"""
数据解析模块：支持 JSON 和 CSV 格式的场景数据解析
"""
import json
import csv
import os
from typing import Dict, Any, List, Tuple, Optional
from .models import (
    Scenario, Fish, WaterChange, AddFish,
    FishSize, FiltrationLevel
)


class ParseError(Exception):
    """数据解析错误"""
    pass


class DataParser:
    """数据解析器"""

    @staticmethod
    def parse_file(file_path: str) -> Scenario:
        """
        从文件解析场景数据
        
        Args:
            file_path: 文件路径，支持 .json 和 .csv
            
        Returns:
            解析后的 Scenario 对象
            
        Raises:
            ParseError: 解析失败时抛出
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.json':
            return DataParser._parse_json(file_path)
        elif ext == '.csv':
            return DataParser._parse_csv(file_path)
        else:
            raise ParseError(f"不支持的文件格式: {ext}，请使用 .json 或 .csv")

    @staticmethod
    def _parse_json(file_path: str) -> Scenario:
        """解析 JSON 文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ParseError(f"JSON 解析错误: {e}")
        except FileNotFoundError:
            raise ParseError(f"文件不存在: {file_path}")
        
        return DataParser._dict_to_scenario(data, file_path)

    @staticmethod
    def _parse_csv(file_path: str) -> Scenario:
        """解析 CSV 文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        except FileNotFoundError:
            raise ParseError(f"文件不存在: {file_path}")
        
        if not rows:
            raise ParseError("CSV 文件为空")
        
        data = DataParser._csv_rows_to_dict(rows)
        return DataParser._dict_to_scenario(data, file_path)

    @staticmethod
    def _csv_rows_to_dict(rows: List[Dict[str, str]]) -> Dict[str, Any]:
        """将 CSV 行转换为字典格式"""
        result = {}
        water_changes = []
        add_fish_list = []
        fish_list = []
        
        for row in rows:
            for key, value in row.items():
                if not value:
                    continue
                
                key_lower = key.lower().strip()
                
                if key_lower in ['name', '场景名称']:
                    result['name'] = value.strip()
                elif key_lower in ['tank_volume', '鱼缸体积', '鱼缸容积']:
                    result['tank_volume'] = float(value)
                elif key_lower in ['filtration_level', '过滤等级', '过滤能力']:
                    result['filtration_level'] = value.lower().strip()
                elif key_lower in ['daily_feeding_amount', '每日喂食量', '喂食量']:
                    result['daily_feeding_amount'] = float(value)
                elif key_lower in ['initial_ammonia', '初始氨氮', '氨氮']:
                    result['initial_ammonia'] = float(value)
                elif key_lower in ['initial_nitrite', '初始亚硝酸盐', '亚硝酸盐']:
                    result['initial_nitrite'] = float(value)
                elif key_lower in ['initial_nitrate', '初始硝酸盐', '硝酸盐']:
                    result['initial_nitrate'] = float(value)
                elif key_lower in ['initial_ph', '初始ph', 'ph值']:
                    result['initial_ph'] = float(value)
                elif key_lower in ['simulation_days', '模拟天数']:
                    result['simulation_days'] = int(value)
                
                elif key_lower in ['fish_size', '鱼尺寸', '鱼体型']:
                    fish_list.append({'size': value.lower().strip(), 'quantity': 1})
                elif key_lower in ['fish_quantity', '鱼数量']:
                    if fish_list:
                        fish_list[-1]['quantity'] = int(value)
                
                elif key_lower in ['water_change_day', '换水天数', '换水日']:
                    water_changes.append({'day': int(value), 'percentage': 0.0})
                elif key_lower in ['water_change_percentage', '换水比例']:
                    if water_changes:
                        water_changes[-1]['percentage'] = float(value)
                
                elif key_lower in ['add_fish_day', '加鱼天数', '加鱼日']:
                    add_fish_list.append({'day': int(value), 'quantity': 1, 'size': 'small'})
                elif key_lower in ['add_fish_quantity', '加鱼数量']:
                    if add_fish_list:
                        add_fish_list[-1]['quantity'] = int(value)
                elif key_lower in ['add_fish_size', '加鱼尺寸']:
                    if add_fish_list:
                        add_fish_list[-1]['size'] = value.lower().strip()
        
        if fish_list:
            result['fish'] = fish_list
        if water_changes:
            result['water_changes'] = water_changes
        if add_fish_list:
            result['add_fish'] = add_fish_list
        
        return result

    @staticmethod
    def _dict_to_scenario(data: Dict[str, Any], file_path: str) -> Scenario:
        """将字典转换为 Scenario 对象"""
        try:
            name = data.get('name', os.path.splitext(os.path.basename(file_path))[0])
            tank_volume = data['tank_volume']
            
            fish_data = data.get('fish', [])
            fish_list = []
            for f in fish_data:
                fish_list.append(Fish(
                    size=FishSize(f['size'].lower()),
                    quantity=int(f['quantity'])
                ))
            
            filtration_level = FiltrationLevel(data.get('filtration_level', 'medium').lower())
            daily_feeding_amount = data.get('daily_feeding_amount', 0.0)
            initial_ammonia = data.get('initial_ammonia', 0.0)
            initial_nitrite = data.get('initial_nitrite', 0.0)
            initial_nitrate = data.get('initial_nitrate', 0.0)
            initial_ph = data.get('initial_ph', 7.0)
            
            water_changes_data = data.get('water_changes', [])
            water_changes = []
            for wc in water_changes_data:
                water_changes.append(WaterChange(
                    day=int(wc['day']),
                    percentage=float(wc['percentage'])
                ))
            
            add_fish_data = data.get('add_fish', [])
            add_fish_list = []
            for af in add_fish_data:
                add_fish_list.append(AddFish(
                    day=int(af['day']),
                    quantity=int(af['quantity']),
                    size=FishSize(af['size'].lower())
                ))
            
            simulation_days = int(data.get('simulation_days', 14))
            
            return Scenario(
                name=name,
                tank_volume=tank_volume,
                fish=fish_list,
                filtration_level=filtration_level,
                daily_feeding_amount=daily_feeding_amount,
                initial_ammonia=initial_ammonia,
                initial_nitrite=initial_nitrite,
                initial_nitrate=initial_nitrate,
                initial_ph=initial_ph,
                water_changes=water_changes,
                add_fish=add_fish_list,
                simulation_days=simulation_days
            )
        
        except KeyError as e:
            raise ParseError(f"缺少必需字段: {e}")
        except ValueError as e:
            raise ParseError(f"字段值错误: {e}")
