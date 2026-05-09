import os
import click
from datetime import datetime
from typing import Dict, List, Any

from freight_audit.context import pass_ctx
from freight_audit.database import get_connection_dict


@click.command()
@click.option('--limit', '-n', type=int, default=10, help='显示最近 N 次巡检')
@click.option('--full', '-f', is_flag=True, help='显示完整详情')
@pass_ctx
def history(ctx, limit, full):
    """查看巡检历史记录"""
    project_dir = ctx.project_dir
    
    conn = get_connection_dict(project_dir)
    cursor = conn.cursor()
    
    cursor.execute(
        'SELECT * FROM audit_runs ORDER BY id DESC LIMIT ?',
        (limit,)
    )
    runs = cursor.fetchall()
    
    if not runs:
        click.echo('[警告] 没有找到巡检记录')
        click.echo('         请先运行: freight-audit audit')
        conn.close()
        return
    
    click.echo(f'巡检历史 (最近 {len(runs)} 次)')
    click.echo('=' * 80)
    
    if full:
        for run in runs:
            cursor.execute(
                'SELECT COUNT(*) as cnt FROM audit_findings WHERE audit_run_id = ?',
                (run['id'],)
            )
            findings_count = cursor.fetchone()['cnt']
            
            cursor.execute(
                '''SELECT severity, COUNT(*) as cnt 
                   FROM audit_findings 
                   WHERE audit_run_id = ? 
                   GROUP BY severity''',
                (run['id'],)
            )
            severity_counts = {r['severity']: r['cnt'] for r in cursor.fetchall()}
            
            cursor.execute(
                'SELECT * FROM shipment_changelog ORDER BY id DESC LIMIT 5'
            )
            recent_changes = cursor.fetchall()
            
            cursor.execute(
                'SELECT COUNT(*) as cnt FROM bad_records'
            )
            bad_count = cursor.fetchone()['cnt']
            
            cursor.execute(
                'SELECT COUNT(*) as cnt FROM shipments'
            )
            shipments_count = cursor.fetchone()['cnt']
            
            click.echo('')
            click.echo(f'[巡检 #{run["id"]}] - {run["run_time"]}')
            click.echo(f'  配置 Hash: {run["config_hash"]}')
            click.echo(f'  物流单数: {run["total_shipments"]}')
            click.echo(f'  发现异常: {run["total_findings"]}')
            click.echo(f'  状态: {run["status"]}')
            if run.get('notes'):
                click.echo(f'  备注: {run["notes"]}')
            
            if severity_counts:
                click.echo('  严重程度:')
                for sev, cnt in severity_counts.items():
                    sev_label = {'high': '高', 'medium': '中', 'low': '低'}.get(sev, sev)
                    click.echo(f'    {sev_label}: {cnt}')
    
    else:
        click.echo('')
        click.echo('| ID | 时间 | 物流单 | 异常数 | 状态 | 配置 |')
        click.echo('|----|------|--------|--------|------|------|')
        
        for run in runs:
            config_hash_short = (run['config_hash'][:8] + '...') if run['config_hash'] else '-'
            status = run.get('status', '-')
            time_str = str(run['run_time'])
            click.echo(f'| {run["id"]} | {time_str[:19]} | {run["total_shipments"]} | {run["total_findings"]} | {status} | {config_hash_short} |')
    
    conn.close()
    
    click.echo('')
    click.echo('=' * 80)
    click.echo('')
    click.echo('下一步:')
    click.echo('  查看某次巡检报告: freight-audit report -r <ID>')
    click.echo('  导出最新报告: freight-audit export <file.csv>')
