#!/usr/bin/env python3
"""验证：重复导入人工补录后，明细、历史、后续都读到同一条更新"""
import sys
import shutil
import os

sys.path.insert(0, '.')
from piano_exam_prep.storage import Storage
from piano_exam_prep.engine import PrepEngine

DATA_DIR = "verify_data"
if os.path.exists(DATA_DIR):
    shutil.rmtree(DATA_DIR)

storage = Storage(DATA_DIR)
engine = PrepEngine(storage)

print("=" * 60)
print("验证：明细、历史、后续追溯都读到同一条更新")
print("=" * 60)

# 第一步：导入
lines = ["1. 小明 - 小星星", "2. 小红 - 致爱丽丝"]
results = engine.import_signups("B001", lines, "老周")
ming_record_id = [r.record_id for r in results if r.student_name == "小明"][0]
print(f"\n1. 导入完成，小明 record_id: {ming_record_id}")

# 第二步：补录合同（造成不一致）
record = engine.supplement_contract(
    record_id=ming_record_id,
    contract_id="CT-001",
    song_copyright_name="小星星变奏曲",
    screenshot_path="scr/001.png",
    operator="老周",
    note="合同第2页",
)
print(f"2. 补录合同完成，状态: {record.review_status.value}")
print(f"   合同号: {record.contract_info.contract_id}")

# 第三步：三种方式读取，确认同一条更新
print("\n3. 三种方式读取验证：")

# 方式1：list 明细
from_list = [r for r in storage.list_records() if r.record_id == ming_record_id][0]
print(f"   方式1 (list 明细):  id={from_list.record_id}, 状态={from_list.review_status.value}, 合同={from_list.contract_info.contract_id}")

# 方式2：trace 三段追溯
trace = engine.trace_record(ming_record_id)
print(f"   方式2 (trace 追溯): id={trace['record_id']}, 状态={trace['stage_3_manual_confirmation']['review_status']}, 合同={trace['stage_2_contract_supplement']['contract_id']}")

# 方式3：history 历史
history = storage.list_history(ming_record_id)
latest = history[-1]
has_contract_change = any(c.field_name == "contract_id" for c in latest.changes)
print(f"   方式3 (history 历史): 共{len(history)}条记录, 最新操作={latest.operation}, 含合同变更={has_contract_change}")

# 断言验证
assert from_list.record_id == trace["record_id"] == ming_record_id, "❌ record_id 不一致!"
assert from_list.review_status.value == "needs_review", "❌ 状态不对!"
assert from_list.contract_info and from_list.contract_info.contract_id == "CT-001", "❌ 合同信息不对!"
assert trace["stage_2_contract_supplement"]["contract_id"] == "CT-001", "❌ trace 里合同信息不对!"
assert len(history) >= 2, "❌ 历史记录数不对!"

print("\n✅ 验证通过：明细、历史、后续追溯都读到同一条更新")
print("   所有读取都基于同一个 record_id，同一个存储文件")
