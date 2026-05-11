"""CLI命令入口"""

import click
from datetime import datetime
from typing import Optional

from .datastore import DataStore
from .importer import DataImporter
from .calculator import FeeCalculator
from .exception_detector import ExceptionDetector
from .exporter import ReportExporter
from .models import CancellationStatus


@click.group()
@click.option("--db", default="freight_cancel.db", help="数据库文件路径")
@click.pass_context
def main(ctx, db):
    ctx.ensure_object(dict)
    ctx.obj["store"] = DataStore(db)


@main.command()
@click.argument("file_path")
@click.option("--type", type=click.Choice(["bookings", "schedules", "cancellations"]), required=True)
@click.pass_context
def import_data(ctx, file_path, type):
    store = ctx.obj["store"]
    importer = DataImporter(store)

    if type == "bookings":
        count = importer.import_bookings_from_csv(file_path)
        click.echo(f"导入订舱记录: {count} 条")
    elif type == "schedules":
        count = importer.import_schedules_from_csv(file_path)
        click.echo(f"导入船期规则: {count} 条")
    else:
        records = importer.import_cancellations_from_csv(file_path)
        click.echo(f"导入取消/改船记录: {len(records)} 条，等待核算")


@main.command()
@click.option("--record-id", help="指定记录ID重新核算")
@click.pass_context
def calculate(ctx, record_id):
    store = ctx.obj["store"]
    calculator = FeeCalculator(store)
    detector = ExceptionDetector(store)

    records = []
    if record_id:
        rec = store.get_cancellation(record_id)
        if not rec:
            click.echo(f"记录不存在: {record_id}")
            return
        records.append(rec)
    else:
        all_records = store.get_all_cancellations()
        records = [r for r in all_records if not r.processed or r.status == CancellationStatus.EXCEPTION]

    for rec in records:
        exceptions = detector.detect(rec)
        rec.exceptions = exceptions

        if any("已处理的取消" in e for e in exceptions):
            rec.is_repeat_import = True
            click.echo(f"\n[重复导入] {rec.booking_no}: 检测到重复导入，跳过核算")
            store.save_cancellation(rec)
            continue

        if detector.is_fatal_exception(exceptions):
            rec.status = CancellationStatus.EXCEPTION
            click.echo(f"\n[异常] {rec.booking_no}: {'; '.join(exceptions)}")
            store.save_cancellation(rec)
            continue

        result = calculator.calculate(rec)
        
        rec.original_fee = result.original_fee
        rec.charged_fee = result.charged_fee
        rec.status = result.status
        rec.processed = True

        click.echo(f"\n[核算完成] {rec.booking_no}")
        click.echo(f"  状态: {rec.status.value}")
        click.echo(f"  原始费用: ¥{rec.original_fee:.2f}")
        if rec.original_fee != rec.charged_fee:
            click.echo(f"  减免金额: ¥{rec.original_fee - rec.charged_fee:.2f}")
        click.echo(f"  实际费用: ¥{rec.charged_fee:.2f}")
        click.echo(f"  说明: {result.reason}")
        if rec.exceptions:
            click.echo(f"  异常: {'; '.join(rec.exceptions)}")

        store.save_cancellation(rec)

    if not records:
        click.echo("没有待核算的记录")


@main.command()
@click.argument("record_id")
@click.option("--waive-amount", type=float, required=True, help="减免后的金额")
@click.option("--reason", required=True, help="减免原因")
@click.option("--operator", required=True, help="操作人")
@click.pass_context
def waive(ctx, record_id, waive_amount, reason, operator):
    store = ctx.obj["store"]
    rec = store.get_cancellation(record_id)
    if not rec:
        click.echo(f"记录不存在: {record_id}")
        return

    if waive_amount > rec.original_fee:
        click.echo(f"错误：减免后金额({waive_amount})不能大于原始费用({rec.original_fee})")
        return

    if waive_amount < 0:
        click.echo("错误：减免后金额不能为负数")
        return

    click.echo(f"\n原始费用对照:")
    click.echo(f"  订舱号: {rec.booking_no}")
    click.echo(f"  原始状态: {rec.status.value}")
    click.echo(f"  规则计算费用: ¥{rec.original_fee:.2f}")
    click.echo(f"  当前收取费用: ¥{rec.charged_fee:.2f}")

    rec.charged_fee = waive_amount
    rec.status = CancellationStatus.WAIVED
    rec.waiver_reason = reason
    rec.waiver_operator = operator
    rec.waiver_time = datetime.now()

    store.save_cancellation(rec)

    click.echo(f"\n减免后:")
    click.echo(f"  新状态: {rec.status.value}")
    click.echo(f"  减免金额: ¥{rec.original_fee - waive_amount:.2f}")
    click.echo(f"  实际收取: ¥{waive_amount:.2f}")
    click.echo(f"  减免原因: {reason}")
    click.echo(f"  操作人: {operator}")


@main.command()
@click.argument("record_id")
@click.pass_context
def detail(ctx, record_id):
    store = ctx.obj["store"]
    rec = store.get_cancellation(record_id)
    if not rec:
        click.echo(f"记录不存在: {record_id}")
        return

    booking = store.get_booking(rec.booking_no)
    schedule = None
    if booking:
        schedule = store.get_schedule_rule(booking.vessel_name, booking.voyage_no)

    click.echo("=" * 70)
    click.echo("单票详情")
    click.echo("=" * 70)

    click.echo(f"\n【取消记录信息】")
    click.echo(f"  记录ID: {rec.id}")
    click.echo(f"  订舱号: {rec.booking_no}")
    click.echo(f"  客户编号: {rec.customer_id}")
    click.echo(f"  取消类型: {rec.cancellation_type.value}")
    click.echo(f"  取消时间: {rec.cancellation_time.strftime('%Y-%m-%d %H:%M:%S')}")
    if rec.new_vessel_name:
        click.echo(f"  新船名: {rec.new_vessel_name}")
    if rec.new_voyage_no:
        click.echo(f"  新航次: {rec.new_voyage_no}")
    click.echo(f"  原舱位释放: {'是' if rec.original_vessel_released else '否'}")
    click.echo(f"  重复导入: {'是' if rec.is_repeat_import else '否'}")

    if booking:
        click.echo(f"\n【订舱信息】")
        click.echo(f"  客户名称: {booking.customer_name}")
        click.echo(f"  客户等级: {booking.customer_level.value}")
        click.echo(f"  船名航次: {booking.vessel_name} {booking.voyage_no}")
        click.echo(f"  起运港/目的港: {booking.origin_port} -> {booking.destination_port}")
        click.echo(f"  柜型柜量: {booking.container_type} x {booking.container_qty}")
        click.echo(f"  海运费单价: ¥{booking.freight_rate:.2f}")

    if schedule:
        click.echo(f"\n【船期规则】")
        click.echo(f"  ETD: {schedule.etd.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"  截关时间: {schedule.cutoff_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"  免费取消小时数: {schedule.free_cancel_hours}h")
        click.echo(f"  取消费比例: {schedule.charge_rate * 100}%")
        click.echo(f"  赔付比例: {schedule.compensation_rate * 100}%")

    click.echo(f"\n【费用详情】")
    click.echo(f"  处理状态: {rec.status.value}")
    click.echo(f"  规则计算费用(原始): ¥{rec.original_fee:.2f}")
    click.echo(f"  实际收取费用: ¥{rec.charged_fee:.2f}")
    if rec.original_fee != rec.charged_fee:
        click.echo(f"  减免金额: ¥{rec.original_fee - rec.charged_fee:.2f}")

    if rec.waiver_reason:
        click.echo(f"\n【人工减免信息】")
        click.echo(f"  减免原因: {rec.waiver_reason}")
        click.echo(f"  操作人: {rec.waiver_operator}")
        click.echo(f"  减免时间: {rec.waiver_time.strftime('%Y-%m-%d %H:%M:%S')}")

    if rec.exceptions:
        click.echo(f"\n【异常信息】")
        for e in rec.exceptions:
            click.echo(f"  - {e}")

    click.echo("\n" + "=" * 70)


@main.command()
@click.argument("output_path")
@click.option("--format", type=click.Choice(["csv", "txt"]), default="csv")
@click.option("--booking-no", help="指定订舱号")
@click.pass_context
def export(ctx, output_path, format, booking_no):
    store = ctx.obj["store"]
    exporter = ReportExporter(store)

    if format == "csv":
        exporter.export_summary_csv(output_path)
        click.echo(f"CSV报告已导出: {output_path}")
    else:
        exporter.export_detail_report(output_path, booking_no)
        click.echo(f"明细报告已导出: {output_path}")


@main.command()
@click.pass_context
def list_records(ctx):
    store = ctx.obj["store"]
    records = store.get_all_cancellations()
    
    if not records:
        click.echo("暂无记录")
        return

    click.echo(f"{'ID':<38} {'订舱号':<12} {'类型':<10} {'状态':<14} {'原始费用':<12} {'实际费用':<12} {'异常':<10}")
    click.echo("-" * 110)
    for r in records:
        click.echo(
            f"{r.id:<38} {r.booking_no:<12} {r.cancellation_type.value:<10} "
            f"{r.status.value:<14} ¥{r.original_fee:<10.2f} ¥{r.charged_fee:<10.2f} "
            f"{'是' if r.exceptions else '否':<10}"
        )


if __name__ == "__main__":
    main(obj={})
