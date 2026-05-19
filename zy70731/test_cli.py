#!/usr/bin/env python3
import subprocess
import json
import os
import sys


def run_command(args, use_json=True):
    cmd = [sys.executable, "consumer_cli.py"] + args
    if use_json and "--json" not in cmd:
        cmd.append("--json")
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result


def cleanup():
    if os.path.exists("consumer_registry.json"):
        os.remove("consumer_registry.json")


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_normal_registration():
    print_section("1. 正常输入测试")

    cleanup()

    print("\n[测试1.1] 正常登记消费者组")
    result = run_command([
        "register",
        "--group", "order-group-1",
        "--queue", "order-queue",
        "--start", "0",
        "--end", "9",
        "--msg-type", "create",
        "--owner", "张三",
        "--team", "订单组",
        "--email", "zhangsan@example.com"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    print(f"  消息: {data['messages']}")
    assert data["success"] == True, "正常登记应该成功"
    assert data["code"] == "SUCCESS"

    print("\n[测试1.2] 再登记另一个不冲突的消费者组")
    result = run_command([
        "register",
        "--group", "order-group-2",
        "--queue", "order-queue",
        "--start", "10",
        "--end", "19",
        "--owner", "李四",
        "--team", "支付组",
        "--email", "lisi@example.com"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == True

    print("\n[测试1.3] 查询队列下的所有消费者")
    result = run_command(["query", "--queue", "order-queue"])
    data = json.loads(result.stdout)
    print(f"  找到 {data['count']} 个消费者组")
    for g in data["groups"]:
        print(f"    - {g['group_name']}: {g['owner']['name']}")
    assert data["count"] == 2

    print("\n[测试1.4] 负责人转移")
    result = run_command([
        "transfer",
        "--group", "order-group-1",
        "--owner", "王五",
        "--team", "订单组",
        "--reason", "张三转岗"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == True

    print("\n[测试1.5] 查看交接历史")
    result = run_command(["history", "--group", "order-group-1"])
    data = json.loads(result.stdout)
    print(f"  找到 {data['count']} 条交接记录")
    for t in data["transfers"]:
        print(f"    {t['from_owner']['name']} -> {t['to_owner']['name']}")
    assert data["count"] == 1

    print("\n[测试1.6] 生成归属报告")
    result = run_command(["report", "--queue", "order-queue"], use_json=False)
    result = run_command(["report", "--queue", "order-queue"])
    data = json.loads(result.stdout)
    print(f"  消费者组总数: {data['total_groups']}")
    print(f"  队列总数: {data['total_queues']}")
    print(f"  负责人总数: {data['total_owners']}")
    assert data["total_groups"] == 2
    assert data["total_queues"] == 1

    print("\n✓ 正常输入测试通过")


def test_idempotent_registration():
    print_section("2. 幂等性测试")

    cleanup()

    print("\n[测试2.1] 首次登记")
    result = run_command([
        "register",
        "--group", "pay-group-1",
        "--queue", "pay-queue",
        "--start", "0",
        "--end", "4",
        "--owner", "赵六",
        "--team", "支付组"
    ])
    data = json.loads(result.stdout)
    assert data["success"] == True
    assert data["code"] == "SUCCESS"
    print("  首次登记成功")

    print("\n[测试2.2] 完全相同的重复登记")
    result = run_command([
        "register",
        "--group", "pay-group-1",
        "--queue", "pay-queue",
        "--start", "0",
        "--end", "4",
        "--owner", "赵六",
        "--team", "支付组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    print(f"  消息: {data['messages']}")
    assert data["success"] == True
    assert data["code"] == "IDEMPOTENT_SUCCESS"

    print("\n[测试2.3] 重复转移给相同负责人")
    result = run_command([
        "transfer",
        "--group", "pay-group-1",
        "--owner", "赵六",
        "--team", "支付组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == True
    assert data["code"] == "IDEMPOTENT_SUCCESS"

    print("\n✓ 幂等性测试通过")


def test_dirty_data():
    print_section("3. 脏数据测试")

    cleanup()

    print("\n[测试3.1] 负责人姓名为空")
    result = run_command([
        "register",
        "--group", "test-group",
        "--queue", "test-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "",
        "--team", "测试组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    print(f"  错误: {data['messages']}")
    assert data["success"] == False
    assert data["code"] == "VALIDATION_ERROR"

    print("\n[测试3.2] 团队名称为空")
    result = run_command([
        "register",
        "--group", "test-group",
        "--queue", "test-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "测试人",
        "--team", ""
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == False
    assert data["code"] == "VALIDATION_ERROR"

    print("\n[测试3.3] 邮箱格式无效")
    result = run_command([
        "register",
        "--group", "test-group",
        "--queue", "test-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "测试人",
        "--team", "测试组",
        "--email", "invalid-email"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    print(f"  错误: {data['messages']}")
    assert data["success"] == False
    assert data["code"] == "VALIDATION_ERROR"

    print("\n[测试3.4] 分区范围无效（结束 < 开始）")
    result = run_command([
        "register",
        "--group", "test-group",
        "--queue", "test-queue",
        "--start", "10",
        "--end", "0",
        "--owner", "测试人",
        "--team", "测试组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == False
    assert data["code"] == "VALIDATION_ERROR"

    print("\n[测试3.5] 分区为负数")
    result = run_command([
        "register",
        "--group", "test-group",
        "--queue", "test-queue",
        "--start", "-5",
        "--end", "5",
        "--owner", "测试人",
        "--team", "测试组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == False
    assert data["code"] == "VALIDATION_ERROR"

    print("\n[测试3.6] 转移不存在的消费者组")
    result = run_command([
        "transfer",
        "--group", "non-existent",
        "--owner", "新人",
        "--team", "新组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == False
    assert data["code"] == "NOT_FOUND"

    print("\n✓ 脏数据测试通过")


def test_range_conflict():
    print_section("4. 范围冲突测试")

    cleanup()

    print("\n[测试4.1] 先登记基准组 0-9")
    result = run_command([
        "register",
        "--group", "base-group",
        "--queue", "conflict-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "基准确认",
        "--team", "基准组"
    ])
    data = json.loads(result.stdout)
    assert data["success"] == True
    print("  基准组登记成功")

    print("\n[测试4.2] 完全重叠 (0-9)")
    result = run_command([
        "register",
        "--group", "full-overlap",
        "--queue", "conflict-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "重叠人",
        "--team", "重叠组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    print(f"  冲突消息: {data['messages']}")
    assert data["success"] == False
    assert data["code"] == "RANGE_CONFLICT"

    print("\n[测试4.3] 部分重叠 (5-14)")
    result = run_command([
        "register",
        "--group", "partial-overlap",
        "--queue", "conflict-queue",
        "--start", "5",
        "--end", "14",
        "--owner", "部分人",
        "--team", "部分组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == False
    assert data["code"] == "RANGE_CONFLICT"

    print("\n[测试4.4] 包含重叠 (2-7)")
    result = run_command([
        "register",
        "--group", "inner-overlap",
        "--queue", "conflict-queue",
        "--start", "2",
        "--end", "7",
        "--owner", "内部人",
        "--team", "内部组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == False
    assert data["code"] == "RANGE_CONFLICT"

    print("\n[测试4.5] 边界相邻 (10-19) - 不冲突")
    result = run_command([
        "register",
        "--group", "adjacent",
        "--queue", "conflict-queue",
        "--start", "10",
        "--end", "19",
        "--owner", "相邻人",
        "--team", "相邻组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == True
    assert data["code"] == "SUCCESS"

    print("\n[测试4.6] 不同队列的相同范围 - 不冲突")
    result = run_command([
        "register",
        "--group", "diff-queue",
        "--queue", "another-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "其他队列人",
        "--team", "其他组"
    ])
    data = json.loads(result.stdout)
    print(f"  结果: {'成功' if data['success'] else '失败'}")
    print(f"  状态码: {data['code']}")
    assert data["success"] == True
    assert data["code"] == "SUCCESS"

    print("\n✓ 范围冲突测试通过")


def test_empty_results():
    print_section("5. 空结果测试")

    cleanup()

    print("\n[测试5.1] 查询不存在的队列")
    result = run_command(["query", "--queue", "non-existent-queue"])
    data = json.loads(result.stdout)
    print(f"  找到 {data['count']} 个消费者组")
    assert data["count"] == 0

    print("\n[测试5.2] 查询不存在的消费者组")
    result = run_command(["query", "--group", "non-existent-group"])
    data = json.loads(result.stdout)
    print(f"  找到 {data['count']} 个消费者组")
    assert data["count"] == 0

    print("\n[测试5.3] 查询不存在的负责人")
    result = run_command(["query", "--owner", "不存在的人"])
    data = json.loads(result.stdout)
    print(f"  找到 {data['count']} 个消费者组")
    assert data["count"] == 0

    print("\n[测试5.4] 查看不存在组的交接历史")
    result = run_command(["history", "--group", "no-history-group"])
    data = json.loads(result.stdout)
    print(f"  找到 {data['count']} 条交接记录")
    assert data["count"] == 0

    print("\n[测试5.5] 空数据库生成报告")
    result = run_command(["report"])
    data = json.loads(result.stdout)
    print(f"  消费者组总数: {data['total_groups']}")
    print(f"  队列总数: {data['total_queues']}")
    print(f"  负责人总数: {data['total_owners']}")
    assert data["total_groups"] == 0
    assert data["total_queues"] == 0
    assert data["total_owners"] == 0

    print("\n✓ 空结果测试通过")


def test_human_json_consistency():
    print_section("6. 人读报告与机器可读输出一致性测试")

    cleanup()

    run_command([
        "register",
        "--group", "consistency-group",
        "--queue", "consistency-queue",
        "--start", "0",
        "--end", "9",
        "--owner", "一致性人",
        "--team", "一致性组"
    ])

    run_command([
        "transfer",
        "--group", "consistency-group",
        "--owner", "新负责人",
        "--team", "新团队",
        "--reason", "测试交接"
    ])

    print("\n[测试6.1] 验证JSON输出与命令行一致")
    result_json = run_command(["report", "--queue", "consistency-queue"])
    json_data = json.loads(result_json.stdout)

    result_human = run_command(["report", "--queue", "consistency-queue"], use_json=False)

    print(f"  JSON中的消费者组总数: {json_data['total_groups']}")
    print(f"  JSON中的队列总数: {json_data['total_queues']}")
    print(f"  JSON中的负责人总数: {json_data['total_owners']}")
    print(f"  JSON中的交接记录数: {len(json_data['recent_transfers'])}")

    assert json_data["total_groups"] == 1
    assert json_data["total_queues"] == 1
    assert json_data["total_owners"] == 1
    assert len(json_data["recent_transfers"]) == 1

    group_in_json = "consistency-group" in str(json_data)
    queue_in_json = "consistency-queue" in str(json_data)
    owner_in_json = "新负责人" in str(json_data)

    group_in_human = "consistency-group" in result_human.stdout
    queue_in_human = "consistency-queue" in result_human.stdout
    owner_in_human = "新负责人" in result_human.stdout

    print(f"  消费者组名一致性: JSON={group_in_json}, 人读={group_in_human}")
    print(f"  队列名一致性: JSON={queue_in_json}, 人读={queue_in_human}")
    print(f"  负责人名一致性: JSON={owner_in_json}, 人读={owner_in_human}")

    assert group_in_json == group_in_human
    assert queue_in_json == queue_in_human
    assert owner_in_json == owner_in_human

    print("\n✓ 一致性测试通过")


def main():
    print("\n" + "#" * 60)
    print("  消费者组归属交接记录排查CLI - 综合测试套件")
    print("#" * 60)

    try:
        test_normal_registration()
        test_idempotent_registration()
        test_dirty_data()
        test_range_conflict()
        test_empty_results()
        test_human_json_consistency()

        print("\n" + "=" * 60)
        print("  所有测试通过! ✓")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cleanup()


if __name__ == "__main__":
    main()
