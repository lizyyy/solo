#!/usr/bin/env python3
from models import Database
from data_import import DataImporter
from reconciliation import ReconciliationEngine
from review_and_report import ReviewManager, ReportGenerator

def main():
    db = Database('linen_reconciliation.db')
    importer = DataImporter(db)
    
    print("=" * 60)
    print("酒店布草对账系统 - 演示")
    print("=" * 60)
    
    print("\n1. 导入送洗CSV数据...")
    success, failed, errors = importer.import_washing_csv('sample_data/washing_sample.csv')
    print(f"   成功导入: {success} 条, 失败: {failed} 条")
    
    print("\n2. 导入回收单JSON数据...")
    success, failed, errors = importer.import_recovery_json('sample_data/recovery_sample.json')
    print(f"   成功导入: {success} 条, 失败: {failed} 条")
    
    print("\n3. 创建对账批次...")
    engine = ReconciliationEngine(db)
    batch_id = engine.create_reconciliation_batch('2024-05-01', '2024-05-31')
    print(f"   对账批次ID: {batch_id}")
    
    print("\n4. 执行自动对账...")
    result = engine.run_reconciliation(batch_id)
    print(f"   对账完成:")
    print(f"   - 对账项数: {result['total_items']}")
    print(f"   - 总送洗数量: {result['total_washing']}")
    print(f"   - 总回收数量: {result['total_recovery']}")
    print(f"   - 总破损数量: {result['total_damage']}")
    print(f"   - 总短少数量: {result['total_shortage']}")
    print(f"   - 最终金额: {result['total_amount']:.2f} 元")
    
    print("\n5. 对账详情:")
    details = engine.get_reconciliation_details(batch_id)
    for detail in details:
        status_icon = "✓" if detail['status'] == 'matched' else "⚠"
        print(f"   {status_icon} {detail['linen_type']}:")
        print(f"      送洗: {detail['washing_quantity']} 件, 回收: {detail['recovery_quantity']} 件")
        print(f"      破损: {detail['damage_quantity']} 件, 短少: {detail['shortage_quantity']} 件")
        print(f"      送洗金额: {detail['washing_amount']:.2f} 元, 短少赔付: {detail['shortage_compensation']:.2f} 元")
        print(f"      破损扣减: {detail['damage_compensation']:.2f} 元, 最终金额: {detail['final_amount']:.2f} 元")
        if detail['discrepancy_reason']:
            print(f"      差异原因: {detail['discrepancy_reason']}")
        print()
    
    print("\n6. 人工复核 - 通过第一条记录...")
    review_manager = ReviewManager(db)
    first_detail = details[0]
    review_result = review_manager.review_detail(
        detail_id=first_detail['id'],
        action='approve',
        note='数据核对无误，同意付款',
        operator='张经理'
    )
    print(f"   复核完成: {first_detail['linen_type']} 已批准")
    
    print("\n7. 修改第二条记录的回收数量...")
    second_detail = details[1]
    revise_result = review_manager.revise_detail(
        detail_id=second_detail['id'],
        recovery_quantity=85,
        note='现场核实回收数量为85件，修正数据',
        operator='李主管'
    )
    print(f"   修改完成: {second_detail['linen_type']} 已更新")
    
    print("\n8. 批量审批所有对账记录...")
    review_manager.batch_approve(batch_id, '系统批量审批')
    print("   批量审批完成")
    
    print("\n9. 生成对账报告...")
    report_generator = ReportGenerator(db)
    import os
    os.makedirs('exports', exist_ok=True)
    report_generator.export_csv(batch_id, 'exports/reconciliation_report.csv')
    report_generator.export_json(batch_id, 'exports/reconciliation_report.json')
    print("   报告已导出到 exports/ 目录")
    
    print("\n10. 最终对账汇总:")
    summary = report_generator.get_review_summary(batch_id)
    print(f"    总项数: {summary['total_items']}")
    print(f"    已匹配: {summary['matched_count']}")
    print(f"    有差异: {summary['discrepancy_count']}")
    print(f"    已批准: {summary['approved_count']}")
    print(f"    短少赔付项: {summary['shortage_count']}")
    print(f"    破损扣减项: {summary['damage_count']}")
    print(f"    最终总金额: {summary['total_amount']:.2f} 元")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)

if __name__ == '__main__':
    main()
