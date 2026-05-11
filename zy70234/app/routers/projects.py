from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.errors import BusinessError
from app.schemas import (
    CheckProjectCreate, CheckProjectResponse,
    ProjectDependencyCreate, ProjectDependencyResponse,
    ErrorResponse
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["检查项目"])


@router.post("/", response_model=CheckProjectResponse, summary="创建检查项目")
def create_project(data: CheckProjectCreate, db: Session = Depends(get_db)):
    try:
        service = ProjectService(db)
        return service.create_project(data)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/{project_id}", response_model=CheckProjectResponse, summary="获取检查项目详情")
def get_project(project_id: int, db: Session = Depends(get_db)):
    try:
        service = ProjectService(db)
        return service.get_project(project_id)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/", response_model=List[CheckProjectResponse], summary="列出所有检查项目")
def list_projects(project_type: str = None, db: Session = Depends(get_db)):
    service = ProjectService(db)
    return service.list_projects(project_type)


@router.post("/dependencies/", response_model=ProjectDependencyResponse, summary="创建项目依赖")
def create_dependency(data: ProjectDependencyCreate, db: Session = Depends(get_db)):
    try:
        service = ProjectService(db)
        return service.create_dependency(data)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/{project_id}/dependencies/", summary="获取项目依赖列表")
def get_project_dependencies(project_id: int, db: Session = Depends(get_db)):
    service = ProjectService(db)
    dependencies = service.get_project_dependencies(project_id)
    return {
        "project_id": project_id,
        "dependencies": [
            {
                "id": d.id,
                "dependency_project_id": d.dependency_project_id,
                "dependency_type": d.dependency_type,
            }
            for d in dependencies
        ]
    }
