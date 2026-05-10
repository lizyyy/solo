import click
import json
from drill_service.storage import Storage
from drill_service.services import DrillService, TrafficService


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def main(ctx, data_dir):
    ctx.ensure_object(dict)
    storage = Storage(data_dir)
    ctx.obj["storage"] = storage
    ctx.obj["drill_service"] = DrillService(storage)
    ctx.obj["traffic_service"] = TrafficService(storage)


@main.group()
def region():
    pass


@region.command("init")
@click.argument("names", nargs=-1)
@click.pass_context
def region_init(ctx, names):
    traffic_service = ctx.obj["traffic_service"]
    regions = traffic_service.initialize_regions(list(names))
    click.echo(f"已初始化 {len(regions)} 个区域:")
    for r in regions:
        click.echo(f"  - {r.name}: {r.status.value}, 权重={r.traffic_weight}%")


@region.command("list")
@click.pass_context
def region_list(ctx):
    traffic_service = ctx.obj["traffic_service"]
    regions = traffic_service.list_regions()
    for r in regions:
        click.echo(f"{r.name}: status={r.status.value}, weight={r.traffic_weight}%, readonly={r.is_read_only}")


@region.command("set-readonly")
@click.argument("name")
@click.argument("value", type=bool)
@click.pass_context
def region_set_readonly(ctx, name, value):
    traffic_service = ctx.obj["traffic_service"]
    region = traffic_service.set_region_readonly(name, value)
    click.echo(f"区域 {name} 只读模式已设置为 {region.is_read_only}")


@main.group()
def plan():
    pass


@plan.command("create")
@click.option("--name", required=True)
@click.option("--source", required=True)
@click.option("--target", required=True)
@click.option("--operator", required=True)
@click.option("--description", default="")
@click.pass_context
def plan_create(ctx, name, source, target, operator, description):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.create_plan(name, source, target, operator, description)
    click.echo(f"创建演练计划: plan_id={plan.plan_id}")
    click.echo(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))


@plan.command("list")
@click.pass_context
def plan_list(ctx):
    drill_service = ctx.obj["drill_service"]
    plans = drill_service.list_plans()
    for p in plans:
        click.echo(f"{p.plan_id}: {p.name}, 源={p.source_region}, 目标={p.target_region}, 状态={p.status.value}, 进度={p.current_step}/{p.total_steps}")


@plan.command("show")
@click.argument("plan_id")
@click.pass_context
def plan_show(ctx, plan_id):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.get_plan(plan_id)
    if plan is None:
        click.echo(f"计划 {plan_id} 不存在")
        return
    click.echo(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))


@plan.command("start")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.pass_context
def plan_start(ctx, plan_id, operator):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.start_drill(plan_id, operator)
    click.echo(f"演练已启动，当前状态: {plan.status.value}, 进度: {plan.current_step}/{plan.total_steps}")


@plan.command("warmup")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.option("--percent", type=int, default=10)
@click.pass_context
def plan_warmup(ctx, plan_id, operator, percent):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.advance_to_traffic_warmup(plan_id, operator)
    plan, switch_info = drill_service.execute_traffic_warmup(plan_id, operator, percent)
    click.echo(f"流量预热完成，当前状态: {plan.status.value}, 进度: {plan.current_step}/{plan.total_steps}")
    click.echo(f"流量分配: {switch_info['traffic_weights']}")


@plan.command("check-readonly")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.pass_context
def plan_check_readonly(ctx, plan_id, operator):
    drill_service = ctx.obj["drill_service"]
    ok, msg = drill_service.validate_readonly(plan_id, operator)
    if ok:
        click.echo(f"只读校验通过: {msg}")
    else:
        click.echo(f"只读校验失败: {msg}")


@plan.command("switch")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.pass_context
def plan_switch(ctx, plan_id, operator):
    drill_service = ctx.obj["drill_service"]
    plan, switch_info = drill_service.execute_full_switch(plan_id, operator)
    click.echo(f"流量切换完成，当前状态: {plan.status.value}, 进度: {plan.current_step}/{plan.total_steps}")
    click.echo(f"流量分配: {switch_info['traffic_weights']}")


@plan.command("request-rollback")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.option("--reason", required=True)
@click.pass_context
def plan_request_rollback(ctx, plan_id, operator, reason):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.request_rollback(plan_id, operator, reason)
    click.echo(f"回切请求已提交，当前状态: {plan.status.value}")


@plan.command("execute-rollback")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.pass_context
def plan_execute_rollback(ctx, plan_id, operator):
    drill_service = ctx.obj["drill_service"]
    plan, switch_info = drill_service.execute_rollback(plan_id, operator)
    click.echo(f"回切执行完成，当前状态: {plan.status.value}")
    click.echo(f"流量分配: {switch_info['traffic_weights']}")


@plan.command("confirm-rollback")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.pass_context
def plan_confirm_rollback(ctx, plan_id, operator):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.confirm_rollback(plan_id, operator)
    click.echo(f"回切确认完成，当前状态: {plan.status.value}")


@plan.command("complete")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.pass_context
def plan_complete(ctx, plan_id, operator):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.complete_switch(plan_id, operator)
    click.echo(f"切换流程完成，当前状态: {plan.status.value}, 进度: {plan.current_step}/{plan.total_steps}")


@plan.command("supplement")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.option("--info", required=True)
@click.pass_context
def plan_supplement(ctx, plan_id, operator, info):
    drill_service = ctx.obj["drill_service"]
    drill_service.supplement_info(plan_id, operator, info)
    click.echo("补录信息已添加")


@plan.command("withdraw")
@click.argument("plan_id")
@click.argument("history_id")
@click.option("--operator", required=True)
@click.option("--reason", required=True)
@click.pass_context
def plan_withdraw(ctx, plan_id, history_id, operator, reason):
    drill_service = ctx.obj["drill_service"]
    drill_service.withdraw_operation(plan_id, history_id, operator, reason)
    click.echo("操作已撤回")


@plan.command("history")
@click.argument("plan_id")
@click.pass_context
def plan_history(ctx, plan_id):
    drill_service = ctx.obj["drill_service"]
    history = drill_service.get_plan_history(plan_id)
    for h in history:
        withdrawn = " [已撤回]" if h.get("is_withdrawn") else ""
        click.echo(f"{h['timestamp']} - {h['operation_type']} by {h['operator']}: {h['details']}{withdrawn}")


@plan.command("report")
@click.argument("plan_id")
@click.pass_context
def plan_report(ctx, plan_id):
    drill_service = ctx.obj["drill_service"]
    report = drill_service.generate_report(plan_id)
    click.echo(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))


@plan.command("cancel")
@click.argument("plan_id")
@click.option("--operator", required=True)
@click.option("--reason", required=True)
@click.pass_context
def plan_cancel(ctx, plan_id, operator, reason):
    drill_service = ctx.obj["drill_service"]
    plan = drill_service.cancel_drill(plan_id, operator, reason)
    click.echo(f"演练已取消，状态: {plan.status.value}")


if __name__ == "__main__":
    main()
