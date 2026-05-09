from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User
from app.models.role import Role, UserRole
from app.schemas.auth import (
    UserCreate, UserUpdate, UserResponse,
    RoleResponse, Token
)
from app.schemas.common import PaginatedRequest, PaginatedResponse
from app.services.auth_service import (
    get_current_user, get_password_hash, verify_password,
    create_access_token, get_user_roles_and_permissions
)

router = APIRouter(prefix="/auth", tags=["认证授权"])


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username, User.is_deleted == False).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )

    roles, permissions = get_user_roles_and_permissions(db, user.id)
    access_token = create_access_token(
        subject=user.id,
        username=user.username,
        roles=roles,
        permissions=permissions,
        store_id=user.store_id
    )

    user.last_login_at = datetime.utcnow()
    db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.post("/users", response_model=UserResponse)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if db.query(User).filter(User.username == user_in.username, User.is_deleted == False).first():
        raise HTTPException(status_code=400, detail="用户名已存在")

    if user_in.email and db.query(User).filter(User.email == user_in.email, User.is_deleted == False).first():
        raise HTTPException(status_code=400, detail="邮箱已存在")

    user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        store_id=user_in.store_id,
        created_by=current_user.id
    )
    db.add(user)
    db.flush()

    for role_id in user_in.role_ids:
        user_role = UserRole(user_id=user.id, role_id=role_id, created_by=current_user.id)
        db.add(user_role)

    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=PaginatedResponse[UserResponse])
def list_users(
    params: PaginatedRequest = Depends(),
    store_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(User).filter(User.is_deleted == False)

    if params.keyword:
        query = query.filter(or_(
            User.username.contains(params.keyword),
            User.full_name.contains(params.keyword),
            User.email.contains(params.keyword)
        ))
    if store_id:
        query = query.filter(User.store_id == store_id)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": users,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    user.updated_by = current_user.id

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    user.is_deleted = True
    user.updated_by = current_user.id
    db.commit()

    return {"code": 200, "message": "删除成功"}


@router.get("/roles", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    roles = db.query(Role).filter(Role.is_deleted == False).all()
    return roles


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    new_password: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少6位")

    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.password_hash = get_password_hash(new_password)
    user.updated_by = current_user.id
    db.commit()

    return {"code": 200, "message": "密码重置成功"}
