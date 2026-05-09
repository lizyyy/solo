import json
import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .engine import SupplyEngine


console = Console()


SAMPLE_ROUTE = {
    "name": "百公里爬坡挑战",
    "points": [
        {"lat": 31.23, "lon": 121.47, "elevation": 10},
        {"lat": 31.24, "lon": 121.48, "elevation": 12},
        {"lat": 31.25, "lon": 121.49, "elevation": 15},
        {"lat": 31.26, "lon": 121.50, "elevation": 20},
        {"lat": 31.27, "lon": 121.51, "elevation": 50},
        {"lat": 31.28, "lon": 121.52, "elevation": 100},
        {"lat": 31.29, "lon": 121.53, "elevation": 180},
        {"lat": 31.30, "lon": 121.54, "elevation": 280},
        {"lat": 31.31, "lon": 121.55, "elevation": 350},
        {"lat": 31.32, "lon": 121.56, "elevation": 420},
        {"lat": 31.33, "lon": 121.57, "elevation": 380},
        {"lat": 31.34, "lon": 121.58, "elevation": 320},
        {"lat": 31.35, "lon": 121.59, "elevation": 250},
        {"lat": 31.36, "lon": 121.60, "elevation": 180},
        {"lat": 31.37, "lon": 121.61, "elevation": 120},
        {"lat": 31.38, "lon": 121.62, "elevation": 80},
        {"lat": 31.39, "lon": 121.63, "elevation": 60},
        {"lat": 31.40, "lon": 121.64, "elevation": 45},
        {"lat": 31.41, "lon": 121.65, "elevation": 35},
        {"lat": 31.42, "lon": 121.66, "elevation": 25},
        {"lat": 31.43, "lon": 121.67, "elevation": 40},
        {"lat": 31.44, "lon": 121.68, "elevation": 90},
        {"lat": 31.45, "lon": 121.69, "elevation": 160},
        {"lat": 31.46, "lon": 121.70, "elevation": 240},
        {"lat": 31.47, "lon": 121.71, "elevation": 320},
        {"lat": 31.48, "lon": 121.72, "elevation": 380},
        {"lat": 31.49, "lon": 121.73, "elevation": 340},
        {"lat": 31.50, "lon": 121.74, "elevation": 280},
        {"lat": 31.51, "lon": 121.75, "elevation": 200},
        {"lat": 31.52, "lon": 121.76, "elevation": 130},
        {"lat": 31.53, "lon": 121.77, "elevation": 70},
        {"lat": 31.54, "lon": 121.78, "elevation": 30},
        {"lat": 31.55, "lon": 121.79, "elevation": 15},
        {"lat": 31.56, "lon": 121.80, "elevation": 10},
    ]
}


@click.group(
    help="骑行俱乐部补给站排布 CLI - 基于爬升、天气和参与者水平智能规划补给站"
)
def main():
    pass


@main.command("init", help="初始化样例数据和目录结构")
def cmd_init():
    engine = SupplyEngine()
    sample_dir = Path.cwd() / "samples"
    sample_dir.mkdir(exist_ok=True)
    
    sample_file = sample_dir / "route_sample.json"
    with open(sample_file, "w", encoding="utf-8") as f:
        json.dump(SAMPLE_ROUTE, f, ensure_ascii=False, indent=2)
    
    console.print(Panel(
        Text.from_markup(
            f"[green]初始化完成[/green]\n\n"
            f"样例路线: {sample_file}\n"
            f"数据目录: {engine.storage.data_dir}\n"
            f"导出目录: {engine.storage.exports_dir}\n\n"
            f"下一步: bike-supply import samples/route_sample.json"
        ),
        title="bike-supply init",
        expand=False
    ))


@main.command("import", help="导入路线文件并执行补给站规划")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--name", "-n", default=None, help="路线名称（默认使用文件名）")
@click.option("--level", "-l", default="intermediate", 
              type=click.Choice(["beginner", "intermediate", "advanced"]),
              help="参与者水平: beginner/入门, intermediate/中级, advanced/精英")
@click.option("--count", "-c", type=int, default=20, help="参与人数")
@click.option("--speed", "-s", type=float, default=20.0, help="平均速度 (km/h)")
@click.option("--temp", "-t", type=float, default=20.0, help="气温 (°C)")
@click.option("--humidity", "-h", type=float, default=60.0, help="湿度 (%)")
@click.option("--force", "-f", is_flag=True, help="强制重新计算（忽略缓存）")
@click.option("--export", "-e", is_flag=True, help="执行后立即导出")
def cmd_import(file_path, name, level, count, speed, temp, humidity, force, export):
    engine = SupplyEngine()
    
    try:
        route_data = engine.load_route_file(file_path)
        points = route_data.get("points", [])
        route_name = name or route_data.get("name", Path(file_path).stem)
        
        weather = {"temperature": temp, "humidity": humidity}
        participants = {"level": level, "count": count, "avg_speed_kmh": speed}
        
        result = engine.process(
            route_name=route_name,
            raw_points=points,
            weather=weather,
            participants=participants,
            force=force
        )
        
        run_id = result["run_id"]
        
        if result.get("cached"):
            console.print(f"[yellow]使用缓存结果[/yellow] Run ID: {run_id}")
            record = result["record"]
            profile = record.get("profile", {})
            stations = record.get("stations", [])
            totals = record.get("totals", {})
        else:
            console.print(f"[green]计算完成[/green] Run ID: {run_id}")
            profile = result["profile"]
            stations = result["stations"]
            totals = result["totals"]
        
        _print_summary(profile, stations, totals, run_id)
        
        if export:
            outputs = engine.export_results(run_id)
            console.print(f"\n[cyan]已导出:[/cyan]")
            for fmt, path in outputs.items():
                console.print(f"  {fmt}: {path}")
        
    except Exception as e:
        console.print(f"[red]错误:[/red] {e}")
        sys.exit(1)


@main.command("check", help="检查路线数据完整性")
@click.argument("file_path", type=click.Path(exists=True))
def cmd_check(file_path):
    engine = SupplyEngine()
    
    try:
        route_data = engine.load_route_file(file_path)
        points = route_data.get("points", [])
        
        result = engine.validate_route(points)
        
        table = Table(title="路线检查结果", show_header=False)
        table.add_column("属性", style="cyan")
        table.add_column("值")
        
        table.add_row("文件", file_path)
        table.add_row("点数", str(len(points)))
        table.add_row("状态", "[green]有效[/green]" if result["valid"] else "[red]无效[/red]")
        
        console.print(table)
        
        if result["warnings"]:
            console.print("\n[yellow]警告:[/yellow]")
            for w in result["warnings"]:
                console.print(f"  - {w}")
        
        if result["errors"]:
            console.print("\n[red]错误:[/red]")
            for e in result["errors"]:
                console.print(f"  - {e}")
            sys.exit(1)
            
    except Exception as e:
        console.print(f"[red]错误:[/red] {e}")
        sys.exit(1)


@main.command("history", help="查看运行历史")
@click.option("--limit", "-n", type=int, default=10, help="显示条数")
@click.option("--detail", "-d", is_flag=True, help="显示详情")
@click.option("--run-id", "-r", default=None, help="指定 Run ID 查看详情")
def cmd_history(limit, detail, run_id):
    engine = SupplyEngine()
    
    if run_id:
        record = engine.get_run_details(run_id)
        if not record:
            console.print(f"[red]找不到运行记录: {run_id}[/red]")
            sys.exit(1)
        
        _print_run_detail(record)
        return
    
    runs = engine.get_history(limit=limit)
    
    if not runs:
        console.print("[yellow]暂无运行记录[/yellow]")
        console.print("使用 bike-supply import 导入路线开始规划")
        return
    
    table = Table(title="运行历史")
    table.add_column("#", style="dim")
    table.add_column("Run ID", style="cyan")
    table.add_column("路线", style="green")
    table.add_column("补给站", justify="center")
    table.add_column("时间", style="dim")
    
    for i, r in enumerate(runs, 1):
        table.add_row(
            str(i),
            r.get("run_id", ""),
            r.get("route_name", ""),
            str(r.get("station_count", 0)),
            r.get("timestamp", "")[:19]
        )
    
    console.print(table)
    console.print(f"\n使用 [cyan]bike-supply history -r <run_id>[/cyan] 查看详情")


@main.command("export", help="导出运行结果")
@click.option("--run-id", "-r", default=None, help="指定 Run ID（默认最新）")
@click.option("--format", "-f", multiple=True,
              type=click.Choice(["json", "csv", "report", "all"]),
              help="导出格式")
def cmd_export(run_id, format):
    engine = SupplyEngine()
    
    try:
        formats = list(format) if format else ["json", "csv", "report"]
        if "all" in formats:
            formats = ["json", "csv", "report"]
        
        outputs = engine.export_results(run_id=run_id, formats=formats)
        
        console.print(Panel(
            "\n".join([f"[cyan]{k}:[/cyan] {v}" for k, v in outputs.items()]),
            title="导出完成",
            expand=False
        ))
        
    except ValueError as e:
        console.print(f"[red]错误:[/red] {e}")
        sys.exit(1)


def _print_summary(profile, stations, totals, run_id):
    console.print("\n" + "=" * 60)
    console.print(f"[bold cyan]路线概况[/bold cyan]")
    console.print("=" * 60)
    console.print(f"  总距离: {profile.get('total_distance_km', 0):.2f} km")
    console.print(f"  总爬升: {profile.get('total_elevation_gain', 0):.0f} m")
    console.print(f"  总下降: {profile.get('total_elevation_loss', 0):.0f} m")
    console.print(f"  爬坡段数: {len(profile.get('climbs', []))}")
    
    console.print("\n" + "=" * 60)
    console.print(f"[bold green]物资汇总[/bold green]")
    console.print("=" * 60)
    console.print(f"  补给站数量: {totals.get('station_count', 0)}")
    console.print(f"  总用水量: {totals.get('total_water_liters', 0):.1f} L")
    console.print(f"  总食物量: {totals.get('total_food_kg', 0):.1f} kg")
    console.print(f"  电解质包: {totals.get('total_electrolytes_packs', 0):.0f}")
    console.print(f"  能量胶: {totals.get('total_energy_gels', 0)}")
    
    console.print("\n" + "=" * 60)
    console.print(f"[bold magenta]补给站列表[/bold magenta]")
    console.print("=" * 60)
    
    for s in stations:
        mats = s.materials if hasattr(s, 'materials') else s.get('materials', {})
        name = s.name if hasattr(s, 'name') else s.get('name', '')
        dist = s.distance_km if hasattr(s, 'distance_km') else s.get('distance_km', 0)
        station_type = s.type if hasattr(s, 'type') else s.get('type', '')
        reason = s.reason if hasattr(s, 'reason') else s.get('reason', '')
        
        console.print(f"\n  [cyan]{name}[/cyan] ({dist:.1f}km) [{station_type}]")
        console.print(f"      水: {mats.get('water_liters', 0):.1f}L | 食物: {mats.get('food_kg', 0):.1f}kg | "
                     f"电解质: {mats.get('electrolytes_packs', 0):.0f} | 能量胶: {mats.get('energy_gels', 0)}")
        console.print(f"      原因: {reason}")


def _print_run_detail(record):
    profile = record.get("profile", {})
    totals = record.get("totals", {})
    stations = record.get("stations", [])
    settings = record.get("settings", {})
    
    console.print(Panel(
        Text.from_markup(
            f"[bold cyan]{record.get('route_name', '未知')}[/bold cyan]\n"
            f"Run ID: {record.get('run_id', '')}\n"
            f"时间: {record.get('timestamp', '')[:19]}"
        ),
        expand=False
    ))
    
    console.print("\n[bold]设置参数:[/bold]")
    p = settings.get("participants", {})
    w = settings.get("weather", {})
    console.print(f"  参与者: {p.get('level', '')} x {p.get('count', 0)}人, 速度 {p.get('avg_speed_kmh', 0)}km/h")
    console.print(f"  天气: {w.get('temperature', 0)}°C, 湿度 {w.get('humidity', 0)}%")
    
    _print_summary(profile, stations, totals, record.get("run_id", ""))


if __name__ == "__main__":
    main()
