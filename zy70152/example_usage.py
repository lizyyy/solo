"""
租户限额动态调整服务 - 使用示例
"""

from tenant_quota_service.models import (
    PlanVersion, QuotaBucket, QuotaType
)
from tenant_quota_service.storage import QuotaStorage
from tenant_quota_service.services import QuotaService


def main():
    """示例：展示租户限额动态调整服务的核心功能"""
    
    print("=" * 60)
    print("租户限额动态调整服务 - 演示")
    print("=" * 60)
    
    # ========== 1. 初始化存储和服务 ==========
    print("\n1. 初始化存储和服务...")
    storage = QuotaStorage()
    service = QuotaService(storage)
    
    # ========== 2. 创建套餐版本 ==========
    print("\n2. 创建套餐版本...")
    
    basic_plan = PlanVersion(
        plan_id="basic",
        version=1,
        name="基础版",
        quotas={
            QuotaType.REQUESTS: 1000,
            QuotaType.STORAGE: 10 * 1024 * 1024,
            QuotaType.MEMBERS: 10
        },
        description="适合小型团队"
    )
    
    pro_plan = PlanVersion(
        plan_id="pro",
        version=1,
        name="专业版",
        quotas={
            QuotaType.REQUESTS: 5000,
            QuotaType.STORAGE: 50 * 1024 * 1024,
            QuotaType.MEMBERS: 50
        },
        description="适合成长型团队"
    )
    
    enterprise_plan = PlanVersion(
        plan_id="enterprise",
        version=1,
        name="企业版",
        quotas={
            QuotaType.REQUESTS: 20000,
            QuotaType.STORAGE: 200 * 1024 * 1024,
            QuotaType.MEMBERS: 200
        },
        description="适合大型企业"
    )
    
    storage.save_plan(basic_plan)
    storage.save_plan(pro_plan)
    storage.save_plan(enterprise_plan)
    
    print(f"   创建套餐: {basic_plan.name}, {pro_plan.name}, {enterprise_plan.name}")
    
    # ========== 3. 为租户创建限额桶 ==========
    print("\n3. 为租户创建限额桶...")
    tenant_id = "tenant_001"
    
    bucket = QuotaBucket(
        tenant_id=tenant_id,
        plan_version=basic_plan,
        quotas=basic_plan.quotas.copy(),
        used={QuotaType.REQUESTS: 500}
    )
    storage.save_bucket(bucket)
    
    print(f"   租户 {tenant_id} 初始套餐: {basic_plan.name}")
    print(f"   已使用请求限额: 500/1000")
    
    # ========== 4. 查询当前限额 ==========
    print("\n4. 查询当前限额状态...")
    result = service.check_quota(tenant_id, "requests")
    if result.success:
        print(f"   请求限额: {result.data['total']}")
        print(f"   已使用: {result.data['used']}")
        print(f"   剩余: {result.data['remaining']}")
    
    # ========== 5. 套餐升级 ==========
    print("\n5. 执行套餐升级 (基础版 -> 专业版)...")
    request_id = "req_upgrade_001"
    result = service.upgrade_plan(
        tenant_id=tenant_id,
        new_plan_id="pro",
        new_plan_version=1,
        request_id=request_id,
        operator_id="system",
        notes="用户自助升级"
    )
    
    if result.success:
        print(f"   升级成功! 事务ID: {result.transaction_id}")
        print(f"   新套餐: {result.data['new_bucket']['plan']['name']}")
        print(f"   新请求限额: {result.data['new_bucket']['quotas']['requests']['effective']}")
    else:
        print(f"   升级失败: {result.message}")
        print(f"   错误: {result.errors}")
    
    # ========== 6. 验证幂等性（重复请求） ==========
    print("\n6. 测试幂等性（发送相同的升级请求）...")
    result2 = service.upgrade_plan(
        tenant_id=tenant_id,
        new_plan_id="pro",
        new_plan_version=1,
        request_id=request_id
    )
    
    if result2.success:
        print(f"   {result2.message}")
        print(f"   返回相同的事务ID: {result2.transaction_id}")
    
    # ========== 7. 限额消费 ==========
    print("\n7. 限额消费测试...")
    for i in range(3):
        result = service.consume_quota(tenant_id, "requests", amount=100)
        if result.success:
            print(f"   消费100次请求: 已用={result.data['used']}, 剩余={result.data['remaining']}")
        else:
            print(f"   消费失败: {result.message}")
    
    # ========== 8. 超限拦截测试 ==========
    print("\n8. 超限拦截测试（尝试消费超出限额的量）...")
    result = service.consume_quota(tenant_id, "requests", amount=100000)
    if not result.success:
        print(f"   拦截成功: {result.message}")
        print(f"   详情: 已用={result.data['used']}, 限额={result.data['total']}")
    
    # ========== 9. 人工调整（运营操作） ==========
    print("\n9. 人工调整限额（运营操作）...")
    result = service.manual_adjustment(
        tenant_id=tenant_id,
        quota_type="requests",
        new_value=10000,
        operator_id="admin_001",
        reason="双11活动临时配额"
    )
    
    if result.success:
        print(f"   调整成功! 事务ID: {result.transaction_id}")
        print(f"   新限额: 10000")
        
        result = service.check_quota(tenant_id, "requests")
        print(f"   当前状态: 已用={result.data['used']}, 剩余={result.data['remaining']}")
        print(f"   人工覆盖值: {result.data['manual_override']}")
    
    # ========== 10. 降级测试（带缓冲） ==========
    print("\n10. 降级测试（带缓冲机制）...")
    
    tenant2_id = "tenant_002"
    bucket2 = QuotaBucket(
        tenant_id=tenant2_id,
        plan_version=pro_plan,
        quotas=pro_plan.quotas.copy(),
        used={QuotaType.REQUESTS: 3000}
    )
    storage.save_bucket(bucket2)
    
    print(f"   租户 {tenant2_id}: 专业版, 已用请求=3000/5000")
    print(f"   降级到基础版（限额1000），但已使用3000...")
    
    result = service.upgrade_plan(
        tenant_id=tenant2_id,
        new_plan_id="basic",
        new_plan_version=1
    )
    
    if result.success:
        print(f"   降级成功!")
        print(f"   基础限额: {result.data['new_bucket']['quotas']['requests']['base']}")
        print(f"   降级缓冲: {result.data['new_bucket']['quotas']['requests']['buffer']}")
        print(f"   实际生效限额: {result.data['new_bucket']['quotas']['requests']['effective']}")
        print(f"   缓冲原因: 已使用3000 > 新套餐1000，添加2000缓冲")
    
    # ========== 11. 生成租户报表 ==========
    print("\n11. 生成租户报表（可追溯明细）...")
    result = service.export_tenant_report(
        tenant_id=tenant_id,
        transaction_limit=10
    )
    
    if result.success:
        report = result.data
        print(f"\n   租户报表:")
        print(f"   - 租户ID: {report['tenant_id']}")
        print(f"   - 当前套餐: {report['current_plan']} v{report['plan_version']}")
        print(f"\n   限额详情:")
        for qt, data in report['quotas'].items():
            print(f"     - {qt}: {data['used']}/{data['total']} (剩余: {data['remaining']})")
            if data['is_overflow']:
                print(f"       ⚠️  已超限!")
        
        print(f"\n   历史变更记录 ({len(report['recent_transactions'])} 条):")
        for tx in report['recent_transactions'][:3]:
            print(f"     - 事务ID: {tx['transaction_id'][:8]}...")
            print(f"       状态: {tx['status']}, 原因: {tx['reason']}")
            print(f"       变更明细:")
            for change in tx['changes']:
                print(f"         - {change['quota_type']}: {change['old_value']} -> {change['new_value']} ({change['change_amount']:+d})")
                if change.get('reason'):
                    print(f"           备注: {change['reason']}")
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
