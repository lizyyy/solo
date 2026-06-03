"""命令行入口"""
import os
import click
from .demo_data import get_demo_csv_samples, get_demo_process_steps
from .service import run_standard_three_step_process
from .workflow import client_review_issue, manual_fix_issue, rerun_issue
from .visualization import export_layout_screenshot


@click.group()
def cli():
    """实验室危化品柜布局系统"""
    pass


@cli.command()
@click.option('--demo', is_flag=True, help='使用演示数据运行完整流程')
@click.option('--safety-csv', type=click.Path(exists=True), help='安全半径表CSV文件路径')
@click.option('--routes-csv', type=click.Path(exists=True), help='路线表CSV文件路径')
@click.option('--output-dir', type=click.Path(), default='./output', help='输出目录')
@click.option('--origin-x', type=float, default=0.0, help='坐标原点X')
@click.option('--origin-y', type=float, default=0.0, help='坐标原点Y')
@click.option('--origin-desc', type=str, default='', help='坐标原点说明')
def run(demo, safety_csv, routes_csv, output_dir, origin_x, origin_y, origin_desc):
    """运行标准三步流程"""
    if not demo and not (safety_csv and routes_csv):
        click.echo('❌ 请指定 --demo 使用演示数据，或同时提供 --safety-csv 和 --routes-csv')
        return

    click.echo('🚀 实验室危化品柜布局分析系统启动')
    click.echo('=' * 60)

    result = run_standard_three_step_process(
        safety_radius_path=safety_csv,
        routes_path=routes_csv,
        origin_point=(origin_x, origin_y),
        origin_description=origin_desc,
        output_dir=output_dir,
        use_demo=demo
    )

    click.echo('\n' + '=' * 60)
    click.echo('✅ 流程执行完成')
    click.echo(f'📁 输出目录: {os.path.abspath(output_dir)}')
    click.echo(f'🖼️  主报告: {result["exported_files"]["main_report"]}')
    for detail in result["exported_files"]["issue_details"]:
        click.echo(f'📄 问题详情: {detail}')


@cli.command()
@click.option('--output-dir', type=click.Path(), default='./demo_data', help='输出目录')
def generate_csv_samples(output_dir):
    """生成演示用的CSV样本文件"""
    files = get_demo_csv_samples(output_dir)
    click.echo('✅ 演示CSV样本已生成:')
    for name, path in files.items():
        click.echo(f'  📄 {name}: {os.path.abspath(path)}')


@cli.command()
def demo_steps():
    """查看演示流程步骤说明"""
    steps = get_demo_process_steps()
    click.echo('📋 演示流程步骤说明（园区运维小陶给新人讲流程用）')
    click.echo('=' * 60)
    for step in steps:
        click.echo(f'\n📍 步骤{step["step"]}: {step["title"]}')
        click.echo(f'   👤 执行人: {step["actor"]}')
        click.echo(f'   📝 说明: {step["description"]}')
        click.echo(f'   🎯 关键输出: {step["key_output"]}')


@cli.command()
@click.option('--issue-id', required=True, help='问题ID')
@click.option('--approved/--rejected', required=True, help='是否通过复核')
@click.option('--notes', required=True, help='复核意见')
@click.option('--demo', is_flag=True, help='基于演示数据操作')
@click.option('--output-dir', type=click.Path(), default='./output', help='项目输出目录')
def review(issue_id, approved, notes, demo, output_dir):
    """展陈客户复核问题"""
    from .demo_data import create_demo_project
    from .visualization import export_layout_screenshot

    if demo:
        project = create_demo_project()
    else:
        click.echo('❌ 请使用 --demo 基于演示数据操作')
        return

    result = client_review_issue(project, issue_id, approved, notes)

    if result:
        status = '通过' if approved else '驳回'
        click.echo(f'✅ 问题 {issue_id} 复核{status}')
        click.echo(f'📝 意见: {notes}')
        click.echo(f'📍 新状态: {result.status.value}')

        export_path = f'{output_dir}/layout_report_after_review.png'
        export_layout_screenshot(project, export_path)
        click.echo(f'🖼️  更新后的报告已导出: {export_path}')
    else:
        click.echo(f'❌ 问题 {issue_id} 不存在')


@cli.command()
@click.option('--issue-id', required=True, help='问题ID')
@click.option('--fix-notes', required=True, help='修正说明')
@click.option('--corrected-value', type=float, help='修正后的值')
@click.option('--demo', is_flag=True, help='基于演示数据操作')
def fix(issue_id, fix_notes, corrected_value, demo):
    """园区运维小陶人工修正问题"""
    from .demo_data import create_demo_project
    from .models import Handler

    if demo:
        project = create_demo_project()
    else:
        click.echo('❌ 请使用 --demo 基于演示数据操作')
        return

    result = manual_fix_issue(project, issue_id, fix_notes, Handler.PARK_OPS_XT, corrected_value)

    if result:
        click.echo(f'✅ 问题 {issue_id} 已人工修正')
        click.echo(f'📝 修正说明: {fix_notes}')
        click.echo(f'📍 新状态: {result.status.value}')
    else:
        click.echo(f'❌ 问题 {issue_id} 不存在')


@cli.command()
@click.option('--issue-id', required=True, help='问题ID')
@click.option('--demo', is_flag=True, help='基于演示数据操作')
def rerun(issue_id, demo):
    """重跑问题（重新计算路线长度）"""
    from .demo_data import create_demo_project

    if demo:
        project = create_demo_project()
    else:
        click.echo('❌ 请使用 --demo 基于演示数据操作')
        return

    result = rerun_issue(project, issue_id)

    if result:
        click.echo(f'✅ 问题 {issue_id} 已重跑')
        click.echo(f'📍 新状态: {result.status.value}')
        click.echo(f'👤 当前处理人: {result.current_handler.value}')
    else:
        click.echo(f'❌ 问题 {issue_id} 不存在')


if __name__ == '__main__':
    cli()
