"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class AllergenType(Enum):
    """过敏原类型"""
    MILK = "乳制品"
    EGGS = "鸡蛋"
    NUTS = "坚果"
    PEANUTS = "花生"
    WHEAT = "小麦"
    SOY = "大豆"
    FISH = "鱼类"
    SHELLFISH = "甲壳类"


class DietaryLabel(Enum):
    """饮食标签"""
    VEGAN = "纯素"
    VEGETARIAN = "素食"
    DAIRY_FREE = "无乳制品"
    NUT_FREE = "无坚果"
    GLUTEN_FREE = "无麸质"


@dataclass
class PriceHistory:
    """价格历史记录"""
    price: float
    purchase_date: datetime
    supplier: str
    batch_number: Optional[str] = None


@dataclass
class Ingredient:
    """原料"""
    id: str
    name: str
    unit: str
    current_price: float
    supplier: str
    allergens: List[AllergenType] = field(default_factory=list)
    dietary_labels: List[DietaryLabel] = field(default_factory=list)
    is_substitutable: bool = True
    substitute_ids: List[str] = field(default_factory=list)
    price_history: List[PriceHistory] = field(default_factory=list)
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "unit": self.unit,
            "current_price": self.current_price,
            "supplier": self.supplier,
            "allergens": [a.value for a in self.allergens],
            "dietary_labels": [d.value for d in self.dietary_labels],
            "is_substitutable": self.is_substitutable,
            "substitute_ids": self.substitute_ids,
            "price_history": [
                {
                    "price": ph.price,
                    "purchase_date": ph.purchase_date.isoformat(),
                    "supplier": ph.supplier,
                    "batch_number": ph.batch_number
                }
                for ph in self.price_history
            ],
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Ingredient":
        price_history = []
        for ph_data in data.get("price_history", []):
            try:
                purchase_date = datetime.fromisoformat(ph_data["purchase_date"])
            except (ValueError, KeyError):
                purchase_date = datetime.now()
            
            price_history.append(PriceHistory(
                price=ph_data["price"],
                purchase_date=purchase_date,
                supplier=ph_data.get("supplier", ""),
                batch_number=ph_data.get("batch_number")
            ))
        
        try:
            created_at = datetime.fromisoformat(data.get("created_at", datetime.now().isoformat()))
        except ValueError:
            created_at = datetime.now()
        
        try:
            updated_at = datetime.fromisoformat(data.get("updated_at", datetime.now().isoformat()))
        except ValueError:
            updated_at = datetime.now()
        
        return cls(
            id=data["id"],
            name=data["name"],
            unit=data["unit"],
            current_price=data["current_price"],
            supplier=data["supplier"],
            allergens=[AllergenType(a) for a in data.get("allergens", [])],
            dietary_labels=[DietaryLabel(d) for d in data.get("dietary_labels", [])],
            is_substitutable=data.get("is_substitutable", True),
            substitute_ids=data.get("substitute_ids", []),
            price_history=price_history,
            notes=data.get("notes", ""),
            created_at=created_at,
            updated_at=updated_at
        )


@dataclass
class RecipeIngredient:
    """配方中的原料用量"""
    ingredient_id: str
    quantity: float
    waste_rate: float = 0.0
    notes: str = ""


@dataclass
class Recipe:
    """配方/SKU"""
    id: str
    sku: str
    name: str
    description: str
    yield_quantity: float
    yield_unit: str
    target_price: float
    ingredients: List[RecipeIngredient] = field(default_factory=list)
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "sku": self.sku,
            "name": self.name,
            "description": self.description,
            "yield_quantity": self.yield_quantity,
            "yield_unit": self.yield_unit,
            "target_price": self.target_price,
            "ingredients": [
                {
                    "ingredient_id": ri.ingredient_id,
                    "quantity": ri.quantity,
                    "waste_rate": ri.waste_rate,
                    "notes": ri.notes
                }
                for ri in self.ingredients
            ],
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Recipe":
        ingredients = [
            RecipeIngredient(
                ingredient_id=ri["ingredient_id"],
                quantity=ri["quantity"],
                waste_rate=ri.get("waste_rate", 0.0),
                notes=ri.get("notes", "")
            )
            for ri in data.get("ingredients", [])
        ]
        
        try:
            created_at = datetime.fromisoformat(data.get("created_at", datetime.now().isoformat()))
        except ValueError:
            created_at = datetime.now()
        
        try:
            updated_at = datetime.fromisoformat(data.get("updated_at", datetime.now().isoformat()))
        except ValueError:
            updated_at = datetime.now()
        
        return cls(
            id=data["id"],
            sku=data["sku"],
            name=data["name"],
            description=data["description"],
            yield_quantity=data["yield_quantity"],
            yield_unit=data["yield_unit"],
            target_price=data["target_price"],
            ingredients=ingredients,
            notes=data.get("notes", ""),
            created_at=created_at,
            updated_at=updated_at
        )


@dataclass
class ReplacementResult:
    """替换演练结果"""
    original_recipe_id: str
    original_ingredient_id: str
    replacement_ingredient_id: str
    original_cost: float
    new_cost: float
    cost_difference: float
    cost_difference_percentage: float
    original_margin: float
    new_margin: float
    margin_difference: float
    original_allergens: List[AllergenType]
    new_allergens: List[AllergenType]
    added_allergens: List[AllergenType]
    removed_allergens: List[AllergenType]
    original_dietary_labels: List[DietaryLabel]
    new_dietary_labels: List[DietaryLabel]
    added_dietary_labels: List[DietaryLabel]
    removed_dietary_labels: List[DietaryLabel]
    warnings: List[str] = field(default_factory=list)
    is_recommended: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_recipe_id": self.original_recipe_id,
            "original_ingredient_id": self.original_ingredient_id,
            "replacement_ingredient_id": self.replacement_ingredient_id,
            "original_cost": self.original_cost,
            "new_cost": self.new_cost,
            "cost_difference": self.cost_difference,
            "cost_difference_percentage": self.cost_difference_percentage,
            "original_margin": self.original_margin,
            "new_margin": self.new_margin,
            "margin_difference": self.margin_difference,
            "original_allergens": [a.value for a in self.original_allergens],
            "new_allergens": [a.value for a in self.new_allergens],
            "added_allergens": [a.value for a in self.added_allergens],
            "removed_allergens": [a.value for a in self.removed_allergens],
            "original_dietary_labels": [d.value for d in self.original_dietary_labels],
            "new_dietary_labels": [d.value for d in self.new_dietary_labels],
            "added_dietary_labels": [d.value for d in self.added_dietary_labels],
            "removed_dietary_labels": [d.value for d in self.removed_dietary_labels],
            "warnings": self.warnings,
            "is_recommended": self.is_recommended,
            "created_at": self.created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReplacementResult":
        try:
            created_at = datetime.fromisoformat(data.get("created_at", datetime.now().isoformat()))
        except ValueError:
            created_at = datetime.now()
        
        return cls(
            original_recipe_id=data["original_recipe_id"],
            original_ingredient_id=data["original_ingredient_id"],
            replacement_ingredient_id=data["replacement_ingredient_id"],
            original_cost=data["original_cost"],
            new_cost=data["new_cost"],
            cost_difference=data["cost_difference"],
            cost_difference_percentage=data["cost_difference_percentage"],
            original_margin=data["original_margin"],
            new_margin=data["new_margin"],
            margin_difference=data["margin_difference"],
            original_allergens=[AllergenType(a) for a in data.get("original_allergens", [])],
            new_allergens=[AllergenType(a) for a in data.get("new_allergens", [])],
            added_allergens=[AllergenType(a) for a in data.get("added_allergens", [])],
            removed_allergens=[AllergenType(a) for a in data.get("removed_allergens", [])],
            original_dietary_labels=[DietaryLabel(d) for d in data.get("original_dietary_labels", [])],
            new_dietary_labels=[DietaryLabel(d) for d in data.get("new_dietary_labels", [])],
            added_dietary_labels=[DietaryLabel(d) for d in data.get("added_dietary_labels", [])],
            removed_dietary_labels=[DietaryLabel(d) for d in data.get("removed_dietary_labels", [])],
            warnings=data.get("warnings", []),
            is_recommended=data.get("is_recommended", True),
            created_at=created_at
        )


@dataclass
class RecipeCostAnalysis:
    """配方成本分析"""
    recipe_id: str
    recipe_name: str
    sku: str
    theoretical_cost: float
    actual_cost: float
    target_price: float
    theoretical_margin: float
    actual_margin: float
    yield_quantity: float
    yield_unit: str
    cost_per_unit: float
    ingredient_breakdown: List[Dict[str, Any]]
    allergens: List[AllergenType]
    dietary_labels: List[DietaryLabel]
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "recipe_id": self.recipe_id,
            "recipe_name": self.recipe_name,
            "sku": self.sku,
            "theoretical_cost": self.theoretical_cost,
            "actual_cost": self.actual_cost,
            "target_price": self.target_price,
            "theoretical_margin": self.theoretical_margin,
            "actual_margin": self.actual_margin,
            "yield_quantity": self.yield_quantity,
            "yield_unit": self.yield_unit,
            "cost_per_unit": self.cost_per_unit,
            "ingredient_breakdown": self.ingredient_breakdown,
            "allergens": [a.value for a in self.allergens],
            "dietary_labels": [d.value for d in self.dietary_labels],
            "created_at": self.created_at.isoformat()
        }
