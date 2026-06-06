#!/usr/bin/env python3
import os
import sys
import json
import click
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.storage import Storage
from core.engine import InspectionEngine
from core.report import ReportGenerator


def get_engine():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    storage = Storage(data_dir)
    return InspectionEngine(storage)


@click.group()
def cli():
    """光伏逆变器散热质检系统 - 质检员小白专用"""
    pass


@cli.command()
@click.option("--name", required=True, help="批次名称")
@click.option("--operator", default="质检员小白", help="操作人")
def create_batch(name, operator):
    """创建新的质检批次"""
    engine = get_engine()
    batch = engine.create_batch(name, operator)
    click.echo(f"✅ 已创建批次：{batch.name}（ID：{batch.id}）")


@cli.command()
def list_batches():
    """列出所有质检批次"""
    engine = get_engine()
    batches = engine.storage.list_batches()
    if not batches:
        click.echo("📭 暂无批次")
        return
    click.echo(f"共 {len(batches)} 个批次：")
    for b in batches:
        click.echo(f"  [{b['id']}] {b['name']} - {b['status']} - {b['abnormal_count']}条异常")


@cli.command()
@click.argument("batch_id")
@click.option("--filename", required=True, help="截图文件名")
@click.option("--data-file", type=click.Path(exists=True), help="截图解析结果JSON文件")
@click.option("--uploader", default="质检员小白", help="上传人")
def import_repair(batch_id, filename, data_file, uploader):
    """导入维修群截图"""
    engine = get_engine()

    if data_file:
        with open(data_file, "r", encoding="utf-8") as f:
            content = json.load(f)
    else:
        demo_dir = os.path.join(os.path.dirname(__file__), "data", "demo")
        demo_file = os.path.join(demo_dir, "repair_screenshot_demo.json")
        if os.path.exists(demo_file):
            with open(demo_file, "r", encoding="utf-8") as f:
                content = json.load(f)
            click.echo("ℹ️  使用演示数据")
        else:
            click.echo("❌ 请提供 --data-file 或准备演示数据")
            return

    batch, screenshot = engine.import_repair_screenshot(
        batch_id, filename, content, uploader=uploader
    )
    click.echo(f"✅ 已导入维修群截图：{filename}")
    click.echo(f"   生成 {len(batch.abnormal_records)} 条异常记录")


@cli.command()
@click.argument("batch_id")
@click.option("--filename", help="采样间隔说明文件名")
@click.option("--data-file", type=click.Path(exists=True), help="采样间隔说明JSON文件")
@click.option("--uploader", default="质检员小白", help="上传人")
def import_sampling(batch_id, filename, data_file, uploader):
    """补录采样间隔说明"""
    engine = get_engine()

    if data_file:
        with open(data_file, "r", encoding="utf-8") as f:
            content = json.load(f)
    else:
        demo_dir = os.path.join(os.path.dirname(__file__), "data", "demo")
        demo_file = os.path.join(demo_dir, "sampling_note_demo.json")
        if os.path.exists(demo_file):
            with open(demo_file, "r", encoding="utf-8") as f:
                content = json.load(f)
            click.echo("ℹ️  使用演示数据")
        else:
            click.echo("❌ 请提供 --data-file 或准备演示数据")
            return

    batch, note = engine.import_sampling_note(
        batch_id, content, filename=filename, uploader=uploader
    )
    click.echo(f"✅ 已补录采样间隔说明")
    click.echo(f"   更新后的异常记录：{len(batch.abnormal_records)} 条")


@cli.command()
@click.argument("batch_id")
@click.option("--format", "output_format", default="report",
              type=click.Choice(["report", "table", "audit", "json"]),
              help="输出格式")
def show(batch_id, output_format):
    """查看批次详情"""
    engine = get_engine()
    batch = engine.storage.load_batch(batch_id)
    if not batch:
        click.echo(f"❌ 批次 {batch_id} 不存在")
        return

    if output_format == "report":
        click.echo(ReportGenerator.generate_batch_report(batch))
    elif output_format == "table":
        click.echo(ReportGenerator.generate_abnormal_table(batch))
    elif output_format == "audit":
        click.echo(ReportGenerator.generate_audit_trail(batch))
    elif output_format == "json":
        import json as _json
        result = {
            "id": batch.id,
            "name": batch.name,
            "status": batch.status,
            "abnormal_count": len(batch.abnormal_records),
            "abnormal_records": [
                {
                    "point_id": r.point_id,
                    "point_name": r.point_name,
                    "status": r.status.value,
                    "direction_status": r.direction_status.value,
                    "keep_reason": r.keep_reason,
                    "missing_materials": r.missing_materials,
                    "next_handler": r.next_handler.value,
                    "is_field_dispute": r.is_field_dispute,
                }
                for r in batch.abnormal_records
            ]
        }
        click.echo(_json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("batch_id")
@click.option("--record-id", required=True, help="异常记录ID")
@click.option("--field", required=True, help="要修改的字段")
@click.option("--old-value", required=True, help="旧值")
@click.option("--new-value", required=True, help="新值")
@click.option("--reason", required=True, help="修改原因")
@click.option("--operator", default="质检员小白", help="操作人")
def correct(batch_id, record_id, field, old_value, new_value, reason, operator):
    """人工修正异常记录"""
    engine = get_engine()
    batch = engine.manual_correct(
        batch_id, record_id, field, old_value, new_value, reason, operator
    )
    click.echo(f"✅ 已修正记录 {record_id}")
    click.echo(f"   字段：{field}")
    click.echo(f"   变更：{old_value} → {new_value}")
    click.echo(f"   原因：{reason}")


@cli.command()
@click.argument("batch_id")
@click.option("--operator", default="质检员小白", help="操作人")
def rerun(batch_id, operator):
    """重跑质检分析"""
    engine = get_engine()
    batch = engine.rerun(batch_id, operator)
    click.echo(f"✅ 已重跑分析（第 {batch.run_count} 次）")
    click.echo(f"   当前异常记录：{len(batch.abnormal_records)} 条")


@cli.command()
@click.argument("batch_id")
@click.option("--record-id", required=True, help="异常记录ID")
@click.option("--resolution", required=True, help="复核结论")
@click.option("--operator", default="实验老师", help="操作人")
def review(batch_id, record_id, resolution, operator):
    """实验老师复核解决"""
    engine = get_engine()
    batch = engine.review_resolve(batch_id, record_id, resolution, operator)
    click.echo(f"✅ 已复核记录 {record_id}")
    click.echo(f"   结论：{resolution}")


@cli.command()
@click.option("--operator", default="质检员小白", help="操作人")
def demo(operator):
    """运行完整演示流程"""
    click.echo("🎬 开始运行光伏逆变器散热质检演示流程...")
    click.echo("")

    engine = get_engine()
    demo_dir = os.path.join(os.path.dirname(__file__), "data", "demo")

    click.echo("步骤 1/6：创建演示批次")
    batch = engine.create_batch("演示批次-2024-光伏逆变器散热", operator)
    click.echo(f"  ✅ 批次ID：{batch.id}")
    click.echo("")

    click.echo("步骤 2/6：导入维修群截图")
    repair_file = os.path.join(demo_dir, "repair_screenshot_demo.json")
    with open(repair_file, "r", encoding="utf-8") as f:
        repair_content = json.load(f)
    batch, _ = engine.import_repair_screenshot(
        batch.id, "维修群截图-20240601.png", repair_content, uploader=operator
    )
    click.echo(f"  ✅ 导入成功，生成 {len(batch.abnormal_records)} 条异常")
    click.echo("")

    click.echo("步骤 3/6：查看导入后的异常工况表")
    click.echo(ReportGenerator.generate_abnormal_table(batch))
    click.echo("")
    click.echo("  🔍 注意：测点 T002 被标记为'现场表述争议'")
    click.echo("     因为现场师傅把'负方向'说成了'向左'，留给实验老师复核")
    click.echo("")

    click.echo("步骤 4/6：补录采样间隔说明")
    sampling_file = os.path.join(demo_dir, "sampling_note_demo.json")
    with open(sampling_file, "r", encoding="utf-8") as f:
        sampling_content = json.load(f)
    batch, _ = engine.import_sampling_note(
        batch.id, sampling_content, filename="采样间隔说明.docx", uploader=operator
    )
    click.echo(f"  ✅ 补录成功，更新了异常记录")
    click.echo("")

    click.echo("步骤 5/6：查看补录后的异常工况表")
    click.echo(ReportGenerator.generate_abnormal_table(batch))
    click.echo("")

    click.echo("步骤 6/6：人工修正一次（演示修改备注）")
    if batch.abnormal_records:
        record = batch.abnormal_records[0]
        batch = engine.manual_correct(
            batch.id, record.id, "notes",
            "", "质检员小白已核对证据链完整",
            "补充核对记录", operator
        )
        click.echo(f"  ✅ 已修正 {record.point_name} 的备注")
    click.echo("")

    click.echo("🎬 演示流程完成！")
    click.echo("")
    click.echo(f"📋 查看完整报告：python cli.py show {batch.id}")
    click.echo(f"📋 查看审计追踪：python cli.py show {batch.id} --format audit")
    click.echo(f"📋 查看异常表格：python cli.py show {batch.id} --format table")
    click.echo("")
    click.echo("🧪 后续操作建议：")
    click.echo(f"  1. 重跑分析：python cli.py rerun {batch.id}")
    record_id = batch.abnormal_records[1].id if len(batch.abnormal_records) > 1 else batch.abnormal_records[0].id
    click.echo(f"  2. 实验老师复核T002：python cli.py review {batch.id} --record-id {record_id} --resolution '方向表述为口误，实际为负方向，判定正常'")


if __name__ == "__main__":
    cli()
