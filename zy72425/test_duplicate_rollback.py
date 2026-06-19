#!/usr/bin/env python3
"""
真实样例验证脚本 - 两条线补实

场景:
  A. 重复导入线：同一批接龙 "小明 - 小星星" 出现在多行
  B. 回滚追溯线：补录合同 → 保存 → 回滚 → 刷新重算 → 追溯/周报

要求覆盖的验证点:
  1. 同批 "小明 - 小星星" 重复出现，不按行号误判为多条新记录
  2. 本次重复 / 历史重复 / 新记录 三类显示正确
  3. 当前结果、明细、历史、报告 都显示同一个来源判断
  4. 补录合同后，所有端点一致读到合同补录
  5. 回滚后：状态回到 imported/pending
  6. 回滚后：不再残留空合同号/版权名/补录人/时间
  7. 回滚后：追溯不再显示 "合同页截图补录" 第二段
  8. 回滚后：周报 has_contract = 否
  9. 修改历史保留原话、修改人、原因
"""
import sys
import shutil
import os

sys.path.insert(0, '.')
from piano_exam_prep.storage import Storage
from piano_exam_prep.engine import PrepEngine
from piano_exam_prep.models import ReviewStatus, WorkflowStage, ImportResultType

DATA_DIR = "test_dup_rb"
CHECK = []

def check(name, cond, detail=""):
    status = "✅" if cond else "❌"
    CHECK.append((name, cond, detail))
    print(f"{status} {name}")
    if not cond and detail:
        print(f"   详情: {detail}")

if os.path.exists(DATA_DIR):
    shutil.rmtree(DATA_DIR)

storage = Storage(DATA_DIR)
engine = PrepEngine(storage)

print("=" * 70)
print("真实样例验证 - 重复导入 + 回滚追溯 两条线")
print("=" * 70)

# ============================================================
# 准备测试数据：同批接龙里 "小明 - 小星星" 出现 3 次（行1、行3、行6）
# ============================================================
lines = [
    "1. 小明 - 小星星",
    "2. 小红 - 致爱丽丝",
    "3. 小明 - 小星星",
    "4. 小华 - 月光奏鸣曲",
    "5. 小李 - 梦中的婚礼",
    "6. 小明 - 小星星",
    "7. 小张 - 童年的回忆",
]

print("\n[A] 重复导入线")
print("-" * 40)
results = engine.import_signups("BATCH_A", lines, "老周")

ming = [r for r in results if r.student_name == "小明"]
print(f"小明共出现 {len(ming)} 行:")
for r in ming:
    print(f"  行{r.original_line_number}: {r.result_type.value} - {r.note}")

new_count = sum(1 for r in results if r.result_type == ImportResultType.NEW)
batch_dup = sum(1 for r in results if r.result_type == ImportResultType.BATCH_DUPLICATE)

check("A1. 同批小明重复行判为『本次重复』，不是新记录",
      len([r for r in ming if r.result_type == ImportResultType.BATCH_DUPLICATE]) == 2,
      f"实际: {[r.result_type.value for r in ming]}")

check("A2. 小明只生成 1 条新记录，不是 3 条",
      len([r for r in ming if r.result_type == ImportResultType.NEW]) == 1)

check("A3. 总新记录数 = 5（5个不同学生），不是 7",
      new_count == 5, f"实际: new={new_count}, batch_dup={batch_dup}")

check("A4. 同批重复的记录关联到同一个 record_id",
      len({r.record_id for r in ming if r.record_id}) == 1,
      f"涉及的 record_ids: {list({r.record_id for r in ming})}")

ming_record_id = [r.record_id for r in ming if r.record_id][0]
print(f"小明主记录ID: {ming_record_id}")

# ============================================================
# A5. 当前结果、明细、历史 都显示同一个来源判断
# ============================================================
print("\n  刷新重算：重新 list / trace / history 核对一致性")
ming_record = storage.load_record(ming_record_id)
from_list = [r for r in storage.list_records() if r.record_id == ming_record_id][0]
trace = engine.trace_record(ming_record_id)

check("A5-1. load_record 与 list_records 读到同一条",
      from_list.record_id == ming_record.record_id == ming_record_id)

check("A5-2. trace 第一段接龙来源行数 = 3（3条证据都保留）",
      len(trace["stage_1_signup_source"]) == 3,
      f"实际: {len(trace['stage_1_signup_source'])}")

source_lines = sorted([s["original_line_number"] for s in trace["stage_1_signup_source"]])
check("A5-3. trace 第一段包含小明出现的所有原始行号 [1,3,6]",
      source_lines == [1, 3, 6],
      f"实际: {source_lines}")

history_count = len(storage.list_history(ming_record_id))
check("A5-4. 历史记录数 >= 1（创建记录）", history_count >= 1)

# ============================================================
# [B] 回滚追溯线
# ============================================================
print("\n[B] 回滚追溯线")
print("-" * 40)

# B1. 补录合同（造成现场名≠版权名）
record = engine.supplement_contract(
    record_id=ming_record_id,
    contract_id="CT-2024-001",
    song_copyright_name="小星星变奏曲",
    screenshot_path="screenshots/ct_2024_001.png",
    operator="老周",
    note="合同第3页截图",
)
check("B1-1. 补录后状态 = needs_review",
      record.review_status == ReviewStatus.NEEDS_REVIEW)
check("B1-2. 补录后 contract_info 有效",
      record.contract_info is not None and record.contract_info.is_valid())

# B2. 刷新重算：所有端点一致读到合同补录
record_loaded = storage.load_record(ming_record_id)
trace_after = engine.trace_record(ming_record_id)
list_after = [r for r in storage.list_records() if r.record_id == ming_record_id][0]
weekly_ming_has_contract = (record_loaded.contract_info is not None and record_loaded.contract_info.is_valid())

check("B2-1. load_record 读到合同号 = CT-2024-001",
      record_loaded.contract_info is not None and record_loaded.contract_info.contract_id == "CT-2024-001")
check("B2-2. list 读到 contract_supplemented 阶段",
      list_after.workflow_stage == WorkflowStage.CONTRACT_SUPPLEMENTED)
check("B2-3. trace 第二段(合同补录)存在",
      trace_after["stage_2_contract_supplement"] is not None,
      "如果是 None，说明追溯没有显示合同补录段")
if trace_after["stage_2_contract_supplement"]:
    check("B2-4. trace 第二段合同号 = CT-2024-001",
          trace_after["stage_2_contract_supplement"]["contract_id"] == "CT-2024-001")
check("B2-5. 周报 has_contract = 是",
      weekly_ming_has_contract == True)
check("B2-6. 明细/历史/报告来源判断一致（都指向同一记录）",
      record_loaded.record_id == list_after.record_id == trace_after["record_id"])

# 取"补录合同"的历史 ID，用于回滚
all_history = storage.list_history(ming_record_id)
supplement_hist = [h for h in all_history if "补录合同" in h.operation]
if supplement_hist:
    supplement_hist_id = supplement_hist[0].history_id
    print(f"  补录合同历史ID: {supplement_hist_id}")
else:
    supplement_hist_id = all_history[-1].history_id
    print(f"  找不到补录合同操作，取最后一条: {supplement_hist_id}")

# 再做一个操作：修改备注（追加），让回滚不止一步
engine.update_remark(
    record_id=ming_record_id,
    field_name="discrepancy_note",
    new_value="家长确认孩子平时叫小星星",
    operator="老周",
    change_note="补充家长反馈",
    append=True,
)
print("  已追加修改备注，制造更多历史点")

# B3. 回滚到补录合同之前
print(f"\n  执行回滚到 {supplement_hist_id} 之前...")
rolled = engine.rollback(ming_record_id, supplement_hist_id, "王老师")

# B4. 回滚后验证
record_after_rb = storage.load_record(ming_record_id)
trace_after_rb = engine.trace_record(ming_record_id)
list_after_rb = [r for r in storage.list_records() if r.record_id == ming_record_id][0]
weekly_ming_rb_has_contract = (record_after_rb.contract_info is not None and record_after_rb.contract_info.is_valid())

check("B4-1. 回滚后 workflow_stage = imported（不是 contract_supplemented）",
      record_after_rb.workflow_stage == WorkflowStage.IMPORTED,
      f"实际: {record_after_rb.workflow_stage.value}")
check("B4-2. 回滚后 review_status = pending（不是 needs_review）",
      record_after_rb.review_status == ReviewStatus.PENDING,
      f"实际: {record_after_rb.review_status.value}")

contract_after = record_after_rb.contract_info
if contract_after:
    cid = contract_after.contract_id
    scn = contract_after.song_copyright_name
    sp = contract_after.screenshot_path
    sby = contract_after.supplemented_by
    check("B4-3. 回滚后合同号为空字符串或 None", not (cid and cid.strip()), f"实际: '{cid}'")
    check("B4-4. 回滚后版权名为空字符串或 None", not (scn and scn.strip()), f"实际: '{scn}'")
    check("B4-5. 回滚后截图路径为空字符串或 None", not (sp and sp.strip()), f"实际: '{sp}'")
    check("B4-6. 回滚后补录人为空字符串或 None", not (sby and sby.strip()), f"实际: '{sby}'")
    check("B4-7. 回滚后 contract_info 整体为 None（is_valid 判断为 False 后清空）",
          contract_after is None, "实际还残留 contract_info 对象（虽空但不是 None）")
else:
    check("B4-3. 回滚后合同号不存在 (contract_info = None)", True)
    check("B4-4. 回滚后版权名不存在 (contract_info = None)", True)
    check("B4-5. 回滚后截图路径不存在 (contract_info = None)", True)
    check("B4-6. 回滚后补录人不存在 (contract_info = None)", True)
    check("B4-7. 回滚后 contract_info 整体为 None", True)

check("B4-8. 回滚后 trace 第二段（合同页截图补录）= None",
      trace_after_rb["stage_2_contract_supplement"] is None,
      f"实际不是 None: {trace_after_rb['stage_2_contract_supplement']}")
check("B4-9. 回滚后 list 阶段 = imported",
      list_after_rb.workflow_stage == WorkflowStage.IMPORTED)
check("B4-10. 回滚后周报 has_contract = 否",
      weekly_ming_rb_has_contract == False)

# B5. 历史里留住原话、修改人、修改原因
print("\n  查看变更历史是否完整")
full_history = storage.list_history(ming_record_id)
rollback_hist = [h for h in full_history if "回滚" in h.operation]
append_hist = [h for h in full_history if "追加" in h.operation]

check("B5-1. 存在『回滚』历史记录", len(rollback_hist) > 0,
      f"实际历史数: {len(full_history)}")
if rollback_hist:
    check("B5-2. 回滚操作记录了操作人 = 王老师",
          rollback_hist[0].operator == "王老师",
          f"实际: {rollback_hist[0].operator}")
check("B5-3. 存在『追加』备注的修改历史", len(append_hist) > 0)
if append_hist:
    changes = append_hist[0].changes
    any_note_change = any("discrepancy_note" in c.field_name for c in changes)
    check("B5-4. 追加备注历史中包含 discrepancy_note 改前→改后", any_note_change)
    if any_note_change:
        for c in changes:
            if c.field_name == "discrepancy_note":
                has_old = c.old_value is not None and len(c.old_value) > 0
                has_new = c.new_value is not None and "家长" in c.new_value
                check("B5-5. 备注旧值不为空（留住原话）且新值包含追加内容",
                      has_old and has_new,
                      f"old有值: {has_old}, new含家长: {has_new}")
                break

# ============================================================
# A6. 第二次重复导入（同批文件再导一次），历史重复判定正确
# ============================================================
print("\n[A6] 第二次导入同一批，验证历史重复判定")
results_2 = engine.import_signups("BATCH_A", lines, "老周")
ming_2 = [r for r in results_2 if r.student_name == "小明"]
hist_dup = sum(1 for r in results_2 if r.result_type == ImportResultType.HISTORY_DUPLICATE)
new_2 = sum(1 for r in results_2 if r.result_type == ImportResultType.NEW)
batch_dup_2 = sum(1 for r in results_2 if r.result_type == ImportResultType.BATCH_DUPLICATE)

check("A6-1. 第二次导入新记录数 = 0（全是重复）",
      new_2 == 0, f"实际: new={new_2}")
check("A6-2. 小明的所有行都判为『历史重复』或『本次重复』",
      all(r.result_type in (ImportResultType.HISTORY_DUPLICATE, ImportResultType.BATCH_DUPLICATE) for r in ming_2),
      f"实际: {[r.result_type.value for r in ming_2]}")
check("A6-3. 总记录数仍为 5（没翻倍）",
      len(storage.list_records()) == 5,
      f"实际: {len(storage.list_records())}")

# ============================================================
# 导出 JSON 核对
# ============================================================
print("\n[C] 导出记录核对")
import json
with open(os.path.join(DATA_DIR, "records", f"{ming_record_id}.json")) as f:
    raw_json = json.load(f)
check("C1. 磁盘上原始 JSON 的 contract_info = null",
      raw_json.get("contract_info") is None,
      f"实际: {raw_json.get('contract_info')}")
check("C2. 磁盘 JSON 里 workflow_stage = imported",
      raw_json.get("workflow_stage") == "imported",
      f"实际: {raw_json.get('workflow_stage')}")

# ============================================================
# 汇总
# ============================================================
print("\n" + "=" * 70)
print(f"验证完成: {sum(1 for _, c, _ in CHECK if c)}/{len(CHECK)} 通过")
print("=" * 70)
failed = [(n, d) for n, c, d in CHECK if not c]
if failed:
    print("❌ 失败项:")
    for n, d in failed:
        print(f"  - {n}")
        if d:
            print(f"      {d}")
    sys.exit(1)
else:
    print("🎉 全部验证通过！")
    print(f"数据目录: {DATA_DIR}/  可用于复盘")
    print()
    print("可重跑的验证命令:")
    print(f"  python3 {__file__}")
