import click
from kbcheck.commands.init import init
from kbcheck.commands.import_cmd import import_cmd
from kbcheck.commands.check import check
from kbcheck.commands.detail import detail
from kbcheck.commands.report import report

@click.group()
@click.version_option()
def cli():
    """知识库失效链接检查工具"""
    pass

cli.add_command(init)
cli.add_command(import_cmd)
cli.add_command(check)
cli.add_command(detail)
cli.add_command(report)

if __name__ == "__main__":
    cli()
