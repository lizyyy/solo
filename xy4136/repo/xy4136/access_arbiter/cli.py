import click
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from . import __version__
from .config import ConfigManager
from .models import DataParser, CardSwipeEvent, PermissionRecord, ZoneDefinition
from .timeline import TimelineMerger, TimelineResult
from .rules import RuleEngine, RuleCheckResult, ViolationSeverity
from .arbitration import ArbitrationManager, ArbitrationSession, ArbitrationStatus, ArbitrationAction
from .exporter import ReportExporter


console = Console()


def get_project_dir() -> Path:
    return Path.cwd()


def ensure_project(ctx: click.Context, silent: bool = False) -> bool:
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    
    if not config_manager.exists():
        if not silent:
            console.print("[red]错误: 当前目录不是一个门禁仲裁项目。[/red]")
            console.print("请先运行 [yellow]access-arbiter init[/yellow] 初始化项目。")
        return False
    
    return True


@click.group()
@click.version_option(__version__, prog_name="access-arbiter")
def main():
    """门禁刷卡冲突仲裁器 - 离线同步多设备门禁事件的CLI工具"""
    pass


@main.command()
@click.argument("name", default="园区门禁项目")
def init(name: str):
    """初始化一个新的门禁仲裁项目
    
    创建项目配置文件和必要的目录结构。
    """
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    
    if config_manager.exists():
        console.print("[yellow]项目已存在。[/yellow]")
        return
    
    config = config_manager.init_project(name)
    
    console.print(Panel.fit(
        f"[green]项目初始化成功![/green]\n\n"
        f"项目名称: {config.name}\n"
        f"创建时间: {config.created_at}\n\n"
        f"目录结构:\n"
        f"  data/devices/      - 设备日志(JSON)\n"
        f"  data/permissions/  - 权限表(CSV)\n"
        f"  data/zones/        - 门区规则(CSV)\n"
        f"  output/            - 输出目录",
        title="门禁刷卡冲突仲裁器"
    ))


@main.command()
@click.option("--devices", "-d", "device_files", multiple=True, type=click.Path(exists=True, path_type=Path),
              help="设备日志JSON文件(可多次指定)")
@click.option("--permissions", "-p", type=click.Path(exists=True, path_type=Path),
              help="人员权限CSV文件")
@click.option("--zones", "-z", type=click.Path(exists=True, path_type=Path),
              help="门区规则CSV文件")
def import_data(device_files: List[Path], permissions: Optional[Path], zones: Optional[Path]):
    """导入设备日志、权限表和门区规则
    
    将数据文件复制到项目的data目录下。
    """
    if not ensure_project(None):
        sys.exit(1)
    
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    data_dir = config_manager.get_data_dir()
    
    devices_dir = data_dir / "devices"
    permissions_dir = data_dir / "permissions"
    zones_dir = data_dir / "zones"
    
    imported = []
    
    for device_file in device_files:
        dest = devices_dir / device_file.name
        import shutil
        shutil.copy2(device_file, dest)
        imported.append(f"设备日志: {device_file.name}")
    
    if permissions:
        dest = permissions_dir / permissions.name
        import shutil
        shutil.copy2(permissions, dest)
        imported.append(f"权限表: {permissions.name}")
    
    if zones:
        dest = zones_dir / zones.name
        import shutil
        shutil.copy2(zones, dest)
        imported.append(f"门区规则: {zones.name}")
    
    if imported:
        console.print("[green]导入成功:[/green]")
        for item in imported:
            console.print(f"  ✓ {item}")
    else:
        console.print("[yellow]没有指定要导入的文件。[/yellow]")


@main.command()
@click.option("--offset", "-o", "device_offsets", multiple=True,
              help="设备时钟偏移 (格式: device_id=seconds, 如: device01=-120)")
@click.option("--gap-threshold", "-g", type=int, default=60,
              help="时间缺口阈值(分钟), 默认60")
def reconcile(device_offsets: List[str], gap_threshold: int):
    """按设备时钟偏差合并事件时间线
    
    校正各设备的时钟偏差，合并成统一的时间线。
    """
    if not ensure_project(None):
        sys.exit(1)
    
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    data_dir = config_manager.get_data_dir()
    
    devices_dir = data_dir / "devices"
    device_files = list(devices_dir.glob("*.json"))
    
    if not device_files:
        console.print("[red]错误: 没有找到设备日志文件。[/red]")
        console.print(f"请将JSON文件放入 {devices_dir} 目录。")
        sys.exit(1)
    
    offsets_dict: dict = {}
    for offset_str in device_offsets:
        if "=" in offset_str:
            device_id, seconds = offset_str.split("=", 1)
            try:
                offsets_dict[device_id.strip()] = int(seconds.strip())
            except ValueError:
                console.print(f"[yellow]警告: 偏移值无效: {offset_str}[/yellow]")
    
    all_events: List[CardSwipeEvent] = []
    validation_results = []
    
    for json_file in device_files:
        events, result = DataParser.parse_device_log(json_file)
        all_events.extend(events)
        validation_results.append((json_file.name, result))
    
    console.print(f"读取了 {len(device_files)} 个设备文件")
    console.print(f"共 {len(all_events)} 个刷卡事件")
    
    for file_name, result in validation_results:
        if result.errors:
            console.print(f"[yellow]{file_name}: {result.valid_records}/{result.total_records} 有效, {len(result.errors)} 错误[/yellow]")
    
    merger = TimelineMerger()
    
    detected_offsets = merger.auto_detect_offsets(all_events, offsets_dict)
    
    for device_id, offset in detected_offsets.items():
        if device_id in offsets_dict:
            console.print(f"设备 {device_id}: 手动偏移 {offset.offset_seconds} 秒")
        else:
            console.print(f"设备 {device_id}: 默认偏移 {offset.offset_seconds} 秒 (置信度 {offset.confidence:.2f})")
    
    timeline_result = merger.merge_timeline(all_events, detected_offsets, gap_threshold)
    
    gaps = timeline_result.gaps
    if gaps:
        console.print(f"\n[yellow]检测到 {len(gaps)} 个时间缺口:[/yellow]")
        for gap in gaps[:5]:
            console.print(
                f"  设备 {gap.device_id}: "
                f"{gap.gap_start.strftime('%H:%M')} - {gap.gap_end.strftime('%H:%M')}, "
                f"持续 {gap.duration_minutes:.0f} 分钟"
            )
        if len(gaps) > 5:
            console.print(f"  ... 还有 {len(gaps) - 5} 个缺口")
    
    output_dir = config_manager.get_output_dir()
    import json
    
    def datetime_to_str(dt):
        return dt.isoformat() if dt else None
    
    timeline_json = {
        "generated_at": datetime.now().isoformat(),
        "total_events": timeline_result.total_events,
        "merged_count": timeline_result.merged_count,
        "device_offsets": {
            did: {
                "offset_seconds": do.offset_seconds,
                "confidence": do.confidence
            }
            for did, do in timeline_result.device_offsets.items()
        },
        "gaps": [
            {
                "device_id": g.device_id,
                "gap_start": datetime_to_str(g.gap_start),
                "gap_end": datetime_to_str(g.gap_end),
                "duration_minutes": g.duration_minutes
            }
            for g in timeline_result.gaps
        ]
    }
    
    timeline_file = output_dir / "timeline_latest.json"
    with open(timeline_file, "w", encoding="utf-8") as f:
        json.dump(timeline_json, f, indent=2, ensure_ascii=False, default=str)
    
    console.print(f"\n[green]时间线合并完成![/green]")
    console.print(f"结果已保存到: {timeline_file}")


@main.command()
@click.option("--duplicate-window", "-w", type=int, default=30,
              help="重复刷卡判定窗口(秒), 默认30")
@click.option("--no-anti-passback", is_flag=True,
              help="禁用反潜回检查")
def check(duplicate_window: int, no_anti_passback: bool):
    """检查违规事件
    
    标出撤权刷卡、门区不匹配、重复刷卡、进出方向断链等违规。
    """
    if not ensure_project(None):
        sys.exit(1)
    
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    data_dir = config_manager.get_data_dir()
    output_dir = config_manager.get_output_dir()
    
    devices_dir = data_dir / "devices"
    permissions_dir = data_dir / "permissions"
    zones_dir = data_dir / "zones"
    
    device_files = list(devices_dir.glob("*.json"))
    permission_files = list(permissions_dir.glob("*.csv"))
    zone_files = list(zones_dir.glob("*.csv"))
    
    if not device_files:
        console.print("[red]错误: 没有找到设备日志文件。[/red]")
        sys.exit(1)
    
    all_events: List[CardSwipeEvent] = []
    for json_file in device_files:
        events, _ = DataParser.parse_device_log(json_file)
        all_events.extend(events)
    
    permissions: List[PermissionRecord] = []
    for csv_file in permission_files:
        records, _ = DataParser.parse_permissions_csv(csv_file)
        permissions.extend(records)
    
    zones: List[ZoneDefinition] = []
    for csv_file in zone_files:
        z_records, _ = DataParser.parse_zones_csv(csv_file)
        zones.extend(z_records)
    
    console.print(f"加载数据:")
    console.print(f"  事件数: {len(all_events)}")
    console.print(f"  权限数: {len(permissions)}")
    console.print(f"  门区数: {len(zones)}")
    
    timeline_file = output_dir / "timeline_latest.json"
    import json
    
    timeline_result: Optional[TimelineResult] = None
    offsets_dict = {}
    
    if timeline_file.exists():
        with open(timeline_file, "r", encoding="utf-8") as f:
            timeline_data = json.load(f)
        
        for did, offset_info in timeline_data.get("device_offsets", {}).items():
            offsets_dict[did] = offset_info.get("offset_seconds", 0)
    
    merger = TimelineMerger()
    detected_offsets = merger.auto_detect_offsets(all_events, offsets_dict)
    timeline_result = merger.merge_timeline(all_events, detected_offsets)
    
    rule_engine = RuleEngine(
        permissions=permissions,
        zones=zones,
        duplicate_swipe_window_seconds=duplicate_window,
        anti_passback_enabled=not no_anti_passback
    )
    
    rule_result = rule_engine.check_all(timeline_result.merged_events)
    
    table = Table(title="违规统计")
    table.add_column("级别", style="cyan")
    table.add_column("数量", justify="right", style="magenta")
    
    severity_counts = rule_result.count_by_severity()
    for severity in [ViolationSeverity.CRITICAL, ViolationSeverity.HIGH, 
                    ViolationSeverity.MEDIUM, ViolationSeverity.LOW]:
        count = severity_counts.get(severity, 0)
        style = "red" if severity == ViolationSeverity.CRITICAL else "yellow" if severity == ViolationSeverity.HIGH else "white"
        table.add_row(severity.value, str(count), style=style)
    
    console.print(table)
    
    if rule_result.violations:
        console.print("\n[bold]违规详情:[/bold]")
        
        for i, v in enumerate(rule_result.violations[:10]):
            severity_style = {
                ViolationSeverity.CRITICAL: "bold red",
                ViolationSeverity.HIGH: "bold yellow",
                ViolationSeverity.MEDIUM: "bold white",
                ViolationSeverity.LOW: "dim"
            }.get(v.severity, "white")
            
            console.print(f"\n[{severity_style}]#{i+1} {v.violation_type.value}[/{severity_style}]")
            console.print(f"  时间: {v.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            console.print(f"  卡号: {v.card_id} | 门区: {v.zone_id} | 设备: {v.device_id}")
            console.print(f"  说明: {v.message}")
            if v.suggested_resolution:
                console.print(f"  建议: {v.suggested_resolution}")
        
        if len(rule_result.violations) > 10:
            console.print(f"\n... 还有 {len(rule_result.violations) - 10} 条违规")
    
    import json
    
    def datetime_to_str(dt):
        return dt.isoformat() if dt else None
    
    violations_json = {
        "generated_at": datetime.now().isoformat(),
        "total_checked": rule_result.total_checked,
        "violation_count": len(rule_result.violations),
        "by_severity": {
            str(k.value): v for k, v in rule_result.count_by_severity().items()
        },
        "by_type": {
            str(k.value): v for k, v in rule_result.count_by_type().items()
        },
        "violations": [
            {
                "event_index": v.event_index,
                "card_id": v.card_id,
                "timestamp": datetime_to_str(v.timestamp),
                "zone_id": v.zone_id,
                "device_id": v.device_id,
                "violation_type": v.violation_type.value,
                "severity": v.severity.value,
                "message": v.message,
                "suggested_resolution": v.suggested_resolution,
                "related_events": v.related_events
            }
            for v in rule_result.violations
        ]
    }
    
    violations_file = output_dir / "violations_latest.json"
    with open(violations_file, "w", encoding="utf-8") as f:
        json.dump(violations_json, f, indent=2, ensure_ascii=False, default=str)
    
    console.print(f"\n[green]违规检查完成![/green]")
    console.print(f"结果已保存到: {violations_file}")


@main.command()
@click.option("--list", "-l", "list_sessions", is_flag=True,
              help="列出所有仲裁会话")
@click.option("--session", "-s", type=str,
              help="指定会话ID进行操作")
@click.option("--confirm", "-c", type=int, multiple=True,
              help="确认指定事件索引的违规")
@click.option("--dismiss", "-d", type=int, multiple=True,
              help="驳回指定事件索引的违规")
@click.option("--note", "-n", type=str,
              help="添加仲裁备注")
@click.option("--new", is_flag=True,
              help="创建新的仲裁会话")
def review(list_sessions: bool, session: Optional[str], 
           confirm: tuple, dismiss: tuple, note: Optional[str], new: bool):
    """保存人工仲裁结果
    
    创建或更新仲裁会话，标记违规为确认/驳回。
    """
    if not ensure_project(None):
        sys.exit(1)
    
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    output_dir = config_manager.get_output_dir()
    
    arbitration_manager = ArbitrationManager(output_dir)
    
    if list_sessions:
        sessions = arbitration_manager.list_sessions()
        
        if not sessions:
            console.print("[yellow]没有找到仲裁会话。[/yellow]")
            return
        
        table = Table(title="仲裁会话列表")
        table.add_column("会话ID", style="cyan")
        table.add_column("创建时间", style="green")
        table.add_column("总数", justify="right")
        table.add_column("已解决", justify="right")
        table.add_column("待处理", justify="right")
        
        for s in sessions:
            table.add_row(
                s["session_id"],
                s["created_at"][:19] if s["created_at"] else "",
                str(s["total_violations"]),
                str(s["resolved_count"]),
                str(s["pending_count"])
            )
        
        console.print(table)
        return
    
    import json
    violations_file = output_dir / "violations_latest.json"
    
    if not violations_file.exists():
        console.print("[red]错误: 没有找到违规检查结果。[/red]")
        console.print("请先运行 [yellow]access-arbiter check[/yellow]。")
        sys.exit(1)
    
    current_session: Optional[ArbitrationSession] = None
    
    if new:
        from .rules import RuleViolation, ViolationType, ViolationSeverity
        
        with open(violations_file, "r", encoding="utf-8") as f:
            violations_data = json.load(f)
        
        violations_list = []
        for v_data in violations_data.get("violations", []):
            from datetime import datetime
            ts_str = v_data.get("timestamp")
            ts = datetime.fromisoformat(ts_str) if ts_str else datetime.now()
            
            violations_list.append(RuleViolation(
                event_index=v_data.get("event_index", 0),
                card_id=v_data.get("card_id", ""),
                timestamp=ts,
                zone_id=v_data.get("zone_id", ""),
                device_id=v_data.get("device_id", ""),
                violation_type=ViolationType(v_data["violation_type"]) if v_data.get("violation_type") else ViolationType.UNAUTHORIZED_PERSON,
                severity=ViolationSeverity(v_data["severity"]) if v_data.get("severity") else ViolationSeverity.MEDIUM,
                message=v_data.get("message", ""),
                suggested_resolution=v_data.get("suggested_resolution")
            ))
        
        current_session = arbitration_manager.create_session(violations_list)
        saved_path = arbitration_manager.save_session(current_session)
        
        console.print(f"[green]创建新仲裁会话: {current_session.session_id}[/green]")
        console.print(f"已保存到: {saved_path}")
    
    elif session:
        try:
            current_session = arbitration_manager.load_session(session)
            console.print(f"[green]加载会话: {session}[/green]")
        except FileNotFoundError:
            console.print(f"[red]错误: 会话 {session} 不存在。[/red]")
            sys.exit(1)
    else:
        sessions = arbitration_manager.list_sessions()
        if sessions:
            latest_session = sessions[0]
            current_session = arbitration_manager.load_session(latest_session["session_id"])
            console.print(f"[green]加载最新会话: {latest_session['session_id']}[/green]")
        else:
            console.print("[yellow]没有找到现有会话。使用 --new 创建新会话。[/yellow]")
            return
    
    if current_session:
        updated = False
        
        for event_idx in confirm:
            success = arbitration_manager.update_record(
                current_session,
                event_index=event_idx,
                status=ArbitrationStatus.CONFIRMED,
                action=ArbitrationAction.VALIDATE_EVENT,
                notes=note or "",
                resolution="管理员确认违规有效"
            )
            if success:
                console.print(f"[green]已确认违规 #{event_idx}[/green]")
                updated = True
        
        for event_idx in dismiss:
            success = arbitration_manager.update_record(
                current_session,
                event_index=event_idx,
                status=ArbitrationStatus.DISMISSED,
                action=ArbitrationAction.INVALIDATE_EVENT,
                notes=note or "",
                resolution="管理员驳回, 判定为误报"
            )
            if success:
                console.print(f"[yellow]已驳回违规 #{event_idx}[/yellow]")
                updated = True
        
        if updated:
            saved_path = arbitration_manager.save_session(current_session)
            console.print(f"\n仲裁会话已更新: {saved_path}")
        
        console.print(f"\n[bold]会话状态:[/bold]")
        console.print(f"  总违规数: {current_session.total_violations}")
        console.print(f"  已解决: {current_session.resolved_count}")
        console.print(f"  待处理: {current_session.pending_count}")
        
        pending = arbitration_manager.get_pending_records(current_session)
        if pending:
            console.print(f"\n[bold]待处理违规 ({len(pending)} 条):[/bold]")
            for r in pending[:5]:
                console.print(
                    f"  #{r.event_index} {r.violation_type.value if r.violation_type else 'unknown'} "
                    f"- {r.card_id} @ {r.timestamp.strftime('%H:%M') if r.timestamp else 'N/A'}"
                )
            if len(pending) > 5:
                console.print(f"  ... 还有 {len(pending) - 5} 条")


@main.command()
@click.option("--format", "-f", "formats", multiple=True,
              type=click.Choice(["json", "csv", "markdown", "all"]),
              default=["all"],
              help="输出格式 (默认: all)")
@click.option("--prefix", "-p", type=str, default="",
              help="输出文件名前缀")
@click.option("--session", "-s", type=str,
              help="指定仲裁会话ID")
def report(formats: tuple, prefix: str, session: Optional[str]):
    """导出审计报告
    
    导出 Markdown/CSV/JSON 格式的审计报告。
    """
    if not ensure_project(None):
        sys.exit(1)
    
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    data_dir = config_manager.get_data_dir()
    output_dir = config_manager.get_output_dir()
    
    import json
    from datetime import datetime
    
    devices_dir = data_dir / "devices"
    permissions_dir = data_dir / "permissions"
    zones_dir = data_dir / "zones"
    
    device_files = list(devices_dir.glob("*.json"))
    permission_files = list(permissions_dir.glob("*.csv"))
    zone_files = list(zones_dir.glob("*.csv"))
    
    all_events: List[CardSwipeEvent] = []
    for json_file in device_files:
        events, _ = DataParser.parse_device_log(json_file)
        all_events.extend(events)
    
    permissions: List[PermissionRecord] = []
    for csv_file in permission_files:
        records, _ = DataParser.parse_permissions_csv(csv_file)
        permissions.extend(records)
    
    zones: List[ZoneDefinition] = []
    for csv_file in zone_files:
        z_records, _ = DataParser.parse_zones_csv(csv_file)
        zones.extend(z_records)
    
    timeline_file = output_dir / "timeline_latest.json"
    offsets_dict = {}
    
    if timeline_file.exists():
        with open(timeline_file, "r", encoding="utf-8") as f:
            timeline_data = json.load(f)
        
        for did, offset_info in timeline_data.get("device_offsets", {}).items():
            offsets_dict[did] = offset_info.get("offset_seconds", 0)
    
    merger = TimelineMerger()
    detected_offsets = merger.auto_detect_offsets(all_events, offsets_dict)
    timeline_result = merger.merge_timeline(all_events, detected_offsets)
    
    rule_engine = RuleEngine(
        permissions=permissions,
        zones=zones
    )
    rule_result = rule_engine.check_all(timeline_result.merged_events)
    
    arbitration_manager = ArbitrationManager(output_dir)
    arbitration_session: Optional[ArbitrationSession] = None
    
    if session:
        try:
            arbitration_session = arbitration_manager.load_session(session)
            console.print(f"[green]使用仲裁会话: {session}[/green]")
        except FileNotFoundError:
            console.print(f"[yellow]警告: 会话 {session} 不存在。[/yellow]")
    else:
        sessions = arbitration_manager.list_sessions()
        if sessions:
            arbitration_session = arbitration_manager.load_session(sessions[0]["session_id"])
            console.print(f"[green]使用最新仲裁会话: {sessions[0]['session_id']}[/green]")
    
    exporter = ReportExporter(output_dir)
    
    output_formats = set(formats)
    if "all" in output_formats:
        output_formats = {"json", "csv", "markdown"}
    
    console.print(f"\n[bold]生成报告...[/bold]")
    console.print(f"  事件数: {timeline_result.total_events}")
    console.print(f"  违规数: {len(rule_result.violations)}")
    console.print(f"  格式: {', '.join(output_formats)}")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_filename = f"{prefix}report_{timestamp}" if prefix else f"report_{timestamp}"
    
    generated_paths = {}
    
    if "json" in output_formats:
        path = exporter.export_json(
            timeline_result, rule_result, arbitration_session,
            output_dir / f"{base_filename}.json"
        )
        generated_paths["json"] = path
        console.print(f"  [green]✓[/green] JSON: {path.name}")
    
    if "csv" in output_formats:
        path = exporter.export_csv(
            timeline_result, rule_result, arbitration_session,
            output_dir / f"{base_filename}.csv"
        )
        generated_paths["csv"] = path
        console.print(f"  [green]✓[/green] CSV: {path.name}")
    
    if "markdown" in output_formats:
        path = exporter.export_markdown(
            timeline_result, rule_result, arbitration_session,
            output_dir / f"{base_filename}.md"
        )
        generated_paths["markdown"] = path
        console.print(f"  [green]✓[/green] Markdown: {path.name}")
    
    console.print(f"\n[green]报告生成完成![/green]")
    console.print(f"输出目录: {output_dir}")


@main.command()
def status():
    """显示项目当前状态"""
    if not ensure_project(None):
        sys.exit(1)
    
    project_dir = get_project_dir()
    config_manager = ConfigManager(project_dir)
    config = config_manager.load()
    data_dir = config_manager.get_data_dir()
    output_dir = config_manager.get_output_dir()
    
    devices_dir = data_dir / "devices"
    permissions_dir = data_dir / "permissions"
    zones_dir = data_dir / "zones"
    
    device_files = list(devices_dir.glob("*.json"))
    permission_files = list(permissions_dir.glob("*.csv"))
    zone_files = list(zones_dir.glob("*.csv"))
    
    timeline_file = output_dir / "timeline_latest.json"
    violations_file = output_dir / "violations_latest.json"
    
    table = Table(title=f"项目状态: {config.name}")
    table.add_column("项目", style="cyan")
    table.add_column("状态", style="green")
    
    table.add_row("创建时间", config.created_at[:19] if config.created_at else "N/A")
    table.add_row("设备日志", f"{len(device_files)} 个文件")
    table.add_row("权限表", f"{len(permission_files)} 个文件")
    table.add_row("门区规则", f"{len(zone_files)} 个文件")
    table.add_row("时间线", "已生成" if timeline_file.exists() else "未生成")
    table.add_row("违规检查", "已完成" if violations_file.exists() else "未检查")
    
    console.print(table)
    
    import json
    
    if timeline_file.exists():
        with open(timeline_file, "r", encoding="utf-8") as f:
            tl_data = json.load(f)
        
        console.print(f"\n[bold]时间线数据:[/bold]")
        console.print(f"  总事件数: {tl_data.get('total_events', 0)}")
        console.print(f"  设备偏移: {len(tl_data.get('device_offsets', {}))} 个设备")
        console.print(f"  时间缺口: {len(tl_data.get('gaps', []))} 个")
    
    if violations_file.exists():
        with open(violations_file, "r", encoding="utf-8") as f:
            v_data = json.load(f)
        
        console.print(f"\n[bold]违规数据:[/bold]")
        console.print(f"  检查事件数: {v_data.get('total_checked', 0)}")
        console.print(f"  违规总数: {v_data.get('violation_count', 0)}")
        
        by_severity = v_data.get('by_severity', {})
        if by_severity:
            for sev, count in by_severity.items():
                style = "red" if sev == "critical" else "yellow" if sev == "high" else "white"
                console.print(f"    [{style}]{sev}: {count}[/{style}]")


import shutil

if __name__ == "__main__":
    main()
