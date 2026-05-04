from datetime import datetime, date
from typing import List, Dict, Any
from app.models import Tank, FillRecord, DivePlan, DivePlanTank, RiskAssessment
from app import db
from config import Config

class RiskDetector:
    RISK_TYPES = {
        'INSPECTION_EXPIRED': 'inspection_expired',
        'OXYGEN_OVER_LIMIT': 'oxygen_over_limit',
        'DUPLICATE_ASSIGNMENT': 'duplicate_assignment',
        'BACKUP_INSUFFICIENT': 'backup_insufficient',
        'PRIMARY_INSUFFICIENT': 'primary_insufficient'
    }
    
    SEVERITY = {
        'CRITICAL': 'critical',
        'HIGH': 'high',
        'MEDIUM': 'medium',
        'LOW': 'low'
    }
    
    def __init__(self, config: Config = None):
        self.config = config or Config()
    
    def check_all_risks(self, dive_plan: DivePlan, dive_plan_tanks: List[DivePlanTank]) -> List[Dict[str, Any]]:
        risks = []
        
        for dpt in dive_plan_tanks:
            tank = Tank.query.get(dpt.tank_id)
            if not tank:
                continue
            
            inspection_risk = self.check_inspection_expiry(tank, dive_plan)
            if inspection_risk:
                inspection_risk['tank_id'] = tank.id
                risks.append(inspection_risk)
            
            oxygen_risk = self.check_oxygen_partial_pressure(tank, dive_plan)
            if oxygen_risk:
                oxygen_risk['tank_id'] = tank.id
                risks.append(oxygen_risk)
            
            pressure_risk = self.check_pressure_sufficiency(tank, dpt.role)
            if pressure_risk:
                pressure_risk['tank_id'] = tank.id
                risks.append(pressure_risk)
        
        duplicate_risks = self.check_duplicate_assignments(dive_plan_tanks)
        risks.extend(duplicate_risks)
        
        return risks
    
    def check_inspection_expiry(self, tank: Tank, dive_plan: DivePlan) -> Dict[str, Any]:
        dive_date = dive_plan.dive_date
        if not dive_date:
            dive_date = date.today()
        
        if tank.inspection_expiry_date < dive_date:
            days_expired = (dive_date - tank.inspection_expiry_date).days
            return {
                'risk_type': self.RISK_TYPES['INSPECTION_EXPIRED'],
                'details': f'气瓶 {tank.serial_number} 年检已过期 {days_expired} 天，到期日期: {tank.inspection_expiry_date.strftime("%Y-%m-%d")}',
                'severity': self.SEVERITY['CRITICAL']
            }
        return None
    
    def check_oxygen_partial_pressure(self, tank: Tank, dive_plan: DivePlan) -> Dict[str, Any]:
        latest_fill = FillRecord.query.filter_by(tank_id=tank.id).order_by(FillRecord.fill_date.desc()).first()
        
        if not latest_fill:
            return {
                'risk_type': self.RISK_TYPES['OXYGEN_OVER_LIMIT'],
                'details': f'气瓶 {tank.serial_number} 没有充气记录，无法确认氧分压',
                'severity': self.SEVERITY['HIGH']
            }
        
        max_ppo2 = self.config.MAX_OXYGEN_PARTIAL_PRESSURE
        
        if latest_fill.oxygen_partial_pressure > max_ppo2:
            return {
                'risk_type': self.RISK_TYPES['OXYGEN_OVER_LIMIT'],
                'details': f'气瓶 {tank.serial_number} 氧分压 ({latest_fill.oxygen_partial_pressure:.2f}) 超过最大值 ({max_ppo2:.2f})',
                'severity': self.SEVERITY['CRITICAL']
            }
        
        return None
    
    def check_pressure_sufficiency(self, tank: Tank, role: str) -> Dict[str, Any]:
        if role == 'primary':
            min_pressure = self.config.PRIMARY_TANK_MIN_PRESSURE
            if tank.current_pressure < min_pressure:
                return {
                    'risk_type': self.RISK_TYPES['PRIMARY_INSUFFICIENT'],
                    'details': f'主供气气瓶 {tank.serial_number} 压力 ({tank.current_pressure} bar) 不足，最低要求 {min_pressure} bar',
                    'severity': self.SEVERITY['HIGH']
                }
        elif role == 'backup':
            min_pressure = self.config.BACKUP_TANK_MIN_PRESSURE
            if tank.current_pressure < min_pressure:
                return {
                    'risk_type': self.RISK_TYPES['BACKUP_INSUFFICIENT'],
                    'details': f'备用气瓶 {tank.serial_number} 压力 ({tank.current_pressure} bar) 不足，最低要求 {min_pressure} bar',
                    'severity': self.SEVERITY['HIGH']
                }
        
        return None
    
    def check_duplicate_assignments(self, dive_plan_tanks: List[DivePlanTank]) -> List[Dict[str, Any]]:
        risks = []
        tank_assignments = {}
        
        for dpt in dive_plan_tanks:
            tank_id = dpt.tank_id
            if tank_id in tank_assignments:
                existing_role = tank_assignments[tank_id]
                risks.append({
                    'risk_type': self.RISK_TYPES['DUPLICATE_ASSIGNMENT'],
                    'tank_id': tank_id,
                    'details': f'气瓶 ID {tank_id} 被重复分配，同时作为 {existing_role} 和 {dpt.role}',
                    'severity': self.SEVERITY['CRITICAL']
                })
            else:
                tank_assignments[tank_id] = dpt.role
        
        return risks
    
    def create_risk_assessments(self, dive_plan: DivePlan, risks: List[Dict[str, Any]]) -> List[RiskAssessment]:
        assessments = []
        for risk in risks:
            assessment = RiskAssessment(
                dive_plan_id=dive_plan.id,
                risk_type=risk['risk_type'],
                tank_id=risk.get('tank_id'),
                details=risk['details'],
                severity=risk['severity'],
                resolved=False
            )
            db.session.add(assessment)
            assessments.append(assessment)
        
        db.session.commit()
        return assessments
    
    def has_unresolved_critical_risks(self, dive_plan: DivePlan) -> bool:
        critical_risks = RiskAssessment.query.filter_by(
            dive_plan_id=dive_plan.id,
            severity=self.SEVERITY['CRITICAL'],
            resolved=False
        ).first()
        return critical_risks is not None
