"""
隔离区模块 - 管理问题病例的隔离和记录
"""

import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Any, Optional

from .models import OrderCase, OrderStatus


class QuarantineManager:
    def __init__(self, quarantine_dir: str):
        self.quarantine_dir = os.path.abspath(quarantine_dir)
        self.quarantine_file = os.path.join(self.quarantine_dir, "quarantine.json")
        self.quarantined_cases: Dict[str, OrderCase] = {}
        self._ensure_dir_exists()
        self._load_quarantine_file()
    
    def _ensure_dir_exists(self):
        if not os.path.exists(self.quarantine_dir):
            os.makedirs(self.quarantine_dir, exist_ok=True)
    
    def _load_quarantine_file(self):
        if os.path.exists(self.quarantine_file):
            try:
                with open(self.quarantine_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._parse_quarantine_data(data)
            except Exception as e:
                print(f"Warning: Failed to load quarantine file: {e}")
    
    def _parse_quarantine_data(self, data: Dict[str, Any]):
        cases = data.get("cases", {})
        for case_id, case_data in cases.items():
            self.quarantined_cases[case_id] = case_data
    
    def _case_to_quarantine_format(self, case: OrderCase) -> Dict[str, Any]:
        case_dict = case.to_dict()
        case_dict["quarantine_time"] = datetime.now().isoformat()
        case_dict["quarantine_reason"] = self._get_quarantine_reason(case)
        return case_dict
    
    def _get_quarantine_reason(self, case: OrderCase) -> str:
        critical_issues = [
            issue for issue in case.validation_issues 
            if issue.severity == "critical"
        ]
        if critical_issues:
            return "; ".join([issue.message for issue in critical_issues])
        return "未知原因"
    
    def quarantine_case(self, case: OrderCase) -> bool:
        if case.status != OrderStatus.QUARANTINED:
            case.status = OrderStatus.QUARANTINED
        
        case_id = case.case_id
        quarantine_data = self._case_to_quarantine_format(case)
        
        self.quarantined_cases[case_id] = quarantine_data
        
        self._save_quarantine_file()
        
        if case.model_files:
            self._copy_files_to_quarantine(case)
        
        return True
    
    def _copy_files_to_quarantine(self, case: OrderCase):
        case_quarantine_dir = os.path.join(self.quarantine_dir, case.case_id)
        if not os.path.exists(case_quarantine_dir):
            os.makedirs(case_quarantine_dir, exist_ok=True)
        
        for model_file in case.model_files:
            try:
                src_path = model_file.file_path
                dst_path = os.path.join(case_quarantine_dir, model_file.file_name)
                
                if not os.path.exists(dst_path):
                    shutil.copy2(src_path, dst_path)
            except Exception as e:
                print(f"Warning: Failed to copy file {model_file.file_name} to quarantine: {e}")
    
    def _save_quarantine_file(self):
        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "version": "1.0.0"
            },
            "cases": self.quarantined_cases,
            "summary": self._generate_summary()
        }
        
        with open(self.quarantine_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _generate_summary(self) -> Dict[str, Any]:
        total = len(self.quarantined_cases)
        issue_types: Dict[str, int] = {}
        severity_counts: Dict[str, int] = {"critical": 0, "warning": 0, "info": 0}
        
        for case_id, case_data in self.quarantined_cases.items():
            issues = case_data.get("validation_issues", [])
            for issue in issues:
                rule_name = issue.get("rule_name", "unknown")
                severity = issue.get("severity", "warning")
                
                if rule_name in issue_types:
                    issue_types[rule_name] += 1
                else:
                    issue_types[rule_name] = 1
                
                if severity in severity_counts:
                    severity_counts[severity] += 1
                else:
                    severity_counts[severity] = 1
        
        return {
            "total_quarantined": total,
            "issue_types": issue_types,
            "severity_counts": severity_counts
        }
    
    def get_quarantined_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        return self.quarantined_cases.get(case_id)
    
    def get_all_quarantined(self) -> List[Dict[str, Any]]:
        return list(self.quarantined_cases.values())
    
    def release_case(self, case_id: str) -> bool:
        if case_id in self.quarantined_cases:
            del self.quarantined_cases[case_id]
            self._save_quarantine_file()
            return True
        return False
    
    def clear_all(self) -> int:
        count = len(self.quarantined_cases)
        self.quarantined_cases.clear()
        self._save_quarantine_file()
        return count
    
    def get_quarantine_summary(self) -> Dict[str, Any]:
        return {
            "quarantine_dir": self.quarantine_dir,
            "quarantine_file": self.quarantine_file,
            "total_quarantined": len(self.quarantined_cases),
            "cases": list(self.quarantined_cases.keys()),
            "summary": self._generate_summary()
        }
    
    def quarantine_cases(self, cases: List[OrderCase]) -> int:
        quarantined_count = 0
        for case in cases:
            if case.status == OrderStatus.QUARANTINED or case.has_critical_issues():
                if self.quarantine_case(case):
                    quarantined_count += 1
        return quarantined_count
