import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"


def test_create_normal_handover():
    """测试：提交正常尾箱交接"""
    print("=" * 50)
    print("测试1: 提交正常尾箱交接")
    print("=" * 50)

    data = {
        "branch_id": "B001",
        "branch_name": "朝阳支行",
        "handover_date": datetime.now().isoformat(),
        "handover_type": "晚班",
        "box_no": "BOX2024001",
        "box_amount": 50000.00,
        "error_no": "",
        "handler1_id": "H001",
        "handler1_name": "张三",
        "handler2_id": "H002",
        "handler2_name": "李四",
        "is_cross_day": 0,
        "previous_unclosed_reason": "",
        "raw_data_position": "系统A-尾箱交接表第3行",
        "created_by": "主管A"
    }

    response = requests.post(f"{BASE_URL}/api/handovers", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"任务ID: {result.get('task_id')}")
    print(f"分类结果: {result.get('category')}")
    print(f"分类原因: {result.get('category_reason')}")
    print(f"后续动作: {result.get('subsequent_action')}")
    print(f"任务状态: {result.get('status')}")
    return result.get('task_id')


def test_create_pending_supplement():
    """测试：待补充（缺少必填字段"""
    print("\n" + "=" * 50)
    print("测试2: 待补充（缺少必填字段）")
    print("=" * 50)

    data = {
        "branch_id": "B002",
        "branch_name": "海淀支行",
        "handover_date": datetime.now().isoformat(),
        "handover_type": "早班",
        "box_no": "",
        "box_amount": 30000.00,
        "error_no": "ERR001",
        "handler1_id": "H003",
        "handler1_name": "王五",
        "handler2_id": "H004",
        "handler2_name": "赵六",
        "is_cross_day": 0,
        "previous_unclosed_reason": "",
        "raw_data_position": "系统A-尾箱交接表第5行",
        "created_by": "主管B"
    }

    response = requests.post(f"{BASE_URL}/api/handovers", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"任务ID: {result.get('task_id')}")
    print(f"分类结果: {result.get('category')}")
    print(f"分类原因: {result.get('category_reason')}")
    print(f"后续动作: {result.get('subsequent_action')}")
    print(f"错误明细: {result.get('error_details')}")
    print(f"任务状态: {result.get('status')}")
    return result.get('task_id')


def test_create_blocked():
    """测试：已拦截（双人相同）"""
    print("\n" + "=" * 50)
    print("测试3: 已拦截（双人相同）")
    print("=" * 50)

    data = {
        "branch_id": "B003",
        "branch_name": "西城支行",
        "handover_date": datetime.now().isoformat(),
        "handover_type": "跨日",
        "box_no": "BOX2024003",
        "box_amount": 80000.00,
        "error_no": "ERR002",
        "handler1_id": "H005",
        "handler1_name": "孙七",
        "handler2_id": "H005",
        "handler2_name": "孙七",
        "is_cross_day": 1,
        "previous_unclosed_reason": "",
        "raw_data_position": "系统A-尾箱交接表第7行",
        "created_by": "主管C"
    }

    response = requests.post(f"{BASE_URL}/api/handovers", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"任务ID: {result.get('task_id')}")
    print(f"分类结果: {result.get('category')}")
    print(f"分类原因: {result.get('category_reason')}")
    print(f"后续动作: {result.get('subsequent_action')}")
    print(f"错误明细: {result.get('error_details')}")
    print(f"任务状态: {result.get('status')}")
    return result.get('task_id')


def test_create_cross_day_missing_reason():
    """测试：跨日交接缺少未闭合原因"""
    print("\n" + "=" * 50)
    print("测试4: 跨日交接缺少未闭合原因")
    print("=" * 50)

    data = {
        "branch_id": "B004",
        "branch_name": "东城支行",
        "handover_date": datetime.now().isoformat(),
        "handover_type": "跨日",
        "box_no": "BOX2024004",
        "box_amount": 65000.00,
        "error_no": "",
        "handler1_id": "H007",
        "handler1_name": "周八",
        "handler2_id": "H008",
        "handler2_name": "吴九",
        "is_cross_day": 1,
        "previous_unclosed_reason": "",
        "raw_data_position": "系统A-尾箱交接表第9行",
        "created_by": "主管D"
    }

    response = requests.post(f"{BASE_URL}/api/handovers", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"任务ID: {result.get('task_id')}")
    print(f"分类结果: {result.get('category')}")
    print(f"分类原因: {result.get('category_reason')}")
    print(f"后续动作: {result.get('subsequent_action')}")
    print(f"错误明细: {result.get('error_details')}")
    print(f"任务状态: {result.get('status')}")
    return result.get('task_id')


def test_update_conclusion(task_id):
    """测试：修改结论并记录审计日志"""
    print("\n" + "=" * 50)
    print("测试5: 修改结论并记录审计日志")
    print("=" * 50)

    data = {
        "field_changed": "category",
        "old_value": "待补充",
        "new_value": "正常",
        "change_reason": "已补充尾箱编号字段，数据完整",
        "changed_by_id": "A001",
        "changed_by_name": "审核员A"
    }

    response = requests.post(f"{BASE_URL}/api/handovers/{task_id}/conclusion", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"修改字段: {result.get('field_changed')}")
    print(f"修改前: {result.get('old_value')}")
    print(f"修改后: {result.get('new_value')}")
    print(f"修改原因: {result.get('change_reason')}")
    print(f"修改人: {result.get('changed_by_name')}")


def test_get_audit_logs(task_id):
    """测试：查询审计日志"""
    print("\n" + "=" * 50)
    print("测试6: 查询审计日志")
    print("=" * 50)

    response = requests.get(f"{BASE_URL}/api/handovers/{task_id}/audit-logs")
    print(f"状态码: {response.status_code}")
    logs = response.json()
    print(f"审计日志数量: {len(logs)}")
    for log in logs:
        print(f"- {log['changed_at']} - {log['changed_by_name']} 修改了 {log['field_changed']}: {log['old_value']} -> {log['new_value']}")
        print(f"  原因: {log['change_reason']}")


def test_get_field_traces(task_id):
    """测试：查询字段追溯信息"""
    print("\n" + "=" * 50)
    print("测试7: 查询字段追溯信息")
    print("=" * 50)

    response = requests.get(f"{BASE_URL}/api/handovers/{task_id}/field-traces")
    print(f"状态码: {response.status_code}")
    traces = response.json()
    print(f"追溯字段数量: {len(traces)}")
    for trace in traces:
        print(f"- 字段: {trace['field_name']}")
        print(f"  原始值: {trace['raw_value']}")
        print(f"  处理后: {trace['processed_value']}")
        print(f"  最终值: {trace['final_value']}")
        print(f"  追溯路径: {trace['trace_path']}")


def test_list_handovers():
    """测试：查询交接任务列表"""
    print("\n" + "=" * 50)
    print("测试8: 查询交接任务列表")
    print("=" * 50)

    response = requests.get(f"{BASE_URL}/api/handovers?limit=10")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"总数量: {result['total']}")
    print(f"返回数量: {len(result['items'])}")
    for item in result['items']:
        print(f"- {item['task_id']} - {item['branch_name']} - {item['category']} - {item['status']}")


def test_update_status(task_id):
    """测试：更新任务状态"""
    print("\n" + "=" * 50)
    print("测试9: 更新任务状态为已导出")
    print("=" * 50)

    response = requests.put(f"{BASE_URL}/api/handovers/{task_id}/status?new_status=EXPORTED")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"任务ID: {result.get('task_id')}")
    print(f"新状态: {result.get('status')}")


def test_get_raw_data(task_id):
    """测试：查询原始材料"""
    print("\n" + "=" * 50)
    print("测试10: 查询原始材料")
    print("=" * 50)

    response = requests.get(f"{BASE_URL}/api/handovers/{task_id}/raw-data")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"任务ID: {result.get('task_id')}")
    print(f"原始数据: {json.dumps(result['raw_data'], ensure_ascii=False, indent=2)}")


if __name__ == "__main__":
    print("银行网点尾箱交接API服务测试")
    print("请先启动服务: python main.py")
    print("=" * 60)

    try:
        task_id1 = test_create_normal_handover()
        task_id2 = test_create_pending_supplement()
        task_id3 = test_create_blocked()
        task_id4 = test_create_cross_day_missing_reason()

        test_update_conclusion(task_id2)
        test_get_audit_logs(task_id2)
        test_get_field_traces(task_id1)
        test_list_handovers()
        test_update_status(task_id1)
        test_get_raw_data(task_id1)

        print("\n" + "=" * 60)
        print("所有测试完成！")
        print("=" * 60)

    except Exception as e:
        print(f"测试出错: {e}")
        print("请确保服务已启动: python main.py")
