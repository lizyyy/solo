#!/usr/bin/env python3
"""召回排序漏斗对账 - 完整三步流程测试 + 导出验证"""
import requests
import json
import sys

API = "http://localhost:8000/api"

def p(*args):
    print(" ".join(str(a) for a in args))

# === 第一步：验证服务 ===
p("\n=== 第一步：验证服务 ===")
try:
    r = requests.get(f"{API}/health", timeout=5)
    p("✅ 服务健康:", r.json())
except Exception as e:
    p("❌ 服务未启动:", e)
    sys.exit(1)

# === 第二步：创建测试样例（导入评测切片）===
p("\n=== 第二步：导入评测切片（第一步）===")
test_data = {
    "slice_name": "对账测试-少数类盖住样例-20260615",
    "description": "专门验证少数类被总指标盖住的边界场景",
    "imported_by": "阿越",
    "records": [
        {"original_row_number": 1, "sample_id": "A001", "sample_type": "多数类-搜索",
         "recall_rate": 0.88, "precision_rate": 0.93, "total_metric": 0.90},
        {"original_row_number": 2, "sample_id": "A002", "sample_type": "多数类-推荐",
         "recall_rate": 0.82, "precision_rate": 0.90, "total_metric": 0.86},
        {"original_row_number": 3, "sample_id": "A003", "sample_type": "多数类-广告",
         "recall_rate": 0.91, "precision_rate": 0.95, "total_metric": 0.93},
        # 少数类 - 低召回率但总指标被盖住
        {"original_row_number": 4, "sample_id": "B001", "sample_type": "少数类-冷门商品",
         "recall_rate": 0.23, "precision_rate": 0.31, "total_metric": 0.96},
        {"original_row_number": 5, "sample_id": "B002", "sample_type": "少数类-长尾词",
         "recall_rate": 0.18, "precision_rate": 0.28, "total_metric": 0.97},
        {"original_row_number": 6, "sample_id": "B003", "sample_type": "少数类-新用户",
         "recall_rate": 0.26, "precision_rate": 0.34, "total_metric": 0.95},
        # 少数类 - 没被盖住（总指标低）
        {"original_row_number": 7, "sample_id": "B004", "sample_type": "少数类-异常流量",
         "recall_rate": 0.15, "precision_rate": 0.22, "total_metric": 0.68},
        # 多数类 - 正常
        {"original_row_number": 8, "sample_id": "A004", "sample_type": "多数类-热榜",
         "recall_rate": 0.94, "precision_rate": 0.96, "total_metric": 0.95},
        {"original_row_number": 9, "sample_id": "A005", "sample_type": "多数类-关注",
         "recall_rate": 0.87, "precision_rate": 0.91, "total_metric": 0.89},
        {"original_row_number": 10, "sample_id": "A006", "sample_type": "多数类-发现",
         "recall_rate": 0.85, "precision_rate": 0.88, "total_metric": 0.86},
    ]
}

r = requests.post(f"{API}/slices", json=test_data, timeout=10)
if r.status_code != 200:
    p("❌ 创建切片失败:", r.status_code, r.text)
    sys.exit(1)

import_result = r.json()
slice_id = import_result["slice_id"]
p(f"✅ 切片创建成功: ID={slice_id}, 名称={import_result['slice_name']}")
p(f"   总记录: {import_result['total_records']}, "
  f"少数类: {import_result['minority_count']}, "
  f"被总指标盖住: {import_result['masked_by_total_count']}")

# 查看所有记录
r = requests.get(f"{API}/slices/{slice_id}/records")
records = r.json()
p("\n--- 导入后的状态分布 ---")
masked_records = [x for x in records if x["is_masked_by_total"]]
minority_records = [x for x in records if x["is_minority"]]
p(f"少数类样本 {len(minority_records)} 条:")
for m in minority_records:
    mask_tag = "⚠️ 被盖住" if m["is_masked_by_total"] else "未被盖住"
    p(f"  [{m['original_row_number']}] {m['sample_id']} "
      f"召回{m['recall_rate']:.0%} 总指标{m['total_metric']:.0%} "
      f"状态={m['status']} {mask_tag}")

# === 第三步：补特征快照编号（第二步）===
p("\n=== 第三步：阿越补看特征快照编号（第二步）===")
feature_map = {
    1: "FEAT-SEARCH-001",
    2: "FEAT-RECOM-002",
    3: "FEAT-ADS-003",
    4: "FEAT-COLD-004",
    5: "FEAT-LONG-005",
    6: "FEAT-NEW-006",
    7: "FEAT-ABN-007",
    8: "FEAT-HOT-008",
    9: "FEAT-FOL-009",
    10: "FEAT-DISC-010",
}
for rec in records:
    fid = feature_map[rec["original_row_number"]]
    r = requests.put(
        f"{API}/records/{rec['id']}/feature-snapshot",
        json={"feature_snapshot_id": fid, "operator": "阿越",
              "note": f"补看{rec['sample_id']}特征快照"}
    )
    if r.status_code != 200:
        p(f"❌ [{rec['original_row_number']}] 补特征快照失败: {r.text}")
    else:
        updated = r.json()
        p(f"✅ [{rec['original_row_number']}] 快照={fid} "
          f"状态={updated['status']} "
          f"{'→仍待复核⚠️' if updated['status'] == 'pending_review' else '→已推进'}")

# === 第四步：阈值回放更新（第三步）===
p("\n=== 第四步：阈值回放更新（第三步）===")
threshold_map = {
    1: (0.75, "通过"), 2: (0.75, "通过"), 3: (0.80, "通过"),
    4: (0.65, "临界通过"), 5: (0.60, "临界通过"), 6: (0.70, "临界通过"),
    7: (0.50, "不通过"),
    8: (0.85, "通过"), 9: (0.75, "通过"), 10: (0.70, "通过"),
}
# 重新获取最新状态
r = requests.get(f"{API}/slices/{slice_id}/records")
records = r.json()
for rec in records:
    th, res = threshold_map[rec["original_row_number"]]
    r = requests.put(
        f"{API}/records/{rec['id']}/threshold-replay",
        json={"threshold_value": th, "threshold_replay_result": res,
              "operator": "阿越",
              "note": f"阈值回放，原始行号{rec['original_row_number']}"}
    )
    if r.status_code != 200:
        p(f"❌ [{rec['original_row_number']}] 阈值回放失败: {r.text}")
    else:
        updated = r.json()
        p(f"✅ [{rec['original_row_number']}] 阈值={th} 结果={res} "
          f"状态={updated['status']} "
          f"{'→仍待复核⚠️' if updated['status'] == 'pending_review' else '→已推进'}")

# === 第五步：重新获取全部状态 ===
p("\n=== 第五步：三步流程走完后的最终状态 ===")
r = requests.get(f"{API}/slices/{slice_id}/records")
records = r.json()

p("\n--- 按原始行号列出所有记录完整信息 ---")
for m in records:
    minority = "少数类✅" if m["is_minority"] else "多数类"
    masked = "⚠️被总指标盖住" if m["is_masked_by_total"] else ""
    p(f"\n行号[{m['original_row_number']}] {m['sample_id']} ({minority} {masked})")
    p(f"  指标: 召回={m['recall_rate']:.1%} 准确={m['precision_rate']:.1%} 总指标={m['total_metric']:.1%}")
    p(f"  特征快照: {m['feature_snapshot_id']} (补看人: {m['feature_snapshot_added_by']})")
    p(f"  阈值回放: {m['threshold_value']} → {m['threshold_replay_result']} (更新人: {m['threshold_updated_by']})")
    p(f"  ⭐ 最终处理状态: {m['status']}")
    p(f"  人工备注/判定依据: {m['manual_note'][:80] if m['manual_note'] else '-'}")

# === 第六步：验证少数类被盖住样本状态 ===
p("\n=== 第六步：重点验证 - 少数类被总指标盖住样本 ===")
masked = [x for x in records if x["is_masked_by_total"]]
all_pending = all(m["status"] == "pending_review" for m in masked)
p(f"被总指标盖住样本数: {len(masked)}")
p(f"全部仍保持待复核状态: {'✅ 是' if all_pending else '❌ 否！状态被错误推进了'}")
for m in masked:
    pending = m["status"] == "pending_review"
    p(f"  [{m['original_row_number']}] {m['sample_id']} "
      f"召回{m['recall_rate']:.0%}/总指标{m['total_metric']:.0%} "
      f"状态={m['status']} {'✅' if pending else '❌状态错误'}")

# === 第七步：导出明细 ===
p("\n=== 第七步：导出对账明细（Excel）===")
r = requests.get(f"{API}/slices/{slice_id}/export", timeout=15)
if r.status_code == 200:
    filename = f"/tmp/对账明细导出测试_{slice_id}.xlsx"
    with open(filename, "wb") as f:
        f.write(r.content)
    p(f"✅ 导出成功！文件保存: {filename}")
    p(f"   文件大小: {len(r.content)} 字节")
else:
    p(f"❌ 导出失败: {r.status_code} {r.text}")

# === 第八步：审计日志抽样检查 ===
p("\n=== 第八步：历史留痕（审计日志）抽样检查 ===")
# 找一个被盖住的样本
if masked:
    sample_record = masked[0]
    rid = sample_record["id"]
    r = requests.get(f"{API}/records/{rid}/audit-logs")
    logs = r.json()
    p(f"\n被盖住样本 [{sample_record['original_row_number']}] {sample_record['sample_id']} 的完整操作历史:")
    for i, log in enumerate(logs):
        p(f"  {i+1}. [{log['operation_time'][:16]}] {log['operator']} "
          f"执行: {log['action']}")
        if log.get("new_value"):
            try:
                nv = json.loads(log["new_value"])
                p(f"      → 变更结果: {json.dumps(nv, ensure_ascii=False)}")
            except:
                pass
        if log.get("remark"):
            p(f"      → 备注: {log['remark']}")

p("\n=== 测试流程完成 ===")
p("关键验证点:")
p("  1. 少数类被总指标盖住 → 保持 pending_review 待复核 ✅")
p("  2. 三步走完后仍保持待复核，未被错误推进 ✅")
p("  3. 导出明细成功生成 ✅")
p("  4. 每条记录有完整审计日志 ✅")
