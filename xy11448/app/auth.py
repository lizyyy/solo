from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import TokenData

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
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
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


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已禁用")
    return current_user


class RoleChecker:
    def __init__(self, allowed_roles):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_active_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足。需要角色: {[r.value for r in self.allowed_roles]}"
            )
        return True


allow_data_entry = RoleChecker([UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR])
allow_reviewer = RoleChecker([UserRole.REVIEWER, UserRole.SUPERVISOR])
allow_supervisor = RoleChecker([UserRole.SUPERVISOR])
allow_all_authenticated = RoleChecker([UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR, UserRole.READ_ONLY])


def get_visible_fields(user: User, resource_type: str) -> list:
    field_permissions = {
        "pile_alerts": {
            UserRole.READ_ONLY: ["id", "pile_id", "alert_type", "alert_message", "status", "start_time", "end_time"],
            UserRole.DATA_ENTRY: ["id", "pile_id", "alert_type", "alert_code", "alert_message", "alert_level", "status", "start_time", "end_time", "duration_minutes", "data_quality"],
            UserRole.REVIEWER: ["id", "pile_id", "alert_type", "alert_code", "alert_message", "alert_level", "status", "start_time", "end_time", "duration_minutes", "data_quality", "quality_issue", "created_by", "reviewed_by"],
            UserRole.SUPERVISOR: ["*"]
        },
        "inspections": {
            UserRole.READ_ONLY: ["id", "pile_id", "inspection_date", "inspector", "status"],
            UserRole.DATA_ENTRY: ["id", "pile_id", "inspection_date", "inspector", "status", "inspection_items", "abnormal_items", "remarks"],
            UserRole.REVIEWER: ["id", "pile_id", "inspection_date", "inspector", "status", "inspection_items", "abnormal_items", "remarks", "data_quality", "quality_issue"],
            UserRole.SUPERVISOR: ["*"]
        },
        "customer_complaints": {
            UserRole.READ_ONLY: ["id", "complaint_no", "complaint_type", "complaint_time", "handle_result"],
            UserRole.DATA_ENTRY: ["id", "complaint_no", "pile_id", "customer_name", "complaint_type", "complaint_content", "complaint_time", "handler", "handle_result"],
            UserRole.REVIEWER: ["id", "complaint_no", "pile_id", "customer_name", "customer_phone", "complaint_type", "complaint_content", "complaint_time", "handler", "handle_result", "data_quality"],
            UserRole.SUPERVISOR: ["*"]
        },
        "work_orders": {
            UserRole.READ_ONLY: ["id", "order_no", "title", "status", "assignee"],
            UserRole.DATA_ENTRY: ["id", "order_no", "pile_id", "title", "description", "status", "assignee", "priority", "due_date"],
            UserRole.REVIEWER: ["id", "order_no", "pile_id", "alert_id", "title", "description", "status", "assignee", "priority", "due_date", "actual_start_time", "actual_end_time"],
            UserRole.SUPERVISOR: ["*"]
        }
    }
    
    resource_perms = field_permissions.get(resource_type, {})
    return resource_perms.get(user.role, ["id"])


def can_perform_action(user: User, action: str, resource_type: str) -> bool:
    action_matrix = {
        "create": {
            "pile_alerts": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "inspections": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "customer_complaints": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "work_orders": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "supervisor_comments": [UserRole.SUPERVISOR],
            "users": [UserRole.SUPERVISOR]
        },
        "update": {
            "pile_alerts": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "inspections": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "customer_complaints": [UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.SUPERVISOR],
            "work_orders": [UserRole.REVIEWER, UserRole.SUPERVISOR],
            "supervisor_comments": [UserRole.SUPERVISOR],
            "users": [UserRole.SUPERVISOR]
        },
        "delete": {
            "pile_alerts": [UserRole.SUPERVISOR],
            "inspections": [UserRole.SUPERVISOR],
            "customer_complaints": [UserRole.SUPERVISOR],
            "work_orders": [UserRole.SUPERVISOR],
            "users": [UserRole.SUPERVISOR]
        },
        "review": {
            "pile_alerts": [UserRole.REVIEWER, UserRole.SUPERVISOR],
            "inspections": [UserRole.REVIEWER, UserRole.SUPERVISOR],
            "customer_complaints": [UserRole.REVIEWER, UserRole.SUPERVISOR]
        },
        "export": {
            "reports": [UserRole.REVIEWER, UserRole.SUPERVISOR]
        },
        "reconcile": {
            "reconciliations": [UserRole.REVIEWER, UserRole.SUPERVISOR]
        }
    }
    
    resource_actions = action_matrix.get(action, {})
    allowed_roles = resource_actions.get(resource_type, [])
    return user.role in allowed_roles
