"""
文件扫描模块 - 扫描模型文件和后处理记录，计算文件哈希
"""

import hashlib
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from .models import ModelFile, PostProcessingRecord


class FileScanner:
    SUPPORTED_MODEL_EXTENSIONS = {".stl", ".3mf", ".obj", ".ply"}
    SUPPORTED_RECORD_EXTENSIONS = {".json", ".csv", ".txt"}
    
    PATIENT_ID_PATTERNS = [
        re.compile(r'P(\d{6,8})', re.IGNORECASE),
        re.compile(r'Patient[_\-]?(\d{6,8})', re.IGNORECASE),
        re.compile(r'(\d{6,8})[_\-]', re.IGNORECASE),
    ]
    
    TOOTH_POSITION_PATTERNS = [
        re.compile(r'T(\d{1,2})(?:[_\-]T(\d{1,2}))*', re.IGNORECASE),
        re.compile(r'(\d{1,2})[_\-](\d{1,2})', re.IGNORECASE),
    ]
    
    def __init__(self, workspace_root: str = None):
        self.workspace_root = workspace_root
        self.scanned_files: List[ModelFile] = []
        self.scanned_records: List[PostProcessingRecord] = []
    
    def calculate_sha256(self, file_path: str, chunk_size: int = 8192) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(chunk_size), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def get_file_info(self, file_path: str) -> Tuple[int, datetime, datetime]:
        stat = os.stat(file_path)
        file_size = stat.st_size
        modification_time = datetime.fromtimestamp(stat.st_mtime)
        try:
            creation_time = datetime.fromtimestamp(stat.st_birthtime)
        except AttributeError:
            creation_time = datetime.fromtimestamp(stat.st_ctime)
        return file_size, creation_time, modification_time
    
    def extract_patient_id_from_filename(self, filename: str) -> Optional[str]:
        for pattern in self.PATIENT_ID_PATTERNS:
            match = pattern.search(filename)
            if match:
                return match.group(1)
        return None
    
    def extract_tooth_position_from_filename(self, filename: str) -> Optional[str]:
        for pattern in self.TOOTH_POSITION_PATTERNS:
            match = pattern.search(filename)
            if match:
                positions = [g for g in match.groups() if g]
                return "-".join(positions)
        return None
    
    def scan_model_file(self, file_path: str) -> ModelFile:
        file_path = os.path.abspath(file_path)
        file_name = os.path.basename(file_path)
        file_ext = os.path.splitext(file_name)[1].lower()
        file_size, creation_time, modification_time = self.get_file_info(file_path)
        file_hash = self.calculate_sha256(file_path)
        
        extracted_patient_id = self.extract_patient_id_from_filename(file_name)
        extracted_tooth_position = self.extract_tooth_position_from_filename(file_name)
        
        model_file = ModelFile(
            file_path=file_path,
            file_name=file_name,
            file_type=file_ext[1:],
            file_size=file_size,
            hash_sha256=file_hash,
            creation_time=creation_time,
            modification_time=modification_time,
            extracted_patient_id=extracted_patient_id,
            extracted_tooth_position=extracted_tooth_position
        )
        
        return model_file
    
    def scan_directory_for_models(self, directory: str) -> List[ModelFile]:
        model_files = []
        directory = os.path.abspath(directory)
        
        if not os.path.isdir(directory):
            return model_files
        
        for root, dirs, files in os.walk(directory):
            for file_name in files:
                file_ext = os.path.splitext(file_name)[1].lower()
                if file_ext in self.SUPPORTED_MODEL_EXTENSIONS:
                    file_path = os.path.join(root, file_name)
                    try:
                        model_file = self.scan_model_file(file_path)
                        model_files.append(model_file)
                        self.scanned_files.append(model_file)
                    except Exception as e:
                        print(f"Warning: Failed to scan {file_path}: {e}")
        
        return model_files
    
    def parse_post_processing_record(self, file_path: str) -> Optional[PostProcessingRecord]:
        file_path = os.path.abspath(file_path)
        file_ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if file_ext == ".json":
                import json
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return self._parse_json_record(data, file_path)
            elif file_ext == ".csv":
                import csv
                with open(file_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        return self._parse_csv_record(row, file_path)
            elif file_ext == ".txt":
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    return self._parse_text_record(content, file_path)
        except Exception as e:
            print(f"Warning: Failed to parse {file_path}: {e}")
        
        return None
    
    def _parse_json_record(self, data: Dict, file_path: str) -> Optional[PostProcessingRecord]:
        case_id = data.get("case_id", data.get("patient_id", ""))
        if not case_id:
            return None
        
        processing_type = data.get("processing_type", data.get("type", "post_processing"))
        
        start_time_str = data.get("start_time", data.get("start", ""))
        end_time_str = data.get("end_time", data.get("end", ""))
        
        start_time = None
        end_time = None
        
        if start_time_str:
            start_time = self._parse_datetime(start_time_str)
        if end_time_str:
            end_time = self._parse_datetime(end_time_str)
        
        record = PostProcessingRecord(
            case_id=case_id,
            processing_type=processing_type,
            start_time=start_time or datetime.now(),
            end_time=end_time or datetime.now(),
            operator=data.get("operator", data.get("technician", "")),
            notes=data.get("notes", data.get("comments", ""))
        )
        
        record.calculate_duration()
        return record
    
    def _parse_csv_record(self, row: Dict, file_path: str) -> Optional[PostProcessingRecord]:
        case_id = row.get("case_id", row.get("patient_id", ""))
        if not case_id:
            return None
        
        processing_type = row.get("processing_type", row.get("type", "post_processing"))
        
        start_time_str = row.get("start_time", row.get("start", ""))
        end_time_str = row.get("end_time", row.get("end", ""))
        
        start_time = None
        end_time = None
        
        if start_time_str:
            start_time = self._parse_datetime(start_time_str)
        if end_time_str:
            end_time = self._parse_datetime(end_time_str)
        
        duration_str = row.get("duration_minutes", row.get("duration", "0"))
        try:
            duration_minutes = int(duration_str)
        except ValueError:
            duration_minutes = 0
        
        record = PostProcessingRecord(
            case_id=case_id,
            processing_type=processing_type,
            start_time=start_time or datetime.now(),
            end_time=end_time or datetime.now(),
            duration_minutes=duration_minutes,
            operator=row.get("operator", row.get("technician", "")),
            notes=row.get("notes", row.get("comments", ""))
        )
        
        if not record.duration_minutes:
            record.calculate_duration()
        
        return record
    
    def _parse_text_record(self, content: str, file_path: str) -> Optional[PostProcessingRecord]:
        lines = content.strip().split('\n')
        case_id = ""
        processing_type = "post_processing"
        start_time = None
        end_time = None
        operator = ""
        notes = ""
        
        for line in lines:
            line = line.strip()
            if line.startswith("case_id:") or line.startswith("病例编号:"):
                case_id = line.split(":", 1)[1].strip()
            elif line.startswith("processing_type:") or line.startswith("处理类型:"):
                processing_type = line.split(":", 1)[1].strip()
            elif line.startswith("start_time:") or line.startswith("开始时间:"):
                start_time_str = line.split(":", 1)[1].strip()
                start_time = self._parse_datetime(start_time_str)
            elif line.startswith("end_time:") or line.startswith("结束时间:"):
                end_time_str = line.split(":", 1)[1].strip()
                end_time = self._parse_datetime(end_time_str)
            elif line.startswith("operator:") or line.startswith("操作者:"):
                operator = line.split(":", 1)[1].strip()
            elif line.startswith("notes:") or line.startswith("备注:"):
                notes = line.split(":", 1)[1].strip()
        
        if not case_id:
            return None
        
        record = PostProcessingRecord(
            case_id=case_id,
            processing_type=processing_type,
            start_time=start_time or datetime.now(),
            end_time=end_time or datetime.now(),
            operator=operator,
            notes=notes
        )
        
        record.calculate_duration()
        return record
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        if not dt_str:
            return None
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except ValueError:
                continue
        
        return None
    
    def scan_directory_for_records(self, directory: str) -> List[PostProcessingRecord]:
        records = []
        directory = os.path.abspath(directory)
        
        if not os.path.isdir(directory):
            return records
        
        for root, dirs, files in os.walk(directory):
            for file_name in files:
                file_ext = os.path.splitext(file_name)[1].lower()
                if file_ext in self.SUPPORTED_RECORD_EXTENSIONS:
                    file_path = os.path.join(root, file_name)
                    try:
                        record = self.parse_post_processing_record(file_path)
                        if record:
                            records.append(record)
                            self.scanned_records.append(record)
                    except Exception as e:
                        print(f"Warning: Failed to scan {file_path}: {e}")
        
        return records
    
    def scan_workspace(self, workspace_root: str = None) -> Dict[str, List]:
        root = workspace_root or self.workspace_root
        if not root:
            raise ValueError("Workspace root path is required")
        
        from .models import Workspace
        
        ws = Workspace(root_path=root, creation_date=datetime.now())
        
        model_files = self.scan_directory_for_models(ws.models_dir)
        records = self.scan_directory_for_records(ws.records_dir)
        
        return {
            "model_files": model_files,
            "post_processing_records": records
        }
    
    def get_scan_summary(self) -> Dict:
        return {
            "total_model_files": len(self.scanned_files),
            "total_records": len(self.scanned_records),
            "model_file_types": self._count_by_file_type(self.scanned_files),
            "model_files": [
                {
                    "file_name": f.file_name,
                    "file_path": f.file_path,
                    "file_size": f.file_size,
                    "hash_sha256": f.hash_sha256,
                    "extracted_patient_id": f.extracted_patient_id,
                    "extracted_tooth_position": f.extracted_tooth_position
                }
                for f in self.scanned_files
            ],
            "records": [
                {
                    "case_id": r.case_id,
                    "processing_type": r.processing_type,
                    "duration_minutes": r.duration_minutes,
                    "operator": r.operator
                }
                for r in self.scanned_records
            ]
        }
    
    def _count_by_file_type(self, files: List[ModelFile]) -> Dict[str, int]:
        counts = {}
        for f in files:
            file_type = f.file_type.lower()
            counts[file_type] = counts.get(file_type, 0) + 1
        return counts
