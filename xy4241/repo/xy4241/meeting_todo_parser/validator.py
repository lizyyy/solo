"""
校验模块 - 负责数据验证、异常处理和警告收集
"""

from datetime import date, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
import logging

from .normalizer import NormalizedTodoItem, DateNormalizer

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """校验严重程度"""
    ERROR = "error"      # 必须修复的错误
    WARNING = "warning"  # 建议修复的警告
    INFO = "info"        # 信息性提示


class ValidationErrorCode(Enum):
    """校验错误码"""
    # 内容相关
    CONTENT_EMPTY = "content_empty"
    CONTENT_TOO_SHORT = "content_too_short"
    
    # 负责人相关
    ASSIGNEE_MISSING = "assignee_missing"
    ASSIGNEE_INVALID = "assignee_invalid"
    
    # 日期相关
    DEADLINE_MISSING = "deadline_missing"
    DEADLINE_PARSE_FAILED = "deadline_parse_failed"
    DEADLINE_TOO_FAR_PAST = "deadline_too_far_past"
    DEADLINE_TOO_FAR_FUTURE = "deadline_too_far_future"
    DEADLINE_OVERDUE = "deadline_overdue"
    
    # 阻塞项相关
    BLOCKING_INVALID = "blocking_invalid"
    
    # 其他
    METADATA_INCOMPLETE = "metadata_incomplete"


@dataclass
class ValidationWarning:
    """单个校验警告"""
    item_id: str
    severity: ValidationSeverity
    error_code: ValidationErrorCode
    message: str
    field: Optional[str] = None
    raw_value: Optional[str] = None
    suggestion: Optional[str] = None
    
    # 源数据引用
    source_file: str = ""
    line_number: int = 0
    raw_content: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（用于JSON序列化）"""
        return {
            "item_id": self.item_id,
            "severity": self.severity.value,
            "error_code": self.error_code.value,
            "message": self.message,
            "field": self.field,
            "raw_value": self.raw_value,
            "suggestion": self.suggestion,
            "source": {
                "file": self.source_file,
                "line": self.line_number,
                "raw_content": self.raw_content
            }
        }


@dataclass
class ValidationResult:
    """校验结果"""
    total_items: int = 0
    valid_items: int = 0
    items_with_errors: int = 0
    items_with_warnings: int = 0
    
    # 按严重程度分类
    errors: List[ValidationWarning] = field(default_factory=list)
    warnings: List[ValidationWarning] = field(default_factory=list)
    infos: List[ValidationWarning] = field(default_factory=list)
    
    # 无法识别的待办项（专门用于 warnings.json）
    unrecognized_items: List[Dict[str, Any]] = field(default_factory=list)
    
    def add_warning(self, warning: ValidationWarning):
        """添加校验警告"""
        if warning.severity == ValidationSeverity.ERROR:
            self.errors.append(warning)
        elif warning.severity == ValidationSeverity.WARNING:
            self.warnings.append(warning)
        else:
            self.infos.append(warning)
    
    def add_unrecognized(self, item: NormalizedTodoItem, reason: str):
        """添加无法识别的待办项"""
        self.unrecognized_items.append({
            "id": item.id,
            "content": item.content,
            "raw_content": item.raw_content,
            "source_file": item.source_file,
            "line_number": item.line_number,
            "reason": reason,
            "has_assignee": item.has_assignee,
            "has_deadline": item.has_deadline,
            "deadline_str": item.deadline_str,
            "assignee": item.assignee
        })
    
    def get_all_warnings(self) -> List[ValidationWarning]:
        """获取所有警告"""
        return self.errors + self.warnings + self.infos
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "summary": {
                "total_items": self.total_items,
                "valid_items": self.valid_items,
                "items_with_errors": self.items_with_errors,
                "items_with_warnings": self.items_with_warnings,
                "error_count": len(self.errors),
                "warning_count": len(self.warnings),
                "info_count": len(self.infos),
                "unrecognized_count": len(self.unrecognized_items)
            },
            "unrecognized_items": self.unrecognized_items,
            "validation_details": {
                "errors": [w.to_dict() for w in self.errors],
                "warnings": [w.to_dict() for w in self.warnings],
                "infos": [w.to_dict() for w in self.infos]
            }
        }


class TodoValidator:
    """待办事项校验器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.validation_config = config.get("validation", {})
        self.date_config = config.get("date", {})
        
        # 读取校验规则
        self.required_fields = self.validation_config.get("required_fields", ["content"])
        self.recommended_fields = self.validation_config.get("recommended_fields", ["assignee", "deadline"])
        
        # 日期范围配置
        date_range_config = self.validation_config.get("date_range", {})
        self.date_range_enabled = date_range_config.get("enabled", True)
        self.min_days_past = date_range_config.get("min_days_past", -365)
        self.max_days_future = date_range_config.get("max_days_future", 365)
        
        # 日期格式化器
        self.date_normalizer = DateNormalizer(config)
    
    def validate(self, items: List[NormalizedTodoItem]) -> ValidationResult:
        """
        校验所有待办项
        
        Args:
            items: 归一化后的待办项列表
            
        Returns:
            校验结果
        """
        result = ValidationResult(total_items=len(items))
        
        for item in items:
            item_valid = True
            has_warnings = False
            
            # 执行各项校验
            warnings = self._validate_item(item)
            
            for warning in warnings:
                result.add_warning(warning)
                
                if warning.severity == ValidationSeverity.ERROR:
                    item_valid = False
                if warning.severity in (ValidationSeverity.ERROR, ValidationSeverity.WARNING):
                    has_warnings = True
            
            # 检查是否是无法识别的项（缺少负责人或截止日期）
            if not item.has_assignee or not item.has_deadline:
                reasons = []
                if not item.has_assignee:
                    reasons.append("缺少负责人")
                if not item.has_deadline:
                    reasons.append("缺少截止日期" if item.deadline_str is None else f"截止日期格式无法识别: {item.deadline_str}")
                result.add_unrecognized(item, "；".join(reasons))
            
            if item_valid:
                result.valid_items += 1
            else:
                result.items_with_errors += 1
            
            if has_warnings:
                result.items_with_warnings += 1
        
        logger.info(
            f"校验完成: {result.total_items} 个待办项, "
            f"{result.valid_items} 个有效, "
            f"{result.items_with_errors} 个有错误, "
            f"{len(result.unrecognized_items)} 个无法识别"
        )
        
        return result
    
    def _validate_item(self, item: NormalizedTodoItem) -> List[ValidationWarning]:
        """校验单个待办项"""
        warnings = []
        
        # 校验内容
        content_warnings = self._validate_content(item)
        warnings.extend(content_warnings)
        
        # 校验负责人
        assignee_warnings = self._validate_assignee(item)
        warnings.extend(assignee_warnings)
        
        # 校验截止日期
        deadline_warnings = self._validate_deadline(item)
        warnings.extend(deadline_warnings)
        
        # 校验阻塞项
        blocking_warnings = self._validate_blocking(item)
        warnings.extend(blocking_warnings)
        
        return warnings
    
    def _validate_content(self, item: NormalizedTodoItem) -> List[ValidationWarning]:
        """校验内容"""
        warnings = []
        
        # 检查内容是否为空
        if not item.content or not item.content.strip():
            warnings.append(ValidationWarning(
                item_id=item.id,
                severity=ValidationSeverity.ERROR,
                error_code=ValidationErrorCode.CONTENT_EMPTY,
                message="待办内容为空",
                field="content",
                suggestion="请添加具体的待办事项描述",
                source_file=item.source_file,
                line_number=item.line_number,
                raw_content=item.raw_content
            ))
        
        # 检查内容是否太短
        elif len(item.content.strip()) < 3:
            warnings.append(ValidationWarning(
                item_id=item.id,
                severity=ValidationSeverity.WARNING,
                error_code=ValidationErrorCode.CONTENT_TOO_SHORT,
                message=f"待办内容过短（{len(item.content)} 字符）",
                field="content",
                raw_value=item.content,
                suggestion="建议添加更详细的描述",
                source_file=item.source_file,
                line_number=item.line_number,
                raw_content=item.raw_content
            ))
        
        return warnings
    
    def _validate_assignee(self, item: NormalizedTodoItem) -> List[ValidationWarning]:
        """校验负责人"""
        warnings = []
        
        # 检查是否缺少负责人（建议字段）
        if "assignee" in self.recommended_fields:
            if not item.has_assignee:
                warnings.append(ValidationWarning(
                    item_id=item.id,
                    severity=ValidationSeverity.WARNING,
                    error_code=ValidationErrorCode.ASSIGNEE_MISSING,
                    message="待办项缺少负责人",
                    field="assignee",
                    suggestion="建议添加 @负责人 或使用 '负责人: 姓名' 格式",
                    source_file=item.source_file,
                    line_number=item.line_number,
                    raw_content=item.raw_content
                ))
        
        return warnings
    
    def _validate_deadline(self, item: NormalizedTodoItem) -> List[ValidationWarning]:
        """校验截止日期"""
        warnings = []
        today = date.today()
        
        # 检查是否缺少截止日期（建议字段）
        if "deadline" in self.recommended_fields:
            if not item.has_deadline:
                if item.deadline_str:
                    # 有原始日期字符串但解析失败
                    warnings.append(ValidationWarning(
                        item_id=item.id,
                        severity=ValidationSeverity.WARNING,
                        error_code=ValidationErrorCode.DEADLINE_PARSE_FAILED,
                        message=f"无法识别的日期格式: {item.deadline_str}",
                        field="deadline",
                        raw_value=item.deadline_str,
                        suggestion="建议使用标准日期格式，如：2024-01-15、1月15日、下周一、明天",
                        source_file=item.source_file,
                        line_number=item.line_number,
                        raw_content=item.raw_content
                    ))
                else:
                    # 完全没有日期
                    warnings.append(ValidationWarning(
                        item_id=item.id,
                        severity=ValidationSeverity.WARNING,
                        error_code=ValidationErrorCode.DEADLINE_MISSING,
                        message="待办项缺少截止日期",
                        field="deadline",
                        suggestion="建议添加截止日期，如：截止 2024-01-15 或 下周一完成",
                        source_file=item.source_file,
                        line_number=item.line_number,
                        raw_content=item.raw_content
                    ))
        
        # 检查日期范围（如果已有日期）
        if item.has_deadline and self.date_range_enabled:
            deadline = item.deadline
            
            # 检查是否过期
            if deadline < today:
                warnings.append(ValidationWarning(
                    item_id=item.id,
                    severity=ValidationSeverity.INFO,
                    error_code=ValidationErrorCode.DEADLINE_OVERDUE,
                    message=f"截止日期已过期：{self.date_normalizer.format_date(deadline)}",
                    field="deadline",
                    raw_value=self.date_normalizer.format_date(deadline),
                    source_file=item.source_file,
                    line_number=item.line_number,
                    raw_content=item.raw_content
                ))
            
            # 检查是否太久远（过去）
            min_date = today + timedelta(days=self.min_days_past)
            if deadline < min_date:
                warnings.append(ValidationWarning(
                    item_id=item.id,
                    severity=ValidationSeverity.WARNING,
                    error_code=ValidationErrorCode.DEADLINE_TOO_FAR_PAST,
                    message=f"截止日期过于久远：{self.date_normalizer.format_date(deadline)}",
                    field="deadline",
                    raw_value=self.date_normalizer.format_date(deadline),
                    suggestion=f"建议检查日期是否正确，最早允许：{self.date_normalizer.format_date(min_date)}",
                    source_file=item.source_file,
                    line_number=item.line_number,
                    raw_content=item.raw_content
                ))
            
            # 检查是否太久远（未来）
            max_date = today + timedelta(days=self.max_days_future)
            if deadline > max_date:
                warnings.append(ValidationWarning(
                    item_id=item.id,
                    severity=ValidationSeverity.WARNING,
                    error_code=ValidationErrorCode.DEADLINE_TOO_FAR_FUTURE,
                    message=f"截止日期过于遥远：{self.date_normalizer.format_date(deadline)}",
                    field="deadline",
                    raw_value=self.date_normalizer.format_date(deadline),
                    suggestion=f"建议检查日期是否正确，最晚允许：{self.date_normalizer.format_date(max_date)}",
                    source_file=item.source_file,
                    line_number=item.line_number,
                    raw_content=item.raw_content
                ))
        
        return warnings
    
    def _validate_blocking(self, item: NormalizedTodoItem) -> List[ValidationWarning]:
        """校验阻塞项"""
        warnings = []
        
        # 检查阻塞项是否有效
        for blocking in item.blocking_normalized:
            if len(blocking) < 2:
                warnings.append(ValidationWarning(
                    item_id=item.id,
                    severity=ValidationSeverity.INFO,
                    error_code=ValidationErrorCode.BLOCKING_INVALID,
                    message=f"阻塞项描述可能不完整：{blocking}",
                    field="blocking",
                    raw_value=blocking,
                    suggestion="建议添加更明确的阻塞项描述",
                    source_file=item.source_file,
                    line_number=item.line_number,
                    raw_content=item.raw_content
                ))
        
        return warnings
