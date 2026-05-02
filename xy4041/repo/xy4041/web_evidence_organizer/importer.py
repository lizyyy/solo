#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
证据导入模块
导入证据文件，计算哈希，识别重复，提取元数据
"""

import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image
from PIL.ExifTags import TAGS

from .config import CaseConfig, EvidenceRecord, EvidenceType
from .hasher import DuplicateDetector, Hasher


class EvidenceImporter:
    """证据导入器"""

    SUPPORTED_EXTENSIONS = {
        ".html", ".htm", ".mhtml", ".mht",
        ".har", ".png", ".jpg", ".jpeg",
        ".pdf", ".txt"
    }

    def __init__(self, config: CaseConfig):
        self.config = config
        self.duplicate_detector = DuplicateDetector()
        self.evidence_records: List[EvidenceRecord] = []
        self.import_results: Dict = {
            "total": 0,
            "imported": 0,
            "duplicates": 0,
            "name_conflicts": 0,
            "skipped": 0,
            "errors": 0,
            "details": [],
        }

    def scan_directory(self, directory: str) -> List[str]:
        """
        扫描目录获取所有支持的证据文件

        Args:
            directory: 目录路径

        Returns:
            文件路径列表
        """
        dir_path = Path(directory)
        if not dir_path.exists():
            raise ValueError(f"目录不存在: {directory}")

        files = []
        for ext in self.SUPPORTED_EXTENSIONS:
            files.extend(dir_path.rglob(f"*{ext}"))
            files.extend(dir_path.rglob(f"*{ext.upper()}"))

        return [str(f.absolute()) for f in files]

    def extract_image_metadata(self, file_path: str) -> Dict:
        """
        提取图片元数据（用于检测截图篡改）

        Args:
            file_path: 图片文件路径

        Returns:
            元数据字典
        """
        metadata = {
            "has_exif": False,
            "exif_data": {},
            "image_info": {},
            "suspicious_indicators": [],
        }

        try:
            with Image.open(file_path) as img:
                metadata["image_info"] = {
                    "format": img.format,
                    "size": img.size,
                    "mode": img.mode,
                }

                if hasattr(img, "_getexif") and img._getexif():
                    exif_data = img._getexif()
                    if exif_data:
                        metadata["has_exif"] = True
                        for tag_id, value in exif_data.items():
                            tag = TAGS.get(tag_id, tag_id)
                            metadata["exif_data"][str(tag)] = str(value)

                        software = metadata["exif_data"].get("Software", "")
                        if software and any(
                            editor in software.lower()
                            for editor in ["photoshop", "gimp", "paint", "editor"]
                        ):
                            metadata["suspicious_indicators"].append(
                                f"图片可能被编辑软件修改: {software}"
                            )

                        if "DateTime" not in metadata["exif_data"]:
                            metadata["suspicious_indicators"].append(
                                "缺少拍摄时间戳"
                            )

        except Exception as e:
            metadata["error"] = str(e)

        return metadata

    def generate_evidence_id(self, prefix: str = "EVD") -> str:
        """
        生成唯一证据ID

        Args:
            prefix: ID前缀

        Returns:
            唯一证据ID
        """
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique = uuid.uuid4().hex[:8].upper()
        return f"{prefix}-{timestamp}-{unique}"

    def import_file(
        self,
        source_path: str,
        evidence_dir: str,
        generate_new_id: bool = True,
    ) -> Tuple[Optional[EvidenceRecord], Dict]:
        """
        导入单个证据文件

        Args:
            source_path: 源文件路径
            evidence_dir: 证据存储目录
            generate_new_id: 是否生成新的证据ID

        Returns:
            (证据记录, 导入结果) 元组
        """
        source = Path(source_path)
        if not source.exists():
            return None, {"error": f"文件不存在: {source_path}"}

        file_info = Hasher.get_file_info(source_path)
        ext = file_info["extension"]

        evidence_type = self.config.get_extension_type(ext)
        if evidence_type is None:
            evidence_type = EvidenceType.ATTACHMENT

        max_size_bytes = self.config.max_attachment_size_mb * 1024 * 1024
        if file_info["size"] > max_size_bytes:
            return None, {
                "error": f"文件大小超过限制: {file_info['size']} > {max_size_bytes}"
            }

        detection_result = self.duplicate_detector.add_file(source_path)

        if detection_result["is_duplicate"]:
            self.import_results["duplicates"] += 1
            return None, {
                "error": "重复文件",
                "duplicate_of": detection_result["duplicate_of"],
            }

        metadata = {}
        if evidence_type == EvidenceType.SCREENSHOT:
            metadata = self.extract_image_metadata(source_path)
            if metadata.get("suspicious_indicators"):
                self.import_results["details"].append({
                    "file": source_path,
                    "warning": "截图存在可疑元数据",
                    "indicators": metadata["suspicious_indicators"],
                })

        evidence_id = self.generate_evidence_id() if generate_new_id else None

        stored_filename = source.name
        if detection_result["is_name_conflict"]:
            self.import_results["name_conflicts"] += 1
            if evidence_id:
                stored_filename = f"{evidence_id}_{source.name}"

        Path(evidence_dir).mkdir(parents=True, exist_ok=True)
        dest_path = Path(evidence_dir) / stored_filename

        shutil.copy2(source_path, dest_path)

        record = EvidenceRecord(
            evidence_id=evidence_id or self.generate_evidence_id(),
            original_filename=source.name,
            stored_filename=stored_filename,
            file_path=str(dest_path.absolute()),
            file_size=file_info["size"],
            sha256_hash=file_info["sha256_hash"],
            evidence_type=evidence_type,
            imported_at=datetime.now(),
            source_directory=str(Path(source_path).parent.absolute()),
            metadata=metadata,
        )

        self.evidence_records.append(record)
        self.import_results["imported"] += 1

        return record, {
            "success": True,
            "evidence_id": record.evidence_id,
            "stored_as": stored_filename,
            "name_conflict": detection_result["is_name_conflict"],
        }

    def import_directory(
        self,
        source_dir: str,
        evidence_dir: str,
    ) -> Dict:
        """
        导入整个目录的证据文件

        Args:
            source_dir: 源目录
            evidence_dir: 证据存储目录

        Returns:
            导入结果汇总
        """
        files = self.scan_directory(source_dir)
        self.import_results["total"] = len(files)

        for file_path in files:
            try:
                record, result = self.import_file(file_path, evidence_dir)
                if "error" in result:
                    self.import_results["details"].append({
                        "file": file_path,
                        "status": "skipped",
                        "reason": result["error"],
                    })
                    self.import_results["skipped"] += 1
                else:
                    self.import_results["details"].append({
                        "file": file_path,
                        "status": "imported",
                        "evidence_id": result.get("evidence_id"),
                    })
            except Exception as e:
                self.import_results["errors"] += 1
                self.import_results["details"].append({
                    "file": file_path,
                    "status": "error",
                    "error": str(e),
                })

        return self.import_results

    def import_multiple_directories(
        self,
        source_dirs: List[str],
        evidence_dir: str,
    ) -> Dict:
        """
        导入多个目录的证据文件

        Args:
            source_dirs: 源目录列表
            evidence_dir: 证据存储目录

        Returns:
            导入结果汇总
        """
        combined_results = {
            "total": 0,
            "imported": 0,
            "duplicates": 0,
            "name_conflicts": 0,
            "skipped": 0,
            "errors": 0,
            "per_directory": {},
        }

        for source_dir in source_dirs:
            self.evidence_records = []
            self.import_results = {
                "total": 0,
                "imported": 0,
                "duplicates": 0,
                "name_conflicts": 0,
                "skipped": 0,
                "errors": 0,
                "details": [],
            }

            dir_result = self.import_directory(source_dir, evidence_dir)
            combined_results["per_directory"][source_dir] = dir_result

            combined_results["total"] += dir_result["total"]
            combined_results["imported"] += dir_result["imported"]
            combined_results["duplicates"] += dir_result["duplicates"]
            combined_results["name_conflicts"] += dir_result["name_conflicts"]
            combined_results["skipped"] += dir_result["skipped"]
            combined_results["errors"] += dir_result["errors"]

        return combined_results

    def save_evidence_index(self, output_path: str) -> None:
        """
        保存证据索引到JSON文件

        Args:
            output_path: 输出文件路径
        """
        index = {
            "generated_at": datetime.now().isoformat(),
            "evidence_count": len(self.evidence_records),
            "evidence_records": [
                record.model_dump(mode="json")
                for record in self.evidence_records
            ],
        }

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

    @staticmethod
    def load_evidence_index(input_path: str) -> List[EvidenceRecord]:
        """
        从JSON文件加载证据索引

        Args:
            input_path: 输入文件路径

        Returns:
            证据记录列表
        """
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return [
            EvidenceRecord.model_validate(record)
            for record in data.get("evidence_records", [])
        ]
