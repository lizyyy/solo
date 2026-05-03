"""
核心业务逻辑 - 原料、配方管理和成本计算
"""

from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime
import uuid

from .models import (
    Ingredient, Recipe, RecipeIngredient, RecipeCostAnalysis,
    ReplacementResult, PriceHistory, AllergenType, DietaryLabel
)


class BakeCalculator:
    """烘焙计算器核心类"""
    
    def __init__(self):
        self.ingredients: Dict[str, Ingredient] = {}
        self.recipes: Dict[str, Recipe] = {}
        self.replacement_history: List[ReplacementResult] = []
    
    def _generate_id(self, prefix: str) -> str:
        """生成唯一ID"""
        return f"{prefix}_{uuid.uuid4().hex[:8]}"
    
    # ==================== 原料管理 ====================
    
    def add_ingredient(
        self,
        name: str,
        unit: str,
        current_price: float,
        supplier: str,
        allergens: List[AllergenType] = None,
        dietary_labels: List[DietaryLabel] = None,
        is_substitutable: bool = True,
        substitute_ids: List[str] = None,
        notes: str = ""
    ) -> Ingredient:
        """添加新原料"""
        if current_price < 0:
            raise ValueError(f"原料价格不能为负数: {current_price}")
        
        ingredient_id = self._generate_id("ing")
        
        price_history = [PriceHistory(
            price=current_price,
            purchase_date=datetime.now(),
            supplier=supplier
        )]
        
        ingredient = Ingredient(
            id=ingredient_id,
            name=name,
            unit=unit,
            current_price=current_price,
            supplier=supplier,
            allergens=allergens or [],
            dietary_labels=dietary_labels or [],
            is_substitutable=is_substitutable,
            substitute_ids=substitute_ids or [],
            price_history=price_history,
            notes=notes
        )
        
        self.ingredients[ingredient_id] = ingredient
        return ingredient
    
    def update_ingredient(
        self,
        ingredient_id: str,
        **kwargs
    ) -> Ingredient:
        """更新原料信息"""
        if ingredient_id not in self.ingredients:
            raise KeyError(f"原料不存在: {ingredient_id}")
        
        ingredient = self.ingredients[ingredient_id]
        
        allowed_fields = [
            "name", "unit", "current_price", "supplier",
            "allergens", "dietary_labels", "is_substitutable",
            "substitute_ids", "notes"
        ]
        
        for key, value in kwargs.items():
            if key == "current_price" and value != ingredient.current_price:
                ingredient.price_history.append(PriceHistory(
                    price=value,
                    purchase_date=datetime.now(),
                    supplier=kwargs.get("supplier", ingredient.supplier)
                ))
            
            if key in allowed_fields:
                setattr(ingredient, key, value)
        
        ingredient.updated_at = datetime.now()
        return ingredient
    
    def get_ingredient(self, ingredient_id: str) -> Optional[Ingredient]:
        """获取原料"""
        return self.ingredients.get(ingredient_id)
    
    def get_all_ingredients(self) -> List[Ingredient]:
        """获取所有原料"""
        return list(self.ingredients.values())
    
    def delete_ingredient(self, ingredient_id: str) -> bool:
        """删除原料（检查是否被配方使用）"""
        for recipe in self.recipes.values():
            for ri in recipe.ingredients:
                if ri.ingredient_id == ingredient_id:
                    raise ValueError(f"原料 {ingredient_id} 正在被配方 {recipe.name} 使用，无法删除")
        
        if ingredient_id in self.ingredients:
            del self.ingredients[ingredient_id]
            return True
        return False
    
    def find_ingredient_by_name(self, name: str) -> List[Ingredient]:
        """按名称查找原料"""
        return [
            ing for ing in self.ingredients.values()
            if name.lower() in ing.name.lower()
        ]
    
    def get_ingredient_price_history(self, ingredient_id: str) -> List[PriceHistory]:
        """获取原料价格历史"""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            raise KeyError(f"原料不存在: {ingredient_id}")
        return ingredient.price_history
    
    # ==================== 配方管理 ====================
    
    def add_recipe(
        self,
        sku: str,
        name: str,
        description: str,
        yield_quantity: float,
        yield_unit: str,
        target_price: float,
        ingredients: List[Dict] = None,
        notes: str = ""
    ) -> Recipe:
        """添加新配方"""
        if target_price <= 0:
            raise ValueError(f"目标售价必须大于 0: {target_price}")
        
        if yield_quantity <= 0:
            raise ValueError(f"成品产量必须大于 0: {yield_quantity}")
        
        recipe_id = self._generate_id("recipe")
        
        recipe_ingredients = []
        if ingredients:
            for ing_data in ingredients:
                ingredient_id = ing_data["ingredient_id"]
                if ingredient_id not in self.ingredients:
                    raise KeyError(f"原料不存在: {ingredient_id}")
                
                if ing_data["quantity"] <= 0:
                    raise ValueError(f"原料用量必须大于 0: {ing_data['quantity']}")
                
                if ing_data.get("waste_rate", 0) < 0 or ing_data.get("waste_rate", 0) > 1:
                    raise ValueError(f"损耗率必须在 0-1 之间: {ing_data.get('waste_rate', 0)}")
                
                recipe_ingredients.append(RecipeIngredient(
                    ingredient_id=ingredient_id,
                    quantity=ing_data["quantity"],
                    waste_rate=ing_data.get("waste_rate", 0.0),
                    notes=ing_data.get("notes", "")
                ))
        
        recipe = Recipe(
            id=recipe_id,
            sku=sku,
            name=name,
            description=description,
            yield_quantity=yield_quantity,
            yield_unit=yield_unit,
            target_price=target_price,
            ingredients=recipe_ingredients,
            notes=notes
        )
        
        self.recipes[recipe_id] = recipe
        return recipe
    
    def update_recipe(self, recipe_id: str, **kwargs) -> Recipe:
        """更新配方"""
        if recipe_id not in self.recipes:
            raise KeyError(f"配方不存在: {recipe_id}")
        
        recipe = self.recipes[recipe_id]
        
        allowed_fields = [
            "sku", "name", "description", "yield_quantity",
            "yield_unit", "target_price", "ingredients", "notes"
        ]
        
        for key, value in kwargs.items():
            if key in allowed_fields:
                setattr(recipe, key, value)
        
        recipe.updated_at = datetime.now()
        return recipe
    
    def get_recipe(self, recipe_id: str) -> Optional[Recipe]:
        """获取配方"""
        return self.recipes.get(recipe_id)
    
    def get_all_recipes(self) -> List[Recipe]:
        """获取所有配方"""
        return list(self.recipes.values())
    
    def get_recipe_by_sku(self, sku: str) -> Optional[Recipe]:
        """按SKU获取配方"""
        for recipe in self.recipes.values():
            if recipe.sku == sku:
                return recipe
        return None
    
    def delete_recipe(self, recipe_id: str) -> bool:
        """删除配方"""
        if recipe_id in self.recipes:
            del self.recipes[recipe_id]
            return True
        return False
    
    def add_recipe_ingredient(
        self,
        recipe_id: str,
        ingredient_id: str,
        quantity: float,
        waste_rate: float = 0.0,
        notes: str = ""
    ) -> Recipe:
        """向配方添加原料"""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            raise KeyError(f"配方不存在: {recipe_id}")
        
        if ingredient_id not in self.ingredients:
            raise KeyError(f"原料不存在: {ingredient_id}")
        
        if quantity <= 0:
            raise ValueError(f"原料用量必须大于 0: {quantity}")
        
        if waste_rate < 0 or waste_rate > 1:
            raise ValueError(f"损耗率必须在 0-1 之间: {waste_rate}")
        
        for ri in recipe.ingredients:
            if ri.ingredient_id == ingredient_id:
                ri.quantity = quantity
                ri.waste_rate = waste_rate
                ri.notes = notes
                recipe.updated_at = datetime.now()
                return recipe
        
        recipe.ingredients.append(RecipeIngredient(
            ingredient_id=ingredient_id,
            quantity=quantity,
            waste_rate=waste_rate,
            notes=notes
        ))
        
        recipe.updated_at = datetime.now()
        return recipe
    
    def remove_recipe_ingredient(self, recipe_id: str, ingredient_id: str) -> Recipe:
        """从配方移除原料"""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            raise KeyError(f"配方不存在: {recipe_id}")
        
        recipe.ingredients = [
            ri for ri in recipe.ingredients
            if ri.ingredient_id != ingredient_id
        ]
        
        recipe.updated_at = datetime.now()
        return recipe
    
    # ==================== 成本计算 ====================
    
    def calculate_recipe_cost(self, recipe_id: str) -> RecipeCostAnalysis:
        """计算配方成本分析"""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            raise KeyError(f"配方不存在: {recipe_id}")
        
        theoretical_cost = 0.0
        actual_cost = 0.0
        ingredient_breakdown = []
        all_allergens: Set[AllergenType] = set()
        all_dietary_labels: Set[DietaryLabel] = set()
        
        for ri in recipe.ingredients:
            ingredient = self.get_ingredient(ri.ingredient_id)
            if not ingredient:
                continue
            
            base_cost = ingredient.current_price * ri.quantity
            theoretical_cost += base_cost
            
            actual_quantity = ri.quantity * (1 + ri.waste_rate)
            actual_cost += ingredient.current_price * actual_quantity
            
            ingredient_breakdown.append({
                "ingredient_id": ingredient.id,
                "ingredient_name": ingredient.name,
                "quantity": ri.quantity,
                "unit": ingredient.unit,
                "waste_rate": ri.waste_rate,
                "actual_quantity": actual_quantity,
                "unit_price": ingredient.current_price,
                "cost": base_cost,
                "actual_cost": ingredient.current_price * actual_quantity,
                "supplier": ingredient.supplier
            })
            
            all_allergens.update(ingredient.allergens)
            
            if not all_dietary_labels:
                all_dietary_labels.update(ingredient.dietary_labels)
            else:
                all_dietary_labels = all_dietary_labels.intersection(ingredient.dietary_labels)
        
        if recipe.target_price > 0:
            theoretical_margin = 1 - (theoretical_cost / recipe.target_price) if theoretical_cost <= recipe.target_price else -float('inf')
            actual_margin = 1 - (actual_cost / recipe.target_price) if actual_cost <= recipe.target_price else -float('inf')
        else:
            theoretical_margin = 0.0
            actual_margin = 0.0
        
        if recipe.yield_quantity > 0:
            cost_per_unit = actual_cost / recipe.yield_quantity
        else:
            cost_per_unit = actual_cost
        
        return RecipeCostAnalysis(
            recipe_id=recipe.id,
            recipe_name=recipe.name,
            sku=recipe.sku,
            theoretical_cost=round(theoretical_cost, 2),
            actual_cost=round(actual_cost, 2),
            target_price=recipe.target_price,
            theoretical_margin=round(theoretical_margin, 4),
            actual_margin=round(actual_margin, 4),
            yield_quantity=recipe.yield_quantity,
            yield_unit=recipe.yield_unit,
            cost_per_unit=round(cost_per_unit, 2),
            ingredient_breakdown=ingredient_breakdown,
            allergens=sorted(all_allergens, key=lambda x: x.value),
            dietary_labels=sorted(all_dietary_labels, key=lambda x: x.value),
            created_at=datetime.now()
        )
    
    # ==================== 替换演练 ====================
    
    def get_possible_replacements(self, recipe_id: str) -> Dict[str, List[Ingredient]]:
        """获取配方中可替换的原料及其候选替换品"""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            raise KeyError(f"配方不存在: {recipe_id}")
        
        replacements = {}
        
        for ri in recipe.ingredients:
            ingredient = self.get_ingredient(ri.ingredient_id)
            if not ingredient:
                continue
            
            if not ingredient.is_substitutable and not ingredient.substitute_ids:
                continue
            
            candidates = []
            
            for sub_id in ingredient.substitute_ids:
                sub_ing = self.get_ingredient(sub_id)
                if sub_ing:
                    candidates.append(sub_ing)
            
            if ingredient.is_substitutable:
                for other in self.ingredients.values():
                    if other.id != ingredient.id:
                        if other.unit == ingredient.unit:
                            if other.id not in [c.id for c in candidates]:
                                candidates.append(other)
            
            if candidates:
                replacements[ingredient.id] = candidates
        
        return replacements
    
    def simulate_replacement(
        self,
        recipe_id: str,
        original_ingredient_id: str,
        replacement_ingredient_id: str
    ) -> ReplacementResult:
        """模拟原料替换，计算影响"""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            raise KeyError(f"配方不存在: {recipe_id}")
        
        original_ingredient = self.get_ingredient(original_ingredient_id)
        if not original_ingredient:
            raise KeyError(f"原原料不存在: {original_ingredient_id}")
        
        replacement_ingredient = self.get_ingredient(replacement_ingredient_id)
        if not replacement_ingredient:
            raise KeyError(f"替换原料不存在: {replacement_ingredient_id}")
        
        recipe_ingredient = None
        for ri in recipe.ingredients:
            if ri.ingredient_id == original_ingredient_id:
                recipe_ingredient = ri
                break
        
        if not recipe_ingredient:
            raise ValueError(f"配方中不包含原料: {original_ingredient_id}")
        
        warnings = []
        is_recommended = True
        
        if original_ingredient.unit != replacement_ingredient.unit:
            warnings.append(f"单位不一致: 原原料({original_ingredient.unit}) vs 替换品({replacement_ingredient.unit})")
            is_recommended = False
        
        if not original_ingredient.is_substitutable:
            if replacement_ingredient_id not in original_ingredient.substitute_ids:
                warnings.append(f"该原料标记为不可替代，且替换品不在预设候选列表中")
                is_recommended = False
        
        original_analysis = self.calculate_recipe_cost(recipe_id)
        
        original_cost = original_analysis.actual_cost
        
        original_base_cost = original_ingredient.current_price * recipe_ingredient.quantity
        original_actual_cost = original_base_cost * (1 + recipe_ingredient.waste_rate)
        
        replacement_base_cost = replacement_ingredient.current_price * recipe_ingredient.quantity
        replacement_actual_cost = replacement_base_cost * (1 + recipe_ingredient.waste_rate)
        
        new_cost = original_cost - original_actual_cost + replacement_actual_cost
        
        cost_difference = new_cost - original_cost
        cost_difference_percentage = (cost_difference / original_cost * 100) if original_cost > 0 else 0.0
        
        if recipe.target_price > 0:
            original_margin = 1 - (original_cost / recipe.target_price)
            new_margin = 1 - (new_cost / recipe.target_price)
        else:
            original_margin = 0.0
            new_margin = 0.0
        
        margin_difference = new_margin - original_margin
        
        original_allergens = original_analysis.allergens.copy()
        
        new_allergens_set = set(original_allergens)
        new_allergens_set.difference_update(original_ingredient.allergens)
        new_allergens_set.update(replacement_ingredient.allergens)
        new_allergens = sorted(new_allergens_set, key=lambda x: x.value)
        
        added_allergens = sorted(
            set(replacement_ingredient.allergens) - set(original_ingredient.allergens),
            key=lambda x: x.value
        )
        
        removed_allergens = sorted(
            set(original_ingredient.allergens) - set(replacement_ingredient.allergens),
            key=lambda x: x.value
        )
        
        if added_allergens:
            warnings.append(f"新增过敏原: {', '.join([a.value for a in added_allergens])}")
            is_recommended = False
        
        original_labels = original_analysis.dietary_labels.copy()
        
        new_labels_set = set()
        for ri in recipe.ingredients:
            if ri.ingredient_id == original_ingredient_id:
                ing = replacement_ingredient
            else:
                ing = self.get_ingredient(ri.ingredient_id)
            
            if not ing:
                continue
            
            if not new_labels_set:
                new_labels_set.update(ing.dietary_labels)
            else:
                new_labels_set = new_labels_set.intersection(ing.dietary_labels)
        
        new_labels = sorted(new_labels_set, key=lambda x: x.value)
        
        added_labels = sorted(
            new_labels_set - set(original_labels),
            key=lambda x: x.value
        )
        
        removed_labels = sorted(
            set(original_labels) - new_labels_set,
            key=lambda x: x.value
        )
        
        if removed_labels:
            warnings.append(f"失去饮食标签: {', '.join([d.value for d in removed_labels])}")
        
        if new_cost > original_cost:
            warnings.append(f"成本增加 ¥{abs(cost_difference):.2f} ({cost_difference_percentage:.1f}%)，毛利率下降 {(margin_difference * 100):.1f}个百分点")
        
        result = ReplacementResult(
            original_recipe_id=recipe_id,
            original_ingredient_id=original_ingredient_id,
            replacement_ingredient_id=replacement_ingredient_id,
            original_cost=round(original_cost, 2),
            new_cost=round(new_cost, 2),
            cost_difference=round(cost_difference, 2),
            cost_difference_percentage=round(cost_difference_percentage, 2),
            original_margin=round(original_margin, 4),
            new_margin=round(new_margin, 4),
            margin_difference=round(margin_difference, 4),
            original_allergens=original_allergens,
            new_allergens=new_allergens,
            added_allergens=added_allergens,
            removed_allergens=removed_allergens,
            original_dietary_labels=original_labels,
            new_dietary_labels=new_labels,
            added_dietary_labels=added_labels,
            removed_dietary_labels=removed_labels,
            warnings=warnings,
            is_recommended=is_recommended,
            created_at=datetime.now()
        )
        
        self.replacement_history.append(result)
        
        return result
    
    def get_replacement_history(self) -> List[ReplacementResult]:
        """获取替换演练历史"""
        return self.replacement_history
