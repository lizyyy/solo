import click

from . import __version__
from .commands.init import init
from .commands.import_cmd import import_cmd
from .commands.check import check
from .commands.detail import detail
from .commands.report import report
from .commands.review import review, review_batch


@click.group()
@click.version_option(__version__)
def cli():
    """客服敏感话术抽检 CLI (CSQC)

    围绕质检团队从客服会话中抽检敏感话术、承诺赔付和未闭环问题。
    """
    pass


cli.add_command(init)
cli.add_command(import_cmd)
cli.add_command(check)
cli.add_command(detail)
cli.add_command(report)
cli.add_command(review)
cli.add_command(review_batch)


if __name__ == '__main__':
    cli()
