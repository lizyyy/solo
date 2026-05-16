from typing import Dict, Any, Tuple, List
from datetime import datetime, timedelta
from app.models import RiskLevel, ChangeCategory, ContractChange, VerdictStatus, ChangeHistory, VerdictReport
from sqlalchemy.orm import Session


class ContractDiffAnalyzer:
    DOCUMENTATION_FIELDS = {"description", "summary", "title", "externaldocs"}

    @classmethod
    def analyze_diff(cls, old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> Dict[str, Any]:
        diff_summary = {
            "added": [],
            "removed": [],
            "modified": [],
            "documentation_changes": [],
            "breaking_changes": [],
            "compatible_changes": []
        }
        cls._compare_dicts(old_contract, new_contract, [], diff_summary, old_contract)
        return diff_summary

    @classmethod
    def _compare_dicts(cls, old: Dict, new: Dict, path: List[str], summary: Dict[str, Any], root_old: Dict):
        old_keys = set(old.keys()) if isinstance(old, dict) else set()
        new_keys = set(new.keys()) if isinstance(new, dict) else set()
        
        for key in new_keys - old_keys:
            full_path = ".".join(path + [str(key)])
            summary["added"].append(full_path)
        
        for key in old_keys - new_keys:
            full_path = ".".join(path + [str(key)])
            summary["removed"].append(full_path)
            
            is_doc = any(f in full_path.lower() for f in cls.DOCUMENTATION_FIELDS)
            change_info = {"path": full_path, "old": "存在", "new": "删除"}
            
            if is_doc:
                summary["documentation_changes"].append(change_info)
            else:
                if cls._is_required_field_deletion(path, key, root_old):
                    summary["breaking_changes"].append(change_info)
                else:
                    summary["compatible_changes"].append(change_info)
            summary["modified"].append(change_info)
        
        for key in old_keys & new_keys:
            old_val = old[key]
            new_val = new[key]
            new_path = path + [str(key)]
            path_str = ".".join(new_path)
            
            if isinstance(old_val, dict) and isinstance(new_val, dict):
                cls._compare_dicts(old_val, new_val, new_path, summary, root_old)
            elif isinstance(old_val, list) and isinstance(new_val, list):
                if sorted(old_val) != sorted(new_val):
                    is_doc = any(f in path_str.lower() for f in cls.DOCUMENTATION_FIELDS)
                    change_info = {"path": path_str, "old": old_val, "new": new_val}
                    if is_doc:
                        summary["documentation_changes"].append(change_info)
                    else:
                        breaking = cls._is_breaking_list_change(new_path, old_val, new_val)
                        if breaking:
                            summary["breaking_changes"].append(change_info)
                        else:
                            summary["compatible_changes"].append(change_info)
                    summary["modified"].append(change_info)
            elif old_val != new_val:
                is_doc = any(f in path_str.lower() for f in cls.DOCUMENTATION_FIELDS)
                change_info = {"path": path_str, "old": old_val, "new": new_val}
                if is_doc:
                    summary["documentation_changes"].append(change_info)
                else:
                    breaking = cls._is_breaking_change(new_path, old_val, new_val)
                    if breaking:
                        summary["breaking_changes"].append(change_info)
                    else:
                        summary["compatible_changes"].append(change_info)
                summary["modified"].append(change_info)

    @classmethod
    def _is_required_field_deletion(cls, path: List[str], field_name: str, root_old: Dict) -> bool:
        parent_path = path.copy()
        while parent_path:
            current = root_old
            valid = True
            for p in parent_path:
                if isinstance(current, dict) and p in current:
                    current = current[p]
                else:
                    valid = False
                    break
            if valid and isinstance(current, dict):
                if "required" in current:
                    required = current["required"]
                    if isinstance(required, list) and field_name in required:
                        return True
            parent_path.pop()
        return False

    @classmethod
    def _is_breaking_list_change(cls, path: List[str], old_val: List, new_val: List) -> bool:
        path_str = ".".join(path).lower()
        if "required" in path_str:
            if len(set(new_val) - set(old_val)) > 0:
                return True
        if "enum" in path_str:
            if len(set(old_val) - set(new_val)) > 0:
                return True
        return False

    @classmethod
    def _is_breaking_change(cls, path: List[str], old_val: Any, new_val: Any) -> bool:
        path_str = ".".join(path).lower()
        if "type" in path_str:
            if old_val != new_val:
                return True
        if "enum" in path_str:
            return True
        return False


class RiskEngine:
    @classmethod
    def calculate_risk(cls, diff_summary: Dict[str, Any]) -> Tuple[RiskLevel, str, ChangeCategory]:
        breaking_count = len(diff_summary.get("breaking_changes", []))
        compatible_count = len(diff_summary.get("compatible_changes", []))
        doc_count = len(diff_summary.get("documentation_changes", []))
        added_count = len(diff_summary.get("added", []))
        removed_count = len(diff_summary.get("removed", []))

        if breaking_count > 0:
            if breaking_count >= 5:
                risk_level = RiskLevel.CRITICAL
                category = ChangeCategory.BREAKING
                opinion = f"检测到{breaking_count}项破坏性变更"
            elif breaking_count >= 2:
                risk_level = RiskLevel.HIGH
                category = ChangeCategory.BREAKING
                opinion = f"检测到{breaking_count}项破坏性变更"
            else:
                risk_level = RiskLevel.MEDIUM
                category = ChangeCategory.BREAKING
                opinion = "检测到1项破坏性变更"
        elif compatible_count > 0 or added_count > 0:
            category = ChangeCategory.COMPATIBLE
            if compatible_count + added_count >= 5:
                risk_level = RiskLevel.LOW
            else:
                risk_level = RiskLevel.SAFE
            opinion = f"检测到{compatible_count}项兼容变更，{added_count}项新增"
        elif doc_count > 0:
            category = ChangeCategory.DOCUMENTATION_ONLY
            risk_level = RiskLevel.SAFE
            opinion = f"仅文档变更，共{doc_count}处"
        else:
            category = ChangeCategory.UNKNOWN
            risk_level = RiskLevel.UNKNOWN
            opinion = "未检测到有效变更"

        return risk_level, opinion, category


class ChangeHistoryService:
    @staticmethod
    def log_change(db: Session, contract_change_id: int, field_name: str,
                     old_value: Any, new_value: Any, changed_by: str, reason: str):
        history = ChangeHistory(
            contract_change_id=contract_change_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            reason=reason
        )
        db.add(history)
        db.commit()


class VerdictReportGenerator:
    @staticmethod
    def generate_report(change: ContractChange, report_type: str = "full") -> Dict[str, Any]:
        report = {
            "change_id": change.id,
            "api_path": change.api_path,
            "http_method": change.http_method,
            "caller": change.caller,
            "risk_level": change.risk_level.value,
            "status": change.status.value,
            "change_category": change.change_category.value,
            "verdict_opinion": change.verdict_opinion,
            "diff_summary": change.diff_summary,
            "processing_basis": change.processing_basis,
            "final_conclusion": change.final_conclusion,
            "created_at": change.created_at.isoformat() if change.created_at else None,
            "confirmed_at": change.confirmed_at.isoformat() if change.confirmed_at else None,
            "completed_at": change.completed_at.isoformat() if change.completed_at else None,
            "manual_override": change.manual_override,
            "report_generated_at": datetime.utcnow().isoformat(),
            "report_type": report_type
        }
        return report

    @staticmethod
    def generate_export_data(changes: List[ContractChange]) -> Dict[str, Any]:
        return {
            "export_time": datetime.utcnow().isoformat(),
            "total_count": len(changes),
            "changes": [
                {
                    "id": c.id,
                    "api_path": c.api_path,
                    "http_method": c.http_method,
                    "caller": c.caller,
                    "risk_level": c.risk_level.value,
                    "status": c.status.value,
                    "change_category": c.change_category.value,
                    "verdict_opinion": c.verdict_opinion,
                    "created_at": c.created_at.isoformat() if c.created_at else None
                }
                for c in changes
            ]
        }
            ]
        }
