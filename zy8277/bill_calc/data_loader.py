# -*- coding: utf-8 -*-
import yaml
import json
import csv
from decimal import Decimal
from typing import List, Dict, Any, Optional
from pathlib import Path
from .models import (
    Bill, BillLineItem, DiscountRule, TaxRule, RoundingProfile,
    RoundingMode, DiscountType, DiscountApplication
)


class DataLoader:
    """数据加载器，用于读取各种配置文件"""
    
    @staticmethod
    def load_yaml(file_path: str) -> Dict[str, Any]:
        """加载 YAML 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @staticmethod
    def load_json(file_path: str) -> Dict[str, Any]:
        """加载 JSON 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def load_csv(file_path: str) -> List[Dict[str, str]]:
        """加载 CSV 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
    
    @staticmethod
    def parse_bills(file_path: str) -> List[Bill]:
        """
        解析账单文件 (bills.yaml)
        
        格式示例:
        bills:
          - id: "bill-001"
            order_id: "order-2024-001"
            currency: "CNY"
            rounding_profile_id: "standard"
            lines:
              - id: "line-1"
                name: "商品A"
                quantity: 2
                unit_price: 100.00
                tax_rate: 13
                is_tax_exempt: false
                service_fee_rate: 1.5
        """
        data = DataLoader.load_yaml(file_path)
        bills_data = data.get('bills', [])
        
        bills = []
        for bill_data in bills_data:
            lines = []
            for line_data in bill_data.get('lines', []):
                line = BillLineItem(
                    id=str(line_data.get('id', '')),
                    name=str(line_data.get('name', '')),
                    quantity=int(line_data.get('quantity', 0)),
                    unit_price=Decimal(str(line_data.get('unit_price', '0'))),
                    tax_rate=Decimal(str(line_data.get('tax_rate', '0'))),
                    is_tax_exempt=bool(line_data.get('is_tax_exempt', False)),
                    service_fee_rate=Decimal(str(line_data.get('service_fee_rate', '0'))) if line_data.get('service_fee_rate') else None,
                    discounts=[str(d) for d in line_data.get('discounts', [])]
                )
                lines.append(line)
            
            bill = Bill(
                id=str(bill_data.get('id', '')),
                order_id=str(bill_data.get('order_id', '')),
                lines=lines,
                currency=str(bill_data.get('currency', 'CNY')),
                rounding_profile_id=str(bill_data.get('rounding_profile_id', 'default')),
                discounts=[str(d) for d in bill_data.get('discounts', [])],
                notes=str(bill_data.get('notes', '')) if bill_data.get('notes') else None
            )
            bills.append(bill)
        
        return bills
    
    @staticmethod
    def parse_discounts(file_path: str) -> List[DiscountRule]:
        """
        解析折扣文件 (discounts.csv)
        
        格式示例:
        id,name,type,value,application,priority,applicable_to_all,applicable_line_ids
        disc-001,新用户立减,FIXED_AMOUNT,20,PRE_TAX,1,true,
        disc-002,会员折扣,PERCENTAGE,10,POST_TAX,2,true,
        """
        rows = DataLoader.load_csv(file_path)
        
        discounts = []
        for row in rows:
            discount_type = DiscountType[row['type'].upper()] if row.get('type') else DiscountType.PERCENTAGE
            application = DiscountApplication[row['application'].upper()] if row.get('application') else DiscountApplication.PRE_TAX
            
            applicable_line_ids = []
            if row.get('applicable_line_ids'):
                applicable_line_ids = [x.strip() for x in row['applicable_line_ids'].split(',') if x.strip()]
            
            discount = DiscountRule(
                id=str(row.get('id', '')),
                name=str(row.get('name', '')),
                type=discount_type,
                value=Decimal(str(row.get('value', '0'))),
                application=application,
                priority=int(row.get('priority', '0')),
                applicable_to_all=row.get('applicable_to_all', 'true').lower() == 'true',
                applicable_line_ids=applicable_line_ids
            )
            discounts.append(discount)
        
        return discounts
    
    @staticmethod
    def parse_tax_rules(file_path: str) -> List[TaxRule]:
        """
        解析税率规则文件 (tax-rules.json)
        
        格式示例:
        {
            "tax_rules": [
                {
                    "id": "tax-13",
                    "name": "一般纳税人税率",
                    "rate": 13,
                    "categories": ["电子产品", "服装"],
                    "is_default": false
                },
                {
                    "id": "tax-0",
                    "name": "零税率",
                    "rate": 0,
                    "categories": ["出口商品"],
                    "is_default": false
                }
            ]
        }
        """
        data = DataLoader.load_json(file_path)
        tax_rules_data = data.get('tax_rules', [])
        
        tax_rules = []
        for rule_data in tax_rules_data:
            tax_rule = TaxRule(
                id=str(rule_data.get('id', '')),
                name=str(rule_data.get('name', '')),
                rate=Decimal(str(rule_data.get('rate', '0'))),
                categories=[str(c) for c in rule_data.get('categories', [])],
                is_default=bool(rule_data.get('is_default', False))
            )
            tax_rules.append(tax_rule)
        
        return tax_rules
    
    @staticmethod
    def parse_rounding_profiles(file_path: str) -> Dict[str, RoundingProfile]:
        """
        解析取整配置文件 (rounding-profiles.json)
        
        格式示例:
        {
            "rounding_profiles": [
                {
                    "id": "standard",
                    "name": "标准取整配置",
                    "line_level_mode": "ROUND_HALF_UP",
                    "line_level_precision": 2,
                    "order_level_mode": "ROUND_HALF_UP",
                    "order_level_precision": 2,
                    "tax_rounding_mode": "ROUND_HALF_UP",
                    "tax_rounding_precision": 2
                },
                {
                    "id": "aggressive",
                    "name": "进取型取整（向上取整）",
                    "line_level_mode": "CEIL",
                    "line_level_precision": 2,
                    "order_level_mode": "CEIL",
                    "order_level_precision": 2,
                    "tax_rounding_mode": "CEIL",
                    "tax_rounding_precision": 2
                }
            ]
        }
        """
        data = DataLoader.load_json(file_path)
        profiles_data = data.get('rounding_profiles', [])
        
        profiles = {}
        for profile_data in profiles_data:
            profile = RoundingProfile(
                id=str(profile_data.get('id', 'default')),
                name=str(profile_data.get('name', '默认配置')),
                line_level_mode=RoundingMode[profile_data.get('line_level_mode', 'ROUND_HALF_UP').upper()],
                line_level_precision=int(profile_data.get('line_level_precision', 2)),
                order_level_mode=RoundingMode[profile_data.get('order_level_mode', 'ROUND_HALF_UP').upper()],
                order_level_precision=int(profile_data.get('order_level_precision', 2)),
                tax_rounding_mode=RoundingMode[profile_data.get('tax_rounding_mode', 'ROUND_HALF_UP').upper()],
                tax_rounding_precision=int(profile_data.get('tax_rounding_precision', 2))
            )
            profiles[profile.id] = profile
        
        # 确保有默认配置
        if 'default' not in profiles:
            profiles['default'] = RoundingProfile(
                id="default",
                name="默认取整配置"
            )
        
        return profiles


class DataValidator:
    """数据验证器"""
    
    @staticmethod
    def validate_bill(bill: Bill) -> List[str]:
        """验证账单数据"""
        errors = []
        
        # 检查必填字段
        if not bill.id:
            errors.append("账单缺少必填字段: id")
        if not bill.order_id:
            errors.append(f"账单 {bill.id} 缺少必填字段: order_id")
        if not bill.lines or len(bill.lines) == 0:
            errors.append(f"账单 {bill.id} 没有任何行项目")
        
        # 验证每行项目
        for line in bill.lines:
            line_errors = DataValidator.validate_line_item(line, bill.id)
            errors.extend(line_errors)
        
        return errors
    
    @staticmethod
    def validate_line_item(line: BillLineItem, bill_id: str) -> List[str]:
        """验证行项目数据"""
        errors = []
        
        # 检查必填字段
        if not line.id:
            errors.append(f"账单 {bill_id} 中的行项目缺少必填字段: id")
        if not line.name:
            errors.append(f"账单 {bill_id} 行 {line.id} 缺少必填字段: name")
        if line.quantity <= 0:
            errors.append(f"账单 {bill_id} 行 {line.id} 数量必须大于 0，当前值: {line.quantity}")
        if line.unit_price < 0:
            errors.append(f"账单 {bill_id} 行 {line.id} 单价不能为负数，当前值: {line.unit_price}")
        if line.tax_rate < 0:
            errors.append(f"账单 {bill_id} 行 {line.id} 税率不能为负数，当前值: {line.tax_rate}")
        if line.service_fee_rate is not None and line.service_fee_rate < 0:
            errors.append(f"账单 {bill_id} 行 {line.id} 服务费率不能为负数，当前值: {line.service_fee_rate}")
        
        return errors
    
    @staticmethod
    def validate_discount(discount: DiscountRule) -> List[str]:
        """验证折扣规则"""
        errors = []
        
        if not discount.id:
            errors.append("折扣规则缺少必填字段: id")
        if not discount.name:
            errors.append(f"折扣规则 {discount.id} 缺少必填字段: name")
        if discount.value < 0:
            errors.append(f"折扣规则 {discount.id} 值不能为负数，当前值: {discount.value}")
        
        # 百分比折扣不能超过 100%
        if discount.type == DiscountType.PERCENTAGE and discount.value > 100:
            errors.append(f"折扣规则 {discount.id} 百分比折扣不能超过 100%，当前值: {discount.value}")
        
        return errors
    
    @staticmethod
    def validate_tax_rule(tax_rule: TaxRule) -> List[str]:
        """验证税率规则"""
        errors = []
        
        if not tax_rule.id:
            errors.append("税率规则缺少必填字段: id")
        if not tax_rule.name:
            errors.append(f"税率规则 {tax_rule.id} 缺少必填字段: name")
        if tax_rule.rate < 0:
            errors.append(f"税率规则 {tax_rule.id} 税率不能为负数，当前值: {tax_rule.rate}")
        if tax_rule.rate > 100:
            errors.append(f"税率规则 {tax_rule.id} 税率不能超过 100%，当前值: {tax_rule.rate}")
        
        return errors
    
    @staticmethod
    def validate_rounding_profile(profile: RoundingProfile) -> List[str]:
        """验证取整配置"""
        errors = []
        
        if not profile.id:
            errors.append("取整配置缺少必填字段: id")
        if not profile.name:
            errors.append(f"取整配置 {profile.id} 缺少必填字段: name")
        
        # 验证精度
        if profile.line_level_precision < 0:
            errors.append(f"取整配置 {profile.id} 行级精度不能为负数")
        if profile.order_level_precision < 0:
            errors.append(f"取整配置 {profile.id} 整单级精度不能为负数")
        if profile.tax_rounding_precision < 0:
            errors.append(f"取整配置 {profile.id} 税费取整精度不能为负数")
        
        return errors
    
    @staticmethod
    def validate_tax_rules_conflict(tax_rules: List[TaxRule]) -> List[str]:
        """检查税率配置冲突"""
        errors = []
        
        # 检查是否有多个默认税率
        default_rules = [r for r in tax_rules if r.is_default]
        if len(default_rules) > 1:
            errors.append(
                f"税率配置冲突: 存在多个默认税率规则: {', '.join([r.id for r in default_rules])}"
            )
        
        # 检查同一分类是否有多个税率
        category_rules: Dict[str, List[str]] = {}
        for rule in tax_rules:
            for category in rule.categories:
                if category not in category_rules:
                    category_rules[category] = []
                category_rules[category].append(rule.id)
        
        for category, rule_ids in category_rules.items():
            if len(rule_ids) > 1:
                errors.append(
                    f"税率配置冲突: 分类 '{category}' 被多个税率规则引用: {', '.join(rule_ids)}"
                )
        
        return errors
