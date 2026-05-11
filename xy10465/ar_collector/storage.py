import json
import os
from typing import Dict, List, Optional, Type, TypeVar
from datetime import datetime
from .models import (
    Customer,
    Receivable,
    CollectionLog,
    Promise,
    Payment,
)

T = TypeVar("T")


class Storage:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self._ensure_dirs()
    
    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for subdir in ["receivables", "customers", "collection_logs", "promises", "payments"]:
            os.makedirs(os.path.join(self.data_dir, subdir), exist_ok=True)
    
    def _get_file_path(self, entity_type: str, entity_id: str) -> str:
        return os.path.join(self.data_dir, entity_type, f"{entity_id}.json")
    
    def _get_list_dir(self, entity_type: str) -> str:
        return os.path.join(self.data_dir, entity_type)
    
    def _save_entity(self, entity_type: str, entity_id: str, data: dict):
        file_path = self._get_file_path(entity_type, entity_id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_entity(self, entity_type: str, entity_id: str) -> Optional[dict]:
        file_path = self._get_file_path(entity_type, entity_id)
        if not os.path.exists(file_path):
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _list_entities(self, entity_type: str) -> List[dict]:
        dir_path = self._get_list_dir(entity_type)
        entities = []
        if not os.path.exists(dir_path):
            return entities
        for filename in os.listdir(dir_path):
            if filename.endswith(".json"):
                file_path = os.path.join(dir_path, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    entities.append(json.load(f))
        return entities
    
    def _entity_exists(self, entity_type: str, entity_id: str) -> bool:
        return os.path.exists(self._get_file_path(entity_type, entity_id))
    
    def save_customer(self, customer: Customer) -> bool:
        if self._entity_exists("customers", customer.customer_id):
            return False
        self._save_entity("customers", customer.customer_id, customer.to_dict())
        return True
    
    def get_customer(self, customer_id: str) -> Optional[Customer]:
        data = self._load_entity("customers", customer_id)
        if data:
            return Customer.from_dict(data)
        return None
    
    def list_customers(self) -> List[Customer]:
        return [Customer.from_dict(d) for d in self._list_entities("customers")]
    
    def update_customer(self, customer: Customer) -> bool:
        if not self._entity_exists("customers", customer.customer_id):
            return False
        self._save_entity("customers", customer.customer_id, customer.to_dict())
        return True
    
    def save_receivable(self, receivable: Receivable) -> bool:
        if self._entity_exists("receivables", receivable.invoice_no):
            return False
        self._save_entity("receivables", receivable.invoice_no, receivable.to_dict())
        return True
    
    def get_receivable(self, invoice_no: str) -> Optional[Receivable]:
        data = self._load_entity("receivables", invoice_no)
        if data:
            return Receivable.from_dict(data)
        return None
    
    def list_receivables(self) -> List[Receivable]:
        return [Receivable.from_dict(d) for d in self._list_entities("receivables")]
    
    def update_receivable(self, receivable: Receivable) -> bool:
        if not self._entity_exists("receivables", receivable.invoice_no):
            return False
        receivable.updated_at = datetime.now()
        self._save_entity("receivables", receivable.invoice_no, receivable.to_dict())
        return True
    
    def save_collection_log(self, log: CollectionLog) -> bool:
        if self._entity_exists("collection_logs", log.log_id):
            return False
        self._save_entity("collection_logs", log.log_id, log.to_dict())
        return True
    
    def get_collection_log(self, log_id: str) -> Optional[CollectionLog]:
        data = self._load_entity("collection_logs", log_id)
        if data:
            return CollectionLog.from_dict(data)
        return None
    
    def list_collection_logs(self) -> List[CollectionLog]:
        return [CollectionLog.from_dict(d) for d in self._list_entities("collection_logs")]
    
    def list_collection_logs_by_invoice(self, invoice_no: str) -> List[CollectionLog]:
        return [log for log in self.list_collection_logs() if log.invoice_no == invoice_no]
    
    def save_promise(self, promise: Promise) -> bool:
        if self._entity_exists("promises", promise.promise_id):
            return False
        self._save_entity("promises", promise.promise_id, promise.to_dict())
        return True
    
    def get_promise(self, promise_id: str) -> Optional[Promise]:
        data = self._load_entity("promises", promise_id)
        if data:
            return Promise.from_dict(data)
        return None
    
    def list_promises(self) -> List[Promise]:
        return [Promise.from_dict(d) for d in self._list_entities("promises")]
    
    def list_promises_by_invoice(self, invoice_no: str) -> List[Promise]:
        return [p for p in self.list_promises() if p.invoice_no == invoice_no]
    
    def get_active_promise(self, invoice_no: str) -> Optional[Promise]:
        for p in self.list_promises_by_invoice(invoice_no):
            if not p.is_fulfilled:
                return p
        return None
    
    def update_promise(self, promise: Promise) -> bool:
        if not self._entity_exists("promises", promise.promise_id):
            return False
        self._save_entity("promises", promise.promise_id, promise.to_dict())
        return True
    
    def save_payment(self, payment: Payment) -> bool:
        if self._entity_exists("payments", payment.payment_id):
            return False
        self._save_entity("payments", payment.payment_id, payment.to_dict())
        return True
    
    def get_payment(self, payment_id: str) -> Optional[Payment]:
        data = self._load_entity("payments", payment_id)
        if data:
            return Payment.from_dict(data)
        return None
    
    def list_payments(self) -> List[Payment]:
        return [Payment.from_dict(d) for d in self._list_entities("payments")]
    
    def list_payments_by_invoice(self, invoice_no: str) -> List[Payment]:
        return [p for p in self.list_payments() if p.invoice_no == invoice_no]
    
    def get_stats(self) -> Dict[str, int]:
        return {
            "customers": len(self.list_customers()),
            "receivables": len(self.list_receivables()),
            "collection_logs": len(self.list_collection_logs()),
            "promises": len(self.list_promises()),
            "payments": len(self.list_payments()),
        }
