import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, TextIO, Union

import yaml

from water_activity_cli.models import (
    BakingProfile,
    FormulaIngredient,
    Ingredient,
    Recipe,
    Unit,
    WaterActivityTarget,
)


def parse_decimal(value: Any) -> Decimal:
    if value is None:
        raise ValueError("数值不能为空")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, str):
        value = value.strip()
        if value.endswith("%"):
            value = value[:-1].strip()
            return Decimal(value) / Decimal("100")
        return Decimal(value)
    raise ValueError(f"无法解析数值: {value}")


def parse_unit(value: Any) -> Unit:
    if value is None:
        return Unit.GRAM
    if isinstance(value, Unit):
        return value
    value = str(value).lower().strip()
    unit_map = {
        "g": Unit.GRAM,
        "gram": Unit.GRAM,
        "grams": Unit.GRAM,
        "kg": Unit.KILOGRAM,
        "kilogram": Unit.KILOGRAM,
        "kilograms": Unit.KILOGRAM,
        "mg": Unit.MILLIGRAM,
        "milligram": Unit.MILLIGRAM,
        "milligrams": Unit.MILLIGRAM,
    }
    if value in unit_map:
        return unit_map[value]
    return Unit.GRAM


class IngredientLibraryParser:
    @staticmethod
    def parse_yaml(file_path: Union[str, Path]) -> Dict[str, Ingredient]:
        file_path = Path(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        ingredients = {}
        if "ingredients" in data:
            for item in data["ingredients"]:
                ing = IngredientLibraryParser._parse_ingredient_item(item)
                ingredients[ing.name] = ing
        return ingredients

    @staticmethod
    def _parse_ingredient_item(item: Dict[str, Any]) -> Ingredient:
        name = item.get("name")
        if not name:
            raise ValueError("原料名称不能为空")
        
        moisture_wet = item.get("moisture_content_wet")
        if moisture_wet is not None:
            moisture_wet = parse_decimal(moisture_wet)
            if moisture_wet > 1:
                moisture_wet = moisture_wet / Decimal("100")
        else:
            moisture_wet = Decimal("0")
        
        moisture_dry = item.get("moisture_content_dry")
        if moisture_dry is not None:
            moisture_dry = parse_decimal(moisture_dry)
        
        aw = item.get("aw")
        if aw is not None:
            aw = parse_decimal(aw)
        
        sorption = item.get("sorption_isotherm")
        if sorption:
            sorption = {str(k): parse_decimal(v) for k, v in sorption.items()}
        
        return Ingredient(
            name=name,
            moisture_content_wet=moisture_wet,
            moisture_content_dry=moisture_dry,
            aw=aw,
            sorption_isotherm=sorption,
            notes=item.get("notes"),
        )


class RecipeParser:
    @staticmethod
    def parse_yaml(file_path: Union[str, Path]) -> Recipe:
        file_path = Path(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        return RecipeParser._parse_recipe_dict(data)

    @staticmethod
    def parse_csv(file_path: Union[str, Path]) -> Recipe:
        file_path = Path(file_path)
        metadata: Dict[str, Any] = {}
        ingredients: List[Dict[str, Any]] = []
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                row = {k.strip(): v.strip() for k, v in row.items() if k}
                if "原料名称" in row and row["原料名称"]:
                    ingredients.append(row)
                elif "配方名称" in row and row["配方名称"]:
                    metadata["name"] = row["配方名称"]
                elif "批次重量" in row and row["批次重量"]:
                    metadata["batch_size"] = row["批次重量"]
                elif "批次单位" in row and row["批次单位"]:
                    metadata["batch_unit"] = row["批次单位"]
                elif "目标水分活度" in row and row["目标水分活度"]:
                    if "target" not in metadata:
                        metadata["target"] = {}
                    metadata["target"]["target_aw"] = row["目标水分活度"]
                elif "烘烤损耗率" in row and row["烘烤损耗率"]:
                    if "baking_profile" not in metadata:
                        metadata["baking_profile"] = {}
                    metadata["baking_profile"]["loss_percentage"] = row["烘烤损耗率"]
        
        return RecipeParser._parse_recipe_from_csv_metadata(metadata, ingredients)

    @staticmethod
    def _parse_recipe_dict(data: Dict[str, Any]) -> Recipe:
        name = data.get("name", "未命名配方")
        version = data.get("version")
        
        batch_size = parse_decimal(data.get("batch_size", 1))
        batch_unit = parse_unit(data.get("batch_unit"))
        
        target_data = data.get("target", {})
        target_aw = parse_decimal(target_data.get("target_aw", "0.85"))
        safety_margin = target_data.get("safety_margin_aw")
        if safety_margin:
            safety_margin = parse_decimal(safety_margin)
        min_aw = target_data.get("min_aw")
        if min_aw:
            min_aw = parse_decimal(min_aw)
        max_aw = target_data.get("max_aw")
        if max_aw:
            max_aw = parse_decimal(max_aw)
        
        target = WaterActivityTarget(
            target_aw=target_aw,
            safety_margin_aw=safety_margin,
            min_aw=min_aw,
            max_aw=max_aw,
        )
        
        baking_data = data.get("baking_profile")
        baking_profile = None
        if baking_data:
            loss_pct = baking_data.get("loss_percentage")
            if loss_pct:
                loss_pct = parse_decimal(loss_pct)
                if loss_pct > 1:
                    loss_pct = loss_pct / Decimal("100")
            baking_profile = BakingProfile(
                loss_percentage=loss_pct if loss_pct else Decimal("0"),
                loss_is_water_only=baking_data.get("loss_is_water_only", True),
                notes=baking_data.get("notes"),
            )
        
        ingredients_data = data.get("ingredients", [])
        ingredients = []
        for item in ingredients_data:
            ing = RecipeParser._parse_formula_ingredient(item)
            ingredients.append(ing)
        
        return Recipe(
            name=name,
            version=version,
            batch_size=batch_size,
            batch_unit=batch_unit,
            ingredients=ingredients,
            target=target,
            baking_profile=baking_profile,
            notes=data.get("notes"),
        )

    @staticmethod
    def _parse_recipe_from_csv_metadata(metadata: Dict[str, Any], ingredients_rows: List[Dict[str, Any]]) -> Recipe:
        name = metadata.get("name", "未命名配方")
        batch_size = parse_decimal(metadata.get("batch_size", 1))
        batch_unit = parse_unit(metadata.get("batch_unit", "kg"))
        
        target_data = metadata.get("target", {})
        target_aw = parse_decimal(target_data.get("target_aw", "0.85"))
        target = WaterActivityTarget(target_aw=target_aw)
        
        baking_data = metadata.get("baking_profile")
        baking_profile = None
        if baking_data:
            loss_pct = baking_data.get("loss_percentage")
            if loss_pct:
                loss_pct = parse_decimal(loss_pct)
                if loss_pct > 1:
                    loss_pct = loss_pct / Decimal("100")
            baking_profile = BakingProfile(
                loss_percentage=loss_pct if loss_pct else Decimal("0"),
            )
        
        ingredients = []
        for row in ingredients_rows:
            item = {
                "name": row.get("原料名称") or row.get("name"),
                "amount": row.get("用量") or row.get("amount"),
                "unit": row.get("单位") or row.get("unit"),
            }
            ing = RecipeParser._parse_formula_ingredient(item)
            ingredients.append(ing)
        
        return Recipe(
            name=name,
            batch_size=batch_size,
            batch_unit=batch_unit,
            ingredients=ingredients,
            target=target,
            baking_profile=baking_profile,
        )

    @staticmethod
    def _parse_formula_ingredient(item: Dict[str, Any]) -> FormulaIngredient:
        name = item.get("name")
        if not name:
            raise ValueError("原料名称不能为空")
        
        amount = item.get("amount")
        if amount is None:
            raise ValueError(f"原料 '{name}' 的用量不能为空")
        amount = parse_decimal(amount)
        
        unit = parse_unit(item.get("unit"))
        
        moisture_override = item.get("moisture_override")
        if moisture_override is not None:
            moisture_override = parse_decimal(moisture_override)
            if moisture_override > 1:
                moisture_override = moisture_override / Decimal("100")
        
        aw_override = item.get("aw_override")
        if aw_override is not None:
            aw_override = parse_decimal(aw_override)
        
        return FormulaIngredient(
            name=name,
            amount=amount,
            unit=unit,
            moisture_override=moisture_override,
            aw_override=aw_override,
        )


def load_ingredient_library(path: Union[str, Path]) -> Dict[str, Ingredient]:
    path = Path(path)
    if path.suffix.lower() in (".yaml", ".yml"):
        return IngredientLibraryParser.parse_yaml(path)
    raise ValueError(f"不支持的原料库文件格式: {path.suffix}")


def load_recipe(path: Union[str, Path]) -> Recipe:
    path = Path(path)
    if path.suffix.lower() in (".yaml", ".yml"):
        return RecipeParser.parse_yaml(path)
    elif path.suffix.lower() == ".csv":
        return RecipeParser.parse_csv(path)
    raise ValueError(f"不支持的配方文件格式: {path.suffix}")
