from datetime import datetime, timedelta
from typing import Optional, List
from jose import jwt, JWTError
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.role import Role, UserRole, RolePermission, Permission
from app.schemas.auth import TokenPayload

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(
    subject: int,
    username: str,
    roles: List[str] = None,
    permissions: List[str] = None,
    store_id: Optional[int] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": subject,
        "username": username,
        "roles": roles or [],
        "permissions": permissions or [],
        "store_id": store_id,
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return TokenPayload(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭证"
        )


def get_user_roles_and_permissions(db: Session, user_id: int) -> tuple:
    user_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    role_ids = [ur.role_id for ur in user_roles]

    roles = []
    permissions = []
    if role_ids:
        role_objs = db.query(Role).filter(Role.id.in_(role_ids)).all()
        roles = [r.code for r in role_objs]

        role_permissions = db.query(RolePermission).filter(RolePermission.role_id.in_(role_ids)).all()
        permission_ids = [rp.permission_id for rp in role_permissions]
        if permission_ids:
            perm_objs = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
            permissions = [p.code for p in perm_objs]

    return roles, permissions


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    payload = decode_token(token)
    user = db.query(User).filter(User.id == payload.sub, User.is_deleted == False).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    return user


def get_current_user_with_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> tuple:
    roles, permissions = get_user_roles_and_permissions(db, current_user.id)
    return current_user, roles, permissions


def has_permission(required_permission: str, user_permissions: List[str]) -> bool:
    if required_permission in user_permissions:
        return True
    if "all" in user_permissions:
        return True
    return False


def has_role(required_role: str, user_roles: List[str]) -> bool:
    if required_role in user_roles:
        return True
    if "admin" in user_roles:
        return True
    return False


def check_store_permission(
    user_store_id: Optional[int],
    target_store_id: int,
    is_admin: bool
) -> bool:
    if is_admin:
        return True
    if user_store_id is None:
        return False
    return user_store_id == target_store_id
