#!/usr/bin/env python3
import click
from src.commands.archive import archive
from src.commands.plan import plan
from src.commands.check import check


@click.group()
@click.version_option("1.0.0", prog_name="grain-fumigation-check")
def cli():
    """
    粮仓熏蒸安全检查 CLI

    工作流程:
      archive import → plan import → check run → check dashboard

    三个核心模块:
      archive: 粮仓档案管理
      plan:    熏蒸计划管理
      check:   安全核对与报告
    """
    pass


cli.add_command(archive)
cli.add_command(plan)
cli.add_command(check)


if __name__ == "__main__":
    cli()
