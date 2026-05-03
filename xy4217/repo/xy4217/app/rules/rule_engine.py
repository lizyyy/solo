from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.models import (
    Prescription, DrugBatch, TemperatureLog, WasteRecord, RiskRecord
)


RISK_TYPES = {
    'BATCH_CONFLICT': '批号冲突',
    'TEMP_GAP': '温度断档',
    'DOSE_OVER_LIMIT': '剂量超限',
    'WASTE_NOT_CLOSED': '未闭环废弃',
    'PREPARE_TIMEOUT': '超时调配',
    'COLD_CHAIN_ABNORMAL': '冷链异常',
    'BATCH_CROSS_PATIENT': '同批号跨患者串用',
    'REMAINING_MISMATCH': '剩余量对不上',
}

RISK_LEVELS = {
    'high': '高风险',
    'medium': '中风险',
    'low': '低风险',
}


class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = [
            self.check_batch_conflict,
            self.check_temperature_gap,
            self.check_dose_over_limit,
            self.check_waste_not_closed,
            self.check_prepare_timeout,
            self.check_cold_chain_abnormal,
            self.check_batch_cross_patient,
            self.check_remaining_mismatch,
        ]
    
    def run_all_rules(self, start_time: Optional[datetime] = None, 
                       end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        all_risks = []
        
        for rule in self.rules:
            risks = rule(start_time=start_time, end_time=end_time)
            all_risks.extend(risks)
        
        return all_risks
    
    def check_batch_conflict(self, start_time: Optional[datetime] = None,
                              end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        batches = self.db.query(DrugBatch).all()
        
        batch_map = defaultdict(list)
        for batch in batches:
            batch_map[batch.batch_number].append(batch)
        
        for batch_num, batch_list in batch_map.items():
            if len(batch_list) > 1:
                risks.append({
                    'risk_type': 'BATCH_CONFLICT',
                    'risk_level': 'high',
                    'description': f'批号[{batch_num}]存在多条记录，可能存在冲突',
                    'related_batch_number': batch_num,
                    'details': {
                        'count': len(batch_list),
                        'batches': [
                            {
                                'drug_name': b.drug_name,
                                'total_amount': b.total_amount,
                                'expire_date': str(b.expire_date)
                            } for b in batch_list
                        ]
                    }
                })
        
        return risks
    
    def check_temperature_gap(self, start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = self.db.query(TemperatureLog)
        if start_time:
            query = query.filter(TemperatureLog.log_time >= start_time)
        if end_time:
            query = query.filter(TemperatureLog.log_time <= end_time)
        
        logs = query.order_by(TemperatureLog.fridge_id, TemperatureLog.log_time).all()
        
        fridge_logs = defaultdict(list)
        for log in logs:
            fridge_logs[log.fridge_id].append(log)
        
        max_gap_minutes = 60
        
        for fridge_id, log_list in fridge_logs.items():
            if len(log_list) < 2:
                continue
            
            for i in range(1, len(log_list)):
                prev_log = log_list[i-1]
                curr_log = log_list[i]
                gap = curr_log.log_time - prev_log.log_time
                
                if gap.total_seconds() > max_gap_minutes * 60:
                    risks.append({
                        'risk_type': 'TEMP_GAP',
                        'risk_level': 'high',
                        'description': f'冰箱[{fridge_id}]温度记录存在断档，间隔{int(gap.total_seconds()/60)}分钟',
                        'related_fridge_id': fridge_id,
                        'details': {
                            'gap_minutes': int(gap.total_seconds() / 60),
                            'prev_time': str(prev_log.log_time),
                            'curr_time': str(curr_log.log_time),
                            'max_allowed_gap_minutes': max_gap_minutes
                        }
                    })
        
        return risks
    
    def check_dose_over_limit(self, start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = self.db.query(Prescription)
        if start_time:
            query = query.filter(Prescription.prescription_time >= start_time)
        if end_time:
            query = query.filter(Prescription.prescription_time <= end_time)
        
        prescriptions = query.all()
        
        for presc in prescriptions:
            batch = None
            if presc.batch_number:
                batch = self.db.query(DrugBatch).filter(
                    DrugBatch.batch_number == presc.batch_number
                ).first()
            
            if batch:
                if presc.dose > batch.total_amount:
                    risks.append({
                        'risk_type': 'DOSE_OVER_LIMIT',
                        'risk_level': 'high',
                        'description': f'处方[{presc.prescription_id}]剂量{presc.dose}{presc.unit}超过批号[{batch.batch_number}]总量{batch.total_amount}{batch.unit}',
                        'related_prescription_id': presc.prescription_id,
                        'related_batch_number': batch.batch_number,
                        'details': {
                            'prescription_dose': presc.dose,
                            'batch_total': batch.total_amount,
                            'unit': presc.unit
                        }
                    })
                elif presc.dose > batch.remaining_amount:
                    risks.append({
                        'risk_type': 'DOSE_OVER_LIMIT',
                        'risk_level': 'high',
                        'description': f'处方[{presc.prescription_id}]剂量{presc.dose}{presc.unit}超过批号[{batch.batch_number}]剩余量{batch.remaining_amount}{batch.unit}',
                        'related_prescription_id': presc.prescription_id,
                        'related_batch_number': batch.batch_number,
                        'details': {
                            'prescription_dose': presc.dose,
                            'batch_remaining': batch.remaining_amount,
                            'unit': presc.unit
                        }
                    })
        
        return risks
    
    def check_waste_not_closed(self, start_time: Optional[datetime] = None,
                                end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = self.db.query(WasteRecord).filter(WasteRecord.closed == 0)
        if start_time:
            query = query.filter(WasteRecord.waste_time >= start_time)
        if end_time:
            query = query.filter(WasteRecord.waste_time <= end_time)
        
        unclosed_records = query.all()
        
        now = datetime.now()
        close_deadline_hours = 24
        
        for record in unclosed_records:
            time_since_waste = now - record.waste_time
            hours_since_waste = time_since_waste.total_seconds() / 3600
            
            if hours_since_waste > close_deadline_hours:
                risks.append({
                    'risk_type': 'WASTE_NOT_CLOSED',
                    'risk_level': 'medium',
                    'description': f'废弃记录[{record.waste_id}]已超过{close_deadline_hours}小时未闭环，当前已{int(hours_since_waste)}小时',
                    'related_waste_id': record.waste_id,
                    'related_batch_number': record.batch_number,
                    'details': {
                        'waste_time': str(record.waste_time),
                        'hours_since_waste': int(hours_since_waste),
                        'close_deadline_hours': close_deadline_hours,
                        'waste_amount': record.waste_amount,
                        'waste_reason': record.waste_reason
                    }
                })
        
        return risks
    
    def check_prepare_timeout(self, start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = self.db.query(Prescription).filter(
            Prescription.expected_prepare_time.isnot(None),
            Prescription.actual_prepare_time.isnot(None)
        )
        if start_time:
            query = query.filter(Prescription.prescription_time >= start_time)
        if end_time:
            query = query.filter(Prescription.prescription_time <= end_time)
        
        prescriptions = query.all()
        
        allowed_delay_minutes = 30
        
        for presc in prescriptions:
            if presc.actual_prepare_time > presc.expected_prepare_time:
                delay = presc.actual_prepare_time - presc.expected_prepare_time
                delay_minutes = int(delay.total_seconds() / 60)
                
                if delay_minutes > allowed_delay_minutes:
                    risks.append({
                        'risk_type': 'PREPARE_TIMEOUT',
                        'risk_level': 'medium',
                        'description': f'处方[{presc.prescription_id}]调配超时{delay_minutes}分钟',
                        'related_prescription_id': presc.prescription_id,
                        'details': {
                            'expected_time': str(presc.expected_prepare_time),
                            'actual_time': str(presc.actual_prepare_time),
                            'delay_minutes': delay_minutes,
                            'allowed_delay_minutes': allowed_delay_minutes
                        }
                    })
        
        return risks
    
    def check_cold_chain_abnormal(self, start_time: Optional[datetime] = None,
                                   end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = self.db.query(TemperatureLog)
        if start_time:
            query = query.filter(TemperatureLog.log_time >= start_time)
        if end_time:
            query = query.filter(TemperatureLog.log_time <= end_time)
        
        logs = query.order_by(TemperatureLog.log_time.desc()).all()
        
        min_valid_temp = 2.0
        max_valid_temp = 8.0
        
        for log in logs:
            temp = log.temperature
            is_abnormal = temp < min_valid_temp or temp > max_valid_temp
            
            if is_abnormal:
                risk_level = 'high' if abs(temp - (min_valid_temp + max_valid_temp)/2) > 5 else 'medium'
                
                risks.append({
                    'risk_type': 'COLD_CHAIN_ABNORMAL',
                    'risk_level': risk_level,
                    'description': f'冰箱[{log.fridge_id}]温度异常：{temp}°C，正常范围{min_valid_temp}-{max_valid_temp}°C',
                    'related_fridge_id': log.fridge_id,
                    'details': {
                        'temperature': temp,
                        'min_valid': min_valid_temp,
                        'max_valid': max_valid_temp,
                        'log_time': str(log.log_time),
                        'fridge_name': log.fridge_name
                    }
                })
        
        return risks
    
    def check_batch_cross_patient(self, start_time: Optional[datetime] = None,
                                   end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        query = self.db.query(Prescription).filter(
            Prescription.batch_number.isnot(None)
        )
        if start_time:
            query = query.filter(Prescription.prescription_time >= start_time)
        if end_time:
            query = query.filter(Prescription.prescription_time <= end_time)
        
        prescriptions = query.all()
        
        batch_patients = defaultdict(set)
        for presc in prescriptions:
            if presc.batch_number and presc.patient_id:
                batch_patients[presc.batch_number].add((presc.patient_id, presc.patient_name))
        
        for batch_num, patient_set in batch_patients.items():
            if len(patient_set) > 1:
                batch = self.db.query(DrugBatch).filter(
                    DrugBatch.batch_number == batch_num
                ).first()
                
                drug_name = batch.drug_name if batch else '未知药品'
                
                risks.append({
                    'risk_type': 'BATCH_CROSS_PATIENT',
                    'risk_level': 'high',
                    'description': f'批号[{batch_num}]({drug_name})被{len(patient_set)}个患者使用，存在串用风险',
                    'related_batch_number': batch_num,
                    'details': {
                        'patient_count': len(patient_set),
                        'patients': [
                            {'patient_id': p[0], 'patient_name': p[1]} 
                            for p in patient_set
                        ],
                        'drug_name': drug_name
                    }
                })
        
        return risks
    
    def check_remaining_mismatch(self, start_time: Optional[datetime] = None,
                                  end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        risks = []
        
        batches = self.db.query(DrugBatch).all()
        
        for batch in batches:
            presc_query = self.db.query(Prescription).filter(
                Prescription.batch_number == batch.batch_number
            )
            if start_time:
                presc_query = presc_query.filter(Prescription.prescription_time >= start_time)
            if end_time:
                presc_query = presc_query.filter(Prescription.prescription_time <= end_time)
            
            prescriptions = presc_query.all()
            total_used = sum(p.dose for p in prescriptions if p.status in ['prepared', 'completed'])
            
            waste_query = self.db.query(WasteRecord).filter(
                WasteRecord.batch_number == batch.batch_number
            )
            if start_time:
                waste_query = waste_query.filter(WasteRecord.waste_time >= start_time)
            if end_time:
                waste_query = waste_query.filter(WasteRecord.waste_time <= end_time)
            
            wastes = waste_query.all()
            total_wasted = sum(w.waste_amount for w in wastes)
            
            expected_remaining = batch.total_amount - total_used - total_wasted
            
            tolerance = 0.001
            if abs(expected_remaining - batch.remaining_amount) > tolerance:
                risks.append({
                    'risk_type': 'REMAINING_MISMATCH',
                    'risk_level': 'high',
                    'description': f'批号[{batch.batch_number}]剩余量不匹配：登记{batch.remaining_amount}{batch.unit}，计算应为{expected_remaining}{batch.unit}',
                    'related_batch_number': batch.batch_number,
                    'details': {
                        'total_amount': batch.total_amount,
                        'total_used': total_used,
                        'total_wasted': total_wasted,
                        'expected_remaining': expected_remaining,
                        'recorded_remaining': batch.remaining_amount,
                        'difference': batch.remaining_amount - expected_remaining,
                        'unit': batch.unit
                    }
                })
        
        return risks
