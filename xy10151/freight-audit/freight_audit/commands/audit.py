import os
import click
from datetime import datetime
from typing import Dict, List, Any, Optional

from freight_audit.context import pass_ctx
from freight_audit.database import get_connection_dict, now_timestamp
from freight_audit.config import compute_config_hash


def get_severity(fee_diff: float, thresholds: Dict) -> str:
    abs_diff = abs(fee_diff)
    if abs_diff >= thresholds.get('high', 50.0):
        return 'high'
    if abs_diff >= thresholds.get('medium', 20.0):
        return 'medium'
    return 'low'


def detect_version_changes(versions: List[Dict], audit_config: Dict) -> List[Dict]:
    findings = []
    thresholds = audit_config.get('severity_thresholds', {'high': 50, 'medium': 20, 'low': 0})
    
    versions_sorted = sorted(versions, key=lambda x: x['version'])
    
    for i in range(1, len(versions_sorted)):
        old = versions_sorted[i - 1]
        new = versions_sorted[i]
        
        old_fee = old.get('freight_fee') or 0
        new_fee = new.get('freight_fee') or 0
        fee_diff = new_fee - old_fee
        
        if old_fee != new_fee:
            severity = get_severity(fee_diff, thresholds)
            findings.append({
                'finding_type': 'fee_change',
                'severity': severity,
                'shipment_no': old['shipment_no'],
                'old_version': old['version'],
                'new_version': new['version'],
                'field_changed': 'freight_fee',
                'old_value': old_fee,
                'new_value': new_fee,
                'fee_difference': fee_diff,
                'description': f"运费变更: v{old['version']} ¥{old_fee} -> v{new['version']} ¥{new_fee} (差: ¥{fee_diff:+.2f})",
            })
        
        old_weight = old.get('weight')
        new_weight = new.get('weight')
        if old_weight != new_weight:
            findings.append({
                'finding_type': 'weight_change',
                'severity': 'medium',
                'shipment_no': old['shipment_no'],
                'old_version': old['version'],
                'new_version': new['version'],
                'field_changed': 'weight',
                'old_value': old_weight,
                'new_value': new_weight,
                'fee_difference': None,
                'description': f"重量变更: v{old['version']} {old_weight}kg -> v{new['version']} {new_weight}kg",
            })
        
        old_route = old.get('route')
        new_route = new.get('route')
        if old_route != new_route:
            findings.append({
                'finding_type': 'route_change',
                'severity': 'medium',
                'shipment_no': old['shipment_no'],
                'old_version': old['version'],
                'new_version': new['version'],
                'field_changed': 'route',
                'old_value': old_route,
                'new_value': new_route,
                'fee_difference': None,
                'description': f"路线变更: v{old['version']} {old_route} -> v{new['version']} {new_route}",
            })
    
    return findings


def detect_fee_deviation(shipment: Dict, audit_config: Dict) -> Optional[Dict]:
    actual_fee = shipment.get('freight_fee')
    standard_fee = shipment.get('standard_fee')
    
    if actual_fee is None or standard_fee is None:
        return None
    
    if standard_fee == 0:
        return None
    
    tolerance_pct = audit_config.get('fee_tolerance_percent', 5.0)
    tolerance_abs = audit_config.get('fee_tolerance_absolute', 10.0)
    
    diff = actual_fee - standard_fee
    diff_pct = abs(diff / standard_fee * 100)
    
    if abs(diff) <= tolerance_abs:
        return None
    if diff_pct <= tolerance_pct:
        return None
    
    thresholds = audit_config.get('severity_thresholds', {'high': 50, 'medium': 20, 'low': 0})
    severity = get_severity(diff, thresholds)
    
    return {
        'finding_type': 'fee_deviation',
        'severity': severity,
        'shipment_no': shipment['shipment_no'],
        'old_version': shipment['version'],
        'new_version': shipment['version'],
        'field_changed': 'freight_fee',
        'old_value': standard_fee,
        'new_value': actual_fee,
        'fee_difference': diff,
        'description': f"运费偏离标准: 标准 ¥{standard_fee}, 实际 ¥{actual_fee}, 差异 ¥{diff:+.2f} ({diff_pct:.1f}%)",
    }


def detect_multiple_versions(shipment_no: str, versions: List[Dict]) -> List[Dict]:
    findings = []
    
    if len(versions) <= 1:
        return findings
    
    version_nums = sorted([v['version'] for v in versions])
    
    findings.append({
        'finding_type': 'multiple_versions',
        'severity': 'low',
        'shipment_no': shipment_no,
        'old_version': version_nums[0],
        'new_version': version_nums[-1],
        'field_changed': 'version',
        'old_value': version_nums[0],
        'new_value': version_nums[-1],
        'fee_difference': None,
        'description': f"存在 {len(versions)} 个版本: v{', v'.join(map(str, version_nums))}",
    })
    
    return findings


@click.command()
@click.option('--shipment', '-s', default=None, help='指定物流单号进行巡检，不传则巡检全部')
@click.option('--notes', '-n', default=None, help='巡检备注')
@pass_ctx
def audit(ctx, shipment, notes):
    """执行运费异常巡检，检测多次修改后的差异"""
    project_dir = ctx.project_dir
    config = ctx.config
    audit_config = config.get('audit', {})
    
    config_hash = compute_config_hash(config)
    
    click.echo(f'开始巡检')
    click.echo(f'配置 Hash: {config_hash}')
    click.echo('=' * 60)
    
    conn = get_connection_dict(project_dir)
    cursor = conn.cursor()
    
    if shipment:
        cursor.execute(
            'SELECT * FROM shipments WHERE shipment_no = ? ORDER BY version',
            (shipment,)
        )
    else:
        cursor.execute('SELECT * FROM shipments ORDER BY shipment_no, version')
    
    all_shipments = cursor.fetchall()
    
    if not all_shipments:
        click.echo('[警告] 没有找到物流单数据')
        click.echo('         请先运行: freight-audit import-shipments <file.csv>')
        conn.close()
        return
    
    total_unique = len(set(s['shipment_no'] for s in all_shipments))
    click.echo(f'待巡检物流单: {total_unique} 个 ({len(all_shipments)} 条版本记录)')
    click.echo('-' * 60)
    
    shipments_by_no: Dict[str, List] = {}
    for s in all_shipments:
        no = s['shipment_no']
        if no not in shipments_by_no:
            shipments_by_no[no] = []
        shipments_by_no[no].append(s)
    
    all_findings = []
    
    for shipment_no, versions in shipments_by_no.items():
        all_findings.extend(detect_multiple_versions(shipment_no, versions))
        all_findings.extend(detect_version_changes(versions, audit_config))
        
        latest = max(versions, key=lambda x: x['version'])
        deviation = detect_fee_deviation(latest, audit_config)
        if deviation:
            all_findings.append(deviation)
    
    cursor.execute(
        '''INSERT INTO audit_runs 
           (run_time, config_hash, total_shipments, total_findings, status, notes)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (
            now_timestamp(),
            config_hash,
            total_unique,
            len(all_findings),
            'completed',
            notes,
        )
    )
    
    audit_run_id = cursor.lastrowid
    
    for finding in all_findings:
        cursor.execute(
            '''INSERT INTO audit_findings 
               (audit_run_id, finding_type, severity, shipment_no, 
                old_version, new_version, field_changed, old_value, 
                new_value, fee_difference, description, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                audit_run_id,
                finding['finding_type'],
                finding['severity'],
                finding['shipment_no'],
                finding.get('old_version'),
                finding.get('new_version'),
                finding.get('field_changed'),
                str(finding.get('old_value', '')),
                str(finding.get('new_value', '')),
                finding.get('fee_difference'),
                finding['description'],
                now_timestamp(),
            )
        )
    
    conn.commit()
    conn.close()
    
    by_type: Dict[str, int] = {}
    by_severity: Dict[str, int] = {'high': 0, 'medium': 0, 'low': 0}
    total_fee_diff = 0.0
    
    for f in all_findings:
        ftype = f['finding_type']
        by_type[ftype] = by_type.get(ftype, 0) + 1
        
        severity = f['severity']
        if severity in by_severity:
            by_severity[severity] += 1
        
        if f.get('fee_difference') is not None:
            total_fee_diff += f['fee_difference']
    
    click.echo(f'巡检结果 (ID: {audit_run_id}):')
    click.echo('')
    click.echo('  按类型统计:')
    for ftype, count in sorted(by_type.items()):
        click.echo(f'    {ftype}: {count} 条')
    click.echo('')
    click.echo('  按严重程度:')
    click.echo(f'    高 (high):   {by_severity["high"]}')
    click.echo(f'    中 (medium): {by_severity["medium"]}')
    click.echo(f'    低 (low):    {by_severity["low"]}')
    click.echo('')
    click.echo(f'  运费总差异: ¥{total_fee_diff:+.2f}')
    click.echo('=' * 60)
    
    if all_findings:
        click.echo('  异常详情:')
        for f in all_findings[:20]:
            sev_color = {'high': '[高]', 'medium': '[中]', 'low': '[低]'}.get(f['severity'], '[?]')
            click.echo(f'    {sev_color} {f["shipment_no"]}: {f["description"]}')
        
        if len(all_findings) > 20:
            click.echo(f'    ... 还有 {len(all_findings) - 20} 条')
        click.echo('-' * 60)
    
    click.echo(f'巡检完成，共发现 {len(all_findings)} 条异常')
    click.echo('')
    click.echo('下一步:')
    click.echo('  查看报告: freight-audit report')
    click.echo('  查看历史: freight-audit history')
    click.echo('  导出报告: freight-audit export <file.csv>')
