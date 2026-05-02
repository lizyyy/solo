import hashlib
from pathlib import Path
from typing import Optional


def compute_sha256(file_path: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def verify_file_integrity(file_path: Path, expected_hash: str) -> bool:
    if not file_path.exists():
        return False
    actual_hash = compute_sha256(file_path)
    return actual_hash == expected_hash
