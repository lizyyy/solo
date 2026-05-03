import sys
from pathlib import Path
from typing import Optional
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from freq_coordinator import __version__
from freq_coordinator.parsers import (
    parse_supply_stations,
    parse_repeaters,
    parse_volunteer_shifts,
    parse_devices,
)
from freq_coordinator.scheduler import SchedulerRules, Orchestrator
from freq_coordinator.risk_engine import RiskEngine
from freq_coordinator.exporters import (
    MarkdownExporter,
    CSVExporter,
    JSONExporter,
)


console = Console()


def validate_files(
    stations_file: Optional[str] = None,
    repeaters_file: Optional[str] = None,
    shifts_file: Optional[str] = None,
    devices_file: Optional[str] = None,
) -> tuple:
    results = []
    
    if stations_file:
        result = parse_supply_stations(stations_file)
        results.append(("补给站", result))
    
    if repeaters_file:
        result = parse_repeaters(repeaters_file)
        results.append(("中继台", result))
    
    if shifts_file:
        result = parse_volunteer_shifts(shifts_file)
        results.append(("志愿者班次", result))
    
    if devices_file:
        result = parse_devices(devices_file)
        results.append(("设备清单", result))
    
    return results


def display_validation_results(results):
    all_valid = True
    
    for name, result in results:
        table = Table(title=f"[bold]{name}[/bold] 校验结果", show_header=True)
        table.add_column("项目", style="cyan")
        table.add_column("状态", style="green")
        table.add_column("详情", style="white")
        
        status = "[green]✓ 有效[/green]" if result.is_valid else "[red]✗ 无效[/red]"
        if not result.is_valid:
            all_valid = False
        
        table.add_row("解析记录数", str(result.parsed_count), "")
        table.add_row("错误数", str(len(result.errors)), "")
        table.add_row("警告数", str(len(result.warnings)), "")
        
        console.print(table)
        
        for error in result.errors:
            row_info = f" (行 {error.row_number})" if error.row_number else ""
            console.print(f"  [red]错误{row_info}:[/red] {error.field} - {error.message}")
        
        for warning in result.warnings:
            row_info = f" (行 {warning.row_number})" if warning.row_number else ""
            console.print(f"  [yellow]警告{row_info}:[/yellow] {warning.field} - {warning.message}")
        
        console.print()
    
    return all_valid


@click.group()
@click.version_option(__version__)
def main():
    """
    频点值守编排员 - 山地越野赛通信保障智能编排工具
    
    用于赛前通信保障规划，包括：
    - 导入补给站、中继台、志愿者班次和设备数据
    - 校验数据字段和时间格式
    - 生成频道、人员和设备编排
    - 检测覆盖缺口、频点冲突、交接超时和电池风险
    - 导出Markdown通信方案、CSV风险清单和JSON审计包
    """
    pass


@main.command()
@click.option("--stations", "-s", type=click.Path(exists=True), help="补给站CSV文件路径")
@click.option("--repeaters", "-r", type=click.Path(exists=True), help="中继台JSON文件路径")
@click.option("--shifts", "-t", type=click.Path(exists=True), help="志愿者班次ICS文件路径")
@click.option("--devices", "-d", type=click.Path(exists=True), help="设备清单CSV文件路径")
def validate(stations, repeaters, shifts, devices):
    """
    校验输入文件格式和内容
    
    检查各文件的字段完整性、数据类型和格式有效性。
    """
    console.print(Panel.fit(
        "[bold cyan]频点值守编排员 - 文件校验[/bold cyan]\n"
        f"版本: {__version__}",
        border_style="cyan"
    ))
    console.print()
    
    results = validate_files(stations, repeaters, shifts, devices)
    all_valid = display_validation_results(results)
    
    if all_valid:
        console.print(Panel("[bold green]✓ 所有文件校验通过[/bold green]", border_style="green"))
        sys.exit(0)
    else:
        console.print(Panel("[bold red]✗ 存在校验错误[/bold red]", border_style="red"))
        sys.exit(1)


@main.command()
@click.option("--stations", "-s", type=click.Path(exists=True), required=True, help="补给站CSV文件路径")
@click.option("--repeaters", "-r", type=click.Path(exists=True), required=True, help="中继台JSON文件路径")
@click.option("--shifts", "-t", type=click.Path(exists=True), required=True, help="志愿者班次ICS文件路径")
@click.option("--devices", "-d", type=click.Path(exists=True), required=True, help="设备清单CSV文件路径")
@click.option("--output", "-o", type=click.Path(), default="./output", help="输出目录路径")
@click.option("--event-name", "-n", default="山地越野赛", help="赛事名称")
@click.option("--min-handover", type=int, default=10, help="最小交接时间(分钟)")
@click.option("--safety-margin", type=float, default=1.0, help="电池安全余量(小时)")
@click.option("--format", "-f", multiple=True, type=click.Choice(["markdown", "csv", "json"]), default=["markdown", "csv", "json"], help="输出格式")
def run(stations, repeaters, shifts, devices, output, event_name, min_handover, safety_margin, format):
    """
    执行完整的编排流程
    
    导入数据 -> 校验 -> 编排 -> 风险检测 -> 导出结果
    """
    console.print(Panel.fit(
        "[bold cyan]频点值守编排员 - 完整编排流程[/bold cyan]\n"
        f"版本: {__version__}",
        border_style="cyan"
    ))
    console.print()
    
    console.print("[bold]第一步: 校验输入文件[/bold]")
    results = validate_files(stations, repeaters, shifts, devices)
    all_valid = display_validation_results(results)
    
    if not all_valid:
        console.print(Panel("[bold red]✗ 文件校验失败，终止编排[/bold red]", border_style="red"))
        sys.exit(1)
    
    console.print()
    console.print("[bold]第二步: 解析数据[/bold]")
    
    stations_result = parse_supply_stations(stations)
    repeaters_result = parse_repeaters(repeaters)
    shifts_result = parse_volunteer_shifts(shifts)
    devices_result = parse_devices(devices)
    
    supply_stations = []
    repeater_stations = []
    volunteer_shifts = []
    device_list = []
    
    stations_map = {}
    for s in stations_result.errors:
        pass
    if hasattr(stations_result, 'parsed_data'):
        supply_stations = stations_result.parsed_data
    else:
        path = Path(stations)
        import csv
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            from freq_coordinator.models import SupplyStation
            for row in reader:
                try:
                    station = SupplyStation(
                        id=row["id"].strip(),
                        name=row["name"].strip(),
                        latitude=float(row["latitude"].strip()),
                        longitude=float(row["longitude"].strip()),
                        distance_from_start=float(row["distance_from_start"].strip()),
                        elevation=float(row.get("elevation", "0").strip()) if row.get("elevation") else 0.0,
                        criticality=row.get("criticality", "normal").lower(),
                        required_coverage=row.get("required_coverage", "true").lower() in ["true", "1", "yes"],
                        contact_person=row.get("contact_person"),
                    )
                    supply_stations.append(station)
                    stations_map[station.id] = station
                except Exception as e:
                    console.print(f"  [yellow]警告: 跳过无效行 - {e}[/yellow]")
    
    import json
    path = Path(repeaters)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        from freq_coordinator.models import RepeaterStation
        if isinstance(data, dict):
            if "repeaters" in data:
                items = data["repeaters"]
            elif "stations" in data:
                items = data["stations"]
            else:
                items = [data]
        else:
            items = data
        
        for item in items:
            try:
                repeater = RepeaterStation(
                    id=str(item["id"]).strip(),
                    name=str(item["name"]).strip(),
                    latitude=float(item["latitude"]),
                    longitude=float(item["longitude"]),
                    elevation=float(item["elevation"]) if item.get("elevation") is not None else 0.0,
                    tx_frequency=float(item["tx_frequency"]),
                    rx_frequency=float(item["rx_frequency"]),
                    power=float(item.get("power", 25.0)),
                    antenna_gain=float(item.get("antenna_gain", 3.0)),
                    coverage_radius_km=float(item.get("coverage_radius_km", 5.0)),
                    height_agl=float(item.get("height_agl", 10.0)),
                    coverage_polygon=item.get("coverage_polygon"),
                )
                repeater_stations.append(repeater)
            except Exception as e:
                console.print(f"  [yellow]警告: 跳过无效中继台 - {e}[/yellow]")
    
    try:
        from ics import Calendar
        path = Path(shifts)
        with open(path, "r", encoding="utf-8") as f:
            cal = Calendar(f.read())
            from freq_coordinator.models import VolunteerShift
            from datetime import timezone
            import pytz
            
            for idx, event in enumerate(cal.events, start=1):
                summary = getattr(event, 'summary', '') or ''
                description = getattr(event, 'description', '') or ''
                
                def extract_field(text, field_name):
                    if not text:
                        return None
                    patterns = [f"{field_name}:", f"{field_name}：", f"{field_name}="]
                    for pattern in patterns:
                        if pattern in text.lower():
                            lines = text.split('\n')
                            for line in lines:
                                lower_line = line.lower()
                                if pattern.lower() in lower_line:
                                    pos = lower_line.find(pattern.lower())
                                    if pos >= 0:
                                        value = line[pos + len(pattern):].strip()
                                        value = value.split(',')[0].split(';')[0].strip()
                                        return value if value else None
                    return None
                
                volunteer_name = extract_field(summary, 'name') or extract_field(description, 'name')
                volunteer_id = extract_field(summary, 'id') or extract_field(description, 'id') or f"vol-{idx:03d}"
                station_id = extract_field(summary, 'station') or extract_field(description, 'station')
                role = extract_field(summary, 'role') or extract_field(description, 'role') or 'operator'
                phone = extract_field(description, 'phone')
                
                if not volunteer_name:
                    volunteer_name = summary.strip() if summary else f"志愿者-{idx}"
                
                if not station_id:
                    console.print(f"  [yellow]警告: 班次 '{summary}' 缺少站点ID，跳过[/yellow]")
                    continue
                
                start_time = getattr(event, 'begin', None)
                end_time = getattr(event, 'end', None)
                
                if start_time and hasattr(start_time, 'datetime'):
                    start_time = start_time.datetime
                if start_time and hasattr(start_time, 'tzinfo') and start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=timezone.utc)
                
                if end_time and hasattr(end_time, 'datetime'):
                    end_time = end_time.datetime
                if end_time and hasattr(end_time, 'tzinfo') and end_time.tzinfo is None:
                    end_time = end_time.replace(tzinfo=timezone.utc)
                
                if not start_time or not end_time:
                    console.print(f"  [yellow]警告: 班次 '{summary}' 缺少时间，跳过[/yellow]")
                    continue
                
                skills_str = extract_field(description, 'skills')
                skills = []
                if skills_str:
                    skills = [s.strip() for s in skills_str.split(',') if s.strip()]
                
                shift = VolunteerShift(
                    id=f"shift-{idx:04d}",
                    volunteer_name=volunteer_name,
                    volunteer_id=volunteer_id,
                    station_id=station_id,
                    start_time=start_time,
                    end_time=end_time,
                    role=role,
                    skills=skills,
                    phone=phone,
                    assigned_device=None,
                )
                volunteer_shifts.append(shift)
    except Exception as e:
        console.print(f"  [red]错误: 解析班次文件失败 - {e}[/red]")
    
    path = Path(devices)
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        from freq_coordinator.models import Device
        from datetime import datetime as dt
        
        for row in reader:
            try:
                frequencies_str = row.get("frequencies", "")
                frequencies = []
                if frequencies_str:
                    for freq_str in frequencies_str.split(";"):
                        try:
                            freq = float(freq_str.strip())
                            if 136 <= freq <= 174:
                                frequencies.append(freq)
                        except ValueError:
                            pass
                
                last_charged = None
                if row.get("last_charged"):
                    try:
                        last_charged = dt.fromisoformat(row["last_charged"].strip())
                    except ValueError:
                        pass
                
                device = Device(
                    id=row["id"].strip(),
                    type=row.get("type", "handheld").lower(),
                    model=row.get("model"),
                    status=row.get("status", "available").lower(),
                    battery_capacity_mah=int(row["battery_capacity_mah"].strip()),
                    current_charge_percent=int(row.get("current_charge_percent", "100").strip()),
                    power_consumption_ma=float(row.get("power_consumption_ma", "200.0").strip()),
                    standby_current_ma=float(row.get("standby_current_ma", "50.0").strip()),
                    frequencies=frequencies,
                    assigned_to=row.get("assigned_to"),
                    last_charged=last_charged,
                )
                device_list.append(device)
            except Exception as e:
                console.print(f"  [yellow]警告: 跳过无效设备 - {e}[/yellow]")
    
    console.print(f"  [green]✓[/green] 解析到 {len(supply_stations)} 个补给站")
    console.print(f"  [green]✓[/green] 解析到 {len(repeater_stations)} 个中继台")
    console.print(f"  [green]✓[/green] 解析到 {len(volunteer_shifts)} 个志愿者班次")
    console.print(f"  [green]✓[/green] 解析到 {len(device_list)} 个设备")
    
    console.print()
    console.print("[bold]第三步: 执行编排[/bold]")
    
    orchestrator = Orchestrator(
        stations=supply_stations,
        repeaters=repeater_stations,
        shifts=volunteer_shifts,
        devices=device_list,
        event_name=event_name,
    )
    
    plan = orchestrator.orchestrate()
    
    console.print(f"  [green]✓[/green] 生成 {len(plan.schedule)} 条编排记录")
    console.print(f"  [green]✓[/green] 分配 {len(plan.channel_plan)} 组频道")
    
    console.print()
    console.print("[bold]第四步: 风险检测[/bold]")
    
    risk_engine = RiskEngine(
        rules=orchestrator.rules,
        plan=plan,
        min_handover_minutes=min_handover,
        safety_margin_hours=safety_margin,
    )
    
    risks = risk_engine.run_all_detectors()
    plan.risks = risks
    
    summary = risk_engine.get_summary()
    critical_count = summary["by_severity"]["critical"]
    high_count = summary["by_severity"]["high"]
    medium_count = summary["by_severity"]["medium"]
    low_count = summary["by_severity"]["low"]
    
    console.print(f"  [red]严重风险: {critical_count}[/red]")
    console.print(f"  [yellow]高优先级: {high_count}[/yellow]")
    console.print(f"  [blue]中优先级: {medium_count}[/blue]")
    console.print(f"  [green]低优先级: {low_count}[/green]")
    
    if risks:
        console.print()
        console.print("[bold]风险详情:[/bold]")
        for risk in risks[:10]:
            severity_color = {
                "critical": "red",
                "high": "yellow",
                "medium": "blue",
                "low": "green",
            }.get(risk.severity, "white")
            
            console.print(
                f"  [{severity_color}]●[/{severity_color}] "
                f"[{risk.type.upper()}] {risk.title}"
            )
        
        if len(risks) > 10:
            console.print(f"  ... 还有 {len(risks) - 10} 项风险")
    
    console.print()
    console.print("[bold]第五步: 导出结果[/bold]")
    
    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if "markdown" in format:
        md_path = output_dir / f"communication_plan_{timestamp}.md"
        md_exporter = MarkdownExporter(plan)
        md_exporter.export(str(md_path))
        console.print(f"  [green]✓[/green] Markdown方案: {md_path}")
    
    if "csv" in format:
        csv_exporter = CSVExporter(plan)
        
        risks_path = output_dir / f"risks_{timestamp}.csv"
        csv_exporter.export_risks(str(risks_path))
        console.print(f"  [green]✓[/green] 风险清单CSV: {risks_path}")
        
        schedule_path = output_dir / f"schedule_{timestamp}.csv"
        csv_exporter.export_schedule(str(schedule_path))
        console.print(f"  [green]✓[/green] 排班表CSV: {schedule_path}")
    
    if "json" in format:
        json_path = output_dir / f"audit_package_{timestamp}.json"
        json_exporter = JSONExporter(plan)
        json_exporter.export_audit_package(str(json_path))
        console.print(f"  [green]✓[/green] JSON审计包: {json_path}")
    
    console.print()
    
    if risk_engine.has_critical_or_high_risks():
        console.print(Panel(
            "[bold yellow]编排完成，但存在严重或高优先级风险。[/bold yellow]\n"
            "请查看导出的风险清单并进行调整。",
            border_style="yellow"
        ))
    else:
        console.print(Panel(
            "[bold green]✓ 编排完成，无严重或高优先级风险。[/bold green]\n"
            f"输出文件已保存到: {output_dir.absolute()}",
            border_style="green"
        ))


@main.command()
@click.option("--stations", "-s", type=click.Path(exists=True), required=True, help="补给站CSV文件路径")
@click.option("--repeaters", "-r", type=click.Path(exists=True), required=True, help="中继台JSON文件路径")
@click.option("--shifts", "-t", type=click.Path(exists=True), required=True, help="志愿者班次ICS文件路径")
@click.option("--devices", "-d", type=click.Path(exists=True), required=True, help="设备清单CSV文件路径")
@click.option("--output", "-o", type=click.Path(), default="./output/schedule.csv", help="输出CSV文件路径")
def schedule(stations, repeaters, shifts, devices, output):
    """
    仅生成排班表
    
    不进行风险检测，只生成人员、设备和频道的编排结果。
    """
    from freq_coordinator.scheduler import Orchestrator
    
    console.print(Panel.fit(
        "[bold cyan]频点值守编排员 - 生成排班表[/bold cyan]\n"
        f"版本: {__version__}",
        border_style="cyan"
    ))
    
    import csv
    import json
    from ics import Calendar
    from datetime import timezone
    from freq_coordinator.models import (
        SupplyStation,
        RepeaterStation,
        VolunteerShift,
        Device,
    )
    from datetime import datetime as dt
    
    supply_stations = []
    path = Path(stations)
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                station = SupplyStation(
                    id=row["id"].strip(),
                    name=row["name"].strip(),
                    latitude=float(row["latitude"].strip()),
                    longitude=float(row["longitude"].strip()),
                    distance_from_start=float(row["distance_from_start"].strip()),
                    elevation=float(row.get("elevation", "0").strip()) if row.get("elevation") else 0.0,
                    criticality=row.get("criticality", "normal").lower(),
                    required_coverage=row.get("required_coverage", "true").lower() in ["true", "1", "yes"],
                    contact_person=row.get("contact_person"),
                )
                supply_stations.append(station)
            except Exception as e:
                console.print(f"  [yellow]警告: 跳过无效行 - {e}[/yellow]")
    
    repeater_stations = []
    path = Path(repeaters)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, dict):
            if "repeaters" in data:
                items = data["repeaters"]
            elif "stations" in data:
                items = data["stations"]
            else:
                items = [data]
        else:
            items = data
        for item in items:
            try:
                repeater = RepeaterStation(
                    id=str(item["id"]).strip(),
                    name=str(item["name"]).strip(),
                    latitude=float(item["latitude"]),
                    longitude=float(item["longitude"]),
                    elevation=float(item["elevation"]) if item.get("elevation") is not None else 0.0,
                    tx_frequency=float(item["tx_frequency"]),
                    rx_frequency=float(item["rx_frequency"]),
                    power=float(item.get("power", 25.0)),
                    antenna_gain=float(item.get("antenna_gain", 3.0)),
                    coverage_radius_km=float(item.get("coverage_radius_km", 5.0)),
                    height_agl=float(item.get("height_agl", 10.0)),
                    coverage_polygon=item.get("coverage_polygon"),
                )
                repeater_stations.append(repeater)
            except Exception as e:
                console.print(f"  [yellow]警告: 跳过无效中继台 - {e}[/yellow]")
    
    volunteer_shifts = []
    path = Path(shifts)
    with open(path, "r", encoding="utf-8") as f:
        cal = Calendar(f.read())
        
        def extract_field(text, field_name):
            if not text:
                return None
            patterns = [f"{field_name}:", f"{field_name}：", f"{field_name}="]
            for pattern in patterns:
                if pattern in text.lower():
                    lines = text.split('\n')
                    for line in lines:
                        lower_line = line.lower()
                        if pattern.lower() in lower_line:
                            pos = lower_line.find(pattern.lower())
                            if pos >= 0:
                                value = line[pos + len(pattern):].strip()
                                value = value.split(',')[0].split(';')[0].strip()
                                return value if value else None
            return None
        
        for idx, event in enumerate(cal.events, start=1):
            summary = getattr(event, 'summary', '') or ''
            description = getattr(event, 'description', '') or ''
            
            volunteer_name = extract_field(summary, 'name') or extract_field(description, 'name')
            volunteer_id = extract_field(summary, 'id') or extract_field(description, 'id') or f"vol-{idx:03d}"
            station_id = extract_field(summary, 'station') or extract_field(description, 'station')
            role = extract_field(summary, 'role') or extract_field(description, 'role') or 'operator'
            
            if not volunteer_name:
                volunteer_name = summary.strip() if summary else f"志愿者-{idx}"
            if not station_id:
                continue
            
            start_time = getattr(event, 'begin', None)
            end_time = getattr(event, 'end', None)
            
            if start_time and hasattr(start_time, 'datetime'):
                start_time = start_time.datetime
            if start_time and hasattr(start_time, 'tzinfo') and start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            if end_time and hasattr(end_time, 'datetime'):
                end_time = end_time.datetime
            if end_time and hasattr(end_time, 'tzinfo') and end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            
            if not start_time or not end_time:
                continue
            
            skills_str = extract_field(description, 'skills')
            skills = []
            if skills_str:
                skills = [s.strip() for s in skills_str.split(',') if s.strip()]
            
            shift = VolunteerShift(
                id=f"shift-{idx:04d}",
                volunteer_name=volunteer_name,
                volunteer_id=volunteer_id,
                station_id=station_id,
                start_time=start_time,
                end_time=end_time,
                role=role,
                skills=skills,
                phone=extract_field(description, 'phone'),
                assigned_device=None,
            )
            volunteer_shifts.append(shift)
    
    device_list = []
    path = Path(devices)
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                frequencies_str = row.get("frequencies", "")
                frequencies = []
                if frequencies_str:
                    for freq_str in frequencies_str.split(";"):
                        try:
                            freq = float(freq_str.strip())
                            if 136 <= freq <= 174:
                                frequencies.append(freq)
                        except ValueError:
                            pass
                
                last_charged = None
                if row.get("last_charged"):
                    try:
                        last_charged = dt.fromisoformat(row["last_charged"].strip())
                    except ValueError:
                        pass
                
                device = Device(
                    id=row["id"].strip(),
                    type=row.get("type", "handheld").lower(),
                    model=row.get("model"),
                    status=row.get("status", "available").lower(),
                    battery_capacity_mah=int(row["battery_capacity_mah"].strip()),
                    current_charge_percent=int(row.get("current_charge_percent", "100").strip()),
                    power_consumption_ma=float(row.get("power_consumption_ma", "200.0").strip()),
                    standby_current_ma=float(row.get("standby_current_ma", "50.0").strip()),
                    frequencies=frequencies,
                    assigned_to=row.get("assigned_to"),
                    last_charged=last_charged,
                )
                device_list.append(device)
            except Exception as e:
                pass
    
    orchestrator = Orchestrator(
        stations=supply_stations,
        repeaters=repeater_stations,
        shifts=volunteer_shifts,
        devices=device_list,
    )
    
    plan = orchestrator.orchestrate()
    
    csv_exporter = CSVExporter(plan)
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    csv_exporter.export_schedule(str(output_path))
    
    console.print(f"[green]✓ 排班表已生成: {output_path.absolute()}[/green]")
    console.print(f"共 {len(plan.schedule)} 条排班记录")


if __name__ == "__main__":
    main()
