import hashlib
import secrets
import string
from typing import Optional


def generate_salt(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def hash_password(password: str, salt: Optional[str] = None) -> str:
    if salt is None:
        salt = generate_salt()
    
    password_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    
    hash_obj = hashlib.sha256(salt_bytes + password_bytes)
    hash_hex = hash_obj.hexdigest()
    
    return f"sha256$${salt}$${hash_hex}"


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        algorithm, salt, stored_hash = hashed_password.split('$$')
    except ValueError:
        return False
    
    new_hash = hash_password(password, salt)
    return secrets.compare_digest(new_hash, hashed_password)
