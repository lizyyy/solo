import hashlib
import json
from datetime import datetime


def generate_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def generate_id(prefix: str, *args) -> str:
    content = "|".join(str(arg) for arg in args) + str(datetime.now().timestamp())
    hash_part = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{hash_part}"
