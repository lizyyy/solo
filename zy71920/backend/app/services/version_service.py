from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Artwork, VersionHistory, Lighting
from ..schemas import ArtworkUpdate


FIELD_NAMES_CN = {
    "title": "作品标题",
    "artist": "艺术家",
    "width": "宽度",
    "height": "高度",
    "depth": "深度",
    "unit": "尺寸单位",
    "medium": "媒介",
    "year": "创作年份",
    "wall_location": "展墙位置",
    "position_x": "横向位置",
    "position_y": "纵向位置",
    "status": "状态"
}


def get_next_version(db: Session, artwork_id: int) -> int:
    last_version = db.query(VersionHistory).filter(
        VersionHistory.artwork_id == artwork_id
    ).order_by(VersionHistory.version_number.desc()).first()
    return last_version.version_number + 1 if last_version else 1


def record_change(
    db: Session,
    artwork_id: int,
    field_name: str,
    old_value: Any,
    new_value: Any,
    changed_by: Optional[str] = None,
    change_reason: Optional[str] = None
) -> VersionHistory:
    version_num = get_next_version(db, artwork_id)
    
    history = VersionHistory(
        artwork_id=artwork_id,
        version_number=version_num,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by=changed_by,
        change_reason=change_reason
    )
    db.add(history)
    db.flush()
    return history


def update_artwork_with_history(
    db: Session,
    artwork: Artwork,
    update_data: ArtworkUpdate,
    changed_by: Optional[str] = None
) -> tuple[Artwork, List[Dict[str, Any]]]:
    changes = []
    update_dict = update_data.model_dump(exclude_unset=True, exclude={"change_reason"})
    
    change_reason = update_data.change_reason or "手动修改"
    
    for field, new_value in update_dict.items():
        old_value = getattr(artwork, field)
        
        if field in ["width", "height", "depth", "position_x", "position_y"]:
            old_str = str(round(old_value, 2)) if old_value is not None else None
            new_str = str(round(new_value, 2)) if new_value is not None else None
        else:
            old_str = str(old_value) if old_value is not None else None
            new_str = str(new_value) if new_value is not None else None
        
        if old_str != new_str:
            record_change(
                db, artwork.id, field, old_value, new_value,
                changed_by, change_reason
            )
            
            field_cn = FIELD_NAMES_CN.get(field, field)
            changes.append({
                "field": field,
                "field_cn": field_cn,
                "old_value": old_value,
                "new_value": new_value
            })
            
            setattr(artwork, field, new_value)
    
    if changes:
        artwork.needs_confirmation = True
        if not change_reason:
            artwork.status = "pending"
    
    db.commit()
    db.refresh(artwork)
    return artwork, changes


def compare_versions(
    db: Session,
    artwork_id: int,
    version1: int,
    version2: int
) -> List[Dict[str, Any]]:
    v1_records = db.query(VersionHistory).filter(
        VersionHistory.artwork_id == artwork_id,
        VersionHistory.version_number == version1
    ).all()
    
    v2_records = db.query(VersionHistory).filter(
        VersionHistory.artwork_id == artwork_id,
        VersionHistory.version_number == version2
    ).all()
    
    changes = []
    v1_dict = {r.field_name: r.new_value for r in v1_records}
    v2_dict = {r.field_name: r.new_value for r in v2_records}
    
    all_fields = set(v1_dict.keys()) | set(v2_dict.keys())
    
    for field in all_fields:
        old_val = v1_dict.get(field)
        new_val = v2_dict.get(field)
        
        if old_val != new_val:
            changes.append({
                "field": field,
                "field_cn": FIELD_NAMES_CN.get(field, field),
                "old_value": old_val,
                "new_value": new_val,
                "change_type": "modified" if old_val and new_val else "added" if new_val else "removed"
            })
    
    return changes


def get_artwork_history(db: Session, artwork_id: int) -> List[Dict[str, Any]]:
    records = db.query(VersionHistory).filter(
        VersionHistory.artwork_id == artwork_id
    ).order_by(VersionHistory.timestamp.desc()).all()
    
    history = []
    for record in records:
        history.append({
            "id": record.id,
            "version_number": record.version_number,
            "field": record.field_name,
            "field_cn": FIELD_NAMES_CN.get(record.field_name, record.field_name),
            "old_value": record.old_value,
            "new_value": record.new_value,
            "changed_by": record.changed_by,
            "change_reason": record.change_reason,
            "timestamp": record.timestamp
        })
    
    return history


def check_lighting_lock(db: Session, artwork_id: int) -> tuple[bool, Optional[str]]:
    lighting = db.query(Lighting).filter(Lighting.artwork_id == artwork_id).first()
    if lighting and lighting.is_locked:
        return True, f"该作品的灯光方案已被 {lighting.locked_by or '管理员'} 锁定，如需修改请先解锁"
    return False, None


def lock_lighting(db: Session, lighting_id: int, locked_by: str) -> Lighting:
    lighting = db.query(Lighting).filter(Lighting.id == lighting_id).first()
    if lighting:
        lighting.is_locked = True
        lighting.locked_by = locked_by
        lighting.locked_at = datetime.utcnow()
        db.commit()
        db.refresh(lighting)
    return lighting


def unlock_lighting(db: Session, lighting_id: int) -> Lighting:
    lighting = db.query(Lighting).filter(Lighting.id == lighting_id).first()
    if lighting:
        lighting.is_locked = False
        lighting.locked_by = None
        lighting.locked_at = None
        db.commit()
        db.refresh(lighting)
    return lighting


def detect_swaps(
    db: Session,
    new_artworks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    swaps = []
    existing_artworks = db.query(Artwork).all()
    existing_by_id = {a.artwork_id: a for a in existing_artworks}
    
    for new_art in new_artworks:
        art_id = new_art.get("artwork_id")
        if art_id and art_id in existing_by_id:
            existing = existing_by_id[art_id]
            old_wall = existing.wall_location
            new_wall = new_art.get("wall_location")
            old_x, old_y = existing.position_x, existing.position_y
            new_x = new_art.get("position_x")
            new_y = new_art.get("position_y")
            
            if old_wall != new_wall or (old_x != new_x) or (old_y != new_y):
                swaps.append({
                    "artwork_id": art_id,
                    "title": existing.title,
                    "old_location": f"{old_wall or '未设置'} ({old_x}, {old_y})",
                    "new_location": f"{new_wall or '未设置'} ({new_x}, {new_y})",
                    "message": f"作品 '{existing.title}' 的挂墙位置发生变化，从 {old_wall or '未设置'} 移到 {new_wall or '未设置'}"
                })
    
    return swaps
