from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, RoleEnum, WorkflowStatus

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
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return user


class RoleChecker:
    def __init__(self, allowed_roles: List[RoleEnum]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)) -> User:
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"角色 {user.role} 没有权限执行此操作"
            )
        return user


ROLE_PERMISSIONS: Dict[RoleEnum, Dict[str, Any]] = {
    RoleEnum.ENTRY: {
        "visible_fields": ["id", "record_no", "record_type", "title", "department", "research_group",
                           "teacher_name", "material_name", "specification", "quantity", "unit",
                           "unit_price", "total_amount", "supplier", "status", "created_at", "remarks"],
        "allowed_actions": ["create_draft", "edit_draft", "submit", "view_own", "delete_draft"],
        "workflow_actions": {
            WorkflowStatus.DRAFT: ["edit", "submit", "delete"],
        }
    },
    RoleEnum.REVIEWER: {
        "visible_fields": ["id", "record_no", "record_type", "title", "department", "research_group",
                           "teacher_name", "material_name", "specification", "quantity", "unit",
                           "unit_price", "total_amount", "supplier", "status", "created_at", "created_by",
                           "reviewed_at", "remarks", "reject_reason"],
        "allowed_actions": ["view_all", "review", "reject", "second_confirm"],
        "workflow_actions": {
            WorkflowStatus.SUBMITTED: ["approve", "reject"],
            WorkflowStatus.REJECTED: ["view"],
        }
    },
    RoleEnum.SUPERVISOR: {
        "visible_fields": ["*"],
        "allowed_actions": ["view_all", "final_approve", "audit", "view_dirty", "resolve_dirty", "export"],
        "workflow_actions": {
            WorkflowStatus.SUBMITTED: ["approve", "reject"],
            WorkflowStatus.SECOND_CONFIRM: ["final_approve", "reject"],
            WorkflowStatus.APPROVED: ["audit", "export"],
        }
    },
    RoleEnum.READONLY: {
        "visible_fields": ["id", "record_no", "record_type", "title", "department", "research_group",
                           "material_name", "quantity", "status", "created_at"],
        "allowed_actions": ["view_all"],
        "workflow_actions": {}
    },
    RoleEnum.SECRETARY: {
        "visible_fields": ["id", "record_no", "record_type", "title", "department", "research_group",
                           "teacher_name", "material_name", "specification", "quantity", "unit",
                           "total_amount", "status", "created_at", "workflow_logs", "change_reason"],
        "allowed_actions": ["view_all", "view_dashboard", "export", "view_audit_trail"],
        "workflow_actions": {}
    }
}


def check_permission(user: User, action: str) -> bool:
    permissions = ROLE_PERMISSIONS.get(user.role, {})
    allowed_actions = permissions.get("allowed_actions", [])
    return action in allowed_actions or "*" in allowed_actions


def filter_fields_by_role(data: Dict[str, Any], user: User) -> Dict[str, Any]:
    permissions = ROLE_PERMISSIONS.get(user.role, {})
    visible_fields = permissions.get("visible_fields", [])

    if "*" in visible_fields:
        return data

    result = {}
    for field in visible_fields:
        if field in data:
            result[field] = data[field]
    return result


def mask_sensitive_data(data: Dict[str, Any]) -> Dict[str, Any]:
    result = data.copy()
    for field in settings.SENSITIVE_FIELDS:
        if field in result and result[field]:
            value = str(result[field])
            if len(value) > 4:
                result[field] = value[:2] + "*" * (len(value) - 4) + value[-2:]
            else:
                result[field] = "*" * len(value)
    return result
