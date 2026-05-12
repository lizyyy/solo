import json
import base64
from pathlib import Path
from datetime import datetime
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend


class CryptoManager:
    def __init__(self, key_dir: Path):
        self.key_dir = key_dir
        self.key_dir.mkdir(parents=True, exist_ok=True)
        self.private_key_path = key_dir / "private_key.pem"
        self.public_key_path = key_dir / "public_key.pem"

    def generate_key_pair(self):
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        with open(self.private_key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        public_key = private_key.public_key()
        with open(self.public_key_path, "wb") as f:
            f.write(public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))

    def load_private_key(self):
        if not self.private_key_path.exists():
            self.generate_key_pair()
        with open(self.private_key_path, "rb") as f:
            return serialization.load_pem_private_key(
                f.read(),
                password=None,
                backend=default_backend()
            )

    def load_public_key(self):
        if not self.public_key_path.exists():
            self.generate_key_pair()
        with open(self.public_key_path, "rb") as f:
            return serialization.load_pem_public_key(
                f.read(),
                backend=default_backend()
            )

    def sign(self, data: str) -> str:
        private_key = self.load_private_key()
        signature = private_key.sign(
            data.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return base64.b64encode(signature).decode()

    def verify(self, data: str, signature: str) -> bool:
        public_key = self.load_public_key()
        try:
            public_key.verify(
                base64.b64decode(signature),
                data.encode(),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False
