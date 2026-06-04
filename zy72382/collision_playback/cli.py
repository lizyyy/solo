import asyncio
import json
from datetime import datetime
from pathlib import Path
import click

from .config import RECORD_STATUS, OPERATOR_LAOCEN, OPERATOR_ENGINEER
from .models import SensorRecordCreate
from . import database, core


def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """小车碰撞动量回放系统 - 命令行接口"""
    pass


@cli.command()
def initdb():
    """初始化数据库"""
    run_async(database.init_db())
    click.echo("✓ 数据库初始化完成")


@cli.command()
@click.argument("sensor_no")
@click.argument("collision_time")
@click.argument("car_mass_kg", type=float)
@click.argument("velocity_ms", type=float)
@click.argument("friction_coeff", type=float)
@click.argument("collision_efficiency", type=float)
@click.option("--notes", help="备注信息")
def import_record(
    sensor_no, collision_time, car_mass_kg, velocity_ms,
    friction_coeff, collision_efficiency, notes
):
    """导入一条传感器记录

    COLLISION_TIME 格式: YYYY-MM-DDTHH:MM:SS 或 'now'
    """
    run_async(database.init_db())

    if collision_time.lower() == "now":
        ct = datetime.now()
    else:
        ct = datetime.fromisoformat(collision_time)

    record_data = SensorRecordCreate(
        sensor_no=sensor_no,
        collision_time=ct,
        car_mass_kg=car_mass_kg,
        velocity_ms=velocity_ms,
        friction_coeff=friction_coeff,
        collision_efficiency=collision_efficiency,
        notes=notes,
    )

    result = run_async(core.import_sensor_record(record_data))
    click.echo(f"导入结果: {result.message}")
    click.echo(f"记录ID: {result.record_id}, 状态: {result.status}")
    if result.has_pending_correction:
        click.echo("⚠ 该记录有待复核的人工修正")


@cli.command()
@click.argument("json_file", type=click.Path(exists=True))
def import_json(json_file):
    """从JSON文件批量导入传感器记录"""
    run_async(database.init_db())

    with open(json_file, "r", encoding="utf-8") as f:
        records_data = json.load(f)

    if not isinstance(records_data, list):
        records_data = [records_data]

    for item in records_data:
        item["collision_time"] = datetime.fromisoformat(item["collision_time"])
        record_data = SensorRecordCreate(**item)
        result = run_async(core.import_sensor_record(record_data))
        click.echo(f"[{result.sensor_no}] {result.message}")


@cli.command()
@click.option("--pending", is_flag=True, help="只显示待复核的记录")
def list(pending):
    """列出所有记录"""
    run_async(database.init_db())

    if pending:
        records = run_async(core.get_pending_review_records())
        if not records:
            click.echo("没有待复核的记录")
            return
    else:
        records = run_async(core.get_all_record_details())
        if not records:
            click.echo("没有记录，请先导入数据")
            return

    for record in records:
        status_icon = {
            RECORD_STATUS["NORMAL"]: "✓",
            RECORD_STATUS["PENDING_REVIEW"]: "⚠",
            RECORD_STATUS["REVIEWED"]: "✓",
        }.get(record.status, "?")

        has_correction_icon = "⚠" if record.has_manual_correction else " "
        pending_review_icon = "⚠" if record.status == RECORD_STATUS["PENDING_REVIEW"] else " "
        photos_icon = "📷" if record.photos else "  "

        click.echo(
            f"{status_icon} [{record.id}] {record.sensor_no} "
            f"{record.collision_time.strftime('%m-%d %H:%M')} "
            f"动量={record.corrected_momentum:.2f} "
            f"{has_correction_icon}人工修正 {pending_review_icon}待复核 {photos_icon}照片"
        )


@cli.command()
@click.argument("record_id", type=int)
def show(record_id):
    """显示单条记录的详细信息（含回放历史）"""
    run_async(database.init_db())

    detail = run_async(core.get_record_detail(record_id))
    if not detail:
        click.echo(f"✗ 记录 {record_id} 不存在")
        return

    click.echo(core.format_record_for_display(detail))


@cli.command()
@click.argument("sensor_no")
def show_by_sensor(sensor_no):
    """通过传感器编号查看记录详情"""
    run_async(database.init_db())

    record = run_async(database.get_sensor_record_by_sensor_no(sensor_no))
    if not record:
        click.echo(f"✗ 传感器 {sensor_no} 不存在")
        return

    detail = run_async(core.get_record_detail(record.id))
    click.echo(core.format_record_for_display(detail))


@cli.command()
@click.argument("record_id", type=int)
@click.argument("field_name")
@click.argument("new_value", type=float)
@click.option("--operator", default=OPERATOR_LAOCEN, help="操作人姓名")
@click.option("--reason", help="修正原因（不填则标记为待复核）")
def correct(record_id, field_name, new_value, operator, reason):
    """应用人工修正

    FIELD_NAME 可选: friction_coeff, collision_efficiency, car_mass_kg, velocity_ms

    注意: 不填 --reason 时会自动标记为待复核状态
    """
    run_async(database.init_db())

    result = run_async(
        core.apply_manual_correction(record_id, field_name, new_value, operator, reason)
    )

    if result["success"]:
        click.echo(f"✓ {result['message']}")
        click.echo(f"  新修正动量: {result['new_corrected_momentum']} kg·m/s")
        if result["status"] == RECORD_STATUS["PENDING_REVIEW"]:
            click.echo("  ⚠ 状态: 待设备工程师复核")
    else:
        click.echo(f"✗ {result['message']}")


@cli.command()
@click.argument("record_id", type=int)
@click.argument("photo_path", type=click.Path(exists=True))
@click.option("--note", help="照片备注")
@click.option("--extracted-friction", type=float, help="从照片提取的摩擦系数(旧口径)")
@click.option("--uploader", default=OPERATOR_LAOCEN, help="上传人")
def upload_photo(record_id, photo_path, note, extracted_friction, uploader):
    """上传工况照片

    可选择从照片中提取旧口径摩擦系数，提取后会自动重放计算
    """
    run_async(database.init_db())

    result = run_async(
        core.upload_work_photo(record_id, photo_path, note, extracted_friction, uploader)
    )

    if result["success"]:
        click.echo(f"✓ {result['message']}")
        if result.get("playback_updated"):
            click.echo(f"  新修正动量: {result['new_corrected_momentum']} kg·m/s")
    else:
        click.echo(f"✗ {result['message']}")


@cli.command()
@click.argument("record_id", type=int)
@click.option("--run-by", default=OPERATOR_LAOCEN, help="执行人")
def playback(record_id, run_by):
    """重新运行参数回放"""
    run_async(database.init_db())

    result = run_async(core.run_playback(record_id, run_by))

    if result["success"]:
        click.echo(f"✓ {result['message']}")
        click.echo(f"  原始动量: {result['raw_momentum']} kg·m/s")
        click.echo(f"  修正动量: {result['corrected_momentum']} kg·m/s")
        click.echo(f"  能量损失: {result['energy_loss']}")
        click.echo(f"  数据来源: {result['source']}")
    else:
        click.echo(f"✗ {result['message']}")


@cli.command()
@click.argument("record_id", type=int)
@click.option("--reviewer", default=OPERATOR_ENGINEER, help="复核人")
def review(record_id, reviewer):
    """设备工程师复核待处理记录"""
    run_async(database.init_db())

    result = run_async(core.review_record(record_id, reviewer))

    if result["success"]:
        click.echo(f"✓ {result['message']}")
        click.echo(f"  新状态: {result['new_status']}")
    else:
        click.echo(f"✗ {result['message']}")


@cli.command()
@click.option("--clear-first", is_flag=True, help="先清空现有数据")
def load_demo(clear_first):
    """加载演示数据（3条典型记录）"""
    run_async(database.init_db())

    if clear_first:
        run_async(database.clear_all_data())
        click.echo("已清空现有数据")

    from . import demo_data
    result = run_async(demo_data.load_demo_data())
    click.echo(result)


@cli.command()
def pending():
    """列出所有待复核的记录"""
    run_async(database.init_db())

    records = run_async(core.get_pending_review_records())
    if not records:
        click.echo("✓ 没有待复核的记录")
        return

    click.echo(f"⚠ 共有 {len(records)} 条待复核记录:")
    for record in records:
        click.echo(f"  [{record.id}] {record.sensor_no} - {record.collision_time.strftime('%Y-%m-%d %H:%M')}")
        for corr in record.corrections:
            if corr.reason is None:
                click.echo(
                    f"    ⚠ {corr.operator} 修改 {corr.field_name}: "
                    f"{corr.old_value} → {corr.new_value} (未填原因)"
                )


@cli.command()
def summary():
    """显示系统整体复盘摘要"""
    run_async(database.init_db())

    records = run_async(core.get_all_record_details())
    if not records:
        click.echo("没有记录")
        return

    total = len(records)
    normal = sum(1 for r in records if r.status == RECORD_STATUS["NORMAL"])
    pending = sum(1 for r in records if r.status == RECORD_STATUS["PENDING_REVIEW"])
    reviewed = sum(1 for r in records if r.status == RECORD_STATUS["REVIEWED"])
    with_photos = sum(1 for r in records if r.photos)
    with_corrections = sum(1 for r in records if r.has_manual_correction)

    click.echo("=" * 60)
    click.echo("小车碰撞动量回放 - 复盘摘要")
    click.echo("=" * 60)
    click.echo(f"总记录数:      {total}")
    click.echo(f"正常记录:      {normal} ✓")
    click.echo(f"待复核:        {pending} ⚠")
    click.echo(f"已复核:        {reviewed} ✓")
    click.echo(f"含工况照片:    {with_photos} 📷")
    click.echo(f"含人工修正:    {with_corrections}")
    click.echo("=" * 60)
    click.echo("可重跑命令:")
    click.echo("  查看记录列表:   python -m collision_playback list")
    click.echo("  查看记录详情:   python -m collision_playback show <记录ID>")
    click.echo("  通过传感器查:   python -m collision_playback show-by-sensor <编号>")
    click.echo("  重新回放:       python -m collision_playback playback <记录ID>")
    click.echo("  待复核列表:     python -m collision_playback pending")
    click.echo("  工程师复核:     python -m collision_playback review <记录ID>")
    click.echo("  复盘摘要:       python -m collision_playback summary")
    click.echo("=" * 60)


def main():
    cli()


if __name__ == "__main__":
    main()
