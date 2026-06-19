import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import SettlementEngine
from models import BatchStatus, AlertLevel, ActionType

STATE_FILE = "settlement_state_test.json"
REPORT_FILE = "settlement_report_test.txt"


def check(name, cond, detail=""):
    status = "✅ PASS" if cond else "❌ FAIL"
    print(f"{status} {name}" + (f" - {detail}" if detail else ""))
    if not cond:
        raise AssertionError(name)


def run_full_validation():
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)
    if os.path.exists(REPORT_FILE):
        os.remove(REPORT_FILE)

    demo_data = [
        {"batch_no": "B20260601", "ticket_no": "T001", "artist_name": "乐队A", "amount": 0.0, "remark": "赠票-艺人工作证-音乐节后台"},
        {"batch_no": "B20260601", "ticket_no": "T002", "artist_name": "乐队A", "amount": 380.0, "remark": "售票-内场VIP-歌迷购买"},
        {"batch_no": "B20260601", "ticket_no": "T003", "artist_name": "乐队B", "amount": 0.0, "remark": "赠票-嘉宾票-乐队B成员"},
        {"batch_no": "B20260602", "ticket_no": "T004", "artist_name": "歌手C", "amount": 280.0, "remark": "售票-看台票-正常售票"},
        {"batch_no": "B20260602", "ticket_no": "T005", "artist_name": "组合D", "amount": 280.0, "remark": "售票-看台票-正常售票"},
    ]

    print("\n" + "=" * 60)
    print("  Step 1: 导入音频备注，触发混批判断")
    print("=" * 60)
    engine = SettlementEngine(state_file=STATE_FILE)
    run1 = engine.import_audio_remarks(demo_data, "版权运营小鹿", "audio_remarks_test.txt")
    b1 = run1.batches["B20260601"]
    check("B20260601 初始状态为赠票售票混批", b1.status == BatchStatus.MIXED, f"实际={b1.status.value}")
    check("B20260601 needs_review=True", b1.needs_review == True)
    check("B20260601 无复核人", b1.reviewer is None)
    blocker_alert = next((a for a in run1.alerts if a.batch_no == "B20260601" and a.level == AlertLevel.BLOCKER), None)
    check("B20260601 生成阻断级提醒", blocker_alert is not None)
    check("阻断提醒负责人=录音师", blocker_alert.assignee == "录音师")
    check("阻断提醒 resolved=False", blocker_alert.resolved == False)
    print("  阻断提醒原始备注触发链:")
    for tr in blocker_alert.trigger_remarks:
        print(f"    - {tr}")

    print("\n" + "=" * 60)
    print("  Step 2: 录音师老张复核 B20260601")
    print("=" * 60)
    engine.review_batch(run1.run_id, "B20260601", "录音师老张",
                        "确认T001、T003是赠票，T002是售票，分属不同艺人，可分开结算")
    b1 = run1.batches["B20260601"]
    check("B20260601 状态=已复核", b1.status == BatchStatus.REVIEWED, f"实际={b1.status.value}")
    check("B20260601 needs_review=False", b1.needs_review == False)
    check("B20260601 复核人=录音师老张", b1.reviewer == "录音师老张")
    blocker_alert = next((a for a in run1.alerts if a.batch_no == "B20260601" and a.level == AlertLevel.BLOCKER), None)
    check("B20260601 阻断提醒已解决", blocker_alert and blocker_alert.resolved == True)
    check("阻断提醒负责人已转小鹿", blocker_alert and blocker_alert.assignee == "版权运营小鹿")

    print("\n" + "=" * 60)
    print("  Step 3: 小鹿补 T001/T002/T003 授权期限")
    print("=" * 60)
    for tn, period in [("T001", "2026-06-01至2026-12-31"),
                       ("T002", "2026-06-01至2026-08-31"),
                       ("T003", "2026-06-01至2026-12-31"),
                       ("T004", "2026-06-01至2026-09-30"),
                       ("T005", "2026-06-01至2026-09-30")]:
        engine.update_auth_period(run1.run_id, tn, period, "版权运营小鹿")
    for tn in ["T001", "T002", "T003", "T004", "T005"]:
        t = next((t for t in run1.tickets if t.ticket_no == tn), None)
        check(f"{tn} 授权期限已写入", t and t.auth_period is not None, f"实际={getattr(t, 'auth_period', None)}")

    print("\n" + "=" * 60)
    print("  Step 4: 保存后刷新（新 engine 实例从 JSON 加载）")
    print("=" * 60)
    del engine
    engine2 = SettlementEngine(state_file=STATE_FILE)
    run_restored = engine2.get_latest_run()
    check("刷新后仍能读到运行数据", run_restored is not None)
    b1 = run_restored.batches["B20260601"]
    check("刷新后 B20260601 状态保持已复核", b1.status == BatchStatus.REVIEWED, f"实际={b1.status.value}")
    check("刷新后 B20260601 needs_review=False", b1.needs_review == False)
    check("刷新后 B20260601 复核人保持录音师老张", b1.reviewer == "录音师老张")
    for tn in ["T001", "T002", "T003"]:
        t = next((t for t in run_restored.tickets if t.ticket_no == tn), None)
        check(f"刷新后 {tn} 授权期限保留", t and t.auth_period is not None)

    print("\n" + "=" * 60)
    print("  Step 5: 重新计算（手动再跑一次 _build_batches + _generate_alerts）")
    print("=" * 60)
    engine2._build_batches(run_restored, preserve_existing=True)
    engine2._generate_alerts(run_restored)
    b1 = run_restored.batches["B20260601"]
    check("重算后 B20260601 仍为已复核", b1.status == BatchStatus.REVIEWED, f"实际={b1.status.value}")
    check("重算后 B20260601 needs_review=False", b1.needs_review == False)
    check("重算后 B20260601 复核人=录音师老张", b1.reviewer == "录音师老张")
    b2 = run_restored.batches["B20260602"]
    check("重算后 B20260602 状态=正常", b2.status == BatchStatus.NORMAL)
    blocker_alerts = [a for a in run_restored.alerts if a.batch_no == "B20260601" and a.level == AlertLevel.BLOCKER]
    check("重算后 B20260601 不再出现未解决阻断提醒", not any(not a.resolved for a in blocker_alerts))
    pending_recorder_alerts = [a for a in run_restored.alerts if a.batch_no == "B20260601" and a.assignee == "录音师" and not a.resolved]
    check("重算后负责人不再是录音师", len(pending_recorder_alerts) == 0,
          f"仍有 {len(pending_recorder_alerts)} 条录音师待处理")

    print("\n" + "=" * 60)
    print("  Step 6: rerun（正式重跑结算）")
    print("=" * 60)
    run2 = engine2.rerun(run_restored.run_id, "版权运营小鹿")
    b1_new = run2.batches["B20260601"]
    check("rerun 后 B20260601 状态保持已复核", b1_new.status == BatchStatus.REVIEWED, f"实际={b1_new.status.value}")
    check("rerun 后 B20260601 needs_review=False", b1_new.needs_review == False)
    check("rerun 后 B20260601 复核人=录音师老张", b1_new.reviewer == "录音师老张")
    for tn in ["T001", "T002", "T003"]:
        t = next((t for t in run2.tickets if t.ticket_no == tn), None)
        check(f"rerun 后 {tn} 授权期限保留", t and t.auth_period is not None)
    blocker_alerts_new = [a for a in run2.alerts if a.batch_no == "B20260601" and a.level == AlertLevel.BLOCKER and not a.resolved]
    check("rerun 后 B20260601 无未解决阻断提醒", len(blocker_alerts_new) == 0)

    print("\n" + "=" * 60)
    print("  Step 7: 审计历史核对")
    print("=" * 60)
    audit = engine2.get_audit_trail(run2.run_id)
    review_logs = [l for l in audit if l.action == ActionType.REVIEW and l.target_batch == "B20260601"]
    check("审计中包含老张复核记录", len(review_logs) >= 1)
    if review_logs:
        check("复核记录 before_text 含混批状态", "赠票售票混批" in review_logs[0].before_text)
        check("复核记录 after_text 含已复核", "已复核" in review_logs[0].after_text)
        check("复核记录 reason 是老张的意见", "确认T001、T003是赠票" in review_logs[0].reason)
    auth_logs = [l for l in audit if l.action == ActionType.AUTH_UPDATE and l.target_ticket_no in ["T001", "T002", "T003"]]
    check("审计中包含 T001/T002/T003 三条授权补录记录", len(auth_logs) == 3, f"实际={len(auth_logs)}")
    for al in auth_logs:
        check(f"{al.target_ticket_no} before_text='未补'", "(未补)" in al.before_text)
        check(f"{al.target_ticket_no} after_text 有日期", "2026" in al.after_text)

    print("\n" + "=" * 60)
    print("  Step 8: 生成报告并核对内容")
    print("=" * 60)
    report = engine2.export_report(run2.run_id)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    check("报告不包含'请先转录音师复核确认票种归属'", "请先转录音师复核确认票种归属" not in report,
          "报告中仍出现要求找录音师的阻断文案")
    check("报告包含录音师老张的复核意见", "确认T001、T003是赠票" in report)
    check("报告包含 B20260601 原始备注链", "T001: 赠票-艺人工作证" in report or "赠票-艺人工作证" in report)
    check("报告包含 T001 授权期限", "2026-06-01至2026-12-31" in report)
    check("报告包含 T002 授权期限", "2026-06-01至2026-08-31" in report)
    check("报告包含 T003 授权期限", "2026-06-01至2026-12-31" in report)
    check("报告 B20260601 状态写为已复核", "已复核" in report and "B20260601" in report)
    print(f"  报告已导出: {REPORT_FILE}")

    print("\n" + "=" * 60)
    print("  Step 9: 再刷新一次 + 再导出，确认结果稳定")
    print("=" * 60)
    del engine2
    engine3 = SettlementEngine(state_file=STATE_FILE)
    run_final = engine3.get_latest_run()
    check("最终刷新后 B20260601 状态=已复核", run_final.batches["B20260601"].status == BatchStatus.REVIEWED)
    check("最终刷新后 B20260601 needs_review=False", run_final.batches["B20260601"].needs_review == False)
    report2 = engine3.export_report(run_final.run_id)
    check("再次导出的报告仍不包含找录音师的阻断文案", "请先转录音师复核确认票种归属" not in report2)
    check("再次导出的报告负责人不是录音师", "负责人: 录音师\n" not in report2)

    print("\n" + "=" * 60)
    print("  🎉 全部检查通过")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_full_validation()
    except AssertionError:
        sys.exit(1)
