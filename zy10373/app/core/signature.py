import uuid
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
from app.schemas import ExpiryPolicy


class DownloadSignatureGenerator:
    SECRET_KEY = "watermark_export_secret_2024"

    @classmethod
    def generate_signature(
        cls,
        request_id: str,
        downloader_id: str,
        downloader_name: str,
        expiry_policy: ExpiryPolicy
    ) -> dict:
        timestamp = datetime.now()
        nonce = uuid.uuid4().hex[:8]
        
        expiry_time = cls._calculate_expiry(timestamp, expiry_policy)
        
        signature_data = (
            f"{request_id}:{downloader_id}:{timestamp.isoformat()}:"
            f"{nonce}:{expiry_time.isoformat()}"
        )
        
        signature = hmac.new(
            cls.SECRET_KEY.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        download_url = f"/api/v1/exports/download?signature={signature}&request_id={request_id}"
        
        return {
            "signature": signature,
            "expires_at": expiry_time,
            "download_url": download_url,
            "nonce": nonce,
            "generated_at": timestamp
        }

    @staticmethod
    def _calculate_expiry(start_time: datetime, policy: ExpiryPolicy) -> datetime:
        if policy.type == "hours":
            hours = policy.value or 24
            return start_time + timedelta(hours=hours)
        elif policy.type == "downloads":
            return start_time + timedelta(days=7)
        elif policy.type == "never":
            return start_time + timedelta(days=365 * 10)
        else:
            return start_time + timedelta(hours=24)

    @classmethod
    def verify_signature(
        cls,
        signature: str,
        request_id: str,
        downloader_id: str,
        generated_at: datetime,
        nonce: str,
        expires_at: datetime
    ) -> bool:
        if datetime.now() > expires_at:
            return False
        
        signature_data = (
            f"{request_id}:{downloader_id}:{generated_at.isoformat()}:"
            f"{nonce}:{expires_at.isoformat()}"
        )
        
        expected_signature = hmac.new(
            cls.SECRET_KEY.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
