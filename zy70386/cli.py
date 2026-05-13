#!/usr/bin/env python3
import click
import os
import sys
from tabulate import tabulate

from importer import Importer
from checker import ConflictChecker
from resolver import ConflictResolver
from exporter import Exporter
from database import Database
from config import get_config


@click.group()
def cli():
    """会员标签冲突检查与管理工具"""
    pass


@cli.command()
@click.option('--file', '-f', 'file_path', required=True, help='导入文件路径 (CSV或JSON)')
@click.option('--source', '-s', required=True, type=click.Choice(['marketing', 'risk_control', 'customer_service']),
              help='数据来源')
@click.option('--imported-by', '-u', default='system', help='导入人')
@click.option('--check/--no-check', default=True, help='导入后自动检查冲突')
def imp(file_path, source, imported_by, check):
    """导入会员标签数据"""
    config = get_config()
    source_display = config.get_source_display_name(source)
    
    click.echo(f"\n开始导入 - 来源: {source_display}")
    click.echo(f"文件: {file_path}")
    
    try:
        importer = Importer()
        
        if file_path.endswith('.json'):
            result = importer.import_from_json(file_path, source, imported_by)
        else:
            result = importer.import_from_csv(file_path, source, imported_by)
        
        click.echo(f"\n导入完成:")
        click.echo(f"  - 批次ID: {result['batch_id']}")
        click.echo(f"  - 会员数: {result['imported_members']}")
        click.echo(f"  - 新增标签: {result['imported_tags']}")
        if result['duplicate_tags']:
            click.echo(f"  - 跳过重复: {result['duplicate_tags']}")
        
        if result['warnings']:
            click.echo(f"\n警告:")
            for warn in result['warnings']:
                click.echo(f"  ! {warn}")
        
        if check and (result['imported_tags'] > 0 or result['warnings']):
            click.echo("\n--- 开始冲突检查 ---")
            checker = ConflictChecker()
            check_result = checker.check_all()
            _print_all_result(check_result)
            
    except FileNotFoundError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option('--member', '-m', help='指定会员ID检查')
def check(member):
    """检查标签冲突"""
    checker = ConflictChecker()
    
    if member:
        click.echo(f"\n检查会员: {member}")
        result = checker.check_member(member)
        _print_member_result(result)
    else:
        click.echo("\n检查所有会员...")
        result = checker.check_all()
        _print_all_result(result)


def _print_member_result(result):
    click.echo(f"\n会员ID: {result['member_id']}")
    click.echo(f"冲突数: {result['conflict_count']}")
    
    if result['tags']:
        click.echo("\n当前标签:")
        table = []
        for tag in result['tags']:
            table.append([
                tag['id'],
                tag['tag_name'],
                tag['source_display_name'],
                tag.get('reason') or '-',
                tag.get('start_date') or '-',
                tag.get('end_date') or '-',
            ])
        click.echo(tabulate(table, headers=['ID', '标签', '来源', '原因', '开始', '结束'],
                          tablefmt='simple'))
    
    if result['conflicts']:
        _print_conflicts(result['conflicts'])
    else:
        click.echo("\n✓ 无冲突，可以直接投放")


def _print_all_result(result):
    click.echo(f"\n总会员数: {result['total_members']}")
    click.echo(f"可直接投放: {result['ready_count']}")
    click.echo(f"需人工确认: {result['need_review_count']}")
    click.echo(f"冲突总数: {result['conflict_count']}")
    
    if result['ready_count'] > 0:
        click.echo(f"\n--- 可直接投放名单 ---")
        table = [[mid] for mid in result['ready_members']]
        click.echo(tabulate(table, headers=['会员ID'], tablefmt='simple'))
    
    if result['need_review_count'] > 0:
        click.echo(f"\n--- 需人工确认名单 ---")
        table = []
        seen_members = set()
        for c in result['conflicts']:
            if c['member_id'] not in seen_members:
                seen_members.add(c['member_id'])
                conflicts = [conf for conf in result['conflicts'] if conf['member_id'] == c['member_id']]
                conflict_types = ', '.join(set(conf['type'] for conf in conflicts))
                table.append([c['member_id'], conflict_types, len(conflicts)])
        click.echo(tabulate(table, headers=['会员ID', '冲突类型', '冲突数'], tablefmt='simple'))
        
        click.echo(f"\n--- 冲突详情 ---")
        _print_conflicts(result['conflicts'])


def _print_conflicts(conflicts):
    type_map = {
        'mutually_exclusive': '互斥标签',
        'expired': '过期标签',
        'duplicate': '重复标签',
        'source_conflict': '来源冲突',
        'missing_reason': '缺少原因',
        'reappearance': '标签复发',
    }
    
    table = []
    for c in conflicts:
        tags = []
        db = Database()
        for tid in c['tag_ids']:
            tag = db.get_tag_by_id(tid)
            if tag:
                tags.append(f"{tag['tag_name']}({tag['source_display_name']})")
        
        table.append([
            c['id'],
            c.get('member_id', ''),
            type_map.get(c['type'], c['type']),
            c['description'],
        ])
    click.echo(tabulate(table, headers=['冲突ID', '会员ID', '类型', '说明'], tablefmt='simple'))


@cli.command()
@click.option('--conflict', '-c', 'conflict_id', type=int, help='冲突ID')
@click.option('--auto/--manual', default=False, help='自动按优先级规则解决')
@click.option('--keep', '-k', 'keep_tags', multiple=True, type=int, help='保留的标签ID (可多个)')
@click.option('--reason', '-r', help='处理原因')
@click.option('--resolved-by', '-u', default='system', help='处理人')
@click.option('--all/--no-all', default=False, help='解决所有可自动处理的冲突')
def resolve(conflict_id, auto, keep_tags, reason, resolved_by, all):
    """解决标签冲突"""
    resolver = ConflictResolver()
    
    if all:
        _resolve_all(resolver, resolved_by)
        return
    
    if not conflict_id:
        click.echo("\n--- 待解决冲突列表 ---")
        conflicts = resolver.get_conflicts_for_review()
        if not conflicts:
            click.echo("没有待解决的冲突")
            return
        
        table = []
        for c in conflicts:
            tag_names = ', '.join([f"{t['tag_name']}({t['source_display_name']})" for t in c['tags']])
            has_history = len(c['history']) > 0
            table.append([
                c['id'],
                c['member_id'],
                c['member_name'] or '-',
                c['conflict_type'],
                tag_names,
                '有' if has_history else '否',
            ])
        click.echo(tabulate(table, headers=['冲突ID', '会员ID', '姓名', '类型', '冲突标签', '有历史'],
                          tablefmt='simple'))
        return
    
    if auto:
        result = resolver.auto_resolve_priority(conflict_id, resolved_by)
        if result['success']:
            click.echo(f"\n✓ {result['message']}")
            if 'kept' in result:
                click.echo(f"  保留: {', '.join(result['kept'])}")
            if 'removed' in result:
                click.echo(f"  清除: {', '.join(result['removed'])}")
        else:
            click.echo(f"\n✗ {result['message']}")
    elif keep_tags:
        result = resolver.manual_resolve(conflict_id, resolved_by, list(keep_tags), reason)
        if result['success']:
            click.echo(f"\n✓ {result['message']}")
            click.echo(f"  保留: {', '.join(result['kept'])}")
            click.echo(f"  清除: {', '.join(result['removed'])}")
            if result.get('reason'):
                click.echo(f"  原因: {result['reason']}")
        else:
            click.echo(f"\n✗ {result['message']}")
    else:
        db = Database()
        conflicts = db.get_conflicts()
        conflict = next((c for c in conflicts if c['id'] == conflict_id), None)
        
        if not conflict:
            click.echo(f"冲突 {conflict_id} 不存在")
            return
        
        tag_ids = list(map(int, conflict['tag_ids'].split(',')))
        tags = [db.get_tag_by_id(tid) for tid in tag_ids]
        tags = [t for t in tags if t]
        
        click.echo(f"\n冲突详情:")
        click.echo(f"  ID: {conflict['id']}")
        click.echo(f"  类型: {conflict['conflict_type']}")
        click.echo(f"  说明: {conflict['description']}")
        click.echo("\n涉及标签:")
        for tag in tags:
            click.echo(f"  [{tag['id']}] {tag['tag_name']} - {tag['source_display_name']}")
            if tag.get('reason'):
                click.echo(f"      原因: {tag['reason']}")
        
        history = db.get_resolution_history(conflict['member_id'])
        if history:
            click.echo(f"\n历史处理记录:")
            for h in history:
                click.echo(f"  - {h['resolution']} (处理人: {h.get('resolved_by', '-')}, {h.get('resolved_at', '-')})")


def _resolve_all(resolver, resolved_by):
    db = Database()
    conflicts = db.get_conflicts()
    
    auto_resolved = 0
    manual_needed = 0
    
    for c in conflicts:
        result = resolver.auto_resolve_priority(c['id'], resolved_by)
        if result['success']:
            auto_resolved += 1
        else:
            manual_needed += 1
    
    click.echo(f"\n自动解决完成:")
    click.echo(f"  自动解决: {auto_resolved}")
    click.echo(f"  需人工处理: {manual_needed}")


@cli.command()
@click.option('--member', '-m', help='指定会员ID查询历史')
@click.option('--resolved/--all', default=True, help='只显示已解决的')
@click.option('--format', '-f', 'fmt', type=click.Choice(['table', 'csv', 'json']), default='table')
def history(member, resolved, fmt):
    """查询冲突处理历史"""
    db = Database()
    exporter = Exporter()
    
    if fmt == 'json':
        result = exporter.export_resolution_history(member, 'json')
        click.echo(result)
        return
    
    if fmt == 'csv':
        result = exporter.export_resolution_history(member, 'csv')
        click.echo(result)
        return
    
    if member:
        history = db.get_conflict_history(member)
        click.echo(f"\n会员 {member} 的冲突历史:")
    else:
        history = db.get_conflicts(resolved=resolved)
        if resolved:
            click.echo("\n已解决的冲突历史:")
        else:
            click.echo("\n未解决的冲突:")
    
    if not history:
        click.echo("没有记录")
        return
    
    table = []
    for h in history:
        member = db.get_member(h['member_id'])
        table.append([
            h['id'],
            h['member_id'],
            member.get('name', '-') if member else '-',
            h['conflict_type'],
            h['resolution'] or h['description'],
            h.get('resolved_by', '-'),
            h.get('resolved_at', '-') if h.get('resolved') else '未解决',
        ])
    click.echo(tabulate(table, headers=['ID', '会员ID', '姓名', '类型', '处理/说明', '处理人', '处理时间'],
                      tablefmt='simple'))


@cli.command()
@click.option('--type', '-t', 'export_type', 
              type=click.Choice(['ready', 'review', 'report', 'history']),
              default='ready', help='导出类型')
@click.option('--format', '-f', 'fmt', type=click.Choice(['csv', 'json']), default='csv')
@click.option('--output', '-o', 'output_file', help='输出文件路径')
@click.option('--include-history/--no-history', default=False, help='包含历史信息')
def export(export_type, fmt, output_file, include_history):
    """导出数据"""
    exporter = Exporter()
    
    if export_type == 'ready':
        data = exporter.export_ready_list(fmt, include_history)
        desc = '可直接投放名单'
    elif export_type == 'review':
        data = exporter.export_need_review_list(fmt, include_history)
        desc = '需人工确认名单'
    elif export_type == 'report':
        data = exporter.export_clean_report(fmt)
        desc = '清洗报告'
    else:
        data = exporter.export_resolution_history(None, fmt)
        desc = '处理历史'
    
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(data)
        click.echo(f"已导出 {desc} 到: {output_file}")
    else:
        click.echo(f"\n--- {desc} ---")
        click.echo(data)


if __name__ == '__main__':
    cli()
