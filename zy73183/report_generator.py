from typing import Dict, List, Optional

from config import STATUS_LABELS
from models import RecordStatus, UnifiedResultSet, ValidatedRecord
from result_engine import describe_filter
from utils import format_number, records_to_dicts


def _progress_bar(actual: int, total: int, width: int = 20) -> str:
    if total == 0:
        return "[" + " " * width + "] 0%"
    filled = int(width * actual / total)
    bar = "█" * filled + "░" * (width - filled)
    pct = int(100 * actual / total)
    return f"[{bar}] {pct}%"


def _split_records(records: List[ValidatedRecord]):
    release_list = [vr for vr in records if vr.can_release]
    supplement_list = [vr for vr in records if not vr.can_release]
    unit_issue_list = [
        vr for vr in records
        if vr.status in (RecordStatus.UNIT_MISSING, RecordStatus.UNIT_INCONSISTENT)
    ]
    late_list = [vr for vr in records if vr.status == RecordStatus.LATE_ARRIVAL]
    supplementary_list = [vr for vr in records if vr.status == RecordStatus.SUPPLEMENTARY]
    return release_list, supplement_list, unit_issue_list, late_list, supplementary_list


def _stats_table(stats) -> str:
    lines = [
        "| 指标 | 数量 | 占比 |",
        "| --- | ---: | ---: |",
        f"| 总记录数 | {stats.total_count} | 100% |",
        f"| 正常 | {stats.normal_count} | {_pct(stats.normal_count, stats.total_count)} |",
        f"| 单位缺失 | {stats.unit_missing_count} | {_pct(stats.unit_missing_count, stats.total_count)} |",
        f"| 单位不一致 | {stats.unit_inconsistent_count} | {_pct(stats.unit_inconsistent_count, stats.total_count)} |",
        f"| 晚到附件 | {stats.late_arrival_count} | {_pct(stats.late_arrival_count, stats.total_count)} |",
        f"| 后补说明 | {stats.supplementary_count} | {_pct(stats.supplementary_count, stats.total_count)} |",
        f"| 待复核 | {stats.pending_review_count} | {_pct(stats.pending_review_count, stats.total_count)} |",
        f"| **可放行** | **{stats.can_release_count}** | **{_pct(stats.can_release_count, stats.total_count)}** |",
        f"| **需补材料** | **{stats.need_supplement_count}** | **{_pct(stats.need_supplement_count, stats.total_count)}** |",
    ]
    if stats.by_category:
        lines.append("")
        lines.append("**按分类统计：**")
        lines.append("")
        lines.append("| 分类 | 数量 |")
        lines.append("| --- | ---: |")
        for cat, cnt in sorted(stats.by_category.items()):
            lines.append(f"| {cat} | {cnt} |")
    if stats.total_standard_value is not None:
        lines.append("")
        lines.append(f"- 可放行记录汇总值：{format_number(stats.total_standard_value)}")
        if stats.avg_standard_value is not None:
            lines.append(f"- 可放行记录均值：{format_number(stats.avg_standard_value)}")
    return "\n".join(lines)


def _pct(part: int, total: int) -> str:
    if total == 0:
        return "0%"
    return f"{int(100 * part / total)}%"


def _supplement_table(records: List[ValidatedRecord]) -> str:
    if not records:
        return "暂无需补材料记录。"
    lines = [
        "| 记录ID | 分类 | 指标 | 原值 | 状态 | 需补内容 | 备注 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for vr in records:
        r = vr.raw
        value_str = f"{r.value} {r.unit or '（缺）'}"
        status_label = STATUS_LABELS.get(vr.status.value, vr.status.value)
        need = "；".join(vr.need_supplement) if vr.need_supplement else "待确认"
        issue = "；".join(vr.issues) if vr.issues else ""
        extra = []
        if r.is_late:
            extra.append("晚到附件")
        if r.supplementary_note:
            extra.append(f"后补: {r.supplementary_note}")
        remark = "；".join([issue] + extra) if (issue or extra) else ""
        lines.append(
            f"| {r.record_id} | {r.category} | {r.metric_name} | {value_str} | {status_label} | {need} | {remark} |"
        )
    return "\n".join(lines)


def _release_table(records: List[ValidatedRecord]) -> str:
    if not records:
        return "暂无可放行记录。"
    lines = [
        "| 记录ID | 分类 | 指标 | 原值 | 标准值 | 标准单位 | 来源 | 备注 |",
        "| --- | --- | --- | --- | ---: | --- | --- | --- |",
    ]
    for vr in records:
        r = vr.raw
        orig = f"{r.value} {r.unit or ''}".strip()
        std = format_number(vr.standard_value)
        std_u = vr.standard_unit or ""
        extra = []
        if r.is_late:
            extra.append("晚到附件")
        if r.supplementary_note:
            extra.append(f"后补说明")
        if vr.status != RecordStatus.NORMAL:
            extra.append(STATUS_LABELS.get(vr.status.value, vr.status.value))
        remark = "；".join(extra) if extra else ""
        lines.append(
            f"| {r.record_id} | {r.category} | {r.metric_name} | {orig} | {std} | {std_u} | {r.source} | {remark} |"
        )
    return "\n".join(lines)


def _unit_issue_table(records: List[ValidatedRecord]) -> str:
    if not records:
        return "无单位问题记录。"
    lines = [
        "> ⚠️ 以下记录存在单位缺失或不一致，**已从正常结果中单独拎出**，不参与标准值汇总。",
        "",
        "| 记录ID | 分类 | 指标 | 原值 | 问题类型 | 具体说明 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for vr in records:
        r = vr.raw
        orig = f"{r.value} {r.unit or '（缺失）'}".strip()
        issue_type = STATUS_LABELS.get(vr.status.value, vr.status.value)
        detail = "；".join(vr.issues) if vr.issues else "单位异常"
        lines.append(
            f"| {r.record_id} | {r.category} | {r.metric_name} | {orig} | {issue_type} | {detail} |"
        )
    return "\n".join(lines)


def _details_table(records: List[ValidatedRecord]) -> str:
    rows = records_to_dicts(records)
    if not rows:
        return "无明细数据。"
    headers = list(rows[0].keys())
    lines = ["| " + " | ".join(headers) + " |"]
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(h, "")) for h in headers) + " |")
    return "\n".join(lines)


def _gap_analysis(result: UnifiedResultSet) -> str:
    s = result.statistics
    lines = []
    if s.unit_missing_count > 0:
        lines.append(f"- 单位缺失 {s.unit_missing_count} 条：请学生补填单位后再纳入汇总。")
    if s.unit_inconsistent_count > 0:
        lines.append(f"- 单位不一致 {s.unit_inconsistent_count} 条：请确认指标维度或修正单位。")
    if s.late_arrival_count > 0:
        lines.append(f"- 晚到附件 {s.late_arrival_count} 条：已并入计算，请确认不影响原始统计口径。")
    if s.supplementary_count > 0:
        lines.append(f"- 后补说明 {s.supplementary_count} 条：建议人工核对与原草稿一致性。")
    if s.pending_review_count > 0:
        lines.append(f"- 待复核 {s.pending_review_count} 条：换算异常，需人工处理。")
    if not lines:
        lines.append("- 当前无缺口，所有记录均已放行。")
    return "\n".join(lines)


def _progress_summary(result: UnifiedResultSet) -> str:
    s = result.statistics
    lines = []
    lines.append(f"- 处理进度：{_progress_bar(s.can_release_count, s.total_count)}")
    lines.append(f"- 已放行 {s.can_release_count} / {s.total_count} 条，待补 {s.need_supplement_count} 条")
    if s.total_standard_value is not None:
        lines.append(f"- 可放行口径汇总值：{format_number(s.total_standard_value)}（标准单位）")
    return "\n".join(lines)


def generate_markdown_report(
    result: UnifiedResultSet,
    title: str = "约束规划图表解释 - 数据核对交接报告",
    late_impact: Optional[Dict] = None,
) -> str:
    records = result.filtered_records
    release_list, supplement_list, unit_issue_list, late_list, supplementary_list = _split_records(records)

    sections = []
    sections.append(f"# {title}")
    sections.append("")
    sections.append(f"**生成时间**：{result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}  ")
    sections.append(f"**数据源哈希**：`{result.source_hash}`（筛选条件、统计、明细表、报告均基于同一套结果生成）")
    sections.append("")
    sections.append(f"**筛选条件**：{describe_filter(result.filter_criteria)}")
    sections.append("")

    sections.append("## 一、处理进度")
    sections.append("")
    sections.append(_progress_summary(result))
    sections.append("")

    sections.append("## 二、缺口分析")
    sections.append("")
    sections.append(_gap_analysis(result))
    sections.append("")

    if late_impact is not None:
        sections.append("## 三、晚到附件复算对比")
        sections.append("")
        sections.append(f"- 复算前可放行汇总值：{format_number(late_impact['before_release_total'])}")
        sections.append(f"- 复算后可放行汇总值：{format_number(late_impact['after_release_total'])}")
        delta_str = format_number(late_impact["delta_value"])
        sign = "+" if late_impact["delta_value"] >= 0 else ""
        sections.append(f"- 变化量：{sign}{delta_str}")
        if late_impact["delta_percent"] is not None:
            sections.append(f"- 变化幅度：{sign}{format_number(late_impact['delta_percent'])}%")
        sections.append(f"- 新增记录：{', '.join(late_impact['added_record_ids']) if late_impact['added_record_ids'] else '无'}")
        sections.append(f"- 受影响记录：{', '.join(late_impact['changed_record_ids']) if late_impact['changed_record_ids'] else '无'}")
        sections.append(f"- 图表与明细口径一致：{'✅ 是' if late_impact['is_consistent_caliber'] else '❌ 否（请人工核对）'}")
        sections.append("")

    sections.append("## 四、需补材料清单（小孟请重点处理）")
    sections.append("")
    sections.append(_supplement_table(supplement_list))
    sections.append("")

    sections.append("## 五、可放行清单")
    sections.append("")
    sections.append(_release_table(release_list))
    sections.append("")

    sections.append("## 六、单位异常单独拎出记录")
    sections.append("")
    sections.append(_unit_issue_table(unit_issue_list))
    sections.append("")

    sections.append("## 七、统计数字")
    sections.append("")
    sections.append(_stats_table(result.statistics))
    sections.append("")

    sections.append("## 八、明细表（与统计、图表同一口径）")
    sections.append("")
    sections.append(_details_table(records))
    sections.append("")

    return "\n".join(sections)
