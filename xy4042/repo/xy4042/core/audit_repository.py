from datetime import datetime
from typing import List, Optional

from models.audit_log import AuditLog
from core.base_repository import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    def _table_name(self) -> str:
        return "audit_logs"
    
    def _row_to_model(self, row) -> AuditLog:
        return AuditLog.from_row(row)
    
    def create(self, log: AuditLog) -> AuditLog:
        now = datetime.now()
        sql = """
            INSERT INTO audit_logs (
                order_id, action, details, old_value, new_value, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                log.order_id, log.action, log.details,
                log.old_value, log.new_value, now
            )
        )
        log.id = cursor.lastrowid
        log.created_at = now
        return log
    
    def log(
        self,
        action: str,
        details: str = "",
        order_id: Optional[int] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None
    ) -> AuditLog:
        log = AuditLog(
            order_id=order_id,
            action=action,
            details=details,
            old_value=old_value,
            new_value=new_value
        )
        return self.create(log)
    
    def get_by_order(self, order_id: int, limit: int = 100) -> List[AuditLog]:
        sql = """
            SELECT * FROM audit_logs 
            WHERE order_id = ? 
            ORDER BY created_at DESC
            LIMIT ?
        """
        cursor = self.db.execute(sql, (order_id, limit))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_action(self, action: str, limit: int = 100) -> List[AuditLog]:
        sql = """
            SELECT * FROM audit_logs 
            WHERE action = ? 
            ORDER BY created_at DESC
            LIMIT ?
        """
        cursor = self.db.execute(sql, (action, limit))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_recent(self, limit: int = 50) -> List[AuditLog]:
        sql = """
            SELECT * FROM audit_logs 
            ORDER BY created_at DESC
            LIMIT ?
        """
        cursor = self.db.execute(sql, (limit,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
