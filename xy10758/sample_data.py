import requests
import json
from datetime import datetime, timedelta

API_BASE = 'http://127.0.0.1:5000/api'

sample_events = [
    {
        "event_id": "EVT_001",
        "subscription_id": "SUB_001",
        "user_id": "USER_001",
        "user_name": "张三",
        "owner": "王经理",
        "plan_id": "PRO_MONTHLY",
        "amount": 99.0,
        "status": "success",
        "failure_reason": "",
        "attempt_count": 0,
        "max_attempts": 3,
        "retry_strategy": "standard",
        "charge_time": (datetime.now() - timedelta(days=2)).isoformat()
    },
    {
        "event_id": "EVT_002",
        "subscription_id": "SUB_002",
        "user_id": "USER_002",
        "user_name": "李四",
        "owner": "李主管",
        "plan_id": "PRO_MONTHLY",
        "amount": 99.0,
        "status": "failed",
        "failure_reason": "余额不足",
        "attempt_count": 1,
        "max_attempts": 3,
        "retry_strategy": "standard",
        "charge_time": (datetime.now() - timedelta(days=1)).isoformat()
    },
    {
        "event_id": "EVT_003",
        "subscription_id": "SUB_003",
        "user_id": "USER_003",
        "user_name": "王五",
        "owner": "王经理",
        "plan_id": "PRO_YEARLY",
        "amount": 999.0,
        "status": "failed",
        "failure_reason": "银行卡过期",
        "attempt_count": 3,
        "max_attempts": 3,
        "retry_strategy": "aggressive",
        "charge_time": (datetime.now() - timedelta(days=5)).isoformat()
    },
    {
        "event_id": "EVT_004",
        "subscription_id": "SUB_004",
        "user_id": "USER_004",
        "user_name": "赵六",
        "owner": "张总监",
        "plan_id": "ENTERPRISE",
        "amount": 2999.0,
        "status": "pending",
        "failure_reason": "",
        "attempt_count": 0,
        "max_attempts": 3,
        "retry_strategy": "conservative",
        "charge_time": (datetime.now() - timedelta(hours=2)).isoformat()
    },
    {
        "event_id": "EVT_005",
        "subscription_id": "SUB_005",
        "user_id": "USER_005",
        "user_name": "钱七",
        "owner": "李主管",
        "plan_id": "PRO_MONTHLY",
        "amount": 88.0,
        "status": "failed",
        "failure_reason": "支付网关错误",
        "attempt_count": 2,
        "max_attempts": 3,
        "retry_strategy": "standard",
        "charge_time": (datetime.now() - timedelta(days=3)).isoformat()
    },
    {
        "event_id": "EVT_006",
        "subscription_id": "SUB_006",
        "user_id": "USER_006",
        "user_name": "孙八",
        "owner": "王经理",
        "plan_id": "PRO_YEARLY",
        "amount": 999.0,
        "status": "success",
        "failure_reason": "",
        "attempt_count": 1,
        "max_attempts": 3,
        "retry_strategy": "aggressive",
        "charge_time": (datetime.now() - timedelta(days=4)).isoformat()
    },
    {
        "event_id": "EVT_007",
        "subscription_id": "SUB_007",
        "user_id": "USER_007",
        "user_name": "周九",
        "owner": "张总监",
        "plan_id": "PRO_MONTHLY",
        "amount": 99.0,
        "status": "failed",
        "failure_reason": "用户取消支付",
        "attempt_count": 3,
        "max_attempts": 3,
        "retry_strategy": "standard",
        "charge_time": (datetime.now() - timedelta(days=10)).isoformat()
    }
]

dirty_data = [
    {
        "event_id": "DIRTY_001",
        "subscription_id": "SUB_DIRTY_001",
        "user_id": "USER_DIRTY_001",
        "user_name": "脏数据测试1",
        "owner": "测试员",
        "plan_id": "INVALID_PLAN",
        "amount": 100.0,
        "status": "failed",
        "failure_reason": "无效订阅计划（应该被拦截）",
        "attempt_count": 1,
        "max_attempts": 3,
        "retry_strategy": "standard",
        "charge_time": datetime.now().isoformat()
    },
    {
        "event_id": "DIRTY_002",
        "subscription_id": "SUB_DIRTY_002",
        "user_id": "USER_DIRTY_002",
        "user_name": "脏数据测试2",
        "owner": "测试员",
        "plan_id": "PRO_MONTHLY",
        "amount": 199.0,
        "status": "success",
        "failure_reason": "",
        "attempt_count": 0,
        "max_attempts": 3,
        "retry_strategy": "standard",
        "charge_time": datetime.now().isoformat()
    }
]

sample_downgrades = [
    {
        "action_id": "DG_001",
        "charge_event_id": "EVT_003",
        "subscription_id": "SUB_003",
        "user_id": "USER_003",
        "action_type": "downgrade_to_basic",
        "action_details": "因银行卡过期且重试失败，已从专业版年付降级到基础版",
        "executed_by": "王经理",
        "revenue_impact": -799.0,
        "notes": "用户已收到通知邮件"
    }
]

def import_sample_data():
    print("=== 导入正常样例数据 ===")
    res = requests.post(f'{API_BASE}/charge-events/batch', json=sample_events)
    results = res.json()
    for r in results:
        status = "✓" if r['success'] else "✗"
        print(f"{status} {r['item']['event_id']}: {'成功' if r['success'] else r['errors']}")
        if 'warnings' in r and r['warnings']:
            print(f"   ⚠ 警告: {r['warnings']}")
    
    print("\n=== 导入脏数据（测试校验机制） ===")
    res = requests.post(f'{API_BASE}/charge-events/batch', json=dirty_data)
    results = res.json()
    for r in results:
        status = "✓" if r['success'] else "✗"
        print(f"{status} {r['item']['event_id']}: {'成功' if r['success'] else r['errors']}")
        if 'warnings' in r and r['warnings']:
            print(f"   ⚠ 警告: {r['warnings']}")
    
    print("\n=== 导入降级动作样例 ===")
    for dg in sample_downgrades:
        res = requests.post(f'{API_BASE}/downgrade-actions', json=dg)
        result = res.json()
        if 'errors' in result:
            print(f"✗ {dg['action_id']}: {result['errors']}")
        else:
            print(f"✓ {dg['action_id']}: 成功")
    
    print("\n=== 数据导入完成 ===")
    print("\n样例场景说明:")
    print("1. EVT_001: 正常成功扣款")
    print("2. EVT_002: 扣款失败，还有重试机会")
    print("3. EVT_003: 扣款失败，重试已用尽，已执行降级")
    print("4. EVT_004: 待处理状态")
    print("5. EVT_005: 扣款失败，正在重试中")
    print("6. EVT_006: 重试后成功扣款")
    print("7. EVT_007: 重试已用尽，需要执行降级")
    print("\n脏数据场景:")
    print("- DIRTY_001: 无效订阅计划（应该被拒绝）")
    print("- DIRTY_002: 金额与计划不匹配（应该有警告但允许导入）")

if __name__ == '__main__':
    import_sample_data()
