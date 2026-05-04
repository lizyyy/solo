import csv
import json
import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from models import (
    db, Tank, WaterQualityRecord, FeedingRecord, 
    WaterChangeRecord, FishRecord, Observation, Risk,
    RISK_TYPES, RISK_LEVELS, REVIEW_STATUSES
)
from config import Config, EXPORT_DIR

def ensure_export_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    return EXPORT_DIR

def generate_filename(prefix: str, ext: str) -> str:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f'{prefix}_{timestamp}.{ext}'

def export_markdown_handover(export_date: date = None, reviewer_name: str = None) -> Dict[str, Any]:
    export_date = export_date or date.today()
    ensure_export_dir()
    
    risks = Risk.query.filter(
        Risk.detected_date == export_date
    ).order_by(Risk.risk_level.desc(), Risk.created_at.desc()).all()
    
    tanks = Tank.query.order_by(Tank.tank_code).all()
    
    recent_feedings = FeedingRecord.query.filter(
        FeedingRecord.record_date == export_date
    ).all()
    feeding_by_tank = {}
    for f in recent_feedings:
        feeding_by_tank[f.tank_id] = f
    
    water_changes = WaterChangeRecord.query.filter(
        WaterChangeRecord.change_date <= export_date
    ).order_by(WaterChangeRecord.change_date.desc()).all()
    latest_water_change = {}
    for wc in water_changes:
        if wc.tank_id not in latest_water_change:
            latest_water_change[wc.tank_id] = wc
    
    observations = Observation.query.filter(
        Observation.observation_date == export_date
    ).all()
    obs_by_tank = {}
    for obs in observations:
        if obs.tank_id not in obs_by_tank:
            obs_by_tank[obs.tank_id] = []
        obs_by_tank[obs.tank_id].append(obs)
    
    critical_count = sum(1 for r in risks if r.risk_level == 'critical')
    warning_count = sum(1 for r in risks if r.risk_level == 'warning')
    info_count = sum(1 for r in risks if r.risk_level == 'info')
    
    md_lines = []
    md_lines.append(f'# 水族馆巡检值班交接单')
    md_lines.append('')
    md_lines.append(f'**日期**: {export_date.strftime("%Y年%m月%d日")}')
    md_lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    if reviewer_name:
        md_lines.append(f'**值班人员**: {reviewer_name}')
    md_lines.append('')
    
    md_lines.append('## 一、风险概览')
    md_lines.append('')
    md_lines.append('| 风险等级 | 数量 |')
    md_lines.append('|---------|------|')
    md_lines.append(f'| 🔴 严重 | {critical_count} |')
    md_lines.append(f'| 🟡 警告 | {warning_count} |')
    md_lines.append(f'| 🔵 提示 | {info_count} |')
    md_lines.append(f'| **合计** | **{len(risks)}** |')
    md_lines.append('')
    
    if risks:
        md_lines.append('## 二、风险详情')
        md_lines.append('')
        
        for risk in risks:
            tank = Tank.query.get(risk.tank_id)
            tank_info = f'{tank.tank_code} ({tank.tank_name or "未命名"})' if tank else '未知展缸'
            
            risk_icon = '🔴' if risk.risk_level == 'critical' else '🟡' if risk.risk_level == 'warning' else '🔵'
            risk_type_name = RISK_TYPES.get(risk.risk_type, risk.risk_type)
            risk_level_name = RISK_LEVELS.get(risk.risk_level, risk.risk_level)
            review_status_name = REVIEW_STATUSES.get(risk.review_status, risk.review_status)
            
            md_lines.append(f'### {risk_icon} [{risk_level_name}] {tank_info}')
            md_lines.append('')
            md_lines.append(f'- **风险类型**: {risk_type_name}')
            md_lines.append(f'- **检测时间**: {risk.detected_date}')
            md_lines.append(f'- **描述**: {risk.description}')
            md_lines.append(f'- **复核状态**: {review_status_name}')
            
            if risk.review_comment:
                md_lines.append(f'- **复核备注**: {risk.review_comment}')
            if risk.reviewed_by:
                md_lines.append(f'- **复核人**: {risk.reviewed_by}')
            
            md_lines.append('')
    
    md_lines.append('## 三、展缸巡检概览')
    md_lines.append('')
    md_lines.append('| 展缸编号 | 展缸名称 | 今日投喂 | 上次换水 | 换水状态 | 异常观察 |')
    md_lines.append('|---------|---------|---------|---------|---------|---------|')
    
    for tank in tanks:
        tank_name = tank.tank_name or '-'
        has_feeding = '✅ 已记录' if tank.id in feeding_by_tank else '❌ 无记录'
        
        last_wc = latest_water_change.get(tank.id)
        if last_wc:
            wc_date = last_wc.change_date.strftime('%m-%d')
            expected_next = last_wc.next_scheduled_date or (last_wc.change_date + timedelta(days=Config.WATER_CHANGE_INTERVAL_DAYS))
            if export_date > expected_next:
                overdue = (export_date - expected_next).days
                wc_status = f'⚠️ 超期{overdue}天'
            else:
                remaining = (expected_next - export_date).days
                wc_status = f'剩余{remaining}天'
        else:
            wc_date = '-'
            wc_status = '❓ 无记录'
        
        tank_obs = obs_by_tank.get(tank.id, [])
        obs_count = len(tank_obs)
        obs_status = f'⚠️ {obs_count}条' if obs_count > 0 else '-'
        
        md_lines.append(f'| {tank.tank_code} | {tank_name} | {has_feeding} | {wc_date} | {wc_status} | {obs_status} |')
    
    md_lines.append('')
    
    md_lines.append('## 四、值班备注')
    md_lines.append('')
    md_lines.append('> 请在此处填写值班期间的特殊事项、处理情况等...')
    md_lines.append('')
    md_lines.append('---')
    md_lines.append('')
    md_lines.append(f'*本交接单由水族馆巡检系统自动生成于 {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
    
    markdown_content = '\n'.join(md_lines)
    
    filename = generate_filename('handover', 'md')
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    return {
        'success': True,
        'filename': filename,
        'filepath': filepath,
        'content_preview': markdown_content[:500] if len(markdown_content) > 500 else markdown_content,
        'stats': {
            'total_tanks': len(tanks),
            'total_risks': len(risks),
            'critical_risks': critical_count,
            'warning_risks': warning_count,
            'info_risks': info_count
        }
    }

def export_csv_risk_list(days: int = 7, include_resolved: bool = False) -> Dict[str, Any]:
    ensure_export_dir()
    
    cutoff_date = date.today() - timedelta(days=days)
    
    query = Risk.query.filter(Risk.detected_date >= cutoff_date)
    
    if not include_resolved:
        query = query.filter(Risk.resolution_status != 'resolved')
    
    risks = query.order_by(
        Risk.risk_level.desc(),
        Risk.detected_date.desc(),
        Risk.created_at.desc()
    ).all()
    
    filename = generate_filename('risks', 'csv')
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow([
            'ID', '展缸编号', '展缸名称', '风险类型', '风险等级',
            '描述', '检测日期', '复核状态', '复核人', '复核备注',
            '处理状态', '处理备注', '创建时间', '更新时间'
        ])
        
        for risk in risks:
            tank = Tank.query.get(risk.tank_id)
            writer.writerow([
                risk.id,
                tank.tank_code if tank else '',
                tank.tank_name if tank else '',
                RISK_TYPES.get(risk.risk_type, risk.risk_type),
                RISK_LEVELS.get(risk.risk_level, risk.risk_level),
                risk.description,
                risk.detected_date,
                REVIEW_STATUSES.get(risk.review_status, risk.review_status),
                risk.reviewed_by or '',
                risk.review_comment or '',
                risk.resolution_status or '',
                risk.resolution_comment or '',
                risk.created_at.strftime('%Y-%m-%d %H:%M:%S') if risk.created_at else '',
                risk.updated_at.strftime('%Y-%m-%d %H:%M:%S') if risk.updated_at else ''
            ])
    
    return {
        'success': True,
        'filename': filename,
        'filepath': filepath,
        'total_risks': len(risks),
        'date_range': f'{cutoff_date} 至 {date.today()}'
    }

def export_json_audit_package(export_date: date = None) -> Dict[str, Any]:
    export_date = export_date or date.today()
    ensure_export_dir()
    
    audit_data = {
        'audit_info': {
            'export_date': export_date.isoformat(),
            'export_time': datetime.now().isoformat(),
            'version': '1.0.0'
        },
        'tanks': [],
        'water_quality_records': [],
        'feeding_records': [],
        'water_change_records': [],
        'fish_records': [],
        'observations': [],
        'risks': [],
        'risk_reviews': []
    }
    
    tanks = Tank.query.all()
    for tank in tanks:
        audit_data['tanks'].append(tank.to_dict())
        
        wq_records = WaterQualityRecord.query.filter(
            WaterQualityRecord.tank_id == tank.id,
            WaterQualityRecord.record_date == export_date
        ).all()
        for rec in wq_records:
            audit_data['water_quality_records'].append(rec.to_dict())
        
        feeding_records = FeedingRecord.query.filter(
            FeedingRecord.tank_id == tank.id,
            FeedingRecord.record_date == export_date
        ).all()
        for rec in feeding_records:
            audit_data['feeding_records'].append(rec.to_dict())
        
        wc_records = WaterChangeRecord.query.filter(
            WaterChangeRecord.tank_id == tank.id
        ).order_by(WaterChangeRecord.change_date.desc()).limit(5).all()
        for rec in wc_records:
            audit_data['water_change_records'].append(rec.to_dict())
        
        fish_records = FishRecord.query.filter(
            FishRecord.tank_id == tank.id
        ).all()
        for rec in fish_records:
            audit_data['fish_records'].append(rec.to_dict())
        
        obs_records = Observation.query.filter(
            Observation.tank_id == tank.id,
            Observation.observation_date == export_date
        ).all()
        for rec in obs_records:
            audit_data['observations'].append(rec.to_dict())
    
    risks = Risk.query.filter(
        Risk.detected_date == export_date
    ).all()
    for risk in risks:
        risk_dict = risk.to_dict()
        audit_data['risks'].append(risk_dict)
        
        if risk.review_status != 'pending':
            audit_data['risk_reviews'].append({
                'risk_id': risk.id,
                'review_status': risk.review_status,
                'review_comment': risk.review_comment,
                'reviewed_by': risk.reviewed_by,
                'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
                'resolution_status': risk.resolution_status,
                'resolution_comment': risk.resolution_comment,
                'resolved_at': risk.resolved_at.isoformat() if risk.resolved_at else None
            })
    
    filename = generate_filename('audit', 'json')
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)
    
    return {
        'success': True,
        'filename': filename,
        'filepath': filepath,
        'stats': {
            'tanks': len(audit_data['tanks']),
            'water_quality_records': len(audit_data['water_quality_records']),
            'feeding_records': len(audit_data['feeding_records']),
            'water_change_records': len(audit_data['water_change_records']),
            'fish_records': len(audit_data['fish_records']),
            'observations': len(audit_data['observations']),
            'risks': len(audit_data['risks']),
            'risk_reviews': len(audit_data['risk_reviews'])
        }
    }

def list_exports() -> List[Dict[str, Any]]:
    ensure_export_dir()
    
    exports = []
    for filename in os.listdir(EXPORT_DIR):
        filepath = os.path.join(EXPORT_DIR, filename)
        if os.path.isfile(filepath):
            stat = os.stat(filepath)
            exports.append({
                'filename': filename,
                'filepath': filepath,
                'size_bytes': stat.st_size,
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'file_type': filename.split('.')[-1].lower() if '.' in filename else 'unknown'
            })
    
    exports.sort(key=lambda x: x['modified_at'], reverse=True)
    return exports
