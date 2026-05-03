import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
from struct import unpack

import config
from models.stl_file import STLFile


@dataclass
class STLScanResult:
    success: bool = True
    stl_files: List[STLFile] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class STLScanner:
    MODEL_ID_PATTERNS = [
        re.compile(r"([A-Z]{2,3}\d{6,10})", re.IGNORECASE),
        re.compile(r"(\d{8,12})"),
        re.compile(r"([A-Z]+\d+)"),
    ]

    JAW_KEYWORDS = {
        "upper": ["上颌", "上", "upper", "maxilla", "maxillary", "u"],
        "lower": ["下颌", "下", "lower", "mandible", "mandibular", "l", "d"],
    }

    def __init__(self):
        self.allowed_extensions = config.ALLOWED_STL_EXTENSIONS

    def scan_directory(
        self,
        directory: Union[str, Path],
        recursive: bool = True
    ) -> STLScanResult:
        directory = Path(directory)
        result = STLScanResult()

        if not directory.exists():
            result.success = False
            result.errors.append(f"目录不存在: {directory}")
            return result

        if not directory.is_dir():
            result.success = False
            result.errors.append(f"路径不是目录: {directory}")
            return result

        if recursive:
            files = list(directory.rglob("*"))
        else:
            files = list(directory.iterdir())

        for file_path in files:
            if not file_path.is_file():
                continue

            ext = file_path.suffix.lower()
            if ext not in self.allowed_extensions:
                continue

            try:
                stl_file = self._parse_stl(file_path)
                if stl_file:
                    result.stl_files.append(stl_file)
            except Exception as e:
                result.warnings.append(f"无法解析STL文件 {file_path.name}: {str(e)}")

        return result

    def _parse_stl(self, file_path: Path) -> Optional[STLFile]:
        model_id = self._extract_model_id(file_path.name)
        if not model_id:
            model_id = self._extract_model_id(str(file_path.parent.name))

        if not model_id:
            return None

        jaw = self._detect_jaw(file_path.name, file_path.parent.name)
        file_size = file_path.stat().st_size
        modified_at = datetime.fromtimestamp(file_path.stat().st_mtime)

        vertex_count, triangle_count = self._parse_stl_geometry(file_path)

        stl_file = STLFile(
            file_path=str(file_path),
            model_id=model_id.upper(),
            jaw=jaw,
            file_size=file_size,
            modified_at=modified_at,
            vertex_count=vertex_count,
            triangle_count=triangle_count,
        )

        return stl_file

    def _parse_stl_geometry(self, file_path: Path) -> tuple:
        vertex_count = None
        triangle_count = None

        try:
            with open(file_path, "rb") as f:
                header = f.read(80)
                if b"solid" in header or self._is_ascii_stl(file_path):
                    triangle_count = self._count_ascii_triangles(file_path)
                else:
                    triangle_count_data = f.read(4)
                    triangle_count = unpack("<I", triangle_count_data)[0]

                vertex_count = triangle_count * 3 if triangle_count else None

        except Exception:
            pass

        return vertex_count, triangle_count

    def _is_ascii_stl(self, file_path: Path) -> bool:
        try:
            with open(file_path, "r") as f:
                first_line = f.readline().strip().lower()
                return first_line.startswith("solid")
        except Exception:
            return False

    def _count_ascii_triangles(self, file_path: Path) -> int:
        count = 0
        try:
            with open(file_path, "r") as f:
                for line in f:
                    if "endfacet" in line.lower():
                        count += 1
        except Exception:
            pass
        return count

    def _extract_model_id(self, text: str) -> Optional[str]:
        for pattern in self.MODEL_ID_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1).upper()
        return None

    def _detect_jaw(self, filename: str, parent_dir: str = "") -> Optional[str]:
        text = f"{filename.lower()} {parent_dir.lower()}"

        for jaw, keywords in self.JAW_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    return jaw

        return None

    def group_by_model(self, stl_files: List[STLFile]) -> Dict[str, List[STLFile]]:
        grouped: Dict[str, List[STLFile]] = {}
        for stl_file in stl_files:
            if stl_file.model_id not in grouped:
                grouped[stl_file.model_id] = []
            grouped[stl_file.model_id].append(stl_file)
        return grouped

    def get_model_jaws(self, stl_files: List[STLFile]) -> Dict[str, List[str]]:
        jaws_by_model: Dict[str, List[str]] = {}
        for stl_file in stl_files:
            if stl_file.model_id not in jaws_by_model:
                jaws_by_model[stl_file.model_id] = []
            if stl_file.jaw and stl_file.jaw not in jaws_by_model[stl_file.model_id]:
                jaws_by_model[stl_file.model_id].append(stl_file.jaw)
        return jaws_by_model
