import json
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .config import Config
from .deduplicator import LiveAlertDeduplicator

console = Console()


def load_alerts(input_path: str) -> list:
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"输入文件不存在: {input_path}")

    with open(path, 'r', encoding='utf-8') as f:
        if path.suffix == '.jsonl':
            alerts = []
            for line in f:
                line = line.strip()
                if line:
                    alerts.append(json.loads(line))
            return alerts
        else:
            data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'alerts' in data:
                return data['alerts']
            else:
                raise ValueError("无法识别的输入格式，请提供JSON数组或包含alerts字段的JSON对象")


def save_output(result: dict, output_path: Optional[str], output_format: str):
    if output_path:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8') as f:
            if output_format == 'json':
                json.dump(result, f, ensure_ascii=False, indent=2)
            elif output_format == 'jsonl':
                for alert in result.get('alerts', []):
                    f.write(json.dumps(alert, ensure_ascii=False) + '\n')
        console.print(f"[green]✓ 结果已保存到: {output_path}[/green]")
    else:
        if output_format == 'json':
            print(json.dumps(result, ensure_ascii=False, indent=2))


def display_statistics(stats: dict):
    table = Table(title="去重统计", show_header=True, header_style="bold magenta")
    table.add_column("统计项", style="cyan")
    table.add_column("数值", justify="right", style="green")

    table.add_row("输入告警数", str(stats.get('total_input', 0)))
    table.add_row("输出告警数", str(stats.get('total_output', 0)))
    table.add_row("重叠片段合并数", str(stats.get('overlap_merged', 0)))
    table.add_row("模型重复移除数", str(stats.get('model_duplicates_removed', 0)))
    table.add_row("误报恢复数", str(stats.get('false_positives_recovered', 0)))

    reduction = (
        (stats.get('total_input', 0) - stats.get('total_output', 0)) / stats.get('total_input', 1) * 100
        if stats.get('total_input', 0) > 0 else 0
    )
    table.add_row("去重率", f"{reduction:.1f}%")

    console.print(table)


def display_alerts_summary(alerts: list):
    if not alerts:
        console.print("[yellow]警告: 没有输出告警[/yellow]")
        return

    table = Table(title="输出告警摘要", show_header=True, header_style="bold blue")
    table.add_column("告警ID", style="cyan")
    table.add_column("直播流ID", style="magenta")
    table.add_column("违规类型", style="yellow")
    table.add_column("时间范围(秒)", style="green")
    table.add_column("模型", style="blue")
    table.add_column("置信度", style="red")
    table.add_column("违规等级", style="purple")

    for alert in alerts[:10]:
        alert_id = alert.get('alert_id', 'N/A')
        stream_id = alert.get('stream_id', 'N/A')
        violation_type = alert.get('violation_type', 'N/A')
        start_time = alert.get('start_time', 0)
        end_time = alert.get('end_time', 0)
        time_range = f"{start_time} - {end_time}"
        model_name = alert.get('model_name', 'N/A')
        confidence = f"{alert.get('confidence', 0):.2f}"
        violation_level = alert.get('violation_level', 'N/A')

        dedup_info = alert.get('deduplication_info', {})
        if dedup_info:
            merge_type = dedup_info.get('merge_type', '')
            if merge_type:
                alert_id = f"[bold]{alert_id}[/bold] *"
            if dedup_info.get('status') == 'false_positive_recovered':
                violation_level = f"[strike]{violation_level}[/strike] (FP)"

        table.add_row(
            alert_id, stream_id, violation_type, time_range,
            model_name, confidence, violation_level
        )

    if len(alerts) > 10:
        table.add_row("...", "...", f"还有 {len(alerts) - 10} 条", "...", "...", "...", "...")

    console.print(table)


@click.group()
def cli():
    """直播告警样本违规片段去重 CLI"""
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--config', '-c', type=click.Path(exists=True), help='配置文件路径')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--format', '-f', 'output_format', type=click.Choice(['json', 'jsonl']), default='json', help='输出格式')
@click.option('--show-details/--no-details', default=True, help='是否显示详细信息')
@click.option('--diff-config', type=click.Path(exists=True), help='用于对比的配置文件路径')
def run(input_file, config, output, output_format, show_details, diff_config):
    """运行去重处理"""
    try:
        console.print(Panel.fit("[bold blue]直播告警样本违规片段去重 CLI[/bold blue]", border_style="blue"))

        cfg = Config(config)
        deduplicator = LiveAlertDeduplicator(cfg)

        alerts = load_alerts(input_file)
        console.print(f"[cyan]已加载 {len(alerts)} 条告警记录[/cyan]")

        result = deduplicator.deduplicate(alerts)

        if show_details:
            console.print()
            display_statistics(result['statistics'])
            console.print()
            display_alerts_summary(result['alerts'])

        save_output(result, output, output_format)

        if diff_config:
            console.print()
            console.print(Panel.fit("[bold yellow]配置对比 - 严格模式[/bold yellow]", border_style="yellow"))
            cfg2 = Config(diff_config)
            deduplicator2 = LiveAlertDeduplicator(cfg2)
            result2 = deduplicator2.deduplicate(alerts)
            display_statistics(result2['statistics'])

            console.print()
            console.print("[bold magenta]差异对比:[/bold magenta]")
            stats1 = result['statistics']
            stats2 = result2['statistics']
            console.print(f"  输出告警数差异: {stats1['total_output']} -> {stats2['total_output']} "
                        f"({'+' if stats2['total_output'] > stats1['total_output'] else ''}"
                        f"{stats2['total_output'] - stats1['total_output']})")
            console.print(f"  重叠合并差异: {stats1['overlap_merged']} -> {stats2['overlap_merged']}")
            console.print(f"  模型重复差异: {stats1['model_duplicates_removed']} -> {stats2['model_duplicates_removed']}")

        console.print()
        console.print("[green]✓ 处理完成[/green]")

    except Exception as e:
        console.print(f"[red]错误: {str(e)}[/red]")
        sys.exit(1)


@cli.command()
@click.argument('config_file', type=click.Path(exists=True))
def validate_config(config_file):
    """验证配置文件"""
    try:
        cfg = Config(config_file)
        console.print(f"[green]✓ 配置文件验证通过[/green]")
        console.print(f"  重叠检测: {'启用' if cfg.overlap_enabled else '禁用'}")
        console.print(f"  模型重复检测: {'启用' if cfg.model_duplicate_enabled else '禁用'}")
        console.print(f"  误报恢复: {'启用' if cfg.fp_recovery_enabled else '禁用'}")
        console.print(f"  合并策略: {cfg.merge_strategy}")
    except Exception as e:
        console.print(f"[red]✗ 配置文件验证失败: {str(e)}[/red]")
        sys.exit(1)


@cli.command()
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
def show_default_config(output):
    """显示默认配置"""
    default_config_path = Path(__file__).parent.parent / "config" / "default.yaml"
    with open(default_config_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(content)
        console.print(f"[green]✓ 默认配置已保存到: {output}[/green]")
    else:
        console.print(Panel(content, title="默认配置", border_style="cyan"))


if __name__ == '__main__':
    cli()
