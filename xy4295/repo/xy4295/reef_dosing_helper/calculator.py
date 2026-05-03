"""
核心投加计算算法模块
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import copy

from .models import (
    TankParams, DailyReading, SupplementConfig, DosingPlan, DosingResult,
    DEFAULT_SUPPLEMENTS, UNIT_CONVERSIONS
)


class DosingCalculator:
    """投加计算器"""
    
    def __init__(
        self,
        tank_params: TankParams,
        historical_readings: List[DailyReading],
        supplement_configs: Optional[Dict[str, SupplementConfig]] = None
    ):
        self.tank_params = tank_params
        self.historical_readings = historical_readings
        self.supplement_configs = supplement_configs or DEFAULT_SUPPLEMENTS.copy()
        self.warnings: List[str] = []
        
        # 计算消耗趋势
        self.consumption_rates = self._calculate_consumption_rates()
        self.avg_evaporation = self._calculate_average_evaporation()
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings.copy()
    
    def _calculate_consumption_rates(self) -> Dict[str, float]:
        """
        计算各参数的每日消耗速率
        基于历史数据的变化趋势
        """
        rates = {'kh': 0.0, 'ca': 0.0, 'mg': 0.0, 'salinity': 0.0}
        
        if len(self.historical_readings) < 2:
            self.warnings.append("历史数据不足2天，无法计算消耗趋势，使用默认值")
            return rates
        
        # 计算各参数的每日变化率
        for param in ['kh', 'ca', 'mg', 'salinity']:
            changes = []
            for i in range(1, len(self.historical_readings)):
                prev_reading = self.historical_readings[i-1]
                curr_reading = self.historical_readings[i]
                
                prev_val = getattr(prev_reading, param, None)
                curr_val = getattr(curr_reading, param, None)
                
                if prev_val is not None and curr_val is not None:
                    # 计算天数差
                    days_diff = (curr_reading.date - prev_reading.date).total_seconds() / 86400
                    if days_diff > 0:
                        # 计算每日变化率（正值表示下降，即消耗）
                        daily_change = (prev_val - curr_val) / days_diff
                        if daily_change > 0:  # 只考虑正消耗（即参数下降）
                            changes.append(daily_change)
            
            if changes:
                # 使用中位数或平均值？这里使用平均值，但排除异常值
                # 简单起见，使用平均值
                rates[param] = sum(changes) / len(changes)
            else:
                self.warnings.append(f"参数 {param.upper()} 历史数据不完整，无法计算消耗趋势")
        
        return rates
    
    def _calculate_average_evaporation(self) -> float:
        """计算平均每日蒸发量"""
        if not self.historical_readings:
            # 使用缸体参数中的默认值
            return self.tank_params.daily_evaporation_rate
        
        evaporations = [
            r.evaporation for r in self.historical_readings
            if r.evaporation is not None and r.evaporation >= 0
        ]
        
        if not evaporations:
            self.warnings.append("没有有效的蒸发量数据，使用缸体参数中的默认值")
            return self.tank_params.daily_evaporation_rate
        
        return sum(evaporations) / len(evaporations)
    
    def _get_current_values(self) -> Dict[str, Optional[float]]:
        """获取最新的检测值"""
        if not self.historical_readings:
            self.warnings.append("没有历史数据，无法获取当前值")
            return {'kh': None, 'ca': None, 'mg': None, 'salinity': None}
        
        latest = self.historical_readings[-1]
        return {
            'kh': latest.kh,
            'ca': latest.ca,
            'mg': latest.mg,
            'salinity': latest.salinity,
        }
    
    def calculate_dosing_plan(
        self,
        start_date: Optional[datetime] = None,
        days: int = 7
    ) -> DosingResult:
        """
        计算未来几天的投加计划
        
        Args:
            start_date: 开始日期，默认使用最新检测日期的下一天
            days: 计算天数，默认7天
        
        Returns:
            DosingResult: 完整的投加结果
        """
        self.warnings.clear()
        
        if start_date is None:
            if self.historical_readings:
                # 从最新检测日期的下一天开始
                start_date = self.historical_readings[-1].date + timedelta(days=1)
            else:
                start_date = datetime.now()
        
        # 获取当前值
        current_values = self._get_current_values()
        
        # 验证必要数据
        required_params = ['kh', 'ca', 'mg', 'salinity']
        missing_params = [p for p in required_params if current_values[p] is None]
        
        if missing_params:
            self.warnings.append(f"缺少必要的当前值: {', '.join(missing_params)}，计算可能不准确")
        
        future_plans: List[DosingPlan] = []
        
        # 模拟未来每天的情况
        simulated_values = copy.deepcopy(current_values)
        
        for day_offset in range(days):
            plan_date = start_date + timedelta(days=day_offset)
            
            plan = DosingPlan(
                date=plan_date,
                tank_params=self.tank_params,
            )
            
            # 计算各参数的投加量
            for param in ['kh', 'ca', 'mg']:
                current_val = simulated_values[param]
                
                if current_val is None:
                    # 如果当前值缺失，尝试使用目标中点
                    current_val = self.tank_params.get_target_midpoint(param)
                    plan.all_warnings.append(
                        f"{param.upper()} 当前值缺失，使用目标中点 {current_val} 进行计算"
                    )
                
                # 计算预计消耗后的数值
                consumption = self.consumption_rates.get(param, 0)
                projected_value = current_val - consumption
                
                # 计算目标范围
                target_min = getattr(self.tank_params, f'target_{param}_min')
                target_max = getattr(self.tank_params, f'target_{param}_max')
                target_mid = (target_min + target_max) / 2
                
                # 决定是否需要投加
                if projected_value < target_min:
                    # 需要投加，计算投加量以达到目标中点
                    required_increase = target_mid - projected_value
                    
                    # 计算投加量
                    dosage, concentration_change, warnings = self._calculate_single_dosage(
                        param=param,
                        required_increase=required_increase,
                        current_value=projected_value,
                    )
                    
                    # 设置计划属性
                    setattr(plan, f'{param}_dosage', dosage)
                    setattr(plan, f'{param}_concentration_change', concentration_change)
                    setattr(plan, f'{param}_warnings', warnings)
                    
                    # 更新模拟值
                    simulated_values[param] = projected_value + concentration_change
                else:
                    # 不需要投加
                    setattr(plan, f'{param}_dosage', 0.0)
                    setattr(plan, f'{param}_concentration_change', 0.0)
                    simulated_values[param] = projected_value
            
            # 计算蒸发补水和盐度调整
            top_up_water, salinity_change, salinity_warnings = self._calculate_salinity_adjustment(
                current_salinity=simulated_values['salinity'],
                evaporation=self.avg_evaporation,
            )
            
            plan.top_up_water = top_up_water
            plan.salinity_adjustment = salinity_change
            plan.salinity_warnings = salinity_warnings
            
            # 更新盐度模拟值
            if simulated_values['salinity'] is not None:
                simulated_values['salinity'] = simulated_values['salinity'] + salinity_change
            
            future_plans.append(plan)
        
        # 收集所有警告
        overall_warnings = self.get_warnings()
        
        return DosingResult(
            tank_params=self.tank_params,
            historical_readings=self.historical_readings,
            future_plans=future_plans,
            supplement_configs=self.supplement_configs,
            overall_warnings=overall_warnings,
        )
    
    def _calculate_single_dosage(
        self,
        param: str,
        required_increase: float,
        current_value: float,
    ) -> Tuple[float, float, List[str]]:
        """
        计算单个参数的投加量
        
        Args:
            param: 参数类型 ('kh', 'ca', 'mg')
            required_increase: 需要提升的量
            current_value: 当前值
        
        Returns:
            (投加量毫升, 实际浓度变化, 警告列表)
        """
        warnings = []
        supplement = self.supplement_configs.get(param)
        
        if not supplement:
            warnings.append(f"没有找到 {param.upper()} 对应的补剂配置，使用默认配置")
            supplement = DEFAULT_SUPPLEMENTS.get(param)
            if not supplement:
                warnings.append(f"无法计算 {param.upper()} 投加量：缺少补剂配置")
                return (0.0, 0.0, warnings)
        
        # 计算理论投加量
        # 需要考虑单位转换
        if param == 'kh':
            # KH: 补剂浓度单位是 meq/mL，目标单位是 dKH
            # 1 dKH = 2 meq/L
            # 公式：投加量(ml) = (需要提升的dKH * 2 * 总体积) / 补剂浓度(meq/ml)
            total_volume = self.tank_params.total_volume
            theoretical_dosage = (required_increase * 2 * total_volume) / supplement.concentration
        else:
            # 钙和镁: 补剂浓度单位是 ppm/mL
            # 公式：投加量(ml) = (需要提升的ppm * 总体积) / 补剂浓度(ppm/ml)
            total_volume = self.tank_params.total_volume
            theoretical_dosage = (required_increase * total_volume) / supplement.concentration
        
        # 计算最大允许投加量
        max_daily_dosage_ml = (supplement.max_daily_dosage * self.tank_params.total_volume) / 100
        
        # 计算实际投加量（不超过最大允许值）
        actual_dosage = min(theoretical_dosage, max_daily_dosage_ml)
        
        if actual_dosage < theoretical_dosage:
            warnings.append(
                f"{param.upper()} 理论投加量 {theoretical_dosage:.2f} mL 超过每日最大限制 {max_daily_dosage_ml:.2f} mL，"
                f"将分次投加或延长调整周期"
            )
        
        # 计算实际浓度变化
        if param == 'kh':
            actual_change = (actual_dosage * supplement.concentration) / (2 * self.tank_params.total_volume)
        else:
            actual_change = (actual_dosage * supplement.concentration) / self.tank_params.total_volume
        
        # 检查安全阈值
        if actual_change > supplement.safety_threshold:
            warnings.append(
                f"警告: {param.upper()} 单次投加浓度变化 {actual_change:.2f} 超过安全阈值 {supplement.safety_threshold:.2f}，"
                f"建议分次投加"
            )
        
        # 如果投加量非常小，可能不需要投加
        if actual_dosage < 0.1:  # 小于0.1mL可以忽略
            warnings.append(f"{param.upper()} 投加量 {actual_dosage:.2f} mL 过小，可以忽略")
            return (0.0, 0.0, warnings)
        
        return (actual_dosage, actual_change, warnings)
    
    def _calculate_salinity_adjustment(
        self,
        current_salinity: Optional[float],
        evaporation: float,
    ) -> Tuple[float, float, List[str]]:
        """
        计算蒸发补水和盐度调整
        
        Args:
            current_salinity: 当前盐度 (sg)
            evaporation: 日蒸发量 (升)
        
        Returns:
            (补水量升, 盐度变化, 警告列表)
        """
        warnings = []
        
        # 默认补水量就是蒸发量
        top_up_water = evaporation
        salinity_change = 0.0
        
        if current_salinity is None:
            warnings.append("盐度数据缺失，仅补充纯水，盐度可能漂移")
            return (top_up_water, 0.0, warnings)
        
        # 目标盐度范围
        target_min = self.tank_params.target_salinity_min
        target_max = self.tank_params.target_salinity_max
        target_mid = (target_min + target_max) / 2
        
        # 计算蒸发后的盐度变化（假设只蒸发纯水）
        # 蒸发后盐度 = 当前盐度 * (总体积 / (总体积 - 蒸发量))
        total_volume = self.tank_params.total_volume
        if total_volume > 0 and evaporation > 0:
            if evaporation >= total_volume:
                warnings.append(f"蒸发量 {evaporation} L 超过或接近缸体总水量 {total_volume} L，数据可能异常")
                return (top_up_water, 0.0, warnings)
            
            # 蒸发后的盐度（假设没有补充）
            salinity_after_evap = current_salinity * (total_volume / (total_volume - evaporation))
            
            # 如果只补纯水，盐度会回到当前值
            # 但如果当前盐度不在目标范围，需要调整
            
            if current_salinity > target_max:
                # 盐度过高，需要用低盐水稀释
                # 计算需要的稀释水量
                # 目标盐度 = target_mid
                # 当前总盐量 = current_salinity * total_volume (简化模型)
                
                # 简单处理：先补纯水，然后根据情况
                warnings.append(
                    f"当前盐度 {current_salinity:.4f} sg 高于目标范围 {target_min:.4f}-{target_max:.4f} sg，"
                    f"建议使用低盐度水补充，或部分换水"
                )
                # 盐度变化：补纯水后会降低一点
                salinity_change = -(salinity_after_evap - current_salinity) * 0.5  # 部分补偿
                
            elif current_salinity < target_min:
                # 盐度过低，需要补充盐水
                warnings.append(
                    f"当前盐度 {current_salinity:.4f} sg 低于目标范围 {target_min:.4f}-{target_max:.4f} sg，"
                    f"建议使用盐水补充"
                )
                # 盐度变化：补盐水
                salinity_change = (target_mid - current_salinity) * 0.3  # 逐步调整
            else:
                # 盐度正常，补纯水
                salinity_change = 0.0
        else:
            warnings.append("缸体总水量为0或蒸发量为0，无法计算盐度变化")
        
        return (top_up_water, salinity_change, warnings)
