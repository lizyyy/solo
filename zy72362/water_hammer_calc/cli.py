from __future__ import annotations
import uuid
import json
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from .models import NameplateData, MaintenanceScreenshot, WaterHammerInput
from .store import DataStore
from .engine import run_calculation

console = Console()

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
    console.print(f"[bold blue]Calculation Result[/bold blue] (calc_id: {calc_id})")
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
    
    console.print(f"[bold blue]Parameter Replay[/bold blue] (calc_id: {calc_id})")
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
