import csv
import json
import re
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal
from dataclasses import dataclass

from colorproof_checker.models import (
    ColorMeasurement, InkFormula, PaperBatch,
    DryingRecord, ProofTask, CustomerTolerance,
    ProofStatus, RiskLevel
)
from colorproof_checker.store import DataStore, parse_decimal, parse_datetime, parse_date


@dataclass
class ImportResult:
    success: bool
    message: str
    imported_count: int = 0
    errors: List[str] = None
    warnings: List[str] = None
    data_ids: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []
        if self.data_ids is None:
            self.data_ids = []


class DataValidator:
    @staticmethod
    def validate_color_measurement_data(data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        errors = []
        warnings = []
        
        required_fields = ['sample_name', 'batch_number', 'color_code', 'delta_e']
        
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"缺少必填字段: {field}")
        
        if 'delta_e' in data:
            try:
                delta_e = parse_decimal(data['delta_e'])
                if delta_e < 0:
                    errors.append("DeltaE 不能为负数")
                elif delta_e > 20:
                    warnings.append(f"DeltaE 值 {delta_e} 异常大，请检查数据")
            except:
                errors.append(f"DeltaE 值 '{data['delta_e']}' 格式无效")
        
        return len(errors) == 0, errors, warnings
    
    @staticmethod
    def validate_ink_formula_data(data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        errors = []
        warnings = []
        
        required_fields = ['color_code', 'color_name', 'customer_id', 'customer_name']
        
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"缺少必填字段: {field}")
        
        if 'base_inks' in data:
            if not isinstance(data['base_inks'], dict) or len(data['base_inks']) == 0:
                warnings.append("油墨配方基础油墨列表为空")
        
        return len(errors) == 0, errors, warnings
    
    @staticmethod
    def validate_paper_batch_data(data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        errors = []
        warnings = []
        
        required_fields = ['batch_number', 'paper_type', 'paper_name', 'grammage']
        
        for field in required_fields:
            if field not in data or data[field] is None:
                errors.append(f"缺少必填字段: {field}")
        
        if 'grammage' in data:
            try:
                grammage = int(data['grammage'])
                if grammage <= 0:
                    errors.append("纸张克重必须大于0")
            except:
                errors.append(f"纸张克重 '{data['grammage']}' 格式无效")
        
        if 'expiry_date' in data and data['expiry_date']:
            try:
                expiry = parse_date(data['expiry_date'])
                if expiry and expiry < date.today():
                    warnings.append(f"纸张批次已过期 (有效期至 {expiry})")
            except:
                warnings.append(f"有效期格式可能无效: {data['expiry_date']}")
        
        return len(errors) == 0, errors, warnings
    
    @staticmethod
    def validate_drying_record_data(data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        errors = []
        warnings = []
        
        required_fields = ['proof_id', 'batch_number', 'print_time', 'drying_start_time']
        
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"缺少必填字段: {field}")
        
        try:
            print_time = parse_datetime(data.get('print_time'))
            drying_start = parse_datetime(data.get('drying_start_time'))
            if print_time and drying_start and drying_start < print_time:
                errors.append("干燥开始时间不能早于印刷时间")
        except:
            warnings.append("时间格式可能无效")
        
        return len(errors) == 0, errors, warnings


class DataImporter:
    def __init__(self, store: DataStore):
        self.store = store
        self.validator = DataValidator()
    
    def import_color_measurement_csv(self, filepath: str) -> ImportResult:
        path = Path(filepath)
        if not path.exists():
            return ImportResult(
                success=False,
                message=f"文件不存在: {filepath}"
            )
        
        result = ImportResult(
            success=True,
            message=f"开始导入色差数据: {path.name}"
        )
        
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    processed_row = self._normalize_csv_row(row)
                    
                    valid, errors, warnings = self.validator.validate_color_measurement_data(processed_row)
                    
                    if warnings:
                        w = [f"第{row_num}行: {warn}" for warn in warnings]
                        result.warnings.extend(w)
                    
                    if not valid:
                        err = [f"第{row_num}行: {e}" for e in errors]
                        result.errors.extend(err)
                        continue
                    
                    try:
                        measurement = self._row_to_color_measurement(processed_row)
                        mid = self.store.save_color_measurement(measurement)
                        result.data_ids.append(mid)
                        result.imported_count += 1
                    except Exception as e:
                        result.errors.append(f"第{row_num}行: 保存失败 - {str(e)}")
        
        except Exception as e:
            result.success = False
            result.message = f"读取文件失败: {str(e)}"
        
        if result.errors:
            result.success = False
            result.message = f"导入完成，{result.imported_count} 条成功，{len(result.errors)} 条失败"
        else:
            result.message = f"成功导入 {result.imported_count} 条色差数据"
        
        return result
    
    def import_ink_formula_json(self, filepath: str) -> ImportResult:
        path = Path(filepath)
        if not path.exists():
            return ImportResult(
                success=False,
                message=f"文件不存在: {filepath}"
            )
        
        result = ImportResult(
            success=True,
            message=f"开始导入油墨配方: {path.name}"
        )
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                formulas = data
            elif isinstance(data, dict):
                if 'formulas' in data:
                    formulas = data['formulas']
                else:
                    formulas = [data]
            else:
                return ImportResult(
                    success=False,
                    message=f"无效的JSON格式"
                )
            
            for idx, formula_data in enumerate(formulas):
                valid, errors, warnings = self.validator.validate_ink_formula_data(formula_data)
                
                if warnings:
                    w = [f"配方{idx+1}: {w}" for w in warnings]
                    result.warnings.extend(w)
                
                if not valid:
                    err = [f"配方{idx+1}: {e}" for e in errors]
                    result.errors.extend(err)
                    continue
                
                try:
                    formula = self._dict_to_ink_formula(formula_data)
                    fid = self.store.save_ink_formula(formula)
                    result.data_ids.append(fid)
                    result.imported_count += 1
                except Exception as e:
                    result.errors.append(f"配方{idx+1}: 保存失败 - {str(e)}")
        
        except Exception as e:
            result.success = False
            result.message = f"读取文件失败: {str(e)}"
        
        if result.errors:
            result.success = False
            result.message = f"导入完成，{result.imported_count} 条成功，{len(result.errors)} 条失败"
        else:
            result.message = f"成功导入 {result.imported_count} 条油墨配方"
        
        return result
    
    def import_paper_batch_csv(self, filepath: str) -> ImportResult:
        path = Path(filepath)
        if not path.exists():
            return ImportResult(
                success=False,
                message=f"文件不存在: {filepath}"
            )
        
        result = ImportResult(
            success=True,
            message=f"开始导入纸张批次: {path.name}"
        )
        
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    processed_row = self._normalize_csv_row(row)
                    
                    valid, errors, warnings = self.validator.validate_paper_batch_data(processed_row)
                    
                    if warnings:
                        w = [f"第{row_num}行: {w}" for w in warnings]
                        result.warnings.extend(w)
                    
                    if not valid:
                        err = [f"第{row_num}行: {e}" for e in errors]
                        result.errors.extend(err)
                        continue
                    
                    try:
                        batch = self._row_to_paper_batch(processed_row)
                        bid = self.store.save_paper_batch(batch)
                        result.data_ids.append(bid)
                        result.imported_count += 1
                    except Exception as e:
                        result.errors.append(f"第{row_num}行: 保存失败 - {str(e)}")
        
        except Exception as e:
            result.success = False
            result.message = f"读取文件失败: {str(e)}"
        
        if result.errors:
            result.success = False
            result.message = f"导入完成，{result.imported_count} 条成功，{len(result.errors)} 条失败"
        else:
            result.message = f"成功导入 {result.imported_count} 条纸张批次"
        
        return result
    
    def import_drying_record_csv(self, filepath: str) -> ImportResult:
        path = Path(filepath)
        if not path.exists():
            return ImportResult(
                success=False,
                message=f"文件不存在: {filepath}"
            )
        
        result = ImportResult(
            success=True,
            message=f"开始导入干燥记录: {path.name}"
        )
        
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    processed_row = self._normalize_csv_row(row)
                    
                    valid, errors, warnings = self.validator.validate_drying_record_data(processed_row)
                    
                    if warnings:
                        w = [f"第{row_num}行: {w}" for w in warnings]
                        result.warnings.extend(w)
                    
                    if not valid:
                        err = [f"第{row_num}行: {e}" for e in errors]
                        result.errors.extend(err)
                        continue
                    
                    try:
                        record = self._row_to_drying_record(processed_row)
                        rid = self.store.save_drying_record(record)
                        result.data_ids.append(rid)
                        result.imported_count += 1
                    except Exception as e:
                        result.errors.append(f"第{row_num}行: 保存失败 - {str(e)}")
        
        except Exception as e:
            result.success = False
            result.message = f"读取文件失败: {str(e)}"
        
        if result.errors:
            result.success = False
            result.message = f"导入完成，{result.imported_count} 条成功，{len(result.errors)} 条失败"
        else:
            result.message = f"成功导入 {result.imported_count} 条干燥记录"
        
        return result
    
    def _normalize_csv_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        result = {}
        for key, value in row.items():
            if key:
                normalized_key = self._normalize_key(key)
                if value:
                    result[normalized_key] = value.strip()
                else:
                    result[normalized_key] = None
        return result
    
    def _normalize_key(self, key: str) -> str:
        key = key.strip().lower()
        key = re.sub(r'[\s\-_]+', '_', key)
        mappings = {
            'deltae': 'delta_e',
            'deltal': 'delta_l',
            'deltaa': 'delta_a',
            'deltab': 'delta_b',
            'deltac': 'delta_c',
            'deltah': 'delta_h',
            'l_star': 'lab_l',
            'a_star': 'lab_a',
            'b_star': 'lab_b',
            'color': 'color_code',
            'colour': 'color_code',
            'batch': 'batch_number',
            'batch_no': 'batch_number',
            'sample': 'sample_name',
            'meas_time': 'measurement_date',
            'meas_date': 'measurement_date',
            'gramage': 'grammage',
            'weight': 'grammage',
            'expiry': 'expiry_date',
            'expire': 'expiry_date',
            'manu_date': 'manufacture_date',
            'received': 'received_date',
            'print': 'print_time',
            'drying_start': 'drying_start_time',
            'drying_end': 'drying_end_time',
            'start_drying': 'drying_start_time',
            'end_drying': 'drying_end_time',
            'temp': 'drying_temperature',
            'humidity': 'drying_humidity',
            'hum': 'drying_humidity',
            'coating': 'coating_type',
            'operator': 'operator_name',
            'visual': 'visual_check_result',
            'touch': 'touch_check_result',
        }
        return mappings.get(key, key)
    
    def _row_to_color_measurement(self, row: Dict[str, Any]) -> ColorMeasurement:
        return ColorMeasurement(
            id=None,
            sample_name=row.get('sample_name', ''),
            batch_number=row.get('batch_number', ''),
            color_code=row.get('color_code', ''),
            delta_e=parse_decimal(row.get('delta_e', 0)),
            delta_l=parse_decimal(row['delta_l']) if row.get('delta_l') else None,
            delta_a=parse_decimal(row['delta_a']) if row.get('delta_a') else None,
            delta_b=parse_decimal(row['delta_b']) if row.get('delta_b') else None,
            delta_c=parse_decimal(row['delta_c']) if row.get('delta_c') else None,
            delta_h=parse_decimal(row['delta_h']) if row.get('delta_h') else None,
            lab_l=parse_decimal(row['lab_l']) if row.get('lab_l') else None,
            lab_a=parse_decimal(row['lab_a']) if row.get('lab_a') else None,
            lab_b=parse_decimal(row['lab_b']) if row.get('lab_b') else None,
            measurement_date=parse_datetime(row.get('measurement_date')),
            notes=row.get('notes')
        )
    
    def _dict_to_ink_formula(self, data: Dict[str, Any]) -> InkFormula:
        base_inks = {}
        if 'base_inks' in data:
            for k, v in data['base_inks'].items():
                base_inks[k] = parse_decimal(v)
        
        return InkFormula(
            id=None,
            color_code=data.get('color_code', ''),
            color_name=data.get('color_name', ''),
            customer_id=data.get('customer_id', ''),
            customer_name=data.get('customer_name', ''),
            pantone_code=data.get('pantone_code'),
            base_inks=base_inks,
            total_weight=parse_decimal(data.get('total_weight', '100')),
            viscosity=parse_decimal(data['viscosity']) if data.get('viscosity') else None,
            ph_value=parse_decimal(data['ph_value']) if data.get('ph_value') else None,
            create_date=parse_date(data.get('create_date')),
            notes=data.get('notes')
        )
    
    def _row_to_paper_batch(self, row: Dict[str, Any]) -> PaperBatch:
        grammage = 0
        if row.get('grammage'):
            try:
                grammage = int(str(row['grammage']).strip())
            except:
                pass
        
        width = None
        if row.get('width'):
            try:
                width = int(str(row['width']).strip())
            except:
                pass
        
        length = None
        if row.get('length'):
            try:
                length = int(str(row['length']).strip())
            except:
                pass
        
        return PaperBatch(
            id=None,
            batch_number=row.get('batch_number', ''),
            paper_type=row.get('paper_type', ''),
            paper_name=row.get('paper_name', ''),
            grammage=grammage,
            width=width,
            length=length,
            supplier=row.get('supplier'),
            manufacture_date=parse_date(row.get('manufacture_date')),
            expiry_date=parse_date(row.get('expiry_date')),
            received_date=parse_date(row.get('received_date')),
            total_quantity=parse_decimal(row['total_quantity']) if row.get('total_quantity') else None,
            used_quantity=parse_decimal(row['used_quantity']) if row.get('used_quantity') else None,
            warehouse_location=row.get('warehouse_location'),
            notes=row.get('notes')
        )
    
    def _row_to_drying_record(self, row: Dict[str, Any]) -> DryingRecord:
        visual_check = None
        if row.get('visual_check_result'):
            val = str(row['visual_check_result']).lower().strip()
            visual_check = val in ['yes', 'y', 'true', '1', 'pass', '通过', '合格']
        
        touch_check = None
        if row.get('touch_check_result'):
            val = str(row['touch_check_result']).lower().strip()
            touch_check = val in ['yes', 'y', 'true', '1', 'pass', '通过', '合格']
        
        return DryingRecord(
            id=None,
            proof_id=row.get('proof_id', ''),
            batch_number=row.get('batch_number', ''),
            print_time=parse_datetime(row.get('print_time')) or datetime.now(),
            drying_start_time=parse_datetime(row.get('drying_start_time')) or datetime.now(),
            drying_end_time=parse_datetime(row.get('drying_end_time')),
            drying_method=row.get('drying_method', '自然晾干'),
            drying_temperature=parse_decimal(row['drying_temperature']) if row.get('drying_temperature') else None,
            drying_humidity=parse_decimal(row['drying_humidity']) if row.get('drying_humidity') else None,
            coating_type=row.get('coating_type'),
            coating_amount=parse_decimal(row['coating_amount']) if row.get('coating_amount') else None,
            operator_name=row.get('operator_name'),
            visual_check_result=visual_check,
            touch_check_result=touch_check,
            notes=row.get('notes')
        )
