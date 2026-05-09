import os
import click

from freight_audit.config import load_config
from freight_audit.context import Context
from freight_audit.commands import init, import_shipments, audit, report, history, export


@click.group()
@click.option('--project-dir', '-d', default=None, help='项目目录，默认为当前目录')
@click.pass_context
def cli(ctx, project_dir):
    """异常运费巡检 CLI 工具
    
    用于检测同一批物流单多次修改后的运费差异
    """
    ctx.obj = Context()
    if project_dir:
        ctx.obj.project_dir = os.path.abspath(project_dir)
    ctx.obj.config = load_config(ctx.obj.project_dir)


cli.add_command(init.init)
cli.add_command(import_shipments.import_shipments)
cli.add_command(audit.audit)
cli.add_command(report.report)
cli.add_command(history.history)
cli.add_command(export.export)


if __name__ == '__main__':
    cli()
