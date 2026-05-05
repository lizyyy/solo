import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
import uuid
import json

from models import DefectRecord


class DefectRecordImporter:
    """缺陷记录导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    SEVERITY_LEVELS = ['轻微', '中等', '严重']
    DEFECT_TYPES = ['开裂', '气泡', '针孔', '釉面不平', '缩釉', '流釉', 
                    '麻点', '黑点', '色差', '光泽不够', '其他']
    
    def __init__(self):
        self.defect_records: List[DefectRecord] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         kiln_run_id_column: str = 'kiln_run_id',
                         position_id_column: str = 'position_id',
                         defect_type_column: str = 'defect_type',
                         severity_column: str = 'severity',
                         description_column: Optional[str] = 'description',
                         photos_column: Optional[str] = 'photos') -> List[DefectRecord]:
        """
        从文件导入缺陷记录
        
        Args:
            file_path: 文件路径
            format_type: 文件格式
            kiln_run_id_column: 窑次ID列名
            position_id_column: 窑位ID列名
            defect_type_column: 缺陷类型列名
            severity_column: 严重程度列名
            description_column: 描述列名
            photos_column: 照片列名（JSON数组字符串）
        
        Returns:
            缺陷记录列表
        """
        self.defect_records = []
        self.errors = []
        
        if format_type is None:
            format_type = self._detect_format(file_path)
        
        if format_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {format_type}")
        
        try:
            if format_type == 'csv':
                df = pd.read_csv(file_path)
            elif format_type == 'json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, list):
                    df = pd.DataFrame(data)
                elif isinstance(data, dict) and 'defect_records' in data:
                    df = pd.DataFrame(data['defect_records'])
                else:
                    raise ValueError("JSON格式不正确")
            elif format_type == 'excel':
                df = pd.read_excel(file_path)
            
            self._parse_dataframe(df, kiln_run_id_column, position_id_column,
                                   defect_type_column, severity_column,
                                   description_column, photos_column)
            
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.defect_records
    
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
    
    def _parse_dataframe(self, df: pd.DataFrame, kiln_run_id_column: str,
                         position_id_column: str, defect_type_column: str,
                         severity_column: str, description_column: Optional[str],
                         photos_column: Optional[str]):
        """解析DataFrame为缺陷记录"""
        required_columns = [kiln_run_id_column, position_id_column, 
                          defect_type_column, severity_column]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必要列 '{col}' 不存在于数据中")
        
        for idx, row in df.iterrows():
            try:
                kiln_run_id = row[kiln_run_id_column]
                position_id = row[position_id_column]
                defect_type = row[defect_type_column]
                severity = row[severity_column]
                
                if pd.isna(kiln_run_id) or pd.isna(position_id):
                    self.errors.append(f"跳过第 {idx+1} 行: 窑次ID或窑位ID为空")
                    continue
                
                if pd.isna(defect_type) or pd.isna(severity):
                    self.errors.append(f"跳过第 {idx+1} 行: 缺陷类型或严重程度为空")
                    continue
                
                kiln_run_id = str(kiln_run_id).strip()
                position_id = str(position_id).strip()
                defect_type = str(defect_type).strip()
                severity = str(severity).strip()
                
                if severity not in self.SEVERITY_LEVELS:
                    self.errors.append(f"第 {idx+1} 行严重程度 '{severity}' 不是有效值，使用默认值")
                    severity = '轻微'
                
                description = None
                if description_column and description_column in df.columns:
                    desc_val = row[description_column]
                    if not pd.isna(desc_val):
                        description = str(desc_val)
                
                photos = None
                if photos_column and photos_column in df.columns:
                    photos_val = row[photos_column]
                    if not pd.isna(photos_val):
                        try:
                            if isinstance(photos_val, str):
                                photos = json.loads(photos_val)
                            elif isinstance(photos_val, list):
                                photos = photos_val
                        except json.JSONDecodeError:
                            self.errors.append(f"第 {idx+1} 行照片JSON解析失败")
                
                defect = DefectRecord(
                    id=str(uuid.uuid4()),
                    kiln_run_id=kiln_run_id,
                    position_id=position_id,
                    defect_type=defect_type,
                    severity=severity,
                    description=description,
                    photos=photos
                )
                self.defect_records.append(defect)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行失败: {str(e)}")
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         kiln_run_id_key: str = 'kiln_run_id',
                         position_id_key: str = 'position_id',
                         defect_type_key: str = 'defect_type',
                         severity_key: str = 'severity',
                         description_key: str = 'description',
                         photos_key: str = 'photos') -> List[DefectRecord]:
        """从字典列表导入缺陷记录"""
        self.defect_records = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                required_keys = [kiln_run_id_key, position_id_key, 
                               defect_type_key, severity_key]
                if not all(k in item for k in required_keys):
                    self.errors.append(f"跳过第 {idx+1} 项: 缺少必要字段")
                    continue
                
                kiln_run_id = str(item[kiln_run_id_key]).strip()
                position_id = str(item[position_id_key]).strip()
                defect_type = str(item[defect_type_key]).strip()
                severity = str(item[severity_key]).strip()
                
                if severity not in self.SEVERITY_LEVELS:
                    self.errors.append(f"第 {idx+1} 项严重程度 '{severity}' 不是有效值，使用默认值")
                    severity = '轻微'
                
                description = None
                if description_key in item and item[description_key]:
                    description = str(item[description_key])
                
                photos = None
                if photos_key in item:
                    photos_val = item[photos_key]
                    if isinstance(photos_val, list):
                        photos = photos_val
                    elif isinstance(photos_val, str):
                        try:
                            photos = json.loads(photos_val)
                        except json.JSONDecodeError:
                            self.errors.append(f"第 {idx+1} 项照片JSON解析失败")
                
                defect = DefectRecord(
                    id=str(uuid.uuid4()),
                    kiln_run_id=kiln_run_id,
                    position_id=position_id,
                    defect_type=defect_type,
                    severity=severity,
                    description=description,
                    photos=photos
                )
                self.defect_records.append(defect)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项失败: {str(e)}")
        
        return self.defect_records
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取缺陷记录统计信息"""
        if not self.defect_records:
            return {
                'count': 0,
                'by_type': {},
                'by_severity': {},
                'affected_positions': 0
            }
        
        by_type = {}
        by_severity = {}
        affected_positions = set()
        
        for defect in self.defect_records:
            by_type[defect.defect_type] = by_type.get(defect.defect_type, 0) + 1
            by_severity[defect.severity] = by_severity.get(defect.severity, 0) + 1
            affected_positions.add(defect.position_id)
        
        return {
            'count': len(self.defect_records),
            'by_type': by_type,
            'by_severity': by_severity,
            'affected_positions_count': len(affected_positions),
            'affected_positions': list(affected_positions)
        }
