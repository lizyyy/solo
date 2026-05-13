import os
import click

from freight_audit.config import load_config, DEFAULT_CONFIG, compute_config_hash, config_diff
from freight_audit.context import Context
from freight_audit.commands import init, import_shipments, audit, report, history, export


def _show_config_status(context_obj: Context) -> None:
    """显示配置加载状态"""
    config, error = load_config(context_obj.project_dir, verbose=True)
    context_obj.config = config
    context_obj.config_error = error
    context_obj.config_hash = compute_config_hash(config)
    
    if error:
        click.echo(click.style(f'[警告] {error}', fg='yellow'))
    else:
        click.echo(f'[信息] 配置加载成功 (Hash: {context_obj.config_hash[:12]}...)')


def _detect_config_change(context_obj: Context) -> None:
    """检测配置变化并显示"""
    if not hasattr(context_obj, 'config'):
        return
    
    current_hash = compute_config_hash(context_obj.config)
    default_hash = compute_config_hash(DEFAULT_CONFIG)
    
    if current_hash != default_hash:
        diffs = config_diff(DEFAULT_CONFIG, context_obj.config)
        if diffs:
            click.echo(click.style('[信息] 检测到自定义配置:', fg='cyan'))
            for d in diffs:
                if d.startswith('+'):
                    click.echo(click.style(f'       {d}', fg='green'))
                elif d.startswith('-'):
                    click.echo(click.style(f'       {d}', fg='red'))
                else:
                    click.echo(click.style(f'       {d}', fg='yellow'))


@click.group()
@click.option('--project-dir', '-d', default=None, help='项目目录，默认为当前目录')
@click.option('--verbose', '-v', is_flag=True, help='显示详细配置信息')
@click.pass_context
def cli(ctx, project_dir, verbose):
    """异常运费巡检 CLI 工具
    
    用于检测同一批物流单多次修改后的运费差异
    """
    ctx.obj = Context()
    if project_dir:
        ctx.obj.project_dir = os.path.abspath(project_dir)
    
    _show_config_status(ctx.obj)
    
    if verbose:
        _detect_config_change(ctx.obj)


cli.add_command(init.init)
cli.add_command(import_shipments.import_shipments)
cli.add_command(audit.audit)
cli.add_command(report.report)
cli.add_command(history.history)
cli.add_command(export.export)


if __name__ == '__main__':
    cli()
