from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import and_, or_, func
from models import (
    db, Tank, WaterQualityRecord, FeedingRecord, 
    WaterChangeRecord, FishRecord, Observation, Risk,
    RISK_TYPES, RISK_LEVELS
)
from config import Config

def get_param_name_cn(param: str) -> str:
    names = {
        'temp': '水温',
        'salinity': '盐度',
        'ph': 'pH值',
        'ammonia': '氨氮'
    }
    return names.get(param, param)

def check_water_quality_out_of_range(tank_id: int, check_date: date = None) -> List[Dict[str, Any]]:
    risks = []
    check_date = check_date or date.today()
    
    latest_record = WaterQualityRecord.query.filter(
        WaterQualityRecord.tank_id == tank_id,
        WaterQualityRecord.record_date <= check_date
    ).order_by(WaterQualityRecord.record_date.desc()).first()
    
    if not latest_record:
        return risks
    
    thresholds = Config.WATER_QUALITY_THRESHOLDS
    
    for param, limits in thresholds.items():
        value = getattr(latest_record, param, None)
        if value is None:
            continue
        
        is_out_of_range = False
        description = ''
        
        if value < limits['min']:
            is_out_of_range = True
            description = f'{get_param_name_cn(param)} {value} 低于下限 {limits["min"]}'
        elif value > limits['max']:
            is_out_of_range = True
            description = f'{get_param_name_cn(param)} {value} 高于上限 {limits["max"]}'
        
        if is_out_of_range:
            risk_level = 'warning'
            if param == 'ammonia' and value > 0.5:
                risk_level = 'critical'
            elif param == 'ph' and (value < 7.5 or value > 8.8):
                risk_level = 'critical'
            elif param == 'temp' and (value < 22 or value > 30):
                risk_level = 'critical'
            
            risks.append({
                'tank_id': tank_id,
                'risk_type': 'WATER_QUALITY_OUT_OF_RANGE',
                'risk_level': risk_level,
                'description': description,
                'detected_date': check_date,
                'source_record_id': latest_record.id,
                'source_record_type': 'WaterQualityRecord',
                'details': {
                    'param': param,
                    'value': value,
                    'min': limits['min'],
                    'max': limits['max'],
                    'record_date': latest_record.record_date.isoformat()
                }
            })
    
    return risks

def check_water_quality_drift(tank_id: int, check_date: date = None) -> List[Dict[str, Any]]:
    risks = []
    check_date = check_date or date.today()
    
    recent_records = WaterQualityRecord.query.filter(
        WaterQualityRecord.tank_id == tank_id,
        WaterQualityRecord.record_date <= check_date
    ).order_by(WaterQualityRecord.record_date.desc()).limit(3).all()
    
    if len(recent_records) < 2:
        return risks
    
    recent_records = sorted(recent_records, key=lambda r: r.record_date)
    thresholds = Config.WATER_QUALITY_THRESHOLDS
    
    for param, limits in thresholds.items():
        values = []
        for rec in recent_records:
            val = getattr(rec, param, None)
            if val is not None:
                values.append(val)
        
        if len(values) < 2:
            continue
        
        first_val = values[0]
        last_val = values[-1]
        drift = abs(last_val - first_val)
        
        if drift >= limits['drift']:
            direction = '上升' if last_val > first_val else '下降'
            description = f'{get_param_name_cn(param)} {direction} {drift:.2f}，超出漂移阈值 {limits["drift"]}（{first_val} → {last_val}）'
            
            risks.append({
                'tank_id': tank_id,
                'risk_type': 'WATER_QUALITY_DRIFT',
                'risk_level': 'warning',
                'description': description,
                'detected_date': check_date,
                'source_record_id': recent_records[-1].id,
                'source_record_type': 'WaterQualityRecord',
                'details': {
                    'param': param,
                    'drift': drift,
                    'threshold': limits['drift'],
                    'first_value': first_val,
                    'last_value': last_val,
                    'first_date': recent_records[0].record_date.isoformat(),
                    'last_date': recent_records[-1].record_date.isoformat()
                }
            })
    
    return risks

def check_feeding_missing(tank_id: int, check_date: date = None) -> List[Dict[str, Any]]:
    risks = []
    check_date = check_date or date.today()
    
    feeding_record = FeedingRecord.query.filter(
        FeedingRecord.tank_id == tank_id,
        FeedingRecord.record_date == check_date
    ).first()
    
    if not feeding_record:
        tank = Tank.query.get(tank_id)
        tank_code = tank.tank_code if tank else 'Unknown'
        
        risks.append({
            'tank_id': tank_id,
            'risk_type': 'FEEDING_MISSING',
            'risk_level': 'warning',
            'description': f'展缸 {check_date} 的投喂记录缺失',
            'detected_date': check_date,
            'source_record_id': None,
            'source_record_type': None,
            'details': {
                'check_date': check_date.isoformat(),
                'tank_code': tank_code
            }
        })
    
    return risks

def check_water_change_overdue(tank_id: int, check_date: date = None) -> List[Dict[str, Any]]:
    risks = []
    check_date = check_date or date.today()
    
    latest_change = WaterChangeRecord.query.filter(
        WaterChangeRecord.tank_id == tank_id
    ).order_by(WaterChangeRecord.change_date.desc()).first()
    
    if not latest_change:
        tank = Tank.query.get(tank_id)
        tank_code = tank.tank_code if tank else 'Unknown'
        
        risks.append({
            'tank_id': tank_id,
            'risk_type': 'WATER_CHANGE_OVERDUE',
            'risk_level': 'warning',
            'description': '无换水记录，请确认是否已完成首次换水',
            'detected_date': check_date,
            'source_record_id': None,
            'source_record_type': None,
            'details': {
                'last_change_date': None,
                'overdue_days': None
            }
        })
        return risks
    
    expected_next_date = None
    if latest_change.next_scheduled_date:
        expected_next_date = latest_change.next_scheduled_date
    else:
        expected_next_date = latest_change.change_date + timedelta(days=Config.WATER_CHANGE_INTERVAL_DAYS)
    
    if check_date > expected_next_date:
        overdue_days = (check_date - expected_next_date).days
        
        risk_level = 'warning'
        if overdue_days > 3:
            risk_level = 'critical'
        
        description = f'换水超期 {overdue_days} 天，上次换水 {latest_change.change_date}，计划换水 {expected_next_date}'
        
        risks.append({
            'tank_id': tank_id,
            'risk_type': 'WATER_CHANGE_OVERDUE',
            'risk_level': risk_level,
            'description': description,
            'detected_date': check_date,
            'source_record_id': latest_change.id,
            'source_record_type': 'WaterChangeRecord',
            'details': {
                'last_change_date': latest_change.change_date.isoformat(),
                'expected_next_date': expected_next_date.isoformat(),
                'overdue_days': overdue_days
            }
        })
    
    return risks

def check_quarantine_incomplete(tank_id: int, check_date: date = None) -> List[Dict[str, Any]]:
    risks = []
    check_date = check_date or date.today()
    
    quarantined_fish = FishRecord.query.filter(
        FishRecord.tank_id == tank_id,
        FishRecord.is_quarantined == True
    ).all()
    
    for fish in quarantined_fish:
        if fish.quarantine_end_date:
            if check_date > fish.quarantine_end_date:
                continue
            
            days_remaining = (fish.quarantine_end_date - check_date).days
            
            risks.append({
                'tank_id': tank_id,
                'risk_type': 'QUARANTINE_INCOMPLETE',
                'risk_level': 'info',
                'description': f'{fish.fish_species}（{fish.fish_name or "未命名"}）隔离期剩余 {days_remaining} 天，隔离结束日期 {fish.quarantine_end_date}',
                'detected_date': check_date,
                'source_record_id': fish.id,
                'source_record_type': 'FishRecord',
                'details': {
                    'fish_species': fish.fish_species,
                    'fish_name': fish.fish_name,
                    'introduction_date': fish.introduction_date.isoformat() if fish.introduction_date else None,
                    'quarantine_end_date': fish.quarantine_end_date.isoformat() if fish.quarantine_end_date else None,
                    'days_remaining': days_remaining
                }
            })
    
    return risks

def check_abnormal_observations(tank_id: int, check_date: date = None) -> List[Dict[str, Any]]:
    risks = []
    check_date = check_date or date.today()
    
    observations = Observation.query.filter(
        Observation.tank_id == tank_id,
        Observation.observation_date == check_date,
        or_(
            Observation.severity == 'warning',
            Observation.severity == 'critical',
            Observation.observation_type == '异常'
        )
    ).all()
    
    for obs in observations:
        risk_level = obs.severity if obs.severity in ['critical', 'warning', 'info'] else 'warning'
        
        risks.append({
            'tank_id': tank_id,
            'risk_type': 'OBSERVATION_ABNORMAL',
            'risk_level': risk_level,
            'description': f'{obs.observation_type or "异常观察"}：{obs.description}',
            'detected_date': check_date,
            'source_record_id': obs.id,
            'source_record_type': 'Observation',
            'details': {
                'observation_type': obs.observation_type,
                'description': obs.description,
                'severity': obs.severity,
                'observer_name': obs.observer_name,
                'observation_date': obs.observation_date.isoformat()
            }
        })
    
    return risks

def detect_all_risks(check_date: date = None, tank_ids: List[int] = None) -> Dict[str, Any]:
    check_date = check_date or date.today()
    results = {
        'check_date': check_date.isoformat(),
        'total_tanks': 0,
        'total_risks': 0,
        'risks_by_type': {},
        'risks_by_level': {'critical': 0, 'warning': 0, 'info': 0},
        'risks': []
    }
    
    if tank_ids:
        tanks = Tank.query.filter(Tank.id.in_(tank_ids)).all()
    else:
        tanks = Tank.query.all()
    
    results['total_tanks'] = len(tanks)
    
    all_risks = []
    
    for tank in tanks:
        tank_risks = []
        
        tank_risks.extend(check_water_quality_out_of_range(tank.id, check_date))
        tank_risks.extend(check_water_quality_drift(tank.id, check_date))
        tank_risks.extend(check_feeding_missing(tank.id, check_date))
        tank_risks.extend(check_water_change_overdue(tank.id, check_date))
        tank_risks.extend(check_quarantine_incomplete(tank.id, check_date))
        tank_risks.extend(check_abnormal_observations(tank.id, check_date))
        
        all_risks.extend(tank_risks)
    
    for risk_data in all_risks:
        existing = Risk.query.filter(
            Risk.tank_id == risk_data['tank_id'],
            Risk.risk_type == risk_data['risk_type'],
            Risk.detected_date == risk_data['detected_date'],
            Risk.review_status == 'pending'
        ).first()
        
        if existing:
            existing.description = risk_data['description']
            existing.risk_level = risk_data['risk_level']
            existing.updated_at = datetime.utcnow()
        else:
            risk = Risk(
                tank_id=risk_data['tank_id'],
                risk_type=risk_data['risk_type'],
                risk_level=risk_data['risk_level'],
                description=risk_data['description'],
                detected_date=risk_data['detected_date'],
                source_record_id=risk_data.get('source_record_id'),
                source_record_type=risk_data.get('source_record_type')
            )
            db.session.add(risk)
        
        results['total_risks'] += 1
        
        risk_type = risk_data['risk_type']
        results['risks_by_type'][risk_type] = results['risks_by_type'].get(risk_type, 0) + 1
        
        risk_level = risk_data['risk_level']
        results['risks_by_level'][risk_level] = results['risks_by_level'].get(risk_level, 0) + 1
    
    db.session.commit()
    
    final_risks = Risk.query.filter(
        Risk.detected_date == check_date
    ).order_by(Risk.risk_level.desc(), Risk.created_at.desc()).all()
    
    results['risks'] = [r.to_dict() for r in final_risks]
    
    return results

def get_recent_risks(days: int = 7, include_resolved: bool = False) -> List[Dict[str, Any]]:
    cutoff_date = date.today() - timedelta(days=days)
    
    query = Risk.query.filter(Risk.detected_date >= cutoff_date)
    
    if not include_resolved:
        query = query.filter(Risk.resolution_status != 'resolved')
    
    risks = query.order_by(
        Risk.risk_level.desc(),
        Risk.detected_date.desc(),
        Risk.created_at.desc()
    ).all()
    
    return [r.to_dict() for r in risks]

def update_risk_review(risk_id: int, review_status: str, review_comment: str = None, 
                       reviewed_by: str = None) -> Optional[Dict[str, Any]]:
    risk = Risk.query.get(risk_id)
    if not risk:
        return None
    
    risk.review_status = review_status
    if review_comment:
        risk.review_comment = review_comment
    if reviewed_by:
        risk.reviewed_by = reviewed_by
    risk.reviewed_at = datetime.utcnow()
    
    if review_status in ['confirmed', 'dismissed', 'resolved']:
        risk.resolution_status = 'resolved' if review_status == 'resolved' else review_status
        if review_status == 'resolved':
            risk.resolved_at = datetime.utcnow()
    
    db.session.commit()
    
    return risk.to_dict()
