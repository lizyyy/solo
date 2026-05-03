"""
坐标变换模块 - 负责单位转换、坐标计算和页面规格处理
"""
from dataclasses import dataclass
from typing import Tuple, Dict, Optional, List
from enum import Enum

from .parse_validator import PageSize, FieldConfig, TemplateConfig


class CoordinateSystem(Enum):
    """坐标系类型"""
    PDF = "pdf"  # PDF坐标系：左下角为原点，Y轴向上
    TOP_LEFT = "top_left"  # 常用坐标系：左上角为原点，Y轴向下


@dataclass
class PageDimensions:
    """页面尺寸（以pt为单位）"""
    width: float
    height: float
    name: str
    
    # 页面尺寸常量（72点/英寸）
    # A4: 210mm x 297mm = 595.28pt x 841.89pt
    # Letter: 8.5in x 11in = 612pt x 792pt
    
    A4_WIDTH = 595.28
    A4_HEIGHT = 841.89
    LETTER_WIDTH = 612.0
    LETTER_HEIGHT = 792.0
    
    # mm到pt的转换系数：1mm = 72/25.4 pt ≈ 2.83464567 pt
    MM_TO_PT = 72.0 / 25.4
    PT_TO_MM = 25.4 / 72.0


@dataclass
class NormalizedField:
    """标准化后的字段（所有坐标均以pt为单位，使用PDF坐标系）"""
    name: str
    x: float  # 左下角X坐标
    y: float  # 左下角Y坐标
    width: float
    height: float
    original_config: FieldConfig
    normalized: bool = True
    
    @property
    def x1(self) -> float:
        """左边界"""
        return self.x
    
    @property
    def y1(self) -> float:
        """下边界"""
        return self.y
    
    @property
    def x2(self) -> float:
        """右边界"""
        return self.x + self.width
    
    @property
    def y2(self) -> float:
        """上边界"""
        return self.y + self.height
    
    @property
    def center_x(self) -> float:
        """中心点X坐标"""
        return self.x + self.width / 2
    
    @property
    def center_y(self) -> float:
        """中心点Y坐标"""
        return self.y + self.height / 2
    
    def get_bounds(self) -> Tuple[float, float, float, float]:
        """获取边界：(x1, y1, x2, y2)"""
        return (self.x1, self.y1, self.x2, self.y2)
    
    def overlaps_with(self, other: 'NormalizedField') -> bool:
        """检查是否与另一个字段重叠"""
        # 分离轴定理
        if self.x2 <= other.x1 or other.x2 <= self.x1:
            return False
        if self.y2 <= other.y1 or other.y2 <= self.y1:
            return False
        return True
    
    def contains_point(self, px: float, py: float) -> bool:
        """检查点是否在字段内"""
        return self.x1 <= px <= self.x2 and self.y1 <= py <= self.y2
    
    def get_overlap_area(self, other: 'NormalizedField') -> float:
        """计算与另一个字段的重叠面积"""
        if not self.overlaps_with(other):
            return 0.0
        
        overlap_x1 = max(self.x1, other.x1)
        overlap_y1 = max(self.y1, other.y1)
        overlap_x2 = min(self.x2, other.x2)
        overlap_y2 = min(self.y2, other.y2)
        
        return (overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)
    
    def get_overlap_percentage(self, other: 'NormalizedField') -> float:
        """计算重叠百分比（相对于自身面积）"""
        self_area = self.width * self.height
        if self_area == 0:
            return 0.0
        
        overlap_area = self.get_overlap_area(other)
        return (overlap_area / self_area) * 100


class CoordinateTransformer:
    """坐标变换器"""
    
    def __init__(self):
        self.page_dimensions: Dict[PageSize, Tuple[float, float]] = {
            PageSize.A4: (PageDimensions.A4_WIDTH, PageDimensions.A4_HEIGHT),
            PageSize.LETTER: (PageDimensions.LETTER_WIDTH, PageDimensions.LETTER_HEIGHT),
        }
    
    def get_page_size(self, page_size: PageSize, orientation: str = "portrait") -> Tuple[float, float]:
        """
        获取页面尺寸（宽，高），单位：pt
        
        Args:
            page_size: 页面尺寸枚举
            orientation: 页面方向，"portrait"（纵向）或 "landscape"（横向）
        
        Returns:
            (width, height) 元组，单位：pt
        """
        width, height = self.page_dimensions.get(
            page_size, 
            (PageDimensions.A4_WIDTH, PageDimensions.A4_HEIGHT)
        )
        
        if orientation == "landscape":
            return (height, width)
        
        return (width, height)
    
    def mm_to_pt(self, mm: float) -> float:
        """毫米转点"""
        return mm * PageDimensions.MM_TO_PT
    
    def pt_to_mm(self, pt: float) -> float:
        """点转毫米"""
        return pt * PageDimensions.PT_TO_MM
    
    def convert_unit(self, value: float, from_unit: str, to_unit: str = "pt") -> float:
        """
        单位转换
        
        Args:
            value: 数值
            from_unit: 原单位（"pt" 或 "mm"）
            to_unit: 目标单位（"pt" 或 "mm"）
        
        Returns:
            转换后的值
        """
        if from_unit == to_unit:
            return value
        
        if from_unit == "mm" and to_unit == "pt":
            return self.mm_to_pt(value)
        elif from_unit == "pt" and to_unit == "mm":
            return self.pt_to_mm(value)
        else:
            raise ValueError(f"不支持的单位转换: {from_unit} -> {to_unit}")
    
    def convert_coordinate_system(
        self,
        x: float,
        y: float,
        page_height: float,
        from_system: CoordinateSystem,
        to_system: CoordinateSystem
    ) -> Tuple[float, float]:
        """
        坐标系转换
        
        PDF坐标系: 左下角为原点(0,0)，Y轴向上
        常用坐标系: 左上角为原点(0,0)，Y轴向下
        
        Args:
            x: X坐标
            y: Y坐标
            page_height: 页面高度
            from_system: 原坐标系
            to_system: 目标坐标系
        
        Returns:
            转换后的 (x, y) 坐标
        """
        if from_system == to_system:
            return (x, y)
        
        # PDF <-> TOP_LEFT
        # 关键转换: y_new = page_height - y_old
        
        if from_system == CoordinateSystem.PDF and to_system == CoordinateSystem.TOP_LEFT:
            # PDF -> TOP_LEFT: y = page_height - y
            return (x, page_height - y)
        elif from_system == CoordinateSystem.TOP_LEFT and to_system == CoordinateSystem.PDF:
            # TOP_LEFT -> PDF: y = page_height - y
            return (x, page_height - y)
        else:
            return (x, y)
    
    def normalize_field(
        self,
        field: FieldConfig,
        page_size: PageSize,
        orientation: str = "portrait",
        coordinate_system: CoordinateSystem = CoordinateSystem.TOP_LEFT
    ) -> NormalizedField:
        """
        标准化字段配置
        
        将字段坐标转换为：
        1. 单位：pt
        2. 坐标系：PDF坐标系（左下角为原点）
        
        Args:
            field: 原始字段配置
            page_size: 页面尺寸
            orientation: 页面方向
            coordinate_system: 原始坐标使用的坐标系
        
        Returns:
            标准化后的字段
        """
        # 1. 单位转换：mm -> pt
        if field.unit == "mm":
            x_pt = self.mm_to_pt(field.x)
            y_pt = self.mm_to_pt(field.y)
            width_pt = self.mm_to_pt(field.width)
            height_pt = self.mm_to_pt(field.height)
        else:
            x_pt = field.x
            y_pt = field.y
            width_pt = field.width
            height_pt = field.height
        
        # 2. 坐标系转换
        page_width, page_height = self.get_page_size(page_size, orientation)
        
        if coordinate_system == CoordinateSystem.TOP_LEFT:
            # TOP_LEFT -> PDF
            # 注意：在TOP_LEFT坐标系中，y通常是指矩形的上边
            # 转换后，PDF坐标系的y是指矩形的下边
            # 所以：y_pdf = page_height - (y_top_left + height)
            # 或者如果y_top_left已经是下边，就是 y_pdf = page_height - y_top_left
            
            # 这里假设输入的y是矩形的上边（TOP_LEFT坐标系的常见用法）
            # 即：在TOP_LEFT坐标系中，(x, y)是矩形的左上角
            # 转换到PDF坐标系，(x, y)应该是矩形的左下角
            
            # 左上角(x_top_left, y_top_left)
            # 左下角(x, y_pdf) = (x_top_left, page_height - y_top_left - height)
            
            y_pdf = page_height - y_pt - height_pt
            x_pdf = x_pt
        else:
            # 已经是PDF坐标系
            x_pdf = x_pt
            y_pdf = y_pt
        
        return NormalizedField(
            name=field.name,
            x=x_pdf,
            y=y_pdf,
            width=width_pt,
            height=height_pt,
            original_config=field
        )
    
    def normalize_template(
        self,
        template: TemplateConfig,
        coordinate_system: CoordinateSystem = CoordinateSystem.TOP_LEFT
    ) -> Tuple[List[NormalizedField], Tuple[float, float]]:
        """
        标准化整个模板
        
        Args:
            template: 模板配置
            coordinate_system: 原始坐标使用的坐标系
        
        Returns:
            (标准化后的字段列表, (页面宽度, 页面高度))
        """
        page_width, page_height = self.get_page_size(
            template.page_size, 
            template.orientation
        )
        
        normalized_fields = []
        for field in template.fields:
            normalized = self.normalize_field(
                field,
                template.page_size,
                template.orientation,
                coordinate_system
            )
            normalized_fields.append(normalized)
        
        return normalized_fields, (page_width, page_height)
    
    def is_field_in_page(
        self,
        field: NormalizedField,
        page_width: float,
        page_height: float,
        margins: Optional[Dict[str, float]] = None
    ) -> Tuple[bool, List[str]]:
        """
        检查字段是否在页面范围内
        
        Args:
            field: 标准化后的字段
            page_width: 页面宽度
            page_height: 页面高度
            margins: 边距 {top, bottom, left, right}，单位：pt
        
        Returns:
            (是否完全在页面内, 问题列表)
        """
        issues = []
        is_inside = True
        
        if margins is None:
            margins = {"top": 0, "bottom": 0, "left": 0, "right": 0}
        
        # 有效区域
        valid_left = margins.get("left", 0)
        valid_right = page_width - margins.get("right", 0)
        valid_bottom = margins.get("bottom", 0)
        valid_top = page_height - margins.get("top", 0)
        
        # 检查各边界
        if field.x1 < valid_left:
            issues.append(f"左边界越界: x1={field.x1:.2f} < 左边界={valid_left:.2f}")
            is_inside = False
        
        if field.x2 > valid_right:
            issues.append(f"右边界越界: x2={field.x2:.2f} > 右边界={valid_right:.2f}")
            is_inside = False
        
        if field.y1 < valid_bottom:
            issues.append(f"下边界越界: y1={field.y1:.2f} < 下边界={valid_bottom:.2f}")
            is_inside = False
        
        if field.y2 > valid_top:
            issues.append(f"上边界越界: y2={field.y2:.2f} > 上边界={valid_top:.2f}")
            is_inside = False
        
        return is_inside, issues
    
    def get_field_position_description(
        self,
        field: NormalizedField,
        page_width: float,
        page_height: float,
        unit: str = "pt"
    ) -> str:
        """
        获取字段位置的描述文本
        
        Args:
            field: 标准化后的字段
            page_width: 页面宽度
            page_height: 页面高度
            unit: 输出单位
        
        Returns:
            描述文本
        """
        if unit == "mm":
            x = self.pt_to_mm(field.x)
            y = self.pt_to_mm(field.y)
            width = self.pt_to_mm(field.width)
            height = self.pt_to_mm(field.height)
            pw = self.pt_to_mm(page_width)
            ph = self.pt_to_mm(page_height)
            unit_str = "mm"
        else:
            x = field.x
            y = field.y
            width = field.width
            height = field.height
            pw = page_width
            ph = page_height
            unit_str = "pt"
        
        return (
            f"字段 '{field.name}': "
            f"位置=({x:.2f}, {y:.2f}){unit_str}, "
            f"尺寸={width:.2f}x{height:.2f}{unit_str}, "
            f"页面={pw:.2f}x{ph:.2f}{unit_str}"
        )
