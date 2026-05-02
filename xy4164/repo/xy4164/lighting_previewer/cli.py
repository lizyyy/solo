"""补光配方预演器 - 主程序入口"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import *
from .validators import CSVParser, DataValidator
from .calculators import CalculationEngine
from .optimizer import LightPlanOptimizer, OptimizationResult
from .session import SessionData, SessionManager
from .exporters import MarkdownExporter, CSVExporter, JSONExporter


def parse_args():
    parser = argparse.ArgumentParser(
        prog="lighting-previewer",
        description="补光配方预演器 - 植物工厂光照优化与成本计算工具",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_parser = subparsers.add_parser("run", help="运行完整计算流程")
    run_parser.add_argument("--zones", required=True, help="作物分区CSV文件路径")
    run_parser.add_argument("--spectra", required=True, help="LED灯谱CSV文件路径")
    run_parser.add_argument("--sensor", required=True, help="传感器数据CSV文件路径")
    run_parser.add_argument("--price", required=True, help="电价CSV文件路径")
    run_parser.add_argument("--budget", type=float, default=None, help="预算限制（元）")
    run_parser.add_argument("--date", default="", help="基准日期")
    run_parser.add_argument("--output", "-o", default="./output", help="输出目录")
    run_parser.add_argument("--session-name", default="", help="会话名称")
    run_parser.add_argument("--no-save", action="store_true", help="不保存会话")
    
    validate_parser = subparsers.add_parser("validate", help="仅校验数据")
    validate_parser.add_argument("--zones", required=True, help="作物分区CSV文件路径")
    validate_parser.add_argument("--spectra", required=True, help="LED灯谱CSV文件路径")
    validate_parser.add_argument("--sensor", required=True, help="传感器数据CSV文件路径")
    validate_parser.add_argument("--price", required=True, help="电价CSV文件路径")
    validate_parser.add_argument("--budget", type=float, default=None, help="预算限制（元）")
    
    session_parser = subparsers.add_parser("session", help="会话管理")
    session_subparsers = session_parser.add_subparsers(dest="session_command", help="会话操作")
    
    session_list = session_subparsers.add_parser("list", help="列出所有会话")
    session_list.add_argument("--sessions-dir", default=None, help="会话目录")
    
    session_load = session_subparsers.add_parser("load", help="加载会话")
    session_load.add_argument("filepath", help="会话文件路径")
    session_load.add_argument("--output", "-o", default="./output", help="输出目录")
    
    session_save = session_subparsers.add_parser("save", help="保存会话（从CSV）")
    session_save.add_argument("--zones", required=True, help="作物分区CSV文件路径")
    session_save.add_argument("--spectra", required=True, help="LED灯谱CSV文件路径")
    session_save.add_argument("--sensor", required=True, help="传感器数据CSV文件路径")
    session_save.add_argument("--price", required=True, help="电价CSV文件路径")
    session_save.add_argument("--session-name", default="", help="会话名称")
    session_save.add_argument("--sessions-dir", default=None, help="会话目录")
    
    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("session_file", help="会话文件路径")
    export_parser.add_argument("--format", "-f", choices=["markdown", "csv", "json", "all"], default="all", help="导出格式")
    export_parser.add_argument("--output", "-o", default="./output", help="输出目录")
    
    example_parser = subparsers.add_parser("example", help="使用示例数据运行")
    example_parser.add_argument("--budget", type=float, default=100.0, help="预算限制（元）")
    example_parser.add_argument("--output", "-o", default="./output", help="输出目录")
    example_parser.add_argument("--session-name", default="示例会话", help="会话名称")
    
    parser.add_argument("--version", "-v", action="version", version="补光配方预演器 v1.0.0")
    
    return parser.parse_args()


def run_full_flow(
    zones_path: str,
    spectra_path: str,
    sensor_path: str,
    price_path: str,
    budget_limit: Optional[float] = None,
    base_date: str = "",
    output_dir: str = "./output",
    session_name: str = "",
    save_session: bool = True
) -> int:
    
    print("=" * 60)
    print("补光配方预演器 - 完整计算流程")
    print("=" * 60)
    print()
    
    print("[1/6] 解析输入数据...")
    parser = CSVParser()
    
    zones = parser.parse_crop_zones(zones_path)
    if parser.get_last_errors():
        print(f"  ❌ 解析作物分区失败:")
        for error in parser.get_last_errors():
            print(f"     - {error}")
        return 1
    print(f"  ✅ 解析到 {len(zones)} 个作物分区")
    
    spectra = parser.parse_led_spectra(spectra_path)
    if parser.get_last_errors():
        print(f"  ⚠️  解析灯谱数据时出现警告:")
        for warn in parser.get_last_warnings():
            print(f"     - {warn}")
    print(f"  ✅ 解析到 {len(spectra)} 个灯谱配置")
    
    sensors = parser.parse_sensor_data(sensor_path)
    if parser.get_last_errors():
        print(f"  ⚠️  解析传感器数据时出现警告:")
        for warn in parser.get_last_warnings():
            print(f"     - {warn}")
    print(f"  ✅ 解析到 {len(sensors)} 个传感器的历史数据")
    
    prices = parser.parse_electricity_price(price_path)
    if parser.get_last_errors():
        print(f"  ❌ 解析电价数据失败:")
        for error in parser.get_last_errors():
            print(f"     - {error}")
        return 1
    if not prices:
        print("  ❌ 未解析到任何电价数据")
        return 1
    electricity_price = prices[0]
    print(f"  ✅ 解析到电价方案: {electricity_price.price_name}")
    
    print()
    print("[2/6] 数据校验...")
    validator = DataValidator()
    
    validation_result = validator.validate_all(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        prices=prices,
        budget_limit=budget_limit,
        base_date=base_date
    )
    
    print(f"  校验状态: {'✅ 通过' if validation_result.is_valid else '❌ 失败'}")
    
    if validation_result.has_critical:
        print(f"  ❌ 发现 {len(validation_result.critical_issues)} 个严重问题:")
        for issue in validation_result.critical_issues[:5]:
            print(f"     - [{issue.category.value}] {issue.message}")
        if len(validation_result.critical_issues) > 5:
            print(f"     ... 还有 {len(validation_result.critical_issues) - 5} 个问题")
    
    if validation_result.has_warnings:
        print(f"  ⚠️  发现 {len(validation_result.warning_issues)} 个警告:")
        for issue in validation_result.warning_issues[:5]:
            print(f"     - [{issue.category.value}] {issue.message}")
        if len(validation_result.warning_issues) > 5:
            print(f"     ... 还有 {len(validation_result.warning_issues) - 5} 个警告")
    
    print()
    print("[3/6] 生成优化补光方案...")
    optimizer = LightPlanOptimizer()
    
    opt_result = optimizer.optimize(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        electricity_price=electricity_price,
        budget_limit=budget_limit,
        base_date=base_date
    )
    
    light_plan = opt_result.light_plan
    print(f"  ✅ 生成补光方案: {light_plan.plan_name}")
    print(f"     - 补光时段数: {len(light_plan.intervals)}")
    print(f"     - 预计能耗: {light_plan.total_estimated_energy:.2f} kWh")
    print(f"     - 预计成本: {light_plan.total_estimated_cost:.2f} 元")
    
    if budget_limit:
        budget_util = (light_plan.total_estimated_cost / budget_limit) * 100
        print(f"     - 预算使用率: {budget_util:.1f}% (预算: {budget_limit:.2f} 元)")
    
    print()
    print("[4/6] 执行光照计算...")
    calc_engine = CalculationEngine()
    
    calc_result = calc_engine.calculate_all(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        electricity_price=electricity_price,
        light_plan=light_plan,
        budget_limit=budget_limit,
        base_date=base_date
    )
    
    print(f"  ✅ 计算完成")
    print(f"     - 总日光积分 (DLI): {calc_result.total_dli:.1f} mol/m²/day")
    print(f"       - 自然光照: {calc_result.total_natural_dli:.1f}")
    print(f"       - 人工补光: {calc_result.total_supplemental_dli:.1f}")
    print(f"     - 整体风险等级: {calc_result.overall_risk_level}")
    
    if calc_result.deficient_zones:
        print(f"     ⚠️  DLI不足分区: {len(calc_result.deficient_zones)} 个")
    if calc_result.excessive_zones:
        print(f"     ⚠️  DLI过量分区: {len(calc_result.excessive_zones)} 个")
    
    print()
    print("[5/6] 分区详细结果:")
    print("-" * 60)
    
    for zone_result in calc_result.zone_results:
        status_icon = "✅" if zone_result.risk_level == "low" else (
            "🟡" if zone_result.risk_level == "medium" else "🔴"
        )
        print(f"  {status_icon} 分区 {zone_result.zone_id}: {zone_result.zone_name}")
        print(f"     作物类型: {zone_result.crop_type}")
        print(f"     DLI: {zone_result.total_dli:.1f} (目标: {zone_result.target_dli:.1f}) "
              f"[{zone_result.dli_status}]")
        print(f"     蓝红比 (B:R): {zone_result.blue_red_ratio:.2f}")
        print(f"     预计成本: {zone_result.estimated_cost:.2f} 元")
        
        if zone_result.warnings:
            for warn in zone_result.warnings:
                print(f"     ⚠️  {warn}")
        print()
    
    print("-" * 60)
    print()
    print("[6/6] 导出结果...")
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"lighting_plan_{timestamp}"
    
    markdown_exporter = MarkdownExporter()
    markdown_path = output_path / f"{base_name}.md"
    markdown_exporter.export_full_plan(
        light_plan=light_plan,
        calculation_result=calc_result,
        validation_result=validation_result,
        zones=zones,
        spectra=spectra,
        output_path=str(markdown_path)
    )
    print(f"  ✅ Markdown方案: {markdown_path}")
    
    csv_exporter = CSVExporter()
    
    risk_path = output_path / f"{base_name}_risks.csv"
    csv_exporter.export_risk_list(
        validation_result=validation_result,
        calculation_result=calc_result,
        output_path=str(risk_path)
    )
    print(f"  ✅ 风险清单CSV: {risk_path}")
    
    zone_path = output_path / f"{base_name}_zones.csv"
    csv_exporter.export_zone_summary(
        calculation_result=calc_result,
        output_path=str(zone_path)
    )
    print(f"  ✅ 分区汇总CSV: {zone_path}")
    
    plan_path = output_path / f"{base_name}_plan.csv"
    csv_exporter.export_light_plan(
        light_plan=light_plan,
        zones=zones,
        output_path=str(plan_path)
    )
    print(f"  ✅ 补光方案CSV: {plan_path}")
    
    json_exporter = JSONExporter()
    json_path = output_path / f"{base_name}_package.json"
    json_exporter.export_calculation_package(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        electricity_price=electricity_price,
        light_plan=light_plan,
        calculation_result=calc_result,
        validation_result=validation_result,
        output_path=str(json_path)
    )
    print(f"  ✅ 计算包JSON: {json_path}")
    
    if save_session:
        print()
        print("[*] 保存会话...")
        
        session = SessionData()
        session.session_name = session_name or f"补光方案_{timestamp}"
        session.base_date = base_date
        session.budget_limit = budget_limit
        
        session.zones = zones
        session.spectra = spectra
        session.sensors = sensors
        session.electricity_prices = prices
        
        session.light_plan = light_plan
        session.calculation_result = calc_result
        session.validation_result = validation_result
        
        session_manager = SessionManager()
        session_file = session_manager.save_session(session)
        
        print(f"  ✅ 会话已保存: {session_file}")
    
    print()
    print("=" * 60)
    print("计算完成！")
    print("=" * 60)
    
    return 0


def run_validate(
    zones_path: str,
    spectra_path: str,
    sensor_path: str,
    price_path: str,
    budget_limit: Optional[float] = None
) -> int:
    
    print("=" * 60)
    print("补光配方预演器 - 数据校验")
    print("=" * 60)
    print()
    
    parser = CSVParser()
    
    print("[1/2] 解析输入数据...")
    zones = parser.parse_crop_zones(zones_path)
    if parser.get_last_errors():
        print(f"  ❌ 解析作物分区失败:")
        for error in parser.get_last_errors():
            print(f"     - {error}")
        return 1
    
    spectra = parser.parse_led_spectra(spectra_path)
    sensors = parser.parse_sensor_data(sensor_path)
    prices = parser.parse_electricity_price(price_path)
    
    print(f"  ✅ 解析到 {len(zones)} 个分区, {len(spectra)} 个灯谱, {len(sensors)} 个传感器")
    
    print()
    print("[2/2] 执行数据校验...")
    
    validator = DataValidator()
    validation_result = validator.validate_all(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        prices=prices,
        budget_limit=budget_limit
    )
    
    print()
    print("校验结果汇总:")
    print("-" * 60)
    
    summary = validation_result.issue_summary
    print(f"  总问题数: {summary['total']}")
    print(f"  - 严重问题: {summary['critical']}")
    print(f"  - 警告: {summary['warning']}")
    print(f"  - 信息: {summary['info']}")
    print()
    print(f"  校验状态: {'✅ 通过' if validation_result.is_valid else '❌ 失败'}")
    
    if validation_result.issues:
        print()
        print("问题详情:")
        for issue in validation_result.issues:
            icon = "🔴" if issue.is_critical else ("🟡" if issue.is_warning else "ℹ️")
            print(f"  {icon} [{issue.category.value}] {issue.message}")
            if issue.suggested_action:
                print(f"     建议: {issue.suggested_action}")
    
    print()
    print("-" * 60)
    
    return 0 if validation_result.is_valid else 1


def run_session_list(sessions_dir: Optional[str] = None) -> int:
    
    print("=" * 60)
    print("补光配方预演器 - 会话列表")
    print("=" * 60)
    print()
    
    manager = SessionManager(sessions_dir)
    sessions = manager.list_sessions()
    
    if not sessions:
        print("未找到任何会话。")
        return 0
    
    print(f"找到 {len(sessions)} 个会话:")
    print("-" * 60)
    
    for i, sess in enumerate(sessions, 1):
        print(f"[{i}] {sess['session_name'] or '未命名会话'}")
        print(f"    ID: {sess['session_id']}")
        print(f"    分区数: {sess['zone_count']}")
        print(f"    最后修改: {sess['last_modified_at']}")
        print(f"    状态: {'有方案' if sess['has_plan'] else '无方案'}, {'有结果' if sess['has_result'] else '无结果'}")
        print(f"    文件: {sess['filepath']}")
        print()
    
    return 0


def run_session_load(filepath: str, output_dir: str = "./output") -> int:
    
    print("=" * 60)
    print("补光配方预演器 - 加载会话")
    print("=" * 60)
    print()
    
    manager = SessionManager()
    
    try:
        session = manager.load_session(filepath)
    except FileNotFoundError:
        print(f"❌ 会话文件不存在: {filepath}")
        return 1
    except Exception as e:
        print(f"❌ 加载会话失败: {e}")
        return 1
    
    print(f"✅ 成功加载会话: {session.session_name or '未命名'}")
    print(f"   创建时间: {session.created_at}")
    print(f"   分区数: {len(session.zones)}")
    print(f"   灯谱数: {len(session.spectra)}")
    print()
    
    if session.calculation_result:
        print("计算结果摘要:")
        print(f"   总DLI: {session.calculation_result.total_dli:.1f} mol/m²/day")
        print(f"   预计成本: {session.calculation_result.total_estimated_cost:.2f} 元")
        print(f"   风险等级: {session.calculation_result.overall_risk_level}")
    print()
    
    if session.light_plan and session.calculation_result:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"loaded_session_{timestamp}"
        
        print("导出会话数据...")
        
        markdown_exporter = MarkdownExporter()
        markdown_path = output_path / f"{base_name}.md"
        markdown_exporter.export_full_plan(
            light_plan=session.light_plan,
            calculation_result=session.calculation_result,
            validation_result=session.validation_result,
            zones=session.zones,
            spectra=session.spectra,
            output_path=str(markdown_path)
        )
        print(f"  ✅ Markdown: {markdown_path}")
        
        csv_exporter = CSVExporter()
        risk_path = output_path / f"{base_name}_risks.csv"
        if session.validation_result and session.calculation_result:
            csv_exporter.export_risk_list(
                validation_result=session.validation_result,
                calculation_result=session.calculation_result,
                output_path=str(risk_path)
            )
            print(f"  ✅ 风险清单: {risk_path}")
        
        json_exporter = JSONExporter()
        json_path = output_path / f"{base_name}_package.json"
        json_exporter.export_calculation_package(
            zones=session.zones,
            spectra=session.spectra,
            sensors=session.sensors,
            electricity_price=session.electricity_prices[0] if session.electricity_prices else None,
            light_plan=session.light_plan,
            calculation_result=session.calculation_result,
            validation_result=session.validation_result,
            output_path=str(json_path)
        )
        print(f"  ✅ 计算包: {json_path}")
    
    print()
    print("完成。")
    return 0


def run_export(session_file: str, export_format: str, output_dir: str) -> int:
    
    print("=" * 60)
    print("补光配方预演器 - 导出数据")
    print("=" * 60)
    print()
    
    manager = SessionManager()
    
    try:
        session = manager.load_session(session_file)
    except FileNotFoundError:
        print(f"❌ 会话文件不存在: {session_file}")
        return 1
    except Exception as e:
        print(f"❌ 加载会话失败: {e}")
        return 1
    
    if not session.light_plan or not session.calculation_result:
        print("❌ 会话中没有完整的计算结果，无法导出")
        return 1
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"export_{timestamp}"
    
    export_all = export_format == "all"
    
    if export_all or export_format == "markdown":
        markdown_exporter = MarkdownExporter()
        markdown_path = output_path / f"{base_name}.md"
        markdown_exporter.export_full_plan(
            light_plan=session.light_plan,
            calculation_result=session.calculation_result,
            validation_result=session.validation_result,
            zones=session.zones,
            spectra=session.spectra,
            output_path=str(markdown_path)
        )
        print(f"✅ 导出Markdown方案: {markdown_path}")
    
    if export_all or export_format == "csv":
        csv_exporter = CSVExporter()
        
        if session.validation_result:
            risk_path = output_path / f"{base_name}_risks.csv"
            csv_exporter.export_risk_list(
                validation_result=session.validation_result,
                calculation_result=session.calculation_result,
                output_path=str(risk_path)
            )
            print(f"✅ 导出风险清单: {risk_path}")
        
        zone_path = output_path / f"{base_name}_zones.csv"
        csv_exporter.export_zone_summary(
            calculation_result=session.calculation_result,
            output_path=str(zone_path)
        )
        print(f"✅ 导出分区汇总: {zone_path}")
        
        plan_path = output_path / f"{base_name}_plan.csv"
        csv_exporter.export_light_plan(
            light_plan=session.light_plan,
            zones=session.zones,
            output_path=str(plan_path)
        )
        print(f"✅ 导出补光方案: {plan_path}")
    
    if export_all or export_format == "json":
        json_exporter = JSONExporter()
        json_path = output_path / f"{base_name}_package.json"
        json_exporter.export_calculation_package(
            zones=session.zones,
            spectra=session.spectra,
            sensors=session.sensors,
            electricity_price=session.electricity_prices[0] if session.electricity_prices else None,
            light_plan=session.light_plan,
            calculation_result=session.calculation_result,
            validation_result=session.validation_result,
            output_path=str(json_path)
        )
        print(f"✅ 导出计算包: {json_path}")
    
    print()
    print("导出完成。")
    return 0


def run_example(budget_limit: float, output_dir: str, session_name: str) -> int:
    
    print("=" * 60)
    print("补光配方预演器 - 示例数据运行")
    print("=" * 60)
    print()
    
    examples_dir = Path(__file__).parent.parent.parent / "examples"
    
    zones_path = examples_dir / "crop_zones.csv"
    spectra_path = examples_dir / "led_spectra.csv"
    sensor_path = examples_dir / "sensor_data.csv"
    price_path = examples_dir / "electricity_price.csv"
    
    for path in [zones_path, spectra_path, sensor_path, price_path]:
        if not path.exists():
            print(f"❌ 示例数据文件不存在: {path}")
            return 1
    
    print(f"使用示例数据:")
    print(f"  - 分区: {zones_path}")
    print(f"  - 灯谱: {spectra_path}")
    print(f"  - 传感器: {sensor_path}")
    print(f"  - 电价: {price_path}")
    print(f"  - 预算限制: {budget_limit} 元")
    print()
    
    return run_full_flow(
        zones_path=str(zones_path),
        spectra_path=str(spectra_path),
        sensor_path=str(sensor_path),
        price_path=str(price_path),
        budget_limit=budget_limit,
        base_date=datetime.now().strftime("%Y-%m-%d"),
        output_dir=output_dir,
        session_name=session_name,
        save_session=True
    )


def main():
    args = parse_args()
    
    if args.command == "run":
        sys.exit(run_full_flow(
            zones_path=args.zones,
            spectra_path=args.spectra,
            sensor_path=args.sensor,
            price_path=args.price,
            budget_limit=args.budget,
            base_date=args.date,
            output_dir=args.output,
            session_name=args.session_name,
            save_session=not args.no_save
        ))
    
    elif args.command == "validate":
        sys.exit(run_validate(
            zones_path=args.zones,
            spectra_path=args.spectra,
            sensor_path=args.sensor,
            price_path=args.price,
            budget_limit=args.budget
        ))
    
    elif args.command == "session":
        if args.session_command == "list":
            sys.exit(run_session_list(sessions_dir=args.sessions_dir))
        elif args.session_command == "load":
            sys.exit(run_session_load(filepath=args.filepath, output_dir=args.output))
        elif args.session_command == "save":
            try:
                manager = SessionManager(sessions_dir=args.sessions_dir)
                session = manager.create_session_from_files(
                    zones_csv=args.zones,
                    spectra_csv=args.spectra,
                    sensor_csv=args.sensor,
                    price_csv=args.price,
                    session_name=args.session_name
                )
                filepath = manager.save_session(session)
                print(f"✅ 会话已保存: {filepath}")
                sys.exit(0)
            except Exception as e:
                print(f"❌ 保存会话失败: {e}")
                sys.exit(1)
        else:
            print("请指定会话操作: list, load, save")
            sys.exit(1)
    
    elif args.command == "export":
        sys.exit(run_export(
            session_file=args.session_file,
            export_format=args.format,
            output_dir=args.output
        ))
    
    elif args.command == "example":
        sys.exit(run_example(
            budget_limit=args.budget,
            output_dir=args.output,
            session_name=args.session_name
        ))
    
    else:
        print("使用 --help 查看可用命令")
        sys.exit(0)


if __name__ == "__main__":
    main()
