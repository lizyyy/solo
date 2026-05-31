import json
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from ..models.models import OperationHistory
from ..schemas.common import OperationHistoryCreate, OperationHistoryResponse, PaginationParams
from ..utils.common import generate_trace_id, format_timestamp


class HistoryService:
    def __init__(self, db: Session):
        self.db = db

    def create_operation_history(
        self,
        operation_type: str,
        target_type: str,
        target_id: int,
        operator: str,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        remark: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> OperationHistory:
        history = OperationHistory(
            operation_type=operation_type,
            target_type=target_type,
            target_id=target_id,
            before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None,
            after_data=json.dumps(after_data, ensure_ascii=False) if after_data else None,
            operator=operator,
            remark=remark,
            trace_id=trace_id or generate_trace_id(),
        )
        self.db.add(history)
        self.db.flush()
        return history

    def get_history_list(
        self,
        operation_type: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[int] = None,
        operator: Optional[str] = None,
        trace_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[OperationHistoryResponse], int]:
        query = self.db.query(OperationHistory)

        if operation_type:
            query = query.filter(OperationHistory.operation_type == operation_type)
        if target_type:
            query = query.filter(OperationHistory.target_type == target_type)
        if target_id:
            query = query.filter(OperationHistory.target_id == target_id)
        if operator:
            query = query.filter(OperationHistory.operator == operator)
        if trace_id:
            query = query.filter(OperationHistory.trace_id == trace_id)
        if start_date:
            start_dt = datetime.fromisoformat(start_date) if start_date else None
            if start_dt:
                query = query.filter(OperationHistory.created_at >= start_dt)
        if end_date:
            end_dt = datetime.fromisoformat(end_date) if end_date else None
            if end_dt:
                query = query.filter(OperationHistory.created_at <= end_dt)

        total = query.count()

        if pagination:
            sort_by = pagination.sort_by or "created_at"
            sort_order = pagination.sort_order or "desc"
            if hasattr(OperationHistory, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(OperationHistory, sort_by).desc())
                else:
                    query = query.order_by(getattr(OperationHistory, sort_by).asc())

            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

        items = query.all()

        response_items = []
        for item in items:
            response_items.append(
                OperationHistoryResponse(
                    id=item.id,
                    operation_type=item.operation_type,
                    target_type=item.target_type,
                    target_id=item.target_id,
                    operator=item.operator,
                    remark=item.remark,
                    before_data=json.loads(item.before_data) if item.before_data else None,
                    after_data=json.loads(item.after_data) if item.after_data else None,
                    trace_id=item.trace_id,
                    created_at=item.created_at,
                )
            )

        return response_items, total

    def get_history_detail(self, history_id: int) -> Optional[OperationHistoryResponse]:
        item = self.db.query(OperationHistory).filter(OperationHistory.id == history_id).first()
        if not item:
            return None

        return OperationHistoryResponse(
            id=item.id,
            operation_type=item.operation_type,
            target_type=item.target_type,
            target_id=item.target_id,
            operator=item.operator,
            remark=item.remark,
            before_data=json.loads(item.before_data) if item.before_data else None,
            after_data=json.loads(item.after_data) if item.after_data else None,
            trace_id=item.trace_id,
            created_at=item.created_at,
        )
