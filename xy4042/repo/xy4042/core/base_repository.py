from typing import Generic, TypeVar, List, Optional, Any
from abc import ABC, abstractmethod

from models.database import get_db

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    def __init__(self):
        self.db = get_db()
    
    @abstractmethod
    def _table_name(self) -> str:
        pass
    
    @abstractmethod
    def _row_to_model(self, row) -> T:
        pass
    
    def get_by_id(self, entity_id: int) -> Optional[T]:
        sql = f"SELECT * FROM {self._table_name()} WHERE id = ?"
        cursor = self.db.execute(sql, (entity_id,))
        row = cursor.fetchone()
        return self._row_to_model(row) if row else None
    
    def get_all(self) -> List[T]:
        sql = f"SELECT * FROM {self._table_name()} ORDER BY id"
        cursor = self.db.execute(sql)
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def delete(self, entity_id: int) -> bool:
        sql = f"DELETE FROM {self._table_name()} WHERE id = ?"
        self.db.execute(sql, (entity_id,))
        return True
    
    def count(self) -> int:
        sql = f"SELECT COUNT(*) FROM {self._table_name()}"
        cursor = self.db.execute(sql)
        result = cursor.fetchone()
        return result[0] if result else 0
