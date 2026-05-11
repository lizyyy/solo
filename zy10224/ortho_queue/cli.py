import click
from datetime import date as date_class, timedelta
from tabulate import tabulate
from .database import get_session, init_db
from .services import (
    create_appointment, reschedule_appointment, cancel_appointment,
    create_reminder, get_today_queue, get_reminder_list,
    suggest_reschedule_options, check_conflicts
)
from .config import EXPORT_DIR, STAGES, REMINDER_TYPES, EMERGENCY_REASONS, APPOINTMENT_STATUS

init_db()

def parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'y', 't')
    return bool(value)

@click.group()
@click.version_option(version="1.0.0")
def cli():
    """口腔正畸复诊排队管理工具"""
    pass

@cli.group()
def patient():
    """患者管理命令"""
    pass

@cli.group()
def appointment():
    """预约管理命令"""
    pass

@cli.group()
def queue():
    """队列查询命令"""
    pass

@cli.group()
def reminder():
    """提醒管理命令"""
    pass

@cli.command()
@click.option("--date", type=click.DateTime(formats=["%Y-%m-%d"]), default=None,
              help="查询日期 (格式: YYYY-MM-DD，默认今天)")
@click.option("--format", type=click.Choice(["table", "json"]), default="table",
              help="输出格式")
def today(date, format):
    """查看今日队列"""
    target_date = date.date() if date else date_class.today()
    session = get_session()
    
    try:
        result = get_today_queue(session, target_date)
        
        if format == "json":
            import json
            output = {
                "date": str(result["date"]),
                "appointments": [
                    {
                        "code": a.appointment_code,
                        "patient": a.patient.name,
                        "doctor": a.doctor.name,
                        "is_emergency": a.is_emergency,
                        "status": a.status,
                        "stage": a.patient.current_stage
                    } for a in result["appointments"]
                ],
                "conflicts": result["conflicts"],
                "doctor_summary": result["doctor_summary"]
            }
            click.echo(json.dumps(output, ensure_ascii=False, indent=2))
        else:
            click.echo(f"\n{'='*60}")
            click.echo(f"📅 今日队列 - {target_date.strftime('%Y年%m月%d日')}")
            click.echo(f"{'='*60}")
            
            if result["appointments"]:
                appt_table = []
                for idx, a in enumerate(result["appointments"], 1):
                    appt_table.append([
                        idx,
                        "🚨 急诊" if a.is_emergency else "常规",
                        a.appointment_code,
                        a.patient.name,
                        a.patient.patient_id,
                        a.doctor.name,
                        a.patient.current_stage or "-",
                        a.status
                    ])
                
                headers = ["序号", "类型", "预约编码", "患者姓名", "患者ID", "医生", "当前阶段", "状态"]
                click.echo(tabulate(appt_table, headers=headers, tablefmt="grid"))
            else:
                click.echo("  今日无预约")
            
            click.echo(f"\n{'='*60}")
            click.echo("👨‍⚕️ 医生负荷")
            click.echo(f"{'='*60}")
            
            if result["doctor_summary"]:
                doctor_table = []
                for d in result["doctor_summary"]:
                    status = "✅ 正常" if not d["is_full"] else "⚠️ 已满"
                    doctor_table.append([
                        d["doctor_name"],
                        f"{d['regular_count']}/{d['max_daily']}",
                        d["emergency_count"],
                        d["total_count"],
                        status
                    ])
                
                headers = ["医生", "常规/上限", "急诊", "总计", "状态"]
                click.echo(tabulate(doctor_table, headers=headers, tablefmt="grid"))
            else:
                click.echo("  暂无医生信息")
            
            if result["conflicts"]:
                click.echo(f"\n{'='*60}")
                click.echo("⚠️ 冲突检测")
                click.echo(f"{'='*60}")
                
                for c in result["conflicts"]:
                    type_label = "🚨 急诊" if c["is_emergency"] else "常规"
                    click.echo(f"\n[{type_label}] {c['appointment_code']} - {c['patient_name']} ({c['doctor_name']})")
                    for conflict in c["conflicts"]:
                        severity = "❌" if conflict["severity"] == "error" else "⚠️"
                        click.echo(f"  {severity} {conflict['message']}")
                        if "details" in conflict and "suggested_date" in conflict["details"]:
                            click.echo(f"     建议日期: {conflict['details']['suggested_date']}")
    finally:
        session.close()

@appointment.command("create")
@click.option("--patient-id", required=True, help="患者ID")
@click.option("--patient-name", required=True, help="患者姓名")
@click.option("--doctor", required=True, help="医生姓名")
@click.option("--date", "appt_date", type=click.DateTime(formats=["%Y-%m-%d"]), required=True,
              help="预约日期 (格式: YYYY-MM-DD)")
@click.option("--emergency", is_flag=True, help="是否为急诊")
@click.option("--emergency-reason", type=click.Choice(EMERGENCY_REASONS), help="急诊原因")
@click.option("--stage", type=click.Choice(STAGES), help="当前阶段")
@click.option("--interval", type=int, help="复诊周期（天）")
@click.option("--phone", help="联系电话")
@click.option("--notes", help="备注")
def appointment_create(patient_id, patient_name, doctor, appt_date, emergency, 
                   emergency_reason, stage, interval, phone, notes):
    """创建预约"""
    session = get_session()
    try:
        patient_kwargs = {}
        if stage:
            patient_kwargs["current_stage"] = stage
        if interval:
            patient_kwargs["review_interval_days"] = interval
        if phone:
            patient_kwargs["phone"] = phone
        
        appt, conflicts, is_duplicate = create_appointment(
            session,
            patient_id, patient_name, doctor,
            appt_date.date(),
            is_emergency=emergency,
            emergency_reason=emergency_reason,
            notes=notes,
            **patient_kwargs
        )
        
        if is_duplicate:
            click.echo(f"⚠️ 预约已存在，跳过重复导入: {appt.appointment_code}")
            return
        
        if not appt:
            click.echo("❌ 创建预约失败:")
            for c in conflicts:
                severity = "❌" if c["severity"] == "error" else "⚠️"
                click.echo(f"  {severity} {c['message']}")
            return
        
        click.echo(f"✅ 预约创建成功: {appt.appointment_code}")
        click.echo(f"   患者: {appt.patient.name} ({appt.patient.patient_id})")
        click.echo(f"   医生: {appt.doctor.name}")
        click.echo(f"   日期: {appt.appointment_date}")
        click.echo(f"   类型: {'急诊' if appt.is_emergency else '常规'}")
        if appt.is_emergency and appt.emergency_reason:
            click.echo(f"   原因: {appt.emergency_reason}")
        
        warnings = [c for c in conflicts if c["severity"] == "warning"]
        if warnings:
            click.echo(f"\n⚠️ 警告:")
            for w in warnings:
                click.echo(f"  - {w['message']}")
    finally:
        session.close()

@appointment.command("reschedule")
@click.option("--code", required=True, help="预约编码")
@click.option("--new-date", type=click.DateTime(formats=["%Y-%m-%d"]), default=None,
              help="新预约日期 (格式: YYYY-MM-DD)")
@click.option("--reason", help="改约原因")
@click.option("--suggest", is_flag=True, help="显示建议日期")
def appointment_reschedule(code, new_date, reason, suggest):
    """改约"""
    session = get_session()
    try:
        from .database import Appointment
        existing = session.query(Appointment).filter(Appointment.appointment_code == code).first()
        
        if suggest or not new_date:
            if not existing:
                click.echo("❌ 未找到该预约")
                return
            suggestions = suggest_reschedule_options(
                session, existing.patient_id, existing.doctor_id,
                existing.appointment_date, existing.is_emergency
            )
            if suggestions:
                click.echo("📅 建议改约日期:")
                for idx, s in enumerate(suggestions, 1):
                    warnings = " (有警告)" if s["warnings"] else ""
                    click.echo(f"  {idx}. {s['date']}{warnings}")
                    for w in s["warnings"]:
                        click.echo(f"     ⚠️ {w['message']}")
            else:
                click.echo("⚠️ 未找到可用的改约日期")
            return
        
        appt, conflicts = reschedule_appointment(session, code, new_date.date(), reason)
        
        if not appt:
            click.echo("❌ 改约失败:")
            for c in conflicts:
                click.echo(f"  ❌ {c['message']}")
            return
        
        click.echo(f"✅ 改约成功: {code} -> {appt.appointment_code}")
        click.echo(f"   新日期: {appt.appointment_date}")
        
        warnings = [c for c in conflicts if c["severity"] == "warning"]
        if warnings:
            click.echo(f"\n⚠️ 警告:")
            for w in warnings:
                click.echo(f"  - {w['message']}")
    finally:
        session.close()

@appointment.command("cancel")
@click.option("--code", required=True, help="预约编码")
@click.option("--reason", help="取消原因")
def appointment_cancel(code, reason):
    """取消预约"""
    session = get_session()
    try:
        appt, errors = cancel_appointment(session, code, reason)
        
        if not appt:
            click.echo("❌ 取消失败:")
            for e in errors:
                click.echo(f"  ❌ {e['message']}")
            return
        
        click.echo(f"✅ 预约已取消: {code}")
        click.echo(f"   患者: {appt.patient.name}")
        click.echo(f"   医生: {appt.doctor.name}")
        click.echo(f"   原日期: {appt.appointment_date}")
        
        from .database import Reminder
        withdrawn = session.query(Reminder).filter(
            Reminder.appointment_id == appt.id,
            Reminder.is_withdrawn == True
        ).all()
        if withdrawn:
            click.echo(f"   ⚠️ 已撤回 {len(withdrawn)} 条提醒")
    finally:
        session.close()

@reminder.command("create")
@click.option("--code", required=True, help="预约编码")
@click.option("--date", "reminder_date", type=click.DateTime(formats=["%Y-%m-%d"]), required=True,
              help="提醒日期 (格式: YYYY-MM-DD)")
@click.option("--type", "reminder_type", type=click.Choice(REMINDER_TYPES), default="短信",
              help="提醒方式")
def reminder_create(code, reminder_date, reminder_type):
    """创建提醒"""
    session = get_session()
    try:
        reminder, errors = create_reminder(session, code, reminder_date.date(), reminder_type)
        
        if not reminder:
            click.echo("❌ 创建提醒失败:")
            for e in errors:
                click.echo(f"  ❌ {e['message']}")
            return
        
        click.echo(f"✅ 提醒创建成功")
        click.echo(f"   预约编码: {code}")
        click.echo(f"   提醒日期: {reminder.reminder_date}")
        click.echo(f"   提醒方式: {reminder.reminder_type}")
    finally:
        session.close()

@reminder.command("list")
@click.option("--date", type=click.DateTime(formats=["%Y-%m-%d"]), default=None,
              help="查询日期 (格式: YYYY-MM-DD，默认今天)")
@click.option("--include-withdrawn", is_flag=True, help="包含已撤回的提醒")
@click.option("--export", type=click.Choice(["csv", "json", "none"]), default="none",
              help="导出格式")
def reminder_list(date, include_withdrawn, export):
    """查看提醒清单"""
    target_date = date.date() if date else date_class.today()
    session = get_session()
    
    try:
        reminders = get_reminder_list(session, target_date, include_withdrawn)
        
        if export == "json":
            import json
            output = {"date": str(target_date), "reminders": reminders}
            click.echo(json.dumps(output, ensure_ascii=False, indent=2))
            return
        
        click.echo(f"\n{'='*60}")
        click.echo(f"📋 提醒清单 - {target_date.strftime('%Y年%m月%d日')}")
        click.echo(f"{'='*60}")
        
        if reminders:
            table = []
            for idx, r in enumerate(reminders, 1):
                status = []
                if r["is_withdrawn"]:
                    status.append("已撤回")
                elif r["is_sent"]:
                    status.append("已发送")
                else:
                    status.append("待发送")
                status_str = "/".join(status)
                
                table.append([
                    idx,
                    "🚨" if r["is_emergency"] else "",
                    r["appointment_code"],
                    r["patient_name"],
                    r["patient_phone"] or "-",
                    r["reminder_type"],
                    status_str
                ])
            
            headers = ["序号", "急诊", "预约编码", "患者姓名", "电话", "提醒方式", "状态"]
            click.echo(tabulate(table, headers=headers, tablefmt="grid"))
        else:
            click.echo("  暂无提醒")
        
        if export == "csv":
            EXPORT_DIR.mkdir(parents=True, exist_ok=True)
            import csv
            filepath = EXPORT_DIR / f"reminders_{target_date.strftime('%Y%m%d')}.csv"
            
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'patient_name', 'patient_id', 'patient_phone',
                    'reminder_type', 'appointment_code',
                    'appointment_date', 'is_emergency'
                ])
                writer.writeheader()
                for r in reminders:
                    writer.writerow({
                        'patient_name': r['patient_name'],
                        'patient_id': r['patient_id'],
                        'patient_phone': r['patient_phone'] or '',
                        'reminder_type': r['reminder_type'],
                        'appointment_code': r['appointment_code'],
                        'appointment_date': str(r['appointment_date']),
                        'is_emergency': '是' if r['is_emergency'] else '否'
                    })
            
            click.echo(f"\n✅ 已导出到: {filepath}")
    finally:
        session.close()

@cli.command()
@click.option("--file", required=True, type=click.Path(exists=True), help="导入文件路径 (JSON/CSV)")
@click.option("--dry-run", is_flag=True, help="仅检查不导入")
def import_batch(file, dry_run):
    """批量导入预约"""
    import json
    import csv
    from pathlib import Path
    
    session = get_session()
    try:
        file_path = Path(file)
        click.echo(f"📂 读取文件: {file_path}")
        
        appointments_data = []
        
        if file_path.suffix.lower() == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    appointments_data = data
                elif isinstance(data, dict) and 'appointments' in data:
                    appointments_data = data['appointments']
        
        elif file_path.suffix.lower() == '.csv':
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                appointments_data = list(reader)
        
        else:
            click.echo("❌ 不支持的文件格式，请使用 JSON 或 CSV")
            return
        
        click.echo(f"📊 共 {len(appointments_data)} 条记录")
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for idx, item in enumerate(appointments_data, 1):
            try:
                from datetime import datetime as dt
                appt_date = dt.strptime(item['date'], '%Y-%m-%d').date()
                
                patient_kwargs = {}
                if 'stage' in item:
                    patient_kwargs['current_stage'] = item['stage']
                if 'interval' in item:
                    patient_kwargs['review_interval_days'] = int(item['interval'])
                if 'phone' in item:
                    patient_kwargs['phone'] = item['phone']
                
                if dry_run:
                    click.echo(f"[{idx}] 检查: {item['patient_id']} - {item['date']}")
                    continue
                
                emergency_value = item.get('emergency', False)
                is_emergency = parse_bool(emergency_value)
                
                appt, conflicts, is_duplicate = create_appointment(
                    session,
                    item['patient_id'],
                    item['patient_name'],
                    item['doctor'],
                    appt_date,
                    is_emergency=is_emergency,
                    emergency_reason=item.get('emergency_reason'),
                    notes=item.get('notes'),
                    **patient_kwargs
                )
                
                if is_duplicate:
                    skip_count += 1
                    click.echo(f"[{idx}] 跳过重复: {item['patient_id']}")
                elif not appt:
                    error_count += 1
                    click.echo(f"[{idx}] ❌ 失败: {item['patient_id']}")
                    for c in conflicts:
                        click.echo(f"     {c['message']}")
                else:
                    success_count += 1
                    click.echo(f"[{idx}] ✅ 成功: {appt.appointment_code}")
                    
            except Exception as e:
                error_count += 1
                click.echo(f"[{idx}] ❌ 错误: {str(e)}")
        
        click.echo(f"\n{'='*60}")
        click.echo(f"📊 导入结果:")
        click.echo(f"   成功: {success_count}")
        click.echo(f"   跳过: {skip_count}")
        click.echo(f"   失败: {error_count}")
        
    finally:
        session.close()

if __name__ == "__main__":
    cli()
