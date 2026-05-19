#!/usr/bin/env python3
import os
import sys

if os.path.exists('book_library.db'):
    os.remove('book_library.db')
    print("已清理旧数据库")

from service import BookDonationService

print("\n=== 测试1: 导入数据 ===")
service = BookDonationService()
donations = service.parse_csv_file('sample_data.csv')
print(f"读取了 {len(donations)} 条记录")

result = service.import_donations(donations, volunteer="测试志愿者", batch_id="batch_test_001")
print(f"导入成功: {result['success']} 条, 失败: {result['failed']} 条")

print("\n=== 测试2: 查询记录 ===")
query_result = service.query_with_filters(batch_id="batch_test_001", page_size=50)
print(f"查询到 {query_result['total']} 条记录:")
for item in query_result['data'][:3]:
    print(f"  - ID:{item['id']} ISBN(raw):{item['isbn_raw']} ISBN(std):{item['isbn_standard']} "
          f"年级(raw):{item['grade_raw']} 年级(std):{item['grade_standard']} "
          f"品相(raw):{item['condition_raw']} 品相(std):{item['condition_standard']}")

print("\n=== 测试3: 查询异常记录 ===")
exception_result = service.query_with_filters(exception_type="invalid_isbn")
print(f"无效ISBN记录数: {exception_result['total']}")

print("\n=== 测试4: 去重检测 ===")
dedup_result = service.deduplicate_batch(batch_id="batch_test_001", operator="管理员", auto_mark=True)
print(f"发现 {dedup_result['duplicate_groups']} 组重复, 标记了 {dedup_result['total_duplicates_marked']} 条重复记录")

print("\n=== 测试5: 生成上架清单 ===")
shelf_result = service.generate_shelf_list(
    batch_id="batch_test_001",
    operator="管理员",
    shelf_code="A-01"
)
print(f"生成上架清单 '{shelf_result['list_id']}', 包含 {shelf_result['total_books']} 本书")

print("\n=== 测试6: 导出记录 ===")
export_result = service.export_to_csv("export_test.csv", batch_id="batch_test_001")
print(f"已导出 {export_result['total_records']} 条记录到 {export_result['file_path']}")

print("\n=== 测试7: 导出生成的上架清单 ===")
shelf_export_result = service.export_shelf_list(shelf_result['list_id'], "shelf_list_test.csv")
print(f"已导出生成的上架清单到 {shelf_export_result['file_path']}")

print("\n=== 测试8: 操作历史 ===")
history_result = service.get_operation_history(page_size=50)
print(f"查询到 {history_result['total']} 条操作记录:")
for log in history_result['data'][:5]:
    print(f"  - [{log['operation_time']}] {log['operation_type']} 成功:{log['success_count']} 失败:{log['fail_count']}")

print("\n=== 所有测试完成 ===")
print("\n生成的文件:")
print("  - book_library.db (SQLite数据库)")
print("  - export_test.csv (全部记录导出)")
print("  - shelf_list_test.csv (上架清单导出)")
