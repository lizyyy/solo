from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.models import (
    AnesthesiaRecord, InfusionPumpLog, CageSensor, MedicationPlan,
    PatientStatus
)

DRUG_CONFLICTS = {
    "阿片类药物": ["苯二氮卓类", "巴比妥类", "酒精"],
    "苯二氮卓类": ["阿片类药物", "巴比妥类", "抗抑郁药"],
    "非甾体抗炎药": ["皮质类固醇", "抗凝血药", "利尿剂"],
    "抗生素": ["抗凝血药", "口服避孕药", "甲氨蝶呤"],
    "皮质类固醇": ["非甾体抗炎药", "抗糖尿病药", "疫苗"],
    "胰岛素": ["皮质类固醇", "β受体阻滞剂", "利尿剂"],
}

GENERIC_TO_CLASS = {
    "吗啡": "阿片类药物",
    "芬太尼": "阿片类药物",
    "哌替啶": "阿片类药物",
    "安定": "苯二氮卓类",
    "咪达唑仑": "苯二氮卓类",
    "地西泮": "苯二氮卓类",
    "布洛芬": "非甾体抗炎药",
    "阿司匹林": "非甾体抗炎药",
    "卡洛芬": "非甾体抗炎药",
    "美洛昔康": "非甾体抗炎药",
    "泼尼松": "皮质类固醇",
    "地塞米松": "皮质类固醇",
    "氢化可的松": "皮质类固醇",
    "青霉素": "抗生素",
    "头孢菌素": "抗生素",
    "阿莫西林": "抗生素",
    "恩诺沙星": "抗生素",
}

class AnomalyDetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.awakening_timeout_hours = 4.0
        self.infusion_interruption_minutes = 30.0
        self.temperature_normal_min = 36.0
        self.temperature_normal_max = 39.0
        self.oxygen_normal_min = 90.0
        self.oxygen_normal_max = 100.0
    
    def check_awakening_timeout(self, patient_id: str) -> Dict[str, Any]:
        anesthesia_records = self.db.query(AnesthesiaRecord).filter(
            AnesthesiaRecord.patient_id == patient_id,
            AnesthesiaRecord.anesthesia_end_time.isnot(None)
        ).order_by(AnesthesiaRecord.anesthesia_end_time.desc()).first()
        
        if not anesthesia_records:
            return {
                "has_timeout": False,
                "details": "未找到麻醉记录"
            }
        
        end_time = anesthesia_records.anesthesia_end_time
        awakening_time = anesthesia_records.awakening_time
        current_time = datetime.utcnow()
        
        if awakening_time:
            time_to_awaken = (awakening_time - end_time).total_seconds() / 3600.0
            if time_to_awaken > self.awakening_timeout_hours:
                return {
                    "has_timeout": True,
                    "details": f"苏醒超时: 麻醉结束后 {time_to_awaken:.1f} 小时才苏醒, 超过 {self.awakening_timeout_hours} 小时阈值",
                    "end_time": end_time.isoformat(),
                    "awakening_time": awakening_time.isoformat(),
                    "hours_to_awaken": time_to_awaken
                }
            else:
                return {
                    "has_timeout": False,
                    "details": f"苏醒正常: 麻醉结束后 {time_to_awaken:.1f} 小时苏醒",
                    "end_time": end_time.isoformat(),
                    "awakening_time": awakening_time.isoformat(),
                    "hours_to_awaken": time_to_awaken
                }
        else:
            time_since_end = (current_time - end_time).total_seconds() / 3600.0
            if time_since_end > self.awakening_timeout_hours:
                return {
                    "has_timeout": True,
                    "details": f"苏醒超时: 麻醉结束已 {time_since_end:.1f} 小时, 仍未苏醒, 超过 {self.awakening_timeout_hours} 小时阈值",
                    "end_time": end_time.isoformat(),
                    "current_time": current_time.isoformat(),
                    "hours_since_end": time_since_end
                }
            else:
                return {
                    "has_timeout": False,
                    "details": f"等待苏醒: 麻醉结束已 {time_since_end:.1f} 小时",
                    "end_time": end_time.isoformat(),
                    "current_time": current_time.isoformat(),
                    "hours_since_end": time_since_end
                }
    
    def check_infusion_interruption(self, patient_id: str) -> Dict[str, Any]:
        infusion_logs = self.db.query(InfusionPumpLog).filter(
            InfusionPumpLog.patient_id == patient_id
        ).order_by(InfusionPumpLog.log_time.desc()).all()
        
        if not infusion_logs:
            return {
                "has_interruption": False,
                "details": "未找到输液泵日志"
            }
        
        interruptions = []
        for log in infusion_logs:
            if log.is_interrupted:
                interruption_detail = {
                    "log_time": log.log_time.isoformat() if log.log_time else None,
                    "drug_name": log.drug_name,
                    "interruption_reason": log.interruption_reason,
                    "interruption_start": log.interruption_start_time.isoformat() if log.interruption_start_time else None,
                    "interruption_end": log.interruption_end_time.isoformat() if log.interruption_end_time else None,
                    "duration_minutes": None
                }
                
                if log.interruption_start_time and log.interruption_end_time:
                    duration = (log.interruption_end_time - log.interruption_start_time).total_seconds() / 60.0
                    interruption_detail["duration_minutes"] = duration
                    if duration > self.infusion_interruption_minutes:
                        interruption_detail["is_prolonged"] = True
                        interruptions.append(interruption_detail)
                elif log.interruption_start_time and not log.interruption_end_time:
                    current_time = datetime.utcnow()
                    duration = (current_time - log.interruption_start_time).total_seconds() / 60.0
                    interruption_detail["duration_minutes"] = duration
                    if duration > self.infusion_interruption_minutes:
                        interruption_detail["is_prolonged"] = True
                        interruption_detail["is_ongoing"] = True
                        interruptions.append(interruption_detail)
        
        if interruptions:
            return {
                "has_interruption": True,
                "details": f"检测到 {len(interruptions)} 次长时间输液中断",
                "interruptions": interruptions,
                "threshold_minutes": self.infusion_interruption_minutes
            }
        else:
            return {
                "has_interruption": False,
                "details": "输液泵运行正常, 无长时间中断"
            }
    
    def check_temp_oxygen_abnormal(self, patient_id: str) -> Dict[str, Any]:
        sensor_readings = self.db.query(CageSensor).filter(
            CageSensor.patient_id == patient_id
        ).order_by(CageSensor.reading_time.desc()).limit(10).all()
        
        if not sensor_readings:
            return {
                "has_abnormal": False,
                "details": "未找到笼位传感器数据"
            }
        
        latest = sensor_readings[0]
        abnormal_readings = []
        
        for reading in sensor_readings:
            temp_abnormal = False
            oxy_abnormal = False
            temp_details = None
            oxy_details = None
            
            if reading.temperature is not None:
                if reading.temperature < (reading.temperature_min or self.temperature_normal_min):
                    temp_abnormal = True
                    temp_details = f"体温过低: {reading.temperature}°C, 下限 {reading.temperature_min or self.temperature_normal_min}°C"
                elif reading.temperature > (reading.temperature_max or self.temperature_normal_max):
                    temp_abnormal = True
                    temp_details = f"体温过高: {reading.temperature}°C, 上限 {reading.temperature_max or self.temperature_normal_max}°C"
            
            if reading.oxygen_level is not None:
                if reading.oxygen_level < (reading.oxygen_min or self.oxygen_normal_min):
                    oxy_abnormal = True
                    oxy_details = f"血氧过低: {reading.oxygen_level}%, 下限 {reading.oxygen_min or self.oxygen_normal_min}%"
                elif reading.oxygen_level > (reading.oxygen_max or self.oxygen_normal_max):
                    oxy_abnormal = True
                    oxy_details = f"血氧过高: {reading.oxygen_level}%, 上限 {reading.oxygen_max or self.oxygen_normal_max}%"
            
            if temp_abnormal or oxy_abnormal:
                abnormal_readings.append({
                    "reading_time": reading.reading_time.isoformat() if reading.reading_time else None,
                    "temperature": reading.temperature,
                    "oxygen_level": reading.oxygen_level,
                    "temp_abnormal": temp_abnormal,
                    "temp_details": temp_details,
                    "oxy_abnormal": oxy_abnormal,
                    "oxy_details": oxy_details
                })
        
        if abnormal_readings:
            return {
                "has_abnormal": True,
                "details": f"检测到 {len(abnormal_readings)} 次温氧异常读数",
                "latest_reading": {
                    "time": latest.reading_time.isoformat() if latest.reading_time else None,
                    "temperature": latest.temperature,
                    "oxygen_level": latest.oxygen_level,
                    "is_temp_abnormal": latest.is_temperature_abnormal,
                    "is_oxy_abnormal": latest.is_oxygen_abnormal
                },
                "abnormal_readings": abnormal_readings
            }
        else:
            return {
                "has_abnormal": False,
                "details": "温氧读数正常",
                "latest_reading": {
                    "time": latest.reading_time.isoformat() if latest.reading_time else None,
                    "temperature": latest.temperature,
                    "oxygen_level": latest.oxygen_level
                }
            }
    
    def check_medication_conflicts(self, patient_id: str) -> Dict[str, Any]:
        medications = self.db.query(MedicationPlan).filter(
            MedicationPlan.patient_id == patient_id,
            or_(
                MedicationPlan.end_time.is_(None),
                MedicationPlan.end_time > datetime.utcnow()
            )
        ).all()
        
        if not medications or len(medications) < 2:
            return {
                "has_conflict": False,
                "details": f"仅 {len(medications)} 种活跃用药, 无冲突风险"
            }
        
        conflicts = []
        med_classes = []
        
        for med in medications:
            drug_class = self._get_drug_class(med.drug_name, med.generic_name)
            med_classes.append({
                "medication_id": med.id,
                "drug_name": med.drug_name,
                "generic_name": med.generic_name,
                "drug_class": drug_class
            })
        
        for i, med1 in enumerate(med_classes):
            for j, med2 in enumerate(med_classes[i+1:], i+1):
                conflict = self._check_pair_conflict(med1, med2)
                if conflict:
                    conflicts.append(conflict)
        
        if conflicts:
            return {
                "has_conflict": True,
                "details": f"检测到 {len(conflicts)} 个用药冲突",
                "conflicts": conflicts,
                "active_medications": [
                    {"name": m["drug_name"], "class": m["drug_class"]} 
                    for m in med_classes
                ]
            }
        else:
            return {
                "has_conflict": False,
                "details": "活跃用药无冲突",
                "active_medications": [
                    {"name": m["drug_name"], "class": m["drug_class"]} 
                    for m in med_classes
                ]
            }
    
    def _get_drug_class(self, drug_name: str, generic_name: str = None) -> str:
        search_names = [drug_name]
        if generic_name:
            search_names.append(generic_name)
        
        for name in search_names:
            name_lower = name.lower()
            for generic, drug_class in GENERIC_TO_CLASS.items():
                if generic.lower() in name_lower or name_lower in generic.lower():
                    return drug_class
        
        return "未知分类"
    
    def _check_pair_conflict(self, med1: Dict, med2: Dict) -> Optional[Dict]:
        class1 = med1["drug_class"]
        class2 = med2["drug_class"]
        
        if class1 in DRUG_CONFLICTS:
            if class2 in DRUG_CONFLICTS[class1]:
                return {
                    "medication_1": med1["drug_name"],
                    "medication_2": med2["drug_name"],
                    "class_1": class1,
                    "class_2": class2,
                    "conflict_type": f"{class1} 与 {class2} 存在药物相互作用风险",
                    "severity": "高" if class1 in ["阿片类药物", "苯二氮卓类"] else "中"
                }
        
        if class2 in DRUG_CONFLICTS:
            if class1 in DRUG_CONFLICTS[class2]:
                return {
                    "medication_1": med2["drug_name"],
                    "medication_2": med1["drug_name"],
                    "class_1": class2,
                    "class_2": class1,
                    "conflict_type": f"{class2} 与 {class1} 存在药物相互作用风险",
                    "severity": "高" if class2 in ["阿片类药物", "苯二氮卓类"] else "中"
                }
        
        return None
    
    def check_all_anomalies(self, patient_id: str) -> Dict[str, Any]:
        results = {
            "patient_id": patient_id,
            "check_time": datetime.utcnow().isoformat(),
            "awakening_timeout": self.check_awakening_timeout(patient_id),
            "infusion_interruption": self.check_infusion_interruption(patient_id),
            "temp_oxygen_abnormal": self.check_temp_oxygen_abnormal(patient_id),
            "medication_conflicts": self.check_medication_conflicts(patient_id)
        }
        
        has_any_anomaly = (
            results["awakening_timeout"]["has_timeout"] or
            results["infusion_interruption"]["has_interruption"] or
            results["temp_oxygen_abnormal"]["has_abnormal"] or
            results["medication_conflicts"]["has_conflict"]
        )
        
        results["has_any_anomaly"] = has_any_anomaly
        
        return results
