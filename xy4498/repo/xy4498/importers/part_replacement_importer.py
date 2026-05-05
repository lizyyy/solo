import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json

from models import PartReplacement


class PartReplacementImporter:
    """零件更换记录导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    def __init__(self):
        self.replacements: List[PartReplacement] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         work_order_id: Optional[str] = None,
                         part_number_column: str = 'part_number',
                         part_name_column: str = 'part_name',
                         quantity_column: str = 'quantity',
                         reason_column: str = 'reason',
                         old_part_condition_column: Optional[str] = None,
                         new_part_serial_column: Optional[str] = None,
                         replacement_date_column: Optional[str] = None,
                         technician_column: Optional[str] = None,
                         cost_column: Optional[str] = None,
                         notes_column: Optional[str] = None) -> List[PartReplacement]:
        """
        从文件导入零件更换记录
        
        Args:
            file_path: 文件路径
            format_type: 文件格式，默认自动检测
            work_order_id: 关联工单ID
            part_number_column: 零件编号列名
            part_name_column: 零件名称列名
            quantity_column: 数量列名
            reason_column: 更换原因列名
            old_part_condition_column: 旧零件状态列名（可选）
            new_part_serial_column: 新零件序列号列名（可选）
            replacement_date_column: 更换日期列名（可选）
            technician_column: 操作师傅列名（可选）
            cost_column: 成本列名（可选）
            notes_column: 备注列名（可选）
        
        Returns:
            零件更换记录列表
        """
        self.replacements = []
        self.errors = []
        
        if format_type is None:
            format_type = self._detect_format(file_path)
        
        if format_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {format_type}")
        
        try:
            df = self._read_file(file_path, format_type)
            self._parse_dataframe(
                df, work_order_id, part_number_column, part_name_column,
                quantity_column, reason_column, old_part_condition_column,
                new_part_serial_column, replacement_date_column, technician_column,
                cost_column, notes_column
            )
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.replacements
    
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
                if 'replacements' in data:
                    return pd.DataFrame(data['replacements'])
                elif 'parts' in data:
                    return pd.DataFrame(data['parts'])
            raise ValueError("JSON格式不正确")
        elif format_type == 'excel':
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的格式: {format_type}")
    
    def _parse_dataframe(self, df: pd.DataFrame,
                         work_order_id: Optional[str],
                         part_number_column: str,
                         part_name_column: str,
                         quantity_column: str,
                         reason_column: str,
                         old_part_condition_column: Optional[str],
                         new_part_serial_column: Optional[str],
                         replacement_date_column: Optional[str],
                         technician_column: Optional[str],
                         cost_column: Optional[str],
                         notes_column: Optional[str]):
        """解析DataFrame为零件更换记录"""
        
        has_part_number = part_number_column in df.columns
        has_part_name = part_name_column in df.columns
        
        if not has_part_name and not has_part_number:
            raise ValueError(f"缺少必要列 '{part_name_column}' 或 '{part_number_column}'")
        
        for idx, row in df.iterrows():
            try:
                part_number = ""
                if has_part_number and not pd.isna(row[part_number_column]):
                    part_number = str(row[part_number_column])
                
                part_name = ""
                if has_part_name and not pd.isna(row[part_name_column]):
                    part_name = str(row[part_name_column])
                
                if not part_number and not part_name:
                    self.errors.append(f"跳过第 {idx+1} 行: 零件编号和名称都为空")
                    continue
                
                quantity = 1
                if quantity_column in df.columns and not pd.isna(row[quantity_column]):
                    try:
                        quantity = int(row[quantity_column])
                        if quantity < 1:
                            quantity = 1
                    except:
                        pass
                
                reason = ""
                if reason_column in df.columns and not pd.isna(row[reason_column]):
                    reason = str(row[reason_column])
                
                old_part_condition = None
                if old_part_condition_column and old_part_condition_column in df.columns:
                    if not pd.isna(row[old_part_condition_column]):
                        old_part_condition = str(row[old_part_condition_column])
                
                new_part_serial = None
                if new_part_serial_column and new_part_serial_column in df.columns:
                    if not pd.isna(row[new_part_serial_column]):
                        new_part_serial = str(row[new_part_serial_column])
                
                replacement_date = None
                if replacement_date_column and replacement_date_column in df.columns:
                    if not pd.isna(row[replacement_date_column]):
                        try:
                            if isinstance(row[replacement_date_column], datetime):
                                replacement_date = row[replacement_date_column]
                            else:
                                replacement_date = pd.to_datetime(row[replacement_date_column]).to_pydatetime()
                        except:
                            pass
                
                technician = None
                if technician_column and technician_column in df.columns:
                    if not pd.isna(row[technician_column]):
                        technician = str(row[technician_column])
                
                cost = None
                if cost_column and cost_column in df.columns:
                    if not pd.isna(row[cost_column]):
                        try:
                            cost = float(row[cost_column])
                        except:
                            pass
                
                notes = None
                if notes_column and notes_column in df.columns:
                    if not pd.isna(row[notes_column]):
                        notes = str(row[notes_column])
                
                replacement = PartReplacement(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    part_number=part_number,
                    part_name=part_name,
                    quantity=quantity,
                    reason=reason,
                    old_part_condition=old_part_condition,
                    new_part_serial=new_part_serial,
                    replacement_date=replacement_date,
                    technician=technician,
                    cost=cost,
                    notes=notes
                )
                self.replacements.append(replacement)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行零件更换记录失败: {str(e)}")
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         work_order_id: Optional[str] = None) -> List[PartReplacement]:
        """从字典列表导入零件更换记录"""
        self.replacements = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                part_number = item.get('part_number', '')
                part_name = item.get('part_name', '')
                
                if not part_number and not part_name:
                    self.errors.append(f"跳过第 {idx+1} 项: 零件编号和名称都为空")
                    continue
                
                quantity = item.get('quantity', 1)
                if isinstance(quantity, str):
                    try:
                        quantity = int(quantity)
                    except:
                        quantity = 1
                if quantity < 1:
                    quantity = 1
                
                reason = item.get('reason', '')
                
                old_part_condition = item.get('old_part_condition')
                new_part_serial = item.get('new_part_serial')
                
                replacement_date = item.get('replacement_date')
                if replacement_date and isinstance(replacement_date, str):
                    try:
                        replacement_date = datetime.fromisoformat(replacement_date)
                    except:
                        replacement_date = None
                
                technician = item.get('technician')
                
                cost = item.get('cost')
                if cost is not None:
                    try:
                        cost = float(cost)
                    except:
                        cost = None
                
                notes = item.get('notes')
                
                replacement = PartReplacement(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    part_number=part_number,
                    part_name=part_name,
                    quantity=quantity,
                    reason=reason,
                    old_part_condition=old_part_condition,
                    new_part_serial=new_part_serial,
                    replacement_date=replacement_date,
                    technician=technician,
                    cost=cost,
                    notes=notes
                )
                self.replacements.append(replacement)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项零件更换记录失败: {str(e)}")
        
        return self.replacements
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取零件更换统计信息"""
        if not self.replacements:
            return {
                'replacement_count': 0,
                'total_parts': 0,
                'unique_parts': 0,
                'total_cost': 0.0
            }
        
        total_parts = sum(r.quantity for r in self.replacements)
        unique_parts = len(set(r.part_number or r.part_name for r in self.replacements))
        total_cost = sum(r.cost for r in self.replacements if r.cost is not None)
        
        part_counts: Dict[str, int] = {}
        for r in self.replacements:
            key = r.part_number or r.part_name
            part_counts[key] = part_counts.get(key, 0) + r.quantity
        
        return {
            'replacement_count': len(self.replacements),
            'total_parts': total_parts,
            'unique_parts': unique_parts,
            'total_cost': total_cost,
            'part_breakdown': part_counts
        }
