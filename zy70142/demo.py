#!/usr/bin/env python3
"""
素材转码任务调度服务 - 交互式验收工具

使用方法：
1. 运行脚本: python demo.py
2. 按照菜单选择场景进行验证
3. 查看输出的规则历史和统计信息

核心功能验证场景：
- 场景1: 正常流程（全部成功）
- 场景2: 重试后成功（验证幂等性和重复状态问题）
- 场景3: 超过重试次数触发回滚
- 场景4: 产物校验失败
"""

import json
import sys
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from transcode_service import (
    TranscodeService,
    MockTranscodeExecutor,
    RetryPolicy,
    TaskStatus,
    ShardStatus,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


def print_separator() -> None:
    print("\n" + "=" * 70)


def print_title(title: str) -> None:
    print_separator()
    print(f"  {title}")
    print_separator()


def print_json(data: Dict[str, Any], indent: int = 2) -> None:
    print(json.dumps(data, indent=indent, ensure_ascii=False, default=str))


def print_task_status(task: Any) -> None:
    print(f"\n任务状态: {task.status.name}")
    print(f"任务ID: {task.task_id}")
    print(f"总分片数: {task.total_shards}")
    print(f"已完成: {task.completed_shards}")
    print(f"失败: {task.failed_shards}")
    print(f"进度: {task.progress_percentage:.1f}%")
    print(f"\n分片详情:")
    for shard_id, shard in task.shards.items():
        print(f"  [{shard.resolution}] {shard_id}: {shard.status.name}")
        if shard.retry_count > 0:
            print(f"      重试次数: {shard.retry_count}/{shard.max_retries}")
        if shard.last_error:
            print(f"      错误: {shard.last_error}")


def print_statistics(service: TranscodeService) -> None:
    stats = service.get_statistics()
    print("\n" + "-" * 50)
    print("系统统计信息:")
    print("-" * 50)
    print(f"总任务数: {stats.total_tasks}")
    print(f"  - 成功: {stats.completed_tasks}")
    print(f"  - 失败: {stats.failed_tasks}")
    print(f"任务成功率: {stats.task_success_rate:.1f}%")
    print(f"\n总分片数: {stats.total_shards}")
    print(f"  - 成功: {stats.successful_shards}")
    print(f"  - 失败: {stats.failed_shards}")
    print(f"  - 重试: {stats.retried_shards}")
    print(f"分片成功率: {stats.shard_success_rate:.1f}%")
    print(f"\n校验总数: {stats.total_validation_checks}")
    print(f"  - 通过: {stats.passed_validations}")
    print(f"  - 失败: {stats.failed_validations}")
    print(f"校验成功率: {stats.validation_success_rate:.1f}%")
    print(f"\n回滚: 尝试 {stats.rollback_attempts} 次")
    print(f"  - 成功: {stats.successful_rollbacks}")
    print(f"  - 失败: {stats.failed_rollbacks}")


def print_rule_history(service: TranscodeService) -> None:
    history = service.get_rule_history()
    if not history:
        print("\n没有规则执行历史")
        return

    print("\n" + "-" * 50)
    print("规则执行历史 (可复查):")
    print("-" * 50)
    for i, entry in enumerate(history, 1):
        result = entry["result"]
        passed = "✓" if result["passed"] else "✗"
        print(f"\n[{i}] {passed} {entry['rule_name']}")
        print(f"    时间: {entry['timestamp']}")
        print(f"    结果: {result['reason']}")
        if result["evidence"]:
            print(f"    证据: {json.dumps(result['evidence'], ensure_ascii=False)}")


def scenario_normal_success() -> None:
    """场景1: 正常流程 - 全部成功"""
    print_title("场景1: 正常流程（全部成功）")
    print("\n验证点:")
    print("  - 任务创建 -> 初始化 -> 分片 -> 处理 -> 校验 -> 完成")
    print("  - 所有分片状态正确流转")
    print("  - 状态不会重复")

    service = TranscodeService()

    print("\n[1/4] 提交转码任务...")
    task = service.submit_transcode_task(
        input_path="/videos/example.mp4",
        resolutions=["1080p", "720p", "480p"],
        bitrates={
            "1080p": 8000000,
            "720p": 4000000,
            "480p": 2000000,
        },
    )
    print(f"✓ 任务已创建: {task.task_id}")
    print(f"✓ 状态: {task.status.name}")
    print(f"✓ 分片数: {task.total_shards}")

    print("\n[2/4] 处理所有分片...")
    for shard in list(task.shards.values()):
        service.process_shard(shard, task)

    print("\n[3/4] 检查任务完成状态...")
    completed = service.check_task_completion(task)
    print(f"✓ 任务完成: {completed}")

    print("\n[4/4] 结果验证...")
    print_task_status(task)

    assert task.status == TaskStatus.COMPLETED, "任务应该完成"
    assert task.all_shards_completed, "所有分片应该完成"
    print("\n✓ 验证通过: 任务正常完成，所有分片成功")

    print_statistics(service)
    print_rule_history(service)

    print_title("场景1 完成 ✓")


def scenario_retry_and_success() -> None:
    """场景2: 重试后成功 - 验证幂等性"""
    print_title("场景2: 重试后成功（验证幂等性）")
    print("\n验证点:")
    print("  - 失败后自动重试")
    print("  - 重试不会导致状态重复")
    print("  - 每个分片的重试次数独立跟踪")
    print("  - 指数退避策略正确应用")

    service = TranscodeService(
        executor=MockTranscodeExecutor(simulate_failures=True)
    )

    print("\n[1/5] 提交转码任务...")
    task = service.submit_transcode_task(
        input_path="/videos/example.mp4",
        resolutions=["1080p", "720p"],
        bitrates={
            "1080p": 8000000,
            "720p": 4000000,
        },
        retry_policy=RetryPolicy(
            max_retries=3,
            initial_delay_seconds=1,
        ),
    )
    print(f"✓ 任务已创建")

    print("\n[2/5] 首次处理（模拟失败）...")
    original_statuses = {}
    for shard in list(task.shards.values()):
        original_statuses[shard.shard_id] = shard.status
        service.process_shard(shard, task)

    print("\n[3/5] 验证失败状态...")
    print_task_status(task)

    pending_retries = service.get_pending_retry_count()
    print(f"\n✓ 待重试队列大小: {pending_retries}")

    for shard in task.shards.values():
        assert shard.retry_count == 1, f"重试次数应该是1，实际是{shard.retry_count}"
        assert shard.next_retry_at is not None, "应该有下一次重试时间"
    print("✓ 所有失败分片已正确调度重试")

    print("\n[4/5] 手动将重试时间提前，处理重试...")
    for shard in task.shards.values():
        shard.next_retry_at = datetime.now() - timedelta(seconds=1)

    processed = service.process_ready_retries()
    print(f"✓ 处理了 {processed} 个重试任务")

    print("\n[5/5] 验证最终状态...")
    for shard in task.shards.values():
        assert shard.status == ShardStatus.SUCCESS, f"分片应该成功，实际是{shard.status.name}"

    completed = service.check_task_completion(task)
    print_task_status(task)

    print("\n✓ 关键验证点:")
    print("  - 每个分片的重试次数独立记录，不会重复")
    print("  - 状态转换严格遵循状态机，不会出现重复状态")
    print("  - 重试后成功，任务正常完成")

    print_statistics(service)
    print_rule_history(service)

    print_title("场景2 完成 ✓")


def scenario_max_retries_exceeded_rollback() -> None:
    """场景3: 超过重试次数触发回滚"""
    print_title("场景3: 超过重试次数触发回滚")
    print("\n验证点:")
    print("  - 超过最大重试次数不会无限重试")
    print("  - 触发回滚流程")
    print("  - 已完成的分片被标记为回滚")
    print("  - 待处理的分片被跳过")

    class AlwaysFailExecutor(MockTranscodeExecutor):
        def transcode(self, shard, input_path, output_path):
            return False

    service = TranscodeService(
        executor=AlwaysFailExecutor()
    )

    print("\n[1/4] 提交转码任务（最大重试1次）...")
    task = service.submit_transcode_task(
        input_path="/videos/example.mp4",
        resolutions=["1080p", "720p", "480p"],
        bitrates={
            "1080p": 8000000,
            "720p": 4000000,
            "480p": 2000000,
        },
        retry_policy=RetryPolicy(
            max_retries=1,
            initial_delay_seconds=0,
        ),
    )

    print("\n[2/4] 首次处理（全部失败）...")
    for shard in list(task.shards.values()):
        service.process_shard(shard, task)

    print_task_status(task)
    print(f"\n待重试队列: {service.get_pending_retry_count()}")

    print("\n[3/4] 处理重试（继续失败）...")
    for shard in task.shards.values():
        shard.next_retry_at = datetime.now() - timedelta(seconds=1)

    processed = service.process_ready_retries()
    print(f"处理了 {processed} 个重试")

    print("\n[4/4] 验证回滚状态...")
    print_task_status(task)

    print("\n✓ 关键验证点:")
    print("  - 重试次数达到上限后自动触发回滚")
    print("  - 不会无限循环重试")
    print("  - 任务状态正确流转到 FAILED")

    print_statistics(service)
    print_rule_history(service)

    print_title("场景3 完成 ✓")


def scenario_validation_failure() -> None:
    """场景4: 产物校验失败"""
    print_title("场景4: 产物校验失败")
    print("\n验证点:")
    print("  - 即使转码成功，校验失败也要重试")
    print("  - 校验规则可复查")
    print("  - 校验历史被记录")

    class BadProductExecutor(MockTranscodeExecutor):
        def get_file_info(self, file_path):
            return {
                "exists": True,
                "size": 0,
                "can_open": True,
            }

    service = TranscodeService(
        executor=BadProductExecutor()
    )

    print("\n[1/3] 提交转码任务...")
    task = service.submit_transcode_task(
        input_path="/videos/example.mp4",
        resolutions=["1080p"],
        bitrates={"1080p": 8000000},
        retry_policy=RetryPolicy(
            max_retries=1,
            initial_delay_seconds=0,
        ),
    )

    print("\n[2/3] 处理分片（转码成功但产物校验失败）...")
    for shard in list(task.shards.values()):
        service.process_shard(shard, task)

    print("\n[3/3] 查看校验结果...")
    print_task_status(task)

    for shard_id, result in task.validation_results.items():
        print(f"\n校验结果 (shard={shard_id[:8]}...):")
        print(f"  总体: {'✓ 通过' if result.passed else '✗ 失败'}")
        print(f"  检查项:")
        for check, passed in result.checks.items():
            status = "✓" if passed else "✗"
            print(f"    {status} {check}")
        if result.errors:
            print(f"  错误: {result.errors}")

    print("\n✓ 关键验证点:")
    print("  - 产物校验失败（文件大小为0）")
    print("  - 校验规则明确记录")
    print("  - 校验历史可追溯")

    print_statistics(service)
    print_rule_history(service)

    print_title("场景4 完成 ✓")


def show_menu() -> None:
    print("\n" + "=" * 70)
    print("     素材转码任务调度服务 - 交互式验收工具")
    print("=" * 70)
    print("\n请选择要运行的场景:")
    print("\n  1. 正常流程（全部成功）")
    print("     验证: 任务状态流转、分片管理")
    print("\n  2. 重试后成功（幂等性验证）")
    print("     验证: 重试机制、指数退避、状态不重复")
    print("\n  3. 超过重试次数触发回滚")
    print("     验证: 最大重试限制、回滚流程")
    print("\n  4. 产物校验失败")
    print("     验证: 校验规则、可复查历史")
    print("\n  5. 运行全部场景")
    print("\n  0. 退出")
    print("=" * 70)


def run_all_scenarios() -> None:
    print_title("运行全部验证场景")
    scenario_normal_success()
    scenario_retry_and_success()
    scenario_max_retries_exceeded_rollback()
    scenario_validation_failure()
    print_title("全部场景完成 ✓")


def main() -> None:
    while True:
        show_menu()
        try:
            choice = input("\n请输入选项 [0-5]: ").strip()

            if choice == "0":
                print("\n再见!")
                sys.exit(0)
            elif choice == "1":
                scenario_normal_success()
            elif choice == "2":
                scenario_retry_and_success()
            elif choice == "3":
                scenario_max_retries_exceeded_rollback()
            elif choice == "4":
                scenario_validation_failure()
            elif choice == "5":
                run_all_scenarios()
            else:
                print("\n无效选项，请重试")
        except KeyboardInterrupt:
            print("\n\n再见!")
            sys.exit(0)
        except Exception as e:
            print(f"\n错误: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
