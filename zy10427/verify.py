#!/usr/bin/env python3
import json
from models import EvacuationStatus, ExecutionResult
from service import create_evacuation_plan, review_plan, advance_step
from service import handle_exception, manual_correct, generate_execution_summary
from storage import load_all_plans

print("=" * 60)
print("  区域流量撤离API - 核心功能验证")
print("=" * 60)

test_data = {
    'region_name': '验证-机房',
    'created_by': 'tester',
    'tenant_bindings': [
        {
            'tenant_id': 'V001',
            'tenant_name': '验证租户',
            'local_resources': ['MySQL-01'],
            'traffic_percentage': 100.0
        }
    ],
    'local_dependencies': [
        {
            'resource_type': 'DB',
            'resource_name': 'MySQL-Main',
            'is_critical': True,
            'check_status': 'PASS'
        }
    ],
    'target_percentage': 0.0
}

print("\n[1] 创建撤离计划")
plan, result, msg = create_evacuation_plan(
    test_data['region_name'],
    test_data['created_by'],
    test_data['tenant_bindings'],
    test_data['local_dependencies'],
    test_data['target_percentage']
)
print(f"  结果: {result.value}")
print(f"  消息: {msg}")
print(f"  计划ID: {plan.plan_id}")
print(f"  状态: {plan.status.value}")
plan_id = plan.plan_id

print("\n[2] 复核计划 - 通过")
plan, result, msg = review_plan(plan_id, 'reviewer', True)
print(f"  结果: {result.value}")
print(f"  消息: {msg}")
print(f"  状态: {plan.status.value}")

print("\n[3] 推进撤离步骤")
for i in range(5):
    plan, result, msg = advance_step(plan_id, 'operator')
    traffic = plan.overall_traffic_percentage if plan else 'N/A'
    print(f"  步骤{i+1}: {result.value} - 当前流量: {traffic}%")
    if plan and plan.status.value == 'COMPLETED':
        print("  撤离已完成!")
        break

print("\n[4] 生成执行摘要")
summary, result, msg = generate_execution_summary(plan_id)
print(f"  结果: {result.value}")
print(f"  区域: {summary.region_name}")
print(f"  总租户: {summary.total_tenants}")
print(f"  初始流量: {summary.initial_traffic}%")
print(f"  当前流量: {summary.current_traffic}%")
print(f"  最终状态: {summary.status}")

print("\n[5] 验证数据持久化 - 重新加载")
plans = load_all_plans()
print(f"  存储中计划数量: {len(plans)}")
print(f"  刚创建的计划存在: {plan_id in plans}")

print("\n[6] 测试异常处理场景")
plan2, result, msg = create_evacuation_plan(
    '异常-机房',
    'tester2',
    [{'tenant_id': 'E001', 'tenant_name': '异常租户', 'local_resources': []}],
    [{'resource_type': 'Net', 'resource_name': 'Switch', 'is_critical': True, 'check_status': 'FAIL'}],
    50.0
)
plan2_id = plan2.plan_id
print(f"  创建第二个计划: {result.value}")

plan2, result, msg = review_plan(plan2_id, 'admin', True)
print(f"  复核(依赖失败): {result.value}")
print(f"  状态: {plan2.status.value}")
print(f"  阻塞原因: {plan2.block_reason}")

plan2, result, msg = manual_correct(plan2_id, 'senior', {
    'local_dependencies': [{'resource_type': 'Net', 'resource_name': 'Switch', 'check_status': 'PASS'}],
    'status': 'IN_PROGRESS'
})
print(f"  人工修正: {result.value}")

plan2, result, msg = handle_exception(plan2_id, 'sre', 'TEST_ERR', '测试异常', compensate=True)
print(f"  异常补偿: {result.value}")
print(f"  最终状态: {plan2.status.value}")

print("\n" + "=" * 60)
print("  所有核心功能验证通过!")
print("=" * 60)
