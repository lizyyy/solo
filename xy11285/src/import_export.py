import io
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session

from src.models import Prescription, BatchOperation, BatchOperationItem
from src.services import BatchOperationService
from src.database import get_db


class ImportService:
    @staticmethod
    def read_excel(file_content: bytes) -> List[Dict[str, Any]]:
        df = pd.read_excel(io.BytesIO(file_content))
        df = df.where(pd.notnull(df), None)
        return df.to_dict('records')

    @staticmethod
    def read_csv(file_content: bytes) -> List[Dict[str, Any]]:
        df = pd.read_csv(io.BytesIO(file_content))
        df = df.where(pd.notnull(df), None)
        return df.to_dict('records')

    @staticmethod
    def parse_prescription_data(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        prescription_groups = {}

        for row in rows:
            key = (row.get('pet_name'), row.get('owner_name'), row.get('doctor_employee_id'))

            if key not in prescription_groups:
                prescription_groups[key] = {
                    'pet_name': row.get('pet_name'),
                    'owner_name': row.get('owner_name'),
                    'pet_weight': row.get('pet_weight'),
                    'weight_unit': row.get('weight_unit', 'kg'),
                    'species': row.get('species', ''),
                    'breed': row.get('breed', ''),
                    'owner_phone': row.get('owner_phone', ''),
                    'doctor_employee_id': row.get('doctor_employee_id'),
                    'diagnosis': row.get('diagnosis', ''),
                    'notes': row.get('notes', ''),
                    'created_by': row.get('created_by', 'import'),
                    'items': []
                }

            medicine_name = row.get('medicine_name')
            if medicine_name:
                prescription_groups[key]['items'].append({
                    'medicine_name': medicine_name,
                    'quantity': row.get('quantity'),
                    'administration_route': row.get('administration_route', ''),
                    'frequency': row.get('frequency', ''),
                    'duration': row.get('duration', '')
                })

        return list(prescription_groups.values())


class ExportService:
    @staticmethod
    def export_prescriptions_to_excel(prescriptions: List[Prescription]) -> bytes:
        data = []
        for prescription in prescriptions:
            for item in prescription.items:
                data.append({
                    '处方编号': prescription.prescription_no,
                    '宠物名称': prescription.pet.name if prescription.pet else '',
                    '宠物品类': prescription.pet.species if prescription.pet else '',
                    '宠物体重': prescription.pet.weight if prescription.pet else '',
                    '体重单位': prescription.pet.weight_unit if prescription.pet else '',
                    '主人姓名': prescription.pet.owner_name if prescription.pet else '',
                    '主人电话': prescription.pet.owner_phone if prescription.pet else '',
                    '医生姓名': prescription.doctor.name if prescription.doctor else '',
                    '医生工号': prescription.doctor.employee_id if prescription.doctor else '',
                    '诊断': prescription.diagnosis,
                    '状态': prescription.status.value,
                    '药品名称': item.medicine.name if item.medicine else '',
                    '剂量': item.calculated_dosage,
                    '单位': item.unit,
                    '数量': item.quantity,
                    '给药途径': item.administration_route,
                    '频次': item.frequency,
                    '持续时间': item.duration,
                    '剂量说明': item.dosage_notes,
                    '库存批号': item.inventory_batch.batch_number if item.inventory_batch else '',
                    '创建人': prescription.created_by,
                    '创建时间': prescription.created_at.strftime('%Y-%m-%d %H:%M:%S') if prescription.created_at else '',
                    '审核人': prescription.reviewed_by,
                    '审核时间': prescription.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if prescription.reviewed_at else '',
                    '发药人': prescription.dispensed_by,
                    '发药时间': prescription.dispensed_at.strftime('%Y-%m-%d %H:%M:%S') if prescription.dispensed_at else '',
                })

        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='处方明细')
        return output.getvalue()

    @staticmethod
    def export_batch_operations_to_excel(operations: List[BatchOperation],
                                         items: List[BatchOperationItem]) -> bytes:
        data = []
        for item in items:
            operation = next((o for o in operations if o.id == item.operation_id), None)
            if not operation:
                continue

            row_data = json.loads(item.row_data) if item.row_data else {}
            data.append({
                '操作编号': operation.operation_id,
                '操作类型': operation.operation_type,
                '操作状态': operation.status.value,
                '创建人': operation.created_by,
                '行号': item.row_index,
                '行状态': item.status,
                '错误类型': item.error_type.value if item.error_type else '',
                '错误信息': item.error_message,
                '记录ID': item.record_id,
                '重试次数': item.retry_count,
                '宠物名称': row_data.get('pet_name', ''),
                '主人姓名': row_data.get('owner_name', ''),
                '医生工号': row_data.get('doctor_employee_id', ''),
                '创建时间': item.created_at.strftime('%Y-%m-%d %H:%M:%S') if item.created_at else '',
            })

        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='批量操作明细')
        return output.getvalue()

    @staticmethod
    def export_prescriptions_to_csv(prescriptions: List[Prescription]) -> bytes:
        data = []
        for prescription in prescriptions:
            for item in prescription.items:
                data.append({
                    'prescription_no': prescription.prescription_no,
                    'pet_name': prescription.pet.name if prescription.pet else '',
                    'species': prescription.pet.species if prescription.pet else '',
                    'weight': prescription.pet.weight if prescription.pet else '',
                    'weight_unit': prescription.pet.weight_unit if prescription.pet else '',
                    'owner_name': prescription.pet.owner_name if prescription.pet else '',
                    'owner_phone': prescription.pet.owner_phone if prescription.pet else '',
                    'doctor_name': prescription.doctor.name if prescription.doctor else '',
                    'doctor_employee_id': prescription.doctor.employee_id if prescription.doctor else '',
                    'diagnosis': prescription.diagnosis,
                    'status': prescription.status.value,
                    'medicine_name': item.medicine.name if item.medicine else '',
                    'calculated_dosage': item.calculated_dosage,
                    'unit': item.unit,
                    'quantity': item.quantity,
                    'administration_route': item.administration_route,
                    'frequency': item.frequency,
                    'duration': item.duration,
                    'dosage_notes': item.dosage_notes,
                    'batch_number': item.inventory_batch.batch_number if item.inventory_batch else '',
                    'created_by': prescription.created_by,
                    'created_at': prescription.created_at.strftime('%Y-%m-%d %H:%M:%S') if prescription.created_at else '',
                    'reviewed_by': prescription.reviewed_by,
                    'reviewed_at': prescription.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if prescription.reviewed_at else '',
                    'dispensed_by': prescription.dispensed_by,
                    'dispensed_at': prescription.dispensed_at.strftime('%Y-%m-%d %H:%M:%S') if prescription.dispensed_at else '',
                })

        df = pd.DataFrame(data)
        output = io.BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        return output.getvalue()
