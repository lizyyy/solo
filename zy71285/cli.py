#!/usr/bin/env python3
"""
命令行界面 - 声学房间模式计算工具
"""
import os
import sys
import click

from room_acoustics.workflow import AcousticWorkflow


@click.group()
def cli():
    """声学房间模式计算工具"""
    pass


@cli.command()
@click.option('--input', '-i', default='input', help='输入目录或文件路径')
@click.option('--output', '-o', default='output', help='输出目录')
@click.option('--history', '-h', default='history', help='历史记录目录')
@click.option('--no-reports', is_flag=True, help='不生成报告')
@click.option('--no-history', is_flag=True, help='不保存历史记录')
@click.option('--no-diff', is_flag=True, help='不进行差异对比')
def run(input, output, history, no_reports, no_history, no_diff):
    """批量处理输入文件并生成报告"""
    click.echo("=" * 60)
    click.echo("声学房间模式计算工具")
    click.echo("=" * 60)

    workflow = AcousticWorkflow(
        output_dir=output,
        history_dir=history,
        input_dir=os.path.dirname(input) if os.path.isfile(input) else input
    )

    if os.path.isfile(input):
        click.echo(f"\n处理文件: {input}")
        result, issues = workflow.process_file(
            filepath=input,
            generate_reports=not no_reports,
            save_history=not no_history,
            compare_history=not no_diff
        )

        if result:
            click.echo(f"  ✓ 处理成功: {result.project_id}")
            click.echo(f"  - 模式数量: {len(result.modes)}")
            click.echo(f"  - 风险间隔: {len(result.frequency_gaps)} 处")
            click.echo(f"  - 模式聚集: {len(result.mode_clusters)} 处")
            if issues:
                click.echo(f"  - 警告: {len(issues)} 个")
        else:
            click.echo(f"  ✗ 处理失败")
            for issue in issues:
                click.echo(f"    [{issue.severity}] {issue.field}: {issue.message}")
    else:
        click.echo(f"\n批量处理目录: {input}")
        result = workflow.process_batch(
            directory=input,
            generate_reports=not no_reports,
            save_history=not no_history,
            compare_history=not no_diff
        )

        summary = result.summary()
        click.echo(f"\n处理完成:")
        click.echo(f"  ✓ 有效文件: {summary['valid_count']}")
        click.echo(f"  ✗ 问题文件: {summary['dirty_count']}")
        click.echo(f"  🔄 差异对比: {summary['diff_count']}")

        if result.dirty_data:
            dirty_report = workflow.export_dirty_data_report(result.dirty_data)
            click.echo(f"\n问题数据报告已生成: {dirty_report}")

    click.echo(f"\n输出目录: {os.path.abspath(output)}")
    click.echo("完成!")


@cli.command()
@click.argument('project_id')
@click.option('--history', '-h', default='history', help='历史记录目录')
@click.option('--output', '-o', default='output', help='输出目录')
def diff(project_id, history, output):
    """比较同一项目的最新两次结果"""
    from room_acoustics.report_generator import HistoryManager, DiffAnalyzer

    hm = HistoryManager(history_dir=history)
    history_files = hm.get_project_history(project_id)

    if len(history_files) < 2:
        click.echo(f"错误: 项目 '{project_id}' 至少需要两次历史记录才能对比")
        click.echo(f"当前找到: {len(history_files)} 条记录")
        return

    old_result = hm.load_result(history_files[1])
    new_result = hm.load_result(history_files[0])

    if not old_result or not new_result:
        click.echo("错误: 无法加载历史记录")
        return

    da = DiffAnalyzer()
    diff_result = da.compare_results(old_result, new_result)
    report_path = da.generate_diff_report(diff_result, output)

    click.echo(f"差异报告已生成: {report_path}")


@cli.command()
@click.option('--output', '-o', default='input', help='示例文件输出目录')
def sample(output):
    """生成示例输入文件"""
    import json
    import yaml

    os.makedirs(output, exist_ok=True)

    sample_normal = {
        'project_id': 'studio_normal_v1',
        'room_dimensions': {
            'length': 6.0,
            'width': 4.2,
            'height': 2.8,
            'unit': 'm'
        },
        'sound_speed': 343.0,
        'min_frequency': 20.0,
        'max_frequency': 200.0,
        'listening_points': [
            {'x': 3.0, 'y': 2.1, 'z': 1.2},
            {'x': 1.5, 'y': 2.1, 'z': 1.2}
        ],
        'absorption_materials': {
            'bass_trap': {'63': 0.8, '125': 0.6},
            'acoustic_panel': {'125': 0.3, '250': 0.7}
        },
        'notes': '标准录音棚配置 v1'
    }

    sample_dirty = {
        'project_id': 'studio_dirty',
        'room_dimensions': {
            'length': 'invalid',
            'width': 4.2,
            'height': 2.8,
            'unit': 'unknown'
        },
        'sound_speed': 343.0,
        'listening_points': [
            {'x': 10.0, 'y': 2.1, 'z': 1.2},
            {'x': 3.0, 'y': 2.1, 'z': 1.2},
            {'x': 3.0, 'y': 2.1, 'z': 1.2}
        ],
        'notes': '包含各种问题的脏数据示例'
    }

    sample_modified = {
        'project_id': 'studio_normal_v1',
        'room_dimensions': {
            'length': 6.5,
            'width': 4.5,
            'height': 3.0,
            'unit': 'm'
        },
        'sound_speed': 343.0,
        'min_frequency': 20.0,
        'max_frequency': 200.0,
        'listening_points': [
            {'x': 3.25, 'y': 2.25, 'z': 1.2}
        ],
        'notes': '修改后的配置 - 用于差异对比测试'
    }

    with open(os.path.join(output, 'studio_normal.json'), 'w', encoding='utf-8') as f:
        json.dump(sample_normal, f, ensure_ascii=False, indent=2)

    with open(os.path.join(output, 'studio_dirty.json'), 'w', encoding='utf-8') as f:
        json.dump(sample_dirty, f, ensure_ascii=False, indent=2)

    with open(os.path.join(output, 'studio_modified.json'), 'w', encoding='utf-8') as f:
        json.dump(sample_modified, f, ensure_ascii=False, indent=2)

    click.echo(f"示例文件已生成到: {os.path.abspath(output)}")
    click.echo("  - studio_normal.json: 正常配置示例")
    click.echo("  - studio_dirty.json: 包含脏数据的示例")
    click.echo("  - studio_modified.json: 修改后的配置示例")


@cli.command()
def info():
    """显示工具信息"""
    click.echo("=" * 60)
    click.echo("声学房间模式计算工具 v0.1.0")
    click.echo("=" * 60)
    click.echo("")
    click.echo("功能特性:")
    click.echo("  ✓ 轴向/切向/斜向驻波模式计算")
    click.echo("  ✓ 频率间隔风险分析")
    click.echo("  ✓ 模式聚集检测")
    click.echo("  ✓ 监听点位置验证")
    click.echo("  ✓ 脏数据分离与标记")
    click.echo("  ✓ 单位混用检测")
    click.echo("  ✓ 可视化图表导出")
    click.echo("  ✓ 历史版本管理")
    click.echo("  ✓ 变更差异对比")
    click.echo("")
    click.echo("支持格式: JSON, YAML, CSV")
    click.echo("")


if __name__ == '__main__':
    cli()
