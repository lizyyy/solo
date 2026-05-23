from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MaterialType, TaskType
from ..schemas import MaterialResponse, MaterialListResponse
from ..services import MaterialService, TaskService, MaterialParser, VisitorService

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/upload", response_model=dict)
async def upload_material(
    batch_id: int = Form(...),
    material_type: MaterialType = Form(...),
    uploaded_by: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    material, status = MaterialService.upload_material(
        db,
        batch_id=batch_id,
        material_type=material_type,
        file_name=file.filename or "unknown",
        file_content=content,
        uploaded_by=uploaded_by,
    )
    if not material:
        raise HTTPException(status_code=400, detail=status)
    
    task = TaskService.create_task(
        db,
        task_type=TaskType.PARSE_MATERIAL,
        batch_id=batch_id,
        parameters={"material_id": material.id},
        created_by=uploaded_by,
    )

    return {
        "material": MaterialResponse.model_validate(material),
        "upload_status": status,
        "parse_task_id": task.id,
    }


@router.get("", response_model=MaterialListResponse)
def list_materials(
    batch_id: Optional[int] = None,
    material_type: Optional[MaterialType] = None,
    parsed: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    materials, total = MaterialService.list_materials(
        db, batch_id=batch_id, material_type=material_type, parsed=parsed
    )
    return {
        "total": total,
        "items": [MaterialResponse.model_validate(m) for m in materials],
    }


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = MaterialService.get_material(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return MaterialResponse.model_validate(material)


@router.post("/{material_id}/parse", response_model=dict)
def parse_material(
    material_id: int,
    parsed_by: str = Query(...),
    db: Session = Depends(get_db),
):
    material = MaterialService.get_material(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    try:
        material_type = MaterialType(material.material_type)
        records, metadata = MaterialParser.parse_material(
            material_type, material.file_path
        )

        count = VisitorService.bulk_create_records(
            db,
            batch_id=material.batch_id,
            material_id=material.id,
            records_data=records,
            created_by=parsed_by,
        )

        MaterialService.mark_parsed(db, material_id)

        return {
            "success": True,
            "records_parsed": count,
            "metadata": metadata,
        }
    except Exception as e:
        MaterialService.mark_parsed(db, material_id, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{material_id}")
def delete_material(
    material_id: int,
    deleted_by: str = Query(...),
    db: Session = Depends(get_db),
):
    success = MaterialService.delete_material(db, material_id, deleted_by)
    if not success:
        raise HTTPException(status_code=404, detail="Material not found")
    return {"message": "Material deleted successfully"}
