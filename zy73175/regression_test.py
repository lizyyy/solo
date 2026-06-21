"""
「概率模拟批量验算」回归测试
验证顺序：run → confirm → show → run → show

验收要点：
1. 首次 run 后 CASE003 挂起，actual_result == 150.0，状态 == 挂起待确认
2. confirm --override 65.6 后 CASE003 状态 == 人工已确认
3. 首次 show 能看到：实际结果 65.6、历史里 150.0→65.6 的变更原因、外推备注只有 1 条
4. 再次 run 后，CASE003 仍然 actual_result == 65.6，状态仍然是 人工已确认
5. 再次 show 时，外推备注没有重复追加（仍然是 1 条外推验算备注）
6. 其他未确认的正常样例（CASE001/002/004）仍按原逻辑重新验算
"""
import json
import os
import sys
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "records.json")
BACKUP_FILE = os.path.join(BASE_DIR, "data", "records.json.bak")

ORIGINAL_DATA = [
    {"id": "CASE001", "student_name": "张小明", "formula_desc": "概率P(A)=频率/总数，单位从百分比%换算到小数概率",
     "source_trace": "来自课本P35 例2-3，学生草稿拍照screenshot_20260618_001.png",
     "input_value": 75.5, "input_unit": "%", "target_unit": "概率", "expected_result": 0.755, "tolerance": 0.02,
     "attachments": [
         {"kind": "草稿备注", "content": "学生写的是 75.5% ≈ 0.76，后来用笔改成 0.755"},
         {"kind": "截图引用", "content": "旧版本截图: img/draft_v1.png，新版本: img/draft_v2.png"}
     ]},
    {"id": "CASE002", "student_name": "李小红", "formula_desc": "期望温度换算：华氏度转摄氏度",
     "source_trace": "习题集第4章第7题，课堂白板笔记",
     "input_value": 98.6, "input_unit": "华氏度", "target_unit": "摄氏度", "expected_result": 37.0, "tolerance": 0.02,
     "attachments": [
         {"kind": "草稿备注", "content": "学生先写了32°C，后来叉掉改写成37°C，旁边标注'公式记错了已修正'"}
     ]},
    {"id": "CASE003", "student_name": "王小刚", "formula_desc": "高温外推：实验数据150°C外推概率计算",
     "source_trace": "实验报告第3组，温度传感器读数，助教小岑标注异常",
     "input_value": 302.0, "input_unit": "华氏度", "target_unit": "摄氏度", "expected_result": 150.0, "tolerance": 0.02,
     "attachments": [
         {"kind": "草稿备注", "content": "学生算出来150°C，但实验设备量程上限是60°C，明显超出合理区间，疑似单位漏换算"},
         {"kind": "截图引用", "content": "实验照片: img/exp_setup.jpg, 草稿演算: img/CASE003_calc.jpg"}
     ]},
    {"id": "CASE004", "student_name": "赵小琳", "formula_desc": "补录：距离单位千米转米（上周漏录数据本周补）",
     "source_trace": "补录记录，原作业编号HW-0612，学生补交",
     "input_value": 2.5, "input_unit": "千米", "target_unit": "米", "expected_result": 2500.0, "tolerance": 0.02,
     "attachments": [
         {"kind": "补录说明", "content": "6月12日作业因请假延迟提交，6月18日补交，值班老师签字确认"},
         {"kind": "截图引用", "content": "补交邮件截图: img/HW-0612_makeup.png"}
     ]},
]

sys.path.insert(0, BASE_DIR)
from prob_check.store import RecordStore
from prob_check.engine import VerificationEngine
from prob_check.reporter import Reporter
from prob_check.models import RecordStatus

errors = []
passes = []


def step(name):
    print()
    print("=" * 70)
    print(f"  STEP: {name}")
    print("=" * 70)


def assert_eq(label, actual, expected):
    if actual == expected:
        passes.append(f"[✓] {label}: {actual}")
        print(f"  ✓ {label}: {actual}")
    else:
        errors.append(f"[✗] {label}: 期望 {expected}, 实际 {actual}")
        print(f"  ✗ {label}: 期望 {expected}, 实际 {actual}")


def reset_data():
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(ORIGINAL_DATA, f, ensure_ascii=False, indent=2)
    print("  数据已重置为初始样例")


reset_data()
store = RecordStore(DATA_FILE)
engine = VerificationEngine()


# =============================================================
# STEP 1: 首次 batch_verify（run 命令对应的核心逻辑）
# =============================================================
step("1. 首次 batch_verify（对应 run 命令）")
records = store.load_all()
results = engine.batch_verify(records)
store.save_all(records)
print(Reporter.format_summary(results, records))

case003 = store.find_by_id("CASE003")
assert_eq("CASE003 首次验算状态", case003.status.value, "挂起待确认")
assert_eq("CASE003 首次验算 actual_result", case003.actual_result, 150.0)
# 外推验算备注条数（应当只有1条）
extrap_notes = [a for a in case003.attachments if a.kind == "验算备注" and "外推越界" in a.content]
assert_eq("CASE003 首次外推备注条数", len(extrap_notes), 1)

# 其他正常样例状态
for rid, expected_status in [("CASE001", "验算通过"), ("CASE002", "验算通过"), ("CASE004", "验算通过")]:
    r = store.find_by_id(rid)
    assert_eq(f"{rid} 状态", r.status.value, expected_status)


# =============================================================
# STEP 2: confirm（人工确认 CASE003，改口径到 65.6）
# =============================================================
step("2. confirm CASE003（人工改口径 150.0 → 65.6）")
store.confirm_record(
    "CASE003",
    operator="李排班",
    note="学生单位写错，实际应为输入65.6摄氏度而非302华氏度，设备量程超限走特殊流程",
    override_result=65.6,
)
case003 = store.find_by_id("CASE003")
assert_eq("CASE003 confirm 后状态", case003.status.value, "人工已确认")
assert_eq("CASE003 confirm 后 actual_result", case003.actual_result, 65.6)
assert_eq("CASE003 确认人", case003.confirmed_by, "李排班")
# 历史变更应有 actual_result 记录：旧值 150.0 → 新值 65.6
result_changes = [h for h in case003.history if h.field_changed == "actual_result"]
assert_eq("CASE003 actual_result 历史变更条数", len(result_changes), 1)
if result_changes:
    assert_eq("CASE003 历史旧值", result_changes[0].old_value, 150.0)
    assert_eq("CASE003 历史新值", result_changes[0].new_value, 65.6)
    assert "单位写错" in result_changes[0].reason, "历史变更原因里应包含改口径说明"


# =============================================================
# STEP 3: 首次 show（Reporter.format_record_detail）
# =============================================================
step("3. 首次 show CASE003（详细信息）")
detail = Reporter.format_record_detail(case003)
print(detail)
for keyword in ["65.6", "人工已确认", "150.0 → 65.6", "李排班", "单位写错"]:
    if keyword in detail:
        passes.append(f"[✓] show 中有关键字: {keyword}")
        print(f"  ✓ show 文本包含: {keyword}")
    else:
        errors.append(f"[✗] show 中缺失关键字: {keyword}")
        print(f"  ✗ show 文本缺失: {keyword}")


# =============================================================
# STEP 4: 再次 batch_verify（复跑整包，不能覆盖人工确认值）
# =============================================================
step("4. 再次 batch_verify（复跑整包 — 核心回归点）")
records = store.load_all()
# 先记一下复跑前 CASE003 的附件数
before_attach_count = len([a for a in records[2].attachments if a.kind == "验算备注" and "外推越界" in a.content])
results = engine.batch_verify(records)
store.save_all(records)
print(Reporter.format_summary(results, records))

case003 = store.find_by_id("CASE003")
# 核心断言：人工确认值不被覆盖
assert_eq("CASE003 复跑后状态（不可退回挂起）", case003.status.value, "人工已确认")
assert_eq("CASE003 复跑后 actual_result（不可改回 150）", case003.actual_result, 65.6)
# 外推备注不得重复追加
after_extrap_notes = [a for a in case003.attachments if a.kind == "验算备注" and "外推越界" in a.content]
assert_eq("CASE003 复跑后外推备注条数（不可重复堆叠）", len(after_extrap_notes), 1)

# 其他未确认的正常样例仍正常重新验算（结果应当仍然是验算通过）
for rid, expected_status in [("CASE001", "验算通过"), ("CASE002", "验算通过"), ("CASE004", "验算通过")]:
    r = store.find_by_id(rid)
    assert_eq(f"{rid} 复跑后状态（仍按原逻辑）", r.status.value, expected_status)

# summary 里 CASE003 的 message 应当包含"人工确认已生效，跳过原始输入重算"
case003_result = [r for r in results if r["record_id"] == "CASE003"][0]
assert "人工确认已生效" in case003_result["message"], "复跑 summary 里对已确认记录应说明跳过重算"
assert "150.0" in case003_result["message"], "复跑 summary 里应提到原始验算值"
assert "65.6" in case003_result["message"], "复跑 summary 里应提到人工口径值"
if "人工确认已生效" in case003_result["message"] and "150.0" in case003_result["message"] and "65.6" in case003_result["message"]:
    passes.append("[✓] 复跑 summary 对 CASE003 显示'人工确认已生效'，并带原始值/新值线索")
    print("  ✓ 复跑 summary CASE003 message 正确包含跳过重算提示与新旧值线索")
else:
    errors.append(f"[✗] 复跑 summary CASE003 message 不符合预期: {case003_result['message']}")


# =============================================================
# STEP 5: 再次 show CASE003
# =============================================================
step("5. 再次 show CASE003（验证历史线索完整、备注没重复）")
case003 = store.find_by_id("CASE003")
detail = Reporter.format_record_detail(case003)
print(detail)
for keyword in ["65.6", "150.0", "人工已确认", "李排班", "单位写错"]:
    if keyword in detail:
        passes.append(f"[✓] 再次 show 仍有关键字: {keyword}")
        print(f"  ✓ 再次 show 文本包含: {keyword}")
    else:
        errors.append(f"[✗] 再次 show 缺失关键字: {keyword}")
        print(f"  ✗ 再次 show 缺失: {keyword}")


# =============================================================
# STEP 6: 导出早会说明，检查关键信息
# =============================================================
step("6. 导出早会说明（export 命令）")
brief = Reporter.format_meeting_brief(store.load_all())
print(brief[:1500] + "..." if len(brief) > 1500 else brief)
for keyword in ["王小刚", "65.6", "150.0", "人工确认", "实验报告第3组", "李排班", "单位写错"]:
    if keyword in brief:
        passes.append(f"[✓] 早会说明包含: {keyword}")
        print(f"  ✓ 早会说明包含: {keyword}")
    else:
        errors.append(f"[✗] 早会说明缺失: {keyword}")


# =============================================================
# 最终总结
# =============================================================
print()
print("=" * 70)
print(f"  回归测试总结：{len(passes)} 项通过，{len(errors)} 项失败")
print("=" * 70)
for p in passes:
    print(f"  {p}")
if errors:
    print()
    print("  失败项：")
    for e in errors:
        print(f"    {e}")
    print()
    print("  ✗ 回归测试未通过，请检查上述失败项。")
    sys.exit(1)
else:
    print()
    print("  ✓ 全部通过！CASE003 复跑后仍为 65.6、状态仍为人工已确认，")
    print("    历史里能看到 150.0→65.6 及改口径原因，外推备注仅 1 条无重复，")
    print("    其他样例仍按原逻辑正常验算，早会说明可直接引用。")
    sys.exit(0)
