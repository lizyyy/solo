import uuid
from datetime import datetime
from typing import List, Optional

from drill_service.storage import Storage
from drill_service.models import OperationHistory, OperationType


class HistoryService:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def record_operation(
        self,
        plan_id: str,
        operation_type: OperationType,
        operator: str,
        details: str,
    ) -> OperationHistory:
        history = OperationHistory(
            history_id=str(uuid.uuid4()),
            plan_id=plan_id,
            operation_type=operation_type,
            operator=operator,
            timestamp=self._now(),
            details=details,
        )
        self.storage.save_history(history)
        return history
    
    def get_plan_history(self, plan_id: str) -> List[OperationHistory]:
        return self.storage.list_history_by_plan(plan_id)
    
    def withdraw_operation(
        self,
        history_id: str,
        withdrawn_by: str,
        reason: str,
    ) -> Optional[OperationHistory]:
        history = self.storage.get_history(history_id)
        if history is None:
            return None
        if history.is_withdrawn:
            raise ValueError(f"操作 {history_id} 已经被撤回")
        
        history.is_withdrawn = True
        history.withdrawn_by = withdrawn_by
        history.withdrawn_at = self._now()
        self.storage.save_history(history)
        
        self.record_operation(
            plan_id=history.plan_id,
            operation_type=OperationType.WITHDRAW,
            operator=withdrawn_by,
            details=f"撤回操作 {history_id}: {reason}",
        )
        return history
    
    def get_effective_history(self, plan_id: str) -> List[OperationHistory]:
        all_history = self.get_plan_history(plan_id)
        return [h for h in all_history if not h.is_withdrawn]
    
    def _now(self) -> str:
        return datetime.now().isoformat()
