#!/usr/bin/env python3
"""
完整流程测试脚本
测试：造数、启动服务、发请求、对账、导出、回放异常
"""
import sys
import os
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api/v1"

def print_step(step, message):
    print(f"\n{'='*60}")
    print(f"步骤 {step}: {message}")
    print(f"{'='*60}")

def test_login(username, password):
    """测试登录"""
    print(f"用户登录: {username}")
    response = requests.post(
        f"{API_BASE}/auth/login",
        data={"username": username, "password": password}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"登录成功，获取Token: {token[:20]}...")
        return token
    else:
        print(f"登录失败: {response.text}")
        return None

def test_create_alert(token, pile_id=1):
    """测试创建告警"""
    print(f"创建桩端告警 (桩ID: {pile_id})")
    now = datetime.now()
    data = {
        "pile_id": pile_id,
        "alert_type": "offline",
        "alert_code": "TEST001",
        "alert_message": "测试离线告警 - 网络连接异常",
        "alert_level": 2,
        "status": "active",
        "start_time": (now - timedelta(hours=2)).isoformat(),
        "end_time": None
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_BASE}/alerts/", json=data, headers=headers)
    if response.status_code == 200:
        alert_id = response.json()["id"]
        print(f"告警创建成功，ID: {alert_id}")
        return alert_id
    else:
        print(f"创建失败: {response.text}")
        return None

def test_create_bad_data(token):
    """测试创建坏数据（应该失败并进入失败列表）"""
    print("测试创建坏数据（不存在的充电桩ID）")
    data = {
        "pile_id": 9999,
        "alert_type": "offline",
        "alert_code": "BAD001",
        "alert_message": "坏数据测试",
        "start_time": datetime.now().isoformat()
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_BASE}/alerts/", json=data, headers=headers)
    if response.status_code == 400:
        print(f"预期失败，数据校验正确拦截: {response.json()['detail']}")
        return True
    else:
        print(f"异常: {response.status_code} - {response.text}")
        return False

def test_reconciliation(token, alert_id):
    """测试对账链路"""
    print(f"对账告警ID: {alert_id}")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_BASE}/reconciliation/create/{alert_id}", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"对账成功: {data.get('message')}")
        print(f"对账状态: {data.get('data', {}).get('recon_status')}")
        print(f"对账结果: {data.get('data', {}).get('recon_result')}")
        return True
    else:
        print(f"对账失败: {response.text}")
        return False

def test_check_work_order_status(token, alert_id):
    """测试检查工单状态（告警恢复但工单挂着的场景）"""
    print(f"检查告警 {alert_id} 的工单状态")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE}/reconciliation/work-order-status/{alert_id}", headers=headers)
    if response.status_code == 200:
        data = response.json().get("data", {})
        print(f"告警状态: {data.get('alert_status')}")
        print(f"关联工单: {data.get('has_work_order')}")
        if data.get("has_work_order"):
            print(f"工单状态: {data.get('work_order_status')}")
            print(f"工单号: {data.get('work_order_no')}")
        if data.get("is_alert_recovered_wo_pending"):
            print(f"⚠️  问题: {data.get('issue')}")
        return True
    else:
        print(f"检查失败: {response.text}")
        return False

def test_failed_data_list(token):
    """测试查看失败数据列表"""
    print("查看失败数据列表")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE}/failed-data/", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"失败数据总数: {data.get('total')}")
        for item in data.get("data", [])[:3]:
            print(f"  - ID: {item['id']}, 类型: {item['data_type']}, 错误: {item['error_message'][:30]}...")
        return True
    else:
        print(f"查询失败: {response.text}")
        return False

def test_export_report(token):
    """测试导出报表"""
    print("导出现月报报表")
    now = datetime.now()
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{API_BASE}/reports/monthly/export?year={now.year}&month={now.month}",
        headers=headers
    )
    if response.status_code == 200:
        filename = response.headers.get("content-disposition", "report.xlsx")
        print(f"报表导出成功: {filename}")
        return True
    else:
        print(f"导出失败: {response.text}")
        return False

def test_playback_alert_chain(token, pile_id=1):
    """测试回放异常链路"""
    print(f"回放充电桩 {pile_id} 的异常链路")
    now = datetime.now()
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "pile_id": pile_id,
        "start_time": (now - timedelta(days=7)).isoformat(),
        "end_time": now.isoformat()
    }
    response = requests.post(f"{API_BASE}/playback/alert-chain", params=params, headers=headers)
    if response.status_code == 200:
        data = response.json().get("data", {})
        print(f"告警数量: {data.get('alert_count')}")
        print(f"巡检记录: {len(data.get('inspections', []))} 条")
        print(f"投诉记录: {len(data.get('complaints', []))} 条")
        print(f"工单记录: {len(data.get('work_orders', []))} 条")
        print("\n告警链路详情:")
        for alert in data.get("alert_chain", [])[:3]:
            print(f"  - 告警{alert['alert_id']}: {alert['alert_type']} - {alert['status']}")
            print(f"    关联工单: {alert['linked_work_order']}, 巡检: {alert['linked_inspection']}, 投诉: {alert['linked_complaint']}")
        return True
    else:
        print(f"回放失败: {response.text}")
        return False

def test_get_permissions(token):
    """测试获取当前用户权限"""
    print("获取当前用户权限信息")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE}/auth/permissions", headers=headers)
    if response.status_code == 200:
        data = response.json()
        user = data.get("user", {})
        perms = data.get("permissions", {})
        print(f"用户: {user.get('full_name')} ({user.get('username')})")
        print(f"角色: {perms.get('name')} ({perms.get('role')})")
        print(f"可创建: {perms.get('can_create', [])}")
        print(f"可更新: {perms.get('can_update', [])}")
        print(f"可复核: {perms.get('can_review', [])}")
        print(f"可导出: {perms.get('can_export', [])}")
        return True
    else:
        print(f"获取权限失败: {response.text}")
        return False

def test_trace_record(token, record_type, record_id):
    """测试数据追溯"""
    print(f"追溯记录: {record_type} - {record_id}")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE}/reports/trace/{record_type}/{record_id}", headers=headers)
    if response.status_code == 200:
        data = response.json().get("data", {})
        record_data = data.get("record_data", {})
        print(f"记录类型: {data.get('record_type')}")
        print(f"数据来源: {data.get('source', [])}")
        print(f"关联记录数: {len(data.get('related_records', []))}")
        print(f"关键字段: {list(record_data.keys())[:10]}")
        return True
    else:
        print(f"追溯失败: {response.text}")
        return False

def test_audit_logs(token):
    """测试审计日志"""
    print("查看审计日志")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE}/audit/?limit=10", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"审计日志总数: {data.get('total')}")
        print("最近10条操作:")
        for log in data.get("data", [])[:10]:
            print(f"  {log['timestamp'][:19]} - {log['action']} - {log['resource_type']}")
        return True
    else:
        print(f"查询失败: {response.text}")
        return False

def main():
    print("="*60)
    print("充电桩巡检验收回放链路系统 - 完整流程测试")
    print("="*60)
    
    print("\n服务运行在: http://localhost:8001")
    print("开始测试...\n")
    
    steps = []
    
    # 步骤1: 登录测试
    print_step(1, "用户登录与权限验证")
    admin_token = test_login("admin", "admin123")
    if admin_token:
        test_get_permissions(admin_token)
        steps.append(("登录/权限", True))
    
    # 步骤2: 录入员登录并造数
    print_step(2, "数据录入 - 创建测试数据")
    operator_token = test_login("operator", "operator123")
    if operator_token:
        alert_id = test_create_alert(operator_token)
        steps.append(("创建告警", alert_id is not None))
    
    # 步骤3: 测试坏数据拦截
    print_step(3, "坏数据检测 - 验证数据质量检查")
    if operator_token:
        result = test_create_bad_data(operator_token)
        steps.append(("坏数据拦截", result))
    
    # 步骤4: 复核员对账
    print_step(4, "对账链路 - 串联告警与工单状态")
    reviewer_token = test_login("reviewer", "reviewer123")
    if reviewer_token and alert_id:
        result = test_reconciliation(reviewer_token, alert_id)
        steps.append(("对账处理", result))
    
    # 步骤5: 检查工单状态（告警恢复但工单挂着）
    print_step(5, "工单状态检查 - 发现告警恢复但工单挂着的问题")
    if reviewer_token:
        result = test_check_work_order_status(reviewer_token, 4)  # 告警4的工单仍挂着
        steps.append(("工单状态检查", result))
    
    # 步骤6: 查看失败数据
    print_step(6, "失败数据管理 - 查看坏数据列表")
    if reviewer_token:
        result = test_failed_data_list(reviewer_token)
        steps.append(("查看失败数据", result))
    
    # 步骤7: 回放异常链路
    print_step(7, "异常回放 - 展示告警、巡检、投诉、工单链路")
    if reviewer_token:
        result = test_playback_alert_chain(reviewer_token, 1)
        steps.append(("异常回放", result))
    
    # 步骤8: 数据追溯
    print_step(8, "数据追溯 - 从报表数字追到单条记录")
    if reviewer_token:
        result = test_trace_record(reviewer_token, "alert", 1)
        steps.append(("数据追溯", result))
    
    # 步骤9: 导出报表
    print_step(9, "报表导出 - 生成并导出月报")
    if reviewer_token:
        result = test_export_report(reviewer_token)
        steps.append(("报表导出", result))
    
    # 步骤10: 审计日志
    print_step(10, "审计日志 - 查看所有操作轨迹")
    if admin_token:
        result = test_audit_logs(admin_token)
        steps.append(("审计日志", result))
    
    # 测试总结
    print("\n" + "="*60)
    print("测试结果总结")
    print("="*60)
    for step_name, result in steps:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{step_name}: {status}")
    
    print("\n" + "="*60)
    print("测试完成!")
    print("="*60)

if __name__ == "__main__":
    main()
