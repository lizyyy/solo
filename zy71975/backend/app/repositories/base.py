from typing import Generic, TypeVar, Type, Optional, List, Any, Dict, Union
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import Base
from app.core.exceptions import ResourceNotFoundException

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_by_id(self, db: Session, id: Any) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id, self.model.is_deleted == False).first()

    def get_by_id_or_404(self, db: Session, id: Any, resource_name: str = "资源") -> ModelType:
        instance = self.get_by_id(db, id)
        if not instance:
            raise ResourceNotFoundException(
                resource=resource_name,
                resource_id=id
            )
        return instance

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).filter(self.model.is_deleted == False).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in.dict()
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_from_dict(self, db: Session, obj_in: Dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ModelType, obj_in: Union[UpdateSchemaType, Dict[str, Any]]) -> ModelType:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def soft_delete(self, db: Session, id: Any) -> ModelType:
        db_obj = self.get_by_id_or_404(db, id)
        db_obj.is_deleted = True
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def hard_delete(self, db: Session, id: Any) -> None:
        db_obj = self.get_by_id_or_404(db, id)
        db.delete(db_obj)
        db.commit()

    def count(self, db: Session) -> int:
        return db.query(self.model).filter(self.model.is_deleted == False).count()

    def get_paginated(self, db: Session, page: int = 1, page_size: int = 10) -> tuple[List[ModelType], int, int]:
        total = self.count(db)
        skip = (page - 1) * page_size
        items = db.query(self.model).filter(self.model.is_deleted == False).offset(skip).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size
        return items, total, total_pages
