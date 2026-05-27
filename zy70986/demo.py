#!/usr/bin/env python3
"""
驿站包裹对账服务 - 完整流程演示

运行方式:
    python demo.py
"""

import json
from datetime import date
from package.importer import DataImporter
from package.reconciler import Reconciler
from package.exporter import ReportExporter
from package.models import DisposalType
from package.sample_data import SAMPLE_PACKAGES_CSV, SAMPLE_SMS_JSON, SAMPLE_RULES_JSON


def print_divider(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    print_divider("驿站包裹对账服务 - 演示开始")

    print_divider("步骤1: 导入数据")
    packages, pkg_errors = DataImporter.import_packages_csv(SAMPLE_PACKAGES_CSV)
    sms, sms_errors = DataImporter.import_sms_json(SAMPLE_SMS_JSON)
    rules, rule_errors = DataImporter.import_rules_json(SAMPLE_RULES_JSON)

    print(f"✓ 导入包裹: {len(packages)} 条")
    print(f"✓ 导入短信: {len(sms)} 条")
    print(f"✓ 导入规则: {len(rules)} 条")
    if pkg_errors or sms_errors or rule_errors:
        print(f"⚠ 错误: {pkg_errors + sms_errors + rule_errors}")

    print_divider("步骤2: 查看样例数据 - 包裹信息（含取件码）")
    for pkg in packages:
        print(f"  [{pkg.package_id}] {pkg.recipient_name} | 取件码: {pkg.pickup_code} | "
              f"到件: {pkg.arrival_date} | 状态: {pkg.status.value}")

    print_divider("步骤3: 自动对账（参考日期 2026-05-27）")
    reconciler = Reconciler(default_overdue_days=7)
    disposals = reconciler.reconcile(packages, sms, rules, reference_date=date(2026, 5, 27))

    type_labels = {
        DisposalType.RELEASE: "✅ 放行",
        DisposalType.RETURN: "🔴 退回",
        DisposalType.SUPPLEMENT: "🟡 补材料",
        DisposalType.MANUAL_REVIEW: "🟠 待复核"
    }

    for d in disposals:
        pkg = next(p for p in packages if p.package_id == d.package_id)
        label = type_labels.get(d.disposal_type, d.disposal_type.value)
        print(f"\n  {label} [{pkg.package_id}] {pkg.recipient_name} (取件码: {pkg.pickup_code})")
        print(f"     原因: {d.reason}")
        for e in d.evidence:
            print(f"     证据: {e}")
        if d.status.value == "pending_review":
            print(f"     ⚠ 需要人工复核")

    print_divider("步骤4: 人工复核 - 修改 PKG004 的处置结果")
    print("  场景: PKG004 被标记为'补材料'，但站长核实后发现收件人已电话联系，同意再放3天")
    print("  操作: 从 'supplement' 改为 'release'，并记录复核意见")

    modified = reconciler.review_disposal(
        package_id="PKG004",
        new_disposal_type=DisposalType.RELEASE,
        review_note="已与收件人电话沟通，收件人将于三日内取件，暂不放行退回",
        reviewer="张站长"
    )
    print(f"\n  ✓ 复核完成")
    print(f"     处置类型: {type_labels.get(modified.disposal_type)}")
    print(f"     复核人: {modified.reviewed_by}")
    print(f"     复核意见: {modified.review_note}")

    print_divider("步骤5: 重新计算（保留已复核记录）")
    updated = reconciler.recalculate(packages, sms, rules)
    reviewed_count = sum(1 for d in updated if d.status.value == "reviewed")
    print(f"✓ 重新计算完成，共 {len(updated)} 条记录")
    print(f"✓ 已复核记录: {reviewed_count} 条（不受重新计算影响）")

    print_divider("步骤6: 生成汇总报告")
    summary = ReportExporter.build_summary(packages, list(reconciler.disposals.values()))
    print(json.dumps(summary.model_dump(), ensure_ascii=False, indent=2, default=str))

    print_divider("步骤7: 差异解释 - PKG004 完整证据链")
    explanation = reconciler.explain_disposal("PKG004")
    pkg = next(p for p in packages if p.package_id == "PKG004")
    explanation["pickup_code"] = pkg.pickup_code
    print(f"""
  【包裹信息】
    包裹ID: {explanation['package_id']}
    取件码: {explanation['pickup_code']}
    处置结果: {explanation['disposal_type']}

  【差异原因】
    {chr(10).join(f'  • {r}' for r in explanation['reasons'])}

  【证据链】
    {chr(10).join(f'  • {e}' for e in explanation['evidence'])}

  【复核信息】
    复核人: {explanation['reviewed_by']}
    复核意见: {explanation['review_note']}

  【审计追踪】
""")
    for log in reconciler.get_audit_logs("PKG004"):
        print(f"    {log.timestamp.strftime('%H:%M:%S')} | {log.action:15} | {log.operator}")
        if log.old_value:
            print(f"      旧值: {log.old_value}")
        if log.new_value:
            print(f"      新值: {log.new_value}")

    print_divider("步骤8: 导出报告")
    csv_content = ReportExporter.export_details_csv(packages, list(reconciler.disposals.values()))
    excel_bytes = ReportExporter.export_excel(
        packages, list(reconciler.disposals.values()), summary, reconciler.audit_logs
    )

    with open("reconciliation_details.csv", "w", encoding="utf-8-sig") as f:
        f.write(csv_content)
    with open("reconciliation_full.xlsx", "wb") as f:
        f.write(excel_bytes)

    print("✓ reconciliation_details.csv 已生成")
    print("✓ reconciliation_full.xlsx 已生成（含3个工作表: 汇总/明细/审计日志）")

    print_divider("演示完成")
    print("""
  站长可向他人展示 PKG004 的处理依据:
  1. 自动检测发现"重复催取3次"，建议补材料
  2. 人工复核后改为放行，有复核意见和审计记录
  3. 所有改动都在审计日志中可追溯
""")


if __name__ == "__main__":
    main()
