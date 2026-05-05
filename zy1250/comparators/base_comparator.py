from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class ComparisonIssue:
    """对比问题"""
    issue_type: str
    severity: str  # critical, warning, info
    message: str
    legacy_value: Any = None
    grpc_value: Any = None
    suggestion: str = ''
    field_path: str = ''


@dataclass
class ComparisonResult:
    """对比结果"""
    is_match: bool = False
    issues: List[ComparisonIssue] = field(default_factory=list)
    legacy_data: Dict[str, Any] = field(default_factory=dict)
    grpc_data: Dict[str, Any] = field(default_factory=dict)
    details: Dict[str, Any] = field(default_factory=dict)


class BaseComparator(ABC):
    """对比器基类"""
    
    COMPARISON_TYPE: str = ''
    
    @abstractmethod
    def compare(self, legacy_data: Any, grpc_data: Any) -> ComparisonResult:
        """执行对比"""
        pass
    
    def create_issue(self,
                    issue_type: str,
                    message: str,
                    severity: str = 'warning',
                    legacy_value: Any = None,
                    grpc_value: Any = None,
                    suggestion: str = '',
                    field_path: str = '') -> ComparisonIssue:
        """创建对比问题"""
        return ComparisonIssue(
            issue_type=issue_type,
            severity=severity,
            message=message,
            legacy_value=legacy_value,
            grpc_value=grpc_value,
            suggestion=suggestion,
            field_path=field_path
        )
    
    def to_dict(self, result: ComparisonResult) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'comparison_type': self.COMPARISON_TYPE,
            'is_match': result.is_match,
            'issues': [
                {
                    'issue_type': issue.issue_type,
                    'severity': issue.severity,
                    'message': issue.message,
                    'legacy_value': issue.legacy_value,
                    'grpc_value': issue.grpc_value,
                    'suggestion': issue.suggestion,
                    'field_path': issue.field_path
                }
                for issue in result.issues
            ],
            'legacy_data': result.legacy_data,
            'grpc_data': result.grpc_data,
            'details': result.details
        }
