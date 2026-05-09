import click
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models import (
    ColorSample,
    BatchInfo,
    PaperBatch,
    InkAdjustment,
    SampleRecord,
    WorkflowStatus,
    AlertLevel,
    generate_id,
)
from ..core import (
    ColorEngine,
    AlertSystem,
    AlertConfig,
    ComparisonEngine,
    DEFAULT_TOLERANCE,
)
from ..services import DataService, ReportService


@click.group()
@click.version_option(version="1.0.0", prog_name="color-tracking")
@click.option("--data-dir", default="./data", help="数据目录路径")
@click.pass_context
def cli(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj["data_service"] = DataService(base_dir=data_dir)
    ctx.obj["alert_system"] = AlertSystem()
    ctx.obj["data_dir"] = data_dir


@cli.group()
def sample():
    """打样记录管理"""
    pass


@sample.command("create")
@click.option("--order-id", required=True, help="订单编号")
@click.option("--product-name", required=True, help="产品名称")
@click.option("--paper-type", required=True, help="纸张类型")
@click.option("--ink-type", required=True, help="油墨类型")
@click.option("--print-machine", required=True, help="印刷机台")
@click.option("--operator", required=True, help="操作员")
@click.option("--paper-batch", required=True, help="纸张批次号")
@click.option("--paper-manufacturer", required=True, help="纸张厂商")
@click.option("--paper-weight", type=float, required=True, help="纸张克重")
@click.option("--ref-l", type=float, required=True, help="参考色L值")
@click.option("--ref-a", type=float, required=True, help="参考色a值")
@click.option("--ref-b", type=float, required=True, help="参考色b值")
@click.option("--measured-l", type=float, required=True, help="测量色L值")
@click.option("--measured-a", type=float, required=True, help="测量色a值")
@click.option("--measured-b", type=float, required=True, help="测量色b值")
@click.option("--notes", default="", help="备注信息")
@click.pass_context
def create_sample(ctx, order_id, product_name, paper_type, ink_type,
                  print_machine, operator, paper_batch, paper_manufacturer,
                  paper_weight, ref_l, ref_a, ref_b,
                  measured_l, measured_a, measured_b, notes):
    """创建打样记录"""
    data_service = ctx.obj["data_service"]
    alert_system = ctx.obj["alert_system"]

    sequence = data_service.get_next_sequence_number(order_id)

    batch_info = BatchInfo(
        batch_id=generate_id("BATCH_"),
        order_id=order_id,
        product_name=product_name,
        paper_type=paper_type,
        ink_type=ink_type,
        print_machine=print_machine,
        operator=operator,
        notes=notes,
    )

    paper = PaperBatch(
        paper_id=generate_id("PAPER_"),
        batch_code=paper_batch,
        manufacturer=paper_manufacturer,
        weight=paper_weight,
    )

    reference = ColorSample(
        sample_id=generate_id("REF_"),
        lab_l=ref_l,
        lab_a=ref_a,
        lab_b=ref_b,
    )

    measured = ColorSample(
        sample_id=generate_id("MEAS_"),
        lab_l=measured_l,
        lab_a=measured_a,
        lab_b=measured_b,
    )

    color_delta = ColorEngine.calculate_color_delta(reference, measured)

    record = SampleRecord(
        record_id=generate_id("REC_"),
        sequence_number=sequence,
        batch_info=batch_info,
        paper_batch=paper,
        reference_sample=reference,
        measured_sample=measured,
        color_delta=color_delta,
        status=WorkflowStatus.COLOR_MEASURED,
    )

    status, alert_level = alert_system.determine_record_status(record)
    record.status = status
    record.alert_level = alert_level

    existing_records = data_service.load_records_by_order(order_id)
    if existing_records:
        paper_alerts = alert_system.check_paper_batch_change(record, existing_records)
        for alert in paper_alerts:
            click.echo(f"  [{alert.level.value}] {alert.message}")

    alerts = alert_system.analyze_record(record)
    for alert in alerts:
        click.echo(f"  [{alert.level.value}] {alert.message}")
        if alert.details.get("action_required"):
            click.echo(f"    建议操作: {alert.details['action_required']}")

    filepath = data_service.save_record(record)

    interpretation = ColorEngine.interpret_delta(color_delta)

    click.echo(f"\n{'='*60}")
    click.echo(f"打样记录已创建")
    click.echo(f"{'='*60}")
    click.echo(f"订单编号: {order_id}")
    click.echo(f"打样序号: {sequence}")
    click.echo(f"记录ID: {record.record_id}")
    click.echo(f"{'─'*60}")
    click.echo(f"色差分析:")
    click.echo(f"  ΔE76: {color_delta.delta_e76:.4f}")
    click.echo(f"  ΔE2000: {color_delta.delta_e2000:.4f}")
    click.echo(f"  ΔL: {color_delta.delta_l:+.4f}  Δa: {color_delta.delta_a:+.4f}  Δb: {color_delta.delta_b:+.4f}")
    click.echo(f"{'─'*60}")
    click.echo(f"颜色解读:")
    for item in interpretation["interpretations"]:
        click.echo(f"  - {item}")
    click.echo(f"{'─'*60}")
    click.echo(f"调整建议: {interpretation['recommendation']}")
    click.echo(f"{'─'*60}")
    click.echo(f"工作状态: {record.status.value}")
    click.echo(f"预警级别: {record.alert_level.value}")
    click.echo(f"{'─'*60}")
    click.echo(f"保存路径: {filepath}")
    click.echo(f"{'='*60}")


@sample.command("list")
@click.option("--order-id", required=True, help="订单编号")
@click.pass_context
def list_samples(ctx, order_id):
    """列出订单的所有打样记录"""
    data_service = ctx.obj["data_service"]
    records = data_service.load_records_by_order(order_id)

    if not records:
        click.echo(f"订单 {order_id} 没有打样记录")
        return

    click.echo(f"\n{'='*80}")
    click.echo(f"订单 {order_id} 打样记录列表")
    click.echo(f"{'='*80}")
    click.echo(f"{'序号':<6}{'ΔE2000':<12}{'ΔE76':<10}{'纸张批次':<15}{'状态':<12}{'预警':<10}")
    click.echo(f"{'─'*80}")

    for record in records:
        delta = record.color_delta
        click.echo(
            f"{record.sequence_number:<6}"
            f"{delta.delta_e2000:<12.4f}"
            f"{delta.delta_e76:<10.4f}"
            f"{record.paper_batch.batch_code:<15}"
            f"{record.status.value:<12}"
            f"{record.alert_level.value:<10}"
        )

    click.echo(f"{'='*80}")
    click.echo(f"总计: {len(records)} 条记录")


@sample.command("show")
@click.option("--order-id", required=True, help="订单编号")
@click.option("--sequence", type=int, help="打样序号")
@click.option("--record-id", help="记录ID")
@click.pass_context
def show_sample(ctx, order_id, sequence, record_id):
    """查看打样记录详情"""
    data_service = ctx.obj["data_service"]

    if record_id:
        record = data_service.load_record(order_id, record_id)
    elif sequence is not None:
        records = data_service.load_records_by_order(order_id)
        record = next((r for r in records if r.sequence_number == sequence), None)
    else:
        click.echo("请提供 --sequence 或 --record-id")
        return

    if not record:
        click.echo("未找到打样记录")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"打样记录详情")
    click.echo(f"{'='*60}")
    click.echo(f"记录ID: {record.record_id}")
    click.echo(f"打样序号: {record.sequence_number}")
    click.echo(f"{'─'*60}")
    click.echo(f"【批次信息】")
    click.echo(f"  订单编号: {record.batch_info.order_id}")
    click.echo(f"  产品名称: {record.batch_info.product_name}")
    click.echo(f"  纸张类型: {record.batch_info.paper_type}")
    click.echo(f"  油墨类型: {record.batch_info.ink_type}")
    click.echo(f"  印刷机台: {record.batch_info.print_machine}")
    click.echo(f"  操作员: {record.batch_info.operator}")
    click.echo(f"{'─'*60}")
    click.echo(f"【纸张批次】")
    click.echo(f"  批次号: {record.paper_batch.batch_code}")
    click.echo(f"  厂商: {record.paper_batch.manufacturer}")
    click.echo(f"  克重: {record.paper_batch.weight}g/m²")
    click.echo(f"{'─'*60}")
    click.echo(f"【颜色数据】")
    click.echo(f"  参考色: L={record.reference_sample.lab_l:.2f} "
               f"a={record.reference_sample.lab_a:.2f} "
               f"b={record.reference_sample.lab_b:.2f}")
    click.echo(f"  测量色: L={record.measured_sample.lab_l:.2f} "
               f"a={record.measured_sample.lab_a:.2f} "
               f"b={record.measured_sample.lab_b:.2f}")
    if record.color_delta:
        click.echo(f"{'─'*60}")
        click.echo(f"【色差分析】")
        click.echo(f"  ΔE2000: {record.color_delta.delta_e2000:.4f}")
        click.echo(f"  ΔE76: {record.color_delta.delta_e76:.4f}")
        click.echo(f"  ΔL: {record.color_delta.delta_l:+.4f}")
        click.echo(f"  Δa: {record.color_delta.delta_a:+.4f}")
        click.echo(f"  Δb: {record.color_delta.delta_b:+.4f}")
    if record.adjustments:
        click.echo(f"{'─'*60}")
        click.echo(f"【调整记录】")
        for adj in record.adjustments:
            click.echo(f"  - {adj.color_channel}: {adj.before_value:.2f} -> {adj.after_value:.2f}")
            click.echo(f"    原因: {adj.adjustment_reason}")
    click.echo(f"{'─'*60}")
    click.echo(f"工作状态: {record.status.value}")
    click.echo(f"预警级别: {record.alert_level.value}")
    click.echo(f"{'='*60}")


@cli.group()
def adjust():
    """油墨调整管理"""
    pass


@adjust.command("add")
@click.option("--order-id", required=True, help="订单编号")
@click.option("--sequence", type=int, required=True, help="打样序号")
@click.option("--channel", required=True, type=click.Choice(["C", "M", "Y", "K", "L", "A", "B"]),
              help="调整通道 (C/M/Y/K/L/A/B)")
@click.option("--before", type=float, required=True, help="调整前数值")
@click.option("--after", type=float, required=True, help="调整后数值")
@click.option("--reason", required=True, help="调整原因")
@click.option("--operator", required=True, help="调整人")
@click.pass_context
def add_adjustment(ctx, order_id, sequence, channel, before, after, reason, operator):
    """添加油墨调整记录"""
    data_service = ctx.obj["data_service"]

    records = data_service.load_records_by_order(order_id)
    record = next((r for r in records if r.sequence_number == sequence), None)

    if not record:
        click.echo(f"未找到第 {sequence} 次打样记录")
        return

    adjustment = InkAdjustment(
        adjustment_id=generate_id("ADJ_"),
        color_channel=channel,
        before_value=before,
        after_value=after,
        adjustment_reason=reason,
        adjusted_by=operator,
    )

    record.adjustments.append(adjustment)
    record.status = WorkflowStatus.ADJUSTMENT_APPLIED
    record.updated_at = datetime.now()

    filepath = data_service.save_record(record)

    click.echo(f"\n{'='*60}")
    click.echo(f"调整记录已添加")
    click.echo(f"{'='*60}")
    click.echo(f"打样序号: {sequence}")
    click.echo(f"调整通道: {channel}")
    click.echo(f"调整范围: {before:.2f} -> {after:.2f} (变化: {after-before:+.2f})")
    click.echo(f"调整原因: {reason}")
    click.echo(f"调整人: {operator}")
    click.echo(f"{'─'*60}")
    click.echo(f"保存路径: {filepath}")
    click.echo(f"{'='*60}")


@cli.group()
def review():
    """复核管理"""
    pass


@review.command("approve")
@click.option("--order-id", required=True, help="订单编号")
@click.option("--sequence", type=int, required=True, help="打样序号")
@click.option("--reviewer", required=True, help="复核人")
@click.option("--notes", default="", help="复核备注")
@click.pass_context
def approve_sample(ctx, order_id, sequence, reviewer, notes):
    """通过复核"""
    data_service = ctx.obj["data_service"]

    records = data_service.load_records_by_order(order_id)
    record = next((r for r in records if r.sequence_number == sequence), None)

    if not record:
        click.echo(f"未找到第 {sequence} 次打样记录")
        return

    record.approved = True
    record.status = WorkflowStatus.APPROVED
    record.reviewer = reviewer
    record.review_notes = notes
    record.updated_at = datetime.now()

    filepath = data_service.save_record(record)

    click.echo(f"\n{'='*60}")
    click.echo(f"复核通过")
    click.echo(f"{'='*60}")
    click.echo(f"打样序号: {sequence}")
    click.echo(f"复核人: {reviewer}")
    if notes:
        click.echo(f"复核备注: {notes}")
    click.echo(f"{'─'*60}")
    click.echo(f"保存路径: {filepath}")
    click.echo(f"{'='*60}")


@review.command("reject")
@click.option("--order-id", required=True, help="订单编号")
@click.option("--sequence", type=int, required=True, help="打样序号")
@click.option("--reviewer", required=True, help="复核人")
@click.option("--notes", required=True, help="拒绝原因")
@click.pass_context
def reject_sample(ctx, order_id, sequence, reviewer, notes):
    """拒绝复核"""
    data_service = ctx.obj["data_service"]

    records = data_service.load_records_by_order(order_id)
    record = next((r for r in records if r.sequence_number == sequence), None)

    if not record:
        click.echo(f"未找到第 {sequence} 次打样记录")
        return

    record.approved = False
    record.status = WorkflowStatus.REJECTED
    record.reviewer = reviewer
    record.review_notes = notes
    record.updated_at = datetime.now()

    filepath = data_service.save_record(record)

    click.echo(f"\n{'='*60}")
    click.echo(f"复核拒绝")
    click.echo(f"{'='*60}")
    click.echo(f"打样序号: {sequence}")
    click.echo(f"复核人: {reviewer}")
    click.echo(f"拒绝原因: {notes}")
    click.echo(f"{'─'*60}")
    click.echo(f"保存路径: {filepath}")
    click.echo(f"{'='*60}")


@cli.group()
def compare():
    """批次对比"""
    pass


@compare.command("order")
@click.option("--order-id", required=True, help="订单编号")
@click.pass_context
def compare_order(ctx, order_id):
    """对比订单的所有打样"""
    data_service = ctx.obj["data_service"]

    records = data_service.load_records_by_order(order_id)
    if not records:
        click.echo(f"订单 {order_id} 没有打样记录")
        return

    comparison = ComparisonEngine.compare_records(order_id, records)

    filepath = data_service.save_comparison(comparison)

    click.echo(f"\n{'='*80}")
    click.echo(f"批次对比分析")
    click.echo(f"{'='*80}")
    click.echo(f"订单编号: {order_id}")
    click.echo(f"对比ID: {comparison.comparison_id}")
    click.echo(f"打样总数: {len(records)}")
    click.echo(f"{'─'*80}")

    if comparison.delta_trend.get("delta_e2000"):
        deltas = comparison.delta_trend["delta_e2000"]
        trend = ComparisonEngine.analyze_trend(deltas)
        click.echo(f"【色差趋势】")
        click.echo(f"  最小ΔE2000: {min(deltas):.4f}")
        click.echo(f"  最大ΔE2000: {max(deltas):.4f}")
        click.echo(f"  平均ΔE2000: {sum(deltas)/len(deltas):.4f}")
        click.echo(f"  趋势: {trend.get('description', '无法分析')}")
        click.echo(f"  打样序列: {' -> '.join([f'{d:.2f}' for d in deltas])}")

    if comparison.adjustments_summary.get("total_adjustments", 0) > 0:
        click.echo(f"{'─'*80}")
        click.echo(f"【调整汇总】")
        adj = comparison.adjustments_summary
        click.echo(f"  总调整次数: {adj['total_adjustments']}")
        for channel, count in adj.get("by_channel", {}).items():
            click.echo(f"    {channel}: {count}次")

    if comparison.paper_batch_changes:
        click.echo(f"{'─'*80}")
        click.echo(f"【纸张批次变更】")
        for change in comparison.paper_batch_changes:
            click.echo(f"  - {change}")

    click.echo(f"{'─'*80}")
    click.echo(f"保存路径: {filepath}")
    click.echo(f"{'='*80}")


@cli.group()
def report():
    """报告管理"""
    pass


@report.command("generate")
@click.option("--order-id", required=True, help="订单编号")
@click.option("--output-dir", default="./output", help="输出目录")
@click.option("--format", "fmt", default="all",
              type=click.Choice(["json", "text", "csv", "all"]),
              help="导出格式")
@click.pass_context
def generate_report(ctx, order_id, output_dir, fmt):
    """生成追样报告"""
    data_service = ctx.obj["data_service"]

    records = data_service.load_records_by_order(order_id)
    if not records:
        click.echo(f"订单 {order_id} 没有打样记录")
        return

    comparison = ComparisonEngine.compare_records(order_id, records)
    report = ReportService.generate_tracking_report(order_id, records)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    saved_files = []

    if fmt in ["json", "all"]:
        report_path = data_service.save_report(report)
        saved_files.append(report_path)

    if fmt in ["text", "all"]:
        text_content = ReportService.generate_text_report(report, records, comparison)
        text_path = output_path / f"{order_id}_report_{timestamp}.txt"
        ReportService.save_text_report(text_content, str(text_path))
        saved_files.append(str(text_path))

    if fmt in ["csv", "all"]:
        csv_path = output_path / f"{order_id}_data_{timestamp}.csv"
        ReportService.export_to_csv(records, str(csv_path))
        saved_files.append(str(csv_path))

    click.echo(f"\n{'='*60}")
    click.echo(f"追样报告已生成")
    click.echo(f"{'='*60}")
    click.echo(f"订单编号: {order_id}")
    click.echo(f"报告编号: {report.report_id}")
    click.echo(f"{'─'*60}")
    click.echo(f"【报告摘要】")
    click.echo(f"  总打样次数: {report.total_samples}")
    click.echo(f"  通过: {report.approved_samples}  拒绝: {report.rejected_samples}  待复核: {report.pending_review}")
    click.echo(f"  平均ΔE2000: {report.avg_delta_e2000:.4f}")
    click.echo(f"{'─'*60}")
    click.echo(f"【保存文件】")
    for f in saved_files:
        click.echo(f"  - {f}")
    click.echo(f"{'='*60}")


@cli.group()
def orders():
    """订单管理"""
    pass


@orders.command("list")
@click.pass_context
def list_orders(ctx):
    """列出所有订单"""
    data_service = ctx.obj["data_service"]
    order_list = data_service.list_orders()

    if not order_list:
        click.echo("没有找到任何订单")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"订单列表")
    click.echo(f"{'='*60}")
    click.echo(f"{'订单编号':<20}{'打样次数':<12}{'最新状态':<20}")
    click.echo(f"{'─'*60}")

    for order_id in order_list:
        summary = data_service.get_order_summary(order_id)
        click.echo(
            f"{summary['order_id']:<20}"
            f"{summary['total_samples']:<12}"
            f"{summary.get('latest_status', 'N/A'):<20}"
        )

    click.echo(f"{'='*60}")
    click.echo(f"总计: {len(order_list)} 个订单")


@orders.command("summary")
@click.option("--order-id", required=True, help="订单编号")
@click.pass_context
def order_summary(ctx, order_id):
    """查看订单摘要"""
    data_service = ctx.obj["data_service"]
    summary = data_service.get_order_summary(order_id)

    if summary["total_samples"] == 0:
        click.echo(f"订单 {order_id} 没有打样记录")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"订单摘要")
    click.echo(f"{'='*60}")
    click.echo(f"订单编号: {summary['order_id']}")
    click.echo(f"总打样次数: {summary['total_samples']}")
    click.echo(f"最新打样序号: {summary['latest_sequence']}")
    click.echo(f"最新状态: {summary['latest_status']}")
    if summary['delta_e2000']['avg'] is not None:
        click.echo(f"{'─'*60}")
        click.echo(f"色差统计:")
        click.echo(f"  最小ΔE2000: {summary['delta_e2000']['min']:.4f}")
        click.echo(f"  最大ΔE2000: {summary['delta_e2000']['max']:.4f}")
        click.echo(f"  平均ΔE2000: {summary['delta_e2000']['avg']:.4f}")
    click.echo(f"{'='*60}")


if __name__ == "__main__":
    cli()
