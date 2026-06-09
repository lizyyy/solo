from pathlib import Path
from typing import Any, Dict, List

from .auditor import get_audit_run, get_registered_rules
from .config import REPORT_OUTPUT_DIR
from .importer import get_record_history


def _severity_icon(sev: str) -> str:
    sev = (sev or "").lower()
    return {
        "error": "🔴",
        "warning": "🟡",
        "info": "🔵",
    }.get(sev, "⚪")


def _status_icon(status: str) -> str:
    return "✅" if status == "pass" else "❌"


def _build_summary_table(run: Dict[str, Any]) -> str:
    total = len(run["results"])
    fail_count = sum(1 for r in run["results"] if r["overall_status"] == "fail")
    pass_count = total - fail_count
    pass_rate = (pass_count / total * 100) if total else 0.0

    per_sev: Dict[str, int] = {}
    per_rule: Dict[str, Dict[str, Any]] = {}
    for r in run["results"]:
        for a in r.get("anomalies", []):
            per_sev[a["severity"]] = per_sev.get(a["severity"], 0) + 1
            rid = a["rule_id"]
            if rid not in per_rule:
                per_rule[rid] = {
                    "rule_id": rid,
                    "rule_name": a["rule_name"],
                    "count": 0,
                    "severity": a["severity"],
                }
            per_rule[rid]["count"] += 1

    lines = []
    lines.append("## 一、复核汇总\n")
    lines.append("| 指标 | 数值 | 说明 |")
    lines.append("| --- | ---: | --- |")
    lines.append(f"| 复核记录总数 | **{total}** | 取各记录的最新版本 |")
    lines.append(
        f"| 通过记录 | {pass_count} | {pass_rate:.1f}% 通过 |"
    )
    mark = " ⚠️ 存在异常" if fail_count > 0 else ""
    lines.append(
        f"| 异常记录 | **{fail_count}** | {(100-pass_rate):.1f}% 需关注{mark} |"
    )
    lines.append("")

    lines.append("### 按严重程度分布\n")
    lines.append("| 严重级别 | 数量 | 标记 |")
    lines.append("| --- | ---: | --- |")
    for sev in ["error", "warning", "info"]:
        lines.append(
            f"| {_severity_icon(sev)} **{sev.upper()}** | {per_sev.get(sev, 0)} | "
            + ("必须修复" if sev == "error" else "建议修复" if sev == "warning" else "可选关注")
            + " |"
        )
    lines.append("")

    lines.append("### 按规则维度汇总（可与明细表中的 rule_id 对应）\n")
    lines.append("| rule_id | 规则名称 | 严重级别 | 触发次数 |")
    lines.append("| --- | --- | --- | ---: |")
    registered = {r["rule_id"]: r for r in get_registered_rules()}
    for rid in sorted(set(list(per_rule.keys()) + list(registered.keys()))):
        info = per_rule.get(rid) or {
            "rule_id": rid,
            "rule_name": registered.get(rid, {}).get("rule_name", "(未触发)"),
            "count": 0,
            "severity": registered.get(rid, {}).get("severity", "-"),
        }
        lines.append(
            f"| `{rid}` | {info['rule_name']} | "
            f"{_severity_icon(info['severity'])} {info['severity']} | **{info['count']}** |"
        )
    lines.append("")
    return "\n".join(lines)


def _build_baseline_section(run: Dict[str, Any]) -> str:
    summary = run.get("baseline_summary")
    if not summary:
        return ""
    lines = []
    lines.append("## 二、与上一版复核对比（人工确认前后变化）\n")
    lines.append(f"> 对比基线 run_tag: `{summary['baseline_run_tag']}`  →  当前 run_tag: `{run['run_tag']}`\n")
    new = summary["new_anomaly_records"]
    fixed = summary["fixed_anomaly_records"]
    still = summary["still_failing_records"]
    lines.append("| 变化类型 | 记录数 | record_id |")
    lines.append("| --- | ---: | --- |")
    lines.append(f"| 🆕 新增异常 | **{len(new)}** | {', '.join('`'+x+'`' for x in new) or '-'} |")
    lines.append(f"| ✅ 已修复 | **{len(fixed)}** | {', '.join('`'+x+'`' for x in fixed) or '-'} |")
    lines.append(f"| 🔁 仍然异常 | **{len(still)}** | {', '.join('`'+x+'`' for x in still) or '-'} |")
    lines.append("")
    return "\n".join(lines)


def _build_history_snippet(record_id: str) -> str:
    history = get_record_history(record_id)
    if len(history) <= 1:
        return f"版本数: {len(history)}（无历史变更）"
    parts = [f"版本数: **{len(history)}** <br>"]
    for v in history:
        operator = v.get("operator") or "系统"
        reason = v.get("change_reason") or "(未说明)"
        cre = v.get("created_at", "")[:16]
        note = v.get("handwritten_note") or ""
        if note and len(note) > 30:
            note = note[:30] + "…"
        att_count = len(v.get("attachments") or [])
        parts.append(
            f"· v{v['version']} @{cre} by {operator} — "
            f"原因:{reason}; 备注:{note or '(无)'}; 附件:{att_count}张"
        )
    return "<br>".join(parts)


def _build_detail_section(run: Dict[str, Any]) -> str:
    lines = []
    lines.append("## 三、异常明细（按记录逐条展开）\n")
    anomaly_results = [r for r in run["results"] if r["overall_status"] == "fail"]
    if not anomaly_results:
        lines.append("> 本次复核未发现异常，全部记录通过。\n")
        return "\n".join(lines)

    lines.append(f"> 共 **{len(anomaly_results)}** 条记录存在问题，按异常数倒序：\n")

    for idx, r in enumerate(anomaly_results, 1):
        pet = r.get("pet_name") or "(未知宠物)"
        owner = r.get("owner_name") or "(未知主人)"
        lines.append(f"### {idx}. `{r['record_id']}` · {pet}（主人: {owner}）\n")
        lines.append(
            f"- 课程: {r.get('course_type') or '-'}  "
            f"训练日期: {r.get('training_date') or '-'}  "
            f"版本: **v{r['version']}**  "
            f"结论: {_status_icon(r['overall_status'])} **{r['overall_status']}**"
        )
        lines.append(f"- 历史追溯: {_build_history_snippet(r['record_id'])}")
        lines.append("")
        lines.append("| rule_id | 严重级别 | 字段 | 异常原因 | 当前值 | 期望值 |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for a in r.get("anomalies", []):
            cur = a.get("current_value") or "-"
            exp = a.get("expected_value") or "-"
            if len(cur) > 40:
                cur = cur[:37] + "…"
            if len(exp) > 40:
                exp = exp[:37] + "…"
            lines.append(
                f"| `{a['rule_id']}` | {_severity_icon(a['severity'])} {a['severity']} "
                f"| `{a.get('field_name') or '-'}` "
                f"| **{a['anomaly_reason']}** "
                f"| {cur} | {exp} |"
            )
        lines.append("")

    pass_results = [r for r in run["results"] if r["overall_status"] == "pass"]
    if pass_results:
        lines.append("## 四、通过记录列表\n")
        lines.append("| record_id | 宠物名 | 主人 | 课程类型 | 训练日期 | 版本 |")
        lines.append("| --- | --- | --- | --- | --- | ---: |")
        for r in pass_results:
            lines.append(
                f"| `{r['record_id']}` | {r.get('pet_name')} "
                f"| {r.get('owner_name')} | {r.get('course_type')} "
                f"| {r.get('training_date')} | v{r['version']} |"
            )
        lines.append("")
    return "\n".join(lines)


def _build_meta_section(run: Dict[str, Any]) -> str:
    lines = []
    lines.append("# 🐾 宠物训练课记录复核报告\n")
    lines.append(f"- **报告编号**: `{run['run_tag']}`")
    lines.append(f"- **触发方式**: {run.get('triggered_by') or 'scheduled'}")
    lines.append(f"- **生成时间**: {run.get('created_at') or '-'}")
    if run.get("baseline_run_tag"):
        lines.append(f"- **基线版本**: `{run['baseline_run_tag']}`（人工确认前的版本）")
    lines.append("")
    return "\n".join(lines)


def render_markdown(run_tag: str, db_path: str = None) -> str:
    run = get_audit_run(run_tag, db_path)
    if not run:
        raise ValueError(f"找不到复核运行: {run_tag}")
    parts = [
        _build_meta_section(run),
        _build_summary_table(run),
    ]
    baseline_block = _build_baseline_section(run)
    if baseline_block:
        parts.append(baseline_block)
    parts.append(_build_detail_section(run))
    return "\n".join(parts)


def save_report(run_tag: str, db_path: str = None, output_dir: str = None) -> str:
    md = render_markdown(run_tag, db_path)
    out_dir = Path(output_dir or REPORT_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    file_path = out_dir / f"audit_report_{run_tag}.md"
    file_path.write_text(md, encoding="utf-8")
    return str(file_path)
