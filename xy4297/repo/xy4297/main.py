"""
疫苗冷链交接自动化工具 - 主入口脚本

使用方法:
    python main.py --input ./data/input --output ./data/output --archive ./data/archive
    python main.py --help
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from config import Config
from parsers.csv_parser import TemperatureCSVParser
from parsers.photo_parser import PhotoParser
from parsers.log_parser import DoorLogParser
from rules.engine import RuleEngine, AlertLevel
from archiver.archiver import FileArchiver
from reports.generator import ReportGenerator


def parse_arguments():
    """
    解析命令行参数
    """
    parser = argparse.ArgumentParser(
        description="疫苗冷链交接自动化工具 - 解析温度CSV、照片和开门日志，检测异常并生成报告",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py                              # 使用默认配置目录
  python main.py --input ./my_data            # 指定输入目录
  python main.py --no-archive                 # 不执行归档
  python main.py --move-files                 # 归档时移动文件而非复制
  python main.py --temp-min 0 --temp-max 10   # 自定义温度阈值
        """,
    )

    parser.add_argument(
        "-i", "--input",
        type=str,
        help="输入数据目录 (包含温度CSV、照片和开门日志)",
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        help="输出报告目录",
    )
    parser.add_argument(
        "-a", "--archive",
        type=str,
        help="归档目录",
    )
    parser.add_argument(
        "--no-archive",
        action="store_true",
        help="不执行文件归档",
    )
    parser.add_argument(
        "--move-files",
        action="store_true",
        help="归档时移动文件(默认是复制)",
    )
    parser.add_argument(
        "--temp-min",
        type=float,
        help="温度下限阈值(默认: 2.0°C)",
    )
    parser.add_argument(
        "--temp-max",
        type=float,
        help="温度上限阈值(默认: 8.0°C)",
    )
    parser.add_argument(
        "--min-readings",
        type=int,
        help="每小时最小读数数量(默认: 4)",
    )
    parser.add_argument(
        "--report-prefix",
        type=str,
        default="cold_chain",
        help="报告文件名前缀(默认: cold_chain)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="显示详细输出",
    )

    return parser.parse_args()


class ColdChainProcessor:
    """
    冷链数据处理主类
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        verbose: bool = False,
    ):
        self.config = config or Config()
        self.verbose = verbose
        
        self.temp_parser: Optional[TemperatureCSVParser] = None
        self.photo_parser: Optional[PhotoParser] = None
        self.door_parser: Optional[DoorLogParser] = None
        self.rule_engine: Optional[RuleEngine] = None
        self.archiver: Optional[FileArchiver] = None
        self.report_generator: Optional[ReportGenerator] = None
        
        self.results: Dict[str, Any] = {}

    def process(
        self,
        input_dir: Optional[Path] = None,
        output_dir: Optional[Path] = None,
        archive_dir: Optional[Path] = None,
        do_archive: bool = True,
        move_files: bool = False,
        report_prefix: str = "cold_chain",
    ) -> Dict[str, Any]:
        """
        执行完整处理流程
        
        Args:
            input_dir: 输入目录
            output_dir: 输出目录
            archive_dir: 归档目录
            do_archive: 是否执行归档
            move_files: 归档时是否移动文件
            report_prefix: 报告前缀
            
        Returns:
            处理结果字典
        """
        input_dir = input_dir or self.config.INPUT_DIR
        output_dir = output_dir or self.config.OUTPUT_DIR
        archive_dir = archive_dir or self.config.ARCHIVE_DIR
        
        self._log(f"开始处理冷链交接数据...")
        self._log(f"  输入目录: {input_dir}")
        self._log(f"  输出目录: {output_dir}")
        self._log(f"  归档目录: {archive_dir}")
        self._log("")

        self.config.ensure_directories()
        
        start_time = datetime.now()
        self.results = {
            "start_time": start_time.isoformat(),
            "input_dir": str(input_dir),
            "output_dir": str(output_dir),
            "archive_dir": str(archive_dir),
        }

        self._log("=== 步骤1: 解析数据 ===")
        self._parse_data(input_dir)
        self._log("")

        self._log("=== 步骤2: 规则检测 ===")
        self._run_rules()
        self._log("")

        self._log("=== 步骤3: 生成报告 ===")
        self._generate_reports(output_dir, report_prefix)
        self._log("")

        if do_archive:
            self._log("=== 步骤4: 归档文件 ===")
            self._archive_files(input_dir, archive_dir, move_files)
            self._log("")

        end_time = datetime.now()
        self.results["end_time"] = end_time.isoformat()
        self.results["duration_seconds"] = (end_time - start_time).total_seconds()

        self._print_summary()
        
        return self.results

    def _parse_data(self, input_dir: Path):
        """
        解析所有数据文件
        """
        if not input_dir.exists():
            self._log(f"警告: 输入目录不存在: {input_dir}")
            return

        self._log("解析温度CSV文件...")
        self.temp_parser = TemperatureCSVParser(self.config)
        temp_readings = self.temp_parser.parse_directory(input_dir)
        self._log(f"  解析了 {len(temp_readings)} 条温度读数")
        
        if self.verbose and self.temp_parser.parsed_files:
            for pf in self.temp_parser.parsed_files:
                self._log(f"    - {pf['file_name']}: {pf['valid_rows']} 行有效数据")

        self._log("解析照片文件...")
        self.photo_parser = PhotoParser(self.config)
        photos = self.photo_parser.parse_directory(input_dir)
        self._log(f"  解析了 {len(photos)} 张照片")
        
        if self.verbose and self.photo_parser.photos_by_date:
            for dt, ps in sorted(self.photo_parser.photos_by_date.items()):
                self._log(f"    - {dt}: {len(ps)} 张照片")

        self._log("解析开门日志...")
        self.door_parser = DoorLogParser(self.config)
        door_entries = self.door_parser.parse_directory(input_dir)
        self._log(f"  解析了 {len(door_entries)} 条开门日志")
        
        self.results["parsing"] = {
            "temperature_readings": len(temp_readings),
            "temperature_files": len(self.temp_parser.parsed_files),
            "photos": len(photos),
            "door_log_entries": len(door_entries),
        }

    def _run_rules(self):
        """
        运行规则引擎检测异常
        """
        self._log("运行异常检测...")
        
        self.rule_engine = RuleEngine(
            config=self.config,
            temp_parser=self.temp_parser,
            photo_parser=self.photo_parser,
            door_parser=self.door_parser,
        )
        
        anomalies = self.rule_engine.run_all_checks()
        
        summary = self.rule_engine.get_summary()
        
        self._log(f"  检测到 {len(anomalies)} 个异常:")
        self._log(f"    - 严重 (CRITICAL): {summary['critical_count']}")
        self._log(f"    - 高级 (HIGH): {summary['high_count']}")
        self._log(f"    - 中级 (MEDIUM): {summary['medium_count']}")
        
        if self.verbose and anomalies:
            self._log("")
            self._log("  异常详情:")
            for anomaly in anomalies:
                level_icon = "🔴" if anomaly.is_critical else ("🟠" if anomaly.is_high else "🟡")
                self._log(f"    {level_icon} [{anomaly.alert_level.value}] {anomaly.description}")
        
        self.results["anomalies"] = summary
        self.results["anomaly_count"] = len(anomalies)

    def _generate_reports(self, output_dir: Path, prefix: str):
        """
        生成所有报告
        """
        self._log("生成报告...")
        
        self.report_generator = ReportGenerator(
            config=self.config,
            temp_parser=self.temp_parser,
            photo_parser=self.photo_parser,
            door_parser=self.door_parser,
            rule_engine=self.rule_engine,
        )
        
        report_paths = self.report_generator.generate_all(
            output_dir=output_dir,
            prefix=prefix,
        )
        
        self._log(f"  Markdown报告: {report_paths['markdown']}")
        self._log(f"  CSV异常清单: {report_paths['csv']}")
        self._log(f"  JSON审计摘要: {report_paths['json']}")
        
        self.results["reports"] = {
            "markdown": str(report_paths["markdown"]),
            "csv": str(report_paths["csv"]),
            "json": str(report_paths["json"]),
        }

    def _archive_files(self, input_dir: Path, archive_dir: Path, move_files: bool):
        """
        归档文件
        """
        self._log("归档文件...")
        
        self.archiver = FileArchiver(
            config=self.config,
            temp_parser=self.temp_parser,
            photo_parser=self.photo_parser,
            door_parser=self.door_parser,
        )
        
        archive_result = self.archiver.archive_all(
            input_dir=input_dir,
            output_dir=archive_dir,
            move=move_files,
        )
        
        summary = self.archiver.get_archive_summary()
        
        self._log(f"  成功归档: {summary['success_count']} 个文件")
        if summary["failure_count"] > 0:
            self._log(f"  归档失败: {summary['failure_count']} 个文件")
        
        if self.verbose and summary.get("by_category"):
            self._log("")
            self._log("  按类别统计:")
            for category, count in summary["by_category"].items():
                self._log(f"    - {category}: {count}")
        
        self.results["archive"] = summary
        self.results["archive_result"] = archive_result.to_dict()

    def _print_summary(self):
        """
        打印处理摘要
        """
        self._log("=" * 50)
        self._log("处理完成摘要")
        self._log("=" * 50)
        
        duration = self.results.get("duration_seconds", 0)
        self._log(f"处理耗时: {duration:.2f} 秒")
        self._log("")
        
        if self.results.get("parsing"):
            parsing = self.results["parsing"]
            self._log("数据解析:")
            self._log(f"  温度读数: {parsing['temperature_readings']}")
            self._log(f"  照片数量: {parsing['photos']}")
            self._log(f"  开门日志: {parsing['door_log_entries']}")
            self._log("")
        
        if self.results.get("anomalies"):
            anomalies = self.results["anomalies"]
            self._log("异常检测:")
            
            critical = anomalies.get("critical_count", 0)
            high = anomalies.get("high_count", 0)
            medium = anomalies.get("medium_count", 0)
            
            if critical > 0:
                self._log(f"  🔴 严重异常: {critical}")
            if high > 0:
                self._log(f"  🟠 高级异常: {high}")
            if medium > 0:
                self._log(f"  🟡 中级异常: {medium}")
                
            if critical + high + medium == 0:
                self._log("  ✅ 无异常检测到")
            self._log("")
        
        if self.results.get("reports"):
            reports = self.results["reports"]
            self._log("生成的报告:")
            for report_type, path in reports.items():
                self._log(f"  - {report_type}: {path}")
            self._log("")

    def _log(self, message: str):
        """
        输出日志
        """
        print(message)


def main():
    """
    主函数
    """
    args = parse_arguments()
    
    config = Config.from_env()
    
    if args.temp_min is not None:
        config.TEMP_THRESHOLD_MIN = args.temp_min
    if args.temp_max is not None:
        config.TEMP_THRESHOLD_MAX = args.temp_max
    if args.min_readings is not None:
        config.MIN_READINGS_PER_HOUR = args.min_readings
    
    input_dir = Path(args.input) if args.input else config.INPUT_DIR
    output_dir = Path(args.output) if args.output else config.OUTPUT_DIR
    archive_dir = Path(args.archive) if args.archive else config.ARCHIVE_DIR
    
    processor = ColdChainProcessor(
        config=config,
        verbose=args.verbose,
    )
    
    try:
        results = processor.process(
            input_dir=input_dir,
            output_dir=output_dir,
            archive_dir=archive_dir,
            do_archive=not args.no_archive,
            move_files=args.move_files,
            report_prefix=args.report_prefix,
        )
        
        if results.get("anomaly_count", 0) > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        print(f"处理过程中发生错误: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(2)


if __name__ == "__main__":
    main()
