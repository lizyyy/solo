from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import (
    authenticate_user, create_access_token, get_current_active_user,
    allow_supervisor, get_password_hash
)
from app.config import settings
from app.models import User, UserRole
from app.schemas import UserCreate, User as UserSchema, UserUpdate, Token

router = APIRouter()


@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.get("/permissions")
async def get_my_permissions(current_user: User = Depends(get_current_active_user)):
    role_permissions = {
        UserRole.DATA_ENTRY: {
            "role": "data_entry",
            "name": "数据录入",
            "can_create": ["pile_alerts", "inspections", "customer_complaints", "work_orders"],
            "can_update": ["pile_alerts", "inspections", "customer_complaints"],
            "can_delete": [],
            "can_export": [],
            "can_review": []
        },
        UserRole.REVIEWER: {
            "role": "reviewer",
            "name": "复核",
            "can_create": ["pile_alerts", "inspections", "customer_complaints", "work_orders"],
            "can_update": ["pile_alerts", "inspections", "customer_complaints", "work_orders"],
            "can_delete": [],
            "can_export": ["reports"],
            "can_review": ["pile_alerts", "inspections", "customer_complaints"]
        },
        UserRole.SUPERVISOR: {
            "role": "supervisor",
            "name": "主管",
            "can_create": ["*"],
            "can_update": ["*"],
            "can_delete": ["*"],
            "can_export": ["reports"],
            "can_review": ["*"]
        },
        UserRole.READ_ONLY: {
            "role": "read_only",
            "name": "只读",
            "can_create": [],
            "can_update": [],
            "can_delete": [],
            "can_export": [],
            "can_review": []
        }
    }
    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "role": current_user.role.value
        },
        "permissions": role_permissions.get(current_user.role, {})
    }


@router.post("/users", response_model=UserSchema, dependencies=[Depends(allow_supervisor)])
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users", response_model=list[UserSchema], dependencies=[Depends(allow_supervisor)])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.put("/users/{user_id}", response_model=UserSchema, dependencies=[Depends(allow_supervisor)])
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user
