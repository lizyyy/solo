import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from .rule_engine import Issue, RiskType


class StatePersistence:
    def __init__(self, data_dir: str = None):
        self.data_dir = Path(data_dir) if data_dir else Path.cwd() / "review_state"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.confirmations_file = self.data_dir / "confirmations.json"
        self.review_history_file = self.data_dir / "review_history.json"

    def _datetime_to_str(self, dt: Optional[datetime]) -> Optional[str]:
        return dt.isoformat() if dt else None

    def _str_to_datetime(self, s: Optional[str]) -> Optional[datetime]:
        return datetime.fromisoformat(s) if s else None

    def _risktype_to_str(self, rt: RiskType) -> str:
        return rt.value

    def _str_to_risktype(self, s: str) -> RiskType:
        return RiskType(s)

    def _issue_to_dict(self, issue: Issue) -> Dict[str, Any]:
        return {
            "issue_id": issue.issue_id,
            "batch_id": issue.batch_id,
            "risk_type": self._risktype_to_str(issue.risk_type),
            "timestamp": self._datetime_to_str(issue.timestamp),
            "severity": issue.severity,
            "description": issue.description,
            "details": issue.details,
            "confirmed_by": issue.confirmed_by,
            "confirmed_at": self._datetime_to_str(issue.confirmed_at),
            "is_false_positive": issue.is_false_positive,
            "notes": issue.notes
        }

    def _dict_to_issue(self, data: Dict[str, Any]) -> Issue:
        return Issue(
            issue_id=data["issue_id"],
            batch_id=data["batch_id"],
            risk_type=self._str_to_risktype(data["risk_type"]),
            timestamp=self._str_to_datetime(data["timestamp"]),
            severity=data["severity"],
            description=data["description"],
            details=data.get("details", {}),
            confirmed_by=data.get("confirmed_by"),
            confirmed_at=self._str_to_datetime(data.get("confirmed_at")),
            is_false_positive=data.get("is_false_positive", False),
            notes=data.get("notes", "")
        )

    def save_confirmations(self, issues: List[Issue]) -> bool:
        try:
            confirmed_data = []
            for issue in issues:
                if issue.confirmed_at is not None:
                    confirmed_data.append(self._issue_to_dict(issue))
            
            with open(self.confirmations_file, 'w', encoding='utf-8') as f:
                json.dump(confirmed_data, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"保存确认状态失败: {e}")
            return False

    def load_confirmations(self) -> Dict[str, Issue]:
        if not self.confirmations_file.exists():
            return {}
        
        try:
            with open(self.confirmations_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            result = {}
            for item in data:
                issue = self._dict_to_issue(item)
                result[issue.issue_id] = issue
            
            return result
        except Exception as e:
            print(f"加载确认状态失败: {e}")
            return {}

    def apply_saved_confirmations(self, issues: List[Issue]) -> List[Issue]:
        saved = self.load_confirmations()
        
        for issue in issues:
            if issue.issue_id in saved:
                saved_issue = saved[issue.issue_id]
                issue.confirmed_by = saved_issue.confirmed_by
                issue.confirmed_at = saved_issue.confirmed_at
                issue.is_false_positive = saved_issue.is_false_positive
                issue.notes = saved_issue.notes
        
        return issues

    def log_review_action(self, action: str, issue_id: str, batch_id: str, 
                          user: str = "", notes: str = "") -> bool:
        history_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "issue_id": issue_id,
            "batch_id": batch_id,
            "user": user,
            "notes": notes
        }
        
        history = []
        if self.review_history_file.exists():
            try:
                with open(self.review_history_file, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except Exception:
                history = []
        
        history.append(history_entry)
        
        try:
            with open(self.review_history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"记录操作历史失败: {e}")
            return False

    def get_review_history(self, batch_id: str = None) -> List[Dict[str, Any]]:
        if not self.review_history_file.exists():
            return []
        
        try:
            with open(self.review_history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
            
            if batch_id:
                history = [h for h in history if h.get("batch_id") == batch_id]
            
            return history
        except Exception as e:
            print(f"读取操作历史失败: {e}")
            return []

    def save_batch_notes(self, batch_id: str, notes: str) -> bool:
        notes_file = self.data_dir / f"batch_{batch_id}_notes.json"
        try:
            data = {
                "batch_id": batch_id,
                "notes": notes,
                "updated_at": datetime.now().isoformat()
            }
            with open(notes_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"保存批次备注失败: {e}")
            return False

    def load_batch_notes(self, batch_id: str) -> Optional[str]:
        notes_file = self.data_dir / f"batch_{batch_id}_notes.json"
        if not notes_file.exists():
            return None
        
        try:
            with open(notes_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get("notes", "")
        except Exception:
            return None

    def clear_all_state(self) -> bool:
        try:
            if self.confirmations_file.exists():
                self.confirmations_file.unlink()
            if self.review_history_file.exists():
                self.review_history_file.unlink()
            
            for notes_file in self.data_dir.glob("batch_*_notes.json"):
                notes_file.unlink()
            
            return True
        except Exception as e:
            print(f"清除状态失败: {e}")
            return False

    def export_state_summary(self) -> Dict[str, Any]:
        confirmations = self.load_confirmations()
        history = self.get_review_history()
        
        confirmed_count = sum(1 for i in confirmations.values() if not i.is_false_positive)
        false_positive_count = sum(1 for i in confirmations.values() if i.is_false_positive)
        
        return {
            "total_confirmed": confirmed_count + false_positive_count,
            "confirmed_issues": confirmed_count,
            "false_positives": false_positive_count,
            "total_review_actions": len(history),
            "state_directory": str(self.data_dir),
            "last_updated": datetime.now().isoformat()
        }
