import tempfile
from pathlib import Path
from typing import Dict

import pytest

from water_activity_cli.models import Ingredient, Recipe, FormulaIngredient, WaterActivityTarget, BakingProfile, Unit


@pytest.fixture
def sample_ingredients() -> Dict[str, Ingredient]:
    return {
        "面粉": Ingredient(
            name="面粉",
            moisture_content_wet=0.12,
            aw=0.55,
        ),
        "白砂糖": Ingredient(
            name="白砂糖",
            moisture_content_wet=0.005,
            aw=0.10,
        ),
        "黄油": Ingredient(
            name="黄油",
            moisture_content_wet=0.16,
            aw=0.90,
        ),
        "鸡蛋": Ingredient(
            name="鸡蛋",
            moisture_content_wet=0.76,
            aw=0.98,
        ),
        "水": Ingredient(
            name="水",
            moisture_content_wet=1.0,
            aw=1.00,
        ),
    }


@pytest.fixture
def sample_recipe(sample_ingredients) -> Recipe:
    return Recipe(
        name="测试曲奇",
        version="1.0",
        batch_size=1.0,
        batch_unit=Unit.KILOGRAM,
        ingredients=[
            FormulaIngredient(name="面粉", amount=400, unit=Unit.GRAM),
            FormulaIngredient(name="白砂糖", amount=200, unit=Unit.GRAM),
            FormulaIngredient(name="黄油", amount=200, unit=Unit.GRAM),
            FormulaIngredient(name="鸡蛋", amount=100, unit=Unit.GRAM),
            FormulaIngredient(name="水", amount=100, unit=Unit.GRAM),
        ],
        target=WaterActivityTarget(
            target_aw=0.65,
            safety_margin_aw=0.02,
        ),
        baking_profile=BakingProfile(
            loss_percentage=0.08,
            loss_is_water_only=True,
        ),
    )


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


@pytest.fixture
def temp_ingredients_file(temp_dir, sample_ingredients) -> Path:
    import yaml
    data = {
        "ingredients": [
            {
                "name": ing.name,
                "moisture_content_wet": float(ing.moisture_content_wet),
                "aw": float(ing.aw) if ing.aw else None,
            }
            for ing in sample_ingredients.values()
        ]
    }
    file_path = temp_dir / "ingredients.yaml"
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True)
    return file_path


@pytest.fixture
def temp_recipe_file(temp_dir) -> Path:
    import yaml
    data = {
        "name": "测试曲奇",
        "version": "1.0",
        "batch_size": 1.0,
        "batch_unit": "kg",
        "ingredients": [
            {"name": "面粉", "amount": 400, "unit": "g"},
            {"name": "白砂糖", "amount": 200, "unit": "g"},
            {"name": "黄油", "amount": 200, "unit": "g"},
            {"name": "鸡蛋", "amount": 100, "unit": "g"},
            {"name": "水", "amount": 100, "unit": "g"},
        ],
        "target": {
            "target_aw": 0.65,
            "safety_margin_aw": 0.02,
        },
        "baking_profile": {
            "loss_percentage": 0.08,
            "loss_is_water_only": True,
        },
    }
    file_path = temp_dir / "recipe.yaml"
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True)
    return file_path
