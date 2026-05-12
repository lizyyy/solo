import click
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from pathlib import Path
import json
from uuid import uuid4

from .models import (
    ProjectState,
    SliceStatus,
    SliceType,
    ImportStatus,
    AuditAction,
    AuditLog,
    ImportRecord,
    TimelineSegment,
    Subtitle,
    Product,
    Violation,
)
from .storage import Storage
from .slicer import generate_slices, validate_slices, check_slice_status
from .samples import get_sample_data


console = Console()


@click.group()
@click.pass_context
def cli(ctx):
    """直播回放切片工具 - 按话题、违规片段、商品讲解和字幕时间轴切片归档"""
    ctx.ensure_object(dict)
    ctx.obj["cwd"] = str(Path.cwd())


@cli.command()
@click.argument("name")
@click.option("--sample", type=click.Choice(["beauty", "food", "fashion"]), help="使用内置样例数据")
@click.option("--subtitle-offset", type=float, default=0.0, help="字幕时间偏移量（秒）")
@click.pass_context
def init(ctx, name, sample, subtitle_offset):
    """初始化一个新的直播回放切片项目"""
    cwd = ctx.obj["cwd"]
    
    if Storage.project_exists(cwd):
        console.print(Panel(Text("项目已存在！使用 liveslice status 查看项目状态", style="bold yellow")))
        return

    state = ProjectState(
        project_name=name,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        subtitle_offset=subtitle_offset,
    )
    Storage.save_project(state, cwd)
    
    log = AuditLog(
        id=str(uuid4()),
        action=AuditAction.CREATE,
        entity_type="project",
        entity_id=name,
        before=None,
        after={"project_name": name, "subtitle_offset": subtitle_offset},
        operator="system",
        reason="初始化项目",
    )
    state.audit_logs.append(log)
    
    if sample:
        sample_data = get_sample_data(sample)
        state.timeline_segments = sample_data["timeline_segments"]
        state.subtitles = sample_data["subtitles"]
        state.products = sample_data["products"]
        state.violations = sample_data["violations"]
        state.subtitle_offset = sample_data.get("subtitle_offset", subtitle_offset)
        Storage.save_project(state, cwd)
        console.print(Panel(Text(f"项目 '{name}' 初始化成功，已加载 [{sample}] 样例数据", style="bold green")))
    else:
        console.print(Panel(Text(f"项目 '{name}' 初始化成功", style="bold green")))


@cli.group("import")
def import_cmd():
    """导入各类数据到当前项目"""
    pass


@import_cmd.command("timeline")
@click.argument("file_path", type=click.Path(exists=True))
@click.pass_context
def import_timeline(ctx, file_path):
    """导入回放时间轴数据 (JSON格式)"""
    _import_data(ctx, file_path, "timeline")


@import_cmd.command("subtitles")
@click.argument("file_path", type=click.Path(exists=True))
@click.pass_context
def import_subtitles(ctx, file_path):
    """导入字幕数据 (JSON/SRT格式)"""
    _import_data(ctx, file_path, "subtitles")


@import_cmd.command("products")
@click.argument("file_path", type=click.Path(exists=True))
@click.pass_context
def import_products(ctx, file_path):
    """导入商品上架记录 (JSON格式)"""
    _import_data(ctx, file_path, "products")


@import_cmd.command("violations")
@click.argument("file_path", type=click.Path(exists=True))
@click.pass_context
def import_violations(ctx, file_path):
    """导入违规标记数据 (JSON格式)"""
    _import_data(ctx, file_path, "violations")


def _import_data(ctx, file_path, data_type):
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("项目不存在！请先使用 liveslice init 初始化项目", style="bold red")))
        return

    state = Storage.load_project(cwd)
    record_id = str(uuid4())
    record = ImportRecord(
        id=record_id,
        data_type=data_type,
        file_path=file_path,
        status=ImportStatus.PROCESSING,
    )
    state.import_records.append(record)
    Storage.save_project(state, cwd)
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        count = 0
        if data_type == "timeline":
            for item in data:
                state.timeline_segments.append(TimelineSegment(**item))
                count += 1
        elif data_type == "subtitles":
            for item in data:
                state.subtitles.append(Subtitle(**item))
                count += 1
        elif data_type == "products":
            for item in data:
                existing = [p for p in state.products if p.product_id == item.get("product_id")]
                if existing:
                    continue
                state.products.append(Product(**item))
                count += 1
        elif data_type == "violations":
            for item in data:
                existing = [v for v in state.violations if v.id == item.get("id")]
                if existing:
                    continue
                state.violations.append(Violation(**item))
                count += 1
        
        record.status = ImportStatus.SUCCESS
        record.record_count = count
        record.completed_at = datetime.now()
        state.updated_at = datetime.now()
        
        log = AuditLog(
            id=str(uuid4()),
            action=AuditAction.IMPORT,
            entity_type=data_type,
            entity_id=record_id,
            before=None,
            after={"file": file_path, "count": count},
            operator="cli",
            reason=f"导入{data_type}数据",
        )
        state.audit_logs.append(log)
        Storage.save_project(state, cwd)
        
        console.print(Panel(Text(f"成功导入 {count} 条 {data_type} 数据", style="bold green")))
    except Exception as e:
        record.status = ImportStatus.FAILED
        record.error_message = str(e)
        record.completed_at = datetime.now()
        
        log = AuditLog(
            id=str(uuid4()),
            action=AuditAction.UPDATE,
            entity_type=data_type,
            entity_id=record_id,
            before=None,
            after={"file": file_path, "error": str(e)},
            operator="cli",
            reason=f"导入{data_type}数据失败",
        )
        state.audit_logs.append(log)
        Storage.save_project(state, cwd)
        console.print(Panel(Text(f"导入失败: {e}", style="bold red")))


@cli.command()
@click.pass_context
def check(ctx):
    """生成并检查切片，验证业务规则"""
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("项目不存在！请先使用 liveslice init 初始化项目", style="bold red")))
        return

    state = Storage.load_project(cwd)
    
    new_slices = generate_slices(state)
    
    existing_ids = {s.slice_id for s in state.slices}
    for s in new_slices:
        if s.slice_id not in existing_ids:
            state.slices.append(s)
    
    errors = validate_slices(state, state.slices)
    check_slice_status(state, state.slices)
    state.updated_at = datetime.now()
    
    for p in state.products:
        state.processed_products.add(p.product_id)
    
    Storage.save_project(state, cwd)
    
    status_table = Table(title="切片状态汇总")
    status_table.add_column("状态", style="cyan")
    status_table.add_column("数量", style="green")
    
    counts = {status: 0 for status in SliceStatus}
    for s in state.slices:
        counts[s.status] += 1
    
    for status, count in counts.items():
        if count > 0:
            status_table.add_row(status.value, str(count))
    
    console.print(status_table)
    
    if errors:
        error_panel = Panel(Text("\n".join(errors), style="red"), title="验证错误")
        console.print(error_panel)
    
    if any(s.status == SliceStatus.REVIEW_NEEDED for s in state.slices):
        review_count = sum(1 for s in state.slices if s.status == SliceStatus.REVIEW_NEEDED)
        console.print(Panel(Text(f"发现 {review_count} 个需要人工复查的重叠切片", style="bold yellow"), title="复查提示"))


@cli.command("detail")
@click.option("--slice-id", help="查看特定切片详情")
@click.option("--type", "slice_type", type=click.Choice(["product", "violation", "topic"]), help="按类型筛选")
@click.option("--status", type=click.Choice([s.value for s in SliceStatus]), help="按状态筛选")
@click.pass_context
def detail(ctx, slice_id, slice_type, status):
    """查看切片详情和历史记录"""
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("项目不存在！请先使用 liveslice init 初始化项目", style="bold red")))
        return

    state = Storage.load_project(cwd)
    
    if slice_id:
        _show_slice_detail(state, slice_id)
        return
    
    slices = state.slices
    if slice_type:
        slices = [s for s in slices if s.slice_type.value == slice_type]
    if status:
        slices = [s for s in slices if s.status.value == status]
    
    if not slices:
        console.print(Panel(Text("没有找到匹配的切片", style="yellow")))
        return
    
    table = Table(title="切片列表")
    table.add_column("切片ID", style="cyan", no_wrap=True)
    table.add_column("类型", style="magenta")
    table.add_column("标题", style="green")
    table.add_column("开始时间", style="blue")
    table.add_column("时长(s)", style="yellow")
    table.add_column("状态", style="bold")
    
    for s in slices:
        status_style = _get_status_style(s.status)
        table.add_row(
            s.slice_id,
            s.slice_type.value,
            s.title,
            f"{s.start_time:.2f}",
            f"{s.duration:.1f}",
            Text(s.status.value, style=status_style),
        )
    
    console.print(table)


def _show_slice_detail(state, slice_id):
    slice_obj = next((s for s in state.slices if s.slice_id == slice_id), None)
    if not slice_obj:
        console.print(Panel(Text(f"未找到切片: {slice_id}", style="bold red")))
        return
    
    console.print(Panel.fit(
        f"[cyan]标题:[/cyan] {slice_obj.title}\n"
        f"[cyan]类型:[/cyan] {slice_obj.slice_type.value}\n"
        f"[cyan]开始时间:[/cyan] {slice_obj.start_time:.2f}s\n"
        f"[cyan]结束时间:[/cyan] {slice_obj.end_time:.2f}s\n"
        f"[cyan]时长:[/cyan] {slice_obj.duration:.1f}s\n"
        f"[cyan]状态:[/cyan] {slice_obj.status.value}\n"
        f"[cyan]商品ID:[/cyan] {slice_obj.product_id or '-'}\n"
        f"[cyan]违规ID:[/cyan] {slice_obj.violation_id or '-'}\n"
        f"[cyan]字幕数:[/cyan] {len(slice_obj.subtitle_ids)}\n"
        f"[cyan]重叠切片:[/cyan] {', '.join(slice_obj.overlapping_slices) or '无'}",
        title=f"切片详情: {slice_id}"
    ))
    
    if slice_obj.subtitle_ids:
        subtitle_table = Table(title="相关字幕")
        subtitle_table.add_column("字幕ID", style="cyan")
        subtitle_table.add_column("开始", style="green")
        subtitle_table.add_column("文本", style="white", overflow="fold")
        
        for sub_id in slice_obj.subtitle_ids:
            sub = next((s for s in state.subtitles if s.id == sub_id), None)
            if sub:
                subtitle_table.add_row(sub.id, f"{sub.start_time:.2f}s", sub.text)
        console.print(subtitle_table)


def _get_status_style(status):
    mapping = {
        SliceStatus.PENDING: "yellow",
        SliceStatus.CHECKING: "blue",
        SliceStatus.READY: "green",
        SliceStatus.EXPORTED: "bright_green",
        SliceStatus.FAILED: "red",
        SliceStatus.REVIEW_NEEDED: "bold yellow",
    }
    return mapping.get(status, "white")


@cli.command()
@click.option("--type", "report_type", type=click.Choice(["summary", "products", "reviews", "history"]), 
              default="summary", help="报告类型")
@click.pass_context
def report(ctx, report_type):
    """生成业务报告 - 商品讲解时长、待复查片段、切片索引"""
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("项目不存在！请先使用 liveslice init 初始化项目", style="bold red")))
        return

    state = Storage.load_project(cwd)
    
    if report_type == "summary":
        _report_summary(state)
    elif report_type == "products":
        _report_products(state)
    elif report_type == "reviews":
        _report_reviews(state)
    elif report_type == "history":
        _report_history(state)


def _report_summary(state):
    total_duration = sum(s.duration for s in state.slices if s.status not in (SliceStatus.FAILED,))
    product_duration = sum(s.duration for s in state.slices if s.slice_type == SliceType.PRODUCT)
    violation_duration = sum(s.duration for s in state.slices if s.slice_type == SliceType.VIOLATION)
    topic_duration = sum(s.duration for s in state.slices if s.slice_type == SliceType.TOPIC)
    
    review_count = sum(1 for s in state.slices if s.status == SliceStatus.REVIEW_NEEDED)
    ready_count = sum(1 for s in state.slices if s.status == SliceStatus.READY)
    exported_count = sum(1 for s in state.slices if s.status == SliceStatus.EXPORTED)
    
    console.print(Panel.fit(
        f"[bold green]项目:[/bold green] {state.project_name}\n"
        f"[bold green]创建时间:[/bold green] {state.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"[bold green]字幕偏移:[/bold green] {state.subtitle_offset}s\n\n"
        f"[bold cyan]=== 数据统计 ===[/bold cyan]\n"
        f"时间轴片段: {len(state.timeline_segments)} 个\n"
        f"字幕条数: {len(state.subtitles)} 条\n"
        f"商品记录: {len(state.products)} 个\n"
        f"违规标记: {len(state.violations)} 个\n\n"
        f"[bold cyan]=== 切片时长汇总 ===[/bold cyan]\n"
        f"商品讲解: {product_duration/60:.1f} 分钟\n"
        f"违规片段: {violation_duration/60:.1f} 分钟\n"
        f"话题片段: {topic_duration/60:.1f} 分钟\n"
        f"总有效时长: {total_duration/60:.1f} 分钟\n\n"
        f"[bold cyan]=== 状态分布 ===[/bold cyan]\n"
        f"[green]可导出:[/green] {ready_count}\n"
        f"[bright_green]已导出:[/bright_green] {exported_count}\n"
        f"[yellow]待复查:[/yellow] {review_count}",
        title="项目概览报告"
    ))


def _report_products(state):
    products = [s for s in state.slices if s.slice_type == SliceType.PRODUCT]
    if not products:
        console.print(Panel(Text("没有商品讲解切片", style="yellow")))
        return
    
    table = Table(title="商品讲解时长报告")
    table.add_column("商品ID", style="cyan")
    table.add_column("商品名称", style="green")
    table.add_column("开始时间", style="blue")
    table.add_column("时长(秒)", style="yellow")
    table.add_column("时长(分钟)", style="magenta")
    table.add_column("状态", style="bold")
    
    total_seconds = 0
    for p in products:
        status_style = _get_status_style(p.status)
        total_seconds += p.duration
        table.add_row(
            p.product_id or "-",
            p.product_name or "-",
            f"{p.start_time:.2f}",
            f"{p.duration:.1f}",
            f"{p.duration/60:.2f}",
            Text(p.status.value, style=status_style),
        )
    
    console.print(table)
    console.print(Panel.fit(
        f"[bold]商品切片总数:[/bold] {len(products)}\n"
        f"[bold]总讲解时长:[/bold] {total_seconds:.1f} 秒 ({total_seconds/60:.2f} 分钟)",
        title="商品汇总"
    ))


def _report_reviews(state):
    reviews = [s for s in state.slices if s.status == SliceStatus.REVIEW_NEEDED]
    if not reviews:
        console.print(Panel(Text("没有需要复查的切片", style="green")))
        return
    
    table = Table(title="待复查切片报告")
    table.add_column("切片ID", style="cyan")
    table.add_column("类型", style="magenta")
    table.add_column("标题", style="green")
    table.add_column("重叠切片", style="red")
    
    for s in reviews:
        overlap_info = ", ".join(s.overlapping_slices) if s.overlapping_slices else "未知"
        table.add_row(s.slice_id, s.slice_type.value, s.title, overlap_info)
    
    console.print(table)
    console.print(Panel(Text(f"总共有 {len(reviews)} 个切片需要人工复查", style="bold yellow")))


def _report_history(state):
    if not state.audit_logs:
        console.print(Panel(Text("没有操作历史", style="yellow")))
        return
    
    table = Table(title="操作历史")
    table.add_column("时间", style="cyan")
    table.add_column("操作", style="magenta")
    table.add_column("实体类型", style="green")
    table.add_column("操作者", style="blue")
    table.add_column("原因", style="white")
    
    for log in sorted(state.audit_logs, key=lambda x: x.timestamp, reverse=True)[:20]:
        table.add_row(
            log.timestamp.strftime("%H:%M:%S"),
            log.action.value,
            log.entity_type,
            log.operator,
            log.reason or "-",
        )
    
    console.print(table)
    
    if len(state.import_records) > 0:
        import_table = Table(title="导入记录")
        import_table.add_column("时间", style="cyan")
        import_table.add_column("类型", style="magenta")
        import_table.add_column("文件", style="green")
        import_table.add_column("状态", style="bold")
        import_table.add_column("数量", style="blue")
        import_table.add_column("错误", style="red")
        
        for rec in sorted(state.import_records, key=lambda x: x.created_at, reverse=True)[:10]:
            status_style = "green" if rec.status == ImportStatus.SUCCESS else "red"
            import_table.add_row(
                rec.created_at.strftime("%H:%M:%S"),
                rec.data_type,
                Path(rec.file_path).name,
                Text(rec.status.value, style=status_style),
                str(rec.record_count),
                rec.error_message or "-",
            )
        console.print(import_table)


@cli.command()
@click.argument("slice_id")
@click.option("--operator", required=True, help="操作者名称")
@click.option("--reason", required=True, help="修正原因")
@click.option("--start-time", type=float, help="新的开始时间")
@click.option("--end-time", type=float, help="新的结束时间")
@click.option("--title", help="新的标题")
@click.pass_context
def correct(ctx, slice_id, operator, reason, start_time, end_time, title):
    """人工修正切片 - 记录前后差异和操作者"""
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("项目不存在！请先使用 liveslice init 初始化项目", style="bold red")))
        return

    state = Storage.load_project(cwd)
    slice_obj = next((s for s in state.slices if s.slice_id == slice_id), None)
    
    if not slice_obj:
        console.print(Panel(Text(f"未找到切片: {slice_id}", style="bold red")))
        return
    
    before = {
        "start_time": slice_obj.start_time,
        "end_time": slice_obj.end_time,
        "duration": slice_obj.duration,
        "title": slice_obj.title,
        "status": slice_obj.status.value,
    }
    
    if start_time is not None:
        slice_obj.start_time = start_time
    if end_time is not None:
        slice_obj.end_time = end_time
    if title is not None:
        slice_obj.title = title
    
    if start_time is not None or end_time is not None:
        slice_obj.duration = slice_obj.end_time - slice_obj.start_time
    
    slice_obj.status = SliceStatus.READY
    slice_obj.updated_at = datetime.now()
    
    after = {
        "start_time": slice_obj.start_time,
        "end_time": slice_obj.end_time,
        "duration": slice_obj.duration,
        "title": slice_obj.title,
        "status": slice_obj.status.value,
    }
    
    log = AuditLog(
        id=str(uuid4()),
        action=AuditAction.CORRECT,
        entity_type="slice",
        entity_id=slice_id,
        before=before,
        after=after,
        operator=operator,
        reason=reason,
    )
    state.audit_logs.append(log)
    state.updated_at = datetime.now()
    Storage.save_project(state, cwd)
    
    diff = []
    for key in before:
        if before[key] != after[key]:
            diff.append(f"  {key}: {before[key]} -> {after[key]}")
    
    console.print(Panel.fit(
        f"[bold green]修正成功[/bold green]\n"
        f"切片ID: {slice_id}\n"
        f"操作者: {operator}\n"
        f"原因: {reason}\n\n"
        f"[bold cyan]变更内容:[/bold cyan]\n" + "\n".join(diff),
        title="人工修正记录"
    ))


@cli.command()
@click.argument("slice_id")
@click.option("--output-dir", type=click.Path(), default="./slices", help="输出目录")
@click.pass_context
def export(ctx, slice_id, output_dir):
    """导出切片文件（幂等操作）"""
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("项目不存在！请先使用 liveslice init 初始化项目", style="bold red")))
        return

    state = Storage.load_project(cwd)
    slice_obj = next((s for s in state.slices if s.slice_id == slice_id), None)
    
    if not slice_obj:
        console.print(Panel(Text(f"未找到切片: {slice_id}", style="bold red")))
        return
    
    if slice_obj.slice_id in state.exported_slices:
        console.print(Panel(Text(f"切片已导出: {slice_obj.export_path}", style="bold yellow"), title="幂等提示"))
        return
    
    if slice_obj.status not in (SliceStatus.READY, SliceStatus.EXPORTED):
        console.print(Panel(Text(f"切片状态不可导出: {slice_obj.status.value}", style="bold red")))
        return
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    filename = f"{slice_obj.slice_type.value}_{slice_obj.slice_id}.json"
    full_path = output_path / filename
    
    export_data = {
        "slice_id": slice_obj.slice_id,
        "slice_type": slice_obj.slice_type.value,
        "start_time": slice_obj.start_time,
        "end_time": slice_obj.end_time,
        "duration": slice_obj.duration,
        "title": slice_obj.title,
        "product_id": slice_obj.product_id,
        "violation_id": slice_obj.violation_id,
        "subtitle_ids": slice_obj.subtitle_ids,
        "exported_at": datetime.now().isoformat(),
    }
    
    with open(full_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    
    slice_obj.export_path = str(full_path)
    slice_obj.export_time = datetime.now()
    slice_obj.status = SliceStatus.EXPORTED
    slice_obj.updated_at = datetime.now()
    state.exported_slices.add(slice_obj.slice_id)
    state.updated_at = datetime.now()
    
    log = AuditLog(
        id=str(uuid4()),
        action=AuditAction.UPDATE,
        entity_type="slice",
        entity_id=slice_id,
        before={"status": "READY", "export_path": None},
        after={"status": "EXPORTED", "export_path": str(full_path)},
        operator="cli",
        reason="导出切片",
    )
    state.audit_logs.append(log)
    Storage.save_project(state, cwd)
    
    console.print(Panel(Text(f"导出成功: {full_path}", style="bold green")))


@cli.command()
@click.pass_context
def status(ctx):
    """查看当前项目状态"""
    cwd = ctx.obj["cwd"]
    if not Storage.project_exists(cwd):
        console.print(Panel(Text("当前目录没有项目，使用 liveslice init 初始化", style="yellow")))
        return

    state = Storage.load_project(cwd)
    _report_summary(state)


if __name__ == "__main__":
    cli()
