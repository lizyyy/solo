import json
import os
from typing import Any, Dict, List, Optional, Type, TypeVar
from datetime import datetime
from ..models.base import BaseModel

T = TypeVar("T", bound=BaseModel)


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.ensure_dirs()

    def ensure_dirs(self):
        for dir_name in [
            "dishes",
            "batches",
            "fridges",
            "sample_boxes",
            "samples",
            "inspections",
            "corrections",
            "daily_menus",
        ]:
            dir_path = os.path.join(self.data_dir, dir_name)
            os.makedirs(dir_path, exist_ok=True)

    def save(self, entity: T) -> T:
        entity.update_timestamp()
        dir_name = self._get_dir_name(type(entity))
        file_path = os.path.join(self.data_dir, dir_name, f"{entity.id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(entity.to_dict(), f, ensure_ascii=False, indent=2)
        return entity

    def load(self, entity_type: Type[T], entity_id: str) -> Optional[T]:
        dir_name = self._get_dir_name(entity_type)
        file_path = os.path.join(self.data_dir, dir_name, f"{entity_id}.json")
        if not os.path.exists(file_path):
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return entity_type(**data)

    def load_all(self, entity_type: Type[T]) -> List[T]:
        dir_name = self._get_dir_name(entity_type)
        dir_path = os.path.join(self.data_dir, dir_name)
        if not os.path.exists(dir_path):
            return []
        entities = []
        for filename in os.listdir(dir_path):
            if filename.endswith(".json"):
                file_path = os.path.join(dir_path, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                entities.append(entity_type(**data))
        return entities

    def delete(self, entity_type: Type[T], entity_id: str) -> bool:
        dir_name = self._get_dir_name(entity_type)
        file_path = os.path.join(self.data_dir, dir_name, f"{entity_id}.json")
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

    def _get_dir_name(self, entity_type: Type[T]) -> str:
        class_name = entity_type.__name__
        mapping = {
            "Dish": "dishes",
            "Batch": "batches",
            "FridgeLocation": "fridges",
            "SampleBox": "sample_boxes",
            "FoodSample": "samples",
            "InspectionRecord": "inspections",
            "ManualCorrection": "corrections",
            "DailyMenu": "daily_menus",
        }
        return mapping.get(class_name, class_name.lower() + "s")
