from typing import Dict, List, Tuple, Any
from candle_simulator.models import Ingredient, IngredientType, NoteType, Recipe, RecipeIngredient


class ValidationError(Exception):
    """数据验证错误"""
    pass


def validate_unit(unit: str) -> Tuple[bool, str]:
    """验证单位是否有效"""
    valid_units = ['g', 'kg', 'mg', 'ml', 'l', 'oz', 'lb', 'pcs', 'unit']
    unit_lower = unit.lower().strip()
    if unit_lower not in valid_units:
        return False, f"不支持的单位 '{unit}'，有效单位为: {valid_units}"
    return True, ""


INGREDIENT_TYPE_ALIASES = {
    'wax': IngredientType.WAX,
    '蜡基': IngredientType.WAX,
    'fragrance': IngredientType.FRAGRANCE,
    '香精': IngredientType.FRAGRANCE,
    'additive': IngredientType.ADDITIVE,
    '助剂': IngredientType.ADDITIVE,
    'container': IngredientType.CONTAINER,
    '容器': IngredientType.CONTAINER,
}

NOTE_TYPE_ALIASES = {
    'top': NoteType.TOP,
    '前调': NoteType.TOP,
    'middle': NoteType.MIDDLE,
    '中调': NoteType.MIDDLE,
    'base': NoteType.BASE,
    '后调': NoteType.BASE,
}


def validate_ingredient_type(ingredient_type: str) -> Tuple[bool, str]:
    """验证原料类型是否有效（支持中英文别名）"""
    type_lower = ingredient_type.lower().strip()
    if type_lower not in INGREDIENT_TYPE_ALIASES:
        valid_aliases = list(INGREDIENT_TYPE_ALIASES.keys())
        return False, f"不支持的原料类型 '{ingredient_type}'，有效类型为: {valid_aliases}"
    return True, ""


def validate_note_type(note_type: str) -> Tuple[bool, str]:
    """验证香调类型是否有效（支持中英文别名）"""
    if not note_type:
        return True, ""
    note_lower = note_type.lower().strip()
    if note_lower not in NOTE_TYPE_ALIASES:
        valid_aliases = list(NOTE_TYPE_ALIASES.keys())
        return False, f"不支持的香调类型 '{note_type}'，有效类型为: {valid_aliases}"
    return True, ""


def validate_ingredient(data: Dict[str, Any]) -> List[str]:
    """
    验证原料数据
    返回错误列表
    """
    errors = []
    
    required_fields = ['name', 'type', 'unit_price', 'unit']
    for field in required_fields:
        if field not in data or data[field] is None:
            errors.append(f"缺少必填字段: '{field}'")
    
    if 'name' in data and data['name']:
        if len(str(data['name']).strip()) == 0:
            errors.append("原料名称不能为空")
    
    if 'type' in data and data['type']:
        is_valid, msg = validate_ingredient_type(data['type'])
        if not is_valid:
            errors.append(msg)
    
    if 'unit_price' in data:
        try:
            price = float(data['unit_price'])
            if price < 0:
                errors.append(f"单价不能为负数: {price}")
        except (ValueError, TypeError):
            errors.append(f"单价必须是数字: {data['unit_price']}")
    
    if 'unit' in data and data['unit']:
        is_valid, msg = validate_unit(data['unit'])
        if not is_valid:
            errors.append(msg)
    
    if 'max_ratio' in data and data['max_ratio'] is not None:
        try:
            ratio = float(data['max_ratio'])
            if ratio < 0 or ratio > 100:
                errors.append(f"最大添加比例应在 0-100 之间: {ratio}")
        except (ValueError, TypeError):
            errors.append(f"最大添加比例必须是数字: {data['max_ratio']}")
    
    if 'flash_point' in data and data['flash_point'] is not None:
        try:
            fp = float(data['flash_point'])
            if fp < 0:
                errors.append(f"闪点不能为负数: {fp}")
        except (ValueError, TypeError):
            errors.append(f"闪点必须是数字: {data['flash_point']}")
    
    if 'note_type' in data and data['note_type']:
        is_valid, msg = validate_note_type(data['note_type'])
        if not is_valid:
            errors.append(msg)
    
    if 'half_life' in data and data['half_life'] is not None:
        try:
            hl = float(data['half_life'])
            if hl < 0:
                errors.append(f"半衰期不能为负数: {hl}")
        except (ValueError, TypeError):
            errors.append(f"半衰期必须是数字: {data['half_life']}")
    
    if 'volatility_coefficient' in data and data['volatility_coefficient'] is not None:
        try:
            vc = float(data['volatility_coefficient'])
            if vc < 0:
                errors.append(f"挥发系数不能为负数: {vc}")
        except (ValueError, TypeError):
            errors.append(f"挥发系数必须是数字: {data['volatility_coefficient']}")
    
    return errors


def validate_recipe(data: Dict[str, Any], ingredients: Dict[str, Ingredient]) -> List[str]:
    """
    验证配方数据
    返回错误列表
    """
    errors = []
    
    required_fields = ['name', 'ingredients', 'total_batch_size', 'target_per_cup_capacity', 'container_count']
    for field in required_fields:
        if field not in data or data[field] is None:
            errors.append(f"缺少必填字段: '{field}'")
    
    if 'name' in data and data['name']:
        if len(str(data['name']).strip()) == 0:
            errors.append("配方名称不能为空")
    
    if 'total_batch_size' in data:
        try:
            size = float(data['total_batch_size'])
            if size <= 0:
                errors.append(f"总批量必须大于 0: {size}")
        except (ValueError, TypeError):
            errors.append(f"总批量必须是数字: {data['total_batch_size']}")
    
    if 'target_per_cup_capacity' in data:
        try:
            cap = float(data['target_per_cup_capacity'])
            if cap <= 0:
                errors.append(f"目标单杯容量必须大于 0: {cap}")
        except (ValueError, TypeError):
            errors.append(f"目标单杯容量必须是数字: {data['target_per_cup_capacity']}")
    
    if 'container_count' in data:
        try:
            count = int(data['container_count'])
            if count <= 0:
                errors.append(f"容器数量必须大于 0: {count}")
        except (ValueError, TypeError):
            errors.append(f"容器数量必须是整数: {data['container_count']}")
    
    if 'target_per_cup_cost' in data and data['target_per_cup_cost'] is not None:
        try:
            cost = float(data['target_per_cup_cost'])
            if cost < 0:
                errors.append(f"目标单杯成本不能为负数: {cost}")
        except (ValueError, TypeError):
            errors.append(f"目标单杯成本必须是数字: {data['target_per_cup_cost']}")
    
    if 'ingredients' in data:
        if not isinstance(data['ingredients'], list) or len(data['ingredients']) == 0:
            errors.append("配方必须包含至少一种原料")
        else:
            for i, ing in enumerate(data['ingredients']):
                ing_errors = validate_recipe_ingredient(ing, ingredients)
                for err in ing_errors:
                    errors.append(f"原料 #{i+1} 错误: {err}")
    
    return errors


def validate_recipe_ingredient(data: Dict[str, Any], ingredients: Dict[str, Ingredient]) -> List[str]:
    """验证配方中的原料条目"""
    errors = []
    
    required_fields = ['name', 'amount', 'unit']
    for field in required_fields:
        if field not in data or data[field] is None:
            errors.append(f"缺少必填字段: '{field}'")
    
    if 'name' in data and data['name']:
        name = str(data['name']).strip()
        if name not in ingredients:
            errors.append(f"原料 '{name}' 不存在于原料库中")
    
    if 'amount' in data:
        try:
            amount = float(data['amount'])
            if amount <= 0:
                errors.append(f"用量必须大于 0: {amount}")
        except (ValueError, TypeError):
            errors.append(f"用量必须是数字: {data['amount']}")
    
    if 'unit' in data and data['unit']:
        is_valid, msg = validate_unit(data['unit'])
        if not is_valid:
            errors.append(msg)
    
    return errors


def parse_ingredient_type(ingredient_type: str) -> IngredientType:
    """将字符串解析为原料类型枚举"""
    type_map = {
        'wax': IngredientType.WAX,
        '蜡基': IngredientType.WAX,
        'fragrance': IngredientType.FRAGRANCE,
        '香精': IngredientType.FRAGRANCE,
        'additive': IngredientType.ADDITIVE,
        '助剂': IngredientType.ADDITIVE,
        'container': IngredientType.CONTAINER,
        '容器': IngredientType.CONTAINER
    }
    type_lower = ingredient_type.lower().strip()
    if type_lower in type_map:
        return type_map[type_lower]
    raise ValidationError(f"未知的原料类型: {ingredient_type}")


def parse_note_type(note_type: str) -> NoteType:
    """将字符串解析为香调类型枚举"""
    note_map = {
        'top': NoteType.TOP,
        '前调': NoteType.TOP,
        'middle': NoteType.MIDDLE,
        '中调': NoteType.MIDDLE,
        'base': NoteType.BASE,
        '后调': NoteType.BASE
    }
    note_lower = note_type.lower().strip() if note_type else ""
    if note_lower in note_map:
        return note_map[note_lower]
    raise ValidationError(f"未知的香调类型: {note_type}")
