from __future__ import annotations

from combo_odds_checker.models import (
    BoundarySample,
    BoundarySampleReport,
    NextContact,
    SampleStatus,
    ScoringWeightTable,
    WeightEntry,
)


def _determine_next_contact(entry: WeightEntry, has_screenshot: bool) -> NextContact:
    if entry.is_negative and not has_screenshot:
        return NextContact.COURSE_DIRECTOR_WU
    if entry.is_negative and has_screenshot:
        return NextContact.STUDENT_TA
    return NextContact.STUDENT_TA


def _build_reason_kept(entry: WeightEntry, has_screenshot: bool) -> str:
    if not entry.is_negative:
        return "正常样本，无需特殊处理。"
    if entry.old_table_treats_as_missing and not has_screenshot:
        return (
            f"该样本原始值 {entry.raw_value} 为负数，被旧评分权重表标记为缺失。"
            "尚未补录旧公式截图，无法确认是否为计算口径差异，"
            "暂留边界样本待教研负责人吴老师确认后转交学生助教复核。"
        )
    if entry.old_table_treats_as_missing and has_screenshot:
        return (
            f"该样本原始值 {entry.raw_value} 为负数，旧表标记为缺失，"
            "但已补录旧公式截图，可交由学生助教复核是否为口径差异。"
        )
    return "负数样本，旧表未标记为缺失，建议关注。"


def _build_missing_materials(entry: WeightEntry, has_screenshot: bool) -> list[str]:
    materials: list[str] = []
    if entry.is_negative and entry.old_table_treats_as_missing and not has_screenshot:
        materials.append("旧公式截图（需教研负责人吴老师提供）")
    if entry.is_negative:
        materials.append("原始计算口径说明")
    return materials


def generate_boundary_report(
    table: ScoringWeightTable,
    screenshots_by_category: dict[str, list[str]] | None = None,
) -> BoundarySampleReport:
    if screenshots_by_category is None:
        screenshots_by_category = {}

    samples: list[BoundarySample] = []
    for entry in table.entries:
        if not entry.is_negative and not entry.old_table_treats_as_missing:
            continue

        linked = screenshots_by_category.get(entry.category, [])
        has_screenshot = len(linked) > 0

        if entry.is_negative and entry.old_table_treats_as_missing and not has_screenshot:
            status = SampleStatus.NEGATIVE_TREATED_AS_MISSING
        elif entry.is_negative and entry.old_table_treats_as_missing and has_screenshot:
            status = SampleStatus.PENDING_TA_REVIEW
        elif entry.is_negative and not entry.old_table_treats_as_missing:
            status = SampleStatus.PENDING_TA_REVIEW
        else:
            status = SampleStatus.NORMAL

        sample = BoundarySample(
            sample_id=f"S-{entry.row_id:03d}",
            entry=entry,
            status=status,
            reason_kept=_build_reason_kept(entry, has_screenshot),
            missing_materials=_build_missing_materials(entry, has_screenshot),
            next_contact=_determine_next_contact(entry, has_screenshot),
            linked_screenshots=linked,
        )
        samples.append(sample)

    total = len(samples)
    negative_missing = sum(1 for s in samples if s.status == SampleStatus.NEGATIVE_TREATED_AS_MISSING)
    pending_ta = sum(1 for s in samples if s.status == SampleStatus.PENDING_TA_REVIEW)
    corrected = sum(1 for s in samples if s.status == SampleStatus.CORRECTED)

    summary = (
        f"边界样本报告：共检出 {total} 条边界样本，"
        f"其中 {negative_missing} 条负数被旧表当缺失（需补录旧公式截图），"
        f"{pending_ta} 条待学生助教复核，"
        f"{corrected} 条已完成修正。"
    )

    return BoundarySampleReport(
        report_id=f"RPT-{table.table_id}",
        samples=samples,
        summary=summary,
    )


def format_report_human(report: BoundarySampleReport) -> str:
    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("  组合数抽奖赔率核对 — 边界样本报告")
    lines.append("=" * 60)
    lines.append("")
    lines.append(report.summary)
    lines.append("")

    for sample in report.samples:
        lines.append(f"  样本编号：{sample.sample_id}")
        lines.append(f"  状态：{sample.status.value}")
        lines.append(f"  类别：{sample.entry.category}")
        lines.append(f"  原始值：{sample.entry.raw_value}")
        lines.append(f"  权重：{sample.entry.weight}")
        lines.append(f"  保留原因：{sample.reason_kept}")
        if sample.missing_materials:
            lines.append(f"  缺少材料：{'；'.join(sample.missing_materials)}")
        else:
            lines.append("  缺少材料：无")
        lines.append(f"  下一步联系：{sample.next_contact.value}")
        if sample.linked_screenshots:
            lines.append(f"  关联截图：{', '.join(sample.linked_screenshots)}")
        if sample.corrected_at:
            lines.append(f"  修正时间：{sample.corrected_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append("-" * 40)

    lines.append("")
    lines.append("报告生成时间：" + report.generated_at.strftime("%Y-%m-%d %H:%M:%S"))
    lines.append("=" * 60)
    return "\n".join(lines)
