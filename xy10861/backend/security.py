import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_FILE = os.path.join(BASE_DIR, 'data', '.encryption_key')
SALT_FILE = os.path.join(BASE_DIR, 'data', '.salt')

def get_or_create_key():
    if os.path.exists(KEY_FILE) and os.path.exists(SALT_FILE):
        with open(KEY_FILE, 'rb') as f:
            key = f.read()
        return key
    
    salt = os.urandom(16)
    with open(SALT_FILE, 'wb') as f:
        f.write(salt)
    
    password = b'env_diff_secret_key_2024'
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password))
    
    with open(KEY_FILE, 'wb') as f:
        f.write(key)
    
    return key

def encrypt_value(value: str) -> str:
    if not value:
        return value
    key = get_or_create_key()
    f = Fernet(key)
    encrypted = f.encrypt(value.encode('utf-8'))
    return base64.urlsafe_b64encode(encrypted).decode('utf-8')

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    try:
        key = get_or_create_key()
        f = Fernet(key)
        decoded = base64.urlsafe_b64decode(encrypted_value.encode('utf-8'))
        decrypted = f.decrypt(decoded)
        return decrypted.decode('utf-8')
    except Exception:
        return encrypted_value

def mask_value(value: str, mask_char: str = "*", visible_chars: int = 4) -> str:
    if not value:
        return value
    if len(value) <= visible_chars * 2:
        return mask_char * len(value)
    return value[:visible_chars] + mask_char * (len(value) - visible_chars * 2) + value[-visible_chars:]
