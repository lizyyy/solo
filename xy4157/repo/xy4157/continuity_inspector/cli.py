"""
CLI 入口模块
"""

import click
import json
import os
from pathlib import Path
from datetime import datetime

from .parsers.csv_parser import CSVParser
from .parsers.json_parser import JSONParser
from .parsers.screenshot_parser import ScreenshotParser
from .rules.engine import ContinuityEngine
from .review.storage import ReviewStorage
from .exporters.markdown import MarkdownExporter
from .exporters.csv_exporter import CSVExporter
from .exporters.json_exporter import JSONExporter
from .models import ProjectData, IssueSeverity, IssueCategory


@click.group()
@click.version_option(version="1.0.0", prog_name="镜头连续性巡检员")
def cli():
    """
    镜头连续性巡检员 - 短剧后期统筹自动化工具
    
    用于校验场次顺序、角色/道具连续性、缺失截图、重复镜号和跨天补拍冲突。
    """
    pass


@cli.command()
@click.option("--call-sheet", "-c", required=True, help="通告单 CSV 文件路径")
@click.option("--script-notes", "-s", required=True, help="场记 JSON 文件路径")
@click.option("--screenshots", "-i", required=True, help="镜头截图清单文件路径")
@click.option("--costume-rules", "-r", required=True, help="服装规则文件路径")
@click.option("--prop-rules", "-p", required=True, help="道具规则文件路径")
@click.option("--project-name", "-n", default="未命名项目", help="项目名称")
@click.option("--production-day", "-d", default=None, help="拍摄日期 (YYYY-MM-DD)")
@click.option("--output", "-o", help="输出项目数据文件路径 (.json)")
def import_data(call_sheet, script_notes, screenshots, costume_rules, prop_rules, 
                project_name, production_day, output):
    """
    导入通告单、场记、截图清单和规则文件
    """
    click.echo(f"📁 开始导入项目: {project_name}")
    
    prod_day = production_day or datetime.now().strftime("%Y-%m-%d")
    
    project = ProjectData(
        project_name=project_name,
        production_day=prod_day
    )
    
    csv_parser = CSVParser()
    json_parser = JSONParser()
    screenshot_parser = ScreenshotParser()
    
    click.echo(f"   解析通告单: {call_sheet}")
    try:
        project.call_sheet_entries = csv_parser.parse_call_sheet(call_sheet)
        click.echo(f"   ✓ 导入 {len(project.call_sheet_entries)} 条通告记录")
    except Exception as e:
        click.echo(f"   ✗ 解析通告单失败: {e}", err=True)
        return
    
    click.echo(f"   解析场记: {script_notes}")
    try:
        project.script_notes = json_parser.parse_script_notes(script_notes)
        click.echo(f"   ✓ 导入 {len(project.script_notes)} 条场记记录")
    except Exception as e:
        click.echo(f"   ✗ 解析场记失败: {e}", err=True)
        return
    
    click.echo(f"   解析截图清单: {screenshots}")
    try:
        project.screenshots = screenshot_parser.parse(screenshots)
        click.echo(f"   ✓ 导入 {len(project.screenshots)} 张截图记录")
    except Exception as e:
        click.echo(f"   ✗ 解析截图清单失败: {e}", err=True)
        return
    
    click.echo(f"   解析服装规则: {costume_rules}")
    try:
        project.costume_rules = json_parser.parse_costume_rules(costume_rules)
        click.echo(f"   ✓ 导入 {len(project.costume_rules)} 条服装规则")
    except Exception as e:
        click.echo(f"   ✗ 解析服装规则失败: {e}", err=True)
        return
    
    click.echo(f"   解析道具规则: {prop_rules}")
    try:
        project.prop_rules = json_parser.parse_prop_rules(prop_rules)
        click.echo(f"   ✓ 导入 {len(project.prop_rules)} 条道具规则")
    except Exception as e:
        click.echo(f"   ✗ 解析道具规则失败: {e}", err=True)
        return
    
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        json_exporter = JSONExporter()
        json_exporter.export_project_data(project, output)
        click.echo(f"\n💾 项目数据已保存至: {output}")
    
    click.echo("\n✅ 导入完成!")
    click.echo(f"   通告记录: {len(project.call_sheet_entries)}")
    click.echo(f"   场记记录: {len(project.script_notes)}")
    click.echo(f"   截图: {len(project.screenshots)}")


@cli.command()
@click.option("--project-file", "-f", required=True, help="项目数据文件路径 (.json)")
@click.option("--output", "-o", help="输出更新后的项目文件")
@click.option("--category", "-c", multiple=True, 
              type=click.Choice([c.value for c in IssueCategory]),
              help="指定检查类别 (可多次使用)")
@click.option("--severity", "-s", 
              type=click.Choice([s.value for s in IssueSeverity]),
              default="中", help="最小报告严重程度")
def check(project_file, output, category, severity):
    """
    执行连续性检查
    """
    click.echo(f"🔍 开始连续性检查: {project_file}")
    
    with open(project_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    json_parser = JSONParser()
    project = json_parser.parse_project_data(data)
    
    engine = ContinuityEngine()
    
    categories = None
    if category:
        categories = [IssueCategory(c) for c in category]
    
    min_severity = IssueSeverity(severity)
    
    click.echo("   检查场次顺序...")
    engine.check_scene_order(project)
    
    click.echo("   检查服装连续性...")
    engine.check_costume_continuity(project)
    
    click.echo("   检查道具连续性...")
    engine.check_prop_continuity(project)
    
    click.echo("   检查缺失截图...")
    engine.check_missing_screenshots(project)
    
    click.echo("   检查重复镜号...")
    engine.check_duplicate_shots(project)
    
    click.echo("   检查补拍冲突...")
    engine.check_reshoot_conflicts(project)
    
    click.echo("   检查命名一致性...")
    engine.check_naming_consistency(project)
    
    filtered_issues = []
    for issue in project.issues:
        if categories and issue.category not in categories:
            continue
        if _severity_level(issue.severity) < _severity_level(min_severity):
            continue
        filtered_issues.append(issue)
    
    count_by_category = {}
    count_by_severity = {}
    for issue in filtered_issues:
        cat = issue.category.value
        sev = issue.severity.value
        count_by_category[cat] = count_by_category.get(cat, 0) + 1
        count_by_severity[sev] = count_by_severity.get(sev, 0) + 1
    
    click.echo(f"\n📋 检查结果汇总:")
    click.echo(f"   总问题数: {len(filtered_issues)}")
    
    if count_by_category:
        click.echo(f"\n   按类别:")
        for cat, count in sorted(count_by_category.items()):
            click.echo(f"      {cat}: {count}")
    
    if count_by_severity:
        click.echo(f"\n   按严重程度:")
        for sev in [s.value for s in IssueSeverity]:
            if sev in count_by_severity:
                click.echo(f"      {sev}: {count_by_severity[sev]}")
    
    if filtered_issues:
        click.echo(f"\n🔴 问题详情:")
        for issue in filtered_issues[:10]:
            status = "✅ 已放行" if issue.approved else "❌ 待处理"
            click.echo(f"   [{issue.severity.value}] {issue.category.value} - {issue.scene_id}")
            click.echo(f"      {issue.description}")
            click.echo(f"      状态: {status}")
        
        if len(filtered_issues) > 10:
            click.echo(f"   ... 还有 {len(filtered_issues) - 10} 个问题")
    
    output_file = output or project_file
    json_exporter = JSONExporter()
    json_exporter.export_project_data(project, output_file)
    
    click.echo(f"\n💾 检查结果已保存至: {output_file}")


def _severity_level(severity):
    order = {
        IssueSeverity.LOW: 1,
        IssueSeverity.MEDIUM: 2,
        IssueSeverity.HIGH: 3,
        IssueSeverity.CRITICAL: 4
    }
    return order.get(severity, 0)


@cli.command()
@click.option("--project-file", "-f", required=True, help="项目数据文件路径 (.json)")
@click.option("--issue-id", "-i", required=True, help="问题ID")
@click.option("--approve/--reject", "-a/-r", default=False, help="放行/拒绝")
@click.option("--notes", "-n", default="", help="备注说明")
@click.option("--user", "-u", default="匿名", help="操作人")
def review(project_file, issue_id, approve, notes, user):
    """
    保存人工复核意见
    """
    action = "放行" if approve else "拒绝"
    click.echo(f"📝 处理复核意见: {action} 问题 {issue_id}")
    
    storage = ReviewStorage()
    
    try:
        storage.load_project(project_file)
        
        if approve:
            storage.approve_issue(issue_id, user, notes)
            click.echo(f"   ✅ 问题 {issue_id} 已标记为放行")
        else:
            storage.reject_issue(issue_id, user, notes)
            click.echo(f"   ✗ 问题 {issue_id} 已标记为拒绝")
        
        storage.save_project(project_file)
        click.echo(f"\n💾 复核意见已保存")
        
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        return


@cli.command()
@click.option("--project-file", "-f", required=True, help="项目数据文件路径 (.json)")
@click.option("--output-dir", "-o", required=True, help="输出目录路径")
@click.option("--format", "-t", multiple=True,
              type=click.Choice(['markdown', 'csv', 'json']),
              default=['markdown', 'csv', 'json'],
              help="导出格式 (可多次使用)")
def export(project_file, output_dir, format):
    """
    导出风险报告和问题列表
    """
    click.echo(f"📤 开始导出: {project_file}")
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    with open(project_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    json_parser = JSONParser()
    project = json_parser.parse_project_data(data)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if 'markdown' in format:
        click.echo("   导出 Markdown 报告...")
        md_exporter = MarkdownExporter()
        md_file = output_path / f"连续性报告_{timestamp}.md"
        md_exporter.export(project, str(md_file))
        click.echo(f"      ✓ {md_file}")
    
    if 'csv' in format:
        click.echo("   导出 CSV 问题表...")
        csv_exporter = CSVExporter()
        csv_file = output_path / f"问题列表_{timestamp}.csv"
        csv_exporter.export(project, str(csv_file))
        click.echo(f"      ✓ {csv_file}")
    
    if 'json' in format:
        click.echo("   导出 JSON 审计包...")
        json_exp = JSONExporter()
        json_file = output_path / f"审计包_{timestamp}.json"
        json_exp.export_audit(project, str(json_file))
        click.echo(f"      ✓ {json_file}")
    
    click.echo(f"\n✅ 导出完成!")
    click.echo(f"   输出目录: {output_dir}")


@cli.command()
@click.option("--output-dir", "-o", required=True, help="示例数据输出目录")
def generate_examples(output_dir):
    """
    生成示例数据用于测试
    """
    from .examples.generator import ExampleGenerator
    
    click.echo(f"📁 生成示例数据至: {output_dir}")
    
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    generator = ExampleGenerator()
    generator.generate_all(str(out_path))
    
    click.echo("✅ 示例数据生成完成!")
    click.echo(f"   文件清单:")
    for f in sorted(out_path.iterdir()):
        if f.is_file():
            click.echo(f"      - {f.name}")


if __name__ == "__main__":
    cli()
