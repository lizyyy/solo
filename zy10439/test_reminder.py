#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:5000/api'

def generate_date(days_from_now):
    return (datetime.utcnow() + timedelta(days=days_from_now)).isoformat() + 'Z'

def pprint_response(response):
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    print("-" * 80)

def test_full_workflow():
    print("=" * 80)
    print("密钥到期催办系统 - 完整工作流测试")
    print("=" * 80)
    
    print("\n[1] 创建系统账号")
    accounts = [
        {"account_name": "prod-payment-service", "system_name": "支付系统", "environment": "生产"},
        {"account_name": "uat-user-auth", "system_name": "用户认证", "environment": "UAT"},
        {"account_name": "dev-data-analysis", "system_name": "数据分析", "environment": "开发"}
    ]
    account_ids = []
    for acc in accounts:
        r = requests.post(f"{BASE_URL}/accounts", json=acc)
        pprint_response(r)
        account_ids.append(r.json()['id'])
    
    print("\n[2] 创建密钥信息（包含不同到期时间）")
    keys = [
        {
            "account_id": account_ids[0],
            "key_name": "支付网关API密钥",
            "key_purpose": "用于对接第三方支付渠道的API调用认证",
            "expiry_date": generate_date(25),
            "owner": "zhangsan",
            "backup_owner": "lisi"
        },
        {
            "account_id": account_ids[0],
            "key_name": "数据库加密密钥",
            "key_purpose": "用户敏感数据字段加密",
            "expiry_date": generate_date(12),
            "owner": "zhangsan",
            "backup_owner": "wangwu"
        },
        {
            "account_id": account_ids[1],
            "key_name": "OAuth客户端密钥",
            "key_purpose": "第三方登录OAuth认证",
            "expiry_date": generate_date(5),
            "owner": "lisi",
            "backup_owner": "zhaoliu"
        },
        {
            "account_id": account_ids[1],
            "key_name": "JWT签名密钥",
            "key_purpose": "用户Token签名验证",
            "expiry_date": generate_date(2),
            "owner": "wangwu",
            "backup_owner": "zhangsan"
        },
        {
            "account_id": account_ids[2],
            "key_name": "数据同步密钥",
            "key_purpose": "跨系统数据同步认证",
            "expiry_date": generate_date(-2),
            "owner": "zhaoliu",
            "backup_owner": "lisi"
        }
    ]
    key_ids = []
    for key in keys:
        r = requests.post(f"{BASE_URL}/keys", json=key)
        pprint_response(r)
        key_ids.append(r.json()['id'])
    
    print("\n[3] 查询所有密钥信息")
    r = requests.get(f"{BASE_URL}/keys")
    pprint_response(r)
    
    print("\n[4] 生成催办记录（自动检测到期分级）")
    r = requests.post(f"{BASE_URL}/reminders/generate", json={"operator": "system-admin"})
    pprint_response(r)
    generated = r.json()['generated']
    
    print("\n[5] 查询所有催办记录")
    r = requests.get(f"{BASE_URL}/reminders")
    pprint_response(r)
    reminders = r.json()
    reminder_id = reminders[0]['id'] if reminders else None
    
    if reminder_id:
        print(f"\n[6] 发送催办通知 - 催办ID: {reminder_id}")
        r = requests.post(f"{BASE_URL}/reminders/{reminder_id}/send", json={"operator": "system-admin"})
        pprint_response(r)
        
        print(f"\n[7] 再次发送催办（重复催办，增加计数）")
        r = requests.post(f"{BASE_URL}/reminders/{reminder_id}/send", json={"operator": "system-admin"})
        pprint_response(r)
        
        print(f"\n[8] 升级催办 - 转交给主管")
        r = requests.post(f"{BASE_URL}/reminders/{reminder_id}/escalate", json={
            "escalated_to": "tech-lead",
            "operator": "system-admin"
        })
        pprint_response(r)
        
        print(f"\n[9] 负责人转交（模拟休假场景）")
        r = requests.post(f"{BASE_URL}/reminders/{reminder_id}/transfer", json={
            "new_owner": "backup-owner",
            "reason": "原负责人休假一周",
            "operator": "system-admin"
        })
        pprint_response(r)
        
        print(f"\n[10] 处理催办 - 记录处理结论")
        r = requests.post(f"{BASE_URL}/reminders/{reminder_id}/process", json={
            "conclusion_type": "密钥已更新",
            "conclusion": "已生成新的密钥并更新到所有配置文件，旧密钥将在7天后作废",
            "processed_by": "backup-owner",
            "follow_up_action": "监控旧密钥使用情况，到期后立即删除",
            "next_review_date": generate_date(7)
        })
        pprint_response(r)
        
        print(f"\n[11] 查看状态流转历史")
        r = requests.get(f"{BASE_URL}/reminders/{reminder_id}/transitions")
        pprint_response(r)
        
        print(f"\n[12] 查看处理结论")
        r = requests.get(f"{BASE_URL}/reminders/{reminder_id}/conclusions")
        pprint_response(r)
    
    print("\n[13] 测试异常路径 - 无效数据创建账号")
    r = requests.post(f"{BASE_URL}/accounts", json={"invalid_field": "test"})
    pprint_response(r)
    
    print("\n[14] 测试人工修正功能")
    if reminder_id:
        r = requests.post(f"{BASE_URL}/reminders/{reminder_id}/correct", json={
            "new_status": "pending",
            "new_owner": "new-owner",
            "error_message": "修正之前的处理错误",
            "reason": "需要重新处理",
            "operator": "admin-user"
        })
        pprint_response(r)
    
    print("\n[15] 导出催办记录CSV")
    r = requests.get(f"{BASE_URL}/export/reminders")
    result = r.json()
    print(f"文件名: {result['filename']}")
    print("CSV内容预览:")
    print(result['content'][:500])
    print("...")
    
    print("\n[16] 导出状态流转历史CSV")
    r = requests.get(f"{BASE_URL}/export/status-transitions")
    result = r.json()
    print(f"文件名: {result['filename']}")
    print("CSV内容预览:")
    print(result['content'][:500])
    print("...")
    
    print("\n[17] 再次生成催办记录（验证去重逻辑）")
    r = requests.post(f"{BASE_URL}/reminders/generate")
    pprint_response(r)
    
    print("\n[18] 按状态筛选催办记录")
    r = requests.get(f"{BASE_URL}/reminders?status=processed")
    pprint_response(r)
    
    print("\n" + "=" * 80)
    print("测试完成！")
    print("=" * 80)

def test_duplicate_reminder():
    print("\n" + "=" * 80)
    print("测试催办去重逻辑")
    print("=" * 80)
    
    print("\n创建一个5天后到期的密钥")
    r = requests.get(f"{BASE_URL}/accounts")
    accounts = r.json()
    if not accounts:
        print("请先运行完整工作流测试")
        return
    
    key_data = {
        "account_id": accounts[0]['id'],
        "key_name": "测试去重密钥",
        "key_purpose": "用于测试催办去重功能",
        "expiry_date": generate_date(5),
        "owner": "tester",
        "backup_owner": "tester2"
    }
    r = requests.post(f"{BASE_URL}/keys", json=key_data)
    pprint_response(r)
    
    print("\n第一次生成催办")
    r = requests.post(f"{BASE_URL}/reminders/generate")
    print(f"生成数量: {r.json()['generated_count']}")
    
    print("\n第二次生成催办（应该去重）")
    r = requests.post(f"{BASE_URL}/reminders/generate")
    print(f"生成数量: {r.json()['generated_count']}")
    print("如果生成数量为0，说明去重功能正常")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'duplicate':
        test_duplicate_reminder()
    else:
        test_full_workflow()
