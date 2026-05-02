# -*- coding: utf-8 -*-
"""
CSV工单解析器
"""

import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
import re

from models import WorkOrder


@dataclass
class ParseResult:
    """解析结果"""
    work_orders: List[WorkOrder] = field(default_factory=list)
    success: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class CSVParser:
    """CSV工单解析器"""
    
    REQUIRED_COLUMNS = [
        '工单号', '电梯编号', '位置', '维保日期', '维保人员'
    ]
    
    OPTIONAL_COLUMNS = [
        '必拍点位', '有整改', '整改项'
    ]
    
    # 日期格式支持
    DATE_FORMATS = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%Y年%m月%d日',
        '%m/%d/%Y',
        '%d/%m/%Y',
    ]
    
    def __init__(self):
        self.encoding = 'utf-8'
        self.delimiter = ','
        
    def parse(self, file_path: Path) -> ParseResult:
        """
        解析CSV工单文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            ParseResult: 解析结果
        """
        result = ParseResult()
        
        if not file_path.exists():
            result.success = False
            result.errors.append(f"文件不存在: {file_path}")
            return result
        
        try:
            # 尝试检测编码
            content = self._read_with_detection(file_path)
            if content is None:
                result.success = False
                result.errors.append(f"无法读取文件: {file_path}")
                return result
            
            # 解析CSV
            lines = content.splitlines()
            if not lines:
                result.success = False
                result.errors.append("CSV文件为空")
                return result
            
            # 检测分隔符
            self._detect_delimiter(lines[0])
            
            # 使用csv模块解析
            reader = csv.DictReader(lines, delimiter=self.delimiter)
            
            # 检查必需列
            missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in reader.fieldnames]
            if missing_columns:
                result.success = False
                result.errors.append(f"缺少必需列: {', '.join(missing_columns)}")
                return result
            
            # 解析每一行
            for row_num, row in enumerate(reader, start=2):  # 从第2行开始（跳过表头）
                work_order = self._parse_row(row, row_num, result)
                if work_order:
                    result.work_orders.append(work_order)
                    
        except Exception as e:
            result.success = False
            result.errors.append(f"解析CSV时出错: {str(e)}")
            
        return result
    
    def _read_with_detection(self, file_path: Path) -> Optional[str]:
        """尝试不同编码读取文件"""
        encodings = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'gb18030']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                    self.encoding = encoding
                    return content
            except (UnicodeDecodeError, UnicodeError):
                continue
        
        return None
    
    def _detect_delimiter(self, first_line: str):
        """自动检测CSV分隔符"""
        if '\t' in first_line:
            self.delimiter = '\t'
        elif ';' in first_line and ',' not in first_line:
            self.delimiter = ';'
        else:
            self.delimiter = ','
    
    def _parse_row(self, row: Dict[str, str], row_num: int, result: ParseResult) -> Optional[WorkOrder]:
        """解析单行数据"""
        try:
            # 必需字段
            order_id = self._clean_value(row.get('工单号', ''))
            elevator_no = self._clean_value(row.get('电梯编号', ''))
            location = self._clean_value(row.get('位置', ''))
            maintenance_date_str = self._clean_value(row.get('维保日期', ''))
            technician = self._clean_value(row.get('维保人员', ''))
            
            # 验证必需字段
            if not order_id:
                result.warnings.append(f"第{row_num}行: 工单号为空，跳过")
                return None
            
            if not elevator_no:
                result.warnings.append(f"第{row_num}行: 电梯编号为空")
            
            # 解析日期
            maintenance_date = self._parse_date(maintenance_date_str)
            if maintenance_date is None:
                result.warnings.append(f"第{row_num}行: 无法解析维保日期 '{maintenance_date_str}'，使用当前日期")
                maintenance_date = datetime.now().date()
                maintenance_date = datetime.combine(maintenance_date, datetime.min.time())
            
            # 解析可选字段
            required_points = self._parse_required_points(row.get('必拍点位', ''))
            has_rectification = self._parse_boolean(row.get('有整改', '否'))
            rectification_items = self._parse_rectification_items(row.get('整改项', ''))
            
            # 创建工单对象
            work_order = WorkOrder(
                order_id=order_id,
                elevator_no=elevator_no,
                location=location,
                maintenance_date=maintenance_date,
                technician=technician,
                required_points=required_points,
                has_rectification=has_rectification,
                rectification_items=rectification_items,
                metadata={'row_num': row_num}
            )
            
            return work_order
            
        except Exception as e:
            result.warnings.append(f"第{row_num}行解析出错: {str(e)}")
            return None
    
    def _clean_value(self, value: str) -> str:
        """清理字符串值"""
        if value is None:
            return ''
        return str(value).strip()
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """尝试多种格式解析日期"""
        if not date_str:
            return None
        
        date_str = self._clean_value(date_str)
        
        for fmt in self.DATE_FORMATS:
            try:
                dt = datetime.strptime(date_str, fmt)
                # 确保是datetime对象（date对象没有time部分）
                if isinstance(dt, datetime):
                    return dt
                return datetime.combine(dt, datetime.min.time())
            except ValueError:
                continue
        
        # 尝试使用dateutil
        try:
            from dateutil import parser as dateutil_parser
            dt = dateutil_parser.parse(date_str, fuzzy=True)
            return dt
        except (ImportError, Exception):
            pass
        
        return None
    
    def _parse_required_points(self, value: str) -> List[str]:
        """解析必拍点位"""
        if not value:
            return []
        
        # 支持多种分隔符
        separators = [',', '、', ';', '，', '；']
        points = [value]
        
        for sep in separators:
            if sep in value:
                points = value.split(sep)
                break
        
        return [self._clean_value(p) for p in points if self._clean_value(p)]
    
    def _parse_boolean(self, value: str) -> bool:
        """解析布尔值"""
        if not value:
            return False
        
        value = self._clean_value(value).lower()
        true_values = ['是', 'yes', 'y', 'true', 't', '1', '有']
        return value in true_values
    
    def _parse_rectification_items(self, value: str) -> List[str]:
        """解析整改项列表"""
        if not value:
            return []
        
        # 支持多种分隔符
        separators = ['\n', ';', '；', '|']
        items = [value]
        
        for sep in separators:
            if sep in value:
                items = value.split(sep)
                break
        
        return [self._clean_value(i) for i in items if self._clean_value(i)]
