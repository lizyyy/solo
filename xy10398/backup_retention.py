#!/usr/bin/env python3
"""本地备份留存策略 CLI"""

import os
import re
import json
import hashlib
import shutil
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path
import click


DEFAULT_CONFIG = {
    "backup_dir": "./backups",
    "daily_keep": 7,
    "weekly_keep": 4,
    "monthly_keep": 12,
    "retention_days": 90,
    "date_pattern": r"(\d{4})[._-]?(\d{2})[._-]?(\d{2})",
    "exceptions": [],
    "confirmations_file": ".backup_confirmations.json"
}


def load_config(config_file: str) -> dict:
    if not os.path.exists(config_file):
        raise click.ClickException(f"配置文件不存在: {config_file}")
    with open(config_file, 'r', encoding='utf-8') as f:
        config = json.load(f)
    for key, value in DEFAULT_CONFIG.items():
        if key not in config:
            config[key] = value
    return config


def load_confirmations(confirmations_file: str) -> set:
    if os.path.exists(confirmations_file):
        with open(confirmations_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return set(data.get('confirmed_files', []))
    return set()


def save_confirmations(confirmations_file: str, confirmed_files: set):
    with open(confirmations_file, 'w', encoding='utf-8') as f:
        json.dump({'confirmed_files': list(confirmed_files)}, f, indent=2)


def parse_date_from_filename(filename: str, pattern: str) -> datetime:
    match = re.search(pattern, filename)
    if not match:
        return None
    try:
        year, month, day = map(int, match.groups())
        return datetime(year, month, day)
    except (ValueError, TypeError):
        return None


def get_file_hash(filepath: str, chunk_size: int = 8192) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()


def scan_backup_dir(backup_dir: str, date_pattern: str) -> tuple:
    files = []
    issues = []
    
    if not os.path.exists(backup_dir):
        raise click.ClickException(f"备份目录不存在: {backup_dir}")
    
    for root, _, filenames in os.walk(backup_dir):
        for filename in filenames:
            filepath = os.path.join(root, filename)
            if filename.startswith('.'):
                continue
            
            file_date = parse_date_from_filename(filename, date_pattern)
            file_size = os.path.getsize(filepath)
            
            if file_date is None:
                issues.append({
                    'type': 'date_parse_error',
                    'filepath': filepath,
                    'message': f"无法从文件名解析日期: {filename}"
                })
            
            files.append({
                'filepath': filepath,
                'filename': filename,
                'date': file_date,
                'size': file_size,
                'mtime': datetime.fromtimestamp(os.path.getmtime(filepath))
            })
    
    return files, issues


def find_duplicates(files: list) -> dict:
    size_groups = defaultdict(list)
    for f in files:
        size_groups[f['size']].append(f)
    
    duplicates = {}
    for size, group in size_groups.items():
        if len(group) < 2:
            continue
        
        hash_groups = defaultdict(list)
        for f in group:
            try:
                file_hash = get_file_hash(f['filepath'])
                hash_groups[file_hash].append(f)
            except Exception as e:
                continue
        
        for file_hash, dup_group in hash_groups.items():
            if len(dup_group) >= 2:
                duplicates[file_hash] = dup_group
    
    return duplicates


def apply_retention_policy(files: list, daily_keep: int, weekly_keep: int, 
                           monthly_keep: int, retention_days: int, 
                           exceptions: list, now: datetime = None) -> tuple:
    if now is None:
        now = datetime.now()
    
    cutoff_date = now - timedelta(days=retention_days)
    
    keep = []
    remove = []
    expired = []
    issues = []
    
    dated_files = [f for f in files if f['date'] is not None]
    undated_files = [f for f in files if f['date'] is None]
    
    daily_groups = defaultdict(list)
    weekly_groups = defaultdict(list)
    monthly_groups = defaultdict(list)
    
    for f in dated_files:
        date = f['date']
        daily_key = date.strftime('%Y-%m-%d')
        weekly_key = f"{date.year}-{date.isocalendar().week:02d}"
        monthly_key = date.strftime('%Y-%m')
        daily_groups[daily_key].append(f)
        weekly_groups[weekly_key].append(f)
        monthly_groups[monthly_key].append(f)
    
    daily_dates = sorted(daily_groups.keys(), reverse=True)[:daily_keep]
    weekly_dates = sorted(weekly_groups.keys(), reverse=True)[:weekly_keep]
    monthly_dates = sorted(monthly_groups.keys(), reverse=True)[:monthly_keep]
    
    keep_dates = set()
    for d in daily_dates:
        keep_dates.add(d)
    for w in weekly_dates:
        for f in weekly_groups[w]:
            keep_dates.add(f['date'].strftime('%Y-%m-%d'))
    for m in monthly_dates:
        for f in monthly_groups[m]:
            keep_dates.add(f['date'].strftime('%Y-%m-%d'))
    
    exception_set = set(exceptions)
    
    for f in dated_files:
        date_key = f['date'].strftime('%Y-%m-%d')
        in_exception = f['filepath'] in exception_set or f['filename'] in exception_set
        
        if f['date'] < cutoff_date:
            expired.append(f)
            if not in_exception:
                remove.append(f)
            else:
                keep.append(f)
        elif date_key in keep_dates or in_exception:
            keep.append(f)
        else:
            remove.append(f)
    
    for f in undated_files:
        in_exception = f['filepath'] in exception_set or f['filename'] in exception_set
        if in_exception:
            keep.append(f)
        else:
            remove.append(f)
    
    if daily_keep < 0 or weekly_keep < 0 or monthly_keep < 0 or retention_days < 0:
        issues.append({
            'type': 'rule_conflict',
            'message': '保留策略参数不能为负数'
        })
    
    return keep, remove, expired, issues


def confirm_deletion(files_to_remove: list, confirmed_files: set) -> tuple:
    new_confirmed = set()
    already_confirmed = set()
    
    for f in files_to_remove:
        if f['filepath'] in confirmed_files:
            already_confirmed.add(f['filepath'])
        else:
            new_confirmed.add(f['filepath'])
    
    return new_confirmed, already_confirmed


def delete_files(files_to_remove: list, confirmed_files: set, simulate: bool = True) -> tuple:
    deleted = []
    errors = []
    not_confirmed = []
    
    for f in files_to_remove:
        if f['filepath'] not in confirmed_files:
            not_confirmed.append(f)
            continue
        
        if simulate:
            deleted.append(f)
        else:
            try:
                os.remove(f['filepath'])
                deleted.append(f)
            except Exception as e:
                errors.append({
                    'filepath': f['filepath'],
                    'error': str(e)
                })
    
    return deleted, errors, not_confirmed


def generate_report(config: dict, files: list, keep: list, remove: list, 
                    expired: list, duplicates: dict, issues: list,
                    confirmed_files: set, simulate: bool) -> str:
    lines = []
    lines.append("=" * 70)
    lines.append("          本 地 备 份 留 存 策 略 报 告")
    lines.append("=" * 70)
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"备份目录: {config['backup_dir']}")
    lines.append(f"模式: {'【模拟模式】 - 不会实际删除任何文件' if simulate else '【确认模式】 - 将执行实际删除操作'}")
    lines.append("-" * 70)
    
    lines.append("\n【配置信息】")
    lines.append(f"  - 每日保留: {config['daily_keep']} 天")
    lines.append(f"  - 每周保留: {config['weekly_keep']} 周")
    lines.append(f"  - 每月保留: {config['monthly_keep']} 月")
    lines.append(f"  - 最大保留期: {config['retention_days']} 天")
    lines.append(f"  - 例外文件: {len(config.get('exceptions', []))} 个")
    
    if config.get('exceptions'):
        for exc in config['exceptions']:
            lines.append(f"    * {exc}")
    
    lines.append("\n【统计概览】")
    lines.append(f"  - 扫描文件总数: {len(files)}")
    lines.append(f"  - 保留文件数: {len(keep)}")
    lines.append(f"  - 待删除文件数: {len(remove)}")
    lines.append(f"  - 超期文件数: {len(expired)}")
    lines.append(f"  - 已确认删除: {len(confirmed_files)} 个文件")
    
    if duplicates:
        lines.append(f"  - 重复文件组数: {len(duplicates)}")
        total_dups = sum(len(g) for g in duplicates.values()) - len(duplicates)
        lines.append(f"  - 重复文件总数: {total_dups}")
    
    if keep:
        lines.append("\n【保留文件详情】")
        lines.append("-" * 70)
        sorted_keep = sorted(keep, key=lambda x: x['date'] or datetime.min, reverse=True)
        for f in sorted_keep:
            date_str = f['date'].strftime('%Y-%m-%d') if f['date'] else 'N/A'
            reason = "保留策略"
            if f['filepath'] in config.get('exceptions', []) or f['filename'] in config.get('exceptions', []):
                reason = "例外清单"
            lines.append(f"  ✓ [{date_str}] {f['filename']} - {reason}")
    
    if remove:
        lines.append("\n【待删除文件详情】")
        lines.append("-" * 70)
        sorted_remove = sorted(remove, key=lambda x: x['date'] or datetime.min)
        for f in sorted_remove:
            date_str = f['date'].strftime('%Y-%m-%d') if f['date'] else 'N/A'
            reason = "超期" if f in expired else "不在保留策略内"
            if f['filepath'] in confirmed_files:
                status = "[已确认]"
            else:
                status = "[待确认]"
            lines.append(f"  ✗ [{date_str}] {f['filename']} - {reason} {status}")
    
    if duplicates:
        lines.append("\n【重复文件检测】")
        lines.append("-" * 70)
        for file_hash, group in duplicates.items():
            lines.append(f"\n  哈希: {file_hash[:16]}...")
            group_sorted = sorted(group, key=lambda x: x['date'] or datetime.min, reverse=True)
            for i, f in enumerate(group_sorted):
                status = "【保留最新】" if i == 0 else "【重复待删】"
                date_str = f['date'].strftime('%Y-%m-%d') if f['date'] else 'N/A'
                lines.append(f"    {status} [{date_str}] {f['filename']}")
    
    if issues:
        lines.append("\n【问题检测】")
        lines.append("-" * 70)
        for issue in issues:
            lines.append(f"  ⚠ {issue['type']}: {issue['message']}")
    
    lines.append("\n" + "=" * 70)
    lines.append("【重要提示 - 模拟 vs 确认】")
    lines.append("-" * 70)
    lines.append("  1. 模拟模式(simulate=True):")
    lines.append("     - 仅显示将要删除的文件")
    lines.append("     - 不会实际删除任何文件")
    lines.append("     - 安全的预览模式")
    lines.append("")
    lines.append("  2. 确认模式(simulate=False):")
    lines.append("     - 只删除已在确认状态中的文件")
    lines.append("     - 实际删除文件后无法恢复")
    lines.append("     - 必须先使用 confirm 命令确认")
    lines.append("")
    lines.append("  3. 确认状态:")
    lines.append("     - 存储在: {}".format(config['confirmations_file']))
    lines.append("     - 再次扫描不会改变确认状态")
    lines.append("     - 使用 --reset 可重置所有确认")
    lines.append("=" * 70)
    
    return "\n".join(lines)


@click.group()
def cli():
    """本地备份留存策略 CLI"""
    pass


@cli.command()
@click.option('--config', default='backup_config.json', help='配置文件路径')
@click.option('--backup-dir', default='./backups', help='样例备份目录')
def init(config, backup_dir):
    """初始化样例配置和备份目录"""
    
    if os.path.exists(config):
        click.echo(f"⚠  配置文件已存在: {config}")
        click.echo("   使用 --reset 选项可覆盖（需确认）")
        return
    
    config_data = DEFAULT_CONFIG.copy()
    config_data['backup_dir'] = backup_dir
    config_data['exceptions'] = [
        'important_full_backup_2024-01-01.tar.gz',
        'critical_restore_point_2024-06-15.zip'
    ]
    
    with open(config, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=2, ensure_ascii=False)
    
    click.echo(f"✓ 已创建配置文件: {config}")
    
    if os.path.exists(backup_dir):
        click.echo(f"⚠  备份目录已存在: {backup_dir}")
    else:
        os.makedirs(backup_dir)
        click.echo(f"✓ 已创建备份目录: {backup_dir}")
        
        now = datetime.now()
        sample_files = []
        
        for i in range(10):
            dt = now - timedelta(days=i)
            sample_files.append(
                (f'daily_backup_{dt.strftime("%Y-%m-%d")}.tar.gz', f'Daily backup {i+1}')
            )
        
        for i in range(6):
            dt = now - timedelta(weeks=i)
            sample_files.append(
                (f'weekly_archive_{dt.strftime("%Y-%m-%d")}.zip', f'Weekly archive {i+1}')
            )
        
        for i in range(15):
            dt = now - timedelta(days=30*i)
            sample_files.append(
                (f'monthly_snapshot_{dt.strftime("%Y-%m-%d")}.tar', f'Monthly snapshot {i+1}')
            )
        
        sample_files.append(('important_full_backup_2024-01-01.tar.gz', 'Important backup'))
        sample_files.append(('critical_restore_point_2024-06-15.zip', 'Critical restore point'))
        sample_files.append(('unknown_date_format_backup.bin', 'Unknown date format'))
        
        duplicate_content = 'This is duplicate content for testing deduplication'
        for i in range(3):
            dt = now - timedelta(days=i)
            sample_files.append(
                (f'duplicate_test_{dt.strftime("%Y-%m-%d")}.dup', duplicate_content)
            )
        
        for filename, content in sample_files:
            filepath = os.path.join(backup_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
        
        click.echo(f"✓ 已创建 {len(sample_files)} 个样例备份文件")
        click.echo("")
        click.echo("【样例说明】")
        click.echo("  - daily_backup_*: 近10天的每日备份（保留最近7天）")
        click.echo("  - weekly_archive_*: 近6周的周备份（保留最近4周）")
        click.echo("  - monthly_snapshot_*: 15个月的月备份（保留最近12个月）")
        click.echo("  - important_full_backup_*: 例外清单中的文件（永远保留）")
        click.echo("  - critical_restore_point_*: 例外清单中的文件（永远保留）")
        click.echo("  - unknown_date_format_backup.bin: 无法解析日期的文件（待处理）")
        click.echo("  - duplicate_test_*.dup: 内容重复的文件（去重测试）")


@cli.command()
@click.option('--config', default='backup_config.json', help='配置文件路径')
def scan(config):
    """扫描备份目录并显示文件信息"""
    try:
        cfg = load_config(config)
    except click.ClickException as e:
        click.echo(str(e))
        return
    
    click.echo(f"正在扫描: {cfg['backup_dir']}")
    click.echo("")
    
    files, issues = scan_backup_dir(cfg['backup_dir'], cfg['date_pattern'])
    
    click.echo(f"扫描完成，共发现 {len(files)} 个文件")
    click.echo("")
    
    if issues:
        click.echo("【问题警告】")
        for issue in issues:
            click.echo(f"  ⚠ {issue['message']}")
        click.echo("")
    
    click.echo("【文件列表】")
    click.echo("-" * 70)
    sorted_files = sorted(files, key=lambda x: x['date'] or datetime.min, reverse=True)
    for f in sorted_files:
        date_str = f['date'].strftime('%Y-%m-%d') if f['date'] else 'N/A'
        click.echo(f"  [{date_str}] {f['filename']}")


@cli.command()
@click.option('--config', default='backup_config.json', help='配置文件路径')
@click.option('--output', '-o', default=None, help='输出报告文件路径')
def preview(config, output):
    """预览清理计划（模拟删除）"""
    try:
        cfg = load_config(config)
    except click.ClickException as e:
        click.echo(str(e))
        return
    
    files, scan_issues = scan_backup_dir(cfg['backup_dir'], cfg['date_pattern'])
    duplicates = find_duplicates(files)
    confirmed_files = load_confirmations(cfg['confirmations_file'])
    
    keep, remove, expired, rule_issues = apply_retention_policy(
        files, cfg['daily_keep'], cfg['weekly_keep'], cfg['monthly_keep'],
        cfg['retention_days'], cfg['exceptions']
    )
    
    all_issues = scan_issues + rule_issues
    
    if not cfg.get('exceptions'):
        all_issues.append({
            'type': 'exceptions_missing',
            'message': '例外清单为空 - 建议添加重要备份文件'
        })
    
    report = generate_report(cfg, files, keep, remove, expired, duplicates, 
                            all_issues, confirmed_files, simulate=True)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report)
        click.echo(f"报告已导出到: {output}")
    else:
        click.echo(report)


@cli.command()
@click.option('--config', default='backup_config.json', help='配置文件路径')
@click.option('--reset', is_flag=True, help='重置所有确认状态')
def confirm(config, reset):
    """确认归档（标记待删除文件）"""
    try:
        cfg = load_config(config)
    except click.ClickException as e:
        click.echo(str(e))
        return
    
    confirmed_files = load_confirmations(cfg['confirmations_file'])
    
    if reset:
        if click.confirm("确定要重置所有确认状态吗？"):
            confirmed_files = set()
            save_confirmations(cfg['confirmations_file'], confirmed_files)
            click.echo("✓ 已重置所有确认状态")
        return
    
    files, _ = scan_backup_dir(cfg['backup_dir'], cfg['date_pattern'])
    keep, remove, _, _ = apply_retention_policy(
        files, cfg['daily_keep'], cfg['weekly_keep'], cfg['monthly_keep'],
        cfg['retention_days'], cfg['exceptions']
    )
    
    new_confirmed, already_confirmed = confirm_deletion(remove, confirmed_files)
    
    click.echo(f"当前待删除文件: {len(remove)} 个")
    click.echo(f"已确认: {len(already_confirmed)} 个")
    click.echo(f"新增确认: {len(new_confirmed)} 个")
    click.echo("")
    
    if new_confirmed:
        click.echo("【新增确认删除的文件】")
        for fp in sorted(new_confirmed):
            click.echo(f"  ✓ {os.path.basename(fp)}")
        
        if click.confirm("确认以上 {count} 个文件的删除计划？".format(count=len(new_confirmed))):
            confirmed_files.update(new_confirmed)
            save_confirmations(cfg['confirmations_file'], confirmed_files)
            click.echo(f"✓ 已确认 {len(new_confirmed)} 个文件的删除计划")
            click.echo(f"  确认状态已保存到: {cfg['confirmations_file']}")
        else:
            click.echo("操作已取消")
    else:
        click.echo("所有待删除文件已确认或没有需要确认的文件")


@cli.command()
@click.option('--config', default='backup_config.json', help='配置文件路径')
@click.option('--force', is_flag=True, help='强制执行（不询问）')
@click.option('--output', '-o', default=None, help='输出报告文件路径')
def execute(config, force, output):
    """执行清理（确认后执行删除）"""
    try:
        cfg = load_config(config)
    except click.ClickException as e:
        click.echo(str(e))
        return
    
    confirmed_files = load_confirmations(cfg['confirmations_file'])
    
    files, scan_issues = scan_backup_dir(cfg['backup_dir'], cfg['date_pattern'])
    duplicates = find_duplicates(files)
    
    keep, remove, expired, rule_issues = apply_retention_policy(
        files, cfg['daily_keep'], cfg['weekly_keep'], cfg['monthly_keep'],
        cfg['retention_days'], cfg['exceptions']
    )
    
    all_issues = scan_issues + rule_issues
    
    to_delete = [f for f in remove if f['filepath'] in confirmed_files]
    not_confirmed = [f for f in remove if f['filepath'] not in confirmed_files]
    
    click.echo("=" * 70)
    click.echo("          执 行 清 理")
    click.echo("=" * 70)
    click.echo(f"待删除文件总数: {len(remove)}")
    click.echo(f"已确认删除: {len(to_delete)}")
    click.echo(f"未确认删除: {len(not_confirmed)}")
    click.echo("=" * 70)
    
    if not_confirmed:
        click.echo("\n【未确认的文件（将跳过）】")
        for f in not_confirmed:
            click.echo(f"  - {f['filename']}")
    
    if not to_delete:
        click.echo("\n没有已确认的文件需要删除")
        click.echo("请先运行 'backup_retention.py confirm' 确认删除计划")
        return
    
    if not force:
        if not click.confirm(f"\n确认要删除 {len(to_delete)} 个文件吗？此操作不可撤销！"):
            click.echo("操作已取消")
            return
    
    deleted, errors, _ = delete_files(to_delete, confirmed_files, simulate=False)
    
    remaining_confirmed = set()
    for f in remove:
        if f['filepath'] in confirmed_files and f not in deleted:
            remaining_confirmed.add(f['filepath'])
    save_confirmations(cfg['confirmations_file'], remaining_confirmed)
    
    click.echo("\n【执行结果】")
    click.echo(f"  成功删除: {len(deleted)} 个文件")
    click.echo(f"  错误: {len(errors)} 个文件")
    
    if errors:
        for e in errors:
            click.echo(f"    ✗ {e['filepath']}: {e['error']}")
    
    report = generate_report(cfg, files, keep, remove, expired, duplicates,
                            all_issues, remaining_confirmed, simulate=False)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report)
        click.echo(f"\n报告已导出到: {output}")
    else:
        click.echo("\n" + report)


@cli.command()
@click.option('--config', default='backup_config.json', help='配置文件路径')
@click.option('--output', '-o', default='backup_report.txt', help='输出报告文件路径')
@click.option('--simulate/--no-simulate', default=True, help='模拟模式/实际模式')
def report(config, output, simulate):
    """导出完整报告"""
    try:
        cfg = load_config(config)
    except click.ClickException as e:
        click.echo(str(e))
        return
    
    files, scan_issues = scan_backup_dir(cfg['backup_dir'], cfg['date_pattern'])
    duplicates = find_duplicates(files)
    confirmed_files = load_confirmations(cfg['confirmations_file'])
    
    keep, remove, expired, rule_issues = apply_retention_policy(
        files, cfg['daily_keep'], cfg['weekly_keep'], cfg['monthly_keep'],
        cfg['retention_days'], cfg['exceptions']
    )
    
    all_issues = scan_issues + rule_issues
    
    report_content = generate_report(cfg, files, keep, remove, expired, duplicates,
                                     all_issues, confirmed_files, simulate)
    
    with open(output, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    click.echo(f"报告已导出到: {output}")
    click.echo(f"模式: {'模拟' if simulate else '实际'}")


if __name__ == '__main__':
    cli()
