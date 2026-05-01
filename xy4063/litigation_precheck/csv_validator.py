import csv
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field


@dataclass
class EvidenceEntry:
    evidence_number: Optional[int] = None
    evidence_number_str: str = ""
    evidence_name: str = ""
    evidence_type: str = ""
    page_count: Optional[int] = None
    source: str = ""
    proof_content: str = ""
    file_name: str = ""
    row_index: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EvidenceList:
    file_path: str
    total_entries: int
    evidence_entries: List[EvidenceEntry] = field(default_factory=list)
    columns: Dict[str, str] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "total_entries": self.total_entries,
            "evidence_entries": [e.to_dict() for e in self.evidence_entries],
            "columns": self.columns,
            "issues": self.issues
        }


@dataclass
class CSVValidationResult:
    is_valid: bool
    evidence_list: Optional[EvidenceList] = None
    issues: List[Dict[str, Any]] = field(default_factory=list)
    missing_files: List[str] = field(default_factory=list)
    extra_files: List[str] = field(default_factory=list)
    number_gaps: List[Tuple[int, int]] = field(default_factory=list)
    duplicate_numbers: List[int] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "evidence_list": self.evidence_list.to_dict() if self.evidence_list else None,
            "issues": self.issues,
            "missing_files": self.missing_files,
            "extra_files": self.extra_files,
            "number_gaps": [list(g) for g in self.number_gaps],
            "duplicate_numbers": self.duplicate_numbers
        }


class EvidenceListParser:
    def __init__(self, column_mapping: Dict[str, str]):
        self.column_mapping = column_mapping
    
    def _get_column_index(self, header_row: List[str], column_key: str) -> Optional[int]:
        expected_name = self.column_mapping.get(column_key, column_key)
        for idx, header in enumerate(header_row):
            header_clean = header.strip()
            if header_clean == expected_name or header_clean == column_key:
                return idx
        return None
    
    def _parse_evidence_number(self, number_str: str) -> Tuple[Optional[int], str]:
        if not number_str:
            return None, ""
        
        number_str = str(number_str).strip()
        
        match = re.search(r"(\d+)", number_str)
        if match:
            return int(match.group(1)), number_str
        
        chinese_map = {
            "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
            "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
            "十": 10
        }
        
        num = 0
        temp = 0
        for char in number_str:
            if char in chinese_map:
                val = chinese_map[char]
                if val == 10:
                    if temp == 0:
                        temp = 1
                    num += temp * 10
                    temp = 0
                else:
                    temp = val
            elif char in ["、", ".", " ", "　", "组", "号", "份"]:
                continue
        num += temp
        
        if num > 0:
            return num, number_str
        
        return None, number_str
    
    def _parse_page_count(self, page_str: str) -> Optional[int]:
        if not page_str:
            return None
        
        page_str = str(page_str).strip()
        
        match = re.search(r"(\d+)", page_str)
        if match:
            return int(match.group(1))
        
        return None
    
    def parse_csv(self, file_path: Path) -> EvidenceList:
        evidence_list = EvidenceList(
            file_path=str(file_path),
            total_entries=0,
            columns=self.column_mapping,
            issues=[]
        )
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                rows = list(reader)
            
            if not rows:
                evidence_list.issues.append("CSV文件为空")
                return evidence_list
            
            header_row = rows[0]
            
            col_indices = {}
            for key in self.column_mapping.keys():
                idx = self._get_column_index(header_row, key)
                if idx is not None:
                    col_indices[key] = idx
            
            if "evidence_number" not in col_indices:
                evidence_list.issues.append(f"未找到'证据编号'列，期望列名: {self.column_mapping.get('evidence_number', '证据编号')}")
            
            evidence_entries = []
            for row_idx, row in enumerate(rows[1:], start=2):
                if not any(cell.strip() for cell in row):
                    continue
                
                entry = EvidenceEntry(row_index=row_idx)
                
                if "evidence_number" in col_indices and col_indices["evidence_number"] < len(row):
                    num_str = row[col_indices["evidence_number"]].strip()
                    entry.evidence_number, entry.evidence_number_str = self._parse_evidence_number(num_str)
                
                if "evidence_name" in col_indices and col_indices["evidence_name"] < len(row):
                    entry.evidence_name = row[col_indices["evidence_name"]].strip()
                
                if "evidence_type" in col_indices and col_indices["evidence_type"] < len(row):
                    entry.evidence_type = row[col_indices["evidence_type"]].strip()
                
                if "page_count" in col_indices and col_indices["page_count"] < len(row):
                    page_str = row[col_indices["page_count"]].strip()
                    entry.page_count = self._parse_page_count(page_str)
                
                if "source" in col_indices and col_indices["source"] < len(row):
                    entry.source = row[col_indices["source"]].strip()
                
                if "proof_content" in col_indices and col_indices["proof_content"] < len(row):
                    entry.proof_content = row[col_indices["proof_content"]].strip()
                
                if "file_name" in col_indices and col_indices["file_name"] < len(row):
                    entry.file_name = row[col_indices["file_name"]].strip()
                
                evidence_entries.append(entry)
            
            evidence_list.evidence_entries = evidence_entries
            evidence_list.total_entries = len(evidence_entries)
            
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    reader = csv.reader(f)
                    rows = list(reader)
                
                if not rows:
                    evidence_list.issues.append("CSV文件为空")
                    return evidence_list
                
                header_row = rows[0]
                
                col_indices = {}
                for key in self.column_mapping.keys():
                    idx = self._get_column_index(header_row, key)
                    if idx is not None:
                        col_indices[key] = idx
                
                if "evidence_number" not in col_indices:
                    evidence_list.issues.append(f"未找到'证据编号'列，期望列名: {self.column_mapping.get('evidence_number', '证据编号')}")
                
                evidence_entries = []
                for row_idx, row in enumerate(rows[1:], start=2):
                    if not any(cell.strip() for cell in row):
                        continue
                    
                    entry = EvidenceEntry(row_index=row_idx)
                    
                    if "evidence_number" in col_indices and col_indices["evidence_number"] < len(row):
                        num_str = row[col_indices["evidence_number"]].strip()
                        entry.evidence_number, entry.evidence_number_str = self._parse_evidence_number(num_str)
                    
                    if "evidence_name" in col_indices and col_indices["evidence_name"] < len(row):
                        entry.evidence_name = row[col_indices["evidence_name"]].strip()
                    
                    if "evidence_type" in col_indices and col_indices["evidence_type"] < len(row):
                        entry.evidence_type = row[col_indices["evidence_type"]].strip()
                    
                    if "page_count" in col_indices and col_indices["page_count"] < len(row):
                        page_str = row[col_indices["page_count"]].strip()
                        entry.page_count = self._parse_page_count(page_str)
                    
                    if "source" in col_indices and col_indices["source"] < len(row):
                        entry.source = row[col_indices["source"]].strip()
                    
                    if "proof_content" in col_indices and col_indices["proof_content"] < len(row):
                        entry.proof_content = row[col_indices["proof_content"]].strip()
                    
                    if "file_name" in col_indices and col_indices["file_name"] < len(row):
                        entry.file_name = row[col_indices["file_name"]].strip()
                    
                    evidence_entries.append(entry)
                
                evidence_list.evidence_entries = evidence_entries
                evidence_list.total_entries = len(evidence_entries)
                
            except Exception as e:
                evidence_list.issues.append(f"解析CSV文件失败: {str(e)}")
        
        except Exception as e:
            evidence_list.issues.append(f"解析CSV文件失败: {str(e)}")
        
        return evidence_list


class CSVValidator:
    def __init__(self, parser: EvidenceListParser):
        self.parser = parser
    
    def validate(
        self, 
        csv_file: Path, 
        scanned_files: List[Dict[str, Any]],
        check_sequence: bool = True
    ) -> CSVValidationResult:
        evidence_list = self.parser.parse_csv(csv_file)
        
        result = CSVValidationResult(
            is_valid=True,
            evidence_list=evidence_list,
            issues=[],
            missing_files=[],
            extra_files=[],
            number_gaps=[],
            duplicate_numbers=[]
        )
        
        if evidence_list.issues:
            result.is_valid = False
            for issue in evidence_list.issues:
                result.issues.append({
                    "type": "csv_parse_error",
                    "severity": "error",
                    "message": issue
                })
        
        csv_numbers = set()
        csv_number_to_entry: Dict[int, EvidenceEntry] = {}
        csv_filenames = set()
        
        for entry in evidence_list.evidence_entries:
            if entry.evidence_number is not None:
                if entry.evidence_number in csv_numbers:
                    result.duplicate_numbers.append(entry.evidence_number)
                    result.issues.append({
                        "type": "duplicate_evidence_number",
                        "severity": "error",
                        "message": f"证据编号重复: {entry.evidence_number} (行 {entry.row_index})",
                        "evidence_number": entry.evidence_number,
                        "row_index": entry.row_index
                    })
                csv_numbers.add(entry.evidence_number)
                csv_number_to_entry[entry.evidence_number] = entry
            
            if entry.file_name:
                csv_filenames.add(entry.file_name)
        
        if result.duplicate_numbers:
            result.is_valid = False
        
        if check_sequence and csv_numbers:
            sorted_numbers = sorted(csv_numbers)
            min_num = sorted_numbers[0]
            max_num = sorted_numbers[-1]
            
            if min_num != 1:
                result.number_gaps.append((1, min_num - 1))
                result.issues.append({
                    "type": "evidence_number_gap",
                    "severity": "warning",
                    "message": f"证据编号不是从1开始，当前最小编号: {min_num}",
                    "missing_range": [1, min_num - 1]
                })
            
            for i in range(len(sorted_numbers) - 1):
                current = sorted_numbers[i]
                next_num = sorted_numbers[i + 1]
                if next_num - current > 1:
                    result.number_gaps.append((current + 1, next_num - 1))
                    result.issues.append({
                        "type": "evidence_number_gap",
                        "severity": "error",
                        "message": f"证据编号跳号: {current + 1} 到 {next_num - 1} 缺失",
                        "missing_range": [current + 1, next_num - 1]
                    })
        
        if result.number_gaps:
            result.is_valid = False
        
        scanned_evidence_files = [
            f for f in scanned_files 
            if f.get("material_type") == "EVIDENCE" or f.get("evidence_number") is not None
        ]
        
        scanned_numbers = set()
        scanned_filenames = set()
        
        for file_info in scanned_evidence_files:
            if file_info.get("evidence_number") is not None:
                scanned_numbers.add(file_info["evidence_number"])
            scanned_filenames.add(file_info["file_name"])
        
        for num in csv_numbers:
            if num not in scanned_numbers:
                entry = csv_number_to_entry.get(num)
                result.missing_files.append(f"证据{num}: {entry.evidence_name if entry else '未知'}")
                result.issues.append({
                    "type": "missing_evidence_file",
                    "severity": "error",
                    "message": f"证据编号 {num} 的文件缺失",
                    "evidence_number": num,
                    "evidence_name": entry.evidence_name if entry else None
                })
        
        for num in scanned_numbers:
            if num not in csv_numbers:
                result.extra_files.append(f"证据{num}")
                result.issues.append({
                    "type": "extra_evidence_file",
                    "severity": "warning",
                    "message": f"存在未在清单中列出的证据文件: 证据{num}",
                    "evidence_number": num
                })
        
        if result.missing_files:
            result.is_valid = False
        
        return result
