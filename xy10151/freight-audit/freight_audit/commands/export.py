import os
import csv
import click
from datetime import datetime
from typing import Dict, List, Any

from freight_audit.context import pass_ctx
from freight_audit.database import get_connection_dict


@click.command('export')
@click.argument('output_file', type=click.Path())
@click.option('--run-id', '-r', type=int, default=None, help='指定巡检 ID，不传则导出最新一次')
@click.option('--format', '-f', type=click.Choice(['csv', 'markdown']), default='csv', help='导出格式')
@click.option('--include-changes', '-c', is_flag=True, help='同时导出变更记录')
@pass_ctx
def export(ctx, output_file, run_id, format, include_changes):
    """导出巡检报告（CSV 或 Markdown 格式"""
    project_dir = ctx.project_dir
    
    output_path = os.path.abspath(output_file)
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    conn = get_connection_dict(project_dir)
    cursor = conn.cursor()
    
    if run_id:
        cursor.execute('SELECT * FROM audit_runs WHERE id = ?', (run_id,))
    else:
        cursor.execute('SELECT * FROM audit_runs ORDER BY id DESC LIMIT 1')
    
    audit_run = cursor.fetchone()
    
    if not audit_run:
        click.echo('[警告] 没有找到巡检记录')
        click.echo('         请先运行: freight-audit audit')
        conn.close()
        return
    
    cursor.execute(
        '''SELECT f.*, ar.run_time 
           FROM audit_findings f 
           LEFT JOIN audit_runs ar ON f.audit_run_id = ar.id 
           WHERE f.audit_run_id = ? 
           ORDER BY 
             CASE f.severity 
               WHEN 'high' THEN 1 
               WHEN 'medium' THEN 2 
               ELSE 3 
             END,
             f.id''',
        (audit_run['id'],)
    )
    findings = cursor.fetchall()
    
    if format == 'csv':
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ID', '巡检ID', '异常类型', '严重程度',
                '物流单号', '旧版本', '新版本',
                '变更字段', '旧值', '新值',
                '费用差异', '描述', '发现时间', '巡检时间',
            ])
            
            for fdata in findings:
                writer.writerow([
                    fdata['id'],
                    fdata['audit_run_id'],
                    fdata['finding_type'],
                    fdata['severity'],
                    fdata['shipment_no'],
                    fdata['old_version'] or '',
                    fdata['new_version'] or '',
                    fdata['field_changed'] or '',
                    fdata['old_value'] or '',
                    fdata['new_value'] or '',
                    fdata['fee_difference'] if fdata['fee_difference'] is not None else '',
                    fdata['description'] or '',
                    fdata['created_at'] or '',
                    fdata['run_time'] or '',
                ])
        
        click.echo(f'[成功] 导出成功: {output_path}')
        click.echo(f'       共 {len(findings)} 条异常记录')
        
        if include_changes:
            cursor.execute(
                'SELECT * FROM shipment_changelog ORDER BY id'
            )
            changes = cursor.fetchall()
            
            changes_path = os.path.splitext(output_path)[0] + '_changes.csv'
            
            with open(changes_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'ID', '物流单号', '版本', '变更类型',
                    '字段', '旧值', '新值',
                    '变更时间', '导入批次',
                ])
                
                for c in changes:
                    writer.writerow([
                        c['id'],
                        c['shipment_no'],
                        c['version'],
                        c['change_type'],
                        c['field_changed'],
                        c['old_value'],
                        c['new_value'],
                        c['change_time'],
                        c['import_batch'],
                    ])
            
            click.echo(f'[成功] 变更记录: {changes_path}')
            click.echo(f'       共 {len(changes)} 条变更记录')
        
        cursor.execute('SELECT COUNT(*) as cnt FROM bad_records')
        bad_count = cursor.fetchone()['cnt']
        
        if bad_count > 0:
            cursor.execute('SELECT * FROM bad_records ORDER BY id')
            bad_records = cursor.fetchall()
            
            bad_path = os.path.splitext(output_path)[0] + '_bad.csv'
            
            with open(bad_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'ID', '源文件', '行号', '原始数据',
                    '错误类型', '错误信息',
                    '导入批次', '导入时间',
                ])
                
                for br in bad_records:
                    writer.writerow([
                        br['id'],
                        br['source_file'],
                        br['line_number'],
                        br['raw_data'],
                        br['error_type'],
                        br['error_message'],
                        br['import_batch'],
                        br['import_time'],
                    ])
            
            click.echo(f'[成功] 坏数据记录: {bad_path}')
            click.echo(f'       共 {bad_count} 条坏数据')
    
    elif format == 'markdown':
        from freight_audit.commands.report import generate_markdown_report
        
        summary = {
            'high': 0,
            'medium': 0,
            'low': 0,
            'by_type': {},
            'total_fee_diff': 0.0,
        }
        
        for f in findings:
            sev = f.get('severity', 'low')
            if sev in summary:
                summary[sev] += 1
            
            ftype = f.get('finding_type', 'unknown')
            summary['by_type'][ftype] = summary['by_type'].get(ftype, 0) + 1
            
            if f.get('fee_difference') is not None:
                summary['total_fee_diff'] += f['fee_difference']
        
        md = generate_markdown_report(dict(audit_run), findings, summary)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md)
        
        click.echo(f'[成功] 导出成功: {output_path}')
        click.echo(f'       共 {len(findings)} 条异常记录')
    
    conn.close()
    
    click.echo('')
    click.echo('=' * 60)
    click.echo('导出完成！')
