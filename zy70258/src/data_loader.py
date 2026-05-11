import csv
import json
import os
from typing import Dict, List, Tuple, Optional
from models import (
    ElderlyProfile,
    Dish,
    MealOrder,
    SubstitutionRule,
    VerificationIssue,
    FailureReason
)


def parse_set_field(value: str) -> set:
    if not value or value.strip().lower() in ['无', 'none', 'null', '']:
        return set()
    return set(item.strip() for item in value.split('|') if item.strip())


def parse_list_field(value: str) -> list:
    if not value or value.strip().lower() in ['无', 'none', 'null', '']:
        return []
    return [item.strip() for item in value.split('|') if item.strip()]


def load_elderly_profiles(filepath: str) -> Tuple[Dict[str, ElderlyProfile], List[VerificationIssue]]:
    profiles = {}
    issues = []
    
    _, ext = os.path.splitext(filepath)
    
    if ext.lower() == '.json':
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for idx, item in enumerate(data.get('elderly_profiles', []), start=1):
                try:
                    profile = ElderlyProfile(
                        id=item['id'],
                        name=item['name'],
                        room_number=item['room_number'],
                        known_allergens=set(item.get('known_allergens', [])),
                        dietary_restrictions=set(item.get('dietary_restrictions', [])),
                        special_conditions=item.get('special_conditions', [])
                    )
                    profiles[profile.id] = profile
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id='N/A',
                        elderly_name=item.get('name', '未知'),
                        dish_name='N/A',
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'老人档案解析失败: {str(e)}',
                        source_line=idx + 1,
                        source_file=filepath
                    ))
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    if not row.get('id'):
                        issues.append(VerificationIssue(
                            order_id='N/A',
                            elderly_name=row.get('name', '未知'),
                            dish_name='N/A',
                            reason=FailureReason.MISSING_DATA,
                            details='老人档案缺少必填字段: id',
                            source_line=line_num,
                            source_file=filepath
                        ))
                        continue
                    
                    profile = ElderlyProfile(
                        id=row['id'],
                        name=row['name'],
                        room_number=row['room_number'],
                        known_allergens=parse_set_field(row.get('known_allergens', '')),
                        dietary_restrictions=parse_set_field(row.get('dietary_restrictions', '')),
                        special_conditions=parse_list_field(row.get('special_conditions', ''))
                    )
                    profiles[profile.id] = profile
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id='N/A',
                        elderly_name=row.get('name', '未知'),
                        dish_name='N/A',
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'老人档案解析失败: {str(e)}',
                        source_line=line_num,
                        source_file=filepath
                    ))
    
    return profiles, issues


def load_dishes(filepath: str) -> Tuple[Dict[str, Dish], List[VerificationIssue]]:
    dishes = {}
    issues = []
    
    _, ext = os.path.splitext(filepath)
    
    if ext.lower() == '.json':
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for idx, item in enumerate(data.get('dishes', []), start=1):
                try:
                    dish = Dish(
                        id=item['id'],
                        name=item['name'],
                        category=item['category'],
                        allergens=set(item.get('allergens', [])),
                        dietary_tags=set(item.get('dietary_tags', []))
                    )
                    dishes[dish.id] = dish
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id='N/A',
                        elderly_name='N/A',
                        dish_name=item.get('name', '未知'),
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'菜品解析失败: {str(e)}',
                        source_line=idx + 1,
                        source_file=filepath
                    ))
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    if not row.get('id'):
                        issues.append(VerificationIssue(
                            order_id='N/A',
                            elderly_name='N/A',
                            dish_name=row.get('name', '未知'),
                            reason=FailureReason.MISSING_DATA,
                            details='菜品缺少必填字段: id',
                            source_line=line_num,
                            source_file=filepath
                        ))
                        continue
                    
                    dish = Dish(
                        id=row['id'],
                        name=row['name'],
                        category=row['category'],
                        allergens=parse_set_field(row.get('allergens', '')),
                        dietary_tags=parse_set_field(row.get('dietary_tags', ''))
                    )
                    dishes[dish.id] = dish
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id='N/A',
                        elderly_name='N/A',
                        dish_name=row.get('name', '未知'),
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'菜品解析失败: {str(e)}',
                        source_line=line_num,
                        source_file=filepath
                    ))
    
    return dishes, issues


def load_meal_orders(filepath: str) -> Tuple[List[MealOrder], List[VerificationIssue]]:
    orders = []
    issues = []
    
    _, ext = os.path.splitext(filepath)
    
    if ext.lower() == '.json':
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for idx, item in enumerate(data.get('meal_orders', []), start=1):
                try:
                    order = MealOrder(
                        id=item['id'],
                        elderly_id=item['elderly_id'],
                        delivery_date=item['delivery_date'],
                        meal_type=item['meal_type'],
                        dish_ids=item.get('dish_ids', [])
                    )
                    orders.append(order)
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id=item.get('id', '未知'),
                        elderly_name='N/A',
                        dish_name='N/A',
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'订单解析失败: {str(e)}',
                        source_line=idx + 1,
                        source_file=filepath
                    ))
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    if not row.get('id'):
                        issues.append(VerificationIssue(
                            order_id='未知',
                            elderly_name='N/A',
                            dish_name='N/A',
                            reason=FailureReason.MISSING_DATA,
                            details='订单缺少必填字段: id',
                            source_line=line_num,
                            source_file=filepath
                        ))
                        continue
                    
                    order = MealOrder(
                        id=row['id'],
                        elderly_id=row.get('elderly_id', '').strip(),
                        delivery_date=row.get('delivery_date', ''),
                        meal_type=row.get('meal_type', ''),
                        dish_ids=parse_list_field(row.get('dish_ids', ''))
                    )
                    orders.append(order)
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id=row.get('id', '未知'),
                        elderly_name='N/A',
                        dish_name='N/A',
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'订单解析失败: {str(e)}',
                        source_line=line_num,
                        source_file=filepath
                    ))
    
    return orders, issues


def load_substitution_rules(filepath: str) -> Tuple[Dict[str, List[SubstitutionRule]], List[VerificationIssue]]:
    rules_by_source = {}
    issues = []
    
    _, ext = os.path.splitext(filepath)
    
    if ext.lower() == '.json':
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for idx, item in enumerate(data.get('substitution_rules', []), start=1):
                try:
                    rule = SubstitutionRule(
                        id=item['id'],
                        source_dish_id=item['source_dish_id'],
                        substitute_dish_id=item['substitute_dish_id'],
                        applicable_conditions=set(item.get('applicable_conditions', []))
                    )
                    if rule.source_dish_id not in rules_by_source:
                        rules_by_source[rule.source_dish_id] = []
                    rules_by_source[rule.source_dish_id].append(rule)
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id='N/A',
                        elderly_name='N/A',
                        dish_name='N/A',
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'替换规则解析失败: {str(e)}',
                        source_line=idx + 1,
                        source_file=filepath
                    ))
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    if not row.get('source_dish_id') or not row.get('substitute_dish_id'):
                        issues.append(VerificationIssue(
                            order_id='N/A',
                            elderly_name='N/A',
                            dish_name='N/A',
                            reason=FailureReason.MISSING_DATA,
                            details='替换规则缺少必填字段: source_dish_id 或 substitute_dish_id',
                            source_line=line_num,
                            source_file=filepath
                        ))
                        continue
                    
                    rule = SubstitutionRule(
                        id=row.get('id', f'S_{line_num}'),
                        source_dish_id=row['source_dish_id'],
                        substitute_dish_id=row['substitute_dish_id'],
                        applicable_conditions=parse_set_field(row.get('applicable_conditions', ''))
                    )
                    if rule.source_dish_id not in rules_by_source:
                        rules_by_source[rule.source_dish_id] = []
                    rules_by_source[rule.source_dish_id].append(rule)
                except Exception as e:
                    issues.append(VerificationIssue(
                        order_id='N/A',
                        elderly_name='N/A',
                        dish_name='N/A',
                        reason=FailureReason.INVALID_FORMAT,
                        details=f'替换规则解析失败: {str(e)}',
                        source_line=line_num,
                        source_file=filepath
                    ))
    
    return rules_by_source, issues


def load_all_from_json(filepath: str) -> Tuple[
    Dict[str, ElderlyProfile],
    Dict[str, Dish],
    Dict[str, List[SubstitutionRule]],
    List[MealOrder],
    List[VerificationIssue]
]:
    all_issues = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    profiles = {}
    for idx, item in enumerate(data.get('elderly_profiles', []), start=1):
        try:
            profile = ElderlyProfile(
                id=item['id'],
                name=item['name'],
                room_number=item['room_number'],
                known_allergens=set(item.get('known_allergens', [])),
                dietary_restrictions=set(item.get('dietary_restrictions', [])),
                special_conditions=item.get('special_conditions', [])
            )
            profiles[profile.id] = profile
        except Exception as e:
            all_issues.append(VerificationIssue(
                order_id='N/A',
                elderly_name=item.get('name', '未知'),
                dish_name='N/A',
                reason=FailureReason.INVALID_FORMAT,
                details=f'老人档案解析失败: {str(e)}',
                source_line=idx + 1,
                source_file=filepath
            ))
    
    dishes = {}
    for idx, item in enumerate(data.get('dishes', []), start=1):
        try:
            dish = Dish(
                id=item['id'],
                name=item['name'],
                category=item['category'],
                allergens=set(item.get('allergens', [])),
                dietary_tags=set(item.get('dietary_tags', []))
            )
            dishes[dish.id] = dish
        except Exception as e:
            all_issues.append(VerificationIssue(
                order_id='N/A',
                elderly_name='N/A',
                dish_name=item.get('name', '未知'),
                reason=FailureReason.INVALID_FORMAT,
                details=f'菜品解析失败: {str(e)}',
                source_line=idx + 1,
                source_file=filepath
            ))
    
    rules_by_source = {}
    for idx, item in enumerate(data.get('substitution_rules', []), start=1):
        try:
            rule = SubstitutionRule(
                id=item['id'],
                source_dish_id=item['source_dish_id'],
                substitute_dish_id=item['substitute_dish_id'],
                applicable_conditions=set(item.get('applicable_conditions', []))
            )
            if rule.source_dish_id not in rules_by_source:
                rules_by_source[rule.source_dish_id] = []
            rules_by_source[rule.source_dish_id].append(rule)
        except Exception as e:
            all_issues.append(VerificationIssue(
                order_id='N/A',
                elderly_name='N/A',
                dish_name='N/A',
                reason=FailureReason.INVALID_FORMAT,
                details=f'替换规则解析失败: {str(e)}',
                source_line=idx + 1,
                source_file=filepath
            ))
    
    orders = []
    for idx, item in enumerate(data.get('meal_orders', []), start=1):
        try:
            order = MealOrder(
                id=item['id'],
                elderly_id=item['elderly_id'],
                delivery_date=item['delivery_date'],
                meal_type=item['meal_type'],
                dish_ids=item.get('dish_ids', [])
            )
            orders.append(order)
        except Exception as e:
            all_issues.append(VerificationIssue(
                order_id=item.get('id', '未知'),
                elderly_name='N/A',
                dish_name='N/A',
                reason=FailureReason.INVALID_FORMAT,
                details=f'订单解析失败: {str(e)}',
                source_line=idx + 1,
                source_file=filepath
            ))
    
    return profiles, dishes, rules_by_source, orders, all_issues
