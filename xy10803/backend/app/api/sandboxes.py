from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import get_db
from ..schemas.tenant_sandbox import TenantSandboxSchema, TenantSandboxCreate, TenantSandboxUpdate
from ..schemas.common import Response
from ..services.sandbox_service import SandboxService

router = APIRouter(prefix="/sandboxes", tags=["sandboxes"])


@router.get("/", response_model=Response[List[TenantSandboxSchema]])
def list_sandboxes(
    skip: int = 0,
    limit: int = 100,
    is_active: bool = None,
    db: Session = Depends(get_db)
):
    sandboxes = SandboxService.list_sandboxes(db, skip=skip, limit=limit, is_active=is_active)
    return Response(data=sandboxes, message="Sandboxes retrieved successfully")


@router.get("/{sandbox_id}", response_model=Response[TenantSandboxSchema])
def get_sandbox(sandbox_id: int, db: Session = Depends(get_db)):
    sandbox = SandboxService.get_sandbox(db, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    return Response(data=sandbox, message="Sandbox retrieved successfully")


@router.post("/", response_model=Response[TenantSandboxSchema])
def create_sandbox(sandbox_create: TenantSandboxCreate, db: Session = Depends(get_db)):
    sandbox = SandboxService.create_sandbox(db, sandbox_create)
    return Response(data=sandbox, message="Sandbox created successfully", code=201)


@router.put("/{sandbox_id}", response_model=Response[TenantSandboxSchema])
def update_sandbox(sandbox_id: int, sandbox_update: TenantSandboxUpdate, db: Session = Depends(get_db)):
    sandbox = SandboxService.update_sandbox(db, sandbox_id, sandbox_update)
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    return Response(data=sandbox, message="Sandbox updated successfully")
