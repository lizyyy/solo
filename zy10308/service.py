from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import Message, StatusHistory, Receipt, MessageStatus, STATUS_TRANSITIONS
from schemas import MessageCreate, StatusUpdate, ReceiptCreate

class IdempotentInboxService:
    def __init__(self, db: Session):
        self.db = db

    def _is_within_deduplication_window(self, message: Message) -> bool:
        window_end = message.created_at + timedelta(seconds=message.deduplication_window)
        return datetime.utcnow() <= window_end

    def _record_status_history(self, message: Message, from_status: MessageStatus, 
                                to_status: MessageStatus, reason: str = None, operator: str = None):
        history = StatusHistory(
            message_id=message.id,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            operator=operator
        )
        self.db.add(history)

    def create_message(self, message_data: MessageCreate) -> tuple[Message, bool]:
        existing = self.db.query(Message).filter(
            Message.message_id == message_data.message_id
        ).first()

        if existing:
            if self._is_within_deduplication_window(existing):
                return existing, False
            else:
                old_status = existing.status
                existing.status = MessageStatus.PENDING
                existing.retry_count = 0
                existing.failure_reason = None
                existing.updated_at = datetime.utcnow()
                self._record_status_history(
                    existing, old_status, MessageStatus.PENDING,
                    reason="去重窗口过期，重置消息状态"
                )
                self.db.commit()
                self.db.refresh(existing)
                return existing, True

        message = Message(
            message_id=message_data.message_id,
            source=message_data.source,
            business_key=message_data.business_key,
            deduplication_window=message_data.deduplication_window,
            payload=message_data.payload,
            max_retries=message_data.max_retries
        )
        self.db.add(message)
        self.db.flush()
        self._record_status_history(
            message, None, MessageStatus.PENDING,
            reason="消息创建"
        )
        self.db.commit()
        self.db.refresh(message)
        return message, True

    def get_message(self, message_id: str = None, db_id: int = None) -> Message:
        if message_id:
            return self.db.query(Message).filter(Message.message_id == message_id).first()
        if db_id:
            return self.db.query(Message).filter(Message.id == db_id).first()
        return None

    def can_transition_status(self, current_status: MessageStatus, target_status: MessageStatus) -> bool:
        return target_status in STATUS_TRANSITIONS.get(current_status, [])

    def update_status(self, db_id: int, status_update: StatusUpdate) -> tuple[Message, str]:
        message = self.get_message(db_id=db_id)
        if not message:
            return None, "消息不存在"

        if message.status == status_update.status:
            return message, "状态未变更"

        if not self.can_transition_status(message.status, status_update.status):
            return None, f"不允许从 {message.status.value} 跳转到 {status_update.status.value}"

        old_status = message.status
        message.status = status_update.status
        message.updated_at = datetime.utcnow()

        if status_update.status == MessageStatus.SUCCESS:
            message.processed_at = datetime.utcnow()

        self._record_status_history(
            message, old_status, status_update.status,
            reason=status_update.reason,
            operator=status_update.operator
        )
        self.db.commit()
        self.db.refresh(message)
        return message, "状态更新成功"

    def mark_processing(self, db_id: int, operator: str = None) -> tuple[Message, str]:
        return self.update_status(db_id, StatusUpdate(
            status=MessageStatus.PROCESSING,
            reason="开始处理",
            operator=operator
        ))

    def mark_success(self, db_id: int, operator: str = None) -> tuple[Message, str]:
        return self.update_status(db_id, StatusUpdate(
            status=MessageStatus.SUCCESS,
            reason="处理成功",
            operator=operator
        ))

    def mark_failed(self, db_id: int, failure_reason: str, operator: str = None) -> tuple[Message, str]:
        message = self.get_message(db_id=db_id)
        if not message:
            return None, "消息不存在"

        message.failure_reason = failure_reason
        message.retry_count += 1
        self.db.commit()

        result, msg = self.update_status(db_id, StatusUpdate(
            status=MessageStatus.FAILED,
            reason=failure_reason,
            operator=operator
        ))
        return result, msg

    def retry(self, db_id: int, operator: str = None) -> tuple[Message, str]:
        message = self.get_message(db_id=db_id)
        if not message:
            return None, "消息不存在"

        if message.status != MessageStatus.FAILED:
            return None, "只有失败状态的消息可以重试"

        if message.retry_count >= message.max_retries:
            return None, f"已达最大重试次数 {message.max_retries}"

        return self.update_status(db_id, StatusUpdate(
            status=MessageStatus.PENDING,
            reason="重试重置为待处理",
            operator=operator
        ))

    def cancel(self, db_id: int, reason: str = "手动撤销", operator: str = None) -> tuple[Message, str]:
        return self.update_status(db_id, StatusUpdate(
            status=MessageStatus.CANCELLED,
            reason=reason,
            operator=operator
        ))

    def add_receipt(self, db_id: int, receipt_data: ReceiptCreate) -> tuple[Receipt, str]:
        message = self.get_message(db_id=db_id)
        if not message:
            return None, "消息不存在"

        receipt = Receipt(
            message_id=db_id,
            receipt_type=receipt_data.receipt_type,
            receipt_data=receipt_data.receipt_data
        )
        self.db.add(receipt)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt, "回执添加成功"

    def query_messages(self, query_params):
        q = self.db.query(Message)

        if query_params.source:
            q = q.filter(Message.source == query_params.source)
        if query_params.business_key:
            q = q.filter(Message.business_key == query_params.business_key)
        if query_params.status:
            q = q.filter(Message.status == query_params.status)
        if query_params.start_time:
            q = q.filter(Message.created_at >= query_params.start_time)
        if query_params.end_time:
            q = q.filter(Message.created_at <= query_params.end_time)

        total = q.count()
        offset = (query_params.page - 1) * query_params.page_size
        messages = q.order_by(Message.created_at.desc()).offset(offset).limit(query_params.page_size).all()

        return messages, total

    def export_messages(self, query_params=None):
        if query_params is None:
            messages = self.db.query(Message).order_by(Message.created_at.desc()).all()
        else:
            messages, _ = self.query_messages(query_params)

        result = []
        for msg in messages:
            msg_dict = {
                "id": msg.id,
                "message_id": msg.message_id,
                "source": msg.source,
                "business_key": msg.business_key,
                "status": msg.status.value,
                "retry_count": msg.retry_count,
                "max_retries": msg.max_retries,
                "failure_reason": msg.failure_reason,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "updated_at": msg.updated_at.isoformat() if msg.updated_at else None,
                "processed_at": msg.processed_at.isoformat() if msg.processed_at else None,
                "status_history": [
                    {
                        "from": h.from_status.value if h.from_status else None,
                        "to": h.to_status.value,
                        "reason": h.reason,
                        "operator": h.operator,
                        "time": h.created_at.isoformat()
                    } for h in msg.status_history
                ],
                "receipts": [
                    {
                        "type": r.receipt_type,
                        "data": r.receipt_data,
                        "time": r.created_at.isoformat()
                    } for r in msg.receipts
                ]
            }
            result.append(msg_dict)
        return result
