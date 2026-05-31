from typing import List, Dict, Any
from datetime import datetime

from models import (
    MaterialBatch, CalibrationResult, GradingSheet,
    Status, AnomalyType
)
from storage import get_batch, get_latest_log
from version_diff import compare_all_versions, format_diff_report


def generate_next_steps(
    results: List[CalibrationResult],
    has_multiple_versions: bool
) -> List[str]:
    next_steps = []

    all_pending = all(r.status == Status.PENDING for r in results)
    any_pending = any(r.status == Status.PENDING for r in results)

    if all_pending:
        next_steps.append("【紧急】所有方法的校准结果均为【待确认】，请立即排查以下问题：")
    elif any_pending:
        next_steps.append("【注意】部分校准结果为【待确认】，请重点关注以下问题：")

    for result in results:
        if result.status == Status.PENDING:
            for anomaly in result.anomalies:
                if anomaly.anomaly_type == AnomalyType.SAMPLING_GAP:
                    next_steps.append(
                        f"  • {result.method.value}：{anomaly.position}存在采样缺口，"
                        f"请检查{anomaly.position}附近的采样过程，"
                        f"确认是否存在数据漏采或时间戳记录错误。"
                        f"建议：重新采集该时间段数据，或使用插值法补全采样缺口。"
                    )
                elif anomaly.anomaly_type == AnomalyType.UNIT_CONVERSION_ERROR:
                    next_steps.append(
                        f"  • {result.method.value}：{anomaly.position}疑似单位换算错误，"
                        f"请核对原始数据记录的单位（mm/m/cm）。"
                        f"常见错误：将mm当作m计算导致声速偏小1000倍。"
                        f"建议：查看原始记录，统一单位后重新计算。"
                    )
                elif anomaly.anomaly_type == AnomalyType.ZERO_DRIFT:
                    next_steps.append(
                        f"  • {result.method.value}：{anomaly.position}存在零点漂移，"
                        f"请检查换能器初始位置是否正确记录。"
                        f"建议：重新校准零点，或在数据处理中减去系统偏移量。"
                    )
                elif anomaly.anomaly_type == AnomalyType.ABNORMAL_VALUE:
                    next_steps.append(
                        f"  • {result.method.value}：{anomaly.position}存在数值异常，"
                        f"请检查设备连接和数据采集软件是否正常工作。"
                        f"建议：重启设备后重新采集数据。"
                    )

            if not result.anomalies and result.relative_error > 5:
                next_steps.append(
                    f"  • {result.method.value}：相对误差{result.relative_error:.2f}%超过5%，"
                    f"但未检测到明确异常。"
                    f"建议：检查环境温度记录是否准确，确认换能器频率设置正确。"
                )

    normal_results = [r for r in results if r.status == Status.NORMAL]
    if normal_results:
        next_steps.append("\n【已通过】以下方法结果正常，可作为参考：")
        for r in normal_results:
            next_steps.append(
                f"  • {r.method.value}：v = {r.measured_velocity:.2f} m/s，"
                f"相对误差 {r.relative_error:.2f}%"
            )

    if has_multiple_versions:
        next_steps.append(
            "\n【版本说明】本批次存在多个版本的传感器日志，"
            "请查阅版本差异报告了解数据变更历史。"
            "注意：历史版本均已保留，未被覆盖。"
        )

    if not next_steps:
        next_steps.append("【完成】所有检查项均通过，实验结果正常。")

    return next_steps


def generate_reasons(
    results: List[CalibrationResult]
) -> List[str]:
    reasons = []

    for result in results:
        reasons.append(f"\n【{result.method.value}】判断理由：")

        if result.status == Status.NORMAL:
            reasons.append("  ✓ 未检测到采样缺口、单位换算错误、零点漂移等严重异常")
            reasons.append(f"  ✓ 相对误差 {result.relative_error:.2f}% 在允许范围内")
            reasons.append(f"  ✓ 测量声速 {result.measured_velocity:.2f} m/s 与理论值 {result.theoretical_velocity:.2f} m/s 吻合良好")
        elif result.status == Status.PENDING:
            reasons.append("  ✗ 存在以下问题，需人工确认：")

            for anomaly in result.anomalies:
                icon = "🚨" if anomaly.severity == "high" else "⚠️"
                reasons.append(f"  {icon} {anomaly.anomaly_type.value}：{anomaly.description}")

            if result.relative_error > 5:
                reasons.append(
                    f"  ✗ 相对误差 {result.relative_error:.2f}% 超过5%阈值，"
                    f"测量值 {result.measured_velocity:.2f} m/s 与理论值 "
                    f"{result.theoretical_velocity:.2f} m/s 偏差较大"
                )

        final_trail = None
        for trail in reversed(result.judgment_trails):
            if "最终状态判定" in trail.criterion:
                final_trail = trail
                break

        if final_trail:
            reasons.append(f"\n  📋 自动判断依据：{final_trail.reason}")
            reasons.append(f"     判断结果：{final_trail.result}")

    return reasons


def generate_grading_sheet(
    batch_id: str,
    output_format: str = "text"
) -> GradingSheet:
    batch = get_batch(batch_id)
    if not batch:
        raise ValueError(f"批次 {batch_id} 不存在")

    results = batch.calibration_records

    if not results:
        latest_log = get_latest_log(batch_id)
        if latest_log:
            raise ValueError(
                f"批次 {batch_id} 已有传感器数据（版本{latest_log.version}），"
                f"但尚未进行校准。请先运行校准。"
            )
        else:
            raise ValueError(f"批次 {batch_id} 暂无数据，请先导入传感器日志。")

    has_multiple_versions = len(batch.logs) > 1

    final_status = "待确认" if any(r.status == Status.PENDING for r in results) else "正常"

    methods_used = [r.method.value for r in results]

    results_summary = []
    for r in results:
        results_summary.append({
            "方法": r.method.value,
            "测量声速(m/s)": round(r.measured_velocity, 2),
            "理论声速(m/s)": round(r.theoretical_velocity, 2),
            "相对误差(%)": round(r.relative_error, 2),
            "波长(m)": round(r.wavelength, 6),
            "状态": r.status.value
        })

    anomalies_found = []
    for r in results:
        for a in r.anomalies:
            anomalies_found.append({
                "方法": r.method.value,
                "异常类型": a.anomaly_type.value,
                "位置": a.position or "全局",
                "严重程度": a.severity,
                "描述": a.description
            })

    reasons = generate_reasons(results)
    next_steps = generate_next_steps(results, has_multiple_versions)

    grading_sheet = GradingSheet(
        batch_id=batch.batch_id,
        student_name=batch.student_name,
        student_id=batch.student_id,
        experiment_date=batch.experiment_date,
        final_status=final_status,
        methods_used=methods_used,
        results_summary=results_summary,
        anomalies_found=anomalies_found,
        reasons=reasons,
        next_steps=next_steps,
        generated_at=datetime.now().isoformat(timespec="seconds")
    )

    return grading_sheet


def format_grading_sheet(
    sheet: GradingSheet,
    format_type: str = "text"
) -> str:
    if format_type == "markdown":
        return _format_markdown(sheet)
    else:
        return _format_text(sheet)


def _format_text(sheet: GradingSheet) -> str:
    lines = []

    lines.append("=" * 70)
    lines.append("声速测量校准实验 - 批改表")
    lines.append("=" * 70)

    lines.append(f"\n📅 实验日期：{sheet.experiment_date}")
    lines.append(f"👤 学生姓名：{sheet.student_name}")
    lines.append(f"🎓 学生学号：{sheet.student_id}")
    lines.append(f"📦 批次编号：{sheet.batch_id}")
    lines.append(f"📊 使用方法：{', '.join(sheet.methods_used)}")
    lines.append(f"🏷️  最终状态：{'🔴 ' if sheet.final_status == '待确认' else '🟢 '}{sheet.final_status}")
    lines.append(f"⏰ 生成时间：{sheet.generated_at}")

    lines.append("\n" + "=" * 70)
    lines.append("一、测量结果汇总")
    lines.append("=" * 70)

    for i, summary in enumerate(sheet.results_summary, 1):
        status_icon = "🟢" if summary["状态"] == "正常" else "🟡"
        lines.append(f"\n{i}. {summary['方法']} {status_icon} [{summary['状态']}]")
        lines.append(f"   测量声速：{summary['测量声速(m/s)']} m/s")
        lines.append(f"   理论声速：{summary['理论声速(m/s)']} m/s")
        lines.append(f"   相对误差：{summary['相对误差(%)']}%")
        lines.append(f"   测 得 波长：{summary['波长(m)']} m")

    if sheet.anomalies_found:
        lines.append("\n" + "=" * 70)
        lines.append("二、检测到的异常")
        lines.append("=" * 70)

        for i, anomaly in enumerate(sheet.anomalies_found, 1):
            severity_icon = "🚨" if anomaly["严重程度"] == "high" else "⚠️"
            lines.append(f"\n{i}. {severity_icon} {anomaly['异常类型']}")
            lines.append(f"   相关方法：{anomaly['方法']}")
            lines.append(f"   异常位置：{anomaly['位置']}")
            lines.append(f"   详细描述：{anomaly['描述']}")
    else:
        lines.append("\n" + "=" * 70)
        lines.append("二、异常检测")
        lines.append("=" * 70)
        lines.append("\n✅ 未检测到任何异常。")

    lines.append("\n" + "=" * 70)
    lines.append("三、自动判断理由")
    lines.append("=" * 70)
    for reason in sheet.reasons:
        lines.append(reason)

    lines.append("\n" + "=" * 70)
    lines.append("四、下一步操作建议")
    lines.append("=" * 70)
    for step in sheet.next_steps:
        lines.append(step)

    lines.append("\n" + "=" * 70)
    lines.append("📌 重要说明")
    lines.append("-" * 70)
    lines.append("1. 本批改表为自动生成，如有疑问请联系助教复核。")
    lines.append("2. 【待确认】状态的结果需人工核实后才能计入成绩。")
    lines.append("3. 所有历史版本数据均已保留，可随时追溯。")
    lines.append("4. 单位换算错误是本实验最常见问题，请重点关注。")
    lines.append("=" * 70)

    return "\n".join(lines)


def _format_markdown(sheet: GradingSheet) -> str:
    lines = []

    lines.append("# 声速测量校准实验 - 批改表\n")

    lines.append("| 项目 | 内容 |")
    lines.append("|------|------|")
    lines.append(f"| 实验日期 | {sheet.experiment_date} |")
    lines.append(f"| 学生姓名 | {sheet.student_name} |")
    lines.append(f"| 学生学号 | {sheet.student_id} |")
    lines.append(f"| 批次编号 | {sheet.batch_id} |")
    lines.append(f"| 使用方法 | {', '.join(sheet.methods_used)} |")
    status_md = "🔴 **待确认**" if sheet.final_status == "待确认" else "🟢 **正常**"
    lines.append(f"| 最终状态 | {status_md} |")
    lines.append(f"| 生成时间 | {sheet.generated_at} |\n")

    lines.append("## 一、测量结果汇总\n")
    lines.append("| 方法 | 测量声速(m/s) | 理论声速(m/s) | 相对误差(%) | 波长(m) | 状态 |")
    lines.append("|------|--------------|--------------|------------|---------|------|")
    for s in sheet.results_summary:
        status_md = "🟢 正常" if s["状态"] == "正常" else "🟡 待确认"
        lines.append(f"| {s['方法']} | {s['测量声速(m/s)']} | {s['理论声速(m/s)']} | {s['相对误差(%)']}% | {s['波长(m)']} | {status_md} |")
    lines.append("")

    if sheet.anomalies_found:
        lines.append("## 二、检测到的异常\n")
        lines.append("| # | 类型 | 方法 | 位置 | 严重程度 | 描述 |")
        lines.append("|---|------|------|------|----------|------|")
        for i, a in enumerate(sheet.anomalies_found, 1):
            severity = "🚨 高" if a["严重程度"] == "high" else "⚠️ 中"
            lines.append(f"| {i} | {a['异常类型']} | {a['方法']} | {a['位置']} | {severity} | {a['描述']} |")
        lines.append("")
    else:
        lines.append("## 二、异常检测\n")
        lines.append("✅ 未检测到任何异常。\n")

    lines.append("## 三、自动判断理由\n")
    for reason in sheet.reasons:
        if reason.startswith("\n【"):
            lines.append(f"\n### {reason.strip()}")
        else:
            lines.append(f"- {reason.strip()}")
    lines.append("")

    lines.append("## 四、下一步操作建议\n")
    for step in sheet.next_steps:
        if step.startswith("【"):
            lines.append(f"\n### {step}")
        elif step.startswith("  •"):
            lines.append(f"- {step.strip()}")
        else:
            lines.append(f"{step}")
    lines.append("")

    lines.append("---\n")
    lines.append("> 📌 **重要说明**  \n")
    lines.append("> 1. 本批改表为自动生成，如有疑问请联系助教复核。  \n")
    lines.append("> 2. **待确认**状态的结果需人工核实后才能计入成绩。  \n")
    lines.append("> 3. 所有历史版本数据均已保留，可随时追溯。  \n")
    lines.append("> 4. 单位换算错误是本实验最常见问题，请重点关注。\n")

    return "\n".join(lines)


def save_grading_sheet(
    sheet: GradingSheet,
    output_dir: str = "grading_reports",
    format_type: str = "text"
) -> str:
    import os
    os.makedirs(output_dir, exist_ok=True)

    ext = "md" if format_type == "markdown" else "txt"
    filename = os.path.join(output_dir, f"{sheet.batch_id}_批改表.{ext}")

    content = format_grading_sheet(sheet, format_type)

    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)

    return filename


def generate_full_report(
    batch_id: str,
    include_version_diff: bool = True
) -> str:
    sheet = generate_grading_sheet(batch_id)

    report_parts = []
    report_parts.append(format_grading_sheet(sheet, "text"))

    if include_version_diff:
        diffs = compare_all_versions(batch_id)
        if diffs:
            report_parts.append("\n\n")
            report_parts.append("=" * 70)
            report_parts.append("附录：版本差异历史")
            report_parts.append("=" * 70)
            for diff in diffs:
                report_parts.append("")
                report_parts.append(format_diff_report(diff))

    return "\n".join(report_parts)
