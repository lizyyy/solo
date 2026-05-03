import math
from datetime import date, timedelta
from typing import List, Optional, Tuple
from dataclasses import dataclass

from .models import (
    Order, Press, PaperStock, Configuration, CutRules, WastageRules,
    ImpositionLayout, SheetImposition, ProductionPlan
)
from .units import Dimension, Size, format_imposition_count


@dataclass
class LayoutResult:
    layout: ImpositionLayout
    paper_size: Size
    paper_stock: PaperStock
    effective_paper_area: float
    used_area: float
    waste_rate: float


class ImpositionPlanner:
    def __init__(self, config: Configuration):
        self.config = config
    
    def get_effective_paper_area(self, paper_size: Size) -> Size:
        cut_rules = self.config.cut_rules
        if cut_rules is None:
            return paper_size
        
        effective_width = paper_size.width - (
            cut_rules.minimum_margin_left + cut_rules.minimum_margin_right +
            cut_rules.grip_margin
        )
        effective_height = paper_size.height - (
            cut_rules.minimum_margin_top + cut_rules.minimum_margin_bottom +
            cut_rules.tail_margin
        )
        
        return Size(
            width=effective_width if effective_width > Dimension(0) else paper_size.width,
            height=effective_height if effective_height > Dimension(0) else paper_size.height
        )
    
    def calculate_layout(
        self,
        item_size: Size,
        paper_size: Size,
        allow_rotation: bool = True
    ) -> List[LayoutResult]:
        results = []
        cut_rules = self.config.cut_rules
        
        gutter_h = cut_rules.default_gutter_horizontal if cut_rules else Dimension(10)
        gutter_v = cut_rules.default_gutter_vertical if cut_rules else Dimension(10)
        
        effective_paper = self.get_effective_paper_area(paper_size)
        
        item_w = item_size.width
        item_h = item_size.height
        
        max_cols = int(effective_paper.width.to_mm() // item_w.to_mm())
        max_rows = int(effective_paper.height.to_mm() // item_h.to_mm())
        
        for cols in range(1, max_cols + 1):
            for rows in range(1, max_rows + 1):
                total_width = (item_w * cols) + (gutter_h * (cols - 1))
                total_height = (item_h * rows) + (gutter_v * (rows - 1))
                
                if total_width <= effective_paper.width and total_height <= effective_paper.height:
                    count = cols * rows
                    used_area = item_size.area() * count
                    effective_area = effective_paper.area()
                    waste_rate = 1.0 - (used_area / effective_area) if effective_area > 0 else 1.0
                    
                    results.append(LayoutResult(
                        layout=ImpositionLayout(
                            rows=rows,
                            cols=cols,
                            rotated=False,
                            total_count=count
                        ),
                        paper_size=paper_size,
                        paper_stock=None,
                        effective_paper_area=effective_area,
                        used_area=used_area,
                        waste_rate=waste_rate
                    ))
        
        if allow_rotation and item_w != item_h:
            rotated_item = item_size.rotate()
            rotated_w = rotated_item.width
            rotated_h = rotated_item.height
            
            max_cols_rot = int(effective_paper.width.to_mm() // rotated_w.to_mm())
            max_rows_rot = int(effective_paper.height.to_mm() // rotated_h.to_mm())
            
            for cols in range(1, max_cols_rot + 1):
                for rows in range(1, max_rows_rot + 1):
                    total_width = (rotated_w * cols) + (gutter_h * (cols - 1))
                    total_height = (rotated_h * rows) + (gutter_v * (rows - 1))
                    
                    if total_width <= effective_paper.width and total_height <= effective_paper.height:
                        count = cols * rows
                        used_area = rotated_item.area() * count
                        effective_area = effective_paper.area()
                        waste_rate = 1.0 - (used_area / effective_area) if effective_area > 0 else 1.0
                        
                        results.append(LayoutResult(
                            layout=ImpositionLayout(
                                rows=rows,
                                cols=cols,
                                rotated=True,
                                total_count=count
                            ),
                            paper_size=paper_size,
                            paper_stock=None,
                            effective_paper_area=effective_area,
                            used_area=used_area,
                            waste_rate=waste_rate
                        ))
        
        results.sort(key=lambda x: (x.waste_rate, -x.layout.total_count))
        return results
    
    def find_best_imposition(
        self,
        order: Order,
        press: Optional[Press] = None
    ) -> Optional[SheetImposition]:
        item_size = order.effective_size
        
        matching_stock = [
            s for s in self.config.paper_stock 
            if s.paper_type == order.paper_type
        ]
        
        if not matching_stock:
            all_stock = self.config.paper_stock
            if not all_stock:
                return None
            matching_stock = all_stock
        
        all_layouts = []
        
        for stock in matching_stock:
            paper_size = stock.size
            
            if press:
                if not press.max_size.can_contain(paper_size):
                    continue
                if (paper_size.width < press.min_size.width or 
                    paper_size.height < press.min_size.height):
                    continue
            
            layouts = self.calculate_layout(item_size, paper_size)
            
            for layout in layouts:
                layout.paper_stock = stock
                all_layouts.append(layout)
        
        if not all_layouts:
            return None
        
        all_layouts.sort(key=lambda x: (x.waste_rate, -x.layout.total_count))
        best = all_layouts[0]
        
        return SheetImposition(
            order=order,
            press=press,
            paper_stock=best.paper_stock,
            layout=best.layout,
            paper_size=best.paper_size,
            effective_paper_area=best.effective_paper_area,
            used_area=best.used_area
        )
    
    def calculate_wastage(
        self,
        order: Order,
        items_per_sheet: int,
        press: Optional[Press] = None
    ) -> int:
        wastage_rules = self.config.wastage_rules
        
        if wastage_rules is None:
            base_wastage = 50
            additional_per_10k = 10
            min_wastage = 30
            max_wastage_percent = 5.0
        else:
            base_wastage = wastage_rules.base_wastage_per_run
            additional_per_10k = wastage_rules.additional_wastage_per_10k
            min_wastage = wastage_rules.minimum_wastage
            max_wastage_percent = wastage_rules.maximum_wastage_percent
        
        if press:
            base_wastage = press.wastage_base
            additional_per_10k = press.wastage_per_run
        
        sheets_required = math.ceil(order.quantity / items_per_sheet)
        
        total_wastage = (
            base_wastage +
            additional_per_10k * math.ceil(order.quantity / 10000)
        )
        
        max_wastage = int(sheets_required * max_wastage_percent / 100)
        
        if total_wastage < min_wastage:
            total_wastage = min_wastage
        
        if total_wastage > max_wastage:
            total_wastage = max_wastage
        
        return total_wastage
    
    def check_cross_day_risk(
        self,
        order: Order,
        today: Optional[date] = None
    ) -> bool:
        if today is None:
            today = date.today()
        
        days_available = (order.due_date - today).days
        
        base_days_needed = 1
        if order.quantity > 50000:
            base_days_needed = 2
        if order.quantity > 100000:
            base_days_needed = 3
        
        return days_available < base_days_needed
    
    def plan_order(
        self,
        order: Order,
        today: Optional[date] = None
    ) -> Optional[ProductionPlan]:
        if today is None:
            today = date.today()
        
        best_imposition: Optional[SheetImposition] = None
        best_press: Optional[Press] = None
        
        if self.config.presses:
            for press in self.config.presses.values():
                imposition = self.find_best_imposition(order, press)
                if imposition is None:
                    continue
                
                if (best_imposition is None or 
                    imposition.waste_rate < best_imposition.waste_rate or
                    (imposition.waste_rate == best_imposition.waste_rate and 
                     imposition.layout.total_count > best_imposition.layout.total_count)):
                    best_imposition = imposition
                    best_press = press
        
        if best_imposition is None:
            best_imposition = self.find_best_imposition(order)
        
        if best_imposition is None:
            return None
        
        items_per_sheet = best_imposition.layout.total_count
        sheets_required = math.ceil(order.quantity / items_per_sheet)
        
        wastage_sheets = self.calculate_wastage(
            order,
            items_per_sheet,
            best_press
        )
        
        total_sheets = sheets_required + wastage_sheets
        
        cross_day_risk = self.check_cross_day_risk(order, today)
        
        oversized_risk = False
        if best_press:
            paper_size = best_imposition.paper_size
            
            if not best_press.max_size.can_contain(paper_size):
                oversized_risk = True
            else:
                max_width_ratio = max(
                    paper_size.width.to_mm() / best_press.max_size.width.to_mm(),
                    paper_size.height.to_mm() / best_press.max_size.width.to_mm()
                )
                max_height_ratio = max(
                    paper_size.width.to_mm() / best_press.max_size.height.to_mm(),
                    paper_size.height.to_mm() / best_press.max_size.height.to_mm()
                )
                if max(max_width_ratio, max_height_ratio) > 0.95:
                    oversized_risk = True
        
        stock_risk = False
        if best_imposition.paper_stock:
            if total_sheets > best_imposition.paper_stock.stock_quantity:
                stock_risk = True
        
        return ProductionPlan(
            order=order,
            imposition=best_imposition,
            sheets_required=sheets_required,
            wastage_sheets=wastage_sheets,
            total_sheets=total_sheets,
            cross_day_risk=cross_day_risk,
            oversized_risk=oversized_risk,
            stock_risk=stock_risk
        )
    
    def plan_all_orders(
        self,
        orders: List[Order],
        today: Optional[date] = None
    ) -> List[ProductionPlan]:
        if today is None:
            today = date.today()
        
        plans = []
        for order in orders:
            plan = self.plan_order(order, today)
            if plan:
                plans.append(plan)
        
        return plans
