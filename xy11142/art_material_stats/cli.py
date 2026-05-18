import os
import sys
import logging
from pathlib import Path
import click
import pandas as pd

from .processor import MaterialStatsProcessor
from .reporter import ReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option(version="0.1.0")
def main():
    """美术培训室画材缺料统计 CLI 工具"""
    pass


@main.command()
@click.option("--input-dir", "-i", required=True, type=click.Path(exists=True, file_okay=False), help="输入目录路径，包含待统计的画材缺料文件")
@click.option("--rules", "-r", required=True, type=click.Path(exists=True, dir_okay=False), help="规则文件路径 (Excel)")
@click.option("--output-dir", "-o", required=True, type=click.Path(file_okay=False), help="输出结果目录路径")
@click.option("--preview", "-p", is_flag=True, help="预览模式，只显示统计概览，不生成输出文件")
@click.option("--verbose", "-v", is_flag=True, help="详细模式，显示每条记录的处理详情")
def run(input_dir, rules, output_dir, preview, verbose):
    """执行画材缺料统计处理"""
    if verbose:
        logger.setLevel(logging.DEBUG)
    
    logger.info("=" * 60)
    logger.info("美术培训室画材缺料统计工具")
    logger.info("=" * 60)
    
    input_path = Path(input_dir)
    rules_path = Path(rules)
    output_path = Path(output_dir)
    
    logger.info(f"输入目录: {input_path}")
    logger.info(f"规则文件: {rules_path}")
    logger.info(f"输出目录: {output_path}")
    logger.info("")
    
    processor = MaterialStatsProcessor(rules_path, verbose=verbose)
    
    input_files = list(input_path.glob("*.xlsx")) + list(input_path.glob("*.xls"))
    if not input_files:
        logger.error("错误: 输入目录中没有找到 Excel 文件")
        sys.exit(1)
    
    logger.info(f"找到 {len(input_files)} 个待处理文件")
    logger.info("")
    
    all_results = []
    for file in input_files:
        logger.info(f"处理文件: {file.name}")
        try:
            results = processor.process_file(file)
            all_results.extend(results)
            logger.info(f"  完成 - {len(results)} 条记录")
        except Exception as e:
            logger.error(f"  失败 - {str(e)}")
    
    logger.info("")
    logger.info("-" * 60)
    logger.info("统计汇总")
    logger.info("-" * 60)
    
    stats = processor.get_statistics()
    logger.info(f"总记录数: {stats['total_records']}")
    logger.info(f"班级改名记录: {stats['class_renamed']}")
    logger.info(f"套装拆分记录: {stats['set_split']}")
    logger.info(f"格式错误记录: {stats['format_errors']}")
    logger.info(f"正常记录: {stats['normal_records']}")
    
    if preview:
        logger.info("")
        logger.info("预览模式 - 不生成输出文件")
        return
    
    if not output_path.exists():
        output_path.mkdir(parents=True)
    
    reporter = ReportGenerator(output_path)
    reporter.generate_all_reports(all_results, stats, processor.errors)
    
    logger.info("")
    logger.info(f"结果已输出到: {output_path.absolute()}")
    logger.info("")
    logger.info("处理完成!")


@main.command()
@click.option("--output-dir", "-o", required=True, type=click.Path(exists=True, file_okay=False), help="输出结果目录路径")
def report(output_dir):
    """查看已生成的统计报告"""
    output_path = Path(output_dir)
    
    report_file = output_path / "统计报告.txt"
    if not report_file.exists():
        logger.error(f"错误: 在 {output_path} 中没有找到统计报告")
        sys.exit(1)
    
    logger.info("=" * 60)
    logger.info("美术培训室画材缺料统计报告")
    logger.info("=" * 60)
    logger.info("")
    
    with open(report_file, "r", encoding="utf-8") as f:
        content = f.read()
        logger.info(content)


@main.command()
def sample():
    """生成示例数据和规则文件"""
    from .sample_data import generate_sample_data
    
    output_dir = Path("sample_data")
    if not output_dir.exists():
        output_dir.mkdir()
    
    generate_sample_data(output_dir)
    logger.info(f"示例数据已生成到: {output_dir.absolute()}")


if __name__ == "__main__":
    main()
