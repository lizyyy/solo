import uuid
import hashlib
from datetime import datetime
from typing import Dict, Any
from app.models import Watermark


class WatermarkGenerator:
    @staticmethod
    def generate_watermark_id() -> str:
        return f"WM_{uuid.uuid4().hex[:16].upper()}"

    @staticmethod
    def generate_text_watermark(
        requester_id: str,
        requester_name: str,
        request_id: str,
        timestamp: datetime
    ) -> Dict[str, Any]:
        watermark_hash = hashlib.sha256(
            f"{requester_id}:{request_id}:{timestamp.isoformat()}".encode()
        ).hexdigest()[:16]
        
        return {
            "text": f"Exported by {requester_name} | {request_id} | {timestamp.strftime('%Y-%m-%d %H:%M')}",
            "hash": watermark_hash,
            "opacity": 0.3,
            "position": "diagonal",
            "font_size": 12
        }

    @staticmethod
    def generate_qrcode_watermark(
        requester_id: str,
        request_id: str,
        download_url: str
    ) -> Dict[str, Any]:
        watermark_hash = hashlib.sha256(
            f"{requester_id}:{request_id}:{download_url}".encode()
        ).hexdigest()[:16]
        
        return {
            "data": f"EXPORT|{request_id}|{requester_id}|{datetime.now().isoformat()}",
            "hash": watermark_hash,
            "size": 100,
            "position": "bottom_right"
        }

    @staticmethod
    def generate_custom_watermark(
        custom_content: Dict[str, Any],
        requester_id: str,
        request_id: str
    ) -> Dict[str, Any]:
        watermark_hash = hashlib.sha256(
            f"{requester_id}:{request_id}:{str(custom_content)}".encode()
        ).hexdigest()[:16]
        
        result = custom_content.copy()
        result["hash"] = watermark_hash
        result["generated_at"] = datetime.now().isoformat()
        return result

    @staticmethod
    def verify_watermark(watermark: Watermark, expected_hash: str) -> bool:
        return watermark.content.get("hash") == expected_hash
