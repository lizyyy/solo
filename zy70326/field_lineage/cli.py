import os
import json
from datetime import datetime, timedelta
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import box

from .models import LineageConfig, NodeType
from .loader import DataLoader
from .analyzer import LineageAnalyzer


console = Console()


def get_default_config() -> LineageConfig:
    base_dir = os.environ.get('LINEAGE_DATA_DIR', '.')
    return LineageConfig(
        tables_path=os.path.join(base_dir, 'tables.json'),
        sql_tasks_path=os.path.join(base_dir, 'sql_tasks.json'),
        reports_path=os.path.join(base_dir, 'reports.json'),
        api_path=os.path.join(base_dir, 'apis.json'),
        owners_path=os.path.join(base_dir, 'owners.json'),
        confirmations_path=os.path.join(base_dir, 'confirmations.json')
    )


def load_analyzer(config: LineageConfig) -> LineageAnalyzer:
    loader = DataLoader(config)
    tables = loader.load_table_fields()
    tasks = loader.load_sql_tasks()
    reports = loader.load_reports()
    apis = loader.load_apis()
    owners = loader.load_owners()
    confirmations = loader.load_confirmations()
    
    return LineageAnalyzer(tables, tasks, reports, apis, owners, confirmations)


@click.group()
@click.option('--data-dir', default='.', help='数据目录路径')
@click.pass_context
def main(ctx, data_dir):
    """字段血缘影响分析 CLI 工具"""
    os.environ['LINEAGE_DATA_DIR'] = data_dir
    ctx.ensure_object(dict)
    ctx.obj['config'] = get_default_config()


@main.command()
@click.argument('field_id')
@click.option('--show-chain/--no-chain', default=True, help='显示血缘链')
@click.pass_context
def impact(ctx, field_id, show_chain):
    """分析字段下线影响范围"""
    config = ctx.obj['config']
    analyzer = load_analyzer(config)
    
    with console.status("[bold green]分析字段影响..."):
        result = analyzer.analyze_impact(field_id)
    
    console.print(Panel.fit(
        f"[bold blue]字段下线影响分析: {field_id}[/bold blue]",
        border_style="blue"
    ))
    
    if result.parse_errors:
        console.print(f"\n[yellow]⚠  有 {len(result.parse_errors)} 个 SQL 任务解析失败，影响范围可能不完整[/yellow]")
    
    tasks_must_change = [n for n in result.direct_dependencies if n.node_type == NodeType.SQL_TASK]
    tasks_indirect = [n for n in result.indirect_dependencies if n.node_type == NodeType.SQL_TASK]
    reports_need_change = [n for n in result.direct_dependencies if n.node_type == NodeType.REPORT]
    reports_observable = [n for n in result.indirect_dependencies if n.node_type == NodeType.REPORT]
    apis_direct = [n for n in result.direct_dependencies if n.node_type == NodeType.API]
    apis_indirect = [n for n in result.indirect_dependencies if n.node_type == NodeType.API]
    
    if tasks_must_change:
        table = Table(title="必须修改的 SQL 任务 (直接引用)", box=box.ROUNDED, show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("任务名", style="green")
        table.add_column("负责人", style="yellow")
        table.add_column("解析状态", style="magenta")
        for node in tasks_must_change:
            has_error = bool(node.metadata.get('parse_error'))
            table.add_row(
                node.id,
                node.name,
                node.metadata.get('owner', '未设置'),
                "[red]解析失败[/red]" if has_error else "[green]正常[/green]"
            )
        console.print(table)
    
    if apis_direct:
        table = Table(title="必须修改的 API (直接引用)", box=box.ROUNDED, show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("API名", style="green")
        table.add_column("负责人", style="yellow")
        table.add_column("路径", style="blue")
        for node in apis_direct:
            table.add_row(
                node.id,
                node.name,
                node.metadata.get('owner', '未设置'),
                node.metadata.get('path', '')
            )
        console.print(table)
    
    if tasks_indirect:
        table = Table(title="间接受影响的 SQL 任务 (派生)", box=box.ROUNDED, show_lines=True, style="dim")
        table.add_column("ID", style="cyan")
        table.add_column("任务名", style="green")
        table.add_column("负责人", style="yellow")
        for node in tasks_indirect:
            table.add_row(node.id, node.name, node.metadata.get('owner', '未设置'))
        console.print(table)
    
    if reports_need_change:
        table = Table(title="需要修改的报表 (直接引用)", box=box.ROUNDED, show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("报表名", style="green")
        table.add_column("负责人", style="yellow")
        table.add_column("仪表盘", style="blue")
        for node in reports_need_change:
            table.add_row(
                node.id,
                node.name,
                node.metadata.get('owner', '未设置'),
                node.metadata.get('dashboard', '')
            )
        console.print(table)
    
    if reports_observable:
        table = Table(title="只需观察的报表 (派生引用)", box=box.ROUNDED, show_lines=True, style="dim")
        table.add_column("ID", style="cyan")
        table.add_column("报表名", style="green")
        table.add_column("负责人", style="yellow")
        for node in reports_observable:
            table.add_row(
                node.id,
                node.name,
                node.metadata.get('owner', '未设置')
            )
        console.print(table)
    
    if show_chain and result.lineage_chain:
        console.print("\n[bold]字段派生链路 (一层上游 + 一层下游):[/bold]")
        for node_id, chain in result.lineage_chain.items():
            if len(chain) >= 2:
                node = analyzer._create_dependency_node(node_id)
                if node and node.node_type != NodeType.TABLE_FIELD:
                    lineage_info = analyzer.get_lineage_chain(node_id, max_depth=1)
                    
                    tree = Tree(f"[bold]{node.name}[/bold] ({node.node_type.value})")
                    
                    if lineage_info['upstream']:
                        upstream = tree.add("[cyan]↑ 上游 (一层)[/cyan]")
                        for up in lineage_info['upstream']:
                            upstream.add(f"[dim]{up.name}[/dim] ({up.node_type.value})")
                    
                    if lineage_info['downstream']:
                        downstream = tree.add("[green]↓ 下游 (一层)[/green]")
                        for down in lineage_info['downstream']:
                            downstream.add(f"[dim]{down.name}[/dim] ({down.node_type.value})")
                    
                    console.print(tree)


@main.command()
@click.argument('owner_id', required=False)
@click.option('--list-all', is_flag=True, help='列出所有负责人')
@click.pass_context
def owner(ctx, owner_id, list_all):
    """查看负责人信息及名下资源"""
    config = ctx.obj['config']
    analyzer = load_analyzer(config)
    loader = DataLoader(config)
    owners = loader.load_owners()
    
    if list_all:
        table = Table(title="所有负责人", box=box.ROUNDED, show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("姓名", style="green")
        table.add_column("邮箱", style="yellow")
        table.add_column("团队", style="blue")
        table.add_column("SQL任务", style="magenta")
        table.add_column("报表", style="red")
        table.add_column("API", style="cyan")
        
        for oid, o in owners.items():
            summary = analyzer.get_owner_summary(oid)
            table.add_row(
                oid,
                o.name,
                o.email,
                o.team,
                str(len(summary['tasks'])),
                str(len(summary['reports'])),
                str(len(summary['apis']))
            )
        console.print(table)
        return
    
    if not owner_id:
        click.echo("请提供负责人 ID 或使用 --list-all 参数")
        return
    
    summary = analyzer.get_owner_summary(owner_id)
    owner_obj = summary['owner']
    
    if not owner_obj:
        console.print(f"[red]未找到负责人: {owner_id}[/red]")
        return
    
    console.print(Panel.fit(
        f"[bold blue]负责人信息: {owner_obj.name}[/bold blue]",
        border_style="blue"
    ))
    
    console.print(f"  ID: [cyan]{owner_obj.id}[/cyan]")
    console.print(f"  团队: [green]{owner_obj.team}[/green]")
    console.print(f"  邮箱: [yellow]{owner_obj.email}[/yellow]")
    console.print()
    
    if summary['tasks']:
        table = Table(title="负责的 SQL 任务", box=box.ROUNDED)
        table.add_column("ID", style="cyan")
        table.add_column("任务名", style="green")
        table.add_column("目标表", style="yellow")
        for task in summary['tasks']:
            table.add_row(task.id, task.name, task.target_table)
        console.print(table)
    
    if summary['reports']:
        table = Table(title="负责的报表", box=box.ROUNDED)
        table.add_column("ID", style="cyan")
        table.add_column("报表名", style="green")
        table.add_column("仪表盘", style="yellow")
        for report in summary['reports']:
            table.add_row(report.id, report.name, report.dashboard)
        console.print(table)
    
    if summary['apis']:
        table = Table(title="负责的 API", box=box.ROUNDED)
        table.add_column("ID", style="cyan")
        table.add_column("API名", style="green")
        table.add_column("路径", style="yellow")
        for api in summary['apis']:
            table.add_row(api.id, api.name, api.path)
        console.print(table)


@main.command()
@click.argument('node_id')
@click.option('--by', required=True, help='确认人ID')
@click.option('--notes', default='', help='备注信息')
@click.pass_context
def confirm(ctx, node_id, by, notes):
    """确认某个任务/报表已完成迁移"""
    config = ctx.obj['config']
    analyzer = load_analyzer(config)
    loader = DataLoader(config)
    
    try:
        conf = analyzer.confirm_migration(node_id, by, notes)
        loader.save_confirmations(analyzer.confirmations)
        
        console.print(Panel.fit(
            f"[bold green]✓ 已确认迁移[/bold green]\n"
            f"节点: {node_id}\n"
            f"确认人: {by}\n"
            f"时间: {conf.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"备注: {notes or '无'}",
            border_style="green"
        ))
    except ValueError as e:
        console.print(f"[red]{e}[/red]")


@main.command()
@click.option('--output', '-o', default=None, help='输出文件路径')
@click.option('--format', 'fmt', default='text', type=click.Choice(['text', 'json']), help='输出格式')
@click.pass_context
def report(ctx, output, fmt):
    """生成完整的下线影响报告"""
    config = ctx.obj['config']
    analyzer = load_analyzer(config)
    loader = DataLoader(config)
    tables = loader.load_table_fields()
    
    report_content = []
    now = datetime.now()
    suggested_window = (now + timedelta(days=14)).strftime('%Y-%m-%d')
    
    unconfirmed = analyzer.get_unconfirmed_by_owner()
    
    total_unconfirmed = sum(len(nodes) for nodes in unconfirmed.values())
    total_with_owner = sum(len(nodes) for oid, nodes in unconfirmed.items() if oid != 'unassigned')
    unassigned_count = len(unconfirmed.get('unassigned', []))
    
    if fmt == 'json':
        report_data = {
            'generated_at': now.isoformat(),
            'suggested_offline_window': suggested_window,
            'summary': {
                'total_unconfirmed': total_unconfirmed,
                'total_with_owner': total_with_owner,
                'unassigned_count': unassigned_count
            },
            'by_owner': {},
            'tasks_must_change': [],
            'reports_observable': [],
            'missing_owners': []
        }
        
        for oid, nodes in unconfirmed.items():
            report_data['by_owner'][oid] = [
                {'id': n.id, 'name': n.name, 'type': n.node_type.value}
                for n in nodes
            ]
        
        json_output = json.dumps(report_data, ensure_ascii=False, indent=2)
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            console.print(f"[green]报告已保存到: {output}[/green]")
        else:
            console.print(json_output)
        return
    
    report_content.append("=" * 60)
    report_content.append("字段下线影响报告")
    report_content.append("=" * 60)
    report_content.append(f"生成时间: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    report_content.append(f"建议下线窗口: {suggested_window} (两周后)")
    report_content.append("")
    
    report_content.append("-" * 60)
    report_content.append("一、摘要")
    report_content.append("-" * 60)
    report_content.append(f"  待确认迁移总数: {total_unconfirmed}")
    report_content.append(f"  有负责人待确认: {total_with_owner}")
    report_content.append(f"  负责人缺失: {unassigned_count}")
    report_content.append("")
    
    if unconfirmed:
        report_content.append("-" * 60)
        report_content.append("二、按负责人分组的待确认项")
        report_content.append("-" * 60)
        
        for oid, nodes in sorted(unconfirmed.items()):
            if oid == 'unassigned':
                owner_name = "【未分配负责人】"
            else:
                owner_obj = analyzer.owners.get(oid)
                owner_name = f"{owner_obj.name} ({oid})" if owner_obj else oid
            
            report_content.append(f"\n  {owner_name}:")
            tasks = [n for n in nodes if n.node_type == NodeType.SQL_TASK]
            reports = [n for n in nodes if n.node_type == NodeType.REPORT]
            apis = [n for n in nodes if n.node_type == NodeType.API]
            
            if tasks:
                report_content.append(f"    - SQL任务 ({len(tasks)}个):")
                for n in tasks:
                    report_content.append(f"        * [{n.id}] {n.name}")
            
            if reports:
                report_content.append(f"    - 报表 ({len(reports)}个):")
                for n in reports:
                    report_content.append(f"        * [{n.id}] {n.name}")
            
            if apis:
                report_content.append(f"    - API ({len(apis)}个):")
                for n in apis:
                    report_content.append(f"        * [{n.id}] {n.name}")
    
    report_content.append("")
    report_content.append("-" * 60)
    report_content.append("三、建议")
    report_content.append("-" * 60)
    report_content.append("  1. 先联系有明确负责人的任务/报表所有者")
    report_content.append("  2. 优先处理直接引用该字段的 SQL 任务")
    report_content.append("  3. 派生报表可观察，待上游任务迁移后自动更新")
    report_content.append(f"  4. 建议在 {suggested_window} 前完成所有迁移确认")
    
    final_report = "\n".join(report_content)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(final_report)
        console.print(f"[green]报告已保存到: {output}[/green]")
    else:
        console.print(final_report)


@main.command()
@click.argument('field_id1')
@click.argument('field_id2')
@click.pass_context
def diff(ctx, field_id1, field_id2):
    """对比两个字段的影响范围差异"""
    config = ctx.obj['config']
    analyzer = load_analyzer(config)
    
    with console.status("[bold green]对比字段影响..."):
        result1 = analyzer.analyze_impact(field_id1)
        result2 = analyzer.analyze_impact(field_id2)
    
    def get_node_ids(result):
        direct = set(n.id for n in result.direct_dependencies)
        indirect = set(n.id for n in result.indirect_dependencies)
        return direct, indirect
    
    direct1, indirect1 = get_node_ids(result1)
    direct2, indirect2 = get_node_ids(result2)
    
    all1 = direct1 | indirect1
    all2 = direct2 | indirect2
    
    only_in_1 = all1 - all2
    only_in_2 = all2 - all1
    common = all1 & all2
    
    console.print(Panel.fit(
        f"[bold blue]字段影响对比[/bold blue]\n"
        f"字段 A: {field_id1}\n"
        f"字段 B: {field_id2}",
        border_style="blue"
    ))
    
    table = Table(title="影响范围对比", box=box.ROUNDED, show_lines=True)
    table.add_column("指标", style="cyan")
    table.add_column(field_id1, style="green")
    table.add_column(field_id2, style="yellow")
    table.add_row("直接依赖数", str(len(direct1)), str(len(direct2)))
    table.add_row("间接依赖数", str(len(indirect1)), str(len(indirect2)))
    table.add_row("唯一影响节点", str(len(only_in_1)), str(len(only_in_2)))
    table.add_row("共同影响节点", str(len(common)), str(len(common)))
    console.print(table)
    
    if only_in_1:
        console.print(f"\n[bold green]仅 {field_id1} 影响的节点:[/bold green]")
        for nid in only_in_1:
            node = analyzer._create_dependency_node(nid)
            if node:
                console.print(f"  - [{node.node_type.value}] {node.name}")
    
    if only_in_2:
        console.print(f"\n[bold yellow]仅 {field_id2} 影响的节点:[/bold yellow]")
        for nid in only_in_2:
            node = analyzer._create_dependency_node(nid)
            if node:
                console.print(f"  - [{node.node_type.value}] {node.name}")


if __name__ == '__main__':
    main()
