from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings, UserRole
from .database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

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

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

class RoleChecker:
    def __init__(self, allowed_roles):
        self.allowed_roles = allowed_roles
    
    def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {self.allowed_roles}"
            )
        return current_user

def check_field_permission(user_role: str, field: str, operation: str = "read") -> bool:
    role_fields = {
        UserRole.READ_ONLY: {
            "read": ["task_id", "status", "retry_count", "created_at", "source_type", "resident_name", "room_number"],
            "write": []
        },
        UserRole.DATA_ENTRY: {
            "read": ["task_id", "status", "retry_count", "created_at", "source_type", "resident_id", "resident_name", "room_number", "repair_content", "material_used", "error_message"],
            "write": ["source_data", "material_used", "repair_content"]
        },
        UserRole.REVIEWER: {
            "read": ["*"],
            "write": ["status", "retry_category", "manual_review_required", "compensation_reason"]
        },
        UserRole.MANAGER: {
            "read": ["*"],
            "write": ["*"]
        }
    }
    
    user_perms = role_fields.get(user_role, role_fields[UserRole.READ_ONLY])
    allowed_fields = user_perms.get(operation, [])
    
    if "*" in allowed_fields:
        return True
    return field in allowed_fields

def filter_fields_by_role(data: dict, user_role: str, operation: str = "read") -> dict:
    if operation == "read" and user_role in [UserRole.REVIEWER, UserRole.MANAGER]:
        return data
    
    role_fields = {
        UserRole.READ_ONLY: ["task_id", "status", "retry_count", "created_at", "source_type", "resident_name", "room_number"],
        UserRole.DATA_ENTRY: ["task_id", "status", "retry_count", "created_at", "source_type", "resident_id", "resident_name", "room_number", "repair_content", "material_used", "error_message"],
    }
    
    allowed_fields = role_fields.get(user_role, role_fields[UserRole.READ_ONLY])
    
    if user_role in [UserRole.REVIEWER, UserRole.MANAGER]:
        return data
    
    return {k: v for k, v in data.items() if k in allowed_fields}
