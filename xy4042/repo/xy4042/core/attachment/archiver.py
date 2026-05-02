import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

from config.settings import get_settings
from core.attachment.hasher import compute_sha256
from models.attachment import Attachment


class AttachmentArchiver:
    def __init__(self):
        self.settings = get_settings()
        self.attachments_dir = self.settings.attachments_dir
    
    def archive_file(
        self,
        source_path: Path,
        order_id: int,
        category: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Attachment:
        if not source_path.exists():
            raise FileNotFoundError(f"源文件不存在: {source_path}")
        
        file_ext = source_path.suffix.lower()
        if file_ext not in self.settings.allowed_attachment_types:
            raise ValueError(f"不支持的文件类型: {file_ext}")
        
        order_dir = self.attachments_dir / f"order_{order_id}"
        order_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        file_name = f"{timestamp}_{unique_id}{file_ext}"
        dest_path = order_dir / file_name
        
        shutil.copy2(source_path, dest_path)
        
        file_size = dest_path.stat().st_size
        sha256_hash = compute_sha256(dest_path)
        
        file_type = self._get_file_type(file_ext)
        
        attachment = Attachment(
            order_id=order_id,
            file_name=file_name,
            original_name=source_path.name,
            file_path=str(dest_path),
            file_type=file_type,
            file_size=file_size,
            sha256_hash=sha256_hash,
            category=category,
            notes=notes
        )
        
        return attachment
    
    def _get_file_type(self, ext: str) -> str:
        if ext in self.settings.image_types:
            return "image"
        elif ext in self.settings.scan_types:
            return "scan"
        elif ext == ".pdf":
            return "pdf"
        else:
            return "document"
    
    def get_attachment_path(self, attachment: Attachment) -> Path:
        return Path(attachment.file_path)
    
    def delete_attachment(self, attachment: Attachment) -> bool:
        file_path = Path(attachment.file_path)
        if file_path.exists():
            file_path.unlink()
            return True
        return False
