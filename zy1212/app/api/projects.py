from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Project, LoadTestBatch
from app.schemas import (
    Project as ProjectSchema,
    ProjectCreate,
    ProjectUpdate,
    ProjectDetail,
    ProjectList,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectSchema, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    existing_project = db.query(Project).filter(
        Project.name == project.name
    ).first()
    if existing_project:
        raise HTTPException(
            status_code=400,
            detail=f"项目名称 '{project.name}' 已存在"
        )
    
    db_project = Project(
        name=project.name,
        description=project.description,
        service_name=project.service_name,
        environment=project.environment.value if project.environment else "production",
        is_active=project.is_active,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/", response_model=ProjectList)
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    environment: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Project)
    
    if is_active is not None:
        query = query.filter(Project.is_active == is_active)
    
    if environment:
        query = query.filter(Project.environment == environment)
    
    total = query.count()
    
    projects = query.offset(skip).limit(limit).all()
    
    project_details = []
    for project in projects:
        batch_count = db.query(LoadTestBatch).filter(
            LoadTestBatch.project_id == project.id
        ).count()
        
        latest_batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.project_id == project.id
        ).order_by(LoadTestBatch.created_at.desc()).first()
        
        detail = ProjectDetail(
            id=project.id,
            name=project.name,
            description=project.description,
            service_name=project.service_name,
            environment=project.environment,
            is_active=project.is_active,
            created_at=project.created_at,
            updated_at=project.updated_at,
            interface_count=len(project.interfaces) if project.interfaces else 0,
            load_test_batch_count=batch_count,
            latest_batch_status=latest_batch.status if latest_batch else None,
        )
        project_details.append(detail)
    
    return ProjectList(
        total=total,
        items=project_details,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{project_id}", response_model=ProjectSchema)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.put("/{project_id}", response_model=ProjectSchema)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    update_data = project_update.model_dump(exclude_unset=True)
    
    if 'name' in update_data:
        existing_project = db.query(Project).filter(
            Project.name == update_data['name'],
            Project.id != project_id
        ).first()
        if existing_project:
            raise HTTPException(
                status_code=400,
                detail=f"项目名称 '{update_data['name']}' 已存在"
            )
    
    for key, value in update_data.items():
        if hasattr(project, key):
            setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db.delete(project)
    db.commit()
