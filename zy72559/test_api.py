import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8000/api"

def api_call(path, method="GET", params=None):
    url = f"{BASE_URL}{path}"
    if params and method == "GET":
        url += "?" + urllib.parse.urlencode(params)
    elif params and method == "POST":
        url += "?" + urllib.parse.urlencode(params)
    
    print(f"\n>>> {method} {url}")
    
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode()
            print(f"Status: {resp.status}")
            print(f"Response: {json.dumps(json.loads(data), ensure_ascii=False, indent=2)}")
            return json.loads(data)
    except Exception as e:
        print(f"Error: {e}")
        return None

print("=" * 60)
print("1. 初始化特征快照")
api_call("/snapshots/init", method="POST")

print("\n" + "=" * 60)
print("2. 获取特征快照列表")
api_call("/snapshots")

print("\n" + "=" * 60)
print("3. 导入评测切片（不带时间窗，应该不会有冲突）")
result = api_call("/slices/import", method="POST", params={
    "slice_id": "EVAL_TEST_001",
    "slice_name": "测试冷启动切片",
    "total_users": 200,
    "feature_snapshot_id": "SNAP_20260501_V1",
    "operator": "小孟"
})

print("\n" + "=" * 60)
print("4. 获取评测切片列表")
api_call("/slices")

if result and result.get("data"):
    slice_id = result["data"]["id"]
    print(f"\n" + "=" * 60)
    print(f"5. 获取切片 {slice_id} 详情")
    api_call(f"/slices/{slice_id}")
    
    print(f"\n" + "=" * 60)
    print(f"6. 执行相似用户扩展")
    api_call(f"/slices/{slice_id}/run-expand", method="POST", params={"operator": "小孟"})
    
    print(f"\n" + "=" * 60)
    print(f"7. 获取扩展结果")
    api_call(f"/slices/{slice_id}/results", params={"page": 1, "page_size": 10})
    
    print(f"\n" + "=" * 60)
    print(f"8. 获取异常样本")
    api_call(f"/slices/{slice_id}/abnormal-samples")
    
    print(f"\n" + "=" * 60)
    print(f"9. 运行自检")
    api_call(f"/slices/{slice_id}/self-check", method="POST")
