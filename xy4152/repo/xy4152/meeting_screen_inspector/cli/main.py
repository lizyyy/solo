import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from meeting_screen_inspector.models.models import (
    DeviceType,
    InspectionSession,
    DeviceInspection,
    DeviceIdentity,
    RiskLevel,
)
from meeting_screen_inspector.parsers import (
    SerialLogParser,
    BluetoothParser,
    ConfigParser,
)
from meeting_screen_inspector.rules import RuleEngine
from meeting_screen_inspector.storage import StorageManager
from meeting_screen_inspector.exporters import Exporter


console = Console()
storage = StorageManager()


def get_session_or_exit(session_id: Optional[str]) -> InspectionSession:
    if not session_id:
        sessions = storage.list_sessions()
        if not sessions:
            console.print("[red]错误：没有找到会话，请先使用 scan 命令导入数据[/red]")
            sys.exit(1)
        session_id = sessions[0].session_id
        console.print(f"[yellow]提示：使用最近的会话: {session_id}[/yellow]")
    
    session = storage.load_session(session_id)
    if not session:
        console.print(f"[red]错误：找不到会话 {session_id}[/red]")
        sys.exit(1)
    
    return session


@click.group()
@click.version_option(version='1.0.0', prog_name='msi')
def cli():
    """会议屏串口巡检盒 - 运维工具
    
    用于巡检会议屏和投屏盒的串口日志、蓝牙广播和配置文件。
    """
    pass


@cli.command()
@click.argument('source', type=click.Path(exists=True, file_okay=True, dir_okay=True))
@click.option('--name', '-n', help='会话名称')
@click.option('--device-type', '-t', type=click.Choice(['meeting_screen', 'casting_box', 'auto']), 
              default='auto', help='设备类型，默认自动检测')
@click.option('--baud-rate', '-b', type=int, default=115200, help='预期波特率，默认115200')
@click.option('--session-id', '-s', help='指定会话ID（追加到现有会话）')
def scan(source, name, device_type, baud_rate, session_id):
    """导入多设备数据包（目录或文件）
    
    SOURCE: 源目录或文件路径
    
    支持的文件类型：
    - .log, .txt: 串口日志
    - .json: 蓝牙快照或设备配置
    - 目录: 会自动扫描子目录中的设备
    """
    source_path = Path(source)
    
    if session_id:
        session = storage.load_session(session_id)
        if not session:
            console.print(f"[red]错误：找不到会话 {session_id}[/red]")
            sys.exit(1)
    else:
        session_id = storage.create_session(name)
        session = InspectionSession(
            session_id=session_id,
            name=name,
            created_at=datetime.now(),
        )
    
    serial_parser = SerialLogParser()
    bt_parser = BluetoothParser()
    config_parser = ConfigParser()
    
    files_to_process: List[Path] = []
    
    if source_path.is_file():
        files_to_process.append(source_path)
    else:
        for ext in ['*.log', '*.txt', '*.json']:
            files_to_process.extend(source_path.rglob(ext))
    
    if not files_to_process:
        console.print("[yellow]警告：没有找到可处理的文件[/yellow]")
        sys.exit(0)
    
    console.print(f"[green]找到 {len(files_to_process)} 个文件待处理[/green]")
    
    devices_by_dir: dict = {}
    
    for file_path in files_to_process:
        parent_dir = file_path.parent.name
        if parent_dir not in devices_by_dir:
            devices_by_dir[parent_dir] = {
                'serial_logs': [],
                'bluetooth_files': [],
                'config_files': [],
            }
        
        ext = file_path.suffix.lower()
        if ext in ['.log', '.txt']:
            devices_by_dir[parent_dir]['serial_logs'].append(file_path)
        elif ext == '.json':
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            if 'bluetooth' in content.lower() or 'address' in content.lower() or 'rssi' in content.lower():
                devices_by_dir[parent_dir]['bluetooth_files'].append(file_path)
            else:
                devices_by_dir[parent_dir]['config_files'].append(file_path)
    
    for dir_name, files in devices_by_dir.items():
        device_id = dir_name
        location = None
        
        match = re.search(r'([A-Za-z_]+-?\d+)', dir_name)
        if match:
            device_id = match.group(1)
        
        dt = DeviceType.MEETING_SCREEN
        if 'casting' in dir_name.lower() or 'box' in dir_name.lower() or '投屏' in dir_name:
            dt = DeviceType.CASTING_BOX
        elif device_type == 'casting_box':
            dt = DeviceType.CASTING_BOX
        elif device_type == 'meeting_screen':
            dt = DeviceType.MEETING_SCREEN
        
        identity = DeviceIdentity(
            device_type=dt,
            device_id=device_id,
            location=location or dir_name,
        )
        
        serial_log = None
        if files['serial_logs']:
            first_log = files['serial_logs'][0]
            console.print(f"  解析串口日志: {first_log.name}")
            serial_log = serial_parser.parse_file(first_log, expected_baudrate=baud_rate)
        
        bluetooth_snapshot = None
        if files['bluetooth_files']:
            first_bt = files['bluetooth_files'][0]
            console.print(f"  解析蓝牙快照: {first_bt.name}")
            bluetooth_snapshot = bt_parser.parse_file(first_bt)
        
        config = None
        if files['config_files']:
            first_cfg = files['config_files'][0]
            console.print(f"  解析配置文件: {first_cfg.name}")
            config = config_parser.parse_file(first_cfg)
        
        source_files = [str(f) for f in files['serial_logs'] + files['bluetooth_files'] + files['config_files']]
        
        existing = next(
            (d for d in session.devices if d.identity.device_id == device_id),
            None
        )
        
        if existing:
            console.print(f"[yellow]  更新已有设备: {device_id}[/yellow]")
            if serial_log:
                existing.serial_log = serial_log
            if bluetooth_snapshot:
                existing.bluetooth_snapshot = bluetooth_snapshot
            if config:
                existing.config = config
            existing.source_files.extend(source_files)
        else:
            device = DeviceInspection(
                identity=identity,
                serial_log=serial_log,
                bluetooth_snapshot=bluetooth_snapshot,
                config=config,
                source_files=source_files,
            )
            session.devices.append(device)
            console.print(f"[green]  添加设备: {device_id} ({dt.value})[/green]")
    
    storage.save_session(session)
    
    console.print("")
    console.print(Panel.fit(
        f"[bold green]导入完成[/bold green]\n"
        f"会话ID: {session.session_id}\n"
        f"设备数: {len(session.devices)}",
        title="结果"
    ))


@cli.command()
@click.option('--session-id', '-s', help='会话ID，默认使用最近的会话')
@click.option('--device-id', '-d', help='仅显示指定设备的解析结果')
def parse(session_id, device_id):
    """解析串口日志/蓝牙广播/配置并显示结果
    
    显示当前会话中所有设备的解析结果摘要。
    """
    session = get_session_or_exit(session_id)
    
    console.print(f"\n[bold]会话: {session.session_id}[/bold]")
    if session.name:
        console.print(f"名称: {session.name}")
    console.print("")
    
    for device in session.devices:
        if device_id and device.identity.device_id != device_id:
            continue
        
        table = Table(title=f"设备: {device.identity.device_id}")
        table.add_column("属性", style="cyan")
        table.add_column("值", style="green")
        
        table.add_row("设备类型", device.identity.device_type.value)
        table.add_row("位置", device.identity.location or "-")
        table.add_row("采集时间", str(device.collected_at))
        
        if device.serial_log:
            table.add_row("串口日志", device.serial_log.filename)
            table.add_row("  检测版本", device.serial_log.detected_version or "-")
            table.add_row("  重启次数", str(device.serial_log.reboot_count))
            table.add_row("  日志条目", str(len(device.serial_log.entries)))
            if device.serial_log.port_info:
                table.add_row("  波特率", f"{device.serial_log.port_info.baud_rate} (检测: {device.serial_log.port_info.detected_baud_rate or '-'})")
        
        if device.bluetooth_snapshot:
            table.add_row("蓝牙快照", f"{len(device.bluetooth_snapshot.devices)} 个设备")
        
        if device.config:
            table.add_row("配置文件", "已加载")
            table.add_row("  配置版本", device.config.version or "-")
            table.add_row("  配置设备ID", device.config.device_id or "-")
            table.add_row("  配置键数", str(len(device.config.all_keys)))
        
        table.add_row("源文件", ", ".join(device.source_files) if device.source_files else "-")
        
        console.print(table)
        console.print("")


@cli.command()
@click.option('--session-id', '-s', help='会话ID，默认使用最近的会话')
@click.option('--reboot-threshold', type=int, default=3, help='重启次数阈值，默认3次')
@click.option('--expected-baudrate', type=int, default=115200, help='预期波特率，默认115200')
@click.option('--save/--no-save', default=True, help='是否保存检查结果到会话')
def check(session_id, reboot_threshold, expected_baudrate, save):
    """检查并标出版本漂移、重启循环、地址重复、配置缺项和回滚风险
    
    执行所有规则检查并显示风险摘要。
    """
    session = get_session_or_exit(session_id)
    
    from meeting_screen_inspector.rules import (
        VersionDriftRule,
        RebootLoopRule,
        AddressDuplicateRule,
        ConfigMissingRule,
        RollbackRiskRule,
        BaudrateErrorRule,
        RuleEngine,
    )
    
    engine = RuleEngine(rules=[
        VersionDriftRule(),
        RebootLoopRule(reboot_threshold=reboot_threshold),
        AddressDuplicateRule(),
        ConfigMissingRule(),
        RollbackRiskRule(),
        BaudrateErrorRule(expected_baudrate=expected_baudrate),
    ])
    
    session = engine.run_and_update_status(session)
    
    if save:
        storage.save_session(session)
    
    summary = session.summary
    
    console.print("\n[bold yellow]========== 检查结果 ==========[/bold yellow]\n")
    
    summary_table = Table(title="风险摘要")
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("数量", style="green")
    
    summary_table.add_row("总设备数", str(summary.get('total_devices', 0)))
    summary_table.add_row("有风险设备", str(summary.get('devices_with_risks', 0)))
    summary_table.add_row("无风险设备", str(summary.get('devices_clean', 0)))
    summary_table.add_row("总风险数", str(summary.get('total_risks', 0)))
    
    risk_by_level = summary.get('risk_count_by_level', {})
    summary_table.add_row("  严重 (CRITICAL)", f"[red]{risk_by_level.get('critical', 0)}[/red]")
    summary_table.add_row("  高 (HIGH)", f"[orange]{risk_by_level.get('high', 0)}[/orange]")
    summary_table.add_row("  中 (MEDIUM)", f"[yellow]{risk_by_level.get('medium', 0)}[/yellow]")
    summary_table.add_row("  低 (LOW)", f"[green]{risk_by_level.get('low', 0)}[/green]")
    
    console.print(summary_table)
    console.print("")
    
    if session.device_statuses:
        devices_table = Table(title="设备风险详情")
        devices_table.add_column("设备ID", style="cyan")
        devices_table.add_column("类型")
        devices_table.add_column("版本")
        devices_table.add_column("风险数")
        devices_table.add_column("状态")
        
        for device_id, status in session.device_statuses.items():
            risk_style = "red" if status.has_critical_risk else "orange" if status.risk_count > 0 else "green"
            confirmed_style = "green" if status.confirmed else "yellow"
            
            devices_table.add_row(
                device_id,
                status.device_type.value,
                status.version or "-",
                f"[{risk_style}]{status.risk_count}[/{risk_style}]",
                f"[{confirmed_style}]{'已确认' if status.confirmed else '未确认'}[/{confirmed_style}]",
            )
        
        console.print(devices_table)
        console.print("")
    
    for device_id, status in session.device_statuses.items():
        if status.risks:
            console.print(f"\n[bold]设备 {device_id} 的风险:[/bold]")
            for risk in status.risks:
                level_color = {
                    RiskLevel.CRITICAL: "red",
                    RiskLevel.HIGH: "orange",
                    RiskLevel.MEDIUM: "yellow",
                    RiskLevel.LOW: "green",
                }.get(risk.level, "white")
                
                console.print(
                    f"  [{level_color}]●[/{level_color}] "
                    f"[{level_color}]{risk.risk_type.value}[/{level_color}] "
                    f"({risk.level.value}): {risk.description}"
                )
                if risk.suggestion:
                    console.print(f"    [italic]建议: {risk.suggestion}[/italic]")


@cli.command('confirm')
@click.argument('device_id', required=False)
@click.option('--session-id', '-s', help='会话ID，默认使用最近的会话')
@click.option('--all', '-a', is_flag=True, help='确认所有设备')
@click.option('--by', '-b', help='确认人姓名')
@click.option('--notes', '-n', help='备注信息')
def confirm_device(device_id, session_id, all, by, notes):
    """人工确认设备状态
    
    DEVICE_ID: 要确认的设备ID（使用 --all 确认所有）
    """
    session = get_session_or_exit(session_id)
    
    if all:
        count = storage.confirm_all_devices(session.session_id, confirmed_by=by)
        console.print(f"[green]已确认 {count} 个设备[/green]")
    elif device_id:
        status = storage.confirm_device_status(
            session.session_id,
            device_id,
            confirmed_by=by,
            notes=notes or "",
        )
        if status:
            console.print(f"[green]已确认设备 {device_id}[/green]")
        else:
            console.print(f"[red]未找到设备 {device_id}[/red]")
    else:
        console.print("[yellow]请指定设备ID或使用 --all 选项[/yellow]")


@cli.command()
@click.option('--session-id', '-s', help='会话ID，默认使用最近的会话')
@click.option('--output-dir', '-o', type=click.Path(), default='.', help='输出目录，默认当前目录')
@click.option('--prefix', '-p', help='输出文件名前缀')
@click.option('--format', '-f', type=click.Choice(['all', 'markdown', 'csv', 'rollback']), 
              default='all', help='导出格式')
@click.option('--device-id', '-d', help='仅导出指定设备的回滚包（仅 rollback 格式）')
def export(session_id, output_dir, prefix, format, device_id):
    """导出巡检报告、风险清单和回滚包
    
    支持格式：
    - markdown: Markdown 巡检报告
    - csv: CSV 风险清单
    - rollback: JSON 回滚包
    - all: 导出所有格式（默认）
    """
    session = get_session_or_exit(session_id)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    exporter = Exporter(session)
    
    if prefix is None:
        prefix = f"inspection_{session.session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    results = {}
    
    if format in ['all', 'markdown']:
        md_path = output_path / f"{prefix}.md"
        results['markdown'] = exporter.export_markdown(md_path)
        console.print(f"[green]已导出 Markdown 报告: {md_path}[/green]")
    
    if format in ['all', 'csv']:
        csv_path = output_path / f"{prefix}_risks.csv"
        results['csv'] = exporter.export_csv(csv_path)
        console.print(f"[green]已导出 CSV 风险清单: {csv_path}[/green]")
    
    if format in ['all', 'rollback']:
        rollback_path = output_path / f"{prefix}_rollback.json"
        results['rollback'] = exporter.export_rollback(rollback_path, device_id)
        if device_id:
            console.print(f"[green]已导出设备 {device_id} 的回滚包: {rollback_path}[/green]")
        else:
            console.print(f"[green]已导出回滚包: {rollback_path}[/green]")
    
    console.print("")
    console.print(Panel.fit(
        "[bold green]导出完成[/bold green]\n" +
        "\n".join([f"- {k}: {v}" for k, v in results.items()]),
        title="结果"
    ))


@cli.command('list')
@click.option('--limit', '-l', type=int, default=10, help='显示最近的N个会话')
def list_sessions(limit):
    """列出历史巡检会话"""
    sessions = storage.list_sessions()
    
    if not sessions:
        console.print("[yellow]没有找到历史会话[/yellow]")
        return
    
    table = Table(title="历史会话")
    table.add_column("会话ID", style="cyan")
    table.add_column("名称")
    table.add_column("创建时间")
    table.add_column("设备数")
    table.add_column("风险数")
    table.add_column("状态")
    
    for session in sessions[:limit]:
        status_color = "green" if session.confirmed else "yellow"
        table.add_row(
            session.session_id,
            session.name or "-",
            session.created_at.strftime('%Y-%m-%d %H:%M'),
            str(session.total_devices),
            str(session.total_risks),
            f"[{status_color}]{'已确认' if session.confirmed else '未确认'}[/{status_color}]",
        )
    
    console.print(table)


@cli.command()
@click.argument('session_id')
def delete(session_id):
    """删除指定的巡检会话
    
    SESSION_ID: 要删除的会话ID
    """
    if storage.delete_session(session_id):
        console.print(f"[green]已删除会话: {session_id}[/green]")
    else:
        console.print(f"[red]未找到会话: {session_id}[/red]")


if __name__ == '__main__':
    cli()
