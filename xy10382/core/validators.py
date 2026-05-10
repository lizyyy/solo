from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from collections import defaultdict

from models import Farmer, Sale, Payment, ReturnItem, Deduction


@dataclass
class ValidationResult:
    valid: bool
    errors: List[str]
    warnings: List[str]
    raw_input: Optional[str] = None


class Validator:
    def __init__(self, storage):
        self.storage = storage

    def validate_payment(self, payment: Payment, raw_input: str = None) -> ValidationResult:
        errors = []
        warnings = []

        if not payment.farmer_id:
            errors.append('缺少农户ID')
        else:
            farmer = self.storage.get_farmer_by_id(payment.farmer_id)
            if not farmer:
                errors.append(f'农户不存在: {payment.farmer_id}')

        if payment.amount <= 0:
            errors.append('回款金额必须大于0')

        if not payment.payment_date:
            errors.append('缺少回款日期')
        else:
            try:
                datetime.strptime(payment.payment_date, '%Y-%m-%d')
            except ValueError:
                errors.append(f'日期格式错误: {payment.payment_date}，应为 YYYY-MM-DD')

        if payment.receipt_no:
            existing = self.storage.get_payment_by_receipt(payment.receipt_no)
            if existing and existing.id != payment.id:
                errors.append(f'收据号已存在: {payment.receipt_no}，重复导入不会重复冲账')

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            raw_input=raw_input
        )

    def validate_return(self, return_item: ReturnItem, raw_input: str = None) -> ValidationResult:
        errors = []
        warnings = []

        if not return_item.farmer_id:
            errors.append('缺少农户ID')
        else:
            farmer = self.storage.get_farmer_by_id(return_item.farmer_id)
            if not farmer:
                errors.append(f'农户不存在: {return_item.farmer_id}')

        if not return_item.sale_id:
            errors.append('缺少原赊销单ID')
        else:
            sale = self.storage.get_sale_by_id(return_item.sale_id)
            if not sale:
                errors.append(f'原赊销单不存在: {return_item.sale_id}')
            else:
                sale_item = next(
                    (item for item in sale.items if item.product_name == return_item.product_name),
                    None
                )
                if not sale_item:
                    errors.append(f'原赊销单中未找到商品: {return_item.product_name}')
                else:
                    existing_returns = self.storage.get_returns_by_sale(return_item.sale_id)
                    same_product_returns = [
                        r for r in existing_returns 
                        if r.product_name == return_item.product_name and r.id != return_item.id
                    ]
                    total_returned = sum(r.quantity for r in same_product_returns) + return_item.quantity
                    if total_returned > sale_item.quantity:
                        errors.append(
                            f'退货数量超过原销售数量: 商品={return_item.product_name}, '
                            f'原销售数量={sale_item.quantity}, 已退货={sum(r.quantity for r in same_product_returns)}, '
                            f'本次退货={return_item.quantity}, 合计={total_returned}'
                        )

        if return_item.quantity <= 0:
            errors.append('退货数量必须大于0')

        if return_item.unit_price <= 0:
            errors.append('退货单价必须大于0')

        if not return_item.return_date:
            errors.append('缺少退货日期')
        else:
            try:
                datetime.strptime(return_item.return_date, '%Y-%m-%d')
            except ValueError:
                errors.append(f'日期格式错误: {return_item.return_date}，应为 YYYY-MM-DD')

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            raw_input=raw_input
        )

    def validate_deduction(self, deduction: Deduction, raw_input: str = None) -> ValidationResult:
        errors = []
        warnings = []

        if not deduction.farmer_id:
            errors.append('缺少农户ID')
        else:
            farmer = self.storage.get_farmer_by_id(deduction.farmer_id)
            if not farmer:
                errors.append(f'农户不存在: {deduction.farmer_id}')

        if deduction.amount <= 0:
            errors.append('抵扣金额必须大于0')

        if not deduction.evidence:
            errors.append('缺少抵扣凭证: 抵扣操作必须提供凭证号或说明')

        if not deduction.deduction_date:
            errors.append('缺少抵扣日期')
        else:
            try:
                datetime.strptime(deduction.deduction_date, '%Y-%m-%d')
            except ValueError:
                errors.append(f'日期格式错误: {deduction.deduction_date}，应为 YYYY-MM-DD')

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            raw_input=raw_input
        )

    def validate_sale(self, sale: Sale, raw_input: str = None) -> ValidationResult:
        errors = []
        warnings = []

        if not sale.farmer_id:
            errors.append('缺少农户ID')
        else:
            farmer = self.storage.get_farmer_by_id(sale.farmer_id)
            if not farmer:
                errors.append(f'农户不存在: {sale.farmer_id}')

        if not sale.items:
            errors.append('赊销单至少需要一个商品')

        for item in sale.items:
            if item.quantity <= 0:
                errors.append(f'商品 {item.product_name} 数量必须大于0')
            if item.unit_price <= 0:
                errors.append(f'商品 {item.product_name} 单价必须大于0')

        if not sale.sale_date:
            errors.append('缺少赊销日期')
        else:
            try:
                datetime.strptime(sale.sale_date, '%Y-%m-%d')
            except ValueError:
                errors.append(f'日期格式错误: {sale.sale_date}，应为 YYYY-MM-DD')

        if sale.due_date:
            try:
                due = datetime.strptime(sale.due_date, '%Y-%m-%d')
                sale_dt = datetime.strptime(sale.sale_date, '%Y-%m-%d')
                if due < sale_dt:
                    warnings.append('到期日期早于赊销日期')
            except ValueError:
                errors.append(f'到期日期格式错误: {sale.due_date}，应为 YYYY-MM-DD')

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            raw_input=raw_input
        )

    def validate_farmer(self, farmer: Farmer, raw_input: str = None) -> ValidationResult:
        errors = []
        warnings = []

        if not farmer.name:
            errors.append('缺少农户姓名')

        if not farmer.phone:
            warnings.append('缺少联系电话')

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            raw_input=raw_input
        )
