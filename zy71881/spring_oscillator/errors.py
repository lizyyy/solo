"""友好错误提示系统。

所有错误信息都经过人性化翻译，避免直接暴露技术术语、
内部字段名或堆栈跟踪给一线同事。
"""

from typing import Optional, List, Dict, Any
import traceback
from pathlib import Path


class SpringOscillatorError(Exception):
    """基础错误类，所有业务错误的基类。

    提供人性化的错误消息、建议操作和上下文信息。
    """

    def __init__(
        self,
        message: str,
        suggestion: str = "",
        context: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None,
    ):
        self.user_message = message
        self.suggestion = suggestion
        self.context = context or {}
        self.original_error = original_error
        self._original_traceback = traceback.format_exc() if original_error else None

        display_message = self._format_display_message()
        super().__init__(display_message)

    def _format_display_message(self) -> str:
        parts = [f"\n{'='*60}"]
        parts.append(f"❌ {self.user_message}")
        if self.suggestion:
            parts.append(f"\n💡 建议：{self.suggestion}")
        if self.context:
            parts.append(f"\n📋 相关信息：")
            for key, value in self.context.items():
                parts.append(f"   • {_translate_field_name(key)}: {value}")
        parts.append(f"{'='*60}\n")
        return "\n".join(parts)

    def get_technical_details(self) -> str:
        """获取技术细节，用于调试，不展示给普通用户。"""
        if self._original_traceback:
            return f"原始错误: {self.original_error}\n{self._original_traceback}"
        return str(self.original_error) if self.original_error else ""


class DataImportError(SpringOscillatorError):
    """数据导入错误。

    当读取文件、解析数据失败时抛出。
    """

    @classmethod
    def file_not_found(cls, file_path: str) -> "DataImportError":
        path = Path(file_path)
        return cls(
            message=f"找不到文件：{path.name}",
            suggestion=f"请检查文件路径是否正确，或者确认文件 '{path.name}' 确实在你说的位置。文件应该放在：{path.parent}",
            context={"文件路径": file_path, "文件名": path.name},
        )

    @classmethod
    def unsupported_format(cls, file_path: str, supported: List[str]) -> "DataImportError":
        path = Path(file_path)
        ext = path.suffix.lower()
        return cls(
            message=f"不支持的文件格式：{ext or '无扩展名'}",
            suggestion=f"目前支持的格式有：{', '.join(supported)}。请把文件另存为这些格式之一再试。",
            context={"当前文件": file_path, "支持格式": supported, "当前扩展名": ext},
        )

    @classmethod
    def missing_columns(cls, file_path: str, missing: List[str], available: List[str]) -> "DataImportError":
        missing_names = [_translate_field_name(col) for col in missing]
        available_names = [_translate_field_name(col) for col in available]
        return cls(
            message=f"文件里缺少必要的列：{', '.join(missing_names)}",
            suggestion=f"请在文件里加上这些列。目前文件里有的列是：{', '.join(available_names)}",
            context={"缺少的列": missing, "现有列": available, "文件": file_path},
        )

    @classmethod
    def invalid_number(cls, file_path: str, column: str, row: int, value: str) -> "DataImportError":
        col_name = _translate_field_name(column)
        return cls(
            message=f"第 {row} 行的「{col_name}」填的不是数字：'{value}'",
            suggestion=f"请检查这个格子，应该填数字。比如质量要写成 0.1 而不是 '100克' 或 '0.1kg'。",
            context={"行号": row, "列名": column, "当前值": value, "文件": file_path},
        )

    @classmethod
    def invalid_date(cls, file_path: str, column: str, row: int, value: str) -> "DataImportError":
        col_name = _translate_field_name(column)
        return cls(
            message=f"第 {row} 行的「{col_name}」日期格式不对：'{value}'",
            suggestion=f"请用常见的日期格式，比如 2024-03-15 或 2024/3/15。",
            context={"行号": row, "列名": column, "当前值": value, "文件": file_path},
        )

    @classmethod
    def empty_file(cls, file_path: str) -> "DataImportError":
        path = Path(file_path)
        return cls(
            message=f"文件 '{path.name}' 是空的，一行数据都没有",
            suggestion="请确认这是正确的数据文件，里面应该有表头和至少一行数据。",
            context={"文件": file_path},
        )

    @classmethod
    def parse_error(cls, file_path: str, row: int, error_msg: str) -> "DataImportError":
        return cls(
            message=f"第 {row} 行数据读不明白：{_translate_error_message(error_msg)}",
            suggestion="请检查这一行的数据是否完整、格式是否正确。",
            context={"行号": row, "原始错误": error_msg, "文件": file_path},
        )


class DataValidationError(SpringOscillatorError):
    """数据验证错误。

    当数据内容不符合物理规律或业务规则时抛出。
    """

    @classmethod
    def negative_mass(cls, record_id: str, mass: float, row: Optional[int] = None) -> "DataValidationError":
        loc = f"第 {row} 行" if row else f"记录 {record_id}"
        return cls(
            message=f"{loc}的质量是负数：{mass} kg",
            suggestion="质量不可能是负数，请检查是不是多打了个负号，或者单位换算错了。",
            context={"质量(kg)": mass, "记录ID": record_id},
        )

    @classmethod
    def negative_period(cls, record_id: str, period: float, row: Optional[int] = None) -> "DataValidationError":
        loc = f"第 {row} 行" if row else f"记录 {record_id}"
        return cls(
            message=f"{loc}的周期是负数：{period} 秒",
            suggestion="时间不可能是负数，请检查是不是多打了个负号。",
            context={"周期(秒)": period, "记录ID": record_id},
        )

    @classmethod
    def mass_too_large(cls, record_id: str, mass: float, max_mass: float, row: Optional[int] = None) -> "DataValidationError":
        loc = f"第 {row} 行" if row else f"记录 {record_id}"
        return cls(
            message=f"{loc}的质量 {mass} kg 太大了，超过了弹簧量程 {max_mass} kg",
            suggestion=f"请检查质量单位是不是搞错了（应该是千克不是克），或者这个数据确实超出了弹簧的弹性范围。",
            context={"质量(kg)": mass, "最大允许(kg)": max_mass, "记录ID": record_id},
        )

    @classmethod
    def period_out_of_range(cls, record_id: str, period: float, min_period: float, max_period: float, row: Optional[int] = None) -> "DataValidationError":
        loc = f"第 {row} 行" if row else f"记录 {record_id}"
        return cls(
            message=f"{loc}的周期 {period} 秒不太合理，应该在 {min_period} 到 {max_period} 秒之间",
            suggestion=f"请检查是不是把半周期当成了全周期，或者计时单位搞错了。这个实验的周期一般在1-3秒左右。",
            context={"周期(秒)": period, "合理范围(秒)": f"{min_period}-{max_period}", "记录ID": record_id},
        )

    @classmethod
    def zero_drift_detected(cls, drift_mm: float, threshold: float) -> "DataValidationError":
        return cls(
            message=f"检测到零点漂移：{drift_mm:.2f} mm，超过了允许的 {threshold} mm",
            suggestion="请检查弹簧下端的指针在空载时是否对准了标尺零点。如果确实有漂移，可以在数据里加上基准偏移量。",
            context={"漂移量(mm)": drift_mm, "允许阈值(mm)": threshold},
        )

    @classmethod
    def insufficient_data(cls, count: int, min_required: int) -> "DataValidationError":
        return cls(
            message=f"可用的数据点太少：只有 {count} 个，至少需要 {min_required} 个才能拟合",
            suggestion="请补充更多不同质量下的周期测量数据，每个质量点至少要有一次测量。",
            context={"当前数据点": count, "最少需要": min_required},
        )

    @classmethod
    def duplicate_records(cls, duplicate_info: List[Dict[str, Any]]) -> "DataValidationError":
        samples = duplicate_info[:3]
        sample_desc = "; ".join([f"质量{x['mass']}kg有{x['count']}条" for x in samples])
        return cls(
            message=f"发现 {len(duplicate_info)} 组重复数据，比如 {sample_desc}",
            suggestion="重复数据会影响拟合结果。系统会自动保留最新的一条，你也可以手动删除不需要的重复项。",
            context={"重复组数": len(duplicate_info), "重复详情": duplicate_info},
        )

    @classmethod
    def amplitude_too_large(cls, record_id: str, amplitude: float, max_amplitude: float, row: Optional[int] = None) -> "DataValidationError":
        loc = f"第 {row} 行" if row else f"记录 {record_id}"
        return cls(
            message=f"{loc}的振幅 {amplitude} cm 太大了，超过了建议的 {max_amplitude} cm",
            suggestion="振幅太大会引入阻尼效应和非线性误差。实验要求振幅控制在2cm以内，这样拟合结果才准确。",
            context={"振幅(cm)": amplitude, "建议最大值(cm)": max_amplitude, "记录ID": record_id},
        )


class FittingError(SpringOscillatorError):
    """拟合过程错误。"""

    @classmethod
    def fit_failed(cls, reason: str) -> "FittingError":
        translated = _translate_error_message(reason)
        return cls(
            message=f"曲线拟合失败：{translated}",
            suggestion="请检查数据是否大致符合周期-质量的平方根关系，或者数据点是不是太少、太分散。",
            context={"原始原因": reason},
        )

    @classmethod
    def poor_fit_quality(cls, r_squared: float, threshold: float) -> "FittingError":
        return cls(
            message=f"拟合效果不太好，R² = {r_squared:.4f}，建议至少要达到 {threshold}",
            suggestion="请检查：1) 数据点是不是太少或太分散；2) 有没有明显偏离趋势的异常点；3) 振幅是不是太大引入了非线性。",
            context={"R平方": r_squared, "建议阈值": threshold},
        )


_FIELD_NAME_TRANSLATIONS = {
    "mass_kg": "质量(kg)",
    "period_s": "周期(秒)",
    "amplitude_cm": "振幅(cm)",
    "spring_extension_mm": "弹簧伸长量(mm)",
    "student_id": "学号",
    "student_name": "姓名",
    "experiment_date": "实验日期",
    "mass": "质量",
    "period": "周期",
    "amplitude": "振幅",
    "extension": "伸长量",
    "spring_id": "弹簧编号",
    "nominal_mass_kg": "标称质量(kg)",
    "actual_mass_kg": "实际质量(kg)",
    "spring_constant_nm": "弹簧劲度系数(N/m)",
    "calibration_date": "标定日期",
}


def _translate_field_name(field_name: str) -> str:
    """将内部字段名翻译成用户易懂的中文名称。"""
    return _FIELD_NAME_TRANSLATIONS.get(field_name, field_name)


def _translate_error_message(error_msg: str) -> str:
    """将技术错误消息翻译成人性化语言。"""
    translations = {
        "could not convert string to float": "无法把文字转换成数字",
        "invalid literal for int": "无法把文字转换成整数",
        "time data": "日期格式不对",
        "does not match format": "不符合格式要求",
        "Optimal parameters not found": "找不到最优参数",
        "Number of calls to function has reached maxfev": "计算次数用完了还没找到合适的参数",
        "array must not contain infs or NaNs": "数据里有缺失值或无效值",
    }
    for tech, human in translations.items():
        if tech in error_msg:
            return human
    return error_msg


def wrap_technical_error(
    func=None,
    *,
    error_class=SpringOscillatorError,
    default_message: str = "操作失败了",
    default_suggestion: str = "请检查输入数据是否正确，或者重试一次。",
):
    """装饰器，将技术异常包装成友好的业务错误。

    支持两种调用方式：
        @wrap_technical_error
        def func(): ...

        @wrap_technical_error(error_class=DataImportError, default_message="导入失败")
        def func(): ...
    """
    def decorator(f):
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except SpringOscillatorError:
                raise
            except Exception as e:
                error_msg = str(e)
                human_msg = _translate_error_message(error_msg)
                if human_msg == error_msg:
                    human_msg = default_message
                raise error_class(
                    message=human_msg,
                    suggestion=default_suggestion,
                    original_error=e,
                ) from e
        wrapper.__name__ = f.__name__
        wrapper.__doc__ = f.__doc__
        return wrapper

    if func is not None:
        return decorator(func)
    return decorator
