#!/usr/bin/env python3
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from warehouse_return_inspector.importer import DataImporter
from warehouse_return_inspector.reporter import Reporter
from warehouse_return_inspector.database import Database


def test():
    work_dir = tempfile.mkdtemp(prefix="wh_return_test_")
    print(f"测试目录: {work_dir}")
    print("=" * 60)

    sample_csv = os.path.join(
        os.path.dirname(__file__), "examples", "sample_returns.csv"
    )
    test_csv = os.path.join(work_dir, "test_returns.csv")
    shutil.copy(sample_csv, test_csv)

    db_path = os.path.join(work_dir, "returns.db")

    print("\n【测试1】导入数据")
    print("-" * 60)
    importer = DataImporter(db_path)
    result = importer.import_file(test_csv)
    importer.close()
    print(f"导入批次ID: {result.get('batch_id', 'N/A')}")
    print(f"总记录数: {result.get('total_records', 0)}")
    print(f"成功导入: {result.get('success_records', 0)}")
    if result.get('exceptions'):
        print(f"\n检测到 {len(result['exceptions'])} 个异常:")
        for ex in result['exceptions']:
            print(f"  - [{ex.get('exception_type')}] {ex.get('order_no')}")
            print(f"    {ex.get('exception_detail')}")
    else:
        print("无异常")

    print("\n【测试2】查看退货单")
    print("-" * 60)
    reporter = Reporter(db_path)
    orders = reporter.list_orders()
    for order in orders:
        print(f"  {order['order_no']} | {order['return_date']} | {order['customer_name'] or '未知客户'}")

    print("\n【测试3】查看待处理异常")
    print("-" * 60)
    reporter = Reporter(db_path)
    exceptions = reporter.list_exceptions(unresolved_only=True)
    if exceptions:
        for ex in exceptions:
            print(f"\n  ID: {ex['id']} [{ex['exception_type']}]")
            print(f"  订单: {ex['order_no']} | SN: {ex['serial_number']}")
            print(f"  问题: {ex['exception_detail']}")
    else:
        print("  无待处理异常")

    print("\n【测试4】重复导入同一个文件")
    print("-" * 60)
    importer = DataImporter(db_path)
    result2 = importer.import_file(test_csv)
    importer.close()
    print(f"结果: {result2.get('message', 'N/A')}")

    print("\n【测试5】修正常见异常")
    print("-" * 60)
    db = Database(db_path)
    fixes = [
        ("SN0002", "repair_responsibility", "厂方质量问题"),
        ("SN0003", "quality_result", "需返修"),
        ("SN0004", "quality_result", "不合格"),
        ("SN0008", "repair_responsibility", "物流运输损坏"),
    ]
    for sn, field, new_val in fixes:
        items = db.get_item_by_serial(sn)
        if items and len(items) == 1:
            old_val = items[0][field] or "空"
            db.update_item_field(items[0]["id"], field, new_val, "测试人员", "测试修正")
            print(f"  SN: {sn} | 字段: {field} | {old_val} -> {new_val}")
    db.close()

    print("\n【测试6】查看处理后的异常（应该只剩下序列号重复）")
    print("-" * 60)
    reporter = Reporter(db_path)
    exceptions = reporter.list_exceptions(unresolved_only=True)
    print(f"  待处理异常数: {len(exceptions)}")
    for ex in exceptions:
        print(f"    - [{ex['exception_type']}] {ex['serial_number']}")

    print("\n【测试7】生成分拣报告")
    print("-" * 60)
    reporter = Reporter(db_path)
    report_path = reporter.generate_sorting_report()
    print(f"报告已生成: {report_path}")
    with open(report_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        for line in lines[:25]:
            print(line.rstrip())
    print("... (省略更多内容)")

    print("\n【测试8】标记异常已解决")
    print("-" * 60)
    db = Database(db_path)
    exceptions = db.get_unresolved_exceptions()
    if exceptions:
        ex = exceptions[0]
        db.resolve_exception(ex["id"], "确认是录入错误，已手动修正", "测试人员")
        print(f"异常 {ex['id']} 已标记为已解决")
    db.close()

    print("\n" + "=" * 60)
    print("测试完成！")
    print(f"测试目录: {work_dir}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(test())
