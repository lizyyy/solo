import json
import csv
from datetime import datetime, date
from typing import List
from pathlib import Path
import pandas as pd

from .models import (
    MaterialBatch,
    SterilizationRecord,
    Patient,
    TreatmentItem,
    UsageRecord
)


class DataLoader:
    DATE_FORMATS = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%Y%m%d',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S'
    ]

    @staticmethod
    def parse_date(date_str: str) -> date:
        if not date_str or not date_str.strip():
            return None
        
        date_str = date_str.strip()
        for fmt in DataLoader.DATE_FORMATS:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    @staticmethod
    def parse_datetime(datetime_str: str) -> datetime:
        if not datetime_str or not datetime_str.strip():
            return None
        
        datetime_str = datetime_str.strip()
        for fmt in DataLoader.DATE_FORMATS:
            try:
                return datetime.strptime(datetime_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间: {datetime_str}")

    @staticmethod
    def load_batches_from_csv(file_path: str) -> List[MaterialBatch]:
        batches = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    batch = MaterialBatch(
                        batch_id=row.get('批次号', row.get('batch_id', '')),
                        material_name=row.get('耗材名称', row.get('material_name', '')),
                        material_type=row.get('耗材类型', row.get('material_type', '')),
                        manufacturer=row.get('生产厂家', row.get('manufacturer', '')),
                        production_date=DataLoader.parse_date(row.get('生产日期', row.get('production_date', ''))),
                        expiration_date=DataLoader.parse_date(row.get('有效期', row.get('expiration_date', ''))),
                        initial_quantity=int(row.get('初始数量', row.get('initial_quantity', 0)) or 0),
                        received_date=DataLoader.parse_date(row.get('入库日期', row.get('received_date', '')) or ''),
                        supplier=row.get('供应商', row.get('supplier')),
                        notes=row.get('备注', row.get('notes'))
                    )
                    batches.append(batch)
                except Exception as e:
                    raise ValueError(f"解析批次数据失败: {str(e)}, 行数据: {row}")
        return batches

    @staticmethod
    def load_sterilizations_from_csv(file_path: str) -> List[SterilizationRecord]:
        records = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    record = SterilizationRecord(
                        sterilization_id=row.get('灭菌记录ID', row.get('sterilization_id', '')),
                        batch_id=row.get('批次号', row.get('batch_id', '')),
                        sterilization_date=DataLoader.parse_datetime(row.get('灭菌日期', row.get('sterilization_date', '')) or ''),
                        expiration_date=DataLoader.parse_datetime(row.get('灭菌有效期', row.get('expiration_date', '')) or ''),
                        sterilization_method=row.get('灭菌方式', row.get('sterilization_method', '')),
                        operator=row.get('操作人员', row.get('operator', '')),
                        sterilizer_id=row.get('灭菌器编号', row.get('sterilizer_id')),
                        temperature=float(row.get('温度', row.get('temperature'))) if row.get('温度') or row.get('temperature') else None,
                        duration=int(row.get('时长', row.get('duration'))) if row.get('时长') or row.get('duration') else None,
                        indicator_result=row.get('指示剂结果', row.get('indicator_result')),
                        notes=row.get('备注', row.get('notes'))
                    )
                    records.append(record)
                except Exception as e:
                    raise ValueError(f"解析灭菌记录失败: {str(e)}, 行数据: {row}")
        return records

    @staticmethod
    def load_patients_from_csv(file_path: str) -> List[Patient]:
        patients = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    patient = Patient(
                        patient_id=row.get('患者ID', row.get('patient_id', '')),
                        name=row.get('姓名', row.get('name', '')),
                        gender=row.get('性别', row.get('gender')),
                        age=int(row.get('年龄', row.get('age'))) if row.get('年龄') or row.get('age') else None,
                        phone=row.get('电话', row.get('phone')),
                        id_card=row.get('身份证号', row.get('id_card')),
                        registration_date=DataLoader.parse_date(row.get('建档日期', row.get('registration_date', '')) or ''),
                        notes=row.get('备注', row.get('notes'))
                    )
                    patients.append(patient)
                except Exception as e:
                    raise ValueError(f"解析患者数据失败: {str(e)}, 行数据: {row}")
        return patients

    @staticmethod
    def load_treatments_from_csv(file_path: str) -> List[TreatmentItem]:
        treatments = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    treatment = TreatmentItem(
                        treatment_id=row.get('治疗项目ID', row.get('treatment_id', '')),
                        patient_id=row.get('患者ID', row.get('patient_id', '')),
                        treatment_date=DataLoader.parse_datetime(row.get('治疗日期', row.get('treatment_date', '')) or ''),
                        treatment_type=row.get('治疗类型', row.get('treatment_type', '')),
                        dentist=row.get('主治医生', row.get('dentist', '')),
                        assistant=row.get('助手', row.get('assistant')),
                        chair_no=row.get('牙椅号', row.get('chair_no')),
                        diagnosis=row.get('诊断', row.get('diagnosis')),
                        notes=row.get('备注', row.get('notes'))
                    )
                    treatments.append(treatment)
                except Exception as e:
                    raise ValueError(f"解析治疗项目失败: {str(e)}, 行数据: {row}")
        return treatments

    @staticmethod
    def load_usages_from_csv(file_path: str) -> List[UsageRecord]:
        usages = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    usage = UsageRecord(
                        usage_id=row.get('使用记录ID', row.get('usage_id', '')),
                        treatment_id=row.get('治疗项目ID', row.get('treatment_id', '')),
                        batch_id=row.get('批次号', row.get('batch_id', '')),
                        usage_date=DataLoader.parse_datetime(row.get('使用日期', row.get('usage_date', '')) or ''),
                        quantity=int(row.get('使用数量', row.get('quantity', 1)) or 1),
                        used_by=row.get('使用人', row.get('used_by', '')),
                        notes=row.get('备注', row.get('notes'))
                    )
                    usages.append(usage)
                except Exception as e:
                    raise ValueError(f"解析使用记录失败: {str(e)}, 行数据: {row}")
        return usages

    @staticmethod
    def load_from_excel(file_path: str, engine):
        xls = pd.ExcelFile(file_path)
        
        if '耗材批次' in xls.sheet_names or 'batches' in xls.sheet_names:
            sheet_name = '耗材批次' if '耗材批次' in xls.sheet_names else 'batches'
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [str(c).strip() for c in df.columns]
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                try:
                    batch = MaterialBatch(
                        batch_id=str(row_dict.get('批次号', row_dict.get('batch_id', ''))),
                        material_name=str(row_dict.get('耗材名称', row_dict.get('material_name', ''))),
                        material_type=str(row_dict.get('耗材类型', row_dict.get('material_type', ''))),
                        manufacturer=str(row_dict.get('生产厂家', row_dict.get('manufacturer', ''))),
                        initial_quantity=int(row_dict.get('初始数量', row_dict.get('initial_quantity', 0)) or 0),
                        received_date=pd.to_datetime(row_dict.get('入库日期', row_dict.get('received_date'))).date() if pd.notna(row_dict.get('入库日期', row_dict.get('received_date'))) else None,
                        supplier=str(row_dict.get('供应商', row_dict.get('supplier'))) if pd.notna(row_dict.get('供应商', row_dict.get('supplier'))) else None,
                        notes=str(row_dict.get('备注', row_dict.get('notes'))) if pd.notna(row_dict.get('备注', row_dict.get('notes'))) else None
                    )
                    engine.load_batch(batch)
                except Exception as e:
                    print(f"警告: 跳过无效批次数据: {str(e)}")

        if '灭菌记录' in xls.sheet_names or 'sterilizations' in xls.sheet_names:
            sheet_name = '灭菌记录' if '灭菌记录' in xls.sheet_names else 'sterilizations'
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [str(c).strip() for c in df.columns]
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                try:
                    record = SterilizationRecord(
                        sterilization_id=str(row_dict.get('灭菌记录ID', row_dict.get('sterilization_id', ''))),
                        batch_id=str(row_dict.get('批次号', row_dict.get('batch_id', ''))),
                        sterilization_date=pd.to_datetime(row_dict.get('灭菌日期', row_dict.get('sterilization_date'))),
                        expiration_date=pd.to_datetime(row_dict.get('灭菌有效期', row_dict.get('expiration_date'))),
                        sterilization_method=str(row_dict.get('灭菌方式', row_dict.get('sterilization_method', ''))),
                        operator=str(row_dict.get('操作人员', row_dict.get('operator', '')))
                    )
                    engine.load_sterilization(record)
                except Exception as e:
                    print(f"警告: 跳过无效灭菌记录: {str(e)}")

        if '患者信息' in xls.sheet_names or 'patients' in xls.sheet_names:
            sheet_name = '患者信息' if '患者信息' in xls.sheet_names else 'patients'
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [str(c).strip() for c in df.columns]
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                try:
                    patient = Patient(
                        patient_id=str(row_dict.get('患者ID', row_dict.get('patient_id', ''))),
                        name=str(row_dict.get('姓名', row_dict.get('name', ''))),
                        gender=str(row_dict.get('性别', row_dict.get('gender'))) if pd.notna(row_dict.get('性别', row_dict.get('gender'))) else None,
                        registration_date=pd.to_datetime(row_dict.get('建档日期', row_dict.get('registration_date'))).date() if pd.notna(row_dict.get('建档日期', row_dict.get('registration_date'))) else None
                    )
                    engine.load_patient(patient)
                except Exception as e:
                    print(f"警告: 跳过无效患者数据: {str(e)}")

        if '治疗项目' in xls.sheet_names or 'treatments' in xls.sheet_names:
            sheet_name = '治疗项目' if '治疗项目' in xls.sheet_names else 'treatments'
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [str(c).strip() for c in df.columns]
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                try:
                    treatment = TreatmentItem(
                        treatment_id=str(row_dict.get('治疗项目ID', row_dict.get('treatment_id', ''))),
                        patient_id=str(row_dict.get('患者ID', row_dict.get('patient_id', ''))),
                        treatment_date=pd.to_datetime(row_dict.get('治疗日期', row_dict.get('treatment_date'))),
                        treatment_type=str(row_dict.get('治疗类型', row_dict.get('treatment_type', ''))),
                        dentist=str(row_dict.get('主治医生', row_dict.get('dentist', '')))
                    )
                    engine.load_treatment(treatment)
                except Exception as e:
                    print(f"警告: 跳过无效治疗项目: {str(e)}")

        if '使用记录' in xls.sheet_names or 'usages' in xls.sheet_names:
            sheet_name = '使用记录' if '使用记录' in xls.sheet_names else 'usages'
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [str(c).strip() for c in df.columns]
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                try:
                    usage = UsageRecord(
                        usage_id=str(row_dict.get('使用记录ID', row_dict.get('usage_id', ''))),
                        treatment_id=str(row_dict.get('治疗项目ID', row_dict.get('treatment_id', ''))),
                        batch_id=str(row_dict.get('批次号', row_dict.get('batch_id', ''))),
                        usage_date=pd.to_datetime(row_dict.get('使用日期', row_dict.get('usage_date'))),
                        quantity=int(row_dict.get('使用数量', row_dict.get('quantity', 1)) or 1),
                        used_by=str(row_dict.get('使用人', row_dict.get('used_by', '')))
                    )
                    engine.load_usage(usage)
                except Exception as e:
                    print(f"警告: 跳过无效使用记录: {str(e)}")
