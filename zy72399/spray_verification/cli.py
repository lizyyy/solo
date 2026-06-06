import sys
import click
from datetime import datetime
from .workflow import SprayVerificationWorkflow
from .sample_data import (
    create_normal_sample,
    create_missing_half_hour_sample,
    create_supplemented_old_caliber_sample,
    create_conflict_sample,
    get_all_samples,
)
from .review_diagram import (
    generate_review_table,
    generate_coverage_chart,
    export_history_report,
    print_conflict_evidence,
)
from .models import RecordStatus


@click.group()
def cli():
    """高压喷淋覆盖校验系统"""
    pass


@cli.command()
def run_full():
    """运行完整校验流程（包含三种场景）"""
    click.echo("=" * 60)
    click.echo("高压喷淋覆盖校验 - 完整流程")
    click.echo("=" * 60)

    workflow = SprayVerificationWorkflow()

    click.echo("\n[步骤1] 传感器编号第一次导入...")
    sensors, photos = get_all_samples()
    state = workflow.step1_import_sensor_records(sensors)
    _print_step_summary(state, "传感器导入完成")

    pending = workflow.get_pending_review_records()
    if pending:
        click.echo(f"\n⚠️  发现 {len(pending)} 条采样时间缺失半小时，留待质检员复核")
        for r in pending:
            click.echo(f"   - {r.record_id}: {r.sensor_record.sensor_id} {r.sensor_record.sample_time}")

    click.echo("\n[步骤2] 训练教练老唐补看工况照片...")
    state = workflow.step2_laotang_review_photos(photos)
    _print_step_summary(state, "老唐照片复核完成")

    conflicts = workflow.get_conflict_records()
    if conflicts:
        for r in conflicts:
            print_conflict_evidence(r)

    quality_review = {}
    pending = workflow.get_pending_review_records()
    for r in pending:
        quality_review[r.record_id] = True

    click.echo("\n[步骤3] 实验复盘图更新...")
    state = workflow.step3_update_review_diagram(quality_review)
    _print_step_summary(state, "复盘图更新完成")

    output_dir = "output"
    table = generate_review_table(state.records)
    click.echo("\n📊 校验结果汇总表:")
    click.echo(table.to_string(index=False))

    chart_path = generate_coverage_chart(state.records, f"{output_dir}/review_chart.png")
    click.echo(f"\n📈 覆盖率图表已生成: {chart_path}")

    report_path = export_history_report(state, f"{output_dir}/history_report.md")
    click.echo(f"📝 复盘记录已导出: {report_path}")

    click.echo("\n" + "=" * 60)
    click.echo("✅ 完整校验流程执行完毕！")
    click.echo("=" * 60)

    _print_rerun_commands()


@cli.command()
def run_normal():
    """仅运行正常材料校验"""
    click.echo("=" * 60)
    click.echo("高压喷淋覆盖校验 - 正常材料场景")
    click.echo("=" * 60)

    workflow = SprayVerificationWorkflow()
    sensor, photo = create_normal_sample()

    click.echo("\n[步骤1] 导入正常传感器记录...")
    state = workflow.step1_import_sensor_records([sensor], [photo])
    _print_step_summary(state, "正常材料导入完成")

    click.echo("\n[步骤2] 老唐复核工况照片...")
    state = workflow.step2_laotang_review_photos([photo])
    _print_step_summary(state, "老唐复核完成")

    click.echo("\n[步骤3] 更新复盘图...")
    state = workflow.step3_update_review_diagram()
    _print_step_summary(state, "复盘图更新完成")

    table = generate_review_table(state.records)
    click.echo("\n📊 结果:")
    click.echo(table.to_string(index=False))

    _verify_record_status(state.records[0], RecordStatus.NORMAL, "正常记录")

    _print_rerun_commands()


@cli.command()
def run_missing():
    """运行采样时间缺半小时场景"""
    click.echo("=" * 60)
    click.echo("高压喷淋覆盖校验 - 采样时间缺半小时场景")
    click.echo("=" * 60)

    workflow = SprayVerificationWorkflow()
    sensor, photo = create_missing_half_hour_sample()

    click.echo("\n[步骤1] 导入传感器记录（采样时间缺半小时）...")
    state = workflow.step1_import_sensor_records([sensor])
    _print_step_summary(state, "导入完成")

    pending = workflow.get_pending_review_records()
    click.echo(f"\n⚠️  采样时间缺失半小时，初始状态设为待质检员复核，不归为正常")
    for r in pending:
        click.echo(f"   - 采样时间: {r.sensor_record.sample_time}")
        click.echo(f"   - 当前状态: {r.status.value}")

    click.echo("\n[步骤2] 老唐补看工况照片...")
    state = workflow.step2_laotang_review_photos([photo])
    _print_step_summary(state, "老唐复核完成")

    click.echo("\n[步骤3] 质检员复核后更新复盘图...")
    quality_review = {state.records[0].record_id: True}
    state = workflow.step3_update_review_diagram(quality_review)
    _print_step_summary(state, "复盘图更新完成")

    table = generate_review_table(state.records)
    click.echo("\n📊 结果:")
    click.echo(table.to_string(index=False))

    _verify_record_status(state.records[0], RecordStatus.MISSING_HALF_HOUR, "采样时间缺半小时（已确认）")

    _print_rerun_commands()


@cli.command()
def run_supplement():
    """运行从工况照片补录旧口径场景"""
    click.echo("=" * 60)
    click.echo("高压喷淋覆盖校验 - 工况照片补录旧口径场景")
    click.echo("=" * 60)

    workflow = SprayVerificationWorkflow()
    sensor, photo = create_supplemented_old_caliber_sample()

    click.echo(f"\n初始传感器口径: {sensor.caliber.value}")
    click.echo(f"工况照片口径: {photo.caliber.value}")
    click.echo(f"照片补录说明: {photo.supplement_note}")

    click.echo("\n[步骤1] 导入传感器记录...")
    state = workflow.step1_import_sensor_records([sensor])
    _print_step_summary(state, "导入完成")

    click.echo("\n[步骤2] 老唐补看工况照片，应用旧口径补录...")
    state = workflow.step2_laotang_review_photos([photo])
    _print_step_summary(state, "补录完成")

    record = state.records[0]
    click.echo(f"\n📝 补录后口径: {record.sensor_record.caliber.value}")
    click.echo(f"   数据来源: {record.sensor_record.source}")
    click.echo(f"   备注: {record.sensor_record.notes}")

    click.echo("\n[步骤3] 更新复盘图...")
    state = workflow.step3_update_review_diagram()
    _print_step_summary(state, "复盘图更新完成")

    table = generate_review_table(state.records)
    click.echo("\n📊 结果:")
    click.echo(table.to_string(index=False))

    _verify_record_status(state.records[0], RecordStatus.SUPPLEMENTED, "照片补录（旧口径）")

    _print_rerun_commands()


@cli.command()
def run_conflict():
    """运行传感器与工况照片口径冲突场景"""
    click.echo("=" * 60)
    click.echo("高压喷淋覆盖校验 - 口径冲突场景")
    click.echo("=" * 60)

    workflow = SprayVerificationWorkflow()
    sensor, photo = create_conflict_sample()

    click.echo(f"\n传感器口径: {sensor.caliber.value}")
    click.echo(f"工况照片口径: {photo.caliber.value}")

    click.echo("\n[步骤1] 导入传感器和照片...")
    state = workflow.step1_import_sensor_records([sensor], [photo])
    _print_step_summary(state, "导入完成")

    conflicts = workflow.get_conflict_records()
    for r in conflicts:
        print_conflict_evidence(r)

    click.echo("⚠️  系统不自动拍板，列出冲突证据供老唐选择")

    def mock_laotang_choice(record):
        click.echo("🤖 模拟老唐选择: [1] 确认 - 以照片为准")
        return True

    click.echo("\n[步骤2] 老唐人工确认冲突...")
    state = workflow.step2_laotang_review_photos([photo], conflict_resolver=mock_laotang_choice)
    _print_step_summary(state, "冲突处理完成")

    record = state.records[0]
    click.echo(f"\n📝 处理后状态: {record.status.value}")
    click.echo(f"   复核人: {record.reviewer}")

    click.echo("\n[步骤3] 更新复盘图...")
    state = workflow.step3_update_review_diagram()
    _print_step_summary(state, "复盘图更新完成")

    table = generate_review_table(state.records)
    click.echo("\n📊 结果:")
    click.echo(table.to_string(index=False))

    _verify_record_status(state.records[0], RecordStatus.CONFIRMED, "冲突已确认（以照片为准）")

    _print_rerun_commands()


def _print_step_summary(state, title):
    summary = {
        "total": len(state.records),
        "normal": sum(1 for r in state.records if r.status == RecordStatus.NORMAL),
        "missing": sum(1 for r in state.records if r.status == RecordStatus.MISSING_HALF_HOUR),
        "pending": sum(1 for r in state.records if r.status == RecordStatus.PENDING_REVIEW),
        "supplemented": sum(1 for r in state.records if r.status == RecordStatus.SUPPLEMENTED),
        "conflict": sum(1 for r in state.records if r.status == RecordStatus.CONFLICT),
        "confirmed": sum(1 for r in state.records if r.status == RecordStatus.CONFIRMED),
    }
    click.echo(f"✅ {title} | 总计:{summary['total']} 正常:{summary['normal']} "
               f"待复核:{summary['pending']} 缺半小时:{summary['missing']} "
               f"补录:{summary['supplemented']} 冲突:{summary['conflict']} 已确认:{summary['confirmed']}")


def _verify_record_status(record, expected_status, description):
    if record.status == expected_status:
        click.echo(f"\n✅ 验证通过: {description}")
        click.echo(f"   记录ID: {record.record_id}")
        click.echo(f"   状态: {record.status.value}")
    else:
        click.echo(f"\n❌ 验证失败: 期望状态 {expected_status.value}，实际 {record.status.value}")
        sys.exit(1)


def _print_rerun_commands():
    click.echo("\n" + "-" * 60)
    click.echo("🔄 可重新运行的命令:")
    click.echo("   完整流程: python -m spray_verification.cli run-full")
    click.echo("   正常材料: python -m spray_verification.cli run-normal")
    click.echo("   缺半小时: python -m spray_verification.cli run-missing")
    click.echo("   补录口径: python -m spray_verification.cli run-supplement")
    click.echo("   冲突场景: python -m spray_verification.cli run-conflict")
    click.echo("-" * 60)


if __name__ == "__main__":
    cli()
