"""数据存储模块：基于JSON文件的持久化"""
import json
import os
from pathlib import Path
from typing import Dict, List, Type, TypeVar, Generic
from dataclasses import asdict

from .models import (
    Building, Elevator, Technician, Vacation, MaintenanceOrder,
    ORDER_STATUS_PENDING
)

T = TypeVar('T')


class JsonRepository(Generic[T]):
    """通用JSON仓库"""

    def __init__(self, file_path: str, model_class: Type[T]):
        self.file_path = file_path
        self.model_class = model_class
        self._items: Dict[str, T] = {}
        self._ensure_file()
        self._load()

    def _ensure_file(self):
        path = Path(self.file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            with open(path, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)

    def _load(self):
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = []
        self._items = {}
        for item in data:
            obj = self.model_class.from_dict(item)
            self._items[obj.id] = obj

    def _save(self):
        data = [item.to_dict() for item in self._items.values()]
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_all(self) -> List[T]:
        return list(self._items.values())

    def get_by_id(self, item_id: str) -> T:
        return self._items.get(item_id)

    def add(self, item: T) -> T:
        self._items[item.id] = item
        self._save()
        return item

    def update(self, item: T) -> T:
        self._items[item.id] = item
        self._save()
        return item

    def delete(self, item_id: str) -> bool:
        if item_id in self._items:
            del self._items[item_id]
            self._save()
            return True
        return False

    def find(self, predicate) -> List[T]:
        return [item for item in self._items.values() if predicate(item)]


class DataStore:
    """统一数据存储"""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.buildings = JsonRepository(
            os.path.join(data_dir, "buildings.json"), Building
        )
        self.elevators = JsonRepository(
            os.path.join(data_dir, "elevators.json"), Elevator
        )
        self.technicians = JsonRepository(
            os.path.join(data_dir, "technicians.json"), Technician
        )
        self.vacations = JsonRepository(
            os.path.join(data_dir, "vacations.json"), Vacation
        )
        self.orders = JsonRepository(
            os.path.join(data_dir, "orders.json"), MaintenanceOrder
        )

    def reload(self):
        """重新加载所有数据"""
        self.buildings._load()
        self.elevators._load()
        self.technicians._load()
        self.vacations._load()
        self.orders._load()
