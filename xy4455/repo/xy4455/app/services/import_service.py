import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Tuple
from io import StringIO
from app.models.models import (
    AnesthesiaRecord, InfusionPumpLog, CageSensor, MedicationPlan,
    PatientStatus
)
from app.schemas.schemas import ImportResult, DataSource
from sqlalchemy.orm import Session
import pandas as pd

class ImportService:
    def __init__(self, db: Session):
        self.db = db
    
    def parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d']:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        return None
    
    def parse_float(self, value: Any) -> float:
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ['true', '1', 'yes', '是']
        return False
    
    def import_from_json(self, data_source: DataSource, json_data: str) -> ImportResult:
        try:
            data = json.loads(json_data)
            if not isinstance(data, list):
                data = [data]
            return self._import_records(data_source, data)
        except json.JSONDecodeError as e:
            return ImportResult(
                success=False,
                total_records=0,
                imported_records=0,
                failed_records=1,
                errors=[f"JSON解析错误: {str(e)}"]
            )
    
    def import_from_csv(self, data_source: DataSource, csv_data: str) -> ImportResult:
        try:
            df = pd.read_csv(StringIO(csv_data))
            data = df.to_dict('records')
            return self._import_records(data_source, data)
        except Exception as e:
            return ImportResult(
                success=False,
                total_records=0,
                imported_records=0,
                failed_records=1,
                errors=[f"CSV解析错误: {str(e)}"]
            )
    
    def _import_records(self, data_source: DataSource, records: List[Dict]) -> ImportResult:
        errors = []
        warnings = []
        imported_count = 0
        failed_count = 0
        
        for idx, record in enumerate(records):
            try:
                if data_source == DataSource.ANESTHESIA:
                    self._create_anesthesia_record(record)
                elif data_source == DataSource.INFUSION:
                    self._create_infusion_log(record)
                elif data_source == DataSource.CAGE:
                    self._create_cage_sensor(record)
                elif data_source == DataSource.MEDICATION:
                    self._create_medication_plan(record)
                else:
                    errors.append(f"未知的数据源类型: {data_source}")
                    continue
                
                imported_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"第 {idx + 1} 条记录导入失败: {str(e)}")
        
        self.db.commit()
        
        return ImportResult(
            success=len(errors) == 0,
            total_records=len(records),
            imported_records=imported_count,
            failed_records=failed_count,
            errors=errors,
            warnings=warnings
        )
    
    def _create_anesthesia_record(self, data: Dict):
        patient_id = data.get('patient_id')
        if not patient_id:
            raise ValueError("缺少patient_id字段")
        
        record = AnesthesiaRecord(
            patient_id=str(patient_id),
            patient_name=data.get('patient_name'),
            species=data.get('species'),
            breed=data.get('breed'),
            anesthesia_start_time=self.parse_datetime(data.get('anesthesia_start_time')),
            anesthesia_end_time=self.parse_datetime(data.get('anesthesia_end_time')),
            awakening_time=self.parse_datetime(data.get('awakening_time')),
            anesthetic_type=data.get('anesthetic_type'),
            dosage=self.parse_float(data.get('dosage')),
            heart_rate=self.parse_float(data.get('heart_rate')),
            respiratory_rate=self.parse_float(data.get('respiratory_rate')),
            blood_pressure_systolic=self.parse_float(data.get('blood_pressure_systolic')),
            blood_pressure_diastolic=self.parse_float(data.get('blood_pressure_diastolic')),
            temperature=self.parse_float(data.get('temperature')),
            spo2=self.parse_float(data.get('spo2')),
            notes=data.get('notes')
        )
        self.db.add(record)
    
    def _create_infusion_log(self, data: Dict):
        patient_id = data.get('patient_id')
        log_time = data.get('log_time')
        
        if not patient_id:
            raise ValueError("缺少patient_id字段")
        if not log_time:
            raise ValueError("缺少log_time字段")
        
        record = InfusionPumpLog(
            patient_id=str(patient_id),
            log_time=self.parse_datetime(log_time),
            drug_name=data.get('drug_name'),
            concentration=data.get('concentration'),
            infusion_rate=self.parse_float(data.get('infusion_rate')),
            volume_infused=self.parse_float(data.get('volume_infused')),
            volume_remaining=self.parse_float(data.get('volume_remaining')),
            is_interrupted=self.parse_bool(data.get('is_interrupted')),
            interruption_reason=data.get('interruption_reason'),
            interruption_start_time=self.parse_datetime(data.get('interruption_start_time')),
            interruption_end_time=self.parse_datetime(data.get('interruption_end_time')),
            pump_status=data.get('pump_status'),
            alarms=data.get('alarms')
        )
        self.db.add(record)
    
    def _create_cage_sensor(self, data: Dict):
        patient_id = data.get('patient_id')
        reading_time = data.get('reading_time')
        
        if not patient_id:
            raise ValueError("缺少patient_id字段")
        if not reading_time:
            raise ValueError("缺少reading_time字段")
        
        temperature = self.parse_float(data.get('temperature'))
        temperature_min = self.parse_float(data.get('temperature_min')) or 36.0
        temperature_max = self.parse_float(data.get('temperature_max')) or 39.0
        
        oxygen_level = self.parse_float(data.get('oxygen_level'))
        oxygen_min = self.parse_float(data.get('oxygen_min')) or 90.0
        oxygen_max = self.parse_float(data.get('oxygen_max')) or 100.0
        
        is_temp_abnormal = False
        is_oxygen_abnormal = False
        
        if temperature is not None:
            is_temp_abnormal = temperature < temperature_min or temperature > temperature_max
        
        if oxygen_level is not None:
            is_oxygen_abnormal = oxygen_level < oxygen_min or oxygen_level > oxygen_max
        
        record = CageSensor(
            patient_id=str(patient_id),
            cage_number=data.get('cage_number'),
            reading_time=self.parse_datetime(reading_time),
            temperature=temperature,
            temperature_min=temperature_min,
            temperature_max=temperature_max,
            oxygen_level=oxygen_level,
            oxygen_min=oxygen_min,
            oxygen_max=oxygen_max,
            humidity=self.parse_float(data.get('humidity')),
            is_temperature_abnormal=is_temp_abnormal,
            is_oxygen_abnormal=is_oxygen_abnormal
        )
        self.db.add(record)
    
    def _create_medication_plan(self, data: Dict):
        patient_id = data.get('patient_id')
        drug_name = data.get('drug_name')
        
        if not patient_id:
            raise ValueError("缺少patient_id字段")
        if not drug_name:
            raise ValueError("缺少drug_name字段")
        
        record = MedicationPlan(
            patient_id=str(patient_id),
            drug_name=str(drug_name),
            generic_name=data.get('generic_name'),
            dosage=data.get('dosage'),
            dosage_value=self.parse_float(data.get('dosage_value')),
            dosage_unit=data.get('dosage_unit'),
            route=data.get('route'),
            frequency=data.get('frequency'),
            start_time=self.parse_datetime(data.get('start_time')),
            end_time=self.parse_datetime(data.get('end_time')),
            prescribing_vet=data.get('prescribing_vet'),
            notes=data.get('notes')
        )
        self.db.add(record)
