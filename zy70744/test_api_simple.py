import requests
import json
import subprocess
import time
import os


def main():
    if os.path.exists("featureflag_conflict.db"):
        os.remove("featureflag_conflict.db")
    
    subprocess.run(["python3", "seed_data.py"])
    
    print("Testing Feature Flag Conflict Resolution API")
    print("=" * 50)
    
    base_url = "http://localhost:8000"
    
    print("\n1. Testing list feature flags")
    try:
        response = requests.get(f"{base_url}/api/feature-flags/")
        print(f"Status: {response.status_code}")
        print(f"Found {len(response.json())} flags")
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure the server is running with: python3 main.py")
        return
    
    print("\n2. Testing create a new feature flag")
    new_flag = {
        "name": "test_api_flag",
        "description": "API测试开关",
        "conditions": {"region": "北京", "level": 3},
        "priority": 50,
        "user_group": "vip"
    }
    response = requests.post(f"{base_url}/api/feature-flags/", json=new_flag)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Created flag with id: {response.json()['id']}")
    
    print("\n3. Testing evaluate conflict (VIP user)")
    eval_request = {
        "user_id": "user_vip_001",
        "user_context": {
            "user_group": "vip",
            "login_days": 45
        }
    }
    response = requests.post(f"{base_url}/api/conflicts/evaluate", json=eval_request)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Has conflict: {result['has_conflict']}")
    if result['has_conflict']:
        print(f"Conflict id: {result['conflict_id']}")
        print(f"Winning flag: {result['winning_flag']['name']}")
        print(f"Overridden flags: {[f['name'] for f in result['overridden_flags']]}")
    
    conflict_id = result.get('conflict_id')
    
    if conflict_id:
        print(f"\n4. Testing resolve conflict (id={conflict_id})")
        resolve_request = {
            "conflict_id": conflict_id,
            "resolution": "客服确认使用VIP专用开关",
            "operator": "客服小王",
            "selected_flag_id": 1
        }
        response = requests.post(f"{base_url}/api/conflicts/resolve", json=resolve_request)
        print(f"Status: {response.status_code}")
        print(f"New status: {response.json()['status']}")
        
        print(f"\n5. Testing get conflict report (id={conflict_id})")
        response = requests.get(f"{base_url}/api/conflicts/{conflict_id}/report")
        print(f"Status: {response.status_code}")
        report = response.json()
        print(f"Final result winning flag: {report['final_result']['winning_flag']['name']}")
        
        print(f"\n6. Testing get conflict logs (id={conflict_id})")
        response = requests.get(f"{base_url}/api/conflicts/{conflict_id}/logs")
        print(f"Status: {response.status_code}")
        print(f"Logs count: {len(response.json())}")
    
    print("\n7. Testing evaluate conflict (Beijing user)")
    eval_request = {
        "user_id": "user_beijing_001",
        "user_context": {
            "region": "北京",
            "user_level": 5
        }
    }
    response = requests.post(f"{base_url}/api/conflicts/evaluate", json=eval_request)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Has conflict: {result['has_conflict']}")
    if result['has_conflict']:
        print(f"Conflict id: {result['conflict_id']}")
        print(f"Winning flag: {result['winning_flag']['name']}")
        conflict_id2 = result['conflict_id']
        
        print(f"\n8. Testing withdraw conflict (id={conflict_id2})")
        response = client.post(
            f"{base_url}/api/conflicts/{conflict_id2}/withdraw",
            params={"operator": "客服小李", "reason": "数据需要重新验证"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"New status: {response.json()['status']}")
        
        print(f"\n9. Testing close conflict (id={conflict_id})")
        response = client.post(
            f"{base_url}/api/conflicts/{conflict_id}/close",
            params={"operator": "主管张三", "reason": "用户问题已解决"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"New status: {response.json()['status']}")
    
    print("\n10. Testing conflict export")
    if conflict_id:
        response = requests.get(f"{base_url}/api/conflicts/{conflict_id}/export")
        print(f"Status: {response.status_code}")
    
    print("\n11. Testing list conflicts")
    response = requests.get(f"{base_url}/api/conflicts/")
    print(f"Status: {response.status_code}")
    print(f"Total conflicts: {len(response.json())}")
    
    print("\n12. Testing health check")
    response = requests.get(f"{base_url}/api/health")
    print(f"Status: {response.status_code}")
    print(f"Health: {response.json()['status']}")
    
    print("\n" + "=" * 50)
    print("All tests completed!")


if __name__ == "__main__":
    main()
