import json
import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict, field
from enum import Enum


class TransferStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProductCategory(Enum):
    MILK_POWDER = "milk_powder"
    DIAPER = "diaper"
    OTHER = "other"


@dataclass
class Customer:
    customer_id: str
    name: str
    phone: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StorageItem:
    storage_id: str
    customer_id: str
    product_name: str
    category: str
    category_enum: ProductCategory
    batch_no: str
    expiry_date: str
    quantity: int
    unit: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['category_enum'] = self.category_enum.value
        return data

    def is_expired(self, check_date: Optional[date] = None) -> bool:
        if check_date is None:
            check_date = date.today()
        expiry = datetime.strptime(self.expiry_date, "%Y-%m-%d").date()
        return check_date > expiry

    def days_until_expiry(self, check_date: Optional[date] = None) -> int:
        if check_date is None:
            check_date = date.today()
        expiry = datetime.strptime(self.expiry_date, "%Y-%m-%d").date()
        return (expiry - check_date).days


@dataclass
class UsageRecord:
    usage_id: str
    storage_id: str
    customer_id: str
    quantity: int
    used_at: str = field(default_factory=lambda: datetime.now().isoformat)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TransferRequest:
    transfer_id: str
    from_customer_id: str
    to_customer_id: str
    storage_id: str
    quantity: int
    status: TransferStatus
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['status'] = self.status.value
        return data


class DataStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.customers: Dict[str, Customer] = {}
        self.storage_items: Dict[str, StorageItem] = {}
        self.usage_records: List[UsageRecord] = []
        self.transfer_requests: Dict[str, TransferRequest] = {}

    def save_all(self):
        import os
        os.makedirs(self.data_dir, exist_ok=True)

        with open(f"{self.data_dir}/customers.json", "w", encoding="utf-8") as f:
            json.dump([c.to_dict() for c in self.customers.values()], f, ensure_ascii=False, indent=2)

        with open(f"{self.data_dir}/storage_items.json", "w", encoding="utf-8") as f:
            json.dump([s.to_dict() for s in self.storage_items.values()], f, ensure_ascii=False, indent=2)

        with open(f"{self.data_dir}/usage_records.json", "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self.usage_records], f, ensure_ascii=False, indent=2)

        with open(f"{self.data_dir}/transfer_requests.json", "w", encoding="utf-8") as f:
            json.dump([t.to_dict() for t in self.transfer_requests.values()], f, ensure_ascii=False, indent=2)

    def load_all(self):
        import os
        if not os.path.exists(self.data_dir):
            return

        try:
            if os.path.exists(f"{self.data_dir}/customers.json"):
                with open(f"{self.data_dir}/customers.json", "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        self.customers[item['customer_id']] = Customer(**item)
        except Exception:
            pass

        try:
            if os.path.exists(f"{self.data_dir}/storage_items.json"):
                with open(f"{self.data_dir}/storage_items.json", "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        item['category_enum'] = ProductCategory(item['category_enum'])
                        self.storage_items[item['storage_id']] = StorageItem(**item)
        except Exception:
            pass

        try:
            if os.path.exists(f"{self.data_dir}/usage_records.json"):
                with open(f"{self.data_dir}/usage_records.json", "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        self.usage_records.append(UsageRecord(**item))
        except Exception:
            pass

        try:
            if os.path.exists(f"{self.data_dir}/transfer_requests.json"):
                with open(f"{self.data_dir}/transfer_requests.json", "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        item['status'] = TransferStatus(item['status'])
                        self.transfer_requests[item['transfer_id']] = TransferRequest(**item)
        except Exception:
            pass


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def validate_date(date_str: str) -> bool:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def validate_phone(phone: str) -> bool:
    if not phone or not phone.isdigit() or len(phone) < 10:
        return False
    return True
