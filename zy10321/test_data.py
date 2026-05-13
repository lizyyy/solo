import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    print(f"{'='*60}")


def setup_test_data():
    print("开始创建测试数据...\n")

    # 1. 创建服务分组
    print("1. 创建服务分组")
    group_data = {"name": "支付核心服务", "description": "支付系统核心变更管理"}
    r = requests.post(f"{BASE_URL}/api/v1/service-groups/", json=group_data)
    print_response("创建服务分组", r)
    group_id = r.json()["id"]

    # 2. 创建审批人
    print("\n2. 创建审批人")
    approver_data = {
        "user_id": "admin001",
        "user_name": "张三",
        "email": "zhangsan@example.com",
        "role": "admin",
        "service_group_id": group_id
    }
    r = requests.post(f"{BASE_URL}/api/v1/approvers/", json=approver_data)
    print_response("创建审批人", r)

    # 3. 创建冻结日历
    print("\n3. 创建冻结日历")
    now = datetime.utcnow()
    freeze_data = {
        "name": "五一假期冻结期",
        "service_group_id": group_id,
        "start_time": (now - timedelta(days=1)).isoformat(),
        "end_time": (now + timedelta(days=7)).isoformat(),
        "reason": "五一假期期间禁止核心变更",
        "created_by": "admin001"
    }
    r = requests.post(f"{BASE_URL}/api/v1/freeze-calendars/", json=freeze_data)
    print_response("创建冻结日历", r)
    freeze_id = r.json()["id"]

    print("\n测试数据创建完成！")
    return group_id, freeze_id


def test_normal_scenario(group_id):
    print("\n\n【场景1: 正常变更 - 不在冻结期内】")
    future_time = (datetime.utcnow() + timedelta(days=30)).isoformat()
    change_data = {
        "change_id": "CHG-001-NORMAL",
        "title": "非冻结期正常变更",
        "description": "这个变更不在冻结期，应该直接通过",
        "service_group_id": group_id,
        "planned_time": future_time,
        "requester": "dev001",
        "idempotency_key": "key-normal-001"
    }
    r = requests.post(f"{BASE_URL}/api/v1/change-orders/", json=change_data)
    print_response("创建正常变更", r)
    status = r.json()["status"]
    print(f"变更状态: {status} - {'✓ 正常通过' if status == 'approved' else '✗ 异常'}")


def test_blocked_scenario(group_id):
    print("\n\n【场景2: 被拦截的变更 - 在冻结期内】")
    freeze_time = (datetime.utcnow() + timedelta(days=3)).isoformat()
    change_data = {
        "change_id": "CHG-002-BLOCKED",
        "title": "冻结期内变更",
        "description": "这个变更在五一冻结期内，应该被拦截",
        "service_group_id": group_id,
        "planned_time": freeze_time,
        "requester": "dev002",
        "idempotency_key": "key-blocked-001"
    }
    r = requests.post(f"{BASE_URL}/api/v1/change-orders/", json=change_data)
    print_response("创建冻结期变更", r)
    change_id = r.json()["id"]
    status = r.json()["status"]
    print(f"变更状态: {status} - {'✓ 已被拦截' if status == 'blocked' else '✗ 未被拦截（异常）'}")

    r = requests.get(f"{BASE_URL}/api/v1/block-logs/", params={"change_id": change_id})
    print_response("查看拦截日志", r)

    return change_id


def test_duplicate_request(group_id):
    print("\n\n【场景3: 重复请求 - 幂等性测试】")
    future_time = (datetime.utcnow() + timedelta(days=40)).isoformat()
    change_data = {
        "change_id": "CHG-003-IDEMPOTENT",
        "title": "幂等性测试变更",
        "description": "使用相同idempotency_key重复提交，不会创建新记录",
        "service_group_id": group_id,
        "planned_time": future_time,
        "requester": "dev003",
        "idempotency_key": "key-idempotent-001"
    }

    print("第一次提交:")
    r1 = requests.post(f"{BASE_URL}/api/v1/change-orders/", json=change_data)
    print_response("第一次提交", r1)
    id1 = r1.json()["id"]
    created_at1 = r1.json()["created_at"]

    print("\n第二次提交（相同幂等键）:")
    r2 = requests.post(f"{BASE_URL}/api/v1/change-orders/", json=change_data)
    print_response("第二次提交", r2)
    id2 = r2.json()["id"]
    created_at2 = r2.json()["created_at"]

    print(f"\n第一次ID: {id1}, 第二次ID: {id2}")
    print(f"ID相同: {'✓ 是' if id1 == id2 else '✗ 否（异常）'}")
    print(f"创建时间相同: {'✓ 是' if created_at1 == created_at2 else '✗ 否（异常）'}")


def test_exception_approval(change_id, freeze_id):
    print("\n\n【场景4: 人工处理 - 例外审批流程】")

    print("步骤1: 创建例外申请")
    exception_data = {
        "request_id": "EXC-001",
        "change_id": change_id,
        "freeze_id": freeze_id,
        "reason": "紧急bug修复，影响线上交易",
        "requester": "dev002",
        "is_emergency": True
    }
    r = requests.post(f"{BASE_URL}/api/v1/exception-requests/", json=exception_data)
    print_response("创建例外申请", r)
    exception_id = r.json()["id"]

    print("\n步骤2: 审批例外申请")
    approve_data = {
        "approver": "admin001",
        "status": "approved"
    }
    r = requests.patch(f"{BASE_URL}/api/v1/exception-requests/{exception_id}/approve", json=approve_data)
    print_response("审批例外申请", r)

    print("\n步骤3: 重新验证变更")
    r = requests.post(f"{BASE_URL}/api/v1/change-orders/{change_id}/validate")
    print_response("重新验证变更", r)
    allowed = r.json()["allowed"]
    print(f"是否允许: {'✓ 是' if allowed else '✗ 否（异常）'}")

    print("\n步骤4: 查看变更最终状态")
    r = requests.get(f"{BASE_URL}/api/v1/change-orders/{change_id}")
    print_response("变更最终状态", r)
    final_status = r.json()["status"]
    print(f"最终状态: {final_status}")


def test_export_logs():
    print("\n\n【场景5: 导出拦截日志】")
    r = requests.get(f"{BASE_URL}/api/v1/block-logs/export")
    print_response("导出所有拦截日志", r)


if __name__ == "__main__":
    try:
        group_id, freeze_id = setup_test_data()
        test_normal_scenario(group_id)
        change_id = test_blocked_scenario(group_id)
        test_duplicate_request(group_id)
        test_exception_approval(change_id, freeze_id)
        test_export_logs()
        print("\n\n所有测试场景完成！")
    except Exception as e:
        print(f"\n错误: {e}")
        print("请确保服务已启动: uvicorn app.main:app --reload")
