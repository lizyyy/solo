"""CLI 入口模块"""
import click
from pathlib import Path
import sys

from .parser import (
    parse_plate_layout,
    parse_ct_results,
    parse_controls,
    validate_ntc_presence,
    ParseError
)
from .rules import run_analysis
from .reporter import (
    export_markdown_report,
    export_issues_csv,
    export_heatmap_html
)


@click.command()
@click.option(
    '--plate-layout', '-p',
    required=True,
    type=click.Path(exists=True, dir_okay=False, readable=True),
    help='孔板布局 CSV 文件路径'
)
@click.option(
    '--ct-results', '-c',
    required=True,
    type=click.Path(exists=True, dir_okay=False, readable=True),
    help='Ct 结果 JSONL 文件路径'
)
@click.option(
    '--controls', '-k',
    required=True,
    type=click.Path(exists=True, dir_okay=False, readable=True),
    help='对照配置 YAML 文件路径'
)
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False, writable=True),
    default='.',
    help='输出目录 (默认: 当前目录)'
)
@click.option(
    '--report-name',
    type=str,
    default='review_report',
    help='报告文件名前缀 (默认: review_report)'
)
@click.option(
    '--verbose', '-v',
    is_flag=True,
    help='显示详细输出'
)
def main(plate_layout, ct_results, controls, output_dir, report_name, verbose):
    """
    qPCR 96孔板结果复核工具
    
    输入:
    - plate_layout.csv: 孔板布局，包含 well_id, sample_id, target, sample_type
    - ct_results.jsonl: Ct 结果，每行一个孔的 JSON 数据
    - controls.yaml: 对照配置，定义阳性对照、阴性对照、NTC 等
    
    输出:
    - review_report.md: 复核报告
    - issues.csv: 问题列表
    - plate_heatmap.html: 交互式热图
    """
    plate_layout_path = Path(plate_layout)
    ct_results_path = Path(ct_results)
    controls_path = Path(controls)
    output_path = Path(output_dir)
    
    try:
        output_path.mkdir(parents=True, exist_ok=True)
        
        if verbose:
            click.echo(f"正在解析孔板布局: {plate_layout_path}")
        
        wells = parse_plate_layout(plate_layout_path)
        
        if verbose:
            click.echo(f"共解析到 {len(wells)} 个孔位")
        
        if verbose:
            click.echo(f"正在解析 Ct 结果: {ct_results_path}")
        
        parse_ct_results(ct_results_path, wells)
        
        if verbose:
            click.echo(f"正在解析对照配置: {controls_path}")
        
        config = parse_controls(controls_path)
        
        if verbose:
            click.echo("正在验证 NTC 对照...")
        
        validate_ntc_presence(wells, config)
        
        if verbose:
            click.echo("正在执行分析...")
        
        result = run_analysis(wells, config)
        
        total_wells = len(wells)
        total_issues = len(result.all_issues)
        error_count = len([i for i in result.all_issues if i['severity'] == 'error'])
        warning_count = len([i for i in result.all_issues if i['severity'] == 'warning'])
        
        click.echo("\n" + "=" * 50)
        click.echo("分析完成!")
        click.echo("=" * 50)
        click.echo(f"总孔数: {total_wells}")
        click.echo(f"问题数: {total_issues} (错误: {error_count}, 警告: {warning_count})")
        click.echo(f"污染风险: {result.risk_assessment.contamination_risk.value.upper()}")
        click.echo(f"抑制风险: {result.risk_assessment.inhibition_risk.value.upper()}")
        
        report_md_path = output_path / f"{report_name}.md"
        if verbose:
            click.echo(f"\n正在导出报告: {report_md_path}")
        export_markdown_report(
            result, config, report_md_path,
            plate_layout_path, ct_results_path, controls_path
        )
        
        issues_csv_path = output_path / "issues.csv"
        if verbose:
            click.echo(f"正在导出问题列表: {issues_csv_path}")
        export_issues_csv(result, issues_csv_path)
        
        heatmap_path = output_path / "plate_heatmap.html"
        if verbose:
            click.echo(f"正在导出热图: {heatmap_path}")
        export_heatmap_html(result, config, heatmap_path)
        
        click.echo("\n输出文件:")
        click.echo(f"  - 报告: {report_md_path}")
        click.echo(f"  - 问题列表: {issues_csv_path}")
        click.echo(f"  - 热图: {heatmap_path}")
        
        if total_issues > 0:
            click.echo("\n警告: 检测到问题，请查看报告和问题列表!")
        
        if error_count > 0:
            sys.exit(1)
        elif warning_count > 0:
            sys.exit(0)
        else:
            sys.exit(0)
            
    except ParseError as e:
        click.echo(f"\n错误: {e}", err=True)
        sys.exit(2)
    except FileNotFoundError as e:
        click.echo(f"\n错误: 找不到文件 - {e}", err=True)
        sys.exit(2)
    except Exception as e:
        if verbose:
            import traceback
            traceback.print_exc()
        click.echo(f"\n错误: {e}", err=True)
        sys.exit(3)


if __name__ == '__main__':
    main()
