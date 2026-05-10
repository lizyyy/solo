import click
from datetime import datetime, timedelta
from tabulate import tabulate
import json

from .services import DataStore, ParkService


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    """园区访客车牌放行系统"""
    ctx.ensure_object(dict)
    ctx.obj["store"] = DataStore(data_dir)
    ctx.obj["service"] = ParkService(ctx.obj["store"])


@cli.command()
@click.option("--visitor-name", required=True, help="访客姓名")
@click.option("--visitor-id", required=True, help="访客身份证号")
@click.option("--visitor-phone", required=True, help="访客电话")
@click.option("--visitor-company", required=True, help="访客单位")
@click.option("--plate", required=True, help="车牌号码")
@click.option("--arrival-time", required=True, help="预计入场时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--departure-time", required=True, help="预计离场时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--access-area", default="全园区", help="允许访问区域")
@click.option("--approved/--not-approved", default=True, help="是否审批通过")
@click.pass_context
def reserve(ctx, visitor_name, visitor_id, visitor_phone, visitor_company, plate, 
            arrival_time, departure_time, access_area, approved):
    """创建访客预约"""
    service = ctx.obj["service"]
    
    try:
        arrival = datetime.strptime(arrival_time, "%Y-%m-%d %H:%M")
        departure = datetime.strptime(departure_time, "%Y-%m-%d %H:%M")
    except ValueError as e:
        click.echo(f"错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式。{e}")
        return
    
    reservation = service.create_reservation(
        visitor_name=visitor_name,
        visitor_id=visitor_id,
        visitor_phone=visitor_phone,
        visitor_company=visitor_company,
        plate_number=plate,
        arrival_time=arrival,
        departure_time=departure,
        access_area=access_area,
        approved=approved
    )
    
    click.echo(f"✅ 预约创建成功！")
    click.echo(f"预约编号: {reservation.reservation_id}")
    click.echo(f"访客: {visitor_name} ({visitor_company})")
    click.echo(f"车牌: {plate}")
    click.echo(f"预约时间: {arrival_time} 至 {departure_time}")
    click.echo(f"审批状态: {'已通过' if approved else '待审批'}")


@cli.command()
@click.option("--original-plate", required=True, help="原车牌号码")
@click.option("--new-plate", required=True, help="新车牌号码")
@click.option("--reason", required=True, help="换车原因")
@click.pass_context
def request_plate_change(ctx, original_plate, new_plate, reason):
    """申请车牌变更（临时换车）"""
    service = ctx.obj["service"]
    
    request = service.request_plate_change(
        original_plate=original_plate,
        new_plate=new_plate,
        reason=reason
    )
    
    click.echo(f"✅ 车牌变更申请提交成功！")
    click.echo(f"申请编号: {request.request_id}")
    click.echo(f"原车牌: {original_plate}")
    click.echo(f"新车牌: {new_plate}")
    click.echo(f"申请原因: {reason}")
    click.echo(f"状态: 待审批")


@cli.command()
@click.argument("request_id")
@click.pass_context
def approve_plate_change(ctx, request_id):
    """审批车牌变更申请"""
    service = ctx.obj["service"]
    
    request = service.approve_plate_change(request_id)
    
    if not request:
        click.echo(f"❌ 错误: 未找到申请编号 {request_id}")
        return
    
    click.echo(f"✅ 车牌变更审批通过！")
    click.echo(f"申请编号: {request.request_id}")
    click.echo(f"原车牌: {request.original_plate}")
    click.echo(f"新车牌: {request.new_plate}")
    click.echo(f"审批时间: {request.approved_at.strftime('%Y-%m-%d %H:%M:%S')}")


@cli.command()
@click.option("--plate", required=True, help="车牌号码")
@click.option("--reason", required=True, help="拉黑原因")
@click.option("--added-by", default="系统", help="操作人")
@click.pass_context
def add_blacklist(ctx, plate, reason, added_by):
    """添加车牌到黑名单"""
    service = ctx.obj["service"]
    
    entry = service.add_to_blacklist(plate, reason, added_by)
    
    click.echo(f"✅ 车牌已加入黑名单！")
    click.echo(f"车牌: {plate}")
    click.echo(f"原因: {reason}")
    click.echo(f"操作人: {added_by}")


@cli.command()
@click.option("--plate", required=True, help="车牌号码")
@click.option("--gate", default="南门", help="门岗名称")
@click.option("--operator", default="", help="操作员姓名")
@click.option("--time", help="模拟时间 (格式: YYYY-MM-DD HH:MM)，不填则使用当前时间")
@click.pass_context
def entry(ctx, plate, gate, operator, time):
    """处理车辆入场（扫描车牌）"""
    service = ctx.obj["service"]
    
    current_time = None
    if time:
        try:
            current_time = datetime.strptime(time, "%Y-%m-%d %H:%M")
        except ValueError as e:
            click.echo(f"错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式。{e}")
            return
    
    event = service.process_entry(plate, gate, operator, current_time)
    
    if event.result == "allowed":
        click.echo(f"✅ 入场放行！")
        click.echo(f"车牌: {plate}")
        click.echo(f"门岗: {gate}")
        click.echo(f"时间: {event.event_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"状态: {event.remark}")
    else:
        click.echo(f"❌ 入场拦截！")
        click.echo(f"车牌: {plate}")
        click.echo(f"门岗: {gate}")
        click.echo(f"时间: {event.event_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"拦截原因: {event.remark}")


@cli.command()
@click.option("--plate", required=True, help="车牌号码")
@click.option("--gate", default="南门", help="门岗名称")
@click.option("--operator", default="", help="操作员姓名")
@click.option("--time", help="模拟时间 (格式: YYYY-MM-DD HH:MM)，不填则使用当前时间")
@click.pass_context
def exit(ctx, plate, gate, operator, time):
    """处理车辆出场（扫描车牌）"""
    service = ctx.obj["service"]
    
    current_time = None
    if time:
        try:
            current_time = datetime.strptime(time, "%Y-%m-%d %H:%M")
        except ValueError as e:
            click.echo(f"错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式。{e}")
            return
    
    event = service.process_exit(plate, gate, operator, current_time)
    
    if event.result == "allowed":
        if "超时" in event.remark:
            click.echo(f"⚠️  超时离场！")
        else:
            click.echo(f"✅ 出场放行！")
        click.echo(f"车牌: {plate}")
        click.echo(f"门岗: {gate}")
        click.echo(f"时间: {event.event_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"状态: {event.remark}")
    else:
        click.echo(f"❌ 出场异常！")
        click.echo(f"车牌: {plate}")
        click.echo(f"门岗: {gate}")
        click.echo(f"时间: {event.event_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"异常原因: {event.remark}")


@cli.command()
@click.option("--plate", required=True, help="车牌号码")
@click.option("--time", help="模拟时间 (格式: YYYY-MM-DD HH:MM)，不填则使用当前时间")
@click.pass_context
def check(ctx, plate, time):
    """检查某辆车能否入场（只检查不记录）"""
    service = ctx.obj["service"]
    
    current_time = None
    if time:
        try:
            current_time = datetime.strptime(time, "%Y-%m-%d %H:%M")
        except ValueError as e:
            click.echo(f"错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式。{e}")
            return
    
    allowed, message, reservation = service.check_entry(plate, current_time)
    
    if allowed:
        click.echo(f"✅ 可以入场")
        click.echo(f"车牌: {plate}")
        if reservation:
            click.echo(f"访客: {reservation.visitor.visitor_name} ({reservation.visitor.visitor_company})")
            click.echo(f"预约有效时间: {reservation.intended_arrival_time.strftime('%Y-%m-%d %H:%M')} 至 {reservation.intended_departure_time.strftime('%Y-%m-%d %H:%M')}")
        click.echo(f"检查结果: {message}")
    else:
        click.echo(f"❌ 禁止入场")
        click.echo(f"车牌: {plate}")
        click.echo(f"拦截原因: {message}")


@cli.command()
@click.option("--start-time", required=True, help="交班开始时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--end-time", required=True, help="交班结束时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--operator", required=True, help="当班操作员")
@click.option("--output", help="输出文件路径，不填则只显示在屏幕")
@click.pass_context
def shift_log(ctx, start_time, end_time, operator, output):
    """生成门岗交班日志"""
    service = ctx.obj["service"]
    
    try:
        start = datetime.strptime(start_time, "%Y-%m-%d %H:%M")
        end = datetime.strptime(end_time, "%Y-%m-%d %H:%M")
    except ValueError as e:
        click.echo(f"错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式。{e}")
        return
    
    log = service.generate_shift_log(start, end, operator)
    
    click.echo("\n" + "=" * 60)
    click.echo("门岗交班日志")
    click.echo("=" * 60)
    click.echo(f"日志编号: {log.log_id}")
    click.echo(f"交班时段: {start_time} 至 {end_time}")
    click.echo(f"当班操作员: {operator}")
    click.echo("-" * 60)
    click.echo(f"入场总数: {log.total_entries}")
    click.echo(f"出场总数: {log.total_exits}")
    click.echo(f"拦截总数: {log.blocked_entries}")
    click.echo(f"违规记录: {log.violations}")
    click.echo("-" * 60)
    
    if log.events:
        click.echo("\n事件明细:")
        table_data = []
        for evt in sorted(log.events, key=lambda x: x.event_time):
            table_data.append([
                evt.event_time.strftime("%Y-%m-%d %H:%M:%S"),
                "入场" if evt.event_type == "entry" else "出场",
                evt.plate_number,
                evt.gate_name,
                "放行" if evt.result == "allowed" else "拦截",
                evt.remark
            ])
        click.echo(tabulate(table_data, headers=["时间", "类型", "车牌", "门岗", "结果", "备注"], tablefmt="grid"))
    else:
        click.echo("\n本时段无事件记录")
    
    if output:
        log_dict = {
            "log_id": log.log_id,
            "shift_start": log.shift_start.isoformat(),
            "shift_end": log.shift_end.isoformat(),
            "operator_on_duty": log.operator_on_duty,
            "total_entries": log.total_entries,
            "total_exits": log.total_exits,
            "blocked_entries": log.blocked_entries,
            "violations": log.violations,
            "events": [{
                "event_id": evt.event_id,
                "event_type": evt.event_type,
                "plate_number": evt.plate_number,
                "event_time": evt.event_time.isoformat(),
                "gate_name": evt.gate_name,
                "operator": evt.operator,
                "result": evt.result,
                "remark": evt.remark
            } for evt in log.events]
        }
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(log_dict, f, ensure_ascii=False, indent=2)
        click.echo(f"\n日志已保存到: {output}")


@cli.command()
@click.option("--date", required=True, help="报告日期 (格式: YYYY-MM-DD)")
@click.option("--output", help="输出文件路径，不填则只显示在屏幕")
@click.pass_context
def daily_report(ctx, date, output):
    """生成按日期汇总的放行报告"""
    service = ctx.obj["service"]
    
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError as e:
        click.echo(f"错误: 日期格式不正确，请使用 YYYY-MM-DD 格式。{e}")
        return
    
    report = service.generate_daily_report(date)
    
    click.echo("\n" + "=" * 60)
    click.echo(f"园区访客放行日报 - {date}")
    click.echo("=" * 60)
    
    summary_data = [
        ["预约总数", report.total_reservations],
        ["实际入场", report.actual_entries],
        ["实际出场", report.actual_exits],
        ["拦截入场", report.blocked_entries],
        ["过期预约", report.expired_reservations],
        ["超时离场", report.overtime_exits],
        ["平均停留时长", report.average_stay_duration]
    ]
    
    click.echo(tabulate(summary_data, headers=["指标", "数值"], tablefmt="grid"))
    
    if output:
        report_dict = {
            "report_date": report.report_date,
            "total_reservations": report.total_reservations,
            "actual_entries": report.actual_entries,
            "actual_exits": report.actual_exits,
            "blocked_entries": report.blocked_entries,
            "expired_reservations": report.expired_reservations,
            "overtime_exits": report.overtime_exits,
            "average_stay_duration": report.average_stay_duration
        }
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2)
        click.echo(f"\n报告已保存到: {output}")


@cli.command()
@click.option("--type", "list_type", required=True, 
              type=click.Choice(["reservations", "blacklist", "events", "in-park"]),
              help="要查看的列表类型")
@click.pass_context
def list(ctx, list_type):
    """查看各种列表"""
    store = ctx.obj["store"]
    
    if list_type == "reservations":
        click.echo("\n访客预约列表:")
        if not store.reservations:
            click.echo("暂无预约记录")
            return
        
        table_data = []
        for res in store.reservations.values():
            table_data.append([
                res.reservation_id,
                res.visitor.visitor_name,
                res.visitor.visitor_company,
                res.vehicle.plate_number,
                res.intended_arrival_time.strftime("%Y-%m-%d %H:%M"),
                res.intended_departure_time.strftime("%Y-%m-%d %H:%M"),
                "已审批" if res.approved else "待审批",
                res.status
            ])
        click.echo(tabulate(table_data, 
                          headers=["预约编号", "访客", "单位", "车牌", "入场时间", "离场时间", "审批", "状态"], 
                          tablefmt="grid"))
    
    elif list_type == "blacklist":
        click.echo("\n黑名单列表:")
        if not store.blacklist:
            click.echo("暂无黑名单记录")
            return
        
        table_data = []
        for entry in store.blacklist.values():
            table_data.append([
                entry.plate_number,
                entry.reason,
                entry.added_at.strftime("%Y-%m-%d %H:%M"),
                entry.added_by
            ])
        click.echo(tabulate(table_data, headers=["车牌", "原因", "添加时间", "操作人"], tablefmt="grid"))
    
    elif list_type == "events":
        click.echo("\n事件记录列表:")
        if not store.events:
            click.echo("暂无事件记录")
            return
        
        table_data = []
        for evt in sorted(store.events.values(), key=lambda x: x.event_time, reverse=True):
            table_data.append([
                evt.event_time.strftime("%Y-%m-%d %H:%M:%S"),
                "入场" if evt.event_type == "entry" else "出场",
                evt.plate_number,
                evt.gate_name,
                "放行" if evt.result == "allowed" else "拦截",
                evt.remark
            ])
        click.echo(tabulate(table_data, headers=["时间", "类型", "车牌", "门岗", "结果", "备注"], tablefmt="grid"))
    
    elif list_type == "in-park":
        click.echo("\n当前在园车辆:")
        if not store.current_plate_in_park:
            click.echo("暂无在园车辆")
            return
        
        table_data = []
        for plate, event_id in store.current_plate_in_park.items():
            entry_event = store.events.get(event_id)
            entry_time = entry_event.event_time.strftime("%Y-%m-%d %H:%M:%S") if entry_event else "未知"
            table_data.append([plate, entry_time])
        click.echo(tabulate(table_data, headers=["车牌", "入场时间"], tablefmt="grid"))


def main():
    cli()


if __name__ == "__main__":
    main()
