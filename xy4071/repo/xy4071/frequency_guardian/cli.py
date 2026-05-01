"""频率排班守门员 - 命令行接口"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from . import __version__
from .models.config import FrequencyGuardianConfig, ProjectConfig
from .models.quarantine import ReviewRecord
from .models.violation import ViolationSeverity
from .parsers.factory import ParserFactory
from .reports.csv_report import CSVReportGenerator
from .reports.json_report import JSONAuditGenerator
from .reports.markdown_report import MarkdownReportGenerator
from .rules.engine import RuleEngine
from .scheduler.analyzer import ScheduleAnalyzer
from .storage.manager import StorageManager


console = Console()


def load_project_config() -> ProjectConfig:
    """
    加载项目配置

    Returns:
        项目配置对象
    """
    config_file = Path.cwd() / "fg_config.json"

    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ProjectConfig(**data)
        except Exception as e:
            console.print(f"[yellow]警告: 无法加载配置文件，使用默认配置: {e}[/yellow]")

    return ProjectConfig()


def save_project_config(config: ProjectConfig) -> None:
    """
    保存项目配置

    Args:
        config: 项目配置对象
    """
    config_file = Path.cwd() / "fg_config.json"

    try:
        data = config.model_dump()

        def convert_path(obj: Any) -> Any:
            if isinstance(obj, Path):
                return str(obj)
            if isinstance(obj, dict):
                return {k: convert_path(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [convert_path(item) for item in obj]
            return obj

        data = convert_path(data)

        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        console.print(f"[red]错误: 无法保存配置文件: {e}[/red]")


@click.group()
@click.version_option(version=__version__, prog_name="fg")
def cli():
    """
    频率排班守门员 - 业余无线电应急演练频率管理工具

    用于管理电台清单、频率分配、值守排班和通联日志，
    自动检测频道冲突、呼号格式错误、功率超限和记录缺失。
    """
    pass


@cli.command()
@click.option("--project-name", "-n", default="应急演练频率管理", help="项目名称")
@click.option("--exercise-name", "-e", default=None, help="演练名称")
@click.option("--max-power", "-p", default=25.0, type=float, help="最大功率限制(瓦)")
@click.option("--min-freq", "-f", default=144.0, type=float, help="最小频率(MHz)")
@click.option("--max-freq", "-F", default=148.0, type=float, help="最大频率(MHz)")
@click.option("--force", "-f", is_flag=True, help="强制覆盖现有配置")
def init(project_name, exercise_name, max_power, min_freq, max_freq, force):
    """
    初始化项目配置

    创建 fg_config.json 配置文件和必要的目录结构。
    """
    config_file = Path.cwd() / "fg_config.json"

    if config_file.exists() and not force:
        console.print(Panel.fit(
            "[yellow]配置文件已存在[/yellow]\n使用 --force 选项覆盖现有配置",
            title="警告",
            border_style="yellow"
        ))
        sys.exit(1)

    config = ProjectConfig(
        project_name=project_name,
        exercise_name=exercise_name,
        max_power_watts=max_power,
        min_frequency_mhz=min_freq,
        max_frequency_mhz=max_freq,
    )

    save_project_config(config)

    config.data_dir.mkdir(parents=True, exist_ok=True)
    config.output_dir.mkdir(parents=True, exist_ok=True)

    table = Table(title="项目初始化完成", show_header=True)
    table.add_column("配置项", style="cyan")
    table.add_column("值", style="green")

    table.add_row("项目名称", config.project_name)
    table.add_row("演练名称", config.exercise_name or "未指定")
    table.add_row("最大功率限制", f"{config.max_power_watts} W")
    table.add_row("频段范围", f"{config.min_frequency_mhz} - {config.max_frequency_mhz} MHz")
    table.add_row("数据目录", str(config.data_dir))
    table.add_row("输出目录", str(config.output_dir))

    console.print(table)
    console.print(f"\n[green]✓ 配置文件已创建: {config_file}[/green]")


@cli.command()
@click.option("--radio", "-r", type=click.Path(exists=True), help="电台清单 CSV 文件")
@click.option("--frequency", "-f", type=click.Path(exists=True), help="频率分配 CSV 文件")
@click.option("--schedule", "-s", type=click.Path(exists=True), help="值守排班 CSV 文件")
@click.option("--log", "-l", type=click.Path(exists=True), help="通联日志 CSV 文件")
@click.option("--all", "-a", is_flag=True, help="从 data 目录自动检测并导入所有文件")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def import_cmd(radio, frequency, schedule, log, all, verbose):
    """
    导入数据文件并逐行校验

    支持导入电台清单、频率分配、值守排班和通联日志 CSV 文件。
    导入时会自动执行基础校验。
    """
    config = load_project_config()

    import_results = {
        "imported_at": datetime.now().isoformat(),
        "files": [],
        "total_valid": 0,
        "total_invalid": 0,
        "errors": [],
    }

    files_to_import = []

    if all:
        data_dir = config.data_dir
        if data_dir.exists():
            for file_path in data_dir.glob("*.csv"):
                file_type = ParserFactory.detect_file_type(file_path)
                files_to_import.append((file_path, file_type))
            if not files_to_import:
                console.print(f"[yellow]在 {data_dir} 中未找到 CSV 文件[/yellow]")
    else:
        if radio:
            files_to_import.append((Path(radio), "radio"))
        if frequency:
            files_to_import.append((Path(frequency), "frequency"))
        if schedule:
            files_to_import.append((Path(schedule), "schedule"))
        if log:
            files_to_import.append((Path(log), "log"))

    if not files_to_import:
        console.print(Panel.fit(
            "[yellow]未指定要导入的文件[/yellow]\n使用 --help 查看可用选项",
            title="提示",
            border_style="yellow"
        ))
        sys.exit(1)

    storage = StorageManager(config)
    storage.clear_quarantine()

    for file_path, file_type in files_to_import:
        console.print(f"\n[cyan]正在导入: {file_path.name} (类型: {file_type})[/cyan]")

        try:
            parser = ParserFactory.get_parser(file_type, config)
            parse_result = parser.parse(file_path)

            file_result = {
                "file_name": file_path.name,
                "file_type": file_type,
                "total_rows": parse_result.total_rows,
                "valid_rows": len(parse_result.valid_data),
                "invalid_rows": len(parse_result.errors),
                "errors": [],
            }

            import_results["total_valid"] += len(parse_result.valid_data)

            if parse_result.errors:
                import_results["total_invalid"] += len(parse_result.errors)

                for error in parse_result.errors:
                    from .models.quarantine import QuarantineEntry
                    from .models.violation import Violation, ViolationType

                    violation = Violation(
                        violation_type=ViolationType.INVALID_FORMAT,
                        severity=ViolationSeverity.HIGH,
                        category="data",
                        message=error.message,
                        source_file=str(file_path),
                        line_number=error.line_number,
                        raw_data=error.raw_data,
                    )

                    entry = QuarantineEntry(
                        source_type=file_type,
                        source_file=str(file_path),
                        line_number=error.line_number,
                        raw_data=error.raw_data or {},
                        violations=[violation],
                        quarantine_reason=error.message,
                    )

                    storage.add_quarantine_entry(entry)

                    file_result["errors"].append({
                        "line_number": error.line_number,
                        "message": error.message,
                        "column": error.column,
                    })

            import_results["files"].append(file_result)

            if verbose:
                table = Table(title=f"{file_path.name} 导入结果")
                table.add_column("指标", style="cyan")
                table.add_column("值", style="green")
                table.add_row("总行数", str(parse_result.total_rows))
                table.add_row("有效行数", str(len(parse_result.valid_data)))
                table.add_row("错误行数", str(len(parse_result.errors)))
                console.print(table)

            status_color = "green" if not parse_result.errors else "yellow"
            console.print(f"[{status_color}]✓ 导入完成: {len(parse_result.valid_data)} 有效, {len(parse_result.errors)} 错误[/{status_color}]")

        except Exception as e:
            console.print(f"[red]✗ 导入失败: {e}[/red]")
            import_results["errors"].append(str(e))

    console.print("\n" + "=" * 50)
    console.print(f"[bold]导入汇总[/bold]")
    console.print(f"  有效记录: {import_results['total_valid']}")
    console.print(f"  错误记录: {import_results['total_invalid']}")

    if import_results["total_invalid"] > 0:
        console.print(f"\n[yellow]⚠️  有 {import_results['total_invalid']} 条记录被隔离，使用 'fg check' 进行详细检查[/yellow]")


@cli.command()
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def plan(verbose):
    """
    生成值守冲突和频道占用表

    分析值守排班数据，检测频道冲突和操作员冲突，
    生成频道占用矩阵和空档分析。
    """
    config = load_project_config()
    data_dir = config.data_dir

    schedule_files = list(data_dir.glob("*schedule*.csv")) + list(data_dir.glob("*排班*.csv"))

    if not schedule_files:
        console.print(Panel.fit(
            "[yellow]未找到值守排班文件[/yellow]\n请先使用 'fg import' 导入排班数据",
            title="提示",
            border_style="yellow"
        ))
        sys.exit(1)

    schedule_file = schedule_files[0]
    console.print(f"[cyan]分析排班文件: {schedule_file.name}[/cyan]")

    try:
        from .parsers.schedule_parser import DutyScheduleParser

        parser = DutyScheduleParser(config)
        parse_result = parser.parse(schedule_file)

        if not parse_result.valid_data:
            console.print("[red]✗ 没有有效的排班数据[/red]")
            if parse_result.errors:
                for error in parse_result.errors:
                    console.print(f"  [yellow]- 第 {error.line_number} 行: {error.message}[/yellow]")
            sys.exit(1)

        schedule = parse_result.data
        analyzer = ScheduleAnalyzer(schedule)

        analysis = analyzer.analyze()

        channel_usage = analysis.get("channel_usage", {})
        conflicts = analysis.get("conflicts", {})
        time_slots = analysis.get("time_slots", [])
        gaps = analysis.get("gaps", [])

        channel_conflicts = conflicts.get("channel_conflicts", [])
        operator_conflicts = conflicts.get("operator_conflicts", [])

        console.print("\n" + "=" * 60)
        console.print(f"[bold]排班冲突分析报告[/bold]")
        console.print("=" * 60)

        if channel_conflicts or operator_conflicts:
            console.print("\n[red]⚠️  检测到冲突[/red]")

            if channel_conflicts:
                console.print(f"\n[bold]频道冲突 ({len(channel_conflicts)} 处):[/bold]")
                table = Table(title="频道冲突详情")
                table.add_column("#", style="cyan", width=3)
                table.add_column("频道", style="magenta")
                table.add_column("冲突操作员", style="yellow")
                table.add_column("时段", style="green")

                for i, conflict in enumerate(channel_conflicts, 1):
                    channel = conflict.get("channel_id", "未知")
                    shifts = conflict.get("conflicting_shifts", [])
                    operators = ", ".join([s.get("operator", "?") for s in shifts])
                    times = ", ".join([f"{s.get('time_start','')}-{s.get('time_end','')}" for s in shifts])
                    table.add_row(str(i), channel, operators, times)

                console.print(table)

            if operator_conflicts:
                console.print(f"\n[bold]操作员冲突 ({len(operator_conflicts)} 处):[/bold]")
                table = Table(title="操作员冲突详情")
                table.add_column("#", style="cyan", width=3)
                table.add_column("操作员", style="magenta")
                table.add_column("冲突频道", style="yellow")
                table.add_column("时段", style="green")

                for i, conflict in enumerate(operator_conflicts, 1):
                    operator = conflict.get("operator", "未知")
                    shifts = conflict.get("conflicting_shifts", [])
                    channels = ", ".join([s.get("channel_id", "?") for s in shifts])
                    times = ", ".join([f"{s.get('time_start','')}-{s.get('time_end','')}" for s in shifts])
                    table.add_row(str(i), operator, channels, times)

                console.print(table)
        else:
            console.print("\n[green]✓ 未检测到排班冲突[/green]")

        console.print(f"\n[bold]频道占用情况:[/bold]")
        table = Table(title="频道占用统计")
        table.add_column("频道ID", style="cyan")
        table.add_column("占用时段数", style="magenta")
        table.add_column("操作员数", style="yellow")

        for channel_id, usage in list(channel_usage.items())[:15]:
            time_slots_data = usage.get("time_slots", [])
            operators = usage.get("operators", [])
            table.add_row(channel_id, str(len(time_slots_data)), str(len(operators)))

        console.print(table)

        if gaps:
            console.print(f"\n[bold]空档分析 ({len(gaps)} 个空档):[/bold]")
            table = Table(title="排班空档")
            table.add_column("开始时间", style="cyan")
            table.add_column("结束时间", style="cyan")
            table.add_column("时长(分钟)", style="magenta")
            table.add_column("可用频道", style="yellow")

            for gap in gaps[:10]:
                start = gap.get("start_time", "")
                end = gap.get("end_time", "")
                duration = gap.get("duration_minutes", 0)
                available = ", ".join(gap.get("available_channels", []))
                table.add_row(start, end, str(duration), available)

            console.print(table)

        output_file = config.output_dir / "schedule_analysis.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2, default=str)

        console.print(f"\n[green]✓ 详细分析结果已保存到: {output_file}[/green]")

    except Exception as e:
        console.print(f"[red]✗ 分析失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def check(verbose):
    """
    执行规则检查，标出违规和缺失证据

    运行所有规则引擎检查，包括：
    - 呼号格式验证
    - 功率限制检查
    - 频率频段验证
    - 频道冲突检测
    - 中继台切换记录检查
    """
    config = load_project_config()
    data_dir = config.data_dir

    storage = StorageManager(config)

    console.print("[cyan]开始执行规则检查...[/cyan]")

    engine = RuleEngine(config)

    all_results = {
        "checked_at": datetime.now().isoformat(),
        "checks": [],
        "total_violations": 0,
        "by_severity": {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        },
    }

    radio_files = list(data_dir.glob("*radio*.csv")) + list(data_dir.glob("*电台*.csv"))
    frequency_files = list(data_dir.glob("*frequency*.csv")) + list(data_dir.glob("*频率*.csv"))
    schedule_files = list(data_dir.glob("*schedule*.csv")) + list(data_dir.glob("*排班*.csv"))
    log_files = list(data_dir.glob("*log*.csv")) + list(data_dir.glob("*日志*.csv"))

    for file_list, file_type, parser_class in [
        (radio_files, "radio", None),
        (frequency_files, "frequency", None),
        (schedule_files, "schedule", None),
        (log_files, "log", None),
    ]:
        for file_path in file_list:
            console.print(f"\n[cyan]检查: {file_path.name}[/cyan]")

            try:
                parser = ParserFactory.get_parser(file_type, config)
                parse_result = parser.parse(file_path)

                if parse_result.valid_data:
                    rule_result = engine.execute_all(parse_result.valid_data, file_type, str(file_path))

                    check_result = {
                        "file_name": file_path.name,
                        "file_type": file_type,
                        "total_rules": rule_result.total_rules_executed,
                        "violations": len(rule_result.violations),
                    }

                    all_results["checks"].append(check_result)

                    if rule_result.violations:
                        for violation in rule_result.violations:
                            from .models.quarantine import QuarantineEntry

                            entry = QuarantineEntry(
                                source_type=file_type,
                                source_file=str(file_path),
                                line_number=violation.line_number,
                                raw_data={},
                                violations=[violation],
                                quarantine_reason=f"违规: {violation.message}",
                            )

                            storage.add_quarantine_entry(entry)

                            severity = violation.severity
                            if isinstance(severity, str):
                                severity_str = severity.lower()
                            else:
                                severity_str = severity.value.lower()

                            if severity_str in all_results["by_severity"]:
                                all_results["by_severity"][severity_str] += 1

                        all_results["total_violations"] += len(rule_result.violations)

                        console.print(f"  [yellow]⚠️  发现 {len(rule_result.violations)} 个违规[/yellow]")

                        if verbose:
                            for v in rule_result.violations:
                                severity_icon = "🔴" if v.severity == ViolationSeverity.CRITICAL else \
                                                "🟠" if v.severity == ViolationSeverity.HIGH else \
                                                "🟡"
                                console.print(f"    {severity_icon} 第{v.line_number}行: {v.message}")
                    else:
                        console.print(f"  [green]✓ 未发现违规[/green]")

            except Exception as e:
                console.print(f"  [red]✗ 检查失败: {e}[/red]")

    console.print("\n" + "=" * 60)
    console.print(f"[bold]规则检查汇总[/bold]")
    console.print("=" * 60)

    if all_results["total_violations"] > 0:
        table = Table(title="违规统计")
        table.add_column("严重程度", style="cyan")
        table.add_column("数量", style="magenta")

        severity_names = {
            "critical": "🔴 严重",
            "high": "🟠 高",
            "medium": "🟡 中",
            "low": "🟢 低",
            "info": "ℹ️ 信息",
        }

        for severity, count in all_results["by_severity"].items():
            if count > 0:
                table.add_row(severity_names.get(severity, severity), str(count))

        console.print(table)
        console.print(f"\n[yellow]⚠️  共发现 {all_results['total_violations']} 个违规[/yellow]")
        console.print(f"[yellow]   违规记录已隔离到: {config.quarantine_file}[/yellow]")
        console.print(f"[yellow]   使用 'fg review' 进行复核确认[/yellow]")
    else:
        console.print("\n[green]✓ 未发现任何违规[/green]")

    output_file = config.output_dir / "check_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2, default=str)

    console.print(f"\n[green]✓ 检查结果已保存到: {output_file}[/green]")


@cli.command()
@click.option("--list", "-l", "list_entries", is_flag=True, help="列出所有待处理条目")
@click.option("--confirm", "-c", help="确认指定条目违规 (entry_id)")
@click.option("--dismiss", "-d", help="驳回指定条目误判 (entry_id)")
@click.option("--all-confirm", "-C", is_flag=True, help="确认所有待处理条目")
@click.option("--all-dismiss", "-D", is_flag=True, help="驳回所有待处理条目")
@click.option("--note", "-n", help="复核备注")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def review(list_entries, confirm, dismiss, all_confirm, all_dismiss, note, verbose):
    """
    管理复核流程，保存人工确认

    支持列出待处理条目、确认违规、驳回误判等操作。
    """
    config = load_project_config()
    storage = StorageManager(config)

    store = storage.load_quarantine_store()

    if list_entries:
        entries = store.get_entries_by_status("quarantined")

        if not entries:
            console.print("[green]✓ 没有待处理的复核条目[/green]")
            return

        table = Table(title="待处理复核条目")
        table.add_column("ID", style="cyan", width=12)
        table.add_column("来源类型", style="magenta")
        table.add_column("违规数", style="yellow")
        table.add_column("隔离原因", style="green")

        for entry in entries[:30]:
            source_name = {
                "radio": "电台清单",
                "frequency": "频率分配",
                "schedule": "值守排班",
                "log": "通联日志",
            }.get(entry.source_type, entry.source_type)

            reason = entry.quarantine_reason[:40] + "..." if len(entry.quarantine_reason) > 40 else entry.quarantine_reason
            table.add_row(
                entry.entry_id[:10] + "...",
                source_name,
                str(len(entry.violations)),
                reason
            )

        console.print(table)

        if len(entries) > 30:
            console.print(f"\n[yellow]还有 {len(entries) - 30} 条待处理条目未显示[/yellow]")

        console.print(f"\n共 {len(entries)} 条待处理条目")
        console.print(f"使用 'fg review --confirm <entry_id>' 确认违规")
        console.print(f"使用 'fg review --dismiss <entry_id>' 驳回误判")
        return

    if confirm:
        entry = store.get_entry_by_id(confirm)
        if not entry:
            entry = next((e for e in store.entries if e.entry_id.startswith(confirm)), None)

        if not entry:
            console.print(f"[red]✗ 未找到条目: {confirm}[/red]")
            sys.exit(1)

        review = ReviewRecord(
            entry_id=entry.entry_id,
            reviewer="CLI",
            decision="confirm",
            notes=note,
        )

        storage.add_review(review)

        console.print(f"[green]✓ 已确认违规: {entry.entry_id}[/green]")
        return

    if dismiss:
        entry = store.get_entry_by_id(dismiss)
        if not entry:
            entry = next((e for e in store.entries if e.entry_id.startswith(dismiss)), None)

        if not entry:
            console.print(f"[red]✗ 未找到条目: {dismiss}[/red]")
            sys.exit(1)

        review = ReviewRecord(
            entry_id=entry.entry_id,
            reviewer="CLI",
            decision="dismiss",
            notes=note,
        )

        storage.add_review(review)

        console.print(f"[green]✓ 已驳回误判: {entry.entry_id}[/green]")
        return

    if all_confirm or all_dismiss:
        entries = store.get_entries_by_status("quarantined")

        if not entries:
            console.print("[green]✓ 没有待处理的复核条目[/green]")
            return

        decision = "confirm" if all_confirm else "dismiss"
        action = "确认" if all_confirm else "驳回"

        for entry in entries:
            review = ReviewRecord(
                entry_id=entry.entry_id,
                reviewer="CLI",
                decision=decision,
                notes=note,
            )
            storage.add_review(review)

        console.print(f"[green]✓ 已{action}所有 {len(entries)} 条待处理条目[/green]")
        return

    stats = store.get_statistics()

    table = Table(title="复核状态统计")
    table.add_column("状态", style="cyan")
    table.add_column("数量", style="magenta")

    status_names = {
        "quarantined": "⏳ 隔离中(待处理)",
        "reviewed": "✅ 已复核",
        "resolved": "✓ 已解决",
        "dismissed": "✗ 已驳回",
    }

    for status, count in stats.get("review_status", {}).items():
        if count > 0:
            table.add_row(status_names.get(status, status), str(count))

    console.print(table)
    console.print("\n使用 --list 查看待处理条目")
    console.print("使用 --confirm 或 --dismiss 进行复核")


@cli.command()
@click.option("--output", "-o", type=click.Path(), help="输出目录路径")
@click.option("--markdown", "-m", is_flag=True, help="只生成 Markdown 报告")
@click.option("--csv", "-c", is_flag=True, help="只生成 CSV 问题清单")
@click.option("--json", "-j", is_flag=True, help="只生成 JSON 审计包")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def export(output, markdown, csv, json, verbose):
    """
    导出报告文件

    导出三种格式的报告：
    - Markdown 复盘报告
    - CSV 问题清单
    - JSON 审计包

    默认导出所有三种格式。
    """
    config = load_project_config()

    if output:
        config.output_dir = Path(output)

    config.output_dir.mkdir(parents=True, exist_ok=True)

    storage = StorageManager(config)
    store = storage.load_quarantine_store()

    schedule_analysis = None
    schedule_analysis_file = config.output_dir / "schedule_analysis.json"
    if schedule_analysis_file.exists():
        try:
            with open(schedule_analysis_file, "r", encoding="utf-8") as f:
                schedule_analysis = json.load(f)
        except Exception:
            pass

    export_all = not (markdown or csv or json)

    if markdown or export_all:
        console.print("[cyan]生成 Markdown 复盘报告...[/cyan]")
        try:
            generator = MarkdownReportGenerator(config, store, schedule_analysis)
            result = generator.generate()

            if result.success:
                console.print(f"[green]✓ {result.message}[/green]")
            else:
                for error in result.errors:
                    console.print(f"[red]✗ {error}[/red]")
        except Exception as e:
            console.print(f"[red]✗ 生成 Markdown 报告失败: {e}[/red]")

    if csv or export_all:
        console.print("[cyan]生成 CSV 问题清单...[/cyan]")
        try:
            generator = CSVReportGenerator(config, store)
            result = generator.generate()

            if result.success:
                console.print(f"[green]✓ {result.message}[/green]")
            else:
                for error in result.errors:
                    console.print(f"[red]✗ {error}[/red]")
        except Exception as e:
            console.print(f"[red]✗ 生成 CSV 报告失败: {e}[/red]")

    if json or export_all:
        console.print("[cyan]生成 JSON 审计包...[/cyan]")
        try:
            generator = JSONAuditGenerator(config, store, schedule_analysis)
            result = generator.generate()

            if result.success:
                console.print(f"[green]✓ {result.message}[/green]")
            else:
                for error in result.errors:
                    console.print(f"[red]✗ {error}[/red]")
        except Exception as e:
            console.print(f"[red]✗ 生成 JSON 审计包失败: {e}[/red]")

    console.print(f"\n[bold]输出目录: {config.output_dir}[/bold]")


if __name__ == "__main__":
    cli()
