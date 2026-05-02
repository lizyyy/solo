#!/usr/bin/env python3
"""
项目验证脚本
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

test_dir = '/tmp/continuity_test'
os.makedirs(f'{test_dir}/examples', exist_ok=True)
os.makedirs(f'{test_dir}/output', exist_ok=True)
os.makedirs(f'{test_dir}/exports', exist_ok=True)

print("=" * 60)
print("步骤 1: 生成示例数据")
print("=" * 60)

from continuity_inspector.examples.generator import ExampleGenerator
gen = ExampleGenerator()
gen.generate_all(f'{test_dir}/examples')

print(f"示例数据已生成到: {test_dir}/examples")
for f in sorted(os.listdir(f'{test_dir}/examples')):
    print(f"   - {f}")

print()
print("=" * 60)
print("步骤 2: 测试解析器模块")
print("=" * 60)

from continuity_inspector.parsers.csv_parser import CSVParser
from continuity_inspector.parsers.json_parser import JSONParser
from continuity_inspector.parsers.screenshot_parser import ScreenshotParser

csv_parser = CSVParser()
json_parser = JSONParser()
ss_parser = ScreenshotParser()

call_sheet = csv_parser.parse_call_sheet(f'{test_dir}/examples/call_sheet.csv')
print(f"解析通告单: {len(call_sheet)} 条记录")
for entry in call_sheet[:2]:
    print(f"   场次 {entry.scene_id} 镜号 {entry.shot_number}: {entry.description[:30]}...")

script_notes = json_parser.parse_script_notes(f'{test_dir}/examples/script_notes.json')
print(f"\n解析场记: {len(script_notes)} 条记录")
for note in script_notes[:2]:
    print(f"   场次 {note.scene_id} 镜号 {note.shot_number}: {note.characters}")

screenshots = ss_parser.parse(f'{test_dir}/examples/screenshots.csv')
print(f"\n解析截图清单: {len(screenshots)} 条记录")
for ss in screenshots[:2]:
    print(f"   {ss.file_path} -> 场次 {ss.scene_id} 镜号 {ss.shot_number}")

costume_rules = json_parser.parse_costume_rules(f'{test_dir}/examples/costume_rules.json')
print(f"\n解析服装规则: {len(costume_rules)} 条规则")
for rule in costume_rules[:2]:
    print(f"   {rule.character} ({rule.scene_id}): {rule.description[:30]}...")

prop_rules = json_parser.parse_prop_rules(f'{test_dir}/examples/prop_rules.json')
print(f"\n解析道具规则: {len(prop_rules)} 条规则")
for rule in prop_rules[:2]:
    print(f"   {rule.prop_name} ({rule.scene_id}): required={rule.required}")

print()
print("=" * 60)
print("步骤 3: 测试规则引擎 (连续性检查)")
print("=" * 60)

from continuity_inspector.models import ProjectData, ShotStatus, IssueCategory, IssueSeverity
from continuity_inspector.rules.engine import ContinuityEngine

project = ProjectData(
    project_name="测试验证项目",
    production_day="2026-05-01"
)

project.call_sheet_entries = call_sheet
project.script_notes = script_notes
project.screenshots = screenshots
project.costume_rules = costume_rules
project.prop_rules = prop_rules

engine = ContinuityEngine()
engine.check_all(project)

print(f"检查完成，发现 {len(project.issues)} 个问题:")
print()

by_category = {}
by_severity = {}

for issue in project.issues:
    cat = issue.category.value
    sev = issue.severity.value
    by_category[cat] = by_category.get(cat, 0) + 1
    by_severity[sev] = by_severity.get(sev, 0) + 1

print("按类别分布:")
for cat, count in sorted(by_category.items()):
    print(f"   - {cat}: {count} 个")

print()
print("按严重程度分布:")
for sev in ["严重", "高", "中", "低"]:
    if sev in by_severity:
        print(f"   - {sev}: {by_severity[sev]} 个")

print()
print("问题详情示例 (前3个):")
print("-" * 40)
for issue in project.issues[:3]:
    status = "已放行" if issue.approved else "待处理"
    print(f"\n问题ID: {issue.issue_id}")
    print(f"类别: {issue.category.value}")
    print(f"严重程度: {issue.severity.value}")
    print(f"场次: {issue.scene_id}")
    if issue.shot_number:
        print(f"镜号: {issue.shot_number}")
    print(f"描述: {issue.description}")
    print(f"状态: {status}")

print()
print("=" * 60)
print("步骤 4: 测试复核存储模块")
print("=" * 60)

from continuity_inspector.review.storage import ReviewStorage

storage = ReviewStorage()
storage.project = project

pending = storage.get_pending_issues()
print(f"待处理问题: {len(pending)} 个")

if pending:
    first_issue = pending[0]
    print(f"\n放行问题: {first_issue.issue_id}")
    storage.approve_issue(first_issue.issue_id, "测试用户", "这是测试放行")
    
    stats = storage.get_statistics()
    print(f"\n统计信息:")
    print(f"   总问题数: {stats['summary']['total_issues']}")
    print(f"   已放行: {stats['summary']['approved']}")
    print(f"   待处理: {stats['summary']['pending']}")

print()
print("=" * 60)
print("步骤 5: 测试导出模块")
print("=" * 60)

from continuity_inspector.exporters.json_exporter import JSONExporter
json_exp = JSONExporter()
project_file = f'{test_dir}/output/project.json'
json_exp.export_project_data(project, project_file)
print(f"项目数据已保存: {project_file}")

from continuity_inspector.exporters.markdown import MarkdownExporter
md_exp = MarkdownExporter()
md_file = f'{test_dir}/exports/report.md'
md_exp.export(project, md_file)
print(f"Markdown 报告已导出: {md_file}")

from continuity_inspector.exporters.csv_exporter import CSVExporter
csv_exp = CSVExporter()
csv_file = f'{test_dir}/exports/issues.csv'
csv_exp.export(project, csv_file)
print(f"CSV 问题表已导出: {csv_file}")

audit_file = f'{test_dir}/exports/audit.json'
json_exp.export_audit(project, audit_file)
print(f"JSON 审计包已导出: {audit_file}")

print()
print("验证导出文件:")
for f in sorted(os.listdir(f'{test_dir}/exports')):
    full_path = f'{test_dir}/exports/{f}'
    size = os.path.getsize(full_path)
    print(f"   - {f} ({size} bytes)")

print()
print("=" * 60)
print("验证完成! 所有模块工作正常")
print("=" * 60)
