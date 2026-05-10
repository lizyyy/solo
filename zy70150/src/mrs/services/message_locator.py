from datetime import datetime
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..database import SessionLocal
from ..models import MessageMetadata
from ..exceptions import InvalidScopeError, NoMessagesFoundError


class MessageLocator:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def close(self):
        if self.db:
            self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def locate(
        self,
        scope_type: str,
        scope_value: Dict[str, Any],
        topic: Optional[str] = None,
        business_type: Optional[str] = None,
    ) -> List[MessageMetadata]:
        query = self.db.query(MessageMetadata)

        if topic:
            query = query.filter(MessageMetadata.topic == topic)
        if business_type:
            query = query.filter(MessageMetadata.business_type == business_type)

        if scope_type == "message_ids":
            message_ids = scope_value.get("message_ids", [])
            if not message_ids:
                raise InvalidScopeError(scope_type, "message_ids 列表不能为空")
            query = query.filter(MessageMetadata.message_id.in_(message_ids))

        elif scope_type == "time_range":
            start_time = scope_value.get("start_time")
            end_time = scope_value.get("end_time")

            if start_time:
                if isinstance(start_time, str):
                    start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                query = query.filter(MessageMetadata.source_timestamp >= start_time)

            if end_time:
                if isinstance(end_time, str):
                    end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                query = query.filter(MessageMetadata.source_timestamp <= end_time)

            if not start_time and not end_time:
                raise InvalidScopeError(scope_type, "必须指定 start_time 或 end_time")

        elif scope_type == "business_keys":
            business_keys = scope_value.get("business_keys", [])
            if not business_keys:
                raise InvalidScopeError(scope_type, "business_keys 列表不能为空")
            query = query.filter(MessageMetadata.business_key.in_(business_keys))

        elif scope_type == "business_ids":
            b_type = scope_value.get("business_type")
            b_ids = scope_value.get("business_ids", [])
            if not b_ids:
                raise InvalidScopeError(scope_type, "business_ids 列表不能为空")
            query = query.filter(MessageMetadata.business_id.in_(b_ids))
            if b_type:
                query = query.filter(MessageMetadata.business_type == b_type)

        elif scope_type == "offset_range":
            topic = scope_value.get("topic")
            partition = scope_value.get("partition")
            start_offset = scope_value.get("start_offset")
            end_offset = scope_value.get("end_offset")

            if not topic:
                raise InvalidScopeError(scope_type, "必须指定 topic")

            query = query.filter(MessageMetadata.topic == topic)
            if partition is not None:
                query = query.filter(MessageMetadata.partition == partition)
            if start_offset is not None:
                query = query.filter(MessageMetadata.offset >= start_offset)
            if end_offset is not None:
                query = query.filter(MessageMetadata.offset <= end_offset)

        else:
            raise InvalidScopeError(scope_type, f"不支持的范围类型: {scope_type}")

        messages = query.order_by(
            MessageMetadata.source_timestamp.asc(),
            MessageMetadata.partition.asc(),
            MessageMetadata.offset.asc(),
        ).all()

        if not messages:
            raise NoMessagesFoundError(scope_type, scope_value)

        return messages

    def get_message_summary(self, messages: List[MessageMetadata]) -> Dict[str, Any]:
        total_amount = sum(m.amount for m in messages if m.amount is not None)
        total_quantity = sum(m.quantity for m in messages if m.quantity is not None)
        total_quota = sum(m.quota for m in messages if m.quota is not None)

        business_types = set(m.business_type for m in messages if m.business_type)
        topics = set(m.topic for m in messages)

        time_range = {
            "earliest": min(m.source_timestamp for m in messages),
            "latest": max(m.source_timestamp for m in messages),
        } if messages else None

        return {
            "count": len(messages),
            "total_amount": total_amount,
            "total_quantity": total_quantity,
            "total_quota": total_quota,
            "business_types": list(business_types),
            "topics": list(topics),
            "time_range": time_range,
        }
