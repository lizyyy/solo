import math
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from .physics import ShotParams, ShotResult, compute_trajectory, RIM_HEIGHT, FREE_THROW_DIST


@dataclass
class ValidationIssue:
    field_name: str
    severity: str
    original_value: Any
    corrected_value: Optional[Any]
    explanation: str


ANGLE_RAD_UPPER = math.pi
VELOCITY_MIN = 0.5
VELOCITY_MAX = 30.0
RELEASE_HEIGHT_MIN = 0.5
RELEASE_HEIGHT_MAX = 2.8
RIM_HEIGHT_MIN = 2.0
RIM_HEIGHT_MAX = 4.0
DISTANCE_MIN = 0.5
DISTANCE_MAX = 15.0


def validate_angle(value: Any, field_name: str = "angle_deg") -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    if value is None:
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=None, corrected_value=None,
            explanation=f"{field_name} 缺失，无法计算轨迹，必须提供出手角度"
        ))
        return issues

    try:
        angle = float(value)
    except (ValueError, TypeError):
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}='{value}' 不是合法数字，无法转换为浮点数"
        ))
        return issues

    if angle > 360 or angle < -360:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={angle}° 超出物理范围(-360°~360°)，可能是弧度被当度数填入"
        ))
        return issues

    if 0 < abs(angle) < ANGLE_RAD_UPPER and abs(angle) < 10:
        converted = math.degrees(abs(angle))
        if 15 < converted < 85:
            corrected = math.degrees(abs(angle))
            issues.append(ValidationIssue(
                field_name=field_name, severity="error",
                original_value=value, corrected_value=round(corrected, 2),
                explanation=f"{field_name}={angle} 疑为弧度制（值在0~π之间），已换算为 {corrected:.2f}°；弧度制输入会极大改变抛物线形态：角度翻倍则弧线更陡、射程变短，角度减半则弧线更平、容易打到篮筐前沿"
            ))
            return issues

    if angle <= 0:
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={angle}° ≤ 0°，球向下或水平投出，不可能命中篮筐"
        ))
    elif angle > 90 and angle <= 180:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={angle}° 在90°~180°之间，投篮出手角不应超过90°，请确认是否误填"
        ))
    elif angle > 80:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={angle}° 接近垂直，实际投篮出手角极少超过75°，请确认是否误填"
        ))

    return issues


def validate_velocity(value: Any, field_name: str = "velocity_ms") -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    if value is None:
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=None, corrected_value=None,
            explanation=f"{field_name} 缺失，无法计算轨迹，必须提供出手速度"
        ))
        return issues

    try:
        vel = float(value)
    except (ValueError, TypeError):
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}='{value}' 不是合法数字"
        ))
        return issues

    if vel <= 0:
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={vel} m/s ≤ 0，速度为负或零不可能前进"
        ))
    elif vel < VELOCITY_MIN:
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={vel} m/s 过低（< {VELOCITY_MIN} m/s），球无法到达篮筐，正常出手速度约5~10 m/s"
        ))
    elif vel > VELOCITY_MAX:
        possible_kmh = vel / 3.6
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=round(possible_kmh, 2),
            explanation=f"{field_name}={vel} m/s 远超正常值（>{VELOCITY_MAX} m/s），疑似 km/h 被当 m/s 填入；若为 {possible_kmh:.1f} km/h 则换算为 {possible_kmh / 3.6:.2f} m/s。速度异常直接改变射程和弧高：速度翻倍则球飞过篮筐很远，速度减半则球到不了篮筐"
        ))

    return issues


def validate_release_height(value: Any, field_name: str = "release_height") -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    if value is None:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=None, corrected_value=1.95,
            explanation=f"{field_name} 缺失，已使用默认值 1.95 m（成年球员平均出手高度）；出手高度直接影响可命中角度范围：越高则可接受角度下限越低"
        ))
        return issues

    try:
        h = float(value)
    except (ValueError, TypeError):
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=1.95,
            explanation=f"{field_name}='{value}' 不合法，已使用默认值 1.95 m"
        ))
        return issues

    if h < RELEASE_HEIGHT_MIN:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={h} m 过低（< {RELEASE_HEIGHT_MIN} m），正常出手高度 1.5~2.4 m"
        ))
    elif h > RELEASE_HEIGHT_MAX:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={h} m 过高（> {RELEASE_HEIGHT_MAX} m），请确认单位是否为 m 而非 cm"
        ))

    return issues


def validate_rim_height(value: Any, field_name: str = "rim_height") -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    if value is None:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=None, corrected_value=RIM_HEIGHT,
            explanation=f"{field_name} 缺失，已使用标准篮筐高度 {RIM_HEIGHT} m（3.048 m = 10英尺）；篮筐高度是命中判定的基准：若基准错误，所有偏差计算都会偏移"
        ))
        return issues

    try:
        h = float(value)
    except (ValueError, TypeError):
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=RIM_HEIGHT,
            explanation=f"{field_name}='{value}' 不合法，已使用标准值 {RIM_HEIGHT} m"
        ))
        return issues

    if h < RIM_HEIGHT_MIN:
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={h} m 低于 {RIM_HEIGHT_MIN} m，标准篮筐 3.048 m，疑似 cm 被当 m 或值填错；如果篮筐高度偏低，计算出的'命中'在实际中是打到篮板下方"
        ))
    elif h < RIM_HEIGHT - 0.3:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={h} m 低于标准篮筐高度 {RIM_HEIGHT} m 超过0.3m，虽在合理范围内但偏差较大；偏低篮筐使命中窗口偏移：同样的角度速度组合在实际3.048m篮筐上可能未命中"
        ))
    elif h > RIM_HEIGHT_MAX:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={h} m 高于 {RIM_HEIGHT_MAX} m，请确认"
        ))

    return issues


def validate_rim_distance(value: Any, field_name: str = "rim_distance") -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    if value is None:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=None, corrected_value=FREE_THROW_DIST,
            explanation=f"{field_name} 缺失，已使用罚球线距离 {FREE_THROW_DIST} m"
        ))
        return issues

    try:
        d = float(value)
    except (ValueError, TypeError):
        issues.append(ValidationIssue(
            field_name=field_name, severity="error",
            original_value=value, corrected_value=FREE_THROW_DIST,
            explanation=f"{field_name}='{value}' 不合法，已使用默认值 {FREE_THROW_DIST} m"
        ))
        return issues

    if d < DISTANCE_MIN:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={d} m 过近（< {DISTANCE_MIN} m）"
        ))
    elif d > DISTANCE_MAX:
        issues.append(ValidationIssue(
            field_name=field_name, severity="warning",
            original_value=value, corrected_value=None,
            explanation=f"{field_name}={d} m 过远（> {DISTANCE_MAX} m），超出半场范围"
        ))

    return issues


def validate_shot_record(record: Dict[str, Any]) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    issues.extend(validate_angle(record.get("angle_deg"), "angle_deg"))
    issues.extend(validate_velocity(record.get("velocity_ms"), "velocity_ms"))
    issues.extend(validate_release_height(record.get("release_height"), "release_height"))
    issues.extend(validate_rim_height(record.get("rim_height"), "rim_height"))
    issues.extend(validate_rim_distance(record.get("rim_distance"), "rim_distance"))

    return issues


def apply_corrections(record: Dict[str, Any], issues: List[ValidationIssue]) -> Dict[str, Any]:
    corrected = dict(record)
    corrections_made: List[str] = []
    for issue in issues:
        if issue.corrected_value is not None and issue.field_name in corrected:
            old = corrected[issue.field_name]
            corrected[issue.field_name] = issue.corrected_value
            corrections_made.append(
                f"{issue.field_name}: {old} → {issue.corrected_value} ({issue.explanation})"
            )
        elif issue.corrected_value is not None and issue.field_name not in corrected:
            corrected[issue.field_name] = issue.corrected_value
            corrections_made.append(
                f"{issue.field_name}: 缺失 → {issue.corrected_value} ({issue.explanation})"
            )
    corrected["_corrections"] = corrections_made
    return corrected


def format_validation_report(issues: List[ValidationIssue]) -> str:
    if not issues:
        return "数据校验通过，无异常"
    lines = ["数据校验报告", "=" * 60]
    for i, issue in enumerate(issues, 1):
        icon = "✗" if issue.severity == "error" else "⚠"
        lines.append(f"  {icon} [{issue.severity.upper()}] #{i}")
        lines.append(f"    字段   : {issue.field_name}")
        lines.append(f"    原始值 : {issue.original_value}")
        lines.append(f"    修正值 : {issue.corrected_value}")
        lines.append(f"    说明   : {issue.explanation}")
        lines.append("")
    return "\n".join(lines)
