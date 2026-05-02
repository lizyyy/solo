"""CLI 命令行接口 - init、import、check、compute、compare、export"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from . import __version__
from .calculator import FlowCalculator, MethodComparison
from .history_store import HistoricalComparer, HistoryStore
from .models import FlowMethod, HistoricalComparison
from .parser_validator import CSVParser, DataValidator
from .report_generator import ReportGenerator

console = Console()


class SessionState:
    """会话状态管理"""

    def __init__(self):
        self.section = None
        self.calibration = None
        self.notes = None
        self.validation_issues = []
        self.flow_result = None
        self.historical_comparison = None
        self.store: Optional[HistoryStore] = None
        self.config: dict = {}

    def get_store(self) -> HistoryStore:
        """获取历史存储实例"""
        if self.store is None:
            store_path = self.config.get("store_path")
            if store_path:
                self.store = HistoryStore(Path(store_path))
            else:
                self.store = HistoryStore()
        return self.store


pass_state = click.make_pass_decorator(SessionState, ensure=True)


@click.group()
@click.version_option(__version__, "--version", "-v")
@click.option("--config", "-c", type=click.Path(exists=True, dir_okay=False), help="配置文件路径")
@click.pass_context
def main(ctx, config):
    """断面流量复核器 - 野外水文调查流量计算与复核工具"""
    ctx.ensure_object(SessionState)
    state = ctx.obj

    # 加载配置文件
    if config:
        with open(config, "r", encoding="utf-8") as f:
            state.config = json.load(f)

    # 输出欢迎信息
    console.print(
        Panel.fit(
            "[bold blue]断面流量复核器[/bold blue]\n"
            f"版本: {__version__}\n"
            "用途: 野外水文调查流量计算与复核",
            title="断面流量复核器",
            border_style="blue",
        )
    )


@main.command()
@click.option("--dir", "-d", "init_dir", type=click.Path(), default=".", help="初始化目录")
@click.option("--force", "-f", is_flag=True, help="强制覆盖现有配置")
@pass_state
def init(state, init_dir, force):
    """初始化项目配置，创建项目结构和配置文件"""
    base_path = Path(init_dir)
    
    # 创建必要的目录
    dirs_to_create = [
        base_path / "data",
        base_path / "data" / "sections",
        base_path / "data" / "calibrations",
        base_path / "data" / "notes",
        base_path / "output",
        base_path / "output" / "reports",
        base_path / "output" / "results",
        base_path / ".flow_history",
    ]

    created = []
    for d in dirs_to_create:
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
            created.append(d)

    # 创建配置文件
    config_file = base_path / "flow_config.json"
    
    default_config = {
        "version": __version__,
        "created_at": datetime.now().isoformat(),
        "store_path": str(base_path / ".flow_history"),
        "validation": {
            "max_spacing_ratio": 2.0,
            "velocity_anomaly_std": 3.0,
            "depth_anomaly_std": 3.0,
            "max_allowed_drift": 0.05,
        },
        "calculation": {
            "default_method": "midpoint",
            "edge_extrapolation": True,
            "zero_velocity_at_edge": True,
            "include_uncertainty": True,
        },
        "uncertainty": {
            "depth_uncertainty": 0.02,
            "velocity_uncertainty": 0.03,
            "spacing_uncertainty": 0.01,
            "method_uncertainty_midpoint": 0.015,
            "method_uncertainty_trapezoidal": 0.02,
            "coverage_factor": 2.0,
        },
        "paths": {
            "sections": "data/sections",
            "calibrations": "data/calibrations",
            "notes": "data/notes",
            "reports": "output/reports",
            "results": "output/results",
        },
    }

    if config_file.exists() and not force:
        console.print(f"[yellow]警告: 配置文件已存在: {config_file}[/yellow]")
        console.print("[yellow]使用 --force 选项覆盖配置[/yellow]")
        return

    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(default_config, f, ensure_ascii=False, indent=2)

    # 更新当前会话的配置
    state.config = default_config

    # 输出结果
    table = Table(title="初始化结果", border_style="green")
    table.add_column("项目", style="cyan")
    table.add_column("状态", style="green")
    
    table.add_row("配置文件", f"已创建: {config_file}")
    for d in created:
        table.add_row("目录", f"已创建: {d}")
    
    console.print(table)
    console.print("\n[green]初始化完成！[/green]")
    console.print(f"配置文件位置: {config_file}")
    console.print("使用 'flow-reviewer import' 命令导入数据")


@main.command()
@click.option("--section", "-s", "section_file", type=click.Path(exists=True, dir_okay=False), help="断面数据CSV文件")
@click.option("--calibration", "-c", "calib_file", type=click.Path(exists=True, dir_okay=False), help="校准记录CSV文件")
@click.option("--notes", "-n", "notes_file", type=click.Path(exists=True, dir_okay=False), help="人工备注CSV文件")
@click.option("--encoding", "-e", default="utf-8", help="文件编码 (默认: utf-8)")
@click.option("--save-to-history", "-H", is_flag=True, help="保存到历史存储")
@pass_state
def import_data(state, section_file, calib_file, notes_file, encoding, save_to_history):
    """导入断面数据、校准记录和人工备注"""
    parser = CSVParser(encoding=encoding)
    imported = []

    # 导入断面数据
    if section_file:
        try:
            section, raw_rows = parser.parse_section_data(Path(section_file))
            state.section = section
            imported.append(f"断面数据: {section.section_id}")
            
            # 显示断面信息
            table = Table(title="导入的断面数据", border_style="blue")
            table.add_column("项目", style="cyan")
            table.add_column("值", style="white")
            table.add_row("断面编号", section.section_id)
            if section.section_name:
                table.add_row("断面名称", section.section_name)
            table.add_row("测量日期", section.measurement_date.strftime("%Y-%m-%d %H:%M:%S"))
            table.add_row("河宽", f"{section.river_width:.2f} 米")
            table.add_row("最大水深", f"{section.max_depth:.2f} 米")
            table.add_row("测点数", str(len(section.measuring_points)))
            table.add_row("单位制", "公制" if section.unit.value == "metric" else "英制")
            console.print(table)

            # 保存到历史存储
            if save_to_history:
                store = state.get_store()
                saved_path = store.save_section(section)
                console.print(f"[green]已保存到历史存储: {saved_path}[/green]")

        except Exception as e:
            console.print(f"[red]导入断面数据失败: {e}[/red]")
            return

    # 导入校准记录
    if calib_file:
        try:
            calibration = parser.parse_calibration_record(Path(calib_file))
            state.calibration = calibration
            imported.append(f"校准记录: {calibration.instrument_id}")

            # 显示校准信息
            table = Table(title="导入的校准记录", border_style="yellow")
            table.add_column("项目", style="cyan")
            table.add_column("值", style="white")
            table.add_row("仪器编号", calibration.instrument_id)
            table.add_row("仪器类型", calibration.instrument_type)
            table.add_row("校准日期", calibration.calibration_date.strftime("%Y-%m-%d"))
            if calibration.next_calibration_date:
                table.add_row("下次校准日期", calibration.next_calibration_date.strftime("%Y-%m-%d"))
            table.add_row("校准系数", f"{calibration.calibration_factor:.6f}")
            table.add_row("偏移量", f"{calibration.offset:.6f}")
            table.add_row("不确定度", f"{calibration.uncertainty*100:.2f}%")
            if calibration.certificate_number:
                table.add_row("证书编号", calibration.certificate_number)
            console.print(table)

        except Exception as e:
            console.print(f"[red]导入校准记录失败: {e}[/red]")

    # 导入人工备注
    if notes_file:
        try:
            notes = parser.parse_manual_notes(Path(notes_file))
            state.notes = notes
            imported.append(f"人工备注: {len(notes)} 条")

            # 显示备注信息
            if notes:
                table = Table(title="导入的人工备注", border_style="magenta")
                table.add_column("编号", style="cyan")
                table.add_column("类别", style="white")
                table.add_column("严重程度", style="white")
                table.add_column("内容", style="white", overflow="fold")
                for note in notes[:10]:
                    severity_style = {
                        "error": "red",
                        "warning": "yellow",
                        "info": "cyan",
                    }.get(note.severity, "white")
                    table.add_row(
                        note.id,
                        note.category,
                        f"[{severity_style}]{note.severity}[/{severity_style}]",
                        note.content[:50] + "..." if len(note.content) > 50 else note.content,
                    )
                if len(notes) > 10:
                    table.add_row("...", "...", "...", f"还有 {len(notes) - 10} 条备注")
                console.print(table)

        except Exception as e:
            console.print(f"[red]导入人工备注失败: {e}[/red]")

    if imported:
        console.print("\n[green]导入成功！[/green]")
        for item in imported:
            console.print(f"  ✓ {item}")
    else:
        console.print("[yellow]未导入任何数据，请使用 -s/-c/-n 选项指定文件[/yellow]")


@main.command()
@click.option("--section-id", "-s", help="指定断面编号（从历史存储加载）")
@click.option("--show-details", "-d", is_flag=True, help="显示详细信息")
@click.option("--save-issues", "-S", type=click.Path(), help="将问题保存到CSV文件")
@pass_state
def check(state, section_id, show_details, save_issues):
    """检查单位、测点间距、仪器漂移和异常值"""
    # 如果指定了断面ID，从历史存储加载
    if section_id:
        store = state.get_store()
        history = store.get_section_history(section_id)
        if not history:
            console.print(f"[red]未找到断面 {section_id} 的历史记录[/red]")
            return
        # 加载最新的断面
        latest = history[0]
        section = store.load_section(latest["file_path"])
        if not section:
            console.print(f"[red]加载断面 {section_id} 失败[/red]")
            return
        state.section = section
        console.print(f"已从历史存储加载断面: {section_id}")

    # 检查是否有断面数据
    if state.section is None:
        console.print("[red]没有可用的断面数据[/red]")
        console.print("[yellow]请先使用 'import' 命令导入数据[/yellow]")
        return

    # 获取验证配置
    val_config = state.config.get("validation", {})
    validator = DataValidator(
        max_spacing_ratio=val_config.get("max_spacing_ratio", 2.0),
        velocity_anomaly_std=val_config.get("velocity_anomaly_std", 3.0),
        depth_anomaly_std=val_config.get("depth_anomaly_std", 3.0),
        max_allowed_drift=val_config.get("max_allowed_drift", 0.05),
    )

    # 执行验证
    with console.status("[bold green]正在验证数据...[/bold green]"):
        issues = validator.validate_all(
            state.section,
            state.calibration,
            state.notes,
        )
        state.validation_issues = issues

    # 统计结果
    error_count = sum(1 for i in issues if i.severity == "error")
    warning_count = sum(1 for i in issues if i.severity == "warning")
    info_count = sum(1 for i in issues if i.severity == "info")

    # 显示汇总
    summary_table = Table(title="验证结果汇总", border_style="green")
    summary_table.add_column("类型", style="cyan")
    summary_table.add_column("数量", style="white")
    summary_table.add_row("错误", f"[red]{error_count}[/red]")
    summary_table.add_row("警告", f"[yellow]{warning_count}[/yellow]")
    summary_table.add_row("提示", f"[cyan]{info_count}[/cyan]")
    summary_table.add_row("合计", str(len(issues)))
    console.print(summary_table)

    # 显示详细信息
    if show_details and issues:
        for severity in ["error", "warning", "info"]:
            severity_issues = [i for i in issues if i.severity == severity]
            if severity_issues:
                severity_label = {
                    "error": "错误",
                    "warning": "警告",
                    "info": "提示",
                }.get(severity, severity)
                severity_style = {
                    "error": "red",
                    "warning": "yellow",
                    "info": "cyan",
                }.get(severity, "white")

                detail_table = Table(
                    title=f"{severity_label}问题详情",
                    border_style=severity_style,
                )
                detail_table.add_column("编号", style="cyan")
                detail_table.add_column("类型", style="white")
                detail_table.add_column("测点", style="white")
                detail_table.add_column("描述", style="white", overflow="fold")
                detail_table.add_column("建议", style="green", overflow="fold")

                for issue in severity_issues:
                    point_str = str(issue.related_point_id) if issue.related_point_id else "-"
                    suggestion = issue.suggestion if issue.suggestion else "-"
                    detail_table.add_row(
                        issue.issue_id,
                        issue.issue_type,
                        point_str,
                        issue.message,
                        suggestion,
                    )
                console.print(detail_table)

    # 保存问题到CSV
    if save_issues and issues:
        reporter = ReportGenerator()
        reporter.export_validation_issues_to_csv(issues, Path(save_issues))
        console.print(f"[green]验证问题已保存到: {save_issues}[/green]")

    # 结论
    if error_count > 0:
        console.print(f"\n[red]❌ 验证发现 {error_count} 个错误，需要修正后再进行计算[/red]")
    elif warning_count > 0:
        console.print(f"\n[yellow]⚠️ 验证发现 {warning_count} 个警告，建议检查后进行计算[/yellow]")
    else:
        console.print(f"\n[green]✅ 验证通过，无严重问题[/green]")


@main.command()
@click.option("--section-id", "-s", help="指定断面编号（从历史存储加载）")
@click.option("--method", "-m", type=click.Choice(["midpoint", "trapezoidal", "both"]), default="midpoint", help="计算方法: midpoint(中垂线法), trapezoidal(梯形法), both(两种都算)")
@click.option("--no-uncertainty", "-U", is_flag=True, help="不计算不确定度")
@click.option("--save-to-history", "-H", is_flag=True, help="保存结果到历史存储")
@click.option("--output", "-o", type=click.Path(), help="输出结果到CSV文件")
@pass_state
def compute(state, section_id, method, no_uncertainty, save_to_history, output):
    """用中垂线/梯形规则计算流量并给出不确定度"""
    # 如果指定了断面ID，从历史存储加载
    if section_id:
        store = state.get_store()
        history = store.get_section_history(section_id)
        if not history:
            console.print(f"[red]未找到断面 {section_id} 的历史记录[/red]")
            return
        latest = history[0]
        section = store.load_section(latest["file_path"])
        if not section:
            console.print(f"[red]加载断面 {section_id} 失败[/red]")
            return
        state.section = section
        console.print(f"已从历史存储加载断面: {section_id}")

    # 检查是否有断面数据
    if state.section is None:
        console.print("[red]没有可用的断面数据[/red]")
        console.print("[yellow]请先使用 'import' 命令导入数据[/yellow]")
        return

    # 检查测点数
    if len(state.section.measuring_points) < 2:
        console.print("[red]测点数不足，至少需要2个测点才能计算流量[/red]")
        return

    # 获取计算配置
    calc_config = state.config.get("calculation", {})
    include_uncertainty = not no_uncertainty

    # 计算
    results = {}
    
    with console.status("[bold green]正在计算流量...[/bold green]"):
        if method in ["midpoint", "both"]:
            calculator = FlowCalculator(
                method=FlowMethod.MIDPOINT,
                edge_extrapolation=calc_config.get("edge_extrapolation", True),
                zero_velocity_at_edge=calc_config.get("zero_velocity_at_edge", True),
            )
            result = calculator.calculate(
                state.section,
                state.calibration,
                include_uncertainty=include_uncertainty,
            )
            results["midpoint"] = result

        if method in ["trapezoidal", "both"]:
            calculator = FlowCalculator(
                method=FlowMethod.TRAPEZOIDAL,
                edge_extrapolation=calc_config.get("edge_extrapolation", True),
                zero_velocity_at_edge=calc_config.get("zero_velocity_at_edge", True),
            )
            result = calculator.calculate(
                state.section,
                state.calibration,
                include_uncertainty=include_uncertainty,
            )
            results["trapezoidal"] = result

    # 显示结果
    if method == "both":
        # 显示两种方法的比较
        console.print(Panel("[bold blue]计算结果对比[/bold blue]", border_style="blue"))
        
        table = Table(title="两种方法结果对比", border_style="green")
        table.add_column("指标", style="cyan")
        table.add_column("中垂线法", style="white")
        table.add_column("梯形法", style="white")
        table.add_column("差异", style="yellow")

        mid = results["midpoint"]
        trap = results["trapezoidal"]
        
        q_diff = abs(mid.total_discharge - trap.total_discharge)
        q_rel = (q_diff / mid.total_discharge * 100) if mid.total_discharge > 0 else 0
        
        table.add_row("总流量", f"{mid.total_discharge:.4f} m³/s", f"{trap.total_discharge:.4f} m³/s", f"{q_rel:.2f}%")
        table.add_row("过水面积", f"{mid.total_area:.2f} m²", f"{trap.total_area:.2f} m²", "")
        table.add_row("平均流速", f"{mid.average_velocity:.4f} m/s", f"{trap.average_velocity:.4f} m/s", "")
        
        console.print(table)

        # 默认保存中垂线法结果
        state.flow_result = results["midpoint"]
    else:
        # 显示单一方法结果
        result = list(results.values())[0]
        state.flow_result = result
        
        method_name = "中垂线法" if method == "midpoint" else "梯形法"
        console.print(Panel(f"[bold blue]计算结果 ({method_name})[/bold blue]", border_style="blue"))
        
        table = Table(title="流量计算结果", border_style="green")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="white")
        table.add_column("单位", style="white")
        
        table.add_row("总流量", f"{result.total_discharge:.4f}", "m³/s")
        table.add_row("过水面积", f"{result.total_area:.2f}", "m²")
        table.add_row("平均流速", f"{result.average_velocity:.4f}", "m/s")
        if result.max_velocity:
            table.add_row("最大流速", f"{result.max_velocity:.4f}", "m/s")
        table.add_row("河宽", f"{result.river_width:.2f}", "米")
        table.add_row("最大水深", f"{result.max_depth:.2f}", "米")
        table.add_row("分段数", str(len(result.segment_results)), "个")
        
        console.print(table)

        # 显示不确定度
        if include_uncertainty and result.uncertainty:
            uncert_table = Table(title="不确定度分析", border_style="yellow")
            uncert_table.add_column("指标", style="cyan")
            uncert_table.add_column("数值", style="white")
            
            uncert_table.add_row("合成不确定度", f"{result.uncertainty.combined_uncertainty:.4f} m³/s")
            uncert_table.add_row("相对不确定度", f"{result.uncertainty.relative_uncertainty:.2f} %")
            uncert_table.add_row(
                "扩展不确定度 (k=2)",
                f"{result.uncertainty.expanded_uncertainty:.4f} m³/s"
            )
            
            console.print(uncert_table)
            
            # 不确定度结论
            rel_uncert = result.uncertainty.relative_uncertainty
            if rel_uncert <= 2:
                console.print(f"[green]✅ 测量精度良好 (相对不确定度 {rel_uncert:.2f}% ≤ 2%)[/green]")
            elif rel_uncert <= 5:
                console.print(f"[yellow]⚠️ 测量精度一般 (相对不确定度 {rel_uncert:.2f}% ≤ 5%)[/yellow]")
            else:
                console.print(f"[red]❌ 测量精度较差 (相对不确定度 {rel_uncert:.2f}% > 5%)[/red]")
            
            console.print(f"[bold]流量结果: {result.total_discharge:.4f} ± {result.uncertainty.expanded_uncertainty:.4f} m³/s[/bold]")

    # 保存到历史存储
    if save_to_history and state.flow_result:
        store = state.get_store()
        saved_path = store.save_result(state.flow_result)
        console.print(f"[green]结果已保存到历史存储: {saved_path}[/green]")

    # 输出到CSV
    if output and state.flow_result:
        reporter = ReportGenerator()
        reporter.export_to_csv(state.flow_result, Path(output))
        console.print(f"[green]结果已保存到: {output}[/green]")


@main.command()
@click.option("--current", "-c", "current_id", required=True, help="当前断面编号")
@click.option("--historical", "-h", "historical_id", required=True, help="历史断面编号")
@click.option("--output", "-o", type=click.Path(), help="输出对比结果到JSON文件")
@pass_state
def compare(state, current_id, historical_id, output):
    """对比历史断面的流量和形态变化"""
    store = state.get_store()

    # 加载当前断面
    current_history = store.get_section_history(current_id)
    if not current_history:
        console.print(f"[red]未找到当前断面 {current_id} 的历史记录[/red]")
        return
    current = store.load_section(current_history[0]["file_path"])
    if not current:
        console.print(f"[red]加载当前断面 {current_id} 失败[/red]")
        return

    # 加载历史断面
    historical_history = store.get_section_history(historical_id)
    if not historical_history:
        console.print(f"[red]未找到历史断面 {historical_id} 的历史记录[/red]")
        return
    historical = store.load_section(historical_history[0]["file_path"])
    if not historical:
        console.print(f"[red]加载历史断面 {historical_id} 失败[/red]")
        return

    # 计算流量（如果还没有计算）
    calc_config = state.config.get("calculation", {})
    default_method = calc_config.get("default_method", "midpoint")
    
    calculator = FlowCalculator(
        method=FlowMethod.MIDPOINT if default_method == "midpoint" else FlowMethod.TRAPEZOIDAL,
        edge_extrapolation=calc_config.get("edge_extrapolation", True),
        zero_velocity_at_edge=calc_config.get("zero_velocity_at_edge", True),
    )

    with console.status("[bold green]正在计算流量并对比...[/bold green]"):
        current_result = calculator.calculate(current, include_uncertainty=False)
        historical_result = calculator.calculate(historical, include_uncertainty=False)

        # 对比
        comparison = HistoricalComparer.compare(
            current, historical, current_result, historical_result
        )
        state.historical_comparison = comparison

    # 显示对比结果
    console.print(Panel(f"[bold blue]断面对比结果[/bold blue]", border_style="blue"))
    
    # 基本信息
    info_table = Table(title="对比基本信息", border_style="green")
    info_table.add_column("项目", style="cyan")
    info_table.add_column("当前断面", style="white")
    info_table.add_column("历史断面", style="white")
    
    info_table.add_row("断面编号", current_id, historical_id)
    info_table.add_row("测量日期", current.measurement_date.strftime("%Y-%m-%d"), historical.measurement_date.strftime("%Y-%m-%d"))
    info_table.add_row("测点数", str(len(current.measuring_points)), str(len(historical.measuring_points)))
    info_table.add_row("河宽", f"{current.river_width:.2f} m", f"{historical.river_width:.2f} m")
    info_table.add_row("最大水深", f"{current.max_depth:.2f} m", f"{historical.max_depth:.2f} m")
    
    console.print(info_table)

    # 流量对比
    result_table = Table(title="流量对比", border_style="yellow")
    result_table.add_column("指标", style="cyan")
    result_table.add_column("当前值", style="white")
    result_table.add_column("历史值", style="white")
    result_table.add_column("差值", style="white")
    result_table.add_column("相对变化", style="white")
    
    q_diff = comparison.discharge_difference
    q_rel = comparison.discharge_difference_percent
    
    result_table.add_row(
        "总流量",
        f"{current_result.total_discharge:.4f} m³/s",
        f"{historical_result.total_discharge:.4f} m³/s",
        f"{q_diff:+.4f} m³/s",
        f"{'[green]' if q_rel >= 0 else '[red]'}{q_rel:+.2f}%{'[/green]' if q_rel >= 0 else '[/red]'}",
    )
    
    if comparison.area_difference is not None:
        result_table.add_row(
            "过水面积",
            f"{current_result.total_area:.2f} m²",
            f"{historical_result.total_area:.2f} m²",
            f"{comparison.area_difference:+.2f} m²",
            f"{comparison.area_difference_percent:+.2f}%",
        )
    
    if comparison.velocity_difference is not None:
        result_table.add_row(
            "平均流速",
            f"{current_result.average_velocity:.4f} m/s",
            f"{historical_result.average_velocity:.4f} m/s",
            f"{comparison.velocity_difference:+.4f} m/s",
            f"{comparison.velocity_difference_percent:+.2f}%",
        )
    
    if comparison.depth_profile_difference is not None:
        result_table.add_row(
            "断面形态差异指数",
            "-",
            "-",
            f"{comparison.depth_profile_difference:.4f}",
            "-",
        )
    
    console.print(result_table)

    # 变化趋势分析
    console.print("\n[bold]变化趋势分析:[/bold]")
    q_pct = comparison.discharge_difference_percent
    if abs(q_pct) <= 5:
        console.print(f"[green]✅ 流量变化在正常范围内（±5%以内），变化率: {q_pct:+.2f}%[/green]")
    elif abs(q_pct) <= 15:
        console.print(f"[yellow]⚠️ 流量有一定变化（±5% ~ ±15%），变化率: {q_pct:+.2f}%[/yellow]")
    else:
        console.print(f"[red]❌ 流量变化较大（超过±15%），变化率: {q_pct:+.2f}%[/red]")

    # 输出到JSON
    if output:
        output_dict = {
            "current_section_id": comparison.current_section_id,
            "historical_section_id": comparison.historical_section_id,
            "comparison_date": comparison.comparison_date.isoformat(),
            "discharge_difference": comparison.discharge_difference,
            "discharge_difference_percent": comparison.discharge_difference_percent,
            "area_difference": comparison.area_difference,
            "area_difference_percent": comparison.area_difference_percent,
            "velocity_difference": comparison.velocity_difference,
            "velocity_difference_percent": comparison.velocity_difference_percent,
            "depth_profile_difference": comparison.depth_profile_difference,
            "current_result": {
                "total_discharge": current_result.total_discharge,
                "total_area": current_result.total_area,
                "average_velocity": current_result.average_velocity,
            },
            "historical_result": {
                "total_discharge": historical_result.total_discharge,
                "total_area": historical_result.total_area,
                "average_velocity": historical_result.average_velocity,
            },
        }
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(output_dict, f, ensure_ascii=False, indent=2)
        
        console.print(f"[green]对比结果已保存到: {output}[/green]")


@main.command()
@click.option("--section-id", "-s", help="指定断面编号（从历史存储加载）")
@click.option("--output", "-o", type=click.Path(), required=True, help="输出文件路径（不含扩展名）")
@click.option("--format", "-f", "fmt", type=click.Choice(["md", "csv", "both"]), default="both", help="输出格式: md, csv, both")
@click.option("--no-segments", "-S", is_flag=True, help="不包含分段详细信息")
@click.option("--no-uncertainty", "-U", is_flag=True, help="不包含不确定度分析")
@click.option("--include-history", "-H", is_flag=True, help="包含历史对比（需要先执行 compare 命令）")
@pass_state
def export_report(state, section_id, output, fmt, no_segments, no_uncertainty, include_history):
    """导出 Markdown 复核报告和 CSV 结果"""
    # 如果指定了断面ID，从历史存储加载
    if section_id:
        store = state.get_store()
        history = store.get_section_history(section_id)
        if not history:
            console.print(f"[red]未找到断面 {section_id} 的历史记录[/red]")
            return
        latest = history[0]
        section = store.load_section(latest["file_path"])
        if not section:
            console.print(f"[red]加载断面 {section_id} 失败[/red]")
            return
        state.section = section
        console.print(f"已从历史存储加载断面: {section_id}")

    # 检查必要的数据
    if state.section is None:
        console.print("[red]没有可用的断面数据[/red]")
        console.print("[yellow]请先使用 'import' 或 'compute' 命令[/yellow]")
        return

    # 如果还没有计算结果，先计算
    if state.flow_result is None:
        calc_config = state.config.get("calculation", {})
        default_method = calc_config.get("default_method", "midpoint")
        
        calculator = FlowCalculator(
            method=FlowMethod.MIDPOINT if default_method == "midpoint" else FlowMethod.TRAPEZOIDAL,
            edge_extrapolation=calc_config.get("edge_extrapolation", True),
            zero_velocity_at_edge=calc_config.get("zero_velocity_at_edge", True),
        )
        
        with console.status("[bold green]正在计算流量...[/bold green]"):
            state.flow_result = calculator.calculate(
                state.section,
                state.calibration,
                include_uncertainty=not no_uncertainty,
            )

    # 生成报告
    reporter = ReportGenerator()
    output_path = Path(output)

    with console.status("[bold green]正在生成报告...[/bold green]"):
        if fmt in ["md", "both"]:
            md_content = reporter.generate_markdown_report(
                section=state.section,
                result=state.flow_result,
                validation_issues=state.validation_issues if state.validation_issues else None,
                historical_comparison=state.historical_comparison if include_history else None,
                include_segments=not no_segments,
                include_uncertainty=not no_uncertainty,
            )
            
            md_file = output_path.with_suffix(".md")
            with open(md_file, "w", encoding="utf-8") as f:
                f.write(md_content)
            
            console.print(f"[green]Markdown 报告已生成: {md_file}[/green]")

        if fmt in ["csv", "both"]:
            csv_file = output_path.with_suffix(".csv")
            reporter.export_to_csv(
                state.flow_result,
                csv_file,
                include_segments=not no_segments,
            )
            console.print(f"[green]CSV 结果已生成: {csv_file}[/green]")

            # 如果有验证问题，也导出
            if state.validation_issues:
                issues_csv = output_path.parent / f"{output_path.stem}_issues.csv"
                reporter.export_validation_issues_to_csv(
                    state.validation_issues,
                    issues_csv,
                )
                console.print(f"[green]验证问题已导出: {issues_csv}[/green]")

    console.print("\n[green]导出完成！[/green]")


@main.command(name="list")
@click.option("--type", "-t", "list_type", type=click.Choice(["sections", "results", "all"]), default="all", help="列出类型: sections, results, all")
@pass_state
def list_items(state, list_type):
    """列出历史存储中的断面和计算结果"""
    store = state.get_store()
    
    if list_type in ["sections", "all"]:
        sections = store.get_all_sections()
        if sections:
            table = Table(title="历史断面", border_style="blue")
            table.add_column("断面编号", style="cyan")
            table.add_column("测量日期", style="white")
            table.add_column("测点数", style="white")
            table.add_column("河宽", style="white")
            table.add_column("最大水深", style="white")
            
            for s in sections[:20]:
                table.add_row(
                    s["section_id"],
                    s["measurement_date"][:10] if "T" in s["measurement_date"] else s["measurement_date"],
                    str(s.get("point_count", "-")),
                    f"{s.get('river_width', '-'):.2f} m" if s.get('river_width') else "-",
                    f"{s.get('max_depth', '-'):.2f} m" if s.get('max_depth') else "-",
                )
            
            if len(sections) > 20:
                table.add_row("...", "...", "...", "...", "...")
                table.add_row("", f"共 {len(sections)} 个断面", "", "", "")
            
            console.print(table)
        else:
            console.print("[yellow]没有历史断面记录[/yellow]")

    if list_type in ["results", "all"]:
        results = store.get_all_results()
        if results:
            table = Table(title="计算结果", border_style="green")
            table.add_column("断面编号", style="cyan")
            table.add_column("计算日期", style="white")
            table.add_column("方法", style="white")
            table.add_column("总流量", style="white")
            
            for r in results[:20]:
                method_name = "中垂线法" if r["method"] == "midpoint" else "梯形法"
                table.add_row(
                    r["section_id"],
                    r["calculation_date"][:10] if "T" in r["calculation_date"] else r["calculation_date"],
                    method_name,
                    f"{r.get('total_discharge', 0):.4f} m³/s",
                )
            
            if len(results) > 20:
                table.add_row("...", "...", "...", "...")
                table.add_row("", f"共 {len(results)} 个结果", "", "")
            
            console.print(table)
        else:
            console.print("[yellow]没有计算结果记录[/yellow]")


if __name__ == "__main__":
    main()
