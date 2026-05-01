"""规则引擎基类"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, Generic, TypeVar

from ..models import Issue, IssueType, IssueSeverity


T = TypeVar("T")


@dataclass
class RuleResult:
    """规则执行结果"""
    rule_name: str
    executed_at: str
    success: bool = True
    issues: list[Issue] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


class BaseRule(ABC, Generic[T]):
    """规则基类"""
    
    def __init__(self, name: str):
        self.name = name
    
    @abstractmethod
    def execute(self, data: T) -> RuleResult:
        """执行规则"""
        pass
    
    def _create_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        description: str,
        box_id: Optional[str] = None,
        sensor_id: Optional[str] = None,
        route_node_id: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        source_data: Optional[dict] = None,
    ) -> Issue:
        """创建问题实例"""
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return Issue(
            issue_id=issue_id,
            issue_type=issue_type,
            severity=severity,
            box_id=box_id,
            sensor_id=sensor_id,
            route_node_id=route_node_id,
            start_time=start_time,
            end_time=end_time,
            description=description,
            detected_at=now,
            source_data=source_data,
        )
    
    def _generate_issue_id(self) -> str:
        """生成问题ID"""
        import uuid
        return f"ISSUE_{uuid.uuid4().hex[:8].upper()}"
    
    def _get_iso_time(self, dt: datetime) -> str:
        """转换为ISO格式时间"""
        return dt.isoformat()
    
    def _parse_iso_time(self, time_str: str) -> Optional[datetime]:
        """解析ISO格式时间"""
        try:
            if "T" in time_str:
                return datetime.fromisoformat(time_str)
            else:
                return datetime.fromisoformat(time_str.replace(" ", "T"))
        except (ValueError, TypeError):
            return None
