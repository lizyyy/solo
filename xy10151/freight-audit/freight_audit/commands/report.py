import os
import click
from datetime import datetime
from typing import Dict, List, Any, Optional

from freight_audit.context import pass_ctx
from freight_audit.database import get_connection_dict
from freight_audit.config import get_output_dir


def generate_markdown_report(audit_run: Dict, findings: List[Dict], summary: Dict) -> str:
    lines = []
    
    lines.append('# 运费异常巡检报告')
    lines.append('')
    lines.append(f'**巡检 ID**: {audit_run["id"]}')
    lines.append(f'**巡检时间**: {audit_run["run_time"]}')
    lines.append(f'**配置 Hash**: {audit_run["config_hash"]}')
    
    if audit_run.get('notes'):
        lines.append(f'**备注**: {audit_run["notes"]}')
    
    lines.append('')
    lines.append('## 巡检概览')
    lines.append('')
    lines.append('| 指标 | 数值 |')
    lines.append('|------|------|')
    lines.append(f'| 巡检物流单总数 | {audit_run["total_shipments"]} |')
    lines.append(f'| 发现异常数 | {audit_run["total_findings"]} |')
    lines.append(f'| 高严重程度 | {summary.get("high", 0)} |')
    lines.append(f'| 中严重程度 | {summary.get("medium", 0)} |')
    lines.append(f'| 低严重程度 | {summary.get("low", 0)} |')
    lines.append(f'| 运费总差异 | ¥{summary.get("total_fee_diff", 0.0):+.2f} |')
    lines.append('')
    
    if summary.get('by_type'):
        lines.append('## 按类型统计')
        lines.append('')
        lines.append('| 异常类型 | 数量 |')
        lines.append('|----------|------|')
        for ftype, count in sorted(summary['by_type'].items()):
            lines.append(f'| {ftype} | {count} |')
        lines.append('')
    
    if findings:
        lines.append('## 异常详情')
        lines.append('')
        
        severity_order = ['high', 'medium', 'low']
        for sev in severity_order:
            sev_findings = [f for f in findings if f['severity'] == sev]
            if not sev_findings:
                continue
            
            sev_label = {'high': '高严重', 'medium': '中严重', 'low': '低严重'}.get(sev, sev)
            lines.append(f'### {sev_label} ({len(sev_findings)} 条)')
            lines.append('')
            lines.append('| # | 物流单号 | 异常类型 | 描述 |')
            lines.append('|---|---------|---------|------|')
            
            for idx, f in enumerate(sev_findings, 1):
                desc = (f.get('description') or '').replace('|', '')
                lines.append(f'| {idx} | {f["shipment_no"]} | {f["finding_type"]} | {desc} |')
            
            lines.append('')
        
        lines.append('### 详细变更记录')
        lines.append('')
        
        for f in findings:
            sev_label = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(f['severity'], '⚪')
            lines.append(f'{sev_label} **{f["shipment_no"]}** - {f["finding_type"]}')
            lines.append('')
            lines.append(f'- 描述: {f.get("description", "")}')
            lines.append(f'- 版本: v{f.get("old_version")} -> v{f.get("new_version")}')
            if f.get('field_changed'):
                lines.append(f'- 字段: {f["field_changed"]}')
                old_val = f.get('old_value', '')
                new_val = f.get('new_value', '')
                if old_val or new_val:
                    lines.append(f'- 变更: `{old_val}` -> `{new_val}`')
            if f.get('fee_difference') is not None:
                lines.append(f'- 费用差异: ¥{f["fee_difference"]:+.2f}')
            lines.append(f'- 发现时间: {f.get("created_at", "")}')
            lines.append('')
    
    lines.append('---')
    lines.append(f'*报告生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
    
    return '\n'.join(lines)


@click.command()
@click.option('--run-id', '-r', type=int, default=None, help='指定巡检 ID，不传则显示最新一次')
@click.option('--save', '-s', is_flag=True, help='保存报告到 reports 目录')
@pass_ctx
def report(ctx, run_id, save):
    """生成运费异常巡检报告（Markdown 格式）"""
    project_dir = ctx.project_dir
    config = ctx.config
    
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
        'SELECT * FROM audit_findings WHERE audit_run_id = ? ORDER BY severity, id',
        (audit_run['id'],)
    )
    findings = cursor.fetchall()
    
    conn.close()
    
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
    
    md_report = generate_markdown_report(dict(audit_run), findings, summary)
    
    if save:
        output_dir = get_output_dir(project_dir, config)
        os.makedirs(output_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'audit_report_{audit_run["id"]}_{timestamp}.md'
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md_report)
        
        click.echo(f'[成功] 报告已保存: {filepath}')
        click.echo('=' * 60)
    
    click.echo(md_report)
    click.echo('')
    click.echo('=' * 60)
    click.echo('下一步:')
    click.echo('  导出 CSV: freight-audit export <file.csv>')
    click.echo('  保存报告: freight-audit report --save')
