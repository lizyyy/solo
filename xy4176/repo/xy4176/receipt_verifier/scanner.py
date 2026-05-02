"""文件扫描模块 - 扫描目录并计算文件哈希"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Set

from tqdm import tqdm

from .models import FileType, ScannedFile
from .utils import calculate_file_hash


class DirectoryScanner:
    """目录扫描器"""

    DEFAULT_EXTENSIONS = {
        ".pdf": FileType.PDF_RECEIPT,
        ".csv": FileType.UNKNOWN,
        ".json": FileType.UNKNOWN,
        ".xlsx": FileType.UNKNOWN,
        ".xls": FileType.UNKNOWN,
    }

    def __init__(
        self,
        directory: str,
        recursive: bool = True,
        hash_algorithm: str = "sha256",
        exclude_patterns: Optional[List[str]] = None,
    ):
        """初始化扫描器

        Args:
            directory: 要扫描的目录路径
            recursive: 是否递归扫描子目录
            hash_algorithm: 哈希算法（md5, sha1, sha256, sha512）
            exclude_patterns: 要排除的文件模式列表
        """
        self.directory = Path(directory).resolve()
        self.recursive = recursive
        self.hash_algorithm = hash_algorithm
        self.exclude_patterns = exclude_patterns or []

        if not self.directory.exists():
            raise FileNotFoundError(f"目录不存在: {self.directory}")
        if not self.directory.is_dir():
            raise NotADirectoryError(f"不是目录: {self.directory}")

    def _should_exclude(self, file_path: Path) -> bool:
        """检查文件是否应该被排除

        Args:
            file_path: 文件路径

        Returns:
            是否排除
        """
        file_name = file_path.name
        file_path_str = str(file_path)

        for pattern in self.exclude_patterns:
            if pattern in file_name or pattern in file_path_str:
                return True

        if file_name.startswith(".") or file_name.startswith("~"):
            return True

        return False

    def _detect_file_type(self, file_path: Path) -> FileType:
        """根据文件名和扩展名检测文件类型

        Args:
            file_path: 文件路径

        Returns:
            文件类型枚举
        """
        ext = file_path.suffix.lower()
        file_name = file_path.name.lower()

        if ext == ".pdf":
            return FileType.PDF_RECEIPT

        if ext == ".csv":
            if "erp" in file_name or "payment" in file_name or "付款" in file_name:
                return FileType.CSV_ERP
            if "ledger" in file_name or "台账" in file_name or "supplier" in file_name:
                return FileType.CSV_LEDGER
            return FileType.UNKNOWN

        if ext == ".json":
            if "invoice" in file_name or "发票" in file_name:
                return FileType.JSON_INVOICE
            return FileType.UNKNOWN

        if ext in (".xlsx", ".xls"):
            if "erp" in file_name or "payment" in file_name:
                return FileType.CSV_ERP
            if "ledger" in file_name or "台账" in file_name:
                return FileType.CSV_LEDGER
            return FileType.UNKNOWN

        return FileType.UNKNOWN

    def scan(self, show_progress: bool = True) -> List[ScannedFile]:
        """执行目录扫描

        Args:
            show_progress: 是否显示进度条

        Returns:
            扫描到的文件列表
        """
        scanned_files: List[ScannedFile] = []

        if self.recursive:
            file_paths = list(self.directory.rglob("*"))
        else:
            file_paths = list(self.directory.glob("*"))

        file_paths = [p for p in file_paths if p.is_file() and not self._should_exclude(p)]

        if show_progress:
            file_paths = tqdm(file_paths, desc="扫描文件", unit="个")

        for file_path in file_paths:
            try:
                stat = file_path.stat()
                file_hash = calculate_file_hash(file_path, self.hash_algorithm)

                scanned_file = ScannedFile(
                    file_path=str(file_path),
                    file_name=file_path.name,
                    file_size=stat.st_size,
                    file_hash=file_hash,
                    modified_time=datetime.fromtimestamp(stat.st_mtime),
                    file_type=self._detect_file_type(file_path),
                )
                scanned_files.append(scanned_file)
            except Exception as e:
                print(f"警告: 无法读取文件 {file_path}: {e}")
                continue

        return scanned_files

    def scan_and_save(self, output_path: str, show_progress: bool = True) -> List[ScannedFile]:
        """扫描并保存结果到 JSON 文件

        Args:
            output_path: 输出 JSON 文件路径
            show_progress: 是否显示进度条

        Returns:
            扫描到的文件列表
        """
        scanned_files = self.scan(show_progress=show_progress)

        result = {
            "scan_info": {
                "directory": str(self.directory),
                "scan_time": datetime.now().isoformat(),
                "hash_algorithm": self.hash_algorithm,
                "recursive": self.recursive,
                "total_files": len(scanned_files),
            },
            "files": [
                {
                    "file_path": f.file_path,
                    "file_name": f.file_name,
                    "file_size": f.file_size,
                    "file_hash": f.file_hash,
                    "modified_time": f.modified_time.isoformat(),
                    "file_type": f.file_type.value,
                }
                for f in scanned_files
            ],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return scanned_files

    @staticmethod
    def find_duplicates(files: List[ScannedFile]) -> List[List[ScannedFile]]:
        """查找重复文件（基于哈希值）

        Args:
            files: 扫描到的文件列表

        Returns:
            重复文件组列表，每组包含至少2个相同哈希的文件
        """
        hash_to_files: dict = {}

        for file in files:
            if file.file_hash not in hash_to_files:
                hash_to_files[file.file_hash] = []
            hash_to_files[file.file_hash].append(file)

        duplicates = [group for group in hash_to_files.values() if len(group) > 1]

        return duplicates

    @staticmethod
    def get_file_stats(files: List[ScannedFile]) -> dict:
        """获取文件统计信息

        Args:
            files: 扫描到的文件列表

        Returns:
            统计信息字典
        """
        total_size = sum(f.file_size for f in files)
        type_counts: dict = {}

        for f in files:
            type_name = f.file_type.value
            if type_name not in type_counts:
                type_counts[type_name] = 0
            type_counts[type_name] += 1

        return {
            "total_files": len(files),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "file_type_counts": type_counts,
        }


def scan_directory(
    directory: str,
    recursive: bool = True,
    hash_algorithm: str = "sha256",
    output: Optional[str] = None,
) -> List[ScannedFile]:
    """便捷函数：扫描目录

    Args:
        directory: 要扫描的目录
        recursive: 是否递归扫描
        hash_algorithm: 哈希算法
        output: 可选的输出 JSON 文件路径

    Returns:
        扫描到的文件列表
    """
    scanner = DirectoryScanner(
        directory=directory,
        recursive=recursive,
        hash_algorithm=hash_algorithm,
    )

    if output:
        return scanner.scan_and_save(output)
    else:
        return scanner.scan()
