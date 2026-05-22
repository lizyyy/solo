from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import hashlib
import base64
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User
from app.models.user import RoleEnum


def _hash_password(password: str) -> str:
    salt = settings.SECRET_KEY.encode()
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return base64.b64encode(hashed).decode()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _hash_password(plain_password) == hashed_password


def get_password_hash(password: str) -> str:
    return _hash_password(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
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
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已禁用")
    return user


class RoleChecker:
    def __init__(self, allowed_roles):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足，需要以下角色之一: {[r.value for r in self.allowed_roles]}"
            )
        return user


allow_data_entry = RoleChecker([RoleEnum.DATA_ENTRY, RoleEnum.REVIEWER, RoleEnum.SUPERVISOR])
allow_reviewer = RoleChecker([RoleEnum.REVIEWER, RoleEnum.SUPERVISOR])
allow_supervisor = RoleChecker([RoleEnum.SUPERVISOR])
allow_all_authenticated = RoleChecker([RoleEnum.DATA_ENTRY, RoleEnum.REVIEWER, RoleEnum.SUPERVISOR, RoleEnum.READ_ONLY])
