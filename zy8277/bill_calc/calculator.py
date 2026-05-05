# -*- coding: utf-8 -*-
from decimal import Decimal, ROUND_HALF_UP, ROUND_UP, ROUND_DOWN, ROUND_CEILING, ROUND_FLOOR
from typing import List, Dict, Any, Optional, Tuple
from .models import (
    Bill, BillLineItem, DiscountRule, RoundingProfile,
    RoundingMode, DiscountType, DiscountApplication, CalculationResult
)


class RoundingService:
    """取整服务，支持多种取整策略"""
    
    @staticmethod
    def round_amount(
        amount: Decimal, 
        mode: RoundingMode, 
        precision: int = 2
    ) -> Decimal:
        """
        根据指定的取整模式和精度对金额进行取整
        
        Args:
            amount: 需要取整的金额
            mode: 取整模式
            precision: 精度（小数位数）
        
        Returns:
            取整后的金额
        """
        if amount == 0:
            return Decimal(0)
        
        # 构建取整量化器，例如 '0.01' 表示精确到分
        quantizer = Decimal(f'0.{"0" * precision}')
        
        if mode == RoundingMode.ROUND_HALF_UP:
            return amount.quantize(quantizer, rounding=ROUND_HALF_UP)
        elif mode == RoundingMode.CEIL:
            return amount.quantize(quantizer, rounding=ROUND_CEILING)
        elif mode == RoundingMode.FLOOR:
            return amount.quantize(quantizer, rounding=ROUND_FLOOR)
        elif mode == RoundingMode.ROUND_UP:
            return amount.quantize(quantizer, rounding=ROUND_UP)
        elif mode == RoundingMode.ROUND_DOWN:
            return amount.quantize(quantizer, rounding=ROUND_DOWN)
        else:
            # 默认使用 ROUND_HALF_UP
            return amount.quantize(quantizer, rounding=ROUND_HALF_UP)
    
    @staticmethod
    def round_line_item(
        line: BillLineItem, 
        profile: RoundingProfile
    ) -> BillLineItem:
        """对行级项目进行取整"""
        # 行级折扣取整
        line.discount_amount = RoundingService.round_amount(
            line.discount_amount,
            profile.line_level_mode,
            profile.line_level_precision
        )
        
        # 税费取整
        line.tax_amount = RoundingService.round_amount(
            line.tax_amount,
            profile.tax_rounding_mode,
            profile.tax_rounding_precision
        )
        
        # 服务费取整
        line.service_fee_amount = RoundingService.round_amount(
            line.service_fee_amount,
            profile.line_level_mode,
            profile.line_level_precision
        )
        
        # 行总额取整
        line.line_total = RoundingService.round_amount(
            line.line_total,
            profile.line_level_mode,
            profile.line_level_precision
        )
        
        return line
    
    @staticmethod
    def round_order_level(
        bill: Bill, 
        profile: RoundingProfile
    ) -> Bill:
        """对整单级项目进行取整"""
        bill.total_subtotal = RoundingService.round_amount(
            bill.total_subtotal,
            profile.order_level_mode,
            profile.order_level_precision
        )
        
        bill.total_discount = RoundingService.round_amount(
            bill.total_discount,
            profile.order_level_mode,
            profile.order_level_precision
        )
        
        bill.total_tax = RoundingService.round_amount(
            bill.total_tax,
            profile.order_level_mode,
            profile.order_level_precision
        )
        
        bill.total_service_fee = RoundingService.round_amount(
            bill.total_service_fee,
            profile.order_level_mode,
            profile.order_level_precision
        )
        
        bill.grand_total = RoundingService.round_amount(
            bill.grand_total,
            profile.order_level_mode,
            profile.order_level_precision
        )
        
        return bill


class DiscountService:
    """折扣计算服务"""
    
    @staticmethod
    def calculate_line_discount(
        line: BillLineItem,
        discount: DiscountRule,
        application_order: DiscountApplication
    ) -> Tuple[Decimal, str]:
        """
        计算单行项目的折扣金额
        
        Args:
            line: 行项目
            discount: 折扣规则
            application_order: 折扣应用时机（税前/税后）
        
        Returns:
            (折扣金额, 计算说明)
        """
        # 检查折扣是否适用于当前行
        if not discount.applicable_to_all:
            if discount.applicable_line_ids and line.id not in discount.applicable_line_ids:
                return Decimal(0), f"折扣 {discount.id} 不适用于行 {line.id}"
        
        # 计算基数
        base_amount = line.subtotal
        
        # 检查折扣是否超过小计
        if discount.type == DiscountType.FIXED_AMOUNT:
            if discount.value > base_amount:
                return base_amount, f"折扣 {discount.id} 金额 {discount.value} 超过行小计 {base_amount}，已截断至小计金额"
        
        # 根据折扣类型计算
        if discount.type == DiscountType.PERCENTAGE:
            discount_amount = base_amount * (discount.value / Decimal(100))
            description = f"行 {line.id}({line.name}): {discount.value}% 折扣 = {discount_amount}"
        elif discount.type == DiscountType.FIXED_AMOUNT:
            discount_amount = discount.value
            description = f"行 {line.id}({line.name}): 固定金额折扣 {discount.value}"
        else:
            discount_amount = Decimal(0)
            description = f"未知折扣类型: {discount.type}"
        
        return discount_amount, description


class BillCalculator:
    """账单计算器"""
    
    def __init__(self, rounding_profiles: Dict[str, RoundingProfile]):
        self.rounding_profiles = rounding_profiles
    
    def calculate(
        self, 
        bill: Bill, 
        discounts: List[DiscountRule],
        expected_total: Optional[Decimal] = None
    ) -> CalculationResult:
        """
        计算账单
        
        Args:
            bill: 账单对象
            discounts: 折扣规则列表
            expected_total: 预期总金额（用于比较）
        
        Returns:
            计算结果
        """
        steps = []
        validation_errors = []
        
        # 获取取整配置
        profile = self.rounding_profiles.get(bill.rounding_profile_id)
        if not profile:
            # 使用默认配置
            profile = RoundingProfile(
                id="default",
                name="默认取整配置"
            )
            validation_errors.append(
                f"警告: 未找到取整配置 '{bill.rounding_profile_id}'，使用默认配置"
            )
        
        # 1. 计算各行小计
        steps.append({"step": "计算各行小计", "details": []})
        for line in bill.lines:
            line.subtotal = line.unit_price * Decimal(line.quantity)
            steps[-1]["details"].append({
                "line_id": line.id,
                "line_name": line.name,
                "subtotal": f"{line.quantity} × {line.unit_price} = {line.subtotal}"
            })
        
        # 2. 计算行级折扣（税前折扣）
        pre_tax_discounts = [d for d in discounts if d.application == DiscountApplication.PRE_TAX]
        if pre_tax_discounts:
            steps.append({"step": "计算税前折扣", "details": []})
            for line in bill.lines:
                line_discounts = [d for d in pre_tax_discounts if 
                    d.applicable_to_all or line.id in d.applicable_line_ids]
                
                # 按优先级排序
                line_discounts.sort(key=lambda d: d.priority)
                
                total_line_discount = Decimal(0)
                for discount in line_discounts:
                    discount_amount, desc = DiscountService.calculate_line_discount(
                        line, discount, DiscountApplication.PRE_TAX
                    )
                    total_line_discount += discount_amount
                    steps[-1]["details"].append(desc)
                
                line.discount_amount = total_line_discount
        
        # 3. 计算税费
        steps.append({"step": "计算税费", "details": []})
        for line in bill.lines:
            if line.is_tax_exempt:
                line.tax_amount = Decimal(0)
                steps[-1]["details"].append(f"行 {line.id}({line.name}): 免税项目，税费 = 0")
            else:
                # 税基 = 小计 - 税前折扣
                tax_base = line.subtotal - line.discount_amount
                if tax_base < 0:
                    tax_base = Decimal(0)
                    validation_errors.append(
                        f"警告: 行 {line.id} 税基为负数，已重置为 0"
                    )
                
                line.tax_amount = tax_base * (line.tax_rate / Decimal(100))
                steps[-1]["details"].append(
                    f"行 {line.id}({line.name}): 税基 {tax_base} × 税率 {line.tax_rate}% = {line.tax_amount}"
                )
        
        # 4. 计算行级折扣（税后折扣）
        post_tax_discounts = [d for d in discounts if d.application == DiscountApplication.POST_TAX]
        if post_tax_discounts:
            steps.append({"step": "计算税后折扣", "details": []})
            for line in bill.lines:
                line_discounts = [d for d in post_tax_discounts if 
                    d.applicable_to_all or line.id in d.applicable_line_ids]
                
                # 按优先级排序
                line_discounts.sort(key=lambda d: d.priority)
                
                additional_discount = Decimal(0)
                for discount in line_discounts:
                    # 税后折扣基数 = 小计 - 税前折扣 + 税费
                    base = line.subtotal - line.discount_amount + line.tax_amount
                    
                    if discount.type == DiscountType.PERCENTAGE:
                        discount_amount = base * (discount.value / Decimal(100))
                    else:  # FIXED_AMOUNT
                        discount_amount = discount.value
                    
                    # 检查折扣是否超过可用金额
                    available = base - additional_discount
                    if discount_amount > available:
                        discount_amount = available
                        validation_errors.append(
                            f"警告: 行 {line.id} 税后折扣超过可用金额，已截断"
                        )
                    
                    additional_discount += discount_amount
                    steps[-1]["details"].append(
                        f"行 {line.id}({line.name}): 税后折扣 {discount.value} = {discount_amount}"
                    )
                
                line.discount_amount += additional_discount
        
        # 5. 计算服务费
        steps.append({"step": "计算服务费", "details": []})
        for line in bill.lines:
            if line.service_fee_rate and line.service_fee_rate > 0:
                # 服务费基数 = 小计 - 折扣 + 税费
                service_fee_base = line.subtotal - line.discount_amount + line.tax_amount
                if service_fee_base < 0:
                    service_fee_base = Decimal(0)
                
                line.service_fee_amount = service_fee_base * (line.service_fee_rate / Decimal(100))
                steps[-1]["details"].append(
                    f"行 {line.id}({line.name}): 服务费基数 {service_fee_base} × 费率 {line.service_fee_rate}% = {line.service_fee_amount}"
                )
            else:
                line.service_fee_amount = Decimal(0)
        
        # 6. 行级取整
        steps.append({"step": "行级取整", "details": []})
        for line in bill.lines:
            # 计算行总额（取整前）
            line.line_total = line.subtotal - line.discount_amount + line.tax_amount + line.service_fee_amount
            
            # 记录取整前的值
            before_rounding = line.line_total
            
            # 应用行级取整
            line = RoundingService.round_line_item(line, profile)
            
            steps[-1]["details"].append(
                f"行 {line.id}({line.name}): 取整前 {before_rounding} → 取整后 {line.line_total} "
                f"(模式: {profile.line_level_mode.value}, 精度: {profile.line_level_precision})"
            )
        
        # 7. 计算整单汇总
        steps.append({"step": "计算整单汇总", "details": []})
        bill.total_subtotal = sum(line.subtotal for line in bill.lines)
        bill.total_discount = sum(line.discount_amount for line in bill.lines)
        bill.total_tax = sum(line.tax_amount for line in bill.lines)
        bill.total_service_fee = sum(line.service_fee_amount for line in bill.lines)
        bill.grand_total = sum(line.line_total for line in bill.lines)
        
        steps[-1]["details"].append({
            "total_subtotal": f"{bill.total_subtotal}",
            "total_discount": f"{bill.total_discount}",
            "total_tax": f"{bill.total_tax}",
            "total_service_fee": f"{bill.total_service_fee}",
            "grand_total": f"{bill.grand_total}"
        })
        
        # 8. 整单级取整
        steps.append({"step": "整单级取整", "details": []})
        
        # 记录取整前的值
        before_grand_total = bill.grand_total
        
        # 应用整单级取整
        bill = RoundingService.round_order_level(bill, profile)
        
        steps[-1]["details"].append(
            f"整单取整: 取整前 {before_grand_total} → 取整后 {bill.grand_total} "
            f"(模式: {profile.order_level_mode.value}, 精度: {profile.order_level_precision})"
        )
        
        # 9. 验证计算结果
        # 检查折扣是否超过小计
        total_subtotal_after_discount = bill.total_subtotal - bill.total_discount
        if total_subtotal_after_discount < 0:
            validation_errors.append(
                f"错误: 总折扣 {bill.total_discount} 超过总小计 {bill.total_subtotal}"
            )
        
        # 检查最终总额是否合理
        if bill.grand_total < 0:
            validation_errors.append(
                f"错误: 最终总额 {bill.grand_total} 为负数"
            )
        
        # 构建计算结果
        is_valid = len([e for e in validation_errors if e.startswith("错误:")]) == 0
        
        result = CalculationResult(
            bill=bill,
            calculation_steps=steps,
            rounding_profile=profile,
            is_valid=is_valid,
            validation_errors=validation_errors
        )
        
        return result
