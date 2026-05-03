import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from core.models import (
    CaseData, VitalSign, DrugAdministration, DrugRule, RiskEvent,
    TimelineEvent, RiskType, RiskSeverity, WeightUnit
)


class RiskThresholds:
    SBP_LOW = 60
    MAP_LOW = 40
    TEMP_LOW = 35.0
    SPO2_LOW = 95
    HR_DOG_LOW = 60
    HR_DOG_HIGH = 180
    HR_CAT_LOW = 100
    HR_CAT_HIGH = 240
    RR_LOW = 6
    ETCO2_HIGH = 55
    MONITORING_GAP_MINUTES = 10
    GAP_DURATION_MINUTES = 5


class RulesEngine:
    
    def __init__(self):
        self.thresholds = RiskThresholds()
    
    def analyze_case(self, case_data: CaseData, drug_rules: List[DrugRule]) -> List[RiskEvent]:
        risks = []
        
        risks.extend(self._check_vital_signs(case_data))
        risks.extend(self._check_drug_dosages(case_data, drug_rules))
        risks.extend(self._check_monitoring_gaps(case_data))
        
        case_data.risks = risks
        self._build_timeline(case_data)
        
        return risks
    
    def _check_vital_signs(self, case_data: CaseData) -> List[RiskEvent]:
        risks = []
        vitals = case_data.vital_signs
        case = case_data.case
        
        hypotension_events = []
        hypothermia_events = []
        
        for vital in vitals:
            risk_details = []
            
            is_hypotensive = False
            if vital.systolic_bp and vital.systolic_bp < self.thresholds.SBP_LOW:
                risk_details.append({
                    'type': 'systolic_bp',
                    'value': vital.systolic_bp,
                    'threshold': self.thresholds.SBP_LOW,
                    'unit': 'mmHg'
                })
                is_hypotensive = True
            if vital.mean_bp and vital.mean_bp < self.thresholds.MAP_LOW:
                risk_details.append({
                    'type': 'mean_bp',
                    'value': vital.mean_bp,
                    'threshold': self.thresholds.MAP_LOW,
                    'unit': 'mmHg'
                })
                is_hypotensive = True
            
            if is_hypotensive:
                hypotension_events.append((vital.timestamp, risk_details, vital))
            
            if vital.temperature and vital.temperature < self.thresholds.TEMP_LOW:
                temp_detail = {
                    'type': 'temperature',
                    'value': vital.temperature,
                    'threshold': self.thresholds.TEMP_LOW,
                    'unit': '°C'
                }
                hypothermia_events.append((vital.timestamp, [temp_detail], vital))
        
        risks.extend(self._group_continuous_events(
            hypotension_events,
            RiskType.HYPOTENSION,
            case.case_id
        ))
        
        risks.extend(self._group_continuous_events(
            hypothermia_events,
            RiskType.HYPOTHERMIA,
            case.case_id
        ))
        
        return risks
    
    def _check_drug_dosages(self, case_data: CaseData, drug_rules: List[DrugRule]) -> List[RiskEvent]:
        risks = []
        case = case_data.case
        administrations = case_data.drug_administrations
        
        rules_map: Dict[Tuple[str, str], DrugRule] = {}
        for rule in drug_rules:
            key = (rule.drug_name.lower(), rule.species.value)
            rules_map[key] = rule
        
        weight_kg = case.weight_kg
        
        for admin in administrations:
            rule_key = (admin.drug_name.lower(), case.species.value)
            rule = rules_map.get(rule_key)
            
            if rule:
                dose_per_kg = admin.dose / weight_kg if weight_kg > 0 else 0
                
                is_violation = False
                violation_type = ""
                details = []
                
                if dose_per_kg < rule.min_dose_per_kg:
                    is_violation = True
                    violation_type = "剂量过低"
                    details.append({
                        'actual': dose_per_kg,
                        'min': rule.min_dose_per_kg,
                        'max': rule.max_dose_per_kg,
                        'unit': f"{rule.dose_unit}/kg"
                    })
                elif dose_per_kg > rule.max_dose_per_kg:
                    is_violation = True
                    violation_type = "剂量过高"
                    details.append({
                        'actual': dose_per_kg,
                        'min': rule.min_dose_per_kg,
                        'max': rule.max_dose_per_kg,
                        'unit': f"{rule.dose_unit}/kg"
                    })
                
                if is_violation:
                    risk = RiskEvent(
                        risk_id=str(uuid.uuid4()),
                        case_id=case.case_id,
                        risk_type=RiskType.DOSAGE_VIOLATION,
                        severity=self._determine_dosage_severity(dose_per_kg, rule),
                        start_time=admin.timestamp,
                        end_time=admin.timestamp,
                        description=f"{admin.drug_name} {violation_type}: 实际 {dose_per_kg:.3f} {rule.dose_unit}/kg, 范围 {rule.min_dose_per_kg}-{rule.max_dose_per_kg}",
                        data_points=[{
                            'timestamp': admin.timestamp.isoformat(),
                            'drug': admin.drug_name,
                            'total_dose': admin.dose,
                            'dose_per_kg': dose_per_kg,
                            'weight_kg': weight_kg,
                            'min': rule.min_dose_per_kg,
                            'max': rule.max_dose_per_kg,
                            'unit': rule.dose_unit
                        }]
                    )
                    risks.append(risk)
        
        return risks
    
    def _check_monitoring_gaps(self, case_data: CaseData) -> List[RiskEvent]:
        risks = []
        vitals = case_data.vital_signs
        case = case_data.case
        
        if len(vitals) < 2:
            return risks
        
        sorted_vitals = sorted(vitals, key=lambda v: v.timestamp)
        gap_threshold = timedelta(minutes=self.thresholds.MONITORING_GAP_MINUTES)
        
        for i in range(1, len(sorted_vitals)):
            prev_vital = sorted_vitals[i-1]
            curr_vital = sorted_vitals[i]
            
            time_gap = curr_vital.timestamp - prev_vital.timestamp
            
            if time_gap > gap_threshold:
                gap_minutes = time_gap.total_seconds() / 60
                
                risk = RiskEvent(
                    risk_id=str(uuid.uuid4()),
                    case_id=case.case_id,
                    risk_type=RiskType.MONITORING_GAP,
                    severity=RiskSeverity.MEDIUM if gap_minutes < 30 else RiskSeverity.HIGH,
                    start_time=prev_vital.timestamp,
                    end_time=curr_vital.timestamp,
                    description=f"监护数据中断 {gap_minutes:.1f} 分钟",
                    data_points=[{
                        'gap_start': prev_vital.timestamp.isoformat(),
                        'gap_end': curr_vital.timestamp.isoformat(),
                        'gap_minutes': gap_minutes,
                        'threshold_minutes': self.thresholds.MONITORING_GAP_MINUTES
                    }]
                )
                risks.append(risk)
        
        return risks
    
    def _group_continuous_events(
        self, 
        events: List[Tuple[datetime, List[Dict], VitalSign]],
        risk_type: RiskType,
        case_id: str
    ) -> List[RiskEvent]:
        if not events:
            return []
        
        risks = []
        current_group: List[Tuple[datetime, List[Dict], VitalSign]] = []
        max_gap = timedelta(minutes=5)
        
        for event in events:
            ts, details, vital = event
            
            if not current_group:
                current_group.append(event)
            else:
                last_ts = current_group[-1][0]
                if ts - last_ts <= max_gap:
                    current_group.append(event)
                else:
                    risk = self._create_risk_from_group(current_group, risk_type, case_id)
                    if risk:
                        risks.append(risk)
                    current_group = [event]
        
        if current_group:
            risk = self._create_risk_from_group(current_group, risk_type, case_id)
            if risk:
                risks.append(risk)
        
        return risks
    
    def _create_risk_from_group(
        self,
        group: List[Tuple[datetime, List[Dict], VitalSign]],
        risk_type: RiskType,
        case_id: str
    ) -> Optional[RiskEvent]:
        if not group:
            return None
        
        start_time = group[0][0]
        end_time = group[-1][0]
        duration_min = (end_time - start_time).total_seconds() / 60
        
        all_details = []
        for ts, details, vital in group:
            detail_point = {
                'timestamp': ts.isoformat()
            }
            for d in details:
                detail_point.update(d)
            all_details.append(detail_point)
        
        if risk_type == RiskType.HYPOTENSION:
            severity = RiskSeverity.MEDIUM
            if duration_min > 10:
                severity = RiskSeverity.HIGH
            min_sbp = min(
                (v[2].systolic_bp for v in group if v[2].systolic_bp),
                default=float('inf')
            )
            if min_sbp < 40:
                severity = RiskSeverity.HIGH
            
            description = f"低血压持续 {duration_min:.1f} 分钟, 最低收缩压 {min_sbp} mmHg"
        
        elif risk_type == RiskType.HYPOTHERMIA:
            severity = RiskSeverity.MEDIUM
            if duration_min > 30:
                severity = RiskSeverity.HIGH
            min_temp = min(
                (v[2].temperature for v in group if v[2].temperature),
                default=float('inf')
            )
            if min_temp < 32:
                severity = RiskSeverity.HIGH
            
            description = f"低体温持续 {duration_min:.1f} 分钟, 最低体温 {min_temp:.1f} °C"
        
        else:
            severity = RiskSeverity.MEDIUM
            description = f"{risk_type.value} 持续 {duration_min:.1f} 分钟"
        
        return RiskEvent(
            risk_id=str(uuid.uuid4()),
            case_id=case_id,
            risk_type=risk_type,
            severity=severity,
            start_time=start_time,
            end_time=end_time,
            description=description,
            data_points=all_details
        )
    
    def _determine_dosage_severity(self, dose_per_kg: float, rule: DrugRule) -> RiskSeverity:
        if rule.min_dose_per_kg > 0:
            ratio = dose_per_kg / rule.min_dose_per_kg
            if ratio < 0.5:
                return RiskSeverity.HIGH
            elif ratio < 0.75:
                return RiskSeverity.MEDIUM
        
        if rule.max_dose_per_kg < float('inf'):
            ratio = dose_per_kg / rule.max_dose_per_kg
            if ratio > 2:
                return RiskSeverity.HIGH
            elif ratio > 1.5:
                return RiskSeverity.MEDIUM
        
        return RiskSeverity.LOW
    
    def _build_timeline(self, case_data: CaseData):
        timeline: List[TimelineEvent] = []
        
        case = case_data.case
        timeline.append(TimelineEvent(
            timestamp=case.start_time,
            event_type='surgery_start',
            description='手术开始',
            details={'type': case.surgery_type}
        ))
        
        for vital in case_data.vital_signs:
            event_type = 'vitals'
            description = '生命体征记录'
            details = {}
            
            if vital.heart_rate:
                details['hr'] = vital.heart_rate
            if vital.systolic_bp:
                details['sbp'] = vital.systolic_bp
                details['dbp'] = vital.diastolic_bp
                details['map'] = vital.mean_bp
            if vital.temperature:
                details['temp'] = vital.temperature
            if vital.spo2:
                details['spo2'] = vital.spo2
            if vital.etco2:
                details['etco2'] = vital.etco2
            
            timeline.append(TimelineEvent(
                timestamp=vital.timestamp,
                event_type=event_type,
                description=description,
                details=details
            ))
        
        for admin in case_data.drug_administrations:
            timeline.append(TimelineEvent(
                timestamp=admin.timestamp,
                event_type='drug',
                description=f'给药: {admin.drug_name} {admin.dose}{admin.dose_unit}',
                details={
                    'drug': admin.drug_name,
                    'dose': admin.dose,
                    'unit': admin.dose_unit,
                    'route': admin.route
                }
            ))
        
        for risk in case_data.risks:
            timeline.append(TimelineEvent(
                timestamp=risk.start_time,
                event_type='risk',
                description=f'风险: {risk.description}',
                details={
                    'risk_id': risk.risk_id,
                    'risk_type': risk.risk_type.value,
                    'severity': risk.severity.value,
                    'confirmed': risk.confirmed
                }
            ))
        
        if case.end_time:
            timeline.append(TimelineEvent(
                timestamp=case.end_time,
                event_type='surgery_end',
                description='手术结束',
                details={}
            ))
        
        timeline.sort(key=lambda e: e.timestamp)
        case_data.timeline = timeline
