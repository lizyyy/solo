from sqlalchemy.orm import Session
from typing import TypeVar, Generic, Type, Optional, List, Any
from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseService(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model
    
    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()
    
    def get_by_field(self, db: Session, field_name: str, value: Any) -> Optional[ModelType]:
        return db.query(self.model).filter(
            getattr(self.model, field_name) == value
        ).first()
    
    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()
    
    def create(self, db: Session, obj_in: dict) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(self, db: Session, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def delete(self, db: Session, id: Any) -> bool:
        obj = self.get(db, id)
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False
