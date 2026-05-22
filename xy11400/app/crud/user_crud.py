from sqlalchemy.orm import Session
from typing import Optional, List

from app import models, schemas
from app.auth import get_password_hash


class UserCRUD:
    def get_user(self, db: Session, user_id: int) -> Optional[models.User]:
        return db.query(models.User).filter(models.User.id == user_id).first()

    def get_user_by_username(self, db: Session, username: str) -> Optional[models.User]:
        return db.query(models.User).filter(models.User.username == username).first()

    def get_users(
        self, db: Session, skip: int = 0, limit: int = 100
    ) -> List[models.User]:
        return db.query(models.User).offset(skip).limit(limit).all()

    def create_user(self, db: Session, user_in: schemas.UserCreate) -> models.User:
        hashed_password = get_password_hash(user_in.password)
        db_user = models.User(
            username=user_in.username,
            hashed_password=hashed_password,
            full_name=user_in.full_name,
            role=user_in.role
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    def update_user(
        self, db: Session, user_id: int, user_in: schemas.UserUpdate
    ) -> Optional[models.User]:
        db_user = self.get_user(db, user_id)
        if not db_user:
            return None

        update_data = user_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_user, field, value)

        db.commit()
        db.refresh(db_user)
        return db_user


user_crud = UserCRUD()
