from __future__ import annotations

from typing import List, Dict, Any

from .models import (
    SedimentRecord,
    CommunicationResult,
    RecordStatus,
    ErrorCategory,
    ChangeHistory,
)


STATUS_COLOR_MAP = {
    RecordStatus.RELEASED: "#22c55e",
    RecordStatus.PENDING_EVIDENCE: "#f59e0b",
    RecordStatus.MANUALLY_MODIFIED: "#8b5cf6",
    RecordStatus.SUSPENDED: "#ef4444",
    RecordStatus.CALCULATION_FAILED: "#dc2626",
}


def _build_summary(record: SedimentRecord) -> str:
    bottle_ids = [b.bottle_id for b in record.bottles]
    bottle_text = f"采样瓶{len(bottle_ids)}个"
    if bottle_ids:
        bottle_text += "（" + "、".join(bottle_ids[:3])
        if len(bottle_ids) > 3:
            bottle_text += f"等{len(bottle_ids)}个"
        bottle_text += "）"

    if record.status == RecordStatus.RELEASED:
        conclusion = record.sediment_conclusion or "已完成淤积标注"
        return f"{record.station_code}站{record.target_harbor}：{conclusion}，{bottle_text}，结论可用于最终报告。"

    if record.status == RecordStatus.MANUALLY_MODIFIED:
        version = record.current_version
        conclusion = record.sediment_conclusion or "结论待确认"
        return (
            f"{record.station_code}站{record.target_harbor}：人工改判第{version}版，当前结论「{conclusion}」，"
            f"需与前版结论比对后确认是否进入最终报告。"
        )

    if record.status == RecordStatus.SUSPENDED:
        suspicion_count = len(record.suspicions)
        return (
            f"{record.station_code}站{record.target_harbor}：暂缓处理，{bottle_text}，"
            f"存在{suspicion_count}项疑点（含遥感云遮挡），暂不进入最终报告。"
        )

    if record.status == RecordStatus.CALCULATION_FAILED:
        error_count = len(record.calculation_errors)
        categories = list({e.category.value for e in record.calculation_errors})
        return (
            f"{record.station_code}站{record.target_harbor}：计算失败，{bottle_text}，"
            f"共{error_count}项错误（{ '、'.join(categories)}），无法生成结论。"
        )

    if record.status == RecordStatus.PENDING_EVIDENCE:
        error_count = len(record.calculation_errors)
        valid_count = len(
            [b for b in record.bottles if b.experiment_result is not None]
        )
        return (
            f"{record.station_code}站{record.target_harbor}：待补证据，"
            f"{bottle_text}中{valid_count}个有实验结果，另{error_count}项待处理，暂不出最终结论。"
        )

    return f"{record.station_code}站{record.target_harbor}：状态异常，请核查。"


def _build_pending_actions(record: SedimentRecord) -> List[str]:
    actions: List[str] = []

    if record.status == RecordStatus.PENDING_EVIDENCE:
        for err in record.calculation_errors:
            if err.category == ErrorCategory.MISSING_DATA:
                actions.append(f"补充缺失数据：{err.detail}")
            elif err.category == ErrorCategory.DATA_MISMATCH:
                actions.append(f"核对不一致数据：{err.detail}")
            else:
                actions.append(f"处理{err.category.value}：{err.detail}")

    if record.status == RecordStatus.CALCULATION_FAILED:
        for err in record.calculation_errors:
            actions.append(f"修复{err.category.value}：{err.detail}，建议：{err.suggestion or '无'}")

    if record.status == RecordStatus.SUSPENDED:
        for susp in record.suspicions:
            actions.append(f"核实疑点[{susp.source}]：{susp.content}，原因：{susp.reason}")

    if record.status == RecordStatus.MANUALLY_MODIFIED:
        actions.append("人工改判记录已归档，请与前版结论比对并确认是否重新计算。")
        if record.change_history:
            latest = record.change_history[-1]
            actions.append(f"第{latest.version}版改判原因：{latest.change_reason}")

    if record.status == RecordStatus.RELEASED:
        actions.append("当前结论已放行，可直接进入最终报告。")

    return actions


def _build_detail_sections(record: SedimentRecord) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []

    sections.append(
        {
            "title": "一、淤积结论",
            "items": [
                {"label": "当前状态", "value": record.status.value},
                {"label": "淤积量", "value": f"{record.sediment_value} {record.sediment_unit}" if record.sediment_value is not None else "未计算"},
                {"label": "结论描述", "value": record.sediment_conclusion or "无"},
                {"label": "可否进入最终报告", "value": "是" if record.final_report_ready else "否"},
                {"label": "当前版本", "value": f"第{record.current_version}版"},
            ],
        }
    )

    bottle_items = []
    for b in record.bottles:
        sampling_str = b.sampling_time.strftime("%Y-%m-%d %H:%M") if b.sampling_time else "未记录"
        exp_str = (
            f"{b.experiment_result} {b.experiment_unit}"
            if b.experiment_result is not None
            else "未提供实验结果"
        )
        flags = []
        if b.has_cloud_occlusion:
            flags.append("云遮挡")
        flag_str = f"（{'、'.join(flags)}）" if flags else ""
        bottle_items.append(
            {
                "label": b.bottle_id,
                "value": f"采样时间：{sampling_str}，实验结果：{exp_str}{flag_str}",
            }
        )
    sections.append({"title": "二、涉及采样瓶", "items": bottle_items or [{"label": "无", "value": "尚未提交任何采样瓶"}]})

    if record.calculation_errors:
        err_items = []
        for i, e in enumerate(record.calculation_errors, 1):
            suggestion = f"，建议：{e.suggestion}" if e.suggestion else ""
            field = f"（字段：{e.affected_field}）" if e.affected_field else ""
            err_items.append(
                {
                    "label": f"{i}. [{e.category.value}]",
                    "value": f"{e.detail}{field}{suggestion}",
                }
            )
        sections.append({"title": "三、计算错误与数据异常", "items": err_items})

    if record.suspicions:
        susp_items = []
        for i, s in enumerate(record.suspicions, 1):
            related = "、".join(s.related_bottle_ids) if s.related_bottle_ids else "无"
            susp_items.append(
                {
                    "label": f"{i}. 来源：{s.source}",
                    "value": f"疑点：{s.content}；暂缓原因：{s.reason}；关联采样瓶：{related}",
                }
            )
        sections.append({"title": "四、疑点与暂缓原因", "items": susp_items})

    if record.change_history:
        hist_items = []
        for ch in reversed(record.change_history):
            operator = ch.operator or "未知操作人"
            old_c = ch.old_conclusion or "（无）"
            new_c = ch.new_conclusion or "（无）"
            remark = f"，备注：{ch.new_remark}" if ch.new_remark else ""
            hist_items.append(
                {
                    "label": f"第{ch.version}版  {ch.change_time.strftime('%Y-%m-%d %H:%M')}  {operator}",
                    "value": f"原因：{ch.change_reason}；结论从「{old_c}」改为「{new_c}」{remark}",
                }
            )
        sections.append({"title": "五、变更历史（旧材料 + 新备注 + 改判原因）", "items": hist_items})

    return sections


def format_for_communication(record: SedimentRecord) -> CommunicationResult:
    bottle_ids = [b.bottle_id for b in record.bottles]
    return CommunicationResult(
        record_id=record.record_id,
        station_code=record.station_code,
        target_harbor=record.target_harbor,
        status=record.status,
        status_color=STATUS_COLOR_MAP.get(record.status, "#6b7280"),
        summary=_build_summary(record),
        detail_sections=_build_detail_sections(record),
        bottle_ids=bottle_ids,
        pending_actions=_build_pending_actions(record),
        last_update=record.updated_at,
    )


def format_records_brief(
    records: List[SedimentRecord],
) -> List[Dict[str, Any]]:
    brief_list = []
    for r in records:
        comm = format_for_communication(r)
        brief_list.append(
            {
                "record_id": comm.record_id,
                "station_code": comm.station_code,
                "target_harbor": comm.target_harbor,
                "status": comm.status.value,
                "status_color": comm.status_color,
                "summary": comm.summary,
                "bottle_count": len(comm.bottle_ids),
                "last_update": comm.last_update,
                "has_errors": len(r.calculation_errors) > 0,
                "has_suspicions": len(r.suspicions) > 0,
                "is_manually_modified": r.status == RecordStatus.MANUALLY_MODIFIED,
                "final_report_ready": r.final_report_ready,
            }
        )
    return brief_list
