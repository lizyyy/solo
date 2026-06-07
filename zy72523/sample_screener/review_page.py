from datetime import datetime
from typing import Optional
from .models import ScreeningSession, SampleRecord, SampleStatus, NextAction


def generate_review_page(session: ScreeningSession) -> str:
    lines = []
    lines.append("# 📋 低质标注样本筛查 · 产品复盘页")
    lines.append("")
    lines.append(f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"> 筛查会话：`{session.session_id}`")
    lines.append(f"> 创建时间：{session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📊 本次筛查概览")
    lines.append("")
    total = len(session.samples)
    pending = sum(1 for s in session.samples.values() if s.status == SampleStatus.PENDING_REVIEW)
    version_conflict = sum(1 for s in session.samples.values() if s.version_conflict)
    has_correction = sum(1 for s in session.samples.values() if s.manual_corrections)
    lines.append(f"- **样本总数**：{total} 条")
    lines.append(f"- **待运营复核**：{pending} 条")
    lines.append(f"- **模型版本冲突**：{version_conflict} 条（样本编号没变但模型换了）")
    lines.append(f"- **已补录人工改判**：{has_correction} 条")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📝 样本详情（按优先级排列）")
    lines.append("")
    samples = sorted(
        session.samples.values(),
        key=lambda s: (
            0 if s.version_conflict else 1,
            0 if s.status == SampleStatus.PENDING_REVIEW else 1,
            s.first_import_time
        )
    )
    for idx, sample in enumerate(samples, 1):
        lines.extend(_render_sample_card(idx, sample))
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🔄 可重新执行的命令")
    lines.append("")
    lines.append("```bash")
    lines.append(f"# 加载本次筛查会话")
    lines.append(f"python -m sample_screener load {session.session_id}")
    lines.append("")
    lines.append("# 重新生成复盘页")
    lines.append(f"python -m sample_screener review {session.session_id}")
    lines.append("")
    lines.append("# 查看所有待复核样本")
    lines.append(f"python -m sample_screener list {session.session_id} --status pending")
    lines.append("")
    lines.append("# 对某条样本重跑模型")
    lines.append(f"# python -m sample_screener rerun {session.session_id} <样本编号> --model-version v2.1 --conclusion \"新结论\"")
    lines.append("```")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 💡 说明")
    lines.append("")
    lines.append("- 🟡 **模型版本冲突**：模型版本换了但样本编号没变，别急着归正常，先找运营复核人确认")
    lines.append("- 📝 **人工改判表**：结论不能直接照抄，需要算法运营老唐再看一遍原始上下文")
    lines.append("- 📋 **复盘页**：不是冷冰冰的系统日志，是能看懂、能推进、能闭环的工作记录")
    return "\n".join(lines)


def _render_sample_card(idx: int, sample: SampleRecord) -> list:
    lines = []
    tag = ""
    if sample.version_conflict:
        tag = "🟡 版本冲突 "
    if sample.status == SampleStatus.PENDING_REVIEW:
        tag += "⏳ 待复核"
    elif sample.status == SampleStatus.NEED_MORE_INFO:
        tag += "📎 补材料中"
    elif sample.status == SampleStatus.LOW_QUALITY:
        tag += "❌ 低质"
    elif sample.status == SampleStatus.NORMAL:
        tag += "✅ 正常"
    elif sample.status == SampleStatus.RESOLVED:
        tag += "🎉 已闭环"
    lines.append(f"### {idx}. 样本 `{sample.sample_id}` {tag}")
    lines.append("")
    if sample.keep_reason:
        lines.append(f"> 🎯 **为什么这条被留下**：{sample.keep_reason}")
        lines.append("")
    latest_output = sample.get_latest_model_output()
    if latest_output:
        lines.append(f"**最新模型输出**（{latest_output.model_version}，置信度 {latest_output.confidence:.1%}）：")
        lines.append("")
        lines.append(f"> {latest_output.conclusion}")
        lines.append("")
        if latest_output.raw_fragment:
            lines.append("<details>")
            lines.append("<summary>查看模型输出原始片段</summary>")
            lines.append("")
            lines.append("```")
            lines.append(latest_output.raw_fragment)
            lines.append("```")
            lines.append("")
            lines.append("</details>")
            lines.append("")
    latest_correction = sample.get_latest_manual_correction()
    if latest_correction:
        lines.append(f"**人工改判**（{latest_correction.corrected_by}，{latest_correction.correction_time.strftime('%Y-%m-%d')}）：")
        lines.append("")
        lines.append(f"> {latest_correction.corrected_conclusion}")
        lines.append("")
        lines.append(f"**改判原因**：{latest_correction.reason}")
        lines.append("")
    if sample.missing_materials:
        lines.append("📦 **还缺什么材料**：")
        lines.append("")
        for mat in sample.missing_materials:
            lines.append(f"- [ ] {mat}")
        lines.append("")
    if sample.next_action:
        action_icon = {
            NextAction.CONTACT_OPERATIONS: "👥",
            NextAction.CONTACT_ALGO_OPS: "👨‍💼",
            NextAction.WAIT_FOR_MATERIALS: "⏳",
            NextAction.RERUN_MODEL: "🔄"
        }.get(sample.next_action, "➡️")
        lines.append(f"**下一步**：{action_icon} {sample.next_action.value}")
        lines.append("")
    if sample.review_notes:
        lines.append("📝 **复核记录**：")
        lines.append("")
        for note in sample.review_notes:
            tag_str = f" `[{note.tag}]`" if note.tag else ""
            lines.append(f"- **{note.reviewer}**（{note.note_time.strftime('%m-%d %H:%M')}）{tag_str}：{note.note}")
        lines.append("")
    if sample.model_outputs and len(sample.model_outputs) > 1:
        lines.append("<details>")
        lines.append(f"<summary>查看 {len(sample.model_outputs)} 次模型输出历史（重跑 {sample.rerun_count} 次）</summary>")
        lines.append("")
        for i, output in enumerate(sample.model_outputs, 1):
            lines.append(f"- **第{i}次** | 版本 {output.model_version} | {output.output_time.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"  结论：{output.conclusion}")
        lines.append("")
        lines.append("</details>")
        lines.append("")
    lines.append("---")
    lines.append("")
    return lines


def generate_run_log(session: ScreeningSession) -> str:
    lines = []
    lines.append(f"# 筛查会话执行记录 - {session.session_id}")
    lines.append("")
    lines.append(f"创建时间: {session.created_at.isoformat()}")
    lines.append("")
    if session.run_commands:
        lines.append("## 执行过的命令")
        lines.append("")
        for cmd in session.run_commands:
            lines.append(f"```bash")
            lines.append(cmd)
            lines.append("```")
            lines.append("")
    return "\n".join(lines)
