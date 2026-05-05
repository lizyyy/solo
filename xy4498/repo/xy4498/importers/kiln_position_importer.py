import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
import uuid
import json

from models import KilnPosition


class KilnPositionImporter:
    """窑位摆放导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    def __init__(self):
        self.kiln_positions: List[KilnPosition] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         code_column: str = 'code',
                         row_column: str = 'row',
                         column_column: str = 'column',
                         shelf_column: Optional[str] = 'shelf',
                         glaze_recipe_id_column: Optional[str] = 'glaze_recipe_id',
                         body_thickness_id_column: Optional[str] = 'body_thickness_id',
                         notes_column: Optional[str] = 'notes') -> List[KilnPosition]:
        """
        从文件导入窑位摆放
        
        Args:
            file_path: 文件路径
            format_type: 文件格式
            code_column: 窑位编码列名
            row_column: 行号列名
            column_column: 列号列名
            shelf_column: 层架列名
            glaze_recipe_id_column: 釉料配方ID列名
            body_thickness_id_column: 坯体厚度ID列名
            notes_column: 备注列名
        
        Returns:
            窑位列表
        """
        self.kiln_positions = []
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
                elif isinstance(data, dict) and 'kiln_positions' in data:
                    df = pd.DataFrame(data['kiln_positions'])
                else:
                    raise ValueError("JSON格式不正确")
            elif format_type == 'excel':
                df = pd.read_excel(file_path)
            
            self._parse_dataframe(df, code_column, row_column, column_column,
                                   shelf_column, glaze_recipe_id_column,
                                   body_thickness_id_column, notes_column)
            
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.kiln_positions
    
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
    
    def _parse_dataframe(self, df: pd.DataFrame, code_column: str,
                         row_column: str, column_column: str,
                         shelf_column: Optional[str],
                         glaze_recipe_id_column: Optional[str],
                         body_thickness_id_column: Optional[str],
                         notes_column: Optional[str]):
        """解析DataFrame为窑位"""
        required_columns = [code_column, row_column, column_column]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必要列 '{col}' 不存在于数据中")
        
        for idx, row in df.iterrows():
            try:
                code = row[code_column]
                row_num = row[row_column]
                col_num = row[column_column]
                
                if pd.isna(code) or pd.isna(row_num) or pd.isna(col_num):
                    self.errors.append(f"跳过第 {idx+1} 行: 编码、行号或列号为空")
                    continue
                
                code = str(code).strip()
                row_num = int(row_num)
                col_num = int(col_num)
                
                if row_num < 0 or col_num < 0:
                    self.errors.append(f"跳过第 {idx+1} 行: 行号或列号无效")
                    continue
                
                shelf = None
                if shelf_column and shelf_column in df.columns:
                    shelf_val = row[shelf_column]
                    if not pd.isna(shelf_val):
                        try:
                            shelf = int(shelf_val)
                        except (ValueError, TypeError):
                            pass
                
                glaze_recipe_id = None
                if glaze_recipe_id_column and glaze_recipe_id_column in df.columns:
                    glaze_id = row[glaze_recipe_id_column]
                    if not pd.isna(glaze_id):
                        glaze_recipe_id = str(glaze_id).strip()
                
                body_thickness_id = None
                if body_thickness_id_column and body_thickness_id_column in df.columns:
                    body_id = row[body_thickness_id_column]
                    if not pd.isna(body_id):
                        body_thickness_id = str(body_id).strip()
                
                notes = None
                if notes_column and notes_column in df.columns:
                    notes_val = row[notes_column]
                    if not pd.isna(notes_val):
                        notes = str(notes_val)
                
                position = KilnPosition(
                    id=str(uuid.uuid4()),
                    code=code,
                    row=row_num,
                    column=col_num,
                    shelf=shelf,
                    glaze_recipe_id=glaze_recipe_id,
                    body_thickness_id=body_thickness_id,
                    notes=notes
                )
                self.kiln_positions.append(position)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行失败: {str(e)}")
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         code_key: str = 'code',
                         row_key: str = 'row',
                         column_key: str = 'column',
                         shelf_key: str = 'shelf',
                         glaze_recipe_id_key: str = 'glaze_recipe_id',
                         body_thickness_id_key: str = 'body_thickness_id',
                         notes_key: str = 'notes') -> List[KilnPosition]:
        """从字典列表导入窑位"""
        self.kiln_positions = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                if code_key not in item or row_key not in item or column_key not in item:
                    self.errors.append(f"跳过第 {idx+1} 项: 缺少编码、行号或列号")
                    continue
                
                code = str(item[code_key]).strip()
                row_num = int(item[row_key])
                col_num = int(item[column_key])
                
                if row_num < 0 or col_num < 0:
                    self.errors.append(f"跳过第 {idx+1} 项: 行号或列号无效")
                    continue
                
                shelf = None
                if shelf_key in item and item[shelf_key]:
                    try:
                        shelf = int(item[shelf_key])
                    except (ValueError, TypeError):
                        pass
                
                glaze_recipe_id = None
                if glaze_recipe_id_key in item and item[glaze_recipe_id_key]:
                    glaze_recipe_id = str(item[glaze_recipe_id_key]).strip()
                
                body_thickness_id = None
                if body_thickness_id_key in item and item[body_thickness_id_key]:
                    body_thickness_id = str(item[body_thickness_id_key]).strip()
                
                notes = None
                if notes_key in item and item[notes_key]:
                    notes = str(item[notes_key])
                
                position = KilnPosition(
                    id=str(uuid.uuid4()),
                    code=code,
                    row=row_num,
                    column=col_num,
                    shelf=shelf,
                    glaze_recipe_id=glaze_recipe_id,
                    body_thickness_id=body_thickness_id,
                    notes=notes
                )
                self.kiln_positions.append(position)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项失败: {str(e)}")
        
        return self.kiln_positions
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取窑位统计信息"""
        if not self.kiln_positions:
            return {
                'count': 0,
                'codes': [],
                'rows': [],
                'columns': []
            }
        
        codes = [kp.code for kp in self.kiln_positions]
        rows = list(set(kp.row for kp in self.kiln_positions))
        columns = list(set(kp.column for kp in self.kiln_positions))
        shelves = list(set(kp.shelf for kp in self.kiln_positions if kp.shelf is not None))
        
        return {
            'count': len(self.kiln_positions),
            'codes': codes,
            'row_count': len(rows),
            'column_count': len(columns),
            'shelf_count': len(shelves) if shelves else 0,
            'rows': sorted(rows),
            'columns': sorted(columns)
        }
