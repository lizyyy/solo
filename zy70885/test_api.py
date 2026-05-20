import requests
import json

BASE_URL = "http://localhost:8000"

def test_health_check():
    print("=== 健康检查 ===")
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")

def test_get_rules():
    print("=== 获取默认规则 ===")
    response = requests.get(f"{BASE_URL}/api/rules")
    print(f"状态码: {response.status_code}")
    rules = response.json()
    print(f"规则数量: {len(rules)}")
    for rule in rules:
        print(f"  - {rule['rule_id']}: {rule['rule_name']}")
    print()

def test_process_batch(batch_id, expect_duplicate=False):
    print(f"=== 批次处理: {batch_id} ===")
    
    with open('test_applications.csv', 'rb') as csv_file, \
         open('test_contracts.json', 'rb') as json_file:
        
        files = {
            'csv_file': ('test_applications.csv', csv_file, 'text/csv'),
            'contracts_json': ('test_contracts.json', json_file, 'application/json')
        }
        data = {'batch_id': batch_id}
        
        response = requests.post(f"{BASE_URL}/api/approval/process", files=files, data=data)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"批次ID: {result['batch_id']}")
            print(f"处理时间: {result['processed_at']}")
            print(f"总记录数: {result['total_count']}")
            print(f"正常放行: {len(result['normal'])} 条")
            print(f"待确认: {len(result['need_confirm'])} 条")
            print(f"失败退回: {len(result['failed'])} 条\n")
            
            print("--- 正常放行记录 ---")
            for item in result['normal']:
                print(f"记录ID: {item['record_id']}")
                print(f"  申请人: {item['original_data']['applicant']}")
                print(f"  说明: {item['explanation']}")
                print(f"  建议: {item['suggestion']}\n")
            
            print("--- 待确认记录 ---")
            for item in result['need_confirm']:
                print(f"记录ID: {item['record_id']}")
                print(f"  申请人: {item['original_data']['applicant']}")
                print(f"  触发规则: {', '.join(item['matched_rules'])}")
                print(f"  原因: {item['explanation']}")
                print(f"  建议处理: {item['suggestion']}\n")
            
            print("--- 失败退回记录 ---")
            for item in result['failed']:
                print(f"记录ID: {item['record_id']}")
                print(f"  申请人: {item['original_data']['applicant']}")
                print(f"  触发规则: {', '.join(item['matched_rules'])}")
                print(f"  原因: {item['explanation']}")
                print(f"  建议处理: {item['suggestion']}\n")
        else:
            print(f"错误: {response.json()['detail']}\n")

if __name__ == "__main__":
    print("法务审批API测试脚本\n")
    
    test_health_check()
    test_get_rules()
    
    test_process_batch("BATCH_20240520_001")
    
    print("=== 测试重复提交（预期失败）===")
    test_process_batch("BATCH_20240520_001", expect_duplicate=True)
    
    print("=== 测试新批次 ===")
    test_process_batch("BATCH_20240520_002")
    
    print("测试完成！")
