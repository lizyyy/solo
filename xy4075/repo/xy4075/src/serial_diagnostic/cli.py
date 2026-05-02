import os
import sys
from pathlib import Path
from typing import Optional, List, Union

import click
import yaml
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from .models import (
    ProtocolConfig, ProtocolType, RegisterType,
    FrameFormat, RegisterDefinition
)
from .parser import LogParserFactory, LogParserError
from .analyzer import ProtocolAnalyzer, AnalysisResult, AnomalySeverity
from .replay import ReplayScheduler, Breakpoint, BreakpointType, ReplayStatus
from .fault_injection import (
    FaultInjectionConfig, FaultType, InjectionTriggerType
)
from .exporter import ReportExporter


console = Console()


def load_config(config_path: Union[str, Path]) -> ProtocolConfig:
    path = Path(config_path)
    if not path.exists():
        console.print(f"[red]错误: 配置文件不存在: {config_path}[/red]")
        sys.exit(1)
    
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    frame_formats = []
    if 'frame_formats' in data:
        for fmt in data['frame_formats']:
            frame_formats.append(FrameFormat(**fmt))
    
    registers = []
    if 'registers' in data:
        for reg in data['registers']:
            registers.append(RegisterDefinition(**reg))
    
    data['frame_formats'] = frame_formats
    data['registers'] = registers
    
    return ProtocolConfig(**data)


def save_config(config: ProtocolConfig, config_path: Union[str, Path]) -> None:
    path = Path(config_path)
    data = config.to_dict()
    
    with open(path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    
    console.print(f"[green]配置文件已保存: {path}[/green]")


@click.group()
@click.version_option(version='1.0.0', prog_name='serial-diag')
def main():
    """
    串口协议回放诊断台 - 嵌入式测试工具
    
    用于解析、回放、分析串口/Modbus协议日志，支持故障注入和报告导出。
    """
    pass


@main.command()
@click.argument('config_path', type=click.Path())
@click.option('--protocol', '-p', type=click.Choice(['modbus_rtu', 'modbus_ascii', 'custom_serial']),
              default='modbus_rtu', help='协议类型')
@click.option('--baud-rate', '-b', type=int, default=9600, help='波特率')
@click.option('--timeout', '-t', type=int, default=1000, help='超时时间(毫秒)')
@click.option('--slave-range', '-s', type=str, default='1-247', help='从机地址范围 (如: 1-247)')
@click.option('--register-range', '-r', type=str, default='0-65535', help='寄存器地址范围')
def init(config_path: str, protocol: str, baud_rate: int, timeout: int,
         slave_range: str, register_range: str):
    """
    初始化协议配置文件
    
    CONFIG_PATH: 配置文件输出路径 (如: config.yaml)
    """
    console.print(Panel.fit("[bold blue]初始化协议配置[/bold blue]"))
    
    try:
        slave_min, slave_max = map(int, slave_range.split('-'))
        reg_min, reg_max = map(int, register_range.split('-'))
    except ValueError:
        console.print("[red]错误: 范围格式应为 'min-max' (如: 1-247)[/red]")
        sys.exit(1)
    
    protocol_type = ProtocolType(protocol)
    
    config = ProtocolConfig(
        name=f"{protocol}_config",
        protocol_type=protocol_type,
        baud_rate=baud_rate,
        timeout_ms=timeout,
        slave_address_range=(slave_min, slave_max),
        register_range=(reg_min, reg_max),
        frame_formats=[
            FrameFormat(
                name="modbus_rtu_standard",
                pattern=r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+([RTX])\s+([0-9A-Fa-f\s]+)$",
                description="标准Modbus RTU日志格式"
            )
        ],
        registers=[
            RegisterDefinition(
                address=0,
                name="Device_ID",
                type=RegisterType.HOLDING_REGISTER,
                description="设备ID寄存器"
            )
        ]
    )
    
    save_config(config, config_path)
    
    table = Table(title="配置摘要")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    table.add_row("协议类型", protocol)
    table.add_row("波特率", str(baud_rate))
    table.add_row("超时时间", f"{timeout}ms")
    table.add_row("从机地址范围", f"{slave_min}-{slave_max}")
    table.add_row("寄存器范围", f"{reg_min}-{reg_max}")
    
    console.print(table)


@main.command('import-log')
@click.argument('log_path', type=click.Path(exists=True))
@click.option('--config', '-c', type=click.Path(exists=True), required=True,
              help='协议配置文件路径')
@click.option('--output', '-o', type=click.Path(), help='解析结果输出路径(JSON)')
@click.option('--validate/--no-validate', default=True, help='是否校验帧')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def import_log(log_path: str, config: str, output: Optional[str], 
               validate: bool, verbose: bool):
    """
    导入并解析串口/Modbus日志文件
    
    LOG_PATH: 日志文件路径
    """
    console.print(Panel.fit("[bold blue]导入并解析日志[/bold blue]"))
    
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task("加载配置...", total=None)
            protocol_config = load_config(config)
            
            progress.add_task("解析日志...", total=None)
            parser = LogParserFactory.create(protocol_config)
            session = parser.parse_file(log_path)
        
        table = Table(title="解析结果")
        table.add_column("项目", style="cyan")
        table.add_column("值", style="green")
        table.add_row("会话ID", session.session_id)
        table.add_row("总帧数", str(session.frame_count))
        table.add_row("持续时间", f"{session.duration:.3f}秒" if session.duration > 0 else "N/A")
        table.add_row("源文件", session.metadata.get('source_file', 'N/A'))
        
        console.print(table)
        
        if verbose and session.frames:
            console.print("\n[bold]前10帧预览:[/bold]")
            frame_table = Table()
            frame_table.add_column("#", style="dim")
            frame_table.add_column("时间戳", style="cyan")
            frame_table.add_column("方向", style="yellow")
            frame_table.add_column("从机", style="green")
            frame_table.add_column("功能码", style="blue")
            frame_table.add_column("有效", style="magenta")
            frame_table.add_column("原始数据", style="dim")
            
            for idx, frame in enumerate(session.frames[:10]):
                valid = "✓" if (frame.validation_result and frame.validation_result.is_valid) else "✗"
                raw_hex = frame.raw_data.hex()[:40] + "..." if len(frame.raw_data) > 20 else frame.raw_data.hex()
                
                frame_table.add_row(
                    str(idx),
                    f"{frame.timestamp:.6f}",
                    frame.direction.value,
                    str(frame.slave_address) if frame.slave_address else "-",
                    frame.function_code if frame.function_code else "-",
                    valid,
                    raw_hex
                )
            
            console.print(frame_table)
        
        if output:
            from .exporter import JSONExporter
            from .analyzer import AnalysisResult
            
            result = AnalysisResult(
                session_id=session.session_id,
                total_frames=session.frame_count,
                valid_frames=sum(1 for f in session.frames if f.validation_result and f.validation_result.is_valid),
                invalid_frames=sum(1 for f in session.frames if f.validation_result and not f.validation_result.is_valid),
                anomalies=[]
            )
            
            exporter = JSONExporter(result, session=session)
            exporter.export(output)
            console.print(f"\n[green]解析结果已保存到: {output}[/green]")
        
        invalid_frames = [
            f for f in session.frames 
            if f.validation_result and not f.validation_result.is_valid
        ]
        if invalid_frames:
            console.print(f"\n[yellow]警告: 检测到 {len(invalid_frames)} 个无效帧[/yellow]")
            for f in invalid_frames[:5]:
                if f.validation_result:
                    for error in f.validation_result.errors:
                        console.print(f"  - 帧 {f.metadata.get('line_number', '?')}: {error}")
    
    except LogParserError as e:
        console.print(f"[red]解析错误: {e}[/red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option('--config', '-c', type=click.Path(exists=True), required=True,
              help='协议配置文件路径')
@click.option('--log', '-l', type=click.Path(exists=True), help='日志文件路径')
@click.option('--session', '-s', type=click.Path(exists=True), help='已解析的会话JSON文件路径')
@click.option('--speed', '-x', type=float, default=1.0, help='回放倍速 (如: 2.0 表示2倍速)')
@click.option('--timeout', '-t', type=int, help='超时时间(毫秒), 覆盖配置')
@click.option('--breakpoint', '-b', type=str, multiple=True,
              help='断点设置 (格式: type:value, 如: frame:5 或 slave:1)')
@click.option('--inject-fault', '-i', type=str, multiple=True,
              help='故障注入 (格式: fault_type@trigger_type=value, 如: corrupt_crc@frame=5)')
@click.option('--from-frame', type=int, default=0, help='从指定帧开始')
@click.option('--step', is_flag=True, help='单步模式')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def replay(config: str, log: Optional[str], session: Optional[str],
           speed: float, timeout: Optional[int], breakpoint: List[str],
           inject_fault: List[str], from_frame: int, step: bool, verbose: bool):
    """
    回放会话,支持倍速、断点和故障注入
    """
    console.print(Panel.fit("[bold blue]回放会话[/bold blue]"))
    
    protocol_config = load_config(config)
    if timeout:
        protocol_config.timeout_ms = timeout
    
    parsed_session = None
    
    if log:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task("解析日志...", total=None)
            parser = LogParserFactory.create(protocol_config)
            parsed_session = parser.parse_file(log)
    
    elif session:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task("加载会话...", total=None)
            import json
            with open(session, 'r', encoding='utf-8') as f:
                data = json.load(f)
            from .models import ParsedFrame, FrameDirection
            
            frames = []
            for f_data in data.get('session', {}).get('frames', []):
                raw_data = bytes.fromhex(f_data['raw_data_hex']) if f_data.get('raw_data_hex') else b''
                data_bytes = bytes.fromhex(f_data['data_hex']) if f_data.get('data_hex') else None
                
                frame = ParsedFrame(
                    raw_data=raw_data,
                    timestamp=f_data['timestamp'],
                    direction=FrameDirection(f_data['direction']),
                    slave_address=f_data['slave_address'],
                    function_code=f_data['function_code'],
                    register_address=f_data['register_address'],
                    register_count=f_data['register_count'],
                    data=data_bytes,
                    crc=f_data['crc'],
                    metadata=f_data.get('metadata', {})
                )
                frames.append(frame)
            
            from .models import ParsedSession
            session_data = data.get('session', {})
            parsed_session = ParsedSession(
                session_id=session_data.get('session_id', 'loaded'),
                start_time=session_data.get('start_time'),
                end_time=session_data.get('end_time'),
                frames=frames,
                metadata=session_data.get('metadata', {})
            )
    else:
        console.print("[red]错误: 必须指定 --log 或 --session 参数[/red]")
        sys.exit(1)
    
    if not parsed_session or not parsed_session.frames:
        console.print("[red]错误: 没有可回放的帧[/red]")
        sys.exit(1)
    
    scheduler = ReplayScheduler(parsed_session)
    scheduler.speed_multiplier = speed
    
    for bp_spec in breakpoint:
        try:
            bp_type_str, value_str = bp_spec.split(':', 1)
            
            bp_type_map = {
                'frame': BreakpointType.FRAME_INDEX,
                'time': BreakpointType.TIME_OFFSET,
                'slave': BreakpointType.SLAVE_ADDRESS,
                'func': BreakpointType.FUNCTION_CODE,
                'state': BreakpointType.STATE_TRANSITION,
                'error': BreakpointType.ERROR_FRAME,
            }
            
            if bp_type_str not in bp_type_map:
                console.print(f"[yellow]未知断点类型: {bp_type_str}, 忽略[/yellow]")
                continue
            
            bp_type = bp_type_map[bp_type_str]
            
            value: Any = value_str
            if bp_type in [BreakpointType.FRAME_INDEX, BreakpointType.SLAVE_ADDRESS]:
                try:
                    value = int(value_str)
                except ValueError:
                    if '-' in value_str:
                        parts = value_str.split('-')
                        value = list(range(int(parts[0]), int(parts[1]) + 1))
                    elif ',' in value_str:
                        value = [int(x.strip()) for x in value_str.split(',')]
            
            bp = Breakpoint(breakpoint_type=bp_type, value=value, name=bp_spec)
            scheduler.add_breakpoint(bp)
            console.print(f"[cyan]已添加断点: {bp_spec}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]断点格式错误 '{bp_spec}': {e}[/yellow]")
    
    for fault_spec in inject_fault:
        try:
            fault_part, trigger_part = fault_spec.split('@', 1)
            trigger_type_str, trigger_value_str = trigger_part.split('=', 1)
            
            fault_type_map = {
                'drop': FaultType.DROP_FRAME,
                'duplicate': FaultType.DUPLICATE_FRAME,
                'delay': FaultType.DELAY_FRAME,
                'corrupt_crc': FaultType.CORRUPT_CRC,
                'corrupt_data': FaultType.CORRUPT_DATA,
                'corrupt_slave': FaultType.CORRUPT_SLAVE_ADDRESS,
                'corrupt_func': FaultType.CORRUPT_FUNCTION_CODE,
                'garbage': FaultType.INSERT_GARBAGE,
                'truncate': FaultType.TRUNCATE_FRAME,
                'timeout': FaultType.TIMEOUT,
            }
            
            trigger_type_map = {
                'frame': InjectionTriggerType.FRAME_INDEX,
                'time': InjectionTriggerType.TIME_OFFSET,
                'random': InjectionTriggerType.RANDOM,
                'slave': InjectionTriggerType.SLAVE_ADDRESS,
                'func': InjectionTriggerType.FUNCTION_CODE,
                'reg': InjectionTriggerType.REGISTER_ADDRESS,
            }
            
            if fault_part not in fault_type_map:
                console.print(f"[yellow]未知故障类型: {fault_part}, 忽略[/yellow]")
                continue
            
            if trigger_type_str not in trigger_type_map:
                console.print(f"[yellow]未知触发类型: {trigger_type_str}, 忽略[/yellow]")
                continue
            
            fault_type = fault_type_map[fault_part]
            trigger_type = trigger_type_map[trigger_type_str]
            
            trigger_value: Any = trigger_value_str
            if trigger_type == InjectionTriggerType.FRAME_INDEX:
                try:
                    trigger_value = int(trigger_value_str)
                except ValueError:
                    if ',' in trigger_value_str:
                        trigger_value = [int(x.strip()) for x in trigger_value_str.split(',')]
            
            fi_config = FaultInjectionConfig(
                fault_type=fault_type,
                trigger_type=trigger_type,
                trigger_value=trigger_value,
                name=fault_spec
            )
            scheduler.add_fault_config(fi_config)
            console.print(f"[cyan]已添加故障注入: {fault_spec}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]故障注入格式错误 '{fault_spec}': {e}[/yellow]")
    
    if step:
        console.print("\n[bold]单步模式[/bold]")
        console.print("按 Enter 执行下一帧, 输入 'q' 退出\n")
        
        scheduler.jump_to(from_frame)
        
        while scheduler.current_frame_index < len(parsed_session.frames):
            frame = parsed_session.frames[scheduler.current_frame_index]
            
            if verbose:
                console.print(f"\n[cyan]帧 #{scheduler.current_frame_index}[/cyan]")
                console.print(f"  时间戳: {frame.timestamp:.6f}")
                console.print(f"  方向: {frame.direction.value}")
                console.print(f"  从机: {frame.slave_address}")
                console.print(f"  功能码: {frame.function_code}")
                console.print(f"  数据: {frame.raw_data.hex()}")
            
            has_more = scheduler.step()
            
            if not verbose:
                console.print(f"处理帧 #{scheduler.current_frame_index - 1}")
            
            if scheduler.events:
                last_event = scheduler.events[-1]
                if last_event.event_type == 'breakpoint':
                    console.print(f"\n[yellow]命中断点: {last_event.breakpoint.name if last_event.breakpoint else 'N/A'}[/yellow]")
                
                if scheduler.fault_manager.get_history():
                    last_injection = scheduler.fault_manager.get_history()[-1]
                    if last_injection.frame_index == scheduler.current_frame_index - 1:
                        console.print(f"[magenta]故障注入: {last_injection.fault_type.value}[/magenta]")
            
            console.print("")
            user_input = input("按 Enter 继续, 输入 'q' 退出 > ").strip().lower()
            if user_input == 'q':
                console.print("[yellow]用户中断[/yellow]")
                break
    else:
        console.print(f"\n开始回放... (倍速: {speed}x, 起始帧: {from_frame})")
        
        if verbose:
            def on_frame(frame, idx):
                console.print(f"[cyan]帧 #{idx}: {frame.direction.value}[/cyan]")
            scheduler.on_frame(on_frame)
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("回放中...", total=len(parsed_session.frames))
            
            def on_frame_progress(frame, idx):
                progress.update(task, completed=idx + 1)
            
            scheduler.on_frame(on_frame_progress)
            scheduler.start(from_frame=from_frame)
    
    stats = scheduler.stats
    console.print(f"\n[bold green]回放完成[/bold green]")
    
    stats_table = Table(title="回放统计")
    stats_table.add_column("项目", style="cyan")
    stats_table.add_column("值", style="green")
    stats_table.add_row("总帧数", str(stats.total_frames))
    stats_table.add_row("已处理", str(stats.processed_frames))
    stats_table.add_row("状态迁移", str(stats.state_transitions))
    stats_table.add_row("无效迁移", str(stats.invalid_transitions))
    stats_table.add_row("命中断点", str(stats.breakpoints_hit))
    stats_table.add_row("故障注入", str(stats.injections_applied))
    stats_table.add_row("回放耗时", f"{stats.duration:.3f}秒")
    
    console.print(stats_table)


@main.command()
@click.option('--config', '-c', type=click.Path(exists=True), required=True,
              help='协议配置文件路径')
@click.option('--log', '-l', type=click.Path(exists=True), help='日志文件路径')
@click.option('--session', '-s', type=click.Path(exists=True), help='已解析的会话JSON文件路径')
@click.option('--timeout', '-t', type=int, help='超时时间(毫秒)')
@click.option('--output', '-o', type=click.Path(), help='分析结果输出路径')
@click.option('--format', '-f', type=click.Choice(['json', 'csv', 'all']), default='all',
              help='输出格式')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def analyze(config: str, log: Optional[str], session: Optional[str],
            timeout: Optional[int], output: Optional[str], format: str,
            verbose: bool):
    """
    分析会话,检测超时、乱序、重复帧和状态迁移异常
    """
    console.print(Panel.fit("[bold blue]分析会话[/bold blue]"))
    
    protocol_config = load_config(config)
    if timeout:
        protocol_config.timeout_ms = timeout
    
    parsed_session = None
    
    if log:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task("解析日志...", total=None)
            parser = LogParserFactory.create(protocol_config)
            parsed_session = parser.parse_file(log)
    
    elif session:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task("加载会话...", total=None)
            import json
            with open(session, 'r', encoding='utf-8') as f:
                data = json.load(f)
            from .models import ParsedFrame, FrameDirection
            
            frames = []
            for f_data in data.get('session', {}).get('frames', []):
                raw_data = bytes.fromhex(f_data['raw_data_hex']) if f_data.get('raw_data_hex') else b''
                data_bytes = bytes.fromhex(f_data['data_hex']) if f_data.get('data_hex') else None
                
                frame = ParsedFrame(
                    raw_data=raw_data,
                    timestamp=f_data['timestamp'],
                    direction=FrameDirection(f_data['direction']),
                    slave_address=f_data['slave_address'],
                    function_code=f_data['function_code'],
                    register_address=f_data['register_address'],
                    register_count=f_data['register_count'],
                    data=data_bytes,
                    crc=f_data['crc'],
                    metadata=f_data.get('metadata', {})
                )
                frames.append(frame)
            
            from .models import ParsedSession
            session_data = data.get('session', {})
            parsed_session = ParsedSession(
                session_id=session_data.get('session_id', 'loaded'),
                start_time=session_data.get('start_time'),
                end_time=session_data.get('end_time'),
                frames=frames,
                metadata=session_data.get('metadata', {})
            )
    else:
        console.print("[red]错误: 必须指定 --log 或 --session 参数[/red]")
        sys.exit(1)
    
    if not parsed_session or not parsed_session.frames:
        console.print("[red]错误: 没有可分析的帧[/red]")
        sys.exit(1)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        progress.add_task("分析中...", total=None)
        
        analyzer = ProtocolAnalyzer(
            protocol_config,
            timeout_ms=protocol_config.timeout_ms
        )
        result = analyzer.analyze(parsed_session)
    
    overview_table = Table(title="分析结果概览")
    overview_table.add_column("项目", style="cyan")
    overview_table.add_column("值", style="green")
    overview_table.add_row("会话ID", result.session_id)
    overview_table.add_row("总帧数", str(result.total_frames))
    overview_table.add_row("有效帧", str(result.valid_frames))
    overview_table.add_row("无效帧", str(result.invalid_frames))
    overview_table.add_row("异常总数", str(result.anomaly_count))
    
    console.print(overview_table)
    
    if result.anomaly_count > 0:
        console.print("\n[bold]异常分布:[/bold]")
        dist_table = Table()
        dist_table.add_column("异常类型", style="cyan")
        dist_table.add_column("数量", style="yellow")
        
        for anomaly_type, count in result.stats.get('by_type', {}).items():
            dist_table.add_row(anomaly_type, str(count))
        
        console.print(dist_table)
        
        critical = result.get_critical_anomalies()
        high = result.get_high_anomalies()
        
        if critical:
            console.print(f"\n[red][bold]严重异常 ({len(critical)} 个):[/bold][/red]")
            for a in critical[:5]:
                console.print(f"  - [{a.frame_index}] {a.message}")
        
        if high:
            console.print(f"\n[yellow][bold]高优先级异常 ({len(high)} 个):[/bold][/yellow]")
            for a in high[:5]:
                console.print(f"  - [{a.frame_index}] {a.message}")
        
        if verbose:
            console.print("\n[bold]所有异常详情:[/bold]")
            for idx, a in enumerate(result.anomalies, 1):
                severity_color = {
                    AnomalySeverity.CRITICAL: 'red',
                    AnomalySeverity.HIGH: 'yellow',
                    AnomalySeverity.MEDIUM: 'cyan',
                    AnomalySeverity.LOW: 'dim',
                    AnomalySeverity.INFO: 'green'
                }.get(a.severity, 'white')
                
                console.print(f"\n[{severity_color}]异常 #{idx} ({a.anomaly_type.value})[/{severity_color}]")
                console.print(f"  时间戳: {a.timestamp:.6f}")
                console.print(f"  帧索引: {a.frame_index}")
                console.print(f"  严重程度: {a.severity.value}")
                console.print(f"  描述: {a.message}")
                if a.details:
                    console.print(f"  详情: {a.details}")
                if a.recommendations:
                    console.print(f"  建议:")
                    for rec in a.recommendations:
                        console.print(f"    - {rec}")
    else:
        console.print("\n[green]太棒了! 未检测到任何异常[/green]")
    
    if output:
        exporter = ReportExporter(
            analysis_result=result,
            session=parsed_session,
            protocol_config=protocol_config
        )
        
        base_path = Path(output)
        
        if format == 'json' or format == 'all':
            json_path = base_path.with_suffix('.json')
            exporter.export_json(json_path)
            console.print(f"\n[green]JSON 报告已保存: {json_path}[/green]")
        
        if format == 'csv' or format == 'all':
            csv_path = base_path.with_suffix('.csv')
            exporter.export_csv(csv_path)
            console.print(f"[green]CSV 异常清单已保存: {csv_path}[/green]")
        
        if format == 'all':
            md_path = base_path.with_suffix('.md')
            exporter.export_markdown(md_path)
            console.print(f"[green]Markdown 报告已保存: {md_path}[/green]")


@main.command()
@click.argument('output_path', type=click.Path())
@click.option('--config', '-c', type=click.Path(exists=True), required=True,
              help='协议配置文件路径')
@click.option('--log', '-l', type=click.Path(exists=True), help='日志文件路径')
@click.option('--session', '-s', type=click.Path(exists=True), help='已解析的会话JSON文件路径')
@click.option('--analysis', '-a', type=click.Path(exists=True), help='分析结果JSON文件路径')
@click.option('--format', '-f', type=click.Choice(['markdown', 'csv', 'json', 'all']), default='all',
              help='导出格式')
@click.option('--include-session/--no-session', default=True, help='是否包含完整会话数据(仅JSON)')
def export(output_path: str, config: str, log: Optional[str], session: Optional[str],
           analysis: Optional[str], format: str, include_session: bool):
    """
    导出诊断报告、异常清单和回放包
    
    OUTPUT_PATH: 输出文件基础路径
    """
    console.print(Panel.fit("[bold blue]导出报告[/bold blue]"))
    
    protocol_config = load_config(config)
    
    parsed_session = None
    analysis_result = None
    
    if analysis:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task("加载分析结果...", total=None)
            import json
            with open(analysis, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            from .analyzer import Anomaly, AnomalyType, AnomalySeverity
            anomalies = []
            for a_data in data.get('analysis', {}).get('anomalies', []):
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType(a_data['type']),
                    severity=AnomalySeverity(a_data['severity']),
                    timestamp=a_data['timestamp'],
                    frame_index=a_data['frame_index'],
                    related_frame_index=a_data['related_frame_index'],
                    message=a_data['message'],
                    details=a_data.get('details', {}),
                    recommendations=a_data.get('recommendations', [])
                ))
            
            analysis_data = data.get('analysis', {})
            analysis_result = AnalysisResult(
                session_id=data.get('session_id', 'exported'),
                total_frames=analysis_data.get('total_frames', 0),
                valid_frames=analysis_data.get('valid_frames', 0),
                invalid_frames=analysis_data.get('invalid_frames', 0),
                anomalies=anomalies,
                stats=analysis_data.get('stats', {})
            )
            
            if include_session and 'session' in data:
                from .models import ParsedFrame, FrameDirection, ParsedSession
                session_data = data['session']
                frames = []
                for f_data in session_data.get('frames', []):
                    raw_data = bytes.fromhex(f_data['raw_data_hex']) if f_data.get('raw_data_hex') else b''
                    data_bytes = bytes.fromhex(f_data['data_hex']) if f_data.get('data_hex') else None
                    
                    frame = ParsedFrame(
                        raw_data=raw_data,
                        timestamp=f_data['timestamp'],
                        direction=FrameDirection(f_data['direction']),
                        slave_address=f_data['slave_address'],
                        function_code=f_data['function_code'],
                        register_address=f_data['register_address'],
                        register_count=f_data['register_count'],
                        data=data_bytes,
                        crc=f_data['crc'],
                        metadata=f_data.get('metadata', {})
                    )
                    frames.append(frame)
                
                parsed_session = ParsedSession(
                    session_id=session_data.get('session_id', 'loaded'),
                    start_time=session_data.get('start_time'),
                    end_time=session_data.get('end_time'),
                    frames=frames,
                    metadata=session_data.get('metadata', {})
                )
    
    if not analysis_result:
        if log:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                progress.add_task("解析日志...", total=None)
                parser = LogParserFactory.create(protocol_config)
                parsed_session = parser.parse_file(log)
                
                progress.add_task("分析会话...", total=None)
                analyzer = ProtocolAnalyzer(protocol_config)
                analysis_result = analyzer.analyze(parsed_session)
        
        elif session:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                progress.add_task("加载会话...", total=None)
                import json
                with open(session, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                from .models import ParsedFrame, FrameDirection, ParsedSession
                
                session_data = data.get('session', {})
                frames = []
                for f_data in session_data.get('frames', []):
                    raw_data = bytes.fromhex(f_data['raw_data_hex']) if f_data.get('raw_data_hex') else b''
                    data_bytes = bytes.fromhex(f_data['data_hex']) if f_data.get('data_hex') else None
                    
                    frame = ParsedFrame(
                        raw_data=raw_data,
                        timestamp=f_data['timestamp'],
                        direction=FrameDirection(f_data['direction']),
                        slave_address=f_data['slave_address'],
                        function_code=f_data['function_code'],
                        register_address=f_data['register_address'],
                        register_count=f_data['register_count'],
                        data=data_bytes,
                        crc=f_data['crc'],
                        metadata=f_data.get('metadata', {})
                    )
                    frames.append(frame)
                
                parsed_session = ParsedSession(
                    session_id=session_data.get('session_id', 'loaded'),
                    start_time=session_data.get('start_time'),
                    end_time=session_data.get('end_time'),
                    frames=frames,
                    metadata=session_data.get('metadata', {})
                )
                
                progress.add_task("分析会话...", total=None)
                analyzer = ProtocolAnalyzer(protocol_config)
                analysis_result = analyzer.analyze(parsed_session)
        else:
            console.print("[red]错误: 必须指定 --analysis、--log 或 --session 参数[/red]")
            sys.exit(1)
    
    if not analysis_result:
        console.print("[red]错误: 没有可导出的数据[/red]")
        sys.exit(1)
    
    exporter = ReportExporter(
        analysis_result=analysis_result,
        session=parsed_session if include_session else None,
        protocol_config=protocol_config
    )
    
    base_path = Path(output_path)
    
    exported = []
    
    if format == 'markdown' or format == 'all':
        md_path = base_path.with_suffix('.md')
        exporter.export_markdown(md_path)
        exported.append(str(md_path))
    
    if format == 'csv' or format == 'all':
        csv_path = base_path.with_suffix('.csv')
        exporter.export_csv(csv_path)
        exported.append(str(csv_path))
    
    if format == 'json' or format == 'all':
        json_path = base_path.with_suffix('.json')
        exporter.export_json(json_path)
        exported.append(str(json_path))
    
    console.print("\n[bold green]导出完成[/bold green]")
    console.print("\n导出的文件:")
    for path in exported:
        console.print(f"  [green]- {path}[/green]")
    
    console.print(f"\n报告包含: {analysis_result.anomaly_count} 个异常")


if __name__ == '__main__':
    main()
