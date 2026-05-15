import sys
import json
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from ..processor import AuditProcessor
from ..models import AuditStatus, ErrorCode

console = Console()


def print_result_summary(result, errors):
    status_colors = {
        AuditStatus.PASS: "green",
        AuditStatus.FAIL: "red",
        AuditStatus.WARNING: "yellow",
        AuditStatus.PARTIAL: "orange",
        AuditStatus.PENDING: "gray"
    }

    console.print(Panel.fit(
        f"[bold]审计结果汇总[/bold]\n"
        f"环境名称: {result.environment_name}\n"
        f"总体状态: [{status_colors[result.overall_status]}]{result.overall_status.upper()}[/{status_colors[result.overall_status]}]\n"
        f"总计: {result.total_count} | 通过: {result.pass_count} | 失败: {result.fail_count} | "
        f"警告: {result.warning_count} | 待处理: {result.pending_count}",
        title="审计报告"
    ))

    if errors:
        console.print("\n[bold red]错误详情:[/bold red]")
        for err in errors:
            console.print(f"  [{err.code}] {err.message}")

    console.print("\n[bold]明细列表:[/bold]")
    table = Table(show_header=True)
    table.add_column("ID", style="dim")
    table.add_column("审计项名称")
    table.add_column("部门")
    table.add_column("负责人")
    table.add_column("来源")
    table.add_column("状态")

    for item in result.items:
        status_style = status_colors.get(item.status, "white")
        table.add_row(
            item.item_id,
            item.item_name,
            item.department,
            item.responsible_person or "-",
            item.source,
            f"[{status_style}]{item.status.upper()}[/{status_style}]"
        )

    console.print(table)


@click.group()
def cli():
    """多源审计取证参数矩阵命令行工具"""
    pass


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--format', '-f', type=click.Choice(['text', 'json']), default='text', help='输出格式')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
def check(file_path, format, output):
    """检查审计材料并验证负责人"""
    processor = AuditProcessor()
    result, errors = processor.process_audit(file_path)

    if not result:
        console.print("[bold red]审计处理失败[/bold red]")
        for err in errors:
            console.print(f"  [{err.code}] {err.message}")
        sys.exit(1)

    exit_code = 0
    if result.overall_status == AuditStatus.FAIL:
        exit_code = 1
    elif result.overall_status == AuditStatus.PARTIAL:
        exit_code = 4

    if format == 'json':
        output_data = {
            "result": result.model_dump(mode='json'),
            "errors": [err.model_dump(mode='json') for err in errors],
            "exit_code": exit_code
        }
        output_str = json.dumps(output_data, ensure_ascii=False, indent=2)
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(output_str)
        else:
            console.print(output_str)
    else:
        print_result_summary(result, errors)

    sys.exit(exit_code)


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.argument('item_id')
@click.option('--corrector', '-c', required=True, help='修正人姓名')
@click.option('--status', '-s', required=True, type=click.Choice(['pass', 'fail', 'warning']), help='修正后的状态')
@click.option('--reason', '-r', required=True, help='修正理由')
@click.option('--evidence', '-e', help='佐证材料链接')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
def correct(file_path, item_id, corrector, status, reason, evidence, output):
    """人工修正审计项判断并添加备注"""
    processor = AuditProcessor()
    result, errors = processor.process_audit(file_path)

    if not result:
        console.print("[bold red]审计处理失败[/bold red]")
        sys.exit(1)

    target_item = None
    for item in result.items:
        if item.item_id == item_id:
            target_item = item
            break

    if not target_item:
        console.print(f"[bold red]未找到ID为 {item_id} 的审计项[/bold red]")
        sys.exit(1)

    corrected_item = processor.add_correction_note(
        item=target_item,
        corrector=corrector,
        corrected_judgment=AuditStatus(status),
        reason=reason,
        evidence=evidence
    )

    console.print(f"[bold green]修正成功![/bold green]")
    console.print(f"  审计项: {corrected_item.item_name} ({corrected_item.item_id})")
    console.print(f"  原判断: {corrected_item.correction_notes[-1].original_judgment}")
    console.print(f"  新判断: {corrected_item.correction_notes[-1].corrected_judgment}")
    console.print(f"  修正人: {corrected_item.correction_notes[-1].corrector}")
    console.print(f"  理由: {corrected_item.correction_notes[-1].reason}")

    if output:
        output_data = {
            "environment_name": result.environment_name,
            "items": [item.model_dump(mode='json') for item in result.items]
        }
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        console.print(f"[bold]修正结果已保存至: {output}[/bold]")


@cli.command()
@click.argument('environment_name')
def lookup(environment_name):
    """通过环境名称查找门店设备台账的原始输入和处理依据"""
    examples_dir = Path(__file__).parent.parent / "examples"
    
    found = False
    for yaml_file in examples_dir.glob("*.yaml"):
        processor = AuditProcessor()
        result, _ = processor.process_audit(str(yaml_file))
        
        if result and result.environment_name == environment_name:
            found = True
            console.print(f"\n[bold green]找到环境: {environment_name}[/bold green]")
            console.print(f"源文件: {yaml_file}")
            console.print("\n[bold]原始输入和处理依据:[/bold]")
            
            for item in result.items:
                console.print(f"\n  [bold]{item.item_id}: {item.item_name}[/bold]")
                console.print(f"    原始数据: {item.model_dump_json(indent=6, include=['original_data'])}")
                console.print(f"    处理依据:")
                for basis in item.processing_basis:
                    console.print(f"      - {basis}")
    
    if not found:
        console.print(f"[bold red]未找到名为 '{environment_name}' 的环境[/bold red]")
        sys.exit(1)


if __name__ == "__main__":
    cli()
