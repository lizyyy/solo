import tempfile
from decimal import Decimal
from pathlib import Path

import pytest
import yaml

from water_activity_cli.models import Ingredient, Recipe, Unit
from water_activity_cli.parser import (
    IngredientLibraryParser,
    RecipeParser,
    load_ingredient_library,
    load_recipe,
    parse_decimal,
    parse_unit,
)


class TestParseDecimal:
    def test_parse_string(self):
        assert parse_decimal("123.5") == Decimal("123.5")
    
    def test_parse_percent_string(self):
        assert parse_decimal("12%") == Decimal("0.12")
    
    def test_parse_int(self):
        assert parse_decimal(123) == Decimal("123")
    
    def test_parse_float(self):
        assert parse_decimal(12.5) == Decimal("12.5")
    
    def test_parse_already_decimal(self):
        d = Decimal("123.5")
        assert parse_decimal(d) is d


class TestParseUnit:
    def test_parse_gram(self):
        assert parse_unit("g") == Unit.GRAM
        assert parse_unit("gram") == Unit.GRAM
        assert parse_unit("G") == Unit.GRAM
    
    def test_parse_kilogram(self):
        assert parse_unit("kg") == Unit.KILOGRAM
        assert parse_unit("KG") == Unit.KILOGRAM
    
    def test_parse_milligram(self):
        assert parse_unit("mg") == Unit.MILLIGRAM
    
    def test_parse_none(self):
        assert parse_unit(None) == Unit.GRAM


class TestIngredientLibraryParser:
    def test_parse_yaml_basic(self, temp_dir):
        data = {
            "ingredients": [
                {
                    "name": "测试原料",
                    "moisture_content_wet": 0.12,
                    "aw": 0.55,
                    "notes": "测试用",
                }
            ]
        }
        file_path = temp_dir / "ingredients.yaml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f)
        
        result = IngredientLibraryParser.parse_yaml(file_path)
        
        assert "测试原料" in result
        ing = result["测试原料"]
        assert ing.moisture_content_wet == Decimal("0.12")
        assert ing.aw == Decimal("0.55")
    
    def test_parse_yaml_percent_moisture(self, temp_dir):
        data = {
            "ingredients": [
                {
                    "name": "测试原料",
                    "moisture_content_wet": "12%",
                }
            ]
        }
        file_path = temp_dir / "ingredients.yaml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f)
        
        result = IngredientLibraryParser.parse_yaml(file_path)
        
        ing = result["测试原料"]
        assert float(ing.moisture_content_wet) == pytest.approx(0.12)


class TestRecipeParser:
    def test_parse_yaml_basic(self, temp_dir):
        data = {
            "name": "测试配方",
            "version": "1.0",
            "batch_size": 1.0,
            "batch_unit": "kg",
            "target": {
                "target_aw": 0.65,
            },
            "ingredients": [
                {"name": "面粉", "amount": 500, "unit": "g"},
            ],
        }
        file_path = temp_dir / "recipe.yaml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f)
        
        recipe = RecipeParser.parse_yaml(file_path)
        
        assert recipe.name == "测试配方"
        assert len(recipe.ingredients) == 1
        assert recipe.ingredients[0].name == "面粉"
    
    def test_parse_yaml_with_baking_profile(self, temp_dir):
        data = {
            "name": "测试配方",
            "batch_size": 1.0,
            "batch_unit": "kg",
            "target": {"target_aw": 0.65},
            "baking_profile": {
                "loss_percentage": "8%",
                "loss_is_water_only": True,
                "notes": "测试",
            },
            "ingredients": [
                {"name": "A", "amount": 100, "unit": "g"},
            ],
        }
        file_path = temp_dir / "recipe.yaml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f)
        
        recipe = RecipeParser.parse_yaml(file_path)
        
        assert recipe.baking_profile is not None
        assert float(recipe.baking_profile.loss_percentage) == pytest.approx(0.08)


class TestLoadFunctions:
    def test_load_ingredient_library_yaml(self, temp_ingredients_file):
        result = load_ingredient_library(temp_ingredients_file)
        
        assert len(result) > 0
        assert "面粉" in result
    
    def test_load_recipe_yaml(self, temp_recipe_file):
        result = load_recipe(temp_recipe_file)
        
        assert result.name == "测试曲奇"
        assert len(result.ingredients) > 0
