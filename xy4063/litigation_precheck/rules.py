import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, asdict, field
from enum import Enum


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    MISSING_REQUIRED_MATERIAL = "missing_required_material"
    MISSING_SIGNATURE_MARK = "missing_signature_mark"
    DUPLICATE_HASH = "duplicate_hash"
    PAGE_COUNT_OUT_OF_RANGE = "page_count_out_of_range"
    INVALID_NAMING = "invalid_naming"
    EVIDENCE_NUMBER_GAP = "evidence_number_gap"
    DUPLICATE_EVIDENCE_NUMBER = "duplicate_evidence_number"
    MISSING_EVIDENCE_FILE = "missing_evidence_file"
    EXTRA_EVIDENCE_FILE = "extra_evidence_file"
    CSV_PARSE_ERROR = "csv_parse_error"


@dataclass
class Issue:
    issue_type: str
    severity: str
    message: str
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    evidence_number: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class CheckResult:
    is_valid: bool
    total_issues: int
    error_count: int
    warning_count: int
    info_count: int
    issues: List[Issue] = field(default_factory=list)
    passed_files: List[str] = field(default_factory=list)
    failed_files: List[str] = field(default_factory=list)
    check_time: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "total_issues": self.total_issues,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "info_count": self.info_count,
            "issues": [i.to_dict() for i in self.issues],
            "passed_files": self.passed_files,
            "failed_files": self.failed_files,
            "check_time": self.check_time
        }


class RuleEngine:
    def __init__(self, config: Dict[str, Any]):
        self.check_rules = config.get("check_rules", {})
        self.material_types = config.get("material_types", [])
        self.naming_rules = config.get("naming_rules", [])
    
    def _get_material_type_config(self, material_type: str) -> Optional[Dict[str, Any]]:
        for mt in self.material_types:
            if isinstance(mt, dict) and mt.get("code") == material_type:
                return mt
            elif hasattr(mt, "code") and mt.code == material_type:
                return mt.model_dump() if hasattr(mt, "model_dump") else vars(mt)
        return None
    
    def check_required_materials(
        self, 
        scanned_files: List[Dict[str, Any]],
        material_types_config: List[Dict[str, Any]]
    ) -> List[Issue]:
        issues = []
        
        required_types = [
            mt for mt in material_types_config 
            if (isinstance(mt, dict) and mt.get("required")) or 
               (hasattr(mt, "required") and mt.required)
        ]
        
        found_types: Set[str] = set()
        for file_info in scanned_files:
            mt = file_info.get("material_type")
            if mt:
                found_types.add(mt)
        
        for req_type in required_types:
            type_code = req_type.get("code") if isinstance(req_type, dict) else getattr(req_type, "code", None)
            type_name = req_type.get("name") if isinstance(req_type, dict) else getattr(req_type, "name", type_code)
            
            if type_code not in found_types:
                issues.append(Issue(
                    issue_type=IssueType.MISSING_REQUIRED_MATERIAL.value,
                    severity=Severity.ERROR.value,
                    message=f"缺少必备材料: {type_name}",
                    details={
                        "material_type": type_code,
                        "material_name": type_name
                    }
                ))
        
        return issues
    
    def check_signature_pages(
        self, 
        scanned_files: List[Dict[str, Any]]
    ) -> List[Issue]:
        issues = []
        
        for file_info in scanned_files:
            material_type = file_info.get("material_type")
            if not material_type:
                continue
            
            mt_config = self._get_material_type_config(material_type)
            if not mt_config:
                continue
            
            requires_signature = mt_config.get("requires_signature", False)
            if not requires_signature:
                continue
            
            file_name = file_info.get("file_name", "")
            file_path = file_info.get("file_path", "")
            
            has_signature_mark = False
            
            if "_签名" in file_name or "签名" in file_name:
                has_signature_mark = True
            
            is_marked = file_info.get("is_signature_page_marked")
            if is_marked is True:
                has_signature_mark = True
            
            if not has_signature_mark:
                issues.append(Issue(
                    issue_type=IssueType.MISSING_SIGNATURE_MARK.value,
                    severity=Severity.WARNING.value,
                    message=f"文件未标记签名页: {file_name}",
                    file_path=file_path,
                    file_name=file_name,
                    details={
                        "material_type": material_type,
                        "expected_signature_pages": mt_config.get("signature_pages")
                    }
                ))
        
        return issues
    
    def check_duplicate_hash(
        self, 
        scanned_files: List[Dict[str, Any]]
    ) -> List[Issue]:
        issues = []
        
        hash_to_files: Dict[str, List[Dict[str, Any]]] = {}
        for file_info in scanned_files:
            file_hash = file_info.get("file_hash")
            if file_hash:
                if file_hash not in hash_to_files:
                    hash_to_files[file_hash] = []
                hash_to_files[file_hash].append(file_info)
        
        for file_hash, files in hash_to_files.items():
            if len(files) > 1:
                file_names = [f.get("file_name", "") for f in files]
                file_paths = [f.get("file_path", "") for f in files]
                
                issues.append(Issue(
                    issue_type=IssueType.DUPLICATE_HASH.value,
                    severity=Severity.WARNING.value,
                    message=f"发现重复文件 (哈希: {file_hash[:16]}...): {', '.join(file_names)}",
                    file_path=file_paths[0] if file_paths else None,
                    file_name=file_names[0] if file_names else None,
                    details={
                        "file_hash": file_hash,
                        "duplicate_files": file_names,
                        "duplicate_count": len(files)
                    }
                ))
        
        return issues
    
    def check_page_range(
        self, 
        scanned_files: List[Dict[str, Any]]
    ) -> List[Issue]:
        issues = []
        max_pages = self.check_rules.get("max_pages_per_file", 100)
        
        for file_info in scanned_files:
            page_count = file_info.get("page_count")
            if page_count is None:
                continue
            
            file_name = file_info.get("file_name", "")
            file_path = file_info.get("file_path", "")
            material_type = file_info.get("material_type")
            
            mt_config = self._get_material_type_config(material_type) if material_type else None
            
            min_pages = 1
            max_pages_type = max_pages
            
            if mt_config:
                min_pages = mt_config.get("min_pages", 1)
                max_pages_type = mt_config.get("max_pages") or max_pages
            
            if page_count < min_pages:
                issues.append(Issue(
                    issue_type=IssueType.PAGE_COUNT_OUT_OF_RANGE.value,
                    severity=Severity.ERROR.value,
                    message=f"文件页数少于预期: {file_name} (当前 {page_count} 页, 最少 {min_pages} 页)",
                    file_path=file_path,
                    file_name=file_name,
                    details={
                        "current_pages": page_count,
                        "min_pages": min_pages,
                        "max_pages": max_pages_type
                    }
                ))
            
            if page_count > max_pages_type:
                issues.append(Issue(
                    issue_type=IssueType.PAGE_COUNT_OUT_OF_RANGE.value,
                    severity=Severity.WARNING.value,
                    message=f"文件页数超出建议范围: {file_name} (当前 {page_count} 页, 建议最多 {max_pages_type} 页)",
                    file_path=file_path,
                    file_name=file_name,
                    details={
                        "current_pages": page_count,
                        "min_pages": min_pages,
                        "max_pages": max_pages_type
                    }
                ))
        
        return issues
    
    def check_naming_convention(
        self, 
        scanned_files: List[Dict[str, Any]]
    ) -> List[Issue]:
        issues = []
        
        for file_info in scanned_files:
            file_name = file_info.get("file_name", "")
            file_path = file_info.get("file_path", "")
            material_type = file_info.get("material_type")
            
            if not material_type:
                continue
            
            mt_config = self._get_material_type_config(material_type)
            if not mt_config:
                continue
            
            naming_pattern = mt_config.get("naming_pattern")
            if not naming_pattern:
                continue
            
            try:
                if not re.search(naming_pattern, file_name):
                    issues.append(Issue(
                        issue_type=IssueType.INVALID_NAMING.value,
                        severity=Severity.WARNING.value,
                        message=f"文件名不符合命名规则: {file_name}",
                        file_path=file_path,
                        file_name=file_name,
                        details={
                            "material_type": material_type,
                            "expected_pattern": naming_pattern
                        }
                    ))
            except re.error:
                pass
        
        return issues
    
    def run_all_checks(
        self,
        scanned_files: List[Dict[str, Any]],
        material_types_config: List[Dict[str, Any]],
        csv_validation_result: Optional[Dict[str, Any]] = None
    ) -> CheckResult:
        from datetime import datetime
        
        all_issues: List[Issue] = []
        
        if self.check_rules.get("check_required_materials", True):
            all_issues.extend(self.check_required_materials(scanned_files, material_types_config))
        
        if self.check_rules.get("check_signature_pages", True):
            all_issues.extend(self.check_signature_pages(scanned_files))
        
        if self.check_rules.get("check_duplicate_hash", True):
            all_issues.extend(self.check_duplicate_hash(scanned_files))
        
        if self.check_rules.get("check_page_range", True):
            all_issues.extend(self.check_page_range(scanned_files))
        
        if self.check_rules.get("check_naming_convention", True):
            all_issues.extend(self.check_naming_convention(scanned_files))
        
        if csv_validation_result:
            csv_issues = csv_validation_result.get("issues", [])
            for csv_issue in csv_issues:
                issue = Issue(
                    issue_type=csv_issue.get("type", "unknown"),
                    severity=csv_issue.get("severity", Severity.ERROR.value),
                    message=csv_issue.get("message", ""),
                    file_path=csv_issue.get("file_path"),
                    file_name=csv_issue.get("file_name"),
                    evidence_number=csv_issue.get("evidence_number"),
                    details={k: v for k, v in csv_issue.items() 
                             if k not in ["type", "severity", "message", "file_path", "file_name", "evidence_number"]}
                )
                all_issues.append(issue)
        
        error_count = sum(1 for i in all_issues if i.severity == Severity.ERROR.value)
        warning_count = sum(1 for i in all_issues if i.severity == Severity.WARNING.value)
        info_count = sum(1 for i in all_issues if i.severity == Severity.INFO.value)
        
        error_file_paths: Set[str] = set()
        for issue in all_issues:
            if issue.severity == Severity.ERROR.value and issue.file_path:
                error_file_paths.add(issue.file_path)
        
        all_file_paths = {f.get("file_path", "") for f in scanned_files if f.get("file_path")}
        passed_files = [p for p in all_file_paths if p not in error_file_paths]
        failed_files = list(error_file_paths)
        
        is_valid = error_count == 0
        
        return CheckResult(
            is_valid=is_valid,
            total_issues=len(all_issues),
            error_count=error_count,
            warning_count=warning_count,
            info_count=info_count,
            issues=all_issues,
            passed_files=sorted(passed_files),
            failed_files=sorted(failed_files),
            check_time=datetime.now().isoformat()
        )


class QuarantineManager:
    @staticmethod
    def save_quarantine(check_result: CheckResult, output_path: Path, 
                         manifest: Optional[Dict[str, Any]] = None,
                         csv_validation: Optional[Dict[str, Any]] = None) -> None:
        quarantine_data = {
            "check_result": check_result.to_dict(),
            "manifest_summary": {
                "total_files": manifest.get("total_files", 0) if manifest else 0,
                "total_size": manifest.get("total_size", 0) if manifest else 0,
                "scan_time": manifest.get("scan_time", "") if manifest else ""
            } if manifest else None,
            "csv_validation": csv_validation,
            "generated_at": check_result.check_time
        }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(quarantine_data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def load_quarantine(quarantine_path: Path) -> Dict[str, Any]:
        with open(quarantine_path, "r", encoding="utf-8") as f:
            return json.load(f)
