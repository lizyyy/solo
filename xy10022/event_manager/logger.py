import logging
from datetime import datetime
from sqlalchemy.orm import Session

from .config import config
from .database import get_db, get_session
from .models import AuditLog, LogLevel

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AuditLogger:
    def log(self, action: str, details=None, user_id=None, resource_type=None, resource_id=None, level=LogLevel.INFO):
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            level=level
        )
        
        db = get_session()
        try:
            db.add(log_entry)
            db.commit()
        except Exception as e:
            logger.error(f'写入审计日志失败: {e}')
            db.rollback()
        finally:
            db.close()
        
        log_func = getattr(logger, level.value, logger.info)
        log_func(f'[{action}] user={user_id}, resource={resource_type}:{resource_id}, details={details}')

audit_logger = AuditLogger()

def log_action(action: str, details=None, user_id=None, resource_type=None, resource_id=None):
    audit_logger.log(action, details, user_id, resource_type, resource_id, LogLevel.INFO)

def log_error(action: str, details=None, user_id=None, resource_type=None, resource_id=None):
    audit_logger.log(action, details, user_id, resource_type, resource_id, LogLevel.ERROR)

def log_warning(action: str, details=None, user_id=None, resource_type=None, resource_id=None):
    audit_logger.log(action, details, user_id, resource_type, resource_id, LogLevel.WARNING)
