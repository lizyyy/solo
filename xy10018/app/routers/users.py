from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..security import get_current_user, RoleChecker
from ..models import User, UserRole
from ..schemas import UserResponse, UserCreate, UserUpdate
from ..services import create_user, update_user, get_users

router = APIRouter(prefix="/api/users", tags=["用户管理"])

admin_checker = RoleChecker(["admin"])

@router.get("", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    return get_users(db, skip=skip, limit=limit)

@router.post("", response_model=UserResponse)
async def create_user_endpoint(
    user: UserCreate,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    from ..security import get_user
    if get_user(db, user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    return create_user(db, user)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_detail(
    user_id: int,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user_endpoint(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    user = update_user(db, user_id, user_update)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

@router.delete("/{user_id}")
async def delete_user_endpoint(
    user_id: int,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    
    user.is_active = False
    db.commit()
    return {"message": "用户已禁用"}
