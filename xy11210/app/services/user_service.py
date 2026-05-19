from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime
from app.models.models import User, UserRole
from app.schemas.schemas import UserCreate
from app.core.security import get_password_hash, verify_password
from app.utils.logger import logger


class UserService:
    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()
    
    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        return db.query(User).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_user(db: Session, user_in: UserCreate) -> User:
        try:
            db_user = User(
                username=user_in.username,
                password_hash=get_password_hash(user_in.password),
                real_name=user_in.real_name,
                phone=user_in.phone,
                email=user_in.email,
                role=user_in.role,
                is_active=True
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            logger.info({"action": "create_user", "user_id": db_user.id, "username": db_user.username})
            return db_user
        except IntegrityError:
            db.rollback()
            logger.warning({"action": "create_user_failed", "reason": "duplicate_username", "username": user_in.username})
            raise ValueError("用户名已存在")
    
    @staticmethod
    def authenticate(db: Session, username: str, password: str) -> Optional[User]:
        user = UserService.get_user_by_username(db, username)
        if not user:
            logger.warning({"action": "login_failed", "reason": "user_not_found", "username": username})
            return None
        if not verify_password(password, user.password_hash):
            logger.warning({"action": "login_failed", "reason": "wrong_password", "username": username})
            return None
        if not user.is_active:
            logger.warning({"action": "login_failed", "reason": "user_inactive", "username": username})
            return None
        logger.info({"action": "login_success", "user_id": user.id, "username": username})
        return user
    
    @staticmethod
    def init_default_user(db: Session) -> None:
        admin = UserService.get_user_by_username(db, "admin")
        if not admin:
            admin_user = UserCreate(
                username="admin",
                password="admin123",
                real_name="系统管理员",
                phone="13800138000",
                email="admin@example.com",
                role=UserRole.ADMIN
            )
            UserService.create_user(db, admin_user)
            logger.info({"action": "init_default_admin"})
        
        engineer = UserService.get_user_by_username(db, "engineer")
        if not engineer:
            engineer_user = UserCreate(
                username="engineer",
                password="engineer123",
                real_name="工程主管",
                phone="13900139000",
                email="engineer@example.com",
                role=UserRole.ENGINEER
            )
            UserService.create_user(db, engineer_user)
            logger.info({"action": "init_default_engineer"})
        
        worker = UserService.get_user_by_username(db, "worker")
        if not worker:
            worker_user = UserCreate(
                username="worker",
                password="worker123",
                real_name="维修工人",
                phone="13700137000",
                email="worker@example.com",
                role=UserRole.WORKER
            )
            UserService.create_user(db, worker_user)
            logger.info({"action": "init_default_worker"})
