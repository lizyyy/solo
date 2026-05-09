from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.repair_receipts import RepairReceipt
from ..models.dispatches import Dispatch
from ..models.temperature_events import TemperatureEvent
from ..schemas.repair_receipts import (
    RepairReceiptCreate,
    RepairReceiptUpdate,
    RepairReceiptQuery,
)


class RepairReceiptService:
    def __init__(self, db: Session):
        self.db = db

    def _build_query(self, query_params: RepairReceiptQuery):
        query = self.db.query(RepairReceipt)

        if query_params.dispatch_id is not None:
            query = query.filter(RepairReceipt.dispatch_id == query_params.dispatch_id)
        if query_params.worker_id is not None:
            query = query.filter(RepairReceipt.worker_id == query_params.worker_id)
        if query_params.status:
            query = query.filter(RepairReceipt.status == query_params.status)
        if query_params.start_time:
            query = query.filter(RepairReceipt.created_at >= query_params.start_time)
        if query_params.end_time:
            query = query.filter(RepairReceipt.created_at <= query_params.end_time)

        return query

    def list(self, query_params: RepairReceiptQuery) -> Tuple[List[RepairReceipt], int]:
        query = self._build_query(query_params)
        total = query.count()
        receipts = (
            query.order_by(RepairReceipt.created_at.desc())
            .offset((query_params.page - 1) * query_params.page_size)
            .limit(query_params.page_size)
            .all()
        )
        return receipts, total

    def get_by_id(self, receipt_id: int) -> Optional[RepairReceipt]:
        return self.db.query(RepairReceipt).filter(RepairReceipt.id == receipt_id).first()

    def get_by_code(self, receipt_code: str) -> Optional[RepairReceipt]:
        return self.db.query(RepairReceipt).filter(RepairReceipt.receipt_code == receipt_code).first()

    def _generate_receipt_code(self) -> str:
        today = datetime.utcnow().strftime("%Y%m%d")
        prefix = f"RECP{today}"
        count = self.db.query(RepairReceipt).filter(RepairReceipt.receipt_code.like(f"{prefix}%")).count() + 1
        return f"{prefix}{count:04d}"

    def create(self, data: RepairReceiptCreate) -> RepairReceipt:
        receipt_code = self._generate_receipt_code()

        receipt = RepairReceipt(
            dispatch_id=data.dispatch_id,
            worker_id=data.worker_id,
            receipt_code=receipt_code,
            arrival_time=data.arrival_time,
            departure_time=data.departure_time,
            diagnosis=data.diagnosis,
            solution=data.solution,
            work_hours=data.work_hours,
            status=data.status,
            store_feedback=data.store_feedback,
            store_rating=data.store_rating,
        )
        self.db.add(receipt)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def update(self, receipt_id: int, data: RepairReceiptUpdate) -> Optional[RepairReceipt]:
        receipt = self.get_by_id(receipt_id)
        if not receipt:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(receipt, field, value)

        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def delete(self, receipt_id: int) -> bool:
        receipt = self.get_by_id(receipt_id)
        if not receipt:
            return False
        self.db.delete(receipt)
        self.db.commit()
        return True

    def complete_receipt(self, receipt_id: int, store_feedback: Optional[str] = None, store_rating: Optional[int] = None) -> Optional[RepairReceipt]:
        receipt = self.get_by_id(receipt_id)
        if not receipt:
            return None

        receipt.status = "completed"
        receipt.departure_time = datetime.utcnow()
        if store_feedback:
            receipt.store_feedback = store_feedback
        if store_rating is not None:
            receipt.store_rating = store_rating

        dispatch = self.db.query(Dispatch).filter(Dispatch.id == receipt.dispatch_id).first()
        if dispatch:
            dispatch.status = "completed"
            dispatch.completed_at = datetime.utcnow()

            event = self.db.query(TemperatureEvent).filter(TemperatureEvent.id == dispatch.temperature_event_id).first()
            if event:
                event.status = "resolved"
                event.resolved_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def get_by_dispatch(self, dispatch_id: int) -> Optional[RepairReceipt]:
        return self.db.query(RepairReceipt).filter(RepairReceipt.dispatch_id == dispatch_id).first()

    def list_by_worker(self, worker_id: int, status: Optional[str] = None) -> List[RepairReceipt]:
        query = self.db.query(RepairReceipt).filter(RepairReceipt.worker_id == worker_id)
        if status:
            query = query.filter(RepairReceipt.status == status)
        return query.order_by(RepairReceipt.created_at.desc()).all()
