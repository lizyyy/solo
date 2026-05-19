from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
from app.models import OperationHistory
from app.utils.mask import mask_sensitive_data


class HistoryService:
    @staticmethod
    def record_operation(
        db: Session,
        operation_type: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        changes: Optional[Dict[str, Any]] = None,
        operator: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        notes: Optional[str] = None
    ) -> OperationHistory:
        
        history = OperationHistory(
            operation_type=operation_type,
            entity_type=entity_type,
            entity_id=entity_id,
            operator=operator,
            before_data=mask_sensitive_data(before_data) if before_data else None,
            after_data=mask_sensitive_data(after_data) if after_data else None,
            changes=mask_sensitive_data(changes) if changes else None,
            ip_address=ip_address,
            user_agent=user_agent,
            notes=notes
        )
        
        db.add(history)
        db.commit()
        db.refresh(history)
        
        return history
    
    @staticmethod
    def get_entity_before_data(entity) -> Dict[str, Any]:
        if hasattr(entity, '__dict__'):
            data = {k: v for k, v in entity.__dict__.items() if not k.startswith('_')}
            return data
        return {}
    
    @staticmethod
    def calculate_changes(before_data: Dict[str, Any], after_data: Dict[str, Any]) -> Dict[str, Any]:
        changes = {}
        all_keys = set(before_data.keys()) | set(after_data.keys())
        
        for key in all_keys:
            before_val = before_data.get(key)
            after_val = after_data.get(key)
            
            if before_val != after_val:
                changes[key] = {
                    "before": before_val,
                    "after": after_val
                }
        
        return changes
