#!/usr/bin/env python3
"""
联邦学习客户端掉队 - 三步完整流程演示

三步流程:
1. 特征快照编号第一次导入
2. 算法工程师小乔补看训练日志曲线
3. 异常样本页更新（碰到时间窗穿越时留给实验平台负责人复核）
"""

import sys
import json
from datetime import datetime, timedelta
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from manager import DropoutManager
from models import DropoutStatus

console = Console()
manager = DropoutManager()


def print_step(title: str):
    console.print(Panel.fit(f"[bold cyan]{title}[/bold cyan]"))


def step_1_import_snapshots():
    """第一步：特征快照编号第一次导入"""
    print_step("第一步：特征快照编号第一次导入")

    snapshots = [
        {
            "snapshot_id": "snap_round5_001",
            "client_id": "client_A",
            "round_num": 5,
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "feature_hash": "a1b2c3d4e5f6",
            "feature_count": 128
        },
        {
            "snapshot_id": "snap_round5_002",
            "client_id": "client_B",
            "round_num": 5,
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "feature_hash": "f6e5d4c3b2a1",
            "feature_count": 128
        },
        {
            "snapshot_id": "snap_round5_003",
            "client_id": "client_A",
            "round_num": 5,
            "timestamp": (datetime.now() - timedelta(hours=26)).isoformat(),
            "feature_hash": "123456789abc",
            "feature_count": 128
        }
    ]

    result = manager.import_feature_snapshots(snapshots, imported_by="qiao_xiaoqiao")

    table = Table(title="导入结果")
    table.add_column("项目")
    table.add_column("数量")
    table.add_row("成功导入", str(result['imported_count']))
    table.add_row("跳过(重复)", str(result['skipped_count']))
    console.print(table)

    console.print(f"\n[green]✓ 特征快照导入完成，导入人: 小乔[/green]")
    console.print(f"[yellow]注意: 其中 snap_round5_003 时间戳较早，后续检测可能触发时间窗穿越[/yellow]")

    return result


def step_2_view_training_logs():
    """第二步：算法工程师小乔补看训练日志曲线"""
    print_step("第二步：算法工程师小乔补看训练日志曲线")

    logs = [
        {
            "log_id": "log_round5_001",
            "client_id": "client_A",
            "round_num": 5,
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "loss": 0.85,
            "accuracy": 0.78,
            "epoch": 10,
            "samples_processed": 5000,
            "log_content": "正常训练完成"
        },
        {
            "log_id": "log_round5_002",
            "client_id": "client_A",
            "round_num": 5,
            "timestamp": (datetime.now() - timedelta(hours=26)).isoformat(),
            "loss": 3.2,
            "accuracy": 0.45,
            "epoch": 3,
            "samples_processed": 1200,
            "log_content": "训练中断，疑似网络问题"
        }
    ]

    manager.import_training_logs(logs)

    console.print("[green]✓ 训练日志已导入[/green]")
    console.print("\n[bold]小乔查看训练日志曲线:[/bold]")

    table = Table(title="client_A 第5轮训练日志")
    table.add_column("日志ID")
    table.add_column("时间")
    table.add_column("Epoch")
    table.add_column("Loss")
    table.add_column("Accuracy")
    table.add_column("样本数")
    for l in logs:
        ts = datetime.fromisoformat(l['timestamp'])
        table.add_row(
            l['log_id'],
            ts.strftime('%m-%d %H:%M'),
            str(l['epoch']),
            f"{l['loss']:.2f}",
            f"{l['accuracy']:.2f}",
            str(l['samples_processed'])
        )
    console.print(table)

    console.print("\n[yellow]小乔发现: log_round5_002 时间异常，Loss高，Accuracy低，训练不完整[/yellow]")
    console.print("[yellow]小乔怀疑: 可能存在时间窗穿越问题，需要创建掉队记录检测[/yellow]")

    return logs


def step_3_create_and_review():
    """第三步：异常样本页更新，碰到时间窗穿越留给负责人复核"""
    print_step("第三步：异常样本页更新（时间窗穿越留待复核）")

    record = manager.detect_and_create_record(
        client_id="client_A",
        round_num=5,
        detected_by="qiao_xiaoqiao",
        remarks="client_A第5轮数据存在时间跨度异常，疑似时间窗穿越"
    )

    console.print(f"\n[green]✓ 掉队记录已创建: {record.record_id}[/green]")

    table = Table(title="掉队记录详情")
    table.add_column("项目")
    table.add_column("值")
    table.add_row("记录ID", record.record_id)
    table.add_row("客户端", record.client_id)
    table.add_row("轮次", str(record.round_num))
    table.add_row("状态", f"[yellow]{record.status.value}[/yellow]")
    table.add_row("时间窗穿越", f"[red]{'是' if record.time_window_crossed else '否'}[/red]")
    table.add_row("异常分数", f"{record.anomaly_score:.2f}")
    table.add_row("关联快照数", str(len(record.snapshot_ids)))
    table.add_row("关联日志数", str(len(record.log_ids)))
    console.print(table)

    if record.time_window_crossed:
        console.print("\n[bold red]⚠️  检测到时间窗穿越！[/bold red]")
        console.print("[yellow]根据边界规则，时间窗穿越可能导致效果虚高[/yellow]")
        console.print("[yellow]状态自动设为 pending_review，留给实验平台负责人复核[/yellow]")
        console.print("[yellow]不急着归为正常，等待负责人确认[/yellow]")

    console.print("\n[bold]小乔修改备注（仅改一条）:[/bold]")
    manager.update_remarks(
        record_id=record.record_id,
        new_remarks="client_A第5轮数据存在时间跨度异常，快照跨越26小时，远超24小时窗口，疑似时间窗穿越导致效果虚高",
        updated_by="qiao_xiaoqiao"
    )

    history = manager.get_record_history(record.record_id)
    console.print("\n[bold]历史记录（可查看改前改后差别）:[/bold]")
    for h in history:
        console.print(f"  [{h['changed_at'][:19]}] {h['changed_by']} 修改 {h['field_name']}:")
        console.print(f"    原值: {h['old_value']}")
        console.print(f"    新值: {h['new_value']}")

    pending = manager.list_pending_reviews()
    console.print(f"\n[bold]待复核记录数: {len(pending)}[/bold]")

    console.print("\n[bold green]✓ 三步流程完成[/bold green]")
    console.print("[cyan]1. 特征快照已导入[/cyan]")
    console.print("[cyan]2. 小乔已查看训练日志曲线[/cyan]")
    console.print("[cyan]3. 异常样本页已更新，时间窗穿越问题留待负责人复核[/cyan]")

    return record


def show_replay_commands(record_id: str):
    """显示复盘命令"""
    print_step("复盘命令清单（可重新跑）")
    data = manager.get_record_with_context(record_id)
    for cmd in data.get('replay_commands', []):
        console.print(f"  $ {cmd}")


def main():
    console.print(Panel.fit(
        "[bold]联邦学习客户端掉队[/bold]\n"
        "三步完整流程演示\n"
        "时间窗穿越 → 效果虚高 → 留待复核"
    ))

    step_1_import_snapshots()
    console.input("\n按回车继续第二步...")

    step_2_view_training_logs()
    console.input("\n按回车继续第三步...")

    record = step_3_create_and_review()
    console.input("\n按回车查看复盘命令...")

    show_replay_commands(record.record_id)

    console.print("\n[bold]关键点总结:[/bold]")
    console.print("  ✓ 边界规则写在代码和README中，不只靠口头约定")
    console.print("  ✓ 重复导入同一批特征快照编号不会翻倍")
    console.print("  ✓ 改备注后历史记录可看改前改后差别")
    console.print("  ✓ 3D/图表展示时保留可回溯的快照/日志引用")
    console.print("  ✓ 输出是可复盘记录和可重跑命令，不是功能清单")
    console.print("  ✓ 时间窗穿越不急着归正常，留给负责人复核")


if __name__ == "__main__":
    main()
