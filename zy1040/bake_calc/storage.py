"""
本地持久化存储模块
"""

import os
import json
from pathlib import Path
from typing import Optional
from datetime import datetime

from .models import Ingredient, Recipe, ReplacementResult
from .manager import BakeCalculator


class StorageManager:
    """存储管理器"""
    
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir:
            self.data_dir = Path(data_dir)
        else:
            self.data_dir = Path.home() / ".bake-calc" / "data"
        
        self.ingredients_file = self.data_dir / "ingredients.json"
        self.recipes_file = self.data_dir / "recipes.json"
        self.replacement_history_file = self.data_dir / "replacement_history.json"
        
        self._ensure_data_dir()
    
    def _ensure_data_dir(self):
        """确保数据目录存在"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def save(self, calculator: BakeCalculator) -> None:
        """保存所有数据"""
        self._save_ingredients(calculator)
        self._save_recipes(calculator)
        self._save_replacement_history(calculator)
    
    def load(self) -> BakeCalculator:
        """加载所有数据"""
        calculator = BakeCalculator()
        
        self._load_ingredients(calculator)
        self._load_recipes(calculator)
        self._load_replacement_history(calculator)
        
        return calculator
    
    def _save_ingredients(self, calculator: BakeCalculator):
        """保存原料数据"""
        data = {
            "version": "1.0",
            "saved_at": datetime.now().isoformat(),
            "ingredients": [
                ing.to_dict() for ing in calculator.get_all_ingredients()
            ]
        }
        
        with open(self.ingredients_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_ingredients(self, calculator: BakeCalculator):
        """加载原料数据"""
        if not self.ingredients_file.exists():
            return
        
        with open(self.ingredients_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for ing_data in data.get("ingredients", []):
            ingredient = Ingredient.from_dict(ing_data)
            calculator.ingredients[ingredient.id] = ingredient
    
    def _save_recipes(self, calculator: BakeCalculator):
        """保存配方数据"""
        data = {
            "version": "1.0",
            "saved_at": datetime.now().isoformat(),
            "recipes": [
                recipe.to_dict() for recipe in calculator.get_all_recipes()
            ]
        }
        
        with open(self.recipes_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_recipes(self, calculator: BakeCalculator):
        """加载配方数据"""
        if not self.recipes_file.exists():
            return
        
        with open(self.recipes_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for recipe_data in data.get("recipes", []):
            recipe = Recipe.from_dict(recipe_data)
            calculator.recipes[recipe.id] = recipe
    
    def _save_replacement_history(self, calculator: BakeCalculator):
        """保存替换演练历史"""
        data = {
            "version": "1.0",
            "saved_at": datetime.now().isoformat(),
            "history": [
                result.to_dict() for result in calculator.get_replacement_history()
            ]
        }
        
        with open(self.replacement_history_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_replacement_history(self, calculator: BakeCalculator):
        """加载替换演练历史"""
        if not self.replacement_history_file.exists():
            return
        
        with open(self.replacement_history_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for result_data in data.get("history", []):
            result = ReplacementResult.from_dict(result_data)
            calculator.replacement_history.append(result)
    
    def export_backup(self, filepath: str) -> str:
        """导出完整备份"""
        full_data = {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "ingredients": [
                ing.to_dict() for ing in self._load_ingredients_from_file()
            ],
            "recipes": [
                recipe.to_dict() for recipe in self._load_recipes_from_file()
            ],
            "replacement_history": [
                result.to_dict() for result in self._load_replacement_history_from_file()
            ]
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(full_data, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def import_backup(self, filepath: str) -> BakeCalculator:
        """从备份恢复"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        calculator = BakeCalculator()
        
        for ing_data in data.get("ingredients", []):
            ingredient = Ingredient.from_dict(ing_data)
            calculator.ingredients[ingredient.id] = ingredient
        
        for recipe_data in data.get("recipes", []):
            recipe = Recipe.from_dict(recipe_data)
            calculator.recipes[recipe.id] = recipe
        
        for result_data in data.get("replacement_history", []):
            result = ReplacementResult.from_dict(result_data)
            calculator.replacement_history.append(result)
        
        return calculator
    
    def _load_ingredients_from_file(self) -> list:
        """从文件加载原料列表"""
        if not self.ingredients_file.exists():
            return []
        
        with open(self.ingredients_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [Ingredient.from_dict(ing_data) for ing_data in data.get("ingredients", [])]
    
    def _load_recipes_from_file(self) -> list:
        """从文件加载配方列表"""
        if not self.recipes_file.exists():
            return []
        
        with open(self.recipes_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [Recipe.from_dict(recipe_data) for recipe_data in data.get("recipes", [])]
    
    def _load_replacement_history_from_file(self) -> list:
        """从文件加载替换历史"""
        if not self.replacement_history_file.exists():
            return []
        
        with open(self.replacement_history_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [ReplacementResult.from_dict(result_data) for result_data in data.get("history", [])]
