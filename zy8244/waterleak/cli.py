"""
供水调度漏损复盘CLI
用于夜间复盘小区管网漏损情况
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from .parsers import PipesParser, MetersParser, PressureParser, RepairOrdersParser
from .topology import NetworkGraph, GraphValidator
from .analysis import ZoneBalanceCalculator, PressureDropAnalyzer, LeakLocator
from .output import ReportGenerator, PlanGenerator


class WaterLeakCLI:
    """漏损复盘CLI主程序"""
    
    def __init__(self):
        self.date_format = "%Y-%m-%d %H:%M:%S"
    
    def run(self):
        """运行CLI"""
        parser = argparse.ArgumentParser(
            prog="waterleak",
            description="供水管网漏损夜间复盘分析工具"
        )
        
        subparsers = parser.add_subparsers(dest="command", help="可用命令")
        
        validate_parser = subparsers.add_parser("validate", help="验证输入数据")
        self._add_common_args(validate_parser)
        
        analyze_parser = subparsers.add_parser("analyze", help="执行漏损分析")
        self._add_common_args(analyze_parser)
        self._add_analyze_args(analyze_parser)
        
        export_parser = subparsers.add_parser("export", help="导出分析结果")
        self._add_common_args(export_parser)
        self._add_analyze_args(export_parser)
        self._add_export_args(export_parser)
        
        run_parser = subparsers.add_parser("run", help="执行完整流程（validate + analyze + export）")
        self._add_common_args(run_parser)
        self._add_analyze_args(run_parser)
        self._add_export_args(run_parser)
        
        args = parser.parse_args()
        
        if args.command is None:
            parser.print_help()
            return 0
        
        if args.command == "validate":
            return self._cmd_validate(args)
        elif args.command == "analyze":
            return self._cmd_analyze(args)
        elif args.command == "export":
            return self._cmd_export(args)
        elif args.command == "run":
            return self._cmd_run(args)
        
        return 0
    
    def _add_common_args(self, parser: argparse.ArgumentParser):
        """添加通用参数"""
        parser.add_argument(
            "--pipes", "-p",
            type=Path,
            default=Path("pipes.yaml"),
            help="管道拓扑YAML文件路径 (默认: pipes.yaml)"
        )
        parser.add_argument(
            "--meters", "-m",
            type=Path,
            default=Path("meters.csv"),
            help="水表数据CSV文件路径 (默认: meters.csv)"
        )
        parser.add_argument(
            "--pressure", "-pr",
            type=Path,
            default=Path("pressure.jsonl"),
            help="压力数据JSONL文件路径 (默认: pressure.jsonl)"
        )
        parser.add_argument(
            "--repairs", "-r",
            type=Path,
            default=Path("repair_orders.csv"),
            help="维修工单CSV文件路径 (默认: repair_orders.csv)"
        )
        parser.add_argument(
            "--verbose", "-v",
            action="store_true",
            help="显示详细输出"
        )
    
    def _add_analyze_args(self, parser: argparse.ArgumentParser):
        """添加分析参数"""
        parser.add_argument(
            "--start-time", "-s",
            type=str,
            help="分析开始时间 (格式: YYYY-MM-DD HH:MM:SS)"
        )
        parser.add_argument(
            "--end-time", "-e",
            type=str,
            help="分析结束时间 (格式: YYYY-MM-DD HH:MM:SS)"
        )
    
    def _add_export_args(self, parser: argparse.ArgumentParser):
        """添加导出参数"""
        parser.add_argument(
            "--report", "-rep",
            type=Path,
            default=Path("leak_review.md"),
            help="复盘报告输出路径 (默认: leak_review.md)"
        )
        parser.add_argument(
            "--plan", "-pl",
            type=Path,
            default=Path("isolation_plan.csv"),
            help="隔离计划输出路径 (默认: isolation_plan.csv)"
        )
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """解析时间字符串"""
        if not dt_str:
            return None
        return datetime.strptime(dt_str, self.date_format)
    
    def _load_data(self, args) -> dict:
        """加载所有数据"""
        print("正在加载数据...")
        
        pipes_parser = PipesParser()
        meters_parser = MetersParser()
        pressure_parser = PressureParser()
        repair_parser = RepairOrdersParser()
        
        errors = []
        
        try:
            pipes_parser.parse(str(args.pipes))
            if args.verbose:
                print(f"  ✓ 加载管道: {len(pipes_parser.pipes)} 条, 分区: {len(pipes_parser.zones)} 个")
        except Exception as e:
            errors.append(f"加载 pipes.yaml 失败: {e}")
        
        try:
            meters_parser.parse(str(args.meters))
            if args.verbose:
                print(f"  ✓ 加载水表: {len(meters_parser.meters)} 个")
        except Exception as e:
            errors.append(f"加载 meters.csv 失败: {e}")
        
        try:
            pressure_parser.parse(str(args.pressure))
            if args.verbose:
                print(f"  ✓ 加载压力传感器: {len(pressure_parser.sensors)} 个")
        except Exception as e:
            errors.append(f"加载 pressure.jsonl 失败: {e}")
        
        try:
            repair_parser.parse(str(args.repairs))
            if args.verbose:
                print(f"  ✓ 加载维修工单: {len(repair_parser.orders)} 条")
        except Exception as e:
            errors.append(f"加载 repair_orders.csv 失败: {e}")
        
        return {
            "pipes_parser": pipes_parser,
            "meters_parser": meters_parser,
            "pressure_parser": pressure_parser,
            "repair_parser": repair_parser,
            "errors": errors
        }
    
    def _validate_data(self, data: dict) -> list:
        """验证数据"""
        print("正在验证数据...")
        
        all_errors = []
        all_errors.extend(data["errors"])
        
        pipes_errors = data["pipes_parser"].validate()
        all_errors.extend(pipes_errors)
        
        meters_errors = data["meters_parser"].validate()
        all_errors.extend(meters_errors)
        
        pressure_errors = data["pressure_parser"].validate()
        all_errors.extend(pressure_errors)
        
        repair_errors = data["repair_parser"].validate()
        all_errors.extend(repair_errors)
        
        try:
            graph = NetworkGraph()
            graph.build_from_parser(data["pipes_parser"])
            validator = GraphValidator(graph)
            graph_errors = validator.validate_all()
            all_errors.extend(graph_errors)
        except Exception as e:
            all_errors.append(f"拓扑验证失败: {e}")
        
        return all_errors
    
    def _analyze_data(self, data: dict, start_time: datetime, end_time: datetime) -> dict:
        """执行分析"""
        print("正在执行分析...")
        
        pipes_parser = data["pipes_parser"]
        meters_parser = data["meters_parser"]
        pressure_parser = data["pressure_parser"]
        repair_parser = data["repair_parser"]
        
        graph = NetworkGraph()
        graph.build_from_parser(pipes_parser)
        
        if start_time is None:
            all_times = []
            for meter in meters_parser.meters.values():
                if meter.readings:
                    all_times.append(meter.readings[0].timestamp)
                    all_times.append(meter.readings[-1].timestamp)
            for sensor in pressure_parser.sensors.values():
                if sensor.readings:
                    all_times.append(sensor.readings[0].timestamp)
                    all_times.append(sensor.readings[-1].timestamp)
            
            if all_times:
                start_time = min(all_times)
                end_time = max(all_times)
            else:
                raise ValueError("无法确定分析时间范围，请指定 --start-time 和 --end-time")
        
        print(f"  分析时段: {start_time.strftime(self.date_format)} 至 {end_time.strftime(self.date_format)}")
        
        print("  分析水量平衡...")
        balance_calc = ZoneBalanceCalculator(meters_parser, repair_parser)
        balance_results = balance_calc.calculate_all_zones(
            pipes_parser.zones, start_time, end_time
        )
        
        suspicious_count = sum(1 for r in balance_results if r.is_suspicious and not r.excluded_reasons)
        print(f"    发现 {suspicious_count} 个可疑分区")
        
        print("  分析压力突降...")
        pressure_analyzer = PressureDropAnalyzer(pressure_parser, graph, repair_parser)
        pressure_events = pressure_analyzer.analyze_pressure_drops(start_time, end_time)
        
        valid_events = [e for e in pressure_events if e.is_valid]
        print(f"    发现 {len(valid_events)} 个有效压力突降事件")
        
        print("  分析压力传播路径...")
        propagation_paths = pressure_analyzer.analyze_propagation(pressure_events)
        print(f"    发现 {len(propagation_paths)} 条传播路径")
        
        print("  定位可疑漏点...")
        leak_locator = LeakLocator(graph)
        suspected_leaks = leak_locator.locate_leaks(
            balance_results, pressure_events, propagation_paths
        )
        print(f"    定位到 {len(suspected_leaks)} 个可疑漏点")
        
        print("  生成隔离计划...")
        isolation_steps = leak_locator.generate_isolation_plan(suspected_leaks)
        print(f"    生成 {len(isolation_steps)} 个隔离步骤")
        
        print("  检测数据异常...")
        data_anomalies = pressure_analyzer.detect_data_anomalies()
        
        return {
            "start_time": start_time,
            "end_time": end_time,
            "balance_results": balance_results,
            "pressure_events": pressure_events,
            "propagation_paths": propagation_paths,
            "suspected_leaks": suspected_leaks,
            "isolation_steps": isolation_steps,
            "data_anomalies": data_anomalies
        }
    
    def _export_results(self, analysis_result: dict, validation_errors: list, args):
        """导出结果"""
        print("正在导出结果...")
        
        report_generator = ReportGenerator()
        plan_generator = PlanGenerator()
        
        report_content = report_generator.generate_report(
            start_time=analysis_result["start_time"],
            end_time=analysis_result["end_time"],
            balance_results=analysis_result["balance_results"],
            pressure_events=analysis_result["pressure_events"],
            propagation_paths=analysis_result["propagation_paths"],
            suspected_leaks=analysis_result["suspected_leaks"],
            validation_errors=validation_errors,
            data_anomalies=analysis_result["data_anomalies"]
        )
        
        report_generator.write_report(str(args.report), report_content)
        print(f"  ✓ 报告已写入: {args.report}")
        
        plan_generator.write_csv(str(args.plan), analysis_result["isolation_steps"])
        print(f"  ✓ 隔离计划已写入: {args.plan}")
    
    def _cmd_validate(self, args) -> int:
        """执行validate命令"""
        data = self._load_data(args)
        errors = self._validate_data(data)
        
        if errors:
            print("\n❌ 数据验证发现问题:")
            for error in errors:
                print(f"  - {error}")
            return 1
        
        print("\n✅ 所有数据验证通过")
        return 0
    
    def _cmd_analyze(self, args) -> int:
        """执行analyze命令"""
        data = self._load_data(args)
        validation_errors = self._validate_data(data)
        
        if validation_errors:
            print("\n⚠️ 数据验证发现问题，继续分析...")
        
        start_time = self._parse_datetime(args.start_time)
        end_time = self._parse_datetime(args.end_time)
        
        try:
            result = self._analyze_data(data, start_time, end_time)
            
            print("\n📊 分析结果摘要:")
            print(f"  可疑漏点: {len(result['suspected_leaks'])} 个")
            
            high = sum(1 for l in result['suspected_leaks'] if l.priority == 'high')
            medium = sum(1 for l in result['suspected_leaks'] if l.priority == 'medium')
            low = sum(1 for l in result['suspected_leaks'] if l.priority == 'low')
            
            print(f"    - 高优先级: {high}")
            print(f"    - 中优先级: {medium}")
            print(f"    - 低优先级: {low}")
            
            return 0
            
        except Exception as e:
            print(f"\n❌ 分析失败: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()
            return 1
    
    def _cmd_export(self, args) -> int:
        """执行export命令"""
        data = self._load_data(args)
        validation_errors = self._validate_data(data)
        
        start_time = self._parse_datetime(args.start_time)
        end_time = self._parse_datetime(args.end_time)
        
        try:
            result = self._analyze_data(data, start_time, end_time)
            self._export_results(result, validation_errors, args)
            
            print("\n✅ 导出完成")
            return 0
            
        except Exception as e:
            print(f"\n❌ 导出失败: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()
            return 1
    
    def _cmd_run(self, args) -> int:
        """执行run命令（完整流程）"""
        print("=" * 50)
        print("  供水管网漏损夜间复盘分析")
        print("=" * 50)
        print()
        
        data = self._load_data(args)
        validation_errors = self._validate_data(data)
        
        print()
        
        start_time = self._parse_datetime(args.start_time)
        end_time = self._parse_datetime(args.end_time)
        
        try:
            result = self._analyze_data(data, start_time, end_time)
            print()
            self._export_results(result, validation_errors, args)
            
            print()
            print("=" * 50)
            print("  分析完成")
            print("=" * 50)
            
            if result["suspected_leaks"]:
                print(f"\n⚠️  发现 {len(result['suspected_leaks'])} 个可疑漏点")
                for leak in result["suspected_leaks"]:
                    priority = "🔴 高" if leak.priority == "high" else ("🟡 中" if leak.priority == "medium" else "🟢 低")
                    print(f"  {priority}优先级 - {leak.leak_id}: {leak.location_description}")
            else:
                print("\n✅ 未发现明显漏损迹象")
            
            print(f"\n📄 复盘报告: {args.report}")
            print(f"📋 隔离计划: {args.plan}")
            
            return 0
            
        except Exception as e:
            print(f"\n❌ 分析失败: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()
            return 1


def main():
    """入口函数"""
    cli = WaterLeakCLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
