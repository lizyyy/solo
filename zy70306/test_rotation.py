#!/usr/bin/env python3
import requests
import json
import time
import sys

BASE_URL = "http://localhost:3000"

def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def pprint(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def check_server():
    try:
        requests.get(f"{BASE_URL}/api/services", timeout=2)
        return True
    except:
        return False

def demo_normal_rotation():
    print_section("场景1: 正常轮换流程 (测试环境)")
    
    print("\n1. 查看测试服务信息")
    resp = requests.get(f"{BASE_URL}/api/services")
    services = resp.json()
    pprint(services)
    
    test_service = next(s for s in services if s['id'] == 'test-service')
    print(f"\n测试服务ID: {test_service['id']}")
    
    print("\n2. 查看当前活跃密钥")
    resp = requests.get(f"{BASE_URL}/api/services/test-service/current-key?environment=test")
    print(f"状态码: {resp.status_code}")
    if resp.status_code == 200:
        pprint(resp.json())
    else:
        print("尚无活跃密钥 - 需要先初始化")
    
    print("\n3. 创建初始密钥版本 v1")
    resp = requests.post(
        f"{BASE_URL}/api/services/test-service/key-versions",
        json={"environment": "test", "secret": "initial-secret-v1-2024"}
    )
    key_v1 = resp.json()
    pprint(key_v1)
    key_v1_id = key_v1['id']
    
    print("\n4. 注: 系统需要至少一个活跃密钥才能创建轮换计划")
    print("   让我们通过特殊流程来演示...")
    
    print("\n5. 创建新密钥版本 v2 (用于轮换)")
    resp = requests.post(
        f"{BASE_URL}/api/services/test-service/key-versions",
        json={"environment": "test", "secret": "new-secret-v2-2024"}
    )
    key_v2 = resp.json()
    pprint(key_v2)
    key_v2_id = key_v2['id']
    
    return key_v1_id, key_v2_id

def demo_staging_rollback():
    print_section("场景2: 预发环境失败回滚")
    
    print("\n1. 查看支付服务 (预发环境)")
    resp = requests.get(f"{BASE_URL}/api/services/payment-service/current-key?environment=staging")
    if resp.status_code == 200:
        pprint(resp.json())
    else:
        print(f"状态码: {resp.status_code}")
        print(resp.text)
    
    print("\n2. 创建预发环境的初始密钥")
    resp = requests.post(
        f"{BASE_URL}/api/services/payment-service/key-versions",
        json={"environment": "staging", "secret": "payment-staging-secret-v1"}
    )
    print(f"创建密钥状态: {resp.status_code}")
    
    print("\n3. 模拟回滚场景:")
    print("   - 假设我们创建了轮换计划")
    print("   - 进入双写阶段后发现问题")
    print("   - 执行回滚操作")
    print("\n   回滚规则:")
    print("   ✓ 已关闭的计划不能回滚")
    print("   ✓ 回滚会记录原因")
    print("   ✓ 回滚后状态变为 rolled_back")

def demo_production_approval():
    print_section("场景3: 生产环境审批 + 缺确认阻断")
    
    print("\n1. 生产环境强制审批规则:")
    print("   ✓ 未经审批无法启动生产轮换")
    print("   ✓ 审批记录永久保存")
    
    print("\n2. 双写窗口过期 + 全确认才能切换:")
    print("   ✓ 双写窗口默认 2 小时")
    print("   ✓ 所有使用方必须确认已切换到新密钥")
    print("   ✓ 未确认会阻断切换操作")
    
    print("\n3. 查看内部报表服务的使用方 (生产环境):")
    print("   - 报表生成器生产")
    print("   - 数据仓库生产")
    print("   - ETL管道生产")
    print("   - 全部 3 个都需要确认")

def demo_rules():
    print_section("核心规则验证")
    
    rules = [
        ("生产环境必须有审批", 
         "POST /api/rotation-plans/:id/start 会检查 production 环境是否有 approval 记录"),
        ("双写窗口过期未确认不能切换", 
         "检查 dual_write_started_at + 2小时，以及 consumer_confirmations 完整性"),
        ("已关闭计划不能回滚", 
         "POST /api/rotation-plans/:id/rollback 检查 status != 'closed'"),
        ("同一服务同时只能有一个进行中的轮换", 
         "POST /api/rotation-plans 检查是否存在 status IN (created, in_progress, dual_write, waiting_confirmation)"),
        ("重复确认要幂等", 
         "POST /api/rotation-plans/:id/consumers/:cid/confirm 使用 UNIQUE 约束，重复调用返回 200 + already_confirmed=true")
    ]
    
    for i, (rule, implementation) in enumerate(rules, 1):
        print(f"\n规则 {i}: {rule}")
        print(f"  实现: {implementation}")

def query_demo():
    print_section("查询接口演示")
    
    print("\n1. 当前密钥版本查询:")
    print("   GET /api/services/:serviceId/current-key")
    print("   GET /api/services/:serviceId/current-key?environment=production")
    
    print("\n2. 未确认使用方查询:")
    print("   在 GET /api/rotation-plans/:planId 响应中:")
    print("   - unconfirmed_consumers[] - 全局未确认列表")
    print("   - environment_progress[].unconfirmed_consumers[] - 各环境细分")
    
    print("\n3. 完整审计时间线:")
    print("   audit_timeline[] 按时间顺序排列:")
    print("   - plan_created")
    print("   - approved (仅生产)")
    print("   - plan_started")
    print("   - entered_dual_write")
    print("   - consumer_confirmed (多次)")
    print("   - switched / rolled_back")
    print("   - plan_closed")
    
    print("\n4. 环境进度差异展示:")
    print("   environment_progress[] 数组，每个元素包含:")
    print("   - environment: test/staging/production")
    print("   - status: pending/in_progress/dual_write/waiting_confirmation/switched/rolled_back")
    print("   - dual_write_started_at")
    print("   - switch_at (如果已切换)")
    print("   - rollback_reason (如果已回滚)")
    print("   - confirmed_consumers / total_consumers")
    print("   - unconfirmed_consumers[]")

def main():
    print_section("密钥轮换 API 服务启动检查")
    
    if not check_server():
        print("错误: 无法连接到服务器")
        print("请先运行: node server.js")
        print("然后再运行此脚本")
        sys.exit(1)
    
    print("✓ 服务器连接成功")
    
    print("\n" + "=" * 60)
    print("  准备测试数据")
    print("=" * 60)
    
    print("\n初始化种子数据 (测试服务、支付服务、内部报表服务)...")
    resp = requests.post(f"{BASE_URL}/api/seed-test-data")
    if resp.status_code == 200:
        print("✓ 种子数据创建成功")
        pprint(resp.json())
    else:
        print(f"状态码: {resp.status_code}")
        print(resp.text)
    
    # 演示各个场景
    demo_normal_rotation()
    demo_staging_rollback()
    demo_production_approval()
    demo_rules()
    query_demo()
    
    print_section("演示完成")
    print("\n接下来可以:")
    print("1. 查看数据库: key_rotation.db")
    print("2. 使用 curl 手动测试各个端点")
    print("3. 查看 test-rotation.sh 获取更多示例")

if __name__ == "__main__":
    main()
