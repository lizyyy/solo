"""
解析校验模块 - 负责 CSV/YAML 文件解析和数据校验
"""

import csv
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import yaml

from .models import (
    AllergenRule,
    AllergenType,
    Formula,
    FormulaIngredient,
    IFRARule,
    RawMaterial,
    RawMaterialBatch,
    RuleSet,
    Unit,
)


class ParserError(Exception):
    """解析错误"""
    pass


class ValidationError(Exception):
    """数据校验错误"""
    pass


class CSVParser:
    """CSV 文件解析器"""
    
    @staticmethod
    def parse_formula(file_path: str) -> Formula:
        """
        解析配方 CSV 文件
        
        预期格式:
        formula_id,formula_name,formula_version,formula_created_date,formula_total_amount,formula_unit,formula_notes,ingredient_raw_material_id,ingredient_amount,ingredient_unit,ingredient_batch_number,ingredient_notes
        F001,玫瑰花香水,1.0,2024-01-15,100.0,g,经典玫瑰配方,,,,,
        F001,,,,,,,RM001,15.0,g,BATCH001,玫瑰精油 - 保加利亚
        ...
        
        说明:
        - 第一行：统一的表头
        - 第二行：配方元数据（ingredient_ 前缀的字段为空）
        - 后续行：原料数据（配方字段可以重复或留空）
        """
        if not os.path.exists(file_path):
            raise ParserError(f"配方文件不存在: {file_path}")
        
        formula_info = None
        ingredients: List[FormulaIngredient] = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 检查是否是原料行（有 ingredient_raw_material_id）
                ingredient_id = row.get('ingredient_raw_material_id', '').strip()
                if ingredient_id:
                    # 原料行
                    try:
                        amount_str = row.get('ingredient_amount', '').strip()
                        unit_str = row.get('ingredient_unit', '').strip()
                        
                        if not amount_str or not unit_str:
                            continue  # 跳过不完整的原料行
                        
                        ingredient = FormulaIngredient(
                            raw_material_id=ingredient_id,
                            amount=float(amount_str),
                            unit=Unit.from_string(unit_str),
                            batch_number=row.get('ingredient_batch_number', '').strip() or None,
                            notes=row.get('ingredient_notes', '').strip() or None,
                        )
                        ingredients.append(ingredient)
                    except (ValueError, KeyError) as e:
                        raise ParserError(f"解析原料行失败: {row}. 错误: {e}")
                elif not formula_info:
                    # 配方元数据行（第一个非空行）
                    formula_info = row
        
        if formula_info is None:
            raise ParserError(f"配方文件中未找到配方元数据: {file_path}")
        
        try:
            # 解析配方元数据
            created_date_str = formula_info.get('formula_created_date', '').strip()
            if created_date_str:
                created_date = datetime.strptime(created_date_str, '%Y-%m-%d').date()
            else:
                created_date = date.today()
            
            formula_id = formula_info.get('formula_id', '').strip()
            formula_name = formula_info.get('formula_name', '').strip()
            formula_version = formula_info.get('formula_version', '1.0').strip()
            total_amount_str = formula_info.get('formula_total_amount', '').strip()
            unit_str = formula_info.get('formula_unit', '').strip()
            notes = formula_info.get('formula_notes', '').strip() or None
            
            if not formula_id:
                raise ValueError("formula_id 不能为空")
            if not formula_name:
                raise ValueError("formula_name 不能为空")
            if not total_amount_str:
                raise ValueError("formula_total_amount 不能为空")
            if not unit_str:
                raise ValueError("formula_unit 不能为空")
            
            formula = Formula(
                id=formula_id,
                name=formula_name,
                version=formula_version,
                created_date=created_date,
                total_amount=float(total_amount_str),
                unit=Unit.from_string(unit_str),
                ingredients=ingredients,
                notes=notes,
            )
            return formula
        except (ValueError, KeyError) as e:
            raise ParserError(f"解析配方元数据失败: {e}")
    
    @staticmethod
    def parse_raw_materials(file_path: str) -> List[RawMaterial]:
        """
        解析原料基础信息 CSV 文件
        
        预期格式:
        id,name,cas_number,molecular_weight,density,flash_point,allergens,is_ethanol,is_fragrance,unit_cost
        RM001,玫瑰精油,...,linalool;limonene,False,True,0.5
        """
        if not os.path.exists(file_path):
            raise ParserError(f"原料文件不存在: {file_path}")
        
        materials: List[RawMaterial] = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    # 解析过敏原列表
                    allergens_str = row.get('allergens', '').strip()
                    allergens: List[AllergenType] = []
                    if allergens_str:
                        for allergen_name in allergens_str.split(';'):
                            allergen_name = allergen_name.strip().lower()
                            try:
                                allergens.append(AllergenType(allergen_name))
                            except ValueError:
                                # 忽略未知的过敏原
                                pass
                    
                    material = RawMaterial(
                        id=row['id'].strip(),
                        name=row['name'].strip(),
                        cas_number=row.get('cas_number', '').strip() or None,
                        molecular_weight=float(row['molecular_weight']) if row.get('molecular_weight', '').strip() else None,
                        density=float(row.get('density', '1.0')),
                        flash_point=float(row['flash_point']) if row.get('flash_point', '').strip() else None,
                        allergens=allergens,
                        is_ethanol=row.get('is_ethanol', '').lower() in ['true', 'yes', '1'],
                        is_fragrance=row.get('is_fragrance', 'true').lower() in ['true', 'yes', '1'],
                        unit_cost=float(row['unit_cost']) if row.get('unit_cost', '').strip() else None,
                    )
                    materials.append(material)
                except (ValueError, KeyError) as e:
                    raise ParserError(f"解析原料行失败: {row}. 错误: {e}")
        
        return materials
    
    @staticmethod
    def parse_batches(file_path: str) -> List[RawMaterialBatch]:
        """
        解析原料批次 CSV 文件
        
        预期格式:
        batch_number,raw_material_id,manufacture_date,expiry_date,supplier,supplier_batch,quantity,unit,purity,notes
        BATCH001,RM001,2024-01-01,2026-01-01,供应商A,SUP001,100.0,g,1.0,备注
        """
        if not os.path.exists(file_path):
            raise ParserError(f"批次文件不存在: {file_path}")
        
        batches: List[RawMaterialBatch] = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    manufacture_date = datetime.strptime(row['manufacture_date'].strip(), '%Y-%m-%d').date()
                    expiry_date = datetime.strptime(row['expiry_date'].strip(), '%Y-%m-%d').date()
                    
                    batch = RawMaterialBatch(
                        batch_number=row['batch_number'].strip(),
                        raw_material_id=row['raw_material_id'].strip(),
                        manufacture_date=manufacture_date,
                        expiry_date=expiry_date,
                        supplier=row.get('supplier', '').strip() or None,
                        supplier_batch=row.get('supplier_batch', '').strip() or None,
                        quantity=float(row.get('quantity', '0.0')),
                        unit=Unit.from_string(row.get('unit', 'g')),
                        purity=float(row.get('purity', '1.0')),
                        notes=row.get('notes', '').strip() or None,
                    )
                    batches.append(batch)
                except (ValueError, KeyError) as e:
                    raise ParserError(f"解析批次行失败: {row}. 错误: {e}")
        
        return batches


class YAMLParser:
    """YAML 文件解析器"""
    
    @staticmethod
    def parse_rule_set(file_path: str) -> RuleSet:
        """
        解析 IFRA/过敏原规则 YAML 文件
        
        预期格式:
        name: "IFRA 49th Amendment"
        version: "49"
        ifra_rules:
          - raw_material_id: "RM001"
            limit_type: "max_concentration"
            limit_value: 0.05
            product_category: "leave-on"
        allergen_rules:
          - allergen_type: "linalool"
            reporting_threshold: 0.001
        banned_substances:
          - "RM999"
        """
        if not os.path.exists(file_path):
            raise ParserError(f"规则文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                raise ParserError(f"YAML 解析失败: {e}")
        
        if not data:
            raise ParserError(f"规则文件为空: {file_path}")
        
        # 解析 IFRA 规则
        ifra_rules: List[IFRARule] = []
        for rule_data in data.get('ifra_rules', []):
            try:
                effective_date = None
                if rule_data.get('effective_date'):
                    effective_date = datetime.strptime(rule_data['effective_date'], '%Y-%m-%d').date()
                
                ifra_rule = IFRARule(
                    raw_material_id=rule_data['raw_material_id'],
                    limit_type=rule_data['limit_type'],
                    limit_value=float(rule_data['limit_value']) if rule_data.get('limit_value') else None,
                    product_category=rule_data.get('product_category'),
                    effective_date=effective_date,
                    notes=rule_data.get('notes'),
                )
                ifra_rules.append(ifra_rule)
            except (ValueError, KeyError) as e:
                raise ParserError(f"解析 IFRA 规则失败: {rule_data}. 错误: {e}")
        
        # 解析过敏原规则
        allergen_rules: List[AllergenRule] = []
        for rule_data in data.get('allergen_rules', []):
            try:
                allergen_type = AllergenType(rule_data['allergen_type'].lower())
                allergen_rule = AllergenRule(
                    allergen_type=allergen_type,
                    reporting_threshold=float(rule_data.get('reporting_threshold', 0.001)),
                    restriction_limit=float(rule_data['restriction_limit']) if rule_data.get('restriction_limit') else None,
                    notes=rule_data.get('notes'),
                )
                allergen_rules.append(allergen_rule)
            except (ValueError, KeyError) as e:
                raise ParserError(f"解析过敏原规则失败: {rule_data}. 错误: {e}")
        
        # 解析禁用物质
        banned_substances: List[str] = data.get('banned_substances', [])
        
        rule_set = RuleSet(
            name=data.get('name', 'Default Rule Set'),
            version=data.get('version', '1.0'),
            ifra_rules=ifra_rules,
            allergen_rules=allergen_rules,
            banned_substances=banned_substances,
        )
        
        return rule_set


class DataValidator:
    """数据校验器"""
    
    @staticmethod
    def validate_formula(formula: Formula, raw_materials: Dict[str, RawMaterial]) -> Tuple[bool, List[str]]:
        """
        校验配方数据
        
        检查:
        1. 所有原料 ID 都存在于原料库中
        2. 用量为正数
        3. 单位一致或可转换
        """
        errors: List[str] = []
        
        # 检查原料 ID
        for ingredient in formula.ingredients:
            if ingredient.raw_material_id not in raw_materials:
                errors.append(f"原料 ID 不存在: {ingredient.raw_material_id}")
            
            # 检查用量
            if ingredient.amount <= 0:
                errors.append(f"原料用量必须为正数: {ingredient.raw_material_id} = {ingredient.amount}")
        
        # 检查总用量
        if formula.total_amount <= 0:
            errors.append(f"配方总用量必须为正数: {formula.total_amount}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_batches(batches: List[RawMaterialBatch], raw_materials: Dict[str, RawMaterial]) -> Tuple[bool, List[str]]:
        """
        校验批次数据
        
        检查:
        1. 批次号唯一
        2. 原料 ID 存在
        3. 生产日期早于过期日期
        """
        errors: List[str] = []
        batch_numbers: set = set()
        
        for batch in batches:
            # 检查批次号唯一
            if batch.batch_number in batch_numbers:
                errors.append(f"批次号重复: {batch.batch_number}")
            batch_numbers.add(batch.batch_number)
            
            # 检查原料 ID
            if batch.raw_material_id not in raw_materials:
                errors.append(f"批次原料 ID 不存在: {batch.raw_material_id} (批次: {batch.batch_number})")
            
            # 检查日期逻辑
            if batch.manufacture_date > batch.expiry_date:
                errors.append(f"生产日期晚于过期日期: {batch.batch_number}")
        
        return len(errors) == 0, errors


class DataStore:
    """数据存储 - 管理加载的所有数据"""
    
    def __init__(self):
        self.formulas: Dict[str, Formula] = {}
        self.raw_materials: Dict[str, RawMaterial] = {}
        self.batches: Dict[str, RawMaterialBatch] = {}
        self.rule_sets: Dict[str, RuleSet] = {}
    
    def load_formula(self, file_path: str) -> Formula:
        """加载配方文件"""
        formula = CSVParser.parse_formula(file_path)
        self.formulas[formula.id] = formula
        return formula
    
    def load_raw_materials(self, file_path: str) -> List[RawMaterial]:
        """加载原料文件"""
        materials = CSVParser.parse_raw_materials(file_path)
        for material in materials:
            self.raw_materials[material.id] = material
        return materials
    
    def load_batches(self, file_path: str) -> List[RawMaterialBatch]:
        """加载批次文件"""
        batches = CSVParser.parse_batches(file_path)
        for batch in batches:
            self.batches[batch.batch_number] = batch
        return batches
    
    def load_rule_set(self, file_path: str) -> RuleSet:
        """加载规则文件"""
        rule_set = YAMLParser.parse_rule_set(file_path)
        self.rule_sets[rule_set.name] = rule_set
        return rule_set
    
    def get_batch_by_material(self, raw_material_id: str) -> List[RawMaterialBatch]:
        """获取指定原料的所有批次"""
        return [
            batch for batch in self.batches.values()
            if batch.raw_material_id == raw_material_id
        ]
    
    def validate_all(self) -> Tuple[bool, List[str]]:
        """校验所有已加载的数据"""
        all_errors: List[str] = []
        
        # 校验配方
        for formula_id, formula in self.formulas.items():
            valid, errors = DataValidator.validate_formula(formula, self.raw_materials)
            if not valid:
                all_errors.extend([f"配方 {formula_id}: {e}" for e in errors])
        
        # 校验批次
        if self.batches:
            valid, errors = DataValidator.validate_batches(
                list(self.batches.values()), self.raw_materials
            )
            if not valid:
                all_errors.extend([f"批次: {e}" for e in errors])
        
        return len(all_errors) == 0, all_errors
