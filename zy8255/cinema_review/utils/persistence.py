"""
状态持久化管理器 - 负责保存和加载用户的处理状态
"""

import json
from datetime import date, datetime, time
from pathlib import Path
from typing import Optional, Dict, Any, List

from cinema_review.models import ReviewState, Issue


class StateManager:
    """状态管理器类"""
    
    def __init__(self, state_file: Path):
        """
        初始化状态管理器
        
        Args:
            state_file: 状态文件路径
        """
        self.state_file = state_file
        self._current_state: Optional[ReviewState] = None
    
    def load(self, target_date: Optional[date] = None) -> ReviewState:
        """
        加载状态
        
        Args:
            target_date: 目标日期，如果为None则使用今天
            
        Returns:
            ReviewState对象
        """
        if target_date is None:
            target_date = date.today()
        
        # 检查文件是否存在
        if not self.state_file.exists():
            self._current_state = ReviewState(review_date=target_date)
            return self._current_state
        
        # 读取文件
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # 检查是否是目标日期的状态
            saved_date = date.fromisoformat(data.get("review_date", target_date.isoformat()))
            
            if saved_date == target_date:
                # 同一天，加载保存的状态
                self._current_state = ReviewState.from_dict(data)
            else:
                # 不同日期，创建新状态
                self._current_state = ReviewState(review_date=target_date)
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"加载状态文件失败: {e}，创建新状态")
            self._current_state = ReviewState(review_date=target_date)
        
        return self._current_state
    
    def save(self, state: Optional[ReviewState] = None) -> bool:
        """
        保存状态
        
        Args:
            state: 要保存的状态，如果为None则使用当前状态
            
        Returns:
            是否保存成功
        """
        if state is None:
            state = self._current_state
        
        if state is None:
            return False
        
        # 更新最后修改时间
        state.last_updated = datetime.now()
        
        # 确保目录存在
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存状态文件失败: {e}")
            return False
    
    def get_current_state(self) -> Optional[ReviewState]:
        """
        获取当前状态
        
        Returns:
            当前ReviewState对象
        """
        return self._current_state
    
    def update_issue_status(
        self,
        issue: Issue,
        status: str,
        notes: Optional[str] = None
    ) -> None:
        """
        更新问题状态
        
        Args:
            issue: 问题对象
            status: 新状态 ("new", "resolved", "dismissed")
            notes: 备注信息
        """
        if self._current_state is None:
            self._current_state = ReviewState(review_date=date.today())
        
        issue_id = issue.id
        
        # 从列表中移除旧状态
        if issue_id in self._current_state.resolved_issue_ids:
            self._current_state.resolved_issue_ids.remove(issue_id)
        if issue_id in self._current_state.dismissed_issue_ids:
            self._current_state.dismissed_issue_ids.remove(issue_id)
        
        # 添加新状态
        if status == "resolved":
            self._current_state.resolved_issue_ids.append(issue_id)
        elif status == "dismissed":
            self._current_state.dismissed_issue_ids.append(issue_id)
        
        # 更新备注
        if notes is not None:
            self._current_state.issue_notes[issue_id] = notes
        
        # 更新最后修改时间
        self._current_state.last_updated = datetime.now()
    
    def get_issue_display_status(self, issue: Issue) -> str:
        """
        获取问题的显示状态
        
        Args:
            issue: 问题对象
            
        Returns:
            显示状态字符串 ("新问题", "已解决", "已忽略")
        """
        if self._current_state is None:
            return "新问题"
        
        issue_id = issue.id
        
        if issue_id in self._current_state.resolved_issue_ids:
            return "已解决"
        elif issue_id in self._current_state.dismissed_issue_ids:
            return "已忽略"
        else:
            return "新问题"
    
    def get_issue_notes(self, issue: Issue) -> str:
        """
        获取问题的备注
        
        Args:
            issue: 问题对象
            
        Returns:
            备注字符串
        """
        if self._current_state is None:
            return ""
        
        return self._current_state.issue_notes.get(issue.id, "")
    
    def update_filter_state(
        self,
        hall_id: Optional[str] = None,
        time_range_start: Optional[time] = None,
        time_range_end: Optional[time] = None
    ) -> None:
        """
        更新筛选器状态
        
        Args:
            hall_id: 选中的影厅ID
            time_range_start: 时间段开始
            time_range_end: 时间段结束
        """
        if self._current_state is None:
            self._current_state = ReviewState(review_date=date.today())
        
        if hall_id is not None:
            self._current_state.hall_id = hall_id
        if time_range_start is not None:
            self._current_state.time_range_start = time_range_start
        if time_range_end is not None:
            self._current_state.time_range_end = time_range_end
        
        self._current_state.last_updated = datetime.now()
    
    def apply_issue_states(self, issues: List[Issue]) -> List[Issue]:
        """
        将保存的状态应用到问题列表
        
        Args:
            issues: 原始问题列表
            
        Returns:
            更新了状态的问题列表
        """
        if self._current_state is None:
            return issues
        
        for issue in issues:
            issue_id = issue.id
            
            # 应用状态
            if issue_id in self._current_state.resolved_issue_ids:
                issue.status = "resolved"
            elif issue_id in self._current_state.dismissed_issue_ids:
                issue.status = "dismissed"
            
            # 应用备注
            if issue_id in self._current_state.issue_notes:
                issue.notes = self._current_state.issue_notes[issue_id]
        
        return issues
