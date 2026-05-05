from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
import yaml
from rich.console import Console
from rich.table import Table

from .engine import SimulationEngine
from .models import CachePolicy, DBUpdate, TrafficEvent
from .reporter import Reporter
from .storage import SQLiteStorage

console = Console()


def load_yaml_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_jsonl(path: str) -> list[dict]:
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


@click.group()
@click.version_option()
def main():
    """缓存事故复盘工具 - 模拟多层缓存架构行为并分析风险事件"""
    pass


@main.command()
@click.option(
    "--dir",
    "-d",
    default="./cache-forensics",
    help="工作目录路径",
    show_default=True,
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="强制覆盖已存在的文件",
)
def init(dir: str, force: bool):
    """初始化工作目录，创建样例配置和数据文件"""
    work_dir = Path(dir)

    if work_dir.exists() and not force:
        console.print(f"[red]错误: 目录已存在: {work_dir}[/red]")
        console.print("使用 --force 选项覆盖已存在的文件")
        sys.exit(1)

    work_dir.mkdir(parents=True, exist_ok=True)

    seed_traffic = [
        {
            "timestamp": "2026-05-05T10:00:00",
            "operation": "read",
            "key": "user:123",
            "request_id": "req-001",
            "source": "web",
            "metadata": {"region": "cn-east-1"},
        },
        {
            "timestamp": "2026-05-05T10:00:01",
            "operation": "read",
            "key": "user:123",
            "request_id": "req-002",
            "source": "mobile",
            "metadata": {"region": "cn-east-1"},
        },
        {
            "timestamp": "2026-05-05T10:00:02",
            "operation": "write",
            "key": "user:123",
            "request_id": "req-003",
            "source": "web",
            "value": {"name": "张三", "email": "zhangsan@example.com", "version": 2},
            "metadata": {"region": "cn-east-1"},
        },
        {
            "timestamp": "2026-05-05T10:00:03",
            "operation": "read",
            "key": "user:123",
            "request_id": "req-004",
            "source": "mobile",
            "metadata": {"region": "cn-east-1"},
        },
        {
            "timestamp": "2026-05-05T10:00:04",
            "operation": "read",
            "key": "user:999",
            "request_id": "req-005",
            "source": "web",
            "metadata": {"region": "cn-east-1"},
        },
    ]

    traffic_path = work_dir / "traffic.jsonl"
    with open(traffic_path, "w", encoding="utf-8") as f:
        for record in seed_traffic:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    db_updates = [
        {
            "timestamp": "2026-05-05T10:00:00",
            "operation": "write",
            "key": "user:123",
            "old_value": None,
            "new_value": {"name": "张三", "email": "zhangsan@example.com", "version": 1},
            "transaction_id": "txn-001",
        },
        {
            "timestamp": "2026-05-05T10:00:02",
            "operation": "update",
            "key": "user:123",
            "old_value": {"name": "张三", "email": "zhangsan@example.com", "version": 1},
            "new_value": {"name": "张三", "email": "zhangsan_new@example.com", "version": 2},
            "transaction_id": "txn-002",
        },
    ]

    db_updates_path = work_dir / "db-updates.yaml"
    with open(db_updates_path, "w", encoding="utf-8") as f:
        yaml.dump({"updates": db_updates}, f, allow_unicode=True, sort_keys=False)

    good_policy = {
        "name": "good-policy",
        "ttl_seconds": 300,
        "ttl_jitter_seconds": 30,
        "local_cache_enabled": True,
        "redis_cache_enabled": True,
        "bloom_filter_enabled": True,
        "mutex_lock_enabled": True,
        "warmup_enabled": True,
        "warmup_keys": ["user:123", "user:456"],
        "consistency_mode": "eventual",
        "write_strategy": "write_through",
        "invalidation_strategy": "delete",
        "hot_key_threshold": 100,
        "penetration_threshold": 50,
        "avalanche_window_seconds": 60,
    }

    bad_policy = {
        "name": "bad-policy",
        "ttl_seconds": 60,
        "ttl_jitter_seconds": 0,
        "local_cache_enabled": False,
        "redis_cache_enabled": True,
        "bloom_filter_enabled": False,
        "mutex_lock_enabled": False,
        "warmup_enabled": False,
        "warmup_keys": [],
        "consistency_mode": "eventual",
        "write_strategy": "write_around",
        "invalidation_strategy": "update",
        "hot_key_threshold": 1000,
        "penetration_threshold": 1000,
        "avalanche_window_seconds": 60,
    }

    policy_path = work_dir / "cache-policy.yaml"
    with open(policy_path, "w", encoding="utf-8") as f:
        yaml.dump(
            {"policies": [good_policy, bad_policy]},
            f,
            allow_unicode=True,
            sort_keys=False,
        )

    db_path = work_dir / "cache-forensics.db"
    SQLiteStorage(str(db_path))

    console.print("[green]✓[/green] 工作目录初始化完成:")
    console.print(f"  目录: {work_dir.absolute()}")
    console.print("  创建的文件:")
    console.print("    - traffic.jsonl (流量样例)")
    console.print("    - db-updates.yaml (数据库更新样例)")
    console.print("    - cache-policy.yaml (缓存策略配置)")
    console.print("    - cache-forensics.db (SQLite 数据库)")
    console.print()
    console.print("[yellow]提示:[/yellow]")
    console.print("  cache-policy.yaml 包含两个策略:")
    console.print("    - good-policy: 推荐的最佳实践配置")
    console.print("    - bad-policy: 存在风险的配置（用于对比测试）")


@main.command()
@click.option(
    "--work-dir",
    "-w",
    default="./cache-forensics",
    help="工作目录路径",
    show_default=True,
)
@click.option(
    "--policy",
    "-p",
    default="good-policy",
    help="使用的策略名称",
    show_default=True,
)
@click.option(
    "--traffic",
    "-t",
    default="traffic.jsonl",
    help="流量数据文件名",
    show_default=True,
)
@click.option(
    "--db-updates",
    "-d",
    default="db-updates.yaml",
    help="数据库更新文件名",
    show_default=True,
)
@click.option(
    "--policy-file",
    "-f",
    default="cache-policy.yaml",
    help="策略配置文件名",
    show_default=True,
)
@click.option(
    "--run-id",
    "-r",
    help="指定运行 ID（默认自动生成）",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    help="显示详细输出",
)
def replay(
    work_dir: str,
    policy: str,
    traffic: str,
    db_updates: str,
    policy_file: str,
    run_id: Optional[str],
    verbose: bool,
):
    """回放流量数据，模拟缓存行为"""
    work_path = Path(work_dir)

    if not work_path.exists():
        console.print(f"[red]错误: 工作目录不存在: {work_path}[/red]")
        sys.exit(1)

    traffic_path = work_path / traffic
    if not traffic_path.exists():
        console.print(f"[red]错误: 流量文件不存在: {traffic_path}[/red]")
        sys.exit(1)

    policy_path = work_path / policy_file
    if not policy_path.exists():
        console.print(f"[red]错误: 策略文件不存在: {policy_path}[/red]")
        sys.exit(1)

    console.print(f"[blue]加载配置文件...[/blue]")

    policy_config = load_yaml_config(str(policy_path))
    policies = policy_config.get("policies", [])

    selected_policy = None
    for p in policies:
        if p.get("name") == policy:
            selected_policy = CachePolicy.from_dict(p)
            break

    if selected_policy is None:
        console.print(f"[red]错误: 找不到策略 '{policy}'[/red]")
        console.print(f"可用策略: {[p.get('name') for p in policies]}")
        sys.exit(1)

    console.print(f"[green]✓[/green] 使用策略: {selected_policy.name}")

    traffic_records = load_jsonl(str(traffic_path))
    traffic_events = [TrafficEvent.from_json(json.dumps(r)) for r in traffic_records]
    console.print(f"[green]✓[/green] 加载流量事件: {len(traffic_events)} 条")

    db_updates_path = work_path / db_updates
    db_events = []
    if db_updates_path.exists():
        db_config = load_yaml_config(str(db_updates_path))
        updates = db_config.get("updates", [])
        db_events = [DBUpdate.from_dict(u) for u in updates]
        console.print(f"[green]✓[/green] 加载数据库更新: {len(db_events)} 条")
    else:
        console.print(f"[yellow]警告: 数据库更新文件不存在: {db_updates_path}[/yellow]")

    console.print()
    console.print(f"[blue]开始模拟回放...[/blue]")

    engine = SimulationEngine(policy=selected_policy)
    engine.load_traffic(traffic_events)
    engine.load_db_updates(db_events)

    if len(traffic_events) > 0:
        start_time = traffic_events[0].timestamp
        initial_data = {"user:123": {"name": "张三", "email": "zhangsan@example.com", "version": 1}}
        engine.initialize_database(initial_data, start_time)

    stats = engine.run(run_id=run_id)

    console.print()
    console.print(f"[green]模拟完成![/green]")
    console.print()

    table = Table(title="模拟结果摘要")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("运行 ID", stats.run_id)
    table.add_row("策略名称", stats.policy_name)
    table.add_row("总请求数", str(stats.total_requests))
    table.add_row("缓存命中", f"{stats.cache_hits} ({stats.hit_rate * 100:.2f}%)")
    table.add_row("缓存未命中", str(stats.cache_misses))
    table.add_row("数据库查询", str(stats.db_queries))
    table.add_row("数据库写入", str(stats.db_writes))
    table.add_row("一致性违规", str(stats.consistency_violations))
    table.add_row("旧值读取", str(stats.stale_reads))
    table.add_row("风险事件", str(len(stats.risk_events)))
    console.print(table)

    if stats.risk_events:
        console.print()
        console.print("[yellow]检测到的风险事件:[/yellow]")
        for risk in stats.risk_events:
            severity_color = (
                "red"
                if risk.severity == "high"
                else "yellow"
                if risk.severity == "medium"
                else "cyan"
            )
            console.print(
                f"  [{severity_color}]{risk.risk_type.value}[/{severity_color}] - {risk.description}"
            )

    db_path = work_path / "cache-forensics.db"
    storage = SQLiteStorage(str(db_path))
    storage.save_run(stats)

    console.print()
    console.print(f"[green]✓[/green] 结果已保存到数据库: {db_path}")
    console.print()
    console.print(f"[cyan]提示:[/cyan] 使用 'cache-forensics export --run-id {stats.run_id}' 导出报告")


@main.command("list")
@click.option(
    "--work-dir",
    "-w",
    default="./cache-forensics",
    help="工作目录路径",
    show_default=True,
)
@click.option(
    "--limit",
    "-n",
    default=10,
    help="显示最近的 N 条记录",
    show_default=True,
)
def list_runs(work_dir: str, limit: int):
    """列出历史运行记录"""
    work_path = Path(work_dir)
    db_path = work_path / "cache-forensics.db"

    if not db_path.exists():
        console.print(f"[red]错误: 数据库不存在: {db_path}[/red]")
        sys.exit(1)

    storage = SQLiteStorage(str(db_path))
    runs = storage.get_runs(limit=limit)

    if not runs:
        console.print("[yellow]没有找到运行记录[/yellow]")
        return

    table = Table(title="历史运行记录")
    table.add_column("运行 ID", style="cyan")
    table.add_column("策略", style="green")
    table.add_column("总请求", style="magenta")
    table.add_column("命中率", style="yellow")
    table.add_column("风险数", style="red")
    table.add_column("创建时间", style="white")

    for run in runs:
        risk_events = storage.get_risk_events(run["id"])
        table.add_row(
            run["id"],
            run["policy_name"],
            str(run["total_requests"]),
            f"{run['hit_rate'] * 100:.2f}%",
            str(len(risk_events)),
            run["created_at"][:19],
        )

    console.print(table)


@main.command()
@click.option(
    "--run-id1",
    "-1",
    required=True,
    help="第一个运行的 ID",
)
@click.option(
    "--run-id2",
    "-2",
    required=True,
    help="第二个运行的 ID",
)
@click.option(
    "--work-dir",
    "-w",
    default="./cache-forensics",
    help="工作目录路径",
    show_default=True,
)
@click.option(
    "--output",
    "-o",
    help="输出文件路径（Markdown 格式）",
)
def compare(run_id1: str, run_id2: str, work_dir: str, output: Optional[str]):
    """对比两个运行的结果"""
    work_path = Path(work_dir)
    db_path = work_path / "cache-forensics.db"

    if not db_path.exists():
        console.print(f"[red]错误: 数据库不存在: {db_path}[/red]")
        sys.exit(1)

    storage = SQLiteStorage(str(db_path))

    run1 = storage.get_run(run_id1)
    run2 = storage.get_run(run_id2)

    if run1 is None:
        console.print(f"[red]错误: 找不到运行 ID: {run_id1}[/red]")
        sys.exit(1)

    if run2 is None:
        console.print(f"[red]错误: 找不到运行 ID: {run_id2}[/red]")
        sys.exit(1)

    risks1 = storage.get_risk_events(run_id1)
    risks2 = storage.get_risk_events(run_id2)

    comparison = Reporter.compare_runs(run1, risks1, run2, risks2)

    console.print()
    console.print(f"[blue]策略对比报告[/blue]")
    console.print(f"  运行 1: {run_id1} ({run1['policy_name']})")
    console.print(f"  运行 2: {run_id2} ({run2['policy_name']})")
    console.print()

    table = Table(title="指标对比")
    table.add_column("指标", style="cyan")
    table.add_column(f"运行 1 ({run1['policy_name']})", style="green")
    table.add_column(f"运行 2 ({run2['policy_name']})", style="yellow")
    table.add_column("差异", style="magenta")

    for m in comparison["metrics_comparison"]:
        v1 = m["run1"]
        v2 = m["run2"]
        diff = m["difference"]

        if isinstance(v1, float) and v1 <= 1:
            v1_str = f"{v1 * 100:.2f}%"
            v2_str = f"{v2 * 100:.2f}%"
            diff_str = f"{diff * 100:+.2f}%"
        else:
            v1_str = str(v1)
            v2_str = str(v2)
            diff_str = f"{diff:+d}"

        diff_color = "green" if (isinstance(diff, (int, float)) and diff < 0 and m["metric"] not in ["缓存命中", "命中率"]) else "red" if diff > 0 and m["metric"] not in ["缓存命中", "命中率"] else "white"
        table.add_row(m["metric"], v1_str, v2_str, f"[{diff_color}]{diff_str}[/{diff_color}]")

    console.print(table)

    if comparison["risk_comparison"]:
        console.print()
        console.print("[yellow]风险事件对比:[/yellow]")
        for r in comparison["risk_comparison"]:
            diff = r["difference"]
            diff_str = f"{diff:+d}"
            diff_color = "green" if diff < 0 else "red" if diff > 0 else "white"
            console.print(
                f"  {r['risk_type']}: {r['run1_count']} vs {r['run2_count']} ([{diff_color}]{diff_str}[/{diff_color}])"
            )

    if output:
        markdown = Reporter.comparison_to_markdown(comparison)
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        console.print()
        console.print(f"[green]✓[/green] 对比报告已导出: {output_path}")


@main.command()
@click.option(
    "--run-id",
    "-r",
    required=True,
    help="运行 ID",
)
@click.option(
    "--work-dir",
    "-w",
    default="./cache-forensics",
    help="工作目录路径",
    show_default=True,
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "markdown"]),
    default="markdown",
    help="输出格式",
    show_default=True,
)
@click.option(
    "--output",
    "-o",
    help="输出文件路径",
)
@click.option(
    "--stdout",
    "-s",
    is_flag=True,
    help="输出到标准输出",
)
def export(run_id: str, work_dir: str, format: str, output: Optional[str], stdout: bool):
    """导出运行报告"""
    work_path = Path(work_dir)
    db_path = work_path / "cache-forensics.db"

    if not db_path.exists():
        console.print(f"[red]错误: 数据库不存在: {db_path}[/red]")
        sys.exit(1)

    storage = SQLiteStorage(str(db_path))

    run = storage.get_run(run_id)
    if run is None:
        console.print(f"[red]错误: 找不到运行 ID: {run_id}[/red]")
        sys.exit(1)

    risks = storage.get_risk_events(run_id)

    from .models import SimulationStats
    stats = SimulationStats(
        run_id=run["id"],
        started_at=datetime.fromisoformat(run["started_at"]),
        finished_at=datetime.fromisoformat(run["finished_at"]),
        policy_name=run["policy_name"],
        total_requests=run["total_requests"],
        cache_hits=run["cache_hits"],
        cache_misses=run["cache_misses"],
        db_queries=run["db_queries"],
        db_writes=run["db_writes"],
        local_hits=run["local_hits"],
        local_misses=run["local_misses"],
        redis_hits=run["redis_hits"],
        redis_misses=run["redis_misses"],
        consistency_violations=run["consistency_violations"],
        stale_reads=run["stale_reads"],
        key_access_counts=run.get("key_access_counts", {}),
    )

    if format == "json":
        content = Reporter.to_json(stats, risks)
    else:
        content = Reporter.to_markdown(stats, risks)

    if stdout:
        console.print(content)
    elif output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        console.print(f"[green]✓[/green] 报告已导出: {output_path}")
    else:
        ext = "json" if format == "json" else "md"
        default_output = work_path / f"report-{run_id}.{ext}"
        with open(default_output, "w", encoding="utf-8") as f:
            f.write(content)
        console.print(f"[green]✓[/green] 报告已导出: {default_output}")


if __name__ == "__main__":
    main()
