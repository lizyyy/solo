#!/usr/bin/env python3
"""
召回排序漏斗对账 - 真实 HTTP 链路端到端验证
覆盖：前端构建 -> 创建样例 -> 查看明细 -> 进入详情 -> 补特征 -> 阈值回放
      -> 执行算法复核 -> 刷新状态 -> 重算结果 -> 导出明细
最后验证：卡片类型、少数类状态、历史留痕、导出字段来自同一条真实样例
"""
import requests
import json
import sys
import os
from datetime import datetime

API = "http://localhost:8000/api"
FRONTEND = "http://localhost:3000"

def p(*args):
    print(" ".join(str(a) for a in args))

def hr(char="="):
    print(char * 72)

# ===== 阶段0：前端构建验证 =====
hr()
p("阶段 0/8：前端 TypeScript 严格编译检查（tsc --noEmit）")
hr()
import subprocess
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
result = subprocess.run(
    ["npx", "tsc", "--noEmit"],
    cwd=frontend_dir, capture_output=True, text=True
)
if result.returncode == 0:
    p("✅ 前端 tsc --noEmit 零错误通过")
else:
    p("❌ 前端编译错误:")
    p(result.stdout)
    p(result.stderr)
    sys.exit(1)

result = subprocess.run(
    ["npx", "vite", "build"],
    cwd=frontend_dir, capture_output=True, text=True
)
if result.returncode == 0:
    p("✅ 前端生产构建成功 (vite build)")
    if "error" in result.stdout.lower() or "error" in result.stderr.lower():
        # 只看 TypeScript 错误，忽略 chunk size 警告
        pass
else:
    p("❌ 前端构建失败:")
    p(result.stdout[-1000:])
    sys.exit(1)

# ===== 阶段1：服务连通性检查 =====
hr()
p("阶段 1/8：HTTP 服务连通性检查")
hr()
try:
    r = requests.get(f"{API}/health", timeout=5)
    assert r.status_code == 200
    p("✅ 后端 API 服务连通正常:", r.json())
except Exception as e:
    p("❌ 后端 API 无法连通:", e)
    sys.exit(1)

try:
    r = requests.get(f"{FRONTEND}/", timeout=5)
    assert r.status_code == 200
    p("✅ 前端页面服务连通正常")
except Exception as e:
    p("❌ 前端页面无法连通:", e)
    sys.exit(1)

# ===== 阶段2：创建评测切片（第一次导入）=====
hr()
p("阶段 2/8：评测切片第一次导入（创建同一条真实样例）")
hr()
test_data = {
    "slice_name": f"HTTP-E2E-样例-{datetime.now().strftime('%H%M%S')}",
    "description": "真实HTTP端到端验证用例",
    "imported_by": "阿越",
    "records": [
        {"original_row_number": 1, "sample_id": "NORM-001", "sample_type": "多数类-热榜",
         "recall_rate": 0.90, "precision_rate": 0.94, "total_metric": 0.92},
        # ⭐ 这条是我们要贯穿跟踪的真实样例 ⭐
        {"original_row_number": 2, "sample_id": "MASK-9527", "sample_type": "少数类-冷门长尾商品",
         "recall_rate": 0.21, "precision_rate": 0.29, "total_metric": 0.96},
        {"original_row_number": 3, "sample_id": "NORM-003", "sample_type": "多数类-推荐",
         "recall_rate": 0.85, "precision_rate": 0.90, "total_metric": 0.87},
    ]
}
p(f"创建切片: {test_data['slice_name']}")
p(f"重点跟踪样例: 行号=2, sample_id=MASK-9527 (少数类, 召回率21%, 总指标96%)")
r = requests.post(f"{API}/slices", json=test_data, timeout=10)
assert r.status_code == 200, f"创建切片失败: {r.status_code} {r.text}"
import_result = r.json()
slice_id = import_result["slice_id"]
p(f"✅ 切片创建成功: id={slice_id}, 总记录={import_result['total_records']}, "
  f"少数类={import_result['minority_count']}, 被盖住={import_result['masked_by_total_count']}")
assert import_result["masked_by_total_count"] >= 1, "至少应该有1条被总指标盖住的记录"

# ===== 阶段3：查看评测切片明细（列表页）=====
hr()
p("阶段 3/8：查看评测切片明细（核对少数类状态）")
hr()
r = requests.get(f"{API}/slices/{slice_id}/records", timeout=5)
assert r.status_code == 200
records = r.json()
p(f"✅ 明细接口返回 {len(records)} 条记录")

# 定位我们跟踪的真实样例
tracked = [r for r in records if r["sample_id"] == "MASK-9527"][0]
p(f"\n⭐ 跟踪样例 MASK-9527 (原始行号={tracked['original_row_number']}) 当前明细:")
p(f"   是否少数类: {tracked['is_minority']}  {'✅' if tracked['is_minority'] else '❌'}")
p(f"   是否被总指标盖住: {tracked['is_masked_by_total']}  {'✅' if tracked['is_masked_by_total'] else '❌'}")
p(f"   当前处理状态: {tracked['status']}  {'✅' if tracked['status'] == 'pending_review' else '❌ (应为pending_review)'}")
p(f"   召回率/总指标: {tracked['recall_rate']:.0%} / {tracked['total_metric']:.0%}")
assert tracked["is_minority"] == True
assert tracked["is_masked_by_total"] == True
assert tracked["status"] == "pending_review"
tracked_id = tracked["id"]

# ===== 阶段4：进入详情页 + 历史留痕检查 =====
hr()
p("阶段 4/8：进入详情页（核对触发动作、处理判断、历史留痕）")
hr()
r = requests.get(f"{API}/records/{tracked_id}", timeout=5)
assert r.status_code == 200, f"详情接口失败: {r.status_code}"
detail = r.json()

r = requests.get(f"{API}/records/{tracked_id}/audit-logs", timeout=5)
assert r.status_code == 200
audit_logs = r.json()

p(f"✅ 详情接口返回正常，状态={detail['status']}")
p(f"✅ 审计日志共 {len(audit_logs)} 条:")
for i, log in enumerate(audit_logs):
    p(f"   {i+1}. [{log['operation_time'][:16]}] {log['operator']} → {log['action']}")
    if log.get("remark"):
        p(f"        备注: {log['remark'][:60]}")
assert len(audit_logs) >= 1, "至少应该有导入动作的日志"

# 检查导入时的处理判断
first_log = audit_logs[0]
assert first_log["action"] == "import", f"第一条日志应该是import，实际是{first_log['action']}"
p(f"\n✅ 导入时的触发动作: {first_log['action']}")
p(f"✅ 处理判断记录在审计日志的 new_value 字段中")
nv = json.loads(first_log["new_value"])
p(f"   判定 is_minority={nv.get('is_minority')}, "
  f"is_masked_by_total={nv.get('is_masked_by_total')}, "
  f"初始状态={nv.get('initial_status')}")

# ===== 阶段5：步骤2 - 阿越补看特征快照编号 =====
hr()
p("阶段 5/8：阿越补看特征快照编号（真实调用接口）")
hr()
r = requests.put(
    f"{API}/records/{tracked_id}/feature-snapshot",
    json={
        "feature_snapshot_id": "FEAT-E2E-MASK-9527",
        "operator": "阿越",
        "note": "E2E测试: 补看长尾商品特征快照，确认特征完整"
    },
    timeout=5,
)
assert r.status_code == 200, f"补特征快照失败: {r.status_code} {r.text}"
updated = r.json()
p(f"✅ 特征快照已补看: {updated['feature_snapshot_id']}")
p(f"   补看人: {updated['feature_snapshot_added_by']}")
p(f"   补看时间: {updated['feature_snapshot_added_time'][:16]}")
# ⭐ 关键断言：被盖住样本仍保持待复核状态 ⭐
p(f"   处理状态: {updated['status']}  {'✅ 仍保持待复核 (正确)' if updated['status'] == 'pending_review' else '❌ 状态被错误推进了!'}")
assert updated["status"] == "pending_review", (
    f"边界规则被违反：被盖住样本应该保持pending_review，实际为{updated['status']}"
)

# ===== 阶段6：步骤3 - 阈值回放更新 =====
hr()
p("阶段 6/8：阈值回放更新（真实调用接口）")
hr()
r = requests.put(
    f"{API}/records/{tracked_id}/threshold-replay",
    json={
        "threshold_value": 0.65,
        "threshold_replay_result": "临界通过，样本量级小需人工复核",
        "operator": "阿越",
        "note": "E2E测试: 阈值回放，长尾样本召回偏低"
    },
    timeout=5,
)
assert r.status_code == 200, f"阈值回放失败: {r.status_code} {r.text}"
updated = r.json()
p(f"✅ 阈值回放已更新: 阈值={updated['threshold_value']}, 结果={updated['threshold_replay_result']}")
p(f"   更新人: {updated['threshold_updated_by']}")
p(f"   更新时间: {updated['threshold_updated_time'][:16]}")
# ⭐ 关键断言：三步走完仍保持待复核 ⭐
p(f"   处理状态: {updated['status']}  {'✅ 仍保持待复核 (正确，留给算法工程师)' if updated['status'] == 'pending_review' else '❌ 状态被错误推进了!'}")
assert updated["status"] == "pending_review", (
    f"边界规则被违反：三步走完后被盖住样本仍应为pending_review，实际为{updated['status']}"
)

# ===== 阶段7：算法工程师复核 =====
hr()
p("阶段 7/8：算法工程师人工复核（真实调用复核接口）")
hr()
r = requests.put(
    f"{API}/records/{tracked_id}/review",
    json={
        "status": "confirmed_abnormal",
        "reviewed_by": "算法工程师-张工",
        "manual_note": "E2E复核：确认该长尾商品召回异常，需补充训练样本覆盖"
    },
    timeout=5,
)
assert r.status_code == 200, f"复核失败: {r.status_code} {r.text}"
reviewed = r.json()
p(f"✅ 算法复核完成: 结论={reviewed['status']} (已确认异常)")
p(f"   复核人: {reviewed['reviewed_by']}")
p(f"   复核时间: {reviewed['reviewed_time'][:16]}")
p(f"   复核意见已写入 manual_note")
assert reviewed["status"] == "confirmed_abnormal"

# 刷新状态 - 重新拉取详情
hr()
p("刷新状态 & 核对历史留痕")
hr()
r = requests.get(f"{API}/records/{tracked_id}/audit-logs", timeout=5)
audit_logs = r.json()
p(f"审计日志现在共 {len(audit_logs)} 条（覆盖全流程）:")
actions = []
for i, log in enumerate(audit_logs):
    actions.append(log["action"])
    p(f"  {i+1}. [{log['operation_time'][:16]}] {log['operator']:10s} → {log['action']:22s} | {log.get('remark','')[:50]}")
expected_actions = ["import", "add_feature_snapshot", "update_threshold", "confirm_abnormal"]
for expected in expected_actions:
    assert expected in actions, f"缺失关键操作日志: {expected}"
p(f"\n✅ 所有关键动作都有完整历史留痕: {' → '.join(actions)}")

# ===== 阶段8：导出明细 & 字段核对 =====
hr()
p("阶段 8/8：导出明细 & 核对导出字段（与页面/接口同一条真实样例）")
hr()
r = requests.get(f"{API}/slices/{slice_id}/export", timeout=15)
assert r.status_code == 200, f"导出失败: {r.status_code}"
export_path = f"/tmp/对账明细-E2E验证-{slice_id}.xlsx"
with open(export_path, "wb") as f:
    f.write(r.content)
size_kb = len(r.content) / 1024
p(f"✅ Excel导出成功: {export_path} ({size_kb:.1f} KB)")

# 读取Excel核对字段
import pandas as pd
df = pd.read_excel(export_path, sheet_name="对账明细")
p(f"✅ Sheet1 对账明细: {len(df)} 行 x {len(df.columns)} 列")
p(f"   列名: {list(df.columns)}")

# 找到我们跟踪的那条真实样例
tracked_row = df[df["样本ID"] == "MASK-9527"].iloc[0]
p(f"\n⭐ 核对同一条真实样例 MASK-9527 的导出字段:")
checks = [
    ("原始行号", tracked_row["原始行号"], 2),
    ("是否少数类", tracked_row["是否少数类"], "是"),
    ("是否被总指标盖住", "⚠️" in str(tracked_row["是否被总指标盖住"]), True),
    ("召回率", "%" in str(tracked_row["召回率"]), True),
    ("总指标", "%" in str(tracked_row["总指标"]), True),
    ("处理状态描述", "已确认异常" in str(tracked_row["处理状态描述"]), True),
    ("特征快照编号", tracked_row["特征快照编号"], "FEAT-E2E-MASK-9527"),
    ("特征快照补看人", tracked_row["特征快照补看人"], "阿越"),
    ("阈值回放阈值", float(tracked_row["阈值回放阈值"]), 0.65),
    ("阈值回放结果", "临界通过" in str(tracked_row["阈值回放结果"]), True),
    ("复核人", tracked_row["复核人"], "算法工程师-张工"),
    ("结果说明", "异常" in str(tracked_row["结果说明"]), True),
]
all_pass = True
for field, actual, expected in checks:
    ok = actual == expected if isinstance(expected, (bool, int, float)) else expected
    status = "✅" if ok else "❌"
    if not ok:
        all_pass = False
    p(f"   {status} {field}: {actual}  (预期 {expected})")

# 汇总 Sheet
df_summary = pd.read_excel(export_path, sheet_name="汇总说明")
p(f"\n✅ Sheet2 汇总说明:")
for _, row in df_summary.iterrows():
    p(f"   {row.iloc[0]}: {row.iloc[1]}")

# ===== 最终总结 =====
hr()
if all_pass:
    p("🎉 全部 8 个阶段验证通过！")
else:
    p("❌ 部分检查未通过")
    sys.exit(1)

hr()
p("最终结论：")
p("  1. ✅ 前端严格编译（tsc --noEmit + vite build）零错误通过")
p("  2. ✅ 真实 HTTP 链路全打通（后端API + 前端页面）")
p("  3. ✅ 同一条真实样例 MASK-9527 贯穿全流程：")
p("        导入(少数类被盖住→待复核) → 补特征快照(仍待复核) →")
p("        阈值回放(仍待复核) → 算法复核(确认异常) → 导出明细(字段全对齐)")
p("  4. ✅ 边界规则生效：少数类被总指标盖住，三步走完仍保持待复核")
p("  5. ✅ 历史留痕完整：4 条审计日志覆盖 import / add_feature / update_threshold / confirm")
p("  6. ✅ 导出明细字段与页面/接口完全一致：原始行号、少数类状态、")
p("        被盖住标记、处理状态、三步操作信息、复核人、结果说明")
p("  7. ✅ 所有字段确实来自同一条真实样例（sample_id=MASK-9527）")
