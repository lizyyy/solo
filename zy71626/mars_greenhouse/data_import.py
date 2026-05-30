"""
数据导入系统
支持多版本兼容、历史数据保留、临时补充数据处理
"""

import json
import csv
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

from .models import (
    GameState, GreenhouseModule, Crop, WaterTank, Battery, SandstormEvent,
    DataSource, GameStatus, CropStatus
)
from .error_tracking import get_global_error_tracker


class DataImporter:
    """数据导入器"""
    
    def __init__(self):
        self.error_tracker = get_global_error_tracker()
        self.data_sources: List[DataSource] = []
        self.version_history: Dict[str, List[DataSource]] = {}
    
    def import_file(self, file_path: str, is_supplement: bool = False) -> Tuple[Optional[GameState], List[DataSource]]:
        """
        导入数据文件
        
        Args:
            file_path: 文件路径
            is_supplement: 是否为临时补充数据
        
        Returns:
            (游戏状态对象, 数据源列表)
        """
        file_path = os.path.abspath(file_path)
        
        if not os.path.exists(file_path):
            self.error_tracker.track_error(
                error_type="FileNotFound",
                error_message=f"文件不存在: {file_path}",
                severity="error",
                source_file=file_path
            )
            return None, []
        
        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext == '.json':
                return self._import_json(file_path, is_supplement)
            elif ext in ['.csv', '.txt']:
                return self._import_csv(file_path, is_supplement)
            else:
                self.error_tracker.track_error(
                    error_type="UnsupportedFormat",
                    error_message=f"不支持的文件格式: {ext}",
                    severity="error",
                    source_file=file_path
                )
                return None, []
        except Exception as e:
            self.error_tracker.track_error(
                error_type="ImportError",
                error_message=f"导入文件失败: {str(e)}",
                severity="critical",
                source_file=file_path,
                exception=e
            )
            return None, []
    
    def _import_json(self, file_path: str, is_supplement: bool) -> Tuple[Optional[GameState], List[DataSource]]:
        """导入JSON文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        
        data_source = DataSource(
            file_path=file_path,
            line_number=None,
            sheet_name=None,
            version=raw_data.get('version', 'unknown'),
            is_supplement=is_supplement,
            is_deprecated=False,
            raw_data=raw_data
        )
        
        self.data_sources.append(data_source)
        
        # 解析游戏状态
        game_state = self._parse_game_state(raw_data, data_source)
        
        return game_state, [data_source]
    
    def _import_csv(self, file_path: str, is_supplement: bool) -> Tuple[Optional[GameState], List[DataSource]]:
        """导入CSV文件"""
        data_sources = []
        all_rows = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                data_source = DataSource(
                    file_path=file_path,
                    line_number=line_num,
                    sheet_name=None,
                    version=row.get('version', 'csv_import'),
                    is_supplement=is_supplement,
                    is_deprecated=False,
                    raw_data=dict(row)
                )
                data_sources.append(data_source)
                all_rows.append((row, data_source))
        
        self.data_sources.extend(data_sources)
        
        # 从CSV行构建游戏状态
        game_state = self._parse_csv_rows(all_rows)
        
        return game_state, data_sources
    
    def _parse_game_state(self, data: Dict[str, Any], source: DataSource) -> GameState:
        """解析游戏状态"""
        game_id = data.get('id', f"game_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        
        game_state = GameState(
            id=game_id,
            name=data.get('name', '未命名关卡'),
            round=data.get('round', 0),
            max_rounds=data.get('max_rounds', 30),
            target_yield=data.get('target_yield', 100.0),
            current_yield=data.get('current_yield', 0.0),
            status=GameStatus.NOT_STARTED
        )
        
        # 解析温室舱
        for gh_data in data.get('greenhouse_modules', []):
            module = self._parse_greenhouse_module(gh_data, source)
            if module:
                game_state.greenhouse_modules.append(module)
        
        # 解析作物
        for crop_data in data.get('crops', []):
            crop = self._parse_crop(crop_data, source)
            if crop:
                game_state.crops.append(crop)
        
        # 解析水箱
        for tank_data in data.get('water_tanks', []):
            tank = self._parse_water_tank(tank_data, source)
            if tank:
                game_state.water_tanks.append(tank)
        
        # 解析电池
        for bat_data in data.get('batteries', []):
            battery = self._parse_battery(bat_data, source)
            if battery:
                game_state.batteries.append(battery)
        
        # 解析事件
        for event_data in data.get('upcoming_events', []):
            event = self._parse_sandstorm_event(event_data, source)
            if event:
                game_state.upcoming_events.append(event)
        
        # 将作物分配到温室舱
        self._assign_crops_to_modules(game_state)
        
        return game_state
    
    def _parse_greenhouse_module(self, data: Dict[str, Any], source: DataSource) -> Optional[GreenhouseModule]:
        """解析温室舱"""
        try:
            return GreenhouseModule(
                id=data.get('id', f"gh_{len(source.raw_data)}"),
                name=data.get('name', '温室舱'),
                capacity=int(data.get('capacity', 10)),
                temperature=float(data.get('temperature', 22.0)),
                target_temperature=float(data.get('target_temperature', 22.0)),
                humidity=float(data.get('humidity', 60.0)),
                light_intensity=float(data.get('light_intensity', 0.0)),
                light_on=bool(data.get('light_on', False)),
                insulation_level=int(data.get('insulation_level', 3)),
                energy_efficiency=float(data.get('energy_efficiency', 0.85))
            )
        except (ValueError, TypeError) as e:
            self.error_tracker.track_error(
                error_type="ParseError",
                error_message=f"解析温室舱失败: {str(e)}",
                severity="warning",
                source_file=source.file_path,
                object_type="GreenhouseModule",
                current_value=data,
                data_source=source
            )
            return None
    
    def _parse_crop(self, data: Dict[str, Any], source: DataSource) -> Optional[Crop]:
        """解析作物"""
        try:
            status_str = data.get('status', 'seed').lower()
            status_map = {s.value: s for s in CropStatus}
            status = status_map.get(status_str, CropStatus.SEED)
            
            return Crop(
                id=data.get('id', f"crop_{datetime.now().timestamp()}"),
                name=data.get('name', '作物'),
                species=data.get('species', 'unknown'),
                status=status,
                health=float(data.get('health', 100.0)),
                growth_stage=int(data.get('growth_stage', 0)),
                growth_progress=float(data.get('growth_progress', 0.0)),
                water_consumption=float(data.get('water_consumption', 10.0)),
                energy_consumption=float(data.get('energy_consumption', 5.0)),
                optimal_temp_min=float(data.get('optimal_temp_min', 18.0)),
                optimal_temp_max=float(data.get('optimal_temp_max', 28.0)),
                optimal_light_hours=float(data.get('optimal_light_hours', 12.0)),
                current_water=float(data.get('current_water', 50.0)),
                harvest_yield=float(data.get('harvest_yield', 0.0))
            )
        except (ValueError, TypeError) as e:
            self.error_tracker.track_error(
                error_type="ParseError",
                error_message=f"解析作物失败: {str(e)}",
                severity="warning",
                source_file=source.file_path,
                object_type="Crop",
                current_value=data,
                data_source=source
            )
            return None
    
    def _parse_water_tank(self, data: Dict[str, Any], source: DataSource) -> Optional[WaterTank]:
        """解析水箱"""
        try:
            return WaterTank(
                id=data.get('id', f"tank_{len(source.raw_data)}"),
                name=data.get('name', '水箱'),
                capacity=float(data.get('capacity', 1000.0)),
                current_level=float(data.get('current_level', 800.0)),
                purification_rate=float(data.get('purification_rate', 5.0)),
                leak_rate=float(data.get('leak_rate', 0.1)),
                is_circulating=bool(data.get('is_circulating', True))
            )
        except (ValueError, TypeError) as e:
            self.error_tracker.track_error(
                error_type="ParseError",
                error_message=f"解析水箱失败: {str(e)}",
                severity="warning",
                source_file=source.file_path,
                object_type="WaterTank",
                current_value=data,
                data_source=source
            )
            return None
    
    def _parse_battery(self, data: Dict[str, Any], source: DataSource) -> Optional[Battery]:
        """解析电池"""
        try:
            return Battery(
                id=data.get('id', f"bat_{len(source.raw_data)}"),
                name=data.get('name', '电池'),
                capacity=float(data.get('capacity', 500.0)),
                current_charge=float(data.get('current_charge', 400.0)),
                charge_rate=float(data.get('charge_rate', 20.0)),
                discharge_rate=float(data.get('discharge_rate', 15.0)),
                efficiency=float(data.get('efficiency', 0.9)),
                is_charging=bool(data.get('is_charging', False))
            )
        except (ValueError, TypeError) as e:
            self.error_tracker.track_error(
                error_type="ParseError",
                error_message=f"解析电池失败: {str(e)}",
                severity="warning",
                source_file=source.file_path,
                object_type="Battery",
                current_value=data,
                data_source=source
            )
            return None
    
    def _parse_sandstorm_event(self, data: Dict[str, Any], source: DataSource) -> Optional[SandstormEvent]:
        """解析沙尘暴事件"""
        try:
            return SandstormEvent(
                id=data.get('id', f"storm_{len(source.raw_data)}"),
                name=data.get('name', '沙尘暴'),
                severity=int(data.get('severity', 1)),
                duration=int(data.get('duration', 3)),
                remaining_duration=int(data.get('remaining_duration', 0)),
                light_blockage=float(data.get('light_blockage', 0.5)),
                temperature_drop=float(data.get('temperature_drop', 10.0)),
                damage_factor=float(data.get('damage_factor', 0.1)),
                is_active=bool(data.get('is_active', False)),
                metadata={
                    "trigger_round": data.get('trigger_round'),
                    "trigger_probability": data.get('trigger_probability', 0.05)
                }
            )
        except (ValueError, TypeError) as e:
            self.error_tracker.track_error(
                error_type="ParseError",
                error_message=f"解析沙尘暴事件失败: {str(e)}",
                severity="warning",
                source_file=source.file_path,
                object_type="SandstormEvent",
                current_value=data,
                data_source=source
            )
            return None
    
    def _parse_csv_rows(self, rows: List[Tuple[Dict[str, Any], DataSource]]) -> GameState:
        """从CSV行解析游戏状态"""
        game_state = GameState(
            id=f"game_csv_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            name="CSV导入关卡"
        )
        
        modules = {}
        crops = []
        
        for row, source in rows:
            row_type = row.get('type', '').lower()
            
            if row_type == 'greenhouse':
                module = self._parse_greenhouse_module(row, source)
                if module:
                    modules[module.id] = module
            
            elif row_type == 'crop':
                crop = self._parse_crop(row, source)
                if crop:
                    crops.append(crop)
            
            elif row_type == 'tank':
                tank = self._parse_water_tank(row, source)
                if tank:
                    game_state.water_tanks.append(tank)
            
            elif row_type == 'battery':
                battery = self._parse_battery(row, source)
                if battery:
                    game_state.batteries.append(battery)
            
            elif row_type == 'event':
                event = self._parse_sandstorm_event(row, source)
                if event:
                    game_state.upcoming_events.append(event)
        
        game_state.greenhouse_modules = list(modules.values())
        game_state.crops = crops
        
        self._assign_crops_to_modules(game_state)
        
        return game_state
    
    def _assign_crops_to_modules(self, game_state: GameState):
        """将作物分配到温室舱"""
        if not game_state.greenhouse_modules:
            # 创建默认温室舱
            game_state.greenhouse_modules.append(GreenhouseModule(
                id="gh_default",
                name="主温室舱",
                capacity=20
            ))
        
        module_idx = 0
        for crop in game_state.crops:
            module = game_state.greenhouse_modules[module_idx]
            if len(module.crops) < module.capacity:
                module.crops.append(crop)
            else:
                module_idx = (module_idx + 1) % len(game_state.greenhouse_modules)
                if module_idx == 0:
                    break
    
    def merge_data(self, base_state: GameState, supplement_state: GameState) -> GameState:
        """
        合并数据（不覆盖旧数据，只补充新数据）
        """
        # 补充温室舱
        existing_ids = {m.id for m in base_state.greenhouse_modules}
        for module in supplement_state.greenhouse_modules:
            if module.id not in existing_ids:
                base_state.greenhouse_modules.append(module)
        
        # 补充作物
        existing_ids = {c.id for c in base_state.crops}
        for crop in supplement_state.crops:
            if crop.id not in existing_ids:
                base_state.crops.append(crop)
        
        # 补充水箱
        existing_ids = {t.id for t in base_state.water_tanks}
        for tank in supplement_state.water_tanks:
            if tank.id not in existing_ids:
                base_state.water_tanks.append(tank)
        
        # 补充电池
        existing_ids = {b.id for b in base_state.batteries}
        for battery in supplement_state.batteries:
            if battery.id not in existing_ids:
                base_state.batteries.append(battery)
        
        # 补充事件
        existing_ids = {e.id for e in base_state.upcoming_events}
        for event in supplement_state.upcoming_events:
            if event.id not in existing_ids:
                base_state.upcoming_events.append(event)
        
        return base_state
    
    def import_directory(self, dir_path: str) -> Tuple[Optional[GameState], List[DataSource]]:
        """
        导入整个目录下的所有数据文件
        不覆盖旧数据，保留所有版本
        """
        dir_path = os.path.abspath(dir_path)
        
        if not os.path.isdir(dir_path):
            self.error_tracker.track_error(
                error_type="DirectoryNotFound",
                error_message=f"目录不存在: {dir_path}",
                severity="error",
                source_file=dir_path
            )
            return None, []
        
        all_sources = []
        game_state = None
        
        # 按修改时间排序，先处理旧文件
        files = []
        for f in os.listdir(dir_path):
            full_path = os.path.join(dir_path, f)
            if os.path.isfile(full_path) and f.endswith(('.json', '.csv', '.txt')):
                mtime = os.path.getmtime(full_path)
                files.append((mtime, full_path))
        
        files.sort(key=lambda x: x[0])
        
        for _, file_path in files:
            is_supplement = 'supplement' in file_path.lower() or '补充' in file_path
            state, sources = self.import_file(file_path, is_supplement)
            
            if state:
                if game_state is None:
                    game_state = state
                else:
                    game_state = self.merge_data(game_state, state)
            
            all_sources.extend(sources)
        
        return game_state, all_sources
    
    def get_import_summary(self) -> Dict[str, Any]:
        """获取导入摘要"""
        return {
            "total_sources": len(self.data_sources),
            "supplement_count": sum(1 for s in self.data_sources if s.is_supplement),
            "deprecated_count": sum(1 for s in self.data_sources if s.is_deprecated),
            "versions": list(set(s.version for s in self.data_sources)),
            "files": list(set(s.file_path for s in self.data_sources))
        }
