# -*- coding: utf-8 -*-
"""
版面计算模块
用于计算标签元素位置、检测尺寸越界、安全边距检查
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from core.models import LabelTemplate, TemplateField, SKUData, ValidationError
from core.constants import ErrorLevel, MM_TO_INCH


@dataclass
class ElementBounds:
    """元素边界信息"""
    name: str
    x: float
    y: float
    width: float
    height: float
    field_type: str
    
    @property
    def right(self) -> float:
        return self.x + self.width
    
    @property
    def bottom(self) -> float:
        return self.y + self.height


class LayoutCalculator:
    """版面计算器"""
    
    def __init__(self, dpi: int = 203):
        self.dpi = dpi
    
    def calculate_text_size(
        self, 
        text: str, 
        font_size: float,
        font_name: str = "Arial"
    ) -> Tuple[float, float]:
        """
        估算文本尺寸（毫米）
        简化估算，实际渲染可能需要字体库
        """
        if not text:
            return 0, 0
        
        avg_char_width = font_size * 0.6
        line_height = font_size * 1.2
        
        lines = text.split('\n')
        max_width = max(len(line) * avg_char_width for line in lines) if lines else 0
        total_height = len(lines) * line_height
        
        return max_width, total_height
    
    def calculate_barcode_size(
        self,
        data: str,
        barcode_type: str,
        height: float = 10.0,
        magnification: float = 1.0
    ) -> Tuple[float, float]:
        """
        估算条码尺寸（毫米）
        """
        if not data:
            return 0, 0
        
        narrow_module_width = 0.33 * magnification
        
        if barcode_type == "CODE128":
            modules_per_char = 11
            quiet_zone = 10 * narrow_module_width
            total_width = (len(data) * modules_per_char + 11) * narrow_module_width + quiet_zone * 2
            
        elif barcode_type == "CODE39":
            modules_per_char = 9 + 3
            quiet_zone = 10 * narrow_module_width
            total_width = (len(data) + 2) * modules_per_char * narrow_module_width + quiet_zone * 2
            
        elif barcode_type in ["EAN13", "UPCA"]:
            total_width = 37.29 * magnification
            
        elif barcode_type in ["EAN8", "UPCE"]:
            total_width = 25.93 * magnification
            
        elif barcode_type == "QRCODE":
            version = self._estimate_qr_version(len(data))
            module_count = 4 * version + 17
            total_width = module_count * narrow_module_width
            height = total_width
            
        elif barcode_type == "ITF14":
            total_width = (14 * 7 + 34) * narrow_module_width
            
        else:
            total_width = len(data) * 2.5 * magnification
        
        return total_width, height
    
    def _estimate_qr_version(self, char_count: int) -> int:
        """估算QR Code版本号"""
        version_capacities = [
            (1, 25), (2, 47), (3, 77), (4, 114), (5, 154),
            (6, 195), (7, 224), (8, 279), (9, 335), (10, 395),
        ]
        for version, capacity in version_capacities:
            if char_count <= capacity:
                return version
        return 10
    
    def get_element_bounds(
        self,
        field: TemplateField,
        data_value: str,
        template: LabelTemplate
    ) -> ElementBounds:
        """获取元素的边界信息"""
        if field.field_type == 'barcode' and field.barcode_type:
            width, height = self.calculate_barcode_size(
                data_value,
                field.barcode_type.value,
                height=field.height or 10.0
            )
        else:
            font_size = field.font_size or 12.0
            width, height = self.calculate_text_size(data_value, font_size)
        
        if field.width:
            width = field.width
        if field.height:
            height = field.height
        
        return ElementBounds(
            name=field.name,
            x=field.x,
            y=field.y,
            width=width,
            height=height,
            field_type=field.field_type
        )


class LayoutValidator:
    """版面校验器"""
    
    def __init__(self, margin_mm: float = 2.0):
        self.margin_mm = margin_mm
        self.calculator = LayoutCalculator()
    
    def check_boundary(
        self,
        bounds: ElementBounds,
        template: LabelTemplate
    ) -> Tuple[bool, List[str]]:
        """检查元素是否越界"""
        errors = []
        
        label_width = template.width_mm
        label_height = template.height_mm
        
        margin = self.margin_mm
        
        if bounds.x < margin:
            errors.append(f"元素 '{bounds.name}' 左边界超出安全边距（距离左边缘{bounds.x:.1f}mm，需要{margin}mm）")
        
        if bounds.y < margin:
            errors.append(f"元素 '{bounds.name}' 上边界超出安全边距（距离上边缘{bounds.y:.1f}mm，需要{margin}mm）")
        
        if bounds.right > (label_width - margin):
            errors.append(f"元素 '{bounds.name}' 右边界超出安全边距（右边缘位置{bounds.right:.1f}mm，标签宽度{label_width}mm，需要保留{margin}mm边距）")
        
        if bounds.bottom > (label_height - margin):
            errors.append(f"元素 '{bounds.name}' 下边界超出安全边距（下边缘位置{bounds.bottom:.1f}mm，标签高度{label_height}mm，需要保留{margin}mm边距）")
        
        return len(errors) == 0, errors
    
    def check_overlap(
        self,
        bounds_list: List[ElementBounds]
    ) -> List[Tuple[ElementBounds, ElementBounds, str]]:
        """检查元素之间是否重叠"""
        overlaps = []
        
        for i, b1 in enumerate(bounds_list):
            for j, b2 in enumerate(bounds_list[i+1:], start=i+1):
                if self._do_overlap(b1, b2):
                    overlaps.append((b1, b2, f"元素 '{b1.name}' 与 '{b2.name}' 重叠"))
        
        return overlaps
    
    def _do_overlap(self, b1: ElementBounds, b2: ElementBounds) -> bool:
        """检查两个矩形是否重叠"""
        return not (
            b1.right <= b2.x or
            b2.right <= b1.x or
            b1.bottom <= b2.y or
            b2.bottom <= b1.y
        )
    
    def validate_layout(
        self,
        sku_data: SKUData,
        template: LabelTemplate
    ) -> List[ValidationError]:
        """校验整个版面"""
        errors = []
        bounds_list = []
        
        data_dict = sku_data.to_dict()
        
        for field in template.fields:
            field_value = str(data_dict.get(field.name, ''))
            
            bounds = self.calculator.get_element_bounds(field, field_value, template)
            bounds_list.append(bounds)
            
            is_valid, boundary_errors = self.check_boundary(bounds, template)
            for err_msg in boundary_errors:
                errors.append(ValidationError(
                    error_code='LAYOUT_BOUNDARY_VIOLATION',
                    message=err_msg,
                    level=ErrorLevel.WARNING,
                    field=field.name,
                    box_number=sku_data.box_number,
                    row_index=sku_data.row_index,
                ))
        
        overlaps = self.check_overlap(bounds_list)
        for b1, b2, msg in overlaps:
            errors.append(ValidationError(
                error_code='LAYOUT_ELEMENT_OVERLAP',
                message=msg,
                level=ErrorLevel.WARNING,
                field=f"{b1.name},{b2.name}",
                box_number=sku_data.box_number,
                row_index=sku_data.row_index,
            ))
        
        return errors
