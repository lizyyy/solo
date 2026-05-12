import json
import os
from typing import Optional
from .models import Database


class StorageManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.db_path = os.path.join(data_dir, "database.json")
        self._ensure_dir()
    
    def _ensure_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def save(self, db: Database) -> None:
        with open(self.db_path, 'w', encoding='utf-8') as f:
            json.dump(db.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load(self) -> Database:
        if not os.path.exists(self.db_path):
            return Database()
        with open(self.db_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return Database.from_dict(data)
    
    def exists(self) -> bool:
        return os.path.exists(self.db_path)
    
    def clear(self) -> None:
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
