import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint

from . import __version__
from .storage import Storage
from .models import (
    ProjectState,
    SampleStatus,
    ResponsibilitySegment,
    CorrectionHistory,
)
from .importers import (
    SampleImporter,
    BoxImporter,
    HandoverImporter,
    TemperatureImporter,
)
from .rules import RuleEngine, StatusDeterminator
from . import examples

console = Console()


def get_project_dir(ctx: click.Context) -> Path:
    project_dir = ctx.obj.get("project_dir") if ctx.obj else None
    if not project_dir:
        project_dir = Path(os.environ.get("COLD_CHAIN_PROJECT", "."))
    return Path(project_dir).resolve()


def load_state(ctx: click.Context) -> ProjectState:
    project_dir = get_project_dir(ctx)
    storage = Storage(project_dir)
    if not storage.exists():
        console.print(f"[red]错误：项目未初始化。请先运行 'cold-chain init'[/red]")
        sys.exit(1)
    return storage.load_state()


def save_state(ctx: click.Context, state: ProjectState) -> None:
    project_dir = get_project_dir(ctx)
    storage = Storage(project_dir)
    storage.save_state(state)


def print_header(title: str):
    rprint(Panel(f"[bold cyan]{title}[/bold cyan]", expand=False))


def print_summary(state: ProjectState):
    table = Table(title="项目摘要", show_header=True, header_style="bold magenta")
    table.add_column("项目", style="dim")
    table.add_column("数值", justify="right")
    table.add_row("样本数", str(len(state.samples)))
    table.add_row("箱子数", str(len(state.boxes)))
    table.add_row("交接记录", str(len(state.handover_records)))
    table.add_row("温度记录", str(len(state.temperature_records)))
    table.add_row("规则违规", str(len(state.violations)))
    table.add_row("人工修正", str(len(state.corrections)))
    table.add_row("数据版本", str(state.version))
    console.print(table)


@click.group()
@click.version_option(__version__)
@click.option(
    "--project", "-p",
    type=click.Path(),
    default=".",
    help="项目目录路径 (默认当前目录)",
    envvar="COLD_CHAIN_PROJECT",
)
@click.pass_context
def cli(ctx: click.Context, project: str):
    """实验样本冷链交接 CLI 工具

    用于管理实验样本从采集点到实验室的冷链交接流程，
    记录温度、交接人、箱号和异常处置信息。
    """
    ctx.ensure_object(dict)
    ctx.obj["project_dir"] = Path(project).resolve()


@cli.command()
@click.argument("name", default="cold-chain-project")
@click.option("--force", "-f", is_flag=True, help="覆盖已存在的项目")
@click.pass_context
def init(ctx: click.Context, name: str, force: bool):
    """初始化新项目

    NAME: 项目名称
    """
    project_dir = get_project_dir(ctx)
    storage = Storage(project_dir)

    if storage.exists() and not force:
        console.print(f"[yellow]项目已存在于 {project_dir}。使用 --force 覆盖。[/yellow]")
        return

    print_header(f"初始化项目: {name}")

    state = storage.initialize(name)
    console.print(f"[green]项目已创建: {project_dir}[/green]")
    print_summary(state)


@cli.command()
@click.argument("category", type=click.Choice(["samples", "boxes", "handovers", "temperatures"]))
@click.argument("file_path", type=click.Path(exists=True))
@click.pass_context
def import_data(ctx: click.Context, category: str, file_path: str):
    """导入数据文件

    CATEGORY: 数据类型 (samples|boxes|handovers|temperatures)
    FILE_PATH: 数据文件路径 (JSON 或 CSV)
    """
    state = load_state(ctx)
    file_path = Path(file_path)

    print_header(f"导入 {category} 数据: {file_path.name}")

    previous_count = 0
    new_count = 0
    errors = []

    if category == "samples":
        previous_count = len(state.samples)
        samples, errors = SampleImporter.import_file(file_path, file_path.name)
        for s in samples:
            if s.sample_id in state.samples:
                console.print(f"[yellow]样本 {s.sample_id} 已存在，跳过[/yellow]")
            else:
                state.samples[s.sample_id] = s
                new_count += 1

    elif category == "boxes":
        previous_count = len(state.boxes)
        boxes, errors = BoxImporter.import_file(file_path)
        for b in boxes:
            if b.box_id in state.boxes:
                console.print(f"[yellow]箱子 {b.box_id} 已存在，跳过[/yellow]")
            else:
                state.boxes[b.box_id] = b
                new_count += 1

    elif category == "handovers":
        previous_count = len(state.handover_records)
        records, errors = HandoverImporter.import_file(file_path)
        for r in records:
            exists = any(
                h.box_id == r.box_id
                and h.from_person == r.from_person
                and h.to_person == r.to_person
                and h.handover_time == r.handover_time
                for h in state.handover_records
            )
            if exists:
                console.print(f"[yellow]重复交接记录已跳过 (箱号: {r.box_id})[/yellow]")
            else:
                state.handover_records.append(r)
                new_count += 1

    elif category == "temperatures":
        previous_count = len(state.temperature_records)
        records, errors = TemperatureImporter.import_file(file_path)
        for r in records:
            exists = any(
                t.box_id == r.box_id
                and t.timestamp == r.timestamp
                and t.temperature == r.temperature
                for t in state.temperature_records
            )
            if exists:
                console.print(f"[yellow]重复温度记录已跳过 (箱号: {r.box_id}, 时间: {r.timestamp})[/yellow]")
            else:
                state.temperature_records.append(r)
                new_count += 1

    if errors:
        console.print(f"[red]解析错误 ({len(errors)} 条):[/red]")
        for err in errors[:10]:
            console.print(f"  - {err}")
        if len(errors) > 10:
            console.print(f"  - ... 还有 {len(errors) - 10} 条错误")

    console.print(f"[green]导入完成: {new_count} 条新记录[/green]")
    console.print(f"[dim]原数量: {previous_count}, 现在: {previous_count + new_count}[/dim]")

    save_state(ctx, state)


@cli.command()
@click.option("--rules/--no-rules", default=True, help="运行规则检查")
@click.pass_context
def check(ctx: click.Context, rules: bool):
    """检查数据一致性和状态"""
    state = load_state(ctx)
    print_header("数据检查")

    if rules:
        console.print("[bold]运行规则检查...[/bold]")
        violations = RuleEngine.run_all_rules(state)
        state.violations = violations
        save_state(ctx, state)

    print_summary(state)

    if state.violations:
        table = Table(title=f"规则违规 ({len(state.violations)})", show_header=True, header_style="bold red")
        table.add_column("规则名称")
        table.add_column("严重程度")
        table.add_column("影响项")
        table.add_column("描述", overflow="fold")

        severity_colors = {
            "info": "dim",
            "warning": "yellow",
            "major": "orange",
            "critical": "bold red",
        }

        for v in state.violations:
            color = severity_colors.get(v.severity, "white")
            table.add_row(
                v.rule_name,
                f"[{color}]{v.severity}[/{color}]",
                ", ".join(v.affected_items[:3]) + ("..." if len(v.affected_items) > 3 else ""),
                v.description,
            )
        console.print(table)

        for v in state.violations:
            if v.suggestion:
                console.print(f"[cyan]建议: {v.suggestion}[/cyan]")
    else:
        console.print("[green]未发现规则违规[/green]")


@cli.command()
@click.argument("item_type", type=click.Choice(["sample", "box", "violation", "history"]), required=False)
@click.argument("item_id", required=False)
@click.pass_context
def detail(ctx: click.Context, item_type: Optional[str], item_id: Optional[str]):
    """查看详细信息

    不带参数显示所有资源概览
    ITEM_TYPE: 查看类型 (sample|box|violation|history)
    ITEM_ID: 项目 ID
    """
    state = load_state(ctx)

    if not item_type:
        print_header("资源概览")
        tree = Tree("项目资源")

        samples_node = tree.add(f"样本 ({len(state.samples)})")
        for sid, sample in list(state.samples.items())[:10]:
            samples_node.add(f"{sid} ({sample.sample_type}, 箱: {sample.box_id})")
        if len(state.samples) > 10:
            samples_node.add(f"... 还有 {len(state.samples) - 10} 个样本")

        boxes_node = tree.add(f"箱子 ({len(state.boxes)})")
        for bid in list(state.boxes.keys())[:10]:
            sample_count = sum(1 for s in state.samples.values() if s.box_id == bid)
            boxes_node.add(f"{bid} ({sample_count} 个样本)")
        if len(state.boxes) > 10:
            boxes_node.add(f"... 还有 {len(state.boxes) - 10} 个箱子")

        tree.add(f"交接记录 ({len(state.handover_records)})")
        tree.add(f"温度记录 ({len(state.temperature_records)})")
        tree.add(f"违规 ({len(state.violations)})")
        tree.add(f"人工修正 ({len(state.corrections)})")

        console.print(tree)
        return

    print_header(f"详细信息: {item_type} {item_id or ''}")

    if item_type == "sample" and item_id:
        if item_id not in state.samples:
            console.print(f"[red]样本 {item_id} 不存在[/red]")
            return
        sample = state.samples[item_id]

        table = Table(title=f"样本详情: {item_id}", show_header=False)
        table.add_column("字段", style="bold")
        table.add_column("值")
        table.add_row("样本编号", sample.sample_id)
        table.add_row("样本类型", sample.sample_type)
        table.add_row("箱号", sample.box_id)
        table.add_row("采集时间", str(sample.collection_time))
        table.add_row("温度范围", f"{sample.expected_temperature_min}°C ~ {sample.expected_temperature_max}°C")

        status = state.sample_statuses.get(item_id, SampleStatus.PENDING)
        segment = state.responsibility_segments.get(item_id, ResponsibilitySegment.UNKNOWN)
        table.add_row("当前状态", status.value)
        table.add_row("责任段", segment.value)
        console.print(table)

        box = state.boxes.get(sample.box_id)
        if box:
            console.print(f"\n[bold]所属箱子: {sample.box_id}[/bold]")
            box_temps = [t for t in state.temperature_records if t.box_id == sample.box_id]
            if box_temps:
                temp_table = Table(title=f"温度记录 (最近 10 条)", show_header=True)
                temp_table.add_column("时间")
                temp_table.add_column("温度")
                temp_table.add_column("单位")
                for t in sorted(box_temps, key=lambda x: x.timestamp, reverse=True)[:10]:
                    norm = RuleEngine.normalize_temperature(t)
                    temp_table.add_row(str(t.timestamp), f"{norm:.1f}°C (原始: {t.temperature}{t.unit.value})", t.unit.value)
                console.print(temp_table)

        handovers = [h for h in state.handover_records if h.box_id == sample.box_id]
        if handovers:
            handover_table = Table(title="交接记录", show_header=True)
            handover_table.add_column("时间")
            handover_table.add_column("交出人")
            handover_table.add_column("接收人")
            handover_table.add_column("地点")
            handover_table.add_column("签字")
            for h in handovers:
                handover_table.add_row(
                    str(h.handover_time),
                    h.from_person,
                    h.to_person,
                    h.location,
                    "[green]✓[/green]" if h.signed else "[red]✗[/red]",
                )
            console.print(handover_table)

    elif item_type == "box" and item_id:
        if item_id not in state.boxes:
            console.print(f"[red]箱子 {item_id} 不存在[/red]")
            return

        samples_in_box = [s for s in state.samples.values() if s.box_id == item_id]
        console.print(f"[bold]箱子 {item_id} 包含 {len(samples_in_box)} 个样本:[/bold]")
        for s in samples_in_box:
            status = state.sample_statuses.get(s.sample_id, SampleStatus.PENDING)
            console.print(f"  - {s.sample_id} ({s.sample_type}, 状态: {status.value})")

    elif item_type == "violation" and item_id:
        idx = int(item_id) if item_id.isdigit() else 0
        if idx < 0 or idx >= len(state.violations):
            console.print(f"[red]违规索引 {item_id} 不存在[/red]")
            return
        v = state.violations[idx]
        table = Table(title=f"违规详情 #{idx}", show_header=False)
        table.add_column("字段", style="bold")
        table.add_column("值")
        table.add_row("规则名称", v.rule_name)
        table.add_row("严重程度", v.severity)
        table.add_row("影响项", ", ".join(v.affected_items))
        table.add_row("描述", v.description)
        if v.suggestion:
            table.add_row("建议", v.suggestion)
        console.print(table)

    elif item_type == "history":
        if state.corrections:
            table = Table(title="人工修正历史", show_header=True)
            table.add_column("修正ID")
            table.add_column("操作者")
            table.add_column("时间")
            table.add_column("字段")
            table.add_column("修改前")
            table.add_column("修改后")
            table.add_column("原因")
            for c in state.corrections:
                table.add_row(
                    c.correction_id[:8],
                    c.operator,
                    str(c.corrected_at),
                    c.field,
                    str(c.before_value),
                    str(c.after_value),
                    c.reason,
                )
            console.print(table)
        else:
            console.print("[dim]暂无人工修正记录[/dim]")

    if state.corrections and item_type != "history":
        console.print(f"\n[dim]注: 该项目有 {len(state.corrections)} 条人工修正记录，使用 'cold-chain detail history' 查看[/dim]")


@cli.command()
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.option("--format", "-f", type=click.Choice(["text", "json", "csv"]), default="text", help="输出格式")
@click.pass_context
def report(ctx: click.Context, output: Optional[str], format: str):
    """生成最终交接报告"""
    state = load_state(ctx)
    print_header("生成交接报告")

    console.print("[bold]运行规则检查...[/bold]")
    violations = RuleEngine.run_all_rules(state)
    state.violations = violations

    console.print("[bold]判定样本状态...[/bold]")
    for sample_id, sample in state.samples.items():
        status, segment = StatusDeterminator.determine_sample_status(
            sample, state, violations, state.corrections
        )
        state.sample_statuses[sample_id] = status
        state.responsibility_segments[sample_id] = segment

    save_state(ctx, state)

    status_counts = {s.value: 0 for s in SampleStatus}
    for status in state.sample_statuses.values():
        status_counts[status.value] += 1

    status_table = Table(title="样本状态汇总", show_header=True, header_style="bold magenta")
    status_table.add_column("状态")
    status_table.add_column("数量", justify="right")
    status_table.add_column("比例", justify="right")

    total = len(state.samples)
    for s, count in status_counts.items():
        if count > 0:
            color = "green" if s == "received" else "yellow" if s == "reviewed" else "red"
            pct = (count / total * 100) if total > 0 else 0
            status_table.add_row(f"[{color}]{s}[/{color}]", str(count), f"{pct:.1f}%")
    console.print(status_table)

    sample_table = Table(title="样本详细状态", show_header=True)
    sample_table.add_column("样本编号")
    sample_table.add_column("样本类型")
    sample_table.add_column("箱号")
    sample_table.add_column("状态")
    sample_table.add_column("责任段")
    sample_table.add_column("说明", overflow="fold")

    for sample_id, sample in state.samples.items():
        status = state.sample_statuses[sample_id]
        segment = state.responsibility_segments[sample_id]

        color = "green" if status == SampleStatus.RECEIVED else "yellow" if status == SampleStatus.REVIEWED else "red"
        sample_violations = [
            v for v in violations
            if sample_id in v.affected_items or sample.box_id in v.affected_items
        ]
        note = "; ".join(v.rule_name for v in sample_violations) if sample_violations else "正常"

        sample_table.add_row(
            sample_id,
            sample.sample_type,
            sample.box_id,
            f"[{color}]{status.value}[/{color}]",
            segment.value,
            note,
        )
    console.print(sample_table)

    if output:
        output_path = Path(output)
        if format == "json":
            from datetime import date

            class JSONEncoder(json.JSONEncoder):
                def default(self, obj):
                    if isinstance(obj, datetime):
                        return obj.isoformat()
                    if isinstance(obj, date):
                        return obj.isoformat()
                    return str(obj)

            import json

            report_data = {
                "project": state.project_name,
                "generated_at": datetime.now().isoformat(),
                "summary": status_counts,
                "samples": [],
                "violations": [v.model_dump(mode="json") for v in state.violations],
                "corrections": [c.model_dump(mode="json") for c in state.corrections],
            }

            for sample_id, sample in state.samples.items():
                report_data["samples"].append({
                    "sample_id": sample_id,
                    "sample_type": sample.sample_type,
                    "box_id": sample.box_id,
                    "status": state.sample_statuses[sample_id].value,
                    "responsibility": state.responsibility_segments[sample_id].value,
                })

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2, cls=JSONEncoder)

        elif format == "csv":
            import csv
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["样本编号", "样本类型", "箱号", "状态", "责任段"])
                for sample_id, sample in state.samples.items():
                    writer.writerow([
                        sample_id,
                        sample.sample_type,
                        sample.box_id,
                        state.sample_statuses[sample_id].value,
                        state.responsibility_segments[sample_id].value,
                    ])

        console.print(f"[green]报告已保存到: {output_path}[/green]")


@cli.command()
@click.argument("field")
@click.argument("before_value")
@click.argument("after_value")
@click.argument("reason")
@click.option("--operator", "-u", required=True, help="操作者姓名")
@click.pass_context
def correct(ctx: click.Context, field: str, before_value: str, after_value: str, reason: str, operator: str):
    """人工修正数据 (需记录前后差异)

    FIELD: 要修正的字段
    BEFORE_VALUE: 修改前的值
    AFTER_VALUE: 修改后的值
    REASON: 修正原因
    """
    state = load_state(ctx)
    print_header("人工修正")

    correction = CorrectionHistory(
        correction_id=str(uuid.uuid4()),
        operator=operator,
        corrected_at=datetime.now(),
        field=field,
        before_value=before_value,
        after_value=after_value,
        reason=reason,
    )

    state.corrections.append(correction)
    save_state(ctx, state)

    console.print(f"[green]修正记录已添加[/green]")
    console.print(f"  字段: {field}")
    console.print(f"  修改前: {before_value}")
    console.print(f"  修改后: {after_value}")
    console.print(f"  操作者: {operator}")
    console.print(f"  原因: {reason}")
    console.print(f"\n[yellow]注意: 建议运行 'cold-chain check' 和 'cold-chain report' 重新评估[/yellow]")


@cli.group()
def example():
    """管理示例数据"""
    pass


@example.command("list")
def example_list():
    """列出可用的示例"""
    print_header("可用示例")
    console.print("  [bold]normal[/bold]    - 合格运输 (完全符合规范)")
    console.print("  [bold]short-over[/bold] - 短时超温 (轻微违规)")
    console.print("  [bold]long-gap[/bold]  - 长时间缺记录 (严重违规)")
    console.print("  [bold]manual[/bold]    - 人工说明 (需手动修正)")
    console.print("  [bold]all[/bold]       - 加载所有示例到一个项目")


@example.command("load")
@click.argument("name", type=click.Choice(["normal", "short-over", "long-gap", "manual", "all"]))
@click.option("--force", "-f", is_flag=True, help="覆盖现有数据")
@click.pass_context
def example_load(ctx: click.Context, name: str, force: bool):
    """加载示例数据

    NAME: 示例名称
    """
    project_dir = get_project_dir(ctx)
    storage = Storage(project_dir)

    if not storage.exists():
        console.print("[yellow]项目未初始化，自动创建...[/yellow]")
        storage.initialize(f"example-{name}")

    state = storage.load_state()

    if state.samples and not force:
        console.print(f"[red]项目已有数据。使用 --force 覆盖。[/red]")
        return

    print_header(f"加载示例: {name}")

    if state.samples:
        state.samples = {}
        state.boxes = {}
        state.handover_records = []
        state.temperature_records = []
        state.sample_statuses = {}
        state.responsibility_segments = {}
        state.violations = []
        state.corrections = []

    if name == "normal":
        examples.load_normal_example(state)
    elif name == "short-over":
        examples.load_short_overtemp_example(state)
    elif name == "long-gap":
        examples.load_long_gap_example(state)
    elif name == "manual":
        examples.load_manual_example(state)
    elif name == "all":
        examples.load_all_examples(state)

    save_state(ctx, state)
    console.print(f"[green]示例数据已加载[/green]")
    print_summary(state)
    console.print(f"\n[cyan]提示: 运行 'cold-chain check' 和 'cold-chain report' 查看结果[/cyan]")


if __name__ == "__main__":
    cli()
