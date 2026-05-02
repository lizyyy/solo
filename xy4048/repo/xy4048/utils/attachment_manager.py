import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from config import CONFIG
from database import (
    DatabaseManager, Attachment, AttachmentType, DeliveryTask, AuditLog
)


@dataclass
class AttachmentResult:
    success: bool
    attachment: Optional[Attachment] = None
    error_message: str = ""
    is_duplicate: bool = False
    duplicate_info: Dict[str, Any] = None


class AttachmentManager:
    def __init__(self, db: DatabaseManager):
        self.db = db
        self.config = CONFIG
        self.attachments_dir = CONFIG.attachments_dir
    
    def calculate_sha256(self, file_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()
    
    def generate_stored_filename(self, original_filename: str, task_id: int) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_path = Path(original_filename)
        suffix = original_path.suffix or ""
        
        return f"task_{task_id}_{timestamp}{suffix}"
    
    def get_task_attachments_dir(self, task_id: int) -> Path:
        task_dir = self.attachments_dir / f"task_{task_id}"
        task_dir.mkdir(parents=True, exist_ok=True)
        return task_dir
    
    def check_duplicate(
        self,
        file_path: Path,
        file_hash: str,
        task_id: int
    ) -> Tuple[bool, Optional[Attachment]]:
        existing_attachments = self.db.get_all(
            Attachment,
            "task_id = ?",
            (task_id,)
        )
        
        original_filename = file_path.name
        
        for att in existing_attachments:
            if att.original_filename == original_filename:
                if att.sha256_hash == file_hash:
                    return True, att
                else:
                    return True, None
        
        for att in existing_attachments:
            if att.sha256_hash == file_hash:
                return True, att
        
        return False, None
    
    def import_attachment(
        self,
        source_path: Path,
        task_id: int,
        attachment_type: AttachmentType,
        operator: str = "",
        notes: str = ""
    ) -> AttachmentResult:
        if not source_path.exists():
            return AttachmentResult(
                success=False,
                error_message=f"文件不存在: {source_path}"
            )
        
        file_ext = source_path.suffix.lower()
        if file_ext not in [t.lower() for t in self.config.allowed_attachment_types]:
            return AttachmentResult(
                success=False,
                error_message=f"不支持的文件类型: {file_ext}"
            )
        
        file_hash = self.calculate_sha256(source_path)
        file_size = source_path.stat().st_size
        
        is_duplicate, existing_attachment = self.check_duplicate(
            source_path, file_hash, task_id
        )
        
        if is_duplicate:
            if existing_attachment:
                return AttachmentResult(
                    success=True,
                    attachment=existing_attachment,
                    is_duplicate=True,
                    duplicate_info={
                        "message": "相同文件已存在",
                        "existing_id": existing_attachment.id
                    }
                )
            else:
                return AttachmentResult(
                    success=False,
                    error_message="同名但不同内容的文件已存在，请重命名后再导入",
                    is_duplicate=True
                )
        
        task_dir = self.get_task_attachments_dir(task_id)
        stored_filename = self.generate_stored_filename(source_path.name, task_id)
        dest_path = task_dir / stored_filename
        
        shutil.copy2(source_path, dest_path)
        
        attachment = Attachment(
            task_id=task_id,
            attachment_type=attachment_type,
            original_filename=source_path.name,
            stored_filename=stored_filename,
            file_path=str(dest_path),
            file_size=file_size,
            sha256_hash=file_hash,
            notes=notes
        )
        
        attachment = self.db.create(attachment)
        
        self.db.log_audit(
            task_id=task_id,
            action="附件导入",
            operator=operator,
            details=f"导入附件: {source_path.name}, 类型: {attachment_type.value}"
        )
        
        return AttachmentResult(
            success=True,
            attachment=attachment
        )
    
    def check_missing_signature(self, task_id: int) -> Tuple[bool, str]:
        attachments = self.db.get_all(
            Attachment,
            "task_id = ? AND attachment_type = ?",
            (task_id, AttachmentType.SIGNATURE.value)
        )
        
        if not attachments:
            return True, "缺少签收单照片"
        
        return False, ""
    
    def get_all_task_attachments(self, task_id: int) -> List[Attachment]:
        return self.db.get_all(
            Attachment,
            "task_id = ?",
            (task_id,)
        )
    
    def delete_attachment(self, attachment: Attachment, operator: str = "") -> bool:
        file_path = Path(attachment.file_path)
        
        if file_path.exists():
            file_path.unlink()
        
        self.db.log_audit(
            task_id=attachment.task_id,
            action="附件删除",
            operator=operator,
            details=f"删除附件: {attachment.original_filename}"
        )
        
        return self.db.delete(attachment)
    
    def calculate_attachments_hash(self, task_id: int) -> str:
        attachments = self.get_all_task_attachments(task_id)
        
        if not attachments:
            return ""
        
        sorted_attachments = sorted(attachments, key=lambda a: a.created_at or datetime.min)
        
        combined_hashes = "|".join([att.sha256_hash for att in sorted_attachments])
        
        final_hash = hashlib.sha256(combined_hashes.encode('utf-8')).hexdigest()
        
        return final_hash
    
    def verify_attachment_integrity(self, attachment: Attachment) -> Tuple[bool, str]:
        file_path = Path(attachment.file_path)
        
        if not file_path.exists():
            return False, "文件不存在"
        
        current_hash = self.calculate_sha256(file_path)
        
        if current_hash != attachment.sha256_hash:
            return False, f"文件哈希不匹配 (期望: {attachment.sha256_hash}, 实际: {current_hash})"
        
        return True, "文件完整"
