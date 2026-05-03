"""命令行界面"""

import argparse
import sys
from pathlib import Path
from datetime import timedelta, time
from typing import Optional

from . import __version__
from .parser import DataParser
from .validator import ScheduleAnalyzer
from .reporter import ReportGenerator


class LabSchedulerCLI:
    """实验室值班预约检查工具命令行界面"""
    
    def __init__(self):
        self.parser = self._create_argument_parser()
    
    def _create_argument_parser(self) -> argparse.ArgumentParser:
        """创建参数解析器"""
        parser = argparse.ArgumentParser(
            prog="lab-scheduler",
            description="实验室值班预约检查工具 - 检查时间冲突、超时占用、故障期误预约和连续值守过长问题",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  # 基本检查
  lab-scheduler check --bookings bookings.json --faults faults.json
  
  # 生成完整报告并导出可用时段
  lab-scheduler check --bookings bookings.json --faults faults.json \
      --report risk_report.md --slots available_slots.csv
  
  # 自定义参数检查
  lab-scheduler check --bookings bookings.json --faults faults.json \
      --max-booking-hours 6 --max-consecutive-hours 10
  
  # 仅验证数据格式
  lab-scheduler validate --bookings bookings.json --faults faults.json
  
  # 仅导出可用时段
  lab-scheduler slots --bookings bookings.json --faults faults.json \
      --output available_slots.csv
            """
        )
        
        parser.add_argument(
            "-v", "--version",
            action="version",
            version=f"lab-scheduler {__version__}"
        )
        
        subparsers = parser.add_subparsers(
            dest="command",
            help="可用命令"
        )
        
        check_parser = subparsers.add_parser(
            "check",
            help="执行完整检查并生成风险报告",
            description="执行完整的预约检查，包括时间冲突、超时占用、故障期误预约和连续值守过长"
        )
        self._add_common_arguments(check_parser)
        self._add_analyzer_arguments(check_parser)
        self._add_output_arguments(check_parser)
        
        validate_parser = subparsers.add_parser(
            "validate",
            help="仅验证数据格式",
            description="验证预约和故障数据的JSON格式是否正确，但不执行业务逻辑检查"
        )
        self._add_common_arguments(validate_parser)
        
        slots_parser = subparsers.add_parser(
            "slots",
            help="导出可用时段",
            description="分析并导出可调整的候选时段为CSV文件"
        )
        self._add_common_arguments(slots_parser)
        self._add_analyzer_arguments(slots_parser)
        slots_parser.add_argument(
            "--output", "-o",
            required=True,
            help="输出CSV文件路径"
        )
        slots_parser.add_argument(
            "--min-hours",
            type=float,
            default=1.0,
            help="最小时段时长（小时），默认1.0"
        )
        
        report_parser = subparsers.add_parser(
            "report",
            help="生成Markdown报告",
            description="生成详细的Markdown格式风险报告"
        )
        self._add_common_arguments(report_parser)
        self._add_analyzer_arguments(report_parser)
        report_parser.add_argument(
            "--output", "-o",
            required=True,
            help="输出Markdown文件路径"
        )
        report_parser.add_argument(
            "--no-slots",
            action="store_true",
            help="不在报告中包含可用时段"
        )
        
        return parser
    
    def _add_common_arguments(self, parser: argparse.ArgumentParser):
        """添加通用参数"""
        parser.add_argument(
            "--bookings", "-b",
            required=True,
            help="预约数据JSON文件路径"
        )
        parser.add_argument(
            "--faults", "-f",
            default="",
            help="故障记录JSON文件路径（可选）"
        )
    
    def _add_analyzer_arguments(self, parser: argparse.ArgumentParser):
        """添加分析器参数"""
        parser.add_argument(
            "--max-booking-hours",
            type=float,
            default=4.0,
            help="单次预约最大时长（小时），默认4.0"
        )
        parser.add_argument(
            "--max-consecutive-hours",
            type=float,
            default=8.0,
            help="单人连续值守最大时长（小时），默认8.0"
        )
        parser.add_argument(
            "--work-start",
            type=str,
            default="08:00",
            help="工作开始时间（HH:MM格式），默认08:00"
        )
        parser.add_argument(
            "--work-end",
            type=str,
            default="22:00",
            help="工作结束时间（HH:MM格式），默认22:00"
        )
    
    def _add_output_arguments(self, parser: argparse.ArgumentParser):
        """添加输出参数"""
        parser.add_argument(
            "--report", "-r",
            help="输出Markdown报告文件路径"
        )
        parser.add_argument(
            "--slots", "-s",
            help="输出可用时段CSV文件路径"
        )
        parser.add_argument(
            "--issues", "-i",
            help="输出风险问题CSV文件路径"
        )
        parser.add_argument(
            "--quiet", "-q",
            action="store_true",
            help="静默模式，不输出到控制台"
        )
    
    def _parse_time(self, time_str: str) -> time:
        """解析时间字符串"""
        try:
            parts = time_str.split(':')
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            return time(hour, minute)
        except (ValueError, IndexError):
            raise ValueError(f"无效的时间格式: {time_str}，应为 HH:MM 格式")
    
    def _load_data(self, bookings_path: str, faults_path: str):
        """加载数据"""
        bookings = DataParser.load_bookings_from_file(bookings_path)
        
        faults = []
        if faults_path and Path(faults_path).exists():
            faults = DataParser.load_faults_from_file(faults_path)
        
        return bookings, faults
    
    def _create_analyzer(self, args) -> ScheduleAnalyzer:
        """创建分析器"""
        work_start = self._parse_time(args.work_start)
        work_end = self._parse_time(args.work_end)
        
        min_slot_hours = getattr(args, 'min_hours', 1.0)
        
        return ScheduleAnalyzer(
            max_booking_duration=timedelta(hours=args.max_booking_hours),
            max_consecutive_hours=args.max_consecutive_hours,
            work_start_time=work_start,
            work_end_time=work_end,
            min_slot_duration=timedelta(hours=min_slot_hours)
        )
    
    def _print_summary(self, result, quiet: bool = False):
        """打印摘要"""
        if quiet:
            return
        
        print("=" * 60)
        print("实验室值班预约检查结果")
        print("=" * 60)
        print(f"\n预约记录: {len(result.bookings)} 条")
        print(f"故障记录: {len(result.faults)} 条")
        print(f"风险问题: {len(result.issues)} 个")
        print(f"  - 高风险: {result.high_risk_count}")
        print(f"  - 中风险: {result.medium_risk_count}")
        print(f"  - 低风险: {result.low_risk_count}")
        print(f"可用时段: {len(result.available_slots)} 个")
        
        if result.issues:
            print("\n" + "-" * 60)
            print("风险问题详情:")
            print("-" * 60)
            for idx, issue in enumerate(result.issues, 1):
                icon = "🔴" if issue.risk_level.value == "高" else ("🟡" if issue.risk_level.value == "中" else "🟢")
                print(f"\n{icon} [{issue.risk_level.value}风险] {issue.issue_type}")
                print(f"   {issue.description}")
        
        print("\n" + "=" * 60)
        if result.high_risk_count > 0:
            print("🚨 存在高风险问题，请优先处理！")
        elif result.issues:
            print("⚠️ 存在风险问题，建议检查。")
        else:
            print("✅ 无风险问题，一切正常！")
        print("=" * 60)
    
    def run(self, args=None):
        """运行命令行工具"""
        if args is None:
            args = sys.argv[1:]
        
        parsed_args = self.parser.parse_args(args)
        
        if parsed_args.command is None:
            self.parser.print_help()
            return 0
        
        try:
            bookings, faults = self._load_data(
                parsed_args.bookings,
                parsed_args.faults
            )
            
            if parsed_args.command == "validate":
                print("✅ 数据格式验证通过！")
                print(f"   预约记录: {len(bookings)} 条")
                print(f"   故障记录: {len(faults)} 条")
                return 0
            
            analyzer = self._create_analyzer(parsed_args)
            result = analyzer.analyze(bookings, faults)
            
            if parsed_args.command == "check":
                quiet = getattr(parsed_args, 'quiet', False)
                self._print_summary(result, quiet)
                
                if parsed_args.report:
                    report_content = ReportGenerator.generate_markdown_report(result)
                    report_path = Path(parsed_args.report)
                    report_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(report_path, 'w', encoding='utf-8') as f:
                        f.write(report_content)
                    if not quiet:
                        print(f"\n📄 报告已保存到: {parsed_args.report}")
                
                if parsed_args.slots:
                    ReportGenerator.export_available_slots_to_csv(
                        result.available_slots,
                        parsed_args.slots
                    )
                    if not quiet:
                        print(f"📊 可用时段已保存到: {parsed_args.slots}")
                
                if parsed_args.issues:
                    ReportGenerator.export_issues_to_csv(
                        result.issues,
                        parsed_args.issues
                    )
                    if not quiet:
                        print(f"📋 风险问题已保存到: {parsed_args.issues}")
                
                return 1 if result.high_risk_count > 0 else 0
            
            elif parsed_args.command == "slots":
                ReportGenerator.export_available_slots_to_csv(
                    result.available_slots,
                    parsed_args.output
                )
                print(f"✅ 可用时段已导出到: {parsed_args.output}")
                print(f"   共 {len(result.available_slots)} 个时段")
                return 0
            
            elif parsed_args.command == "report":
                report_content = ReportGenerator.generate_markdown_report(
                    result,
                    include_available_slots=not parsed_args.no_slots
                )
                report_path = Path(parsed_args.output)
                report_path.parent.mkdir(parents=True, exist_ok=True)
                with open(report_path, 'w', encoding='utf-8') as f:
                    f.write(report_content)
                print(f"✅ 报告已生成: {parsed_args.output}")
                print(f"   风险问题: {len(result.issues)} 个")
                return 0
            
            return 0
        
        except FileNotFoundError as e:
            print(f"❌ 文件不存在: {e}", file=sys.stderr)
            return 1
        
        except ValueError as e:
            print(f"❌ 数据错误: {e}", file=sys.stderr)
            return 1
        
        except Exception as e:
            print(f"❌ 执行错误: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            return 1


def main():
    """主函数入口"""
    cli = LabSchedulerCLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
