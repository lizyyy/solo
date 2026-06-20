#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
404 链接工单处理链完整验证脚本
=========================================================
覆盖：重新导入 → 冲突检测(404) → 历史记录 → 自检报告 → CSV/JSON 导出
重点核对 WO_002、WO_006 的所有字段
"""

import json
import csv
import os
import sys
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
REPORTS_DIR = BASE_DIR / "reports"

errors = []
checks = []


def log_check(name, passed, detail=""):
    checks.append({"name": name, "passed": passed, "detail": detail})
    mark = "✅ PASS" if passed else "❌ FAIL"
    print(f"  [{mark}] {name}")
    if detail:
        print(f"           {detail}")
    if not passed:
        errors.append((name, detail))


def main():
    print("=" * 70)
    print("404链接工单处理链验证脚本")
    print("=" * 70)
    print()

    # 1. 清理旧数据，确保干净可复现
    print("【准备】清理旧的 output/ 和 reports/ 数据")
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    if REPORTS_DIR.exists():
        shutil.rmtree(REPORTS_DIR)
    print("  已清理\n")

    # 2. 运行完整三步流程 + 自检
    print("【步骤1】运行完整三步流程和自检报告生成")
    sys.path.insert(0, str(BASE_DIR))

    from core.workflow import WorkflowEngine

    engine = WorkflowEngine(output_dir=str(OUTPUT_DIR))

    normal = str(BASE_DIR / "data/samples/normal_work_orders.json")
    remarks = str(BASE_DIR / "data/samples/desensitization_remarks.json")
    wrong = str(BASE_DIR / "data/samples/wrong_caliber_work_orders.json")
    suppl = str(BASE_DIR / "data/samples/supplementary_work_orders.json")

    workflow = engine.run_three_step_workflow(normal, remarks, wrong, suppl)
    engine.export_all()
    self_check = engine.run_self_check()
    print("  执行完成\n")

    # 3. 读取所有导出文件
    conflict_json = json.loads((OUTPUT_DIR / "conflict_samples.json").read_text())
    history_json = json.loads((OUTPUT_DIR / "all_history.json").read_text())
    report_json = json.loads(
        (REPORTS_DIR / "self_check_report.json").read_text()
    )
    csv_rows = list(csv.DictReader(
        (OUTPUT_DIR / "conflict_samples.csv").open(encoding="utf-8")
    ))

    # 4. 定位 WO_002、WO_006 的 link_404_passed 冲突
    def find_conflicts(wo_id, ctype="link_404_passed"):
        return [
            c for c in conflict_json
            if c["work_order_id"] == wo_id and c["conflict_type"] == ctype
        ]

    print("【验证】WO_002 和 WO_006 的 link_404_passed 冲突")
    wo002_conflicts = find_conflicts("WO_002")
    wo006_conflicts = find_conflicts("WO_006")
    log_check("WO_002 检测到 link_404_passed 冲突", len(wo002_conflicts) == 1,
              f"实际 {len(wo002_conflicts)} 条")
    log_check("WO_006 检测到 link_404_passed 冲突", len(wo006_conflicts) == 1,
              f"实际 {len(wo006_conflicts)} 条")

    wo002_conf = wo002_conflicts[0] if wo002_conflicts else None
    wo006_conf = wo006_conflicts[0] if wo006_conflicts else None

    # 5. 逐项字段核对
    print("\n【验证】冲突样本 JSON 字段核对")
    for label, conf, expected_links in [
        ("WO_002", wo002_conf, 1),
        ("WO_006", wo006_conf, 2),
    ]:
        if not conf:
            log_check(f"{label}: JSON 冲突对象存在", False)
            continue
        log_check(f"{label}: 状态 = need_product_review",
                  conf["status"] == "need_product_review",
                  f"实际: {conf['status']}")
        log_check(f"{label}: handler = '产品经理复核'",
                  conf["handler"] == "产品经理复核",
                  f"实际: {repr(conf['handler'])}")
        log_check(f"{label}: handle_notes 不为空",
                  bool(conf.get("handle_notes")),
                  f"实际: {repr(conf.get('handle_notes'))}")

        evidence = conf.get("evidence", [])
        log_check(f"{label}: evidence 至少 1 条", len(evidence) >= 1)
        broken_links = []
        for ev in evidence:
            bl = (ev.get("details") or {}).get("broken_links", [])
            broken_links.extend(bl)
        log_check(f"{label}: 证据里失效链接数 = {expected_links}",
                  len(broken_links) == expected_links,
                  f"实际 {len(broken_links)} 条")
        log_check(f"{label}: 失效链接 description 不为空",
                  bool(evidence[0].get("description")) if evidence else False)

    # 6. CSV 导出核对
    print("\n【验证】冲突样本 CSV 字段核对")

    def find_csv(wo_id, ctype="link_404_passed"):
        return [r for r in csv_rows
                if r["工单ID"] == wo_id and r["冲突类型"] == ctype]

    for label, rows, expected_links in [
        ("WO_002", find_csv("WO_002"), 1),
        ("WO_006", find_csv("WO_006"), 2),
    ]:
        if len(rows) != 1:
            log_check(f"{label}: CSV 存在唯一一行", False,
                      f"实际 {len(rows)} 行")
            continue
        row = rows[0]
        log_check(f"{label} CSV: 状态 = need_product_review",
                  row["状态"] == "need_product_review",
                  f"实际: {row['状态']}")
        log_check(f"{label} CSV: 当前责任方 = '产品经理复核'",
                  row["当前责任方"] == "产品经理复核",
                  f"实际: {repr(row['当前责任方'])}")
        log_check(f"{label} CSV: 处理人 = '产品经理复核'",
                  row["处理人"] == "产品经理复核",
                  f"实际: {repr(row['处理人'])}")
        log_check(f"{label} CSV: 失效链接列不为空",
                  bool(row["失效链接"]),
                  f"实际: {repr(row['失效链接'][:60])}")
        log_check(f"{label} CSV: 拦截原因说明不为空",
                  bool(row["拦截原因说明"]),
                  f"实际: {repr(row['拦截原因说明'])}")
        log_check(f"{label} CSV: 是否完成确认 = '否'",
                  row["是否完成确认"] == "否",
                  f"实际: {repr(row['是否完成确认'])}")

    # 7. 历史记录核对
    print("\n【验证】历史记录 all_history.json 核对")
    detect_ops = [h for h in history_json
                  if h["operation_type"] == "detect_conflict"]
    log_check("历史记录存在 detect_conflict 条目", len(detect_ops) > 0,
              f"实际 {len(detect_ops)} 条")

    for label, conf_obj in [("WO_002", wo002_conf), ("WO_006", wo006_conf)]:
        if not conf_obj:
            log_check(f"{label}: 跳过历史记录核对", False, "冲突不存在")
            continue
        matched = [h for h in detect_ops if h["target_id"] == conf_obj["id"]]
        log_check(f"{label}: 历史记录包含该冲突ID", len(matched) == 1,
                  f"匹配 {len(matched)} 条")
        if matched:
            after_state = matched[0].get("after_state") or {}
            log_check(f"{label}: 历史 after_state.handler = '产品经理复核'",
                      after_state.get("handler") == "产品经理复核",
                      f"实际: {repr(after_state.get('handler'))}")
            log_check(f"{label}: 历史 after_state.status = need_product_review",
                      after_state.get("status") == "need_product_review",
                      f"实际: {repr(after_state.get('status'))}")

    # 8. 自检报告核对
    print("\n【验证】自检报告 self_check_report.json 核对")
    link_check = None
    for r in report_json.get("results", []):
        if r["check_name"] == "引用链接404仍被判通过检测":
            link_check = r
            break
    log_check("自检报告含引用链接404项", link_check is not None)
    if link_check:
        log_check("引用链接404检测 passed = false",
                  link_check["passed"] is False,
                  f"实际: {link_check['passed']}")
        log_check("引用链接404 severity = error",
                  link_check["severity"] == "error",
                  f"实际: {link_check['severity']}")
        details = link_check.get("details") or {}
        problematic = details.get("problematic_orders", [])
        has_002 = any(p["work_order_id"] == "WO_002" for p in problematic)
        has_006 = any(p["work_order_id"] == "WO_006" for p in problematic)
        log_check("自检详情包含 WO_002", has_002)
        log_check("自检详情包含 WO_006", has_006)
        # 核对 WO_002/WO_006 的 conflict_status
        for wo_id in ["WO_002", "WO_006"]:
            entry = next((p for p in problematic if p["work_order_id"] == wo_id), None)
            if entry:
                log_check(f"自检详情 {wo_id}: conflict_status = need_product_review",
                          entry.get("conflict_status") == "need_product_review",
                          f"实际: {repr(entry.get('conflict_status'))}")
                log_check(f"自检详情 {wo_id}: issue_type 不为空",
                          bool(entry.get("issue_type")))

    # 9. 汇总
    print()
    print("=" * 70)
    passed = sum(1 for c in checks if c["passed"])
    total = len(checks)
    print(f"验证汇总: {passed}/{total} 通过")
    print("=" * 70)

    if errors:
        print("\n失败项明细:")
        for name, detail in errors:
            print(f"  ❌ {name}")
            if detail:
                print(f"     {detail}")
        sys.exit(1)
    else:
        print("\n✅ 所有验证项通过")
        sys.exit(0)


if __name__ == "__main__":
    main()
