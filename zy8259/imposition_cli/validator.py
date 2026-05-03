from datetime import date, datetime
from typing import List, Optional

from .models import (
    Order, Press, PaperStock, Configuration,
    ValidationResult, ValidationError, ColorMode
)
from .units import Dimension


class Validator:
    def __init__(self, config: Configuration):
        self.config = config
    
    def validate_order(self, order: Order, today: Optional[date] = None) -> ValidationResult:
        errors = []
        warnings = []
        
        if not order.order_id:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="order_id",
                message="订单ID不能为空",
                severity="error"
            ))
        
        if not order.product_name:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="product_name",
                message="产品名称不能为空",
                severity="error"
            ))
        
        if order.finished_size.width.to_mm() <= 0:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="width",
                message=f"成品宽度必须大于0，当前值: {order.finished_size.width.to_str()}",
                severity="error"
            ))
        
        if order.finished_size.height.to_mm() <= 0:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="height",
                message=f"成品高度必须大于0，当前值: {order.finished_size.height.to_str()}",
                severity="error"
            ))
        
        if order.bleed.to_mm() < 0:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="bleed",
                message=f"出血值不能为负数，当前值: {order.bleed.to_str()}",
                severity="error"
            ))
        elif order.bleed.to_mm() > 10:
            warnings.append(ValidationError(
                order_id=order.order_id,
                field="bleed",
                message=f"出血值 {order.bleed.to_str()} 较大，可能影响拼版效率",
                severity="warning"
            ))
        
        if order.quantity <= 0:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="quantity",
                message=f"数量必须大于0，当前值: {order.quantity}",
                severity="error"
            ))
        
        if today is None:
            today = date.today()
        
        if order.due_date < today:
            warnings.append(ValidationError(
                order_id=order.order_id,
                field="due_date",
                message=f"交期 {order.due_date} 已过（当前日期: {today}）",
                severity="warning"
            ))
        
        days_until_due = (order.due_date - today).days
        if days_until_due <= 1 and order.quantity > 10000:
            warnings.append(ValidationError(
                order_id=order.order_id,
                field="due_date",
                message=f"订单数量较大 ({order.quantity}) 但交期紧张（仅剩 {days_until_due} 天）",
                severity="warning"
            ))
        
        if not order.paper_type:
            errors.append(ValidationError(
                order_id=order.order_id,
                field="paper_type",
                message="纸张类型不能为空",
                severity="error"
            ))
        else:
            matching_stock = [s for s in self.config.paper_stock if s.paper_type == order.paper_type]
            if not matching_stock:
                warnings.append(ValidationError(
                    order_id=order.order_id,
                    field="paper_type",
                    message=f"纸张类型 '{order.paper_type}' 在库存中没有匹配项",
                    severity="warning"
                ))
        
        effective_size = order.effective_size
        can_print = False
        for press in self.config.presses.values():
            if (press.max_size.can_contain(effective_size) and 
                effective_size.width >= press.min_size.width and
                effective_size.height >= press.min_size.height):
                can_print = True
                break
        
        if not can_print and self.config.presses:
            warnings.append(ValidationError(
                order_id=order.order_id,
                field="size",
                message=f"成品尺寸（含出血: {effective_size.width.to_str()} x {effective_size.height.to_str()}）"
                        f" 可能超出所有机台的印刷范围",
                severity="warning"
            ))
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_all_orders(
        self, 
        orders: List[Order], 
        today: Optional[date] = None
    ) -> List[ValidationResult]:
        if today is None:
            today = date.today()
        
        results = []
        for order in orders:
            result = self.validate_order(order, today)
            results.append(result)
        
        return results
    
    def validate_configuration(self) -> ValidationResult:
        errors = []
        warnings = []
        
        if not self.config.presses:
            warnings.append(ValidationError(
                order_id="CONFIG",
                field="presses",
                message="没有配置印刷机台信息",
                severity="warning"
            ))
        
        for press_name, press in self.config.presses.items():
            if press.max_size.width <= press.min_size.width:
                errors.append(ValidationError(
                    order_id="CONFIG",
                    field=f"presses.{press_name}.width",
                    message=f"机台 {press_name} 最大宽度 ({press.max_size.width.to_str()}) "
                            f"小于等于最小宽度 ({press.min_size.width.to_str()})",
                    severity="error"
                ))
            
            if press.max_size.height <= press.min_size.height:
                errors.append(ValidationError(
                    order_id="CONFIG",
                    field=f"presses.{press_name}.height",
                    message=f"机台 {press_name} 最大高度 ({press.max_size.height.to_str()}) "
                            f"小于等于最小高度 ({press.min_size.height.to_str()})",
                    severity="error"
                ))
        
        if not self.config.paper_stock:
            warnings.append(ValidationError(
                order_id="CONFIG",
                field="paper_stock",
                message="没有配置纸张库存信息",
                severity="warning"
            ))
        
        if self.config.cut_rules is None:
            warnings.append(ValidationError(
                order_id="CONFIG",
                field="cut_rules",
                message="没有配置裁切规则，将使用默认值",
                severity="warning"
            ))
        
        if self.config.wastage_rules is None:
            warnings.append(ValidationError(
                order_id="CONFIG",
                field="wastage_rules",
                message="没有配置损耗规则，将使用默认值",
                severity="warning"
            ))
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
