from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os

from ..database import get_db, Dependency as DBDependency, DependencyPath
from ..lockfile_parser import LockfileParser
from ..services import PathTracker, LicenseMerger
from ..schemas import (
    Dependency, DependencyCreate, LockfileImportRequest,
    LockfileImportResponse, DependencyPathCreate, DependencyPath as SchemaDependencyPath
)

router = APIRouter()


@router.post("/import", response_model=LockfileImportResponse)
async def import_lockfile(
    request: LockfileImportRequest,
    db: Session = Depends(get_db)
):
    if not os.path.exists(request.lockfile_path):
        raise HTTPException(
            status_code=404,
            detail=f"Lockfile not found: {request.lockfile_path}"
        )

    parsed_deps, warnings = LockfileParser.parse(
        request.lockfile_path,
        request.lockfile_type
    )

    lockfile_type = request.lockfile_type or LockfileParser.detect_lockfile_type(request.lockfile_path)

    imported = []
    for parsed in parsed_deps:
        existing = db.query(DBDependency).filter(
            DBDependency.name == parsed.name,
            DBDependency.project_path == request.project_path
        ).first()

        if existing:
            existing.version = parsed.version or existing.version
            existing.license_name = parsed.license_name or existing.license_name
            existing.last_checked_at = datetime.utcnow()
            db_dep = existing
        else:
            db_dep = DBDependency(
                name=parsed.name,
                version=parsed.version,
                package_manager="pip" if lockfile_type and "pip" in lockfile_type.value.lower() else "npm" if lockfile_type and "package" in lockfile_type.value.lower() else "unknown",
                lockfile_type=lockfile_type.value if lockfile_type else None,
                lockfile_path=request.lockfile_path,
                license_name=LicenseMerger.normalize_license(parsed.license_name),
                license_url=parsed.license_url,
                description=parsed.description,
                project_path=request.project_path,
            )
            db.add(db_dep)

        db.commit()
        db.refresh(db_dep)
        imported.append(db_dep)

    return LockfileImportResponse(
        success=True,
        imported_count=len(imported),
        dependencies=imported,
        warnings=warnings
    )


@router.get("/", response_model=List[Dependency])
async def list_dependencies(
    project_path: Optional[str] = None,
    license_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(DBDependency)
    if project_path:
        query = query.filter(DBDependency.project_path == project_path)
    if license_name:
        query = query.filter(DBDependency.license_name == license_name)

    return query.offset(skip).limit(limit).all()


@router.get("/{dependency_id}", response_model=Dependency)
async def get_dependency(dependency_id: int, db: Session = Depends(get_db)):
    dep = db.query(DBDependency).filter(DBDependency.id == dependency_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    return dep


@router.delete("/{dependency_id}")
async def delete_dependency(dependency_id: int, db: Session = Depends(get_db)):
    dep = db.query(DBDependency).filter(DBDependency.id == dependency_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    db.delete(dep)
    db.commit()
    return {"success": True}


@router.post("/{dependency_id}/track-paths", response_model=List[SchemaDependencyPath])
async def track_dependency_paths(
    dependency_id: int,
    project_path: Optional[str] = None,
    db: Session = Depends(get_db)
):
    dep = db.query(DBDependency).filter(DBDependency.id == dependency_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")

    search_path = project_path or dep.project_path
    if not search_path:
        raise HTTPException(status_code=400, detail="No project path specified")

    paths = PathTracker.track_imports(search_path, dep.name)

    db.query(DependencyPath).filter(DependencyPath.dependency_id == dependency_id).delete()

    result = []
    for path_info in paths:
        db_path = DependencyPath(
            dependency_id=dependency_id,
            file_path=path_info['file_path'],
            import_line=path_info['import_line'],
            line_number=path_info['line_number'],
            module_name=path_info['module_name'],
        )
        db.add(db_path)
        db.commit()
        db.refresh(db_path)
        result.append(db_path)

    return result


@router.get("/{dependency_id}/paths", response_model=List[SchemaDependencyPath])
async def get_dependency_paths(dependency_id: int, db: Session = Depends(get_db)):
    return db.query(DependencyPath).filter(DependencyPath.dependency_id == dependency_id).all()


@router.get("/licenses/merged")
async def get_merged_licenses(db: Session = Depends(get_db), project_path: Optional[str] = None):
    query = db.query(DBDependency)
    if project_path:
        query = query.filter(DBDependency.project_path == project_path)

    dependencies = query.all()
    merged = LicenseMerger.merge_licenses(dependencies)

    result = {}
    for license_name, deps in merged.items():
        result[license_name] = {
            "count": len(deps),
            "dependencies": [{"name": d.name, "version": d.version, "id": d.id} for d in deps]
        }

    return result
