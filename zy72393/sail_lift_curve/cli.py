import click
import os
import sys

from sail_lift_curve.workflow import WorkflowEngine
from sail_lift_curve.visualizer import (
    plot_lift_curve_2d,
    plot_lift_curve_3d,
    generate_summary_chart,
)


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """实验风帆升力曲线 - 数据处理与报告生成工具"""
    pass


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--name", "-n", default="风帆升力曲线项目", help="项目名称")
@click.option("--output", "-o", default="./output", help="输出目录")
def import_data(file_path, name, output):
    """第1步: 导入设备铭牌参数数据"""
    click.echo(f"📂 正在导入数据: {file_path}")
    
    engine = WorkflowEngine(name=name)
    records, thresholds = engine.step1_import_equipment(file_path)
    
    click.echo(f"✅ 导入完成，共 {len(records)} 条记录")
    click.echo(f"⚠️  检测到 {len(thresholds)} 条被平均值盖掉的超阈值记录")
    
    os.makedirs(output, exist_ok=True)
    project_path = engine.save_project(output)
    
    click.echo(f"💾 项目已保存: {project_path}")
    click.echo("")
    click.echo("👉 下一步: 使用 review 命令让老岑复核待处理记录")
    
    if thresholds:
        click.echo("")
        click.echo("待处理记录列表:")
        for i, t in enumerate(thresholds, 1):
            equip = None
            for r in records:
                if r.record_id == t.equipment_record_id:
                    equip = r
                    break
            equip_name = equip.equipment_name if equip else "未知"
            click.echo(f"  {i}. 阈值记录ID: {t.record_id} | 设备: {equip_name} | 偏离: {t.deviation_percent:.1f}%")


@cli.command()
@click.argument("project_file", type=click.Path(exists=True))
@click.option("--threshold-id", "-t", help="阈值记录ID")
@click.option("--screenshot", "-s", help="维修群截图引用")
@click.option("--notes", "-m", default="", help="老岑备注")
@click.option("--confirm/--no-confirm", default=False, help="是否确认该记录")
@click.option("--list", "-l", "list_all", is_flag=True, help="列出所有待处理记录")
@click.option("--output", "-o", default="./output", help="输出目录")
def review(project_file, threshold_id, screenshot, notes, confirm, list_all, output):
    """第2步: 维修师傅老岑补看维修群截图并复核"""
    engine = WorkflowEngine.load_project(project_file)
    
    if list_all:
        pending = engine.get_pending_threshold_records()
        click.echo(f"📋 待处理记录 (共 {len(pending)} 条):")
        click.echo("-" * 70)
        for i, t in enumerate(pending, 1):
            detail = engine.get_record_detail(t.equipment_record_id)
            equip = detail["equipment_record"] if detail else None
            equip_name = equip.equipment_name if equip else "未知"
            equip_id = equip.equipment_id if equip else "未知"
            click.echo(f"  {i}. 阈值记录ID: {t.record_id}")
            click.echo(f"     设备: {equip_id} - {equip_name}")
            click.echo(f"     原始值: {t.raw_value:.4f} | 平均值: {t.averaged_value:.4f} | 偏离: {t.deviation_percent:.1f}%")
            click.echo(f"     状态: {t.status}")
            if equip and equip.maintenance_screenshot_ref:
                click.echo(f"     截图: {equip.maintenance_screenshot_ref}")
            click.echo("")
        return
    
    if not threshold_id:
        click.echo("❌ 请指定 --threshold-id 或使用 --list 查看待处理记录")
        sys.exit(1)
    
    click.echo(f"🔍 正在复核记录: {threshold_id}")
    
    result = engine.step2_laocen_review(
        threshold_record_id=threshold_id,
        screenshot_ref=screenshot,
        reviewer_notes=notes,
        confirm=confirm,
    )
    
    if not result:
        click.echo(f"❌ 未找到阈值记录: {threshold_id}")
        sys.exit(1)
    
    click.echo(f"✅ 复核完成")
    click.echo(f"   当前状态: {result.status}")
    if confirm:
        click.echo(f"   确认人: {result.confirmed_by}")
    
    project_path = engine.save_project(output)
    click.echo(f"💾 项目已保存: {project_path}")
    
    if confirm:
        click.echo("")
        click.echo("👉 下一步: 使用 convert 命令更新单位换算说明")


@cli.command()
@click.argument("project_file", type=click.Path(exists=True))
@click.option("--threshold-id", "-t", required=True, help="阈值记录ID")
@click.option("--original-unit", "-u", default="Cl", help="原始单位")
@click.option("--converted-unit", "-c", default="kgf", help="转换后单位")
@click.option("--factor", "-f", default=9.8, type=float, help="换算系数")
@click.option("--why-kept", "-w", required=True, help="为什么被留下")
@click.option("--missing", "-m", required=True, help="还缺什么材料")
@click.option("--next-action", "-a", required=True, help="下一步该找谁")
@click.option("--contact", "-p", default="老岑", help="联系人")
@click.option("--output", "-o", default="./output", help="输出目录")
def convert(project_file, threshold_id, original_unit, converted_unit, factor,
            why_kept, missing, next_action, contact, output):
    """第3步: 更新单位换算说明"""
    engine = WorkflowEngine.load_project(project_file)
    
    click.echo(f"📝 正在更新单位换算说明 (记录: {threshold_id})")
    
    note = engine.step3_update_conversion_note(
        threshold_record_id=threshold_id,
        original_unit=original_unit,
        converted_unit=converted_unit,
        conversion_factor=factor,
        why_kept=why_kept,
        missing_materials=missing,
        next_action=next_action,
        contact_person=contact,
    )
    
    if not note:
        click.echo(f"❌ 未找到阈值记录: {threshold_id}")
        sys.exit(1)
    
    click.echo(f"✅ 单位换算说明已更新")
    click.echo(f"   {note.original_value:.4f} {original_unit} = {note.converted_value:.4f} {converted_unit}")
    click.echo(f"   为什么留下: {why_kept}")
    click.echo(f"   缺什么材料: {missing}")
    click.echo(f"   下一步: {next_action}")
    click.echo(f"   联系人: {contact}")
    
    project_path = engine.save_project(output)
    click.echo(f"💾 项目已保存: {project_path}")


@cli.command()
@click.argument("project_file", type=click.Path(exists=True))
@click.option("--mode", "-m", type=click.Choice(["2d", "3d", "summary", "all"]), default="all", help="图表类型")
@click.option("--output", "-o", default="./output", help="输出目录")
def plot(project_file, mode, output):
    """生成升力曲线图表"""
    engine = WorkflowEngine.load_project(project_file)
    os.makedirs(output, exist_ok=True)
    
    curve_data = engine.get_lift_curve_data()
    
    if mode in ("2d", "all"):
        fig_2d = plot_lift_curve_2d(
            curve_data,
            records=engine.state.equipment_records,
            threshold_records=engine.state.threshold_records,
        )
        out_2d = os.path.join(output, f"lift_curve_2d_{engine.state.project_id}.html")
        fig_2d.write_html(out_2d, include_plotlyjs="cdn")
        click.echo(f"📊 2D曲线图已生成: {out_2d}")
    
    if mode in ("3d", "all"):
        fig_3d = plot_lift_curve_3d(
            curve_data,
            records=engine.state.equipment_records,
            threshold_records=engine.state.threshold_records,
        )
        out_3d = os.path.join(output, f"lift_curve_3d_{engine.state.project_id}.html")
        fig_3d.write_html(out_3d, include_plotlyjs="cdn")
        click.echo(f"📊 3D曲线图已生成: {out_3d}")
    
    if mode in ("summary", "all"):
        fig_summary = generate_summary_chart(
            engine.state.equipment_records,
            engine.state.threshold_records,
        )
        out_sum = os.path.join(output, f"summary_{engine.state.project_id}.html")
        fig_summary.write_html(out_sum, include_plotlyjs="cdn")
        click.echo(f"📊 数据概览图已生成: {out_sum}")


@cli.command()
@click.argument("project_file", type=click.Path(exists=True))
@click.option("--output", "-o", default="./output", help="输出目录")
def report(project_file, output):
    """生成完整的文本报告"""
    engine = WorkflowEngine.load_project(project_file)
    os.makedirs(output, exist_ok=True)
    
    report_text = engine.generate_report_text()
    
    out_file = os.path.join(output, f"report_{engine.state.project_id}.txt")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(report_text)
    
    click.echo(f"📄 报告已生成: {out_file}")
    click.echo("")
    click.echo(report_text)


@cli.command()
@click.argument("project_file", type=click.Path(exists=True))
def status(project_file):
    """查看项目当前状态"""
    engine = WorkflowEngine.load_project(project_file)
    
    click.echo("=" * 60)
    click.echo(f"📦 项目ID: {engine.state.project_id}")
    click.echo(f"📋 项目名称: {engine.state.name}")
    click.echo(f"📍 当前步骤: 第{engine.state.step}步 - {engine.state.step_description}")
    click.echo(f"⏰ 更新时间: {engine.state.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("-" * 60)
    
    total = len(engine.state.equipment_records)
    pending = len(engine.get_pending_threshold_records())
    confirmed = len(engine.get_confirmed_records())
    
    click.echo(f"📊 总记录数: {total}")
    click.echo(f"⚠️  待复核: {pending} 条")
    click.echo(f"✅ 已确认: {confirmed} 条")
    click.echo(f"📝 换算说明: {len(engine.state.unit_conversion_notes)} 条")
    
    click.echo("")
    if pending > 0:
        click.echo(f"🚨 还有 {pending} 条记录待老岑复核，请使用 review 命令处理")
    elif engine.state.step == 1:
        click.echo("👉 建议: 继续执行第2步 - 老岑复核待处理记录")
    elif engine.state.step == 2:
        click.echo("👉 建议: 继续执行第3步 - 更新单位换算说明")
    else:
        click.echo("✅ 所有步骤已完成！可生成报告或图表")


@cli.command()
@click.option("--output", "-o", default="./output", help="输出目录")
@click.option("--name", "-n", default="示例项目", help="项目名称")
def demo(output, name):
    """运行完整示例流程"""
    from . import create_sample_data
    
    click.echo("🚀 开始运行示例流程...")
    click.echo("")
    
    sample_path = create_sample_data(output)
    click.echo(f"📁 示例数据已生成: {sample_path}")
    click.echo("")
    
    click.echo("=" * 60)
    click.echo("第1步: 导入设备铭牌参数")
    click.echo("=" * 60)
    engine = WorkflowEngine(name=name)
    records, thresholds = engine.step1_import_equipment(sample_path)
    click.echo(f"✅ 导入 {len(records)} 条记录，发现 {len(thresholds)} 条被平均值盖掉的超阈值记录")
    click.echo("")
    
    if thresholds:
        t = thresholds[0]
        click.echo("=" * 60)
        click.echo("第2步: 老岑复核第一条记录")
        click.echo("=" * 60)
        click.echo(f"🔍 复核记录: {t.record_id}")
        result = engine.step2_laocen_review(
            threshold_record_id=t.record_id,
            screenshot_ref="wechat_group_20240615_001.png",
            reviewer_notes="现场核实，数据异常是因为传感器临时漂移，已复校",
            confirm=True,
        )
        click.echo(f"✅ 记录状态: {result.status} | 确认人: {result.confirmed_by}")
        click.echo("")
        
        click.echo("=" * 60)
        click.echo("第3步: 更新单位换算说明")
        click.echo("=" * 60)
        note = engine.step3_update_conversion_note(
            threshold_record_id=t.record_id,
            original_unit="Cl",
            converted_unit="kgf",
            conversion_factor=9.8,
            why_kept="虽然数值超阈值，但经过老岑现场确认是传感器漂移，非设备本身问题，数据可用于趋势分析",
            missing_materials="还缺该时段的设备运行日志、当时的气象条件记录",
            next_action="找维修师傅补充调取当时的设备运行日志，确认复校后的后续数据是否正常",
            contact_person="老岑",
        )
        click.echo(f"✅ 换算: {note.original_value:.4f} {note.original_unit} = {note.converted_value:.4f} {note.converted_unit}")
        click.echo(f"   为什么留下: {note.why_kept}")
        click.echo(f"   缺什么: {note.missing_materials}")
        click.echo(f"   下一步: {note.next_action}")
        click.echo("")
    
    click.echo("=" * 60)
    click.echo("生成报告和图表")
    click.echo("=" * 60)
    project_path = engine.save_project(output)
    click.echo(f"💾 项目保存: {project_path}")
    
    report_file = os.path.join(output, f"demo_report_{engine.state.project_id}.txt")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(engine.generate_report_text())
    click.echo(f"📄 报告: {report_file}")
    
    curve_data = engine.get_lift_curve_data()
    fig_2d = plot_lift_curve_2d(curve_data, engine.state.equipment_records, engine.state.threshold_records)
    plot_file = os.path.join(output, f"demo_curve_2d_{engine.state.project_id}.html")
    fig_2d.write_html(plot_file, include_plotlyjs="cdn")
    click.echo(f"📊 2D图: {plot_file}")
    
    click.echo("")
    click.echo("🎉 示例流程完成！请查看输出目录下的文件。")
    click.echo("")
    click.echo("提示: 你也可以手动运行以下命令来体验:")
    click.echo(f"  sail-lift import-data {sample_path}")
    click.echo(f"  sail-lift status {project_path}")
    click.echo(f"  sail-lift review --list {project_path}")
    click.echo(f"  sail-lift plot {project_path}")
    click.echo(f"  sail-lift report {project_path}")


def main():
    cli()


if __name__ == "__main__":
    main()
