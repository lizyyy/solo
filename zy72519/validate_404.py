import sys
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from core import WorkflowEngine

def main():
    base_dir = Path(__file__).parent
    sample_dir = base_dir / "data" / "samples"

    engine = WorkflowEngine(
        data_dir=str(base_dir / "data"),
        output_dir=str(base_dir / "output"),
    )

    result = engine.run_three_step_workflow(
        normal_file=str(sample_dir / "normal_work_orders.json"),
        remarks_file=str(sample_dir / "desensitization_remarks.json"),
        wrong_caliber_file=str(sample_dir / "wrong_caliber_work_orders.json"),
        supplementary_file=str(sample_dir / "supplementary_work_orders.json"),
    )

    pending = engine.list_pending_conflicts()
    print(f"=== 周姐待确认冲突数: {len(pending)} ===")
    for c in pending:
        print(f"  - {c['conflict_type']} : {c['work_order_id']} {c['work_order_title']}")

    product_review = [
        c for c in engine.detector.conflicts.values()
        if c.status.value == "need_product_review"
    ]
    print(f"\n=== 产品经理待复核 (need_product_review) 数: {len(product_review)} ===")
    for c in product_review:
        print(f"  冲突ID: {c.id}")
        print(f"  工单ID: {c.work_order_id}")
        print(f"  冲突类型: {c.conflict_type.value}")
        print(f"  状态: {c.status.value}")
        for ev in c.evidence:
            print(f"  证据描述: {ev.description}")
            if "broken_links" in ev.details:
                for bl in ev.details["broken_links"]:
                    print(f"    - 失效链接: {bl['url']} 状态码:{bl['status_code']} 原因:{bl['reason']}")

    print(f"\n=== 所有冲突汇总 ===")
    for c in engine.detector.conflicts.values():
        wo = engine.importer.work_orders.get(c.work_order_id)
        print(f"  [{c.status.value}] {c.conflict_type.value} / {c.work_order_id} / {wo.title if wo else 'N/A'}")

    check_report = engine.run_self_check()
    print(f"\n=== 自检报告 ===")
    for r in check_report["results"]:
        status = "PASS" if r["passed"] else "FAIL"
        print(f"  [{status}] ({r['severity']}) {r['check_name']}: {r['message']}")
        if not r["passed"] and "problematic_orders" in r["details"]:
            for p in r["details"]["problematic_orders"]:
                print(f"    -> {p.get('issue_type','')} {p['work_order_id']}: {p['broken_link']} (status={p.get('conflict_status','N/A')})")

    engine.export_all()
    print("\n所有数据已导出，output/ 和 reports/")

if __name__ == "__main__":
    main()
