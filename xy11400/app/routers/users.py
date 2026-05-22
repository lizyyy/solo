from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import allow_supervisor, get_current_active_user
from app import models, schemas
from app.crud.user_crud import user_crud

router = APIRouter(prefix="/users", tags=["用户管理"])


@router.get("/", response_model=list[schemas.UserForList])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    return user_crud.get_users(db, skip=skip, limit=limit)


@router.post("/", response_model=schemas.User)
async def create_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    existing = user_crud.get_user_by_username(db, user_in.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    return user_crud.create_user(db, user_in)


@router.get("/{user_id}", response_model=schemas.User)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    user = user_crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.put("/{user_id}", response_model=schemas.User)
async def update_user(
    user_id: int,
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    user = user_crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user_crud.update_user(db, user_id, user_in)
