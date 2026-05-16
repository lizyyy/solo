import hashlib
import json
from datetime import datetime, timedelta
from jose import jwt
from typing import List, Dict, Any
import secrets
import string

SECRET_KEY = "evidence-package-secret-key-2024"
ALGORITHM = "HS256"
DOWNLOAD_TOKEN_EXPIRE_HOURS = 24


def generate_materials_hash(materials: List[Dict[str, Any]]) -> str:
    materials_sorted = sorted(materials, key=lambda x: x.get("material_name", ""))
    materials_json = json.dumps(materials_sorted, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(materials_json.encode("utf-8")).hexdigest()


def generate_signature(case_number: str, version: int, materials_hash: str, timestamp: datetime = None) -> str:
    if timestamp is None:
        timestamp = datetime.now()
    signature_data = {
        "case_number": case_number,
        "version": version,
        "materials_hash": materials_hash,
        "timestamp": timestamp.isoformat()
    }
    signature_json = json.dumps(signature_data, sort_keys=True, ensure_ascii=False)
    full_hash = hashlib.sha256(signature_json.encode("utf-8")).hexdigest()
    token = jwt.encode({"sig": full_hash, "data": signature_data}, SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_signature(signature_value: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(signature_value, SECRET_KEY, algorithms=[ALGORITHM])
        stored_sig = payload.get("sig")
        data = payload.get("data")
        recalculated_json = json.dumps(data, sort_keys=True, ensure_ascii=False)
        recalculated_sig = hashlib.sha256(recalculated_json.encode("utf-8")).hexdigest()
        return {
            "is_valid": stored_sig == recalculated_sig,
            "data": data,
            "message": "签章校验通过" if stored_sig == recalculated_sig else "签章校验失败：数据被篡改"
        }
    except Exception as e:
        return {
            "is_valid": False,
            "data": None,
            "message": f"签章解析失败：{str(e)}"
        }


def verify_version_chain(signatures: List[Any]) -> Dict[str, Any]:
    if not signatures:
        return {"is_complete": False, "message": "没有签章记录", "chain": []}
    sorted_sigs = sorted(signatures, key=lambda x: x.version)
    chain = []
    prev_sig = None
    is_complete = True
    for i, sig in enumerate(sorted_sigs):
        verification = verify_signature(sig.signature_value)
        chain_item = {
            "version": sig.version,
            "signature_id": sig.id,
            "signed_at": sig.signed_at.isoformat() if sig.signed_at else None,
            "signed_by": sig.signed_by,
            "materials_hash": sig.materials_hash,
            "signature_valid": verification["is_valid"],
            "signature_message": verification["message"],
            "link_to_previous_valid": True
        }
        if i > 0:
            chain_item["link_to_previous_valid"] = (sig.previous_signature_id == sorted_sigs[i-1].id)
            if not chain_item["link_to_previous_valid"]:
                is_complete = False
        if not verification["is_valid"]:
            is_complete = False
        chain.append(chain_item)
        prev_sig = sig
    return {
        "is_complete": is_complete,
        "message": "版本链完整且有效" if is_complete else "版本链存在断裂或签章无效",
        "chain": chain,
        "total_versions": len(chain)
    }


def generate_download_token(package_id: int, case_number: str, version: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=DOWNLOAD_TOKEN_EXPIRE_HOURS)
    token = jwt.encode({
        "package_id": package_id,
        "case_number": case_number,
        "version": version,
        "exp": expire
    }, SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_download_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "is_valid": True,
            "data": payload,
            "message": "授权有效"
        }
    except jwt.ExpiredSignatureError:
        return {"is_valid": False, "data": None, "message": "下载授权已过期"}
    except Exception as e:
        return {"is_valid": False, "data": None, "message": f"授权验证失败：{str(e)}"}


def generate_random_string(length: int = 32) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def calculate_file_hash(file_content: bytes) -> str:
    return hashlib.sha256(file_content).hexdigest()
