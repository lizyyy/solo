import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

from models import (
    SensorLog, CalibrationResult, VersionDiff, DiffItem,
    Status, AnomalyType, AnomalyMark
)
from storage import get_log_by_version, get_batch


def compare_raw_data(
    old_data: List[Dict[str, Any]],
    new_data: List[Dict[str, Any]]
) -> List[DiffItem]:
    diffs = []

    old_len = len(old_data)
    new_len = len(new_data)

    if old_len != new_len:
        diffs.append(DiffItem(
            field="采样点数量",
            old_value=old_len,
            new_value=new_len,
            change_type="数据点数量变化",
            impact=f"采样点从{old_len}个变为{new_len}个，可能影响数据完整性"
        ))

    min_len = min(old_len, new_len)
    fields_to_compare = ["timestamp", "position", "amplitude", "phase"]

    for field in fields_to_compare:
        old_vals = np.array([d.get(field, 0) for d in old_data[:min_len]])
        new_vals = np.array([d.get(field, 0) for d in new_data[:min_len]])

        if not np.allclose(old_vals, new_vals, rtol=1e-9, atol=1e-9):
            changed_indices = np.where(~np.isclose(old_vals, new_vals, rtol=1e-9, atol=1e-9))[0]

            for idx in changed_indices[:5]:
                old_val = old_vals[idx]
                new_val = new_vals[idx]

                impact = ""
                if field == "position" and old_val != 0 and new_val != 0:
                    ratio = max(abs(new_val), abs(old_val)) / min(abs(new_val), abs(old_val))
                    if ratio > 900 and ratio < 1100:
                        impact = "⚠️ 位置数据变化接近1000倍，极可能是单位换算错误（mm↔m）"

                if not impact and field == "timestamp" and old_val != 0:
                    change_ratio = abs(new_val - old_val) / (abs(old_val) + 1e-10) * 100
                    if change_ratio > 200:
                        impact = "⚠️ 时间戳大幅变化，可能存在采样缺口问题"

                if not impact and old_val != 0:
                    change_ratio = abs(new_val - old_val) / (abs(old_val) + 1e-10) * 100
                    impact = f"{field}数据变化率: {change_ratio:.2f}%"
                elif not impact:
                    impact = f"{field}数据从{old_val}变为{new_val}"

                diffs.append(DiffItem(
                    field=f"采样点[{idx+1}].{field}",
                    old_value=float(old_val),
                    new_value=float(new_val),
                    change_type="数值修改",
                    impact=impact
                ))

            if len(changed_indices) > 5:
                diffs.append(DiffItem(
                    field=f"{field}字段",
                    old_value=f"共{len(changed_indices)}处变化",
                    new_value=f"共{len(changed_indices)}处变化",
                    change_type="批量修改",
                    impact=f"{field}字段共有{len(changed_indices)}个采样点发生变化，仅显示前5处"
                ))

    if new_len > old_len:
        diffs.append(DiffItem(
            field="新增数据点",
            old_value=f"无（共{old_len}点）",
            new_value=f"新增{new_len - old_len}点",
            change_type="数据追加",
            impact=f"新版本比旧版本多{new_len - old_len}个采样点"
        ))
    elif old_len > new_len:
        diffs.append(DiffItem(
            field="缺失数据点",
            old_value=f"共{old_len}点",
            new_value=f"缺失{old_len - new_len}点",
            change_type="数据删除",
            impact=f"新版本比旧版本少{old_len - new_len}个采样点，可能存在数据丢失"
        ))

    return diffs


def compare_anomalies(
    old_anomalies: List[AnomalyMark],
    new_anomalies: List[AnomalyMark]
) -> List[str]:
    changes = []

    old_types = {(a.anomaly_type.value, a.position): a for a in old_anomalies}
    new_types = {(a.anomaly_type.value, a.position): a for a in new_anomalies}

    for key, old_anomaly in old_types.items():
        if key not in new_types:
            changes.append(
                f"⚠️ 异常消失：{old_anomaly.anomaly_type.value} "
                f"（位置: {old_anomaly.position}）在新版本中不再被检测到。"
                f"原因为：{old_anomaly.description}"
            )

    for key, new_anomaly in new_types.items():
        if key not in old_types:
            changes.append(
                f"🚨 新增异常：{new_anomaly.anomaly_type.value} "
                f"（位置: {new_anomaly.position}）在新版本中被检测到。"
                f"原因为：{new_anomaly.description}"
            )
        else:
            old_anomaly = old_types[key]
            if old_anomaly.description != new_anomaly.description:
                changes.append(
                    f"🔄 异常描述变更：{new_anomaly.anomaly_type.value} "
                    f"（位置: {new_anomaly.position}）描述发生变化。"
                    f"旧：{old_anomaly.description} → 新：{new_anomaly.description}"
                )

    if not changes:
        changes.append("✅ 异常检测结果无变化")

    return changes


def compare_calibration_results(
    old_result: Optional[CalibrationResult],
    new_result: Optional[CalibrationResult]
) -> List[DiffItem]:
    diffs = []

    if old_result is None or new_result is None:
        if old_result is None and new_result is not None:
            diffs.append(DiffItem(
                field="校准结果",
                old_value="无",
                new_value="已生成",
                change_type="新增校准",
                impact="新版本完成了校准计算"
            ))
        elif old_result is not None and new_result is None:
            diffs.append(DiffItem(
                field="校准结果",
                old_value="已生成",
                new_value="无",
                change_type="校准丢失",
                impact="旧版本有校准结果但新版本没有，需要重新校准"
            ))
        return diffs

    fields_to_compare = [
        ("measured_velocity", "测量声速", "m/s"),
        ("theoretical_velocity", "理论声速", "m/s"),
        ("relative_error", "相对误差", "%"),
        ("wavelength", "波长", "m"),
    ]

    for field_name, display_name, unit in fields_to_compare:
        old_val = getattr(old_result, field_name)
        new_val = getattr(new_result, field_name)

        if abs(old_val - new_val) > 1e-9:
            change_pct = abs(new_val - old_val) / (abs(old_val) + 1e-10) * 100

            if field_name == "relative_error":
                if new_val > 5 and old_val <= 5:
                    impact = f"⚠️ 相对误差从{old_val:.2f}%升至{new_val:.2f}%，超过5%阈值，状态可能变为待确认"
                elif new_val <= 5 and old_val > 5:
                    impact = f"✅ 相对误差从{old_val:.2f}%降至{new_val:.2f}%，进入正常范围"
                else:
                    impact = f"相对误差变化{change_pct:.2f}%"
            elif field_name == "measured_velocity":
                old_theory = old_result.theoretical_velocity
                new_theory = new_result.theoretical_velocity
                impact = (
                    f"测量声速变化，旧值与理论值偏差{abs(old_val - old_theory):.2f}m/s，"
                    f"新值与理论值偏差{abs(new_val - new_theory):.2f}m/s"
                )
            else:
                impact = f"{display_name}变化率: {change_pct:.2f}%"

            diffs.append(DiffItem(
                field=display_name,
                old_value=f"{old_val:.4f} {unit}",
                new_value=f"{new_val:.4f} {unit}",
                change_type="数值变化",
                impact=impact
            ))

    if old_result.status != new_result.status:
        diffs.append(DiffItem(
            field="状态",
            old_value=old_result.status.value,
            new_value=new_result.status.value,
            change_type="状态变更",
            impact=f"校准状态从【{old_result.status.value}】变为【{new_result.status.value}】"
        ))

    return diffs


def compare_log_versions(
    batch_id: str,
    old_version: int,
    new_version: int
) -> VersionDiff:
    batch = get_batch(batch_id)
    if not batch:
        raise ValueError(f"批次 {batch_id} 不存在")

    old_log = get_log_by_version(batch_id, old_version)
    new_log = get_log_by_version(batch_id, new_version)

    if not old_log:
        raise ValueError(f"版本 {old_version} 不存在")
    if not new_log:
        raise ValueError(f"版本 {new_version} 不存在")

    all_diffs = []

    data_diffs = compare_raw_data(old_log.raw_data, new_log.raw_data)
    all_diffs.extend(data_diffs)

    old_record = None
    new_record = None

    for rec in batch.calibration_records:
        if hasattr(rec, 'log_version'):
            if rec.log_version == old_version:
                old_record = rec
            elif rec.log_version == new_version:
                new_record = rec

    if old_log.upload_time != new_log.upload_time:
        all_diffs.append(DiffItem(
            field="上传时间",
            old_value=old_log.upload_time,
            new_value=new_log.upload_time,
            change_type="元数据变更",
            impact=f"数据上传时间从{old_log.upload_time}变为{new_log.upload_time}"
        ))

    if old_log.filename != new_log.filename:
        all_diffs.append(DiffItem(
            field="文件名",
            old_value=old_log.filename,
            new_value=new_log.filename,
            change_type="元数据变更",
            impact=f"数据文件从{old_log.filename}变为{new_log.filename}"
        ))

    old_anomalies = old_record.anomalies if old_record else []
    new_anomalies = new_record.anomalies if new_record else []
    anomaly_changes = compare_anomalies(old_anomalies, new_anomalies)

    status_change = None
    if old_record and new_record and old_record.status != new_record.status:
        status_change = (
            f"状态变更：{old_record.status.value} → {new_record.status.value}"
        )

    return VersionDiff(
        old_version=old_version,
        new_version=new_version,
        diff_items=all_diffs,
        anomaly_changes=anomaly_changes,
        status_change=status_change
    )


def compare_all_versions(batch_id: str) -> List[VersionDiff]:
    batch = get_batch(batch_id)
    if not batch:
        raise ValueError(f"批次 {batch_id} 不存在")

    if len(batch.logs) < 2:
        return []

    diffs = []
    for i in range(len(batch.logs) - 1):
        diff = compare_log_versions(batch_id, i + 1, i + 2)
        diffs.append(diff)

    return diffs


def format_diff_report(diff: VersionDiff) -> str:
    lines = []

    lines.append("=" * 60)
    lines.append(f"版本差异报告：版本 {diff.old_version} → 版本 {diff.new_version}")
    lines.append("=" * 60)

    if diff.status_change:
        lines.append(f"\n🔴 重要变更：{diff.status_change}")
        lines.append("-" * 40)

    lines.append(f"\n📊 数据变更 ({len(diff.diff_items)} 处):")
    lines.append("-" * 40)

    for item in diff.diff_items:
        lines.append(f"\n【{item.change_type}】{item.field}")
        lines.append(f"    旧值: {item.old_value}")
        lines.append(f"    新值: {item.new_value}")
        lines.append(f"    影响: {item.impact}")

    lines.append(f"\n⚠️  异常检测变更 ({len(diff.anomaly_changes)} 项):")
    lines.append("-" * 40)

    for change in diff.anomaly_changes:
        lines.append(f"  {change}")

    lines.append("\n" + "=" * 60)
    lines.append("注意：本报告仅显示差异，历史版本数据不会被覆盖。")
    lines.append("如需查看完整历史，请使用 get_log_by_version() 获取指定版本。")
    lines.append("=" * 60)

    return "\n".join(lines)
