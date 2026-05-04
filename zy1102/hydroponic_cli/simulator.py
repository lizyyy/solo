"""模拟计算模块 - 根据当前状态和目标参数生成操作方案"""
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, date, timedelta
import math

from .models import (
    Reservoir, Crop, CropStageInfo, Recipe, Reading,
    NutrientInventory, ReservoirState, DailyAction,
    SimulationResult, SimulationSummary, DataBundle
)
from .units import (
    convert_ec, convert_volume, normalize_ec_to_ms,
    calculate_dilution_factor, calculate_nutrient_addition,
    calculate_ph_adjustment
)


class SimulationStrategy:
    """模拟策略枚举"""
    STABLE_EC = "stable_ec"
    SAVE_NUTRIENT = "save_nutrient"
    AGGRESSIVE_CORRECTION = "aggressive_correction"


class Simulator:
    """营养液调配模拟器"""
    
    def __init__(
        self,
        data_bundle: DataBundle,
        strategy: str = SimulationStrategy.STABLE_EC
    ):
        self.data = data_bundle
        self.strategy = strategy
        self.warnings: List[str] = []
        self.errors: List[str] = []
    
    def simulate_reservoir(
        self,
        reservoir_id: str,
        days: int = 7,
        start_date: Optional[date] = None,
        crop_id: Optional[str] = None,
        crop_stage: Optional[str] = None,
        recipe_id: Optional[str] = None
    ) -> SimulationResult:
        """
        模拟单个储液桶未来几天的操作方案
        
        Args:
            reservoir_id: 储液桶 ID
            days: 模拟天数
            start_date: 开始日期，默认为今天
            crop_id: 作物 ID（可选，从 readings 推断）
            crop_stage: 作物阶段（可选）
            recipe_id: 配方 ID（可选）
        
        Returns:
            SimulationResult: 模拟结果
        """
        if start_date is None:
            start_date = date.today()
        
        end_date = start_date + timedelta(days=days - 1)
        
        reservoir = self.data.reservoirs.get(reservoir_id)
        if not reservoir:
            error_msg = f"储液桶 ID '{reservoir_id}' 未找到"
            self.errors.append(error_msg)
            return SimulationResult(
                reservoir_id=reservoir_id,
                start_date=start_date,
                end_date=end_date,
                total_days=days,
                daily_actions=[],
                summary=SimulationSummary(),
                errors=[error_msg]
            )
        
        initial_state = self._get_initial_state(
            reservoir_id, reservoir, crop_id, crop_stage, recipe_id
        )
        
        if not initial_state:
            error_msg = f"无法获取储液桶 '{reservoir_id}' 的初始状态"
            self.errors.append(error_msg)
            return SimulationResult(
                reservoir_id=reservoir_id,
                start_date=start_date,
                end_date=end_date,
                total_days=days,
                daily_actions=[],
                summary=SimulationSummary(),
                errors=[error_msg]
            )
        
        daily_actions = self._run_simulation(
            initial_state, reservoir, days, start_date
        )
        
        summary = self._calculate_summary(daily_actions, initial_state)
        
        return SimulationResult(
            reservoir_id=reservoir_id,
            start_date=start_date,
            end_date=end_date,
            total_days=days,
            daily_actions=daily_actions,
            summary=summary,
            warnings=self.warnings.copy(),
            errors=self.errors.copy()
        )
    
    def _get_initial_state(
        self,
        reservoir_id: str,
        reservoir: Reservoir,
        crop_id: Optional[str],
        crop_stage: Optional[str],
        recipe_id: Optional[str]
    ) -> Optional[ReservoirState]:
        """获取初始状态"""
        latest_reading = self._get_latest_reading(reservoir_id)
        
        if not latest_reading:
            self.warnings.append(f"储液桶 '{reservoir_id}' 没有历史读数，使用默认值")
            
            default_volume = reservoir.max_capacity_liters * 0.8
            default_ec = 1.5
            default_ph = 6.0
            
            return ReservoirState(
                reservoir_id=reservoir_id,
                current_volume=default_volume,
                current_ec=default_ec,
                current_ph=default_ph,
                crop_id=crop_id,
                crop_stage=crop_stage or "vegetative",
                recipe_id=recipe_id,
                last_reading_time=datetime.now()
            )
        
        volume = latest_reading.volume_liters
        if volume is None:
            volume = reservoir.max_capacity_liters * 0.8
        
        return ReservoirState(
            reservoir_id=reservoir_id,
            current_volume=volume,
            current_ec=latest_reading.ec_value_ms,
            current_ph=latest_reading.ph_value,
            crop_id=crop_id,
            crop_stage=crop_stage,
            recipe_id=recipe_id,
            last_reading_time=latest_reading.timestamp
        )
    
    def _get_latest_reading(self, reservoir_id: str) -> Optional[Reading]:
        """获取指定储液桶的最新读数"""
        reservoir_readings = [r for r in self.data.readings if r.reservoir_id == reservoir_id]
        if not reservoir_readings:
            return None
        return max(reservoir_readings, key=lambda r: r.timestamp)
    
    def _run_simulation(
        self,
        initial_state: ReservoirState,
        reservoir: Reservoir,
        days: int,
        start_date: date
    ) -> List[DailyAction]:
        """运行模拟"""
        daily_actions: List[DailyAction] = []
        current_state = initial_state
        
        target_stage_info = self._get_target_stage_info(current_state)
        
        for day in range(days):
            current_date = start_date + timedelta(days=day)
            
            action = self._calculate_daily_action(
                current_state, reservoir, target_stage_info, day + 1, current_date
            )
            
            daily_actions.append(action)
            
            current_state = self._update_state(current_state, action, reservoir)
        
        return daily_actions
    
    def _get_target_stage_info(self, state: ReservoirState) -> CropStageInfo:
        """获取目标阶段信息"""
        if state.crop_id and state.crop_id in self.data.crops:
            crop = self.data.crops[state.crop_id]
            if state.crop_stage:
                stage_info = crop.get_stage_info(state.crop_stage)
                if stage_info:
                    return stage_info
            
            if crop.stages:
                first_stage = next(iter(crop.stages.values()))
                return first_stage
        
        return CropStageInfo(
            stage="default",
            target_ec_min=1.2,
            target_ec_max=1.8,
            target_ec_unit="mS/cm",
            target_ph_min=5.5,
            target_ph_max=6.5
        )
    
    def _calculate_daily_action(
        self,
        state: ReservoirState,
        reservoir: Reservoir,
        target: CropStageInfo,
        day_num: int,
        current_date: date
    ) -> DailyAction:
        """计算单日操作"""
        actions: List[str] = []
        warnings: List[str] = []
        notes: List[str] = []
        
        add_water_liters = 0.0
        add_a_ml = 0.0
        add_b_ml = 0.0
        add_acid_ml = 0.0
        add_base_ml = 0.0
        drain_liters = 0.0
        requires_full_change = False
        
        target_ec_optimal = target.target_ec_optimal
        target_ph_optimal = target.target_ph_optimal
        
        target_volume = reservoir.max_capacity_liters * 0.8
        
        evaporation_loss = state.current_volume * state.evaporation_rate_per_day
        nutrient_loss = state.current_ec * state.nutrient_uptake_rate
        
        new_volume_before_action = max(0, state.current_volume - evaporation_loss)
        new_ec_before_action = state.current_ec
        
        if evaporation_loss > 0:
            notes.append(f"预计蒸发损失: {evaporation_loss:.2f} L")
        
        if new_volume_before_action < target_volume * 0.7:
            actions.append("补充水分至目标液位")
            add_water_liters = target_volume - new_volume_before_action
            
            if add_water_liters > 0:
                new_ec_after_water = (new_ec_before_action * new_volume_before_action) / (new_volume_before_action + add_water_liters)
                notes.append(f"补水后 EC 预计从 {new_ec_before_action:.2f} 降至 {new_ec_after_water:.2f} mS/cm")
                working_ec = new_ec_after_water
                working_volume = new_volume_before_action + add_water_liters
            else:
                working_ec = new_ec_before_action
                working_volume = new_volume_before_action
        else:
            working_ec = new_ec_before_action
            working_volume = new_volume_before_action
        
        ec_in_range = target.target_ec_min_ms <= working_ec <= target.target_ec_max_ms
        
        if not ec_in_range:
            if working_ec > target.target_ec_max_ms:
                if self.strategy == SimulationStrategy.SAVE_NUTRIENT:
                    dilution = calculate_dilution_factor(
                        working_ec, working_volume,
                        target.target_ec_optimal,
                        reservoir.max_capacity_liters
                    )
                    
                    if dilution.get('target_unreachable'):
                        warnings.append(dilution.get('message', '无法通过补水达到目标 EC'))
                        requires_full_change = True
                        actions.append("需要部分或全部换液")
                    else:
                        add_water_liters += dilution['add_water']
                        working_ec = dilution['new_ec']
                        working_volume += dilution['add_water']
                        actions.append("通过补水稀释 EC")
                        notes.append(f"额外补水稀释 EC: +{dilution['add_water']:.2f} L")
                else:
                    drain_needed = min(working_volume * 0.5, working_volume - target_volume)
                    if drain_needed > 0:
                        drain_liters = drain_needed
                        working_volume -= drain_liters
                        actions.append("排出部分高浓度溶液")
                        notes.append(f"排出 {drain_liters:.2f} L 高浓度溶液")
                        
                        add_water_liters += drain_liters
                        working_ec = (working_ec * (working_volume + drain_liters) - working_ec * drain_liters) / working_volume
            
            elif working_ec < target.target_ec_min_ms:
                recipe = self._get_recipe(state.recipe_id, target.recommended_recipe)
                
                if recipe:
                    a_ec = recipe.a_solution.ec_per_ml_per_liter
                    b_ec = recipe.b_solution.ec_per_ml_per_liter
                    
                    nutrient_calc = calculate_nutrient_addition(
                        working_ec, working_volume,
                        target.target_ec_optimal,
                        a_ec, b_ec
                    )
                    
                    add_a_ml = nutrient_calc['add_a_ml']
                    add_b_ml = nutrient_calc['add_b_ml']
                    
                    if add_a_ml > 0 or add_b_ml > 0:
                        actions.append("补充营养液")
                        notes.append(
                            f"添加 A 液: {add_a_ml:.1f} mL, B 液: {add_b_ml:.1f} mL "
                            f"(目标 EC: {target.target_ec_optimal:.2f} mS/cm)"
                        )
                        
                        self._check_inventory(recipe.id, 'A', add_a_ml, warnings)
                        self._check_inventory(recipe.id, 'B', add_b_ml, warnings)
                        
                        if recipe.incompatibility_notes:
                            notes.append(f"混配禁忌: {recipe.incompatibility_notes}")
        
        ph_in_range = target.target_ph_min <= state.current_ph <= target.target_ph_max
        
        if not ph_in_range:
            ph_calc = calculate_ph_adjustment(
                state.current_ph, target_ph_optimal, working_volume
            )
            
            add_acid_ml = ph_calc.get('add_acid_ml', 0.0)
            add_base_ml = ph_calc.get('add_base_ml', 0.0)
            
            if add_acid_ml > 0:
                actions.append("添加酸液调整 pH")
                notes.append(f"添加酸液约 {add_acid_ml:.1f} mL (当前 pH: {state.current_ph:.1f}, 目标: {target_ph_optimal:.1f})")
            
            if add_base_ml > 0:
                actions.append("添加碱液调整 pH")
                notes.append(f"添加碱液约 {add_base_ml:.1f} mL (当前 pH: {state.current_ph:.1f}, 目标: {target_ph_optimal:.1f})")
            
            if 'warning' in ph_calc:
                warnings.append(ph_calc['warning'])
        
        if not actions:
            actions.append("无需特殊操作，保持观察")
        
        expected_ec = working_ec
        expected_ph = target_ph_optimal if (add_acid_ml > 0 or add_base_ml > 0) else state.current_ph
        expected_volume = working_volume
        
        return DailyAction(
            day=day_num,
            date=current_date,
            reservoir_id=state.reservoir_id,
            actions=actions,
            add_water_liters=round(add_water_liters, 2),
            add_a_ml=round(add_a_ml, 1),
            add_b_ml=round(add_b_ml, 1),
            add_acid_ml=round(add_acid_ml, 1),
            add_base_ml=round(add_base_ml, 1),
            drain_liters=round(drain_liters, 2),
            requires_full_change=requires_full_change,
            expected_ec=round(expected_ec, 3),
            expected_ph=round(expected_ph, 2),
            expected_volume=round(expected_volume, 2),
            warnings=warnings,
            notes=notes
        )
    
    def _get_recipe(self, primary_id: Optional[str], secondary_id: Optional[str]) -> Optional[Recipe]:
        """获取配方"""
        if primary_id and primary_id in self.data.recipes:
            return self.data.recipes[primary_id]
        if secondary_id and secondary_id in self.data.recipes:
            return self.data.recipes[secondary_id]
        if self.data.recipes:
            return next(iter(self.data.recipes.values()))
        return None
    
    def _check_inventory(
        self,
        recipe_id: str,
        solution_type: str,
        required_ml: float,
        warnings: List[str]
    ):
        """检查库存"""
        for item in self.data.inventory.values():
            if item.recipe_id == recipe_id and item.solution_type.upper() == solution_type.upper():
                if item.current_volume_ml < required_ml:
                    warnings.append(
                        f"库存不足: 配方 {recipe_id} {solution_type}液 "
                        f"需要 {required_ml:.1f} mL，库存仅 {item.current_volume_ml:.1f} mL"
                    )
                elif item.current_volume_ml - required_ml < item.minimum_threshold:
                    warnings.append(
                        f"库存预警: 配方 {recipe_id} {solution_type}液 "
                        f"使用后将低于最低阈值 {item.minimum_threshold:.1f} mL"
                    )
                return
        
        warnings.append(f"未找到配方 {recipe_id} {solution_type}液 的库存记录")
    
    def _update_state(
        self,
        state: ReservoirState,
        action: DailyAction,
        reservoir: Reservoir
    ) -> ReservoirState:
        """更新状态（用于下一天模拟）"""
        new_volume = action.expected_volume or state.current_volume
        new_ec = action.expected_ec or state.current_ec
        new_ph = action.expected_ph or state.current_ph
        
        if action.requires_full_change:
            new_volume = reservoir.max_capacity_liters * 0.8
        
        return ReservoirState(
            reservoir_id=state.reservoir_id,
            current_volume=new_volume,
            current_ec=new_ec,
            current_ph=new_ph,
            crop_id=state.crop_id,
            crop_stage=state.crop_stage,
            recipe_id=state.recipe_id,
            last_reading_time=state.last_reading_time,
            evaporation_rate_per_day=state.evaporation_rate_per_day,
            nutrient_uptake_rate=state.nutrient_uptake_rate
        )
    
    def _calculate_summary(
        self,
        daily_actions: List[DailyAction],
        initial_state: ReservoirState
    ) -> SimulationSummary:
        """计算模拟摘要"""
        if not daily_actions:
            return SimulationSummary()
        
        total_water = sum(a.add_water_liters for a in daily_actions)
        total_a = sum(a.add_a_ml for a in daily_actions)
        total_b = sum(a.add_b_ml for a in daily_actions)
        total_acid = sum(a.add_acid_ml for a in daily_actions)
        total_base = sum(a.add_base_ml for a in daily_actions)
        total_drained = sum(a.drain_liters for a in daily_actions)
        
        full_changes = sum(1 for a in daily_actions if a.requires_full_change)
        
        ec_values = [a.expected_ec for a in daily_actions if a.expected_ec is not None]
        ph_values = [a.expected_ph for a in daily_actions if a.expected_ph is not None]
        
        avg_ec = sum(ec_values) / len(ec_values) if ec_values else initial_state.current_ec
        avg_ph = sum(ph_values) / len(ph_values) if ph_values else initial_state.current_ph
        
        end_ec = daily_actions[-1].expected_ec if daily_actions[-1].expected_ec else initial_state.current_ec
        end_ph = daily_actions[-1].expected_ph if daily_actions[-1].expected_ph else initial_state.current_ph
        end_volume = daily_actions[-1].expected_volume if daily_actions[-1].expected_volume else initial_state.current_volume
        
        ec_out_of_range = 0
        ph_out_of_range = 0
        
        target = self._get_target_stage_info(initial_state)
        
        for action in daily_actions:
            if action.expected_ec is not None:
                if not (target.target_ec_min_ms <= action.expected_ec <= target.target_ec_max_ms):
                    ec_out_of_range += 1
            
            if action.expected_ph is not None:
                if not (target.target_ph_min <= action.expected_ph <= target.target_ph_max):
                    ph_out_of_range += 1
        
        return SimulationSummary(
            total_water_added_liters=round(total_water, 2),
            total_a_added_ml=round(total_a, 1),
            total_b_added_ml=round(total_b, 1),
            total_acid_added_ml=round(total_acid, 1),
            total_base_added_ml=round(total_base, 1),
            total_drained_liters=round(total_drained, 2),
            full_changes_required=full_changes,
            ec_out_of_range_days=ec_out_of_range,
            ph_out_of_range_days=ph_out_of_range,
            average_ec=round(avg_ec, 3),
            average_ph=round(avg_ph, 2),
            end_ec=round(end_ec, 3),
            end_ph=round(end_ph, 2),
            end_volume=round(end_volume, 2)
        )
