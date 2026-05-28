import math
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict
from models import (
    StudentRecord,
    FringePosition,
    WavelengthResult,
    Anomaly,
    AnalysisStep,
    SourceType,
    AngleUnit,
)


def detect_missing_fringes(
    student_record: StudentRecord,
    expected_max_order: int = 3,
) -> List[Anomaly]:
    anomalies = []

    orders = defaultdict(lambda: {"left": False, "right": False, "center": False})
    for fringe in student_record.fringes:
        orders[abs(fringe.order)][fringe.side] = True
        if fringe.order == 0:
            orders[0]["center"] = True

    center_present = orders.get(0, {}).get("center", False)
    if not center_present:
        anomaly = Anomaly(
            anomaly_type="条纹缺失",
            severity="error",
            description="未找到零级（中央）亮纹位置，这是计算其他级次条纹位置的基准",
            affected_ids=[student_record.source_id],
            suggestion="请重新测量零级条纹位置，确保其在视场中央",
            source_type=SourceType.CALCULATED,
            parent_ids=[student_record.source_id],
            notes="零级条纹是所有计算的基准，缺失会导致所有角度计算错误",
        )
        anomalies.append(anomaly)

    for k in range(1, expected_max_order + 1):
        order_info = orders.get(k, {"left": False, "right": False})
        missing_sides = []
        if not order_info.get("left", False):
            missing_sides.append("左")
        if not order_info.get("right", False):
            missing_sides.append("右")

        if missing_sides:
            severity = "warning" if len(missing_sides) == 1 else "error"
            anomaly = Anomaly(
                anomaly_type="条纹缺失",
                severity=severity,
                description=f"第{k}级条纹缺少{ '、'.join(missing_sides) }侧数据",
                affected_ids=[student_record.source_id],
                suggestion=f"请检查并补充第{k}级{ '、'.join(missing_sides) }侧的条纹位置测量",
                source_type=SourceType.CALCULATED,
                parent_ids=[student_record.source_id],
                notes=f"对称测量可以减小系统误差，建议同时记录左右两侧同级条纹",
            )
            anomalies.append(anomaly)

    present_orders = sorted([k for k in orders.keys() if k > 0])
    if present_orders:
        expected_orders = set(range(1, max(present_orders) + 1))
        actual_orders = set(present_orders)
        missing_between = expected_orders - actual_orders
        for k in sorted(missing_between):
            anomaly = Anomaly(
                anomaly_type="条纹缺失",
                severity="warning",
                description=f"在已测量的级次中，第{k}级条纹缺失（已测级次：{present_orders}）",
                affected_ids=[student_record.source_id],
                suggestion=f"请检查是否漏测了第{k}级条纹，或确认该级次确实无法观测到",
                source_type=SourceType.CALCULATED,
                parent_ids=[student_record.source_id],
                notes="中间级次缺失可能是由于测量时漏记，也可能是级次混淆的表现",
            )
            anomalies.append(anomaly)

    return anomalies


def detect_order_confusion(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
    reference_wavelength: Optional[float] = None,
    tolerance_ratio: float = 0.15,
) -> List[Anomaly]:
    anomalies = []

    if len(wavelength_results) < 2:
        return anomalies

    order_values = defaultdict(list)
    for result in wavelength_results:
        order_values[abs(result.order)].append(result.value)

    order_means = {}
    for order, values in order_values.items():
        if values:
            order_means[order] = sum(values) / len(values)

    sorted_orders = sorted(order_means.keys())

    for i in range(len(sorted_orders)):
        for j in range(i + 1, len(sorted_orders)):
            k1 = sorted_orders[i]
            k2 = sorted_orders[j]
            ratio = order_means[k2] / order_means[k1] if order_means[k1] != 0 else 0
            expected_ratio = k2 / k1

            if abs(ratio - expected_ratio) / expected_ratio > tolerance_ratio:
                anomaly = Anomaly(
                    anomaly_type="级次混淆",
                    severity="error",
                    description=(
                        f"第{k1}级和第{k2}级计算的波长不符合比例关系。"
                        f"实测比值 λ({k2})/λ({k1}) = {ratio:.4f}，"
                        f"理论比值应为 {expected_ratio:.4f}，"
                        f"偏差 {abs(ratio - expected_ratio)/expected_ratio*100:.1f}%"
                    ),
                    affected_ids=[
                        r.source_id for r in wavelength_results
                        if abs(r.order) in (k1, k2)
                    ],
                    suggestion=(
                        f"请核对第{k1}级和第{k2}级条纹的级次标记是否正确。"
                        f"常见错误：将k=1记为k=2，或混淆了左右两侧的级次方向。"
                        f"如果数据是角度，检查是否将1级记为了2级。"
                    ),
                    source_type=SourceType.CALCULATED,
                    parent_ids=[r.source_id for r in wavelength_results],
                    notes=(
                        f"根据光栅方程，λ与级次k成反比（同级条纹）。"
                        f"如果是同一级次的两侧，波长应该接近相等。"
                    ),
                )
                anomalies.append(anomaly)

    if reference_wavelength and reference_wavelength > 0:
        for result in wavelength_results:
            ratio = result.value / reference_wavelength
            k_actual = abs(result.order)

            possible_k = []
            for k_test in range(1, 6):
                expected_lambda = result.value * k_test / k_actual
                if abs(expected_lambda - reference_wavelength) / reference_wavelength < tolerance_ratio:
                    possible_k.append(k_test)

            if possible_k and k_actual not in possible_k:
                anomaly = Anomaly(
                    anomaly_type="级次混淆",
                    severity="error",
                    description=(
                        f"第{k_actual}级条纹计算波长 {result.value*1e9:.2f} nm 与参考值 "
                        f"{reference_wavelength*1e9:.2f} nm 偏差 {abs(ratio-1)*100:.1f}%。"
                        f"若级次应为 {possible_k}，则波长计算值将在合理范围内。"
                    ),
                    affected_ids=[result.source_id],
                    suggestion=(
                        f"建议检查该条纹的级次标记。若标记为k={possible_k[0]}，"
                        f"则计算波长为 {result.value*k_actual/possible_k[0]*1e9:.2f} nm，"
                        f"与参考值更接近。"
                    ),
                    source_type=SourceType.CALCULATED,
                    parent_ids=[result.source_id],
                    notes="级次混淆是最常见的错误之一，特别是当条纹较密时容易数错。",
                )
                anomalies.append(anomaly)

    return anomalies


def detect_angle_unit_errors(
    student_record: StudentRecord,
    reference_wavelength: Optional[float] = None,
) -> List[Anomaly]:
    anomalies = []

    for fringe in student_record.fringes:
        if fringe.angle is None:
            continue

        if fringe.angle_unit == AngleUnit.DEGREE:
            if abs(fringe.angle) > 180:
                anomaly = Anomaly(
                    anomaly_type="角度单位错误",
                    severity="error",
                    description=(
                        f"第{fringe.order}级条纹角度 {fringe.angle}° 超出合理范围（±90°）"
                    ),
                    affected_ids=[fringe.source_id],
                    suggestion=(
                        "请检查角度单位是否正确。如果数据是弧度，请将单位改为弧度；"
                        "如果是分，请改用弧分单位。"
                    ),
                    source_type=SourceType.CALCULATED,
                    parent_ids=[fringe.source_id],
                    notes="角度值过大通常是单位混淆导致的，如将弧度误用为度。",
                )
                anomalies.append(anomaly)

            if abs(fringe.angle) > 0 and abs(fringe.angle) < 0.01:
                severity = "warning"
                if reference_wavelength:
                    test_angle_rad = math.radians(fringe.angle * 60)
                    if student_record.grating_constant and fringe.order != 0:
                        test_lambda = (
                            student_record.grating_constant.value
                            * math.sin(test_angle_rad)
                            / abs(fringe.order)
                        )
                        if (
                            abs(test_lambda - reference_wavelength) / reference_wavelength
                            < 0.2
                        ):
                            severity = "error"

                anomaly = Anomaly(
                    anomaly_type="角度单位错误",
                    severity=severity,
                    description=(
                        f"第{fringe.order}级条纹角度 {fringe.angle}° 过小。"
                        f"如果实际单位是弧分（'），请在记录时明确标注。"
                    ),
                    affected_ids=[fringe.source_id],
                    suggestion=(
                        "请确认角度单位。如果数据是弧分，请设置 angle_unit=ARCMINUTE。"
                        f"按弧分重新计算：角度 = {fringe.angle}' = {fringe.angle/60:.4f}°"
                    ),
                    source_type=SourceType.CALCULATED,
                    parent_ids=[fringe.source_id],
                    notes="角度值过小通常是将弧分误用为度，这是非常常见的错误。",
                )
                anomalies.append(anomaly)

        elif fringe.angle_unit == AngleUnit.RADIAN:
            if abs(fringe.angle) > math.pi / 2:
                anomaly = Anomaly(
                    anomaly_type="角度单位错误",
                    severity="error",
                    description=(
                        f"第{fringe.order}级条纹角度 {fringe.angle:.4f} rad 超出合理范围（±π/2）"
                    ),
                    affected_ids=[fringe.source_id],
                    suggestion=(
                        "请检查角度单位是否正确。如果数据是角度，请将单位改为度。"
                        f"按角度重新计算：{math.degrees(fringe.angle):.2f}°"
                    ),
                    source_type=SourceType.CALCULATED,
                    parent_ids=[fringe.source_id],
                    notes="弧度与角度混淆会导致结果差约57倍（180/π）。",
                )
                anomalies.append(anomaly)

        elif fringe.angle_unit == AngleUnit.ARCMINUTE:
            if abs(fringe.angle) > 60 * 90:
                anomaly = Anomaly(
                    anomaly_type="角度单位错误",
                    severity="error",
                    description=(
                        f"第{fringe.order}级条纹角度 {fringe.angle}' 超出合理范围（±5400'）"
                    ),
                    affected_ids=[fringe.source_id],
                    suggestion=(
                        "请检查角度单位是否正确。如果数据是度，请将单位改为度。"
                        f"按度重新计算：{fringe.angle/60:.2f}°"
                    ),
                    source_type=SourceType.CALCULATED,
                    parent_ids=[fringe.source_id],
                    notes="弧分与角度混淆会导致结果差60倍。",
                )
                anomalies.append(anomaly)

    return anomalies


def detect_symmetry_errors(
    student_record: StudentRecord,
    tolerance_ratio: float = 0.1,
) -> List[Anomaly]:
    anomalies = []

    order_sides = defaultdict(dict)
    for fringe in student_record.fringes:
        if fringe.order == 0:
            continue
        k = abs(fringe.order)
        order_sides[k][fringe.side] = fringe

    for k, sides in order_sides.items():
        left = sides.get("left")
        right = sides.get("right")

        if left and right and left.position and right.position:
            left_pos = abs(left.position)
            right_pos = abs(right.position)
            avg_pos = (left_pos + right_pos) / 2
            if avg_pos > 0:
                deviation = abs(left_pos - right_pos) / avg_pos
                if deviation > tolerance_ratio:
                    anomaly = Anomaly(
                        anomaly_type="对称性异常",
                        severity="warning",
                        description=(
                            f"第{k}级条纹左右位置不对称。左侧: {left.position:.4e} m, "
                            f"右侧: {right.position:.4e} m, 相对偏差: {deviation*100:.1f}%"
                        ),
                        affected_ids=[left.source_id, right.source_id],
                        suggestion=(
                            f"请检查第{k}级条纹的测量位置是否准确。"
                            f"不对称偏差超过{tolerance_ratio*100:.0f}%可能意味着："
                            f"1) 测量误差较大；2) 光栅未垂直放置；3) 读数错误。"
                        ),
                        source_type=SourceType.CALCULATED,
                        parent_ids=[left.source_id, right.source_id],
                        notes=(
                            "理想情况下，同级条纹的左右位置绝对值应相等。"
                            "取左右平均值可以减小系统误差。"
                        ),
                    )
                    anomalies.append(anomaly)

    return anomalies


def detect_data_inconsistency(
    wavelength_results: List[WavelengthResult],
    cv_threshold: float = 0.1,
) -> List[Anomaly]:
    anomalies = []

    if len(wavelength_results) < 2:
        return anomalies

    values = [r.value for r in wavelength_results]
    mean_val = sum(values) / len(values)
    std_val = math.sqrt(sum((v - mean_val) ** 2 for v in values) / len(values))
    cv = std_val / mean_val if mean_val != 0 else 0

    if cv > cv_threshold:
        outliers = []
        for result in wavelength_results:
            z_score = abs(result.value - mean_val) / std_val if std_val > 0 else 0
            if z_score > 2:
                outliers.append((result, z_score))

        description = (
            f"各组波长计算值离散度较大，变异系数 CV = {cv*100:.1f}% "
            f"(阈值: {cv_threshold*100:.0f}%)。平均值 = {mean_val*1e9:.2f} nm，"
            f"标准差 = {std_val*1e9:.2f} nm。"
        )

        if outliers:
            outlier_info = ", ".join(
                [f"第{r.order}级(Z={z:.1f}σ)" for r, z in outliers]
            )
            description += f" 可疑离群点：{outlier_info}"

        anomaly = Anomaly(
            anomaly_type="数据不一致",
            severity="warning",
            description=description,
            affected_ids=[r.source_id for r in wavelength_results],
            suggestion=(
                "请检查各条数据的测量和记录是否正确。"
                "离群点可能对应测量错误或级次混淆。"
                "可以考虑使用格拉布斯检验法剔除异常值。"
            ),
            source_type=SourceType.CALCULATED,
            parent_ids=[r.source_id for r in wavelength_results],
            notes=(
                f"变异系数(CV) = 标准差/平均值。CV > {cv_threshold*100:.0f}% "
                "通常表示数据质量需要关注。"
            ),
        )
        anomalies.append(anomaly)

    return anomalies


def detect_all_anomalies(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
    expected_max_order: int = 3,
) -> Tuple[List[Anomaly], Dict[str, Any]]:
    all_anomalies = []
    trace = {}

    missing_anomalies = detect_missing_fringes(student_record, expected_max_order)
    all_anomalies.extend(missing_anomalies)
    trace["条纹缺失"] = len(missing_anomalies)

    angle_unit_anomalies = detect_angle_unit_errors(
        student_record, student_record.reference_wavelength
    )
    all_anomalies.extend(angle_unit_anomalies)
    trace["角度单位错误"] = len(angle_unit_anomalies)

    symmetry_anomalies = detect_symmetry_errors(student_record)
    all_anomalies.extend(symmetry_anomalies)
    trace["对称性异常"] = len(symmetry_anomalies)

    order_anomalies = detect_order_confusion(
        student_record, wavelength_results, student_record.reference_wavelength
    )
    all_anomalies.extend(order_anomalies)
    trace["级次混淆"] = len(order_anomalies)

    inconsistency_anomalies = detect_data_inconsistency(wavelength_results)
    all_anomalies.extend(inconsistency_anomalies)
    trace["数据不一致"] = len(inconsistency_anomalies)

    trace["总异常数"] = len(all_anomalies)
    trace["严重错误"] = sum(1 for a in all_anomalies if a.severity == "error")
    trace["警告"] = sum(1 for a in all_anomalies if a.severity == "warning")

    return all_anomalies, trace


def create_anomaly_detection_step(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
) -> AnalysisStep:
    step = AnalysisStep(
        step_name="异常检测",
        source_type=SourceType.CALCULATED,
        parent_ids=[student_record.source_id] + [r.source_id for r in wavelength_results],
        notes="检测条纹缺失、级次混淆、角度单位错误等常见实验问题",
        input_data={
            "student_record_id": student_record.source_id,
            "fringe_count": len(student_record.fringes),
            "result_count": len(wavelength_results),
            "detection_types": [
                "条纹缺失",
                "级次混淆",
                "角度单位错误",
                "对称性异常",
                "数据不一致",
            ],
        },
    )
    return step
