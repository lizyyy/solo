from __future__ import annotations

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass

from .models import (
    BottleSample,
    CalculationError,
    ErrorCategory,
    SedimentRecord,
    RecordStatus,
    SuspicionItem,
)
from .bottle_parser import validate_time_consistency


VALID_UNITS = {"kg/m³", "kg/m3", "g/L", "mg/L", "ppm"}
UNIT_CONVERSIONS = {
    "kg/m³": 1.0,
    "kg/m3": 1.0,
    "g/L": 1.0,
    "mg/L": 0.001,
    "ppm": 0.001,
}

SEDIMENT_THRESHOLD_MIN = 0.0
SEDIMENT_THRESHOLD_MAX = 500.0

SEASONAL_FACTORS = {
    1: 1.2, 2: 1.15, 3: 1.05, 4: 0.95, 5: 0.9, 6: 0.85,
    7: 0.8, 8: 0.85, 9: 0.95, 10: 1.05, 11: 1.15, 12: 1.2,
}


@dataclass
class CalculationResult:
    success: bool
    sediment_value: Optional[float]
    sediment_unit: str
    conclusion: Optional[str]
    errors: List[CalculationError]
    suspicions: List[SuspicionItem]
    valid_bottles: List[BottleSample]
    invalid_bottles: List[BottleSample]
    status: RecordStatus
    final_report_ready: bool


def _validate_unit(unit: Optional[str]) -> Tuple[bool, Optional[CalculationError]]:
    if not unit:
        return False, CalculationError(
            category=ErrorCategory.UNIT_ERROR,
            detail="实验结果单位缺失",
            affected_field="experiment_unit",
            suggestion="请补充实验结果的计量单位",
        )
    normalized = unit.strip().lower()
    for valid in VALID_UNITS:
        if normalized == valid.lower():
            return True, None
    return False, CalculationError(
        category=ErrorCategory.UNIT_ERROR,
        detail=f"不支持的实验结果单位: {unit}，支持单位: {', '.join(sorted(VALID_UNITS))}",
        affected_field="experiment_unit",
        suggestion="请将单位转换为支持的标准单位",
    )


def _normalize_to_kg_per_m3(value: float, unit: str) -> float:
    normalized = unit.strip().lower()
    factor = 1.0
    for valid, conv in UNIT_CONVERSIONS.items():
        if normalized == valid.lower():
            factor = conv
            break
    return value * factor


def _validate_threshold(
    value: float, bottle_id: str
) -> List[CalculationError]:
    errors: List[CalculationError] = []
    if value < SEDIMENT_THRESHOLD_MIN:
        errors.append(
            CalculationError(
                category=ErrorCategory.THRESHOLD_ERROR,
                detail=(
                    f"采样瓶{bottle_id}归一化后的含沙量({value:.4f} kg/m³) "
                    f"低于阈值({SEDIMENT_THRESHOLD_MIN})"
                ),
                affected_field="experiment_result",
                suggestion="请核对该采样瓶的实验结果是否存在记录错误",
            )
        )
    if value > SEDIMENT_THRESHOLD_MAX:
        errors.append(
            CalculationError(
                category=ErrorCategory.THRESHOLD_ERROR,
                detail=(
                    f"采样瓶{bottle_id}归一化后的含沙量({value:.2f} kg/m³) "
                    f"超过最大阈值({SEDIMENT_THRESHOLD_MAX})"
                ),
                affected_field="experiment_result",
                suggestion="请核对该采样瓶的实验结果是否存在数量级或单位换算错误",
            )
        )
    return errors


def _get_seasonal_factor(sampling_time) -> float:
    if sampling_time is None:
        return 1.0
    month = sampling_time.month
    return SEASONAL_FACTORS.get(month, 1.0)


def _check_cloud_occlusion(
    bottles: List[BottleSample],
) -> List[SuspicionItem]:
    suspicions: List[SuspicionItem] = []
    for bottle in bottles:
        if bottle.has_cloud_occlusion:
            suspicions.append(
                SuspicionItem(
                    source="遥感数据",
                    content=(
                        f"采样瓶{bottle.bottle_id}对应遥感影像存在云遮挡，"
                        f"详情: {bottle.cloud_occlusion_detail or '未提供具体描述'}"
                    ),
                    reason="遥感云遮挡导致淤积空间判断依据不足，暂不进入最终报告",
                    related_bottle_ids=[bottle.bottle_id],
                )
            )
    return suspicions


def calculate_sediment(
    record: SedimentRecord,
    bottles: Optional[List[BottleSample]] = None,
) -> CalculationResult:
    errors: List[CalculationError] = []
    suspicions: List[SuspicionItem] = []
    valid_bottles: List[BottleSample] = []
    invalid_bottles: List[BottleSample] = []

    target_bottles = bottles if bottles is not None else record.bottles

    if not target_bottles:
        errors.append(
            CalculationError(
                category=ErrorCategory.MISSING_DATA,
                detail="未提供任何采样瓶数据",
                affected_field="bottles",
                suggestion="请至少提供一个有效采样瓶的实验结果",
            )
        )
        return CalculationResult(
            success=False,
            sediment_value=None,
            sediment_unit="kg/m³",
            conclusion=None,
            errors=errors,
            suspicions=[],
            valid_bottles=[],
            invalid_bottles=[],
            status=RecordStatus.PENDING_EVIDENCE,
            final_report_ready=False,
        )

    normalized_values: List[float] = []

    for bottle in target_bottles:
        _, bottle_errors = validate_time_consistency(bottle)
        if bottle_errors:
            errors.extend(bottle_errors)
            invalid_bottles.append(bottle)
            continue

        if bottle.experiment_result is None:
            errors.append(
                CalculationError(
                    category=ErrorCategory.MISSING_DATA,
                    detail=f"采样瓶{bottle.bottle_id}缺失实验结果",
                    affected_field="experiment_result",
                    suggestion="请补充该采样瓶的实验结果数值",
                )
            )
            invalid_bottles.append(bottle)
            continue

        unit_valid, unit_error = _validate_unit(bottle.experiment_unit)
        if not unit_valid and unit_error:
            errors.append(unit_error)
            invalid_bottles.append(bottle)
            continue

        try:
            normalized = _normalize_to_kg_per_m3(
                bottle.experiment_result, bottle.experiment_unit or ""
            )
        except Exception as e:
            errors.append(
                CalculationError(
                    category=ErrorCategory.FORMULA_ERROR,
                    detail=f"采样瓶{bottle.bottle_id}单位换算失败: {str(e)}",
                    affected_field="experiment_result",
                    suggestion="请检查单位换算公式是否正确应用",
                )
            )
            invalid_bottles.append(bottle)
            continue

        threshold_errors = _validate_threshold(normalized, bottle.bottle_id)
        if threshold_errors:
            errors.extend(threshold_errors)
            invalid_bottles.append(bottle)
            continue

        valid_bottles.append(bottle)
        normalized_values.append(normalized)

    cloud_suspicions = _check_cloud_occlusion(target_bottles)
    suspicions.extend(cloud_suspicions)

    def _separate_errors(err_list: List[CalculationError]) -> Tuple[List[CalculationError], List[CalculationError]]:
        missing_errs = [e for e in err_list if e.category == ErrorCategory.MISSING_DATA]
        hard_errs = [e for e in err_list if e.category != ErrorCategory.MISSING_DATA]
        return missing_errs, hard_errs

    missing_errors, hard_errors = _separate_errors(errors)

    if not valid_bottles:
        if hard_errors:
            final_status = RecordStatus.CALCULATION_FAILED
        elif missing_errors:
            final_status = RecordStatus.PENDING_EVIDENCE
        else:
            final_status = RecordStatus.PENDING_EVIDENCE
        return CalculationResult(
            success=False,
            sediment_value=None,
            sediment_unit="kg/m³",
            conclusion=None,
            errors=errors,
            suspicions=suspicions,
            valid_bottles=[],
            invalid_bottles=invalid_bottles,
            status=final_status,
            final_report_ready=False,
        )

    try:
        raw_avg = sum(normalized_values) / len(normalized_values)
        sample_time = valid_bottles[0].sampling_time if valid_bottles else None
        seasonal = _get_seasonal_factor(sample_time)
        sediment_value = round(raw_avg * seasonal, 4)
    except ZeroDivisionError:
        errors.append(
            CalculationError(
                category=ErrorCategory.FORMULA_ERROR,
                detail="淤积量计算公式出现除零错误",
                affected_field="sediment_value",
                suggestion="请检查有效采样瓶数量统计逻辑",
            )
        )
        return CalculationResult(
            success=False,
            sediment_value=None,
            sediment_unit="kg/m³",
            conclusion=None,
            errors=errors,
            suspicions=suspicions,
            valid_bottles=valid_bottles,
            invalid_bottles=invalid_bottles,
            status=RecordStatus.CALCULATION_FAILED,
            final_report_ready=False,
        )
    except Exception as e:
        errors.append(
            CalculationError(
                category=ErrorCategory.FORMULA_ERROR,
                detail=f"淤积量计算异常: {str(e)}",
                affected_field="sediment_value",
                suggestion="请检查淤积量计算公式各参数是否有效",
            )
        )
        return CalculationResult(
            success=False,
            sediment_value=None,
            sediment_unit="kg/m³",
            conclusion=None,
            errors=errors,
            suspicions=suspicions,
            valid_bottles=valid_bottles,
            invalid_bottles=invalid_bottles,
            status=RecordStatus.CALCULATION_FAILED,
            final_report_ready=False,
        )

    if sediment_value < 10.0:
        conclusion = "轻度淤积（淤积量<10 kg/m³）"
    elif sediment_value < 50.0:
        conclusion = "中度淤积（10 kg/m³ ≤ 淤积量 < 50 kg/m³）"
    else:
        conclusion = "重度淤积（淤积量 ≥ 50 kg/m³）"

    has_suspicion = len(suspicions) > 0
    has_hard_error = len(hard_errors) > 0
    has_missing_error = len(missing_errors) > 0
    final_report_ready = not has_suspicion and not has_hard_error and not has_missing_error

    if has_suspicion:
        status = RecordStatus.SUSPENDED
    elif has_hard_error:
        status = RecordStatus.CALCULATION_FAILED
    elif has_missing_error or len(invalid_bottles) > 0 or len(valid_bottles) < len(target_bottles):
        status = RecordStatus.PENDING_EVIDENCE
    else:
        status = RecordStatus.RELEASED

    return CalculationResult(
        success=True,
        sediment_value=sediment_value,
        sediment_unit="kg/m³",
        conclusion=conclusion,
        errors=errors,
        suspicions=suspicions,
        valid_bottles=valid_bottles,
        invalid_bottles=invalid_bottles,
        status=status,
        final_report_ready=final_report_ready,
    )
