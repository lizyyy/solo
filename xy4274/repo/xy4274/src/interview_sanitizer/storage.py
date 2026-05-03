"""状态存储模块 - 管理项目状态、扫描结果和人工处理意见"""

import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class IssueStatus(Enum):
    """问题处理状态"""
    OPEN = "待处理"
    IN_PROGRESS = "处理中"
    RESOLVED = "已解决"
    WONT_FIX = "不处理"
    NEEDS_REVIEW = "需复核"


@dataclass
class IssueNote:
    """问题备注"""
    issue_id: str
    status: IssueStatus
    comment: str = ""
    assignee: Optional[str] = None
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class NameOverride:
    """姓名覆盖规则（人工指定的化名）"""
    original_name: str
    override_pseudonym: str
    comment: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class SegmentExclusion:
    """片段排除（未授权片段需排除）"""
    segment_index: int
    start_time: str
    end_time: str
    reason: str
    excluded: bool = True
    comment: Optional[str] = None


@dataclass
class ProjectState:
    """项目状态"""
    project_id: str
    project_dir: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    scan_results: Dict[str, Any] = field(default_factory=dict)
    scan_time: Optional[str] = None
    
    issue_notes: Dict[str, IssueNote] = field(default_factory=dict)
    name_overrides: Dict[str, NameOverride] = field(default_factory=dict)
    segment_exclusions: Dict[int, SegmentExclusion] = field(default_factory=dict)
    
    export_history: List[Dict[str, Any]] = field(default_factory=list)
    
    metadata: Dict[str, Any] = field(default_factory=dict)


class StateManager:
    """状态管理器"""
    
    STATE_DIR_NAME = ".sanitizer"
    STATE_FILE_NAME = "state.json"
    CONFIG_FILE_NAME = "config.json"
    
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.state_dir = project_dir / self.STATE_DIR_NAME
        self.state_file = self.state_dir / self.STATE_FILE_NAME
        self.config_file = self.state_dir / self.CONFIG_FILE_NAME
        self._state: Optional[ProjectState] = None
    
    def init_project(self) -> ProjectState:
        """初始化项目状态"""
        if not self.state_dir.exists():
            self.state_dir.mkdir(parents=True, exist_ok=True)
        
        project_id = f"proj_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        state = ProjectState(
            project_id=project_id,
            project_dir=str(self.project_dir)
        )
        
        self._state = state
        self._save_state()
        
        return state
    
    def load_state(self) -> ProjectState:
        """加载项目状态"""
        if self._state is not None:
            return self._state
        
        if not self.state_file.exists():
            raise FileNotFoundError(f"状态文件不存在: {self.state_file}，请先运行 init 命令")
        
        with open(self.state_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        state = ProjectState(
            project_id=data.get('project_id', ''),
            project_dir=data.get('project_dir', ''),
            created_at=data.get('created_at', ''),
            updated_at=data.get('updated_at', ''),
            scan_results=data.get('scan_results', {}),
            scan_time=data.get('scan_time'),
            metadata=data.get('metadata', {})
        )
        
        for issue_id, note_data in data.get('issue_notes', {}).items():
            state.issue_notes[issue_id] = IssueNote(
                issue_id=note_data['issue_id'],
                status=IssueStatus(note_data['status']),
                comment=note_data.get('comment', ''),
                assignee=note_data.get('assignee'),
                updated_at=note_data.get('updated_at', '')
            )
        
        for name, override_data in data.get('name_overrides', {}).items():
            state.name_overrides[name] = NameOverride(
                original_name=override_data['original_name'],
                override_pseudonym=override_data['override_pseudonym'],
                comment=override_data.get('comment'),
                created_at=override_data.get('created_at', '')
            )
        
        for idx, excl_data in data.get('segment_exclusions', {}).items():
            state.segment_exclusions[int(idx)] = SegmentExclusion(
                segment_index=excl_data['segment_index'],
                start_time=excl_data['start_time'],
                end_time=excl_data['end_time'],
                reason=excl_data['reason'],
                excluded=excl_data.get('excluded', True),
                comment=excl_data.get('comment')
            )
        
        state.export_history = data.get('export_history', [])
        
        self._state = state
        return state
    
    def _save_state(self):
        """保存状态到文件"""
        if self._state is None:
            return
        
        self._state.updated_at = datetime.now().isoformat()
        
        data = {
            'project_id': self._state.project_id,
            'project_dir': self._state.project_dir,
            'created_at': self._state.created_at,
            'updated_at': self._state.updated_at,
            'scan_results': self._state.scan_results,
            'scan_time': self._state.scan_time,
            'issue_notes': {
                k: {
                    'issue_id': v.issue_id,
                    'status': v.status.value,
                    'comment': v.comment,
                    'assignee': v.assignee,
                    'updated_at': v.updated_at
                }
                for k, v in self._state.issue_notes.items()
            },
            'name_overrides': {
                k: {
                    'original_name': v.original_name,
                    'override_pseudonym': v.override_pseudonym,
                    'comment': v.comment,
                    'created_at': v.created_at
                }
                for k, v in self._state.name_overrides.items()
            },
            'segment_exclusions': {
                k: {
                    'segment_index': v.segment_index,
                    'start_time': v.start_time,
                    'end_time': v.end_time,
                    'reason': v.reason,
                    'excluded': v.excluded,
                    'comment': v.comment
                }
                for k, v in self._state.segment_exclusions.items()
            },
            'export_history': self._state.export_history,
            'metadata': self._state.metadata
        }
        
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def save_scan_results(self, results: Dict[str, Any]):
        """保存扫描结果"""
        state = self.load_state()
        state.scan_results = results
        state.scan_time = datetime.now().isoformat()
        self._save_state()
    
    def get_scan_results(self) -> Dict[str, Any]:
        """获取扫描结果"""
        state = self.load_state()
        return state.scan_results
    
    def update_issue_status(self, issue_index: int, status: IssueStatus, comment: str = "", 
                            assignee: Optional[str] = None) -> IssueNote:
        """
        更新问题状态
        
        Args:
            issue_index: 问题序号（从 0 开始）
            status: 新状态
            comment: 备注
            assignee: 处理人
            
        Returns:
            更新后的 IssueNote
        """
        state = self.load_state()
        issue_id = str(issue_index)
        
        note = IssueNote(
            issue_id=issue_id,
            status=status,
            comment=comment,
            assignee=assignee
        )
        
        state.issue_notes[issue_id] = note
        self._save_state()
        
        return note
    
    def get_issue_status(self, issue_index: int) -> Optional[IssueNote]:
        """获取问题处理状态"""
        state = self.load_state()
        return state.issue_notes.get(str(issue_index))
    
    def add_name_override(self, original_name: str, pseudonym: str, comment: Optional[str] = None) -> NameOverride:
        """
        添加姓名覆盖规则
        
        Args:
            original_name: 原始姓名
            pseudonym: 化名
            comment: 备注
            
        Returns:
            NameOverride 对象
        """
        state = self.load_state()
        
        override = NameOverride(
            original_name=original_name,
            override_pseudonym=pseudonym,
            comment=comment
        )
        
        state.name_overrides[original_name] = override
        self._save_state()
        
        return override
    
    def get_name_overrides(self) -> Dict[str, NameOverride]:
        """获取所有姓名覆盖规则"""
        state = self.load_state()
        return state.name_overrides
    
    def add_segment_exclusion(self, segment_index: int, start_time: str, end_time: str, 
                               reason: str, excluded: bool = True, comment: Optional[str] = None) -> SegmentExclusion:
        """
        添加片段排除规则
        
        Args:
            segment_index: 片段索引
            start_time: 开始时间
            end_time: 结束时间
            reason: 排除原因
            excluded: 是否排除
            comment: 备注
            
        Returns:
            SegmentExclusion 对象
        """
        state = self.load_state()
        
        exclusion = SegmentExclusion(
            segment_index=segment_index,
            start_time=start_time,
            end_time=end_time,
            reason=reason,
            excluded=excluded,
            comment=comment
        )
        
        state.segment_exclusions[segment_index] = exclusion
        self._save_state()
        
        return exclusion
    
    def get_segment_exclusions(self) -> Dict[int, SegmentExclusion]:
        """获取所有片段排除规则"""
        state = self.load_state()
        return state.segment_exclusions
    
    def record_export(self, export_type: str, output_path: str, metadata: Optional[Dict[str, Any]] = None):
        """
        记录导出历史
        
        Args:
            export_type: 导出类型（srt, markdown, json）
            output_path: 输出路径
            metadata: 附加元数据
        """
        state = self.load_state()
        
        export_record = {
            'export_type': export_type,
            'output_path': output_path,
            'export_time': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        
        state.export_history.append(export_record)
        self._save_state()
    
    def is_initialized(self) -> bool:
        """检查项目是否已初始化"""
        return self.state_file.exists()
    
    def get_config(self) -> Dict[str, Any]:
        """获取项目配置"""
        if self.config_file.exists():
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def save_config(self, config: Dict[str, Any]):
        """保存项目配置"""
        if not self.state_dir.exists():
            self.state_dir.mkdir(parents=True, exist_ok=True)
        
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
