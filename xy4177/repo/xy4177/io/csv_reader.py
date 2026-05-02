# -*- coding: utf-8 -*-
"""
CSV文件读取器
"""

import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from core.models import SKUData


class CSVReader:
    """读取WMS导出的SKU CSV文件"""
    
    def __init__(self, encoding: str = 'utf-8-sig'):
        self.encoding = encoding
    
    def read_file(self, file_path: str) -> List[SKUData]:
        """读取CSV文件并返回SKU数据列表"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV文件不存在: {file_path}")
        
        sku_list = []
        with open(path, 'r', encoding=self.encoding, newline='') as f:
            reader = csv.DictReader(f)
            for row_index, row in enumerate(reader, start=1):
                sku_data = SKUData.from_dict(row, row_index)
                sku_list.append(sku_data)
        
        return sku_list
    
    def read_file_raw(self, file_path: str) -> List[Dict[str, Any]]:
        """读取CSV原始数据（用于调试）"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV文件不存在: {file_path}")
        
        data_list = []
        with open(path, 'r', encoding=self.encoding, newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data_list.append(dict(row))
        
        return data_list
    
    def get_headers(self, file_path: str) -> List[str]:
        """获取CSV文件的列名"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV文件不存在: {file_path}")
        
        with open(path, 'r', encoding=self.encoding, newline='') as f:
            reader = csv.reader(f)
            headers = next(reader, [])
        
        return headers
