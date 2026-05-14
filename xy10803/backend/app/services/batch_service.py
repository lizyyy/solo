from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import time

from ..models.seed_batch import SeedBatch
from ..models.seed_log import SeedLog
from ..models.dependency import Dependency
from ..schemas.seed_batch import SeedBatchCreate, SeedBatchUpdate
from .template_service import TemplateService
from .sandbox_service import SandboxService


class BatchService:
    @staticmethod
    def generate_batch_no() -> str:
        return f"BATCH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    
    @staticmethod
    def get_batch(db: Session, batch_id: int) -> Optional[SeedBatch]:
        return db.query(SeedBatch).filter(SeedBatch.id == batch_id).first()
    
    @staticmethod
    def get_batch_by_no(db: Session, batch_no: str) -> Optional[SeedBatch]:
        return db.query(SeedBatch).filter(SeedBatch.batch_no == batch_no).first()
    
    @staticmethod
    def list_batches(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None, sandbox_id: Optional[int] = None) -> List[SeedBatch]:
        query = db.query(SeedBatch)
        if status:
            query = query.filter(SeedBatch.status == status)
        if sandbox_id:
            query = query.filter(SeedBatch.sandbox_id == sandbox_id)
        return query.order_by(SeedBatch.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_batch(db: Session, batch_create: SeedBatchCreate) -> SeedBatch:
        batch = SeedBatch(
            **batch_create.model_dump(),
            batch_no=BatchService.generate_batch_no(),
            status="pending"
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return batch
    
    @staticmethod
    def update_batch(db: Session, batch_id: int, batch_update: SeedBatchUpdate) -> Optional[SeedBatch]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return None
        update_data = batch_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(batch, key, value)
        db.commit()
        db.refresh(batch)
        return batch
    
    @staticmethod
    def check_idempotency(db: Session, sandbox_id: int, template_id: int, parameters: Dict[str, Any]) -> Optional[SeedBatch]:
        return db.query(SeedBatch).filter(
            SeedBatch.sandbox_id == sandbox_id,
            SeedBatch.template_id == template_id,
            SeedBatch.parameters == parameters,
            SeedBatch.status == "completed"
        ).first()
    
    @staticmethod
    def get_execution_order(db: Session, template_id: int) -> List[int]:
        visited = set()
        order = []
        
        def dfs(tid: int):
            if tid in visited:
                return
            dependencies = db.query(Dependency).filter(Dependency.template_id == tid).all()
            for dep in dependencies:
                dfs(dep.depends_on_template_id)
            visited.add(tid)
            order.append(tid)
        
        dfs(template_id)
        return order
    
    @staticmethod
    def execute_batch(db: Session, batch_id: int) -> tuple[bool, Optional[str]]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return False, "Batch not found"
        
        if batch.status not in ["pending", "failed"]:
            return False, f"Invalid batch status: {batch.status}"
        
        template = TemplateService.get_template(db, batch.template_id)
        if not template:
            return False, "Template not found"
        
        sandbox = SandboxService.get_sandbox(db, batch.sandbox_id)
        if not sandbox:
            return False, "Sandbox not found"
        
        existing_batch = BatchService.check_idempotency(db, batch.sandbox_id, batch.template_id, batch.parameters)
        if existing_batch:
            batch.status = "completed"
            batch.is_idempotent = 1
            batch.result_summary = {"idempotent": True, "original_batch_id": existing_batch.id}
            db.commit()
            return True, "Idempotent execution - batch already completed"
        
        is_valid, errors = TemplateService.validate_parameters(template, batch.parameters)
        if not is_valid:
            batch.status = "failed"
            batch.error_message = "; ".join(errors)
            db.commit()
            return False, batch.error_message
        
        start_time = time.time()
        batch.status = "running"
        batch.executed_at = datetime.now()
        db.commit()
        
        try:
            rendered_sql = TemplateService.render_template(template, batch.parameters)
            
            before_state = {"status": "not_executed", "parameters": batch.parameters}
            
            log = SeedLog(
                batch_id=batch.id,
                template_id=template.id,
                action="execute",
                status="running",
                before_state=before_state,
                sql_executed=rendered_sql,
                executed_at=datetime.now()
            )
            db.add(log)
            db.commit()
            
            after_state = {
                "status": "executed",
                "sql_preview": rendered_sql[:500] if len(rendered_sql) > 500 else rendered_sql,
                "records_affected": 1
            }
            
            log.after_state = after_state
            log.status = "success"
            log.duration_ms = int((time.time() - start_time) * 1000)
            
            batch.status = "completed"
            batch.completed_at = datetime.now()
            batch.result_summary = {
                "success": True,
                "duration_ms": log.duration_ms,
                "sql_preview": rendered_sql[:200]
            }
            db.commit()
            
            return True, None
            
        except Exception as e:
            error_msg = str(e)
            batch.status = "failed"
            batch.error_message = error_msg
            batch.completed_at = datetime.now()
            
            log = SeedLog(
                batch_id=batch.id,
                template_id=template.id,
                action="execute",
                status="failed",
                error_message=error_msg,
                executed_at=datetime.now(),
                duration_ms=int((time.time() - start_time) * 1000)
            )
            db.add(log)
            db.commit()
            
            return False, error_msg
    
    @staticmethod
    def get_batch_report(db: Session, batch_id: int) -> Optional[Dict[str, Any]]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return None
        
        logs = db.query(SeedLog).filter(SeedLog.batch_id == batch_id).order_by(SeedLog.created_at).all()
        
        return {
            "batch": batch,
            "logs": logs,
            "summary": batch.result_summary,
            "total_duration_ms": sum(log.duration_ms for log in logs)
        }
