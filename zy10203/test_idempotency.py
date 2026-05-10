#!/usr/bin/env python3
import os
import sys
import tempfile
import shutil
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from warehouse_return_inspector.importer import DataImporter
from warehouse_return_inspector.reporter import Reporter
from warehouse_return_inspector.database import Database


def test_idempotency():
    work_dir = tempfile.mkdtemp(prefix="wh_idempotency_test_")
    print(f"测试目录: {work_dir}")
    print("=" * 70)

    sample_csv = os.path.join(
        os.path.dirname(__file__), "examples", "sample_returns.csv"
    )
    db_path = os.path.join(work_dir, "returns.db")

    print("\n【测试1】首次导入")
    print("-" * 70)
    test_csv_1 = os.path.join(work_dir, "test_returns_1.csv")
    shutil.copy(sample_csv, test_csv_1)

    importer = DataImporter(db_path)
    result1 = importer.import_file(test_csv_1)
    importer.close()

    print(f"批次ID: {result1.get('batch_id')}")
    print(f"总记录数: {result1.get('total_records')}")
    print(f"成功导入: {result1.get('success_records')}")
    print(f"跳过记录: {result1.get('skipped_records', 0)}")
    print(f"异常数: {len(result1.get('exceptions', []))}")

    reporter = Reporter(db_path)
    orders1 = reporter.list_orders()
    items1 = reporter.list_items()
    exceptions1 = reporter.list_exceptions(unresolved_only=True)
    reporter.close()
    print(f"数据库中订单数: {len(orders1)}")
    print(f"数据库中商品数: {len(items1)}")
    print(f"数据库中异常数: {len(exceptions1)}")

    assert result1["success"] == True, "首次导入应该成功"
    assert result1["success_records"] == 8, "应该导入8条记录"
    assert result1.get("skipped_records", 0) == 0, "首次导入不应该有跳过"
    assert len(items1) == 8, "数据库中应该有8条商品"

    print("\n【测试2】重复导入同一个文件（修改时间变化）")
    print("-" * 70)
    time.sleep(1)
    os.utime(test_csv_1, (time.time(), time.time()))

    importer = DataImporter(db_path)
    result2 = importer.import_file(test_csv_1)
    importer.close()

    print(f"批次ID: {result2.get('batch_id')}")
    print(f"是否重复: {not result2.get('success', True)}")
    print(f"消息: {result2.get('message', 'N/A')}")

    reporter = Reporter(db_path)
    items2 = reporter.list_items()
    exceptions2 = reporter.list_exceptions(unresolved_only=True)
    reporter.close()
    print(f"数据库中商品数: {len(items2)}")
    print(f"数据库中异常数: {len(exceptions2)}")

    assert result2["success"] == False, "相同文件应该被检测为重复"
    assert len(items2) == 8, "商品数应该保持8条（不重复插入）"
    assert len(exceptions2) == len(exceptions1), "异常数应该保持不变"

    print("\n【测试3】相同内容不同文件名导入（第一层去重：内容哈希）")
    print("-" * 70)
    test_csv_2 = os.path.join(work_dir, "test_returns_2_copy.csv")
    shutil.copy(test_csv_1, test_csv_2)

    importer = DataImporter(db_path)
    result3 = importer.import_file(test_csv_2)
    importer.close()

    print(f"批次ID: {result3.get('batch_id')}")
    print(f"是否重复: {not result3.get('success', True)}")
    print(f"消息: {result3.get('message', 'N/A')}")

    reporter = Reporter(db_path)
    items3 = reporter.list_items()
    exceptions3 = reporter.list_exceptions(unresolved_only=True)
    reporter.close()
    print(f"数据库中商品数: {len(items3)}")
    print(f"数据库中异常数: {len(exceptions3)}")

    assert result3["success"] == False, "内容相同的文件应该被检测为重复"
    assert len(items3) == 8, "商品数应该保持8条"
    assert len(exceptions3) == len(exceptions1), "异常数应该保持不变"

    print("\n【测试4】内容不同的文件（第二层去重：订单号+SN）")
    print("-" * 70)
    test_csv_3 = os.path.join(work_dir, "test_returns_3_new.csv")
    shutil.copy(sample_csv, test_csv_3)

    with open(test_csv_3, "a", encoding="utf-8") as f:
        f.write('RT20260501009,SN0009,2026-05-09,钱十一,充电器,SKU009,合格,,待审核,F-06-01,\n')
        f.write('RT20260501010,SN0010,2026-05-10,冯十二,数据线,SKU010,不合格,,待审核,,\n')

    importer = DataImporter(db_path)
    result4 = importer.import_file(test_csv_3)
    importer.close()

    print(f"批次ID: {result4.get('batch_id')}")
    print(f"总记录数: {result4.get('total_records')}")
    print(f"成功导入: {result4.get('success_records')}")
    print(f"跳过记录: {result4.get('skipped_records', 0)}")
    print(f"异常数: {len(result4.get('exceptions', []))}")

    reporter = Reporter(db_path)
    items4 = reporter.list_items()
    exceptions4 = reporter.list_exceptions(unresolved_only=True)
    reporter.close()
    print(f"数据库中商品数: {len(items4)}")
    print(f"数据库中异常数: {len(exceptions4)}")

    assert result4["success"] == True, "新文件应该被允许导入"
    assert result4.get("skipped_records", 0) == 8, "应该跳过原来的8条（已存在的订单号+SN组合）"
    assert result4["success_records"] == 2, "应该只导入新增的2条"
    assert len(items4) == 10, "商品数应该变成10条（8+2）"

    print("\n" + "=" * 70)
    print("✅ 幂等性测试全部通过！")
    print("=" * 70)
    print("\n验证结论：")
    print("  第一层去重（文件级别）: 基于文件内容哈希")
    print("    - 同一个文件（修改时间变化）→ 不会重复导入")
    print("    - 相同内容不同文件名 → 不会重复导入")
    print("  第二层去重（记录级别）: 基于(订单号, 序列号)组合")
    print("    - 已存在的订单号+SN → 被跳过")
    print("    - 新的订单号+SN → 正常导入")
    print(f"\n测试目录: {work_dir}")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(test_idempotency())
