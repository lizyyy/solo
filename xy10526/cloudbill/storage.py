import json
import os
from typing import Optional, List, Dict, Any, Callable, TypeVar, Generic
from datetime import datetime
from .models import (
    CloudBill, Resource, TagStrategy, OwnerMapping, Project,
    ImportBatch, HistoryRecord, BillStatus, generate_id
)

T = TypeVar('T')


class JSONStore(Generic[T]):
    def __init__(self, file_path: str, from_dict: Callable[[Dict[str, Any]], T],
                 to_dict: Callable[[T], Dict[str, Any]]):
        self.file_path = file_path
        self.from_dict = from_dict
        self.to_dict = to_dict
        self._cache: Dict[str, T] = {}
        self._loaded = False

    def _ensure_dir(self):
        dir_path = os.path.dirname(self.file_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)

    def _load(self):
        if self._loaded:
            return
        if not os.path.exists(self.file_path):
            self._cache = {}
            self._loaded = True
            return
        with open(self.file_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        self._cache = {item.get('bill_id', item.get('resource_id', item.get('strategy_id',
                                                                            item.get('owner_id',
                                                                                     item.get('project_id',
                                                                                              item.get('record_id',
                                                                                                       item.get(
                                                                                                           'batch_id'))))))):
                           self.from_dict(item) for item in raw}
        self._loaded = True

    def _save(self):
        self._ensure_dir()
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump([self.to_dict(item) for item in self._cache.values()],
                      f, ensure_ascii=False, indent=2)

    def get(self, key: str) -> Optional[T]:
        self._load()
        return self._cache.get(key)

    def all(self) -> List[T]:
        self._load()
        return list(self._cache.values())

    def save(self, key: str, item: T) -> None:
        self._load()
        self._cache[key] = item
        self._save()

    def delete(self, key: str) -> bool:
        self._load()
        if key in self._cache:
            del self._cache[key]
            self._save()
            return True
        return False

    def exists(self, key: str) -> bool:
        self._load()
        return key in self._cache

    def count(self) -> int:
        self._load()
        return len(self._cache)

    def clear(self) -> None:
        self._cache = {}
        self._loaded = True
        self._save()


class Storage:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.bills = JSONStore(
            os.path.join(data_dir, "bills.json"),
            CloudBill.from_dict,
            lambda b: b.to_dict()
        )
        self.resources = JSONStore(
            os.path.join(data_dir, "resources.json"),
            Resource.from_dict,
            lambda r: r.to_dict()
        )
        self.strategies = JSONStore(
            os.path.join(data_dir, "strategies.json"),
            TagStrategy.from_dict,
            lambda s: s.to_dict()
        )
        self.owners = JSONStore(
            os.path.join(data_dir, "owners.json"),
            OwnerMapping.from_dict,
            lambda o: o.to_dict()
        )
        self.projects = JSONStore(
            os.path.join(data_dir, "projects.json"),
            Project.from_dict,
            lambda p: p.to_dict()
        )
        self.batches = JSONStore(
            os.path.join(data_dir, "batches.json"),
            ImportBatch.from_dict,
            lambda b: b.to_dict()
        )
        self.history = JSONStore(
            os.path.join(data_dir, "history.json"),
            HistoryRecord.from_dict,
            lambda h: h.to_dict()
        )

    def add_history(self, record: HistoryRecord):
        self.history.save(record.record_id, record)

    def get_bills_by_project(self, project_code: str) -> List[CloudBill]:
        result = []
        for bill in self.bills.all():
            if bill.get_project() == project_code:
                result.append(bill)
        return result

    def get_bills_by_status(self, status: BillStatus) -> List[CloudBill]:
        return [b for b in self.bills.all() if b.status == status]

    def get_bills_by_batch(self, batch_id: str) -> List[CloudBill]:
        return [b for b in self.bills.all() if b.import_batch_id == batch_id]

    def get_history_for_bill(self, bill_id: str) -> List[HistoryRecord]:
        result = [h for h in self.history.all() if h.bill_id == bill_id]
        result.sort(key=lambda h: h.created_at)
        return result

    def get_batches_by_type(self, import_type: str) -> List[ImportBatch]:
        result = [b for b in self.batches.all() if b.import_type == import_type]
        result.sort(key=lambda b: b.created_at, reverse=True)
        return result

    def get_project_by_code(self, code: str) -> Optional[Project]:
        for project in self.projects.all():
            if project.code == code:
                return project
        return None
