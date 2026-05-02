import argparse
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from .data_parser import DataParser, ThermocoupleData, KilnPosition, GlazeRecipe
from .curve_calculator import CurveCalculator, CurveCalculationResult
from .risk_rules import RiskAnalyzer, GlazeRiskAssessment
from .simulator import CurveSimulator, SimulationResult, TargetCurveParams
from .reporter import ReportGenerator, FullAnalysisReport


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='窑温曲线复盘器 - 陶艺工作室窑炉数据复盘分析工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  # 基本分析模式
  kiln-analyzer analyze --thermocouple data/tc1.csv --positions data/positions.json --glazes data/glazes.yaml

  # 带输出的完整分析
  kiln-analyzer analyze --thermocouple data/tc1.csv --positions data/positions.json --glazes data/glazes.yaml 
                         --output reports/analysis --format markdown csv json

  # 模拟模式（调整曲线参数）
  kiln-analyzer simulate --thermocouple data/tc1.csv --positions data/positions.json --glazes data/glazes.yaml
                          --target-temp 1300 --holding-time 45 --heating-rate 120

  # 使用示例数据快速测试
  kiln-analyzer example
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    analyze_parser = subparsers.add_parser('analyze', help='分析窑温数据')
    analyze_parser.add_argument('--thermocouple', '-t', required=True, action='append',
                                help='热电偶CSV文件路径 (可多次指定)')
    analyze_parser.add_argument('--positions', '-p', required=True,
                                help='窑位摆放JSON文件路径')
    analyze_parser.add_argument('--glazes', '-g', required=True,
                                help='釉料配方YAML文件路径')
    analyze_parser.add_argument('--interpolation', '-i', default='linear',
                                choices=['linear', 'time', 'ffill', 'bfill'],
                                help='缺测点插值方法 (默认: linear)')
    analyze_parser.add_argument('--target-temp', type=float,
                                help='目标保温温度 (可选，默认从釉料配方读取)')
    analyze_parser.add_argument('--output', '-o',
                                help='输出文件路径/目录')
    analyze_parser.add_argument('--format', '-f', action='append', default=['markdown'],
                                choices=['markdown', 'csv', 'json'],
                                help='输出格式 (可多次指定，默认: markdown)')
    
    simulate_parser = subparsers.add_parser('simulate', help='模拟复盘分析')
    simulate_parser.add_argument('--thermocouple', '-t', required=True,
                                  help='热电偶CSV文件路径')
    simulate_parser.add_argument('--positions', '-p', required=True,
                                  help='窑位摆放JSON文件路径')
    simulate_parser.add_argument('--glazes', '-g', required=True,
                                  help='釉料配方YAML文件路径')
    simulate_parser.add_argument('--target-temp', type=float, default=1280,
                                  help='目标最高温度 (默认: 1280℃)')
    simulate_parser.add_argument('--heating-rate', type=float, default=150,
                                  help='升温速率 (℃/小时，默认: 150)')
    simulate_parser.add_argument('--holding-time', type=float, default=30,
                                  help='保温时间 (分钟，默认: 30)')
    simulate_parser.add_argument('--cooling-rate', type=float, default=100,
                                  help='冷却速率 (℃/小时，默认: 100)')
    simulate_parser.add_argument('--intermediate-hold', action='append', nargs=2, type=float,
                                  metavar=('TEMP', 'MINUTES'),
                                  help='中间保温点 (可多次指定，如: 500 20 表示在500℃保温20分钟)')
    simulate_parser.add_argument('--output', '-o',
                                  help='输出文件路径/目录')
    simulate_parser.add_argument('--format', '-f', action='append', default=['markdown'],
                                  choices=['markdown', 'csv', 'json'],
                                  help='输出格式')
    
    example_parser = subparsers.add_parser('example', help='使用示例数据运行演示')
    example_parser.add_argument('--output', '-o', help='输出目录')
    
    return parser.parse_args()


def run_analysis(args):
    """运行分析模式"""
    print("=" * 60)
    print("窑温曲线复盘器 - 分析模式")
    print("=" * 60)
    print()
    
    parser = DataParser()
    
    print("正在加载数据...")
    for tc_file in args.thermocouple:
        try:
            tc_data = parser.parse_thermocouple_csv(tc_file, args.interpolation)
            print(f"  ✓ 加载热电偶数据: {tc_file}")
            print(f"    - 数据点数: {len(tc_data.temperatures)}")
            print(f"    - 缺测点: {tc_data.metadata['missing_points_count']}")
        except Exception as e:
            print(f"  ✗ 加载失败 {tc_file}: {e}")
            return 1
    
    try:
        parser.parse_kiln_positions_json(args.positions)
        print(f"  ✓ 加载窑位数据: {args.positions}")
        print(f"    - 窑位数: {len(parser.kiln_positions)}")
    except Exception as e:
        print(f"  ✗ 加载窑位数据失败: {e}")
        return 1
    
    try:
        parser.parse_glaze_recipes_yaml(args.glazes)
        print(f"  ✓ 加载釉料配方: {args.glazes}")
        print(f"    - 配方数: {len(parser.glaze_recipes)}")
    except Exception as e:
        print(f"  ✗ 加载釉料配方失败: {e}")
        return 1
    
    print()
    print("正在计算曲线分析...")
    
    curve_calculator = CurveCalculator()
    risk_analyzer = RiskAnalyzer()
    report_generator = ReportGenerator()
    
    curve_analyses: Dict[str, CurveCalculationResult] = {}
    for name, tc_data in parser.thermocouples.items():
        target_temp = args.target_temp
        if target_temp is None and parser.glaze_recipes:
            first_glaze = next(iter(parser.glaze_recipes.values()))
            target_temp = first_glaze.firing_profile.get('max_temp')
        
        try:
            ca = curve_calculator.calculate_full_curve(tc_data, target_temp)
            curve_analyses[name] = ca
            print(f"  ✓ 分析曲线: {name}")
            print(f"    - 最高温度: {ca.peak_temperature:.1f}℃")
            print(f"    - 总时长: {ca.total_firing_duration_minutes:.1f}分钟")
            print(f"    - 最大升温速率: {ca.heating_rates.max_rate:.1f}℃/小时")
            print(f"    - 保温段数: {len(ca.holding_segments)}")
        except Exception as e:
            print(f"  ✗ 分析失败 {name}: {e}")
    
    print()
    print("正在评估风险...")
    
    try:
        risk_assessments = risk_analyzer.analyze_all_positions(
            parser.thermocouples,
            parser.kiln_positions,
            parser.glaze_recipes
        )
        print(f"  ✓ 完成风险评估: {len(risk_assessments)} 个评估")
        
        risk_summary = risk_analyzer.get_risk_summary(risk_assessments)
        print(f"    - 最高风险等级: {risk_summary['highest_risk_level']}")
        print(f"    - 风险分布: {risk_summary['risk_distribution']}")
    except Exception as e:
        print(f"  ✗ 风险评估失败: {e}")
        risk_assessments = []
    
    print()
    print("正在生成报告...")
    
    first_curve = next(iter(curve_analyses.values())) if curve_analyses else None
    
    report = report_generator.generate_full_report(
        thermocouples=parser.thermocouples,
        positions=parser.kiln_positions,
        glaze_recipes=parser.glaze_recipes,
        curve_analysis=first_curve,
        risk_assessments=risk_assessments
    )
    
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        exported_files = []
        
        if 'markdown' in args.format:
            md_path = str(output_path) + '.md' if output_path.suffix else str(output_path / 'analysis.md')
            md_path = report_generator.export_markdown(report, md_path)
            exported_files.append(md_path)
            print(f"  ✓ Markdown报告: {md_path}")
        
        if 'json' in args.format:
            json_path = str(output_path) + '.json' if output_path.suffix else str(output_path / 'analysis.json')
            json_path = report_generator.export_json(report, json_path)
            exported_files.append(json_path)
            print(f"  ✓ JSON报告: {json_path}")
        
        if 'csv' in args.format:
            csv_prefix = str(output_path) if output_path.suffix else str(output_path / 'analysis')
            csv_files = report_generator.export_csv(report, csv_prefix)
            exported_files.extend(csv_files)
            for f in csv_files:
                print(f"  ✓ CSV报告: {f}")
        
        print()
        print(f"报告已导出到: {args.output}")
    else:
        print()
        print("=" * 60)
        print("分析结果摘要")
        print("=" * 60)
        print()
        print("数据统计:")
        print(f"  - 热电偶: {len(parser.thermocouples)} 个")
        print(f"  - 窑位: {len(parser.kiln_positions)} 个")
        print(f"  - 釉料: {len(parser.glaze_recipes)} 种")
        print()
        
        if first_curve:
            print("曲线分析:")
            print(f"  - 最高温度: {first_curve.peak_temperature:.1f}℃")
            print(f"  - 总时长: {first_curve.total_firing_duration_minutes:.1f} 分钟")
            print(f"  - 最大升温速率: {first_curve.heating_rates.max_rate:.1f} ℃/小时")
            print()
        
        if risk_summary:
            print("风险评估:")
            print(f"  - 最高风险等级: {risk_summary['highest_risk_level']}")
            for level, count in risk_summary['risk_distribution'].items():
                if count > 0:
                    print(f"  - {level}: {count}")
            print()
        
        print("使用 --output 参数导出完整报告")
        print("=" * 60)
    
    return 0


def run_simulation(args):
    """运行模拟模式"""
    print("=" * 60)
    print("窑温曲线复盘器 - 模拟复盘模式")
    print("=" * 60)
    print()
    
    parser = DataParser()
    
    print("正在加载数据...")
    
    try:
        tc_data = parser.parse_thermocouple_csv(args.thermocouple, 'linear')
        print(f"  ✓ 加载热电偶数据: {args.thermocouple}")
        print(f"    - 数据点数: {len(tc_data.temperatures)}")
    except Exception as e:
        print(f"  ✗ 加载失败: {e}")
        return 1
    
    try:
        parser.parse_kiln_positions_json(args.positions)
        print(f"  ✓ 加载窑位数据: {args.positions}")
    except Exception as e:
        print(f"  ✗ 加载窑位数据失败: {e}")
        return 1
    
    try:
        parser.parse_glaze_recipes_yaml(args.glazes)
        print(f"  ✓ 加载釉料配方: {args.glazes}")
    except Exception as e:
        print(f"  ✗ 加载釉料配方失败: {e}")
        return 1
    
    print()
    print("模拟参数:")
    print(f"  - 目标温度: {args.target_temp}℃")
    print(f"  - 升温速率: {args.heating_rate}℃/小时")
    print(f"  - 保温时间: {args.holding_time}分钟")
    print(f"  - 冷却速率: {args.cooling_rate}℃/小时")
    
    intermediate_holds = []
    if args.intermediate_hold:
        for temp, minutes in args.intermediate_hold:
            intermediate_holds.append({'temperature': temp, 'duration_min': minutes})
            print(f"  - 中间保温: {temp}℃ 保温 {minutes}分钟")
    
    print()
    print("正在生成模拟曲线...")
    
    simulator = CurveSimulator()
    risk_analyzer = RiskAnalyzer()
    report_generator = ReportGenerator()
    
    target_params = TargetCurveParams(
        target_temp=args.target_temp,
        heating_rate=args.heating_rate,
        holding_time_min=args.holding_time,
        cooling_rate=args.cooling_rate,
        intermediate_holds=intermediate_holds
    )
    
    try:
        simulation_result = simulator.simulate_with_params(
            actual_data=tc_data,
            params=target_params,
            glaze_recipes=parser.glaze_recipes,
            positions=parser.kiln_positions
        )
        print(f"  ✓ 模拟完成: {simulation_result.simulation_id}")
        
        comp = simulation_result.comparison
        print(f"    - 实际最高温度: {comp['actual_stats']['max_temp']:.1f}℃")
        print(f"    - 模拟最高温度: {comp['simulated_stats']['max_temp']:.1f}℃")
        print(f"    - 温度差异: {comp['differences']['max_temp_diff']:+.1f}℃")
        print(f"    - 时长差异: {comp['differences']['duration_diff']:+.1f}分钟")
    except Exception as e:
        print(f"  ✗ 模拟失败: {e}")
        return 1
    
    print()
    print("正在评估实际曲线风险...")
    
    try:
        actual_risks = risk_analyzer.analyze_all_positions(
            parser.thermocouples,
            parser.kiln_positions,
            parser.glaze_recipes
        )
        print(f"  ✓ 实际风险评估: {len(actual_risks)} 个")
        
        actual_risk_summary = risk_analyzer.get_risk_summary(actual_risks)
        print(f"    - 实际最高风险: {actual_risk_summary['highest_risk_level']}")
    except Exception as e:
        print(f"  ✗ 风险评估失败: {e}")
        actual_risks = []
        actual_risk_summary = {}
    
    print()
    print("正在生成改进建议...")
    
    try:
        suggestions = simulator.suggest_improvements(actual_risks, tc_data)
        print(f"  ✓ 生成 {len(suggestions)} 条改进建议")
        for i, suggestion in enumerate(suggestions, 1):
            print(f"    {i}. {suggestion['description']}")
    except Exception as e:
        print(f"  ✗ 生成建议失败: {e}")
        suggestions = []
    
    print()
    print("正在生成报告...")
    
    curve_calculator = CurveCalculator()
    actual_curve_analysis = curve_calculator.calculate_full_curve(tc_data, args.target_temp)
    
    report = report_generator.generate_full_report(
        thermocouples=parser.thermocouples,
        positions=parser.kiln_positions,
        glaze_recipes=parser.glaze_recipes,
        curve_analysis=actual_curve_analysis,
        risk_assessments=actual_risks,
        simulation_results=[simulation_result],
        suggestions=suggestions
    )
    
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if 'markdown' in args.format:
            md_path = str(output_path) + '.md' if output_path.suffix else str(output_path / 'simulation.md')
            md_path = report_generator.export_markdown(report, md_path)
            print(f"  ✓ Markdown报告: {md_path}")
        
        if 'json' in args.format:
            json_path = str(output_path) + '.json' if output_path.suffix else str(output_path / 'simulation.json')
            json_path = report_generator.export_json(report, json_path)
            print(f"  ✓ JSON报告: {json_path}")
        
        if 'csv' in args.format:
            csv_prefix = str(output_path) if output_path.suffix else str(output_path / 'simulation')
            csv_files = report_generator.export_csv(report, csv_prefix)
            for f in csv_files:
                print(f"  ✓ CSV报告: {f}")
        
        print()
        print(f"报告已导出到: {args.output}")
    else:
        print()
        print("=" * 60)
        print("模拟结果摘要")
        print("=" * 60)
        print()
        print("参数调整对比:")
        comp = simulation_result.comparison
        print(f"  - 最高温度: {comp['actual_stats']['max_temp']:.1f}℃ → {comp['simulated_stats']['max_temp']:.1f}℃")
        print(f"  - 总时长: {comp['actual_stats']['duration_min']:.1f}分钟 → {comp['simulated_stats']['duration_min']:.1f}分钟")
        print()
        
        if actual_risk_summary:
            print("改进建议:")
            for i, suggestion in enumerate(suggestions, 1):
                print(f"  {i}. {suggestion['description']}")
                print(f"     预期效果: {suggestion['expected_benefit']}")
            print()
        
        print("使用 --output 参数导出完整报告")
        print("=" * 60)
    
    return 0


def run_example(args):
    """运行示例模式"""
    print("=" * 60)
    print("窑温曲线复盘器 - 示例演示模式")
    print("=" * 60)
    print()
    print("正在生成示例数据...")
    
    example_dir = Path(__file__).parent.parent / "examples"
    example_dir.mkdir(exist_ok=True)
    
    create_example_data(example_dir)
    
    print(f"  ✓ 示例数据已生成到: {example_dir}")
    print()
    
    parser = DataParser()
    
    tc_file = example_dir / "thermocouple.csv"
    pos_file = example_dir / "kiln_positions.json"
    glaze_file = example_dir / "glaze_recipes.yaml"
    
    try:
        tc_data = parser.parse_thermocouple_csv(str(tc_file), 'linear')
        parser.parse_kiln_positions_json(str(pos_file))
        parser.parse_glaze_recipes_yaml(str(glaze_file))
    except Exception as e:
        print(f"  ✗ 加载示例数据失败: {e}")
        return 1
    
    print("正在运行分析...")
    
    curve_calculator = CurveCalculator()
    risk_analyzer = RiskAnalyzer()
    report_generator = ReportGenerator()
    
    target_temp = 1280.0
    curve_analysis = curve_calculator.calculate_full_curve(tc_data, target_temp)
    
    risk_assessments = risk_analyzer.analyze_all_positions(
        parser.thermocouples,
        parser.kiln_positions,
        parser.glaze_recipes
    )
    
    print()
    print("=" * 60)
    print("示例分析结果")
    print("=" * 60)
    print()
    print("数据统计:")
    print(f"  - 热电偶: {len(parser.thermocouples)} 个")
    print(f"  - 窑位: {len(parser.kiln_positions)} 个")
    print(f"  - 釉料: {len(parser.glaze_recipes)} 种")
    print()
    
    print("曲线分析:")
    print(f"  - 最高温度: {curve_analysis.peak_temperature:.1f}℃")
    print(f"  - 总时长: {curve_analysis.total_firing_duration_minutes:.1f} 分钟")
    print(f"  - 最大升温速率: {curve_analysis.heating_rates.max_rate:.1f} ℃/小时")
    print()
    
    risk_summary = risk_analyzer.get_risk_summary(risk_assessments)
    print("风险评估:")
    print(f"  - 最高风险等级: {risk_summary['highest_risk_level']}")
    for level, count in risk_summary['risk_distribution'].items():
        if count > 0:
            print(f"  - {level}: {count}")
    print()
    
    output_dir = args.output or (example_dir / "output")
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    report = report_generator.generate_full_report(
        thermocouples=parser.thermocouples,
        positions=parser.kiln_positions,
        glaze_recipes=parser.glaze_recipes,
        curve_analysis=curve_analysis,
        risk_assessments=risk_assessments
    )
    
    md_path = output_path / "example_analysis.md"
    json_path = output_path / "example_analysis.json"
    csv_prefix = output_path / "example"
    
    report_generator.export_markdown(report, str(md_path))
    report_generator.export_json(report, str(json_path))
    report_generator.export_csv(report, str(csv_prefix))
    
    print("报告已导出:")
    print(f"  - Markdown: {md_path}")
    print(f"  - JSON: {json_path}")
    print(f"  - CSV: {output_path}/")
    print()
    print("=" * 60)
    
    return 0


def create_example_data(output_dir: Path):
    """创建示例数据文件"""
    import csv
    import json
    import yaml
    
    times = []
    temps = []
    
    start_time = pd.Timestamp('2024-01-01 08:00:00')
    
    for minute in range(480):
        current_time = start_time + pd.Timedelta(minutes=minute)
        times.append(current_time.strftime('%Y-%m-%d %H:%M:%S'))
        
        if minute < 300:
            temp = 20 + (minute / 300) * 1260
            if 120 <= minute < 140:
                temp = 500 + (minute - 120) * 0.5
            elif 240 <= minute < 270:
                temp = 1000 + (minute - 240) * 2
        elif minute < 330:
            temp = 1280 + (minute - 300) * 0.1
        else:
            temp = 1280 - (minute - 330) * 3
        
        if minute in [50, 150, 250]:
            temps.append('')
        else:
            temps.append(f"{temp:.1f}")
    
    tc_csv = output_dir / "thermocouple.csv"
    with open(tc_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['time', 'temperature'])
        for t, temp in zip(times, temps):
            writer.writerow([t, temp])
    
    positions = {
        "positions": [
            {
                "id": "pos_1",
                "name": "上层左前",
                "position_x": 0.2,
                "position_y": 0.8,
                "position_z": 0.5,
                "thermocouple_id": "thermocouple",
                "items": [
                    {"glaze_id": "glaze_001", "count": 3}
                ]
            },
            {
                "id": "pos_2",
                "name": "中层中心",
                "position_x": 0.5,
                "position_y": 0.5,
                "position_z": 0.5,
                "thermocouple_id": "thermocouple",
                "items": [
                    {"glaze_id": "glaze_002", "count": 2},
                    {"glaze_id": "glaze_003", "count": 1}
                ]
            },
            {
                "id": "pos_3",
                "name": "下层右后",
                "position_x": 0.8,
                "position_y": 0.2,
                "position_z": 0.5,
                "thermocouple_id": "thermocouple",
                "items": [
                    {"glaze_id": "glaze_001", "count": 2}
                ]
            }
        ]
    }
    
    pos_json = output_dir / "kiln_positions.json"
    with open(pos_json, 'w', encoding='utf-8') as f:
        json.dump(positions, f, ensure_ascii=False, indent=2)
    
    recipes = {
        "recipes": [
            {
                "id": "glaze_001",
                "name": "青瓷釉",
                "components": {
                    "长石": 40.0,
                    "石英": 30.0,
                    "高岭土": 20.0,
                    "石灰石": 10.0
                },
                "firing_profile": {
                    "max_temp": 1280,
                    "holding_time_min": 30
                },
                "risk_rules": {
                    "max_heating_rate": 150.0,
                    "max_cooling_rate": -100.0,
                    "critical_cooling_range": [573, 300]
                }
            },
            {
                "id": "glaze_002",
                "name": "钧瓷釉",
                "components": {
                    "长石": 35.0,
                    "石英": 25.0,
                    "方解石": 20.0,
                    "滑石": 10.0,
                    "氧化铁": 5.0,
                    "氧化铜": 5.0
                },
                "firing_profile": {
                    "max_temp": 1300,
                    "holding_time_min": 45
                },
                "risk_rules": {
                    "max_heating_rate": 120.0,
                    "max_cooling_rate": -80.0,
                    "critical_cooling_range": [600, 350]
                }
            },
            {
                "id": "glaze_003",
                "name": "透明釉",
                "components": {
                    "长石": 50.0,
                    "石英": 25.0,
                    "高岭土": 15.0,
                    "石灰石": 10.0
                },
                "firing_profile": {
                    "max_temp": 1260,
                    "holding_time_min": 25
                },
                "risk_rules": {
                    "max_heating_rate": 180.0,
                    "max_cooling_rate": -120.0,
                    "critical_cooling_range": [550, 280]
                }
            }
        ]
    }
    
    glaze_yaml = output_dir / "glaze_recipes.yaml"
    with open(glaze_yaml, 'w', encoding='utf-8') as f:
        yaml.dump(recipes, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def main():
    """主入口函数"""
    args = parse_args()
    
    if args.command == 'analyze':
        sys.exit(run_analysis(args))
    elif args.command == 'simulate':
        sys.exit(run_simulation(args))
    elif args.command == 'example':
        sys.exit(run_example(args))
    else:
        print("请指定命令: analyze, simulate, 或 example")
        print("使用 --help 查看详细帮助")
        sys.exit(1)


if __name__ == '__main__':
    main()
