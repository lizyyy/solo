import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from uuid import uuid4

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    SimulationParams,
    ThresholdParams,
    AnalysisReport,
    RiskLevel,
)
from .parser import CSVLoader, DataValidator
from .simulation import WaterQualitySimulator
from .rules import RiskEngine, RecommendationEngine
from .comparison import ScenarioComparison
from .exporter import MarkdownExporter, CSVExporter, JSONExporter


console = Console()


def load_source_water_params(file_path: str) -> Dict[str, float]:
    loader = CSVLoader()
    try:
        import csv
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        params: Dict[str, float] = {}
        for row in rows:
            param = row.get("parameter", "")
            value = row.get("value", "0")
            try:
                params[param] = float(value)
            except ValueError:
                pass
        return params
    except Exception as e:
        console.print(f"[yellow]警告: 无法读取水源参数文件 {file_path}: {e}，使用默认值[/yellow]")
        return {
            "ph": 8.0,
            "salinity": 0.0,
            "ammonia_nitrogen": 0.0,
            "nitrite": 0.0,
        }


def run_analysis(args: argparse.Namespace) -> int:
    console.print(Panel.fit(
        "[bold cyan]育苗池水质换水推演器[/bold cyan]\n"
        "[dim]水质分析与处置方案生成[/dim]",
        title="开始分析",
        title_align="left"
    ))

    loader = CSVLoader()
    validator = DataValidator()
    thresholds = ThresholdParams()
    risk_engine = RiskEngine(thresholds)
    rec_engine = RecommendationEngine(thresholds)

    console.print("\n[bold]📂 加载数据文件...[/bold]")

    pond_config: Optional[PondConfig] = None
    if args.pond_config:
        pond_config = loader.load_pond_config(args.pond_config)
        if pond_config is None:
            console.print(f"[red]错误: 无法加载池塘配置文件 {args.pond_config}[/red]")
            for error in loader.validation_errors:
                console.print(f"  - {error}")
            return 1
        console.print(f"  ✓ 池塘配置: {pond_config.pond_name} ({pond_config.pond_id})")

    initial_state: Optional[PondState] = None
    if args.water_quality:
        pond_id = pond_config.pond_id if pond_config else "unknown"
        initial_state = loader.load_water_quality_state(args.water_quality, pond_id)
        if initial_state is None:
            console.print(f"[red]错误: 无法加载水质状态文件 {args.water_quality}[/red]")
            return 1
        console.print(f"  ✓ 水质状态: {initial_state.timestamp.strftime('%Y-%m-%d %H:%M')}")

    sensor_data = None
    if args.sensor_records:
        pond_id = pond_config.pond_id if pond_config else None
        sensor_data = loader.load_sensor_records(args.sensor_records, pond_id)
        if sensor_data:
            console.print(f"  ✓ 传感器记录: {len(sensor_data.records)} 条记录")

    source_water_params = {"ph": 8.0, "salinity": 0.0, "ammonia_nitrogen": 0.0, "nitrite": 0.0}
    if args.source_water:
        source_water_params = load_source_water_params(args.source_water)
        console.print(f"  ✓ 水源参数已加载")

    if initial_state is None:
        console.print("[red]错误: 必须提供水质状态文件 (--water-quality)[/red]")
        return 1

    console.print("\n[bold]🔍 数据验证...[/bold]")

    if pond_config:
        val_result = validator.validate_complete_data(pond_config, initial_state, sensor_data)
        if not val_result.is_valid:
            console.print("[yellow]警告: 数据验证发现错误:[/yellow]")
            for error in val_result.errors:
                console.print(f"  - {error}")
        if val_result.warnings:
            console.print("[yellow]警告: 数据验证发现警告:[/yellow]")
            for warning in val_result.warnings:
                console.print(f"  - {warning}")
    else:
        val_result = validator.validate_pond_state(initial_state)

    console.print("  ✓ 验证完成")

    console.print("\n[bold]⚠️ 风险检测...[/bold]")

    risks = risk_engine.check_initial_state_risks(initial_state)

    if risks:
        table = Table(title="检测到的风险")
        table.add_column("风险等级", style="cyan")
        table.add_column("风险类型", style="magenta")
        table.add_column("描述", style="green")

        for risk in risks:
            level_style = {
                RiskLevel.CRITICAL: "bold red",
                RiskLevel.DANGER: "bold magenta",
                RiskLevel.WARNING: "bold yellow",
                RiskLevel.SAFE: "bold green",
            }.get(risk.risk_level, "")
            table.add_row(
                f"[{level_style}]{risk.risk_level.value}[/{level_style}]",
                risk.risk_type.value,
                risk.description,
            )
        console.print(table)
    else:
        console.print("  ✓ 未检测到显著风险")

    console.print("\n[bold]📊 生成处置建议...[/bold]")

    if not pond_config:
        pond_config = PondConfig(
            pond_id=initial_state.pond_id,
            pond_name="未命名池塘",
            volume=100,
            area=50,
            depth=2.0,
            species="未知品种",
            stage="未知阶段",
            stocking_density=1000,
        )

    scenario, recommendations = rec_engine.generate_scenario(
        pond_config=pond_config,
        current_state=initial_state,
        source_water_params=source_water_params,
        risks=risks,
        scenario_id=f"scenario_{uuid4().hex[:8]}",
        scenario_name="推荐方案",
    )

    if recommendations.get("water_change", {}).get("recommended"):
        wc = recommendations["water_change"]
        console.print(f"  💧 换水建议: {wc['exchange_ratio'] * 100:.1f}% ({wc['urgency']})")
        console.print(f"     原因: {wc['reason']}")

    if recommendations.get("aeration", {}).get("recommended"):
        aer = recommendations["aeration"]
        console.print(f"  🌀 曝气建议: {aer['intensity']} 强度, 持续 {aer['duration_hours']} 小时")
        console.print(f"     原因: {aer['reason']}")

    if recommendations.get("probiotics", {}).get("recommended"):
        prob = recommendations["probiotics"]
        console.print(f"  🦠 补菌建议: {prob['probiotics_type']}, {prob['dosage']} g/m³")
        console.print(f"     原因: {prob['reason']}")

    console.print("\n[bold]🔮 运行24小时水质模拟...[/bold]")

    simulator = WaterQualitySimulator(pond_config)

    sim_params = SimulationParams(
        simulation_hours=24,
        time_step=1.0,
        feed_rate=args.feed_rate if args.feed_rate else 0.5,
        feed_protein_content=40.0,
        aeration_rate=0.0,
        water_exchange_rate=0.0,
        probiotics_dosage=0.0,
        source_water_ph=source_water_params.get("ph", 8.0),
        source_water_salinity=source_water_params.get("salinity", 0.0),
        source_water_ammonia=source_water_params.get("ammonia_nitrogen", 0.0),
        source_water_nitrite=source_water_params.get("nitrite", 0.0),
    )

    initial_params = WaterQualityParams(
        temperature=initial_state.temperature,
        ph=initial_state.ph,
        ammonia_nitrogen=initial_state.ammonia_nitrogen,
        nitrite=initial_state.nitrite,
        salinity=initial_state.salinity,
        dissolved_oxygen=initial_state.dissolved_oxygen,
        turbidity=initial_state.turbidity,
        alkalinity=initial_state.alkalinity,
        hardness=initial_state.hardness,
    )

    baseline_result = simulator.simulate_baseline(
        initial_params, sim_params, initial_state.timestamp
    )

    scenario_result = simulator.simulate_with_scenario(
        initial_params, sim_params, scenario, initial_state.timestamp
    )

    baseline_final = baseline_result.get_final_state()
    scenario_final = scenario_result.get_final_state()

    table = Table(title="24小时模拟结果对比")
    table.add_column("指标", style="cyan")
    table.add_column("初始值", style="magenta")
    table.add_column("基线预测(无干预)", style="yellow")
    table.add_column("方案预测(有干预)", style="green")

    metrics = [
        ("氨氮 (mg/L)", initial_state.ammonia_nitrogen, baseline_final.get("ammonia_nitrogen"), scenario_final.get("ammonia_nitrogen")),
        ("亚硝酸盐 (mg/L)", initial_state.nitrite, baseline_final.get("nitrite"), scenario_final.get("nitrite")),
        ("pH值", initial_state.ph, baseline_final.get("ph"), scenario_final.get("ph")),
        ("溶解氧 (mg/L)", initial_state.dissolved_oxygen, baseline_final.get("dissolved_oxygen"), scenario_final.get("dissolved_oxygen")),
    ]

    for name, init, base, scen in metrics:
        table.add_row(
            name,
            f"{init:.4f}",
            f"{base:.4f}" if base else "-",
            f"{scen:.4f}" if scen else "-",
        )
    console.print(table)

    console.print("\n[bold]📋 生成分析报告...[/bold]")

    scenario_risks = risk_engine.check_complete_risks(
        initial_state, scenario_result, scenario=scenario
    )

    summary_parts = []
    if recommendations.get("water_change", {}).get("recommended"):
        summary_parts.append(f"建议换水 {recommendations['water_change']['exchange_ratio'] * 100:.1f}%")
    if recommendations.get("aeration", {}).get("recommended"):
        summary_parts.append(f"建议曝气 {recommendations['aeration']['duration_hours']} 小时")
    if recommendations.get("probiotics", {}).get("recommended"):
        summary_parts.append(f"建议投加 {recommendations['probiotics']['probiotics_type']}")

    summary = "、".join(summary_parts) if summary_parts else "水质良好，无需特殊处理"

    report = AnalysisReport(
        report_id=f"report_{uuid4().hex[:12]}",
        pond_id=pond_config.pond_id,
        scenario_id=scenario.scenario_id,
        initial_state=initial_state.to_dict(),
        simulation_result=scenario_result,
        risks=scenario_risks,
        recommendations=recommendations,
        summary=summary,
    )

    console.print(f"  ✓ 报告 ID: {report.report_id}")
    console.print(f"  ✓ 最高风险等级: {report.get_highest_risk_level().value}")

    output_dir = Path(args.output_dir) if args.output_dir else Path.cwd() / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    console.print(f"\n[bold]💾 导出报告到 {output_dir}...[/bold]")

    md_exporter = MarkdownExporter()
    csv_exporter = CSVExporter()
    json_exporter = JSONExporter()

    md_path = output_dir / f"处置单_{report.report_id}.md"
    md_exporter.export_analysis_report(
        str(md_path), report, pond_config, initial_state, scenario
    )
    console.print(f"  ✓ Markdown处置单: {md_path.name}")

    csv_path = output_dir / f"模拟曲线_{report.report_id}.csv"
    csv_exporter.export_simulation_curve(str(csv_path), scenario_result, scenario.scenario_name)
    console.print(f"  ✓ CSV曲线数据: {csv_path.name}")

    json_path = output_dir / f"审计包_{report.report_id}.json"
    json_exporter.export_audit_package(
        str(json_path), report, pond_config, initial_state, scenario
    )
    console.print(f"  ✓ JSON审计包: {json_path.name}")

    if args.compare:
        console.print("\n[bold]🔄 运行方案对比分析...[/bold]")

        comparator = ScenarioComparison(pond_config, thresholds)

        comparison_report = comparator.compare_scenarios(
            initial_state=initial_state,
            simulation_params=sim_params,
            baseline_scenario=None,
            comparison_scenario=scenario,
        )

        comp_md_path = output_dir / f"方案对比_{comparison_report.comparison_id}.md"
        md_exporter.export_comparison_report(str(comp_md_path), comparison_report)
        console.print(f"  ✓ 方案对比报告: {comp_md_path.name}")

        comp_json_path = output_dir / f"对比审计_{comparison_report.comparison_id}.json"
        json_exporter.export_comparison_audit(str(comp_json_path), comparison_report)
        console.print(f"  ✓ 对比审计包: {comp_json_path.name}")

    console.print("\n[bold green]✅ 分析完成！[/bold green]")
    console.print(f"\n报告已导出到: {output_dir.resolve()}")

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="wqs",
        description="育苗池水质换水推演器 - 水产育苗场水质科学计算工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  wqs analyze --pond-config examples/pond_config.csv --water-quality examples/water_quality.csv
  wqs analyze --water-quality examples/water_quality.csv --sensor-records examples/sensor_records.csv --compare
  wqs analyze --water-quality examples/water_quality.csv --feed-rate 0.8 --output-dir ./results
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    analyze_parser = subparsers.add_parser("analyze", help="运行水质分析")
    analyze_parser.add_argument(
        "--pond-config", "-c",
        type=str,
        help="池塘配置CSV文件路径",
    )
    analyze_parser.add_argument(
        "--water-quality", "-w",
        type=str,
        required=True,
        help="水质状态CSV文件路径 (必需)",
    )
    analyze_parser.add_argument(
        "--sensor-records", "-s",
        type=str,
        help="传感器记录CSV文件路径",
    )
    analyze_parser.add_argument(
        "--source-water", "-sw",
        type=str,
        help="水源参数CSV文件路径",
    )
    analyze_parser.add_argument(
        "--feed-rate", "-f",
        type=float,
        default=0.5,
        help="投喂率 (kg/小时), 默认: 0.5",
    )
    analyze_parser.add_argument(
        "--compare", "-cmp",
        action="store_true",
        help="运行方案对比分析",
    )
    analyze_parser.add_argument(
        "--output-dir", "-o",
        type=str,
        help="输出目录路径",
    )

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 0

    try:
        if args.command == "analyze":
            return run_analysis(args)
        else:
            parser.print_help()
            return 0
    except KeyboardInterrupt:
        console.print("\n[yellow]操作已取消[/yellow]")
        return 1
    except Exception as e:
        console.print(f"[red]错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
