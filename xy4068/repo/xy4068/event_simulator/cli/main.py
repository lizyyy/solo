import json
import os
import signal
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from event_simulator import __version__
from event_simulator.models.config import AppConfig
from event_simulator.models.event import Event
from event_simulator.models.jitter_rule import JitterRule, JitterType
from event_simulator.replay_scheduler.scheduler import ReplayScheduler, ReplayStatus
from event_simulator.scenario_parser.parser import ScenarioParser
from event_simulator.state_storage.storage import StateStorage
from event_simulator.validation.validator import Validator
from event_simulator.reporter.generator import ReportGenerator

console = Console()


class Context:
    def __init__(self):
        self.work_dir: Path = Path.cwd()
        self.config_path: Path = self.work_dir / ".event-simulator" / "config.json"
        self.config: Optional[AppConfig] = None
        self.verbose: bool = False
    
    def load_config(self) -> Optional[AppConfig]:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.config = AppConfig(**data)
                return self.config
            except Exception:
                pass
        return None
    
    def save_config(self, config: AppConfig):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config.to_dict(), f, indent=2, ensure_ascii=False)
        self.config = config
    
    def get_scenarios_dir(self) -> Path:
        if self.config:
            return self.work_dir / self.config.init.scenarios_dir
        return self.work_dir / "scenarios"
    
    def get_data_dir(self) -> Path:
        if self.config:
            return self.work_dir / self.config.init.data_dir
        return self.work_dir / "data"
    
    def get_reports_dir(self) -> Path:
        if self.config:
            return self.work_dir / self.config.init.reports_dir
        return self.work_dir / "reports"
    
    def get_state_dir(self) -> Path:
        if self.config:
            return self.work_dir / self.config.init.state_dir
        return self.work_dir / "state"


pass_context = click.make_pass_decorator(Context)


@click.group()
@click.version_option(__version__, "-v", "--version")
@click.option("-C", "--directory", type=click.Path(exists=True, file_okay=False), help="工作目录")
@click.option("-V", "--verbose", is_flag=True, help="显示详细输出")
@click.pass_context
def cli(ctx: click.Context, directory: Optional[str], verbose: bool):
    """边缘 AI 摄像头算法验收事件流仿真器"""
    context = Context()
    if directory:
        context.work_dir = Path(directory)
    context.verbose = verbose
    context.load_config()
    ctx.obj = context


@cli.command()
@click.option("--force", "-f", is_flag=True, help="强制初始化，覆盖现有配置")
@pass_context
def init(ctx: Context, force: bool):
    """初始化工作目录，创建配置和场景目录"""
    
    if ctx.config and not force:
        console.print(Panel.fit(
            "[yellow]工作目录已初始化[/yellow]\n"
            f"  配置文件: {ctx.config_path}\n"
            "使用 --force 强制重新初始化",
            title="提示",
            style="yellow",
        ))
        return
    
    config = AppConfig()
    
    scenarios_dir = ctx.work_dir / config.init.scenarios_dir
    data_dir = ctx.work_dir / config.init.data_dir
    reports_dir = ctx.work_dir / config.init.reports_dir
    state_dir = ctx.work_dir / config.init.state_dir
    
    for d in [scenarios_dir, data_dir, reports_dir, state_dir]:
        d.mkdir(parents=True, exist_ok=True)
    
    ctx.save_config(config)
    
    tree = Tree(f"[bold green]{ctx.work_dir}[/bold green]")
    tree.add(f"[dim].event-simulator/[/dim]")
    tree.add(f"[blue]{config.init.scenarios_dir}/[/blue] (场景配置)")
    tree.add(f"[blue]{config.init.data_dir}/[/blue] (事件数据 CSV/JSON)")
    tree.add(f"[blue]{config.init.reports_dir}/[/blue] (报告输出)")
    tree.add(f"[blue]{config.init.state_dir}/[/blue] (状态存储)")
    
    console.print(Panel.fit(
        tree,
        title=f"初始化成功 - v{config.init.version}",
        style="green",
    ))
    
    console.print("\n[dim]下一步操作:[/dim]")
    console.print("  1. [cyan]event-simulator scenario list[/cyan] - 查看场景")
    console.print("  2. [cyan]event-simulator scenario create[/cyan] - 创建新场景")
    console.print("  3. [cyan]event-simulator replay --help[/cyan] - 查看回放命令")


@cli.group()
def scenario():
    """管理场景、摄像头、区域、事件模板和抖动规则"""
    pass


@scenario.command(name="list")
@pass_context
def scenario_list(ctx: Context):
    """列出所有场景"""
    scenarios_dir = ctx.get_scenarios_dir()
    
    if not scenarios_dir.exists():
        console.print("[yellow]场景目录不存在，请先运行 init[/yellow]")
        return
    
    scenario_files = list(scenarios_dir.glob("*.json"))
    
    if not scenario_files:
        console.print("[yellow]暂无场景[/yellow]")
        return
    
    table = Table(title="场景列表")
    table.add_column("ID", style="cyan")
    table.add_column("名称", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("运行次数", style="magenta")
    table.add_column("上次运行", style="dim")
    
    for sf in scenario_files:
        try:
            with open(sf, "r", encoding="utf-8") as f:
                data = json.load(f)
            table.add_row(
                data.get("id", "?"),
                data.get("name", "?"),
                data.get("status", "?"),
                str(data.get("run_count", 0)),
                data.get("last_run_at", "-")[:19] if data.get("last_run_at") else "-",
            )
        except Exception:
            table.add_row(sf.stem, "[red]读取错误[/red]", "", "", "")
    
    console.print(table)


@scenario.command(name="create")
@click.option("--id", "scenario_id", required=True, help="场景唯一标识")
@click.option("--name", required=True, help="场景名称")
@click.option("--description", "-d", default="", help="场景描述")
@click.option("--tag", "-t", multiple=True, help="场景标签（可多次使用）")
@pass_context
def scenario_create(ctx: Context, scenario_id: str, name: str, description: str, tag: tuple):
    """创建新场景"""
    scenarios_dir = ctx.get_scenarios_dir()
    scenarios_dir.mkdir(parents=True, exist_ok=True)
    
    scenario_path = scenarios_dir / f"{scenario_id}.json"
    
    if scenario_path.exists():
        console.print(f"[red]场景已存在: {scenario_id}[/red]")
        return
    
    from event_simulator.models.scenario import Scenario, ScenarioStatus
    
    scenario = Scenario(
        id=scenario_id,
        name=name,
        description=description,
        status=ScenarioStatus.DRAFT,
        tags=list(tag),
    )
    
    with open(scenario_path, "w", encoding="utf-8") as f:
        json.dump(scenario.to_dict(), f, indent=2, ensure_ascii=False)
    
    console.print(Panel.fit(
        f"[green]场景创建成功[/green]\n"
        f"  ID: {scenario_id}\n"
        f"  名称: {name}\n"
        f"  文件: {scenario_path}",
        title="创建场景",
        style="green",
    ))


@scenario.command(name="show")
@click.argument("scenario_id")
@pass_context
def scenario_show(ctx: Context, scenario_id: str):
    """显示场景详情"""
    scenarios_dir = ctx.get_scenarios_dir()
    scenario_path = scenarios_dir / f"{scenario_id}.json"
    
    if not scenario_path.exists():
        console.print(f"[red]场景不存在: {scenario_id}[/red]")
        return
    
    with open(scenario_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    console.print(Panel.fit(
        json.dumps(data, indent=2, ensure_ascii=False),
        title=f"场景: {scenario_id}",
        style="cyan",
    ))


@scenario.command(name="add-camera")
@click.argument("scenario_id")
@click.option("--id", "camera_id", required=True, help="摄像头ID")
@click.option("--name", required=True, help="摄像头名称")
@click.option("--location", required=True, help="安装位置")
@click.option("--ip", help="IP地址")
@click.option("--model", help="型号")
@pass_context
def scenario_add_camera(ctx: Context, scenario_id: str, camera_id: str, name: str, location: str, ip: Optional[str], model: Optional[str]):
    """向场景添加摄像头"""
    scenarios_dir = ctx.get_scenarios_dir()
    scenario_path = scenarios_dir / f"{scenario_id}.json"
    
    if not scenario_path.exists():
        console.print(f"[red]场景不存在: {scenario_id}[/red]")
        return
    
    with open(scenario_path, "r", encoding="utf-8") as f:
        scenario_data = json.load(f)
    
    from event_simulator.models.camera import Camera
    
    camera = Camera(
        id=camera_id,
        name=name,
        location=location,
        ip_address=ip,
        model=model,
    )
    
    cameras_dir = scenarios_dir / scenario_id / "cameras"
    cameras_dir.mkdir(parents=True, exist_ok=True)
    
    camera_path = cameras_dir / f"{camera_id}.json"
    with open(camera_path, "w", encoding="utf-8") as f:
        json.dump(camera.to_dict(), f, indent=2, ensure_ascii=False)
    
    if camera_id not in scenario_data.get("cameras", []):
        scenario_data.setdefault("cameras", []).append(camera_id)
        scenario_data["updated_at"] = datetime.now().isoformat()
        
        with open(scenario_path, "w", encoding="utf-8") as f:
            json.dump(scenario_data, f, indent=2, ensure_ascii=False)
    
    console.print(f"[green]摄像头已添加: {camera_id} -> {name}[/green]")


@scenario.command(name="add-jitter")
@click.argument("scenario_id")
@click.option("--id", "rule_id", required=True, help="规则ID")
@click.option("--name", required=True, help="规则名称")
@click.option("--type", "jitter_type", type=click.Choice([
    "network_delay", "packet_loss", "out_of_order", 
    "timestamp_drift", "duplicate", "camera_blocked"
]), required=True, help="抖动类型")
@click.option("--probability", type=float, default=0.1, help="触发概率 0.0-1.0")
@click.option("--delay-min", type=int, help="延迟最小值(ms)")
@click.option("--delay-max", type=int, help="延迟最大值(ms)")
@click.option("--loss-percent", type=float, help="丢包百分比 0.0-1.0")
@click.option("--drift-seconds", type=int, help="时间戳漂移秒数")
@click.option("--duplicate-count", type=int, help="重复次数")
@click.option("--block-duration", type=int, help="遮挡持续秒数")
@click.option("--camera", multiple=True, help="目标摄像头ID（可多次使用）")
@click.option("--event-type", multiple=True, help="目标事件类型（可多次使用）")
@pass_context
def scenario_add_jitter(
    ctx: Context, scenario_id: str, rule_id: str, name: str, jitter_type: str,
    probability: float, delay_min: Optional[int], delay_max: Optional[int],
    loss_percent: Optional[float], drift_seconds: Optional[int],
    duplicate_count: Optional[int], block_duration: Optional[int],
    camera: tuple, event_type: tuple,
):
    """添加抖动规则"""
    scenarios_dir = ctx.get_scenarios_dir()
    scenario_path = scenarios_dir / f"{scenario_id}.json"
    
    if not scenario_path.exists():
        console.print(f"[red]场景不存在: {scenario_id}[/red]")
        return
    
    with open(scenario_path, "r", encoding="utf-8") as f:
        scenario_data = json.load(f)
    
    jitter = JitterRule(
        id=rule_id,
        name=name,
        jitter_type=jitter_type,
        probability=probability,
        delay_min_ms=delay_min,
        delay_max_ms=delay_max,
        loss_percentage=loss_percent,
        drift_seconds=drift_seconds,
        duplicate_count=duplicate_count,
        block_duration_seconds=block_duration,
        target_cameras=list(camera),
        target_event_types=list(event_type),
    )
    
    jitter_dir = scenarios_dir / scenario_id / "jitter_rules"
    jitter_dir.mkdir(parents=True, exist_ok=True)
    
    jitter_path = jitter_dir / f"{rule_id}.json"
    with open(jitter_path, "w", encoding="utf-8") as f:
        json.dump(jitter.to_dict(), f, indent=2, ensure_ascii=False)
    
    if rule_id not in scenario_data.get("jitter_rules", []):
        scenario_data.setdefault("jitter_rules", []).append(rule_id)
        scenario_data["updated_at"] = datetime.now().isoformat()
        
        with open(scenario_path, "w", encoding="utf-8") as f:
            json.dump(scenario_data, f, indent=2, ensure_ascii=False)
    
    console.print(f"[green]抖动规则已添加: {rule_id} ({jitter_type})[/green]")


@cli.command()
@click.argument("source", nargs=-1, required=True)
@click.option("--scenario", "-s", "scenario_id", help="场景ID（用于加载抖动规则）")
@click.option("--speed", "-x", type=float, default=1.0, help="回放倍速 (默认 1.0x)")
@click.option("--output", "-o", type=click.Path(), help="输出事件到文件 (JSONL格式)")
@click.option("--resume", is_flag=True, help="从上次暂停处继续")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，不输出事件详情")
@pass_context
def replay(
    ctx: Context, source: tuple, scenario_id: Optional[str], 
    speed: float, output: Optional[str], resume: bool, quiet: bool,
):
    """从 CSV/JSON 生成带时间戳的事件流，支持倍速、暂停续跑"""
    
    parser = ScenarioParser(ctx.work_dir)
    all_events: List[Event] = []
    
    for src in source:
        src_path = Path(src)
        if not src_path.is_absolute():
            src_path = ctx.get_data_dir() / src
        
        if not src_path.exists():
            console.print(f"[red]源文件不存在: {src}[/red]")
            return
        
        try:
            events = parser.parse_file(src_path)
            all_events.extend(events)
            console.print(f"[cyan]已加载 {len(events)} 个事件来自 {src}[/cyan]")
        except Exception as e:
            console.print(f"[red]解析失败 {src}: {e}[/red]")
            return
    
    if not all_events:
        console.print("[yellow]没有事件需要回放[/yellow]")
        return
    
    all_events = parser.sort_events(all_events)
    
    time_range = parser.get_time_range(all_events)
    if time_range:
        duration = (time_range["end"] - time_range["start"]).total_seconds()
        console.print(f"\n[dim]时间范围: {time_range['start']} ~ {time_range['end']}[/dim]")
        console.print(f"[dim]原始时长: {duration:.1f} 秒, 倍速播放: {duration/speed:.1f} 秒[/dim]")
    
    jitter_rules: List[JitterRule] = []
    if scenario_id:
        scenarios_dir = ctx.get_scenarios_dir()
        jitter_dir = scenarios_dir / scenario_id / "jitter_rules"
        if jitter_dir.exists():
            for jf in jitter_dir.glob("*.json"):
                try:
                    with open(jf, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    jitter_rules.append(JitterRule(**data))
                except Exception as e:
                    if ctx.verbose:
                        console.print(f"[dim]加载抖动规则失败 {jf}: {e}[/dim]")
    
    output_file = None
    if output:
        output_path = Path(output)
        output_file = open(output_path, "w", encoding="utf-8")
    
    emitted_count = [0]
    start_time = time.time()
    
    def on_event(event: Event):
        emitted_count[0] += 1
        event_dict = event.to_dict()
        
        if output_file:
            output_file.write(json.dumps(event_dict, ensure_ascii=False) + "\n")
            output_file.flush()
        
        if not quiet:
            ts = event.timestamp.strftime("%H:%M:%S")
            console.print(
                f"[dim]{ts}[/dim] "
                f"[{event.event_type:20}] "
                f"{event.camera_id:12} "
                f"[dim]{event.area_id or '-':10}[/dim] "
                f"{event.severity:8}",
                highlight=False,
            )
    
    def on_status_change(status: ReplayStatus):
        console.print(f"\n[bold]状态: {status.value}[/bold]")
    
    state_dir = ctx.get_state_dir() / "replay"
    scheduler = ReplayScheduler(
        events=all_events,
        jitter_rules=jitter_rules,
        on_event=on_event,
        on_status_change=on_status_change,
        state_dir=state_dir,
    )
    
    console.print(f"\n[green]开始回放 ({len(all_events)} 个事件, {speed}x 速度)[/green]")
    console.print("[dim]按 Ctrl+C 暂停[/dim]\n")
    
    def handle_sigint(signum, frame):
        console.print("\n[yellow]正在暂停...[/yellow]")
        scheduler.pause()
    
    original_handler = signal.signal(signal.SIGINT, handle_sigint)
    
    try:
        scheduler.start(speed=speed, resume_from_checkpoint=resume)
        
        while True:
            progress = scheduler.get_progress()
            status = progress["status"]
            
            if status in [ReplayStatus.COMPLETED.value, ReplayStatus.STOPPED.value]:
                break
            
            if status == ReplayStatus.PAUSED.value:
                console.print("\n[yellow]已暂停[/yellow]")
                console.print("[dim]输入 'resume' 继续, 'stop' 停止[/dim]")
                
                try:
                    user_input = input("> ").strip().lower()
                    if user_input == "resume":
                        scheduler.resume()
                        console.print("[green]继续回放...[/green]")
                    elif user_input == "stop":
                        scheduler.stop()
                        break
                except EOFError:
                    scheduler.stop()
                    break
            
            time.sleep(0.1)
        
        scheduler.wait(timeout=5.0)
        
        elapsed = time.time() - start_time
        final_progress = scheduler.get_progress()
        
        console.print("")
        console.print(Panel.fit(
            f"[green]回放完成[/green]\n"
            f"  已处理: {final_progress['processed_events']} 个事件\n"
            f"  进度: {final_progress['progress_percent']}%\n"
            f"  耗时: {elapsed:.1f} 秒",
            title="回放结束",
            style="green" if final_progress["status"] == ReplayStatus.COMPLETED.value else "yellow",
        ))
        
    finally:
        signal.signal(signal.SIGINT, original_handler)
        if output_file:
            output_file.close()


@cli.command()
@click.argument("source", nargs=-1, required=True)
@click.option("--scenario", "-s", "scenario_id", help="场景ID（用于加载抖动规则做冲突检查）")
@click.option("--rule", "-r", multiple=True, help="指定要运行的校验规则（默认全部）")
@click.option("--ignore", "-i", multiple=True, help="忽略指定规则")
@click.option("--required-field", "-f", multiple=True, help="额外的必填字段检查")
@click.option("--format", "-o", "output_format", type=click.Choice(["text", "json"]), default="text", help="输出格式")
@pass_context
def validate(
    ctx: Context, source: tuple, scenario_id: Optional[str],
    rule: tuple, ignore: tuple, required_field: tuple, output_format: str,
):
    """校验事件流：乱序、重复、缺字段、规则冲突"""
    
    parser = ScenarioParser(ctx.work_dir)
    all_events: List[Event] = []
    
    for src in source:
        src_path = Path(src)
        if not src_path.is_absolute():
            src_path = ctx.get_data_dir() / src
        
        if not src_path.exists():
            console.print(f"[red]源文件不存在: {src}[/red]")
            sys.exit(1)
        
        try:
            events = parser.parse_file(src_path)
            all_events.extend(events)
        except Exception as e:
            console.print(f"[red]解析失败 {src}: {e}[/red]")
            sys.exit(1)
    
    if not all_events:
        console.print("[yellow]没有事件需要校验[/yellow]")
        return
    
    validator = Validator()
    
    jitter_rules: Optional[List[JitterRule]] = None
    if scenario_id:
        jitter_rules = []
        scenarios_dir = ctx.get_scenarios_dir()
        jitter_dir = scenarios_dir / scenario_id / "jitter_rules"
        if jitter_dir.exists():
            for jf in jitter_dir.glob("*.json"):
                try:
                    with open(jf, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    jitter_rules.append(JitterRule(**data))
                except Exception:
                    pass
    
    enabled_rules = list(rule) if rule else None
    disabled_rules = list(ignore) if ignore else None
    additional_required = list(required_field) if required_field else None
    
    result = validator.validate(
        events=all_events,
        jitter_rules=jitter_rules,
        additional_required_fields=additional_required,
        enabled_rules=enabled_rules,
        disabled_rules=disabled_rules,
    )
    
    if output_format == "json":
        console.print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    else:
        status = "✅ 通过" if result.valid else "❌ 失败"
        console.print(Panel.fit(
            f"状态: {status}\n"
            f"事件总数: {result.total_events}\n"
            f"错误数: {result.total_errors}\n"
            f"警告数: {result.total_warnings}\n"
            f"执行规则: {', '.join(result.rules_executed)}",
            title="校验结果",
            style="green" if result.valid else "red",
        ))
        
        if result.errors:
            console.print("\n[bold red]错误详情:[/bold red]")
            for e in result.errors:
                console.print(f"  ❌ [{e.rule_name}] {e.message}")
                if e.location:
                    console.print(f"     位置: {e.location}")
        
        if result.warnings:
            console.print("\n[bold yellow]警告详情:[/bold yellow]")
            for w in result.warnings:
                console.print(f"  ⚠️ [{w.rule_name}] {w.message}")
    
    if not result.valid:
        sys.exit(1)


@cli.command()
@click.argument("source", nargs=-1, required=True)
@click.option("--id", "report_id", help="报告ID（默认自动生成）")
@click.option("--scenario", "-s", "scenario_id", help="场景ID")
@click.option("--validate/--no-validate", default=True, help="是否执行校验")
@click.option("--output-dir", "-o", type=click.Path(file_okay=False), help="输出目录")
@pass_context
def report(
    ctx: Context, source: tuple, report_id: Optional[str], 
    scenario_id: Optional[str], validate: bool, output_dir: Optional[str],
):
    """生成 Markdown 与 JSON 审计报告"""
    
    if not report_id:
        report_id = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    parser = ScenarioParser(ctx.work_dir)
    all_events: List[Event] = []
    
    for src in source:
        src_path = Path(src)
        if not src_path.is_absolute():
            src_path = ctx.get_data_dir() / src
        
        if not src_path.exists():
            console.print(f"[red]源文件不存在: {src}[/red]")
            sys.exit(1)
        
        try:
            events = parser.parse_file(src_path)
            all_events.extend(events)
            console.print(f"[cyan]已加载 {len(events)} 个事件来自 {src}[/cyan]")
        except Exception as e:
            console.print(f"[red]解析失败 {src}: {e}[/red]")
            sys.exit(1)
    
    scenario_info: Optional[Dict[str, Any]] = None
    if scenario_id:
        scenarios_dir = ctx.get_scenarios_dir()
        scenario_path = scenarios_dir / f"{scenario_id}.json"
        if scenario_path.exists():
            with open(scenario_path, "r", encoding="utf-8") as f:
                scenario_info = json.load(f)
    
    validation_result = None
    if validate:
        console.print("[cyan]执行校验...[/cyan]")
        validator = Validator()
        validation_result = validator.validate(all_events)
    
    output_path = Path(output_dir) if output_dir else ctx.get_reports_dir()
    generator = ReportGenerator(output_path)
    
    console.print(f"[cyan]生成报告: {report_id}[/cyan]")
    paths = generator.generate(
        report_id=report_id,
        events=all_events,
        validation_result=validation_result,
        scenario_info=scenario_info,
    )
    
    console.print(Panel.fit(
        f"[green]报告生成成功[/green]\n"
        f"  JSON: {paths['json']}\n"
        f"  Markdown: {paths['markdown']}",
        title=f"报告: {report_id}",
        style="green",
    ))


if __name__ == "__main__":
    cli()
