"""CLI 主入口"""

import click
import sys
from . import __version__
from .commands import (
    init_command,
    import_command,
    check_command,
    history_command,
    export_command,
)


@click.group()
@click.version_option(__version__, prog_name="rain-garden")
@click.pass_context
def cli(ctx):
    """社区雨水花园养护 CLI 工具

    用于管理雨水花园养护，包括降雨记录、积水记录、植物状态和志愿者巡查安排。
    """
    ctx.ensure_object(dict)
    pass


cli.add_command(init_command.init_cmd)
cli.add_command(import_command.import_cmd)
cli.add_command(check_command.check_cmd)
cli.add_command(history_command.history_cmd)
cli.add_command(export_command.export_cmd)


def main():
    try:
        cli()
    except KeyboardInterrupt:
        click.echo("\n操作已取消")
        sys.exit(1)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
