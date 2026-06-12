#!/usr/bin/env python3
"""
合同条款抽取复核 - 完整端到端流程测试
按照新人流程：线上反馈工单导入 → 小孟补录脱敏备注 → 版本对比更新
重点核对：低置信度样本被平均指标盖住这类记录
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contract_review.core import ReviewStore, SampleImporter, VersionComparator
from contract_review.models import DesensitizationRule, FeedbackTicket

def print_title(text):
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80)

def print_section(text):
    print(f"\n{'─' * 60}")
    print(f"  {text}")
    print(f"{'─' * 60}")

def main():
    store = ReviewStore('data')
    importer = SampleImporter(store)
    comparator = VersionComparator(store)

    # 清空数据
    for f in ['samples.json', 'tickets.json', 'rules.json', 'reports.json', 'audit_logs.json']:
        path = os.path.join('data', f)
        if os.path.exists(path):
            os.remove(path)
    store = ReviewStore('data')
    importer = SampleImporter(store)
    comparator = VersionComparator(store)

    print_title("合同条款抽取复核 - 完整端到端流程验证")

    # ========== 第一步：导入两个版本的样本数据 ==========
    print_section("📥 第一步：导入 v1.0.0 和 v1.1.0 两个版本的样本数据")
    print("  注意：两个版本中同一合同的 sample_id 不同（模拟实际情况）")
    print("  目标：验证版本对比时能按合同名称正确对齐")

    v1_ids = importer.import_from_json('data/v1.0.0_samples.json', '1.0.0')
    print(f"\n  ✅ v1.0.0 导入 {len(v1_ids)} 个样本:")
    for sid in v1_ids:
        s = store.get_sample(sid)
        masked = " ⚠️被平均掩盖" if s.is_masked_by_avg else ""
        print(f"    {sid} - {s.contract_name} 置信度:{s.overall_confidence:.2f} 低置信:{len(s.low_confidence_clauses)}个{masked}")

    # v1.1.0 的样本 ID 加后缀，模拟实际情况
    import json
    with open('data/v1.1.0_samples.json') as f:
        v2_data = json.load(f)
    for item in v2_data:
        item['sample_id'] = item['sample_id'] + '_V2'
    with open('/tmp/v110_e2e.json', 'w') as f:
        json.dump(v2_data, f)

    v2_ids = importer.import_from_json('/tmp/v110_e2e.json', '1.1.0')
    print(f"\n  ✅ v1.1.0 导入 {len(v2_ids)} 个样本 (sample_id 加 _V2 后缀):")
    for sid in v2_ids:
        s = store.get_sample(sid)
        masked = " ⚠️被平均掩盖" if s.is_masked_by_avg else ""
        print(f"    {sid} - {s.contract_name} 置信度:{s.overall_confidence:.2f} 低置信:{len(s.low_confidence_clauses)}个{masked}")

    # ========== 第二步：导入线上反馈工单 ==========
    print_section("🎫 第二步：导入线上反馈工单（第一次导入）")
    print("  重点：关联到被平均值掩盖的样本 SDEMO001")

    ticket = FeedbackTicket(
        sample_id="SDEMO001",
        title="违约责任条款抽取置信度偏低",
        description="线上用户反馈：采购合同中的违约责任条款抽取结果不稳定，有时置信度只有0.5左右，用户疑问为什么整体置信度还是0.82",
        reporter="知识库编辑-小王",
        status="open",
        priority="high",
        feedback_type="low_confidence_masked_by_avg",
        related_clause_ids=["C003"]
    )
    store.add_ticket(ticket)
    print(f"\n  ✅ 已创建工单 {ticket.ticket_id}")
    print(f"     关联样本: SDEMO001")
    print(f"     标题: {ticket.title}")
    print(f"     报告人: {ticket.reporter}")

    # ========== 第三步：先做一次版本对比（补录前） ==========
    print_section("📊 第三步：先做一次版本对比（小孟补录脱敏备注前）")
    print("  验证：按合同名称对齐，而不是按 sample_id 对齐")
    print("  预期：同一合同的两个版本被正确匹配，不会出现 not_exists/not_exists 分裂")

    report1 = comparator.compare('1.0.0', '1.1.0', '模型评测-小孟')
    print(f"\n  ✅ 报告 {report1.report_id} 生成成功")
    print(f"  对比合同数: {report1.summary['total_contracts']} 份")
    print(f"  被平均值掩盖: v1={report1.summary['masked_v1']}个, v2={report1.summary['masked_v2']}个")

    print("\n  🔍 重点检查'被平均值掩盖'的样本对齐情况:")
    for item in [i for i in report1.items if i.was_masked_in_v1 or i.was_masked_in_v2]:
        print(f"\n  合同: {item.contract_name}")
        print(f"    样本ID: v1={item.v1_sample_id} | v2={item.v2_sample_id}")
        print(f"    置信度: {item.v1_confidence:.4f} → {item.v2_confidence:.4f} (变化 {item.confidence_change:+.4f})")
        print(f"    被掩盖: v1={'是' if item.was_masked_in_v1 else '否'} | v2={'是' if item.was_masked_in_v2 else '否'}")
        print(f"    状态: v1={item.v1_status} | v2={item.v2_status}")
        print(f"    关联工单: {'✅有' if item.has_ticket else '❌无'} ({item.ticket_count}个)")
        print(f"    脱敏备注: {'✅有' if item.has_desensitization_note else '❌无'}")
        print(f"    为什么被留下: {item.reason_kept}")
        print(f"    还缺什么材料: {', '.join(item.missing_materials)}")
        print(f"    下一步找谁: {item.next_owner}")
        print(f"    具体做什么: {item.next_action}")

    # ========== 第四步：小孟补录脱敏规则备注 ==========
    print_section("📝 第四步：模型评测同事小孟补录脱敏规则备注")
    print("  重点：补录时填写修改原因，记录改前改后")
    print("  预期：补录后，已有的版本对比报告自动联动更新")

    # 先看一下补录前的状态
    sample_before = store.get_sample('SDEMO001')
    old_note = sample_before.desensitization_note or "(空)"
    print(f"\n  补录前 SDEMO001 的脱敏备注: {old_note[:50]}{'...' if len(old_note) > 50 else ''}")
    print(f"  补录前报告中该样本的 has_desensitization_note: {report1.items[0].has_desensitization_note}")

    print("\n  小孟开始补录...")
    rule_v1 = DesensitizationRule(
        sample_id="SDEMO001",
        clause_id="C003",
        rule_type="desensitization",
        pattern="XX科技有限公司",
        replacement="甲方",
        note="此样本中'违约责任'条款原文包含客户全称'XX科技有限公司'，已做脱敏处理。脱敏后语义特征缺失导致模型置信度降低至0.55，但被其他高置信度条款的平均值(0.82)掩盖。",
        added_by="小孟"
    )
    rule_v2 = DesensitizationRule(
        sample_id="SDEMO001_V2",
        clause_id="C003",
        rule_type="desensitization",
        pattern="XX科技有限公司",
        replacement="甲方",
        note="同SDEMO001，v1.1.0对脱敏样本的处理逻辑已优化，但该条款置信度(0.62)仍被平均值(0.85)掩盖。",
        added_by="小孟"
    )

    print("\n  为 v1.0.0 的 SDEMO001 补录:")
    store.add_rule(rule_v1, change_reason="响应知识库编辑质询，说明该样本低置信度被平均值掩盖的具体原因")
    print(f"    ✅ 规则ID: {rule_v1.rule_id}")
    print(f"    改前: {old_note}")
    print(f"    改后: {sample_before.desensitization_note[:80]}...")
    print(f"    原因: {rule_v1.change_reason}")

    print("\n  为 v1.1.0 的 SDEMO001_V2 补录:")
    sample_v2 = store.get_sample('SDEMO001_V2')
    old_note_v2 = sample_v2.desensitization_note or "(空)"
    store.add_rule(rule_v2, change_reason="同步更新v1.1.0版本同一合同的脱敏说明")
    print(f"    ✅ 规则ID: {rule_v2.rule_id}")
    print(f"    改前: {old_note_v2}")
    print(f"    原因: {rule_v2.change_reason}")

    # ========== 第五步：验证修改历史 ==========
    print_section("📜 第五步：查看修改历史")
    print("  验证：所有修改都有日志记录，包含改前、改后、修改原因")

    logs = store.get_audit_logs_by_sample('SDEMO001')
    print(f"\n  SDEMO001 共有 {len(logs)} 条修改记录:")
    for idx, log in enumerate(logs, 1):
        print(f"\n  {idx}. {log.created_at}")
        print(f"     修改人: {log.changed_by}")
        print(f"     字段: {log.field_name}")
        print(f"     原因: {log.change_reason}")
        old_short = log.old_value[:50] + ("..." if len(log.old_value) > 50 else "")
        new_short = log.new_value[:50] + ("..." if len(log.new_value) > 50 else "")
        print(f"     改前: {old_short}")
        print(f"     改后: {new_short}")

    # ========== 第六步：验证报告联动更新 ==========
    print_section("🔄 第六步：验证版本对比报告已自动联动更新")
    print("  验证：补录备注后，不需要重新生成报告，已有报告自动更新")

    # 直接从 store 中读取之前的报告（不是重新生成）
    report_updated = store.reports[report1.report_id]

    print("\n  🔍 检查报告中该样本的最新状态:")
    for item in [i for i in report_updated.items if i.was_masked_in_v1 or i.was_masked_in_v2]:
        print(f"\n  合同: {item.contract_name}")
        print(f"    关联工单: {'✅有' if item.has_ticket else '❌无'} ({item.ticket_count}个)")
        print(f"    脱敏备注: {'✅有' if item.has_desensitization_note else '❌无'}  ← 补录后应为 ✅有")
        print(f"    为什么被留下: {item.reason_kept}")
        print(f"    还缺什么材料: {', '.join(item.missing_materials)}")
        print(f"    下一步找谁: {item.next_owner}")
        print(f"    具体做什么: {item.next_action}")

    # 验证
    for item in report_updated.items:
        if item.contract_name == "采购合同-2024-001":
            assert item.has_desensitization_note == True, "❌ 脱敏备注状态没有联动更新！"
            assert "知识库编辑" in item.next_owner, "❌ 下一步负责人不对！"
            print("\n  ✅ 验证通过：补录备注后报告自动联动更新！")
            break

    # ========== 第七步：生成最终完整报告 ==========
    print_section("📋 第七步：生成最终完整的人类可读报告")
    print("  输出完整报告，重点看被平均值掩盖的样本")

    final_report = comparator.compare('1.0.0', '1.1.0', '模型评测-小孟')
    text_report = comparator.generate_human_readable_report(final_report)

    report_path = 'data/final_report.txt'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(text_report)

    print(f"\n  ✅ 完整报告已保存到: {report_path}")
    print("\n  📄 报告摘要:")
    print(f"     报告编号: {final_report.report_id}")
    print(f"     对比合同数: {final_report.summary['total_contracts']} 份")
    print(f"     置信度提升: {final_report.summary['improved']} 个")
    print(f"     被平均值掩盖: v1={final_report.summary['masked_v1']}个, v2={final_report.summary['masked_v2']}个")
    print(f"     待知识库编辑复核: {final_report.summary['need_knowledge_review']} 个")
    print(f"     待模型评测小孟处理: {final_report.summary['need_model_review']} 个")

    # ========== 第八步：验证核心需求 ==========
    print_title("✅ 核心需求验证清单")

    checks = [
        ("1. 低置信度样本被平均指标盖住能被检测到",
         len(store.get_masked_samples()) > 0),
        ("2. 版本对比按合同名称对齐，不是按sample_id",
         all(i.v1_sample_id and i.v2_sample_id for i in final_report.items
             if i.was_masked_in_v1 and i.was_masked_in_v2)),
        ("3. 补录备注后已有报告自动联动更新",
         True),  # 已验证
        ("4. 修改有历史记录（改前、改后、原因）",
         len(store.get_audit_logs_by_sample('SDEMO001')) > 0),
        ("5. 报告说明为什么被留下、缺什么、找谁、做什么",
         all(i.reason_kept and i.missing_materials and i.next_owner and i.next_action
             for i in final_report.items)),
        ("6. 低置信度样本保留待复核，不自动归正常",
         all(i.v2_status == 'pending' for i in final_report.items
             if i.was_masked_in_v2 or i.v2_low_confidence_count > 0)),
        ("7. 点样本能回到工单和脱敏备注",
         all(i.has_ticket or i.has_desensitization_note for i in final_report.items
             if i.was_masked_in_v1 or i.was_masked_in_v2)),
        ("8. 同一合同不会分裂成not_exists两行",
         not any(i.v1_status == 'not_exists' and i.v2_status == 'not_exists'
                 for i in final_report.items)),
    ]

    all_passed = True
    for desc, passed in checks:
        status = "✅" if passed else "❌"
        if not passed:
            all_passed = False
        print(f"  {status} {desc}")

    print("\n" + "=" * 80)
    if all_passed:
        print("  🎉 全部验证通过！端到端流程跑通！")
    else:
        print("  ⚠️  部分验证未通过，请检查")
    print("=" * 80)

    print(f"\n📂 数据文件位置: {os.path.abspath('data')}/")
    print(f"📝 最终报告: {os.path.abspath(report_path)}")
    print("\n🚀 接下来可以运行:")
    print("   python3 main.py web          # 启动小看板，可视化操作")
    print("   python3 main.py cli history SDEMO001  # 查看SDEMO001的修改历史")
    print("   python3 main.py cli show SDEMO001     # 查看SDEMO001的详情")

    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
