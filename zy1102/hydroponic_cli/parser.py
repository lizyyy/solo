"""数据解析模块 - 读取和解析各种数据文件"""
import json
import csv
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, date
from pathlib import Path

from .models import (
    Reservoir, Crop, CropStageInfo, Recipe, SolutionInfo,
    Reading, NutrientInventory, DataBundle
)
from .units import VALID_EC_UNITS, VALID_VOLUME_UNITS


class DataParser:
    """数据解析器"""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def parse_all(
        self,
        reservoirs_path: Optional[str] = None,
        crops_path: Optional[str] = None,
        recipes_path: Optional[str] = None,
        readings_path: Optional[str] = None,
        inventory_path: Optional[str] = None
    ) -> DataBundle:
        """解析所有数据文件"""
        reservoirs = {}
        crops = {}
        recipes = {}
        readings = []
        inventory = {}
        
        if reservoirs_path and Path(reservoirs_path).exists():
            reservoirs = self.parse_reservoirs(reservoirs_path)
        
        if crops_path and Path(crops_path).exists():
            crops = self.parse_crops(crops_path)
        
        if recipes_path and Path(recipes_path).exists():
            recipes = self.parse_recipes(recipes_path)
        
        if readings_path and Path(readings_path).exists():
            readings = self.parse_readings(readings_path)
        
        if inventory_path and Path(inventory_path).exists():
            inventory = self.parse_inventory(inventory_path)
        
        return DataBundle(
            reservoirs=reservoirs,
            crops=crops,
            recipes=recipes,
            readings=readings,
            inventory=inventory
        )
    
    def parse_reservoirs(self, filepath: str) -> Dict[str, Reservoir]:
        """解析储液桶 JSON 文件"""
        reservoirs = {}
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict) and 'reservoirs' in data:
                items = data['reservoirs']
            else:
                self.errors.append(f"reservoirs.json 格式错误，应为列表或包含 'reservoirs' 键的对象")
                return reservoirs
            
            for i, item in enumerate(items):
                try:
                    reservoir = self._parse_reservoir_item(item, i)
                    if reservoir.id in reservoirs:
                        self.warnings.append(f"储液桶 ID '{reservoir.id}' 重复，后加载的将覆盖之前的")
                    reservoirs[reservoir.id] = reservoir
                except Exception as e:
                    self.errors.append(f"解析储液桶第 {i} 项失败: {e}")
        
        except json.JSONDecodeError as e:
            self.errors.append(f"reservoirs.json JSON 解析错误: {e}")
        except FileNotFoundError:
            self.errors.append(f"文件未找到: {filepath}")
        except Exception as e:
            self.errors.append(f"解析 reservoirs.json 时发生错误: {e}")
        
        return reservoirs
    
    def _parse_reservoir_item(self, item: Dict, index: int) -> Reservoir:
        """解析单个储液桶项"""
        required_fields = ['id', 'name', 'max_capacity']
        for field in required_fields:
            if field not in item:
                raise ValueError(f"缺少必需字段: {field}")
        
        capacity_unit = item.get('capacity_unit', 'L')
        if capacity_unit not in VALID_VOLUME_UNITS:
            self.warnings.append(f"储液桶 '{item['id']}' 的容量单位 '{capacity_unit}' 可能无效")
        
        return Reservoir(
            id=str(item['id']),
            name=str(item['name']),
            max_capacity=float(item['max_capacity']),
            capacity_unit=capacity_unit,
            description=item.get('description'),
            metadata=item.get('metadata', {})
        )
    
    def parse_crops(self, filepath: str) -> Dict[str, Crop]:
        """解析作物 CSV 文件"""
        crops: Dict[str, Crop] = {}
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        crop_id = str(row.get('crop_id', row.get('id', ''))).strip()
                        if not crop_id:
                            self.errors.append(f"CSV 第 {row_num} 行: 缺少作物 ID")
                            continue
                        
                        crop_name = str(row.get('name', row.get('crop_name', ''))).strip()
                        stage = str(row.get('stage', '')).strip()
                        
                        if not stage:
                            self.errors.append(f"CSV 第 {row_num} 行: 缺少生长阶段")
                            continue
                        
                        if crop_id not in crops:
                            crops[crop_id] = Crop(
                                id=crop_id,
                                name=crop_name or crop_id,
                                common_name=row.get('common_name'),
                                stages={}
                            )
                        
                        stage_info = self._parse_crop_stage_row(row, row_num)
                        crops[crop_id].stages[stage] = stage_info
                        crops[crop_id].stages[stage.lower()] = stage_info
                    
                    except Exception as e:
                        self.errors.append(f"解析作物 CSV 第 {row_num} 行失败: {e}")
        
        except FileNotFoundError:
            self.errors.append(f"文件未找到: {filepath}")
        except Exception as e:
            self.errors.append(f"解析 crops.csv 时发生错误: {e}")
        
        return crops
    
    def _parse_crop_stage_row(self, row: Dict, row_num: int) -> CropStageInfo:
        """解析 CSV 中的作物阶段行"""
        stage = str(row.get('stage', '')).strip()
        
        ec_min = self._safe_float(row.get('ec_min', row.get('target_ec_min')), 1.0)
        ec_max = self._safe_float(row.get('ec_max', row.get('target_ec_max')), 2.0)
        ec_unit = str(row.get('ec_unit', row.get('target_ec_unit', 'mS/cm'))).strip()
        
        ph_min = self._safe_float(row.get('ph_min', row.get('target_ph_min')), 5.5)
        ph_max = self._safe_float(row.get('ph_max', row.get('target_ph_max')), 6.5)
        
        if ec_unit not in VALID_EC_UNITS:
            self.warnings.append(f"CSV 第 {row_num} 行: EC 单位 '{ec_unit}' 可能无效")
        
        return CropStageInfo(
            stage=stage,
            target_ec_min=ec_min,
            target_ec_max=ec_max,
            target_ec_unit=ec_unit,
            target_ph_min=ph_min,
            target_ph_max=ph_max,
            recommended_recipe=row.get('recommended_recipe'),
            notes=row.get('notes')
        )
    
    def parse_recipes(self, filepath: str) -> Dict[str, Recipe]:
        """解析配方 JSON 文件"""
        recipes = {}
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict) and 'recipes' in data:
                items = data['recipes']
            else:
                self.errors.append(f"recipes.json 格式错误")
                return recipes
            
            for i, item in enumerate(items):
                try:
                    recipe = self._parse_recipe_item(item, i)
                    if recipe.id in recipes:
                        self.warnings.append(f"配方 ID '{recipe.id}' 重复")
                    recipes[recipe.id] = recipe
                except Exception as e:
                    self.errors.append(f"解析配方第 {i} 项失败: {e}")
        
        except json.JSONDecodeError as e:
            self.errors.append(f"recipes.json JSON 解析错误: {e}")
        except FileNotFoundError:
            self.errors.append(f"文件未找到: {filepath}")
        except Exception as e:
            self.errors.append(f"解析 recipes.json 时发生错误: {e}")
        
        return recipes
    
    def _parse_recipe_item(self, item: Dict, index: int) -> Recipe:
        """解析单个配方项"""
        required_fields = ['id', 'name', 'type', 'a_solution', 'b_solution']
        for field in required_fields:
            if field not in item:
                raise ValueError(f"缺少必需字段: {field}")
        
        a_solution = self._parse_solution_info(item['a_solution'], "A液")
        b_solution = self._parse_solution_info(item['b_solution'], "B液")
        
        return Recipe(
            id=str(item['id']),
            name=str(item['name']),
            type=str(item['type']),
            a_solution=a_solution,
            b_solution=b_solution,
            mixing_ratio=float(item.get('mixing_ratio', 1.0)),
            description=item.get('description'),
            incompatibility_notes=item.get('incompatibility_notes'),
            source=item.get('source')
        )
    
    def _parse_solution_info(self, data: Dict, name_prefix: str) -> SolutionInfo:
        """解析溶液信息"""
        return SolutionInfo(
            name=str(data.get('name', name_prefix)),
            concentration_per_ml=float(data.get('concentration_per_ml', 1.0)),
            ec_per_ml_per_liter=float(data.get('ec_per_ml_per_liter', 0.1)),
            unit=str(data.get('unit', 'mL')),
            npk_ratio=data.get('npk_ratio'),
            key_elements=data.get('key_elements', [])
        )
    
    def parse_readings(self, filepath: str) -> List[Reading]:
        """解析读数 CSV 文件"""
        readings = []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        reading = self._parse_reading_row(row, row_num)
                        readings.append(reading)
                    except Exception as e:
                        self.errors.append(f"解析读数 CSV 第 {row_num} 行失败: {e}")
        
        except FileNotFoundError:
            self.errors.append(f"文件未找到: {filepath}")
        except Exception as e:
            self.errors.append(f"解析 readings.csv 时发生错误: {e}")
        
        readings.sort(key=lambda r: r.timestamp)
        return readings
    
    def _parse_reading_row(self, row: Dict, row_num: int) -> Reading:
        """解析 CSV 中的读数行"""
        reservoir_id = str(row.get('reservoir_id', row.get('res_id', ''))).strip()
        if not reservoir_id:
            raise ValueError(f"缺少储液桶 ID")
        
        timestamp_str = str(row.get('timestamp', row.get('time', row.get('date', '')))).strip()
        if not timestamp_str:
            raise ValueError(f"缺少时间戳")
        
        try:
            timestamp = self._parse_datetime(timestamp_str)
        except Exception as e:
            raise ValueError(f"时间戳格式错误: {timestamp_str}") from e
        
        ec_value = self._safe_float(row.get('ec_value', row.get('ec')), None)
        if ec_value is None:
            raise ValueError(f"缺少 EC 值")
        
        ec_unit = str(row.get('ec_unit', 'mS/cm')).strip()
        
        ph_value = self._safe_float(row.get('ph_value', row.get('ph')), None)
        if ph_value is None:
            raise ValueError(f"缺少 pH 值")
        
        volume = self._safe_float(row.get('volume'), None)
        volume_unit = str(row.get('volume_unit', 'L')).strip()
        
        temperature = self._safe_float(row.get('temperature'), None)
        
        reading_id = str(row.get('id', f"{reservoir_id}_{timestamp_str}"))
        
        return Reading(
            id=reading_id,
            reservoir_id=reservoir_id,
            timestamp=timestamp,
            ec_value=ec_value,
            ec_unit=ec_unit,
            ph_value=ph_value,
            volume=volume,
            volume_unit=volume_unit,
            temperature=temperature,
            notes=row.get('notes'),
            source=str(row.get('source', 'manual'))
        )
    
    def parse_inventory(self, filepath: str) -> Dict[str, NutrientInventory]:
        """解析库存 JSON 文件"""
        inventory = {}
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict) and 'inventory' in data:
                items = data['inventory']
            else:
                self.errors.append(f"inventory.json 格式错误")
                return inventory
            
            for i, item in enumerate(items):
                try:
                    inv = self._parse_inventory_item(item, i)
                    inventory[inv.id] = inv
                except Exception as e:
                    self.errors.append(f"解析库存第 {i} 项失败: {e}")
        
        except json.JSONDecodeError as e:
            self.errors.append(f"inventory.json JSON 解析错误: {e}")
        except FileNotFoundError:
            self.errors.append(f"文件未找到: {filepath}")
        except Exception as e:
            self.errors.append(f"解析 inventory.json 时发生错误: {e}")
        
        return inventory
    
    def _parse_inventory_item(self, item: Dict, index: int) -> NutrientInventory:
        """解析单个库存项"""
        required_fields = ['id', 'recipe_id', 'solution_type', 'current_volume']
        for field in required_fields:
            if field not in item:
                raise ValueError(f"缺少必需字段: {field}")
        
        expiration_date = None
        if item.get('expiration_date'):
            try:
                expiration_date = date.fromisoformat(str(item['expiration_date']))
            except:
                pass
        
        return NutrientInventory(
            id=str(item['id']),
            recipe_id=str(item['recipe_id']),
            solution_type=str(item['solution_type']),
            current_volume=float(item['current_volume']),
            volume_unit=str(item.get('volume_unit', 'mL')),
            minimum_threshold=float(item.get('minimum_threshold', 100.0)),
            expiration_date=expiration_date,
            batch_number=item.get('batch_number')
        )
    
    def _safe_float(self, value, default) -> float:
        """安全转换为浮点数"""
        if value is None or value == '':
            return default if default is not None else 0.0
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return default if default is not None else 0.0
    
    def _parse_datetime(self, value: str) -> datetime:
        """解析日期时间字符串"""
        value = value.strip()
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        try:
            from dateutil import parser
            return parser.parse(value)
        except:
            pass
        
        raise ValueError(f"无法解析日期时间: {value}")
