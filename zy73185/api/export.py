from __future__ import annotations
from typing import List, Dict

from sqlalchemy.orm import Session

from . import models, schemas


def _format_time(ms: int) -> str:
    import datetime

    d = datetime.datetime.fromtimestamp(ms / 1000)
    return d.strftime("%Y-%m-%d %H:%M")


_ANOMALY_LABEL = {
    "answer_version_conflict": "答案版本冲突",
    "duplicate_submission": "重复提交",
    "duplicate_sample": "重复样本",
    "missing_note": "后补备注缺失",
}


def anomaly_label(t: str) -> str:
    return _ANOMALY_LABEL.get(t, t)


def draft_to_out(d: models.DraftEntry) -> schemas.DraftOut:
    return schemas.DraftOut(
        id=d.id,
        questionNo=d.question_no,
        answerContent=d.answer_content,
        answerVersion=d.answer_version,
        supplementaryNote=d.supplementary_note,
        rawSource=d.raw_source,
        submittedAt=d.submitted_at,
        submissionFingerprint=d.submission_fingerprint,
    )


def param_to_out(p: models.ParamVersion) -> schemas.ParamVersionOut:
    return schemas.ParamVersionOut(
        id=p.id,
        name=p.name,
        createdAt=p.created_at,
        tolerance=p.tolerance,
        roundingRule=p.rounding_rule,
        sigFigs=p.sig_figs,
        isActive=p.is_active,
    )


def anomaly_to_out(a: models.Anomaly) -> schemas.AnomalyOut:
    return schemas.AnomalyOut(
        id=a.id,
        type=a.type,
        relatedDraftIds=[d.id for d in a.drafts],
        sourceDescription=a.source_description,
        impactScope=a.impact_scope,
        explanation=a.explanation,
        resolved=a.resolved,
        resolverNote=a.resolver_note,
    )


def run_to_out(
    run: models.CalculationRun, include_pv: bool = True
) -> schemas.CalculationRunOut:
    return schemas.CalculationRunOut(
        id=run.id,
        paramVersionId=run.param_version_id,
        paramVersion=param_to_out(run.param_version) if include_pv and run.param_version else None,
        startedAt=run.started_at,
        finishedAt=run.finished_at,
        validDraftIds=list(run.valid_draft_ids or []),
        allDraftIds=list(run.all_draft_ids or []),
        anomalies=[anomaly_to_out(a) for a in run.anomalies],
        summary=run.summary,
        editorNote=run.editor_note,
        batchId=run.batch_id,
    )


def build_markdown_export(
    db: Session, run_id: str
) -> str:
    run = (
        db.query(models.CalculationRun)
        .filter(models.CalculationRun.id == run_id)
        .first()
    )
    if run is None:
        return "# 未找到记录"

    pv = run.param_version
    all_runs = (
        db.query(models.CalculationRun)
        .order_by(models.CalculationRun.started_at.desc())
        .all()
    )
    drafts_by_id = {
        d.id: d
        for d in db.query(models.DraftEntry)
        .filter(models.DraftEntry.id.in_(run.all_draft_ids))
        .all()
    }

    lines: List[str] = []
    lines.append("# 误差传播批量验算 · 交付摘要")
    lines.append("")
    lines.append(f"> 导出时间：{_format_time(int(__import__('time').time() * 1000))}")
    lines.append("")

    lines.append("## 一、当前页面摘要")
    lines.append("")
    lines.append(run.summary)
    lines.append("")
    lines.append(f"- 有效样本（纳入正常汇总）：{len(run.valid_draft_ids)} 条")
    lines.append(f"- 总提交草稿：{len(run.all_draft_ids)} 条")
    unresolved = [a for a in run.anomalies if not a.resolved]
    if unresolved:
        lines.append("")
        lines.append("### 未解决异常清单")
        lines.append("")
        for a in unresolved:
            lines.append(
                f"- **{anomaly_label(a.type)}**：{a.source_description}　"
                f"影响：{a.impact_scope}"
            )
        lines.append("")

    lines.append("## 二、学生草稿（有效样本 vs 异常分开）")
    lines.append("")
    lines.append("### 有效样本（纳入正常汇总）")
    lines.append("")
    lines.append("| 题号 | 答案内容 | 版本 | 后补备注 |")
    lines.append("|---|---|---|---|")
    valid_set = set(run.valid_draft_ids)
    for did in run.valid_draft_ids:
        d = drafts_by_id.get(did)
        if not d:
            continue
        lines.append(
            f"| {d.question_no} | {d.answer_content.replace('|', '｜')} | "
            f"{d.answer_version or '-'} | {d.supplementary_note or '-'} |"
        )
    lines.append("")
    lines.append("### 异常 / 待补看（未纳入正常汇总）")
    lines.append("")
    lines.append("| 题号 | 答案内容 | 异常类型 | 来源描述 | 影响范围 |")
    lines.append("|---|---|---|---|---|")
    anomaly_by_draft: Dict[str, List[models.Anomaly]] = {}
    for a in run.anomalies:
        for d in a.drafts:
            anomaly_by_draft.setdefault(d.id, []).append(a)
    for did, d in drafts_by_id.items():
        if did in valid_set:
            continue
        a_list = anomaly_by_draft.get(did, [])
        labels = "、".join(anomaly_label(a.type) for a in a_list) or "-"
        srcs = "；".join(a.source_description for a in a_list) or "-"
        imps = "；".join(a.impact_scope for a in a_list) or "-"
        lines.append(
            f"| {d.question_no} | {d.answer_content.replace('|', '｜')} | "
            f"{labels} | {srcs} | {imps} |"
        )
    lines.append("")

    lines.append("## 三、处理记录（历史备注留存）")
    lines.append("")
    if not all_runs:
        lines.append("_暂无验算运行记录。_")
    else:
        for r in all_runs:
            r_pv = r.param_version
            lines.append(f"### 运行 @ {_format_time(r.started_at)}")
            lines.append("")
            lines.append(f"- **参数版本**：{r_pv.name if r_pv else r.param_version_id}")
            lines.append(
                f"- **草稿**：总 {len(r.all_draft_ids)} 条 / 有效 {len(r.valid_draft_ids)} 条"
            )
            lines.append(f"- **异常数**：{len(r.anomalies)}")
            lines.append(f"- **自动摘要**：{r.summary}")
            if r.editor_note:
                lines.append(f"- **阿宁备注**：{r.editor_note}")
            lines.append("")

    lines.append("## 四、参数版本档案")
    lines.append("")
    all_pv = db.query(models.ParamVersion).order_by(models.ParamVersion.created_at.desc()).all()
    for p in all_pv:
        lines.append(
            f"- **{p.name}** ({'当前激活' if p.is_active else '历史'})："
            f"容忍阈值 {p.tolerance}，有效数字 {p.sig_figs} 位，"
            f"舍入规则 {p.rounding_rule}，建档于 {_format_time(p.created_at)}"
        )
    return "\n".join(lines)
