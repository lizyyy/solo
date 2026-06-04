import click
import json
import os
import sys

from data_import import importer
from storage import storage
from detector import detector
from safety_reminder import safety_manager
from models import MaintenanceScreenshot
import uuid


@click.group()
def cli():
    """风洞小车阻力曲线分析工具"""
    pass


@cli.command()
@click.option("--name", required=True, help="实验名称")
@click.option("--date", required=True, help="实验日期")
@click.option("--csv", "csv_file", required=True, help="传感器数据CSV文件")
@click.option("--device", "device_file", help="设备铭牌参数JSON文件")
def create_session(name, date, csv_file, device_file):
    """创建新的实验会话"""
    click.echo(f"创建实验会话: {name}")

    records = importer.import_from_csv(csv_file)
    click.echo(f"导入 {len(records)} 条传感器记录")

    device_plate = None
    if device_file:
        with open(device_file, "r", encoding="utf-8") as f:
            device_data = json.load(f)
            device_plate = importer.import_device_plate(device_data)
        click.echo("导入设备铭牌参数")

    session = importer.create_session(name, date, records, device_plate)

    records, restart_events = detector.detect_restarts(session.sensor_records)
    session.sensor_records = records

    pattern_info = detector.analyze_patterns(restart_events)

    session = safety_manager.process_session_reminders(
        session, restart_events, pattern_info
    )

    storage.create_session(session)

    click.echo(f"检测到 {len(restart_events)} 次传感器重启事件")
    click.echo(f"会话ID: {session.id}")
    click.echo("会话创建完成！")


@cli.command()
def list_sessions():
    """列出所有实验会话"""
    sessions = storage.list_sessions()
    if not sessions:
        click.echo("暂无实验会话")
        return

    click.echo("实验会话列表：")
    for s in sessions:
        click.echo(f"  - {s['name']} ({s['date']}) - {s['status']}")
        click.echo(f"    ID: {s['id']}")


@cli.command()
@click.argument("session_id")
def show_session(session_id):
    """显示实验会话详情"""
    session = storage.get_session(session_id)
    if not session:
        click.echo(f"会话不存在")
        return

    click.echo(f"实验名称: {session.name}")
    click.echo(f"日期: {session.date}")
    click.echo(f"记录数: {len(session.sensor_records)}")

    summary = safety_manager.get_summary(session)
    click.echo("\n安全提醒概览:")
    click.echo(f"  总计: {summary['total']}")
    click.echo(f"  严重: {summary['critical']}")
    click.echo(f"  警告: {summary['warning']}")
    click.echo(f"  已复核: {summary['reviewed']}")

    if session.safety_reminders:
        click.echo("\n安全提醒详情：")
        for r in session.safety_reminders:
            click.echo(f"\n  [{r.level.value.upper()} {r.title}")
            click.echo(f"  记录ID: {r.record_id}")
            click.echo(f"  保留原因: {r.reason_kept}")
            click.echo(f"  缺失材料: {', '.join(r.missing_materials)}")
            click.echo(f"  下一步: {r.next_action.value}")
            if r.teacher_note:
                click.echo(f"  林老师备注: {r.teacher_note}")


@cli.command()
@click.argument("session_id")
@click.argument("record_id")
@click.option("--file", "screenshot_file", required=True, help="截图文件路径")
@click.option("--desc", required=True, help="截图描述")
@click.option("--note", required=True, help="林老师说明")
def add_screenshot(session_id, record_id, screenshot_file, desc, note):
    """添加维修群截图"""
    session = storage.get_session(session_id)
    if not session:
        click.echo("会话不存在")
        return

    filename = os.path.basename(screenshot_file)
    screenshot = MaintenanceScreenshot(
        id=str(uuid.uuid4()),
        record_id=record_id,
        filename=filename,
        uploader="林老师",
        description=desc,
        wechat_group_name="设备维修群",
    )

    session.maintenance_screenshots.append(screenshot)

    reminder = safety_manager.get_reminder_by_record(session, record_id)
    if reminder:
        safety_manager.update_after_screenshot(reminder, screenshot, note)

    storage.update_session(session)
    click.echo("截图已添加，安全提醒已更新")


@cli.command()
@click.argument("session_id")
@click.argument("record_id")
@click.option("--note", required=True, help="核对备注")
def check_device_plate(session_id, record_id, note):
    """标记设备铭牌参数核对"""
    session = storage.get_session(session_id)
    if not session:
        click.echo("会话不存在")
        return

    reminder = safety_manager.get_reminder_by_record(session, record_id)
    if reminder:
        safety_manager.update_after_device_plate_check(reminder, note)
        storage.update_session(session)
        click.echo("设备铭牌核对已记录，安全提醒已更新")
    else:
        click.echo("未找到对应安全提醒")


@cli.command()
@click.argument("session_id")
@click.argument("record_id")
@click.option("--note", required=True, help="复核意见")
@click.option("--approve/--reject", default=True, help="是否通过")
def review(session_id, record_id, note, approve):
    """安全员复核安全提醒"""
    session = storage.get_session(session_id)
    if not session:
        click.echo("会话不存在")
        return

    reminder = safety_manager.get_reminder_by_record(session, record_id)
    if reminder:
        safety_manager.mark_reviewed(reminder, note, approve)
        storage.update_session(session)
        status = "通过" if approve else "驳回"
        click.echo(f"安全提醒已{status}")
    else:
        click.echo("未找到对应安全提醒")


@cli.command()
@click.argument("session_id")
def export_report(session_id):
    """导出风洞小车阻力曲线报告"""
    session = storage.get_session(session_id)
    if not session:
        click.echo("会话不存在")
        return

    output = {
        "session": {
            "name": session.name,
            "date": session.date,
        },
        "device_plate": session.device_plate.model_dump(mode="json") if session.device_plate else None,
        "safety_reminders": [r.model_dump(mode="json") for r in session.safety_reminders],
        "restart_events": [
            {
                "record_id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "sensor_id": r.sensor_id,
                "reason": r.restart_reason,
            }
            for r in session.sensor_records
            if r.is_restart_marker
        ],
    }

    filename = f"report_{session_id}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    click.echo(f"报告已导出: {filename}")


if __name__ == "__main__":
    cli()
