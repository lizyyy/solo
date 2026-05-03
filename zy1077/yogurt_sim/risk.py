#!/usr/bin/env python3
"""风险规则模块 - 识别酸奶发酵中的常见翻车风险

风险类型:
1. 低温发酵停滞风险 - 温度过低导致菌活性不足
2. 高温菌活性下降风险 - 温度过高导致菌种损伤
3. 接种比例过低风险 - 初始菌量不足
4. 接种比例过高风险 - 发酵过快导致风味异常
5. 预计过酸风险 - 发酵时间过长导致酸度过高
6. 发酵时长超安全窗口 - 存在食品安全风险
7. 容器过满风险 - 发酵膨胀导致溢出
8. 容器散热异常风险 - 填充率过低导致温度控制困难
9. 预热与温度不匹配风险 - 预热标记与实际温度不一致
10. 无法凝固风险 - 预计无法完成凝固
11. 热损伤累积风险 - 持续高温导致菌种不可逆损伤
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class RiskLevel(Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Risk:
    """风险对象"""
    id: str
    name: str
    level: RiskLevel
    description: str
    cause: str
    suggestion: str
    severity_score: float  # 0-10 分


class RiskEvaluator:
    """风险评估器"""
    
    def __init__(self):
        self.rules = self._register_rules()
    
    def _register_rules(self) -> List[callable]:
        """注册所有风险规则"""
        return [
            self._check_low_temperature_risk,
            self._check_high_temperature_risk,
            self._check_low_inoculation_risk,
            self._check_high_inoculation_risk,
            self._check_over_acid_risk,
            self._check_safety_duration_risk,
            self._check_container_full_risk,
            self._check_heat_damage_risk,
            self._check_no_coagulation_risk,
            self._check_preheat_mismatch_risk,
            self._check_cooling_during_fermentation_risk,
        ]
    
    def evaluate(self, plan: Dict[str, Any], simulation: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        评估发酵方案的风险
        
        Args:
            plan: 发酵方案
            simulation: 模拟结果
        
        Returns:
            风险列表
        """
        risks = []
        
        for rule in self.rules:
            risk = rule(plan, simulation)
            if risk:
                risks.append(self._risk_to_dict(risk))
        
        # 按风险等级和严重程度排序
        risks.sort(key=lambda x: (
            {"high": 0, "medium": 1, "low": 2}[x["level"]],
            -x["severity_score"]
        ))
        
        return risks
    
    def _risk_to_dict(self, risk: Risk) -> Dict[str, Any]:
        """将 Risk 对象转换为字典"""
        return {
            "id": risk.id,
            "name": risk.name,
            "level": risk.level.value,
            "description": risk.description,
            "cause": risk.cause,
            "suggestion": risk.suggestion,
            "severity_score": risk.severity_score
        }
    
    # ==================== 风险规则实现 ====================
    
    def _check_low_temperature_risk(self, plan: Dict[str, Any], 
                                     simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查低温发酵停滞风险"""
        target_temp = plan.get('target_temp_c', 40.0)
        final_temp = simulation.get('key_metrics', {}).get('final_temperature', target_temp)
        
        # 检查目标温度是否过低
        if target_temp < 30:
            # 计算严重程度: 温度越低越严重
            severity = min(10, max(3, (30 - target_temp) * 0.8))
            
            if target_temp < 25:
                level = RiskLevel.HIGH
                description = "严重低温风险，发酵可能停滞"
            else:
                level = RiskLevel.MEDIUM
                description = "低温风险，发酵速度会很慢"
            
            return Risk(
                id="LOW_TEMPERATURE",
                name="低温发酵停滞风险",
                level=level,
                description=description,
                cause=f"目标保温温度 ({target_temp}°C) 过低，乳酸菌活性会显著下降。"
                      f"最适发酵温度为 37-42°C。",
                suggestion=f"建议将目标温度提高到 37-42°C 范围内。当前温度 {target_temp}°C "
                          f"下发酵时间可能需要延长 2-3 倍。",
                severity_score=round(severity, 1)
            )
        
        # 检查模拟过程中温度是否过低
        time_steps = simulation.get('time_steps', [])
        low_temp_count = sum(1 for step in time_steps if step.get('temperature_c', 0) < 28)
        
        if low_temp_count > len(time_steps) * 0.3:  # 超过 30% 时间温度过低
            severity = min(8, max(3, low_temp_count / len(time_steps) * 10))
            
            return Risk(
                id="LOW_TEMPERATURE_DURING",
                name="发酵过程低温风险",
                level=RiskLevel.MEDIUM,
                description="发酵过程中温度偏低，可能延长凝固时间",
                cause="发酵过程中实际温度低于预期，可能是环境温度低或容器保温差导致。",
                suggestion="建议检查容器保温性能，或提高环境温度。可适当延长发酵时间。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_high_temperature_risk(self, plan: Dict[str, Any], 
                                       simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查高温导致菌活性下降风险"""
        target_temp = plan.get('target_temp_c', 40.0)
        
        if target_temp > 48:
            severity = min(10, max(4, (target_temp - 48) * 0.8))
            
            if target_temp > 52:
                level = RiskLevel.HIGH
                description = "严重高温风险，菌种可能快速失活"
            else:
                level = RiskLevel.MEDIUM
                description = "高温风险，可能影响菌种活性"
            
            return Risk(
                id="HIGH_TEMPERATURE",
                name="高温菌活性下降风险",
                level=level,
                description=description,
                cause=f"目标保温温度 ({target_temp}°C) 过高，超过乳酸菌的耐受温度范围。"
                      f"温度超过 48°C 时乳酸菌会快速失活。",
                suggestion=f"建议将目标温度降低到 37-45°C 范围内。如果是想缩短发酵时间，"
                          f"可以考虑在 42-45°C 发酵，但不要超过 48°C。",
                severity_score=round(severity, 1)
            )
        
        # 检查模拟过程中的高温
        time_steps = simulation.get('time_steps', [])
        high_temp_count = sum(1 for step in time_steps if step.get('temperature_c', 0) > 50)
        
        if high_temp_count > 0:
            severity = min(9, max(3, high_temp_count * 2))
            
            return Risk(
                id="HIGH_TEMPERATURE_DURING",
                name="发酵过程高温风险",
                level=RiskLevel.HIGH if high_temp_count > len(time_steps) * 0.2 else RiskLevel.MEDIUM,
                description="发酵过程中温度过高，可能造成菌种热损伤",
                cause="发酵过程中实际温度超过 50°C，乳酸菌会受到不可逆的热损伤。",
                suggestion="立即检查温度控制系统，避免温度超标。如果已经发生热损伤，建议重新接种。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_low_inoculation_risk(self, plan: Dict[str, Any], 
                                     simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查接种比例过低风险"""
        inoc_ratio = plan.get('inoculation_ratio', 2.0)
        culture_type = plan.get('culture_type', 'yogurt_starter')
        
        # 不同菌种类型的最低接种比例
        min_ratios = {
            'yogurt_starter': 1.0,
            'store_bought': 2.0,
            'probiotic': 0.5,
            'homemade': 2.0,
        }
        
        min_ratio = min_ratios.get(culture_type, 1.0)
        
        if inoc_ratio < min_ratio:
            severity = min(8, max(3, (min_ratio - inoc_ratio) * 2))
            
            # 检查模拟结果是否显示无法凝固
            coagulation = simulation.get('coagulation_window', {})
            no_coagulation = coagulation.get('start_hours') is None
            
            if no_coagulation:
                level = RiskLevel.HIGH
                description = "接种比例过低，预计无法凝固"
            else:
                level = RiskLevel.MEDIUM
                description = "接种比例偏低，发酵时间会延长"
            
            return Risk(
                id="LOW_INOCULATION",
                name="接种比例过低风险",
                level=level,
                description=description,
                cause=f"当前接种比例 ({inoc_ratio}%) 低于建议值 ({min_ratio}%)。"
                      f"初始菌量不足会导致发酵启动慢，甚至无法凝固。",
                suggestion=f"建议将接种比例提高到 {min_ratio}% 以上。使用市售酸奶作为菌种时，"
                          f"建议 3-5% 的接种比例。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_high_inoculation_risk(self, plan: Dict[str, Any], 
                                      simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查接种比例过高风险"""
        inoc_ratio = plan.get('inoculation_ratio', 2.0)
        
        if inoc_ratio > 10:
            severity = min(7, max(2, (inoc_ratio - 10) * 0.3))
            
            return Risk(
                id="HIGH_INOCULATION",
                name="接种比例过高风险",
                level=RiskLevel.MEDIUM,
                description="接种比例偏高，可能导致发酵过快或风味异常",
                cause=f"当前接种比例 ({inoc_ratio}%) 较高。接种量过大虽然会加快发酵，"
                      f"但可能导致产酸过快，影响风味和质地。",
                suggestion="建议将接种比例控制在 2-5% 范围内。高接种比例适合需要快速发酵的场景，"
                          "但要密切监测酸度，避免过酸。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_over_acid_risk(self, plan: Dict[str, Any], 
                               simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查预计过酸风险"""
        coagulation = simulation.get('coagulation_window', {})
        key_metrics = simulation.get('key_metrics', {})
        
        # 检查是否过酸
        final_ph = key_metrics.get('final_ph', 6.6)
        is_over_acid = final_ph < 4.2
        
        # 检查过酸时间是否早于总时长
        over_acid_hours = coagulation.get('end_hours')
        total_duration = plan.get('total_duration_h', 8.0)
        
        if is_over_acid and over_acid_hours and over_acid_hours < total_duration:
            severity = min(9, max(3, (total_duration - over_acid_hours) * 0.5))
            
            return Risk(
                id="OVER_ACID",
                name="预计过酸风险",
                level=RiskLevel.HIGH,
                description="预计会过酸，建议提前停止发酵",
                cause=f"模拟显示在 {coagulation.get('end_time', '未知')} 时已过酸 (pH={final_ph})，"
                      f"但配置的总发酵时长为 {total_duration} 小时。"
                      f"过酸会导致酸奶口感过酸、乳清分离。",
                suggestion=f"建议在 {coagulation.get('optimal_time', '凝固窗口中期')} 停止发酵。"
                          f"最佳停止时间是凝固完成后、过酸发生前。",
                severity_score=round(severity, 1)
            )
        
        # 即使没有完全过酸，检查最终 pH 是否偏低
        if final_ph < 4.4:
            severity = min(6, max(2, (4.4 - final_ph) * 3))
            
            return Risk(
                id="SLIGHT_OVER_ACID",
                name="酸度偏高风险",
                level=RiskLevel.LOW,
                description="最终酸度偏高，可能影响口感",
                cause=f"最终 pH ({final_ph}) 偏低，酸度较高。"
                      f"虽然还没有完全过酸，但口感可能偏酸。",
                suggestion="可以适当缩短发酵时间，或降低发酵温度。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_safety_duration_risk(self, plan: Dict[str, Any], 
                                     simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查发酵时长超安全窗口风险"""
        total_duration = plan.get('total_duration_h', 8.0)
        
        if total_duration > 24:
            severity = min(10, max(5, (total_duration - 24) * 0.3))
            
            return Risk(
                id="SAFETY_DURATION",
                name="发酵时长超安全窗口",
                level=RiskLevel.HIGH,
                description="发酵时间过长，存在食品安全风险",
                cause=f"配置的发酵时长 ({total_duration} 小时) 超过 24 小时安全窗口。"
                      f"长时间发酵不仅会导致过酸，还可能增加杂菌污染的风险。",
                suggestion="建议将发酵时间控制在 24 小时以内。家庭自制酸奶建议 6-12 小时。"
                          "如果确实需要长时间发酵，请确保严格的无菌操作和温度控制。",
                severity_score=round(severity, 1)
            )
        
        if total_duration > 16:
            severity = min(5, max(2, (total_duration - 16) * 0.3))
            
            return Risk(
                id="LONG_DURATION",
                name="发酵时间较长",
                level=RiskLevel.LOW,
                description="发酵时间超过 16 小时，请注意观察",
                cause=f"发酵时长 ({total_duration} 小时) 较长。低温发酵确实需要更长时间，"
                      f"但要注意过酸和安全问题。",
                suggestion="如果是低温发酵 (30°C 以下)，长时间发酵是正常的。"
                          "建议定期检查酸度，避免过酸。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_container_full_risk(self, plan: Dict[str, Any], 
                                    simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查容器过满风险"""
        milk_volume = plan.get('milk_volume_ml', 500.0)
        container_size = plan.get('container_size_ml', 600.0)
        
        if container_size <= 0:
            return None
        
        fill_ratio = milk_volume / container_size
        
        if fill_ratio > 0.95:
            severity = min(9, max(4, (fill_ratio - 0.95) * 100))
            
            return Risk(
                id="CONTAINER_OVERFLOW",
                name="容器过满溢出风险",
                level=RiskLevel.HIGH,
                description="容器过满，发酵膨胀可能导致溢出",
                cause=f"容器填充率 {fill_ratio*100:.1f}% 过高。牛奶发酵过程中会因产酸和凝乳"
                      f"而发生体积膨胀，填充率过高容易溢出。",
                suggestion=f"建议填充率控制在 80-90% 之间。当前牛奶量 {milk_volume} ml，"
                          f"建议使用至少 {milk_volume / 0.85:.0f} ml 的容器。",
                severity_score=round(severity, 1)
            )
        
        if fill_ratio > 0.9:
            severity = min(5, max(2, (fill_ratio - 0.9) * 50))
            
            return Risk(
                id="CONTAINER_FULL",
                name="容器较满风险",
                level=RiskLevel.LOW,
                description="容器填充率较高，注意观察",
                cause=f"容器填充率 {fill_ratio*100:.1f}% 较高。虽然不会立即溢出，"
                      f"但发酵过程中仍需注意。",
                suggestion="发酵过程中注意观察，如果有溢出迹象及时处理。"
                          "下次制作时建议使用稍大的容器。",
                severity_score=round(severity, 1)
            )
        
        # 检查填充率过低导致的散热问题
        if fill_ratio < 0.3:
            severity = min(6, max(2, (0.3 - fill_ratio) * 10))
            
            return Risk(
                id="CONTAINER_UNDERFILLED",
                name="容器填充率过低风险",
                level=RiskLevel.MEDIUM,
                description="容器填充率过低，散热可能过快",
                cause=f"容器填充率 {fill_ratio*100:.1f}% 过低。牛奶量相对容器太小，"
                      f"散热表面积相对较大，温度控制可能困难。",
                suggestion=f"建议填充率至少 30% 以上。如果牛奶量少，建议使用较小的容器。"
                          f"当前 {milk_volume} ml 牛奶建议使用 {milk_volume / 0.7:.0f} ml 左右的容器。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_heat_damage_risk(self, plan: Dict[str, Any], 
                                 simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查热损伤累积风险"""
        key_metrics = simulation.get('key_metrics', {})
        heat_damage = key_metrics.get('total_heat_damage', 0.0)
        
        if heat_damage > 1.0:
            severity = min(9, max(4, heat_damage))
            
            return Risk(
                id="HEAT_DAMAGE",
                name="热损伤累积风险",
                level=RiskLevel.HIGH if heat_damage > 2.0 else RiskLevel.MEDIUM,
                description="存在显著热损伤，菌种活性可能不可逆下降",
                cause=f"累积热损伤指数 ({heat_damage:.2f}) 较高。说明发酵过程中存在持续高温，"
                      f"乳酸菌可能受到不可逆的损伤。",
                suggestion="建议降低发酵温度，避免温度超过 48°C。"
                          "如果热损伤严重，可能需要重新接种。",
                severity_score=round(severity, 1)
            )
        
        if heat_damage > 0.3:
            severity = min(4, max(1, heat_damage))
            
            return Risk(
                id="MINOR_HEAT_DAMAGE",
                name="轻微热损伤",
                level=RiskLevel.LOW,
                description="存在轻微热损伤，建议关注",
                cause=f"累积热损伤指数 ({heat_damage:.2f}) 显示存在轻微热损伤。"
                      f"虽然不严重，但应避免温度过高。",
                suggestion="建议监测温度，避免超过 48°C。",
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_no_coagulation_risk(self, plan: Dict[str, Any], 
                                    simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查无法凝固风险"""
        coagulation = simulation.get('coagulation_window', {})
        key_metrics = simulation.get('key_metrics', {})
        
        start_hours = coagulation.get('start_hours')
        final_ph = key_metrics.get('final_ph', 6.6)
        
        if start_hours is None:
            # 检查原因
            if final_ph > 5.5:
                severity = 8.0
                cause = "酸度几乎没有增加，可能是菌种活性极低或接种量不足。"
                suggestion = "建议检查菌种是否过期或失活，适当增加接种比例。"
            elif final_ph > 5.0:
                severity = 6.0
                cause = "酸度增加但不足以凝固，可能是发酵时间不够或温度过低。"
                suggestion = "建议延长发酵时间，或提高发酵温度到 37-42°C。"
            else:
                severity = 4.0
                cause = "酸度接近凝固阈值，但可能需要更长时间。"
                suggestion = "建议延长发酵时间，密切观察凝固情况。"
            
            return Risk(
                id="NO_COAGULATION",
                name="无法凝固风险",
                level=RiskLevel.HIGH if severity > 6 else RiskLevel.MEDIUM,
                description="预计无法在配置时间内完成凝固",
                cause=cause,
                suggestion=suggestion,
                severity_score=round(severity, 1)
            )
        
        return None
    
    def _check_preheat_mismatch_risk(self, plan: Dict[str, Any], 
                                      simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查预热与温度不匹配风险"""
        preheated = plan.get('preheated', False)
        initial_temp = plan.get('initial_temp_c', 25.0)
        target_temp = plan.get('target_temp_c', 40.0)
        
        if preheated:
            if initial_temp < target_temp - 10:
                severity = min(6, max(2, (target_temp - 10 - initial_temp) * 0.2))
                
                return Risk(
                    id="PREHEAT_MISMATCH",
                    name="预热与温度不匹配风险",
                    level=RiskLevel.MEDIUM,
                    description="标记为预热但初始温度较低",
                    cause=f"方案标记为已预热，但初始温度 ({initial_temp}°C) "
                          f"远低于目标温度 ({target_temp}°C)。"
                          f"预热应该使牛奶接近发酵温度。",
                    suggestion=f"如果确实预热了，请确认初始温度设置是否正确。"
                              f"预热后的牛奶温度应该接近目标发酵温度。",
                    severity_score=round(severity, 1)
                )
        
        return None
    
    def _check_cooling_during_fermentation_risk(self, plan: Dict[str, Any], 
                                                   simulation: Dict[str, Any]) -> Optional[Risk]:
        """检查发酵过程中异常降温风险"""
        time_steps = simulation.get('time_steps', [])
        
        if len(time_steps) < 2:
            return None
        
        # 检查是否有显著降温
        temp_drops = []
        for i in range(1, len(time_steps)):
            prev_temp = time_steps[i-1].get('temperature_c', 0)
            curr_temp = time_steps[i].get('temperature_c', 0)
            drop = prev_temp - curr_temp
            if drop > 3:  # 单步降温超过 3°C
                temp_drops.append({
                    'step': i,
                    'time': time_steps[i].get('time_hours', 0),
                    'drop': drop
                })
        
        if temp_drops:
            max_drop = max(d['drop'] for d in temp_drops)
            severity = min(7, max(3, max_drop * 0.5))
            
            return Risk(
                id="COOLING_DURING_FERMENTATION",
                name="发酵过程异常降温风险",
                level=RiskLevel.MEDIUM,
                description="发酵过程中存在异常降温",
                cause=f"模拟显示发酵过程中存在异常降温 (最大降温 {max_drop:.1f}°C)。"
                      f"温度波动可能影响发酵稳定性，导致凝固不均匀。",
                suggestion="建议检查保温设备，确保温度稳定。发酵过程中避免频繁开盖检查。",
                severity_score=round(severity, 1)
            )
        
        return None
