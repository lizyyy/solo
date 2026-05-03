import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .config import CheckerConfig
from .models import AttachmentFile


SUPPORTED_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".json",
}


class FileScanner:
    def __init__(self, config: CheckerConfig):
        self.config = config
    
    def scan_directory(self, directory: Path) -> list[AttachmentFile]:
        attachments: list[AttachmentFile] = []
        
        if not directory.exists():
            return attachments
        
        for file_path in directory.iterdir():
            if file_path.is_file():
                attachment = self._process_file(file_path)
                if attachment:
                    attachments.append(attachment)
            elif file_path.is_dir():
                sub_attachments = self.scan_directory(file_path)
                attachments.extend(sub_attachments)
        
        return attachments
    
    def _process_file(self, file_path: Path) -> Optional[AttachmentFile]:
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return None
        
        if file_path.name.startswith("."):
            return None
        
        stat = file_path.stat()
        size = stat.st_size
        last_modified = datetime.fromtimestamp(stat.st_mtime)
        
        invoice_number = self._extract_invoice_number(file_path)
        expense_id = self._extract_expense_id(file_path)
        
        sidecar_meta = self._read_sidecar_meta(file_path)
        if sidecar_meta:
            if "invoice_number" in sidecar_meta and not invoice_number:
                invoice_number = str(sidecar_meta["invoice_number"])
            if "expense_id" in sidecar_meta and not expense_id:
                expense_id = str(sidecar_meta["expense_id"])
        
        return AttachmentFile(
            filename=file_path.name,
            full_path=str(file_path),
            file_type=file_path.suffix.lower()[1:],
            size=size,
            last_modified=last_modified,
            invoice_number=invoice_number,
            expense_id=expense_id,
            sidecar_meta=sidecar_meta,
        )
    
    def _extract_invoice_number(self, file_path: Path) -> Optional[str]:
        name = file_path.stem
        
        patterns = [
            r'(?:发票|invoice|fp)[_\s-]*(\d{8,20})',
            r'(?:发票|invoice|fp)[_\s-]*([A-Z]{2,3}\d{8,15})',
            r'(\d{8,20})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_expense_id(self, file_path: Path) -> Optional[str]:
        name = file_path.stem
        
        patterns = [
            r'(?:报销|expense|bx|pay)[_\s-]*([A-Z0-9_-]{6,30})',
            r'(?:报销|expense|bx|pay)[_\s-]*(\d{6,20})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _read_sidecar_meta(self, file_path: Path) -> Optional[dict[str, Any]]:
        json_path = file_path.with_suffix(".json")
        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        
        meta_dir = file_path.parent / ".meta"
        if meta_dir.exists() and meta_dir.is_dir():
            meta_file = meta_dir / f"{file_path.name}.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception:
                    pass
        
        return None
    
    def get_files_by_invoice(self, attachments: list[AttachmentFile]) -> dict[str, list[AttachmentFile]]:
        result: dict[str, list[AttachmentFile]] = {}
        for att in attachments:
            if att.invoice_number:
                if att.invoice_number not in result:
                    result[att.invoice_number] = []
                result[att.invoice_number].append(att)
        return result
    
    def get_files_by_expense_id(self, attachments: list[AttachmentFile]) -> dict[str, list[AttachmentFile]]:
        result: dict[str, list[AttachmentFile]] = {}
        for att in attachments:
            if att.expense_id:
                if att.expense_id not in result:
                    result[att.expense_id] = []
                result[att.expense_id].append(att)
        return result
