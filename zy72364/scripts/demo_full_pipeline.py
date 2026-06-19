import sys
import os
import json
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from em_calibrator import (
    Database,
    import_records, reimport_records,
    engineer_review, safety_review,
    get_record_with_evidence, get_full_audit_trail,
    generate_report,
    RecordStatus, ChangeType,
)

db = Database(":memory:")

print("=" * 80)
print("  电磁铁吸力标定系统 全链路端到端演示脚本")
print("=" * 80)
print()

print("==== Step 1: 导入初始批次 (3条记录) ====")
records_step1 = [
    {"original_line_no": 2, "sensor_id": "S-001", "equipment_position": "POS-01",
     "temperature_value": 25.3, "caliber": "DN50", "remark": "A位标定"},
    {"original_line_no": 3, "sensor_id": "S-002", "equipment_position": "POS-02",
     "temperature_value": 26.1, "caliber": "DN50", "remark": "B位标定"},
    {"original_line_no": 4, "sensor_id": "S-003", "equipment_position": "POS-03",
     "temperature_value": 25.8, "caliber": "DN65", "remark": "C位标定"},
]
batch_id, created, updated, details = import_records(
    db, records_step1, source_file="calibration_20260619.csv", operator="system"
)
print(f"  batch_id = {batch_id}")
print(f"  新建记录数 = {created}, 更新记录数 = {updated}")
for d in details:
    print(f"    line={d['original_line_no']:>2}  action={d['action']:<18}  record_id={d['record_id']}")
main_batch_id = batch_id
all_records_step1 = db.get_records_by_batch(main_batch_id)
print(f"  batch内总记录数 (验证): {len(all_records_step1)}")
print()

print("==== Step 1.5: 插入历史已完成批次 (用于触发传感器变更检测) ====")
historical_records = [
    {"original_line_no": 2, "sensor_id": "S-001", "equipment_position": "POS-01",
     "temperature_value": 24.0, "caliber": "DN50", "remark": "历史A位标定"},
    {"original_line_no": 3, "sensor_id": "S-OLD02", "equipment_position": "POS-02",
     "temperature_value": 24.5, "caliber": "DN50", "remark": "历史B位标定"},
    {"original_line_no": 4, "sensor_id": "S-003", "equipment_position": "POS-03",
     "temperature_value": 25.0, "caliber": "DN65", "remark": "历史C位标定"},
]
hist_batch_id, hist_created, hist_updated, hist_details = import_records(
    db, historical_records, source_file="calibration_20260101_history.csv", operator="system"
)
hist_records = db.get_records_by_batch(hist_batch_id)
for hr in hist_records:
    hr.status = RecordStatus.COMPLETED.value
    hr.updated_at = datetime.datetime.now().isoformat()
    db.update_record(hr)
print(f"  历史批次 batch_id = {hist_batch_id}")
print(f"  POS-01 历史传感器: S-001 (与当前一致, 无变更)")
print(f"  POS-02 历史传感器: S-OLD02 (与当前 S-002 不一致, 将触发 sensor_changed)")
print(f"  POS-03 历史传感器: S-003 (与当前一致, 无变更)")
print(f"  历史批次所有记录状态已设为 COMPLETED")
print()

print("==== Step 2: 何工补录返工 (仅修改 line=3 的 remark) ====")
records_step2 = [
    {"original_line_no": 2, "sensor_id": "S-001", "equipment_position": "POS-01",
     "temperature_value": 25.3, "caliber": "DN50", "remark": "A位标定"},
    {"original_line_no": 3, "sensor_id": "S-002", "equipment_position": "POS-02",
     "temperature_value": 26.1, "caliber": "DN50",
     "remark": "B位标定·何工确认：实测温度偏差+0.2，已复核传感器编号"},
    {"original_line_no": 4, "sensor_id": "S-003", "equipment_position": "POS-03",
     "temperature_value": 25.8, "caliber": "DN65", "remark": "C位标定"},
]
_, step2_created, step2_updated, step2_details = reimport_records(
    db, target_batch_id=main_batch_id, records=records_step2,
    operator="何工", reason="补录返工：何工核对后只改 line=3 的备注"
)
print(f"  新建: {step2_created}, 更新: {step2_updated}")
for d in step2_details:
    changes_str = " | ".join([f"{c[0]}: '{c[1]}' → '{c[2]}'" for c in d["changes"]]) if d["changes"] else "无变更"
    print(f"    line={d['original_line_no']:>2}  action={d['action']:<10}  changes: {changes_str}")
count_after_step2 = db.count_records_by_batch(main_batch_id)
print(f"  batch内总记录数 (验证仍为3): {count_after_step2}")
assert count_after_step2 == 3, f"step2后记录数应为3, 实际 {count_after_step2}"
print()

print("==== Step 3: 工程师复核 (何工) ====")
step3_records = db.get_records_by_batch(main_batch_id)
step3_records_sorted = sorted(step3_records, key=lambda r: r.original_line_no)
expected_after_er = {
    "POS-01": RecordStatus.SAFETY_REVIEW.value,
    "POS-02": RecordStatus.SENSOR_CHANGED.value,
    "POS-03": RecordStatus.SAFETY_REVIEW.value,
}
for rec in step3_records_sorted:
    result = engineer_review(db, rec.id, operator="何工", note="何工工程师复核通过")
    print(f"  {rec.equipment_position:<8} (line={rec.original_line_no}, sensor={rec.sensor_id}) → 状态: {result.status}")
    expected = expected_after_er[rec.equipment_position]
    assert result.status == expected, (
        f"{rec.equipment_position} engineer_review后期望状态={expected}, 实际={result.status}"
    )
    print(f"    ✓ 断言通过: 状态 == {expected}")
print()

print("==== Step 4: 安全复核 (安全员王工) ====")
step4_records = db.get_records_by_batch(main_batch_id)
step4_records_sorted = sorted(step4_records, key=lambda r: r.original_line_no)
for rec in step4_records_sorted:
    status_before = rec.status
    approve = True
    result = safety_review(db, rec.id, operator="安全员王工", approve=approve,
                           note=f"安全员王工安全复核通过 (原状态={status_before})")
    print(f"  {rec.equipment_position:<8} (原状态={status_before:<16}) → 最终状态: {result.status}")
    assert result.status == RecordStatus.COMPLETED.value, (
        f"{rec.equipment_position} safety_review后期望状态=completed, 实际={result.status}"
    )
    print(f"    ✓ 断言通过: 状态 == completed")
print()

print("==== Step 5: 重新计算 + 生成标定报告 ====")
report = generate_report(db, batch_id=main_batch_id, operator="system")
report.print_summary()
print()

print("==== Step 6: 保存报告为 JSON ====")
output_path = "/tmp/em_calibration_report.json"
report.save_json(output_path)
print(f"  报告已保存至: {output_path}")
print()

print("==== Step 7: 全自动验证 ====")
print("---- 7a: 记录数验证 ----")
cnt_batch = db.count_records_by_batch(main_batch_id)
print(f"  batch_id={main_batch_id} 的记录数: {cnt_batch}")
assert cnt_batch == 3, f"记录数断言失败: {cnt_batch} != 3"
print(f"  ✓ batch内记录数 == 3")
all_batch_records = db.get_records_by_batch(main_batch_id)
assert len(all_batch_records) == 3, f"get_records_by_batch返回数量 != 3"
print(f"  ✓ get_records_by_batch 返回数量 == 3")
print()

print("---- 7b: 所有记录状态 == COMPLETED ----")
for rec in all_batch_records:
    print(f"    {rec.equipment_position:<8} status={rec.status}")
    assert rec.status == RecordStatus.COMPLETED.value, (
        f"{rec.equipment_position} 状态 != completed: {rec.status}"
    )
print("  ✓ 所有3条记录状态均为 completed")
print()

print("---- 7c: line=3 remark 最终值 4种路径验证 ----")
target_line = 3
final_remark_expected = "B位标定·何工确认：实测温度偏差+0.2，已复核传感器编号"
rec_by_id = db.get_record(all_batch_records[1].id)
remark_1 = rec_by_id.remark
print(f"  路径1 get_record:           '{remark_1}'")
assert remark_1 == final_remark_expected, f"路径1 remark不匹配"
print("  ✓ 路径1 通过")
rec_by_batch_line = db.get_record_by_batch_and_line(main_batch_id, target_line)
remark_2 = rec_by_batch_line.remark
print(f"  路径2 get_record_by_batch_line: '{remark_2}'")
assert remark_2 == final_remark_expected, f"路径2 remark不匹配"
print("  ✓ 路径2 通过")
evidence = get_record_with_evidence(db, all_batch_records[1].id)
remark_3 = evidence["record"].remark
print(f"  路径3 get_record_with_evidence: '{remark_3}'")
assert remark_3 == final_remark_expected, f"路径3 remark不匹配"
print("  ✓ 路径3 通过")
filtered = [r for r in db.get_records_by_batch(main_batch_id) if r.original_line_no == target_line]
assert len(filtered) == 1, "过滤后应只有1条记录"
remark_4 = filtered[0].remark
print(f"  路径4 get_records_by_batch 过滤: '{remark_4}'")
assert remark_4 == final_remark_expected, f"路径4 remark不匹配"
print("  ✓ 路径4 通过")
print()

print("---- 7d: line=3 remark 变更历史验证 ----")
line3_id = all_batch_records[1].id
evidence_line3 = get_record_with_evidence(db, line3_id)
manual_edits = [
    ch for ch in evidence_line3["change_history"]
    if ch.field_name == "remark" and ch.change_type == ChangeType.MANUAL_EDIT.value
]
print(f"  manual_edit 变更条数: {len(manual_edits)}")
assert len(manual_edits) >= 1, "至少应有一条 manual_edit 的 remark变更"
me = manual_edits[0]
print(f"    old_value='{me.old_value}'")
print(f"    new_value='{me.new_value}'")
print(f"    changed_by='{me.changed_by}'")
print(f"    reason='{me.reason}'")
assert me.old_value == "B位标定", f"old_value不匹配: {me.old_value}"
assert "何工确认" in me.new_value, f"new_value不含'何工确认'"
assert me.changed_by == "何工", f"changed_by不是何工: {me.changed_by}"
assert "补录返工" in me.reason, f"reason不含'补录返工': {me.reason}"
print("  ✓ remark 变更历史全部断言通过")
print()

print("---- 7e: line=3 POS-02 工作流日志验证 ----")
audit_line3 = get_full_audit_trail(db, line3_id)
wf_logs = audit_line3["workflow_log"]
print(f"  workflow_log 条数: {len(wf_logs)}")
for wl in wf_logs:
    print(f"    {wl.from_status:<16} → {wl.to_status:<16}  by {wl.operator}  note: {wl.note[:40]}")
has_imported_to_sensor_changed = any(
    wl.from_status == RecordStatus.IMPORTED.value and wl.to_status == RecordStatus.SENSOR_CHANGED.value
    for wl in wf_logs
)
assert has_imported_to_sensor_changed, "缺少 IMPORTED → SENSOR_CHANGED 日志"
print("  ✓ IMPORTED → SENSOR_CHANGED 日志存在")
sensor_changed_to_any = any(
    wl.from_status == RecordStatus.SENSOR_CHANGED.value for wl in wf_logs
)
assert sensor_changed_to_any, "缺少 SENSOR_CHANGED → ... 日志"
print("  ✓ SENSOR_CHANGED → ... 日志存在")
final_completed_by_wang = any(
    wl.to_status == RecordStatus.COMPLETED.value and wl.operator == "安全员王工"
    for wl in wf_logs
)
assert final_completed_by_wang, "缺少安全员王工完成 COMPLETED 的日志"
print("  ✓ 安全员王工录入 COMPLETED 日志存在")
print()

print("---- 7f: 报告内容验证 ----")
assert report.batch_id == main_batch_id, f"report.batch_id不匹配: {report.batch_id} != {main_batch_id}"
print(f"  ✓ report.batch_id == {main_batch_id}")
assert len(report.records) == 3, f"report.records数量 != 3"
print(f"  ✓ len(report.records) == 3")
pos02_rec = report.records[1]
assert pos02_rec.equipment_position == "POS-02", f"records[1]位置不匹配: {pos02_rec.equipment_position}"
print(f"  ✓ records[1].equipment_position == 'POS-02'")
assert "何工确认" in pos02_rec.final_remark, "records[1].final_remark不含'何工确认'"
print(f"  ✓ records[1].final_remark 包含'何工确认'")
force_val = pos02_rec.pulling_force_kn
print(f"  records[1].pulling_force_kn = {force_val} (DN50@26.1°C, 期望 ~9.82kN, 范围8~12)")
assert isinstance(force_val, float), "pulling_force_kn不是float"
assert 8.0 <= force_val <= 12.0, f"pulling_force_kn超出合理范围: {force_val}"
print(f"  ✓ pulling_force_kn 在合理范围 (8.0~12.0)")
assert pos02_rec.force_pass is True, "force_pass不是True"
print(f"  ✓ force_pass == True")
print()

print("---- 7g: JSON文件内容验证 ----")
assert os.path.exists(output_path), f"JSON文件不存在: {output_path}"
print(f"  ✓ JSON文件存在: {output_path}")
with open(output_path, "r", encoding="utf-8") as f:
    json_data = json.load(f)
assert "report_id" in json_data, "JSON缺少report_id字段"
print(f"  ✓ JSON包含 report_id 字段: {json_data['report_id']}")
assert "batch_id" in json_data, "JSON缺少batch_id字段"
assert json_data["batch_id"] == main_batch_id, f"JSON batch_id不匹配"
print(f"  ✓ JSON batch_id == {main_batch_id}")
print()

print("=" * 80)
print("  ========== 全链路自动验证全部通过 ==========")
print("=" * 80)
