from __future__ import annotations
import uuid
import json
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from .models import CalcStatus, NameplateData, MaintenanceScreenshot, WaterHammerInput
from .store import DataStore
from .engine import run_calculation

console = Console()


def status_color(status: CalcStatus) -> str:
    mapping = {
        CalcStatus.DRAFT: "blue",
        CalcStatus.NEEDS_REVIEW: "yellow",
        CalcStatus.REVIEWED_BY_TRAINER: "cyan",
        CalcStatus.APPROVED: "green",
        CalcStatus.REJECTED: "red",
        CalcStatus.FINALIZED: "grey50",
    }
    return mapping.get(status, "white")


def render_status_banner(calc_id: str, result) -> None:
    from rich.panel import Panel
    status_str = f"[{status_color(result.status)} bold]{result.status.value}[/]"
    lines = [f"[bold]Calc ID:[/] {calc_id}", f"[bold]状态:[/] {status_str}"]
    reviewers = []
    if result.reviewed_by_trainer:
        reviewers.append(f"训练教练: {result.trainer_name or '—'}")
    if result.reviewed_by_engineer:
        reviewers.append(f"设备工程师: {result.engineer_name or '—'}")
    if reviewers:
        lines.append("[bold]复核人:[/] " + "  |  ".join(reviewers))
    next_actions = [e.next_action for e in result.parameter_entries if e.next_action]
    if next_actions:
        lines.append("[bold]下一步行动:[/]")
        for a in next_actions:
            lines.append(f"  • {a}")
    console.print(Panel("\n".join(lines), title="计算状态概览", border_style="bold"))


def render_change_history(change_history) -> None:
    if not change_history:
        console.print("[grey50](无变更记录)[/]")
        return
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Change ID", style="dim", width=12)
    table.add_column("Time", width=20)
    table.add_column("Type")
    table.add_column("Operator")
    table.add_column("Parameter")
    table.add_column("Old→New")
    table.add_column("Reason")
    for rec in change_history:
        old_new = ""
        if rec.old_value is not None and rec.new_value is not None:
            old_new = f"{rec.old_value} → {rec.new_value}"
        elif rec.status_before is not None and rec.status_after is not None:
            old_new = f"{rec.status_before} → {rec.status_after}"
        table.add_row(
            rec.change_id,
            rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            rec.change_type.value,
            rec.operator,
            rec.parameter_name or "",
            old_new,
            rec.reason or "",
        )
    console.print(table)

@click.group()
def whcalc():
    pass

@whcalc.command()
@click.option("--file", required=True, type=click.Path(exists=True))
@click.option("--data-dir", default="./wh_data")
def import_nameplate(file, data_dir):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
    nameplate = NameplateData.model_validate(data)
    store = DataStore(data_dir)
    store.save_nameplate(nameplate)
    console.print(f"[green]Successfully[/green] imported nameplate for equipment_id: {nameplate.equipment_id}")

@whcalc.command()
@click.option("--file", required=True, type=click.Path(exists=True))
@click.option("--data-dir", default="./wh_data")
def import_screenshot(file, data_dir):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
    screenshot = MaintenanceScreenshot.model_validate(data)
    store = DataStore(data_dir)
    store.save_screenshot(screenshot)
    console.print(f"[green]Successfully[/green] imported screenshot_id: {screenshot.screenshot_id}")

@whcalc.command()
@click.option("--file", required=True, type=click.Path(exists=True))
@click.option("--calc-id", default=None)
@click.option("--data-dir", default="./wh_data")
def calculate(file, calc_id, data_dir):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
    input_data = WaterHammerInput.model_validate(data)
    calc_id = calc_id or str(uuid.uuid4())
    result = run_calculation(input_data)
    store = DataStore(data_dir)
    store.save_calculation(calc_id, input_data, result)
    status_str = f"[{status_color(result.status)} bold]{result.status.value}[/]"
    console.print(f"[bold blue]Calculation Result[/bold blue] (calc_id: {calc_id})  状态: {status_str}")
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Metric")
    table.add_column("Value")
    table.add_column("Unit")
    table.add_row("Max Pressure", f"{result.max_pressure:.2e}", "Pa")
    table.add_row("Pressure Rise", f"{result.pressure_rise:.2e}", "Pa")
    table.add_row("Joukowsky Pressure", f"{result.joukowsky_pressure:.2e}", "Pa")
    table.add_row("Wave Speed Used", f"{result.wave_speed_used:.2f}", "m/s")
    table.add_row("Classification", result.classification, "")
    console.print(table)

@whcalc.command()
@click.option("--calc-id", required=True)
@click.option("--data-dir", default="./wh_data")
def replay(calc_id, data_dir):
    store = DataStore(data_dir)
    loaded = store.load_calculation(calc_id)
    if loaded is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} not found")
        return
    _, result = loaded
    
    render_status_banner(calc_id, result)
    
    console.print(f"\n[bold blue]Parameter Replay[/bold blue] (calc_id: {calc_id})")
    param_table = Table(show_header=True, header_style="bold magenta")
    param_table.add_column("Parameter")
    param_table.add_column("Value")
    param_table.add_column("Unit")
    param_table.add_column("Source")
    param_table.add_column("Modified?")
    param_table.add_column("Reason")
    param_table.add_column("Missing Materials")
    param_table.add_column("Next Action")
    
    for entry in result.parameter_entries:
        param_table.add_row(
            entry.name,
            f"{entry.value}",
            entry.unit,
            entry.provenance.source.value,
            "Yes" if entry.is_manually_modified else "No",
            entry.modification_reason or "",
            ", ".join(entry.missing_materials) if entry.missing_materials else "",
            entry.next_action or "",
        )
    console.print(param_table)
    
    review_flags = [f for f in result.override_flags if f.needs_review]
    if review_flags:
        console.print("\n[bold yellow]Override Flags Needing Review[/bold yellow]")
        flag_table = Table(show_header=True, header_style="bold yellow")
        flag_table.add_column("Parameter")
        flag_table.add_column("Original Value")
        flag_table.add_column("Overridden Value")
        flag_table.add_column("Reason")
        for flag in review_flags:
            flag_table.add_row(
                flag.parameter_name,
                f"{flag.original_value}",
                f"{flag.overridden_value}",
                flag.reason or "None",
            )
        console.print(flag_table)
    
    console.print("\n[bold blue]Replay Narrative[/bold blue]")
    console.print(result.replay_narrative)
    
    console.print("\n[bold blue]Change History[/bold blue]")
    render_change_history(result.change_history)

@whcalc.command("add-reason")
@click.option("--calc-id", required=True)
@click.option("--param", required=True)
@click.option("--reason", required=True)
@click.option("--data-dir", default="./wh_data")
def add_reason(calc_id, param, reason, data_dir):
    store = DataStore(data_dir)
    result = store.add_override_reason(calc_id, param, reason)
    if result is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} or parameter {param} not found")
        return
    console.print(f"[green]Successfully[/green] added reason for parameter {param} in calculation {calc_id}")

@whcalc.command("link-screenshot")
@click.option("--calc-id", required=True)
@click.option("--screenshot-id", required=True)
@click.option("--data-dir", default="./wh_data")
def link_screenshot(calc_id, screenshot_id, data_dir):
    store = DataStore(data_dir)
    result = store.link_screenshot_to_parameters(screenshot_id, calc_id)
    if result is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} or screenshot {screenshot_id} not found")
        return
    console.print(f"[green]Successfully[/green] linked screenshot {screenshot_id} to calculation {calc_id} parameters")

@whcalc.command()
@click.option("--calc-id", required=True)
@click.option("--data-dir", default="./wh_data")
def history(calc_id, data_dir):
    store = DataStore(data_dir)
    changes = store.get_change_history(calc_id)
    if not changes and store.load_calculation(calc_id) is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} not found")
        return
    console.print(f"[bold blue]Change History[/bold blue] (calc_id: {calc_id})")
    render_change_history(changes)

@whcalc.command("export-report")
@click.option("--calc-id", required=True)
@click.option("--output", default=None, type=click.Path())
@click.option("--data-dir", default="./wh_data")
def export_report(calc_id, output, data_dir):
    import shutil
    store = DataStore(data_dir)
    result = store.export_report(calc_id)
    if result is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} not found")
        return
    report, default_path_str = result
    default_path = Path(default_path_str)
    if output:
        out_path = Path(output)
        if out_path.suffix.lower() != ".json":
            out_path.mkdir(parents=True, exist_ok=True)
            out_path = out_path / default_path.name
        else:
            out_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(default_path, out_path)
        saved_to = str(out_path)
    else:
        saved_to = default_path_str
    matching_status = next((s for s in CalcStatus if s.value == report.status), None)
    status_color_str = status_color(matching_status) if matching_status else "white"
    console.print(f"[bold blue]Report Exported[/bold blue] (calc_id: {calc_id})")
    console.print(f"  文件: [cyan]{saved_to}[/]")
    console.print(f"  当前状态: [{status_color_str}]{report.status}[/]")
    if report.next_action_summary:
        console.print("  下一步行动:")
        for a in report.next_action_summary:
            console.print(f"    • {a}")
    else:
        console.print("  下一步行动: [green]无[/]")

@whcalc.command("engineer-review")
@click.option("--calc-id", required=True)
@click.option("--approve/--reject", required=True)
@click.option("--reviewer", required=True)
@click.option("--comments", default="")
@click.option("--data-dir", default="./wh_data")
def engineer_review(calc_id, approve, reviewer, comments, data_dir):
    store = DataStore(data_dir)
    result = store.review_by_engineer(calc_id, approve, reviewer, comments)
    if result is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} not found")
        return
    status_str = f"[{status_color(result.status)} bold]{result.status.value}[/]"
    verdict = "[green]通过[/]" if approve else "[red]驳回[/]"
    console.print(f"[bold blue]Engineer Review[/bold blue] (calc_id: {calc_id})")
    console.print(f"  复核人: {reviewer}")
    console.print(f"  结论: {verdict}")
    if comments:
        console.print(f"  意见: {comments}")
    console.print(f"  当前状态: {status_str}")

@whcalc.command("trainer-review")
@click.option("--calc-id", required=True)
@click.option("--reviewer", default="训练教练老唐")
@click.option("--comments", default="")
@click.option("--data-dir", default="./wh_data")
def trainer_review(calc_id, reviewer, comments, data_dir):
    store = DataStore(data_dir)
    result = store.review_by_trainer(calc_id, reviewer, comments)
    if result is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} not found")
        return
    status_str = f"[{status_color(result.status)} bold]{result.status.value}[/]"
    console.print(f"[bold blue]Trainer Review[/bold blue] (calc_id: {calc_id})")
    console.print(f"  复核人: {reviewer}")
    if comments:
        console.print(f"  意见: {comments}")
    console.print(f"  当前状态: {status_str}")

@whcalc.command()
@click.option("--calc-id", required=True)
@click.option("--data-dir", default="./wh_data")
def finalize(calc_id, data_dir):
    store = DataStore(data_dir)
    result = store.finalize_calc(calc_id)
    if result is None:
        console.print(f"[red]Error:[/red] Calculation {calc_id} not found")
        return
    status_str = f"[{status_color(result.status)} bold]{result.status.value}[/]"
    console.print(f"[bold blue]Finalize[/bold blue] (calc_id: {calc_id})")
    console.print(f"  结果: [green]已归档[/]")
    console.print(f"  当前状态: {status_str}")

@whcalc.command("list")
@click.option("--what", required=True, type=click.Choice(["nameplates", "screenshots", "calculations"]))
@click.option("--data-dir", default="./wh_data")
def list_cmd(what, data_dir):
    store = DataStore(data_dir)
    if what == "nameplates":
        items = store.list_nameplates()
        title = "Nameplates"
    elif what == "screenshots":
        items = store.list_screenshots()
        title = "Screenshots"
    else:
        items = store.list_calculations()
        title = "Calculations"
    console.print(f"[bold blue]{title}[/bold blue]")
    if not items:
        console.print("  (none)")
    else:
        for item in items:
            console.print(f"  - {item}")

def main():
    whcalc()

if __name__ == "__main__":
    main()
