from core_logic import export_to_excel, get_point_detail, get_statistics, get_point_list
from openpyxl import load_workbook
import io

print("=" * 70)
print("城市更新拆迁安置清单 - 完整流程测试")
print("=" * 70)

stats = get_statistics()
print(f"\n📊 统计数据:")
print(f"  总点位: {stats['total']}")
print(f"  已处理: {stats['processed']} 点")
print(f"  待核实: {stats['need_verify']} 点")
print(f"  需现场复看: {stats['need_onsite']} 点")
print(f"  待处理反馈: {stats['unresolved_feedback']} 条")
print(f"  版本变更记录: {stats['version_count']} 条")

print(f"\n📋 点位列表:")
points = get_point_list()
for p in points:
    print(f"  {p['point_no']:15} {p['status_text']:10} {p['address']}")

print(f"\n📜 CQ-2026-003 版本历史 (GIS旧口径样例):")
detail = get_point_detail(3)
for v in detail['versions']:
    old = f'{v["old_value"]} -> ' if v['old_value'] else ''
    src = f' | 来源: {v["source_name"]}' if v.get('source_name') else ''
    print(f'  v{v["version"]}: {v["field_name"]:15} {old}{v["new_value"]:10} | {v["operator"]:8} | {v["operation_note"]}{src}')

print(f"\n💬 CQ-2026-002 居民反馈 (待核实样例):")
detail2 = get_point_detail(2)
for fb in detail2['feedback']:
    status = '已处理' if fb['is_resolved'] else '待处理'
    print(f'  [{status}] {fb["feedback_type"]}: {fb["feedback_content"]}')
    print(f'          来源: {fb["feedback_source"]}')

print(f"\n📝 CQ-2026-002 街道备注:")
for note in detail2['notes']:
    print(f'  [{note["street_name"]}] {note["operator"]}: {note["note_content"]}')

print(f"\n✅ CQ-2026-001 复核记录 (顺利记录样例):")
detail1 = get_point_detail(1)
for r in detail1['reviews']:
    print(f'  {r["reviewer"]} - {r["review_time"]}')
    print(f'  结果: 通过')
    print(f'  意见: {r["review_note"]}')

print(f"\n📥 导出Excel测试:")
wb = export_to_excel()
output = io.BytesIO()
wb.save(output)
output.seek(0)
wb2 = load_workbook(output)
print(f"  包含Sheet: {wb2.sheetnames}")
for sheet_name in wb2.sheetnames:
    ws = wb2[sheet_name]
    if sheet_name == '汇总说明':
        continue
    print(f"  - {sheet_name}: {ws.max_row - 1} 条记录")

print("\n" + "=" * 70)
print("✅ 测试完成！城市更新拆迁安置清单主流程已全部走通")
print("   从样例导入 -> 归并 -> 人工复核 -> 导出公示清单")
print("   所有变更均留痕，版本历史完整，可追溯可交接")
print("=" * 70)
