from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import User
from app.models.enums import UserRole
from app.core.security import get_password_hash, verify_password


class UserRepository:
    def __init__(self):
        pass

    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    def get_by_id(self, db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def create(self, db: Session, username: str, password: str, full_name: str, role: UserRole, phone: Optional[str] = None, email: Optional[str] = None) -> User:
        hashed_password = get_password_hash(password)
        user = User(
            username=username,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            phone=phone,
            email=email
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate(self, db: Session, username: str, password: str) -> Optional[User]:
        user = self.get_by_username(db, username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def get_by_role(self, db: Session, role: UserRole) -> List[User]:
        return db.query(User).filter(User.role == role).all()

    def list_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        return db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    def is_active(self, user: User) -> bool:
        return user.is_active

    def is_admin(self, user: User) -> bool:
        return user.role == UserRole.ADMIN

    def is_reviewer(self, user: User) -> bool:
        return user.role in [UserRole.ADMIN, UserRole.REVIEWER]
