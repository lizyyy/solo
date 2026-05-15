import click
import json
import os
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich.text import Text
from .__init__ import __version__
from .processor import MaterialProcessor
from .storage import StorageManager
from .models import CheckStatus


console = Console()
processor = MaterialProcessor()


def print_status(status: CheckStatus) -> str:
    status_map = {
        CheckStatus.PASS: "[green]✓ 通过[/green]",
        CheckStatus.FAIL: "[red]✗ 失败[/red]",
        CheckStatus.WARNING: "[yellow]⚠ 警告[/yellow]",
        CheckStatus.SKIPPED: "[gray]○ 跳过[/gray]"
    }
    return status_map.get(status, str(status))


@click.group()
@click.version_option(version=__version__, prog_name="dir-perm-cli")
def cli():
    """目录权限漂移检测工具 - 检测空值被误判为成功的权限漂移场景"""
    pass


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--batch-id", required=True, help="批次ID")
@click.option("--title", required=True, help="提交材料标题")
@click.option("--department", required=True, help="提交部门")
@click.option("--submitter", required=True, help="提交人")
def submit(file_path, batch_id, title, department, submitter):
    """提交材料进行权限漂移检测"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        
        result = processor.process_material(raw_data, batch_id, title, department, submitter)
        
        if result.is_duplicate:
            console.print(Panel(
                f"[yellow]{result.conflict_info}[/yellow]",
                title="重复提交检测",
                border_style="yellow"
            ))
            
            if result.conclusion:
                console.print(f"原有结论整体状态: {print_status(result.conclusion.overall_status)}")
        
        if result.success and result.conclusion:
            conclusion = result.conclusion
            
            console.print(Panel(
                f"提交ID: {result.existing_material.submission_id}\n"
                f"整体检测结果: {print_status(conclusion.overall_status)}",
                title="检测完成",
                border_style="green" if conclusion.overall_status == CheckStatus.PASS else 
                              "red" if conclusion.overall_status == CheckStatus.FAIL else "yellow"
            ))
            
            table = Table(title="详细检测结果")
            table.add_column("规则ID", style="cyan")
            table.add_column("检测项", style="blue")
            table.add_column("状态")
            table.add_column("说明", style="white")
            
            for cr in conclusion.check_results:
                table.add_row(
                    cr.check_id,
                    cr.check_name,
                    print_status(cr.status),
                    cr.message
                )
            
            console.print(table)
            
            if conclusion.overall_status != CheckStatus.PASS:
                console.print("\n[bold red]问题详情:[/bold red]")
                for cr in conclusion.check_results:
                    if cr.status in [CheckStatus.FAIL, CheckStatus.WARNING]:
                        console.print(f"\n[yellow]{cr.check_name}:[/yellow]")
                        for detail in cr.details.values():
                            if isinstance(detail, list):
                                for item in detail:
                                    console.print(f"  - {item}")
                            else:
                                console.print(f"  - {detail}")
    
    except Exception as e:
        console.print(f"[red]错误: {str(e)}[/red]")


@cli.command("list")
@click.option("--batch-id", help="按批次ID筛选")
def list_submissions(batch_id):
    """列出所有提交记录"""
    if batch_id:
        submissions = processor.storage.get_submissions_by_batch(batch_id)
    else:
        submissions = processor.storage.get_all_submissions()
    
    if not submissions:
        console.print("[yellow]没有找到提交记录[/yellow]")
        return
    
    table = Table(title="提交记录列表")
    table.add_column("提交ID", style="cyan")
    table.add_column("批次ID", style="blue")
    table.add_column("标题", style="green")
    table.add_column("部门")
    table.add_column("提交人")
    table.add_column("检测状态")
    
    for sub in submissions:
        conclusion = processor.get_conclusion_by_submission(sub.submission_id)
        status = print_status(conclusion.overall_status) if conclusion else "[gray]未检测[/gray]"
        table.add_row(
            sub.submission_id,
            sub.batch_id,
            sub.title,
            sub.department,
            sub.submitter,
            status
        )
    
    console.print(table)


@cli.command()
@click.argument("submission_id")
def show(submission_id):
    """查看单个提交的详细信息"""
    submission = processor.get_submission_by_id(submission_id)
    if not submission:
        console.print(f"[red]未找到提交ID: {submission_id}[/red]")
        return
    
    conclusion = processor.get_conclusion_by_submission(submission_id)
    
    console.print(Panel(
        f"标题: {submission.title}\n"
        f"批次: {submission.batch_id}\n"
        f"部门: {submission.department}\n"
        f"提交人: {submission.submitter}\n"
        f"提交时间: {submission.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if submission.submitted_at else 'N/A'}\n"
        f"整体状态: {print_status(conclusion.overall_status) if conclusion else 'N/A'}",
        title=f"提交详情: {submission_id}",
        border_style="blue"
    ))
    
    console.print("\n[bold]权限项:[/bold]")
    perm_table = Table()
    perm_table.add_column("设备ID", style="cyan")
    perm_table.add_column("设备名称")
    perm_table.add_column("门店")
    perm_table.add_column("权限类型")
    perm_table.add_column("目标路径")
    
    for item in submission.permission_items:
        perm_table.add_row(
            item.device_id,
            item.device_name,
            item.store_name,
            item.permission_type,
            item.permission_target or "[red]空[/red]"
        )
    console.print(perm_table)
    
    console.print("\n[bold]审批节点:[/bold]")
    node_table = Table()
    node_table.add_column("节点ID", style="cyan")
    node_table.add_column("节点名称")
    node_table.add_column("审批人")
    node_table.add_column("状态")
    node_table.add_column("审批时间")
    
    for node in submission.approval_nodes:
        approver_status = "[red]空[/red]" if not node.approver else node.approver
        time_status = "[red]空[/red]" if not node.approved_at else node.approved_at.strftime('%Y-%m-%d %H:%M')
        node_table.add_row(
            node.node_id,
            node.node_name,
            approver_status,
            node.status.value,
            time_status
        )
    console.print(node_table)
    
    if conclusion:
        console.print("\n[bold]检测结果:[/bold]")
        check_table = Table()
        check_table.add_column("规则ID", style="cyan")
        check_table.add_column("检测项")
        check_table.add_column("状态")
        check_table.add_column("说明")
        
        for cr in conclusion.check_results:
            check_table.add_row(
                cr.check_id,
                cr.check_name,
                print_status(cr.status),
                cr.message
            )
        console.print(check_table)


@cli.command()
@click.option("--output", "-o", help="输出文件路径")
@click.option("--batch-id", help="按批次ID筛选")
def export(output, batch_id):
    """导出检测结果"""
    result_json = processor.export_results(output_format="json", batch_id=batch_id)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(result_json)
        console.print(f"[green]结果已导出到: {output}[/green]")
    else:
        console.print(result_json)


@cli.command("query-node")
@click.option("--node-id", help="按节点ID查询")
@click.option("--node-name", help="按节点名称模糊查询")
@click.option("--batch-id", help="按批次ID筛选")
def query_node(node_id, node_name, batch_id):
    """按审批节点回查相关提交"""
    results = processor.query_by_approval_node(node_id=node_id, node_name=node_name, batch_id=batch_id)
    
    if not results:
        console.print("[yellow]没有找到匹配的记录[/yellow]")
        return
    
    console.print(f"[green]找到 {len(results)} 条匹配记录:[/green]\n")
    
    for idx, result in enumerate(results, 1):
        sub = result["submission"]
        node = result["node"]
        conclusion = result["conclusion"]
        
        tree = Tree(f"[bold blue]#{idx} 提交: {sub.submission_id}[/bold blue] - {sub.title}")
        node_branch = tree.add(f"[cyan]审批节点: {node.node_id} - {node.node_name}[/cyan]")
        node_branch.add(f"审批人: {node.approver or '[red]空[/red]'}")
        node_branch.add(f"状态: {node.status.value}")
        node_branch.add(f"审批时间: {node.approved_at.strftime('%Y-%m-%d %H:%M') if node.approved_at else '[red]空[/red]'}")
        
        if conclusion:
            tree.add(f"检测结果: {print_status(conclusion.overall_status)}")
        
        console.print(tree)
        console.print()


@cli.command("samples")
def list_samples():
    """列出可用的样例文件"""
    samples_dir = Path(__file__).parent.parent / "samples"
    
    if not samples_dir.exists():
        console.print("[yellow]样例目录不存在[/yellow]")
        return
    
    sample_files = list(samples_dir.glob("*.json"))
    
    if not sample_files:
        console.print("[yellow]没有找到样例文件[/yellow]")
        return
    
    console.print("[green]可用样例文件:[/green]\n")
    
    for sf in sample_files:
        with open(sf, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        perm_count = len(data.get("permission_items", []))
        node_count = len(data.get("approval_nodes", []))
        
        desc = "正常材料" if "normal" in sf.name else "坏材料(空值陷阱)" if "null" in sf.name else "其他"
        
        console.print(f"  [cyan]{sf.name}[/cyan]")
        console.print(f"    描述: {desc}")
        console.print(f"    权限项数: {perm_count}, 审批节点数: {node_count}")
        console.print(f"    路径: {sf.absolute()}\n")


if __name__ == "__main__":
    cli()
