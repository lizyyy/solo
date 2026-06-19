#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
错口径样例自动验证脚本
覆盖：打开项目 → 导入 wrong_caliber_tickets.csv → 上传 wrong_caliber_audio_remarks.csv
      → 补录 → 保存 → 刷新 → 重算 → 导出票务核销报告
核对：T002/T003/T004/T005 票号、映射后状态、冲突证据、处理判断、历史记录、
      报告详情、导出内容
重点证明：
  1. "统计有冲突但详情为空" 不再出现
  2. "有 4 张冲突票却提示无实质冲突" 不再出现
"""
import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from cli import TicketVerificationCLI
from src import ConflictType, TicketStatus, LeaveStatus


PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"
WARN = "\033[93m⚠ WARN\033[0m"


def assert_true(cond, name, detail=""):
    if cond:
        print(f"{PASS}  {name}" + (f" — {detail}" if detail else ""))
        return True
    else:
        print(f"{FAIL}  {name}" + (f" — {detail}" if detail else ""))
        return False


def main():
    print("=" * 70)
    print("  错口径样例自动验证脚本")
    print("=" * 70)

    cli = TicketVerificationCLI()
    output_dir = os.path.join(Path(__file__).parent.parent, "reports")
    all_pass = True

    # ============ 阶段 A：导入 + 上传 ============
    print("\n[阶段 A] 导入 wrong_caliber_tickets.csv + 上传 wrong_caliber_audio_remarks.csv")
    cli.step1_import_tickets("data/samples/wrong_caliber_tickets.csv", batch_id="VERIFY_A")
    cli.step2_review_audio_remarks("data/samples/wrong_caliber_audio_remarks.csv", "老周")
    cli.step3_update_checklist("老周")

    # 验证 bug 2：不能出现 "状态映射后未检测到实质冲突" 这类错误提示
    # （实际通过冲突数量来验证，CLI 输出已在 step2 中）
    step2_conflict_count = len(cli.conflicts)
    step2_conflict_tickets = len(set(c.ticket_id for c in cli.conflicts))
    all_pass &= assert_true(
        step2_conflict_count > 0,
        "阶段A冲突数 > 0",
        f"实际冲突条数={step2_conflict_count}, 涉及票数={step2_conflict_tickets}"
    )
    all_pass &= assert_true(
        step2_conflict_tickets >= 4,
        "阶段A至少涉及 4 张冲突票(T002/T003/T004/T005)",
        f"实际涉及 {step2_conflict_tickets} 张"
    )

    # ============ 阶段 A 额外验证：补录前 T003/T005 确实是请假+待复核 ============
    print("\n[阶段A额外校验] 补录前验证 T003/T005 为请假+待巡演统筹复核")
    ticket_by_id_A = {t.ticket_id: t for t in cli.tickets}
    for tid in ("T003", "T005"):
        t = ticket_by_id_A.get(tid)
        all_pass &= assert_true(
            t is not None and t.leave_status == LeaveStatus.LEAVE,
            f"[阶段A] {tid} leave_status=请假",
            f"实际={t.leave_status.value if t else 'None'}"
        )
        all_pass &= assert_true(
            t is not None and t.verification_status == TicketStatus.NEED_REVIEW,
            f"[阶段A] {tid} verification_status=待巡演统筹复核",
            f"实际={t.verification_status.value if t else 'None'}"
        )

    # ============ 阶段 B：保存中间态 ============
    print("\n[阶段 B] 保存处理中间态")
    save_before = os.path.join(output_dir, "verify_state_before.json")
    cli.save_state(save_before)
    all_pass &= assert_true(
        Path(save_before).exists() and Path(save_before).stat().st_size > 0,
        "中间态保存文件存在且非空",
        f"文件: {save_before}"
    )

    # ============ 阶段 C：补录 + 刷新 + 重算 ============
    print("\n[阶段 C] 补录 → 刷新 → 重算")
    cli.supplement_tickets("data/samples/supplement_tickets.csv", "老周")
    sup_remarks = cli.audio_parser.parse_file("data/samples/supplement_audio_remarks.csv")
    cli.audio_remarks.extend(sup_remarks)
    cli.refresh_status("老周")
    cli.recalculate_conflicts("老周")

    # ============ 阶段 D：再次保存 + 导出报告 ============
    print("\n[阶段 D] 再次保存 + 导出票务核销报告")
    save_after = os.path.join(output_dir, "verify_state_after.json")
    cli.save_state(save_after)
    report, text_report_path, json_report_path = cli.generate_final_report(output_dir)

    all_pass &= assert_true(
        Path(text_report_path).exists() and Path(text_report_path).stat().st_size > 0,
        "文本报告已导出",
        f"文件: {text_report_path}"
    )
    all_pass &= assert_true(
        Path(json_report_path).exists() and Path(json_report_path).stat().st_size > 0,
        "JSON报告已导出",
        f"文件: {json_report_path}"
    )

    # ============ 核心验证 ============
    print("\n" + "=" * 70)
    print("  核心断言验证")
    print("=" * 70)

    # --- 验证1：报告统计和冲突详情数量一致（bug修复前统计=4,详情=0）---
    report_conflict_count_from_details = len(report.conflicts)
    report_conflict_tickets_from_details = len(set(c.ticket_id for c in report.conflicts))
    stats_total = report.conflict_count + report.need_review_count

    all_pass &= assert_true(
        report_conflict_count_from_details > 0,
        "报告冲突详情条数 > 0 (修复前=0)",
        f"实际详情条数={report_conflict_count_from_details}"
    )
    all_pass &= assert_true(
        report_conflict_tickets_from_details >= 4,
        "报告冲突详情至少覆盖 4 张票 (修复前=0)",
        f"实际覆盖 {report_conflict_tickets_from_details} 张票"
    )
    all_pass &= assert_true(
        report_conflict_tickets_from_details >= (report.conflict_count + report.need_review_count),
        "详情覆盖的票数 ≥ 统计的冲突+待复核票数",
        f"详情票数={report_conflict_tickets_from_details}, "
        f"统计冲突={report.conflict_count}, 统计待复核={report.need_review_count}, "
        f"统计合计={stats_total}"
    )

    # --- 验证2：文本报告不会同时出现"存在冲突: N" 和 "无冲突" ---
    text_content = Path(text_report_path).read_text(encoding="utf-8")
    has_stats_conflict = "存在冲突:" in text_content
    has_detail_no_conflict = "二、冲突详情" in text_content and "无冲突" in text_content.split(
        "二、冲突详情"
    )[1].split("三、")[0]
    all_pass &= assert_true(
        not (has_stats_conflict and has_detail_no_conflict),
        "不会出现『统计有冲突』和『详情写无冲突』并存（原bug）",
        f"统计存在冲突={has_stats_conflict}, 详情写无冲突={has_detail_no_conflict}"
    )

    # --- 验证3：逐条核对 T002/T003/T004/T005 ---
    expected = {
        "T002": {
            "student": "李小红",
            "ticket_status": "已核销",
            "normalized": "已完成",
            "conflict_types": [ConflictType.REPERTOIRE_MISMATCH],
            "ticket_repertoire": "土耳其进行曲",
            "audio_repertoire": "致爱丽丝"
        },
        "T003": {
            "student": "王小华",
            "ticket_status": "已核销",
            "normalized": "已完成",
            "conflict_types": [ConflictType.LEAVE_COUNTED],
            "leave_status": LeaveStatus.LEAVE,
            "is_consumed": True
        },
        "T004": {
            "student": "陈小芳",
            "ticket_status": "已核销",
            "normalized": "已完成",
            "conflict_types": [ConflictType.REPERTOIRE_MISMATCH],
            "ticket_repertoire": "水边的阿狄丽娜",
            "audio_repertoire": "童年的回忆"
        },
        "T005": {
            "student": "刘小伟",
            "ticket_status": "已核销",
            "normalized": "已完成",
            "conflict_types": [ConflictType.LEAVE_COUNTED],
            "leave_status": LeaveStatus.LEAVE,
            "is_consumed": True
        },
    }

    ticket_by_id = {t.ticket_id: t for t in cli.tickets}
    conflicts_by_ticket = {}
    for c in cli.conflicts:
        if c.ticket_id not in conflicts_by_ticket:
            conflicts_by_ticket[c.ticket_id] = []
        conflicts_by_ticket[c.ticket_id].append(c)

    for tid, exp in expected.items():
        print(f"\n--- 核对票号 {tid} ---")
        ticket = ticket_by_id.get(tid)
        ticket_conflicts = conflicts_by_ticket.get(tid, [])

        all_pass &= assert_true(ticket is not None, f"{tid} 票号存在")
        if not ticket:
            continue

        all_pass &= assert_true(
            ticket.student_name == exp["student"],
            f"{tid} 学员姓名正确",
            f"预期={exp['student']}, 实际={ticket.student_name}"
        )
        all_pass &= assert_true(
            ticket.status == exp["ticket_status"],
            f"{tid} 票务原始状态正确",
            f"预期={exp['ticket_status']}, 实际={ticket.status}"
        )
        all_pass &= assert_true(
            ticket.normalized_status == exp["normalized"],
            f"{tid} 映射后状态正确",
            f"预期={exp['normalized']}, 实际={ticket.normalized_status}"
        )
        all_pass &= assert_true(
            len(ticket_conflicts) >= 1,
            f"{tid} 至少有 1 条冲突",
            f"实际={len(ticket_conflicts)} 条"
        )

        # 核对冲突类型
        actual_types = [c.conflict_type for c in ticket_conflicts]
        for et in exp["conflict_types"]:
            all_pass &= assert_true(
                et in actual_types,
                f"{tid} 包含预期冲突类型 {et.value}",
                f"实际类型={[t.value for t in actual_types]}"
            )

        # 核对证据字段是否非空
        for c in ticket_conflicts:
            all_pass &= assert_true(
                c.evidence and len(c.evidence) > 0,
                f"{tid} 冲突 {c.conflict_type.value} 证据不为空",
                f"证据字段数={len(c.evidence)}"
            )
            all_pass &= assert_true(
                c.current_verdict and "待" in c.current_verdict,
                f"{tid} 冲突有『当前判断』字段",
                f"current_verdict={c.current_verdict}"
            )
            all_pass &= assert_true(
                c.handler_status,
                f"{tid} 冲突有『负责人可处理状态』字段",
                f"handler_status={c.handler_status}"
            )

        # 核对曲目证据（T002/T004）
        if "ticket_repertoire" in exp:
            rep_conflicts = [c for c in ticket_conflicts
                             if c.conflict_type == ConflictType.REPERTOIRE_MISMATCH]
            if rep_conflicts:
                c = rep_conflicts[0]
                all_pass &= assert_true(
                    c.ticket_value == exp["ticket_repertoire"],
                    f"{tid} 曲目冲突票务表值正确",
                    f"预期={exp['ticket_repertoire']}, 实际={c.ticket_value}"
                )
                all_pass &= assert_true(
                    c.audio_value == exp["audio_repertoire"],
                    f"{tid} 曲目冲突音频备注值正确",
                    f"预期={exp['audio_repertoire']}, 实际={c.audio_value}"
                )
                all_pass &= assert_true(
                    "audio_raw_remark" in c.evidence and c.evidence["audio_raw_remark"],
                    f"{tid} 曲目冲突保留原始备注证据"
                )

        # 核对请假课时错算（T003/T005）—— 补录后状态可能更新为"补录"
        if "leave_status" in exp:
            all_pass &= assert_true(
                ticket.leave_status in (exp["leave_status"], LeaveStatus.MAKEUP),
                f"{tid} 请假状态正确（补录后可变为补录）",
                f"预期={exp['leave_status'].value} 或 补录, 实际={ticket.leave_status.value}"
            )
            all_pass &= assert_true(
                ticket.is_consumed == exp["is_consumed"],
                f"{tid} 已消耗标记正确",
                f"预期={exp['is_consumed']}, 实际={ticket.is_consumed}"
            )
            all_pass &= assert_true(
                ticket.verification_status in (TicketStatus.NEED_REVIEW, TicketStatus.CONFLICT),
                f"{tid} 核验状态=待巡演统筹复核 或 存在冲突（补录后有其他冲突时为存在冲突）",
                f"实际={ticket.verification_status.value}"
            )

        # 核对历史记录非空
        all_pass &= assert_true(
            len(ticket.history) >= 1,
            f"{tid} 历史记录 ≥ 1 条",
            f"实际={len(ticket.history)} 条"
        )
        for h in ticket.history:
            all_pass &= assert_true(
                h.operator,
                f"{tid} 历史记录包含操作人",
                f"operator={h.operator}"
            )

        # 核对报告文本中出现该票号
        all_pass &= assert_true(
            f"票号: {tid}" in text_content or f"票号{tid}" in text_content,
            f"{tid} 在文本报告冲突详情中出现",
        )

    # --- 验证4：JSON报告也含完整冲突详情 ---
    with open(json_report_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)

    json_conflict_count = len(json_data.get("conflicts", []))
    json_conflict_tickets = len(set(c.get("ticket_id") for c in json_data.get("conflicts", [])))
    all_pass &= assert_true(
        json_conflict_count == report_conflict_count_from_details,
        "JSON报告冲突条数与文本报告一致",
        f"JSON={json_conflict_count}, 文本={report_conflict_count_from_details}"
    )
    all_pass &= assert_true(
        {"T002", "T003", "T004", "T005"}.issubset(set(c.get("ticket_id") for c in json_data.get("conflicts", []))),
        "JSON报告中包含 T002/T003/T004/T005"
    )

    # --- 验证5：状态映射日志存在且正确 ---
    mapping_log = json_data.get("status_mapping_log", [])
    all_pass &= assert_true(
        len(mapping_log) > 0,
        "JSON报告包含状态映射日志",
        f"共 {len(mapping_log)} 条"
    )
    for entry in mapping_log:
        if entry.get("ticket_id") in ("T002", "T003", "T004", "T005"):
            all_pass &= assert_true(
                entry.get("normalized_status") == "已完成",
                f"{entry.get('ticket_id')} 状态映射日志正确",
                f"原始={entry.get('raw_status')}, 映射={entry.get('normalized_status')}"
            )

    # --- 验证6：审计日志存在且正确 ---
    audit_log = json_data.get("audit_entries", [])
    all_pass &= assert_true(
        len(audit_log) >= 10,
        "JSON报告包含审计记录（≥10条）",
        f"共 {len(audit_log)} 条"
    )
    actions = {e.get("action") for e in audit_log}
    expected_actions = {"票务导入", "音频备注补充", "标记待巡演统筹复核",
                        "核对通过", "补录新增", "补录更新", "刷新状态映射",
                        "重算冲突", "音频备注补充到核对表", "保存当前处理状态"}
    for act in expected_actions:
        all_pass &= assert_true(
            any(act in a for a in actions),
            f"审计记录包含动作『{act}』",
            f"实际动作={sorted(list(actions))}"
        )

    # ============ 总结 ============
    print("\n" + "=" * 70)
    if all_pass:
        print(f"\n{PASS} 所有断言通过！错口径样例已闭环验证完成。")
    else:
        print(f"\n{FAIL} 部分断言失败，请检查上方详细输出。")
    print(f"\n生成文件:")
    print(f"  中间态(补录前): {save_before}")
    print(f"  中间态(补录后): {save_after}")
    print(f"  文本报告: {text_report_path}")
    print(f"  JSON报告: {json_report_path}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
