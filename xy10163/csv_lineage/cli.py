import click
import json
import os
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from csv_lineage.utils.storage import LineageStorage
from csv_lineage.core.schema import SchemaAnalyzer
from csv_lineage.core.alias import AliasManager
from csv_lineage.core.lineage import LineageManager
from csv_lineage.core.report import ReportGenerator
from csv_lineage.utils.graph import LineageGraph

console = Console()

@click.group()
@click.option('--storage', '-s', default=None, help='存储目录路径 (默认: ./.lineage)')
@click.pass_context
def cli(ctx, storage):
    """CSV 字段血缘追踪 CLI - 追踪运营表字段名变化，管理别名，识别破坏性变更"""
    ctx.ensure_object(dict)
    ctx.obj['storage'] = LineageStorage(storage)
    ctx.obj['schema_analyzer'] = SchemaAnalyzer()
    ctx.obj['alias_manager'] = AliasManager(ctx.obj['storage'])
    ctx.obj['lineage_manager'] = LineageManager(ctx.obj['storage'])
    ctx.obj['report_generator'] = ReportGenerator(ctx.obj['storage'])
    ctx.obj['graph_generator'] = LineageGraph(ctx.obj['storage'])

@cli.command()
@click.argument('table_name')
@click.argument('csv_file', type=click.Path(exists=True))
@click.option('--comment', '-c', default='', help='版本备注')
@click.option('--auto-alias/--no-auto-alias', default=True, help='自动检测字段重命名并建立别名')
@click.pass_context
def import_csv(ctx, table_name, csv_file, comment, auto_alias):
    """导入 CSV 文件并创建版本"""
    storage = ctx.obj['storage']
    schema_analyzer = ctx.obj['schema_analyzer']
    alias_manager = ctx.obj['alias_manager']
    lineage_manager = ctx.obj['lineage_manager']
    
    console.print(f"[cyan]正在分析 CSV 文件: {csv_file}[/cyan]")
    schema = schema_analyzer.analyze_csv(csv_file)
    
    existing_versions = storage.get_all_versions(table_name)
    is_first_import = len(existing_versions) == 0
    
    old_version = storage.get_version(table_name) if not is_first_import else None
    
    console.print(f"[cyan]保存版本...[/cyan]")
    new_version_num, is_new_version = storage.save_version(table_name, csv_file, schema, comment)
    
    if not is_new_version:
        console.print(f"[yellow]⚠ 检测到重复导入[/yellow]")
        console.print(f"  该文件已存在于版本 v{new_version_num}")
        console.print(f"  跳过血缘更新以避免污染状态")
        return
    
    if is_first_import:
        lineage_manager.initialize_lineage(table_name, new_version_num, schema)
        console.print(f"[green]✓ 首次导入成功[/green]")
        console.print(f"  表名: {table_name}")
        console.print(f"  版本: v{new_version_num}")
        console.print(f"  字段数: {schema['field_count']}")
    else:
        old_schema = old_version['schema'] if old_version else None
        comparison = schema_analyzer.compare_schemas(old_schema, schema)
        
        renames = {}
        if auto_alias and old_schema:
            renames = alias_manager.detect_renames(old_schema, schema, table_name)
            if renames:
                console.print(f"[yellow]检测到 {len(renames)} 个可能的字段重命名:[/yellow]")
                for old, new in renames.items():
                    console.print(f"  {old} -> {new}")
        
        lineage_manager.update_lineage(table_name, new_version_num, schema, comparison, renames)
        
        if renames:
            alias_manager.apply_renames_to_aliases(table_name, renames)
        
        summary = comparison['summary']
        console.print(f"[green]✓ 导入成功[/green]")
        console.print(f"  版本: v{old_version['version'] if old_version else 'N/A'} -> v{new_version_num}")
        console.print(f"  变更: +{summary['added_count']} -{summary['removed_count']} ~{summary['changed_count']}")

@cli.command()
@click.argument('table_name')
@click.option('--from-version', '-f', type=int, default=None, help='起始版本')
@click.option('--to-version', '-t', type=int, default=None, help='结束版本')
@click.option('--output', '-o', type=click.Path(), default=None, help='输出文件路径')
@click.option('--format', '-fmt', type=click.Choice(['text', 'json', 'html']), default='text', help='报告格式')
@click.pass_context
def report(ctx, table_name, from_version, to_version, output, format):
    """生成字段血缘和变更报告"""
    storage = ctx.obj['storage']
    schema_analyzer = ctx.obj['schema_analyzer']
    lineage_manager = ctx.obj['lineage_manager']
    report_generator = ctx.obj['report_generator']
    
    versions = storage.get_all_versions(table_name)
    if not versions:
        console.print(f"[red]错误: 表 '{table_name}' 不存在[/red]")
        return
    
    if from_version is None:
        from_version = versions[0]['version']
    if to_version is None:
        to_version = versions[-1]['version']
    
    old_version_data = storage.get_version(table_name, from_version)
    new_version_data = storage.get_version(table_name, to_version)
    
    if not old_version_data or not new_version_data:
        console.print(f"[red]错误: 指定的版本不存在[/red]")
        return
    
    console.print(f"[cyan]比较版本 v{from_version} -> v{to_version}[/cyan]")
    
    comparison = schema_analyzer.compare_schemas(
        old_version_data['schema'],
        new_version_data['schema']
    )
    
    lineage = storage.get_lineage(table_name)
    breaking_changes = lineage_manager.identify_breaking_changes(
        table_name, from_version, to_version
    )
    
    if format == 'text':
        report_content = report_generator.generate_text_report(
            table_name, comparison, lineage, breaking_changes, from_version, to_version
        )
    elif format == 'json':
        report_content = report_generator.generate_json_report(
            table_name, comparison, lineage, breaking_changes, from_version, to_version
        )
    else:
        report_content = report_generator.generate_html_report(
            table_name, comparison, lineage, breaking_changes, from_version, to_version
        )
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report_content)
        console.print(f"[green]✓ 报告已保存到: {output}[/green]")
    else:
        console.print(report_content)

@cli.command()
@click.argument('table_name')
@click.argument('output_file', type=click.Path())
@click.pass_context
def graph(ctx, table_name, output_file):
    """生成字段血缘可视化图"""
    graph_generator = ctx.obj['graph_generator']
    
    console.print(f"[cyan]生成血缘图...[/cyan]")
    result = graph_generator.generate_graph(table_name, output_file)
    
    if 'error' in result:
        console.print(f"[red]错误: {result['error']}[/red]")
    else:
        console.print(f"[green]✓ 血缘图已生成: {output_file}[/green]")
        console.print(f"  节点数: {result.get('node_count', 'N/A')}")

@cli.command('list-tables')
@click.pass_context
def list_tables(ctx):
    """列出所有已追踪的表"""
    storage = ctx.obj['storage']
    tables = storage.list_tables()
    
    if not tables:
        console.print("[yellow]没有找到任何表[/yellow]")
        return
    
    table = Table(title="已追踪的表")
    table.add_column("表名", style="cyan")
    table.add_column("版本数", style="green")
    table.add_column("当前版本", style="magenta")
    
    for table_name in tables:
        versions = storage.get_all_versions(table_name)
        meta = storage.get_meta()
        current = meta['tables'][table_name]['current_version']
        table.add_row(table_name, str(len(versions)), f"v{current}")
    
    console.print(table)

@cli.command('list-versions')
@click.argument('table_name')
@click.pass_context
def list_versions(ctx, table_name):
    """列出表的所有版本"""
    storage = ctx.obj['storage']
    versions = storage.get_all_versions(table_name)
    
    if not versions:
        console.print(f"[red]错误: 表 '{table_name}' 不存在[/red]")
        return
    
    table = Table(title=f"{table_name} 的版本历史")
    table.add_column("版本", style="cyan")
    table.add_column("导入时间", style="green")
    table.add_column("字段数", style="magenta")
    table.add_column("备注", style="yellow")
    
    for v in versions:
        table.add_row(
            f"v{v['version']}",
            v['imported_at'][:19],
            str(v['field_count']),
            v['comment'] or '-'
        )
    
    console.print(table)

@cli.command('field-history')
@click.argument('table_name')
@click.argument('field_name')
@click.pass_context
def field_history(ctx, table_name, field_name):
    """查看字段的历史变更"""
    lineage_manager = ctx.obj['lineage_manager']
    
    history = lineage_manager.get_field_history(table_name, field_name)
    
    if not history:
        console.print(f"[red]错误: 字段 '{field_name}' 不存在于表 '{table_name}'[/red]")
        return
    
    console.print(Panel.fit(
        f"[cyan]标准名称:[/cyan] {history['canonical_name']}\n"
        f"[green]所有别名:[/green] {', '.join(history['aliases'])}\n"
        f"[magenta]首次出现:[/magenta] v{history['first_seen']}\n"
        f"[yellow]最后出现:[/yellow] v{history['last_seen']}",
        title=f"字段历史: {field_name}"
    ))
    
    table = Table(title="变更记录")
    table.add_column("版本", style="cyan")
    table.add_column("字段名", style="green")
    table.add_column("类型", style="magenta")
    table.add_column("动作", style="yellow")
    table.add_column("时间", style="white")
    
    for entry in history['history']:
        action = entry.get('action', 'unknown')
        action_style = {
            'added': 'green',
            'removed': 'red',
            'renamed_from': 'yellow',
            'type_changed': 'magenta'
        }.get(action, 'white')
        
        table.add_row(
            f"v{entry['version']}",
            entry.get('name', '-'),
            entry.get('dtype', '-'),
            f"[{action_style}]{action}[/{action_style}]",
            entry.get('timestamp', '-')[:19]
        )
    
    console.print(table)

@cli.command('add-alias')
@click.argument('table_name')
@click.argument('canonical_name')
@click.argument('alias')
@click.pass_context
def add_alias(ctx, table_name, canonical_name, alias):
    """手动添加字段别名"""
    alias_manager = ctx.obj['alias_manager']
    storage = ctx.obj['storage']
    
    tables = storage.list_tables()
    if table_name not in tables:
        console.print(f"[red]错误: 表 '{table_name}' 不存在[/red]")
        return
    
    success = alias_manager.add_alias(table_name, canonical_name, alias)
    
    if success:
        console.print(f"[green]✓ 别名添加成功: {canonical_name} <- {alias}[/green]")
    else:
        console.print(f"[red]错误: 别名 '{alias}' 已属于其他字段[/red]")

@cli.command('list-aliases')
@click.argument('table_name')
@click.pass_context
def list_aliases(ctx, table_name):
    """列出所有字段别名"""
    lineage_manager = ctx.obj['lineage_manager']
    storage = ctx.obj['storage']
    
    tables = storage.list_tables()
    if table_name not in tables:
        console.print(f"[red]错误: 表 '{table_name}' 不存在[/red]")
        return
    
    aliases = lineage_manager.get_all_fields_with_aliases(table_name)
    
    if not aliases:
        console.print("[yellow]没有找到别名信息[/yellow]")
        return
    
    table = Table(title=f"{table_name} 的字段别名")
    table.add_column("标准名称", style="cyan")
    table.add_column("历史别名", style="green")
    table.add_column("别名数量", style="magenta")
    
    for canonical, alias_list in aliases.items():
        current = alias_list[-1] if alias_list else canonical
        alias_strs = []
        for i, a in enumerate(alias_list):
            marker = " (当前)" if i == len(alias_list) - 1 and len(alias_list) > 1 else ""
            alias_strs.append(f"{a}{marker}")
        
        table.add_row(
            canonical,
            "\n".join(alias_strs),
            str(len(alias_list))
        )
    
    console.print(table)

@cli.command('rebuild-lineage')
@click.argument('table_name')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def rebuild_lineage(ctx, table_name, verbose):
    """从版本历史重建血缘关系（修复被污染的血缘数据）"""
    lineage_manager = ctx.obj['lineage_manager']
    alias_manager = ctx.obj['alias_manager']
    schema_analyzer = ctx.obj['schema_analyzer']
    storage = ctx.obj['storage']
    
    tables = storage.list_tables()
    if table_name not in tables:
        console.print(f"[red]错误: 表 '{table_name}' 不存在[/red]")
        ctx.exit(1)
    
    versions = storage.get_all_versions(table_name)
    if not versions:
        console.print(f"[red]错误: 表 '{table_name}' 没有版本历史[/red]")
        ctx.exit(1)
    
    console.print(f"[cyan]从 {len(versions)} 个版本重建血缘关系...[/cyan]")
    
    result = lineage_manager.rebuild_from_versions(
        table_name, 
        alias_manager,
        schema_analyzer,
        verbose
    )
    
    if result.get('success'):
        console.print(f"[green]✓ 血缘关系重建成功[/green]")
        console.print(f"  版本数: {result.get('version_count')}")
        console.print(f"  字段数: {result.get('field_count')}")
    else:
        console.print(f"[red]✗ 重建失败: {result.get('error', 'Unknown error')}[/red]")
        ctx.exit(1)

@cli.command('check-breaking')
@click.argument('table_name')
@click.option('--from-version', '-f', type=int, default=None, help='起始版本')
@click.option('--to-version', '-t', type=int, default=None, help='结束版本')
@click.option('--fail-on-breaking/--no-fail-on-breaking', default=False, help='发现破坏性变更时返回非零退出码')
@click.pass_context
def check_breaking(ctx, table_name, from_version, to_version, fail_on_breaking):
    """检查破坏性变更"""
    lineage_manager = ctx.obj['lineage_manager']
    storage = ctx.obj['storage']
    
    tables = storage.list_tables()
    if table_name not in tables:
        console.print(f"[red]错误: 表 '{table_name}' 不存在[/red]")
        ctx.exit(1)
    
    result = lineage_manager.identify_breaking_changes(table_name, from_version, to_version)
    
    breaking = result['breaking_changes']
    warnings = result['warnings']
    
    if breaking:
        console.print(f"[red]⚠ 发现 {len(breaking)} 个破坏性变更:[/red]")
        for i, change in enumerate(breaking, 1):
            console.print(f"  {i}. [red]{change['message']}[/red]")
            console.print(f"     来源: 版本 {change['source']['version']}")
    else:
        console.print("[green]✓ 没有发现破坏性变更[/green]")
    
    if warnings:
        console.print(f"\n[yellow]⚠ 发现 {len(warnings)} 个警告:[/yellow]")
        for i, warning in enumerate(warnings, 1):
            console.print(f"  {i}. [yellow]{warning['message']}[/yellow]")
    
    if fail_on_breaking and breaking:
        ctx.exit(1)

if __name__ == '__main__':
    cli()
