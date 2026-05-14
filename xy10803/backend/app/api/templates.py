from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import get_db
from ..schemas.data_template import DataTemplateSchema, DataTemplateCreate, DataTemplateUpdate
from ..schemas.common import Response
from ..services.template_service import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=Response[List[DataTemplateSchema]])
def list_templates(
    skip: int = 0,
    limit: int = 100,
    is_active: bool = None,
    db: Session = Depends(get_db)
):
    templates = TemplateService.list_templates(db, skip=skip, limit=limit, is_active=is_active)
    return Response(data=templates, message="Templates retrieved successfully")


@router.get("/{template_id}", response_model=Response[DataTemplateSchema])
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = TemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(data=template, message="Template retrieved successfully")


@router.post("/", response_model=Response[DataTemplateSchema])
def create_template(template_create: DataTemplateCreate, db: Session = Depends(get_db)):
    template = TemplateService.create_template(db, template_create)
    return Response(data=template, message="Template created successfully", code=201)


@router.put("/{template_id}", response_model=Response[DataTemplateSchema])
def update_template(template_id: int, template_update: DataTemplateUpdate, db: Session = Depends(get_db)):
    template = TemplateService.update_template(db, template_id, template_update)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(data=template, message="Template updated successfully")


@router.delete("/{template_id}", response_model=Response[dict])
def delete_template(template_id: int, db: Session = Depends(get_db)):
    success = TemplateService.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(data={"deleted": True}, message="Template deleted successfully")
