import click
from .commands.init_cmd import init
from .commands.import_cmd import import_cmd
from .commands.check_cmd import check, list_tasks, retry_task
from .commands.fix_cmd import fix, recheck
from .commands.report_cmd import report, list_batches
from .commands.history_cmd import history
from .commands.export_cmd import export

@click.group()
@click.version_option(version='1.0.0')
def cli():
    """乡镇药房近效期多源导入巡检 CLI 工具"""
    pass

cli.add_command(init)
cli.add_command(import_cmd)
cli.add_command(check)
cli.add_command(fix)
cli.add_command(report)
cli.add_command(history)
cli.add_command(export)
cli.add_command(list_tasks)
cli.add_command(list_batches)
cli.add_command(recheck)
cli.add_command(retry_task)

if __name__ == '__main__':
    cli()
