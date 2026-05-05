import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
import uuid
import json

from models import GlazeRecipe


class GlazeRecipeImporter:
    """釉料配方导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    def __init__(self):
        self.glaze_recipes: List[GlazeRecipe] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         name_column: str = 'name',
                         components_column: Optional[str] = None,
                         melting_temp_column: Optional[str] = 'melting_temperature',
                         notes_column: Optional[str] = 'notes') -> List[GlazeRecipe]:
        """
        从文件导入釉料配方
        
        Args:
            file_path: 文件路径
            format_type: 文件格式
            name_column: 配方名称列名
            components_column: 成分列名（JSON格式字符串）
            melting_temp_column: 熔融温度列名
            notes_column: 备注列名
        
        Returns:
            釉料配方列表
        """
        self.glaze_recipes = []
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
                elif isinstance(data, dict) and 'glaze_recipes' in data:
                    df = pd.DataFrame(data['glaze_recipes'])
                else:
                    raise ValueError("JSON格式不正确")
            elif format_type == 'excel':
                df = pd.read_excel(file_path)
            
            self._parse_dataframe(df, name_column, components_column, 
                                   melting_temp_column, notes_column)
            
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.glaze_recipes
    
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
    
    def _parse_dataframe(self, df: pd.DataFrame, name_column: str,
                         components_column: Optional[str],
                         melting_temp_column: Optional[str],
                         notes_column: Optional[str]):
        """解析DataFrame为釉料配方"""
        if name_column not in df.columns:
            raise ValueError(f"缺少必要列 '{name_column}' 不存在于数据中")
        
        for idx, row in df.iterrows():
            try:
                name = row[name_column]
                if pd.isna(name) or str(name).strip() == '':
                    self.errors.append(f"跳过第 {idx+1} 行: 配方名称为空")
                    continue
                
                name = str(name).strip()
                
                components = {}
                if components_column and components_column in df.columns:
                    components_str = row[components_column]
                    if not pd.isna(components_str):
                        try:
                            if isinstance(components_str, str):
                                components = json.loads(components_str)
                            elif isinstance(components_str, dict):
                                components = components_str
                        except json.JSONDecodeError:
                                    self.errors.append(f"第 {idx+1} 行成分JSON解析失败，使用空成分")
                
                melting_temp = None
                if melting_temp_column and melting_temp_column in df.columns:
                    temp_val = row[melting_temp_column]
                    if not pd.isna(temp_val):
                        try:
                            melting_temp = float(temp_val)
                        except (ValueError, TypeError):
                            pass
                
                notes = None
                if notes_column and notes_column in df.columns:
                    notes_val = row[notes_column]
                    if not pd.isna(notes_val):
                        notes = str(notes_val)
                
                recipe = GlazeRecipe(
                    id=str(uuid.uuid4()),
                    name=name,
                    components=components,
                    melting_temperature=melting_temp,
                    notes=notes
                )
                self.glaze_recipes.append(recipe)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行失败: {str(e)}")
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         name_key: str = 'name',
                         components_key: str = 'components',
                         melting_temp_key: str = 'melting_temperature',
                         notes_key: str = 'notes') -> List[GlazeRecipe]:
        """从字典列表导入釉料配方"""
        self.glaze_recipes = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                if name_key not in item:
                    self.errors.append(f"跳过第 {idx+1} 项: 缺少配方名称")
                    continue
                
                name = str(item[name_key]).strip()
                if not name:
                    self.errors.append(f"跳过第 {idx+1} 项: 配方名称为空")
                    continue
                
                components = {}
                if components_key in item:
                    comp_val = item[components_key]
                    if isinstance(comp_val, dict):
                        components = comp_val
                    elif isinstance(comp_val, str):
                        try:
                            components = json.loads(comp_val)
                        except json.JSONDecodeError:
                            self.errors.append(f"第 {idx+1} 项成分JSON解析失败")
                
                melting_temp = None
                if melting_temp_key in item and item[melting_temp_key]:
                    try:
                        melting_temp = float(item[melting_temp_key])
                    except (ValueError, TypeError):
                        pass
                
                notes = None
                if notes_key in item and item[notes_key]:
                    notes = str(item[notes_key])
                
                recipe = GlazeRecipe(
                    id=str(uuid.uuid4()),
                    name=name,
                    components=components,
                    melting_temperature=melting_temp,
                    notes=notes
                )
                self.glaze_recipes.append(recipe)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项失败: {str(e)}")
        
        return self.glaze_recipes
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取釉料配方统计信息"""
        if not self.glaze_recipes:
            return {
                'count': 0,
                'names': [],
                'avg_components_count': 0
            }
        
        names = [gr.name for gr in self.glaze_recipes]
        components_counts = [len(gr.components) for gr in self.glaze_recipes]
        
        return {
            'count': len(self.glaze_recipes),
            'names': names,
            'min_components': min(components_counts),
            'max_components': max(components_counts),
            'avg_components_count': sum(components_counts) / len(components_counts)
        }
