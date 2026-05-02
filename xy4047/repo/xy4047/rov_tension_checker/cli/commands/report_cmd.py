"""report 命令"""

import click
from datetime import datetime
from pathlib import Path
from typing import Optional

from rov_tension_checker.config.manager import ConfigManager
from rov_tension_checker.report.csv_exporter import CSVExporter
from rov_tension_checker.report.json_auditor import JSONAuditor
from rov_tension_checker.report.markdown import MarkdownReporter
from rov_tension_checker.storage.repository import AnalysisRepository


@click.command()
@click.option('--analysis-id', '-a', help='分析ID（默认为最新分析）')
@click.option('--output-dir', '-o', default=None, help='输出目录')
@click.option('--format', '-f', 'formats', multiple=True,
              default=['markdown', 'csv', 'json'],
              type=click.Choice(['markdown', 'csv', 'json', 'all'], case_sensitive=False),
              help='输出格式')
@click.option('--working-dir', '-w', default=None, help='工作目录')
@click.option('--name', '-n', default=None, help='报告文件名前缀')
def report(
    analysis_id: Optional[str],
    output_dir: Optional[str],
    formats: tuple,
    working_dir: Optional[str],
    name: Optional[str]
):
    """导出分析报告
    
    支持三种导出格式：
    - markdown: Markdown 作业复盘报告
    - csv: CSV 风险点清单和时间序列数据
    - json: JSON 计算审计包（完整分析数据）
    
    使用 'all' 导出所有格式。
    """
    config_manager = ConfigManager(working_dir)
    
    if not config_manager.config_exists():
        click.echo(click.style("❌ 项目未初始化", fg='red'))
        return
    
    config = config_manager.load_config()
    base_path = Path(working_dir or '.') / config.output_directory
    repo = AnalysisRepository(str(base_path))
    
    if analysis_id:
        analysis = repo.load_analysis(analysis_id)
    else:
        analysis = repo.get_latest_analysis()
    
    if not analysis:
        if analysis_id:
            click.echo(click.style(f"❌ 未找到分析: {analysis_id}", fg='red'))
        else:
            click.echo(click.style("❌ 没有找到分析记录", fg='red'))
        click.echo("请先运行 'rov-tension analyze' 执行分析")
        return
    
    click.echo(f"使用分析: {analysis.analysis_id}")
    click.echo(f"项目: {analysis.project_name}")
    click.echo(f"管线: {analysis.pipeline_id}")
    click.echo("")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_prefix = name or f"report_{analysis.pipeline_id}_{timestamp}"
    
    out_dir = Path(output_dir) if output_dir else base_path
    out_dir.mkdir(parents=True, exist_ok=True)
    
    actual_formats = list(formats)
    if 'all' in actual_formats:
        actual_formats = ['markdown', 'csv', 'json']
    
    click.echo(f"导出格式: {', '.join(actual_formats)}")
    click.echo(f"输出目录: {out_dir}")
    click.echo("")
    
    exported_files = []
    
    if 'markdown' in actual_formats:
        click.echo("正在导出 Markdown 报告...")
        reporter = MarkdownReporter()
        md_path = out_dir / f"{file_prefix}.md"
        reporter.save_report(analysis, str(md_path))
        click.echo(click.style(f"  ✓ {md_path}", fg='green'))
        exported_files.append(str(md_path))
    
    if 'csv' in actual_formats:
        click.echo("正在导出 CSV 文件...")
        exporter = CSVExporter()
        
        risks_path = out_dir / f"{file_prefix}_risks.csv"
        exporter.export_risks(analysis, str(risks_path))
        click.echo(click.style(f"  ✓ 风险清单: {risks_path}", fg='green'))
        exported_files.append(str(risks_path))
        
        series_path = out_dir / f"{file_prefix}_timeseries.csv"
        exporter.export_timeseries(analysis, str(series_path))
        click.echo(click.style(f"  ✓ 时间序列: {series_path}", fg='green'))
        exported_files.append(str(series_path))
    
    if 'json' in actual_formats:
        click.echo("正在导出 JSON 审计包...")
        auditor = JSONAuditor()
        
        full_path = out_dir / f"{file_prefix}_audit.json"
        auditor.export_audit(analysis, str(full_path), include_samples=True)
        click.echo(click.style(f"  ✓ 完整审计: {full_path}", fg='green'))
        exported_files.append(str(full_path))
        
        minimal_path = out_dir / f"{file_prefix}_summary.json"
        auditor.export_minimal(analysis, str(minimal_path))
        click.echo(click.style(f"  ✓ 摘要: {minimal_path}", fg='green'))
        exported_files.append(str(minimal_path))
    
    click.echo("")
    click.echo(click.style("✓ 报告导出完成！", fg='green'))
    click.echo("")
    click.echo("导出的文件:")
    for f in exported_files:
        click.echo(f"  - {f}")
    
    return exported_files
