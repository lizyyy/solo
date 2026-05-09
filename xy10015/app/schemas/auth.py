from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr


class UserLogin(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6)


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    store_id: Optional[int] = None
    role_ids: List[int] = []


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    store_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    phone: Optional[str]
    store_id: Optional[int]
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class RoleResponse(RoleBase):
    id: int
    is_system: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: int
    username: str
    roles: List[str] = []
    permissions: List[str] = []
    store_id: Optional[int] = None
    exp: Optional[datetime] = None
