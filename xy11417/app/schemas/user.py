from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.core.config import UserRole

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.READ_ONLY

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
