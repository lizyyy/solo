from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token, mask_sensitive_data
from app.schemas.schemas import UserResponse, Token, ApiResponse
from app.services.user_service import UserService
from app.api.deps import get_current_user
from app.utils.logger import logger

router = APIRouter()


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = UserService.authenticate(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(subject=user.id)
    user_response = UserResponse.model_validate(user)
    
    logger.info({"action": "user_login", "user_id": user.id, "username": user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }


@router.get("/me", response_model=ApiResponse)
def read_users_me(current_user=Depends(get_current_user)):
    user_data = UserResponse.model_validate(current_user).model_dump()
    masked_data = mask_sensitive_data(user_data)
    return ApiResponse(code=200, message="success", data=masked_data)
