import base64
from pathlib import Path
from typing import Optional

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    from cryptography.exceptions import InvalidSignature
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False


class SignatureVerifier:
    def __init__(self, public_key_pem: Optional[str] = None, public_key_path: Optional[Path] = None):
        if not HAS_CRYPTOGRAPHY:
            raise ImportError("cryptography 库未安装，请运行 pip install cryptography")
        
        self._public_key = None
        
        if public_key_path:
            self._load_public_key_from_file(public_key_path)
        elif public_key_pem:
            self._load_public_key_from_pem(public_key_pem)

    def _load_public_key_from_file(self, path: Path):
        with open(path, "rb") as f:
            self._public_key = serialization.load_pem_public_key(f.read())

    def _load_public_key_from_pem(self, pem_data: str):
        if not pem_data.startswith("-----"):
            if "\n" not in pem_data:
                pem_data = "\n".join([pem_data[i:i+64] for i in range(0, len(pem_data), 64)])
            pem_data = f"-----BEGIN PUBLIC KEY-----\n{pem_data}\n-----END PUBLIC KEY-----"
        
        self._public_key = serialization.load_pem_public_key(pem_data.encode("utf-8"))

    def verify_sha256_rsa(self, data: bytes, signature_base64: str) -> bool:
        if self._public_key is None:
            raise ValueError("公钥未设置")
        
        try:
            signature = base64.b64decode(signature_base64)
        except Exception as e:
            raise ValueError(f"签名解码失败: {e}")
        
        try:
            self._public_key.verify(
                signature,
                data,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            return True
        except InvalidSignature:
            return False
        except Exception as e:
            raise ValueError(f"签名验证过程出错: {e}")

    def verify_manifest_signature(
        self, 
        manifest_dict: dict, 
        signature: str,
        exclude_fields: list = ["signature", "signed_by", "signature_algorithm"]
    ) -> bool:
        import json
        
        manifest_copy = {k: v for k, v in manifest_dict.items() if k not in exclude_fields}
        
        manifest_json = json.dumps(
            manifest_copy, 
            sort_keys=True, 
            indent=None, 
            ensure_ascii=False
        )
        
        return self.verify_sha256_rsa(manifest_json.encode("utf-8"), signature)


def verify_file_signature(
    file_path: Path,
    signature_base64: str,
    public_key_pem: Optional[str] = None,
    public_key_path: Optional[Path] = None
) -> bool:
    verifier = SignatureVerifier(public_key_pem, public_key_path)
    
    with open(file_path, "rb") as f:
        file_data = f.read()
    
    return verifier.verify_sha256_rsa(file_data, signature_base64)
