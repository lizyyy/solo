"""命令行接口"""

from pathlib import Path
from typing import Optional

import click

from .models import IssueType
from .service import AuditService


@click.group()
@click.version_option(version='0.1.0', prog_name='report-audit')
@click.pass_context
def cli(ctx):
    """本地经营周报一致性复核工具
    
    用于连锁咖啡运营在发周报前进行数据一致性复核。
    """
    ctx.ensure_object(dict)
    ctx.obj['service'] = AuditService()


@cli.command()
@click.option('--orders', '-o', required=True, type=click.Path(exists=True),
              help='订单数据 CSV 文件路径')
@click.option('--refunds', '-r', required=True, type=click.Path(exists=True),
              help='退款数据 CSV 文件路径')
@click.option('--labor-costs', '-l', required=True, type=click.Path(exists=True),
              help='人工成本 CSV 文件路径')
@click.option('--metric-rules', '-m', required=True, type=click.Path(exists=True),
              help='指标规则 YAML 文件路径')
@click.option('--report', '-rp', required=True, type=click.Path(exists=True),
              help='待验证的报告文件 (.md 或 .json)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
@click.pass_context
def validate(ctx, orders, refunds, labor_costs, metric_rules, report, verbose):
    """验证报告数据一致性
    
    读取业务数据和待验证的报告，进行一致性复核并输出结果。
    """
    service = ctx.obj['service']
    
    click.echo('📋 正在加载数据...')
    
    try:
        result = service.audit(
            Path(orders),
            Path(refunds),
            Path(labor_costs),
            Path(metric_rules),
            Path(report),
        )
        
        stats = service.get_statistics()
        
        click.echo(f'✅ 数据加载完成')
        click.echo(f'   - 门店数量: {stats["store_count"]}')
        click.echo(f'   - 订单数量: {stats["order_count"]}')
        click.echo(f'   - 退款数量: {stats["refund_count"]}')
        click.echo(f'   - 报告类型: {stats["report_type"]}')
        click.echo('')
        
        click.echo('🔍 验证结果:')
        click.echo('-' * 50)
        
        if result.is_valid:
            click.echo(click.style('✅ 验证通过！', fg='green'))
        else:
            click.echo(click.style('❌ 验证失败，发现问题！', fg='red'))
        
        click.echo(f'   总问题数: {result.total_issues}')
        click.echo(f'   严重问题: {result.critical_issues}')
        click.echo(f'   警告问题: {result.warning_issues}')
        click.echo('')
        
        if result.issues:
            click.echo('📝 问题详情:')
            click.echo('-' * 50)
            
            for issue in result.issues:
                severity = '🔴' if issue.issue_type in [
                    IssueType.TOLERANCE_EXCEEDED,
                    IssueType.MISSING_REFUND_DEDUCTION,
                    IssueType.STORE_AGGREGATION_ERROR,
                ] else '🟡'
                
                click.echo(f'{severity} [{issue.issue_type.value}] {issue.message}')
                
                if verbose:
                    if issue.expected_value is not None:
                        click.echo(f'   计算值: {issue.expected_value}')
                    if issue.reported_value is not None:
                        click.echo(f'   报告值: {issue.reported_value}')
                    if issue.difference is not None:
                        click.echo(f'   差异: {issue.difference}')
                    if issue.store_id:
                        click.echo(f'   门店: {issue.store_id}')
                    if issue.context:
                        click.echo(f'   上下文: {issue.context}')
                    click.echo('')
        
        if result.is_valid:
            ctx.exit(0)
        else:
            ctx.exit(1)
            
    except Exception as e:
        click.echo(click.style(f'❌ 错误: {str(e)}', fg='red'), err=True)
        ctx.exit(2)


@cli.command()
@click.option('--orders', '-o', required=True, type=click.Path(exists=True),
              help='订单数据 CSV 文件路径')
@click.option('--refunds', '-r', required=True, type=click.Path(exists=True),
              help='退款数据 CSV 文件路径')
@click.option('--labor-costs', '-l', required=True, type=click.Path(exists=True),
              help='人工成本 CSV 文件路径')
@click.option('--metric-rules', '-m', required=True, type=click.Path(exists=True),
              help='指标规则 YAML 文件路径')
@click.option('--report', '-rp', required=True, type=click.Path(exists=True),
              help='待验证的报告文件 (.md 或 .json)')
@click.option('--output-dir', '-od', default='.', type=click.Path(),
              help='输出目录 (默认: 当前目录)')
@click.option('--name', '-n', default='audit_result', help='输出文件名前缀 (默认: audit_result)')
@click.pass_context
def audit(ctx, orders, refunds, labor_costs, metric_rules, report, output_dir, name):
    """执行完整审计并生成报告
    
    执行完整的一致性复核流程，并导出 Markdown 差异报告和 CSV 明细。
    """
    service = ctx.obj['service']
    
    click.echo('📋 开始审计流程...')
    
    try:
        result = service.audit(
            Path(orders),
            Path(refunds),
            Path(labor_costs),
            Path(metric_rules),
            Path(report),
        )
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        md_path = output_path / f'{name}.md'
        csv_path = output_path / f'{name}_issues.csv'
        metrics_path = output_path / f'{name}_metrics.csv'
        
        service.export_markdown_report(md_path)
        service.export_csv_report(csv_path)
        service.export_metrics_comparison(metrics_path)
        
        click.echo('✅ 审计完成！')
        click.echo('')
        click.echo('📊 结果摘要:')
        click.echo(f'   状态: {"✅ 通过" if result.is_valid else "❌ 存在问题"}')
        click.echo(f'   总问题数: {result.total_issues}')
        click.echo(f'   严重问题: {result.critical_issues}')
        click.echo(f'   警告问题: {result.warning_issues}')
        click.echo('')
        click.echo('📁 生成的文件:')
        click.echo(f'   - Markdown 报告: {md_path}')
        click.echo(f'   - 问题明细 CSV: {csv_path}')
        click.echo(f'   - 指标对比 CSV: {metrics_path}')
        
        if result.is_valid:
            ctx.exit(0)
        else:
            ctx.exit(1)
            
    except Exception as e:
        click.echo(click.style(f'❌ 错误: {str(e)}', fg='red'), err=True)
        ctx.exit(2)


@cli.command()
@click.option('--orders', '-o', required=True, type=click.Path(exists=True),
              help='订单数据 CSV 文件路径')
@click.option('--refunds', '-r', required=True, type=click.Path(exists=True),
              help='退款数据 CSV 文件路径')
@click.option('--labor-costs', '-l', required=True, type=click.Path(exists=True),
              help='人工成本 CSV 文件路径')
@click.option('--metric-rules', '-m', required=True, type=click.Path(exists=True),
              help='指标规则 YAML 文件路径')
@click.option('--report', '-rp', required=True, type=click.Path(exists=True),
              help='待验证的报告文件 (.md 或 .json)')
@click.option('--format', '-f', 'fmt', type=click.Choice(['markdown', 'csv', 'both']),
              default='both', help='导出格式 (markdown/csv/both, 默认: both)')
@click.option('--output', '-o', 'output_path', required=True, type=click.Path(),
              help='输出路径 (如果是目录则自动生成文件名)')
@click.pass_context
def export(ctx, orders, refunds, labor_costs, metric_rules, report, fmt, output_path):
    """导出验证报告
    
    执行验证并导出指定格式的报告。
    """
    service = ctx.obj['service']
    
    click.echo('📋 正在导出报告...')
    
    try:
        result = service.audit(
            Path(orders),
            Path(refunds),
            Path(labor_costs),
            Path(metric_rules),
            Path(report),
        )
        
        output = Path(output_path)
        
        if output.is_dir():
            output.mkdir(parents=True, exist_ok=True)
            md_path = output / 'audit_report.md'
            csv_path = output / 'audit_issues.csv'
        else:
            base = output.parent
            base.mkdir(parents=True, exist_ok=True)
            stem = output.stem
            md_path = base / f'{stem}.md'
            csv_path = base / f'{stem}.csv'
        
        if fmt in ['markdown', 'both']:
            service.export_markdown_report(md_path)
            click.echo(f'✅ Markdown 报告已导出: {md_path}')
        
        if fmt in ['csv', 'both']:
            service.export_csv_report(csv_path)
            click.echo(f'✅ CSV 明细已导出: {csv_path}')
        
        click.echo('')
        click.echo('📊 验证结果:')
        click.echo(f'   状态: {"✅ 通过" if result.is_valid else "❌ 存在问题"}')
        click.echo(f'   总问题数: {result.total_issues}')
        
        if result.is_valid:
            ctx.exit(0)
        else:
            ctx.exit(1)
            
    except Exception as e:
        click.echo(click.style(f'❌ 错误: {str(e)}', fg='red'), err=True)
        ctx.exit(2)


@cli.command()
@click.option('--host', '-h', default='127.0.0.1', help='绑定主机 (默认: 127.0.0.1)')
@click.option('--port', '-p', default=8000, type=int, help='端口 (默认: 8000)')
@click.option('--reload', is_flag=True, help='自动重载 (开发模式)')
def api(host, port, reload):
    """启动本地 API 服务器
    
    启动一个轻量的本地 API 服务，支持上传文件进行复核。
    """
    import uvicorn
    
    click.echo(f'🚀 启动 API 服务器: http://{host}:{port}')
    click.echo('📚 API 文档:')
    click.echo(f'   - Swagger UI: http://{host}:{port}/docs')
    click.echo(f'   - ReDoc: http://{host}:{port}/redoc')
    click.echo('')
    click.echo('按 Ctrl+C 停止服务器')
    
    uvicorn.run(
        'audit_tool.api:app',
        host=host,
        port=port,
        reload=reload,
    )


if __name__ == '__main__':
    cli()
