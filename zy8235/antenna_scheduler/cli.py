#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import click
import sys
from pathlib import Path
from typing import Optional

from .models import IssueSeverity
from .validator import DataLoader, ScheduleValidator
from .scheduler import SchedulePlanner
from .reporter import ReportExporter


DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "sample" / "antenna.yaml"
DEFAULT_PASSES_PATH = Path(__file__).parent.parent / "sample" / "passes.csv"
DEFAULT_PRIORITY_PATH = Path(__file__).parent.parent / "sample" / "mission_priority.json"
DEFAULT_MAINTENANCE_PATH = Path(__file__).parent.parent / "sample" / "maintenance.csv"


def get_default_paths() -> dict:
    return {
        'config': str(DEFAULT_CONFIG_PATH),
        'passes': str(DEFAULT_PASSES_PATH),
        'priority': str(DEFAULT_PRIORITY_PATH),
        'maintenance': str(DEFAULT_MAINTENANCE_PATH)
    }


def load_and_validate(config: str, passes: str, priority: str, maintenance: str):
    loader = DataLoader()
    
    try:
        antennas, passes_data, priorities, maintenances = loader.load_all(
            antenna_path=config,
            passes_path=passes,
            priority_path=priority,
            maintenance_path=maintenance
        )
    except FileNotFoundError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"加载数据时出错: {e}", err=True)
        sys.exit(1)
    
    validator = ScheduleValidator()
    result = validator.validate(antennas, passes_data, priorities, maintenances)
    
    planner = SchedulePlanner()
    planner.plan(result)
    
    return result


@click.group()
@click.version_option(version='1.0.0', prog_name='antenna-scheduler')
def main():
    """卫星地面站天线排程预检工具
    
    用于离线校验和规划卫星过境排程，支持：
    - validate: 校验可见窗口、冷却时间、维护段和优先级抢占
    - plan: 生成可执行排程建议
    - export-report: 导出冲突清单和排程报告
    """
    pass


@main.command()
@click.option('--config', '-c', 
              default=str(DEFAULT_CONFIG_PATH),
              help='天线配置 YAML 文件路径')
@click.option('--passes', '-p', 
              default=str(DEFAULT_PASSES_PATH),
              help='过境数据 CSV 文件路径')
@click.option('--priority', '-r', 
              default=str(DEFAULT_PRIORITY_PATH),
              help='任务优先级 JSON 文件路径')
@click.option('--maintenance', '-m', 
              default=str(DEFAULT_MAINTENANCE_PATH),
              help='维护计划 CSV 文件路径')
@click.option('--verbose', '-v', is_flag=True,
              help='显示详细信息')
def validate(config, passes, priority, maintenance, verbose):
    """校验排程数据
    
    校验可见窗口、天线转向冷却时间、维护禁用段和任务优先级抢占。
    输出冲突清单和严重程度。
    """
    click.echo("=" * 60)
    click.echo("天线排程预检 - 校验模式")
    click.echo("=" * 60)
    
    result = load_and_validate(config, passes, priority, maintenance)
    
    total_issues = len(result.issues)
    critical = len(result.get_issues_by_severity(IssueSeverity.CRITICAL))
    high = len(result.get_issues_by_severity(IssueSeverity.HIGH))
    medium = len(result.get_issues_by_severity(IssueSeverity.MEDIUM))
    low = len(result.get_issues_by_severity(IssueSeverity.LOW))
    
    click.echo(f"\n校验结果摘要:")
    click.echo(f"  总过境数: {len(result.passes)}")
    click.echo(f"  总问题数: {total_issues}")
    click.echo(f"    严重 (CRITICAL): {critical}")
    click.echo(f"    高 (HIGH): {high}")
    click.echo(f"    中 (MEDIUM): {medium}")
    click.echo(f"    低 (LOW): {low}")
    
    if critical > 0 or high > 0:
        click.echo(f"\n{'⚠️ 警告: 存在严重问题，需要立即处理!' if critical > 0 else ''}")
    
    if verbose or total_issues > 0:
        click.echo(f"\n详细问题列表:")
        click.echo("-" * 60)
        
        for i, issue in enumerate(result.issues, 1):
            severity_emoji = {
                IssueSeverity.CRITICAL: "🔴",
                IssueSeverity.HIGH: "🟠",
                IssueSeverity.MEDIUM: "🟡",
                IssueSeverity.LOW: "🟢"
            }.get(issue.severity, "⚪")
            
            click.echo(f"\n{severity_emoji} 问题 {i} [{issue.severity.value.upper()}]")
            click.echo(f"   类型: {issue.issue_type.value}")
            click.echo(f"   天线: {issue.antenna_id}")
            click.echo(f"   描述: {issue.message}")
            click.echo(f"   建议: {issue.suggestion}")
    
    click.echo(f"\n{'=' * 60}")
    if result.has_critical_issues():
        click.echo("校验完成 - 存在严重问题!")
        sys.exit(1)
    elif total_issues > 0:
        click.echo("校验完成 - 存在警告问题")
        sys.exit(0)
    else:
        click.echo("校验完成 - 无问题")
        sys.exit(0)


@main.command()
@click.option('--config', '-c', 
              default=str(DEFAULT_CONFIG_PATH),
              help='天线配置 YAML 文件路径')
@click.option('--passes', '-p', 
              default=str(DEFAULT_PASSES_PATH),
              help='过境数据 CSV 文件路径')
@click.option('--priority', '-r', 
              default=str(DEFAULT_PRIORITY_PATH),
              help='任务优先级 JSON 文件路径')
@click.option('--maintenance', '-m', 
              default=str(DEFAULT_MAINTENANCE_PATH),
              help='维护计划 CSV 文件路径')
@click.option('--antenna', '-a',
              help='指定天线ID查看详细排程')
def plan(config, passes, priority, maintenance, antenna):
    """生成排程计划
    
    根据校验结果生成可执行的排程建议，包括：
    - 可执行的过境任务
    - 被抢占的任务
    - 需要手动解决的冲突
    """
    click.echo("=" * 60)
    click.echo("天线排程预检 - 计划模式")
    click.echo("=" * 60)
    
    result = load_and_validate(config, passes, priority, maintenance)
    
    planner = SchedulePlanner()
    scheduled = result.scheduled_passes
    
    executable = planner.get_executable_passes(scheduled)
    conflicted = planner.get_conflicted_passes(scheduled)
    
    timeline = planner.analyze_timeline(scheduled)
    
    click.echo(f"\n排程摘要:")
    click.echo(f"  时间范围: {timeline['start_time'].strftime('%Y-%m-%d %H:%M')} 至 {timeline['end_time'].strftime('%Y-%m-%d %H:%M')}")
    click.echo(f"  总时长: {timeline['total_duration_hours']:.1f} 小时")
    click.echo(f"  总过境数: {timeline['total_passes']}")
    click.echo(f"  可执行: {len(executable)}")
    click.echo(f"  有冲突: {len(conflicted)}")
    
    click.echo(f"\n状态分布:")
    status_map = {
        'SCHEDULED': '可执行',
        'PREEMPTED': '被抢占',
        'CONFLICT_MAINTENANCE': '维护冲突',
        'CONFLICT_VISIBILITY': '可见性冲突',
        'CONFLICT_SAME_PRIORITY': '同优先级冲突',
        'CONFLICT_TIMING': '时间冲突',
    }
    for status, count in timeline.get('pass_status_summary', {}).items():
        desc = status_map.get(status, status)
        click.echo(f"  {desc}: {count}")
    
    click.echo(f"\n{'=' * 60}")
    click.echo("可执行任务清单:")
    click.echo("-" * 60)
    for sp in executable:
        cross_midnight = " [跨午夜]" if sp.pass_obj.is_cross_midnight else ""
        click.echo(f"  ✅ {sp.pass_obj.pass_id}: {sp.pass_obj.satellite_name} "
                   f"({sp.pass_obj.start_time.strftime('%H:%M')}-{sp.pass_obj.end_time.strftime('%H:%M')}) "
                   f"天线 {sp.pass_obj.antenna_id}{cross_midnight}")
    
    if conflicted:
        click.echo(f"\n{'=' * 60}")
        click.echo("存在冲突的任务:")
        click.echo("-" * 60)
        for sp in conflicted:
            click.echo(f"  ❌ {sp.pass_obj.pass_id}: {sp.pass_obj.satellite_name} - "
                       f"状态: {sp.status}")
            if sp.notes:
                click.echo(f"     备注: {sp.notes}")
    
    if antenna:
        antenna_groups = planner.group_passes_by_antenna(scheduled)
        if antenna in antenna_groups:
            click.echo(f"\n{'=' * 60}")
            click.echo(f"天线 {antenna} 详细排程:")
            click.echo("-" * 60)
            for sp in antenna_groups[antenna]:
                status_icon = "✅" if sp.status == "SCHEDULED" else "❌"
                cross_midnight = " [跨午夜]" if sp.pass_obj.is_cross_midnight else ""
                click.echo(f"\n  {status_icon} {sp.pass_obj.pass_id}:")
                click.echo(f"     卫星: {sp.pass_obj.satellite_name}")
                click.echo(f"     时间: {sp.pass_obj.start_time.strftime('%Y-%m-%d %H:%M')} - {sp.pass_obj.end_time.strftime('%Y-%m-%d %H:%M')}{cross_midnight}")
                click.echo(f"     任务类型: {sp.pass_obj.mission_type}")
                click.echo(f"     优先级: {sp.pass_obj.priority_level}")
                click.echo(f"     状态: {sp.status}")
                if sp.notes:
                    click.echo(f"     备注: {sp.notes}")
    
    click.echo(f"\n{'=' * 60}")
    click.echo("计划生成完成。使用 'export-report' 命令导出详细报告。")


@main.command()
@click.option('--config', '-c', 
              default=str(DEFAULT_CONFIG_PATH),
              help='天线配置 YAML 文件路径')
@click.option('--passes', '-p', 
              default=str(DEFAULT_PASSES_PATH),
              help='过境数据 CSV 文件路径')
@click.option('--priority', '-r', 
              default=str(DEFAULT_PRIORITY_PATH),
              help='任务优先级 JSON 文件路径')
@click.option('--maintenance', '-m', 
              default=str(DEFAULT_MAINTENANCE_PATH),
              help='维护计划 CSV 文件路径')
@click.option('--output-issues', '-oi',
              default='issues.csv',
              help='冲突清单输出文件路径 (默认: issues.csv)')
@click.option('--output-report', '-or',
              default='schedule_review.md',
              help='排程报告输出文件路径 (默认: schedule_review.md)')
@click.option('--output-dir', '-od',
              default='.',
              help='输出目录 (默认: 当前目录)')
def export_report(config, passes, priority, maintenance, 
                   output_issues, output_report, output_dir):
    """导出排程报告
    
    导出冲突清单 (issues.csv) 和排程建议报告 (schedule_review.md)。
    """
    click.echo("=" * 60)
    click.echo("天线排程预检 - 报告导出模式")
    click.echo("=" * 60)
    
    result = load_and_validate(config, passes, priority, maintenance)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    issues_path = output_path / output_issues
    report_path = output_path / output_report
    
    exporter = ReportExporter()
    
    click.echo(f"\n导出冲突清单到: {issues_path}")
    issues_file = exporter.export_issues_csv(result, str(issues_path))
    
    click.echo(f"导出排程报告到: {report_path}")
    report_file = exporter.export_schedule_review_md(result, str(report_path))
    
    total_issues = len(result.issues)
    click.echo(f"\n报告摘要:")
    click.echo(f"  总问题数: {total_issues}")
    click.echo(f"  冲突清单: {issues_file}")
    click.echo(f"  排程报告: {report_file}")
    
    click.echo(f"\n{'=' * 60}")
    click.echo("报告导出完成!")


if __name__ == '__main__':
    main()
