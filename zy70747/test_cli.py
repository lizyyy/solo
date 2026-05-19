#!/usr/bin/env python3
import os
import sys
import json
from models import TransformationStatus
from rules import ApiDecommissionManager
from storage import Storage
from reporter import Reporter


def test_empty_report():
    print("\n" + "=" * 60)
    print("测试1: 空结果报告")
    print("=" * 60)

    storage = Storage(data_dir="test_data")
    storage.clear()
    manager = storage.load() or ApiDecommissionManager()
    reporter = Reporter(output_dir="test_reports")

    json_path, txt_path = reporter.save_both_reports(manager, "test_empty")

    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)

    assert json_data["summary"]["total_apis"] == 0, "空结果API数量应为0"
    assert json_data["summary"]["total_callers"] == 0, "空结果调用方数量应为0"
    print("✓ 空结果测试通过")
    print(f"  JSON报告: {json_path}")
    print(f"  文本报告: {txt_path}")
    return True


def test_normal_flow():
    print("\n" + "=" * 60)
    print("测试2: 正常输入流程")
    print("=" * 60)

    storage = Storage(data_dir="test_data")
    storage.clear()
    manager = ApiDecommissionManager()
    reporter = Reporter(output_dir="test_reports")

    success, errors = manager.register_api("user/v1/login", "2024-12-31")
    assert success, f"注册接口失败: {errors}"
    print("✓ 接口注册成功")

    success, errors = manager.register_caller(
        "user/v1/login",
        "订单系统",
        "切换到v2接口，使用新的认证方式",
        "2024-11-30",
        "需要配合其他系统联调"
    )
    assert success, f"登记调用方失败: {errors}"
    print("✓ 调用方1登记成功")

    success, errors = manager.register_caller(
        "user/v1/login",
        "支付系统",
        "重构支付流程，使用v2接口",
        "2024-12-15"
    )
    assert success, f"登记调用方失败: {errors}"
    print("✓ 调用方2登记成功")

    success, errors = manager.update_caller_status(
        "user/v1/login",
        "订单系统",
        TransformationStatus.IN_PROGRESS
    )
    assert success, f"更新状态失败: {errors}"
    print("✓ 调用方状态更新成功")

    storage.save(manager)
    json_path, txt_path = reporter.save_both_reports(manager, "test_normal")

    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)

    assert json_data["summary"]["total_apis"] == 1
    assert json_data["summary"]["total_callers"] == 2
    print("✓ 正常流程测试通过")
    print(f"  JSON报告: {json_path}")
    print(f"  文本报告: {txt_path}")
    return True


def test_dirty_data():
    print("\n" + "=" * 60)
    print("测试3: 脏数据输入")
    print("=" * 60)

    manager = ApiDecommissionManager()

    success, errors = manager.register_api("", "2024-12-31")
    assert not success, "空接口名应该失败"
    assert any(e.field == "api_name" for e in errors)
    print("✓ 空接口名验证通过")

    success, errors = manager.register_api("test/api", "invalid-date")
    assert not success, "无效日期格式应该失败"
    assert any(e.field == "decommission_date" for e in errors)
    print("✓ 无效日期格式验证通过")

    manager.register_api("test/api", "2024-12-31")

    success, errors = manager.register_caller("test/api", "", "改造计划")
    assert not success, "空调用方名应该失败"
    assert any(e.field == "caller_name" for e in errors)
    print("✓ 空调用方名验证通过")

    success, errors = manager.register_caller("test/api", "调用方A", "")
    assert not success, "空改造计划应该失败"
    assert any(e.field == "transformation_plan" for e in errors)
    print("✓ 空改造计划验证通过")

    success, errors = manager.register_caller("non-exist/api", "调用方A", "改造计划")
    assert not success, "不存在的接口应该失败"
    assert any(e.field == "api_name" for e in errors)
    print("✓ 不存在接口验证通过")

    print("✓ 脏数据测试全部通过")
    return True


def test_boundary_conflicts():
    print("\n" + "=" * 60)
    print("测试4: 边界冲突测试")
    print("=" * 60)

    manager = ApiDecommissionManager()

    manager.register_api("test/api", "2024-12-31")

    success, errors = manager.register_api("test/api", "2025-06-30")
    assert not success, "重复注册接口应该失败"
    assert any(e.field == "api_name" for e in errors)
    print("✓ 接口去重验证通过")

    manager.register_caller("test/api", "调用方A", "改造计划A")
    success, errors = manager.register_caller("test/api", "调用方A", "改造计划B")
    assert not success, "重复登记调用方应该失败"
    assert any(e.field == "caller_name" for e in errors)
    print("✓ 调用方去重验证通过")

    success, errors = manager.register_caller(
        "test/api",
        "调用方B",
        "改造计划B",
        "2025-01-31"
    )
    assert success, "计划完成日期晚于退役日期应该有警告但不失败"
    assert any(e.severity == "warning" for e in errors)
    print("✓ 日期冲突警告验证通过")

    success, errors = manager.request_extension(
        "test/api",
        "调用方A",
        "2024-12-31",
        "2024-06-30",
        "测试理由"
    )
    assert not success, "申请日期早于原日期应该失败"
    assert any(e.field == "requested_decommission_date" for e in errors)
    print("✓ 延期日期逻辑验证通过")

    success, errors = manager.approve_extension(
        "test/api",
        "不存在的调用方",
        True,
        "审批人"
    )
    assert not success, "审批不存在的申请应该失败"
    print("✓ 不存在延期申请验证通过")

    success, errors = manager.request_extension(
        "test/api",
        "调用方A",
        "2024-12-31",
        "2025-03-31",
        "需要更多时间测试"
    )
    assert success, "正常延期申请应该成功"
    print("✓ 正常延期申请成功")

    success, errors = manager.approve_extension(
        "test/api",
        "调用方A",
        True,
        "张经理"
    )
    assert success, "审批应该成功"
    print("✓ 延期审批成功")

    api = manager.get_api("test/api")
    assert api.decommission_date == "2025-03-31", "批准后退役日期应更新"
    caller = next(c for c in api.callers if c.caller_name == "调用方A")
    assert caller.status == TransformationStatus.DELAYED, "批准后调用方状态应更新"
    print("✓ 审批后状态联动更新验证通过")

    print("✓ 边界冲突测试全部通过")
    return True


def test_report_consistency():
    print("\n" + "=" * 60)
    print("测试5: 机器可读输出与人读报告一致性")
    print("=" * 60)

    storage = Storage(data_dir="test_data")
    storage.clear()
    manager = ApiDecommissionManager()
    reporter = Reporter(output_dir="test_reports")

    manager.register_api("user/v1/login", "2024-12-31")
    manager.register_api("order/v1/create", "2025-03-31")

    manager.register_caller("user/v1/login", "订单系统", "切换v2", "2024-11-30")
    manager.register_caller("user/v1/login", "支付系统", "重构流程", "2024-12-15")
    manager.register_caller("order/v1/create", "库存系统", "适配新接口", "2025-02-28")

    manager.update_caller_status("user/v1/login", "订单系统", TransformationStatus.COMPLETED)
    manager.update_caller_status("user/v1/login", "支付系统", TransformationStatus.IN_PROGRESS)

    manager.request_extension(
        "order/v1/create",
        "库存系统",
        "2025-03-31",
        "2025-06-30",
        "第三方依赖未完成"
    )

    manager.approve_extension("order/v1/create", "库存系统", True, "李总")

    json_path, txt_path = reporter.save_both_reports(manager, "test_consistency")

    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)

    summary = json_data["summary"]
    assert summary["total_apis"] == 2
    assert summary["total_callers"] == 3
    assert summary["total_extension_requests"] == 1
    assert summary["caller_status_distribution"]["已完成"] == 1
    assert summary["caller_status_distribution"]["进行中"] == 1
    assert summary["caller_status_distribution"]["已延期"] == 1

    with open(txt_path, 'r', encoding='utf-8') as f:
        txt_content = f.read()

    assert "接口总数: 2" in txt_content, "文本报告接口总数不一致"
    assert "调用方总数: 3" in txt_content, "文本报告调用方总数不一致"
    assert "user/v1/login" in txt_content, "文本报告缺少接口名"
    assert "订单系统" in txt_content, "文本报告缺少调用方名"
    assert "库存系统" in txt_content, "文本报告缺少调用方名"

    print("✓ JSON报告统计数据正确")
    print("✓ 文本报告内容与JSON数据一致")
    print("✓ 数据一致性测试通过")
    print(f"  JSON报告: {json_path}")
    print(f"  文本报告: {txt_path}")
    return True


def main():
    print("\n" + "#" * 60)
    print("#   API退役申请调用方改造排查CLI - 综合测试")
    print("#" * 60)

    tests = [
        test_empty_report,
        test_normal_flow,
        test_dirty_data,
        test_boundary_conflicts,
        test_report_consistency,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 60)
    print("测试总结:")
    print(f"  通过: {passed}")
    print(f"  失败: {failed}")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    else:
        print("\n✓ 所有测试通过!")
        sys.exit(0)


if __name__ == "__main__":
    main()
