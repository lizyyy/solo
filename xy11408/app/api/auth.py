from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.schemas import UserResponse, Token, ApiResponse
from app.services import UserService

router = APIRouter()


@router.post("/login", response_model=ApiResponse[Token])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = UserService.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return ApiResponse(
        data=Token(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        ),
        message="登录成功"
    )


@router.get("/me", response_model=ApiResponse[UserResponse])
def get_current_user_info(current_user = Depends(get_current_user)):
    return ApiResponse(
        data=UserResponse.model_validate(current_user),
        message="获取用户信息成功"
    )
