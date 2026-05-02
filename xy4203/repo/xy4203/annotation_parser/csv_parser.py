#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV标注解析模块 - 解析病害标注CSV和修复材料记录
"""

import csv
import os
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DefectAnnotation:
    """病害标注数据结构"""
    id: str = ""
    page_number: int = 0
    defect_type: str = ""
    position_x: float = 0.0
    position_y: float = 0.0
    width: float = 0.0
    height: float = 0.0
    area: float = 0.0
    severity: str = ""
    description: str = ""
    repair_status: str = ""
    material_used: str = ""
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MaterialRecord:
    """修复材料记录数据结构"""
    id: str = ""
    page_number: int = 0
    material_type: str = ""
    material_name: str = ""
    quantity: float = 0.0
    unit: str = ""
    usage_area: float = 0.0
    application_date: str = ""
    technician: str = ""
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


class CSVParser:
    """
    CSV标注解析器
    解析病害标注CSV和修复材料记录
    """
    
    # 支持的CSV字段映射（不同格式的兼容）
    DEFECT_FIELD_MAPPINGS = {
        "id": ["id", "编号", "标注ID", "缺陷ID"],
        "page_number": ["page_number", "页码", "页号", "page"],
        "defect_type": ["defect_type", "病害类型", "缺陷类型", "type"],
        "position_x": ["position_x", "x坐标", "x", "center_x"],
        "position_y": ["position_y", "y坐标", "y", "center_y"],
        "width": ["width", "宽度", "w"],
        "height": ["height", "高度", "h"],
        "area": ["area", "面积", "区域面积"],
        "severity": ["severity", "严重程度", "级别", "等级"],
        "description": ["description", "描述", "说明", "备注"],
        "repair_status": ["repair_status", "修复状态", "状态"],
        "material_used": ["material_used", "使用材料", "材料"],
        "notes": ["notes", "附加说明", "其他"]
    }
    
    MATERIAL_FIELD_MAPPINGS = {
        "id": ["id", "编号", "记录ID"],
        "page_number": ["page_number", "页码", "页号", "page"],
        "material_type": ["material_type", "材料类型", "类型"],
        "material_name": ["material_name", "材料名称", "名称"],
        "quantity": ["quantity", "数量", "用量"],
        "unit": ["unit", "单位", "计量单位"],
        "usage_area": ["usage_area", "使用面积", "覆盖面积"],
        "application_date": ["application_date", "使用日期", "日期"],
        "technician": ["technician", "修复师", "操作人员"],
        "notes": ["notes", "备注", "说明"]
    }
    
    def __init__(self):
        """初始化CSV解析器"""
        self.defect_annotations: List[DefectAnnotation] = []
        self.material_records: List[MaterialRecord] = []
    
    def parse_defect_csv(self, csv_path: str) -> List[DefectAnnotation]:
        """
        解析病害标注CSV文件
        
        Args:
            csv_path: CSV文件路径
            
        Returns:
            病害标注列表
        """
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"CSV文件不存在: {csv_path}")
        
        self.defect_annotations = []
        
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                # 尝试自动检测分隔符
                content = f.read(1024)
                f.seek(0)
                
                # 检测分隔符
                if '\t' in content:
                    delimiter = '\t'
                elif ';' in content:
                    delimiter = ';'
                else:
                    delimiter = ','
                
                reader = csv.DictReader(f, delimiter=delimiter)
                
                # 获取实际的字段名
                actual_fields = reader.fieldnames if reader.fieldnames else []
                
                for row_num, row in enumerate(reader, 2):  # 行号从2开始（跳过表头）
                    annotation = self._parse_defect_row(row, actual_fields, row_num)
                    if annotation:
                        self.defect_annotations.append(annotation)
            
            return self.defect_annotations
            
        except Exception as e:
            raise RuntimeError(f"解析CSV文件失败: {e}")
    
    def _parse_defect_row(self, row: Dict[str, str], actual_fields: List[str], row_num: int) -> Optional[DefectAnnotation]:
        """
        解析单行病害标注数据
        
        Args:
            row: CSV行数据
            actual_fields: 实际字段名列表
            row_num: 行号
            
        Returns:
            病害标注对象（解析失败返回None）
        """
        annotation = DefectAnnotation()
        
        # 尝试使用多种可能的字段名
        for field_name, possible_names in self.DEFECT_FIELD_MAPPINGS.items():
            for possible_name in possible_names:
                if possible_name in row and row[possible_name].strip():
                    value = row[possible_name].strip()
                    
                    # 根据字段类型转换值
                    if field_name in ["page_number"]:
                        try:
                            value = int(value)
                        except (ValueError, TypeError):
                            value = 0
                    elif field_name in ["position_x", "position_y", "width", "height", "area"]:
                        try:
                            value = float(value)
                        except (ValueError, TypeError):
                            value = 0.0
                    
                    setattr(annotation, field_name, value)
                    break
        
        # 自动生成ID（如果没有提供）
        if not annotation.id:
            annotation.id = f"defect_{row_num - 1}"
        
        # 计算面积（如果没有提供但有宽高）
        if annotation.area == 0 and annotation.width > 0 and annotation.height > 0:
            annotation.area = annotation.width * annotation.height
        
        return annotation
    
    def parse_material_csv(self, csv_path: str) -> List[MaterialRecord]:
        """
        解析修复材料记录CSV文件
        
        Args:
            csv_path: CSV文件路径
            
        Returns:
            材料记录列表
        """
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"CSV文件不存在: {csv_path}")
        
        self.material_records = []
        
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                # 尝试自动检测分隔符
                content = f.read(1024)
                f.seek(0)
                
                # 检测分隔符
                if '\t' in content:
                    delimiter = '\t'
                elif ';' in content:
                    delimiter = ';'
                else:
                    delimiter = ','
                
                reader = csv.DictReader(f, delimiter=delimiter)
                
                # 获取实际的字段名
                actual_fields = reader.fieldnames if reader.fieldnames else []
                
                for row_num, row in enumerate(reader, 2):  # 行号从2开始（跳过表头）
                    record = self._parse_material_row(row, actual_fields, row_num)
                    if record:
                        self.material_records.append(record)
            
            return self.material_records
            
        except Exception as e:
            raise RuntimeError(f"解析CSV文件失败: {e}")
    
    def _parse_material_row(self, row: Dict[str, str], actual_fields: List[str], row_num: int) -> Optional[MaterialRecord]:
        """
        解析单行材料记录数据
        
        Args:
            row: CSV行数据
            actual_fields: 实际字段名列表
            row_num: 行号
            
        Returns:
            材料记录对象（解析失败返回None）
        """
        record = MaterialRecord()
        
        # 尝试使用多种可能的字段名
        for field_name, possible_names in self.MATERIAL_FIELD_MAPPINGS.items():
            for possible_name in possible_names:
                if possible_name in row and row[possible_name].strip():
                    value = row[possible_name].strip()
                    
                    # 根据字段类型转换值
                    if field_name in ["page_number"]:
                        try:
                            value = int(value)
                        except (ValueError, TypeError):
                            value = 0
                    elif field_name in ["quantity", "usage_area"]:
                        try:
                            value = float(value)
                        except (ValueError, TypeError):
                            value = 0.0
                    
                    setattr(record, field_name, value)
                    break
        
        # 自动生成ID（如果没有提供）
        if not record.id:
            record.id = f"material_{row_num - 1}"
        
        return record
    
    def get_defects_by_page(self, page_number: int) -> List[DefectAnnotation]:
        """
        获取指定页码的所有病害标注
        
        Args:
            page_number: 页码
            
        Returns:
            该页的病害标注列表
        """
        return [d for d in self.defect_annotations if d.page_number == page_number]
    
    def get_materials_by_page(self, page_number: int) -> List[MaterialRecord]:
        """
        获取指定页码的所有材料记录
        
        Args:
            page_number: 页码
            
        Returns:
            该页的材料记录列表
        """
        return [m for m in self.material_records if m.page_number == page_number]
    
    def calculate_annotation_coverage(self, page_number: int, image_width: int, image_height: int) -> Dict:
        """
        计算标注覆盖率
        
        Args:
            page_number: 页码
            image_width: 图像宽度
            image_height: 图像高度
            
        Returns:
            覆盖率统计信息
        """
        defects = self.get_defects_by_page(page_number)
        
        total_image_area = image_width * image_height
        total_annotated_area = sum(d.area for d in defects)
        
        # 计算覆盖率（注意：可能有重叠标注，这里简单求和）
        coverage_percent = (total_annotated_area / total_image_area * 100) if total_image_area > 0 else 0
        
        # 按类型统计
        type_stats = {}
        for defect in defects:
            defect_type = defect.defect_type or "未分类"
            if defect_type not in type_stats:
                type_stats[defect_type] = {"count": 0, "total_area": 0.0}
            type_stats[defect_type]["count"] += 1
            type_stats[defect_type]["total_area"] += defect.area
        
        return {
            "page_number": page_number,
            "total_defects": len(defects),
            "total_annotated_area": total_annotated_area,
            "total_image_area": total_image_area,
            "coverage_percent": coverage_percent,
            "type_statistics": type_stats
        }
    
    def validate_defect_annotations(self) -> List[Dict]:
        """
        验证病害标注数据的完整性和一致性
        
        Returns:
            验证问题列表
        """
        issues = []
        
        for i, defect in enumerate(self.defect_annotations):
            # 检查必填字段
            if defect.page_number <= 0:
                issues.append({
                    "type": "missing_field",
                    "severity": "high",
                    "defect_id": defect.id,
                    "field": "page_number",
                    "message": f"标注 {defect.id} 缺少有效的页码"
                })
            
            if not defect.defect_type:
                issues.append({
                    "type": "missing_field",
                    "severity": "medium",
                    "defect_id": defect.id,
                    "field": "defect_type",
                    "message": f"标注 {defect.id} 缺少病害类型"
                })
            
            if defect.area <= 0 and (defect.width <= 0 or defect.height <= 0):
                issues.append({
                    "type": "invalid_data",
                    "severity": "medium",
                    "defect_id": defect.id,
                    "field": "area",
                    "message": f"标注 {defect.id} 面积数据无效"
                })
        
        # 检查页码连续性（如果有多个标注）
        page_numbers = sorted(set(d.page_number for d in self.defect_annotations if d.page_number > 0))
        if len(page_numbers) > 1:
            expected = list(range(page_numbers[0], page_numbers[-1] + 1))
            missing = [p for p in expected if p not in page_numbers]
            if missing:
                issues.append({
                    "type": "page_gap",
                    "severity": "warning",
                    "pages": missing,
                    "message": f"检测到页码不连续，缺少页码: {missing}"
                })
        
        return issues
    
    def validate_material_records(self) -> List[Dict]:
        """
        验证材料记录数据的完整性和一致性
        
        Returns:
            验证问题列表
        """
        issues = []
        
        for i, record in enumerate(self.material_records):
            # 检查必填字段
            if record.page_number <= 0:
                issues.append({
                    "type": "missing_field",
                    "severity": "high",
                    "record_id": record.id,
                    "field": "page_number",
                    "message": f"材料记录 {record.id} 缺少有效的页码"
                })
            
            if not record.material_name:
                issues.append({
                    "type": "missing_field",
                    "severity": "medium",
                    "record_id": record.id,
                    "field": "material_name",
                    "message": f"材料记录 {record.id} 缺少材料名称"
                })
        
        return issues
    
    def get_defect_types(self) -> List[str]:
        """
        获取所有病害类型
        
        Returns:
            病害类型列表
        """
        return sorted(set(d.defect_type for d in self.defect_annotations if d.defect_type))
    
    def get_material_types(self) -> List[str]:
        """
        获取所有材料类型
        
        Returns:
            材料类型列表
        """
        return sorted(set(m.material_type for m in self.material_records if m.material_type))
    
    def get_page_numbers(self) -> List[int]:
        """
        获取所有涉及的页码
        
        Returns:
            页码列表（已排序）
        """
        defect_pages = set(d.page_number for d in self.defect_annotations if d.page_number > 0)
        material_pages = set(m.page_number for m in self.material_records if m.page_number > 0)
        all_pages = defect_pages.union(material_pages)
        return sorted(all_pages)
