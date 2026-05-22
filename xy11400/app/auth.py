from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app import models, schemas
from app.models import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_active_user)) -> models.User:
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {self.allowed_roles}"
            )
        return user


allow_data_entry = RoleChecker([UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR])
allow_reviewer = RoleChecker([UserRole.REVIEWER, UserRole.SUPERVISOR])
allow_supervisor = RoleChecker([UserRole.SUPERVISOR])
allow_all_authenticated = RoleChecker([
    UserRole.DATA_ENTRY,
    UserRole.REVIEWER,
    UserRole.SUPERVISOR,
    UserRole.READ_ONLY
])


def get_user_crud():
    from app.crud import user_crud
    return user_crud


def create_initial_users(db: Session):
    users = [
        {
            "username": "admin",
            "password": "admin123",
            "full_name": "系统管理员",
            "role": UserRole.SUPERVISOR
        },
        {
            "username": "reviewer",
            "password": "reviewer123",
            "full_name": "复核员张三",
            "role": UserRole.REVIEWER
        },
        {
            "username": "operator",
            "password": "operator123",
            "full_name": "录入员李四",
            "role": UserRole.DATA_ENTRY
        },
        {
            "username": "viewer",
            "password": "viewer123",
            "full_name": "查看员王五",
            "role": UserRole.READ_ONLY
        }
    ]

    for user_data in users:
        existing = db.query(models.User).filter(models.User.username == user_data["username"]).first()
        if not existing:
            hashed_password = get_password_hash(user_data["password"])
            db_user = models.User(
                username=user_data["username"],
                hashed_password=hashed_password,
                full_name=user_data["full_name"],
                role=user_data["role"]
            )
            db.add(db_user)
    db.commit()
