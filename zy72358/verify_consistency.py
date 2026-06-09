import json
from thermal_runaway_warning.api import create_api_response

print("=== 1. JSON 导出结果核对 ===")
with open('/tmp/export_result.json') as f:
    data = json.load(f)
print(f"Total records: {len(data)}")
suppressed = [r for r in data if r.get('suppressed_by_average')]
over = [r for r in data if r.get('is_over_threshold')]
print(f"suppressed_by_average=True count: {len(suppressed)}")
print(f"is_over_threshold=True count: {len(over)}")
for r in suppressed:
    rd = r.get('review_decision') or {}
    print(f"  - {r['sensor_id']} row{r['original_row']}: status={r['status']}, original={r['original_import_value']}, value={r['raw_value']}, avg={r['average_value']}, threshold={r['threshold']}, next={r.get('next_reviewer')}, amended={r.get('amended_value')}, reviewer={rd.get('decided_by', '')}")

print("\n=== 2. API 响应一致性核对 ===")
csv_text = open('example_sensor_data.csv', encoding='utf-8').read()
with open('example_photos.json') as f: photos = json.load(f)
with open('example_conversions.json') as f: convs = json.load(f)
with open('example_amendments.json') as f: amendments = json.load(f)
with open('example_reviews.json') as f: reviews = json.load(f)

result = create_api_response(
    csv_text=csv_text,
    photo_attachments=photos,
    unit_conversions=convs,
    amendments=amendments,
    manual_reviews=reviews,
    source_name="6月批次电芯巡检.csv",
    operator="何工",
)

print(f"API response keys: {sorted(result.keys())}")
ev = result['evidence_summary']
print(f"evidence_summary count (over threshold): {len(ev)}")
supp_in_api = [e for e in ev if e['suppressed_by_average']]
print(f"evidence_summary suppressed_by_average=True count: {len(supp_in_api)}")
for e in ev:
    rd = e.get('review_decision') or {}
    print(f"  API ev: {e['sensor_id']} row{e['original_row']}: status={e['status']}, original={e['original_import_value']}, current={e['current_value']}, avg={e['average_value']}, threshold={e['threshold']}, next={e.get('next_reviewer')}, reviewer={rd.get('decided_by', 'N/A')}, is_over={e['is_over_threshold']}, suppressed={e['suppressed_by_average']}")

print("\n=== 3. 四个视图交叉一致性核对 ===")
export_supp = sorted([(r['sensor_id'], r['original_row']) for r in data if r.get('suppressed_by_average')])
api_supp = sorted([(e['sensor_id'], e['original_row']) for e in ev if e['suppressed_by_average']])
page_supp = sorted([(p['传感器编号'], p['原始行号']) for p in result['page_display'] if p.get('被平均值盖掉') == '⚠️ 是'])
summary_supp_count = result['summary']['suppressed_by_average_count']
print(f"  export suppressed: {export_supp}")
print(f"  api suppressed:    {api_supp}")
print(f"  page suppressed:   {page_supp}")
print(f"  summary.suppressed_by_average_count: {summary_supp_count}")
all_match = (export_supp == api_supp == page_supp and summary_supp_count == len(export_supp))
print(f"  ✅ 所有视图一致: {all_match}")

print("\n=== 4. 人工复核信息完整性核对 ===")
t101_row3 = next((e for e in ev if e['sensor_id']=='T-101' and e['original_row']==3), None)
rd = t101_row3.get('review_decision') if t101_row3 else None
fields_ok = False
if t101_row3 and rd:
    conditions = [
        t101_row3['original_import_value'] == 75.0,
        t101_row3['amended_value'] == 68.0,
        rd['original_statement'] != '',
        rd['amended_reason'] != '',
        rd['next_reviewer'] == '质量主管李工',
        rd['decided_by'] == '维修师傅王工',
        t101_row3['suppressed_by_average'] is True,
        t101_row3['is_over_threshold'] is True,
    ]
    fields_ok = all(conditions)
    print(f"  T-101 row3: 原始值={rd.get('original_value')}, 改后值={rd.get('amended_value')}, 原始说法={bool(rd.get('original_statement'))}, 处理原因={bool(rd.get('amended_reason'))}, 下一步找谁={rd.get('next_reviewer')}, 复核人={rd.get('decided_by')}")
print(f"  ✅ 复核信息完整: {fields_ok}")

print("\n=== 5. 最终结论 ===")
final_ok = all_match and fields_ok
print(f"✅ 全部核对通过: {final_ok}")
