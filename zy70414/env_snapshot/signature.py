import hashlib
import hmac
import json
from typing import Dict, Any, Tuple, Optional
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature


class SignatureService:
    SUPPORTED_ALGORITHMS = ["SHA256", "SHA512", "MD5", "HMAC-SHA256", "RSA-SHA256"]

    @staticmethod
    def normalize_env_vars(env_vars: Dict[str, str]) -> str:
        sorted_items = sorted(env_vars.items(), key=lambda x: x[0])
        return json.dumps(sorted_items, separators=(',', ':'))

    @classmethod
    def sign(cls, env_vars: Dict[str, str], algorithm: str, key: Optional[str] = None) -> Tuple[str, str]:
        if algorithm not in cls.SUPPORTED_ALGORITHMS:
            raise ValueError(f"不支持的签名算法: {algorithm}")

        normalized_data = cls.normalize_env_vars(env_vars)
        data_bytes = normalized_data.encode('utf-8')

        if algorithm == "SHA256":
            signature = hashlib.sha256(data_bytes).hexdigest()
        elif algorithm == "SHA512":
            signature = hashlib.sha512(data_bytes).hexdigest()
        elif algorithm == "MD5":
            signature = hashlib.md5(data_bytes).hexdigest()
        elif algorithm == "HMAC-SHA256":
            if not key:
                raise ValueError("HMAC-SHA256 需要提供密钥")
            signature = hmac.new(key.encode('utf-8'), data_bytes, hashlib.sha256).hexdigest()
        elif algorithm == "RSA-SHA256":
            if not key:
                raise ValueError("RSA-SHA256 需要提供私钥")
            private_key = serialization.load_pem_private_key(
                key.encode('utf-8'),
                password=None
            )
            signature = private_key.sign(
                data_bytes,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            ).hex()
        else:
            raise ValueError(f"未实现的签名算法: {algorithm}")

        return signature, algorithm

    @classmethod
    def verify(cls, env_vars: Dict[str, str], signature: str, algorithm: str, 
               expected_algorithm: str, key: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
        result = {
            "algorithm_match": algorithm == expected_algorithm,
            "signature_valid": False,
            "actual_algorithm": algorithm,
            "expected_algorithm": expected_algorithm,
            "errors": []
        }

        if not result["algorithm_match"]:
            result["errors"].append({
                "type": "algorithm_mismatch",
                "message": f"签名算法不一致: 期望 {expected_algorithm}, 实际 {algorithm}"
            })

        try:
            computed_signature, _ = cls.sign(env_vars, expected_algorithm, key)
            result["signature_valid"] = computed_signature == signature
            if not result["signature_valid"]:
                result["errors"].append({
                    "type": "signature_mismatch",
                    "message": f"签名验证失败: 期望 {computed_signature}, 实际 {signature}"
                })
        except Exception as e:
            result["errors"].append({
                "type": "verification_error",
                "message": f"验证过程出错: {str(e)}"
            })

        return result["algorithm_match"] and result["signature_valid"], result

    @staticmethod
    def detect_algorithm(signature: str) -> Optional[str]:
        sig_len = len(signature)
        if sig_len == 32:
            return "MD5"
        elif sig_len == 64:
            return "SHA256"
        elif sig_len == 128:
            return "SHA512"
        return None
