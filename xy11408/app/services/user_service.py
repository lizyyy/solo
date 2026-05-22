from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List

from app.models import User
from app.models.user import RoleEnum
from app.schemas import UserCreate
from app.core.security import get_password_hash, verify_password


class UserService:
    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    @staticmethod
    def create_user(db: Session, user_in: UserCreate) -> User:
        hashed_password = get_password_hash(user_in.password)
        db_user = User(
            username=user_in.username,
            full_name=user_in.full_name,
            hashed_password=hashed_password,
            role=user_in.role,
            is_active=True
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        user = UserService.get_user_by_username(db, username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        user.last_login = datetime.now()
        db.commit()
        return user

    @staticmethod
    def list_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        return db.query(User).offset(skip).limit(limit).all()

    @staticmethod
    def init_default_users(db: Session) -> None:
        users = [
            {"username": "luruyuan", "full_name": "陆茹媛", "password": "luru123", "role": RoleEnum.DATA_ENTRY},
            {"username": "fuyipei", "full_name": "傅贻沛", "password": "fuyi123", "role": RoleEnum.REVIEWER},
            {"username": "guanpeixun", "full_name": "管培迅", "password": "guan123", "role": RoleEnum.SUPERVISOR},
            {"username": "chaijiehao", "full_name": "柴杰昊", "password": "chai123", "role": RoleEnum.READ_ONLY},
        ]

        for user_data in users:
            if not UserService.get_user_by_username(db, user_data["username"]):
                user_in = UserCreate(**user_data)
                UserService.create_user(db, user_in)
