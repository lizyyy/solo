from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional
from enum import Enum

from .units import Dimension, Size


class ColorMode(Enum):
    COLOR = "彩色"
    MONO = "单色"
    SPOT = "专色"


@dataclass
class Order:
    order_id: str
    product_name: str
    finished_size: Size
    bleed: Dimension
    quantity: int
    due_date: date
    paper_type: str
    color_mode: ColorMode
    
    @property
    def effective_size(self) -> Size:
        return Size(
            width=self.finished_size.width + self.bleed * 2,
            height=self.finished_size.height + self.bleed * 2
        )


@dataclass
class PressFormat:
    name: str
    size: Size


@dataclass
class Press:
    name: str
    max_size: Size
    min_size: Size
    color_capacity: int
    formats: List[PressFormat]
    default_formats: List[str]
    wastage_base: int
    wastage_per_run: int


@dataclass
class PaperStock:
    paper_type: str
    size: Size
    stock_quantity: int
    price_per_sheet: float


@dataclass
class CutRules:
    default_gutter_horizontal: Dimension
    default_gutter_vertical: Dimension
    minimum_margin_top: Dimension
    minimum_margin_bottom: Dimension
    minimum_margin_left: Dimension
    minimum_margin_right: Dimension
    grip_margin: Dimension
    tail_margin: Dimension


@dataclass
class WastageRules:
    base_wastage_per_run: int
    additional_wastage_per_10k: int
    minimum_wastage: int
    maximum_wastage_percent: float


@dataclass
class Configuration:
    presses: Dict[str, Press] = field(default_factory=dict)
    paper_stock: List[PaperStock] = field(default_factory=list)
    cut_rules: Optional[CutRules] = None
    wastage_rules: Optional[WastageRules] = None


@dataclass
class ImpositionLayout:
    rows: int
    cols: int
    rotated: bool
    total_count: int
    
    @property
    def layout_string(self) -> str:
        return f"{self.cols}x{self.rows}"


@dataclass
class SheetImposition:
    order: Order
    press: Press
    paper_stock: PaperStock
    layout: ImpositionLayout
    paper_size: Size
    effective_paper_area: float
    used_area: float
    
    @property
    def waste_rate(self) -> float:
        if self.effective_paper_area <= 0:
            return 1.0
        return 1.0 - (self.used_area / self.effective_paper_area)
    
    @property
    def waste_percentage(self) -> float:
        return self.waste_rate * 100


@dataclass
class ProductionPlan:
    order: Order
    imposition: SheetImposition
    sheets_required: int
    wastage_sheets: int
    total_sheets: int
    cross_day_risk: bool
    oversized_risk: bool
    stock_risk: bool
    
    @property
    def total_waste_percentage(self) -> float:
        if self.total_sheets <= 0:
            return 0.0
        return (self.wastage_sheets / self.total_sheets) * 100


@dataclass
class ValidationError:
    order_id: str
    field: str
    message: str
    severity: str = "error"


@dataclass
class ValidationResult:
    valid: bool
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
