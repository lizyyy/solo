#!/usr/bin/env python3
"""预览环境租约审计 - 样例数据生成器

包含:
1. 正常输入场景
2. 脏数据
3. 边界冲突
4. 空结果
"""

import json
import sys
from datetime import datetime, timedelta
from env_audit.models import LeaseManager, Environment, LeaseStatus, EnvironmentStatus


def generate_normal_scenario():
    """生成正常场景数据"""
    print("=" * 60)
    print("场景 1: 正常输入场景")
    print("=" * 60)

    manager = LeaseManager()
    for i in range(1, 6):
        manager.add_environment(Environment(env_id=f"env-{i:02d}", name=f"预览环境{i:02d}"))

    results = []

    results.append(manager.create_lease(
        "env-01", "feature/user-login", "zhangsan", 8, "用户登录功能联调"
    ))

    results.append(manager.create_lease(
        "env-02", "feature/payment-gateway", "lisi", 24, "支付网关集成测试",
        request_id="req-001"
    ))

    results.append(manager.renew_lease(
        "env-02", "lisi", 8, "需要继续验证边界情况",
        request_id="req-002"
    ))

    results.append(manager.create_lease(
        "env-03", "hotfix/security-patch", "wangwu", 4, "安全补丁紧急修复"
    ))

    results.append(manager.release_lease(
        "env-03", "wangwu", "修复完成，已上线"
    ))

    print(f"\n✓ 生成了 {len([r for r in results if r.get('success')])} 条成功操作")
    print("\n当前状态:")
    report = manager.get_occupancy_report()
    print(json.dumps(report['summary'], ensure_ascii=False, indent=2))

    return {
        'scenario': 'normal',
        'results': results,
        'report': report
    }


def generate_conflict_scenario():
    """生成冲突场景数据"""
    print("\n" + "=" * 60)
    print("场景 2: 边界冲突场景")
    print("=" * 60)

    manager = LeaseManager()
    manager.add_environment(Environment(env_id="env-01", name="预览环境01"))

    results = []

    results.append(manager.create_lease(
        "env-01", "feature/a", "zhangsan", 8, "A功能开发"
    ))
    print(f"\n1. zhangsan 租用 env-01: {'成功' if results[-1]['success'] else '失败'}")

    results.append(manager.create_lease(
        "env-01", "feature/b", "lisi", 8, "B功能开发"
    ))
    print(f"2. lisi 尝试租用 env-01: {'成功' if results[-1]['success'] else '失败 - ' + results[-1].get('error', '')}")

    results.append(manager.renew_lease(
        "env-01", "lisi", 8, "我想续租"
    ))
    print(f"3. lisi 尝试续租 env-01: {'成功' if results[-1]['success'] else '失败 - ' + results[-1].get('error', '')}")

    results.append(manager.release_lease(
        "env-01", "lisi", "我要释放"
    ))
    print(f"4. lisi 尝试释放 env-01: {'成功' if results[-1]['success'] else '失败 - ' + results[-1].get('error', '')}")

    results.append(manager.release_lease(
        "env-01", None, "管理员强制释放", force=True
    ))
    print(f"5. 管理员强制释放 env-01: {'成功' if results[-1]['success'] else '失败'}")

    results.append(manager.release_lease(
        "env-01", "zhangsan", "再次释放"
    ))
    print(f"6. 再次释放已释放的 env-01: {results[-1].get('message', '成功')}")

    return {
        'scenario': 'conflict',
        'results': results
    }


def generate_idempotent_scenario():
    """生成幂等性场景"""
    print("\n" + "=" * 60)
    print("场景 3: 重复请求幂等性场景")
    print("=" * 60)

    manager = LeaseManager()
    manager.add_environment(Environment(env_id="env-01", name="预览环境01"))

    results = []

    results.append(manager.create_lease(
        "env-01", "feature/a", "zhangsan", 8, "A功能开发",
        request_id="same-request-id-123"
    ))
    print(f"\n1. 第一次租用: {'成功' if results[-1]['success'] else '失败'}")

    results.append(manager.create_lease(
        "env-01", "feature/a", "zhangsan", 8, "A功能开发",
        request_id="same-request-id-123"
    ))
    print(f"2. 重复相同请求: {results[-1].get('message', '无消息')} (idempotent={results[-1].get('idempotent')})")

    results.append(manager.renew_lease(
        "env-01", "zhangsan", 8, "续租",
        request_id="renew-request-456"
    ))
    print(f"3. 第一次续租: {'成功' if results[-1]['success'] else '失败'}")

    results.append(manager.renew_lease(
        "env-01", "zhangsan", 8, "续租",
        request_id="renew-request-456"
    ))
    print(f"4. 重复续租请求: {results[-1].get('message', '无消息')} (idempotent={results[-1].get('idempotent')})")

    return {
        'scenario': 'idempotent',
        'results': results
    }


def generate_expired_scenario():
    """生成过期租约场景"""
    print("\n" + "=" * 60)
    print("场景 4: 租约过期判断场景")
    print("=" * 60)

    manager = LeaseManager()
    manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
    manager.add_environment(Environment(env_id="env-02", name="预览环境02"))
    manager.add_environment(Environment(env_id="env-03", name="预览环境03"))

    lease1 = manager.environments['env-01'].current_lease
    if not lease1:
        result = manager.create_lease("env-01", "feature/expired", "zhangsan", 8, "测试过期")
        if result['success']:
            result['lease'].end_time = datetime.now() - timedelta(hours=1)

    result = manager.create_lease("env-02", "feature/almost-expired", "lisi", 8, "测试即将过期")
    if result['success']:
        result['lease'].end_time = datetime.now() + timedelta(minutes=30)

    result = manager.create_lease("env-03", "feature/normal", "wangwu", 8, "正常租约")

    expired = manager.check_expired_leases()
    print(f"\n发现 {len(expired)} 个过期租约")
    for e in expired:
        print(f"  - {e.env_id}: {e.branch_name} ({e.assignee})")

    report = manager.get_occupancy_report()
    print(f"\n即将到期(<2h): {report['summary']['expiring_soon']} 个")

    return {
        'scenario': 'expired',
        'expired_count': len(expired),
        'report': report
    }


def generate_empty_scenario():
    """生成空结果场景"""
    print("\n" + "=" * 60)
    print("场景 5: 空结果场景")
    print("=" * 60)

    manager = LeaseManager()
    for i in range(1, 4):
        manager.add_environment(Environment(env_id=f"env-{i:02d}", name=f"预览环境{i:02d}"))

    history = manager.get_lease_history()
    print(f"\n租约历史 (空): {len(history)} 条")

    expired = manager.check_expired_leases()
    print(f"过期租约 (空): {len(expired)} 条")

    report = manager.get_occupancy_report()
    print(f"可用环境: {report['summary']['available']} 个")
    print(f"已占用: {report['summary']['occupied']} 个")

    should_release = [
        e for e in report['environments']
        if e['status'] == 'occupied' and (e.get('is_expired') or e['remaining_hours'] < 4)
    ]
    print(f"应该释放 (空): {len(should_release)} 个")

    return {
        'scenario': 'empty',
        'history_count': len(history),
        'expired_count': len(expired),
        'report': report
    }


def generate_dirty_data_scenario():
    """生成脏数据场景"""
    print("\n" + "=" * 60)
    print("场景 6: 脏数据/异常输入场景")
    print("=" * 60)

    manager = LeaseManager()
    manager.add_environment(Environment(env_id="env-01", name="预览环境01"))

    results = []

    results.append(manager.create_lease(
        "env-999", "feature/x", "zhangsan", 8, "不存在的环境"
    ))
    print(f"\n1. 租用不存在的环境: {results[-1].get('error', '')}")

    results.append(manager.renew_lease(
        "env-01", "zhangsan", 8, "续租不存在的租约"
    ))
    print(f"2. 续租不存在的租约: {results[-1].get('error', '')}")

    results.append(manager.release_lease("env-999"))
    print(f"3. 释放不存在的环境: {results[-1].get('error', '')}")

    results.append(manager.create_lease(
        "env-01", "", "zhangsan", 8, "空分支名"
    ))
    print(f"4. 空分支名: {results[-1].get('error', '')}")

    results.append(manager.create_lease(
        "env-01", "feature/test", "", 8, "空占用人"
    ))
    print(f"5. 空占用人: {results[-1].get('error', '')}")

    results.append(manager.create_lease(
        "env-01", "feature/test", "zhangsan", -1, "负租期"
    ))
    print(f"6. 负租期: {results[-1].get('error', '')}")

    results.append(manager.create_lease(
        "env-01", "feature/test", "zhangsan", 8, ""
    ))
    print(f"7. 空租用理由: {results[-1].get('error', '')}")

    return {
        'scenario': 'dirty_data',
        'results': results
    }


def main():
    print("预览环境租约审计排查CLI - 样例数据生成器\n")

    all_data = {
        'generated_at': datetime.now().isoformat(),
        'scenarios': []
    }

    all_data['scenarios'].append(generate_normal_scenario())
    all_data['scenarios'].append(generate_conflict_scenario())
    all_data['scenarios'].append(generate_idempotent_scenario())
    all_data['scenarios'].append(generate_expired_scenario())
    all_data['scenarios'].append(generate_empty_scenario())
    all_data['scenarios'].append(generate_dirty_data_scenario())

    print("\n" + "=" * 60)
    print("所有场景生成完成")
    print("=" * 60)

    output_file = 'sample_data_output.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n结果已保存到: {output_file}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
