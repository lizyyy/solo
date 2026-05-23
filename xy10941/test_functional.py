#!/usr/bin/env python3
"""功能测试脚本"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("门店收银差异对账工具 - 功能测试")
print("=" * 60)
print()

# 1. 测试数据读取
print("1. 测试数据读取模块...")
try:
    from store_reconcile.data_loader import DataLoader
    
    loader = DataLoader(verbose=False)
    cashier_dir = os.path.join(os.path.dirname(__file__), "examples", "cashier")
    payment_dir = os.path.join(os.path.dirname(__file__), "examples", "payment")
    
    cash_df, cash_errors = loader.load_cash_records(cashier_dir, "STORE001")
    print(f"   ✓ 收银流水读取成功: {len(cash_df)} 条有效记录, {len(cash_errors)} 条坏记录")
    
    payment_df, payment_errors = loader.load_payment_records(payment_dir)
    print(f"   ✓ 支付流水读取成功: {len(payment_df)} 条有效记录, {len(payment_errors)} 条坏记录")
    
except Exception as e:
    print(f"   ✗ 数据读取失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# 2. 测试对账逻辑
print("2. 测试对账核心逻辑...")
try:
    from store_reconcile.reconciler import Reconciler
    from datetime import timedelta
    
    reconciler = Reconciler(time_window=timedelta(minutes=5), amount_tolerance=0.01)
    result = reconciler.reconcile(cash_df, payment_df, "STORE001")
    
    print(f"   ✓ 对账完成: {result['summary']['matched']['total']} 条匹配, "
          f"{result['summary']['unmatched']['cashier']['total'] + result['summary']['unmatched']['payment']['total']} 条差异")
    print(f"   ✓ 收银净额: ¥{result['summary']['amount_summary']['cashier_net']:.2f}")
    print(f"   ✓ 支付净额: ¥{result['summary']['amount_summary']['payment_net']:.2f}")
    print(f"   ✓ 差异金额: ¥{result['summary']['amount_summary']['difference']:.2f}")
    
except Exception as e:
    print(f"   ✗ 对账失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# 3. 测试报告生成
print("3. 测试报告生成...")
try:
    from store_reconcile.reporter import Reporter
    import tempfile
    
    output_dir = tempfile.mkdtemp(prefix="reconcile_test_")
    reporter = Reporter(output_dir=output_dir, store_id="STORE001")
    reporter.generate_all(result, cash_errors, payment_errors)
    
    files = os.listdir(output_dir)
    print(f"   ✓ 报告生成目录: {output_dir}")
    for f in sorted(files):
        size = os.path.getsize(os.path.join(output_dir, f))
        print(f"     - {f} ({size} bytes)")
    
except Exception as e:
    print(f"   ✗ 报告生成失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("✅ 所有功能测试通过!")
print("=" * 60)
print()
print("现在可以运行:")
print(f"  python -m store_reconcile.cli -c {cashier_dir} -p {payment_dir} -s STORE001")
print()
