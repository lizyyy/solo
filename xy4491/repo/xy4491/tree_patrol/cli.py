import click
import json
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from tree_patrol.core import DataLoader, AssessmentEngine
from tree_patrol.database import DatabaseManager
from tree_patrol.query import QueryInterface
from tree_patrol.export import Exporter
from tree_patrol.models import TreeStatus, ReviewRecord

console = Console()


@click.group()
@click.version_option("1.0.0")
def cli():
    """古树巡护放行 CLI 工具
    
    用于地方文保队管理古树巡护、判断放行状态、保存复核记录等。
    """
    pass


@cli.command()
@click.option('--date', '-d', default=None, help='评估日期 (YYYY-MM-DD)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def assess(date, verbose):
    """评估所有古树的今日状态
    
    根据古树台账、巡护记录、天气预警、修剪工单和游客投诉，
    综合判断每棵树今天能否开放围栏、要不要加固或派人复查。
    """
    console.print(Panel.fit("[bold green]古树巡护放行评估系统[/bold green]"))
    
    assessment_date = None
    if date:
        try:
            assessment_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            console.print(f"[bold red]错误: 日期格式不正确，请使用 YYYY-MM-DD 格式[/bold red]")
            return
    
    query = QueryInterface()
    assessments = query.get_all_assessments(assessment_date)
    summary = query.get_daily_summary(assessment_date)
    
    console.print(f"\n[bold]评估日期:[/bold] {assessment_date.strftime('%Y-%m-%d') if assessment_date else '今日'}")
    console.print(f"[bold]古树总数:[/bold] {summary['assessment_summary']['total_trees']}")
    
    table = Table(title="古树状态统计")
    table.add_column("状态", style="cyan")
    table.add_column("数量", justify="right", style="magenta")
    
    status_colors = {
        "开放": "green",
        "需复查": "yellow",
        "需加固": "orange",
        "封闭": "red"
    }
    
    for status, count in summary['assessment_summary']['status_counts'].items():
        color = status_colors.get(status, "white")
        table.add_row(f"[{color}]{status}[/{color}]", str(count))
    
    console.print(table)
    
    if verbose:
        console.print("\n[bold]详细评估结果:[/bold]")
        
        for assessment in assessments:
            tree = query.get_tree_by_id(assessment.tree_id)
            if tree:
                status_color = status_colors.get(assessment.status.value, "white")
                
                detail_table = Table(show_header=False, box=None)
                detail_table.add_column("属性", style="cyan")
                detail_table.add_column("值")
                
                detail_table.add_row("编号", tree.id)
                detail_table.add_row("名称", tree.name)
                detail_table.add_row("位置", tree.location)
                detail_table.add_row("树龄", f"{tree.age}年")
                detail_table.add_row("树种", tree.species)
                detail_table.add_row("状态", f"[{status_color}]{assessment.status.value}[/{status_color}]")
                
                console.print(Panel(detail_table, title=f"[bold]{tree.name} ({tree.id})[/bold]"))
                
                console.print("  [bold]评估原因:[/bold]")
                for reason in assessment.reasons:
                    console.print(f"    • {reason}")
                console.print()


@cli.command()
@click.argument('tree_id', required=False)
@click.option('--keyword', '-k', help='搜索关键词')
@click.option('--status', '-s', type=click.Choice(['开放', '需复查', '需加固', '封闭']), help='按状态筛选')
@click.option('--location', '-l', help='按位置筛选')
def query(tree_id, keyword, status, location):
    """查询古树信息
    
    可以按树ID、关键词、状态或位置查询古树详细信息。
    """
    query_interface = QueryInterface()
    
    if tree_id:
        detail = query_interface.get_tree_detail(tree_id)
        if not detail:
            console.print(f"[bold red]未找到编号为 {tree_id} 的古树[/bold red]")
            return
        
        tree = detail['tree']
        assessment = detail['assessment']
        
        console.print(Panel.fit(f"[bold green]古树详细信息 - {tree.name}[/bold green]"))
        
        info_table = Table(show_header=False, box=None)
        info_table.add_column("属性", style="cyan")
        info_table.add_column("值")
        
        info_table.add_row("编号", tree.id)
        info_table.add_row("名称", tree.name)
        info_table.add_row("位置", tree.location)
        info_table.add_row("树龄", f"{tree.age}年")
        info_table.add_row("树种", tree.species)
        info_table.add_row("台账状态", tree.status)
        
        if assessment:
            status_colors = {
                "开放": "green",
                "需复查": "yellow",
                "需加固": "orange",
                "封闭": "red"
            }
            color = status_colors.get(assessment.status.value, "white")
            info_table.add_row("今日评估状态", f"[{color}]{assessment.status.value}[/{color}]")
        
        console.print(info_table)
        
        if assessment and assessment.reasons:
            console.print("\n[bold]评估原因:[/bold]")
            for reason in assessment.reasons:
                console.print(f"  • {reason}")
        
        if detail['patrols']:
            console.print(f"\n[bold]今日巡护记录 ({len(detail['patrols'])}条):[/bold]")
            for patrol in detail['patrols']:
                console.print(f"  巡护员: {patrol.inspector}, 时间: {patrol.date.strftime('%Y-%m-%d %H:%M')}")
                console.print(f"  备注: {patrol.notes}")
                if patrol.issues_found:
                    console.print(f"  发现问题: {', '.join(patrol.issues_found)}")
                console.print()
        
        if detail['complaints']:
            console.print(f"\n[bold]相关投诉 ({len(detail['complaints'])}条):[/bold]")
            for complaint in detail['complaints']:
                console.print(f"  投诉人: {complaint.reporter}, 时间: {complaint.date.strftime('%Y-%m-%d %H:%M')}")
                console.print(f"  类型: {complaint.complaint_type}")
                console.print(f"  描述: {complaint.description}")
                console.print(f"  状态: {complaint.status}")
                console.print()
        
        if detail['pruning_orders']:
            console.print(f"\n[bold]修剪工单 ({len(detail['pruning_orders'])}条):[/bold]")
            for order in detail['pruning_orders']:
                console.print(f"  工单编号: {order.id}")
                console.print(f"  计划日期: {order.scheduled_date.strftime('%Y-%m-%d')}")
                console.print(f"  原因: {order.reason}")
                console.print(f"  状态: {order.status}")
                console.print()
        
        if detail['alerts']:
            console.print(f"\n[bold]相关天气预警 ({len(detail['alerts'])}条):[/bold]")
            for alert in detail['alerts']:
                console.print(f"  预警类型: {alert.alert_type} ({alert.severity}级)")
                console.print(f"  描述: {alert.description}")
                console.print()
        
        if detail['review_history']:
            console.print(f"\n[bold]历史复核记录 ({len(detail['review_history'])}条):[/bold]")
            for review in detail['review_history']:
                console.print(f"  复核时间: {review.review_date.strftime('%Y-%m-%d %H:%M')}")
                console.print(f"  复核人: {review.reviewer}")
                console.print(f"  原状态: {review.original_status.value} → 最终状态: {review.final_status.value}")
                console.print(f"  复核备注: {review.review_notes}")
                console.print()
    
    else:
        results = query_interface.search_trees(
            keyword=keyword,
            status=TreeStatus(status) if status else None,
            location=location
        )
        
        if not results:
            console.print("[yellow]未找到符合条件的古树[/yellow]")
            return
        
        console.print(f"\n[bold]找到 {len(results)} 棵古树:[/bold]")
        
        table = Table(title="古树列表")
        table.add_column("编号", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("位置")
        table.add_column("树龄")
        table.add_column("今日状态")
        
        status_colors = {
            "开放": "green",
            "需复查": "yellow",
            "需加固": "orange",
            "封闭": "red"
        }
        
        for item in results:
            tree = item['tree']
            assessment = item['assessment']
            status_text = assessment.status.value if assessment else "未知"
            color = status_colors.get(status_text, "white")
            
            table.add_row(
                tree.id,
                tree.name,
                tree.location,
                f"{tree.age}年",
                f"[{color}]{status_text}[/{color}]"
            )
        
        console.print(table)


@cli.command()
@click.argument('tree_id')
@click.argument('assessment_id')
@click.option('--reviewer', '-r', required=True, help='复核人姓名')
@click.option('--original-status', '-o', type=click.Choice(['开放', '需复查', '需加固', '封闭']), required=True, help='原始状态')
@click.option('--final-status', '-f', type=click.Choice(['开放', '需复查', '需加固', '封闭']), required=True, help='最终状态')
@click.option('--notes', '-n', required=True, help='复核备注')
def review(tree_id, assessment_id, reviewer, original_status, final_status, notes):
    """保存人工复核结果
    
    将人工复核的结果保存到 SQLite 数据库，包括原始状态、最终状态和复核备注。
    """
    db = DatabaseManager()
    
    review_record = ReviewRecord(
        id=f"R{datetime.now().strftime('%Y%m%d%H%M%S')}",
        tree_id=tree_id,
        assessment_id=assessment_id,
        review_date=datetime.now(),
        reviewer=reviewer,
        original_status=TreeStatus(original_status),
        final_status=TreeStatus(final_status),
        review_notes=notes
    )
    
    if db.save_review_record(review_record):
        console.print(f"[bold green]复核记录已保存[/bold green]")
        console.print(f"  复核编号: {review_record.id}")
        console.print(f"  古树编号: {tree_id}")
        console.print(f"  复核人: {reviewer}")
        console.print(f"  状态变更: {original_status} → {final_status}")
    else:
        console.print(f"[bold red]保存复核记录失败[/bold red]")


@cli.command()
@click.option('--output', '-o', help='输出文件路径')
@click.option('--format', '-f', type=click.Choice(['markdown', 'json']), default='markdown', help='输出格式')
@click.option('--tree-id', '-t', help='指定古树ID (仅JSON格式)')
@click.option('--reviews', '-r', is_flag=True, help='导出复核记录历史')
def export(output, format, tree_id, reviews):
    """导出数据
    
    可以导出 Markdown 交接单或 JSON 明细数据。
    """
    exporter = Exporter()
    
    if reviews:
        result = exporter.export_review_history(output, tree_id)
        if output:
            console.print(f"[bold green]复核记录已导出到: {output}[/bold green]")
        else:
            console.print(json.dumps(result, ensure_ascii=False, indent=2))
    elif format == 'markdown':
        markdown = exporter.export_markdown_handover(output)
        if output:
            console.print(f"[bold green]交接单已导出到: {output}[/bold green]")
        else:
            console.print(markdown)
    else:
        result = exporter.export_json_details(output, tree_id)
        if output:
            console.print(f"[bold green]JSON明细已导出到: {output}[/bold green]")
        else:
            console.print(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
def stats():
    """显示统计信息
    
    显示古树状态分布和复核记录统计。
    """
    query = QueryInterface()
    summary = query.get_daily_summary()
    
    console.print(Panel.fit("[bold green]古树巡护统计信息[/bold green]"))
    
    console.print("\n[bold]今日评估统计:[/bold]")
    console.print(f"  古树总数: {summary['assessment_summary']['total_trees']}")
    
    table = Table(title="状态分布")
    table.add_column("状态", style="cyan")
    table.add_column("数量", justify="right", style="magenta")
    table.add_column("占比", justify="right", style="yellow")
    
    total = summary['assessment_summary']['total_trees']
    for status, count in summary['assessment_summary']['status_counts'].items():
        percentage = (count / total * 100) if total > 0 else 0
        table.add_row(status, str(count), f"{percentage:.1f}%")
    
    console.print(table)
    
    console.print("\n[bold]复核记录统计:[/bold]")
    console.print(f"  总复核记录数: {summary['review_statistics']['total_reviews']}")
    
    if summary['review_statistics']['status_distribution']:
        review_table = Table(title="复核状态分布")
        review_table.add_column("最终状态", style="cyan")
        review_table.add_column("数量", justify="right", style="magenta")
        
        for status, count in summary['review_statistics']['status_distribution'].items():
            review_table.add_row(status, str(count))
        
        console.print(review_table)


if __name__ == '__main__':
    cli()
