#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:5000/api/v1"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(f"Status: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except:
        print(response.text)

def example_1_create_suppression():
    """示例1: 创建误报压制记录"""
    data = {
        "rule_id": "R006",
        "rule_name": "路径遍历",
        "scanner_type": "semgrep",
        "sample_content": "open(f'uploads/{filename}')",
        "file_path": "src/utils/file_handler.py",
        "line_number": 56,
        "reason": "filename 已通过 os.path.basename 校验",
        "suppressor": "security_dev",
        "expires_days": 120,
        "scanner_output": {"severity": "HIGH", "confidence": "HIGH"}
    }
    response = requests.post(f"{BASE_URL}/suppressions", json=data)
    print_response("示例1: 创建误报压制记录", response)
    if response.status_code in [200, 201]:
        return response.json().get('id')
    return None

def example_2_idempotent_check(record_id):
    """示例2: 幂等性测试 - 重复提交相同内容"""
    data = {
        "rule_id": "R006",
        "rule_name": "路径遍历",
        "scanner_type": "semgrep",
        "sample_content": "open(f'uploads/{filename}')",
        "file_path": "src/utils/file_handler.py",
        "line_number": 56,
        "reason": "filename 已通过 os.path.basename 校验",
        "suppressor": "security_dev",
        "expires_days": 120
    }
    response = requests.post(f"{BASE_URL}/suppressions", json=data)
    print_response("示例2: 幂等性测试 - 重复提交", response)

def example_3_list_suppressions():
    """示例3: 查询压制记录列表"""
    params = {
        "page": 1,
        "per_page": 10,
        "state": "pending"
    }
    response = requests.get(f"{BASE_URL}/suppressions", params=params)
    print_response("示例3: 查询待审核记录列表", response)
    
    params2 = {"expired": "false"}
    response2 = requests.get(f"{BASE_URL}/suppressions", params=params2)
    print_response("示例3b: 查询未过期记录", response2)

def example_4_get_suppression_detail(record_id):
    """示例4: 获取单条记录详情"""
    response = requests.get(f"{BASE_URL}/suppressions/{record_id}")
    print_response("示例4: 获取记录详情", response)

def example_5_state_transition(record_id):
    """示例5: 状态流转 - 从 pending -> under_review -> approved"""
    data1 = {
        "to_state": "under_review",
        "operator": "security_reviewer",
        "reason": "开始复核该误报申请"
    }
    response1 = requests.post(f"{BASE_URL}/suppressions/{record_id}/transition", json=data1)
    print_response("示例5a: 状态流转 - 开始复核", response1)
    
    data2 = {
        "to_state": "approved",
        "operator": "security_reviewer",
        "conclusion": "false_positive",
        "comment": "确认是误报，理由充分，批准压制",
        "reason": "复核完成"
    }
    response2 = requests.post(f"{BASE_URL}/suppressions/{record_id}/transition", json=data2)
    print_response("示例5b: 状态流转 - 批准压制", response2)

def example_6_invalid_transition(record_id):
    """示例6: 非法状态转换测试 - 从 approved -> rejected"""
    data = {
        "to_state": "rejected",
        "operator": "security_reviewer"
    }
    response = requests.post(f"{BASE_URL}/suppressions/{record_id}/transition", json=data)
    print_response("示例6: 非法状态转换测试", response)

def example_7_manual_correction(record_id):
    """示例7: 人工修正记录"""
    data = {
        "operator": "admin",
        "reason": "压制理由更新：新增二次校验逻辑",
        "expires_days": 180,
        "comment": "管理员修正有效期"
    }
    response = requests.put(f"{BASE_URL}/suppressions/{record_id}/correct", json=data)
    print_response("示例7: 人工修正记录", response)

def example_8_export_data():
    """示例8: 导出压制记录"""
    response = requests.get(f"{BASE_URL}/suppressions/export?format=json")
    print_response("示例8a: JSON格式导出", response)
    
    response_csv = requests.get(f"{BASE_URL}/suppressions/export?format=csv&state=approved")
    print_response("示例8b: CSV格式导出已批准记录", response_csv)

def example_9_error_tracking():
    """示例9: 查询异常处理日志"""
    response = requests.get(f"{BASE_URL}/errors?unhandled=true")
    print_response("示例9: 查询未处理的异常日志", response)

def example_10_health_check():
    """示例10: 健康检查"""
    response = requests.get(f"{BASE_URL}/health")
    print_response("示例10: 健康检查", response)

def main():
    print("误报压制复核 API 调用示例")
    print("=" * 60)
    print("请先确保服务已启动: python app.py")
    print("请先导入样例数据: python sample_data.py")
    print()
    
    try:
        example_10_health_check()
        
        record_id = example_1_create_suppression()
        
        if record_id:
            example_2_idempotent_check(record_id)
            example_4_get_suppression_detail(record_id)
            example_5_state_transition(record_id)
            example_6_invalid_transition(record_id)
            example_7_manual_correction(record_id)
        
        example_3_list_suppressions()
        example_8_export_data()
        example_9_error_tracking()
        
        print("\n" + "="*60)
        print("  API调用示例执行完成!")
        print("="*60)
        print("\n状态机说明:")
        print("  pending     → under_review | rejected | revoked")
        print("  under_review → approved | rejected | pending")
        print("  approved    → expired | revoked")
        print("  rejected    → pending")
        print("  expired     → pending")
        print("  revoked     → pending")
        print("\n复核结论:")
        print("  true_positive     - 确认为漏洞")
        print("  false_positive    - 确认为误报")
        print("  needs_more_context - 需要更多信息")
        print("  acceptable_risk   - 可接受风险")
        
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到服务器!")
        print("请先执行: python app.py")

if __name__ == '__main__':
    main()
