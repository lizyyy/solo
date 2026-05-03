import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import asdict, dataclass

from models import Issue


class StateManager:
    def __init__(self, state_file: str = "local_state.json"):
        self.state_file = state_file
        self.resolved_issues: Dict[str, Dict[str, Any]] = {}
        self.user_settings: Dict[str, Any] = {}
        self.last_load_time: Optional[datetime] = None
        
        self._load_state()

    def _load_state(self):
        if not os.path.exists(self.state_file):
            return
        
        try:
            with open(self.state_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                self.resolved_issues = data.get('resolved_issues', {})
                self.user_settings = data.get('user_settings', {})
                
                last_load_str = data.get('last_load_time')
                if last_load_str:
                    self.last_load_time = datetime.fromisoformat(last_load_str)
            
            print(f"已加载本地状态: {len(self.resolved_issues)} 个已处理问题")
        except Exception as e:
            print(f"加载本地状态失败: {e}")

    def _save_state(self):
        try:
            data = {
                'resolved_issues': self.resolved_issues,
                'user_settings': self.user_settings,
                'last_load_time': datetime.now().isoformat()
            }
            
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print(f"已保存本地状态到: {self.state_file}")
            return True
        except Exception as e:
            print(f"保存本地状态失败: {e}")
            return False

    def mark_issue_resolved(
        self, 
        issue_id: str, 
        resolved_by: str, 
        resolve_notes: str = ""
    ) -> bool:
        self.resolved_issues[issue_id] = {
            'issue_id': issue_id,
            'is_resolved': True,
            'resolved_by': resolved_by,
            'resolved_at': datetime.now().isoformat(),
            'resolve_notes': resolve_notes
        }
        
        return self._save_state()

    def mark_issue_unresolved(self, issue_id: str) -> bool:
        if issue_id in self.resolved_issues:
            del self.resolved_issues[issue_id]
            return self._save_state()
        return True

    def is_issue_resolved(self, issue_id: str) -> bool:
        return issue_id in self.resolved_issues and self.resolved_issues[issue_id].get('is_resolved', False)

    def get_issue_resolution(self, issue_id: str) -> Optional[Dict[str, Any]]:
        return self.resolved_issues.get(issue_id)

    def sync_with_issues(self, issues: List[Issue]) -> List[Issue]:
        for issue in issues:
            resolution = self.get_issue_resolution(issue.issue_id)
            if resolution:
                issue.is_resolved = resolution.get('is_resolved', False)
                issue.resolved_by = resolution.get('resolved_by', '')
                if resolution.get('resolved_at'):
                    try:
                        issue.resolved_at = datetime.fromisoformat(resolution['resolved_at'])
                    except (ValueError, TypeError):
                        issue.resolved_at = None
                issue.resolve_notes = resolution.get('resolve_notes', '')
        
        return issues

    def clear_state(self) -> bool:
        self.resolved_issues = {}
        return self._save_state()

    def export_state(self, export_path: str) -> bool:
        try:
            data = {
                'resolved_issues': self.resolved_issues,
                'user_settings': self.user_settings,
                'export_time': datetime.now().isoformat()
            }
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print(f"已导出状态到: {export_path}")
            return True
        except Exception as e:
            print(f"导出状态失败: {e}")
            return False

    def import_state(self, import_path: str, merge: bool = True) -> bool:
        if not os.path.exists(import_path):
            print(f"状态文件不存在: {import_path}")
            return False
        
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            imported_resolved = data.get('resolved_issues', {})
            
            if merge:
                self.resolved_issues.update(imported_resolved)
            else:
                self.resolved_issues = imported_resolved
            
            if 'user_settings' in data:
                self.user_settings.update(data['user_settings'])
            
            self._save_state()
            print(f"已从 {import_path} 导入状态 (共 {len(imported_resolved)} 条记录)")
            return True
        except Exception as e:
            print(f"导入状态失败: {e}")
            return False

    def get_statistics(self) -> Dict[str, Any]:
        total_resolved = len(self.resolved_issues)
        
        by_user: Dict[str, int] = {}
        for issue_id, resolution in self.resolved_issues.items():
            resolved_by = resolution.get('resolved_by', '未知')
            by_user[resolved_by] = by_user.get(resolved_by, 0) + 1
        
        return {
            'total_resolved': total_resolved,
            'by_user': by_user,
            'last_load_time': self.last_load_time.isoformat() if self.last_load_time else None,
            'state_file': self.state_file
        }
