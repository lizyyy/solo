from typing import Optional, Tuple, Dict
from dataclasses import dataclass

from app.models import RecordStatus


UNIT_CONVERSION = {
    "cm": 1.0,
    "m": 100.0,
    "mm": 0.1,
    "厘米": 1.0,
    "米": 100.0,
    "毫米": 0.1,
}


THRESHOLDS = {
    "normal_max": 50.0,
    "warning_min": 50.0,
    "warning_max": 150.0,
    "danger_min": 150.0,
}


FORMULA_VERSION = "v2.1"


@dataclass
class CalculationResult:
    status: RecordStatus
    siltation_cm: Optional[float] = None
    fail_stage: Optional[str] = None
    fail_reason: Optional[str] = None
    judgment: Optional[str] = None


def validate_formula(value: Optional[float]) -> Tuple[bool, Optional[str]]:
    if value is None:
        return False, "淤积原始值为空，无法套用公式"
    if not isinstance(value, (int, float)):
        return False, f"淤积原始值类型错误: {type(value)}，应为数值型"
    return True, None


def validate_and_convert_unit(raw_value: Optional[float], raw_unit: Optional[str]) -> Tuple[bool, Optional[float], Optional[str]]:
    if raw_unit is None:
        return False, None, "单位为空，无法进行换算"

    unit_key = str(raw_unit).strip().lower()
    if unit_key not in UNIT_CONVERSION:
        return False, None, f"未知单位: {raw_unit}，支持单位: {list(UNIT_CONVERSION.keys())}"

    if raw_value is None:
        return False, None, "原始值为空，无法进行单位换算"

    try:
        converted = float(raw_value) * UNIT_CONVERSION[unit_key]
        return True, converted, None
    except (ValueError, TypeError) as e:
        return False, None, f"单位换算失败: {str(e)}"


def validate_threshold(value_cm: float) -> Tuple[bool, Optional[str], Optional[str]]:
    if value_cm < 0:
        return False, f"淤积量为负值: {value_cm} cm，超出阈值合理范围", None

    judgment = None
    if value_cm < THRESHOLDS["warning_min"]:
        judgment = "正常"
    elif value_cm < THRESHOLDS["danger_min"]:
        judgment = "预警"
    else:
        judgment = "危险"

    return True, None, judgment


def calculate_siltation(raw_value: Optional[float], raw_unit: Optional[str]) -> CalculationResult:
    ok, err = validate_formula(raw_value)
    if not ok:
        return CalculationResult(
            status=RecordStatus.FAILED_FORMULA,
            fail_stage="formula",
            fail_reason=err,
        )

    ok, converted, err = validate_and_convert_unit(raw_value, raw_unit)
    if not ok:
        return CalculationResult(
            status=RecordStatus.FAILED_UNIT,
            fail_stage="unit",
            fail_reason=err,
        )

    ok, err, judgment = validate_threshold(converted)
    if not ok:
        return CalculationResult(
            status=RecordStatus.FAILED_THRESHOLD,
            fail_stage="threshold",
            fail_reason=err,
            siltation_cm=converted,
        )

    return CalculationResult(
        status=RecordStatus.SUCCESS,
        siltation_cm=converted,
        judgment=judgment,
    )


def get_fail_stage_description(stage: str) -> str:
    descriptions = {
        "formula": "卡在【公式】阶段：原始值缺失或类型错误，无法进入公式计算",
        "unit": "卡在【单位】阶段：单位不识别或换算失败，请检查单位写法是否在支持列表中",
        "threshold": "卡在【阈值】阶段：换算完成但数值超出合理阈值范围，请核查原始数据",
    }
    return descriptions.get(stage, f"卡在未知阶段: {stage}")
