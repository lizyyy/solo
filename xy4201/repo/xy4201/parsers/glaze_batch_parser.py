"""
釉料批次解析器
解析釉料批次表CSV文件
"""

import csv
from datetime import datetime
from typing import List, Dict, Optional
from .base_parser import BaseParser
from ..models import GlazeBatch, WorkPiece


class GlazeBatchParser(BaseParser):
    """釉料批次CSV解析器"""
    
    def __init__(self):
        super().__init__()
        self.batch_id_counter = 1
        self.work_id_counter = 1
    
    def parse(self, file_path: str) -> List[GlazeBatch]:
        """
        解析釉料批次CSV文件
        
        期望的CSV格式：
        batch_id,glaze_name,formula,quantity,unit,created_date,expiration_date,notes,status
        GB-2024-001,青瓷釉,长石40% 石英20%...,5000,g,2024-01-01,2025-01-01,新配批次,可用
        
        或简化格式：
        batch_id,glaze_name,quantity,status
        GB-2024-001,青瓷釉,5000,可用
        """
        self.clear()
        
        if not self.validate_file(file_path):
            return []
        
        batches: List[GlazeBatch] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    batch = self._parse_row(row, row_num)
                    if batch:
                        batches.append(batch)
        
        except csv.Error as e:
            self.add_error(f"CSV解析错误: {str(e)}")
            return []
        except Exception as e:
            self.add_error(f"文件读取错误: {str(e)}")
            return []
        
        if not batches:
            self.add_warning("未解析到有效的釉料批次")
        
        return batches
    
    def _parse_row(self, row: Dict[str, str], row_num: int) -> Optional[GlazeBatch]:
        """解析单行数据"""
        batch_id = row.get('batch_id') or row.get('id')
        if not batch_id:
            batch_id = f"AUTO-GB-{self.batch_id_counter:03d}"
            self.batch_id_counter += 1
            self.add_warning(f"第{row_num}行缺少批次ID，自动生成: {batch_id}")
        
        glaze_name = row.get('glaze_name') or row.get('name')
        if not glaze_name:
            self.add_warning(f"第{row_num}行缺少釉料名称，跳过此行")
            return None
        
        formula = row.get('formula')
        
        quantity = None
        quantity_str = row.get('quantity')
        if quantity_str:
            try:
                quantity = float(quantity_str)
            except ValueError:
                self.add_warning(f"第{row_num}行数量值无效: {quantity_str}")
        
        unit = row.get('unit', 'g')
        
        created_date = self._parse_date(row.get('created_date'), row_num, "创建日期")
        expiration_date = self._parse_date(row.get('expiration_date'), row_num, "过期日期")
        
        notes = row.get('notes') or row.get('remark')
        
        status = row.get('status', '可用')
        if status not in ['可用', '已用完', '已过期']:
            self.add_warning(f"第{row_num}行状态值不标准: {status}")
        
        return GlazeBatch(
            batch_id=batch_id,
            glaze_name=glaze_name,
            formula=formula,
            quantity=quantity,
            unit=unit,
            created_date=created_date,
            expiration_date=expiration_date,
            notes=notes,
            status=status
        )
    
    def _parse_date(self, date_str: Optional[str], row_num: int, field_name: str) -> Optional[datetime]:
        """解析日期字符串"""
        if not date_str:
            return None
        
        date_str = date_str.strip()
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        try:
            return datetime.fromisoformat(date_str)
        except ValueError:
            pass
        
        self.add_warning(f"第{row_num}行{field_name}格式无法解析: {date_str}")
        return None


class WorkPieceParser(BaseParser):
    """作品CSV解析器"""
    
    def __init__(self):
        super().__init__()
        self.work_id_counter = 1
    
    def parse(self, file_path: str) -> List[WorkPiece]:
        """
        解析作品CSV文件
        
        期望的CSV格式：
        work_id,title,artist,glaze_batch_id,shelf_layer,notes,status
        W-001,花瓶,张三,GB-2024-001,上层,手工拉坯,待烧成
        
        或简化格式：
        work_id,title,glaze_batch_id,shelf_layer
        W-001,花瓶,GB-2024-001,上层
        """
        self.clear()
        
        if not self.validate_file(file_path):
            return []
        
        works: List[WorkPiece] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    work = self._parse_row(row, row_num)
                    if work:
                        works.append(work)
        
        except csv.Error as e:
            self.add_error(f"CSV解析错误: {str(e)}")
            return []
        except Exception as e:
            self.add_error(f"文件读取错误: {str(e)}")
            return []
        
        if not works:
            self.add_warning("未解析到有效的作品数据")
        
        return works
    
    def _parse_row(self, row: Dict[str, str], row_num: int) -> Optional[WorkPiece]:
        """解析单行数据"""
        work_id = row.get('work_id') or row.get('id')
        if not work_id:
            work_id = f"AUTO-W-{self.work_id_counter:03d}"
            self.work_id_counter += 1
            self.add_warning(f"第{row_num}行缺少作品ID，自动生成: {work_id}")
        
        title = row.get('title') or row.get('name')
        artist = row.get('artist')
        glaze_batch_id = row.get('glaze_batch_id')
        shelf_layer = row.get('shelf_layer') or row.get('layer')
        notes = row.get('notes') or row.get('remark')
        status = row.get('status', '待烧成')
        
        return WorkPiece(
            work_id=work_id,
            title=title,
            artist=artist,
            glaze_batch_id=glaze_batch_id,
            shelf_layer=shelf_layer,
            notes=notes,
            status=status
        )
