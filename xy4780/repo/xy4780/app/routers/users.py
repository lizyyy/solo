from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app.services import UserService
from app.config import UserRole
from app.exceptions import UserNotFoundException

router = APIRouter(prefix="/api/users", tags=["users"])


class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    role: UserRole
    department: Optional[str]

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    role: UserRole
    department: Optional[str] = Field(None, max_length=100)


@router.get("", response_model=List[UserResponse], summary="获取所有用户")
def list_users(db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_all()


@router.get("/{user_id}", response_model=UserResponse, summary="获取用户详情")
def get_user(user_id: int, db: Session = Depends(get_db)):
    service = UserService(db)
    user = service.get_by_id(user_id)
    if not user:
        raise UserNotFoundException(user_id)
    return user


@router.post("", response_model=UserResponse, status_code=201, summary="创建用户")
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.create(
        username=data.username,
        name=data.name,
        role=data.role,
        department=data.department
    )
