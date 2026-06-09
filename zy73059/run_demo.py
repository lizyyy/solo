#!/usr/bin/env python3
"""
电梯故障异常归因 - 一键跑通样例。

按样例跑一遍 → 再找接口返回 → 核对交接信息。
运行: python run_demo.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from elevator_attribution import (
    build_sample_dataset, AttributionAPI,
    FilterCriteria, FaultStatus,
)


def _title(s: str):
    print("\n" + "=" * 60)
    print(f"  {s}")
    print("=" * 60)


def _pp(obj, indent: int = 2):
    print(json.dumps(obj, ensure_ascii=False, indent=indent))


def main():
    proc = build_sample_dataset()
    api = AttributionAPI(proc)

    # ============================================================
    # Step 1: 跑一遍样例汇总（和屏幕首页数字一致）
    # ============================================================
    _title("Step 1 —— 汇总页（算法值班人先看这里）")
    criteria = FilterCriteria()
    summary = api.summary(criteria)
    print(f"  filter_criteria（本页/导出共用口径）:")
    _pp(summary["filter_criteria"])
    print(f"\n  统计概览:")
    _pp(summary["summary_stats"])
    print(f"\n  记录列表（和导出数字同源）:")
    for r in summary["records"]:
        tag = " [BLOCKED]" if r["status"] == "已拦截" else ""
        print(f"    - {r['fault_id']} | {r['elevator_id']} | {r['status']}{tag}"
              f" | {r['root_cause'] or '(未归因)'} | conf={r['attribution_confidence']}")

    # ============================================================
    # Step 2: 从汇总追到异常记录 —— 点一条 BLOCKED
    # ============================================================
    _title("Step 2 —— 从汇总一路追到异常记录（链路不断层）")
    blocked_ids = [r["fault_id"] for r in summary["records"] if r["status"] == "已拦截"]
    if blocked_ids:
        target = blocked_ids[0]
        print(f"  追踪目标: {target}")
        detail = api.fault_detail(target)
        print(f"\n  基础信息: fault_id={detail['fault']['fault_id']}, "
              f"status={detail['fault']['status']}")
        print(f"  block_reason: {detail['fault']['block_reason']}")
        print(f"  block_detail: {detail['fault']['block_detail']}")
        t = detail["trace"]
        for ch in t["chains"]:
            print(f"\n  --- 归因链路 chain_id={ch['chain_id']} ---")
            print(f"  [SUMMARY] {ch['summary']}")
            print(f"  [DETAIL ] fault_code={ch['detail']['fault_code']}, "
                  f"occurred_at={ch['detail']['occurred_at']}")
            print(f"  [RAW_LOGS] 共 {len(ch['raw_logs'])} 条传感器日志:")
            for lg in ch["raw_logs"]:
                rev = " [REVOKED]" if lg["is_revoked"] else ""
                note = f" —— {lg['revoke_note']}" if lg.get("revoke_note") else ""
                print(f"    - {lg['log_id']} {lg['ts']} {lg['sensor_type']}="
                      f"{lg['sensor_value']}{rev}{note}")
            print(f"  [CHANGES ] 变动原因 ({len(ch['changes'])} 条):")
            for c in ch["changes"]:
                print(f"    - {c['timestamp']} {c['operator']} "
                      f"[{c['change_type']}] {c['change_note']}")

    # ============================================================
    # Step 3: 导出 —— 筛选口径留在接口返回里，不和屏幕数字分家
    # ============================================================
    _title("Step 3 —— 导出（filter_criteria 一起返回）")
    criteria2 = FilterCriteria(
        start_date="2026-06-08 00:00:00",
        end_date="2026-06-09 23:59:59",
        status_list=[FaultStatus.ATTRIBUTED, FaultStatus.BLOCKED],
        min_confidence=0.0,
    )
    export = api.export(criteria2)
    print(f"  export_ts       : {export['export_ts']}")
    print(f"  total_count     : {export['total_count']}")
    print(f"  filter_criteria :")
    _pp(export["filter_criteria"])
    print(f"  summary_stats.by_status:")
    _pp(export["summary_stats"]["by_status"])
    print(f"\n  NOTE: {export['note']}")

    # ============================================================
    # Step 4: 交接 —— 上一班改了什么
    # ============================================================
    _title("Step 4 —— 交接：上一班改了什么")
    report = api.handover_report(since_ts="2026-06-08 00:00:00")
    print(f"  共 {report['change_count']} 条变更:")
    print(f"\n  --- 交接文字（贴群里就行）---\n{report['handover_text']}\n")
    print("  --- 明细（必要时核对变动前后值）---")
    for c in report["changes"]:
        print(f"  - {c['change_id']} | {c['timestamp']} | {c['operator']} "
              f"| {c['fault_id']} | [{c['change_type']}] {c['change_note']}")

    # ============================================================
    # Step 5: 坏材料来了先看哪里
    # ============================================================
    _title("Step 5 —— 坏材料排查路径")
    tri = api.bad_material_triage()
    print("  三步排查:")
    for s in tri["steps"]:
        print(f"    {s}")
    print(f"\n  [Step1] BLOCKED（先救这里）: 共 {len(tri['blocked'])} 条")
    for b in tri["blocked"]:
        print(f"    - {b['fault_id']} ({b['elevator_id']}) 原因={b['block_reason']}")
        print(f"        说明: {b['block_detail'][:80]}...")
        print(f"        下钻: {b['detail_link']}")
    print(f"\n  [Step2] 存在撤回日志: 共 {len(tri['with_revoked'])} 条")
    for w in tri["with_revoked"]:
        print(f"    - {w['fault_id']} ({w['elevator_id']}) status={w['status']} "
              f"撤回 {len(w['revoked_logs'])} 条")
    print(f"\n  [Step3] 低置信度复核: 共 {len(tri['low_confidence'])} 条")
    for l in tri["low_confidence"]:
        print(f"    - {l['fault_id']} ({l['elevator_id']}) conf={l['confidence']} "
              f"root_cause={l['root_cause']}")

    _title("✅ 样例跑完。接口返回结构见上方 JSON。交接文字可直接复制。")


if __name__ == "__main__":
    main()
