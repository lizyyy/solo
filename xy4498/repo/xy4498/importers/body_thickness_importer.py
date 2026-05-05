import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
import uuid
import json

from models import BodyThickness


class BodyThicknessImporter:
    """坯体厚度导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    def __init__(self):
        self.body_thicknesses: List[BodyThickness] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         position_id_column: str = 'position_id',
                         thickness_column: str = 'thickness',
                         material_column: Optional[str] = None) -> List[BodyThickness]:
        """
        从文件导入坯体厚度
        
        Args:
            file_path: 文件路径
            format_type: 文件格式
            position_id_column: 窑位ID列名
            thickness_column: 厚度列名
            material_column: 材料列名（可选）
        
        Returns:
            坯体厚度列表
        """
        self.body_thicknesses = []
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
                elif isinstance(data, dict) and 'body_thicknesses' in data:
                    df = pd.DataFrame(data['body_thicknesses'])
                else:
                    raise ValueError("JSON格式不正确")
            elif format_type == 'excel':
                df = pd.read_excel(file_path)
            
            self._parse_dataframe(df, position_id_column, thickness_column, material_column)
            
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.body_thicknesses
    
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
    
    def _parse_dataframe(self, df: pd.DataFrame, position_id_column: str,
                         thickness_column: str, material_column: Optional[str]):
        """解析DataFrame为坯体厚度"""
        required_columns = [position_id_column, thickness_column]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必要列 '{col}' 不存在于数据中")
        
        for idx, row in df.iterrows():
            try:
                position_id = row[position_id_column]
                thickness = row[thickness_column]
                
                if pd.isna(position_id) or pd.isna(thickness):
                    self.errors.append(f"跳过第 {idx+1} 行: 窑位ID或厚度值为空")
                    continue
                
                position_id = str(position_id).strip()
                thickness = float(thickness)
                
                if thickness <= 0:
                    self.errors.append(f"跳过第 {idx+1} 行: 厚度值无效: {thickness}")
                    continue
                
                material = None
                if material_column and material_column in df.columns:
                    material = str(row[material_column]) if not pd.isna(row[material_column]) else None
                
                body_thickness = BodyThickness(
                    id=str(uuid.uuid4()),
                    position_id=position_id,
                    thickness=thickness,
                    material=material
                )
                self.body_thicknesses.append(body_thickness)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行失败: {str(e)}")
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         position_id_key: str = 'position_id',
                         thickness_key: str = 'thickness',
                         material_key: Optional[str] = None) -> List[BodyThickness]:
        """从字典列表导入坯体厚度"""
        self.body_thicknesses = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                if position_id_key not in item or thickness_key not in item:
                    self.errors.append(f"跳过第 {idx+1} 项: 缺少窑位ID或厚度")
                    continue
                
                position_id = str(item[position_id_key]).strip()
                thickness = float(item[thickness_key])
                
                if thickness <= 0:
                    self.errors.append(f"跳过第 {idx+1} 项: 厚度值无效: {thickness}")
                    continue
                
                material = None
                if material_key and material_key in item:
                    material = str(item[material_key]) if item[material_key] else None
                
                body_thickness = BodyThickness(
                    id=str(uuid.uuid4()),
                    position_id=position_id,
                    thickness=thickness,
                    material=material
                )
                self.body_thicknesses.append(body_thickness)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项失败: {str(e)}")
        
        return self.body_thicknesses
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取坯体厚度统计信息"""
        if not self.body_thicknesses:
            return {
                'count': 0,
                'min_thickness': None,
                'max_thickness': None,
                'avg_thickness': None,
                'materials': []
            }
        
        thicknesses = [bt.thickness for bt in self.body_thicknesses]
        materials = list(set(bt.material for bt in self.body_thicknesses if bt.material))
        
        return {
            'count': len(self.body_thicknesses),
            'min_thickness': min(thicknesses),
            'max_thickness': max(thicknesses),
            'avg_thickness': sum(thicknesses) / len(thicknesses),
            'materials': materials
        }
