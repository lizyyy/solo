"""CLI入口模块"""
import argparse
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

from .parsers import PoolsParser, SensorParser, DosingParser, RulesParser
from .rules import ReviewEngine
from .exporters import CSVExporter, MarkdownExporter
from .models import ReviewResult, SeverityLevel
from .version import __version__

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_parser() -> argparse.ArgumentParser:
    """设置命令行参数解析器"""
    parser = argparse.ArgumentParser(
        prog='pool-review',
        description='公共泳池水质投药复盘工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f'''
示例:
  # 基本使用 - 使用当前目录的数据文件
  pool-review review

  # 指定数据文件路径
  pool-review review --pools /data/pools.csv --sensor /data/sensor_minutes.csv

  # 指定复盘日期
  pool-review review --date 2024-05-20

  # 仅验证输入数据
  pool-review validate

版本: {__version__}
        '''
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version=f'pool-review {__version__}'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    review_parser = subparsers.add_parser('review', help='执行复盘分析')
    review_parser.add_argument(
        '--pools', '-p',
        type=str,
        default='pools.csv',
        help='泳池配置CSV文件路径 (默认: pools.csv)'
    )
    review_parser.add_argument(
        '--sensor', '-s',
        type=str,
        default='sensor_minutes.csv',
        help='传感器数据CSV文件路径 (默认: sensor_minutes.csv)'
    )
    review_parser.add_argument(
        '--dosing', '-d',
        type=str,
        default='dosing_log.jsonl',
        help='投药日志JSONL文件路径 (默认: dosing_log.jsonl)'
    )
    review_parser.add_argument(
        '--rules', '-r',
        type=str,
        default='rules.yaml',
        help='规则配置YAML文件路径 (默认: rules.yaml)'
    )
    review_parser.add_argument(
        '--date',
        type=str,
        help='复盘日期 (格式: YYYY-MM-DD, 默认: 今天)'
    )
    review_parser.add_argument(
        '--output-dir', '-o',
        type=str,
        default='.',
        help='输出目录 (默认: 当前目录)'
    )
    review_parser.add_argument(
        '--no-export',
        action='store_true',
        help='不导出报告文件，仅在控制台显示结果'
    )
    review_parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='显示详细日志'
    )
    
    validate_parser = subparsers.add_parser('validate', help='验证输入数据')
    validate_parser.add_argument(
        '--pools', '-p',
        type=str,
        default='pools.csv',
        help='泳池配置CSV文件路径'
    )
    validate_parser.add_argument(
        '--sensor', '-s',
        type=str,
        default='sensor_minutes.csv',
        help='传感器数据CSV文件路径'
    )
    validate_parser.add_argument(
        '--dosing', '-d',
        type=str,
        default='dosing_log.jsonl',
        help='投药日志JSONL文件路径'
    )
    validate_parser.add_argument(
        '--rules', '-r',
        type=str,
        default='rules.yaml',
        help='规则配置YAML文件路径'
    )
    
    return parser


def parse_date(date_str: Optional[str]) -> datetime:
    """解析日期参数"""
    if not date_str:
        return datetime.now()
    
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        logger.error(f"无效的日期格式: {date_str}，应为 YYYY-MM-DD")
        sys.exit(1)


def run_validate(args) -> int:
    """执行验证命令"""
    logger.info("开始验证输入数据...")
    
    pools_path = Path(args.pools)
    sensor_path = Path(args.sensor)
    dosing_path = Path(args.dosing)
    rules_path = Path(args.rules)
    
    all_valid = True
    
    pools_parser = PoolsParser(pools_path)
    pools = pools_parser.parse()
    if not pools_parser.validate():
        logger.error("泳池配置验证失败")
        for err in pools_parser.get_errors():
            logger.error(f"  - {err}")
        all_valid = False
    else:
        logger.info(f"✓ 泳池配置: 找到 {len(pools)} 个泳池")
    
    sensor_parser = SensorParser(sensor_path, pools)
    sensor_data = sensor_parser.parse()
    if not sensor_parser.validate():
        logger.warning("传感器数据有警告")
        for warn in sensor_parser.get_warnings():
            logger.warning(f"  - {warn}")
    else:
        total_readings = sum(len(d.readings) for d in sensor_data.values())
        logger.info(f"✓ 传感器数据: {len(sensor_data)} 个泳池, 共 {total_readings} 条读数")
    
    dosing_parser = DosingParser(dosing_path, pools)
    dosing_logs = dosing_parser.parse()
    if not dosing_parser.validate():
        logger.warning("投药日志有警告")
        for warn in dosing_parser.get_warnings():
            logger.warning(f"  - {warn}")
    else:
        total_records = sum(len(l.records) for l in dosing_logs.values())
        logger.info(f"✓ 投药日志: {len(dosing_logs)} 个泳池, 共 {total_records} 条记录")
    
    rules_parser = RulesParser(rules_path)
    rules = rules_parser.parse()
    if not rules_parser.validate():
        logger.error("规则配置验证失败")
        for err in rules_parser.get_errors():
            logger.error(f"  - {err}")
        all_valid = False
    else:
        logger.info("✓ 规则配置: 已加载")
    
    if all_valid:
        logger.info("\n✅ 所有数据验证通过！")
        return 0
    else:
        logger.error("\n❌ 数据验证存在错误")
        return 1


def run_review(args) -> int:
    """执行复盘命令"""
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    review_date = parse_date(args.date)
    logger.info(f"执行复盘，日期: {review_date.date()}")
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    pools_path = Path(args.pools)
    sensor_path = Path(args.sensor)
    dosing_path = Path(args.dosing)
    rules_path = Path(args.rules)
    
    logger.info("解析数据文件...")
    
    pools_parser = PoolsParser(pools_path)
    pools = pools_parser.parse()
    if not pools_parser.validate():
        logger.error("泳池配置验证失败")
        for err in pools_parser.get_errors():
            logger.error(f"  - {err}")
        return 1
    
    sensor_parser = SensorParser(sensor_path, pools)
    sensor_data = sensor_parser.parse()
    for warn in sensor_parser.get_warnings():
        logger.warning(f"传感器数据警告: {warn}")
    
    dosing_parser = DosingParser(dosing_path, pools)
    dosing_logs = dosing_parser.parse()
    for warn in dosing_parser.get_warnings():
        logger.warning(f"投药日志警告: {warn}")
    
    rules_parser = RulesParser(rules_path)
    rules = rules_parser.parse()
    if rules_parser.has_errors():
        logger.warning("使用默认规则配置")
        for err in rules_parser.get_errors():
            logger.warning(f"  - {err}")
    
    logger.info("执行规则检查...")
    engine = ReviewEngine(rules)
    result = engine.run_review(
        pools=pools,
        sensor_data=sensor_data,
        dosing_logs=dosing_logs,
        visitor_periods=None,
        review_date=review_date
    )
    
    _print_review_summary(result)
    
    if not args.no_export:
        logger.info("导出报告...")
        
        csv_path = output_dir / 'issues.csv'
        md_path = output_dir / 'pool_water_review.md'
        
        try:
            issue_count = CSVExporter.export(result, csv_path)
            logger.info(f"✓ 问题列表已导出: {csv_path} ({issue_count} 条)")
        except Exception as e:
            logger.error(f"导出CSV失败: {str(e)}")
        
        try:
            MarkdownExporter.export(result, md_path)
            logger.info(f"✓ 复盘报告已导出: {md_path}")
        except Exception as e:
            logger.error(f"导出Markdown失败: {str(e)}")
    
    critical_count = sum(
        1 for i in result.all_issues 
        if i.severity == SeverityLevel.CRITICAL
    )
    
    if critical_count > 0:
        logger.warning(f"\n⚠️ 发现 {critical_count} 个严重问题，请优先处理")
        return 2
    
    return 0


def _print_review_summary(result: ReviewResult):
    """打印复盘摘要"""
    total = len(result.all_issues)
    by_severity = result.get_all_issues_by_severity()
    
    critical = len(by_severity[SeverityLevel.CRITICAL])
    warning = len(by_severity[SeverityLevel.WARNING])
    info = len(by_severity[SeverityLevel.INFO])
    
    print("\n" + "=" * 60)
    print("                    复盘结果摘要")
    print("=" * 60)
    print(f"复盘日期: {result.review_date.date()}")
    print(f"复盘泳池数: {len(result.pools)}")
    print(f"\n问题统计:")
    print(f"  🔴 严重问题: {critical}")
    print(f"  🟡 警告问题: {warning}")
    print(f"  ℹ️ 信息提示: {info}")
    print(f"  {'-' * 30}")
    print(f"  总计: {total}")
    
    if total > 0:
        by_type = result.count_issues_by_type()
        print(f"\n问题类型分布:")
        for issue_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
            print(f"  - {issue_type}: {count}")
    
    print("=" * 60 + "\n")


def main():
    """主入口函数"""
    parser = setup_parser()
    args = parser.parse_args()
    
    if args.command == 'review':
        sys.exit(run_review(args))
    elif args.command == 'validate':
        sys.exit(run_validate(args))
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == '__main__':
    main()
