import click
from datetime import date, datetime
from typing import Optional

from .service import MedicationService
from .store import DataStore
from .reports import ReportExporter
from .models import MedicationStatus, ChangeStatus


def get_service():
    return MedicationService()


@click.group()
@click.version_option()
def cli():
    """宠物店喂药计划班次确认变更留痕排查系统"""
    pass


@cli.group()
def pet():
    """宠物档案管理"""
    pass


@pet.command("create")
@click.option("--name", required=True, help="宠物名称")
@click.option("--type", "pet_type", required=True, type=click.Choice(["dog", "cat", "bird", "other"]), help="宠物类型")
@click.option("--owner", required=True, help="主人姓名")
@click.option("--phone", required=True, help="主人电话")
@click.option("--breed", help="品种")
@click.option("--age", type=float, help="年龄")
@click.option("--weight", type=float, help="体重(kg)")
def create_pet(name, pet_type, owner, phone, breed, age, weight):
    """创建宠物档案"""
    service = get_service()
    kwargs = {}
    if breed:
        kwargs["breed"] = breed
    if age:
        kwargs["age"] = age
    if weight:
        kwargs["weight_kg"] = weight
    
    pet = service.create_pet(name, pet_type, owner, phone, **kwargs)
    click.echo(f"✅ 宠物档案创建成功: {pet.pet_id}")


@pet.command("list")
def list_pets():
    """列出所有宠物"""
    service = get_service()
    pets = service.store.get_all_pets()
    if not pets:
        click.echo("无宠物档案")
        return
    
    for p in pets:
        click.echo(f"{p['pet_id']}: {p['name']} ({p['type']}) - 主人: {p['owner_name']}")


@cli.group()
def order():
    """寄养订单管理"""
    pass


@order.command("create")
@click.option("--pet-id", required=True, help="宠物ID")
@click.option("--checkin", required=True, help="入住日期 (YYYY-MM-DD)")
@click.option("--checkout", required=True, help="退房日期 (YYYY-MM-DD)")
@click.option("--room", help="房间号")
def create_order(pet_id, checkin, checkout, room):
    """创建寄养订单"""
    service = get_service()
    checkin_date = date.fromisoformat(checkin)
    checkout_date = date.fromisoformat(checkout)
    kwargs = {"room_number": room} if room else {}
    
    try:
        order = service.create_order(pet_id, checkin_date, checkout_date, **kwargs)
        click.echo(f"✅ 寄养订单创建成功: {order.order_id}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")


@order.command("list")
def list_orders():
    """列出所有订单"""
    service = get_service()
    orders = service.store.get_all_orders()
    if not orders:
        click.echo("无寄养订单")
        return
    
    for o in orders:
        click.echo(f"{o['order_id']}: 宠物{o['pet_id']} {o['checkin_date']}~{o['checkout_date']}")


@cli.group()
def plan():
    """喂药计划管理"""
    pass


@plan.command("create")
@click.option("--order-id", required=True, help="订单ID")
@click.option("--pet-id", required=True, help="宠物ID")
@click.option("--start", required=True, help="开始日期 (YYYY-MM-DD)")
@click.option("--medication", required=True, help="药物名称")
@click.option("--amount", required=True, help="剂量")
@click.option("--unit", required=True, help="单位")
@click.option("--frequency", required=True, type=click.Choice(["daily", "twice_daily", "thrice_daily", "nightly"]), help="频率")
@click.option("--route", required=True, help="给药途径")
@click.option("--by", "created_by", required=True, help="创建人")
def create_plan(order_id, pet_id, start, medication, amount, unit, frequency, route, created_by):
    """创建喂药计划"""
    service = get_service()
    start_date = date.fromisoformat(start)
    
    try:
        plan = service.create_medication_plan(
            order_id, pet_id, start_date, medication,
            amount, unit, frequency, route, created_by
        )
        click.echo(f"✅ 喂药计划创建成功: {plan.plan_id}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")


@plan.command("update")
@click.option("--plan-id", required=True, help="计划ID")
@click.option("--medication", help="药物名称")
@click.option("--amount", help="剂量")
@click.option("--unit", help="单位")
@click.option("--frequency", help="频率")
@click.option("--route", help="给药途径")
@click.option("--by", "requested_by", required=True, help="请求人")
def update_plan(plan_id, medication, amount, unit, frequency, route, requested_by):
    """申请变更剂量(需确认)"""
    service = get_service()
    
    try:
        change, msg = service.update_dosage(
            plan_id, medication, amount, unit, frequency, route, requested_by
        )
        if change:
            click.echo(f"✅ {msg}: {change.change_id}")
        else:
            click.echo(f"ℹ️  {msg}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")


@plan.command("list")
def list_plans():
    """列出所有喂药计划"""
    service = get_service()
    plans = service.store.get_all_plans()
    if not plans:
        click.echo("无喂药计划")
        return
    
    for p in plans:
        click.echo(f"{p['plan_id']}: 订单{p['order_id']} 当前版本:{p['current_version']}")


@cli.group()
def change():
    """变更记录管理"""
    pass


@change.command("confirm")
@click.option("--change-id", required=True, help="变更ID")
@click.option("--by", "confirmed_by", required=True, help="确认人")
def confirm_change(change_id, confirmed_by):
    """确认剂量变更"""
    service = get_service()
    
    try:
        if service.confirm_change(change_id, confirmed_by):
            click.echo(f"✅ 变更已确认生效: {change_id}")
        else:
            click.echo(f"❌ 变更确认失败(可能已处理)")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")


@change.command("reject")
@click.option("--change-id", required=True, help="变更ID")
@click.option("--by", "rejected_by", required=True, help="拒绝人")
def reject_change(change_id, rejected_by):
    """拒绝剂量变更"""
    service = get_service()
    
    if service.reject_change(change_id, rejected_by):
        click.echo(f"✅ 变更已拒绝: {change_id}")
    else:
        click.echo(f"❌ 变更拒绝失败")


@change.command("pending")
def list_pending_changes():
    """列出待确认变更"""
    service = get_service()
    changes = service.store.get_pending_changes()
    if not changes:
        click.echo("无待确认变更")
        return
    
    for c in changes:
        click.echo(f"{c['change_id']}: {c['field_changed']} {c['old_value']} → {c['new_value']} (请求人:{c['requested_by']})")


@cli.group()
def shift():
    """班次执行记录"""
    pass


@shift.command("record")
@click.option("--plan-id", required=True, help="计划ID")
@click.option("--date", "shift_date", required=True, help="班次日期 (YYYY-MM-DD)")
@click.option("--type", "shift_type", required=True, type=click.Choice(["morning", "afternoon", "evening", "night"]), help="班次类型")
@click.option("--status", required=True, type=click.Choice(["administered", "skipped", "missed"]), help="执行状态")
@click.option("--by", "executed_by", help="执行人")
@click.option("--notes", help="备注")
def record_shift(plan_id, shift_date, shift_type, status, executed_by, notes):
    """记录班次执行"""
    service = get_service()
    shift_date_obj = date.fromisoformat(shift_date)
    
    try:
        execution = service.record_shift_execution(
            plan_id, shift_date_obj, shift_type, status, executed_by, notes
        )
        click.echo(f"✅ 班次记录成功: {execution.execution_id}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")


@shift.command("check-missed")
@click.option("--date", "check_date", help="检查日期 (YYYY-MM-DD)")
def check_missed(check_date):
    """检查漏喂"""
    service = get_service()
    check_date_obj = date.fromisoformat(check_date) if check_date else None
    
    missed = service.check_missed_doses(check_date_obj)
    if not missed:
        click.echo("✅ 无漏喂记录")
        return
    
    for m in missed:
        click.echo(f"⚠️  {m['alert']}")


@cli.group()
def report():
    """护理报告"""
    pass


@report.command("generate")
@click.option("--order-id", required=True, help="订单ID")
@click.option("--start", required=True, help="开始日期 (YYYY-MM-DD)")
@click.option("--end", required=True, help="结束日期 (YYYY-MM-DD)")
@click.option("--export", is_flag=True, help="导出文件")
def generate_report(order_id, start, end, export):
    """生成护理报告"""
    service = get_service()
    start_date = date.fromisoformat(start)
    end_date = date.fromisoformat(end)
    
    try:
        report = service.generate_care_report(order_id, start_date, end_date)
        ReportExporter.print_report(report)
        
        if export:
            json_path = ReportExporter.export_json(report)
            txt_path = ReportExporter.export_text(report)
            click.echo(f"📄 报告已导出:")
            click.echo(f"   JSON: {json_path}")
            click.echo(f"   TXT:  {txt_path}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")


@cli.command("validate")
def validate_data():
    """验证数据完整性"""
    service = get_service()
    errors = service.validate_data()
    
    total_errors = sum(len(v) for v in errors.values())
    if total_errors == 0:
        click.echo("✅ 所有数据验证通过")
        return
    
    click.echo(f"❌ 发现 {total_errors} 个数据问题:")
    for category, errs in errors.items():
        if errs:
            click.echo(f"  {category}:")
            for e in errs:
                click.echo(f"    - {e}")


@cli.command("clear")
@click.confirmation_option(prompt="确定要清空所有数据吗?")
def clear_all():
    """清空所有数据"""
    store = DataStore()
    store.clear_all()
    click.echo("✅ 所有数据已清空")


if __name__ == "__main__":
    cli()
