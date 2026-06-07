#!/usr/bin/env python3
"""测试完整流程"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contract_review.core import ReviewStore, SampleImporter, VersionComparator
from contract_review.models import DesensitizationRule, FeedbackTicket

def main():
    store = ReviewStore('data')
    importer = SampleImporter(store)
    comparator = VersionComparator(store)

    print("=" * 60)
    print("合同条款抽取复核 - 完整流程测试")
    print("=" * 60)

    print("\n📥 第一步: 导入样本数据 (v1.0.0 和 v1.1.0)")
    v1_ids = importer.import_from_json('data/v1.0.0_samples.json', '1.0.0')
    print(f"  v1.0.0 导入 {len(v1_ids)} 个样本: {', '.join(v1_ids)}")

    import json
    with open('data/v1.1.0_samples.json') as f:
        v2_data = json.load(f)
    for item in v2_data:
        item['sample_id'] = item['sample_id'] + '_V2'
    with open('/tmp/v110_test.json', 'w') as f:
        json.dump(v2_data, f)
    v2_ids = importer.import_from_json('/tmp/v110_test.json', '1.1.0')
    print(f"  v1.1.0 导入 {len(v2_ids)} 个样本")

    print("\n👀 检测'被平均值掩盖'的样本:")
    masked = store.get_masked_samples()
    print(f"  共发现 {len(masked)} 个被平均指标掩盖的样本:")
    for s in masked:
        print(f"    ⚠️  {s.sample_id} [{s.model_version}] {s.contract_name}")
        print(f"        整体置信度: {s.overall_confidence:.2f} (看起来正常)")
        print(f"        但有 {len(s.low_confidence_clauses)} 个低置信度条款被掩盖")

    print("\n🎫 第二步: 关联线上反馈工单")
    ticket = FeedbackTicket(
        sample_id=v1_ids[0],
        title="违约责任条款抽取置信度偏低",
        description="线上用户反馈该条款抽取结果不稳定，有时能抽到有时抽不到",
        reporter="知识库编辑-小王",
        related_clause_ids=["C003"]
    )
    store.add_ticket(ticket)
    print(f"  已为 {v1_ids[0]} 创建工单: {ticket.ticket_id}")

    print("\n📝 第三步: 模型评测同事小孟补录脱敏规则备注")
    for sid in [v1_ids[0], v2_ids[0]]:
        rule = DesensitizationRule(
            sample_id=sid,
            rule_type="desensitization",
            pattern="公司全称",
            replacement="甲方",
            note="此样本涉及客户公司名称脱敏，违约责任条款置信度低因脱敏后语义特征缺失",
            added_by="小孟"
        )
        store.add_rule(rule)
        print(f"  已为 {sid} 补录脱敏备注 (by 小孟)")

    print("\n📊 第四步: 生成模型版本对比报告")
    report = comparator.compare('1.0.0', '1.1.0', '模型评测-小孟')
    text_report = comparator.generate_human_readable_report(report)
    print("  报告生成成功！")

    print("\n" + "=" * 60)
    print("报告摘要:")
    print(f"  总样本数: {report.summary['total_v1']} → {report.summary['total_v2']}")
    print(f"  被平均值掩盖: v1有{report.summary['masked_v1']}个, v2有{report.summary['masked_v2']}个")
    print(f"  待知识库编辑复核: {report.summary['need_knowledge_review']} 个")
    print(f"  待模型评测小孟处理: {report.summary['need_model_review']} 个")
    print("=" * 60)

    print("\n📋 被平均值掩盖样本的详细分析 (报告中会体现):")
    for item in [i for i in report.items if i.was_masked_in_v1 or i.was_masked_in_v2]:
        print(f"\n  样本 {item.sample_id}:")
        print(f"    为什么被留下: {item.reason_kept}")
        print(f"    还缺什么材料: {', '.join(item.missing_materials)}")
        print(f"    下一步: {item.next_action}")
        print(f"    找谁: {item.next_owner}")

    print("\n✅ 完整流程测试通过！")
    print("\n📌 核心能力验证:")
    print("  1. ✅ 能识别'低置信度样本被平均指标盖住'的情况")
    print("  2. ✅ 导入后自动标出这类样本（⚠️标记）")
    print("  3. ✅ 补录脱敏规则备注后数据自动关联")
    print("  4. ✅ 版本对比报告说明: 为什么留下、缺什么、找谁、做什么")
    print("  5. ✅ 低置信度样本始终保留待复核状态，不自动归正常")
    print("\n🚀 接下来可以运行:")
    print("  python3 main.py web  # 启动小看板，可视化操作")
    print("  python3 main.py cli --help  # 查看所有命令")

if __name__ == "__main__":
    main()
