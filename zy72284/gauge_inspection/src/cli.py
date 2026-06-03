import json
import os
import sys
from typing import Optional

import click

from .workflow import GaugeInspectionWorkflow
from .coord_detector import CoordinateDetector
from .models import PointCloudLog, SafetyRadiusTable, CoordinateIssue, SiteNote

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@click.group()
@click.version_option(version="1.0.0", prog_name="gauge-inspection")
def cli():
    """轨道交通限界检查系统 - 阿景与巡检组的协作工具"""
    pass

@cli.group()
def workflow():
    """工作流程管理"""
    pass

@workflow.command("step1")
@click.option("--log-no", required=True, help="点云抽稀日志编号")
@click.option("--input-file", required=True, type=click.Path(exists=True), help="点云数据JSON文件路径")
@click.option("--imported-by", default="system", help="导入人")
def step1_import(log_no: str, input_file: str, imported_by: str):
    """【第一步】导入点云抽稀日志，自动检测坐标问题"""
    wf = GaugeInspectionWorkflow()
    
    with open(input_file, "r", encoding="utf-8") as f:
        items = json.load(f)
    
    click.echo(f"\n{'='*60}")
    click.echo(f"🚀 正在执行第一步：导入点云抽稀日志")
    click.echo(f"{'='*60}")
    click.echo(f"日志编号: {log_no}")
    click.echo(f"数据条数: {len(items)}")
    click.echo(f"导入人: {imported_by}")
    click.echo()
    
    log, issues = wf.step1_import_point_cloud_log(log_no, items, imported_by)
    
    click.echo(f"✅ 点云日志导入成功，ID: {log.id}")
    click.echo()
    
    mixed_count = len([x for x in issues if x["issue"].is_mixed])
    click.echo(f"📊 检测结果: 共{len(issues)}条，其中{click.style(str(mixed_count), fg='red', bold=True)}条坐标混合")
    click.echo()
    
    for item_data in issues:
        issue = item_data["issue"]
        detection = item_data["detection"]
        note = item_data["site_note"]
        
        status_icon = "⚠️ " if issue.is_mixed else "✅"
        status_color = "red" if issue.is_mixed else "green"
        
        click.echo(f"{status_icon} 【{issue.item_identifier}】 {click.style(detection.coord_type, fg=status_color, bold=True)}")
        click.echo(f"   坐标: X={detection.raw_x}, Y={detection.raw_y}, Z={detection.raw_z}")
        click.echo(f"   判定: X轴={detection.x_type}, Y轴={detection.y_type}, Z轴={detection.z_type}")
        click.echo(f"   📝 为什么留下: {note.why_kept}")
        if note.missing_materials:
            click.echo(f"   🔍 还缺材料: {note.missing_materials}")
        click.echo(f"   ➡️  下一步: {note.next_action}")
        click.echo(f"   👤 联系人: {note.contact_person}")
        click.echo()

@workflow.command("step2")
@click.option("--table-no", required=True, help="安全半径表编号")
@click.option("--input-file", required=True, type=click.Path(exists=True), help="安全半径表JSON文件路径")
@click.option("--reviewed-by", default="ajing", help="复核人（展陈设计师阿景）")
def step2_review(table_no: str, input_file: str, reviewed_by: str):
    """【第二步】展陈设计师阿景补看安全半径表，更新现场说明"""
    wf = GaugeInspectionWorkflow()
    
    with open(input_file, "r", encoding="utf-8") as f:
        items = json.load(f)
    
    click.echo(f"\n{'='*60}")
    click.echo(f"🎨 正在执行第二步：展陈设计师阿景补看安全半径表")
    click.echo(f"{'='*60}")
    click.echo(f"表格编号: {table_no}")
    click.echo(f"数据条数: {len(items)}")
    click.echo(f"复核人: {reviewed_by}")
    click.echo()
    
    try:
        table, updated = wf.step2_review_safety_radius_table(table_no, items, reviewed_by)
    except ValueError as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(1)
    
    click.echo(f"✅ 安全半径表复核完成，ID: {table.id}")
    click.echo()
    
    for item_data in updated:
        issue = item_data["issue"]
        note = item_data["site_note"]
        
        if "warning" in item_data:
            click.echo(f"⚠️  【{issue.item_identifier}】 {click.style(item_data['warning'], fg='yellow')}")
            click.echo()
            continue
        
        detection = item_data["detection"]
        
        status_icon = "⚠️ " if issue.is_mixed else "✅"
        status_color = "red" if issue.is_mixed else "green"
        
        click.echo(f"{status_icon} 【{issue.item_identifier}】 {click.style(detection.coord_type, fg=status_color, bold=True)}")
        click.echo(f"   坐标: X={detection.raw_x}, Y={detection.raw_y}")
        click.echo(f"   安全半径: {item_data['safety_item']['safety_radius']}米")
        click.echo(f"   📝 为什么留下: {note.why_kept}")
        if note.missing_materials:
            click.echo(f"   🔍 还缺材料: {note.missing_materials}")
        click.echo(f"   ➡️  下一步: {note.next_action}")
        click.echo(f"   👤 联系人: {note.contact_person}")
        click.echo(f"   📄 说明版本: v{note.version}")
        click.echo()

@workflow.command("step3")
@click.option("--inspector", default="巡检组", help="巡检组负责人")
def step3_finalize(inspector: str):
    """【第三步】给现场班组看的说明更新，标记最终处理方式"""
    wf = GaugeInspectionWorkflow()
    
    click.echo(f"\n{'='*60}")
    click.echo(f"🏗️  正在执行第三步：更新现场班组说明")
    click.echo(f"{'='*60}")
    click.echo(f"巡检负责人: {inspector}")
    click.echo()
    
    finalized = wf.step3_finalize_for_site_team(inspector)
    
    click.echo(f"✅ 已更新{len(finalized)}条现场说明")
    click.echo()
    
    for item_data in finalized:
        issue = item_data["issue"]
        note = item_data["site_note"]
        action_required = item_data.get("action_required", True)
        
        if action_required:
            status_icon = "🚧"
            status_color = "yellow"
        else:
            status_icon = "✅"
            status_color = "green"
        
        extra_note = item_data.get("note", "")
        if extra_note:
            click.echo(f"ℹ️  {extra_note}")
        
        click.echo(f"{status_icon} 【{issue.item_identifier}】 {click.style(issue.status, fg=status_color, bold=True)}")
        click.echo(f"   📝 为什么留下: {note.why_kept}")
        if note.missing_materials:
            click.echo(f"   🔍 还缺材料: {note.missing_materials}")
        click.echo(f"   ➡️  下一步: {note.next_action}")
        click.echo(f"   👤 联系人: {note.contact_person}")
        click.echo(f"   📄 说明版本: v{note.version}")
        click.echo()

@workflow.command("status")
def workflow_status():
    """查看工作流当前状态"""
    wf = GaugeInspectionWorkflow()
    status = wf.get_workflow_status()
    
    click.echo(f"\n{'='*60}")
    click.echo("📋 工作流状态")
    click.echo(f"{'='*60}")
    click.echo()
    
    for step in status:
        status_icon = {
            "pending": "⏳",
            "in_progress": "🔄",
            "completed": "✅"
        }.get(step["status"], "❓")
        
        status_color = {
            "pending": "yellow",
            "in_progress": "blue",
            "completed": "green"
        }.get(step["status"], "white")
        
        click.echo(f"{status_icon} 第{step['step_order']}步: {click.style(step['step_name'], fg=status_color, bold=True)}")
        click.echo(f"   状态: {step['status']}")
        if step["operator"]:
            click.echo(f"   操作人: {step['operator']}")
        if step["started_time"]:
            click.echo(f"   开始时间: {step['started_time']}")
        if step["completed_time"]:
            click.echo(f"   完成时间: {step['completed_time']}")
        if step["remark"]:
            click.echo(f"   备注: {step['remark']}")
        click.echo()

@workflow.command("reset")
@click.confirmation_option(prompt="确定要重置工作流状态吗？这不会删除已导入的数据")
def workflow_reset():
    """重置工作流状态（不删除数据）"""
    wf = GaugeInspectionWorkflow()
    wf.reset_workflow()
    click.echo("✅ 工作流状态已重置")

@cli.command("issues")
@click.option("--issue-id", type=int, help="查看指定问题详情")
def list_issues(issue_id: Optional[int]):
    """查看所有坐标问题及现场说明"""
    wf = GaugeInspectionWorkflow()
    
    if issue_id:
        issue = CoordinateIssue.get_by_id(issue_id)
        if not issue:
            click.echo(f"❌ 找不到ID为{issue_id}的问题记录")
            return
        note = SiteNote.get_by_issue_id(issue_id)
        issues_with_notes = [{"issue": issue, "site_note": note}]
    else:
        issues_with_notes = wf.get_all_issues_with_notes()
    
    click.echo(f"\n{'='*60}")
    click.echo(f"🔍 坐标问题列表（共{len(issues_with_notes)}条）")
    click.echo(f"{'='*60}")
    click.echo()
    
    for item in issues_with_notes:
        issue = item["issue"]
        note = item["site_note"]
        
        status_icon = "⚠️ " if issue.is_mixed else "✅"
        status_color = "red" if issue.is_mixed else "green"
        
        click.echo(f"{status_icon} ID:{issue.id} 【{issue.item_identifier}】 {click.style(issue.coord_type_detected, fg=status_color, bold=True)}")
        click.echo(f"   状态: {click.style(issue.status, fg='cyan')}")
        click.echo(f"   坐标: X={issue.original_coord_x}, Y={issue.original_coord_y}")
        if note:
            click.echo(f"   📝 为什么留下: {note.why_kept}")
            if note.missing_materials:
                click.echo(f"   🔍 还缺材料: {note.missing_materials}")
            click.echo(f"   ➡️  下一步: {note.next_action}")
            click.echo(f"   👤 联系人: {note.contact_person}")
            click.echo(f"   📄 版本: v{note.version} (更新于 {note.last_updated_time})")
        click.echo()

@cli.command("detect")
@click.option("--x", required=True, help="X坐标值")
@click.option("--y", required=True, help="Y坐标值")
@click.option("--z", help="Z坐标值（可选）")
def detect_coord(x: str, y: str, z: Optional[str]):
    """检测单个坐标的坐标系类型"""
    result = CoordinateDetector.detect(x, y, z)
    click.echo(CoordinateDetector.explain_detection(result))

@cli.command("run-full-demo")
@click.option("--reset-db", is_flag=True, help="运行前重置数据库")
def run_full_demo(reset_db: bool):
    """运行完整演示流程（三步走通）"""
    if reset_db:
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "db", "gauge_inspection.db")
        if os.path.exists(db_path):
            os.remove(db_path)
            click.echo("🗑️  已重置数据库")
    
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples")
    point_cloud_file = os.path.join(base_dir, "point_cloud_log_001.json")
    safety_radius_file = os.path.join(base_dir, "safety_radius_table_001.json")
    
    click.echo(click.style("\n" + "="*60, fg="cyan", bold=True))
    click.echo(click.style("🚄 轨道交通限界检查系统 - 完整演示", fg="cyan", bold=True))
    click.echo(click.style("="*60, fg="cyan", bold=True))
    
    click.echo(click.style("\n📖 背景故事:", fg="yellow", bold=True))
    click.echo("展陈设计师阿景做'轨道交通限界检查'时最怕临时补材料，")
    click.echo("尤其是点云抽稀日志已经确认、安全半径表又冒出经纬度和米制坐标混在一起。")
    click.echo("今天我们来模拟这个场景...")
    
    wf = GaugeInspectionWorkflow()
    
    click.echo(click.style("\n" + "="*60, fg="blue", bold=True))
    click.echo(click.style("📍 第一步：点云抽稀日志第一次导入", fg="blue", bold=True))
    click.echo(click.style("="*60, fg="blue", bold=True))
    
    with open(point_cloud_file, "r", encoding="utf-8") as f:
        items = json.load(f)
    
    log, issues_step1 = wf.step1_import_point_cloud_log("LOG-DEMO-001", items, "demo-system")
    
    mixed_count = len([x for x in issues_step1 if x["issue"].is_mixed])
    click.echo(f"\n✅ 导入完成！共{len(items)}条点云数据")
    click.echo(f"⚠️  检测到 {click.style(str(mixed_count), fg='red', bold=True)} 条经纬度与米制坐标混合")
    click.echo("   （系统自动标记为待巡检，留给巡检组复核，不急着归正常）")
    
    for item in issues_step1:
        if item["issue"].is_mixed:
            issue = item["issue"]
            note = item["site_note"]
            click.echo(f"\n   🔴 【{issue.item_identifier}】")
            click.echo(f"      坐标: X={issue.original_coord_x}, Y={issue.original_coord_y}")
            click.echo(f"      说明: {note.next_action}")
    
    click.echo(click.style("\n" + "="*60, fg="magenta", bold=True))
    click.echo(click.style("🎨 第二步：展陈设计师阿景补看安全半径表", fg="magenta", bold=True))
    click.echo(click.style("="*60, fg="magenta", bold=True))
    
    with open(safety_radius_file, "r", encoding="utf-8") as f:
        safety_items = json.load(f)
    
    table, updated = wf.step2_review_safety_radius_table("SR-DEMO-001", safety_items, "ajing")
    
    click.echo(f"\n✅ 阿景已复核{len(safety_items)}条安全半径数据")
    click.echo("   （补录完成，现场说明自动更新版本）")
    
    for item in updated:
        if item["issue"].is_mixed and "detection" in item and item["detection"]:
            issue = item["issue"]
            note = item["site_note"]
            click.echo(f"\n   🟡 【{issue.item_identifier}】")
            click.echo(f"      安全半径: {item['safety_item']['safety_radius']}米")
            click.echo(f"      说明版本: v{note.version}")
            click.echo(f"      下一步: {note.next_action}")
    
    click.echo(click.style("\n" + "="*60, fg="green", bold=True))
    click.echo(click.style("🏗️  第三步：给现场班组看的说明更新", fg="green", bold=True))
    click.echo(click.style("="*60, fg="green", bold=True))
    
    finalized = wf.step3_finalize_for_site_team("巡检组-老王")
    
    action_count = len([x for x in finalized if x["action_required"]])
    ready_count = len([x for x in finalized if not x["action_required"]])
    
    click.echo(f"\n✅ 已更新{len(finalized)}条现场说明")
    click.echo(f"   🚧 需巡检组复核: {click.style(str(action_count), fg='yellow', bold=True)}条")
    click.echo(f"   ✅ 可直接施工: {click.style(str(ready_count), fg='green', bold=True)}条")
    
    click.echo(click.style("\n" + "="*60, fg="cyan", bold=True))
    click.echo(click.style("📋 最终给现场班组看的说明", fg="cyan", bold=True))
    click.echo(click.style("="*60, fg="cyan", bold=True))
    
    for item in finalized:
        issue = item["issue"]
        note = item["site_note"]
        action = "🚧 需处理" if item["action_required"] else "✅ 可施工"
        
        click.echo(f"\n{action} 【{issue.item_identifier}】")
        click.echo(f"   📌 为什么留下: {note.why_kept}")
        if note.missing_materials:
            click.echo(f"   📦 还缺材料: {note.missing_materials}")
        click.echo(f"   ➡️  下一步: {note.next_action}")
        click.echo(f"   👤 联系人: {note.contact_person}")
    
    click.echo(click.style("\n" + "="*60, fg="cyan", bold=True))
    click.echo(click.style("🎯 演示完成！", fg="cyan", bold=True))
    click.echo(click.style("="*60, fg="cyan", bold=True))
    click.echo("\n💡 关键点回顾:")
    click.echo("   1. 坐标混合问题没有自动归正常，留给巡检组复核")
    click.echo("   2. 每步操作都有明确的'为什么留下、缺什么、找谁'")
    click.echo("   3. 补录安全半径表后，现场说明自动更新版本")
    click.echo("   4. 术语保留，但解释是阿景和巡检组交接的语气")
    click.echo()

def main():
    cli()

if __name__ == "__main__":
    main()
