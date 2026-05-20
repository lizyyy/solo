import requests
import json

BASE_URL = "http://localhost:8000"

def test_full_flow():
    print("=" * 50)
    print("理赔材料审核系统 - 完整流程测试")
    print("=" * 50)
    
    print("\n1. 初始化默认规则...")
    response = requests.post(f"{BASE_URL}/api/rules/init-default")
    print(f"   状态: {response.status_code}")
    print(f"   结果: {response.json()}")
    
    print("\n2. 上传保单信息...")
    with open("test_data/policy.json", "rb") as f:
        files = {"file": ("policy.json", f, "application/json")}
        response = requests.post(f"{BASE_URL}/api/claim/upload-policy", files=files)
    print(f"   状态: {response.status_code}")
    print(f"   保单号: {response.json().get('policy_no')}")
    
    print("\n3. 上传材料清单并审核 (金额超限测试)...")
    with open("test_data/materials.csv", "rb") as f:
        files = {"file": ("materials.csv", f, "text/csv")}
        params = {
            "batch_no": "BATCH_TEST_001",
            "policy_no": "POL20240001",
            "claimant_name": "张三",
            "total_amount": 60000
        }
        response = requests.post(f"{BASE_URL}/api/claim/upload-csv", params=params, files=files)
    print(f"   状态: {response.status_code}")
    result = response.json()
    print(f"   批次号: {result.get('batch_no')}")
    print(f"   正常项: {len(result.get('normal_items', []))}")
    print(f"   待确认项: {len(result.get('pending_items', []))}")
    print(f"   失败项: {len(result.get('failed_items', []))}")
    
    if result.get('failed_items'):
        print(f"\n   失败详情:")
        for item in result['failed_items'][:2]:
            print(f"     - {item['rule_code']}: {item['suggestion']}")
            print(f"       来源规则: {item['source_rule']}")
    
    print("\n4. 查询批次审核历史...")
    response = requests.get(f"{BASE_URL}/api/history/batch/BATCH_TEST_001")
    print(f"   状态: {response.status_code}")
    history = response.json()
    print(f"   历史记录数: {len(history.get('audit_history', []))}")
    
    first_result = history.get('audit_history', [None])[0]
    if first_result:
        result_id = None
        for r in history.get('audit_history', []):
            if isinstance(r, dict) and 'rule_code' in r:
                result_id = r.get('id')
                break
        
        print(f"\n5. 追踪复核意见来源...")
        response = requests.get(f"{BASE_URL}/api/history/trace/1")
        print(f"   状态: {response.status_code}")
        if response.status_code == 200:
            trace = response.json()
            print(f"   规则来源: {trace.get('source_rule')}")
            print(f"   处理建议: {trace.get('suggestion')}")
        
        print(f"\n6. 添加复核意见...")
        response = requests.put(
            f"{BASE_URL}/api/history/review/1",
            params={"reviewer": "李理赔", "comment": "已核实情况，建议退回补充材料"}
        )
        print(f"   状态: {response.status_code}")
        
    print("\n" + "=" * 50)
    print("测试完成！")
    print("=" * 50)

if __name__ == "__main__":
    try:
        test_full_flow()
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务器，请先运行: python main.py")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
