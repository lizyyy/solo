import csv
from typing import List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class PrescriptionData(BaseModel):
    prescription_id: str
    patient_id: str
    patient_name: str
    drug_name: str
    dose: float
    unit: str = "mg"
    prescription_time: datetime
    expected_prepare_time: datetime = None
    actual_prepare_time: datetime = None
    status: str = "pending"
    batch_number: str = None
    drug_id: str = None

    @field_validator('dose', mode='before')
    def parse_dose(cls, v):
        if isinstance(v, str):
            return float(v.strip())
        return v

    @field_validator('prescription_time', 'expected_prepare_time', 'actual_prepare_time', mode='before')
    def parse_datetime(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            v = v.strip()
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M',
                '%Y-%m-%d',
                '%Y/%m/%d %H:%M:%S',
                '%Y/%m/%d %H:%M',
                '%Y/%m/%d',
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期时间: {v}")
        return v


def parse_prescription_csv(csv_content: str) -> List[Dict[str, Any]]:
    lines = csv_content.strip().split('\n')
    reader = csv.DictReader(lines)
    
    prescriptions = []
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            data = {
                'prescription_id': row.get('处方编号', row.get('prescription_id', '')).strip(),
                'patient_id': row.get('患者ID', row.get('patient_id', '')).strip(),
                'patient_name': row.get('患者姓名', row.get('patient_name', '')).strip(),
                'drug_name': row.get('药品名称', row.get('drug_name', '')).strip(),
                'dose': row.get('剂量', row.get('dose', '0')).strip(),
                'unit': row.get('单位', row.get('unit', 'mg')).strip(),
                'prescription_time': row.get('开具时间', row.get('prescription_time', '')).strip(),
                'expected_prepare_time': row.get('预计调配时间', row.get('expected_prepare_time', '')).strip(),
                'actual_prepare_time': row.get('实际调配时间', row.get('actual_prepare_time', '')).strip(),
                'status': row.get('状态', row.get('status', 'pending')).strip(),
                'batch_number': row.get('批号', row.get('batch_number', '')).strip(),
                'drug_id': row.get('药品ID', row.get('drug_id', '')).strip(),
            }
            
            validated = PrescriptionData(**data)
            prescriptions.append(validated.model_dump())
        except Exception as e:
            errors.append({
                'row': row_num,
                'error': str(e),
                'data': row
            })
    
    return {
        'success': len(errors) == 0,
        'prescriptions': prescriptions,
        'errors': errors,
        'total': len(prescriptions) + len(errors)
    }
