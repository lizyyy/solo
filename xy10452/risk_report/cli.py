import click
import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from .store import DataStore
from .calculator import RiskCalculator
from .exporter import ReportExporter
from .models import (
    Task, Defect, Milestone, BlockerNote, RiskStatus, ProjectRiskReport,
    RiskLevel, RiskType
)


@click.group()
@click.option('--storage', '-s', default='./risk_data', help='数据存储路径')
@click.pass_context
def main(ctx: click.Context, storage: str):
    ctx.ensure_object(dict)
    ctx.obj['store'] = DataStore(storage)
    ctx.obj['calculator'] = RiskCalculator()


@main.group(name='import')
def import_cmd():
    pass


@import_cmd.command('task')
@click.option('--id', 'task_id', required=True, help='任务ID')
@click.option('--title', required=True, help='任务标题')
@click.option('--status', required=True, help='任务状态')
@click.option('--owner', help='负责人')
@click.option('--planned-start', 'planned_start', required=True, help='计划开始日期 (YYYY-MM-DD)')
@click.option('--planned-end', 'planned_end', required=True, help='计划结束日期 (YYYY-MM-DD)')
@click.option('--actual-start', 'actual_start', help='实际开始日期 (YYYY-MM-DD)')
@click.option('--actual-end', 'actual_end', help='实际结束日期 (YYYY-MM-DD)')
@click.option('--week', 'week_number', type=int, required=True, help='周数')
@click.option('--project', required=True, help='项目名称')
@click.option('--description', default='', help='描述')
@click.pass_context
def import_task(ctx: click.Context, task_id: str, title: str, status: str, owner: str,
                planned_start: str, planned_end: str, actual_start: Optional[str], 
                actual_end: Optional[str], week_number: int, project: str, description: str):
    store: DataStore = ctx.obj['store']
    
    task = Task(
        id=task_id,
        title=title,
        status=status,
        owner=owner,
        planned_start=date.fromisoformat(planned_start),
        planned_end=date.fromisoformat(planned_end),
        actual_start=date.fromisoformat(actual_start) if actual_start else None,
        actual_end=date.fromisoformat(actual_end) if actual_end else None,
        week_number=week_number,
        project=project,
        description=description
    )
    
    if store.import_task(task):
        click.echo(f"✅ 任务已导入: {task_id}")
    else:
        click.echo(f"⚠️  任务已存在，跳过: {task_id}")


@import_cmd.command('defect')
@click.option('--id', 'defect_id', required=True, help='缺陷ID')
@click.option('--title', required=True, help='缺陷标题')
@click.option('--severity', required=True, help='严重程度')
@click.option('--status', required=True, help='缺陷状态')
@click.option('--owner', help='负责人')
@click.option('--related-task', 'related_task_id', help='关联任务ID')
@click.option('--created-date', 'created_date', help='创建日期 (YYYY-MM-DD)')
@click.option('--resolved-date', 'resolved_date', help='解决日期 (YYYY-MM-DD)')
@click.option('--week', 'week_number', type=int, required=True, help='周数')
@click.option('--project', required=True, help='项目名称')
@click.option('--description', default='', help='描述')
@click.pass_context
def import_defect(ctx: click.Context, defect_id: str, title: str, severity: str, status: str,
                  owner: str, related_task_id: Optional[str], created_date: Optional[str],
                  resolved_date: Optional[str], week_number: int, project: str, description: str):
    store: DataStore = ctx.obj['store']
    
    defect = Defect(
        id=defect_id,
        title=title,
        severity=severity,
        status=status,
        owner=owner,
        related_task_id=related_task_id,
        created_date=date.fromisoformat(created_date) if created_date else None,
        resolved_date=date.fromisoformat(resolved_date) if resolved_date else None,
        week_number=week_number,
        project=project,
        description=description
    )
    
    if store.import_defect(defect):
        click.echo(f"✅ 缺陷已导入: {defect_id}")
    else:
        click.echo(f"⚠️  缺陷已存在，跳过: {defect_id}")


@import_cmd.command('milestone')
@click.option('--id', 'milestone_id', required=True, help='里程碑ID')
@click.option('--title', required=True, help='里程碑标题')
@click.option('--planned-date', 'planned_date', required=True, help='计划日期 (YYYY-MM-DD)')
@click.option('--actual-date', 'actual_date', help='实际日期 (YYYY-MM-DD)')
@click.option('--status', default='未开始', help='里程碑状态')
@click.option('--week', 'week_number', type=int, required=True, help='周数')
@click.option('--project', required=True, help='项目名称')
@click.option('--description', default='', help='描述')
@click.option('--dependent-tasks', 'dependent_tasks', multiple=True, help='关联任务ID（可多次指定）')
@click.pass_context
def import_milestone(ctx: click.Context, milestone_id: str, title: str, planned_date: str,
                     actual_date: Optional[str], status: str, week_number: int, project: str,
                     description: str, dependent_tasks: tuple):
    store: DataStore = ctx.obj['store']
    
    milestone = Milestone(
        id=milestone_id,
        title=title,
        planned_date=date.fromisoformat(planned_date),
        actual_date=date.fromisoformat(actual_date) if actual_date else None,
        status=status,
        week_number=week_number,
        project=project,
        description=description,
        dependent_tasks=list(dependent_tasks)
    )
    
    if store.import_milestone(milestone):
        click.echo(f"✅ 里程碑已导入: {milestone_id}")
    else:
        click.echo(f"⚠️  里程碑已存在，跳过: {milestone_id}")


@import_cmd.command('blocker')
@click.option('--id', 'blocker_id', required=True, help='阻塞备注ID')
@click.option('--content', required=True, help='备注内容')
@click.option('--owner', help='负责人')
@click.option('--created-date', 'created_date', required=True, help='创建日期 (YYYY-MM-DD)')
@click.option('--resolved-date', 'resolved_date', help='解决日期 (YYYY-MM-DD)')
@click.option('--week', 'week_number', type=int, required=True, help='周数')
@click.option('--project', required=True, help='项目名称')
@click.option('--related-task', 'related_task_id', help='关联任务ID')
@click.pass_context
def import_blocker(ctx: click.Context, blocker_id: str, content: str, owner: str,
                   created_date: str, resolved_date: Optional[str], week_number: int,
                   project: str, related_task_id: Optional[str]):
    store: DataStore = ctx.obj['store']
    
    blocker = BlockerNote(
        id=blocker_id,
        content=content,
        owner=owner,
        created_date=date.fromisoformat(created_date),
        resolved_date=date.fromisoformat(resolved_date) if resolved_date else None,
        week_number=week_number,
        project=project,
        related_task_id=related_task_id
    )
    
    if store.import_blocker(blocker):
        click.echo(f"✅ 阻塞备注已导入: {blocker_id}")
    else:
        click.echo(f"⚠️  阻塞备注已存在，跳过: {blocker_id}")


@import_cmd.command('json')
@click.option('--file', 'json_file', required=True, help='JSON文件路径')
@click.pass_context
def import_json(ctx: click.Context, json_file: str):
    store: DataStore = ctx.obj['store']
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        imported = {'tasks': 0, 'defects': 0, 'milestones': 0, 'blockers': 0, 'skipped': 0}
        
        for item in data.get('tasks', []):
            item['week_number'] = item.get('week_number', 0)
            item['project'] = item.get('project', '')
            task = Task.from_dict(item)
            if store.import_task(task):
                imported['tasks'] += 1
            else:
                imported['skipped'] += 1
        
        for item in data.get('defects', []):
            item['week_number'] = item.get('week_number', 0)
            item['project'] = item.get('project', '')
            defect = Defect.from_dict(item)
            if store.import_defect(defect):
                imported['defects'] += 1
            else:
                imported['skipped'] += 1
        
        for item in data.get('milestones', []):
            item['week_number'] = item.get('week_number', 0)
            item['project'] = item.get('project', '')
            milestone = Milestone.from_dict(item)
            if store.import_milestone(milestone):
                imported['milestones'] += 1
            else:
                imported['skipped'] += 1
        
        for item in data.get('blockers', []):
            item['week_number'] = item.get('week_number', 0)
            item['project'] = item.get('project', '')
            blocker = BlockerNote.from_dict(item)
            if store.import_blocker(blocker):
                imported['blockers'] += 1
            else:
                imported['skipped'] += 1
        
        click.echo(f"✅ 导入完成: 任务 {imported['tasks']}, 缺陷 {imported['defects']}, "
                   f"里程碑 {imported['milestones']}, 阻塞备注 {imported['blockers']}, "
                   f"跳过 {imported['skipped']}")
    except Exception as e:
        click.echo(f"❌ 导入失败: {e}", err=True)


@main.command('calculate')
@click.option('--project', required=True, help='项目名称')
@click.option('--week', 'week_number', type=int, required=True, help='周数')
@click.option('--today', help='计算日期 (YYYY-MM-DD)，默认今天')
@click.pass_context
def calculate(ctx: click.Context, project: str, week_number: int, today: Optional[str]):
    store: DataStore = ctx.obj['store']
    calculator: RiskCalculator = ctx.obj['calculator']
    
    tasks = store.get_tasks(project=project, week_number=week_number)
    defects = store.get_defects(project=project, week_number=week_number)
    milestones = store.get_milestones(project=project, week_number=week_number)
    blockers = store.get_blockers(project=project, week_number=week_number)
    
    if not tasks and not defects and not milestones:
        click.echo(f"⚠️  未找到项目 '{project}' 第 {week_number} 周的数据")
        return
    
    today_date = date.fromisoformat(today) if today else date.today()
    
    risks = calculator.calculate(tasks, defects, milestones, blockers, project, week_number, today_date)
    store.save_risks(risks, project, week_number)
    
    overall_level = calculator.calculate_overall_risk(risks)
    summary = calculator.generate_summary(risks, tasks, defects, milestones)
    
    report = ProjectRiskReport(
        week_number=week_number,
        project=project,
        overall_risk_level=overall_level,
        risks=risks,
        summary=summary
    )
    store.save_report(report)
    
    level_colors = {
        RiskLevel.LOW: 'green',
        RiskLevel.MEDIUM: 'yellow',
        RiskLevel.HIGH: 'bright_red',
        RiskLevel.CRITICAL: 'red'
    }
    
    click.echo(f"\n📊 风险计算完成")
    click.echo(f"  项目: {project}")
    click.echo(f"  周数: 第 {week_number} 周")
    click.echo(f"  总体风险等级: {click.style(overall_level.value, fg=level_colors.get(overall_level, 'white'))}")
    click.echo(f"  检测到风险: {len(risks)} 项")
    click.echo(f"")
    
    if risks:
        click.echo("  风险分布:")
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            count = sum(1 for r in risks if r.level == level)
            if count > 0:
                click.echo(f"    - {level.value}: {count} 项")


@main.command('list')
@click.option('--project', help='项目名称')
@click.option('--week', 'week_number', type=int, help='周数')
@click.option('--level', type=click.Choice(['低', '中', '高', '严重']), help='风险等级过滤')
@click.pass_context
def list_risks(ctx: click.Context, project: Optional[str], week_number: Optional[int], 
               level: Optional[str]):
    store: DataStore = ctx.obj['store']
    
    risks = store.get_risks(project=project, week_number=week_number)
    
    if level:
        risks = [r for r in risks if r.level.value == level]
    
    if not risks:
        click.echo("ℹ️  未找到匹配的风险")
        return
    
    level_colors = {
        RiskLevel.LOW: 'green',
        RiskLevel.MEDIUM: 'yellow',
        RiskLevel.HIGH: 'bright_red',
        RiskLevel.CRITICAL: 'red'
    }
    
    status_colors = {
        RiskStatus.IDENTIFIED: 'cyan',
        RiskStatus.EXPLAINED: 'yellow',
        RiskStatus.MITIGATED: 'blue',
        RiskStatus.RESOLVED: 'green'
    }
    
    click.echo(f"共 {len(risks)} 项风险:\n")
    for risk in risks:
        click.echo(f"[{risk.id}] {click.style(risk.level.value, fg=level_colors.get(risk.level, 'white'))} "
                   f"{risk.title}")
        click.echo(f"  项目: {risk.project} | 周数: 第 {risk.week_number} 周 | "
                   f"类型: {risk.risk_type.value} | 状态: {click.style(risk.status.value, fg=status_colors.get(risk.status, 'white'))}")
        if risk.explanation:
            click.echo(f"  解释: {risk.explanation[:50]}...")
        click.echo("")


@main.command('show')
@click.option('--risk-id', 'risk_id', required=True, help='风险ID')
@click.pass_context
def show_risk(ctx: click.Context, risk_id: str):
    store: DataStore = ctx.obj['store']
    
    risks = store.get_risks(risk_id=risk_id)
    if not risks:
        click.echo(f"⚠️  未找到风险: {risk_id}")
        return
    
    risk = risks[0]
    
    level_colors = {
        RiskLevel.LOW: 'green',
        RiskLevel.MEDIUM: 'yellow',
        RiskLevel.HIGH: 'bright_red',
        RiskLevel.CRITICAL: 'red'
    }
    
    click.echo(f"\n{'='*60}")
    click.echo(f"风险详情: {risk.id}")
    click.echo(f"{'='*60}\n")
    
    click.echo(f"标题: {risk.title}")
    click.echo(f"等级: {click.style(risk.level.value, fg=level_colors.get(risk.level, 'white'))}")
    click.echo(f"类型: {risk.risk_type.value}")
    click.echo(f"状态: {risk.status.value}")
    click.echo(f"项目: {risk.project}")
    click.echo(f"周数: 第 {risk.week_number} 周")
    click.echo(f"负责人: {risk.owner or '未分配'}")
    click.echo(f"创建时间: {risk.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    click.echo(f"描述:\n{risk.description}\n")
    
    if risk.explanation:
        click.echo(f"解释说明:\n{risk.explanation}\n")
    
    click.echo(f"证据 ({len(risk.evidence)} 项):\n")
    for i, evidence in enumerate(risk.evidence, 1):
        click.echo(f"  {i}. [{evidence.source_type.upper()}] {evidence.source_id}: {evidence.source_title}")
        for key, value in evidence.details.items():
            click.echo(f"     - {key}: {value}")
        click.echo("")


@main.command('explain')
@click.option('--risk-id', 'risk_id', required=True, help='风险ID')
@click.option('--explanation', required=True, help='解释说明')
@click.option('--owner', help='负责人')
@click.pass_context
def explain_risk(ctx: click.Context, risk_id: str, explanation: str, owner: Optional[str]):
    store: DataStore = ctx.obj['store']
    
    risks = store.get_risks(risk_id=risk_id)
    if not risks:
        click.echo(f"⚠️  未找到风险: {risk_id}")
        return
    
    risk = risks[0]
    risk.status = RiskStatus.EXPLAINED
    risk.explanation = explanation
    if owner:
        risk.owner = owner
    
    store.update_risk(risk)
    click.echo(f"✅ 风险 {risk_id} 已标记为已解释")


@main.command('resolve')
@click.option('--risk-id', 'risk_id', required=True, help='风险ID')
@click.option('--status', type=click.Choice(['已解释', '已缓解', '已解决']), required=True, help='新状态')
@click.option('--explanation', help='解释说明')
@click.pass_context
def resolve_risk(ctx: click.Context, risk_id: str, status: str, explanation: Optional[str]):
    store: DataStore = ctx.obj['store']
    
    risks = store.get_risks(risk_id=risk_id)
    if not risks:
        click.echo(f"⚠️  未找到风险: {risk_id}")
        return
    
    status_map = {
        '已解释': RiskStatus.EXPLAINED,
        '已缓解': RiskStatus.MITIGATED,
        '已解决': RiskStatus.RESOLVED
    }
    
    risk = risks[0]
    risk.status = status_map[status]
    if explanation:
        risk.explanation = explanation
    
    store.update_risk(risk)
    click.echo(f"✅ 风险 {risk_id} 状态已更新为: {status}")


@main.command('export')
@click.option('--project', required=True, help='项目名称')
@click.option('--week', 'week_number', type=int, required=True, help='周数')
@click.option('--format', 'fmt', type=click.Choice(['markdown', 'json']), default='markdown', help='导出格式')
@click.option('--output', '-o', required=True, help='输出文件路径')
@click.pass_context
def export_report(ctx: click.Context, project: str, week_number: int, fmt: str, output: str):
    store: DataStore = ctx.obj['store']
    
    reports = store.get_reports(project=project, week_number=week_number)
    
    if not reports:
        click.echo(f"⚠️  未找到项目 '{project}' 第 {week_number} 周的报告，请先运行 calculate 命令")
        return
    
    report = reports[0]
    
    if fmt == 'markdown':
        file_path = ReportExporter.export_markdown(report, output)
    else:
        file_path = ReportExporter.export_json(report, output)
    
    click.echo(f"✅ 周报已导出到: {file_path}")


@main.command('projects')
@click.pass_context
def list_projects(ctx: click.Context):
    store: DataStore = ctx.obj['store']
    projects = store.get_projects()
    
    if not projects:
        click.echo("ℹ️  暂无项目数据")
        return
    
    click.echo(f"共 {len(projects)} 个项目:\n")
    for project in projects:
        weeks = store.get_weeks(project=project)
        click.echo(f"  - {project} (周数: {', '.join(map(str, weeks)) or '无'})")


@main.command('weeks')
@click.option('--project', help='项目名称')
@click.pass_context
def list_weeks(ctx: click.Context, project: Optional[str]):
    store: DataStore = ctx.obj['store']
    weeks = store.get_weeks(project=project)
    
    if not weeks:
        click.echo("ℹ️  暂无周数据")
        return
    
    project_label = f"项目 '{project}'" if project else "所有项目"
    click.echo(f"{project_label} 的周数: {', '.join(map(str, weeks))}")


if __name__ == '__main__':
    main()
