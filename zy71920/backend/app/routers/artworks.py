from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Artwork, Lighting, ImportSession
from ..schemas import (
    Artwork as ArtworkSchema,
    ArtworkCreate,
    ArtworkUpdate,
    Lighting as LightingSchema,
    LightingCreate,
    LightingUpdate,
    ImportResult,
    ConfirmationRequest
)
from ..services.import_export_service import import_artworks_from_excel, export_artworks_to_excel
from ..services.version_service import (
    update_artwork_with_history,
    get_artwork_history,
    check_lighting_lock,
    lock_lighting,
    unlock_lighting
)

router = APIRouter(prefix="/api/artworks", tags=["artworks"])


@router.get("/", response_model=List[ArtworkSchema])
def get_artworks(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    needs_confirmation: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Artwork)
    if status:
        query = query.filter(Artwork.status == status)
    if needs_confirmation is not None:
        query = query.filter(Artwork.needs_confirmation == needs_confirmation)
    return query.offset(skip).limit(limit).all()


@router.get("/{artwork_id}", response_model=ArtworkSchema)
def get_artwork(artwork_id: int, db: Session = Depends(get_db)):
    artwork = db.query(Artwork).filter(Artwork.id == artwork_id).first()
    if not artwork:
        raise HTTPException(status_code=404, detail="作品不存在")
    return artwork


@router.post("/", response_model=ArtworkSchema)
def create_artwork(artwork: ArtworkCreate, db: Session = Depends(get_db)):
    db_artwork = Artwork(**artwork.model_dump())
    db.add(db_artwork)
    db.commit()
    db.refresh(db_artwork)
    return db_artwork


@router.put("/{artwork_id}", response_model=ArtworkSchema)
def update_artwork(
    artwork_id: int,
    artwork_update: ArtworkUpdate,
    db: Session = Depends(get_db)
):
    artwork = db.query(Artwork).filter(Artwork.id == artwork_id).first()
    if not artwork:
        raise HTTPException(status_code=404, detail="作品不存在")
    
    updated_artwork, changes = update_artwork_with_history(db, artwork, artwork_update)
    return updated_artwork


@router.delete("/{artwork_id}")
def delete_artwork(artwork_id: int, db: Session = Depends(get_db)):
    artwork = db.query(Artwork).filter(Artwork.id == artwork_id).first()
    if not artwork:
        raise HTTPException(status_code=404, detail="作品不存在")
    db.delete(artwork)
    db.commit()
    return {"message": "作品已删除"}


@router.post("/import", response_model=ImportResult)
async def import_artworks(
    file: UploadFile = File(...),
    session_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传Excel文件 (.xlsx 或 .xls)")
    
    content = await file.read()
    result, _ = import_artworks_from_excel(db, content, file.filename, session_name)
    return result


@router.post("/export")
async def export_artworks(
    artwork_ids: Optional[List[int]] = Query(None),
    include_lighting: bool = True,
    db: Session = Depends(get_db)
):
    excel_content = export_artworks_to_excel(db, artwork_ids, include_lighting)
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=artworks_export.xlsx"}
    )


@router.post("/confirm")
def confirm_artworks(request: ConfirmationRequest, db: Session = Depends(get_db)):
    artworks = db.query(Artwork).filter(Artwork.id.in_(request.artwork_ids)).all()
    for artwork in artworks:
        artwork.needs_confirmation = not request.confirmed
        if request.confirmed:
            artwork.status = "confirmed"
    db.commit()
    return {
        "message": f"已确认 {len(artworks)} 件作品",
        "confirmed_count": len(artworks)
    }


@router.get("/{artwork_id}/history")
def get_history(artwork_id: int, db: Session = Depends(get_db)):
    artwork = db.query(Artwork).filter(Artwork.id == artwork_id).first()
    if not artwork:
        raise HTTPException(status_code=404, detail="作品不存在")
    return get_artwork_history(db, artwork_id)


@router.get("/{artwork_id}/lighting", response_model=Optional[LightingSchema])
def get_lighting(artwork_id: int, db: Session = Depends(get_db)):
    return db.query(Lighting).filter(Lighting.artwork_id == artwork_id).first()


@router.post("/{artwork_id}/lighting", response_model=LightingSchema)
def create_lighting(artwork_id: int, lighting: LightingCreate, db: Session = Depends(get_db)):
    is_locked, lock_msg = check_lighting_lock(db, artwork_id)
    if is_locked:
        raise HTTPException(status_code=400, detail=lock_msg)
    
    artwork = db.query(Artwork).filter(Artwork.id == artwork_id).first()
    if not artwork:
        raise HTTPException(status_code=404, detail="作品不存在")
    
    db_lighting = Lighting(**lighting.model_dump())
    db.add(db_lighting)
    db.commit()
    db.refresh(db_lighting)
    return db_lighting


@router.put("/lighting/{lighting_id}", response_model=LightingSchema)
def update_lighting(lighting_id: int, lighting_update: LightingUpdate, db: Session = Depends(get_db)):
    lighting = db.query(Lighting).filter(Lighting.id == lighting_id).first()
    if not lighting:
        raise HTTPException(status_code=404, detail="灯光方案不存在")
    
    if lighting.is_locked and not lighting_update.is_locked:
        raise HTTPException(status_code=400, detail="灯光方案已锁定，如需修改请先解锁")
    
    update_data = lighting_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lighting, key, value)
    
    db.commit()
    db.refresh(lighting)
    return lighting


@router.post("/lighting/{lighting_id}/lock")
def lock_lighting_endpoint(lighting_id: int, locked_by: str = "当前用户", db: Session = Depends(get_db)):
    lighting = lock_lighting(db, lighting_id, locked_by)
    if not lighting:
        raise HTTPException(status_code=404, detail="灯光方案不存在")
    return {"message": "灯光方案已锁定", "lighting_id": lighting_id}


@router.post("/lighting/{lighting_id}/unlock")
def unlock_lighting_endpoint(lighting_id: int, db: Session = Depends(get_db)):
    lighting = unlock_lighting(db, lighting_id)
    if not lighting:
        raise HTTPException(status_code=404, detail="灯光方案不存在")
    return {"message": "灯光方案已解锁", "lighting_id": lighting_id}


@router.get("/import/sessions")
def get_import_sessions(db: Session = Depends(get_db)):
    return db.query(ImportSession).order_by(ImportSession.created_at.desc()).all()
