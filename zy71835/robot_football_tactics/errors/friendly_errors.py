from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, TypeVar, Generic
from contextlib import contextmanager
import traceback
import sys


T = TypeVar('T')


@dataclass
class FriendlyError(Exception):
    """友好错误基类，所有人话错误都应该继承这个类"""

    message: str  # 人话错误信息
    suggestion: str = ""  # 人话修改建议
    field_path: str = ""  # 内部字段路径，用于技术排查（但不直接展示给用户）
    raw_value: Any = None  # 原始值，用于技术排查
    context: Dict[str, Any] = field(default_factory=dict)  # 上下文信息
    severity: str = "error"  # error / warning / info
    original_error: Optional[Exception] = None  # 原始异常，用于技术排查

    def __post_init__(self):
        super().__init__(self.message)

    def to_human_string(self) -> str:
        """转换成用户友好的字符串"""
        lines = [f"❌ {self.message}"]

        if self.suggestion:
            lines.append(f"💡 建议：{self.suggestion}")

        if self.context:
            context_str = "、".join(f"{k}={v}" for k, v in self.context.items() if v is not None)
            if context_str:
                lines.append(f"📋 相关信息：{context_str}")

        return "\n".join(lines)

    def to_tech_string(self) -> str:
        """转换成技术排查用的字符串"""
        lines = [f"[{self.severity.upper()}] {self.message}"]
        if self.field_path:
            lines.append(f"  字段路径：{self.field_path}")
        if self.raw_value is not None:
            lines.append(f"  原始值：{repr(self.raw_value)}")
        if self.original_error:
            lines.append(f"  原始异常：{type(self.original_error).__name__}: {str(self.original_error)}")
        return "\n".join(lines)

    def __str__(self) -> str:
        """默认展示人话版本"""
        return self.to_human_string()


@dataclass
class ParseError(FriendlyError):
    """解析错误"""
    pass


@dataclass
class ValidationError(FriendlyError):
    """校验错误"""
    pass


@dataclass
class ComparisonMismatch(FriendlyError):
    """比对不一致"""
    pass


@dataclass
class VersionConflict(FriendlyError):
    """版本冲突"""
    pass


@contextmanager
def error_context(context_name: str, **context_kwargs):
    """
    错误上下文管理器，用于给异常添加上下文信息
    用法：
        with error_context("解析单位表", unit_id="U001"):
            do_something()
    """
    try:
        yield
    except FriendlyError as e:
        e.context[context_name] = context_kwargs or True
        raise
    except Exception as e:
        friendly = FriendlyError(
            message=f"{context_name}时发生未知错误",
            suggestion="请联系技术同学排查，或检查输入内容是否符合预期",
            context=context_kwargs,
            original_error=e
        )
        raise friendly from e


class FieldTranslator:
    """字段翻译器，把内部字段名翻译成用户能理解的人话"""

    def __init__(self):
        self._translations: Dict[str, str] = {}
        self._reverse_translations: Dict[str, str] = {}

    def register(self, internal_name: str, human_name: str, synonyms: List[str] = None):
        """注册一个字段的翻译"""
        self._translations[internal_name] = human_name
        self._reverse_translations[human_name] = internal_name
        if synonyms:
            for syn in synonyms:
                self._reverse_translations[syn] = internal_name

    def to_human(self, internal_path: str) -> str:
        """把内部字段路径翻译成人话"""
        parts = internal_path.split(".")
        translated_parts = []

        for part in parts:
            if part in self._translations:
                translated_parts.append(self._translations[part])
            else:
                match = part
                for human, internal in self._reverse_translations.items():
                    if part.lower() == internal.lower():
                        match = human
                        break
                translated_parts.append(match)

        return " -> ".join(translated_parts)

    def to_internal(self, human_name: str) -> str:
        """把人话翻译成内部字段名"""
        return self._reverse_translations.get(human_name, human_name)


_global_translator = FieldTranslator()


def register_translation(internal_name: str, human_name: str, synonyms: List[str] = None):
    """全局注册字段翻译"""
    _global_translator.register(internal_name, human_name, synonyms)


def translate_field(internal_path: str) -> str:
    """全局翻译字段"""
    return _global_translator.to_human(internal_path)


register_translation("unit_id", "单位编号", ["id", "uid"])
register_translation("unit_name", "单位名称", ["name"])
register_translation("unit_type", "单位类型", ["type"])
register_translation("hp", "生命值", ["血量", "体力"])
register_translation("atk", "攻击力", ["攻击"])
register_translation("def", "防御力", ["防御"])
register_translation("spd", "速度", ["移动速度"])
register_translation("terrain_name", "地形名称")
register_translation("terrain_type", "地形类型")
register_translation("effect_name", "效果名称")
register_translation("modifier", "修正值", ["数值", "值"])
register_translation("target_attr", "影响属性", ["属性"])
register_translation("event_type", "事件类型")
register_translation("actor_unit_id", "执行者", ["行为人", "主动方"])
register_translation("target_unit_id", "目标", ["被动方"])
register_translation("result", "结果", ["结算"])
register_translation("final_score", "最终比分", ["比分"])
register_translation("mvp_unit_id", "MVP", ["最有价值球员"])
register_translation("value", "结算值", ["结果值"])
register_translation("expected_value", "期望值", ["预期值"])


def create_validation_error(
    field_path: str,
    raw_value: Any,
    issue: str,
    suggestion: str = "",
    **context
) -> ValidationError:
    """
    快速创建一个校验错误
    自动把内部字段名翻译成人话
    """
    human_field = translate_field(field_path)

    return ValidationError(
        message=f"{human_field}{issue}（当前值：{raw_value}）",
        suggestion=suggestion,
        field_path=field_path,
        raw_value=raw_value,
        context=context,
        severity="error"
    )


def create_mismatch_error(
    field_path: str,
    report_value: Any,
    settlement_value: Any,
    issue: str,
    suggestion: str = "",
    **context
) -> ComparisonMismatch:
    """快速创建一个比对不一致错误"""
    human_field = translate_field(field_path)

    return ComparisonMismatch(
        message=f"{human_field}{issue}：战报是 {report_value}，但结算是 {settlement_value}",
        suggestion=suggestion,
        field_path=field_path,
        raw_value={"report": report_value, "settlement": settlement_value},
        context=context,
        severity="error"
    )


class ErrorCollector:
    """错误收集器，用于一次性收集多个错误而不是遇到第一个就停止"""

    def __init__(self, stop_on_first_error: bool = False):
        self.errors: List[FriendlyError] = []
        self.warnings: List[FriendlyError] = []
        self.stop_on_first_error = stop_on_first_error

    def add_error(self, error: FriendlyError):
        self.errors.append(error)
        if self.stop_on_first_error:
            self.raise_if_errors()

    def add_warning(self, warning: FriendlyError):
        warning.severity = "warning"
        self.warnings.append(warning)

    def raise_if_errors(self):
        """如果有错误就抛出第一个错误"""
        if self.errors:
            if len(self.errors) == 1:
                raise self.errors[0]
            else:
                raise AggregatedError(self.errors, self.warnings)

    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def has_warnings(self) -> bool:
        return len(self.warnings) > 0

    def to_report(self) -> str:
        """生成错误报告"""
        lines = []

        if self.errors:
            lines.append(f"❌ 发现 {len(self.errors)} 个错误：")
            for i, err in enumerate(self.errors, 1):
                lines.append(f"\n{i}. {err.to_human_string()}")

        if self.warnings:
            lines.append(f"\n⚠️  发现 {len(self.warnings)} 个警告：")
            for i, warn in enumerate(self.warnings, 1):
                lines.append(f"\n{i}. {warn.to_human_string()}")

        return "\n".join(lines)


@dataclass
class AggregatedError(FriendlyError):
    """聚合多个错误"""
    all_errors: List[FriendlyError] = field(default_factory=list)
    all_warnings: List[FriendlyError] = field(default_factory=list)

    def __init__(self, errors: List[FriendlyError], warnings: List[FriendlyError] = None):
        self.all_errors = errors
        self.all_warnings = warnings or []
        super().__init__(
            message=f"发现 {len(errors)} 个错误，{len(self.all_warnings)} 个警告",
            suggestion="请查看下方详细错误列表逐一修正",
            severity="error"
        )

    def to_human_string(self) -> str:
        lines = [f"❌ {self.message}"]
        if self.suggestion:
            lines.append(f"💡 {self.suggestion}")
        lines.append("")

        for i, err in enumerate(self.all_errors, 1):
            lines.append(f"【错误 {i}】{err.to_human_string()}")
            lines.append("")

        for i, warn in enumerate(self.all_warnings, 1):
            lines.append(f"【警告 {i}】{warn.to_human_string()}")
            lines.append("")

        return "\n".join(lines)
