import math
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class CostBreakdown:
    material_cost: float = 0.0
    labor_cost: float = 0.0
    cutting_cost: float = 0.0
    urgent_surcharge: float = 0.0
    wastage_cost: float = 0.0
    total_cost: float = 0.0
    profit_margin: float = 0.0
    quoted_price: float = 0.0

class QuotationCalculator:
    LABOR_COST_PER_HOUR = 80.0
    CUTS_PER_HOUR = 100
    URGENT_SURCHARGE_RATE = 0.3
    DEFAULT_PROFIT_MARGIN_RATE = 0.25
    WASTAGE_RATE = 0.03
    
    def __init__(
        self,
        labor_cost_per_hour: float = None,
        cuts_per_hour: int = None,
        urgent_surcharge_rate: float = None,
        profit_margin_rate: float = None,
        wastage_rate: float = None
    ):
        self.labor_cost_per_hour = labor_cost_per_hour if labor_cost_per_hour is not None else self.LABOR_COST_PER_HOUR
        self.cuts_per_hour = cuts_per_hour if cuts_per_hour is not None else self.CUTS_PER_HOUR
        self.urgent_surcharge_rate = urgent_surcharge_rate if urgent_surcharge_rate is not None else self.URGENT_SURCHARGE_RATE
        self.profit_margin_rate = profit_margin_rate if profit_margin_rate is not None else self.DEFAULT_PROFIT_MARGIN_RATE
        self.wastage_rate = wastage_rate if wastage_rate is not None else self.WASTAGE_RATE
    
    def calculate_labor_cost(
        self,
        sheets_count: int,
        cols: int,
        rows: int,
        is_double_sided: bool = False
    ) -> float:
        cuts_per_sheet = (cols - 1) + (rows - 1)
        if is_double_sided:
            cuts_per_sheet *= 2
        
        total_cuts = cuts_per_sheet * sheets_count
        
        hours_needed = total_cuts / self.cuts_per_hour
        
        labor_cost = hours_needed * self.labor_cost_per_hour
        
        return max(5.0, labor_cost)
    
    def calculate_cutting_cost(
        self,
        sheets_count: int,
        complexity: int = 1
    ) -> float:
        base_cutting_fee = 20.0
        
        if sheets_count <= 10:
            return base_cutting_fee * complexity
        elif sheets_count <= 50:
            return base_cutting_fee * complexity * 1.5
        else:
            return base_cutting_fee * complexity * 2.0
    
    def calculate_material_cost(
        self,
        sheets_count: int,
        unit_price: float,
        include_wastage: bool = True
    ) -> float:
        base_cost = sheets_count * unit_price
        
        if include_wastage:
            wastage_cost = base_cost * self.wastage_rate
            return base_cost + wastage_cost
        
        return base_cost
    
    def calculate_urgent_surcharge(
        self,
        total_cost: float,
        is_urgent: bool
    ) -> float:
        if is_urgent:
            return total_cost * self.urgent_surcharge_rate
        return 0.0
    
    def calculate_profit_margin(
        self,
        total_cost: float,
        margin_rate: float = None
    ) -> float:
        rate = margin_rate if margin_rate is not None else self.profit_margin_rate
        return total_cost * rate
    
    def calculate_full_quotation(
        self,
        sheets_count: int,
        unit_price: float,
        cols: int,
        rows: int,
        is_urgent: bool = False,
        is_double_sided: bool = False,
        cutting_complexity: int = 1,
        margin_rate: float = None
    ) -> CostBreakdown:
        material_cost = self.calculate_material_cost(
            sheets_count,
            unit_price,
            include_wastage=True
        )
        
        labor_cost = self.calculate_labor_cost(
            sheets_count,
            cols,
            rows,
            is_double_sided
        )
        
        cutting_cost = self.calculate_cutting_cost(
            sheets_count,
            cutting_complexity
        )
        
        subtotal = material_cost + labor_cost + cutting_cost
        
        urgent_surcharge = self.calculate_urgent_surcharge(subtotal, is_urgent)
        
        total_cost = subtotal + urgent_surcharge
        
        profit_margin = self.calculate_profit_margin(total_cost, margin_rate)
        
        quoted_price = total_cost + profit_margin
        
        return CostBreakdown(
            material_cost=round(material_cost, 2),
            labor_cost=round(labor_cost, 2),
            cutting_cost=round(cutting_cost, 2),
            urgent_surcharge=round(urgent_surcharge, 2),
            wastage_cost=round(material_cost * self.wastage_rate / (1 + self.wastage_rate), 2),
            total_cost=round(total_cost, 2),
            profit_margin=round(profit_margin, 2),
            quoted_price=round(quoted_price, 2)
        )
    
    def calculate_volume_discount(
        self,
        quoted_price: float,
        quantity: int
    ) -> Dict:
        discount_rate = 0.0
        discount_amount = 0.0
        
        if quantity >= 1000:
            discount_rate = 0.15
        elif quantity >= 500:
            discount_rate = 0.10
        elif quantity >= 200:
            discount_rate = 0.05
        
        if discount_rate > 0:
            discount_amount = quoted_price * discount_rate
        
        final_price = quoted_price - discount_amount
        
        return {
            'original_price': round(quoted_price, 2),
            'discount_rate': round(discount_rate * 100, 1),
            'discount_amount': round(discount_amount, 2),
            'final_price': round(final_price, 2)
        }
    
    def generate_quotation_summary(
        self,
        cost_breakdown: CostBreakdown,
        order_details: Dict,
        volume_discount: Dict = None
    ) -> Dict:
        summary = {
            'order_number': order_details.get('order_number'),
            'product_name': order_details.get('product_name'),
            'quantity': order_details.get('quantity'),
            'finished_size': order_details.get('finished_size'),
            'paper_info': order_details.get('paper_info'),
            'sheets_needed': order_details.get('sheets_needed'),
            'cutting_layout': order_details.get('cutting_layout'),
            
            'cost_breakdown': {
                'material_cost': cost_breakdown.material_cost,
                'labor_cost': cost_breakdown.labor_cost,
                'cutting_cost': cost_breakdown.cutting_cost,
                'urgent_surcharge': cost_breakdown.urgent_surcharge,
                'wastage_cost': cost_breakdown.wastage_cost,
                'total_cost': cost_breakdown.total_cost,
                'profit_margin': cost_breakdown.profit_margin,
            },
            
            'quoted_price': cost_breakdown.quoted_price,
            'is_urgent': order_details.get('is_urgent', False),
            'quotation_date': datetime.now().isoformat()
        }
        
        if volume_discount:
            summary['volume_discount'] = volume_discount
            summary['final_price'] = volume_discount.get('final_price', cost_breakdown.quoted_price)
        
        return summary
    
    @staticmethod
    def format_currency(amount: float) -> str:
        return f'¥{amount:.2f}'
    
    @staticmethod
    def format_percent(rate: float) -> str:
        return f'{rate * 100:.1f}%'
