from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import (
    PermissionDeclaration,
    PermissionDeclarationCreate,
    PermissionDeclarationUpdate,
    PermissionMatchResult,
)
from app.services import PermissionService

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.post("/", response_model=PermissionDeclaration)
def create_declaration(
    declaration: PermissionDeclarationCreate, db: Session = Depends(get_db)
):
    return PermissionService.create_declaration(db, declaration)


@router.get("/", response_model=List[PermissionDeclaration])
def get_declarations(active: bool = True, db: Session = Depends(get_db)):
    if active:
        return PermissionService.get_active_declarations(db)
    from app.models import PermissionDeclaration as PDModel
    return db.query(PDModel).all()


@router.get("/{declaration_id}", response_model=PermissionDeclaration)
def get_declaration(declaration_id: int, db: Session = Depends(get_db)):
    declaration = PermissionService.get_declaration(db, declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="Declaration not found")
    return declaration


@router.put("/{declaration_id}", response_model=PermissionDeclaration)
def update_declaration(
    declaration_id: int,
    declaration_update: PermissionDeclarationUpdate,
    db: Session = Depends(get_db),
):
    declaration = PermissionService.update_declaration(
        db, declaration_id, declaration_update
    )
    if not declaration:
        raise HTTPException(status_code=404, detail="Declaration not found")
    return declaration


@router.delete("/{declaration_id}", response_model=PermissionDeclaration)
def deactivate_declaration(declaration_id: int, db: Session = Depends(get_db)):
    declaration = PermissionService.deactivate_declaration(db, declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="Declaration not found")
    return declaration


@router.post("/{declaration_id}/compare", response_model=PermissionMatchResult)
def compare_permissions(declaration_id: int, db: Session = Depends(get_db)):
    result = PermissionService.compare_permissions(db, declaration_id)
    if not result:
        raise HTTPException(status_code=404, detail="Declaration not found")
    return result
