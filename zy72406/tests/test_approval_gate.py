#!/usr/bin/env python3
"""
版权授权地域核对 - 审批门控验证脚本
三类样例：A) 只有合同没有接龙  B) 接龙+合同但备注为空  C) 证据齐全且备注完整
每类样例验证：审批结果、证据明细、历史记录、导出明细
"""
import json
import os
from src.engine import CopyrightCheckEngine
from src.models import SongStatus, EvidenceType

DATA_PATH = "data/gate_test.json"
REPORT_PATH = "reports/gate_test_weekly.json"

if os.path.exists(DATA_PATH):
    os.remove(DATA_PATH)
if os.path.exists(REPORT_PATH):
    os.remove(REPORT_PATH)

engine = CopyrightCheckEngine(DATA_PATH)

def section(title):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)

def show_record_details(record):
    details = engine.get_record_details(record.record_id)
    summary = details["evidence_summary"]
    print(f"  状态: {summary['status']}")
    print(f"  接龙证据: {summary['group_chat_evidence_count']} 份")
    print(f"  合同证据: {summary['contract_evidence_count']} 份")
    print(f"  人工改动: {summary['manual_change_count']} 次")
    print(f"  原始行号: {summary['original_row_number']}")
    print()
    print("  证据明细:")
    for ev in details["record"]["evidences"]:
        print(f"    [{ev['evidence_type']}] {ev['source']}")
        print(f"      {ev['content'][:70]}")
    print()
    print("  状态历史:")
    for status, ts, op in details["record"]["status_history"]:
        print(f"    {status} by {op}")

def verify_export_consistency(label, record_id):
    report = engine.generate_report()
    engine.export_weekly_report(REPORT_PATH)
    with open(REPORT_PATH, 'r', encoding='utf-8') as f:
        export_data = json.load(f)
    api_summary = engine.get_record(record_id).get_evidence_summary()
    export_match = None
    for r in export_data["records"]:
        if r["record_id"] == record_id:
            export_match = r
            break
    if export_match is None:
        print(f"  ❌ {label} 导出中找不到该记录")
        return False
    keys = ["status", "group_chat_evidence_count", "contract_evidence_count", "original_row_number"]
    ok = True
    for k in keys:
        if api_summary.get(k) != export_match.get(k):
            print(f"  ❌ {label} {k} 不一致: API={api_summary.get(k)}, 导出={export_match.get(k)}")
            ok = False
    if ok:
        print(f"  ✅ {label} 导出明细与接口/页面数据一致")
    return ok

section("准备：排练群接龙导入 3 条记录")

rows = [
    {"现场名": "夜曲", "版权名": "夜曲", "授权地域": "中国大陆"},
    {"现场名": "七里香live", "版权名": "七里香", "授权地域": "中国大陆"},
    {"现场名": "稻香", "版权名": "稻香", "授权地域": "全球"},
]
imported, errors = engine.batch_import_from_group_chat(rows, "小助理", source_file="接龙测试.xlsx")
print(f"导入: 成功 {len(imported)} 条, 失败 {len(errors)} 条")

record_a = imported[0]  # 夜曲 - 用于样例A：只有合同没有接龙
record_b = imported[1]  # 七里香 - 用于样例B：接龙+合同但备注为空
record_c = imported[2]  # 稻香 - 用于样例C：证据齐全且备注完整

section("样例A：只有合同没有接龙证据 → 审批应被阻止")

engine.add_contract_evidence(record_a.record_id, "合同页_夜曲.pdf", "合同第1页，授权地域中国大陆", "小段")
engine._save()

r = engine.get_record(record_a.record_id)
engine.records[record_a.record_id].evidences = [
    e for e in r.evidences if e.evidence_type != EvidenceType.GROUP_CHAT
]
engine._save()

record_a = engine.get_record(record_a.record_id)
print(f"记录: {record_a.get_display_name()}")
print(f"接龙证据: {sum(1 for e in record_a.evidences if e.evidence_type == EvidenceType.GROUP_CHAT)} 份")
print(f"合同证据: {sum(1 for e in record_a.evidences if e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT)} 份")
print()

if record_a.status not in [SongStatus.TEACHER_REVIEW, SongStatus.CONTRACT_VERIFIED]:
    engine.records[record_a.record_id].update_status(SongStatus.CONTRACT_VERIFIED, "测试")
    engine._save()

print("尝试审批（备注='确认通过'）:")
success_a, blockers_a = engine.teacher_approve(record_a.record_id, "音乐老师", "确认通过")
print(f"  审批结果: {'通过' if success_a else '被阻止'}")
if blockers_a:
    print(f"  阻止原因: {'; '.join(blockers_a)}")
print()

record_a = engine.get_record(record_a.record_id)
show_record_details(record_a)
print()
verify_export_consistency("样例A", record_a.record_id)

section("样例B：接龙+合同都有，但审批备注为空 → 审批应被阻止")

engine.add_contract_evidence(record_b.record_id, "合同页_七里香.pdf", "合同第2页，授权地域中国大陆", "小段")
engine._save()

record_b = engine.get_record(record_b.record_id)
print(f"记录: {record_b.get_display_name()}")
print(f"接龙证据: {sum(1 for e in record_b.evidences if e.evidence_type == EvidenceType.GROUP_CHAT)} 份")
print(f"合同证据: {sum(1 for e in record_b.evidences if e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT)} 份")
print()

if record_b.status not in [SongStatus.TEACHER_REVIEW, SongStatus.CONTRACT_VERIFIED]:
    engine.records[record_b.record_id].update_status(SongStatus.TEACHER_REVIEW, "测试")
    engine._save()

print("尝试审批（备注=''）:")
success_b, blockers_b = engine.teacher_approve(record_b.record_id, "音乐老师", "")
print(f"  审批结果: {'通过' if success_b else '被阻止'}")
if blockers_b:
    print(f"  阻止原因: {'; '.join(blockers_b)}")
print()

print("尝试审批（备注='   '纯空格）:")
record_b_retry = engine.get_record(record_b.record_id)
success_b2, blockers_b2 = engine.teacher_approve(record_b.record_id, "音乐老师", "   ")
print(f"  审批结果: {'通过' if success_b2 else '被阻止'}")
if blockers_b2:
    print(f"  阻止原因: {'; '.join(blockers_b2)}")
print()

record_b = engine.get_record(record_b.record_id)
show_record_details(record_b)
print()
verify_export_consistency("样例B", record_b.record_id)

section("样例C：接龙+合同都有，审批备注完整 → 审批应通过")

engine.add_contract_evidence(record_c.record_id, "合同页_稻香.pdf", "合同第3页，授权地域全球", "小段")
engine._save()

record_c = engine.get_record(record_c.record_id)
print(f"记录: {record_c.get_display_name()}")
print(f"接龙证据: {sum(1 for e in record_c.evidences if e.evidence_type == EvidenceType.GROUP_CHAT)} 份")
print(f"合同证据: {sum(1 for e in record_c.evidences if e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT)} 份")
print()

if record_c.status not in [SongStatus.TEACHER_REVIEW, SongStatus.CONTRACT_VERIFIED]:
    engine.records[record_c.record_id].update_status(SongStatus.CONTRACT_VERIFIED, "测试")
    engine._save()

print("尝试审批（备注='版权名与合同一致，现场名无冲突，确认放行'）:")
success_c, blockers_c = engine.teacher_approve(
    record_c.record_id, "音乐老师",
    "版权名与合同一致，现场名无冲突，确认放行"
)
print(f"  审批结果: {'通过' if success_c else '被阻止'}")
if blockers_c:
    print(f"  阻止原因: {'; '.join(blockers_c)}")
print()

record_c = engine.get_record(record_c.record_id)
show_record_details(record_c)
print()
verify_export_consistency("样例C", record_c.record_id)

section("最终总结")

all_pass = True

if success_a:
    print("❌ 样例A（缺接龙证据）不应通过却被放行")
    all_pass = False
else:
    print("✅ 样例A（缺接龙证据）正确阻止")

if success_b or success_b2:
    print("❌ 样例B（备注为空）不应通过却被放行")
    all_pass = False
else:
    print("✅ 样例B（备注为空）正确阻止")

if not success_c:
    print("❌ 样例C（证据齐全+备注完整）应通过却被阻止")
    all_pass = False
else:
    print("✅ 样例C（证据齐全+备注完整）正确通过")

print()

record_a_final = engine.get_record(record_a.record_id)
record_b_final = engine.get_record(record_b.record_id)
record_c_final = engine.get_record(record_c.record_id)

print(f"样例A 最终状态: {record_a_final.status.value} (应为非 approved)")
print(f"样例B 最终状态: {record_b_final.status.value} (应为非 approved)")
print(f"样例C 最终状态: {record_c_final.status.value} (应为 approved)")
print()

note_evidence_a = [e for e in record_a_final.evidences if e.source == "teacher_review_blocked"]
note_evidence_b = [e for e in record_b_final.evidences if e.source == "teacher_review_blocked"]
note_evidence_c = [e for e in record_c_final.evidences if e.source == "teacher_review"]

if note_evidence_a:
    print(f"✅ 样例A 有阻止记录证据: {note_evidence_a[0].content[:60]}")
else:
    print("❌ 样例A 缺少阻止记录证据")
    all_pass = False

if note_evidence_b:
    print(f"✅ 样例B 有阻止记录证据: {note_evidence_b[0].content[:60]}")
else:
    print("❌ 样例B 缺少阻止记录证据")
    all_pass = False

if note_evidence_c:
    print(f"✅ 样例C 有审批备注证据: {note_evidence_c[0].content[:60]}")
else:
    print("❌ 样例C 缺少审批备注证据")
    all_pass = False

print()
if all_pass:
    print("=" * 60)
    print("  ✅ 全部验证通过：缺证据或缺备注的记录不会再被放行")
    print("=" * 60)
else:
    print("=" * 60)
    print("  ❌ 存在验证失败，请检查")
    print("=" * 60)
