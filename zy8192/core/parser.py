import csv
import json
import re
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

import yaml
from dateutil.parser import parse as date_parse

from core.models import (
    Case, VitalSign, DrugAdministration, DrugRule, 
    Species, WeightUnit, CaseData
)


class Parser:
    
    DATETIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%H:%M:%S",
        "%H:%M",
    ]
    
    @staticmethod
    def parse_datetime(
        value: str, 
        base_date: Optional[date] = None,
        assume_past: bool = True
    ) -> datetime:
        value = value.strip()
        
        if not base_date:
            base_date = date.today()
        
        try:
            for fmt in Parser.DATETIME_FORMATS:
                try:
                    parsed = datetime.strptime(value, fmt)
                    
                    if parsed.year == 1900:
                        parsed = datetime(
                            base_date.year,
                            base_date.month,
                            base_date.day,
                            parsed.hour,
                            parsed.minute,
                            parsed.second
                        )
                    
                    return parsed
                except ValueError:
                    continue
        except Exception:
            pass
        
        try:
            parsed = date_parse(value, fuzzy=True)
            if parsed.year == datetime.now().year and parsed.month == 1 and parsed.day == 1:
                if ':' in value:
                    time_part = parsed.time()
                    parsed = datetime(
                        base_date.year,
                        base_date.month,
                        base_date.day,
                        time_part.hour,
                        time_part.minute,
                        time_part.second
                    )
            return parsed
        except Exception:
            raise ValueError(f"无法解析日期时间: {value}")
    
    @staticmethod
    def parse_weight(value: str) -> Tuple[float, WeightUnit]:
        value = value.strip().lower()
        
        unit = WeightUnit.KG
        if 'lb' in value or 'lbs' in value or '磅' in value:
            unit = WeightUnit.LB
            value = value.replace('lb', '').replace('lbs', '').replace('磅', '').strip()
        elif 'kg' in value or '公斤' in value:
            value = value.replace('kg', '').replace('公斤', '').strip()
        
        value = value.replace(',', '')
        match = re.search(r'[\d.]+', value)
        if match:
            weight = float(match.group())
            return weight, unit
        
        raise ValueError(f"无法解析体重: {value}")
    
    @staticmethod
    def parse_float(value: str) -> Optional[float]:
        if value is None or value == '' or value.lower() in ('na', 'n/a', 'null', 'none', '--'):
            return None
        try:
            return float(value.replace(',', '').strip())
        except (ValueError, AttributeError):
            return None
    
    @staticmethod
    def parse_species(value: str) -> Species:
        value = value.strip().lower()
        if value in ('dog', '犬', '狗', 'canine'):
            return Species.DOG
        elif value in ('cat', '猫', 'feline'):
            return Species.CAT
        raise ValueError(f"未知物种: {value}")


class CSVParser(Parser):
    
    @staticmethod
    def parse_cases(file_path: str) -> List[Case]:
        cases = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"病例文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                row = {k.strip(): v for k, v in row.items()}
                
                case_id = row.get('case_id', row.get('病例ID', ''))
                patient_name = row.get('patient_name', row.get('动物姓名', ''))
                
                species_str = row.get('species', row.get('物种', ''))
                species = CSVParser.parse_species(species_str)
                
                weight_str = row.get('weight', row.get('体重', '0'))
                weight, weight_unit = CSVParser.parse_weight(weight_str)
                
                surgery_type = row.get('surgery_type', row.get('手术类型', ''))
                anesthesiologist = row.get('anesthesiologist', row.get('麻醉师', ''))
                
                start_str = row.get('start_time', row.get('开始时间', ''))
                end_str = row.get('end_time', row.get('结束时间', ''))
                notes = row.get('notes', row.get('备注', ''))
                
                start_time = CSVParser.parse_datetime(start_str) if start_str else datetime.now()
                
                end_time = None
                if end_str:
                    end_time = CSVParser.parse_datetime(end_str)
                    if end_time < start_time:
                        end_time += timedelta(days=1)
                
                case = Case(
                    case_id=case_id,
                    patient_name=patient_name,
                    species=species,
                    weight=weight,
                    weight_unit=weight_unit,
                    surgery_type=surgery_type,
                    start_time=start_time,
                    end_time=end_time,
                    anesthesiologist=anesthesiologist,
                    notes=notes
                )
                cases.append(case)
        
        return cases


class JSONLParser(Parser):
    
    @staticmethod
    def parse_vitals(file_path: str, case_start_time: Optional[datetime] = None) -> List[VitalSign]:
        vitals = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"生命体征文件不存在: {file_path}")
        
        base_date = case_start_time.date() if case_start_time else date.today()
        first_timestamp = None
        
        with open(path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"第{line_num}行JSON解析错误: {e}")
                
                ts_value = data.get('timestamp', data.get('time', ''))
                if isinstance(ts_value, str):
                    timestamp = JSONLParser.parse_datetime(ts_value, base_date)
                elif isinstance(ts_value, (int, float)):
                    timestamp = datetime.fromtimestamp(ts_value)
                else:
                    timestamp = datetime.now()
                
                if first_timestamp is None:
                    first_timestamp = timestamp
                elif timestamp < first_timestamp:
                    timestamp += timedelta(days=1)
                
                vital = VitalSign(
                    timestamp=timestamp,
                    heart_rate=JSONLParser.parse_float(str(data.get('heart_rate', data.get('hr', data.get('心率'))))),
                    respiratory_rate=JSONLParser.parse_float(str(data.get('respiratory_rate', data.get('rr', data.get('呼吸频率'))))),
                    systolic_bp=JSONLParser.parse_float(str(data.get('systolic_bp', data.get('sbp', data.get('收缩压'))))),
                    diastolic_bp=JSONLParser.parse_float(str(data.get('diastolic_bp', data.get('dbp', data.get('舒张压'))))),
                    mean_bp=JSONLParser.parse_float(str(data.get('mean_bp', data.get('map', data.get('平均压'))))),
                    temperature=JSONLParser.parse_float(str(data.get('temperature', data.get('temp', data.get('体温'))))),
                    spo2=JSONLParser.parse_float(str(data.get('spo2', data.get('血氧饱和度')))),
                    etco2=JSONLParser.parse_float(str(data.get('etco2', data.get('呼气末二氧化碳')))),
                    source=data.get('source', 'monitor')
                )
                vitals.append(vital)
        
        return vitals


class YAMLParser(Parser):
    
    @staticmethod
    def parse_drug_rules(file_path: str) -> List[DrugRule]:
        rules = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"药物规则文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            return rules
        
        drugs = data.get('drugs', [])
        
        for item in drugs:
            species_list = item.get('species', ['dog', 'cat'])
            if not isinstance(species_list, list):
                species_list = [species_list]
            
            for species_str in species_list:
                species = YAMLParser.parse_species(species_str)
                
                rule = DrugRule(
                    drug_name=item.get('name', item.get('drug_name', '')),
                    species=species,
                    min_dose_per_kg=float(item.get('min_dose_per_kg', item.get('min', 0))),
                    max_dose_per_kg=float(item.get('max_dose_per_kg', item.get('max', float('inf')))),
                    dose_unit=item.get('unit', item.get('dose_unit', 'mg')),
                    route=item.get('route', ''),
                    notes=item.get('notes', '')
                )
                rules.append(rule)
        
        return rules
    
    @staticmethod
    def parse_drug_administrations(file_path: str, base_date: Optional[date] = None) -> List[DrugAdministration]:
        administrations = []
        path = Path(file_path)
        
        if not path.exists():
            return administrations
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            return administrations
        
        items = data.get('administrations', data.get('drugs', []))
        
        for item in items:
            ts_value = item.get('time', item.get('timestamp', ''))
            timestamp = YAMLParser.parse_datetime(ts_value, base_date) if ts_value else datetime.now()
            
            dose_value = item.get('dose', 0)
            if isinstance(dose_value, str):
                dose, _ = YAMLParser.parse_weight(dose_value)
            else:
                dose = float(dose_value)
            
            admin = DrugAdministration(
                timestamp=timestamp,
                drug_name=item.get('name', item.get('drug_name', '')),
                dose=dose,
                dose_unit=item.get('unit', item.get('dose_unit', 'mg')),
                route=item.get('route', ''),
                notes=item.get('notes', '')
            )
            administrations.append(admin)
        
        return administrations
