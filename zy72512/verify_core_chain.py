#!/usr/bin/env python3
"""
验证脚本：证明手机号漏遮不会被"导入时已检测完成"掩盖，
低置信度身份证也不会绕过算法复核。

运行方式: python3 verify_core_chain.py
会自行初始化数据，无需先运行 demo。
"""

import json
import sys
import os
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from ocr_review.storage.store import DataStore
from ocr_review.detector.phone_leak_detector import LeakDetector, OCR_LOW_CONFIDENCE_THRESHOLD
from ocr_review.review.workflow import ReviewWorkflow
from ocr_review.exporter.export_manager import ExportManager
from ocr_review.audit.audit_checker import AuditChecker
from ocr_review.importer.ticket_importer import TicketImporter
from ocr_review.models.rule import MaskRule, RuleStatus, RuleType

PASS = "✅ PASS"
FAIL = "❌ FAIL"


def check(condition, msg):
    if condition:
        print(f"  {PASS} {msg}")
    else:
        print(f"  {FAIL} {msg}")
    return condition


def setup_fresh_data():
    for d in ["data", "output"]:
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d)

    store = DataStore(base_dir="data")

    samples_dir = Path("samples")
    rules_path = samples_dir / "sample_rules.json"
    with open(rules_path, "r", encoding="utf-8") as f:
        rules_data = json.load(f)
    for rd in rules_data:
        rd["rule_type"] = RuleType(rd["rule_type"])
        rd["status"] = RuleStatus(rd["status"])
        rule = MaskRule(**rd)
        store.save_rule(rule)

    importer = TicketImporter(store)
    importer.import_from_json("samples/sample_tickets.json")

    return store


from pathlib import Path


def main():
    all_pass = True

    print("=" * 60)
    print("🔍 核心链路验证脚本")
    print("=" * 60)

    print("\n🛠️ 初始化干净数据...")
    store = setup_fresh_data()
    detector = LeakDetector(store)
    workflow = ReviewWorkflow(store)
    exporter = ExportManager(store, output_dir="output")
    checker = AuditChecker()

    # ========== 验证1: detect 不会报0泄露 ==========
    print("\n📌 验证1: 导入后 detect 不会报0泄露（手机号漏遮可被识别）")
    tickets = store.list_tickets()
    all_results = detector.batch_detect(tickets)
    total_leaked = sum(r.leaked_fields for r in all_results)
    tickets_with_leaks = sum(1 for r in all_results if r.has_leaks)
    all_pass &= check(total_leaked > 0, f"泄露字段总数 > 0 (实际={total_leaked})")
    all_pass &= check(tickets_with_leaks > 0, f"含泄露工单数 > 0 (实际={tickets_with_leaks})")

    # ========== 验证2: 低置信度身份证留给算法 ==========
    print("\n📌 验证2: OCR<0.7的身份证自动留给算法同事复核")
    ticket_003 = store.load_ticket("TICKET-20260601-003")
    id_card_field = next(f for f in ticket_003.fields if f.field_name == "buyer_id_card")
    all_pass &= check(
        id_card_field.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD,
        f"buyer_id_card OCR={id_card_field.ocr_confidence} < {OCR_LOW_CONFIDENCE_THRESHOLD}"
    )
    all_pass &= check(
        id_card_field.leak_detected,
        f"buyer_id_card leak_detected={id_card_field.leak_detected}"
    )
    detect_result_003 = detector.detect_ticket(ticket_003, auto_mark=False)
    id_card_leak = next((l for l in detect_result_003.leaks if l.field_name == "buyer_id_card"), None)
    all_pass &= check(
        id_card_leak is not None and id_card_leak.needs_algorithm_review,
        f"buyer_id_card needs_algorithm_review={id_card_leak.needs_algorithm_review if id_card_leak else 'N/A'}"
    )

    # ========== 验证3: 运营补备注后低置信度字段仍高风险 ==========
    print("\n📌 验证3: 运营补备注后，低置信度字段仍🔴高风险（不能直接归无风险）")
    review_result = workflow.operation_review(
        "TICKET-20260601-003",
        [{"field_name": "remarks", "note": "运营已补充脱敏规则，文本中手机号纳入遮蔽"}],
        reviewer="老唐",
    )
    ticket_003 = store.load_ticket("TICKET-20260601-003")
    all_pass &= check(
        ticket_003.assignee == "algorithm",
        f"TICKET-003 自动升级给算法 (assignee={ticket_003.assignee})"
    )
    all_pass &= check(
        review_result.escalated_to_algorithm,
        f"运营复核返回 escalated_to_algorithm=True"
    )
    output_before_algo = exporter.generate_export("TICKET-20260601-003", generated_by="verify")
    export_before = store.load_export(output_before_algo.export_id)
    id_card_before = next((f for f in export_before.fields if f.field_name == "buyer_id_card"), None)
    all_pass &= check(
        id_card_before is not None and id_card_before.leak_risk == "high",
        f"运营复核后 buyer_id_card leak_risk=high (actual={id_card_before.leak_risk if id_card_before else 'N/A'})"
    )
    all_pass &= check(
        id_card_before is not None and id_card_before.responsible_role == "algorithm",
        f"运营复核后 buyer_id_card 指给算法同事 (role={id_card_before.responsible_role if id_card_before else 'N/A'})"
    )

    # ========== 验证4: 算法复核后风险清除 ==========
    print("\n📌 验证4: 算法同事复核后，低置信度字段风险清除")
    algo_result = workflow.algorithm_review(
        "TICKET-20260601-003",
        [{"field_name": "buyer_id_card", "note": "算法已确认识别结果正确，已调整OCR模型参数"}],
        reviewer="算法同事",
    )
    all_pass &= check(
        algo_result.new_status.value == "reviewed_by_algorithm",
        f"算法复核后状态=reviewed_by_algorithm (actual={algo_result.new_status.value})"
    )
    output_after_algo = exporter.generate_export("TICKET-20260601-003", generated_by="verify")
    export_after = store.load_export(output_after_algo.export_id)
    id_card_after = next((f for f in export_after.fields if f.field_name == "buyer_id_card"), None)
    all_pass &= check(
        id_card_after is not None and id_card_after.leak_risk == "none",
        f"算法复核后 buyer_id_card leak_risk=none (actual={id_card_after.leak_risk if id_card_after else 'N/A'})"
    )
    all_pass &= check(
        id_card_after is not None and "双重复核" in id_card_after.next_step,
        f"导出说明包含'双重复核' (next_step={id_card_after.next_step if id_card_after else 'N/A'})"
    )

    # ========== 验证5: 全量脱敏复查通过 ==========
    print("\n📌 验证5: 导出文件和存储文件无原始敏感号码")
    output_results = checker.audit_directory("output")
    data_results = checker.audit_directory("data")
    output_issues = sum(len(r.issues) for r in output_results)
    data_issues = sum(len(r.issues) for r in data_results)
    all_pass &= check(output_issues == 0, f"output/ 无原始敏感值 (issues={output_issues})")
    all_pass &= check(data_issues == 0, f"data/ 无原始敏感值 (issues={data_issues})")

    # ========== 验证6: 变更历史可追溯 ==========
    print("\n📌 验证6: 变更历史可追溯（谁改了什么、影响了哪条导出）")
    ticket_003 = store.load_ticket("TICKET-20260601-003")
    has_algo_change = any(
        log.change_type == "algorithm_note_added" and log.field_name == "buyer_id_card"
        for log in ticket_003.change_logs
    )
    all_pass &= check(has_algo_change, "变更历史包含算法对 buyer_id_card 的备注")
    has_affected_exports = any(
        len(log.affected_exports) > 0
        for log in ticket_003.change_logs
    )
    all_pass &= check(has_affected_exports, "变更历史记录了影响的导出ID")

    # ========== 验证7: 结单拦截 ==========
    print("\n📌 验证7: 低置信度字段未经算法复核不能结单")
    ticket_002 = store.load_ticket("TICKET-20260601-002")
    bank_field = next((f for f in ticket_002.fields if f.field_name == "seller_bank_account"), None)
    if bank_field and bank_field.ocr_confidence and bank_field.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD:
        workflow.operation_review(
            "TICKET-20260601-002",
            [{"field_name": "seller_bank_account", "note": "运营已查看"}],
            reviewer="老唐",
        )
        resolve_result = workflow.resolve_ticket("TICKET-20260601-002", resolver="系统")
        all_pass &= check(
            not resolve_result.success,
            f"TICKET-002 低置信度字段未算法复核时结单被拦截"
        )
        all_pass &= check(
            "算法复核" in resolve_result.message or "低置信度" in resolve_result.message,
            f"拦截原因提及算法复核"
        )
    else:
        print(f"  ⏭️ TICKET-002 无低置信度字段(OCR={bank_field.ocr_confidence if bank_field else 'N/A'})，跳过")

    # ========== 验证8: 分步操作一致性 ==========
    print("\n📌 验证8: 分步导入→检测→复核→导出 全链路一致")
    workflow.operation_review(
        "TICKET-20260601-001",
        [
            {"field_name": "buyer_phone", "note": "已补充脱敏规则"},
            {"field_name": "seller_phone", "note": "已补充脱敏规则"},
        ],
        reviewer="老唐",
    )
    output_001 = exporter.generate_export("TICKET-20260601-001", generated_by="verify")
    export_001 = store.load_export(output_001.export_id)
    high_risk_001 = [f for f in export_001.fields if f.leak_risk == "high"]
    all_pass &= check(
        len(high_risk_001) == 0,
        f"TICKET-001 运营复核后无高风险字段 (high_risk={len(high_risk_001)})"
    )

    # ========== 汇总 ==========
    print("\n" + "=" * 60)
    if all_pass:
        print("🎉 全部验证通过！")
    else:
        print("⚠️ 部分验证未通过，请检查上方 FAIL 项")
    print("=" * 60)
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
