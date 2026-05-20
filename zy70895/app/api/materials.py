from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import schemas, crud

router = APIRouter(prefix="/materials", tags=["材料管理"])


@router.post("/")
def create_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=material.batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    db_material, is_new = crud.create_material(db=db, material=material)
    
    if not is_new:
        return {
            "message": "材料已存在，返回原有记录",
            "is_duplicate": True,
            "material": db_material
        }
    
    return {
        "message": "材料创建成功",
        "is_duplicate": False,
        "material": db_material
    }


@router.get("/", response_model=List[schemas.Material])
def read_materials(
    batch_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    materials = crud.get_materials(db, batch_id=batch_id, skip=skip, limit=limit)
    return materials


@router.get("/{material_id}", response_model=schemas.Material)
def read_material(material_id: int, db: Session = Depends(get_db)):
    db_material = crud.get_material(db, material_id=material_id)
    if db_material is None:
        raise HTTPException(status_code=404, detail="材料不存在")
    return db_material


@router.get("/{material_id}/detail", response_model=schemas.MaterialDetail)
def get_material_detail(material_id: int, db: Session = Depends(get_db)):
    detail = crud.get_material_with_audit(db, material_id=material_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="材料不存在")
    return detail


@router.put("/{material_id}")
def update_material(
    material_id: int,
    material_update: schemas.MaterialUpdate,
    operator: str = Query(..., description="操作人"),
    change_reason: str = Query(..., description="修改原因"),
    db: Session = Depends(get_db)
):
    db_material = crud.update_material(
        db,
        material_id=material_id,
        material_update=material_update,
        operator=operator,
        change_reason=change_reason
    )
    if db_material is None:
        raise HTTPException(status_code=404, detail="材料不存在")
    return {
        "message": "更新成功",
        "material": db_material
    }


@router.get("/{material_id}/audit-logs", response_model=List[schemas.AuditLog])
def get_material_audit_logs(material_id: int, db: Session = Depends(get_db)):
    db_material = crud.get_material(db, material_id=material_id)
    if db_material is None:
        raise HTTPException(status_code=404, detail="材料不存在")
    return crud.get_audit_logs(db, material_id=material_id)
