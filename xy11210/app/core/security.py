from datetime import datetime, timedelta
from typing import Any, Optional, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


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


def mask_sensitive_data(data: Any, fields: Optional[list] = None) -> Any:
    if fields is None:
        fields = settings.SENSITIVE_FIELDS
    
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if key in fields:
                result[key] = _mask_value(str(value))
            elif isinstance(value, dict) or isinstance(value, list):
                result[key] = mask_sensitive_data(value, fields)
            else:
                result[key] = value
        return result
    elif isinstance(data, list):
        return [mask_sensitive_data(item, fields) for item in data]
    else:
        return data


def _mask_value(value: str) -> str:
    if not value:
        return value
    if len(value) <= 4:
        return "*" * len(value)
    if "@" in value:
        parts = value.split("@")
        if len(parts[0]) <= 2:
            return "*" * len(parts[0]) + "@" + parts[1]
        return parts[0][0] + "*" * (len(parts[0]) - 2) + parts[0][-1] + "@" + parts[1]
    return value[:3] + "*" * (len(value) - 6) + value[-3:]
