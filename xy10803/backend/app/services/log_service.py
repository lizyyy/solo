from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.seed_log import SeedLog
from ..schemas.seed_log import SeedLogCreate


class LogService:
    @staticmethod
    def get_log(db: Session, log_id: int) -> Optional[SeedLog]:
        return db.query(SeedLog).filter(SeedLog.id == log_id).first()
    
    @staticmethod
    def list_logs(db: Session, skip: int = 0, limit: int = 100, batch_id: Optional[int] = None, template_id: Optional[int] = None) -> List[SeedLog]:
        query = db.query(SeedLog)
        if batch_id:
            query = query.filter(SeedLog.batch_id == batch_id)
        if template_id:
            query = query.filter(SeedLog.template_id == template_id)
        return query.order_by(SeedLog.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_log(db: Session, log_create: SeedLogCreate) -> SeedLog:
        log = SeedLog(**log_create.model_dump())
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    
    @staticmethod
    def get_state_diff(db: Session, log_id: int) -> Optional[dict]:
        log = LogService.get_log(db, log_id)
        if not log:
            return None
        
        return {
            "before": log.before_state,
            "after": log.after_state,
            "diff": {
                "status": f"{log.before_state.get('status', 'unknown') if log.before_state else 'none'} -> {log.after_state.get('status', 'unknown') if log.after_state else 'none'}"
            } if log.before_state and log.after_state else None
        }
