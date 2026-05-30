import json
import os
from datetime import datetime
from typing import List, Dict, Optional, TypeVar, Generic, Callable
from pathlib import Path

from .models import (
    Policy,
    Claim,
    Bill,
    BillStatus,
    AuditLogEntry,
)

T = TypeVar("T")


class JsonRepository(Generic[T]):
    def __init__(self, data_dir: str, filename: str, model_class: type, id_field: str):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.file_path = self.data_dir / filename
        self.model_class = model_class
        self.id_field = id_field
        self._data: Dict[str, T] = {}
        self._load()

    def _load(self) -> None:
        if self.file_path.exists():
            with open(self.file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
            for item_data in raw_data:
                item = self.model_class.model_validate(item_data)
                item_id = getattr(item, self.id_field)
                self._data[item_id] = item

    def _save(self) -> None:
        data_list = [item.model_dump(mode="json") for item in self._data.values()]
        tmp_path = self.file_path.with_suffix(self.file_path.suffix + ".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data_list, f, ensure_ascii=False, indent=2)
        tmp_path.replace(self.file_path)

    def get(self, item_id: str) -> Optional[T]:
        return self._data.get(item_id)

    def get_all(self) -> List[T]:
        return list(self._data.values())

    def add(self, item: T, overwrite: bool = False) -> bool:
        item_id = getattr(item, self.id_field)
        if item_id in self._data and not overwrite:
            return False
        self._data[item_id] = item
        self._save()
        return True

    def update(self, item: T) -> bool:
        item_id = getattr(item, self.id_field)
        if item_id not in self._data:
            return False
        self._data[item_id] = item
        self._save()
        return True

    def delete(self, item_id: str) -> bool:
        if item_id in self._data:
            del self._data[item_id]
            self._save()
            return True
        return False

    def exists(self, item_id: str) -> bool:
        return item_id in self._data

    def count(self) -> int:
        return len(self._data)

    def filter(self, predicate: Callable[[T], bool]) -> List[T]:
        return [item for item in self._data.values() if predicate(item)]

    def clear(self) -> None:
        self._data.clear()
        self._save()


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.policies = JsonRepository[Policy](data_dir, "policies.json", Policy, "policy_no")
        self.claims = JsonRepository[Claim](data_dir, "claims.json", Claim, "claim_no")
        self.bills = JsonRepository[Bill](data_dir, "bills.json", Bill, "bill_no")
        self.audit_log = JsonRepository[AuditLogEntry](
            data_dir, "audit_log.json", AuditLogEntry, "timestamp"
        )

    def log_action(
        self,
        action: str,
        bill_no: Optional[str] = None,
        claim_no: Optional[str] = None,
        details: Optional[Dict] = None,
    ) -> None:
        entry = AuditLogEntry(
            action=action,
            bill_no=bill_no,
            claim_no=claim_no,
            details=details or {},
        )
        timestamp_str = entry.timestamp.isoformat()
        while timestamp_str in self.audit_log._data:
            entry.timestamp = datetime.fromtimestamp(entry.timestamp.timestamp() + 0.001)
            timestamp_str = entry.timestamp.isoformat()
        entry.timestamp = entry.timestamp
        self.audit_log._data[entry.timestamp.isoformat()] = entry
        self.audit_log._save()

    def get_total_amounts(self) -> Dict[str, float]:
        totals = {
            "normal": 0.0,
            "pending": 0.0,
            "exception": 0.0,
            "all": 0.0,
        }
        for bill in self.bills.get_all():
            totals["all"] += bill.net_claim_amount
            if bill.status in [BillStatus.NORMAL, BillStatus.SUPPLEMENTED, BillStatus.RESUBMITTED]:
                totals["normal"] += bill.net_claim_amount
            elif bill.status == BillStatus.PENDING:
                totals["pending"] += bill.net_claim_amount
            elif bill.status in [BillStatus.EXCEPTION, BillStatus.WITHDRAWN, BillStatus.DRAFT]:
                totals["exception"] += bill.net_claim_amount
        return totals

    def get_stats(self) -> Dict:
        bills = self.bills.get_all()
        status_counts = {}
        for bill in bills:
            status = bill.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "policies": self.policies.count(),
            "claims": self.claims.count(),
            "bills": len(bills),
            "bills_by_status": status_counts,
            "amounts": self.get_total_amounts(),
        }

    def reload(self) -> None:
        self.policies._load()
        self.claims._load()
        self.bills._load()
        self.audit_log._load()
