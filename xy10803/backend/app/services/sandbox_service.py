from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from ..models.tenant_sandbox import TenantSandbox
from ..schemas.tenant_sandbox import TenantSandboxCreate, TenantSandboxUpdate


class SandboxService:
    @staticmethod
    def get_sandbox(db: Session, sandbox_id: int) -> Optional[TenantSandbox]:
        return db.query(TenantSandbox).filter(TenantSandbox.id == sandbox_id).first()
    
    @staticmethod
    def get_sandbox_by_tenant(db: Session, tenant_id: str, environment: Optional[str] = None) -> List[TenantSandbox]:
        query = db.query(TenantSandbox).filter(TenantSandbox.tenant_id == tenant_id)
        if environment:
            query = query.filter(TenantSandbox.environment == environment)
        return query.all()
    
    @staticmethod
    def list_sandboxes(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None) -> List[TenantSandbox]:
        query = db.query(TenantSandbox)
        if is_active is not None:
            query = query.filter(TenantSandbox.is_active == is_active)
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def create_sandbox(db: Session, sandbox_create: TenantSandboxCreate) -> TenantSandbox:
        sandbox = TenantSandbox(**sandbox_create.model_dump())
        db.add(sandbox)
        db.commit()
        db.refresh(sandbox)
        return sandbox
    
    @staticmethod
    def update_sandbox(db: Session, sandbox_id: int, sandbox_update: TenantSandboxUpdate) -> Optional[TenantSandbox]:
        sandbox = SandboxService.get_sandbox(db, sandbox_id)
        if not sandbox:
            return None
        update_data = sandbox_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(sandbox, key, value)
        db.commit()
        db.refresh(sandbox)
        return sandbox
    
    @staticmethod
    def update_last_cleaned(db: Session, sandbox_id: int) -> Optional[TenantSandbox]:
        sandbox = SandboxService.get_sandbox(db, sandbox_id)
        if not sandbox:
            return None
        sandbox.last_cleaned_at = datetime.now()
        db.commit()
        db.refresh(sandbox)
        return sandbox
