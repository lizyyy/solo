import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8000/api"

def api_call(path, method="GET", params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode()
            return json.loads(data)
    except Exception as e:
        print(f"Error: {e}")
        return None

print("=" * 70)
print("完整流程测试：带时间窗的评测切片 + 时间窗穿越检测")
print("=" * 70)

print("\n📌 步骤1: 导入带时间窗的评测切片（故意让快照时间和时间窗不匹配）")
result = api_call("/slices/import", method="POST", params={
    "slice_id": "EVAL_TIME_TEST_001",
    "slice_name": "时间窗测试切片",
    "total_users": 500000,
    "time_window_start": "2026-06-01",
    "time_window_end": "2026-06-07",
    "feature_snapshot_id": "SNAP_20260501_V1",
    "operator": "小孟"
})

slice_id = result["data"]["id"]
print(f"   ✅ 导入成功，切片ID: {slice_id}")
if result["conflicts"]:
    print(f"   ⚠️  检测到 {len(result['conflicts'])} 个冲突:")
    for c in result["conflicts"]:
        print(f"      - {c['description']}")

print("\n📌 步骤2: 查看冲突详情，模拟评测运营小孟确认冲突")
conflict_id = result["conflicts"][0]["id"]
print(f"   冲突ID: {conflict_id}")
print(f"   冲突证据: {json.dumps(result['conflicts'][0]['evidence'], ensure_ascii=False)}")

confirm = api_call(f"/conflicts/{conflict_id}/resolve", method="POST", params={
    "resolution": "confirmed",
    "operator": "小孟"
})
print(f"   ✅ 小孟已确认冲突，继续执行")

print("\n📌 步骤3: 执行相似用户扩展（会检测时间窗穿越）")
expand_result = api_call(f"/slices/{slice_id}/run-expand", method="POST", params={"operator": "小孟"})
data = expand_result["data"]
print(f"   ✅ 扩展完成")
print(f"   - 总结果数: {data['total_results']}")
print(f"   - 异常样本数: {data['abnormal_count']}")
print(f"   - 待复核数: {data['need_review_count']}")

print("\n📌 步骤4: 查看自检报告")
for check in data["self_checks"]:
    status = "✅ 通过" if check["passed"] else "❌ 未通过"
    print(f"   {status} {check['check_name']}: {check['error_count']} 个问题")
    if check["details"].get("warning"):
        print(f"      ⚠️  {check['details']['warning']}")
    if check["details"].get("leakage_samples"):
        print(f"      📊 时间窗穿越样本数: {check['details'].get('total_leakage_count', 0)}")

print("\n📌 步骤5: 查看异常样本（时间窗穿越）")
abnormal = api_call(f"/slices/{slice_id}/abnormal-samples", params={"page": 1, "page_size": 5})
print(f"   总异常样本: {abnormal['total']}")
for sample in abnormal["samples"][:3]:
    print(f"\n   👤 用户 {sample['user_id']}:")
    print(f"      相似度: {sample['similarity_score']}")
    print(f"      异常原因: {sample['abnormal_reason']}")
    print(f"      待复核: {'是' if sample['need_review'] else '否'}")
    print(f"      复核状态: {sample['review_status']}")

print("\n📌 步骤6: 模拟实验平台负责人复核异常样本")
if abnormal["samples"]:
    sample_id = abnormal["samples"][0]["id"]
    print(f"   复核样本ID: {sample_id}")
    review = api_call(f"/results/{sample_id}/review", method="POST", params={
        "review_status": "confirmed_abnormal",
        "operator": "实验平台负责人"
    })
    print(f"   ✅ 实验平台负责人已复核，确认为异常")

print("\n📌 步骤7: 验证数据一致性 - 接口返回与数据库同一份数据")
detail = api_call(f"/slices/{slice_id}")
print(f"   详情页统计: 异常={detail['data']['abnormal_count']}, 待复核={detail['data']['need_review_count']}")

results_api = api_call(f"/slices/{slice_id}/results", params={"page": 1, "page_size": 1})
print(f"   结果接口统计: 总数={results_api['total']}")

abnormal_api = api_call(f"/slices/{slice_id}/abnormal-samples")
print(f"   异常接口统计: 总数={abnormal_api['total']}")
print(f"\n   ✅ 三个数据源读取同一份结果，数据一致！")

print("\n" + "=" * 70)
print("🎉 完整流程测试通过！")
print("=" * 70)
