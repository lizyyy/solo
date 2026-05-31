import pandas as pd
import io
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Artwork, ImportSession, Lighting
from ..schemas import ArtworkCreate
from .validation_service import validate_artwork_data, validate_dimensions
from .version_service import detect_swaps


def read_excel_file(file_content: bytes) -> pd.DataFrame:
    excel_file = io.BytesIO(file_content)
    df = pd.read_excel(excel_file)
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]
    return df


def normalize_row(row: pd.Series) -> Dict[str, Any]:
    data = {}
    
    column_mapping = {
        "作品编号": "artwork_id",
        "artwork_id": "artwork_id",
        "id": "artwork_id",
        "作品名称": "title",
        "标题": "title",
        "title": "title",
        "艺术家": "artist",
        "作者": "artist",
        "artist": "artist",
        "宽度": "width",
        "宽": "width",
        "width": "width",
        "高度": "height",
        "高": "height",
        "height": "height",
        "深度": "depth",
        "depth": "depth",
        "单位": "unit",
        "unit": "unit",
        "媒介": "medium",
        "材料": "medium",
        "medium": "medium",
        "年份": "year",
        "创作年份": "year",
        "year": "year",
        "展墙": "wall_location",
        "展墙位置": "wall_location",
        "wall_location": "wall_location",
        "位置x": "position_x",
        "横向位置": "position_x",
        "position_x": "position_x",
        "位置y": "position_y",
        "纵向位置": "position_y",
        "position_y": "position_y",
    }
    
    for col in row.index:
        col_normalized = str(col).strip().lower()
        if col_normalized in column_mapping:
            field = column_mapping[col_normalized]
            value = row[col]
            if pd.isna(value):
                data[field] = None
            else:
                data[field] = str(value).strip() if isinstance(value, str) else value
    
    if "unit" not in data or not data["unit"]:
        data["unit"] = "cm"
    
    return data


def import_artworks_from_excel(
    db: Session,
    file_content: bytes,
    filename: str,
    session_name: Optional[str] = None
) -> Tuple[Dict[str, Any], List[Artwork]]:
    try:
        df = read_excel_file(file_content)
    except Exception as e:
        return {
            "success": False,
            "message": f"无法读取Excel文件：{str(e)}",
            "issues": []
        }, []
    
    all_issues: List[Dict[str, Any]] = []
    imported_artworks: List[Artwork] = []
    success_count = 0
    warning_count = 0
    error_count = 0
    
    normalized_data_list = []
    
    for idx, row in df.iterrows():
        row_num = idx + 2
        data = normalize_row(row)
        normalized_data_list.append(data)
        
        is_valid, issues = validate_artwork_data(data, row_num)
        
        if "width" in data and "height" in data and data["width"] and data["height"]:
            try:
                w = float(data["width"])
                h = float(data["height"])
                u = str(data.get("unit", "cm"))
                dim_issues = validate_dimensions(w, h, u)
                for issue in dim_issues:
                    issue["row"] = row_num
                    issue["artwork_id"] = data.get("artwork_id")
                    issues.append(issue)
            except:
                pass
        
        for issue in issues:
            if issue["severity"] == "error":
                error_count += 1
            else:
                warning_count += 1
        
        all_issues.extend(issues)
        
        if is_valid:
            try:
                existing = db.query(Artwork).filter(Artwork.artwork_id == data["artwork_id"]).first()
                
                artwork_data = ArtworkCreate(
                    artwork_id=str(data["artwork_id"]),
                    title=str(data.get("title", "")),
                    artist=str(data.get("artist", "")),
                    width=float(data.get("width", 0)),
                    height=float(data.get("height", 0)),
                    depth=float(data["depth"]) if data.get("depth") else None,
                    unit=str(data.get("unit", "cm")),
                    medium=str(data["medium"]) if data.get("medium") else None,
                    year=str(data["year"]) if data.get("year") else None,
                    wall_location=str(data["wall_location"]) if data.get("wall_location") else None,
                    position_x=float(data["position_x"]) if data.get("position_x") else None,
                    position_y=float(data["position_y"]) if data.get("position_y") else None,
                )
                
                if existing:
                    existing.title = artwork_data.title
                    existing.artist = artwork_data.artist
                    existing.width = artwork_data.width
                    existing.height = artwork_data.height
                    existing.depth = artwork_data.depth
                    existing.unit = artwork_data.unit
                    existing.medium = artwork_data.medium
                    existing.year = artwork_data.year
                    existing.wall_location = artwork_data.wall_location
                    existing.position_x = artwork_data.position_x
                    existing.position_y = artwork_data.position_y
                    existing.issues = issues
                    existing.needs_confirmation = len(issues) > 0
                    existing.updated_at = datetime.utcnow()
                    db.commit()
                    db.refresh(existing)
                    imported_artworks.append(existing)
                else:
                    artwork = Artwork(
                        **artwork_data.model_dump(),
                        issues=issues,
                        needs_confirmation=len(issues) > 0
                    )
                    db.add(artwork)
                    db.commit()
                    db.refresh(artwork)
                    imported_artworks.append(artwork)
                
                success_count += 1
            except Exception as e:
                error_count += 1
                all_issues.append({
                    "row": row_num,
                    "artwork_id": data.get("artwork_id"),
                    "type": "import_error",
                    "message": f"导入失败：{str(e)}",
                    "severity": "error"
                })
    
    swaps = detect_swaps(db, normalized_data_list)
    for swap in swaps:
        all_issues.append({
            "row": 0,
            "artwork_id": swap["artwork_id"],
            "type": "position_change",
            "message": swap["message"],
            "severity": "warning"
        })
        warning_count += 1
    
    session = ImportSession(
        session_name=session_name or f"导入 {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        filename=filename,
        total_records=len(df),
        success_count=success_count,
        warning_count=warning_count,
        error_count=error_count,
        issues=all_issues
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {
        "success": True,
        "session_id": session.id,
        "message": f"导入完成：成功 {success_count} 条，警告 {warning_count} 条，错误 {error_count} 条",
        "total_records": len(df),
        "success_count": success_count,
        "warning_count": warning_count,
        "error_count": error_count,
        "issues": all_issues
    }, imported_artworks


def export_artworks_to_excel(
    db: Session,
    artwork_ids: Optional[List[int]] = None,
    include_lighting: bool = True
) -> bytes:
    query = db.query(Artwork)
    if artwork_ids:
        query = query.filter(Artwork.id.in_(artwork_ids))
    artworks = query.all()
    
    data = []
    for artwork in artworks:
        row = {
            "作品编号": artwork.artwork_id,
            "作品名称": artwork.title,
            "艺术家": artwork.artist,
            "宽度": artwork.width,
            "高度": artwork.height,
            "深度": artwork.depth,
            "单位": artwork.unit,
            "媒介": artwork.medium,
            "年份": artwork.year,
            "展墙位置": artwork.wall_location,
            "横向位置(cm)": artwork.position_x,
            "纵向位置(cm)": artwork.position_y,
            "状态": artwork.status,
            "待确认": "是" if artwork.needs_confirmation else "否"
        }
        
        if include_lighting:
            lighting = db.query(Lighting).filter(Lighting.artwork_id == artwork.id).first()
            if lighting:
                row.update({
                    "灯光类型": lighting.light_type,
                    "灯光强度": lighting.intensity,
                    "色温": lighting.color_temp,
                    "灯光角度": lighting.angle,
                    "灯光备注": lighting.notes,
                    "灯光锁定": "是" if lighting.is_locked else "否"
                })
        
        data.append(row)
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='作品清单')
    return output.getvalue()
