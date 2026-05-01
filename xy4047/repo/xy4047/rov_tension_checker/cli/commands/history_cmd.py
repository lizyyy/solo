"""history 命令"""

import click
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from rov_tension_checker.config.manager import ConfigManager
from rov_tension_checker.storage.repository import AnalysisRepository


def parse_date(value: str) -> Optional[date]:
    if not value:
        return None
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise click.BadParameter(f"无法解析日期: {value}")


@click.command()
@click.option('--pipeline', '-p', default=None, help='按管线编号筛选')
@click.option('--date-from', '-f', default=None, help='开始日期 (格式: YYYY-MM-DD)')
@click.option('--date-to', '-t', default=None, help='结束日期 (格式: YYYY-MM-DD)')
@click.option('--critical/--no-critical', default=None, help='只显示有/无关键风险的记录')
@click.option('--limit', '-l', default=20, help='显示记录数量限制 (默认 20)')
@click.option('--detail', '-d', is_flag=True, help='显示详细信息')
@click.option('--working-dir', '-w', default=None, help='工作目录')
def history(
    pipeline: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    critical: Optional[bool],
    limit: int,
    detail: bool,
    working_dir: Optional[str]
):
    """查询历史分析记录
    
    可以按作业日期、管线编号或风险状态查询历史分析。
    """
    config_manager = ConfigManager(working_dir)
    
    if not config_manager.config_exists():
        click.echo(click.style("❌ 项目未初始化", fg='red'))
        return
    
    config = config_manager.load_config()
    base_path = Path(working_dir or '.') / config.output_directory
    repo = AnalysisRepository(str(base_path))
    
    start_date = parse_date(date_from) if date_from else None
    end_date = parse_date(date_to) if date_to else None
    
    click.echo("查询历史分析记录...")
    click.echo("-" * 50)
    
    if pipeline:
        click.echo(f"管线编号: {pipeline}")
    if start_date:
        click.echo(f"开始日期: {start_date}")
    if end_date:
        click.echo(f"结束日期: {end_date}")
    if critical is not None:
        click.echo(f"关键风险: {'有' if critical else '无'}")
    
    click.echo("")
    
    analyses = repo.query_analyses(
        pipeline_id=pipeline,
        survey_date_start=start_date,
        survey_date_end=end_date,
        has_critical_risks=critical
    )
    
    if not analyses:
        click.echo(click.style("没有找到匹配的历史记录", fg='yellow'))
        return
    
    display_count = min(limit, len(analyses))
    click.echo(f"找到 {len(analyses)} 条记录，显示前 {display_count} 条:")
    click.echo("")
    
    for i, ana in enumerate(analyses[:display_count], 1):
        try:
            created_at = datetime.fromisoformat(ana['created_at'])
            survey_date = datetime.fromisoformat(ana['survey_date'])
        except (ValueError, TypeError):
            created_at = None
            survey_date = None
        
        critical_count = ana.get('critical_risk_count', 0)
        warning_count = ana.get('warning_risk_count', 0)
        
        risk_status = ""
        if critical_count > 0:
            risk_status = click.style(f"🔴 {critical_count} 关键", fg='red')
        elif warning_count > 0:
            risk_status = click.style(f"🟡 {warning_count} 预警", fg='yellow')
        else:
            risk_status = click.style("✅ 无风险", fg='green')
        
        click.echo(f"[{i}] 分析 ID: {ana.get('analysis_id', 'N/A')}")
        click.echo(f"    项目: {ana.get('project_name', 'N/A')}")
        click.echo(f"    管线: {ana.get('pipeline_id', 'N/A')}")
        click.echo(f"    作业日期: {survey_date.strftime('%Y-%m-%d') if survey_date else 'N/A'}")
        click.echo(f"    分析时间: {created_at.strftime('%Y-%m-%d %H:%M') if created_at else 'N/A'}")
        click.echo(f"    采样点: {ana.get('sample_count', 0)}")
        click.echo(f"    风险状态: {risk_status}")
        
        if detail:
            click.echo(f"    文件名: {ana.get('filename', 'N/A')}")
        
        click.echo("")
    
    if len(analyses) > display_count:
        click.echo(click.style(f"... 还有 {len(analyses) - display_count} 条记录", fg='cyan'))
        click.echo(click.style(f"使用 --limit {len(analyses)} 查看全部", fg='cyan'))
    
    return analyses
