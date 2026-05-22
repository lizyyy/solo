import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
from models import (
    Base, MedicineRecord, QueueItem, RetryLog, StatusHistory,
    DirtyRecord, RecordSnapshot, Attachment, CompensationRecord,
    QueueStatus, DirtyType, RetryCategory, MedicineRecordCreate,
    DiffDetail, SupervisorStats
)


class QueueService:
    def __init__(self, db_url: str = "sqlite:///pharmacy_queue.db"):
        self.engine = create_engine(db_url, echo=False)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def get_session(self) -> Session:
        return self.SessionLocal()
    
    @staticmethod
    def generate_no(prefix: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique = uuid.uuid4().hex[:8].upper()
        return f"{prefix}{timestamp}{unique}"
    
    @staticmethod
    def compute_diff(before: Dict[str, Any], after: Dict[str, Any]) -> Tuple[List[str], Dict[str, Any]]:
        diff_fields = []
        diff_summary = {}
        all_keys = set(before.keys()) | set(after.keys())
        for key in all_keys:
            b_val = before.get(key)
            a_val = after.get(key)
            if b_val != a_val:
                diff_fields.append(key)
                diff_summary[key] = {"before": b_val, "after": a_val}
        return diff_fields, diff_summary
    
    def _record_status_change(
        self,
        session: Session,
        queue_item: QueueItem,
        new_status: str,
        operator: Optional[str] = None,
        reason: Optional[str] = None
    ) -> StatusHistory:
        before_snapshot = {
            "status": queue_item.status,
            "retry_count": queue_item.retry_count,
            "current_quantity": queue_item.current_quantity,
            "current_amount": queue_item.current_amount,
            "external_receipt_no": queue_item.external_receipt_no,
        }
        
        old_status = queue_item.status
        queue_item.status = new_status
        
        after_snapshot = {
            "status": new_status,
            "retry_count": queue_item.retry_count,
            "current_quantity": queue_item.current_quantity,
            "current_amount": queue_item.current_amount,
            "external_receipt_no": queue_item.external_receipt_no,
        }
        
        diff_fields, _ = self.compute_diff(before_snapshot, after_snapshot)
        
        history = StatusHistory(
            queue_item_id=queue_item.id,
            from_status=old_status,
            to_status=new_status,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            diff_fields=diff_fields,
            operator=operator,
            reason=reason
        )
        session.add(history)
        return history
    
    def create_medicine_record(
        self,
        data: MedicineRecordCreate,
        operator: Optional[str] = None
    ) -> MedicineRecord:
        with self.get_session() as session:
            record = MedicineRecord(
                record_no=self.generate_no("REC"),
                **data.dict(exclude_unset=True)
            )
            session.add(record)
            session.flush()
            
            snapshot = RecordSnapshot(
                record_id=record.id,
                snapshot_type="create",
                snapshot_data=data.dict(),
                created_by=operator
            )
            session.add(snapshot)
            session.commit()
            session.refresh(record)
            return record
    
    def add_attachment(
        self,
        record_id: int,
        attachment_type: str,
        file_name: str,
        file_content: bytes,
        uploaded_by: Optional[str] = None,
        meta_data: Optional[Dict[str, Any]] = None
    ) -> Attachment:
        file_hash = hashlib.sha256(file_content).hexdigest()
        with self.get_session() as session:
            attachment = Attachment(
                record_id=record_id,
                attachment_type=attachment_type,
                file_name=file_name,
                file_hash=file_hash,
                meta_data=meta_data or {},
                uploaded_by=uploaded_by
            )
            session.add(attachment)
            session.commit()
            session.refresh(attachment)
            return attachment
    
    def enqueue_record(
        self,
        record_id: int,
        region_id: Optional[str] = None,
        max_retries: int = 5
    ) -> QueueItem:
        with self.get_session() as session:
            record = session.query(MedicineRecord).filter_by(id=record_id).first()
            if not record:
                raise ValueError(f"Medicine record {record_id} not found")
            
            queue_item = QueueItem(
                queue_no=self.generate_no("Q"),
                record_id=record_id,
                store_id=record.store_id,
                region_id=region_id,
                max_retries=max_retries,
                current_quantity=record.quantity,
                current_amount=record.amount
            )
            session.add(queue_item)
            session.flush()
            
            self._record_status_change(
                session, queue_item, QueueStatus.PENDING,
                operator="system", reason="加入重试补偿队列"
            )
            session.commit()
            session.refresh(queue_item)
            return queue_item
    
    def submit_external_receipt(
        self,
        queue_item_id: int,
        receipt_no: str,
        receipt_data: Dict[str, Any],
        operator: Optional[str] = None
    ) -> QueueItem:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            before_data = {
                "external_receipt_no": queue_item.external_receipt_no,
                "external_status": queue_item.external_status
            }
            
            queue_item.external_receipt_no = receipt_no
            queue_item.external_response = receipt_data
            queue_item.external_status = receipt_data.get("status", "received")
            
            after_data = {
                "external_receipt_no": receipt_no,
                "external_status": queue_item.external_status
            }
            
            self._record_status_change(
                session, queue_item, QueueStatus.PROCESSING,
                operator=operator, reason=f"提交外部回执: {receipt_no}"
            )
            
            session.commit()
            session.refresh(queue_item)
            return queue_item
    
    def process_retry(
        self,
        queue_item_id: int,
        retry_category: RetryCategory,
        error_message: Optional[str] = None,
        response_data: Optional[Dict[str, Any]] = None,
        success: bool = False
    ) -> Tuple[QueueItem, RetryLog]:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            before_data = {
                "status": queue_item.status,
                "retry_count": queue_item.retry_count,
                "external_status": queue_item.external_status
            }
            
            queue_item.retry_count += 1
            queue_item.last_processed_at = datetime.utcnow()
            
            after_data = {
                "status": queue_item.status,
                "retry_count": queue_item.retry_count,
                "external_status": queue_item.external_status
            }
            
            _, diff_summary = self.compute_diff(before_data, after_data)
            
            retry_log = RetryLog(
                queue_item_id=queue_item_id,
                attempt_no=queue_item.retry_count,
                retry_category=retry_category.value,
                before_data=before_data,
                after_data=after_data,
                diff_summary=diff_summary,
                error_message=error_message,
                response_data=response_data or {},
                success=success
            )
            
            if success:
                queue_item.status = QueueStatus.CLOSED
                self._record_status_change(
                    session, queue_item, QueueStatus.CLOSED,
                    operator="system", reason=f"重试成功 (第{queue_item.retry_count}次)"
                )
            else:
                if queue_item.retry_count >= queue_item.max_retries:
                    queue_item.status = QueueStatus.MANUAL
                    queue_item.retry_category = retry_category.value
                    self._record_status_change(
                        session, queue_item, QueueStatus.MANUAL,
                        operator="system", reason="达到最大重试次数，转人工处理"
                    )
                else:
                    queue_item.status = QueueStatus.RETRYING
                    queue_item.retry_category = retry_category.value
                    retry_log.next_retry_at = datetime.utcnow() + timedelta(
                        minutes=min(30, 2 ** queue_item.retry_count)
                    )
                    self._record_status_change(
                        session, queue_item, QueueStatus.RETRYING,
                        operator="system", reason=f"准备第{queue_item.retry_count}次重试"
                    )
            
            session.add(retry_log)
            session.commit()
            session.refresh(queue_item)
            session.refresh(retry_log)
            return queue_item, retry_log
    
    def manual_takeover(
        self,
        queue_item_id: int,
        handler: str,
        notes: Optional[str] = None
    ) -> QueueItem:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            queue_item.handler = handler
            queue_item.handled_at = datetime.utcnow()
            queue_item.handle_notes = notes
            
            self._record_status_change(
                session, queue_item, QueueStatus.MANUAL,
                operator=handler, reason=notes or "人工接管处理"
            )
            
            session.commit()
            session.refresh(queue_item)
            return queue_item
    
    def compensate_record(
        self,
        queue_item_id: int,
        compensated_quantity: float,
        compensated_amount: float,
        compensation_rules: Dict[str, Any],
        operator: str,
        notes: Optional[str] = None
    ) -> Tuple[QueueItem, CompensationRecord]:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            before_compensation = {
                "current_quantity": queue_item.current_quantity,
                "current_amount": queue_item.current_amount
            }
            
            new_quantity = queue_item.current_quantity - compensated_quantity
            new_amount = queue_item.current_amount - compensated_amount
            
            queue_item.current_quantity = new_quantity
            queue_item.current_amount = new_amount
            
            after_compensation = {
                "current_quantity": new_quantity,
                "current_amount": new_amount
            }
            
            _, diff_summary = self.compute_diff(before_compensation, after_compensation)
            
            compensation = CompensationRecord(
                queue_item_id=queue_item_id,
                compensation_no=self.generate_no("CMP"),
                before_compensation=before_compensation,
                after_compensation=after_compensation,
                compensation_rules=compensation_rules,
                diff_summary=diff_summary,
                compensated_quantity=compensated_quantity,
                compensated_amount=compensated_amount,
                operator=operator,
                notes=notes
            )
            
            self._record_status_change(
                session, queue_item, QueueStatus.COMPENSATED,
                operator=operator, reason=notes or "补偿入账完成"
            )
            
            session.add(compensation)
            session.commit()
            session.refresh(queue_item)
            session.refresh(compensation)
            return queue_item, compensation
    
    def close_queue_item(
        self,
        queue_item_id: int,
        operator: str,
        reason: str
    ) -> QueueItem:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            self._record_status_change(
                session, queue_item, QueueStatus.CLOSED,
                operator=operator, reason=reason
            )
            
            session.commit()
            session.refresh(queue_item)
            return queue_item
    
    def move_to_dead_letter(
        self,
        queue_item_id: int,
        operator: str,
        reason: str
    ) -> QueueItem:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            self._record_status_change(
                session, queue_item, QueueStatus.DEAD_LETTER,
                operator=operator, reason=reason
            )
            
            session.commit()
            session.refresh(queue_item)
            return queue_item
    
    def detect_dirty_record(
        self,
        record_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[DirtyType], List[str], Dict[str, Any]]:
        required_fields = [
            "store_id", "medicine_id", "batch_no",
            "quantity", "amount", "expiry_date"
        ]
        missing_fields = [f for f in required_fields if f not in record_data or record_data[f] is None]
        if missing_fields:
            return True, DirtyType.MISSING_FIELD, missing_fields, {"missing": missing_fields}
        
        return False, None, [], {}
    
    def create_dirty_record(
        self,
        dirty_type: DirtyType,
        original_content: Dict[str, Any],
        dirty_fields: List[str],
        conflict_details: Optional[Dict[str, Any]] = None,
        record_id: Optional[int] = None,
        source_ref: Optional[str] = None
    ) -> DirtyRecord:
        with self.get_session() as session:
            dirty = DirtyRecord(
                record_id=record_id,
                source_ref=source_ref,
                dirty_type=dirty_type.value,
                dirty_fields=dirty_fields,
                conflict_details=conflict_details or {},
                original_content=original_content
            )
            session.add(dirty)
            session.commit()
            session.refresh(dirty)
            return dirty
    
    def resolve_dirty_record(
        self,
        dirty_id: int,
        resolver: str,
        processing_opinion: str,
        corrected_content: Dict[str, Any]
    ) -> DirtyRecord:
        with self.get_session() as session:
            dirty = session.query(DirtyRecord).filter_by(id=dirty_id).first()
            if not dirty:
                raise ValueError(f"Dirty record {dirty_id} not found")
            
            dirty.processing_opinion = processing_opinion
            dirty.corrected_content = corrected_content
            dirty.status = "resolved"
            dirty.resolver = resolver
            dirty.resolved_at = datetime.utcnow()
            
            session.commit()
            session.refresh(dirty)
            return dirty
    
    def get_queue_item_history(self, queue_item_id: int) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            history = session.query(StatusHistory).filter_by(
                queue_item_id=queue_item_id
            ).order_by(StatusHistory.changed_at).all()
            
            return [
                {
                    "id": h.id,
                    "from_status": h.from_status,
                    "to_status": h.to_status,
                    "diff_fields": h.diff_fields,
                    "before": h.before_snapshot,
                    "after": h.after_snapshot,
                    "operator": h.operator,
                    "reason": h.reason,
                    "changed_at": h.changed_at.isoformat()
                }
                for h in history
            ]
    
    def get_retry_logs(self, queue_item_id: int) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            logs = session.query(RetryLog).filter_by(
                queue_item_id=queue_item_id
            ).order_by(RetryLog.attempted_at).all()
            
            return [
                {
                    "id": l.id,
                    "attempt_no": l.attempt_no,
                    "retry_category": l.retry_category,
                    "diff_summary": l.diff_summary,
                    "error_message": l.error_message,
                    "success": l.success,
                    "attempted_at": l.attempted_at.isoformat(),
                    "next_retry_at": l.next_retry_at.isoformat() if l.next_retry_at else None
                }
                for l in logs
            ]
    
    def get_queue_item_detail(self, queue_item_id: int) -> Dict[str, Any]:
        with self.get_session() as session:
            queue_item = session.query(QueueItem).filter_by(id=queue_item_id).first()
            if not queue_item:
                raise ValueError(f"Queue item {queue_item_id} not found")
            
            record = queue_item.medicine_record
            
            return {
                "queue_no": queue_item.queue_no,
                "status": queue_item.status,
                "retry_count": queue_item.retry_count,
                "max_retries": queue_item.max_retries,
                "retry_category": queue_item.retry_category,
                "store_id": queue_item.store_id,
                "created_at": queue_item.created_at.isoformat(),
                "medicine": {
                    "record_no": record.record_no,
                    "medicine_name": record.medicine_name,
                    "batch_no": record.batch_no,
                    "expiry_date": record.expiry_date,
                    "quantity": record.quantity,
                    "amount": record.amount,
                    "source_type": record.source_type
                },
                "current": {
                    "quantity": queue_item.current_quantity,
                    "amount": queue_item.current_amount
                },
                "external": {
                    "receipt_no": queue_item.external_receipt_no,
                    "status": queue_item.external_status
                },
                "history": self.get_queue_item_history(queue_item_id),
                "retries": self.get_retry_logs(queue_item_id)
            }
    
    def get_supervisor_stats(self, region_id: Optional[str] = None) -> SupervisorStats:
        with self.get_session() as session:
            query = session.query(QueueItem)
            if region_id:
                query = query.filter_by(region_id=region_id)
            
            retry_by_category = dict(
                query.filter(
                    QueueItem.status.in_([QueueStatus.RETRYING, QueueStatus.MANUAL]),
                    QueueItem.retry_category.isnot(None)
                ).group_by(QueueItem.retry_category).with_entities(
                    QueueItem.retry_category, func.count(QueueItem.id)
                ).all()
            )
            
            dead_letter = session.query(DirtyRecord).filter_by(
                status="pending"
            ).group_by(DirtyRecord.dirty_type).with_entities(
                DirtyRecord.dirty_type, func.count(DirtyRecord.id)
            ).all()
            dead_letter_by_type = dict(dead_letter)
            
            total_retried = query.filter(QueueItem.retry_count > 0).count()
            recovered = query.filter(
                QueueItem.retry_count > 0,
                QueueItem.status == QueueStatus.CLOSED
            ).count()
            recovery_rate = recovered / total_retried if total_retried > 0 else 0.0
            
            today = datetime.utcnow().date()
            pending_manual = query.filter_by(status=QueueStatus.MANUAL).count()
            closed_today = query.filter(
                QueueItem.status == QueueStatus.CLOSED,
                func.date(QueueItem.updated_at) == today
            ).count()
            
            return SupervisorStats(
                retry_by_category=retry_by_category,
                dead_letter_by_type=dead_letter_by_type,
                recovery_rate=round(recovery_rate, 4),
                pending_manual=pending_manual,
                closed_today=closed_today
            )
    
    def list_queue_items(
        self,
        status: Optional[str] = None,
        store_id: Optional[str] = None,
        region_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[QueueItem]:
        with self.get_session() as session:
            query = session.query(QueueItem)
            if status:
                query = query.filter_by(status=status)
            if store_id:
                query = query.filter_by(store_id=store_id)
            if region_id:
                query = query.filter_by(region_id=region_id)
            return query.order_by(QueueItem.created_at.desc()).limit(limit).offset(offset).all()
    
    def export_queue_data(
        self,
        status: Optional[str] = None,
        region_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            items = self.list_queue_items(status=status, region_id=region_id, limit=10000)
            result = []
            for item in items:
                detail = self.get_queue_item_detail(item.id)
                result.append(detail)
            return result
