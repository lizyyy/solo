import json
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
from pathlib import Path

import core

console = Console()


@click.group()
def cli():
    """异常交易规则蒸馏评测工具"""
    core.initialize()


@cli.command()
def init():
    """初始化数据库"""
    core.initialize()
    console.print("[green]✓[/green] 数据库初始化完成")


@cli.group()
def import_data():
    """导入数据"""
    pass


@import_data.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--source-type', default='file', help='来源类型')
def samples(file_path, source_type):
    """导入样本数据"""
    ids = core.import_samples_from_file(file_path, source_type)
    console.print(f"[green]✓[/green] 成功导入 {len(ids)} 个样本")
    for sid in ids[:5]:
        console.print(f"  - {sid}")
    if len(ids) > 5:
        console.print(f"  ... 还有 {len(ids) - 5} 个")


@import_data.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.argument('model_version')
@click.option('--description', help='版本描述')
def model_outputs(file_path, model_version, description):
    """导入模型输出结果"""
    core.import_model_outputs(file_path, model_version, description)
    console.print(f"[green]✓[/green] 成功导入模型输出 (版本: {model_version})")


@import_data.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--model-version', help='模型版本')
@click.option('--created-by', default='system', help='创建人')
def thresholds(file_path, model_version, created_by):
    """导入阈值配置"""
    core.import_thresholds(file_path, model_version, created_by)
    console.print(f"[green]✓[/green] 成功导入阈值配置")


@cli.command()
@click.argument('model_version')
@click.option('--rule-type', default='异常交易', help='规则类型')
def distill(model_version, rule_type):
    """批量蒸馏规则"""
    ids = core.batch_distill_rules(model_version, rule_type)
    console.print(f"[green]✓[/green] 成功蒸馏 {len(ids)} 条规则")
    for did in ids[:3]:
        console.print(f"  - {did}")
    if len(ids) > 3:
        console.print(f"  ... 还有 {len(ids) - 3} 条")


@cli.command()
@click.argument('distillation_id')
@click.argument('reviewer')
@click.argument('review_result', type=click.Choice(['通过', '不通过', '需要修改']))
@click.option('--comment', help='复核意见')
@click.option('--corrected-rule', help='修正后的规则')
def review(distillation_id, reviewer, review_result, comment, corrected_rule):
    """对蒸馏规则进行人工复核"""
    core.add_review(distillation_id, reviewer, review_result, comment, corrected_rule)
    console.print(f"[green]✓[/green] 复核完成: {review_result}")


@cli.command()
@click.argument('distillation_id')
@click.argument('note_content')
@click.option('--created-by', required=True, help='添加人')
def add_note(distillation_id, note_content, created_by):
    """为蒸馏规则添加备注"""
    core.add_note(distillation_id, note_content, created_by)
    console.print(f"[green]✓[/green] 备注已添加")


@cli.command()
@click.argument('distillation_id')
@click.option('--output', '-o', help='导出到文件')
def trace(distillation_id, output):
    """查看蒸馏规则的完整溯源信息"""
    trace_data = core.get_distillation_trace(distillation_id)
    
    if not trace_data.get('rule'):
        console.print(f"[red]✗[/red] 未找到规则: {distillation_id}")
        return
    
    rule = trace_data['rule']
    sample = trace_data.get('sample')
    notes = trace_data.get('notes', [])
    reviews = trace_data.get('reviews', [])
    
    console.print(Panel.fit(f"[bold blue]规则溯源: {distillation_id}[/bold blue]"))
    
    table = Table(show_header=False, box=None)
    table.add_row("规则ID:", rule['distillation_id'])
    table.add_row("样本ID:", rule['sample_id'])
    table.add_row("模型版本:", rule['model_version'])
    table.add_row("规则类型:", rule['rule_type'] or '-')
    table.add_row("置信度:", str(rule['confidence']) if rule['confidence'] else '-')
    table.add_row("创建时间:", rule['created_at'])
    table.add_row("引用缺失:", "是" if rule['has_missing_reference'] else "否")
    console.print(table)
    
    console.print("\n[bold]规则内容:[/bold]")
    console.print(rule['rule_content'])
    
    if rule.get('evidence_snippets'):
        console.print("\n[bold]证据来源:[/bold]")
        for idx, snippet in enumerate(rule['evidence_snippets'], 1):
            console.print(f"  {idx}. {snippet}")
    
    if reviews:
        console.print("\n[bold]复核记录:[/bold]")
        for r in reviews:
            console.print(f"  [{r['reviewed_at']}] {r['reviewer']}: {r['review_result']}")
            if r['review_comment']:
                console.print(f"    意见: {r['review_comment']}")
            if r['corrected_rule']:
                console.print(f"    修正: {r['corrected_rule']}")
    
    if notes:
        console.print("\n[bold]备注信息:[/bold]")
        for n in notes:
            console.print(f"  [{n['created_at']}] {n['created_by']}: {n['note_content']}")
    
    if sample:
        console.print("\n[bold]样本信息:[/bold]")
        console.print(f"  来源文件: {sample.get('source_file', '-')}")
        console.print(f"  来源类型: {sample.get('source_type', '-')}")
        console.print(f"  采集时间: {sample.get('created_at', '-')}")
    
    if output:
        core.export_distillation(distillation_id, output)
        console.print(f"\n[green]✓[/green] 溯源信息已导出到: {output}")


@cli.command()
@click.argument('model_version')
@click.option('--report-name', help='报告名称')
@click.option('--created-by', default='system', help='创建人')
def report(model_version, report_name, created_by):
    """生成评测报告"""
    report_id = core.generate_report(model_version, report_name, created_by)
    console.print(f"[green]✓[/green] 报告已生成: {report_id}")


@cli.command()
@click.argument('report_id')
@click.argument('output_path', type=click.Path())
def export_report(report_id, output_path):
    """导出报告到文件"""
    core.export_report(report_id, output_path)
    console.print(f"[green]✓[/green] 报告已导出到: {output_path}")


@cli.command()
@click.argument('base_version')
@click.argument('target_version')
def compare(base_version, target_version):
    """对比两个版本的差异"""
    result = core.compare_versions(base_version, target_version)
    
    console.print(Panel.fit(f"[bold blue]版本对比: {base_version} → {target_version}[/bold blue]"))
    
    console.print("\n[bold]指标变化:[/bold]")
    table = Table()
    table.add_column("指标")
    table.add_column(f"{base_version}", justify="right")
    table.add_column(f"{target_version}", justify="right")
    table.add_column("变化", justify="right")
    
    metrics = result['metric_changes']
    for key, val in metrics.items():
        change = f"{val['change_pct']:+.2f}%" if val['change_pct'] is not None else "-"
        table.add_row(key, str(val['base']), str(val['target']), change)
    
    console.print(table)
    
    samples = result['sample_changes']
    console.print(f"\n[bold]样本变化:[/bold]")
    console.print(f"  新增样本: {len(samples['new_samples'])} 个")
    console.print(f"  移除样本: {len(samples['removed_samples'])} 个")
    console.print(f"  共有样本: {len(samples['common_samples'])} 个")
    
    if samples['new_samples']:
        console.print(f"\n[bold]新增样本列表:[/bold]")
        for s in samples['new_samples'][:5]:
            console.print(f"  - {s}")
        if len(samples['new_samples']) > 5:
            console.print(f"  ... 还有 {len(samples['new_samples']) - 5} 个")


@cli.group()
def list_data():
    """查看数据列表"""
    pass


@list_data.command()
def versions():
    """查看所有模型版本"""
    versions = core.get_all_versions()
    if not versions:
        console.print("[yellow]暂无版本数据[/yellow]")
        return
    
    table = Table(title="模型版本列表")
    table.add_column("#", justify="right")
    table.add_column("版本号")
    for idx, v in enumerate(versions, 1):
        table.add_row(str(idx), v)
    console.print(table)


@list_data.command()
def reports():
    """查看所有报告"""
    reports = core.get_all_reports()
    if not reports:
        console.print("[yellow]暂无报告[/yellow]")
        return
    
    table = Table(title="报告列表")
    table.add_column("#", justify="right")
    table.add_column("报告ID")
    table.add_column("报告名称")
    table.add_column("模型版本")
    table.add_column("创建时间")
    for idx, r in enumerate(reports, 1):
        table.add_row(str(idx), r['report_id'], r['report_name'], 
                      r['model_version'], r['created_at'])
    console.print(table)


@list_data.command()
@click.option('--model-version', help='按版本筛选')
@click.option('--limit', default=20, help='显示数量')
def rules(model_version, limit):
    """查看蒸馏规则列表"""
    rules = core.get_all_distillations(model_version)
    if not rules:
        console.print("[yellow]暂无规则数据[/yellow]")
        return
    
    table = Table(title=f"蒸馏规则列表 (共{len(rules)}条)")
    table.add_column("#", justify="right")
    table.add_column("规则ID")
    table.add_column("样本ID")
    table.add_column("模型版本")
    table.add_column("有引用")
    table.add_column("置信度")
    
    for idx, r in enumerate(rules[:limit], 1):
        has_ref = "[green]✓[/green]" if not r['has_missing_reference'] else "[red]✗[/red]"
        conf = f"{r['confidence']:.2f}" if r['confidence'] else "-"
        table.add_row(str(idx), r['distillation_id'], r['sample_id'],
                      r['model_version'], has_ref, conf)
    
    console.print(table)
    if len(rules) > limit:
        console.print(f"\n... 还有 {len(rules) - limit} 条规则未显示")


@list_data.command()
@click.option('--model-version', help='按版本筛选')
def thresholds(model_version):
    """查看阈值配置"""
    thresholds = core.get_all_thresholds(model_version)
    if not thresholds:
        console.print("[yellow]暂无阈值配置[/yellow]")
        return
    
    table = Table(title="阈值配置列表")
    table.add_column("#", justify="right")
    table.add_column("规则名称")
    table.add_column("阈值")
    table.add_column("比较类型")
    table.add_column("版本")
    table.add_column("描述")
    
    for idx, t in enumerate(thresholds, 1):
        table.add_row(str(idx), t['rule_name'], str(t['threshold_value']),
                      t['comparison_type'], t.get('model_version', '-'),
                      t.get('description', '-'))
    
    console.print(table)


if __name__ == '__main__':
    cli()
