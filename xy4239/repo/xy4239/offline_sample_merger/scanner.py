"""
包扫描模块 - 负责扫描和发现离线样本包
"""

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .models import PackageInfo


class PackageScanner:
    SUPPORTED_FORMATS = [".csv", ".json", ".jsonl"]
    PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff"]

    def __init__(self, scan_dir: str, recursive: bool = True):
        self.scan_dir = Path(scan_dir).resolve()
        self.recursive = recursive
        self.packages: List[PackageInfo] = []
        self.errors: List[str] = []

    def scan(self) -> List[PackageInfo]:
        if not self.scan_dir.exists():
            raise NotADirectoryError(f"扫描目录不存在: {self.scan_dir}")
        
        if not self.scan_dir.is_dir():
            raise NotADirectoryError(f"路径不是目录: {self.scan_dir}")

        self.packages = []
        self.errors = []

        self._scan_directory(self.scan_dir)

        return self.packages

    def _scan_directory(self, directory: Path):
        for item in directory.iterdir():
            if item.is_dir():
                if self._is_package_directory(item):
                    package = self._process_package_directory(item)
                    if package:
                        self.packages.append(package)
                elif self.recursive:
                    self._scan_directory(item)
            elif item.is_file() and self._is_data_file(item):
                package = self._process_single_file(item)
                if package:
                    self.packages.append(package)

    def _is_package_directory(self, path: Path) -> bool:
        manifest_file = path / "manifest.json"
        if manifest_file.exists():
            return True
        
        data_files = list(path.glob("*.csv")) + list(path.glob("*.json")) + list(path.glob("*.jsonl"))
        return len(data_files) > 0

    def _is_data_file(self, path: Path) -> bool:
        return path.suffix.lower() in self.SUPPORTED_FORMATS

    def _is_photo_file(self, path: Path) -> bool:
        return path.suffix.lower() in self.PHOTO_EXTENSIONS

    def _process_package_directory(self, path: Path) -> Optional[PackageInfo]:
        try:
            name = path.name
            package_format = "directory"

            manifest_path = path / "manifest.json"
            checksum = ""
            created_at = None
            source_device = ""
            collector = ""

            if manifest_path.exists():
                manifest = self._read_manifest(manifest_path)
                checksum = manifest.get("checksum", "")
                created_at_str = manifest.get("created_at")
                if created_at_str:
                    try:
                        created_at = datetime.fromisoformat(created_at_str)
                    except ValueError:
                        pass
                source_device = manifest.get("device", "")
                collector = manifest.get("collector", "")

            if not checksum:
                checksum = self._calculate_directory_checksum(path)

            file_count = 0
            sample_count = 0
            photo_count = 0

            for item in path.rglob("*") if self.recursive else path.iterdir():
                if item.is_file():
                    file_count += 1
                    if self._is_data_file(item):
                        samples = self._count_samples_in_file(item)
                        sample_count += samples
                    elif self._is_photo_file(item):
                        photo_count += 1

            package = PackageInfo(
                name=name,
                path=str(path),
                format=package_format,
                checksum=checksum,
                file_count=file_count,
                sample_count=sample_count,
                created_at=created_at,
                source_device=source_device,
                collector=collector,
            )

            return package

        except Exception as e:
            self.errors.append(f"处理目录包 {path} 时出错: {str(e)}")
            return None

    def _process_single_file(self, path: Path) -> Optional[PackageInfo]:
        try:
            name = path.stem
            package_format = path.suffix.lower().lstrip(".")

            checksum = self._calculate_file_checksum(path)
            sample_count = self._count_samples_in_file(path)

            stat = path.stat()
            created_at = datetime.fromtimestamp(stat.st_ctime)

            package = PackageInfo(
                name=name,
                path=str(path),
                format=package_format,
                checksum=checksum,
                file_count=1,
                sample_count=sample_count,
                created_at=created_at,
                source_device="",
                collector="",
            )

            return package

        except Exception as e:
            self.errors.append(f"处理单文件 {path} 时出错: {str(e)}")
            return None

    def _read_manifest(self, manifest_path: Path) -> Dict[str, Any]:
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _calculate_file_checksum(self, file_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _calculate_directory_checksum(self, dir_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        
        files = sorted(dir_path.rglob("*")) if self.recursive else sorted(dir_path.iterdir())
        
        for file_path in files:
            if file_path.is_file():
                relative_path = str(file_path.relative_to(dir_path))
                sha256_hash.update(relative_path.encode("utf-8"))
                sha256_hash.update(b"|")
                
                with open(file_path, "rb") as f:
                    for byte_block in iter(lambda: f.read(4096), b""):
                        sha256_hash.update(byte_block)
                sha256_hash.update(b"|")

        return sha256_hash.hexdigest()

    def _count_samples_in_file(self, file_path: Path) -> int:
        try:
            suffix = file_path.suffix.lower()
            
            if suffix == ".json":
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return len(data)
                    elif isinstance(data, dict):
                        if "samples" in data:
                            return len(data["samples"])
                        elif "records" in data:
                            return len(data["records"])
                        else:
                            return 1
                    return 0
                    
            elif suffix == ".jsonl":
                count = 0
                with open(file_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            count += 1
                return count
                
            elif suffix == ".csv":
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    if len(lines) <= 1:
                        return 0
                    return len(lines) - 1
                    
            return 0
            
        except Exception:
            return 0

    def get_packages_by_name(self, name: str) -> List[PackageInfo]:
        return [p for p in self.packages if p.name == name]

    def get_packages_by_format(self, fmt: str) -> List[PackageInfo]:
        return [p for p in self.packages if p.format == fmt]

    def get_errors(self) -> List[str]:
        return self.errors
