import click
import colorama

from .commands import DrCli
from .reporter import Reporter
from .utils import clear_state, load_state


colorama.init()


@click.group()
@click.option(
    "--plan",
    "-p",
    default="dr_plan.yaml",
    help="演练计划文件路径 (默认: dr_plan.yaml)",
)
@click.option(
    "--state-dir",
    "-s",
    default=".",
    help="状态文件存储目录 (默认: 当前目录)",
)
@click.option(
    "--fail-verify-rule",
    default=None,
    help="模拟指定验证规则失败，用于测试 (格式: rule_id)",
)
@click.pass_context
def cli(ctx: click.Context, plan: str, state_dir: str, fail_verify_rule: str):
    """容灾切换演练 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj["plan"] = plan
    ctx.obj["state_dir"] = state_dir
    ctx.obj["fail_verify_rule"] = fail_verify_rule


@cli.command()
@click.option("--force", "-f", is_flag=True, help="强制重新开始，清空旧状态")
@click.pass_context
def precheck(ctx: click.Context, force: bool):
    """执行演练前置检查"""
    dr = DrCli(
        plan_path=ctx.obj["plan"],
        state_dir=ctx.obj["state_dir"],
        fail_verify_rule=ctx.obj["fail_verify_rule"],
    )
    success = dr.precheck(force=force)
    ctx.exit(0 if success else 1)


@cli.command()
@click.pass_context
def switch(ctx: click.Context):
    """执行服务切换（主 -> 备）"""
    dr = DrCli(
        plan_path=ctx.obj["plan"],
        state_dir=ctx.obj["state_dir"],
        fail_verify_rule=ctx.obj["fail_verify_rule"],
    )
    success = dr.switch()
    ctx.exit(0 if success else 1)


@cli.command()
@click.option(
    "--skip",
    "-k",
    multiple=True,
    help="允许人工跳过的验证规则ID (可多次指定)",
)
@click.pass_context
def verify(ctx: click.Context, skip: tuple):
    """执行切换后验证"""
    dr = DrCli(
        plan_path=ctx.obj["plan"],
        state_dir=ctx.obj["state_dir"],
        fail_verify_rule=ctx.obj["fail_verify_rule"],
    )
    success = dr.verify(skip_rules=list(skip) if skip else None)
    ctx.exit(0 if success else 1)


@cli.command()
@click.pass_context
def rollback(ctx: click.Context):
    """执行回切操作（备 -> 主）"""
    dr = DrCli(
        plan_path=ctx.obj["plan"],
        state_dir=ctx.obj["state_dir"],
        fail_verify_rule=ctx.obj["fail_verify_rule"],
    )
    success = dr.rollback()
    ctx.exit(0 if success else 1)


@cli.command()
@click.option(
    "--output",
    "-o",
    default=None,
    help="报告输出文件路径 (默认: 标准输出)",
)
@click.pass_context
def report(ctx: click.Context, output: str):
    """生成演练复盘报告"""
    state = load_state(ctx.obj["state_dir"])
    if not state:
        click.echo("未找到演练状态，请先执行演练命令")
        ctx.exit(1)

    report_text = Reporter.generate_report(state, output_file=output)
    if not output:
        click.echo(report_text)
    else:
        click.echo(f"报告已生成: {output}")


@cli.command()
@click.pass_context
def reset(ctx: click.Context):
    """重置演练状态（删除状态文件）"""
    clear_state(ctx.obj["state_dir"])
    click.echo("演练状态已重置")


@cli.command()
@click.pass_context
def status(ctx: click.Context):
    """查看当前演练状态"""
    state = load_state(ctx.obj["state_dir"])
    if not state:
        click.echo("未找到演练状态")
        ctx.exit(0)

    from .models import SwitchStatus

    status_map = {
        SwitchStatus.NOT_STARTED: "未开始",
        SwitchStatus.PRECHECKING: "前置检查中",
        SwitchStatus.PRECHECK_FAILED: "前置检查失败",
        SwitchStatus.READY_TO_SWITCH: "准备切换",
        SwitchStatus.SWITCHING: "切换中",
        SwitchStatus.SWITCHED: "已切换",
        SwitchStatus.VERIFYING: "验证中",
        SwitchStatus.VERIFY_FAILED: "验证失败",
        SwitchStatus.COMPLETED: "已完成",
        SwitchStatus.ROLLING_BACK: "回切中",
        SwitchStatus.ROLLED_BACK: "已回切",
    }

    click.echo(f"演练计划: {state.plan_name}")
    click.echo(f"运行ID: {state.run_id}")
    click.echo(f"开始时间: {state.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo(f"当前状态: {status_map.get(state.current_status, state.current_status.value)}")
    click.echo(f"已执行步骤: {len(state.steps)}")


if __name__ == "__main__":
    cli()
