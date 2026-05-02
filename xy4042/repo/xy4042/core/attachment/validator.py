from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional, Any

from core.attachment.hasher import compute_sha256, verify_file_integrity
from models.attachment import Attachment
from models.measurement import Measurement


@dataclass
class ValidationIssue:
    severity: str
    type: str
    message: str
    details: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class AttachmentValidator:
    def __init__(self):
        pass
    
    def validate_attachment(
        self,
        attachment: Attachment,
        existing_attachments: List[Attachment]
    ) -> List[ValidationIssue]:
        issues = []
        
        same_name_attachments = [
            a for a in existing_attachments 
            if a.original_name == attachment.original_name and a.id != attachment.id
        ]
        
        for same_name_att in same_name_attachments:
            if same_name_att.sha256_hash != attachment.sha256_hash:
                issues.append(ValidationIssue(
                    severity="warning",
                    type="duplicate_name_different_content",
                    message=f"同名文件但内容不同: {attachment.original_name}",
                    details={
                        "existing_id": same_name_att.id,
                        "existing_hash": same_name_att.sha256_hash,
                        "new_hash": attachment.sha256_hash
                    }
                ))
        
        file_path = Path(attachment.file_path)
        if not file_path.exists():
            issues.append(ValidationIssue(
                severity="error",
                type="missing_file",
                message=f"文件缺失: {attachment.original_name}",
                details={"file_path": str(file_path)}
            ))
        else:
            actual_hash = compute_sha256(file_path)
            if actual_hash != attachment.sha256_hash:
                issues.append(ValidationIssue(
                    severity="error",
                    type="file_corrupted",
                    message=f"文件完整性校验失败: {attachment.original_name}",
                    details={
                        "expected_hash": attachment.sha256_hash,
                        "actual_hash": actual_hash
                    }
                ))
        
        return issues
    
    def validate_order_attachments(
        self,
        attachments: List[Attachment],
        measurements: List[Measurement]
    ) -> List[ValidationIssue]:
        issues = []
        
        scan_attachments = [a for a in attachments if a.is_scan()]
        image_attachments = [a for a in attachments if a.is_image()]
        
        if not scan_attachments and not image_attachments:
            issues.append(ValidationIssue(
                severity="warning",
                type="no_visual_reference",
                message="订单没有扫描文件或取模照片",
                details={}
            ))
        
        for attachment in attachments:
            file_path = Path(attachment.file_path)
            if not file_path.exists():
                issues.append(ValidationIssue(
                    severity="error",
                    type="missing_attachment",
                    message=f"附件文件缺失: {attachment.original_name}",
                    details={
                        "attachment_id": attachment.id,
                        "file_path": attachment.file_path
                    }
                ))
        
        if measurements and attachments:
            latest_measurement = max(measurements, key=lambda m: m.version)
            latest_attachment = max(attachments, key=lambda a: a.created_at or a.id)
            
            if latest_measurement.created_at and latest_attachment.created_at:
                if latest_measurement.created_at > latest_attachment.created_at:
                    issues.append(ValidationIssue(
                        severity="info",
                        type="measurement_newer_than_attachments",
                        message="最新尺寸记录晚于附件上传时间，可能需要更新照片",
                        details={
                            "measurement_version": latest_measurement.version,
                            "measurement_date": latest_measurement.created_at,
                            "latest_attachment_date": latest_attachment.created_at
                        }
                    ))
        
        return issues
    
    def check_duplicate_names(
        self,
        attachments: List[Attachment]
    ) -> Dict[str, List[Attachment]]:
        name_map: Dict[str, List[Attachment]] = {}
        for att in attachments:
            if att.original_name not in name_map:
                name_map[att.original_name] = []
            name_map[att.original_name].append(att)
        
        return {name: atts for name, atts in name_map.items() if len(atts) > 1}
