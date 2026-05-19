import json
import os
from datetime import datetime
from typing import Generic, TypeVar, List, Optional, Dict, Any, Callable
from pathlib import Path

from models import BaseEntity, IdempotentEntity, QueryFilter, PaginationParams, PaginatedResult


T = TypeVar('T', bound=BaseEntity)


class BaseRepository(Generic[T]):
    def __init__(self, storage_path: str, entity_type: type):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.entity_type = entity_type
        self._data: Dict[str, T] = {}
        self._load_all()

    def _get_file_path(self, entity_id: str) -> Path:
        return self.storage_path / f"{entity_id}.json"

    def _load_all(self):
        self._data.clear()
        for file_path in self.storage_path.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    entity = self.entity_type(**data)
                    if not getattr(entity, 'is_deleted', False):
                        self._data[entity.id] = entity
            except Exception:
                continue

    def _save_to_file(self, entity: T):
        file_path = self._get_file_path(entity.id)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(entity.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def create(self, entity: T) -> T:
        entity.update_timestamp()
        self._data[entity.id] = entity
        self._save_to_file(entity)
        return entity

    def get_by_id(self, entity_id: str) -> Optional[T]:
        return self._data.get(entity_id)

    def update(self, entity: T) -> T:
        if entity.id not in self._data:
            raise ValueError(f"Entity {entity.id} not found")
        entity.update_timestamp()
        self._data[entity.id] = entity
        self._save_to_file(entity)
        return entity

    def delete(self, entity_id: str, soft_delete: bool = True):
        entity = self.get_by_id(entity_id)
        if not entity:
            return
        if soft_delete:
            entity.is_deleted = True
            self.update(entity)
        else:
            del self._data[entity_id]
            file_path = self._get_file_path(entity_id)
            if file_path.exists():
                file_path.unlink()

    def list_all(self) -> List[T]:
        return list(self._data.values())

    def find_by(self, predicate: Callable[[T], bool]) -> List[T]:
        return [entity for entity in self._data.values() if predicate(entity)]

    def find_one(self, predicate: Callable[[T], bool]) -> Optional[T]:
        for entity in self._data.values():
            if predicate(entity):
                return entity
        return None

    def paginate(self, params: PaginationParams, predicate: Optional[Callable[[T], bool]] = None) -> PaginatedResult[T]:
        all_items = self.list_all()
        if predicate:
            all_items = [item for item in all_items if predicate(item)]
        
        total = len(all_items)
        start = (params.page - 1) * params.page_size
        end = start + params.page_size
        items = all_items[start:end]
        total_pages = (total + params.page_size - 1) // params.page_size
        
        return PaginatedResult(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=total_pages
        )

    def count(self, predicate: Optional[Callable[[T], bool]] = None) -> int:
        if predicate:
            return sum(1 for entity in self._data.values() if predicate(entity))
        return len(self._data)


class IdempotentRepository(BaseRepository[T], Generic[T]):
    def find_by_idempotent_key(self, idempotent_key: str) -> Optional[T]:
        return self.find_one(lambda e: getattr(e, 'idempotent_key', None) == idempotent_key)

    def find_by_request_hash(self, request_hash: str) -> Optional[T]:
        return self.find_one(lambda e: getattr(e, 'request_hash', None) == request_hash)

    def create_with_idempotency(self, entity: T, idempotent_key: Optional[str] = None, request_hash: Optional[str] = None) -> T:
        if idempotent_key:
            existing = self.find_by_idempotent_key(idempotent_key)
            if existing:
                return existing
        
        if request_hash:
            existing = self.find_by_request_hash(request_hash)
            if existing:
                return existing
        
        if idempotent_key:
            entity.idempotent_key = idempotent_key
        if request_hash:
            entity.request_hash = request_hash
        
        return self.create(entity)
