import json
import uuid
from datetime import date, datetime
from typing import Dict, List, Any, Optional, TypeVar, Type
from pathlib import Path

T = TypeVar('T')

DATA_DIR = Path(__file__).parent.parent / "data"


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


class DataStore:
    def __init__(self):
        DATA_DIR.mkdir(exist_ok=True)
        self._stores: Dict[str, Dict[str, Any]] = {}
        self._load_all()

    def _get_store_path(self, store_name: str) -> Path:
        return DATA_DIR / f"{store_name}.json"

    def _load_all(self):
        for store_name in ["inventory", "recall", "consumption", "reconciliation", "reviews"]:
            path = self._get_store_path(store_name)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    self._stores[store_name] = json.load(f)
            else:
                self._stores[store_name] = {}

    def _save_store(self, store_name: str):
        path = self._get_store_path(store_name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._stores[store_name], f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)

    def generate_id(self) -> str:
        return str(uuid.uuid4())

    def add(self, store_name: str, item: Any) -> str:
        if store_name not in self._stores:
            self._stores[store_name] = {}
        item_id = item.id if hasattr(item, 'id') and item.id else self.generate_id()
        item_dict = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
        item_dict['id'] = item_id
        self._stores[store_name][item_id] = item_dict
        self._save_store(store_name)
        return item_id

    def get(self, store_name: str, item_id: str, model_class: Optional[Type[T]] = None) -> Optional[T]:
        store = self._stores.get(store_name, {})
        item_data = store.get(item_id)
        if item_data is None:
            return None
        if model_class:
            return model_class(**item_data)
        return item_data

    def get_all(self, store_name: str, model_class: Optional[Type[T]] = None) -> List[T]:
        store = self._stores.get(store_name, {})
        items = list(store.values())
        if model_class:
            return [model_class(**item) for item in items]
        return items

    def update(self, store_name: str, item_id: str, item: Any) -> bool:
        store = self._stores.get(store_name, {})
        if item_id not in store:
            return False
        item_dict = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
        item_dict['id'] = item_id
        if 'updated_at' in item_dict:
            item_dict['updated_at'] = datetime.now().isoformat()
        store[item_id] = item_dict
        self._save_store(store_name)
        return True

    def delete(self, store_name: str, item_id: str) -> bool:
        store = self._stores.get(store_name, {})
        if item_id not in store:
            return False
        del store[item_id]
        self._save_store(store_name)
        return True

    def clear(self, store_name: str):
        self._stores[store_name] = {}
        self._save_store(store_name)

    def find_by(self, store_name: str, field: str, value: Any) -> List[Dict]:
        store = self._stores.get(store_name, {})
        return [item for item in store.values() if item.get(field) == value]

    def count(self, store_name: str) -> int:
        return len(self._stores.get(store_name, {}))


store = DataStore()
