import csv
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict, field
from datetime import datetime


@dataclass
class PackedFile:
    original_path: str
    packed_path: str
    file_name: str
    file_size: int
    material_type: Optional[str] = None
    evidence_number: Optional[int] = None
    file_hash: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PackResult:
    is_success: bool
    packed_dir: str
    total_packed_files: int
    total_size: int
    packed_files: List[PackedFile] = field(default_factory=list)
    skipped_files: List[str] = field(default_factory=list)
    pack_time: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_success": self.is_success,
            "packed_dir": self.packed_dir,
            "total_packed_files": self.total_packed_files,
            "total_size": self.total_size,
            "packed_files": [f.to_dict() for f in self.packed_files],
            "skipped_files": self.skipped_files,
            "pack_time": self.pack_time
        }


class Packer:
    def __init__(self, output_config: Dict[str, Any]):
        self.output_config = output_config
        self.packed_dir_name = output_config.get("packed_dir_name", "递交包")
        self.packed_list_filename = output_config.get("packed_list_filename", "提交清单.csv")
    
    def pack(
        self,
        source_dir: Path,
        target_base_dir: Path,
        passed_files: List[str],
        all_scanned_files: List[Dict[str, Any]],
        evidence_list: Optional[Dict[str, Any]] = None
    ) -> PackResult:
        packed_dir = target_base_dir / self.packed_dir_name
        packed_dir.mkdir(parents=True, exist_ok=True)
        
        packed_files: List[PackedFile] = []
        skipped_files: List[str] = []
        total_size = 0
        
        file_info_map: Dict[str, Dict[str, Any]] = {}
        for file_info in all_scanned_files:
            file_path = file_info.get("file_path", "")
            if file_path:
                file_info_map[file_path] = file_info
        
        evidence_entries = []
        if evidence_list and isinstance(evidence_list, dict):
            evidence_entries = evidence_list.get("evidence_entries", [])
        elif evidence_list:
            evidence_entries = getattr(evidence_list, "evidence_entries", [])
        
        evidence_number_to_name: Dict[int, str] = {}
        for entry in evidence_entries:
            if isinstance(entry, dict):
                num = entry.get("evidence_number")
                name = entry.get("evidence_name", "")
            else:
                num = getattr(entry, "evidence_number", None)
                name = getattr(entry, "evidence_name", "")
            if num is not None:
                evidence_number_to_name[num] = name
        
        for relative_path in passed_files:
            source_file = source_dir / relative_path
            
            if not source_file.exists():
                skipped_files.append(f"{relative_path} (文件不存在)")
                continue
            
            target_file = packed_dir / relative_path
            target_file.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                shutil.copy2(source_file, target_file)
                
                file_info = file_info_map.get(relative_path, {})
                file_size = file_info.get("file_size", source_file.stat().st_size)
                
                packed_file = PackedFile(
                    original_path=relative_path,
                    packed_path=str(target_file.relative_to(packed_dir.parent)),
                    file_name=source_file.name,
                    file_size=file_size,
                    material_type=file_info.get("material_type"),
                    evidence_number=file_info.get("evidence_number"),
                    file_hash=file_info.get("file_hash", "")
                )
                
                packed_files.append(packed_file)
                total_size += file_size
                
            except Exception as e:
                skipped_files.append(f"{relative_path} (复制失败: {str(e)})")
        
        self._generate_packed_list(packed_dir, packed_files, evidence_number_to_name)
        
        return PackResult(
            is_success=len(skipped_files) == 0,
            packed_dir=str(packed_dir),
            total_packed_files=len(packed_files),
            total_size=total_size,
            packed_files=packed_files,
            skipped_files=skipped_files,
            pack_time=datetime.now().isoformat()
        )
    
    def _generate_packed_list(
        self, 
        packed_dir: Path, 
        packed_files: List[PackedFile],
        evidence_number_to_name: Dict[int, str]
    ) -> None:
        list_file = packed_dir / self.packed_list_filename
        
        sorted_files = sorted(
            packed_files,
            key=lambda f: (
                0 if f.material_type == "COMPLAINT" else
                1 if f.material_type == "POA" else
                2 if f.material_type == "IDENTITY" else
                3 if f.material_type == "EVIDENCE_LIST" else
                4 if f.material_type == "EVIDENCE" else
                5 if f.material_type == "ADDRESS_CONFIRM" else 99,
                f.evidence_number or 999,
                f.file_name
            )
        )
        
        with open(list_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "序号",
                "材料类型",
                "证据编号",
                "证据名称",
                "文件名",
                "文件大小(字节)",
                "哈希值(前16位)"
            ])
            
            for idx, pf in enumerate(sorted_files, 1):
                material_type_name = self._get_material_type_name(pf.material_type)
                evidence_name = ""
                
                if pf.evidence_number is not None:
                    evidence_name = evidence_number_to_name.get(pf.evidence_number, "")
                
                writer.writerow([
                    idx,
                    material_type_name,
                    pf.evidence_number if pf.evidence_number else "",
                    evidence_name,
                    pf.file_name,
                    pf.file_size,
                    pf.file_hash[:16] if pf.file_hash else ""
                ])
    
    @staticmethod
    def _get_material_type_name(material_type: Optional[str]) -> str:
        type_names = {
            "COMPLAINT": "起诉状",
            "POA": "授权委托书",
            "EVIDENCE_LIST": "证据目录",
            "EVIDENCE": "证据材料",
            "ADDRESS_CONFIRM": "送达地址确认书",
            "IDENTITY": "身份证明"
        }
        return type_names.get(material_type, "其他")


class PackedListManager:
    @staticmethod
    def load_packed_list(list_file: Path) -> List[Dict[str, Any]]:
        result = []
        try:
            with open(list_file, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    result.append(dict(row))
        except UnicodeDecodeError:
            with open(list_file, "r", encoding="gbk") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    result.append(dict(row))
        return result
