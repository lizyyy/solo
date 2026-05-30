"""
游戏引擎核心逻辑
处理资源调度、环境反馈、事件回合
"""

from typing import List, Tuple, Dict, Any
from datetime import datetime
from .models import (
    GameState, GameStatus, FailureReason,
    Crop, CropStatus, GreenhouseModule, WaterTank, Battery, SandstormEvent
)
from .error_tracking import get_global_error_tracker


class GreenhouseEngine:
    """温室游戏引擎"""
    
    def __init__(self, game_state: GameState):
        self.game_state = game_state
        self.error_tracker = get_global_error_tracker()
        self.round_logs: List[Dict[str, Any]] = []
    
    def start_game(self) -> bool:
        """开始游戏"""
        if self.game_state.status != GameStatus.NOT_STARTED:
            self.error_tracker.track_error(
                error_type="InvalidStateTransition",
                error_message=f"无法从状态 {self.game_state.status} 开始游戏",
                severity="warning",
                object_id=self.game_state.id,
                object_type="GameState"
            )
            return False
        
        self.game_state.status = GameStatus.RUNNING
        self.game_state.round = 1
        self.game_state.updated_at = datetime.now()
        return True
    
    def process_round(self) -> Tuple[bool, List[str]]:
        """
        处理一个回合
        
        Returns:
            (是否继续游戏, 回合消息列表)
        """
        if self.game_state.status != GameStatus.RUNNING:
            return False, ["游戏未在运行中"]
        
        messages = []
        round_data = {
            "round": self.game_state.round,
            "timestamp": datetime.now(),
            "actions": [],
            "events": [],
            "resource_changes": {}
        }
        
        # 1. 处理事件（沙尘暴等）
        event_messages = self._process_events()
        messages.extend(event_messages)
        round_data["events"].extend(event_messages)
        
        # 2. 资源调度
        resource_messages = self._process_resources()
        messages.extend(resource_messages)
        round_data["resource_changes"] = self._get_resource_snapshot()
        
        # 3. 环境反馈
        env_messages = self._process_environment()
        messages.extend(env_messages)
        
        # 4. 作物生长
        crop_messages = self._process_crops()
        messages.extend(crop_messages)
        round_data["actions"].extend(crop_messages)
        
        # 5. 检查失败条件
        failed, failure_reason = self._check_failure_conditions()
        if failed:
            self.game_state.status = GameStatus.FAILED
            self.game_state.failure_reason = failure_reason
            failure_msg = self._get_failure_message(failure_reason)
            messages.append(f"【游戏失败】{failure_msg}")
            self.round_logs.append(round_data)
            return False, messages
        
        # 6. 检查胜利条件
        if self._check_success_conditions():
            self.game_state.status = GameStatus.SUCCESS
            messages.append("【游戏成功】恭喜完成种植目标！")
            self.round_logs.append(round_data)
            return False, messages
        
        # 7. 检查回合数
        if self.game_state.round >= self.game_state.max_rounds:
            if self.game_state.current_yield >= self.game_state.target_yield:
                self.game_state.status = GameStatus.SUCCESS
                messages.append("【游戏成功】时间结束，达成种植目标！")
            else:
                self.game_state.status = GameStatus.FAILED
                self.game_state.failure_reason = FailureReason.CROP_ALL_DEAD
                messages.append("【游戏失败】时间结束，未达成种植目标！")
            self.round_logs.append(round_data)
            return False, messages
        
        # 进入下一回合
        self.game_state.round += 1
        self.game_state.updated_at = datetime.now()
        self.round_logs.append(round_data)
        
        return True, messages
    
    def _process_events(self) -> List[str]:
        """处理事件系统"""
        messages = []
        
        # 处理当前活跃的沙尘暴
        if self.game_state.current_sandstorm and self.game_state.current_sandstorm.is_active:
            storm = self.game_state.current_sandstorm
            storm.remaining_duration -= 1
            
            if storm.remaining_duration <= 0:
                storm.is_active = False
                self.game_state.current_sandstorm = None
                messages.append(f"沙尘暴 '{storm.name}' 已结束")
            else:
                messages.append(f"沙尘暴持续中: 剩余 {storm.remaining_duration} 回合")
                # 应用沙尘暴效果
                self._apply_sandstorm_effects(storm)
        
        # 检查是否有新事件触发
        for event in self.game_state.upcoming_events[:]:
            if self._should_trigger_event(event):
                event.is_active = True
                event.remaining_duration = event.duration
                self.game_state.current_sandstorm = event
                self.game_state.upcoming_events.remove(event)
                messages.append(f"【警告】{event.name} 来袭！持续 {event.duration} 回合")
        
        return messages
    
    def _apply_sandstorm_effects(self, storm: SandstormEvent):
        """应用沙尘暴效果"""
        # 光照减弱
        for module in self.game_state.greenhouse_modules:
            original_light = module.light_intensity
            module.light_intensity *= (1 - storm.light_blockage)
            
            # 温度下降
            module.temperature -= storm.temperature_drop / storm.duration
        
        # 作物受损
        for crop in self.game_state.crops:
            if crop.status != CropStatus.DEAD:
                damage = storm.damage_factor * 100 / storm.duration
                crop.health -= damage
                if crop.health <= 0:
                    crop.health = 0
                    crop.status = CropStatus.DEAD
    
    def _should_trigger_event(self, event: SandstormEvent) -> bool:
        """判断是否应该触发事件"""
        # 可以基于回合数、随机概率等条件触发
        trigger_round = event.metadata.get("trigger_round")
        if trigger_round and self.game_state.round == trigger_round:
            return True
        
        # 随机触发
        import random
        trigger_probability = event.metadata.get("trigger_probability", 0.05)
        return random.random() < trigger_probability
    
    def _process_resources(self) -> List[str]:
        """处理资源调度"""
        messages = []
        
        # 计算能量收支
        energy_produced = self._calculate_energy_production()
        energy_consumed = self._calculate_energy_consumption()
        
        self.game_state.total_energy_production += energy_produced
        self.game_state.total_energy_consumption += energy_consumed
        
        # 更新电池状态
        total_battery_change = 0.0
        for battery in self.game_state.batteries:
            if battery.is_charging:
                charge_amount = min(
                    battery.charge_rate * battery.efficiency,
                    battery.capacity - battery.current_charge
                )
                battery.current_charge += charge_amount
                total_battery_change += charge_amount
            else:
                # 放电供应系统
                discharge_amount = min(
                    battery.discharge_rate,
                    battery.current_charge
                )
                battery.current_charge -= discharge_amount
                total_battery_change -= discharge_amount
        
        net_energy = energy_produced - energy_consumed + total_battery_change
        
        if net_energy < -100:  # 能量严重不足
            messages.append(f"【警告】能量严重不足！本回合净能量: {net_energy:.1f}")
        
        # 计算水平衡
        water_produced = self._calculate_water_production()
        water_consumed = self._calculate_water_consumption()
        
        self.game_state.total_water_production += water_produced
        self.game_state.total_water_consumption += water_consumed
        
        # 更新水箱状态
        for tank in self.game_state.water_tanks:
            if tank.is_circulating:
                # 水循环正常，净化水
                tank.current_level = min(
                    tank.capacity,
                    tank.current_level + tank.purification_rate - tank.leak_rate
                )
            else:
                # 水循环断开，只漏不净
                tank.current_level -= tank.leak_rate * 2
            
            # 防止负数
            if tank.current_level < 0:
                tank.current_level = 0
                messages.append(f"【警告】水箱 '{tank.name}' 已空！")
        
        messages.append(f"能量: 产{energy_produced:.1f} / 耗{energy_consumed:.1f} | 水: 产{water_produced:.1f} / 耗{water_consumed:.1f}")
        
        return messages
    
    def _calculate_energy_production(self) -> float:
        """计算能量产量"""
        # 太阳能板产能（基于光照）
        base_production = 0.0
        for module in self.game_state.greenhouse_modules:
            # 假设有太阳能板
            base_production += module.light_intensity * 0.1
        
        return base_production
    
    def _calculate_energy_consumption(self) -> float:
        """计算能量消耗"""
        total = 0.0
        
        # 温控系统
        for module in self.game_state.greenhouse_modules:
            temp_diff = abs(module.temperature - module.target_temperature)
            total += temp_diff * 2  # 温差越大耗能越多
            
            # 照明系统
            if module.light_on:
                total += 10.0
        
        # 水循环系统
        for tank in self.game_state.water_tanks:
            if tank.is_circulating:
                total += 5.0
        
        return total
    
    def _calculate_water_production(self) -> float:
        """计算水产量"""
        total = 0.0
        for tank in self.game_state.water_tanks:
            if tank.is_circulating:
                total += tank.purification_rate
        return total
    
    def _calculate_water_consumption(self) -> float:
        """计算水消耗"""
        total = 0.0
        for crop in self.game_state.crops:
            if crop.status not in [CropStatus.DEAD, CropStatus.HARVESTABLE]:
                total += crop.water_consumption
        return total
    
    def _get_resource_snapshot(self) -> Dict[str, float]:
        """获取资源快照"""
        return {
            "total_energy": sum(b.current_charge for b in self.game_state.batteries),
            "total_water": sum(t.current_level for t in self.game_state.water_tanks),
            "energy_production": self.game_state.total_energy_production,
            "energy_consumption": self.game_state.total_energy_consumption,
            "water_production": self.game_state.total_water_production,
            "water_consumption": self.game_state.total_water_consumption
        }
    
    def _process_environment(self) -> List[str]:
        """处理环境反馈"""
        messages = []
        
        for module in self.game_state.greenhouse_modules:
            # 温度自然调节
            if module.light_on:
                module.temperature += 0.5  # 灯照升温
            else:
                module.temperature -= 0.3  # 夜间降温
            
            # 温控系统作用
            temp_diff = module.target_temperature - module.temperature
            if abs(temp_diff) > 0.5:
                adjust = min(1.0, abs(temp_diff)) * (1 if temp_diff > 0 else -1)
                module.temperature += adjust
        
        return messages
    
    def _process_crops(self) -> List[str]:
        """处理作物生长"""
        messages = []
        harvest_count = 0
        
        for crop in self.game_state.crops:
            if crop.status == CropStatus.DEAD:
                continue
            
            # 检查水分
            if crop.current_water < crop.water_consumption:
                crop.health -= 5
                messages.append(f"作物 '{crop.name}' 缺水！健康度下降")
            else:
                crop.current_water -= crop.water_consumption
            
            # 检查温度
            for module in self.game_state.greenhouse_modules:
                if any(c.id == crop.id for c in module.crops):
                    if not (crop.optimal_temp_min <= module.temperature <= crop.optimal_temp_max):
                        crop.health -= 2
                    break
            
            # 检查光照
            light_hours = 12 if crop.current_light_exposure > 50 else 0
            if light_hours < crop.optimal_light_hours * 0.5:
                crop.health -= 1
            
            # 健康度检查
            if crop.health <= 0:
                crop.health = 0
                crop.status = CropStatus.DEAD
                messages.append(f"作物 '{crop.name}' 已死亡")
                continue
            
            # 生长进度
            if crop.health > 50:
                growth_rate = crop.health / 100.0
                crop.growth_progress += growth_rate * 10
                
                # 升级生长阶段
                stage_thresholds = [0, 20, 40, 60, 80, 100]
                new_stage = sum(1 for t in stage_thresholds if crop.growth_progress >= t) - 1
                new_stage = min(new_stage, 5)
                
                if new_stage > crop.growth_stage:
                    crop.growth_stage = new_stage
                    status_map = {
                        0: CropStatus.SEED,
                        1: CropStatus.SPROUT,
                        2: CropStatus.GROWING,
                        3: CropStatus.FLOWERING,
                        4: CropStatus.FRUITING,
                        5: CropStatus.HARVESTABLE
                    }
                    crop.status = status_map.get(new_stage, crop.status)
                    
                    if crop.status == CropStatus.HARVESTABLE:
                        crop.harvest_yield = 10 + crop.health * 0.2
                        messages.append(f"作物 '{crop.name}' 成熟！预计产量: {crop.harvest_yield:.1f}")
            
            # 重置每日光照
            crop.current_light_exposure = 0
        
        # 自动收获成熟作物
        for crop in self.game_state.crops:
            if crop.status == CropStatus.HARVESTABLE:
                self.game_state.current_yield += crop.harvest_yield
                harvest_count += 1
        
        if harvest_count > 0:
            messages.append(f"收获了 {harvest_count} 株作物！当前总产量: {self.game_state.current_yield:.1f}")
        
        return messages
    
    def _check_failure_conditions(self) -> Tuple[bool, FailureReason]:
        """检查失败条件"""
        # 1. 能量为负
        total_energy = sum(b.current_charge for b in self.game_state.batteries)
        if total_energy <= 0:
            self.game_state.failure_details = {
                "total_energy": total_energy,
                "energy_consumption_rate": self.game_state.total_energy_consumption / max(1, self.game_state.round)
            }
            return True, FailureReason.ENERGY_NEGATIVE
        
        # 2. 水循环断开
        all_tanks_empty = all(t.current_level <= 0 for t in self.game_state.water_tanks)
        all_circulation_off = all(not t.is_circulating for t in self.game_state.water_tanks)
        if all_tanks_empty and all_circulation_off:
            self.game_state.failure_details = {
                "total_water": sum(t.current_level for t in self.game_state.water_tanks),
                "circulation_active": any(t.is_circulating for t in self.game_state.water_tanks)
            }
            return True, FailureReason.WATER_CYCLE_BROKEN
        
        # 3. 温差越界（所有舱室温度异常）
        all_temp_out_of_range = True
        for module in self.game_state.greenhouse_modules:
            has_optimal_crop = False
            for crop in module.crops:
                if crop.optimal_temp_min <= module.temperature <= crop.optimal_temp_max:
                    has_optimal_crop = True
                    break
            if has_optimal_crop or not module.crops:
                all_temp_out_of_range = False
                break
        
        if all_temp_out_of_range and self.game_state.greenhouse_modules:
            self.game_state.failure_details = {
                "modules": [(m.name, m.temperature) for m in self.game_state.greenhouse_modules]
            }
            return True, FailureReason.TEMPERATURE_OUT_OF_RANGE
        
        # 4. 所有作物死亡
        all_dead = all(c.status == CropStatus.DEAD for c in self.game_state.crops)
        if all_dead and self.game_state.crops:
            self.game_state.failure_details = {
                "total_crops": len(self.game_state.crops),
                "surviving_crops": sum(1 for c in self.game_state.crops if c.status != CropStatus.DEAD)
            }
            return True, FailureReason.CROP_ALL_DEAD
        
        return False, None
    
    def _get_failure_message(self, reason: FailureReason) -> str:
        """获取失败消息"""
        messages = {
            FailureReason.ENERGY_NEGATIVE:
                "能量耗尽！温室系统无法维持运转。请检查：1) 太阳能板是否充足 2) 是否过度使用高能耗设备 3) 电池管理策略",
            FailureReason.WATER_CYCLE_BROKEN:
                "水循环系统崩溃！作物无法获得水分。请检查：1) 水箱是否充足 2) 净化系统是否开启 3) 作物耗水量",
            FailureReason.TEMPERATURE_OUT_OF_RANGE:
                "温度超出作物耐受范围！请检查：1) 温控系统设置 2) 光照时间配置 3) 舱室保温",
            FailureReason.CROP_ALL_DEAD:
                "所有作物已死亡！请复盘：1) 水分供应 2) 温度控制 3) 光照时长 4) 沙尘暴防护",
            FailureReason.SANDSTORM_DAMAGE:
                "沙尘暴造成不可逆损害！请检查：1) 防护措施 2) 应急能量储备 3) 作物抗逆性"
        }
        return messages.get(reason, "未知原因导致游戏失败")
    
    def _check_success_conditions(self) -> bool:
        """检查胜利条件"""
        return self.game_state.current_yield >= self.game_state.target_yield
    
    def harvest_crop(self, crop_id: str) -> float:
        """收获指定作物"""
        for crop in self.game_state.crops:
            if crop.id == crop_id and crop.status == CropStatus.HARVESTABLE:
                yield_amount = crop.harvest_yield
                self.game_state.current_yield += yield_amount
                crop.status = CropStatus.DEAD
                return yield_amount
        return 0.0
    
    def toggle_light(self, module_id: str) -> bool:
        """开关灯光"""
        for module in self.game_state.greenhouse_modules:
            if module.id == module_id:
                module.light_on = not module.light_on
                return module.light_on
        return False
    
    def set_target_temperature(self, module_id: str, temp: float) -> bool:
        """设置目标温度"""
        if not (0 <= temp <= 50):
            self.error_tracker.track_error(
                error_type="InvalidTemperature",
                error_message=f"目标温度 {temp} 超出有效范围 (0-50)",
                severity="warning",
                object_id=module_id,
                object_type="GreenhouseModule",
                field_name="target_temperature",
                current_value=temp,
                expected_range="0-50"
            )
            return False
        
        for module in self.game_state.greenhouse_modules:
            if module.id == module_id:
                module.target_temperature = temp
                return True
        return False
    
    def toggle_water_circulation(self, tank_id: str) -> bool:
        """开关水循环"""
        for tank in self.game_state.water_tanks:
            if tank.id == tank_id:
                tank.is_circulating = not tank.is_circulating
                return tank.is_circulating
        return False
