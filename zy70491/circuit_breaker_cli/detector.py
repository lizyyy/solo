from datetime import datetime, timedelta
from typing import Dict, Any, List
from uuid import uuid4

from .models import (
    HandoverRecord,
    Material,
    Attachment,
    AttachmentStatus,
    RecordStatus
)


class AttachmentExpiryDetector:
    def __init__(self, warning_days: int = 7):
        self.warning_days = warning_days

    def detect(self, record: HandoverRecord) -> Dict[str, Any]:
        expired_attachments = []
        expiring_soon = []
        all_attachments = []

        for material in record.materials:
            for attachment in material.attachments:
                attachment_info = {
                    "attachment_id": attachment.id,
                    "attachment_name": attachment.name,
                    "material_id": material.id,
                    "material_name": material.name,
                    "expire_time": attachment.expire_time.isoformat() if attachment.expire_time else None
                }
                all_attachments.append(attachment_info)

                if attachment.expire_time:
                    if attachment.is_expired():
                        attachment.status = AttachmentStatus.EXPIRED
                        expired_attachments.append(attachment_info)
                    elif (attachment.expire_time - datetime.now()) <= timedelta(days=self.warning_days):
                        expiring_soon.append(attachment_info)

        is_abnormal = len(expired_attachments) > 0
        reason_parts = []
        
        if expired_attachments:
            reason_parts.append(f"发现 {len(expired_attachments)} 个已过期附件")
        if expiring_soon:
            reason_parts.append(f"发现 {len(expiring_soon)} 个即将过期附件（{self.warning_days}天内）")
        
        reason = "; ".join(reason_parts) if reason_parts else "所有附件状态正常"

        return {
            "is_abnormal": is_abnormal,
            "reason": reason,
            "details": {
                "total_attachments": len(all_attachments),
                "expired_count": len(expired_attachments),
                "expiring_soon_count": len(expiring_soon),
                "expired_attachments": expired_attachments,
                "expiring_soon_attachments": expiring_soon,
                "all_attachments": all_attachments
            }
        }

    def detect_and_update(self, record: HandoverRecord) -> None:
        result = self.detect(record)
        record.set_system_judgment(
            is_abnormal=result["is_abnormal"],
            reason=result["reason"],
            details=result["details"]
        )