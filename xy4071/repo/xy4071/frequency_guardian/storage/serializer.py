"""JSON 序列化器"""

from dataclasses import dataclass, field
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Dict, List, Optional, TypeVar, Union

T = TypeVar("T")


@dataclass
class SerializationResult:
    """序列化操作结果"""

    success: bool = True
    message: str = ""
    errors: List[str] = field(default_factory=list)
    data: Optional[Any] = None

    def add_error(self, error: str) -> None:
        """添加错误"""
        self.errors.append(error)
        self.success = False

    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0


class JsonSerializer:
    """JSON 序列化器"""

    @classmethod
    def serialize(cls, obj: Any) -> Any:
        """
        序列化对象为 JSON 可序列化格式

        Args:
            obj: 任意对象

        Returns:
            JSON 可序列化的数据
        """
        if obj is None:
            return None

        if isinstance(obj, (str, int, float, bool)):
            return obj

        if isinstance(obj, (datetime, date, time)):
            return obj.isoformat()

        if isinstance(obj, Path):
            return str(obj)

        if isinstance(obj, dict):
            return {cls.serialize(k): cls.serialize(v) for k, v in obj.items()}

        if isinstance(obj, list):
            return [cls.serialize(item) for item in obj]

        if hasattr(obj, "__dict__"):
            return cls.serialize(obj.__dict__)

        if hasattr(obj, "model_dump"):
            return cls.serialize(obj.model_dump())

        if hasattr(obj, "dict"):
            return cls.serialize(obj.dict())

        try:
            return str(obj)
        except Exception:
            return None

    @classmethod
    def to_json_dict(cls, obj: Any) -> Dict[str, Any]:
        """
        将对象转换为 JSON 字典

        Args:
            obj: 任意对象

        Returns:
            JSON 字典
        """
        result = cls.serialize(obj)
        if isinstance(result, dict):
            return result
        return {"value": result}

    @classmethod
    def save_to_file(
        cls,
        obj: Any,
        filepath: Path,
        indent: int = 2,
        ensure_ascii: bool = False,
    ) -> SerializationResult:
        """
        保存对象到 JSON 文件

        Args:
            obj: 要保存的对象
            filepath: 文件路径
            indent: 缩进空格数
            ensure_ascii: 是否确保 ASCII

        Returns:
            序列化操作结果
        """
        result = SerializationResult()

        try:
            import json

            data = cls.serialize(obj)

            filepath.parent.mkdir(parents=True, exist_ok=True)

            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(
                    data,
                    f,
                    ensure_ascii=ensure_ascii,
                    indent=indent,
                    default=str,
                )

            result.message = f"数据已保存到: {filepath}"
            result.data = filepath

        except Exception as e:
            result.add_error(f"保存到文件失败: {str(e)}")

        return result

    @classmethod
    def load_from_file(cls, filepath: Path) -> SerializationResult:
        """
        从 JSON 文件加载数据

        Args:
            filepath: 文件路径

        Returns:
            序列化操作结果
        """
        result = SerializationResult()

        try:
            import json

            if not filepath.exists():
                result.add_error(f"文件不存在: {filepath}")
                return result

            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            result.data = data
            result.message = f"成功从 {filepath} 加载数据"

        except Exception as e:
            result.add_error(f"从文件加载失败: {str(e)}")

        return result

    @classmethod
    def to_json_string(
        cls,
        obj: Any,
        indent: int = 2,
        ensure_ascii: bool = False,
    ) -> str:
        """
        将对象转换为 JSON 字符串

        Args:
            obj: 任意对象
            indent: 缩进空格数
            ensure_ascii: 是否确保 ASCII

        Returns:
            JSON 字符串
        """
        import json

        data = cls.serialize(obj)
        return json.dumps(
            data,
            ensure_ascii=ensure_ascii,
            indent=indent,
            default=str,
        )

    @classmethod
    def parse_datetime(cls, value: Optional[Union[str, datetime]]) -> Optional[datetime]:
        """
        解析日期时间

        Args:
            value: 字符串或 datetime 对象

        Returns:
            datetime 对象或 None
        """
        if value is None:
            return None

        if isinstance(value, datetime):
            return value

        try:
            from dateutil.parser import parse

            return parse(value)
        except Exception:
            try:
                return datetime.fromisoformat(value)
            except Exception:
                return None

    @classmethod
    def parse_date(cls, value: Optional[Union[str, date]]) -> Optional[date]:
        """
        解析日期

        Args:
            value: 字符串或 date 对象

        Returns:
            date 对象或 None
        """
        if value is None:
            return None

        if isinstance(value, date):
            return value

        dt = cls.parse_datetime(value)
        if dt:
            return dt.date()
        return None

    @classmethod
    def parse_time(cls, value: Optional[Union[str, time]]) -> Optional[time]:
        """
        解析时间

        Args:
            value: 字符串或 time 对象

        Returns:
            time 对象或 None
        """
        if value is None:
            return None

        if isinstance(value, time):
            return value

        try:
            # 尝试直接解析时间
            from dateutil.parser import parse

            dt = parse(value)
            return dt.time()
        except Exception:
            try:
                return time.fromisoformat(value)
            except Exception:
                return None

    @classmethod
    def safe_get(
        cls,
        data: Dict[str, Any],
        key: str,
        default: Any = None,
    ) -> Any:
        """
        安全获取字典值

        Args:
            data: 字典
            key: 键名
            default: 默认值

        Returns:
            值或默认值
        """
        if not isinstance(data, dict):
            return default

        # 支持嵌套键，如 "a.b.c"
        parts = key.split(".")
        current = data

        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return default

        return current if current is not None else default

    @classmethod
    def merge_dicts(
        cls,
        base: Dict[str, Any],
        override: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        合并两个字典

        Args:
            base: 基础字典
            override: 覆盖字典

        Returns:
            合并后的字典
        """
        result = dict(base)

        for key, value in override.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                result[key] = cls.merge_dicts(result[key], value)
            else:
                result[key] = value

        return result

    @classmethod
    def extract_by_keys(
        cls,
        data: Dict[str, Any],
        keys: List[str],
        default: Any = None,
    ) -> Dict[str, Any]:
        """
        从字典中提取指定的键

        Args:
            data: 源字典
            keys: 要提取的键列表
            default: 默认值

        Returns:
            只包含指定键的字典
        """
        return {key: cls.safe_get(data, key, default) for key in keys}

    @classmethod
    def filter_none_values(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        过滤掉值为 None 的键

        Args:
            data: 源字典

        Returns:
            过滤后的字典
        """
        return {k: v for k, v in data.items() if v is not None}

    @classmethod
    def pretty_print(
        cls,
        obj: Any,
        indent: int = 2,
        ensure_ascii: bool = False,
    ) -> str:
        """
        美化打印对象

        Args:
            obj: 任意对象
            indent: 缩进空格数
            ensure_ascii: 是否确保 ASCII

        Returns:
            美化后的 JSON 字符串
        """
        return cls.to_json_string(obj, indent=indent, ensure_ascii=ensure_ascii)
