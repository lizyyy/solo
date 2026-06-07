#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
推荐召回候选去重 - 命令行工具
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import click
from src import DedupEngine, SliceManager, FeatureVersionManager


class AppState:
    def __init__(self):
        self.fv_manager = FeatureVersionManager()
        self.dedup_engine = DedupEngine()
        self.slice_manager = SliceManager(feature_version_manager=self.fv_manager)
        self.data_dir = os.path.join(os.path.dirname(__file__), "data", "demo")


pass_state = click.make_pass_decorator(AppState, ensure=True)


@click.group()
@click.option('--data-dir', type=click.Path(exists=True), 
              help='数据目录路径，默认使用演示数据')
@pass_state
def cli(state, data_dir):
    """推荐召回候选去重工具 - 实验平台负责人阿越的得力助手"""
    if data_dir:
        state.data_dir = data_dir


@cli.command()
@pass_state
def demo(state):
    """运行完整演示流程"""
    click.echo("启动演示流程...")
    os.system(f"{sys.executable} {os.path.join(os.path.dirname(__file__), 'run_demo.py')}")


@cli.command()
@click.argument('yaml_path', type=click.Path(exists=True))
@pass_state
def import_params(state, yaml_path):
    """导入参数YAML，执行去重检测"""
    click.echo(f"导入参数文件: {yaml_path}")
    records = state.dedup_engine.load_params_yaml(yaml_path)
    summary = state.dedup_engine.batch_import(records)
    
    click.echo(f"\n导入完成:")
    click.echo(f"  总计: {summary['total']} 条")
    click.echo(f"  正常唯一: {summary['unique']} 条")
    click.echo(f"  检测重复: {summary['duplicate']} 条")
    click.echo(f"  待策略复核: {summary['review_required']} 条")
    
    if summary['issues']:
        click.echo("\n检测到的问题:")
        for issue in summary['issues']:
            sev_color = {'WARNING': 'yellow', 'SUCCESS': 'green', 'INFO': 'blue'}
            color = sev_color.get(issue.get('severity', 'INFO'), 'white')
            click.secho(f"  [{issue['severity']}] {issue['message']}", fg=color)
            if issue.get('action_required'):
                click.echo(f"    → {issue['action_required']}")


@cli.command()
@click.argument('yaml_path', type=click.Path(exists=True))
@pass_state
def import_slices(state, yaml_path):
    """导入评测切片，自动处理补录数据"""
    click.echo(f"导入评测切片: {yaml_path}")
    slices = state.slice_manager.load_eval_slices(yaml_path)
    summary = state.slice_manager.batch_import(slices)
    
    click.echo(f"\n导入完成:")
    click.echo(f"  总计: {summary['total']} 个")
    click.echo(f"  新增: {summary['new']} 个")
    click.echo(f"  更新: {summary['updated']} 个")
    click.echo(f"  补录切片: {summary['backfill']} 个")
    
    if summary['issues']:
        click.echo("\n检测到的问题:")
        for issue in summary['issues']:
            sev_color = {'WARNING': 'yellow', 'SUCCESS': 'green', 'INFO': 'blue'}
            color = sev_color.get(issue.get('severity', 'INFO'), 'white')
            click.secho(f"  [{issue['severity']}] {issue['message']}", fg=color)


@cli.command()
@click.argument('yaml_path', type=click.Path(exists=True))
@pass_state
def import_feature_versions(state, yaml_path):
    """导入特征版本表"""
    click.echo(f"导入特征版本: {yaml_path}")
    versions = state.fv_manager.load_versions_yaml(yaml_path)
    summary = state.fv_manager.batch_import(versions)
    
    click.echo(f"\n导入完成:")
    click.echo(f"  总计: {summary['total']} 个")
    click.echo(f"  新增: {summary['new']} 个")
    click.echo(f"  更新: {summary['updated']} 个")


@cli.command()
@pass_state
def list_records(state):
    """列出所有实验记录及去重状态"""
    records = state.dedup_engine.get_all_records()
    if not records:
        click.echo("暂无记录，请先导入参数YAML")
        return
    
    status_map = {
        "UNIQUE": ("✅", "green"),
        "DUPLICATE": ("⚠️", "yellow"),
        "APPROVED_DUPLICATE": ("✅", "green"),
        "REJECTED": ("❌", "red"),
        "NEW_VERSION": ("🔄", "cyan"),
        "PENDING_REVIEW": ("⏳", "yellow")
    }
    
    click.echo("\n实验记录列表:")
    for r in records:
        icon, color = status_map.get(r.dedup_status, ("?", "white"))
        review_flag = " 🔍待复核" if r.review_required else ""
        click.secho(f"  {icon} {r.record_id} | {r.experiment_name}{review_flag}", fg=color)
        if r.duplicate_of:
            click.echo(f"     重复于: {r.duplicate_of}")
        if r.reviewer:
            click.echo(f"     复核人: {r.reviewer}")


@cli.command()
@click.argument('record_id')
@click.option('--reviewer', required=True, help='复核人姓名')
@click.option('--decision', type=click.Choice(['APPROVE', 'REJECT', 'NEW_VERSION']),
              required=True, help='复核决定')
@click.option('--comment', default='', help='复核意见')
@pass_state
def review(state, record_id, reviewer, decision, comment):
    """复核重复记录"""
    result = state.dedup_engine.review_duplicate(record_id, reviewer, decision, comment)
    
    if result:
        decision_map = {
            "APPROVE": "通过",
            "REJECT": "拒绝",
            "NEW_VERSION": "标记为新版本"
        }
        click.secho(f"复核完成: {record_id}", fg='green')
        click.echo(f"  决定: {decision_map[decision]}")
        click.echo(f"  复核人: {reviewer}")
        if comment:
            click.echo(f"  意见: {comment}")
    else:
        click.secho(f"未找到记录: {record_id}", fg='red')


@cli.command()
@pass_state
def pending_review(state):
    """查看待复核的记录"""
    records = state.dedup_engine.get_pending_review()
    if not records:
        click.echo("✅ 没有待复核的记录")
        return
    
    click.echo(f"\n⏳ 待复核记录 ({len(records)} 条):")
    for r in records:
        click.secho(f"  {r.record_id} | {r.experiment_name}", fg='yellow')
        click.echo(f"     重复于: {r.duplicate_of}")


@cli.command()
@pass_state
def feature_versions(state):
    """查看特征版本表"""
    versions = state.fv_manager.get_all_versions()
    if not versions:
        click.echo("暂无特征版本")
        return
    
    click.echo("\n特征版本列表:")
    for fv in versions:
        active = "✅ 活跃" if fv.is_active else "⏸️  历史"
        click.echo(f"  {fv.version_id}: {fv.version_name} [{active}]")
        click.echo(f"     特征数: {len(fv.feature_list)} 个")
        if fv.notes:
            click.echo(f"     备注: {fv.notes}")


@cli.command()
@pass_state
def status(state):
    """查看当前系统状态概览"""
    records = state.dedup_engine.get_all_records()
    slices = state.slice_manager.get_all_slices()
    fv_count = len(state.fv_manager.get_all_versions())
    pending = len(state.dedup_engine.get_pending_review())
    backfill = len(state.slice_manager.get_backfill_slices())
    
    click.echo("\n" + "=" * 50)
    click.echo("  推荐召回候选去重 - 系统状态")
    click.echo("=" * 50)
    click.echo(f"  实验记录: {len(records)} 条")
    click.echo(f"  评测切片: {len(slices)} 个")
    click.echo(f"  特征版本: {fv_count} 个")
    if pending > 0:
        click.secho(f"  待策略复核: {pending} 条 ⚠️", fg='yellow')
    else:
        click.echo(f"  待策略复核: {pending} 条 ✅")
    if backfill > 0:
        click.secho(f"  补录切片: {backfill} 个", fg='cyan')
    click.echo("=" * 50)


if __name__ == "__main__":
    cli()
