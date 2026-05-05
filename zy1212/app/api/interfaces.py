from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Project, Interface
from app.schemas import (
    Interface as InterfaceSchema,
    InterfaceCreate,
    InterfaceUpdate,
    InterfaceList,
    InterfaceImportRequest,
    InterfaceImportResult,
)

router = APIRouter(prefix="/interfaces", tags=["Interfaces"])


@router.post("/", response_model=InterfaceSchema, status_code=201)
def create_interface(interface: InterfaceCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == interface.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db_interface = Interface(
        project_id=interface.project_id,
        name=interface.name,
        method=interface.method.value,
        path=interface.path,
        description=interface.description,
        request_headers=interface.request_headers,
        request_body=interface.request_body,
        request_params=interface.request_params,
        response_schema=interface.response_schema,
        expected_response_time_ms=interface.expected_response_time_ms,
        priority=interface.priority.value,
        tags=interface.tags,
        is_active=interface.is_active,
    )
    db.add(db_interface)
    db.commit()
    db.refresh(db_interface)
    return db_interface


@router.get("/", response_model=InterfaceList)
def list_interfaces(
    project_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    method: Optional[str] = None,
    priority: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Interface)
    
    if project_id:
        query = query.filter(Interface.project_id == project_id)
    
    if method:
        query = query.filter(Interface.method == method.upper())
    
    if priority:
        query = query.filter(Interface.priority == priority.lower())
    
    if is_active is not None:
        query = query.filter(Interface.is_active == is_active)
    
    total = query.count()
    interfaces = query.offset(skip).limit(limit).all()
    
    return InterfaceList(
        total=total,
        items=interfaces,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{interface_id}", response_model=InterfaceSchema)
def get_interface(interface_id: int, db: Session = Depends(get_db)):
    interface = db.query(Interface).filter(Interface.id == interface_id).first()
    if not interface:
        raise HTTPException(status_code=404, detail="接口不存在")
    return interface


@router.put("/{interface_id}", response_model=InterfaceSchema)
def update_interface(
    interface_id: int,
    interface_update: InterfaceUpdate,
    db: Session = Depends(get_db),
):
    interface = db.query(Interface).filter(Interface.id == interface_id).first()
    if not interface:
        raise HTTPException(status_code=404, detail="接口不存在")
    
    update_data = interface_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(interface, key):
            if key == 'method' and value:
                setattr(interface, key, value.value)
            elif key == 'priority' and value:
                setattr(interface, key, value.value)
            else:
                setattr(interface, key, value)
    
    db.commit()
    db.refresh(interface)
    return interface


@router.delete("/{interface_id}", status_code=204)
def delete_interface(interface_id: int, db: Session = Depends(get_db)):
    interface = db.query(Interface).filter(Interface.id == interface_id).first()
    if not interface:
        raise HTTPException(status_code=404, detail="接口不存在")
    
    db.delete(interface)
    db.commit()


@router.post("/import", response_model=InterfaceImportResult)
def import_interfaces(
    import_request: InterfaceImportRequest,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == import_request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    created = 0
    updated = 0
    skipped = 0
    errors = []
    
    for i, interface_data in enumerate(import_request.interfaces):
        try:
            existing_interface = db.query(Interface).filter(
                Interface.project_id == import_request.project_id,
                Interface.method == interface_data.method.value,
                Interface.path == interface_data.path,
            ).first()
            
            if existing_interface:
                if import_request.overwrite_existing:
                    update_data = interface_data.model_dump(exclude={'project_id'})
                    for key, value in update_data.items():
                        if hasattr(existing_interface, key):
                            if key == 'method' and value:
                                setattr(existing_interface, key, value.value)
                            elif key == 'priority' and value:
                                setattr(existing_interface, key, value.value)
                            else:
                                setattr(existing_interface, key, value)
                    db.commit()
                    db.refresh(existing_interface)
                    updated += 1
                else:
                    skipped += 1
            else:
                db_interface = Interface(
                    project_id=import_request.project_id,
                    name=interface_data.name,
                    method=interface_data.method.value,
                    path=interface_data.path,
                    description=interface_data.description,
                    request_headers=interface_data.request_headers,
                    request_body=interface_data.request_body,
                    request_params=interface_data.request_params,
                    response_schema=interface_data.response_schema,
                    expected_response_time_ms=interface_data.expected_response_time_ms,
                    priority=interface_data.priority.value,
                    tags=interface_data.tags,
                    is_active=interface_data.is_active,
                )
                db.add(db_interface)
                db.commit()
                db.refresh(db_interface)
                created += 1
                
        except Exception as e:
            errors.append(f"第 {i+1} 个接口导入失败: {str(e)}")
            db.rollback()
    
    return InterfaceImportResult(
        success=len(errors) == 0,
        total=len(import_request.interfaces),
        created=created,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )
