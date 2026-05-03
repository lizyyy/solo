import json
import csv
import os
from typing import Dict, List, Any, Tuple
from pathlib import Path

from candle_simulator.models import Ingredient, Recipe, RecipeIngredient, IngredientType, NoteType
from candle_simulator.validators import (
    validate_ingredient, validate_recipe, validate_recipe_ingredient,
    parse_ingredient_type, parse_note_type, ValidationError
)


class ParserError(Exception):
    """解析错误"""
    pass


def detect_file_format(file_path: str) -> str:
    """检测文件格式"""
    ext = Path(file_path).suffix.lower()
    if ext == '.json':
        return 'json'
    elif ext == '.csv':
        return 'csv'
    else:
        raise ParserError(f"不支持的文件格式: {ext}，仅支持 .json 和 .csv")


def parse_ingredients(file_path: str) -> Dict[str, Ingredient]:
    """
    解析原料库文件（支持 JSON 或 CSV）
    返回: 原料名称到 Ingredient 对象的映射
    """
    if not os.path.exists(file_path):
        raise ParserError(f"文件不存在: {file_path}")
    
    file_format = detect_file_format(file_path)
    
    if file_format == 'json':
        return _parse_ingredients_json(file_path)
    else:
        return _parse_ingredients_csv(file_path)


def _parse_ingredients_json(file_path: str) -> Dict[str, Ingredient]:
    """解析 JSON 格式的原料库"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ParserError(f"JSON 解析错误: {e}")
    except Exception as e:
        raise ParserError(f"读取文件失败: {e}")
    
    ingredients = {}
    
    if not isinstance(data, list):
        if 'ingredients' in data and isinstance(data['ingredients'], list):
            data = data['ingredients']
        else:
            raise ParserError("JSON 格式错误：需要是数组或包含 ingredients 数组的对象")
    
    for i, item in enumerate(data):
        errors = validate_ingredient(item)
        if errors:
            error_str = "\n  - ".join(errors)
            raise ParserError(f"原料 #{i+1} 验证失败:\n  - {error_str}")
        
        try:
            ingredient = _create_ingredient_from_dict(item)
        except Exception as e:
            raise ParserError(f"原料 #{i+1} 创建失败: {e}")
        
        if ingredient.name in ingredients:
            raise ParserError(f"重复的原料名称: '{ingredient.name}'")
        
        ingredients[ingredient.name] = ingredient
    
    return ingredients


def _parse_ingredients_csv(file_path: str) -> Dict[str, Ingredient]:
    """解析 CSV 格式的原料库"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data = list(reader)
    except Exception as e:
        raise ParserError(f"读取 CSV 文件失败: {e}")
    
    if not data:
        raise ParserError("CSV 文件为空")
    
    required_columns = ['name', 'type', 'unit_price', 'unit']
    missing_columns = [col for col in required_columns if col not in data[0]]
    if missing_columns:
        raise ParserError(f"CSV 缺少必要的列: {missing_columns}")
    
    ingredients = {}
    
    for i, row in enumerate(data):
        item = _csv_row_to_dict(row)
        errors = validate_ingredient(item)
        if errors:
            error_str = "\n  - ".join(errors)
            raise ParserError(f"原料 #{i+1} 验证失败:\n  - {error_str}")
        
        try:
            ingredient = _create_ingredient_from_dict(item)
        except Exception as e:
            raise ParserError(f"原料 #{i+1} 创建失败: {e}")
        
        if ingredient.name in ingredients:
            raise ParserError(f"重复的原料名称: '{ingredient.name}'")
        
        ingredients[ingredient.name] = ingredient
    
    return ingredients


def _csv_row_to_dict(row: Dict[str, str]) -> Dict[str, Any]:
    """将 CSV 行转换为字典，处理数值类型"""
    result = {}
    for key, value in row.items():
        if value is None or value == '':
            result[key] = None
            continue
        
        if key in ['unit_price', 'max_ratio', 'flash_point', 'half_life', 'volatility_coefficient']:
            try:
                result[key] = float(value)
            except ValueError:
                result[key] = value
        elif key == 'allergen_tags':
            result[key] = [tag.strip() for tag in value.split(',') if tag.strip()]
        else:
            result[key] = value.strip() if value else None
    
    return result


def _create_ingredient_from_dict(data: Dict[str, Any]) -> Ingredient:
    """从字典创建 Ingredient 对象"""
    ingredient_type = parse_ingredient_type(data['type'])
    
    note_type = None
    if 'note_type' in data and data['note_type']:
        note_type = parse_note_type(data['note_type'])
    
    allergen_tags = data.get('allergen_tags', [])
    if isinstance(allergen_tags, str):
        allergen_tags = [tag.strip() for tag in allergen_tags.split(',') if tag.strip()]
    
    return Ingredient(
        name=data['name'].strip(),
        type=ingredient_type,
        unit_price=float(data['unit_price']),
        unit=data['unit'].strip(),
        max_ratio=float(data['max_ratio']) if data.get('max_ratio') is not None else None,
        flash_point=float(data['flash_point']) if data.get('flash_point') is not None else None,
        allergen_tags=allergen_tags,
        note_type=note_type,
        half_life=float(data['half_life']) if data.get('half_life') is not None else None,
        volatility_coefficient=float(data['volatility_coefficient']) if data.get('volatility_coefficient') is not None else None,
        notes=data.get('notes', '') or ''
    )


def parse_recipe(file_path: str, ingredients: Dict[str, Ingredient]) -> Recipe:
    """
    解析配方文件（支持 JSON 或 CSV）
    """
    if not os.path.exists(file_path):
        raise ParserError(f"文件不存在: {file_path}")
    
    file_format = detect_file_format(file_path)
    
    if file_format == 'json':
        return _parse_recipe_json(file_path, ingredients)
    else:
        return _parse_recipe_csv(file_path, ingredients)


def _parse_recipe_json(file_path: str, ingredients: Dict[str, Ingredient]) -> Recipe:
    """解析 JSON 格式的配方"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ParserError(f"JSON 解析错误: {e}")
    except Exception as e:
        raise ParserError(f"读取文件失败: {e}")
    
    errors = validate_recipe(data, ingredients)
    if errors:
        error_str = "\n  - ".join(errors)
        raise ParserError(f"配方验证失败:\n  - {error_str}")
    
    return _create_recipe_from_dict(data, ingredients)


def _parse_recipe_csv(file_path: str, ingredients: Dict[str, Ingredient]) -> Recipe:
    """解析 CSV 格式的配方"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        raise ParserError(f"读取 CSV 文件失败: {e}")
    
    if not rows:
        raise ParserError("CSV 文件为空")
    
    header_cols = set(rows[0].keys())
    
    recipe_metadata = {}
    ingredients_list = []
    
    if 'recipe_name' in header_cols:
        recipe_metadata['name'] = rows[0].get('recipe_name', '未命名配方')
        recipe_metadata['description'] = rows[0].get('description', '')
        recipe_metadata['total_batch_size'] = float(rows[0].get('total_batch_size', 0))
        recipe_metadata['total_batch_unit'] = rows[0].get('total_batch_unit', 'g')
        recipe_metadata['target_per_cup_capacity'] = float(rows[0].get('target_per_cup_capacity', 0))
        recipe_metadata['target_per_cup_unit'] = rows[0].get('target_per_cup_unit', 'g')
        recipe_metadata['container_count'] = int(rows[0].get('container_count', 1))
        recipe_metadata['target_per_cup_cost'] = float(rows[0].get('target_per_cup_cost', 0)) if rows[0].get('target_per_cup_cost') else 0.0
        recipe_metadata['notes'] = rows[0].get('notes', '')
        
        for row in rows:
            if row.get('ingredient_name'):
                ingredients_list.append({
                    'name': row['ingredient_name'],
                    'amount': float(row['ingredient_amount']) if row.get('ingredient_amount') else 0,
                    'unit': row.get('ingredient_unit', 'g')
                })
    else:
        if 'name' not in header_cols or 'amount' not in header_cols:
            raise ParserError("CSV 配方格式错误：需要包含 'name', 'amount' 列或配方元数据列")
        
        recipe_metadata['name'] = Path(file_path).stem
        recipe_metadata['description'] = ''
        recipe_metadata['total_batch_size'] = 0.0
        recipe_metadata['total_batch_unit'] = 'g'
        recipe_metadata['target_per_cup_capacity'] = 0.0
        recipe_metadata['target_per_cup_unit'] = 'g'
        recipe_metadata['container_count'] = 1
        recipe_metadata['target_per_cup_cost'] = 0.0
        recipe_metadata['notes'] = ''
        
        for row in rows:
            if row.get('name'):
                ingredients_list.append({
                    'name': row['name'],
                    'amount': float(row['amount']) if row.get('amount') else 0,
                    'unit': row.get('unit', 'g')
                })
    
    recipe_metadata['ingredients'] = ingredients_list
    
    errors = validate_recipe(recipe_metadata, ingredients)
    if errors:
        error_str = "\n  - ".join(errors)
        raise ParserError(f"配方验证失败:\n  - {error_str}")
    
    return _create_recipe_from_dict(recipe_metadata, ingredients)


def _create_recipe_from_dict(data: Dict[str, Any], ingredients: Dict[str, Ingredient]) -> Recipe:
    """从字典创建 Recipe 对象"""
    recipe_ingredients = []
    
    for ing_data in data['ingredients']:
        name = ing_data['name'].strip()
        if name not in ingredients:
            raise ParserError(f"原料 '{name}' 不存在于原料库中")
        
        recipe_ingredient = RecipeIngredient(
            name=name,
            amount=float(ing_data['amount']),
            unit=ing_data['unit'].strip(),
            ingredient=ingredients[name]
        )
        recipe_ingredients.append(recipe_ingredient)
    
    return Recipe(
        name=data.get('name', '未命名配方').strip(),
        description=data.get('description', '').strip(),
        ingredients=recipe_ingredients,
        total_batch_size=float(data['total_batch_size']),
        total_batch_unit=data.get('total_batch_unit', 'g').strip(),
        target_per_cup_capacity=float(data['target_per_cup_capacity']),
        target_per_cup_unit=data.get('target_per_cup_unit', 'g').strip(),
        container_count=int(data['container_count']),
        target_per_cup_cost=float(data.get('target_per_cup_cost', 0)) if data.get('target_per_cup_cost') else 0.0,
        notes=data.get('notes', '').strip()
    )
