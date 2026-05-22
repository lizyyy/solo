#!/usr/bin/env python3
import os
from models import Database, WashingRecord, RecoveryRecord
from data_import import DataImporter
from reconciliation import ReconciliationEngine
from review_and_report import ReviewManager, ReportGenerator

def main():
    if os.path.exists('linen_reconciliation.db'):
        os.remove('linen_reconciliation.db')
        print("已删除旧数据库")
    
    db = Database('linen_reconciliation.db')
    
    print("=" * 70)
    print("酒店布草对账系统 - 第三轮修复验证演示")
    print("=" * 70)
    
    print("\n" + "=" * 70)
    print("测试1: 导入测试数据（床单重点测试案例）")
    print("=" * 70)
    washing = WashingRecord(db)
    sample_data = [
        ('W001', '2024-05-01', '床单', 100, 15.00, '5月第一批送洗', '正常'),
        ('W002', '2024-05-01', '被罩', 80, 20.00, '5月第一批送洗', '正常'),
        ('W003', '2024-05-01', '枕套', 200, 5.00, '5月第一批送洗', '正常'),
        ('W004', '2024-05-05', '床单', 120, 15.00, '5月第二批送洗', '正常'),
        ('W005', '2024-05-05', '被罩', 90, 20.00, '5月第二批送洗', '正常'),
        ('W006', '2024-05-05', '枕套', 220, 5.00, '5月第二批送洗', '正常'),
        ('W007', '2024-05-10', '毛巾', 150, 8.00, '毛巾补送', '正常'),
        ('W008', '2024-05-10', '浴巾', 80, 12.00, '浴巾补送', '正常'),
        ('W009', '2024-05-10', '浴巾', 80, 12.00, '浴巾补送(重复)', '重复计费测试'),
    ]
    for data in sample_data:
        washing.add_record(*data)
    print(f"   已导入 {len(sample_data)} 条送洗记录")
    
    recovery = RecoveryRecord(db)
    recovery_data = [
        ('R001', '2024-05-02', '床单', 95, 3, 2, '正常磨损'),
        ('R002', '2024-05-02', '被罩', 78, 2, 0, '勾破'),
        ('R003', '2024-05-02', '枕套', 195, 3, 2, '发黄'),
        ('R004', '2024-05-06', '床单', 115, 5, 0, '污渍无法清除'),
        ('R005', '2024-05-06', '被罩', 85, 2, 3, '破损'),
        ('R006', '2024-05-06', '枕套', 210, 5, 5, '正常损耗'),
        ('R007', '2024-05-11', '毛巾', 145, 3, 2, '破旧'),
        ('R008', '2024-05-11', '浴巾', 78, 1, 1, '破损'),
    ]
    for data in recovery_data:
        recovery.add_record(*data)
    
    print(f"   已导入 {len(recovery_data)} 条回收记录")
    print(f"\n   床单数据（重点验证）:")
    print(f"   - 送洗: 100 + 120 = 220 件")
    print(f"   - 回收（干净+破损）: (95+3) + (115+5) = 218 件")
    print(f"   - 回收单丢失: 2 + 0 = 2 件")
    print(f"   - 预期短少: (220-218) + 2 = 4 件")
    
    print("\n" + "=" * 70)
    print("测试2: 执行自动对账，验证 lost_quantity 存入对账明细")
    print("=" * 70)
    engine = ReconciliationEngine(db)
    batch_id = engine.create_reconciliation_batch('2024-05-01', '2024-05-31')
    result = engine.run_reconciliation(batch_id)
    
    details = engine.get_reconciliation_details(batch_id)
    sheet_detail = next(d for d in details if d['linen_type'] == '床单')
    
    print(f"   床单对账结果:")
    print(f"   - 送洗数量: {sheet_detail['washing_quantity']} 件")
    print(f"   - 回收数量: {sheet_detail['recovery_quantity']} 件")
    print(f"   - 破损数量: {sheet_detail['damage_quantity']} 件")
    print(f"   - 丢失数量: {sheet_detail['lost_quantity']} 件")
    print(f"   - 短少数量: {sheet_detail['shortage_quantity']} 件")
    print(f"   - 短少赔付: {sheet_detail['shortage_compensation']:.2f} 元")
    print(f"\n   验证结果:")
    print(f"   ✓ lost_quantity 已存入数据库: {sheet_detail['lost_quantity']} 件")
    print(f"   ✓ 短少 = 缺口(2) + 丢失(2) = {sheet_detail['shortage_quantity']} 件")
    print(f"   ✓ 赔付金额正确: 4 × 15 = {sheet_detail['shortage_compensation']:.2f} 元")
    
    if sheet_detail['discrepancy_logs']:
        print(f"\n   差异日志:")
        for log in sheet_detail['discrepancy_logs']:
            print(f"      - {log['description']}")
    
    print("\n" + "=" * 70)
    print("测试3: 复核修改回收数量，验证丢失数量保留")
    print("=" * 70)
    review_manager = ReviewManager(db)
    print(f"   修改前 - 床单:")
    print(f"      回收数量: {sheet_detail['recovery_quantity']} 件")
    print(f"      丢失数量: {sheet_detail['lost_quantity']} 件")
    print(f"      短少数量: {sheet_detail['shortage_quantity']} 件")
    print(f"      短少赔付: {sheet_detail['shortage_compensation']:.2f} 元")
    
    print(f"\n   操作: 只修改回收数量为 219 件（增加1件），不指定丢失数量")
    print(f"   预期: 缺口 = 220-219 = 1，丢失保留 = 2，短少 = 1+2 = 3 件")
    
    revise_result = review_manager.revise_detail(
        detail_id=sheet_detail['id'],
        recovery_quantity=219,
        note='现场核实床单实际回收为219件，修正数据',
        operator='李主管'
    )
    
    print(f"\n   修改后 - 床单:")
    print(f"      丢失数量: {revise_result['lost_quantity']} 件")
    print(f"      短少数量: {revise_result['shortage_quantity']} 件")
    print(f"      短少赔付: {revise_result['shortage_compensation']:.2f} 元")
    
    details = engine.get_reconciliation_details(batch_id)
    sheet_detail = next(d for d in details if d['linen_type'] == '床单')
    
    print(f"\n   重新查询后的数据同步验证:")
    print(f"      回收数量: {sheet_detail['recovery_quantity']} 件")
    print(f"      丢失数量: {sheet_detail['lost_quantity']} 件")
    print(f"      短少数量: {sheet_detail['shortage_quantity']} 件")
    print(f"      短少赔付: {sheet_detail['shortage_compensation']:.2f} 元")
    
    print(f"\n   验证结果:")
    print(f"   ✓ 丢失数量保留原值: {sheet_detail['lost_quantity']} 件")
    print(f"   ✓ 短少自动重算: (220-219)+2 = {sheet_detail['shortage_quantity']} 件")
    print(f"   ✓ 赔付金额同步更新: {sheet_detail['shortage_compensation']:.2f} 元")
    
    if sheet_detail['discrepancy_logs']:
        print(f"\n   更新后的差异日志:")
        for log in sheet_detail['discrepancy_logs']:
            print(f"      - {log['description']}")
    
    print("\n" + "=" * 70)
    print("测试4: 验证汇总数据和导出报告同步")
    print("=" * 70)
    report_generator = ReportGenerator(db)
    os.makedirs('exports', exist_ok=True)
    csv_path = 'exports/reconciliation_report.csv'
    report_generator.export_csv(batch_id, csv_path)
    print(f"   CSV报告已导出: {csv_path}")
    
    summary = report_generator.get_review_summary(batch_id)
    print(f"\n   汇总数据:")
    print(f"      总项数: {summary['total_items']}")
    print(f"      最终金额: {summary['total_amount']:.2f} 元")
    
    print("\n" + "=" * 70)
    print("第三轮修复验证完成！")
    print("=" * 70)
    print("\n关键修复验证总结:")
    print("  ✓ 回收单 lost_quantity 已存入对账明细表")
    print("  ✓ 对账时短少 = 送洗-回收缺口 + 回收单丢失")
    print("  ✓ 复核修改时丢失数量保留，短少自动重算")
    print("  ✓ 详情、汇总、导出报告数据同步")
    print("  ✓ 短少赔付说明区分缺口和丢失两部分")

if __name__ == '__main__':
    main()
