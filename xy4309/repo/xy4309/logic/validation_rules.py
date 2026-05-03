#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
校验规则模块
包含过期预警、库存下限、同柜禁配、未归还超期等校验逻辑
"""

from datetime import date, timedelta
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from models import (
    Reagent, Cabinet, UsageRecord,
    ChemicalCategory, AlertType, Alert
)


@dataclass
class ValidationResult:
    """校验结果"""
    is_valid: bool
    alert_type: Optional[AlertType]
    message: str
    reagent_id: Optional[int] = None
    bottle_number: Optional[str] = None
    reagent_name: Optional[str] = None


class ValidationRules:
    """校验规则类"""
    
    # 禁配规则：哪些类别不能存放在同一柜位
    INCOMPATIBLE_RULES: Dict[ChemicalCategory, List[ChemicalCategory]] = {
        ChemicalCategory.ACID: [ChemicalCategory.BASE, ChemicalCategory.REDUCING, ChemicalCategory.CORROSIVE],
        ChemicalCategory.BASE: [ChemicalCategory.ACID, ChemicalCategory.REDUCING, ChemicalCategory.CORROSIVE],
        ChemicalCategory.OXIDIZING: [ChemicalCategory.REDUCING, ChemicalCategory.ORGANIC, ChemicalCategory.EXPLOSIVE],
        ChemicalCategory.REDUCING: [ChemicalCategory.OXIDIZING, ChemicalCategory.ACID, ChemicalCategory.BASE],
        ChemicalCategory.ORGANIC: [ChemicalCategory.OXIDIZING, ChemicalCategory.EXPLOSIVE],
        ChemicalCategory.EXPLOSIVE: [ChemicalCategory.OXIDIZING, ChemicalCategory.ORGANIC, ChemicalCategory.ACID],
        ChemicalCategory.TOXIC: [ChemicalCategory.ACID, ChemicalCategory.BASE],
        ChemicalCategory.CORROSIVE: [ChemicalCategory.ACID, ChemicalCategory.BASE, ChemicalCategory.REDUCING]
    }
    
    # 即将过期的天数阈值
    EXPIRING_SOON_DAYS = 30
    
    @classmethod
    def check_expired(cls, reagent: Reagent) -> ValidationResult:
        """
        检查试剂是否过期
        
        Args:
            reagent: 试剂对象
        
        Returns:
            校验结果
        """
        today = date.today()
        
        if reagent.expiration_date < today:
            return ValidationResult(
                is_valid=False,
                alert_type=AlertType.EXPIRED,
                message=f"试剂已过期，有效期至 {reagent.expiration_date.isoformat()}",
                reagent_id=reagent.id,
                bottle_number=reagent.bottle_number,
                reagent_name=reagent.name
            )
        
        # 检查是否即将过期
        days_until_expiry = (reagent.expiration_date - today).days
        if days_until_expiry <= cls.EXPIRING_SOON_DAYS and days_until_expiry >= 0:
            return ValidationResult(
                is_valid=False,
                alert_type=AlertType.EXPIRING_SOON,
                message=f"试剂即将过期，还有 {days_until_expiry} 天到期（有效期至 {reagent.expiration_date.isoformat()}）",
                reagent_id=reagent.id,
                bottle_number=reagent.bottle_number,
                reagent_name=reagent.name
            )
        
        return ValidationResult(
            is_valid=True,
            alert_type=None,
            message="试剂在有效期内",
            reagent_id=reagent.id,
            bottle_number=reagent.bottle_number,
            reagent_name=reagent.name
        )
    
    @classmethod
    def check_low_stock(cls, reagent: Reagent) -> ValidationResult:
        """
        检查试剂库存是否低于下限
        
        Args:
            reagent: 试剂对象
        
        Returns:
            校验结果
        """
        if reagent.quantity <= reagent.min_quantity:
            return ValidationResult(
                is_valid=False,
                alert_type=AlertType.LOW_STOCK,
                message=f"库存不足，当前数量: {reagent.quantity} {reagent.unit}，最低预警值: {reagent.min_quantity} {reagent.unit}",
                reagent_id=reagent.id,
                bottle_number=reagent.bottle_number,
                reagent_name=reagent.name
            )
        
        return ValidationResult(
            is_valid=True,
            alert_type=None,
            message="库存充足",
            reagent_id=reagent.id,
            bottle_number=reagent.bottle_number,
            reagent_name=reagent.name
        )
    
    @classmethod
    def check_incompatible(
        cls, 
        reagent: Reagent, 
        cabinet_reagents: List[Reagent]
    ) -> List[ValidationResult]:
        """
        检查试剂与同柜位其他试剂是否禁配
        
        Args:
            reagent: 待检查的试剂
            cabinet_reagents: 同一柜位的所有试剂（包含自身）
        
        Returns:
            校验结果列表
        """
        results: List[ValidationResult] = []
        
        # 过滤掉自身
        other_reagents = [r for r in cabinet_reagents if r.id != reagent.id]
        
        # 检查是否有禁配规则
        reagent_category = reagent.category
        incompatible_categories = cls.INCOMPATIBLE_RULES.get(reagent_category, [])
        
        for other in other_reagents:
            if other.category in incompatible_categories:
                # 检查双向禁配
                other_incompatible = cls.INCOMPATIBLE_RULES.get(other.category, [])
                if reagent_category in other_incompatible:
                    results.append(ValidationResult(
                        is_valid=False,
                        alert_type=AlertType.INCOMPATIBLE,
                        message=f"与柜位内的 '{other.name}'（{other.category.value}）禁配，"
                               f"{reagent_category.value} 与 {other.category.value} 不能存放在同一柜位",
                        reagent_id=reagent.id,
                        bottle_number=reagent.bottle_number,
                        reagent_name=reagent.name
                    ))
        
        return results
    
    @classmethod
    def check_overdue_return(cls, usage_record: UsageRecord) -> ValidationResult:
        """
        检查领用记录是否超期未归还
        
        Args:
            usage_record: 领用记录
        
        Returns:
            校验结果
        """
        # 只检查领用操作且未归还的
        if usage_record.operation_type != '领用' or usage_record.actual_return_date is not None:
            return ValidationResult(
                is_valid=True,
                alert_type=None,
                message="无超期未归还"
            )
        
        today = date.today()
        
        # 如果没有预计归还日期，也视为超期
        if usage_record.expected_return_date is None:
            return ValidationResult(
                is_valid=False,
                alert_type=AlertType.OVERDUE_RETURN,
                message="领用记录未设置预计归还日期",
                reagent_id=usage_record.reagent_id,
                bottle_number=usage_record.bottle_number
            )
        
        if usage_record.expected_return_date < today:
            days_overdue = (today - usage_record.expected_return_date).days
            return ValidationResult(
                is_valid=False,
                alert_type=AlertType.OVERDUE_RETURN,
                message=f"领用超期 {days_overdue} 天，预计归还日期: {usage_record.expected_return_date.isoformat()}",
                reagent_id=usage_record.reagent_id,
                bottle_number=usage_record.bottle_number
            )
        
        return ValidationResult(
            is_valid=True,
            alert_type=None,
            message="领用在期限内"
        )
    
    @classmethod
    def validate_reagent(
        cls, 
        reagent: Reagent, 
        cabinet_reagents: Optional[List[Reagent]] = None
    ) -> List[ValidationResult]:
        """
        全面校验单个试剂
        
        Args:
            reagent: 试剂对象
            cabinet_reagents: 同一柜位的所有试剂（用于禁配检查）
        
        Returns:
            校验结果列表
        """
        results: List[ValidationResult] = []
        
        # 检查过期
        expired_result = cls.check_expired(reagent)
        if not expired_result.is_valid:
            results.append(expired_result)
        
        # 检查库存
        low_stock_result = cls.check_low_stock(reagent)
        if not low_stock_result.is_valid:
            results.append(low_stock_result)
        
        # 检查禁配
        if cabinet_reagents:
            incompatible_results = cls.check_incompatible(reagent, cabinet_reagents)
            results.extend(incompatible_results)
        
        return results
    
    @classmethod
    def validate_all_reagents(
        cls, 
        reagents: List[Reagent],
        cabinets: List[Cabinet]
    ) -> Dict[int, List[ValidationResult]]:
        """
        校验所有试剂
        
        Args:
            reagents: 所有试剂列表
            cabinets: 所有柜位列表
        
        Returns:
            按柜位分组的校验结果
        """
        # 按柜位分组试剂
        cabinet_reagents: Dict[int, List[Reagent]] = {}
        
        # 初始化所有柜位
        for cabinet in cabinets:
            cabinet_reagents[cabinet.id] = []
        
        # 分配试剂到柜位
        for reagent in reagents:
            if reagent.cabinet_id and reagent.cabinet_id in cabinet_reagents:
                cabinet_reagents[reagent.cabinet_id].append(reagent)
        
        # 执行校验
        all_results: Dict[int, List[ValidationResult]] = {}
        
        for cabinet_id, reagents_list in cabinet_reagents.items():
            cabinet_results: List[ValidationResult] = []
            for reagent in reagents_list:
                reagent_results = cls.validate_reagent(reagent, reagents_list)
                cabinet_results.extend(reagent_results)
            if cabinet_results:
                all_results[cabinet_id] = cabinet_results
        
        return all_results
    
    @classmethod
    def validate_usage_records(cls, usage_records: List[UsageRecord]) -> List[ValidationResult]:
        """
        校验所有领用记录
        
        Args:
            usage_records: 领用记录列表
        
        Returns:
            校验结果列表
        """
        results: List[ValidationResult] = []
        
        for record in usage_records:
            result = cls.check_overdue_return(record)
            if not result.is_valid:
                results.append(result)
        
        return results
    
    @classmethod
    def get_incompatible_pairs(cls) -> List[Tuple[str, str]]:
        """
        获取所有禁配对列表（用于显示）
        
        Returns:
            禁配对列表，每个元素是 (类别1, 类别2)
        """
        pairs: List[Tuple[str, str]] = []
        added_pairs = set()
        
        for cat1, incompatible_list in cls.INCOMPATIBLE_RULES.items():
            for cat2 in incompatible_list:
                # 确保只添加一次，避免重复
                pair_key = tuple(sorted([cat1.value, cat2.value]))
                if pair_key not in added_pairs:
                    # 验证双向禁配
                    if cat1 in cls.INCOMPATIBLE_RULES.get(cat2, []):
                        pairs.append((cat1.value, cat2.value))
                        added_pairs.add(pair_key)
        
        return pairs
