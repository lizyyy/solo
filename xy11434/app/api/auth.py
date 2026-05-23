from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RoleEnum
from app.schemas import UserCreate, UserResponse, Token
from app.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, RoleChecker
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")

    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        real_name=user_data.real_name,
        hashed_password=hashed_password,
        role=user_data.role,
        department=user_data.department,
        phone=user_data.phone,
        email=user_data.email
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/init-default-users")
def init_default_users(db: Session = Depends(get_db)):
    default_users = [
        {"username": "entry_user", "real_name": "录入员小王", "role": RoleEnum.ENTRY, "password": "123456"},
        {"username": "reviewer_user", "real_name": "复核员老李", "role": RoleEnum.REVIEWER, "password": "123456"},
        {"username": "supervisor_user", "real_name": "主管张主任", "role": RoleEnum.SUPERVISOR, "password": "123456"},
        {"username": "readonly_user", "real_name": "查看员小陈", "role": RoleEnum.READONLY, "password": "123456"},
        {"username": "secretary_user", "real_name": "学院秘书刘姐", "role": RoleEnum.SECRETARY, "password": "123456"},
    ]

    created = []
    for user_data in default_users:
        existing = db.query(User).filter(User.username == user_data["username"]).first()
        if not existing:
            hashed_password = get_password_hash(user_data["password"])
            db_user = User(
                username=user_data["username"],
                real_name=user_data["real_name"],
                hashed_password=hashed_password,
                role=user_data["role"],
                department="化学学院"
            )
            db.add(db_user)
            created.append(user_data["username"])

    db.commit()
    return {
        "message": "默认用户初始化完成",
        "created_users": created,
        "default_password": "123456"
    }
