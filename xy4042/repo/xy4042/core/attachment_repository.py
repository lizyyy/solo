from datetime import datetime
from typing import List, Optional

from models.attachment import Attachment
from core.base_repository import BaseRepository


class AttachmentRepository(BaseRepository[Attachment]):
    def _table_name(self) -> str:
        return "attachments"
    
    def _row_to_model(self, row) -> Attachment:
        return Attachment.from_row(row)
    
    def create(self, attachment: Attachment) -> Attachment:
        now = datetime.now()
        sql = """
            INSERT INTO attachments (
                order_id, file_name, original_name, file_path,
                file_type, file_size, sha256_hash, category, notes, is_missing, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                attachment.order_id, attachment.file_name, attachment.original_name,
                attachment.file_path, attachment.file_type, attachment.file_size,
                attachment.sha256_hash, attachment.category, attachment.notes,
                attachment.is_missing, now
            )
        )
        attachment.id = cursor.lastrowid
        attachment.created_at = now
        return attachment
    
    def get_by_order(self, order_id: int) -> List[Attachment]:
        sql = """
            SELECT * FROM attachments 
            WHERE order_id = ? 
            ORDER BY created_at DESC
        """
        cursor = self.db.execute(sql, (order_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_hash(self, sha256_hash: str) -> List[Attachment]:
        sql = """
            SELECT * FROM attachments 
            WHERE sha256_hash = ?
        """
        cursor = self.db.execute(sql, (sha256_hash,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_original_name(self, order_id: int, original_name: str) -> List[Attachment]:
        sql = """
            SELECT * FROM attachments 
            WHERE order_id = ? AND original_name = ?
            ORDER BY created_at DESC
        """
        cursor = self.db.execute(sql, (order_id, original_name))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def mark_missing(self, attachment_id: int, is_missing: bool = True) -> None:
        sql = "UPDATE attachments SET is_missing = ? WHERE id = ?"
        self.db.execute(sql, (is_missing, attachment_id))
    
    def get_images(self, order_id: int) -> List[Attachment]:
        return [
            a for a in self.get_by_order(order_id) 
            if a.is_image()
        ]
    
    def get_scans(self, order_id: int) -> List[Attachment]:
        return [
            a for a in self.get_by_order(order_id) 
            if a.is_scan()
        ]
