import json
import os
import sys
from datetime import datetime
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table

from .comparison_engine import ComparisonEngine
from .config_loader import load_config
from .difference_store import DifferenceStore
from .models import (
    CheckConfig,
    DifferenceStatus,
    EntityConfig,
    TenantFilter,
    TimeRange,
)
from .report_generator import ReportGenerator
from .snapshot_reader import SnapshotReader

console = Console()


def create_context(config_path: str, snapshot_dir: str, store_dir: str) -> dict:
    config = load_config(config_path)
    snapshot_reader = SnapshotReader(snapshot_dir)
    comparison_engine = ComparisonEngine(snapshot_reader)
    diff_store = DifferenceStore(store_dir)
    report_generator = ReportGenerator(comparison_engine)
    
    return {
        "config": config,
        "snapshot_reader": snapshot_reader,
        "comparison_engine": comparison_engine,
        "diff_store": diff_store,
        "report_generator": report_generator,
    }


def filter_entities(config: CheckConfig, entities: Optional[List[str]]) -> List[EntityConfig]:
    if not entities:
        return config.entities
    
    return [e for e in config.entities if e.name in entities]


def build_time_range(start_time: Optional[str], end_time: Optional[str], time_field: Optional[str]) -> Optional[TimeRange]:
    if not start_time and not end_time:
        return None
    
    start_dt = None
    if start_time:
        start_dt = datetime.fromisoformat(start_time)
    
    end_dt = None
    if end_time:
        end_dt = datetime.fromisoformat(end_time)
    
    return TimeRange(
        start_time=start_dt,
        end_time=end_dt,
        time_field=time_field or "created_at",
    )


def build_tenant_filter(tenant_ids: Optional[List[str]], tenant_field: Optional[str]) -> Optional[TenantFilter]:
    if not tenant_ids:
        return None
    
    return TenantFilter(
        tenant_ids=tenant_ids,
        tenant_field=tenant_field or "tenant_id",
    )


@click.group()
@click.option("--config", "-c", required=True, help="配置文件路径")
@click.option("--snapshot-dir", "-s", required=True, help="快照目录路径")
@click.option("--store-dir", "-d", default="./diff_store", help="差异数据存储目录")
@click.pass_context
def cli(ctx: click.Context, config: str, snapshot_dir: str, store_dir: str):
    ctx.obj = create_context(config, snapshot_dir, store_dir)


@cli.command("check")
@click.option("--entity", "-e", multiple=True, help="指定检查的实体（可多次指定）")
@click.option("--tenant", "-t", multiple=True, help="指定租户ID（可多次指定）")
@click.option("--tenant-field", default=None, help="租户字段名")
@click.option("--start-time", default=None, help="开始时间（ISO格式）")
@click.option("--end-time", default=None, help="结束时间（ISO格式）")
@click.option("--time-field", default=None, help="时间字段名")
@click.option("--no-save", is_flag=True, help="不保存差异到存储")
@click.pass_context
def check(
    ctx: click.Context,
    entity: List[str],
    tenant: List[str],
    tenant_field: Optional[str],
    start_time: Optional[str],
    end_time: Optional[str],
    time_field: Optional[str],
    no_save: bool,
):
    context = ctx.obj
    config: CheckConfig = context["config"]
    report_generator: ReportGenerator = context["report_generator"]
    diff_store: DifferenceStore = context["diff_store"]
    
    entities = filter_entities(config, list(entity) if entity else None)
    if not entities:
        console.print("[red]未找到匹配的实体配置[/red]")
        sys.exit(1)
    
    tenant_filter = build_tenant_filter(list(tenant) if tenant else None, tenant_field)
    time_range = build_time_range(start_time, end_time, time_field)
    
    console.print(f"[blue]开始检查...[/blue]")
    console.print(f"  实体: {', '.join(e.name for e in entities)}")
    if tenant_filter:
        console.print(f"  租户: {', '.join(tenant_filter.tenant_ids)}")
    if time_range:
        console.print(f"  时间范围: {time_range.start_time or '无限制'} ~ {time_range.end_time or '无限制'}")
    
    report = report_generator.generate_report(
        entities=entities,
        tenant_filter=tenant_filter,
        time_range=time_range,
    )
    
    if not no_save:
        total_diffs = 0
        for entity_report in report.entities:
            for diff in entity_report.sample_differences:
                diff_store.update_difference(diff)
            for diff_list in [
                [d for d in entity_report.sample_differences]
            ]:
                pass
            for diff_type in ["new_missing", "old_missing", "field_diffs", "mapping_diffs", "status_diffs", "amount_diffs", "duplicate_pks"]:
                pass
        
        diffs_to_save = []
        for entity_report in report.entities:
            comparison_engine: ComparisonEngine = context["comparison_engine"]
            entity_config = next(e for e in entities if e.name == entity_report.entity)
            differences, _ = comparison_engine.compare_entity(
                entity=entity_config,
                tenant_filter=tenant_filter,
                time_range=time_range,
            )
            diffs_to_save.extend(differences)
        
        diff_store.update_many(diffs_to_save)
        console.print(f"[green]已保存 {len(diffs_to_save)} 条差异到存储[/green]")
    
    _print_report_summary(report)


def _print_report_summary(report):
    console.print("\n[bold green]=== 检查报告 ===[/bold green]")
    console.print(f"检查时间: {report.check_time}")
    console.print(f"影响租户: {', '.join(report.affected_tenants) if report.affected_tenants else '无'}")
    console.print(f"总差异数: {report.total_differences}")
    
    table = Table(title="按类型汇总")
    table.add_column("差异类型", style="cyan")
    table.add_column("数量", style="magenta")
    
    type_mapping = {
        "new_missing": "新库缺失",
        "old_missing": "旧库缺失",
        "field_diffs": "字段差异",
        "mapping_diffs": "映射差异",
        "status_diffs": "状态不一致",
        "amount_diffs": "金额不一致",
        "duplicate_pks": "重复主键",
    }
    
    for key, label in type_mapping.items():
        table.add_row(label, str(report.summary.get(key, 0)))
    
    console.print(table)
    
    for entity_report in report.entities:
        console.print(f"\n[bold yellow]--- 实体: {entity_report.entity} ---[/bold yellow]")
        console.print(f"  检查记录数: {entity_report.total_checked}")
        console.print(f"  新库缺失: {entity_report.new_missing}")
        console.print(f"  旧库缺失: {entity_report.old_missing}")
        console.print(f"  字段差异: {entity_report.field_diffs}")
        console.print(f"  映射差异: {entity_report.mapping_diffs}")
        console.print(f"  状态不一致: {entity_report.status_diffs}")
        console.print(f"  金额不一致: {entity_report.amount_diffs}")
        console.print(f"  重复主键: {entity_report.duplicate_pks}")
        
        if entity_report.sample_differences:
            console.print(f"\n  [bold]示例差异 ({len(entity_report.sample_differences)} 条):[/bold]")
            for diff in entity_report.sample_differences:
                status_text = f"[{diff.status.value}]"
                if diff.status == DifferenceStatus.RECURRING:
                    status_text += f" (复发 x{diff.recurrence_count})"
                console.print(f"    - {diff.pk_value}: {diff.diff_type.value} {status_text}")
        
        if entity_report.suggestions:
            console.print(f"\n  [bold]补偿建议:[/bold]")
            for suggestion in entity_report.suggestions:
                frozen_text = " [red][已冻结][/red]" if suggestion.is_frozen else ""
                console.print(f"    - {suggestion.pk_value}: {suggestion.action.value} - {suggestion.reason}{frozen_text}")


@cli.command("sample")
@click.option("--entity", "-e", multiple=True, help="指定检查的实体（可多次指定）")
@click.option("--count", "-n", default=5, help="采样数量")
@click.option("--save/--no-save", default=False, help="是否保存差异")
@click.pass_context
def sample(ctx: click.Context, entity: List[str], count: int, save: bool):
    context = ctx.obj
    config: CheckConfig = context["config"]
    snapshot_reader: SnapshotReader = context["snapshot_reader"]
    comparison_engine: ComparisonEngine = context["comparison_engine"]
    diff_store: DifferenceStore = context["diff_store"]
    
    entities = filter_entities(config, list(entity) if entity else None)
    if not entities:
        console.print("[red]未找到匹配的实体配置[/red]")
        sys.exit(1)
    
    console.print(f"[blue]采样检查，每实体取 {count} 条记录[/blue]")
    
    for entity_config in entities:
        console.print(f"\n[bold yellow]--- 实体: {entity_config.name} ---[/bold yellow]")
        
        old_records = list(snapshot_reader.read_snapshot(entity_config, "old"))[:count]
        new_records = list(snapshot_reader.read_snapshot(entity_config, "new"))[:count]
        
        console.print(f"  旧库采样 {len(old_records)} 条")
        console.print(f"  新库采样 {len(new_records)} 条")
        
        differences, total_checked = comparison_engine.compare_entity(entity_config)
        console.print(f"  发现 {len(differences)} 条差异")
        
        if differences[:count]:
            for diff in differences[:count]:
                console.print(f"    - {diff.pk_value}: {diff.diff_type.value}")
        
        if save and differences:
            diff_store.update_many(differences[:count])
            console.print(f"  [green]已保存 {min(count, len(differences))} 条差异[/green]")


@cli.command("explain")
@click.argument("diff_id")
@click.pass_context
def explain(ctx: click.Context, diff_id: str):
    context = ctx.obj
    diff_store: DifferenceStore = context["diff_store"]
    config: CheckConfig = context["config"]
    report_generator: ReportGenerator = context["report_generator"]
    
    diff = diff_store.get_difference(diff_id)
    if not diff:
        console.print(f"[red]未找到差异: {diff_id}[/red]")
        sys.exit(1)
    
    entity_config = next((e for e in config.entities if e.name == diff.entity), None)
    explanation = report_generator.generate_diff_explanation(diff, entity_config)
    
    console.print(f"\n[bold green]=== 差异详情 ===[/bold green]")
    console.print(f"ID: {explanation['diff_id']}")
    console.print(f"实体: {explanation['entity']}")
    console.print(f"主键: {explanation['primary_key']} = {explanation['pk_value']}")
    console.print(f"类型: {explanation['diff_type']}")
    console.print(f"状态: {explanation['status']}")
    console.print(f"描述: {explanation['description']}")
    
    if explanation.get('tenant_id'):
        console.print(f"租户: {explanation['tenant_id']}")
    
    if explanation.get('recurrence_count', 0) > 0:
        console.print(f"[red]复发次数: {explanation['recurrence_count']}[/red]")
    
    if 'field_differences' in explanation:
        console.print("\n[bold]字段差异:[/bold]")
        table = Table()
        table.add_column("字段", style="cyan")
        table.add_column("旧值", style="yellow")
        table.add_column("新值", style="red")
        
        for fd in explanation['field_differences']:
            table.add_row(
                fd['field'],
                str(fd['old_value']),
                str(fd['new_value']),
            )
        console.print(table)
    
    if 'compensation_suggestion' in explanation:
        cs = explanation['compensation_suggestion']
        frozen_text = " [red][已冻结数据，禁止自动补偿][/red]" if cs['is_frozen'] else ""
        console.print(f"\n[bold]补偿建议:[/bold] {cs['action']} - {cs['reason']}{frozen_text}")
    
    if 'status_history' in explanation:
        sh = explanation['status_history']
        console.print("\n[bold]状态历史:[/bold]")
        if sh.get('first_seen_at'):
            console.print(f"  首次发现: {sh['first_seen_at']}")
        if sh.get('confirmed_at'):
            console.print(f"  人工确认: {sh['confirmed_at']}")
        if sh.get('fixed_at'):
            console.print(f"  标记修复: {sh['fixed_at']}")
        if sh.get('recurrence_count', 0) > 0:
            console.print(f"  [red]复发次数: {sh['recurrence_count']}[/red]")


@cli.command("mark-fixed")
@click.argument("diff_ids", nargs=-1)
@click.option("--all", is_flag=True, help="标记所有开放状态的差异")
@click.option("--notes", default=None, help="备注信息")
@click.pass_context
def mark_fixed(ctx: click.Context, diff_ids: List[str], all: bool, notes: Optional[str]):
    context = ctx.obj
    diff_store: DifferenceStore = context["diff_store"]
    
    if all:
        open_diffs = diff_store.get_all(status=DifferenceStatus.OPEN)
        diff_ids = [d.id for d in open_diffs]
        console.print(f"[blue]准备标记 {len(diff_ids)} 条开放状态差异为已修复[/blue]")
    elif not diff_ids:
        console.print("[red]请指定差异ID或使用 --all 选项[/red]")
        sys.exit(1)
    
    count = 0
    for diff_id in diff_ids:
        if diff_store.mark_fixed(diff_id, notes):
            count += 1
            console.print(f"[green]已标记: {diff_id}[/green]")
        else:
            console.print(f"[red]未找到: {diff_id}[/red]")
    
    console.print(f"\n[bold]共标记 {count} 条差异为已修复[/bold]")


@cli.command("confirm")
@click.argument("diff_id")
@click.option("--notes", default=None, help="备注信息")
@click.pass_context
def confirm(ctx: click.Context, diff_id: str, notes: Optional[str]):
    context = ctx.obj
    diff_store: DifferenceStore = context["diff_store"]
    
    if diff_store.confirm_difference(diff_id, notes):
        console.print(f"[green]已确认差异: {diff_id}[/green]")
    else:
        console.print(f"[red]未找到差异: {diff_id}[/red]")
        sys.exit(1)


@cli.command("report")
@click.option("--entity", "-e", multiple=True, help="指定实体（可多次指定）")
@click.option("--format", "-f", type=click.Choice(["table", "json"]), default="table", help="输出格式")
@click.option("--output", "-o", default=None, help="输出文件路径（仅JSON格式）")
@click.pass_context
def report(ctx: click.Context, entity: List[str], format: str, output: Optional[str]):
    context = ctx.obj
    diff_store: DifferenceStore = context["diff_store"]
    config: CheckConfig = context["config"]
    
    entities = filter_entities(config, list(entity) if entity else None)
    
    stats = diff_store.get_statistics()
    
    if format == "json":
        all_diffs = diff_store.get_all()
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "statistics": stats,
            "differences": [
                {
                    "id": d.id,
                    "entity": d.entity,
                    "pk_value": d.pk_value,
                    "diff_type": d.diff_type.value,
                    "status": d.status.value,
                    "tenant_id": d.tenant_id,
                    "recurrence_count": d.recurrence_count,
                }
                for d in all_diffs
            ],
        }
        
        if output:
            with open(output, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            console.print(f"[green]报告已保存到: {output}[/green]")
        else:
            console.print(json.dumps(report_data, indent=2, ensure_ascii=False))
    else:
        console.print(f"\n[bold green]=== 差异存储报告 ===[/bold green]")
        console.print(f"生成时间: {datetime.now()}")
        
        table = Table(title="状态统计")
        table.add_column("状态", style="cyan")
        table.add_column("数量", style="magenta")
        
        status_mapping = {
            "open": ("开放", "white"),
            "confirmed": ("已确认", "yellow"),
            "fixed": ("已修复", "green"),
            "recurring": ("复发", "red"),
        }
        
        for key, (label, style) in status_mapping.items():
            table.add_row(f"[{style}]{label}[/{style}]", str(stats.get(key, 0)))
        
        table.add_row("[bold]总计[/bold]", str(stats.get("total", 0)))
        console.print(table)
        
        recurring = diff_store.get_recurring()
        if recurring:
            console.print(f"\n[bold red]--- 复发差异 ({len(recurring)} 条) ---[/bold red]")
            for diff in recurring:
                console.print(f"  - {diff.entity}:{diff.pk_value} (复发 x{diff.recurrence_count})")


def main():
    cli()


if __name__ == "__main__":
    main()
