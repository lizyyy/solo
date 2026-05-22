#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8001/api/v1"


def get_token(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": username, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    print(f"登录失败: {response.status_code} - {response.text}")
    return None


def test_health_check():
    print("\n=== 健康检查 ===")
    response = requests.get("http://localhost:8001/health")
    print(f"状态: {response.status_code}")
    print(f"响应: {response.json()}")


def test_role_permissions():
    print("\n=== 测试角色权限 ===")

    roles = [
        ("admin", "admin123", "主管"),
        ("reviewer", "reviewer123", "复核"),
        ("entry", "entry123", "录入"),
        ("readonly", "readonly123", "只读"),
    ]

    for username, password, role_name in roles:
        token = get_token(username, password)
        if not token:
            continue

        headers = {"Authorization": f"Bearer {token}"}

        response = requests.get(
            f"{BASE_URL}/ledger/role-config/view",
            headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            print(f"\n[{role_name}] 可见字段数: {len(data['visible_fields'])}, 可编辑字段数: {len(data['editable_fields'])}")
            print(f"  可编辑字段: {data['editable_fields'][:10]}...")


def test_create_and_flow():
    print("\n=== 测试台账记录完整流程 ===")

    token = get_token("entry", "entry123")
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}

    print("\n1. 录入员创建记录")
    record_data = {
        "franchise_id": "F001",
        "franchise_name": "北京朝阳店",
        "record_date": datetime.now().isoformat(),
        "material_name": "珍珠",
        "material_code": "MAT001",
        "quantity": 10.5,
        "unit": "kg",
        "unit_price": 15.0,
        "total_amount": 157.5,
        "order_quantity": 12,
        "order_amount": 180,
        "loss_quantity": 1.5,
        "loss_amount": 22.5,
        "headquarter_price": 12.0,
        "source_order_no": "ORD20240523001",
        "change_reason": "正常进货",
        "remarks": "测试记录"
    }
    response = requests.post(
        f"{BASE_URL}/ledger",
        headers=headers,
        json=record_data
    )
    print(f"创建状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        record_id = data["id"]
        print(f"创建成功! 记录ID: {record_id}, 编号: {data['record_no']}, 状态: {data['status']}")
        print(f"是否有脏数据: {data.get('is_dirty', False)}")

        print("\n2. 录入员提交审核")
        response = requests.post(
            f"{BASE_URL}/ledger/{record_id}/submit",
            headers=headers,
            json={"reason": "录入完成，申请审核"}
        )
        print(f"提交状态: {response.status_code}")

    else:
        print(f"创建失败: {response.text}")
        return

    print("\n3. 复核员驳回")
    reviewer_token = get_token("reviewer", "reviewer123")
    reviewer_headers = {"Authorization": f"Bearer {reviewer_token}"}
    response = requests.post(
        f"{BASE_URL}/ledger/{record_id}/reject",
        headers=reviewer_headers,
        json={"reason": "需要补充明细", "rejection_reason": "缺少入库单编号，请补充"}
    )
    print(f"驳回状态: {response.status_code}")
    print(f"响应: {response.json()}")

    print("\n4. 录入员修改后重新提交")
    update_data = {"source_loss_no": "LOSS20240523001"}
    response = requests.put(
        f"{BASE_URL}/ledger/{record_id}",
        headers=headers,
        json=update_data,
        params={"change_reason": "补充损耗单号"}
    )
    print(f"修改状态: {response.status_code}")

    response = requests.post(
        f"{BASE_URL}/ledger/{record_id}/submit",
        headers=headers,
        json={"reason": "已补充损耗单号"}
    )
    print(f"重新提交状态: {response.status_code}")

    print("\n5. 主管确认")
    admin_token = get_token("admin", "admin123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/ledger/{record_id}/confirm",
        headers=admin_headers,
        json={"reason": "审核通过"}
    )
    print(f"确认状态: {response.status_code}")
    print(f"响应: {response.json()}")

    print("\n6. 查看详情（含历史）")
    response = requests.get(
        f"{BASE_URL}/ledger/{record_id}",
        headers=admin_headers
    )
    if response.status_code == 200:
        data = response.json()
        print(f"当前状态: {data['status']}")
        print(f"状态变更次数: {len(data.get('status_history', []))}")
        print(f"字段变更次数: {len(data.get('field_changes', []))}")
        for h in data.get('status_history', []):
            print(f"  - {h['from_status']} -> {h['to_status']}: {h.get('reason', '')}")


def test_dirty_detection():
    print("\n=== 测试脏记录检测 ===")

    token = get_token("entry", "entry123")
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}

    print("\n创建有问题的记录...")
    record_data = {
        "franchise_id": "F001",
        "franchise_name": "脏数据测试店",
        "record_date": "2024-01-01T00:00:00",
        "material_name": "椰果",
        "quantity": 10,
        "unit_price": 10,
        "total_amount": 150,
    }
    response = requests.post(
        f"{BASE_URL}/ledger",
        headers=headers,
        json=record_data
    )
    if response.status_code == 200:
        data = response.json()
        print(f"记录ID: {data['id']}")
        print(f"是否脏数据标记: {data.get('is_dirty')}")
        print(f"脏数据类型: {data.get('dirty_types')}")


def test_list_and_export():
    print("\n=== 测试列表和导出 ===")

    token = get_token("admin", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(f"{BASE_URL}/ledger", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"总记录数: {data['total']}")
        print(f"当前页记录数: {len(data['items'])}")

    print("\n导出Excel...")
    response = requests.post(
        f"{BASE_URL}/ledger/export",
        headers=headers,
        json={"masked": False}
    )
    if response.status_code == 200:
        with open("test_export.xlsx", "wb") as f:
            f.write(response.content)
        print("导出成功，保存为 test_export.xlsx")


def test_readonly_view():
    print("\n=== 测试只读用户视图 ===")
    token = get_token("readonly", "readonly123")
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(f"{BASE_URL}/ledger", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"只读用户可见记录数: {data['total']}")
        if data['items']:
            first_record = data['items'][0]
            print(f"单条记录可见字段: {list(first_record.keys())[:15]}...")
            print(f"是否包含敏感字段总部价格: {'headquarter_price' in first_record}")


if __name__ == "__main__":
    test_health_check()
    test_role_permissions()
    test_create_and_flow()
    test_dirty_detection()
    test_list_and_export()
    test_readonly_view()
    print("\n=== 测试完成 ===")
