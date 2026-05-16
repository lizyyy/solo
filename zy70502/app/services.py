import json
import jsondiff
from typing import Dict, Any, Tuple, List
from datetime import datetime, timedelta
from app.models import RiskLevel, ChangeCategory, ContractChange, VerdictStatus, ChangeHistory
from sqlalchemy.orm import Session


class ContractDiffAnalyzer:
    DOCUMENTATION_FIELDS = {"description", "summary", "title", "externalDocs"}

    @classmethod
    def analyze_diff(cls, old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> Dict[str, Any]:
        diff = jsondiff.diff(old_contract, new_contract, syntax='symmetric')
        diff_summary = {
            "added": [],
            "removed": [],
            "modified": [],
            "documentation_changes": [],
            "breaking_changes": [],
            "compatible_changes": []
        }
        cls._traverse_diff(diff, [], diff_summary, old_contract, new_contract)
        return diff_summary

    @classmethod
    def _traverse_diff(cls, diff: Any, path: List[str], summary: Dict[str, Any],
                        old: Dict[str, Any], new: Dict[str, Any]):
        if isinstance(diff, dict):
            for key, value in diff.items():
                if key == jsondiff.symbols.insert:
                    for item in value:
                        summary["added"].append(".".join(path + [str(item)]))
                elif key == jsondiff.symbols.delete:
                    for item in value:
                        summary["removed"].append(".".join(path + [str(item)]))
                else:
                    new_path = path + [str(key)]
                    path_str = ".".join(new_path)
                    is_doc = any(f in path_str.lower() for f in cls.DOCUMENTATION_FIELDS)
                    if isinstance(value, dict) and jsondiff.symbols.old in value and jsondiff.symbols.new in value:
                        old_val = value[jsondiff.symbols.old]
                        new_val = value[jsondiff.symbols.new]
                        if is_doc:
                            summary["documentation_changes"].append({
                                "path": path_str,
                                "old": old_val,
                                "new": new_val
                            })
                        else:
                            breaking = cls._is_breaking_change(new_path, old_val, new_val, old, new)
                            change_info = {"path": path_str, "old": old_val, "new": new_val}
                            if breaking:
                                summary["breaking_changes"].append(change_info)
                                summary["modified"].append(change_info)
                            else:
                                summary["compatible_changes"].append(change_info)
                                summary["modified"].append(change_info)
                    else:
                        cls._traverse_diff(value, new_path, summary, old, new)

    @classmethod
    def _is_breaking_change(cls, path: List[str], old_val: Any, new_val: Any,
                            old_contract: Dict, new_contract: Dict) -> bool:
        path_str = ".".join(path)
        if "required" in path_str:
            if isinstance(new_val, list) and isinstance(old_val, list):
                if len(set(new_val) - set(old_val)) > 0:
                    return True
        if "type" in path_str:
            if old_val != new_val:
                return True
        if "enum" in path_str:
            if isinstance(new_val, list) and isinstance(old_val, list):
                if len(set(old_val) - set(new_val)) > 0:
                    return True
        if "properties" in path and len(path) >= 2:
            prop_name = path[-2]
            old_props = cls._get_nested_value(old_contract, path[:-1]) or {}
            new_props = cls._get_nested_value(new_contract, path[:-1]) or {}
            if old_props and isinstance(old_props, dict):
                if "nullable" not in old_props.get(prop_name, {}) and "nullable" not in new_props.get(prop_name, {}):
                    if path[-1] != "nullable":
                        return True
        return False

    @staticmethod
    def _get_nested_value(obj: Dict, path: List[str]) -> Any:
        current = obj
        for key in path:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None
        return current


class RiskEngine:
    @classmethod
    def calculate_risk(cls, diff_summary: Dict[str, Any]) -> Tuple[RiskLevel, str, ChangeCategory]:
        breaking_count = len(diff_summary.get("breaking_changes", []))
        compatible_count = len(diff_summary.get("compatible_changes", []))
        doc_count = len(diff_summary.get("documentation_changes", []))
        added_count = len(diff_summary.get("added", []))
        removed_count = len(diff_summary.get("removed", []))

        if breaking_count > 0:
            if breaking_count >= 5 or removed_count > 0:
                risk_level = RiskLevel.CRITICAL
                category = ChangeCategory.BREAKING
                opinion = f"检测到{breaking_count}项破坏性变更，{removed_count}项字段删除"
            elif breaking_count >= 2:
                risk_level = RiskLevel.HIGH
                category = ChangeCategory.BREAKING
                opinion = f"检测到{breaking_count}项破坏性变更"
            else:
                risk_level = RiskLevel.MEDIUM
                category = ChangeCategory.BREAKING
                opinion = "检测到破坏性变更"
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
            risk_level = RiskLevel.SAFE
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
