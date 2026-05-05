import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json

from models import WaterproofTest


class WaterproofTestImporter:
    """防水测试记录导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    VALID_TEST_TYPES = ['dry', 'wet', 'pressure']
    VALID_RESULTS = ['pass', 'fail', 'conditional']
    
    def __init__(self):
        self.tests: List[WaterproofTest] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         work_order_id: Optional[str] = None,
                         test_date_column: str = 'test_date',
                         test_type_column: str = 'test_type',
                         pressure_column: Optional[str] = None,
                         duration_column: Optional[str] = None,
                         result_column: str = 'result',
                         leak_detected_column: Optional[str] = None,
                         leak_location_column: Optional[str] = None,
                         technician_column: Optional[str] = None,
                         equipment_column: Optional[str] = None,
                         notes_column: Optional[str] = None) -> List[WaterproofTest]:
        """
        从文件导入防水测试记录
        
        Args:
            file_path: 文件路径
            format_type: 文件格式，默认自动检测
            work_order_id: 关联工单ID
            test_date_column: 测试日期列名
            test_type_column: 测试类型列名
            pressure_column: 测试压力列名（可选）
            duration_column: 测试时长列名（可选）
            result_column: 测试结果列名
            leak_detected_column: 泄漏检测列名（可选）
            leak_location_column: 泄漏位置列名（可选）
            technician_column: 操作师傅列名（可选）
            equipment_column: 设备型号列名（可选）
            notes_column: 备注列名（可选）
        
        Returns:
            防水测试记录列表
        """
        self.tests = []
        self.errors = []
        
        if format_type is None:
            format_type = self._detect_format(file_path)
        
        if format_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {format_type}")
        
        try:
            df = self._read_file(file_path, format_type)
            self._parse_dataframe(
                df, work_order_id, test_date_column, test_type_column,
                pressure_column, duration_column, result_column,
                leak_detected_column, leak_location_column, technician_column,
                equipment_column, notes_column
            )
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.tests
    
    def _detect_format(self, file_path: str) -> str:
        """检测文件格式"""
        if file_path.endswith('.csv'):
            return 'csv'
        elif file_path.endswith('.json'):
            return 'json'
        elif file_path.endswith(('.xlsx', '.xls')):
            return 'excel'
        else:
            raise ValueError(f"无法检测文件格式: {file_path}")
    
    def _read_file(self, file_path: str, format_type: str) -> pd.DataFrame:
        """读取文件为DataFrame"""
        if format_type == 'csv':
            return pd.read_csv(file_path)
        elif format_type == 'json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            elif isinstance(data, dict):
                if 'tests' in data:
                    return pd.DataFrame(data['tests'])
                elif 'waterproof_tests' in data:
                    return pd.DataFrame(data['waterproof_tests'])
            raise ValueError("JSON格式不正确")
        elif format_type == 'excel':
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的格式: {format_type}")
    
    def _parse_dataframe(self, df: pd.DataFrame,
                         work_order_id: Optional[str],
                         test_date_column: str,
                         test_type_column: str,
                         pressure_column: Optional[str],
                         duration_column: Optional[str],
                         result_column: str,
                         leak_detected_column: Optional[str],
                         leak_location_column: Optional[str],
                         technician_column: Optional[str],
                         equipment_column: Optional[str],
                         notes_column: Optional[str]):
        """解析DataFrame为防水测试记录"""
        
        for idx, row in df.iterrows():
            try:
                test_date = datetime.now()
                if test_date_column in df.columns and not pd.isna(row[test_date_column]):
                    try:
                        if isinstance(row[test_date_column], datetime):
                            test_date = row[test_date_column]
                        else:
                            test_date = pd.to_datetime(row[test_date_column]).to_pydatetime()
                    except:
                        pass
                
                test_type = "pressure"
                if test_type_column in df.columns and not pd.isna(row[test_type_column]):
                    test_type_val = str(row[test_type_column]).lower()
                    if test_type_val in self.VALID_TEST_TYPES:
                        test_type = test_type_val
                    elif '干' in test_type_val:
                        test_type = 'dry'
                    elif '湿' in test_type_val or '水' in test_type_val:
                        test_type = 'wet'
                    elif '压力' in test_type_val or '气压' in test_type_val:
                        test_type = 'pressure'
                
                pressure_bar = None
                if pressure_column and pressure_column in df.columns:
                    if not pd.isna(row[pressure_column]):
                        try:
                            pressure_bar = float(row[pressure_column])
                        except:
                            pass
                
                duration_minutes = None
                if duration_column and duration_column in df.columns:
                    if not pd.isna(row[duration_column]):
                        try:
                            duration_minutes = int(row[duration_column])
                            if duration_minutes < 0:
                                duration_minutes = None
                        except:
                            pass
                
                result = "fail"
                if result_column in df.columns and not pd.isna(row[result_column]):
                    result_val = str(row[result_column]).lower()
                    if result_val in self.VALID_RESULTS:
                        result = result_val
                    elif '通过' in result_val or '合格' in result_val or 'pass' in result_val:
                        result = 'pass'
                    elif '失败' in result_val or '不合格' in result_val or 'fail' in result_val:
                        result = 'fail'
                    elif '条件' in result_val or 'conditional' in result_val:
                        result = 'conditional'
                
                leak_detected = False
                if leak_detected_column and leak_detected_column in df.columns:
                    if not pd.isna(row[leak_detected_column]):
                        leak_val = row[leak_detected_column]
                        if isinstance(leak_val, bool):
                            leak_detected = leak_val
                        elif isinstance(leak_val, str):
                            leak_val_lower = leak_val.lower()
                            leak_detected = leak_val_lower in ['true', 'yes', '是', '有', '1']
                        else:
                            try:
                                leak_detected = bool(int(leak_val))
                            except:
                                pass
                
                leak_location = None
                if leak_location_column and leak_location_column in df.columns:
                    if not pd.isna(row[leak_location_column]):
                        leak_location = str(row[leak_location_column])
                
                technician = None
                if technician_column and technician_column in df.columns:
                    if not pd.isna(row[technician_column]):
                        technician = str(row[technician_column])
                
                equipment_model = None
                if equipment_column and equipment_column in df.columns:
                    if not pd.isna(row[equipment_column]):
                        equipment_model = str(row[equipment_column])
                
                notes = None
                if notes_column and notes_column in df.columns:
                    if not pd.isna(row[notes_column]):
                        notes = str(row[notes_column])
                
                test = WaterproofTest(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    test_date=test_date,
                    test_type=test_type,
                    pressure_bar=pressure_bar,
                    duration_minutes=duration_minutes,
                    result=result,
                    leak_detected=leak_detected,
                    leak_location=leak_location,
                    technician=technician,
                    equipment_model=equipment_model,
                    notes=notes
                )
                self.tests.append(test)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行防水测试记录失败: {str(e)}")
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         work_order_id: Optional[str] = None) -> List[WaterproofTest]:
        """从字典列表导入防水测试记录"""
        self.tests = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                test_date = item.get('test_date')
                if test_date is None:
                    test_date = datetime.now()
                elif isinstance(test_date, str):
                    try:
                        test_date = datetime.fromisoformat(test_date)
                    except:
                        test_date = datetime.now()
                
                test_type = item.get('test_type', 'pressure')
                if isinstance(test_type, str):
                    test_type = test_type.lower()
                if test_type not in self.VALID_TEST_TYPES:
                    test_type = 'pressure'
                
                pressure_bar = item.get('pressure_bar')
                if pressure_bar is not None:
                    try:
                        pressure_bar = float(pressure_bar)
                    except:
                        pressure_bar = None
                
                duration_minutes = item.get('duration_minutes')
                if duration_minutes is not None:
                    try:
                        duration_minutes = int(duration_minutes)
                        if duration_minutes < 0:
                            duration_minutes = None
                    except:
                        duration_minutes = None
                
                result = item.get('result', 'fail')
                if isinstance(result, str):
                    result = result.lower()
                if result not in self.VALID_RESULTS:
                    if '通过' in result or '合格' in result:
                        result = 'pass'
                    elif '条件' in result:
                        result = 'conditional'
                    else:
                        result = 'fail'
                
                leak_detected = item.get('leak_detected', False)
                if isinstance(leak_detected, str):
                    leak_detected = leak_detected.lower() in ['true', 'yes', '是', '有', '1']
                
                leak_location = item.get('leak_location')
                technician = item.get('technician')
                equipment_model = item.get('equipment_model')
                notes = item.get('notes')
                
                test = WaterproofTest(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    test_date=test_date,
                    test_type=test_type,
                    pressure_bar=pressure_bar,
                    duration_minutes=duration_minutes,
                    result=result,
                    leak_detected=leak_detected,
                    leak_location=leak_location,
                    technician=technician,
                    equipment_model=equipment_model,
                    notes=notes
                )
                self.tests.append(test)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项防水测试记录失败: {str(e)}")
        
        return self.tests
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取防水测试统计信息"""
        if not self.tests:
            return {
                'test_count': 0,
                'pass_count': 0,
                'fail_count': 0,
                'conditional_count': 0,
                'leak_count': 0
            }
        
        pass_count = sum(1 for t in self.tests if t.result == 'pass')
        fail_count = sum(1 for t in self.tests if t.result == 'fail')
        conditional_count = sum(1 for t in self.tests if t.result == 'conditional')
        leak_count = sum(1 for t in self.tests if t.leak_detected)
        
        test_types: Dict[str, int] = {}
        for t in self.tests:
            test_types[t.test_type] = test_types.get(t.test_type, 0) + 1
        
        return {
            'test_count': len(self.tests),
            'pass_count': pass_count,
            'fail_count': fail_count,
            'conditional_count': conditional_count,
            'leak_count': leak_count,
            'pass_rate': (pass_count / len(self.tests) * 100) if self.tests else 0,
            'test_types': test_types
        }
