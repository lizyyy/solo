from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import MaterialCreate, MaterialResponse, MaterialDetailResponse, BatchSubmitRequest, BatchSubmitResponse, QueryFilter
from services import submit_material, batch_submit_materials, query_materials
from models import Material

router = APIRouter()


@router.post("/", response_model=MaterialResponse)
def create_material(material_data: MaterialCreate, db: Session = Depends(get_db)):
    try:
        material, reused, conflict = submit_material(db, material_data)
        return material
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=BatchSubmitResponse)
def batch_create_materials(request: BatchSubmitRequest, db: Session = Depends(get_db)):
    try:
        result = batch_submit_materials(db, request.batch_id, request.materials)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[MaterialResponse])
def list_materials(
    file_summary: str = None,
    status: str = None,
    batch_id: str = None,
    only_needs_confirmation: bool = False,
    db: Session = Depends(get_db)
):
    query_filter = QueryFilter(
        file_summary=file_summary,
        status=status,
        batch_id=batch_id,
        only_needs_confirmation=only_needs_confirmation
    )
    return query_materials(db, query_filter)


@router.get("/{material_id}", response_model=MaterialDetailResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    return material
