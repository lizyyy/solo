import hashlib
import json
from typing import Any, Dict, List, Optional
from datetime import datetime

from .models import CompensationMessage, MessageStatus
from .database import QueueDatabase


class IdempotentManager:
    def __init__(self, db: QueueDatabase):
        self.db = db
    
    def generate_key(self, payload: Dict[str, Any], 
                     key_fields: Optional[List[str]] = None,
                     topic: Optional[str] = None) -> str:
        if key_fields:
            key_data = {k: payload.get(k) for k in key_fields if k in payload}
        else:
            key_data = payload
        
        sorted_data = self._deep_sort(key_data)
        key_str = json.dumps(sorted_data, sort_keys=True, ensure_ascii=False)
        
        if topic:
            key_str = f"{topic}:{key_str}"
        
        return hashlib.sha256(key_str.encode("utf-8")).hexdigest()
    
    def _deep_sort(self, obj: Any) -> Any:
        if isinstance(obj, dict):
            return sorted((k, self._deep_sort(v)) for k, v in obj.items())
        elif isinstance(obj, list):
            return sorted(self._deep_sort(x) for x in obj)
        else:
            return obj
    
    def check_duplicates(self, message: CompensationMessage) -> List[CompensationMessage]:
        if not message.idempotent_key:
            return []
        
        duplicates = self.db.list_messages(
            idempotent_key=message.idempotent_key,
        )
        
        return [m for m in duplicates if m.id != message.id]
    
    def find_success_message(self, message: CompensationMessage) -> Optional[CompensationMessage]:
        if not message.idempotent_key:
            return None
        
        messages = self.db.list_messages(
            idempotent_key=message.idempotent_key,
            status=MessageStatus.SUCCESS,
        )
        
        return messages[0] if messages else None
    
    def get_duplicate_groups(self) -> Dict[str, List[CompensationMessage]]:
        duplicates = self.db.get_duplicate_idempotent_keys()
        groups: Dict[str, List[CompensationMessage]] = {}
        
        for key, _ in duplicates:
            messages = self.db.list_messages(idempotent_key=key)
            groups[key] = messages
        
        return groups
    
    def analyze_duplicate_group(self, key: str) -> Dict[str, Any]:
        messages = self.db.list_messages(idempotent_key=key)
        
        has_success = any(m.status == MessageStatus.SUCCESS for m in messages)
        all_dead = all(m.status == MessageStatus.DEAD_LETTER for m in messages)
        oldest = min(messages, key=lambda m: m.created_at)
        newest = max(messages, key=lambda m: m.created_at)
        
        return {
            "key": key,
            "count": len(messages),
            "has_success": has_success,
            "all_dead": all_dead,
            "oldest_message": oldest.id,
            "newest_message": newest.id,
            "time_span_hours": (newest.created_at - oldest.created_at).total_seconds() / 3600,
            "messages": messages,
        }
    
    def safe_to_delete(self, message: CompensationMessage) -> bool:
        if not message.idempotent_key:
            return message.status == MessageStatus.SUCCESS
        
        success_msg = self.find_success_message(message)
        if success_msg and success_msg.id != message.id:
            return True
        
        return message.status == MessageStatus.SUCCESS
    
    def get_retry_chain(self, message: CompensationMessage) -> List[CompensationMessage]:
        if not message.idempotent_key:
            return [message]
        
        chain = self.db.list_messages(
            idempotent_key=message.idempotent_key,
            order_by="created_at",
            order_dir="ASC",
        )
        return chain
