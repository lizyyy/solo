from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from app.core.config import get_settings

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def mask_sensitive_data(data: dict, sensitive_fields: list = None) -> dict:
    if sensitive_fields is None:
        sensitive_fields = settings.SENSITIVE_FIELDS
    
    result = data.copy()
    for field in sensitive_fields:
        if field in result and result[field]:
            value = str(result[field])
            if len(value) > 4:
                result[field] = value[:2] + settings.MASK_PATTERN + value[-2:]
            else:
                result[field] = settings.MASK_PATTERN
    return result


def mask_sensitive_log(message: str, sensitive_patterns: list = None) -> str:
    if sensitive_patterns is None:
        sensitive_patterns = ["phone", "email", "id_card"]
    
    result = message
    for pattern in sensitive_patterns:
        if pattern in result.lower():
            result = result.replace(pattern, settings.MASK_PATTERN)
    return result
