import os
import pandas as pd
import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Tuple
from .storage import Storage
from .business import PropDepositManager
from .models import ProblemRecord


class DataImporter:
    def __init__(self, storage: Storage, manager: PropDepositManager):
        self.storage = storage
        self.manager = manager
    
    def _parse_excel_date(self, value: Any) -> str:
        if pd.isna(value):
            return ""
        if isinstance(value, (pd.Timestamp, datetime)):
            return value.date().isoformat()
        return str(value)
    
    def _parse_float(self, value: Any) -> float:
        if pd.isna(value) or value is None:
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def import_props_from_excel(self, file_path: str) -> Dict:
        result = {
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'problems': [],
            'errors': []
        }
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            raise ValueError(f"无法读取Excel文件: {e}")
        
        df = df.where(pd.notnull(df), None)
        
        for idx, row in df.iterrows():
            line_number = idx + 2
            data = row.to_dict()
            
            clean_data = {
                'prop_id': str(data.get('道具ID', '')) if data.get('道具ID') else '',
                'name': str(data.get('道具名称', '')) if data.get('道具名称') else '',
                'category': str(data.get('分类', '')) if data.get('分类') else '',
                'value': self._parse_float(data.get('价值')),
                'deposit_rate': self._parse_float(data.get('押金比例', 1.0)),
                'status': str(data.get('状态', '')) if data.get('状态') else 'available',
                'location': str(data.get('存放位置', '')) if data.get('存放位置') else '',
                'description': str(data.get('描述', '')) if data.get('描述') else ''
            }
            
            existing = self.storage.get_prop(clean_data['prop_id'])
            if existing:
                result['skipped'] += 1
                continue
            
            try:
                self.manager.create_prop(clean_data)
                result['success'] += 1
            except ValueError as e:
                problem = ProblemRecord(
                    problem_id=str(uuid.uuid4()),
                    source_file=file_path,
                    line_number=line_number,
                    data=clean_data,
                    error_type='prop_validation',
                    error_message=str(e)
                )
                self.storage.add_problem(problem)
                result['problems'].append({
                    'line': line_number,
                    'error': str(e)
                })
                result['failed'] += 1
        
        return result
    
    def import_borrows_from_excel(self, file_path: str) -> Dict:
        result = {
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'problems': [],
            'errors': []
        }
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            raise ValueError(f"无法读取Excel文件: {e}")
        
        df = df.where(pd.notnull(df), None)
        
        for idx, row in df.iterrows():
            line_number = idx + 2
            data = row.to_dict()
            
            clean_data = {
                'borrow_id': str(data.get('借用单ID', '')) if data.get('借用单ID') else '',
                'prop_id': str(data.get('道具ID', '')) if data.get('道具ID') else '',
                'crew_name': str(data.get('剧组名称', '')) if data.get('剧组名称') else '',
                'borrow_date': self._parse_excel_date(data.get('借用日期')),
                'scheduled_return_date': self._parse_excel_date(data.get('计划归还日期')),
                'deposit_paid': self._parse_float(data.get('已交押金'))
            }
            
            existing = self.storage.get_borrow(clean_data['borrow_id'])
            if existing:
                result['skipped'] += 1
                continue
            
            try:
                self.manager.create_borrow(clean_data)
                result['success'] += 1
            except ValueError as e:
                problem = ProblemRecord(
                    problem_id=str(uuid.uuid4()),
                    source_file=file_path,
                    line_number=line_number,
                    data=clean_data,
                    error_type='borrow_validation',
                    error_message=str(e)
                )
                self.storage.add_problem(problem)
                result['problems'].append({
                    'line': line_number,
                    'error': str(e)
                })
                result['failed'] += 1
        
        return result
    
    def import_returns_from_excel(self, file_path: str) -> Dict:
        result = {
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'problems': [],
            'errors': []
        }
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            raise ValueError(f"无法读取Excel文件: {e}")
        
        df = df.where(pd.notnull(df), None)
        
        for idx, row in df.iterrows():
            line_number = idx + 2
            data = row.to_dict()
            
            borrow_id = str(data.get('借用单ID', '')) if data.get('借用单ID') else ''
            actual_return = self._parse_excel_date(data.get('实际归还日期'))
            damage_level = str(data.get('损坏程度', 'none')) if data.get('损坏程度') else 'none'
            
            damage_level_map = {
                '无': 'none',
                '无损坏': 'none',
                '轻微': 'minor',
                '轻微损坏': 'minor',
                '严重': 'major',
                '严重损坏': 'major',
                '报废': 'total',
                '完全损坏': 'total'
            }
            
            damage_level = damage_level_map.get(damage_level.lower(), damage_level)
            damage_fee_override = self._parse_float(data.get('损坏费'))
            delay_fee_override = self._parse_float(data.get('延期费'))
            
            if not borrow_id:
                problem = ProblemRecord(
                    problem_id=str(uuid.uuid4()),
                    source_file=file_path,
                    line_number=line_number,
                    data={'error': '缺少借用单ID'},
                    error_type='return_validation',
                    error_message='缺少借用单ID'
                )
                self.storage.add_problem(problem)
                result['problems'].append({'line': line_number, 'error': '缺少借用单ID'})
                result['failed'] += 1
                continue
            
            borrow = self.storage.get_borrow(borrow_id)
            if not borrow:
                problem = ProblemRecord(
                    problem_id=str(uuid.uuid4()),
                    source_file=file_path,
                    line_number=line_number,
                    data={'borrow_id': borrow_id},
                    error_type='return_validation',
                    error_message=f'借用单不存在: {borrow_id}'
                )
                self.storage.add_problem(problem)
                result['problems'].append({'line': line_number, 'error': f'借用单不存在: {borrow_id}'})
                result['failed'] += 1
                continue
            
            if borrow.status in ['returned', 'settled']:
                result['skipped'] += 1
                continue
            
            try:
                from .models import DamageLevel
                self.manager.process_return(
                    borrow_id=borrow_id,
                    actual_return_date=date.fromisoformat(actual_return),
                    damage_level=DamageLevel(damage_level),
                    damage_fee_override=damage_fee_override if damage_fee_override > 0 else None,
                    delay_fee_override=delay_fee_override if delay_fee_override > 0 else None
                )
                result['success'] += 1
            except (ValueError, TypeError) as e:
                problem = ProblemRecord(
                    problem_id=str(uuid.uuid4()),
                    source_file=file_path,
                    line_number=line_number,
                    data={
                        'borrow_id': borrow_id,
                        'actual_return': actual_return,
                        'damage_level': damage_level
                    },
                    error_type='return_processing',
                    error_message=str(e)
                )
                self.storage.add_problem(problem)
                result['problems'].append({'line': line_number, 'error': str(e)})
                result['failed'] += 1
        
        return result
