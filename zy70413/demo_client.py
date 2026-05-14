import requests
import json
from demo_data import (
    generate_normal_batch,
    generate_batch_with_time_order_error,
    generate_partial_success_batch,
    generate_manual_note_example,
    generate_v1_rule,
    generate_v2_rule
)

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n=== {title} ===")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"错误: {response.text}")


def demo_1_create_rules():
    """演示1: 创建验签规则版本"""
    print("\n" + "="*50)
    print("演示1: 创建验签规则版本")
    print("="*50)
    
    print("\n创建 v1.0 规则（基础验签）")
    rule_v1 = generate_v1_rule()
    response = requests.post(f"{BASE_URL}/api/rules", json=rule_v1)
    print_response("创建 v1.0 规则", response)
    
    print("\n创建 v2.0 规则（宽松验签）")
    rule_v2 = generate_v2_rule()
    response = requests.post(f"{BASE_URL}/api/rules", json=rule_v2)
    print_response("创建 v2.0 规则", response)
    
    print("\n查询所有规则")
    response = requests.get(f"{BASE_URL}/api/rules")
    print_response("规则列表", response)


def demo_2_submit_normal_batch():
    """演示2: 提交正常批次"""
    print("\n" + "="*50)
    print("演示2: 提交正常批次")
    print("="*50)
    
    batch_data = generate_normal_batch()
    response = requests.post(f"{BASE_URL}/api/batch/submit", json=batch_data)
    print_response("提交正常批次", response)


def demo_3_submit_error_batch():
    """演示3: 提交包含时间顺序错误的批次"""
    print("\n" + "="*50)
    print("演示3: 提交包含时间顺序错误的批次")
    print("="*50)
    
    batch_data = generate_batch_with_time_order_error()
    response = requests.post(f"{BASE_URL}/api/batch/submit", json=batch_data)
    print_response("提交错误批次", response)


def demo_4_submit_partial_batch():
    """演示4: 提交部分成功的批次"""
    print("\n" + "="*50)
    print("演示4: 提交部分成功的批次")
    print("="*50)
    
    batch_data = generate_partial_success_batch()
    response = requests.post(f"{BASE_URL}/api/batch/submit", json=batch_data)
    print_response("提交部分成功批次", response)


def demo_5_query_batch_details():
    """演示5: 查询批次明细"""
    print("\n" + "="*50)
    print("演示5: 查询批次明细")
    print("="*50)
    
    batch_no = "BATCH_ERROR_001"
    response = requests.get(f"{BASE_URL}/api/batch/{batch_no}")
    print_response(f"查询批次 {batch_no}", response)


def demo_6_duplicate_submission():
    """演示6: 重复提交同一批次（幂等性）"""
    print("\n" + "="*50)
    print("演示6: 重复提交同一批次（幂等性）")
    print("="*50)
    
    batch_data = generate_normal_batch()
    print("\n第二次提交相同批次")
    response = requests.post(f"{BASE_URL}/api/batch/submit", json=batch_data)
    print_response("重复提交", response)


def demo_7_conflict_submission():
    """演示7: 同一批次号不同内容（冲突检测）"""
    print("\n" + "="*50)
    print("演示7: 同一批次号不同内容（冲突检测）")
    print("="*50)
    
    batch_data = generate_normal_batch()
    batch_data["transactions"][0]["amount"] = 999.0
    print("\n使用同一批次号但不同内容提交")
    response = requests.post(f"{BASE_URL}/api/batch/submit", json=batch_data)
    print_response("冲突提交", response)


def demo_8_add_manual_note():
    """演示8: 添加人工备注"""
    print("\n" + "="*50)
    print("演示8: 添加人工备注")
    print("="*50)
    
    note_data = generate_manual_note_example()
    response = requests.post(f"{BASE_URL}/api/notes", json=note_data)
    print_response("添加人工备注", response)
    
    print("\n按调用方查询备注")
    caller = "member_service"
    response = requests.get(f"{BASE_URL}/api/notes/caller/{caller}")
    print_response(f"查询 {caller} 的备注", response)


def demo_9_export_failed_records():
    """演示9: 导出异常记录给同事复核"""
    print("\n" + "="*50)
    print("演示9: 导出异常记录给同事复核")
    print("="*50)
    
    export_request = {
        "batch_no": "BATCH_ERROR_001",
        "include_failed_only": True,
        "created_by": "qa_team"
    }
    response = requests.post(f"{BASE_URL}/api/export", json=export_request)
    print_response("导出异常记录", response)


def demo_10_batch_with_different_rule():
    """演示10: 使用不同规则版本处理批次"""
    print("\n" + "="*50)
    print("演示10: 使用不同规则版本处理批次")
    print("="*50)
    
    batch_data = generate_batch_with_time_order_error()
    batch_data["batch_no"] = "BATCH_ERROR_WITH_V2"
    batch_data["rule_version"] = "v2.0"
    batch_data["remark"] = "使用v2.0宽松规则处理，不检查时间顺序"
    
    response = requests.post(f"{BASE_URL}/api/batch/submit", json=batch_data)
    print_response("使用v2.0规则处理", response)
    
    print("\n说明：使用v2.0规则时，时间顺序错误不会被标记为失败")
    print("旧批次仍保留当时使用的规则版本和判断口径")


def run_all_demos():
    """运行所有演示"""
    print("批量回调验签服务 - API演示")
    print("请先启动服务: python main.py")
    print("="*50)
    
    try:
        health_response = requests.get(f"{BASE_URL}/api/health")
        if health_response.status_code != 200:
            print("服务未启动，请先运行: python main.py")
            return
        print("服务连接成功 ✓")
    except Exception as e:
        print(f"无法连接到服务: {e}")
        print("请先启动服务: python main.py")
        return
    
    demo_1_create_rules()
    demo_2_submit_normal_batch()
    demo_3_submit_error_batch()
    demo_4_submit_partial_batch()
    demo_5_query_batch_details()
    demo_6_duplicate_submission()
    demo_7_conflict_submission()
    demo_8_add_manual_note()
    demo_9_export_failed_records()
    demo_10_batch_with_different_rule()
    
    print("\n" + "="*50)
    print("所有演示完成！")
    print("="*50)
    print("\n主要功能总结:")
    print("1. ✓ 支持正常/异常/部分成功批次处理")
    print("2. ✓ 自动检测时间顺序错误并标记")
    print("3. ✓ 重复提交复用旧结论（幂等性）")
    print("4. ✓ 冲突检测（同批次号不同内容）")
    print("5. ✓ 保留每条明细状态，不整批标记")
    print("6. ✓ 规则版本管理，旧批次保留判断口径")
    print("7. ✓ 人工备注入库，按调用方查询")
    print("8. ✓ 异常记录导出Excel供同事复核")


if __name__ == "__main__":
    run_all_demos()
