"""
历史记录管理模块
保存和读取每期的检查历史
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .models import CheckResult, CheckHistory, Issue, IssueSeverity
from .config import Config


class HistoryManager:
    """历史记录管理器"""
    
    def __init__(self, config: Config):
        self.config = config
        self.history_config = config.history_config
        self.storage_path = Path(self.history_config.get('storage_path', './check_history'))
        self.keep_count = self.history_config.get('keep_count', 50)
        
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self) -> None:
        """确保存储目录存在"""
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    def save_check_result(self, result: CheckResult) -> CheckHistory:
        """保存检查结果到历史记录
        
        Args:
            result: 检查结果
            
        Returns:
            历史记录对象
        """
        episode_dir = self.storage_path / f"EP{result.episode_number}"
        episode_dir.mkdir(exist_ok=True)
        
        timestamp = result.check_time.strftime("%Y%m%d_%H%M%S")
        result_filename = f"check_{timestamp}.json"
        result_file = episode_dir / result_filename
        
        result_data = self._result_to_dict(result)
        
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2, default=str)
        
        history = CheckHistory(
            episode_number=result.episode_number,
            check_time=result.check_time,
            folder_path=result.folder_path,
            passed=result.passed,
            error_count=result.error_count,
            warning_count=result.warning_count,
            issues_summary=self._summarize_issues(result.issues),
            result_file=str(result_file)
        )
        
        self._cleanup_old_records(episode_dir)
        
        return history
    
    def _result_to_dict(self, result: CheckResult) -> Dict[str, Any]:
        """将检查结果转换为可序列化的字典"""
        files_dict = {
            'episode_number': result.files.episode_number,
            'folder_path': result.files.folder_path,
            'audio_path': result.files.audio_path,
            'cover_path': result.files.cover_path,
            'shownotes_path': result.files.shownotes_path,
            'subtitles_path': result.files.subtitles_path,
            'assets_folder': result.files.assets_folder,
            'extra_files': result.files.extra_files,
            'audio_duration': result.files.audio_duration,
            'audio_bitrate': result.files.audio_bitrate,
            'audio_sample_rate': result.files.audio_sample_rate,
        }
        
        issues_dict = []
        for issue in result.issues:
            issues_dict.append({
                'issue_type': issue.issue_type.value,
                'severity': issue.severity.value,
                'message': issue.message,
                'file_path': issue.file_path,
                'details': issue.details,
                'suggestion': issue.suggestion,
            })
        
        return {
            'episode_number': result.episode_number,
            'check_time': result.check_time.isoformat(),
            'folder_path': result.folder_path,
            'files': files_dict,
            'issues': issues_dict,
            'total_files_checked': result.total_files_checked,
            'error_count': result.error_count,
            'warning_count': result.warning_count,
            'passed': result.passed,
        }
    
    def _summarize_issues(self, issues: List[Issue]) -> List[str]:
        """生成问题摘要"""
        summary = []
        for issue in issues[:10]:
            severity_mark = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}.get(issue.severity.value, "")
            summary.append(f"{severity_mark} {issue.message}")
        
        if len(issues) > 10:
            summary.append(f"... 还有 {len(issues) - 10} 个问题")
        
        return summary
    
    def _cleanup_old_records(self, episode_dir: Path) -> None:
        """清理旧的历史记录"""
        json_files = sorted(
            episode_dir.glob("check_*.json"),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        if len(json_files) > self.keep_count:
            for old_file in json_files[self.keep_count:]:
                old_file.unlink()
    
    def load_check_result(self, episode_number: str, check_time: Optional[datetime] = None) -> Optional[CheckResult]:
        """加载检查结果
        
        Args:
            episode_number: 期数编号
            check_time: 指定检查时间，如果为None则加载最新的
            
        Returns:
            检查结果对象，如果不存在则返回None
        """
        episode_dir = self.storage_path / f"EP{episode_number}"
        if not episode_dir.exists():
            return None
        
        if check_time:
            timestamp = check_time.strftime("%Y%m%d_%H%M%S")
            result_file = episode_dir / f"check_{timestamp}.json"
            if result_file.exists():
                return self._load_result_from_file(result_file)
            return None
        else:
            json_files = sorted(
                episode_dir.glob("check_*.json"),
                key=lambda x: x.stat().st_mtime,
                reverse=True
            )
            if json_files:
                return self._load_result_from_file(json_files[0])
            return None
    
    def _load_result_from_file(self, file_path: Path) -> Optional[CheckResult]:
        """从文件加载检查结果"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            from .models import EpisodeFiles, Issue, IssueType, IssueSeverity
            
            files = EpisodeFiles(
                episode_number=data['files']['episode_number'],
                folder_path=data['files']['folder_path'],
                audio_path=data['files'].get('audio_path'),
                cover_path=data['files'].get('cover_path'),
                shownotes_path=data['files'].get('shownotes_path'),
                subtitles_path=data['files'].get('subtitles_path'),
                assets_folder=data['files'].get('assets_folder'),
                extra_files=data['files'].get('extra_files', []),
                audio_duration=data['files'].get('audio_duration'),
                audio_bitrate=data['files'].get('audio_bitrate'),
                audio_sample_rate=data['files'].get('audio_sample_rate'),
            )
            
            issues = []
            for issue_data in data.get('issues', []):
                issues.append(Issue(
                    issue_type=IssueType(issue_data['issue_type']),
                    severity=IssueSeverity(issue_data['severity']),
                    message=issue_data['message'],
                    file_path=issue_data.get('file_path'),
                    details=issue_data.get('details', {}),
                    suggestion=issue_data.get('suggestion'),
                ))
            
            check_time = datetime.fromisoformat(data['check_time'])
            
            return CheckResult(
                episode_number=data['episode_number'],
                check_time=check_time,
                folder_path=data['folder_path'],
                files=files,
                issues=issues,
                total_files_checked=data.get('total_files_checked', 0),
                error_count=data.get('error_count', 0),
                warning_count=data.get('warning_count', 0),
                passed=data.get('passed', False),
            )
        
        except Exception as e:
            return None
    
    def get_episode_history(self, episode_number: str) -> List[CheckHistory]:
        """获取某期的所有检查历史
        
        Args:
            episode_number: 期数编号
            
        Returns:
            历史记录列表，按时间倒序排列
        """
        episode_dir = self.storage_path / f"EP{episode_number}"
        if not episode_dir.exists():
            return []
        
        history_list = []
        json_files = sorted(
            episode_dir.glob("check_*.json"),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        for json_file in json_files:
            result = self._load_result_from_file(json_file)
            if result:
                history = CheckHistory(
                    episode_number=result.episode_number,
                    check_time=result.check_time,
                    folder_path=result.folder_path,
                    passed=result.passed,
                    error_count=result.error_count,
                    warning_count=result.warning_count,
                    issues_summary=self._summarize_issues(result.issues),
                    result_file=str(json_file)
                )
                history_list.append(history)
        
        return history_list
    
    def list_all_episodes(self) -> List[str]:
        """列出所有有检查历史的期数
        
        Returns:
            期数编号列表
        """
        if not self.storage_path.exists():
            return []
        
        episodes = []
        for item in self.storage_path.iterdir():
            if item.is_dir() and item.name.startswith('EP'):
                episode_num = item.name[2:]
                if episode_num.isdigit():
                    episodes.append(episode_num)
        
        return sorted(episodes, key=lambda x: int(x))
