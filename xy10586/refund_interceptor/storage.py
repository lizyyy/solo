import json
from datetime import datetime
from pathlib import Path
from typing import List, Type, TypeVar, Generic, Optional
from pydantic import BaseModel

from .models import (
    WorkspaceState, OrderPayment, BlacklistItem, ApprovalRecord,
    HistoricalRefund, RefundRequest, CorrectionRecord
)

T = TypeVar('T', bound=BaseModel)


class Storage(Generic[T]):
    def __init__(self, file_path: Path, model_class: Type[T]):
        self.file_path = file_path
        self.model_class = model_class
    
    def _default(self):
        if not self.file_path.exists():
            return []
        self.save([])
        return []
    
    def load(self) -> List[T]:
        if not self.file_path.exists():
            return []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [self.model_class.model_validate(item) for item in data]
    
    def save(self, items: List[T]):
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(
                [item.model_dump(mode='json') for item in items],
                f,
                ensure_ascii=False,
                indent=2
            )
    
    def append(self, item: T):
        items = self.load()
        items.append(item)
        self.save(items)
    
    def update(self, items: List[T]):
        self.save(items)


class DataManager:
    def __init__(self, config):
        self.config = config
        self.state_storage: Storage[WorkspaceState] = Storage(config.state_file, WorkspaceState)
        self.payments_storage: Storage[OrderPayment] = Storage(config.payments_file, OrderPayment)
        self.blacklist_storage: Storage[BlacklistItem] = Storage(config.blacklist_file, BlacklistItem)
        self.approvals_storage: Storage[ApprovalRecord] = Storage(config.approvals_file, ApprovalRecord)
        self.historical_refunds_storage: Storage[HistoricalRefund] = Storage(config.historical_refunds_file, HistoricalRefund)
        self.refund_requests_storage: Storage[RefundRequest] = Storage(config.refund_requests_file, RefundRequest)
        self.corrections_storage: Storage[CorrectionRecord] = Storage(config.corrections_file, CorrectionRecord)
    
    def get_state(self) -> WorkspaceState:
        states = self.state_storage.load()
        if states:
            return states[0]
        return WorkspaceState()
    
    def save_state(self, state: WorkspaceState):
        self.state_storage.save([state])
    
    def get_payments(self) -> List[OrderPayment]:
        return self.payments_storage.load()
    
    def get_payment_by_order(self, order_id: str) -> Optional[OrderPayment]:
        for p in self.get_payments():
            if p.order_id == order_id:
                return p
        return None
    
    def save_payments(self, payments: List[OrderPayment]):
        self.payments_storage.save(payments)
    
    def get_blacklist(self) -> List[BlacklistItem]:
        return self.blacklist_storage.load()
    
    def get_blacklist_by_account(self, account: str) -> Optional[BlacklistItem]:
        for item in self.get_blacklist():
            if item.account == account and item.is_active:
                return item
        return None
    
    def save_blacklist(self, items: List[BlacklistItem]):
        self.blacklist_storage.save(items)
    
    def get_approvals(self) -> List[ApprovalRecord]:
        return self.approvals_storage.load()
    
    def get_approval_by_request(self, request_id: str) -> Optional[ApprovalRecord]:
        for a in self.get_approvals():
            if a.refund_request_id == request_id:
                return a
        return None
    
    def save_approvals(self, approvals: List[ApprovalRecord]):
        self.approvals_storage.save(approvals)
    
    def get_historical_refunds(self) -> List[HistoricalRefund]:
        return self.historical_refunds_storage.load()
    
    def get_historical_by_order(self, order_id: str) -> List[HistoricalRefund]:
        return [h for h in self.get_historical_refunds() if h.order_id == order_id and h.status == "success"]
    
    def save_historical_refunds(self, refunds: List[HistoricalRefund]):
        self.historical_refunds_storage.save(refunds)
    
    def get_refund_requests(self) -> List[RefundRequest]:
        return self.refund_requests_storage.load()
    
    def get_request_by_id(self, request_id: str) -> Optional[RefundRequest]:
        for r in self.get_refund_requests():
            if r.request_id == request_id:
                return r
        return None
    
    def save_refund_requests(self, requests: List[RefundRequest]):
        self.refund_requests_storage.save(requests)
    
    def get_corrections(self) -> List[CorrectionRecord]:
        return self.corrections_storage.load()
    
    def get_corrections_by_request(self, request_id: str) -> List[CorrectionRecord]:
        return [c for c in self.get_corrections() if c.request_id == request_id]
    
    def save_corrections(self, corrections: List[CorrectionRecord]):
        self.corrections_storage.save(corrections)
