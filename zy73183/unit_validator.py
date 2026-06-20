from typing import Optional, Tuple

from config import EXPECTED_UNITS, UNIT_CONVERSION, STANDARD_UNIT, RELEASE_CRITERIA
from models import RawRecord, ValidatedRecord, RecordStatus


def _infer_dimension(record: RawRecord) -> Optional[str]:
    if record.dimension:
        return record.dimension
    metric = record.metric_name or ""
    for dim in EXPECTED_UNITS:
        if dim in metric:
            return dim
    keyword_map = {
        "距离": ["里程", "路程", "距离", "运输距离"],
        "时间": ["工时", "时长", "时间", "耗时", "小时", "分钟"],
        "重量": ["重量", "载重", "吨数", "重量"],
        "金额": ["费用", "成本", "金额", "预算", "支出"],
        "数量": ["数量", "台数", "件数", "个数"],
        "百分比": ["占比", "比率", "率", "百分比"],
    }
    for dim, keywords in keyword_map.items():
        for kw in keywords:
            if kw in metric:
                return dim
    return None


def _validate_unit_consistency(record: RawRecord, dimension: Optional[str]) -> Tuple[bool, str]:
    if not record.unit:
        return False, "单位缺失"
    if not dimension:
        return True, "无法推断维度，跳过一致性校验"
    valid_units = EXPECTED_UNITS.get(dimension, [])
    if record.unit in valid_units:
        return True, ""
    return False, f"单位'{record.unit}'与维度'{dimension}'不匹配，期望单位: {valid_units}"


def _convert_to_standard(value: float, unit: str, dimension: Optional[str]) -> Tuple[Optional[float], Optional[str], str]:
    if not dimension:
        return None, None, "无法推断维度，未执行单位换算"
    std_unit = STANDARD_UNIT.get(dimension)
    if not std_unit:
        return None, None, f"维度'{dimension}'未定义标准单位"
    if unit == std_unit:
        return value, std_unit, ""
    key = (unit, std_unit)
    rate = UNIT_CONVERSION.get(key)
    if rate is None:
        return None, None, f"缺少从'{unit}'到'{std_unit}'的换算系数"
    return value * rate, std_unit, ""


def _evaluate_release(record: RawRecord, status: RecordStatus, issues: list, dimension: Optional[str]) -> Tuple[bool, list]:
    need_supplement = []
    can_release = True

    if RELEASE_CRITERIA.get("must_have_units") and not record.unit:
        can_release = False
        need_supplement.append("补充单位")

    if RELEASE_CRITERIA.get("must_have_category_match") and not dimension:
        can_release = False
        need_supplement.append("明确指标维度（距离/时间/金额等）")

    if status == RecordStatus.UNIT_INCONSISTENT:
        can_release = False
        need_supplement.append("修正单位或确认维度")

    if status == RecordStatus.PENDING_REVIEW:
        can_release = False
        need_supplement.append("人工复核后处理")

    if record.is_late:
        if RELEASE_CRITERIA.get("must_not_be_late"):
            can_release = False
            need_supplement.append("晚到附件，建议补充提交说明")
        else:
            need_supplement.append("晚到附件，需确认不影响汇总口径")

    if record.supplementary_note:
        need_supplement.append("含后补说明，建议复核内容一致性")

    return can_release, need_supplement


def validate_record(record: RawRecord) -> ValidatedRecord:
    issues = []
    dimension = _infer_dimension(record)
    unit_ok, unit_msg = _validate_unit_consistency(record, dimension)

    if not record.unit:
        status = RecordStatus.UNIT_MISSING
        if unit_msg:
            issues.append(unit_msg)
    elif not unit_ok:
        status = RecordStatus.UNIT_INCONSISTENT
        if unit_msg:
            issues.append(unit_msg)
    elif record.is_late:
        status = RecordStatus.LATE_ARRIVAL
    elif record.supplementary_note:
        status = RecordStatus.SUPPLEMENTARY
    else:
        status = RecordStatus.NORMAL

    std_value = None
    std_unit = None
    if status not in (RecordStatus.UNIT_MISSING, RecordStatus.UNIT_INCONSISTENT):
        std_value, std_unit, conv_msg = _convert_to_standard(
            record.value, record.unit, dimension
        )
        if conv_msg:
            issues.append(conv_msg)
            if std_value is None and status == RecordStatus.NORMAL:
                status = RecordStatus.PENDING_REVIEW

    can_release, need_supplement = _evaluate_release(record, status, issues, dimension)

    release_reason = None
    if can_release:
        release_reason = "校验通过，可纳入统计口径"
    elif need_supplement:
        release_reason = f"需补充: {'；'.join(need_supplement)}"

    return ValidatedRecord(
        raw=record,
        status=status,
        issues=issues,
        standard_value=std_value,
        standard_unit=std_unit,
        original_value=record.value,
        original_unit=record.unit,
        can_release=can_release,
        release_reason=release_reason,
        need_supplement=need_supplement,
    )


def split_by_unit_issue(records):
    normal = []
    unit_issue = []
    for vr in records:
        if vr.status in (RecordStatus.UNIT_MISSING, RecordStatus.UNIT_INCONSISTENT):
            unit_issue.append(vr)
        else:
            normal.append(vr)
    return normal, unit_issue
