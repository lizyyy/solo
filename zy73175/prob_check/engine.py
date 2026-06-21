from typing import List, Optional, Dict, Any
from .models import (
    VerificationRecord,
    RecordStatus,
    SuspensionReason,
    BoundaryInfo,
)
from .unit_converter import convert_unit
from .boundary_checker import check_boundary


class VerificationEngine:
    def __init__(self, tolerance: float = 0.05):
        self.default_tolerance = tolerance

    def verify_record(self, record: VerificationRecord) -> Dict[str, Any]:
        result = {
            "record_id": record.id,
            "student": record.student_name,
            "status": None,
            "message": "",
            "unit_issue": None,
            "boundary_issue": None,
        }

        status_val = record.status.value if isinstance(record.status, RecordStatus) else record.status
        if status_val == RecordStatus.CONFIRMED.value:
            result["status"] = RecordStatus.CONFIRMED.value
            override_from_history = None
            original_calc = None
            for h in record.history:
                if h.field_changed == "actual_result":
                    override_from_history = h.new_value
                    original_calc = h.old_value
                    break
            reason_note = record.confirmation_note or ""
            who = record.confirmed_by or ""
            when = record.confirmed_at or ""
            if override_from_history is not None and original_calc is not None:
                result["message"] = (
                    f"人工确认已生效，跳过原始输入重算：原始验算 {original_calc}{record.target_unit} "
                    f"→ 人工口径 {override_from_history}{record.target_unit}"
                    f"（{who} @ {when}，原因: {reason_note}）"
                )
            else:
                result["message"] = f"人工确认已生效，跳过原始输入重算（{who} @ {when}，原因: {reason_note}）"
            return result

        tolerance = record.tolerance if hasattr(record, 'tolerance') else self.default_tolerance

        converted, ok, unit_msg = convert_unit(
            record.input_value,
            record.input_unit,
            record.target_unit,
        )

        if not ok:
            record.suspend(SuspensionReason.UNIT_INCONSISTENT, None)
            record.add_attachment("验算备注", f"单位换算失败: {unit_msg}")
            result["status"] = RecordStatus.SUSPENDED.value
            result["message"] = f"单位换算异常: {unit_msg}"
            result["unit_issue"] = unit_msg
            return result

        record.actual_result = converted

        boundary = self._check_result_boundary(record, converted)
        if boundary is not None:
            record.suspend(SuspensionReason.EXTRAPOLATION_BOUNDARY, boundary)
            record.add_attachment(
                "验算备注",
                f"外推越界: {boundary.variable}={boundary.current_value}, "
                f"合理区间[{boundary.lower_bound}, {boundary.upper_bound}], "
                f"{boundary.direction}",
            )
            result["status"] = RecordStatus.SUSPENDED.value
            result["boundary_issue"] = boundary.to_dict()
            result["message"] = (
                f"外推越界卡壳在【{boundary.variable}】，"
                f"当前值 {boundary.current_value}，"
                f"正常区间 [{boundary.lower_bound}, {boundary.upper_bound}]，"
                f"方向：{boundary.direction}。请排班同事确认后再放行。"
            )
            return result

        diff = abs(converted - record.expected_result)
        within_tolerance = diff <= max(abs(record.expected_result) * tolerance, 1e-9)

        if within_tolerance:
            record.status = RecordStatus.VERIFIED
            record.last_updated = record.last_updated
            result["status"] = RecordStatus.VERIFIED.value
            result["message"] = (
                f"验算通过: {record.input_value}{record.input_unit} "
                f"-> {converted}{record.target_unit}, "
                f"与期望值 {record.expected_result}{record.target_unit} 偏差 {round(diff, 6)} 在容差内。"
            )
        else:
            record.status = RecordStatus.REJECTED
            record.add_attachment(
                "验算备注",
                f"数值偏差: 实际 {converted}, 期望 {record.expected_result}, "
                f"差值 {round(diff, 6)}, 容差 {tolerance*100}%",
            )
            result["status"] = RecordStatus.REJECTED.value
            result["message"] = (
                f"验算不通过: 换算结果 {converted}{record.target_unit}, "
                f"与期望 {record.expected_result}{record.target_unit} 差 {round(diff, 6)}, 超容差。"
            )

        return result

    def _check_result_boundary(self, record: VerificationRecord, value: float) -> Optional[BoundaryInfo]:
        unit_to_key = {
            "摄氏度": "temperature_c",
            "华氏度": None,
            "开尔文": None,
            "%": "percentage",
        }
        target = record.target_unit
        if target in unit_to_key and unit_to_key[target]:
            return check_boundary(unit_to_key[target], value)
        if target.endswith("概率") or target == "概率":
            return check_boundary("probability", value)
        return None

    def batch_verify(self, records: List[VerificationRecord]) -> List[Dict[str, Any]]:
        results = []
        for rec in records:
            results.append(self.verify_record(rec))
        return results
