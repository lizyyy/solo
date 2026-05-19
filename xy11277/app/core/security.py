import re
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def mask_sensitive_data(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: mask_sensitive_data(v) if k not in settings.SENSITIVE_FIELDS else mask_field(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    elif isinstance(data, object) and hasattr(data, '__dict__'):
        obj_dict = data.__dict__.copy()
        for field in settings.SENSITIVE_FIELDS:
            if field in obj_dict:
                obj_dict[field] = mask_field(obj_dict[field])
        return obj_dict
    return data


def mask_field(value: str) -> str:
    if not value or not isinstance(value, str):
        return value
    if len(value) <= 4:
        return "*" * len(value)
    if re.match(r'^1[3-9]\d{9}$', value):
        return value[:3] + "****" + value[7:]
    if len(value) == 18:
        return value[:6] + "********" + value[14:]
    return value[:2] + "*" * (len(value) - 4) + value[-2:]
