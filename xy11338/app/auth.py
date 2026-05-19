from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import hashlib
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import TokenData, UserCreate

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")


def get_password_hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return get_password_hash(plain_password) == hashed_password


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def get_user(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return user


def require_role(*roles: UserRole):
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要以下角色之一: {', '.join([r.value for r in roles])}"
            )
        return current_user
    return role_dependency


def create_user(db: Session, user_data: UserCreate) -> User:
    existing_user = get_user(db, user_data.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def init_default_users(db: Session):
    admin = get_user(db, "admin")
    if not admin:
        admin_data = UserCreate(
            username="admin",
            password="admin123",
            full_name="系统管理员",
            phone="13800138000",
            role=UserRole.ADMIN
        )
        create_user(db, admin_data)
        print("默认管理员用户已创建: admin / admin123")
    
    engineer = get_user(db, "engineer01")
    if not engineer:
        engineer_data = UserCreate(
            username="engineer01",
            password="engineer123",
            full_name="工程师01",
            phone="13800138001",
            role=UserRole.ENGINEER
        )
        create_user(db, engineer_data)
        print("默认工程师用户已创建: engineer01 / engineer123")
    
    warehouse = get_user(db, "warehouse01")
    if not warehouse:
        warehouse_data = UserCreate(
            username="warehouse01",
            password="warehouse123",
            full_name="仓管员01",
            phone="13800138002",
            role=UserRole.WAREHOUSE
        )
        create_user(db, warehouse_data)
        print("默认仓管用户已创建: warehouse01 / warehouse123")
    
    claim = get_user(db, "claim01")
    if not claim:
        claim_data = UserCreate(
            username="claim01",
            password="claim123",
            full_name="索赔员01",
            phone="13800138003",
            role=UserRole.CLAIM
        )
        create_user(db, claim_data)
        print("默认索赔用户已创建: claim01 / claim123")
