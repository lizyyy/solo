#!/usr/bin/env python3
"""完整流程测试"""

import sys
sys.path.insert(0, 'src')

from pathlib import Path

from agri_finance.importer import import_rate_table, import_job_sheet, import_fuel_log
from agri_finance.billing import process_billing, billing_summary
from agri_finance.database import (
    get_billing_records, get_import_history, get_bad_records,
    review_billing_record, RecordStatus
)
from agri_finance.security import mask_record, export_billing_to_csv

def test_full_flow():
    print("=" * 60)
    print("农机合作社财务系统 - 完整流程测试")
    print("=" * 60)
    
    data_dir = Path('data/raw')
    
    # 1. 导入费率表
    print("\n1. 导入费率表")
    print("-" * 40)
    rate_batch, rate_bad = import_rate_table(data_dir / 'rate_sample.csv', 'test_admin')
    print(f"批次ID: {rate_batch.batch_id}")
    print(f"有效记录: {rate_batch.valid_records}")
    print(f"错误记录: {len(rate_bad)}")
    assert rate_batch.valid_records == 5, f"期望5条有效记录，实际{rate_batch.valid_records}"
    
    # 2. 导入作业单
    print("\n2. 导入作业单")
    print("-" * 40)
    job_batch, job_bad = import_job_sheet(data_dir / 'job_sample.csv', 'test_admin')
    print(f"批次ID: {job_batch.batch_id}")
    print(f"有效记录: {job_batch.valid_records}")
    print(f"错误记录: {len(job_bad)}")
    
    if job_bad:
        print("\n错误记录详情:")
        for b in job_bad[:3]:
            print(f"  行{b.row_number}: {b.error_message}")
            print(f"    建议: {b.suggestion}")
    
    # 3. 导入油耗表
    print("\n3. 导入油耗表")
    print("-" * 40)
    fuel_batch, fuel_bad = import_fuel_log(data_dir / 'fuel_sample.json', 'test_admin')
    print(f"批次ID: {fuel_batch.batch_id}")
    print(f"有效记录: {fuel_batch.valid_records}")
    print(f"错误记录: {len(fuel_bad)}")
    
    # 4. 执行计费
    print("\n4. 执行计费")
    print("-" * 40)
    result = process_billing()
    print(f"已处理: {result['processed']}")
    print(f"跳过(0元): {result['skipped']}")
    print(f"无费率: {result['errors']}")
    print(f"待处理: {result['total_pending']}")
    
    # 5. 查看账单
    print("\n5. 账单汇总")
    print("-" * 40)
    bills = get_billing_records()
    print(f"总账单数: {len(bills)}")
    
    if bills:
        summary = billing_summary(bills)
        print(f"总金额: ¥{summary['total_amount']:.2f}")
        print(f"  - 小时费: ¥{summary['total_hourly']:.2f}")
        print(f"  - 亩费: ¥{summary['total_mu']:.2f}")
        print(f"  - 油费: ¥{summary['total_fuel']:.2f}")
        
        # 显示脱敏后的记录
        print("\n脱敏账单示例:")
        for bill in bills[:2]:
            masked = mask_record(bill.model_dump(), context='display')
            print(f"  {masked.get('tractor_id')}: ¥{masked.get('total_charge')}")
    
    # 6. 复核账单
    print("\n6. 复核账单")
    print("-" * 40)
    if bills:
        review_billing_record(bills[0].id, '财务主管')
        print(f"账单 {bills[0].id} 已复核")
    
    # 7. 查看导入历史
    print("\n7. 导入历史")
    print("-" * 40)
    history = get_import_history(limit=10)
    for h in history:
        print(f"  {h.batch_id}: {h.source_type.value}, 有效{h.valid_records}条")
    
    # 8. 查看错误记录
    print("\n8. 错误记录")
    print("-" * 40)
    bads = get_bad_records()
    print(f"总错误记录: {len(bads)}")
    
    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)

if __name__ == '__main__':
    test_full_flow()
