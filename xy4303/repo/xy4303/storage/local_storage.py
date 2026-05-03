import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

import config
from models.workbench import Workbench


@dataclass
class StorageResult:
    success: bool = True
    message: str = ""
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class LocalStorage:
    def __init__(
        self,
        storage_file: Optional[Path] = None,
        backup_dir: Optional[Path] = None,
    ):
        self.storage_file = storage_file or config.STORAGE_FILE
        self.backup_dir = backup_dir or config.BACKUP_DIR
        self.max_backups = 10

        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def save(self, workbench: Workbench) -> StorageResult:
        result = StorageResult()

        try:
            self._create_backup()

            data = workbench.to_dict()

            with open(self.storage_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            result.success = True
            result.message = f"保存成功，共 {workbench.item_count} 条记录"

        except Exception as e:
            result.success = False
            result.errors.append(f"保存失败: {str(e)}")

        return result

    def load(self) -> Optional[Workbench]:
        if not self.storage_file.exists():
            return None

        try:
            with open(self.storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            return Workbench.from_dict(data)

        except Exception as e:
            return None

    def _create_backup(self) -> None:
        if not self.storage_file.exists():
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = self.backup_dir / f"backup_{timestamp}.json"

        shutil.copy2(self.storage_file, backup_file)

        self._cleanup_old_backups()

    def _cleanup_old_backups(self) -> None:
        backups = sorted(
            self.backup_dir.glob("backup_*.json"),
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

        for backup in backups[self.max_backups:]:
            try:
                backup.unlink()
            except Exception:
                pass

    def list_backups(self) -> list:
        backups = sorted(
            self.backup_dir.glob("backup_*.json"),
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

        result = []
        for backup in backups:
            stat = backup.stat()
            result.append({
                "name": backup.name,
                "path": str(backup),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime),
            })

        return result

    def restore_from_backup(self, backup_name: str) -> StorageResult:
        result = StorageResult()
        backup_file = self.backup_dir / backup_name

        if not backup_file.exists():
            result.success = False
            result.errors.append(f"备份文件不存在: {backup_name}")
            return result

        try:
            if self.storage_file.exists():
                self._create_backup()

            shutil.copy2(backup_file, self.storage_file)
            result.success = True
            result.message = f"已从备份 {backup_name} 恢复"

        except Exception as e:
            result.success = False
            result.errors.append(f"恢复失败: {str(e)}")

        return result

    def clear(self) -> StorageResult:
        result = StorageResult()

        try:
            if self.storage_file.exists():
                self._create_backup()
                self.storage_file.unlink()

            result.success = True
            result.message = "已清除所有数据"

        except Exception as e:
            result.success = False
            result.errors.append(f"清除失败: {str(e)}")

        return result

    def export_to_file(self, file_path: Path, workbench: Workbench) -> StorageResult:
        result = StorageResult()

        try:
            data = workbench.to_dict()
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            result.success = True
            result.message = f"已导出到 {file_path}"

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result

    def import_from_file(self, file_path: Path) -> tuple[Optional[Workbench], StorageResult]:
        result = StorageResult()
        workbench = None

        if not file_path.exists():
            result.success = False
            result.errors.append(f"文件不存在: {file_path}")
            return workbench, result

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            workbench = Workbench.from_dict(data)
            result.success = True
            result.message = f"导入成功，共 {workbench.item_count} 条记录"

        except Exception as e:
            result.success = False
            result.errors.append(f"导入失败: {str(e)}")

        return workbench, result
