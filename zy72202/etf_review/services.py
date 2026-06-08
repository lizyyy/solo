import json
from pathlib import Path

from etf_review.models import (
    init_db,
    insert_batch,
    insert_component,
    update_holiday_note,
    confirm_approver,
    get_batch,
    get_components,
    get_balance_changes,
    get_stats,
    list_batches,
    get_component,
)
from etf_review.pinyin_detector import detect_pinyin_approvers, is_pinyin_only


SAMPLE_DATA_PATH = Path(__file__).parent.parent / "sample_data.json"


def import_from_file(filepath: str) -> dict:
    init_db()
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    results = {"batches": [], "components": []}
    for batch_data in data.get("batches", []):
        batch_id = batch_data["batch_id"]
        batch_date = batch_data["batch_date"]
        etf_code = batch_data["etf_code"]
        etf_name = batch_data.get("etf_name", "")

        existing = get_batch(batch_id)
        if existing:
            results["batches"].append({"batch_id": batch_id, "status": "skipped_exists"})
            continue

        insert_batch(batch_id, batch_date, etf_code, etf_name)
        results["batches"].append({"batch_id": batch_id, "status": "imported"})

        components = batch_data.get("components", [])
        flagged = detect_pinyin_approvers(components)

        for comp in flagged:
            cid = insert_component(
                batch_id=batch_id,
                component_code=comp["component_code"],
                component_name=comp["component_name"],
                expected_weight=comp["expected_weight"],
                actual_weight=comp["actual_weight"],
                approver_name=comp["approver_name"],
                approver_is_pinyin=comp["approver_is_pinyin"],
                holiday_extension_note=comp.get("holiday_extension_note", ""),
                flag_reason=comp.get("flag_reason", ""),
            )
            results["components"].append({
                "component_id": cid,
                "code": comp["component_code"],
                "pinyin_flagged": comp["approver_is_pinyin"],
            })

    return results


def supplement_holiday_note(component_id: int, note: str) -> dict:
    return update_holiday_note(component_id, note)


def confirm_approver_name(component_id: int, real_name: str) -> dict:
    return confirm_approver(component_id, real_name)


def get_batch_detail(batch_id: str) -> dict:
    batch = get_batch(batch_id)
    if not batch:
        return {"error": "批次不存在"}
    components = get_components(batch_id)
    balance_changes = get_balance_changes(batch_id)
    return {
        "batch": batch,
        "components": components,
        "balance_changes": balance_changes,
    }


def generate_report(batch_id: str) -> str:
    detail = get_batch_detail(batch_id)
    if "error" in detail:
        return f"错误：{detail['error']}"

    batch = detail["batch"]
    components = detail["components"]
    changes = detail["balance_changes"]

    lines = []
    lines.append("=" * 80)
    lines.append("ETF 篮子成分异常复盘报告")
    lines.append("=" * 80)
    lines.append(f"清算批次号: {batch['batch_id']}")
    lines.append(f"批次日期:   {batch['batch_date']}")
    lines.append(f"ETF代码:    {batch['etf_code']}  {batch.get('etf_name', '')}")
    lines.append(f"报告生成时间: {batch.get('updated_at', '')}")
    lines.append("")

    lines.append("-" * 80)
    lines.append("一、异常成分概览")
    lines.append("-" * 80)
    flagged = [c for c in components if c["status"] != "normal"]
    if not flagged:
        lines.append("  所有成分均正常，无异常项。")
    else:
        for c in flagged:
            flag = "【拼音审批人】" if c["approver_is_pinyin"] else ""
            note_flag = "【缺顺延说明】" if not c.get("holiday_extension_note") and c["deviation"] != 0 else ""
            lines.append(f"  {flag}{note_flag} {c['component_code']} {c['component_name']}")
            lines.append(f"    审批人: {c['approver_name']}  偏差: {c['deviation']}")
            if c.get("flag_reason"):
                lines.append(f"    标记原因: {c['flag_reason']}")

    lines.append("")
    lines.append("-" * 80)
    lines.append("二、余额变化明细")
    lines.append("-" * 80)
    lines.append(f"  {'代码':<10} {'名称':<10} {'变动前':>10} {'变动后':>10} {'变化量':>10}  说明")
    lines.append("  " + "-" * 70)
    for ch in changes:
        line = (
            f"  {ch['component_code']:<10} "
            f"{ch['component_name']:<10} "
            f"{ch['before_balance']:>10.4f} "
            f"{ch['after_balance']:>10.4f} "
            f"{ch['change_amount']:>10.4f}  "
        )
        desc_parts = []
        if ch.get("reason_kept"):
            desc_parts.append(ch["reason_kept"])
        if ch.get("missing_materials") and ch["missing_materials"] != "无":
            desc_parts.append(f"缺: {ch['missing_materials']}")
        if ch.get("next_action") and ch["next_action"] != "无需操作":
            desc_parts.append(f"→ {ch['next_action']}")
        line += "；".join(desc_parts)
        lines.append(line)

    lines.append("")
    lines.append("-" * 80)
    lines.append("三、待办事项")
    lines.append("-" * 80)
    todos = []
    for c in components:
        if c["approver_is_pinyin"]:
            todos.append(f"  □ 找客户经理确认审批人: {c['approver_name']} (成分 {c['component_code']})")
        if not c.get("holiday_extension_note") and c["deviation"] != 0:
            todos.append(f"  □ 投研助理小周补充节假日顺延说明 (成分 {c['component_code']})")
    if not todos:
        todos.append("  无待办事项。")
    lines.extend(todos)

    lines.append("")
    lines.append("=" * 80)
    lines.append("报告结束")
    lines.append("=" * 80)
    return "\n".join(lines)
