import os
import hashlib
import sqlite3
import struct
import tempfile
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime


@dataclass
class FileInfo:
    path: str
    exists: bool
    size: int = 0
    sha256: str = ""
    modified_at: datetime = None


@dataclass
class PageInfo:
    page_number: int
    offset: int
    size: int
    checksum_valid: bool
    error: Optional[str] = None


@dataclass
class ValidationResult:
    db_file: FileInfo
    wal_file: Optional[FileInfo]
    is_valid: bool
    page_count: int = 0
    valid_pages: int = 0
    pages: List[PageInfo] = field(default_factory=list)
    errors: List[Dict] = field(default_factory=list)
    warnings: List[Dict] = field(default_factory=list)


class SQLiteBackupChecker:
    SQLITE_HEADER = b"SQLite format 3\x00"
    WAL_HEADER = b"\x37\x7f\x06\x82"
    PAGE_SIZE_OFFSETS = [16, 17]

    def __init__(self, db_path: str, wal_path: Optional[str] = None):
        self.db_path = Path(db_path)
        self.wal_path = Path(wal_path) if wal_path else None
        self.result = None

    def _get_file_info(self, path: Path) -> FileInfo:
        if not path.exists():
            return FileInfo(path=str(path), exists=False)
        
        stat = path.stat()
        with open(path, "rb") as f:
            file_hash = hashlib.sha256()
            while chunk := f.read(8192):
                file_hash.update(chunk)
        
        return FileInfo(
            path=str(path),
            exists=True,
            size=stat.st_size,
            sha256=file_hash.hexdigest(),
            modified_at=datetime.fromtimestamp(stat.st_mtime)
        )

    def _read_page_size(self, db_file) -> int:
        db_file.seek(16)
        page_size_bytes = db_file.read(2)
        page_size = struct.unpack(">H", page_size_bytes)[0]
        if page_size == 1:
            return 65536
        return page_size

    def _validate_sqlite_header(self, db_file) -> Tuple[bool, Optional[str]]:
        db_file.seek(0)
        header = db_file.read(16)
        if header != self.SQLITE_HEADER:
            return False, f"无效的SQLite头: 期望 {self.SQLITE_HEADER!r}, 实际 {header!r}"
        return True, None

    def _validate_wal_header(self, wal_file) -> Tuple[bool, Optional[str]]:
        wal_file.seek(0)
        header = wal_file.read(4)
        if header != self.WAL_HEADER:
            return False, f"无效的WAL头: 期望 {self.WAL_HEADER!r}, 实际 {header!r}"
        return True, None

    def _calculate_page_checksum(self, page_data: bytes) -> int:
        if len(page_data) < 8:
            return 0
        s1 = 0
        s2 = 0
        for i in range(0, len(page_data) - 8, 4):
            val = struct.unpack(">I", page_data[i:i+4])[0]
            s1 = (s1 + val) & 0xFFFFFFFF
            s2 = (s2 + s1) & 0xFFFFFFFF
        return (s2 << 32) | s1

    def _get_page_checksum_from_footer(self, page_data: bytes) -> int:
        if len(page_data) < 8:
            return 0
        return struct.unpack(">Q", page_data[-8:])[0]

    def check_database(self) -> ValidationResult:
        errors = []
        warnings = []
        pages = []
        
        db_info = self._get_file_info(self.db_path)
        wal_info = self._get_file_info(self.wal_path) if self.wal_path and self.wal_path.exists() else None
        
        if not db_info.exists:
            errors.append({
                "type": "file_missing",
                "message": f"数据库文件不存在: {self.db_path}",
                "location": str(self.db_path)
            })
            return ValidationResult(
                db_file=db_info,
                wal_file=wal_info,
                is_valid=False,
                errors=errors
            )

        try:
            with open(self.db_path, "rb") as db_file:
                header_valid, header_err = self._validate_sqlite_header(db_file)
                if not header_valid:
                    errors.append({
                        "type": "invalid_header",
                        "message": header_err,
                        "location": f"{self.db_path}:0"
                    })
                    return ValidationResult(
                        db_file=db_info,
                        wal_file=wal_info,
                        is_valid=False,
                        errors=errors
                    )

                page_size = self._read_page_size(db_file)
                db_file_size = db_info.size
                page_count = db_file_size // page_size
                
        except Exception as e:
            errors.append({
                "type": "read_error",
                "message": f"读取数据库文件失败: {str(e)}",
                "location": str(self.db_path)
            })

        if wal_info:
            wal_valid, wal_err = self._check_wal_file()
            if not wal_valid:
                warnings.append({
                    "type": "wal_issue",
                    "message": wal_err,
                    "location": str(self.wal_path)
                })

        try:
            temp_dir = tempfile.mkdtemp()
            try:
                temp_db = os.path.join(temp_dir, "temp.db")
                shutil.copy2(self.db_path, temp_db)
                
                if self.wal_path and self.wal_path.exists():
                    temp_wal = temp_db + "-wal"
                    shutil.copy2(self.wal_path, temp_wal)
                
                conn = sqlite3.connect(temp_db)
                cursor = conn.cursor()
                
                cursor.execute("PRAGMA integrity_check")
                result = cursor.fetchone()
                integrity_result = result[0]
                
                if integrity_result != "ok":
                    errors.append({
                        "type": "integrity_error",
                        "message": f"SQLite完整性检查失败: {integrity_result}",
                        "location": str(self.db_path)
                    })
                
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                
                valid_pages = page_count
                
                conn.close()
                
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        except sqlite3.DatabaseError as e:
            errors.append({
                "type": "sqlite_error",
                "message": f"SQLite错误: {str(e)}",
                "location": str(self.db_path)
            })
        except Exception as e:
            errors.append({
                "type": "check_error",
                "message": f"检查失败: {str(e)}",
                "location": str(self.db_path)
            })

        is_valid = len(errors) == 0
        
        return ValidationResult(
            db_file=db_info,
            wal_file=wal_info,
            is_valid=is_valid,
            page_count=page_count,
            valid_pages=valid_pages if 'valid_pages' in locals() else 0,
            pages=pages,
            errors=errors,
            warnings=warnings
        )

    def _check_wal_file(self) -> Tuple[bool, Optional[str]]:
        if not self.wal_path or not self.wal_path.exists():
            return True, None
        
        try:
            with open(self.wal_path, "rb") as wal_file:
                header_valid, header_err = self._validate_wal_header(wal_file)
                if not header_valid:
                    return False, header_err
                
                file_size = self.wal_path.stat().st_size
                if file_size < 32:
                    return False, "WAL文件太小，不包含有效数据"
                
        except Exception as e:
            return False, f"读取WAL文件失败: {str(e)}"
        
        return True, None

    def try_restore(self, output_path: Optional[str] = None) -> Tuple[bool, List[str]]:
        messages = []
        success = False
        
        if output_path is None:
            output_path = str(self.db_path).replace(".db", "_restored.db")
        
        output_dir = Path(output_path).parent
        if not output_dir.exists():
            output_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            temp_dir = tempfile.mkdtemp()
            try:
                temp_db = os.path.join(temp_dir, "temp.db")
                shutil.copy2(self.db_path, temp_db)
                
                if self.wal_path and self.wal_path.exists():
                    temp_wal = temp_db + "-wal"
                    shutil.copy2(self.wal_path, temp_wal)
                
                conn = sqlite3.connect(temp_db)
                cursor = conn.cursor()
                
                cursor.execute("PRAGMA integrity_check")
                result = cursor.fetchone()
                if result[0] != "ok":
                    messages.append(f"完整性检查失败: {result[0]}")
                else:
                    messages.append("SQLite完整性检查通过")
                
                cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                conn.commit()
                
                shutil.copy2(temp_db, output_path)
                messages.append(f"恢复的数据库已保存到: {output_path}")
                success = True
                
                conn.close()
                
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        except sqlite3.DatabaseError as e:
            messages.append(f"SQLite错误: {str(e)}")
            success = False
        except Exception as e:
            messages.append(f"恢复失败: {str(e)}")
            success = False
        
        return success, messages
