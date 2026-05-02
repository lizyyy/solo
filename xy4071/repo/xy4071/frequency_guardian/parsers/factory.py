"""解析器工厂"""

from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional, Type, Union

from .base import BaseCSVParser, ParseResult
from .frequency_parser import FrequencyPlanParser
from .log_parser import ContactLogParser
from .radio_parser import RadioInventoryParser
from .schedule_parser import DutyScheduleParser


class ParserType(str, Enum):
    """解析器类型枚举"""

    RADIO = "radio"
    FREQUENCY_CHANNELS = "frequency_channels"
    FREQUENCY_ASSIGNMENTS = "frequency_assignments"
    SCHEDULE = "schedule"
    LOG = "log"


class ParserFactory:
    """解析器工厂类"""

    _parsers: Dict[ParserType, Type[BaseCSVParser]] = {
        ParserType.RADIO: RadioInventoryParser,
        ParserType.FREQUENCY_CHANNELS: FrequencyPlanParser,
        ParserType.FREQUENCY_ASSIGNMENTS: FrequencyPlanParser,
        ParserType.SCHEDULE: DutyScheduleParser,
        ParserType.LOG: ContactLogParser,
    }

    @classmethod
    def get_parser(
        cls,
        parser_type: Union[ParserType, str],
        **kwargs,
    ) -> BaseCSVParser:
        """
        获取解析器实例

        Args:
            parser_type: 解析器类型
            **kwargs: 传递给解析器的参数

        Returns:
            解析器实例
        """
        if isinstance(parser_type, str):
            try:
                parser_type = ParserType(parser_type.lower())
            except ValueError:
                raise ValueError(f"不支持的解析器类型: {parser_type}")

        parser_class = cls._parsers.get(parser_type)
        if not parser_class:
            raise ValueError(f"未找到解析器类型: {parser_type}")

        # 特殊处理频率解析器
        if parser_type == ParserType.FREQUENCY_CHANNELS:
            kwargs["parse_type"] = "channels"
        elif parser_type == ParserType.FREQUENCY_ASSIGNMENTS:
            kwargs["parse_type"] = "assignments"

        return parser_class(**kwargs)

    @classmethod
    def guess_parser_type(
        cls,
        file_path: Union[str, Path],
        content_hint: Optional[str] = None,
    ) -> Optional[ParserType]:
        """
        根据文件名和内容猜测解析器类型

        Args:
            file_path: 文件路径
            content_hint: 内容提示（如表头）

        Returns:
            猜测的解析器类型，如果无法猜测则返回None
        """
        file_path = Path(file_path)
        filename = file_path.name.lower()

        # 根据文件名猜测
        if any(kw in filename for kw in ["radio", "设备", "电台", "inventory"]):
            if "assign" in filename or "分配" in filename:
                return ParserType.FREQUENCY_ASSIGNMENTS
            return ParserType.RADIO

        if any(kw in filename for kw in ["frequency", "频率", "channel", "频道"]):
            if "assign" in filename or "分配" in filename:
                return ParserType.FREQUENCY_ASSIGNMENTS
            return ParserType.FREQUENCY_CHANNELS

        if any(kw in filename for kw in ["schedule", "排班", "duty", "值守", "shift", "班次"]):
            return ParserType.SCHEDULE

        if any(kw in filename for kw in ["log", "日志", "contact", "通联", "qso"]):
            return ParserType.LOG

        # 根据内容猜测
        if content_hint:
            content_lower = content_hint.lower()
            if any(kw in content_lower for kw in ["呼号", "设备id", "call_sign", "device_id"]):
                if "shift_id" in content_lower or "班次" in content_lower:
                    return ParserType.SCHEDULE
                if "time_start" in content_lower or "开始时间" in content_lower:
                    if "call_sign_other" in content_lower or "对方呼号" in content_lower:
                        return ParserType.LOG
                return ParserType.RADIO
            if "frequency" in content_lower or "频率" in content_lower:
                if "assignment_id" in content_lower or "分配id" in content_lower:
                    return ParserType.FREQUENCY_ASSIGNMENTS
                return ParserType.FREQUENCY_CHANNELS

        return None

    @classmethod
    def parse_file_by_type(
        cls,
        parser_type: Union[ParserType, str],
        file_path: Union[str, Path],
        **kwargs,
    ) -> ParseResult[Any]:
        """
        使用指定类型的解析器解析文件

        Args:
            parser_type: 解析器类型
            file_path: 文件路径
            **kwargs: 传递给解析器的参数

        Returns:
            解析结果
        """
        parser = cls.get_parser(parser_type, **kwargs)
        return parser.parse_file(file_path)

    @classmethod
    def parse_file_auto(
        cls,
        file_path: Union[str, Path],
        **kwargs,
    ) -> ParseResult[Any]:
        """
        自动猜测解析器类型并解析文件

        Args:
            file_path: 文件路径
            **kwargs: 传递给解析器的参数

        Returns:
            解析结果
        """
        # 先尝试根据文件名猜测
        guessed_type = cls.guess_parser_type(file_path)

        if guessed_type:
            try:
                return cls.parse_file_by_type(guessed_type, file_path, **kwargs)
            except Exception:
                pass

        # 如果猜测失败，尝试所有解析器
        errors = []
        for parser_type in ParserType:
            try:
                result = cls.parse_file_by_type(parser_type, file_path, **kwargs)
                # 如果成功解析了至少一条记录，返回该结果
                if result.valid_lines > 0 or not result.has_errors():
                    return result
            except Exception as e:
                errors.append(f"{parser_type}: {e}")

        # 所有尝试都失败了，返回默认类型（尝试使用LOG类型解析）
        from .base import ParseResult, ParseError

        result = ParseResult()
        result.add_error(ParseError(
            line_number=0,
            field_name=None,
            error_type="parser_detection_failed",
            message=f"无法自动检测文件类型，尝试的解析器均失败: {'; '.join(errors)}",
        ))
        return result

    @classmethod
    def list_available_parsers(cls) -> Dict[str, str]:
        """
        列出所有可用的解析器

        Returns:
            解析器类型到描述的映射
        """
        descriptions = {
            ParserType.RADIO: "电台设备清单解析器 - 解析设备ID、呼号、型号、功率等信息",
            ParserType.FREQUENCY_CHANNELS: "频率频道解析器 - 解析频道ID、频率、带宽、调制模式等信息",
            ParserType.FREQUENCY_ASSIGNMENTS: "频率分配解析器 - 解析频率分配给指定呼号的时间段",
            ParserType.SCHEDULE: "值守排班解析器 - 解析班次、呼号、频道、时间等排班信息",
            ParserType.LOG: "通联日志解析器 - 解析通联日期、时间、呼号、频率、信号报告等",
        }
        return {k.value: descriptions[k] for k in ParserType}
