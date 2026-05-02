"""
CLI 命令入口

支持命令：
- help: 显示帮助信息
- simulate: 模拟晾晒场景
- compare: 对比两个晾晒方案
- export/report: 导出报告
"""
import sys
import os
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

from .models import (
    DryingResult,
    ComparisonResult,
    DryingScenario,
)
from .input_parser import InputParser, InputParserError
from .validator import Validator, ValidationError
from .drying_model import DryingModel
from .risk_assessment import RiskAssessor
from .report_generator import ReportGenerator


def create_drying_result(
    scenario: DryingScenario,
    processing_results: Dict,
) -> DryingResult:
    """从处理结果创建DryingResult对象"""
    clothing_results = processing_results.get("clothing_results", [])
    
    if clothing_results:
        sorted_items = sorted(clothing_results, key=lambda x: x["dry_time_hours"])
        quickest = sorted_items[0]
        slowest = sorted_items[-1]
        avg_time = sum(x["dry_time_hours"] for x in clothing_results) / len(clothing_results)
        total_time = sum(x["dry_time_hours"] for x in clothing_results)
    else:
        quickest = {}
        slowest = {}
        avg_time = 0
        total_time = 0
    
    risk_assessments, overall_risk = RiskAssessor.assess_all_items(
        scenario, processing_results
    )
    
    recommendations = RiskAssessor.generate_recommendations(
        scenario, processing_results, risk_assessments, overall_risk
    )
    
    return DryingResult(
        scenario_name=scenario.name,
        total_dry_time_hours=total_time,
        average_dry_time_hours=avg_time,
        quickest_item=quickest,
        slowest_item=slowest,
        risk_assessments=risk_assessments,
        overall_risk_level=overall_risk,
        recommendations=recommendations,
        weather_summary=processing_results.get("weather_summary", {}),
        raw_data=processing_results,
    )


def process_scenario(file_path: str) -> DryingResult:
    """处理单个场景文件"""
    print(f"📂 正在加载场景文件: {file_path}")
    
    try:
        scenario = InputParser.parse_json_scenario(file_path)
    except InputParserError as e:
        print(f"❌ 解析错误: {e}")
        sys.exit(1)
    
    print(f"✅ 场景解析完成: {scenario.name}")
    
    print(f"🔍 正在校验数据...")
    errors = Validator.validate_scenario(scenario)
    if errors:
        print(f"❌ 校验失败:")
        print(Validator.format_errors(errors))
        sys.exit(1)
    print(f"✅ 数据校验通过")
    
    print(f"🔄 正在计算干燥曲线...")
    processing_results = DryingModel.process_scenario(scenario)
    print(f"✅ 干燥曲线计算完成")
    
    print(f"⚠️  正在评估风险...")
    result = create_drying_result(scenario, processing_results)
    print(f"✅ 风险评估完成")
    
    return result


def cmd_help(args: argparse.Namespace):
    """显示帮助信息"""
    help_text = """
🌧️ 梅雨季晾衣干燥预估器 v1.0.0

使用方法:
  python -m laundry_dryer <command> [options]

可用命令:
  simulate  <scenario.json>      模拟单个晾晒场景
  compare   <a.json> <b.json>    对比两个晾晒方案
  export    <scenario.json>       导出报告 (可指定 --md, --html, --json)
  report    <scenario.json>       别名: 同 export
  help                             显示此帮助信息

示例:
  # 模拟场景并显示终端摘要
  python -m laundry_dryer simulate examples/scenario1_normal.json
  
  # 对比两个方案
  python -m laundry_dryer compare examples/scenario1_normal.json examples/scenario2_optimized.json
  
  # 导出所有格式的报告
  python -m laundry_dryer export examples/scenario1_normal.json --md --html --json
  
  # 指定输出目录
  python -m laundry_dryer export examples/scenario1_normal.json --md -o ./output/

输入格式:
  - JSON场景文件: 包含衣物列表和天气时段
  - CSV衣物清单: 可配合默认天气使用 (见 examples/ 目录)

输出格式:
  - 终端摘要: 控制台直接显示
  - Markdown: --md 或 --markdown
  - HTML: --html
  - JSON: --json
"""
    print(help_text)


def cmd_simulate(args: argparse.Namespace):
    """模拟晾晒场景"""
    scenario_file = args.scenario
    
    if not os.path.exists(scenario_file):
        print(f"❌ 场景文件不存在: {scenario_file}")
        sys.exit(1)
    
    result = process_scenario(scenario_file)
    
    print("\n" + "=" * 60)
    print(ReportGenerator.generate_terminal_summary(result))


def cmd_compare(args: argparse.Namespace):
    """对比两个晾晒方案"""
    file_a = args.scenario_a
    file_b = args.scenario_b
    
    for f in [file_a, file_b]:
        if not os.path.exists(f):
            print(f"❌ 场景文件不存在: {f}")
            sys.exit(1)
    
    print("📊 正在分析方案 A...")
    result_a = process_scenario(file_a)
    
    print("\n📊 正在分析方案 B...")
    result_b = process_scenario(file_b)
    
    print("\n" + "=" * 60)
    print("📊 晾晒方案对比")
    print("=" * 60)
    
    a_avg = result_a.average_dry_time_hours
    b_avg = result_b.average_dry_time_hours
    
    print(f"\n⏱️  干燥时间对比:")
    print(f"   方案 A 平均: {a_avg:.1f} 小时")
    print(f"   方案 B 平均: {b_avg:.1f} 小时")
    
    time_diff = abs(a_avg - b_avg)
    if a_avg < b_avg:
        winner = "方案 A"
        print(f"\n🏆 结论: {winner} 更快，节省约 {time_diff:.1f} 小时")
    elif b_avg < a_avg:
        winner = "方案 B"
        print(f"\n🏆 结论: {winner} 更快，节省约 {time_diff:.1f} 小时")
    else:
        winner = "两个方案"
        print(f"\n🏆 结论: 两个方案干燥时间相近")
    
    print(f"\n⚠️  风险等级对比:")
    print(f"   方案 A 整体风险: {result_a.overall_risk_level}")
    print(f"   方案 B 整体风险: {result_b.overall_risk_level}")
    
    key_diffs = []
    if result_a.weather_summary.get("average_wind_kph", 0) != result_b.weather_summary.get("average_wind_kph", 0):
        key_diffs.append(f"风速不同: A({result_a.weather_summary.get('average_wind_kph')}km/h) vs B({result_b.weather_summary.get('average_wind_kph')}km/h)")
    
    if result_a.weather_summary.get("average_humidity_pct", 0) != result_b.weather_summary.get("average_humidity_pct", 0):
        key_diffs.append(f"湿度不同: A({result_a.weather_summary.get('average_humidity_pct')}%) vs B({result_b.weather_summary.get('average_humidity_pct')}%)")
    
    items_a = result_a.raw_data.get("clothing_results", [])
    items_b = result_b.raw_data.get("clothing_results", [])
    if items_a and items_b:
        spacing_a = items_a[0].get("hanger_spacing_cm", 0)
        spacing_b = items_b[0].get("hanger_spacing_cm", 0)
        if spacing_a != spacing_b:
            key_diffs.append(f"衣架间距不同: A({spacing_a}cm) vs B({spacing_b}cm)")
    
    if key_diffs:
        print(f"\n💡 关键差异:")
        for diff in key_diffs:
            print(f"   - {diff}")
    
    if args.output or args.md:
        comp_result = ComparisonResult(
            scenario_a_name=result_a.scenario_name,
            scenario_b_name=result_b.scenario_name,
            winner=winner,
            time_savings_hours=time_diff,
            risk_comparison={
                "a": result_a.overall_risk_level,
                "b": result_b.overall_risk_level,
            },
            key_differences=key_diffs,
            detailed_comparison={},
        )
        
        output_dir = Path(args.output) if args.output else Path(".")
        
        if args.md:
            md_path = output_dir / "comparison_report.md"
            ReportGenerator.generate_comparison_report(
                comp_result, result_a, result_b, str(md_path), "markdown"
            )
            print(f"\n📄 Markdown对比报告已导出: {md_path}")
        
        print("=" * 60)


def cmd_export(args: argparse.Namespace):
    """导出报告"""
    scenario_file = args.scenario
    
    if not os.path.exists(scenario_file):
        print(f"❌ 场景文件不存在: {scenario_file}")
        sys.exit(1)
    
    result = process_scenario(scenario_file)
    
    output_dir = Path(args.output) if args.output else Path(".")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    base_name = Path(scenario_file).stem
    
    if not any([args.md, args.html, args.json, args.all]):
        args.all = True
    
    if args.md or args.all:
        md_path = output_dir / f"{base_name}_report.md"
        ReportGenerator.generate_markdown_report(result, str(md_path))
        print(f"📄 Markdown报告已导出: {md_path}")
    
    if args.html or args.all:
        html_path = output_dir / f"{base_name}_report.html"
        ReportGenerator.generate_html_report(result, str(html_path))
        print(f"🌐 HTML报告已导出: {html_path}")
    
    if args.json or args.all:
        json_path = output_dir / f"{base_name}_report.json"
        ReportGenerator.generate_json_output(result, str(json_path))
        print(f"📋 JSON报告已导出: {json_path}")
    
    print("\n" + "=" * 60)
    print(ReportGenerator.generate_terminal_summary(result))


def main():
    """主入口"""
    parser = argparse.ArgumentParser(
        description="🌧️ 梅雨季晾衣干燥预估器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    help_parser = subparsers.add_parser("help", help="显示帮助信息")
    help_parser.set_defaults(func=cmd_help)
    
    simulate_parser = subparsers.add_parser("simulate", help="模拟晾晒场景")
    simulate_parser.add_argument("scenario", help="场景JSON文件路径")
    simulate_parser.set_defaults(func=cmd_simulate)
    
    compare_parser = subparsers.add_parser("compare", help="对比两个晾晒方案")
    compare_parser.add_argument("scenario_a", help="方案A JSON文件路径")
    compare_parser.add_argument("scenario_b", help="方案B JSON文件路径")
    compare_parser.add_argument("-o", "--output", help="输出目录")
    compare_parser.add_argument("--md", "--markdown", action="store_true", help="导出Markdown对比报告")
    compare_parser.set_defaults(func=cmd_compare)
    
    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("scenario", help="场景JSON文件路径")
    export_parser.add_argument("-o", "--output", help="输出目录")
    export_parser.add_argument("--md", "--markdown", action="store_true", help="导出Markdown报告")
    export_parser.add_argument("--html", action="store_true", help="导出HTML报告")
    export_parser.add_argument("--json", action="store_true", help="导出JSON报告")
    export_parser.add_argument("--all", action="store_true", help="导出所有格式")
    export_parser.set_defaults(func=cmd_export)
    
    report_parser = subparsers.add_parser("report", help="导出报告 (export的别名)")
    report_parser.add_argument("scenario", help="场景JSON文件路径")
    report_parser.add_argument("-o", "--output", help="输出目录")
    report_parser.add_argument("--md", "--markdown", action="store_true", help="导出Markdown报告")
    report_parser.add_argument("--html", action="store_true", help="导出HTML报告")
    report_parser.add_argument("--json", action="store_true", help="导出JSON报告")
    report_parser.add_argument("--all", action="store_true", help="导出所有格式")
    report_parser.set_defaults(func=cmd_export)
    
    args = parser.parse_args()
    
    if not args.command or args.command == "help":
        cmd_help(args)
    elif hasattr(args, "func"):
        args.func(args)
    else:
        cmd_help(args)


if __name__ == "__main__":
    main()
