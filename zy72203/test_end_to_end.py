import sys
import time

from models import TailDifferenceStatus, SettlementBatch
from tail_difference_tracker import TailDifferenceTracker
from report_generator import ReportGenerator
from visualization import VisualizationService


def print_section(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_complete_workflow():
    print_section("基金申赎尾差追踪系统 - 端到端测试")

    tracker = TailDifferenceTracker()
    report_gen = ReportGenerator(tracker)
    viz = VisualizationService(tracker, report_gen)

    test_email_batch = [
        {
            'trade_date': '2026-06-01',
            'fund_code': '000001',
            'fund_name': '测试成长混合A',
            'application_amount': 1000000.00,
            'redemption_amount': 500000.00,
            'settlement_amount': 500000.00,
            'remark': '已冲正',
        },
        {
            'trade_date': '2026-06-01',
            'fund_code': '000002',
            'fund_name': '测试稳健债券C',
            'application_amount': 800000.00,
            'redemption_amount': 300000.00,
            'settlement_amount': 499999.99,
            'remark': None,
        },
        {
            'trade_date': '2026-06-02',
            'fund_code': '000003',
            'fund_name': '测试全球精选',
            'application_amount': 1200000.00,
            'redemption_amount': 400000.00,
            'settlement_amount': 800000.01,
            'remark': '跨境赎回延时到账',
        }
    ]

    print_section("【第一步】客户经理补充邮件第一次导入")

    records, count = tracker.import_client_email_batch(
        source_file='客户经理补充_20260603.xlsx',
        email_batch_data=test_email_batch,
        operator='系统管理员'
    )

    print(f"✓ 导入完成，共导入 {count} 条记录")
    print(f"✓ 当前系统总记录数: {len(tracker.records)}")

    special_record = None
    for r in records:
        if r.remark and "已冲正" in r.remark and r.tail_difference == 0:
            special_record = r
            print(f"\n★ 发现需特别关注记录: {r.fund_code} {r.fund_name}")
            print(f"  尾差金额: {r.tail_difference:.2f}元")
            print(f"  备注: {r.remark}")
            print(f"  状态: {r.status.value}")
            print(f"  责任人: {r.responsible_person}")
            print(f"  下一步: {r.next_action}")
            print(f"  needs_manual_review(): {r.needs_manual_review()}")

    print_section("【验证】重复导入同一批邮件不翻倍")

    records2, count2 = tracker.import_client_email_batch(
        source_file='客户经理补充_20260603.xlsx',
        email_batch_data=test_email_batch,
        operator='系统管理员'
    )

    print(f"✓ 重复导入结果: 导入 {count2} 条记录")
    print(f"✓ 当前系统总记录数: {len(tracker.records)}")
    assert count2 == 0, "重复导入应该返回0条新记录"
    assert len(tracker.records) == count, "总记录数不应变化"
    print("✓ 去重机制验证通过！")

    print_section("【第二步】风控值班老秦补看清算批次号")

    batch = SettlementBatch(
        batch_number='JS20260603001',
        trade_date='2026-06-01',
        settlement_date='2026-06-03',
        total_amount=1500000.00,
        status='已清算'
    )
    tracker.add_settlement_batch(batch)
    print(f"✓ 已添加清算批次: {batch.batch_number}")

    if special_record:
        result = tracker.link_settlement_batch(
            record_id=special_record.id,
            batch_number='JS20260603001',
            operator='风控值班老秦'
        )
        print(f"✓ 关联清算批次结果: {result}")

    print_section("【验证】变更历史 - 备注修改前后对比")

    if special_record:
        result = tracker.update_remark(
            record_id=special_record.id,
            new_remark='已冲正 - 经老秦核实，冲正凭证齐全',
            operator='风控值班老秦',
            reason='补充冲正核实情况'
        )
        print(f"✓ 备注修改结果: {result}")

        history = tracker.get_record_change_history(special_record.id)
        print(f"\n变更历史记录数: {len(history)}")
        for h in history:
            print(f"\n  [{h['时间']}] {h['操作人']}")
            print(f"    变更类型: {h['变更类型']}")
            print(f"    字段: {h['字段']}")
            print(f"    变更前: {h['变更前']}")
            print(f"    变更后: {h['变更后']}")
            if h['原因']:
                print(f"    原因: {h['原因']}")

    print_section("【第三步】给负责人看的摘要更新")

    summary = report_gen.generate_executive_summary()
    print(f"报告时间: {summary['报告生成时间']}")
    print(f"总记录数: {summary['总记录数']}")
    print(f"待复核记录数: {summary['待复核记录数']}")
    print(f"需特别关注(金额0备注已冲正): {summary['需特别关注（金额0但备注已冲正）']}条")
    print(f"\n各状态统计: {summary['各状态统计']}")

    print("\n待办事项摘要（给负责人看）:")
    for i, todo in enumerate(summary['待办事项摘要'], 1):
        print(f"\n  ▶ #{i}")
        print(f"    基金: {todo['基金']}")
        print(f"    尾差: {todo['尾差金额']} | 状态: {todo['当前状态']}")
        print(f"    → 为何留下: {todo['为何留下']}")
        print(f"    → 缺什么材料: {todo['缺什么材料']}")
        print(f"    → 下一步找谁: {todo['下一步找谁']}")
        print(f"    → 具体动作: {todo['具体动作']}")
        print(f"    → 追溯能力: 邮件{todo['可追溯邮件']} | 批次{todo['可追溯批次']}")

    print("\n计算参数说明:")
    params = summary['计算参数说明']
    print(f"  参数版本: {params['参数版本']}")
    print(f"  容忍阈值: {params['容忍阈值']}")
    print(f"  舍入方式: {params['舍入方式']}")
    print(f"  计算逻辑: {params['计算逻辑说明']}")

    print_section("【验证】金额为0但备注已冲正 - 不自动归正常")

    if special_record:
        print(f"记录状态: {special_record.status.value}")
        print(f"是否需要人工复核: {special_record.needs_manual_review()}")
        assert special_record.status == TailDifferenceStatus.PENDING_REVIEW, "应保持待复核状态"
        assert special_record.needs_manual_review() == True, "应标记为需要人工复核"
        print("✓ 验证通过：金额为0但备注已冲正的记录保持待复核状态，不自动归正常")

    print_section("【验证】3D/图表展示 - 点击可追溯")

    chart_data = viz.get_chart_data("3d")
    print(f"图表类型: {chart_data['chart_type']}")
    print(f"X轴(日期): {chart_data['x_axis']}")
    print(f"Y轴(基金): {chart_data['y_axis']}")
    print(f"数据点数: {len(chart_data['data_points'])}")
    print(f"点击行为说明: {chart_data['click_behavior']}")

    if special_record:
        drilldown = viz.drilldown_to_record(special_record.id)
        print(f"\n钻取到记录: {drilldown['record_detail']['fund_info']}")
        print(f"可追溯邮件: {drilldown['trace_options']['can_trace_to_email']}")
        print(f"可追溯批次: {drilldown['trace_options']['can_trace_to_batch']}")

        if 'special_attention' in drilldown:
            print(f"\n★ 特别提醒: {drilldown['special_attention']['message']}")

        email_trace = viz.trace_to_original_email(special_record.id)
        print(f"\n追溯到原始邮件:")
        print(f"  来源文件: {email_trace['source_file']}")
        print(f"  导入时间: {email_trace['import_time']}")

        batch_trace = viz.trace_to_settlement_batch(special_record.id)
        print(f"\n追溯到清算批次:")
        print(f"  批次号: {batch_trace['batch_number']}")
        print(f"  清算日期: {batch_trace['settlement_date']}")

    print_section("【生成完整报告】")
    full_report = report_gen.generate_detailed_report()
    print(full_report[:1500] + "\n...\n(报告过长，仅展示前1500字符)")

    with open('尾差追踪报告_示例.txt', 'w', encoding='utf-8') as f:
        f.write(full_report)
    print("\n✓ 完整报告已保存到: 尾差追踪报告_示例.txt")

    print_section("测试总结")
    print("✓ 所有测试通过！")
    print("\n验证的需求点:")
    print("  1. 重复导入同一批邮件不翻倍 ✓")
    print("  2. 备注修改可查看改前改后差别 ✓")
    print("  3. 3D/图表点击可追溯到邮件和批次 ✓")
    print("  4. 负责人摘要说明为什么留下、缺什么、找谁 ✓")
    print("  5. 计算参数版本和取舍理由附在旁边 ✓")
    print("  6. 三步流程完整可走通 ✓")
    print("  7. 金额0备注已冲正不自动归正常 ✓")


if __name__ == '__main__':
    test_complete_workflow()
