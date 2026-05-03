"""
命令行入口模块
"""

import os
import sys
from pathlib import Path
from typing import Optional

import click

from .io import read_all_files, write_qc_issues_csv
from .calibration import build_calibration_curves
from .quality_control import run_quality_control_analysis
from .anomaly_detection import run_anomaly_detection
from .report_export import generate_markdown_report, generate_html_trend_report
from .models import BatchData


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """法医毒物实验室质谱批次复核工具"""
    pass


@cli.command()
@click.option("--run-sequence", "-r", required=True, type=click.Path(exists=True),
              help="进样序列 CSV 文件路径")
@click.option("--calibration", "-c", required=True, type=click.Path(exists=True),
              help="校准配置 YAML 文件路径")
@click.option("--peak-table", "-p", required=True, type=click.Path(exists=True),
              help="峰表 CSV 文件路径")
@click.option("--chain-of-custody", "-k", required=True, type=click.Path(exists=True),
              help="交接记录 JSONL 文件路径")
@click.option("--output-dir", "-o", default=".", type=click.Path(),
              help="输出目录路径 (默认: 当前目录)")
@click.option("--qc-csv", default="qc_issues.csv",
              help="QC 问题 CSV 输出文件名 (默认: qc_issues.csv)")
@click.option("--report-md", default="toxicology_qc_report.md",
              help="Markdown 报告输出文件名 (默认: toxicology_qc_report.md)")
@click.option("--trend-html", default="peak_area_trend.html",
              help="峰面积趋势 HTML 输出文件名 (默认: peak_area_trend.html)")
@click.option("--verbose", "-v", is_flag=True, help="显示详细日志")
def analyze(
    run_sequence: str,
    calibration: str,
    peak_table: str,
    chain_of_custody: str,
    output_dir: str,
    qc_csv: str,
    report_md: str,
    trend_html: str,
    verbose: bool,
):
    """
    分析质谱批次数据，生成质量控制报告
    
    读取进样序列、校准配置、峰表和交接记录，执行完整的 QC 分析流程，
    包括: 校准曲线计算、内标漂移分析、质控样偏差检查、LOD/LOQ 命中检测,
    以及异常检测 (重复样本编号、交接断链、跨午夜进样)。
    """
    if verbose:
        click.echo("正在读取输入文件...")
    
    try:
        batch_data = read_all_files(
            run_sequence_path=run_sequence,
            calibration_path=calibration,
            peak_table_path=peak_table,
            chain_of_custody_path=chain_of_custody,
        )
    except FileNotFoundError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"读取文件时出错: {e}", err=True)
        sys.exit(1)
    
    if verbose:
        click.echo(f"  读取 {len(batch_data.run_sequence)} 个进样记录")
        click.echo(f"  读取 {len(batch_data.chain_of_custody)} 个样本的交接记录")
        click.echo("正在构建校准曲线...")
    
    from .io import read_calibration_config
    calibration_config = read_calibration_config(calibration)
    
    calibration_curves = build_calibration_curves(batch_data, calibration_config)
    batch_data.calibration_curves = calibration_curves
    
    if verbose:
        click.echo(f"  构建了 {len(calibration_curves)} 条校准曲线")
        click.echo("正在运行质量控制分析...")
    
    batch_data = run_quality_control_analysis(batch_data, calibration_curves, calibration_config)
    
    if verbose:
        click.echo("正在运行异常检测...")
    
    anomaly_config = calibration_config.get("anomaly_detection", {})
    batch_data = run_anomaly_detection(batch_data, anomaly_config)
    
    total_issues = len(batch_data.qc_issues)
    critical_issues = sum(1 for i in batch_data.qc_issues if i.severity == "critical")
    high_issues = sum(1 for i in batch_data.qc_issues if i.severity == "high")
    
    click.echo(f"\n分析完成! 共发现 {total_issues} 个问题")
    click.echo(f"  严重: {critical_issues}")
    click.echo(f"  高: {high_issues}")
    click.echo(f"  中/低: {total_issues - critical_issues - high_issues}")
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    qc_csv_path = output_path / qc_csv
    if verbose:
        click.echo(f"\n正在写入 QC 问题 CSV: {qc_csv_path}")
    write_qc_issues_csv(batch_data.qc_issues, str(qc_csv_path))
    
    report_md_path = output_path / report_md
    if verbose:
        click.echo(f"正在生成 Markdown 报告: {report_md_path}")
    generate_markdown_report(batch_data, calibration_curves, str(report_md_path))
    
    trend_html_path = output_path / trend_html
    if verbose:
        click.echo(f"正在生成 HTML 趋势图: {trend_html_path}")
    generate_html_trend_report(batch_data, calibration_curves, str(trend_html_path))
    
    click.echo(f"\n输出文件已生成:")
    click.echo(f"  - {qc_csv_path}")
    click.echo(f"  - {report_md_path}")
    click.echo(f"  - {trend_html_path}")
    
    if critical_issues > 0:
        sys.exit(2)
    elif high_issues > 0:
        sys.exit(1)


@cli.command()
@click.option("--output-dir", "-o", default="sample_data", type=click.Path(),
              help="示例数据输出目录 (默认: sample_data)")
@click.option("--anomaly-type", type=click.Choice(["all", "is_missing", "chain_break", "normal"]),
              default="all", help="生成哪种类型的示例数据 (默认: all)")
def generate_samples(output_dir: str, anomaly_type: str):
    """
    生成示例数据用于演示
    
    可生成正常数据和包含异常的样例数据 (缺内标、乱序交接等)
    """
    from .sample_data import generate_sample_batch, SampleType
    
    output_path = Path(output_dir)
    
    if anomaly_type in ["all", "normal"]:
        normal_dir = output_path / "normal"
        normal_dir.mkdir(parents=True, exist_ok=True)
        click.echo(f"正在生成正常示例数据: {normal_dir}")
        generate_sample_batch(str(normal_dir), has_is_missing=False, has_chain_break=False)
    
    if anomaly_type in ["all", "is_missing"]:
        is_missing_dir = output_path / "is_missing"
        is_missing_dir.mkdir(parents=True, exist_ok=True)
        click.echo(f"正在生成缺内标异常数据: {is_missing_dir}")
        generate_sample_batch(str(is_missing_dir), has_is_missing=True, has_chain_break=False)
    
    if anomaly_type in ["all", "chain_break"]:
        chain_break_dir = output_path / "chain_break"
        chain_break_dir.mkdir(parents=True, exist_ok=True)
        click.echo(f"正在生成乱序交接异常数据: {chain_break_dir}")
        generate_sample_batch(str(chain_break_dir), has_is_missing=False, has_chain_break=True)
    
    click.echo(f"\n示例数据已生成到: {output_path}")
    click.echo("\n使用示例:")
    click.echo("  toxicology-qc analyze -r sample_data/normal/run_sequence.csv \\")
    click.echo("                       -c sample_data/normal/calibration.yaml \\")
    click.echo("                       -p sample_data/normal/peak_table.csv \\")
    click.echo("                       -k sample_data/normal/chain_of_custody.jsonl \\")
    click.echo("                       -o output_normal")


def main():
    cli()


if __name__ == "__main__":
    main()
