#!/usr/bin/env python3
"""科学计算模型模块 - 模拟酸奶发酵过程

模型假设:
1. 温度变化遵循牛顿冷却定律
2. 菌种活性与温度呈非线性关系（存在最适温度）
3. 乳酸生成速率与菌活性、接种比例、温度相关
4. pH 与乳酸浓度呈对数关系
5. 凝固发生在特定酸度范围内（pH 4.5-4.8）
6. 过酸发生在 pH 低于 4.2 时

参数说明:
- 时间步长: 15 分钟 (0.25 小时)
- 温度系数: 根据容器和填充率调整
- 菌活性曲线: 37°C 为最适温度，低于 30°C 或高于 48°C 活性显著下降
"""

import math
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass, field
from datetime import timedelta


# 模型常量
TIME_STEP_HOURS = 0.25  # 15分钟

# 温度相关参数
OPTIMAL_TEMP = 37.0  # 最适发酵温度 (°C)
MIN_ACTIVE_TEMP = 25.0  # 最低活性温度 (°C)
MAX_ACTIVE_TEMP = 48.0  # 最高活性温度 (°C)
HEAT_DAMAGE_TEMP = 50.0  # 热损伤温度 (°C)

# 酸度和 pH 相关参数
INITIAL_PH = 6.6  # 新鲜牛奶初始 pH
COAGULATION_PH_LOW = 4.5  # 凝固开始 pH
COAGULATION_PH_HIGH = 4.8  # 凝固结束 pH (实际是开始凝固的上限)
OVER_ACID_PH = 4.2  # 过酸阈值 pH
SAFE_DURATION_HOURS = 24.0  # 安全发酵时长

# 凝固相关参数
COAGULATION_START_ACIDITY = 0.6  # 开始凝固的酸度 (%)
COAGULATION_END_ACIDITY = 0.9  # 凝固完成的酸度 (%)
OVER_ACID_ACIDITY = 1.2  # 过酸的酸度 (%)

# 菌种类型对应的基础活性系数
CULTURE_ACTIVITY_COEFFICIENTS = {
    "yogurt_starter": 1.0,  # 商用发酵剂
    "store_bought": 0.6,  # 市售酸奶
    "probiotic": 0.8,  # 益生菌胶囊
    "homemade": 0.7,  # 自制酸奶
}


@dataclass
class SimulationState:
    """模拟状态"""
    time_hours: float = 0.0
    temperature_c: float = 0.0
    ph: float = 6.6
    acidity_percent: float = 0.0  # 乳酸百分比
    bacteria_activity: float = 1.0  # 当前菌活性 (相对于初始)
    bacteria_count: float = 1.0  # 相对菌数
    is_coagulated: bool = False
    is_over_acid: bool = False
    cumulative_heat_damage: float = 0.0


@dataclass 
class CoagulationWindow:
    """凝固窗口"""
    start_hours: float = None
    end_hours: float = None
    optimal_hours: float = None  # 建议停止时间
    start_ph: float = None
    end_ph: float = None
    start_acidity: float = None
    end_acidity: float = None


class FermentationSimulator:
    """酸奶发酵模拟器"""
    
    def __init__(self, plan: Dict[str, Any]):
        """
        初始化模拟器
        
        Args:
            plan: 发酵方案字典
        """
        self.plan = plan
        self.time_steps = []
        
        # 提取参数
        self.initial_temp = plan.get('initial_temp_c', 25.0)
        self.target_temp = plan.get('target_temp_c', 40.0)
        self.ambient_temp = plan.get('ambient_temp_c', 25.0)
        self.total_duration = plan.get('total_duration_h', 8.0)
        
        # 菌种参数
        self.culture_type = plan.get('culture_type', 'yogurt_starter')
        self.culture_activity = plan.get('culture_activity', 5)
        self.inoculation_ratio = plan.get('inoculation_ratio', 2.0)
        
        # 容器参数
        self.milk_volume = plan.get('milk_volume_ml', 500.0)
        self.container_size = plan.get('container_size_ml', 600.0)
        self.preheated = plan.get('preheated', False)
        self.milk_fat = plan.get('milk_fat_content', 3.5)
        
        # 温度阶段（如果有）
        self.temperature_phases = plan.get('temperature_phases', None)
        
        # 计算派生参数
        self.fill_ratio = self.milk_volume / self.container_size if self.container_size > 0 else 0.8
        
        # 基础活性系数
        self.base_activity_coeff = CULTURE_ACTIVITY_COEFFICIENTS.get(
            self.culture_type, 0.8
        )
        
        # 初始活性 = 菌种活性评分 × 类型系数 × 接种比例因子
        # 接种比例因子: 以 2% 为基准，每增加 1% 增加 20% 活性
        inoculation_factor = 1.0 + (self.inoculation_ratio - 2.0) * 0.2
        
        # 菌种活性评分转换 (1-10 → 0.2-2.0)
        activity_factor = 0.2 + (self.culture_activity - 1) * 0.2
        
        self.initial_bacteria_activity = (
            self.base_activity_coeff * activity_factor * max(0.5, inoculation_factor)
        )
        
        # 计算温度变化系数 (基于容器填充率)
        # 填充率越高，温度保持越好
        self.thermal_coeff = self._calculate_thermal_coeff()
        
    def _calculate_thermal_coeff(self) -> float:
        """
        计算温度变化系数
        
        基于牛顿冷却定律: dT/dt = k*(T_ambient - T_current)
        k 值取决于容器的保温性能和填充率
        
        Returns:
            温度系数 k (1/小时)
        """
        # 基础系数 (假设是普通保温容器)
        base_k = 0.15  # 每小时温度变化率
        
        # 填充率影响: 填充率越高，温度变化越慢
        # 填充率 30% 以下: 散热快
        # 填充率 30-70%: 适中
        # 填充率 70% 以上: 保温好
        
        if self.fill_ratio < 0.3:
            fill_factor = 1.5  # 散热快 50%
        elif self.fill_ratio > 0.7:
            fill_factor = 0.7  # 保温好 30%
        else:
            fill_factor = 1.0
        
        # 预热影响: 如果预热，初始温度接近目标温度
        preheat_factor = 0.8 if self.preheated else 1.0
        
        return base_k * fill_factor * preheat_factor
    
    def _calculate_temperature_at_time(self, time_hours: float, current_temp: float) -> float:
        """
        计算给定时间的温度
        
        如果有温度阶段配置，按阶段调整目标温度
        
        Args:
            time_hours: 当前时间 (小时)
            current_temp: 当前温度
        
        Returns:
            新的温度
        """
        # 确定当前阶段的目标温度
        effective_target = self.target_temp
        
        if self.temperature_phases:
            elapsed = 0.0
            for phase in self.temperature_phases:
                phase_duration = phase.get('duration_h', 0)
                if elapsed <= time_hours < elapsed + phase_duration:
                    effective_target = phase.get('temperature_c', self.target_temp)
                    break
                elapsed += phase_duration
        
        # 牛顿冷却/加热公式
        # T(t) = T_ambient + (T0 - T_ambient) * e^(-kt)
        # 但这里我们是步进计算
        
        # 温度差
        delta_temp = effective_target - current_temp
        
        # 如果温度差很小，直接返回目标温度
        if abs(delta_temp) < 0.1:
            return effective_target
        
        # 计算温度变化
        # 向目标温度靠近，速度取决于温差和热系数
        temp_change = delta_temp * (1 - math.exp(-self.thermal_coeff * TIME_STEP_HOURS))
        
        new_temp = current_temp + temp_change
        
        # 限制温度变化速率（更符合实际）
        max_change_per_step = 5.0  # 每步最多变化 5°C
        if abs(temp_change) > max_change_per_step:
            temp_change = max_change_per_step * (1 if temp_change > 0 else -1)
            new_temp = current_temp + temp_change
        
        return new_temp
    
    def _calculate_bacteria_activity(self, temperature: float, cumulative_damage: float) -> Tuple[float, float]:
        """
        计算当前温度下的菌活性
        
        菌活性曲线:
        - 30°C 以下: 活性低，呈指数下降
        - 30-37°C: 活性上升，37°C 达到峰值
        - 37-45°C: 活性缓慢下降
        - 45°C 以上: 活性快速下降，且有累积热损伤
        
        Args:
            temperature: 当前温度
            cumulative_damage: 累积热损伤
        
        Returns:
            (相对活性, 新增热损伤)
        """
        # 基础活性曲线 (相对于最适温度)
        if temperature < MIN_ACTIVE_TEMP:
            # 低温: 活性指数下降
            base_activity = math.exp(0.15 * (temperature - MIN_ACTIVE_TEMP))
        elif temperature <= OPTIMAL_TEMP:
            # 上升阶段: 二次曲线
            norm_temp = (temperature - MIN_ACTIVE_TEMP) / (OPTIMAL_TEMP - MIN_ACTIVE_TEMP)
            base_activity = 4 * norm_temp * (1 - norm_temp) if norm_temp <= 1 else 0
            # 调整使 37°C 为 1.0
            base_activity = base_activity * 1.0
        elif temperature <= MAX_ACTIVE_TEMP:
            # 下降阶段: 线性下降
            norm_temp = (temperature - OPTIMAL_TEMP) / (MAX_ACTIVE_TEMP - OPTIMAL_TEMP)
            base_activity = 1.0 - 0.8 * norm_temp
        else:
            # 超高温: 活性骤降
            base_activity = math.exp(-0.5 * (temperature - MAX_ACTIVE_TEMP))
        
        # 计算热损伤
        new_damage = 0.0
        if temperature > HEAT_DAMAGE_TEMP:
            # 超过 50°C，每小时增加损伤
            damage_rate = 0.3 * (temperature - HEAT_DAMAGE_TEMP)  # 每小时损伤率
            new_damage = damage_rate * TIME_STEP_HOURS
        
        # 总损伤 = 累积损伤 + 新增损伤
        total_damage = cumulative_damage + new_damage
        
        # 损伤因子: 损伤越多，活性越低
        damage_factor = math.exp(-total_damage)
        
        # 最终活性 = 基础活性 × 初始活性 × 损伤因子
        final_activity = base_activity * self.initial_bacteria_activity * damage_factor
        
        return max(0.01, final_activity), total_damage
    
    def _calculate_lactic_acid_production(self, activity: float, temperature: float) -> float:
        """
        计算乳酸生成率
        
        乳酸生成速率与:
        1. 菌活性成正比
        2. 温度有一定关系（酶活性）
        3. 营养物质浓度（简化为恒定，假设牛奶充足）
        
        Args:
            activity: 当前菌活性
            temperature: 当前温度
        
        Returns:
            本时间步的酸度增加量 (%)
        """
        # 基础产酸率 (每小时)
        # 假设在最适条件下，每小时酸度增加约 0.1%
        base_rate_per_hour = 0.1
        
        # 温度对酶活性的影响因子
        # 使用与菌活性类似但稍宽的曲线
        if temperature < 20:
            temp_factor = 0.2
        elif temperature < 35:
            temp_factor = 0.2 + 0.8 * (temperature - 20) / 15
        elif temperature < 45:
            temp_factor = 1.0
        elif temperature < 55:
            temp_factor = 1.0 - 0.8 * (temperature - 45) / 10
        else:
            temp_factor = 0.2
        
        # 酸度增加量 = 基础率 × 活性 × 温度因子 × 时间步
        acid_increase = base_rate_per_hour * activity * temp_factor * TIME_STEP_HOURS
        
        # 反馈抑制: 酸度越高，产酸越慢
        # 当酸度 > 1.0% 时，产酸率下降
        feedback_factor = 1.0
        if self._current_acidity > 1.0:
            feedback_factor = math.exp(-0.5 * (self._current_acidity - 1.0))
        
        return acid_increase * feedback_factor
    
    def _calculate_ph_from_acidity(self, acidity: float) -> float:
        """
        从酸度计算 pH
        
        参考点:
        - 新鲜牛奶: pH ~6.6, 酸度 ~0.15%
        - 凝固开始: pH ~4.6, 酸度 ~0.6%
        - 过酸: pH ~4.2, 酸度 ~1.0%
        
        使用分段线性插值:
        - 0.15% 以下: pH = 6.6
        - 0.15% - 0.6%: 线性插值从 6.6 到 4.6
        - 0.6% - 1.0%: 线性插值从 4.6 到 4.2
        - 1.0% 以上: 缓慢下降 (每增加 0.5% 酸度，pH 下降约 0.1)
        
        Args:
            acidity: 酸度 (%)
        
        Returns:
            pH 值
        """
        # 参考点定义
        points = [
            (0.15, 6.6),   # 新鲜牛奶
            (0.6, 4.6),    # 开始凝固
            (1.0, 4.2),    # 过酸
        ]
        
        # 低于最低酸度，返回初始 pH
        if acidity <= points[0][0]:
            return points[0][1]
        
        # 分段线性插值
        for i in range(len(points) - 1):
            acid1, ph1 = points[i]
            acid2, ph2 = points[i + 1]
            
            if acid1 < acidity <= acid2:
                # 线性插值
                ratio = (acidity - acid1) / (acid2 - acid1)
                ph = ph1 + ratio * (ph2 - ph1)
                return max(3.5, min(7.0, ph))
        
        # 超过最高酸度，继续缓慢下降
        # 每增加 0.5% 酸度，pH 下降约 0.1
        last_acid, last_ph = points[-1]
        extra_acid = acidity - last_acid
        ph_drop = extra_acid * 0.2  # 每 1% 酸度下降 0.2 pH
        
        ph = last_ph - ph_drop
        return max(3.5, min(7.0, ph))
    
    def simulate(self) -> Dict[str, Any]:
        """
        执行完整的发酵模拟
        
        Returns:
            包含模拟结果的字典
        """
        # 初始化状态
        state = SimulationState(
            time_hours=0.0,
            temperature_c=self.initial_temp,
            ph=INITIAL_PH,
            acidity_percent=0.15,  # 新鲜牛奶的基础酸度
            bacteria_activity=self.initial_bacteria_activity,
            bacteria_count=1.0,
            is_coagulated=False,
            is_over_acid=False,
            cumulative_heat_damage=0.0
        )
        
        # 用于跟踪凝固窗口
        coagulation_window = CoagulationWindow()
        time_steps_data = []
        
        # 记录当前酸度供反馈抑制使用
        self._current_acidity = state.acidity_percent
        
        # 模拟循环
        num_steps = int(self.total_duration / TIME_STEP_HOURS) + 1
        
        for step in range(num_steps):
            current_time = step * TIME_STEP_HOURS
            
            # 记录当前状态
            step_data = {
                'step': step,
                'time_hours': round(current_time, 2),
                'temperature_c': round(state.temperature_c, 2),
                'ph': round(state.ph, 2),
                'acidity_percent': round(state.acidity_percent, 3),
                'bacteria_activity': round(state.bacteria_activity, 3),
                'cumulative_heat_damage': round(state.cumulative_heat_damage, 3),
                'is_coagulated': state.is_coagulated,
                'is_over_acid': state.is_over_acid
            }
            time_steps_data.append(step_data)
            
            # 检查凝固窗口
            if not state.is_coagulated:
                if state.ph <= COAGULATION_PH_HIGH and state.acidity_percent >= COAGULATION_START_ACIDITY:
                    # 开始凝固
                    state.is_coagulated = True
                    coagulation_window.start_hours = current_time
                    coagulation_window.start_ph = state.ph
                    coagulation_window.start_acidity = state.acidity_percent
            
            # 检查过酸
            if not state.is_over_acid:
                if state.ph <= OVER_ACID_PH or state.acidity_percent >= OVER_ACID_ACIDITY:
                    state.is_over_acid = True
                    coagulation_window.end_hours = current_time
                    coagulation_window.end_ph = state.ph
                    coagulation_window.end_acidity = state.acidity_percent
                    
                    # 计算最佳停止时间 (凝固窗口的中间点)
                    if coagulation_window.start_hours is not None:
                        optimal = (
                            coagulation_window.start_hours + 
                            (current_time - coagulation_window.start_hours) * 0.5
                        )
                        coagulation_window.optimal_hours = round(optimal, 2)
            
            # 如果是最后一步，跳过计算
            if step == num_steps - 1:
                break
            
            # 计算下一步温度
            next_temp = self._calculate_temperature_at_time(
                current_time + TIME_STEP_HOURS,
                state.temperature_c
            )
            
            # 计算菌活性和热损伤
            next_activity, next_damage = self._calculate_bacteria_activity(
                next_temp,
                state.cumulative_heat_damage
            )
            
            # 更新当前酸度供反馈抑制
            self._current_acidity = state.acidity_percent
            
            # 计算乳酸生成
            acid_increase = self._calculate_lactic_acid_production(
                next_activity,
                next_temp
            )
            next_acidity = state.acidity_percent + acid_increase
            
            # 计算 pH
            next_ph = self._calculate_ph_from_acidity(next_acidity)
            
            # 更新状态
            state = SimulationState(
                time_hours=current_time + TIME_STEP_HOURS,
                temperature_c=next_temp,
                ph=next_ph,
                acidity_percent=next_acidity,
                bacteria_activity=next_activity,
                bacteria_count=state.bacteria_count * (1 + 0.1 * next_activity * TIME_STEP_HOURS),
                is_coagulated=state.is_coagulated,
                is_over_acid=state.is_over_acid,
                cumulative_heat_damage=next_damage
            )
        
        # 如果凝固窗口还没结束，使用最后状态
        if coagulation_window.end_hours is None and state.is_coagulated:
            coagulation_window.end_hours = self.total_duration
            coagulation_window.end_ph = state.ph
            coagulation_window.end_acidity = state.acidity_percent
            
            if coagulation_window.start_hours is not None:
                # 如果还没过酸，建议在总时长的 80% 时停止
                optimal = (
                    coagulation_window.start_hours + 
                    (self.total_duration - coagulation_window.start_hours) * 0.8
                )
                coagulation_window.optimal_hours = round(optimal, 2)
        
        # 计算关键指标
        key_metrics = {
            'final_ph': round(state.ph, 2),
            'final_acidity': round(state.acidity_percent, 3),
            'viability_retention': round(
                (state.bacteria_activity / self.initial_bacteria_activity) * 100, 1
            ) if self.initial_bacteria_activity > 0 else 0,
            'total_heat_damage': round(state.cumulative_heat_damage, 3),
            'final_temperature': round(state.temperature_c, 2)
        }
        
        # 生成建议
        suggestions = self._generate_suggestions(state, coagulation_window, time_steps_data)
        
        # 构建返回结果
        result = {
            'plan_name': self.plan.get('name', 'Unnamed Plan'),
            'time_steps': time_steps_data,
            'coagulation_window': {
                'start_hours': coagulation_window.start_hours,
                'end_hours': coagulation_window.end_hours,
                'optimal_hours': coagulation_window.optimal_hours,
                'start_ph': coagulation_window.start_ph,
                'end_ph': coagulation_window.end_ph,
                'start_acidity': coagulation_window.start_acidity,
                'end_acidity': coagulation_window.end_acidity,
                'start_time': self._format_hours(coagulation_window.start_hours) if coagulation_window.start_hours else "未开始",
                'end_time': self._format_hours(coagulation_window.end_hours) if coagulation_window.end_hours else "未结束",
                'optimal_time': self._format_hours(coagulation_window.optimal_hours) if coagulation_window.optimal_hours else "待定"
            },
            'key_metrics': key_metrics,
            'suggestions': suggestions,
            'model_assumptions': self._get_model_assumptions()
        }
        
        return result
    
    def _format_hours(self, hours: float) -> str:
        """将小时格式化为 小时:分钟 格式"""
        if hours is None:
            return "N/A"
        h = int(hours)
        m = int((hours - h) * 60)
        return f"{h}h{m:02d}m"
    
    def _generate_suggestions(self, state: SimulationState, 
                              coagulation: CoagulationWindow,
                              time_steps: List[Dict]) -> List[str]:
        """根据模拟结果生成建议"""
        suggestions = []
        
        # 检查是否会凝固
        if not state.is_coagulated:
            if state.ph > 5.0:
                suggestions.append("预计不会凝固，建议增加菌种量或提高发酵温度")
            elif state.ph > COAGULATION_PH_HIGH:
                suggestions.append("发酵时长不足，建议延长发酵时间")
        
        # 检查是否过酸
        if state.is_over_acid:
            if coagulation.end_hours and coagulation.end_hours < self.total_duration:
                suggestions.append(
                    f"预计在 {self._format_hours(coagulation.end_hours)} 后过酸，建议提前停止发酵"
                )
        
        # 检查温度问题
        final_temp = state.temperature_c
        if final_temp < 30:
            suggestions.append(f"最终温度较低 ({final_temp:.1f}°C)，发酵速度慢，建议提高保温温度")
        elif final_temp > 48:
            suggestions.append(f"最终温度较高 ({final_temp:.1f}°C)，可能影响菌种活性，建议降低保温温度")
        
        # 检查热损伤
        if state.cumulative_heat_damage > 0.5:
            suggestions.append(
                f"存在显著热损伤 (累积损伤: {state.cumulative_heat_damage:.2f})，建议避免高温"
            )
        
        # 检查发酵时长
        if self.total_duration > 24:
            suggestions.append("发酵时长超过 24 小时，存在食品安全风险，建议缩短时长")
        
        # 检查接种比例
        if self.inoculation_ratio < 1:
            suggestions.append(f"接种比例较低 ({self.inoculation_ratio}%)，建议增加到 2-3%")
        elif self.inoculation_ratio > 5:
            suggestions.append(f"接种比例较高 ({self.inoculation_ratio}%)，可能导致发酵过快")
        
        # 检查填充率
        if self.fill_ratio > 0.9:
            suggestions.append(f"容器填充率较高 ({self.fill_ratio*100:.0f}%)，注意发酵膨胀可能溢出")
        elif self.fill_ratio < 0.3:
            suggestions.append(f"容器填充率较低 ({self.fill_ratio*100:.0f}%)，温度保持可能不佳")
        
        return suggestions
    
    def _get_model_assumptions(self) -> Dict[str, str]:
        """返回模型假设说明"""
        return {
            "temperature_model": "牛顿冷却定律，温度变化速率与温差成正比",
            "activity_curve": "37°C 为最适温度，30°C 以下和 48°C 以上活性显著下降",
            "acid_production": "乳酸生成速率与菌活性和温度相关，高酸度有反馈抑制",
            "ph_model": "pH 与酸度呈对数关系，参考新鲜牛奶 pH 6.6、凝固 pH 4.6、过酸 pH 4.2",
            "coagulation_window": "pH 4.5-4.8 为凝固窗口，pH < 4.2 为过酸",
            "time_step": f"时间步长 {TIME_STEP_HOURS*60:.0f} 分钟",
            "limitations": "简化模型，不考虑蛋白质变性的详细机制、杂菌污染等因素"
        }
