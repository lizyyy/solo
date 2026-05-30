"""
失败反馈和复盘系统
区分概念错误和操作错误，提供详细的失败分析
"""

from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from .models import GameState, GameStatus, FailureReason, Crop, CropStatus
from .engine import GreenhouseEngine


class ErrorCategory(Enum):
    """错误分类"""
    CONCEPTUAL = "conceptual"
    OPERATIONAL = "operational"
    STRATEGIC = "strategic"
    UNKNOWN = "unknown"


@dataclass
class FailureAnalysis:
    """失败分析结果"""
    failure_reason: FailureReason
    error_category: ErrorCategory
    root_cause: str
    conceptual_errors: List[str]
    operational_errors: List[str]
    strategic_errors: List[str]
    recommendations: List[str]
    learning_points: List[str]
    resource_analysis: Dict[str, Any]
    timeline_events: List[Dict[str, Any]]


class FailureAnalyzer:
    """失败分析器"""
    
    def __init__(self, engine: GreenhouseEngine):
        self.engine = engine
        self.game_state = engine.game_state
    
    def analyze_failure(self) -> FailureAnalysis:
        """分析失败原因"""
        if self.game_state.status != GameStatus.FAILED:
            raise ValueError("游戏未失败，无法分析")
        
        reason = self.game_state.failure_reason
        
        # 根据失败原因进行分类分析
        if reason == FailureReason.ENERGY_NEGATIVE:
            return self._analyze_energy_failure()
        elif reason == FailureReason.WATER_CYCLE_BROKEN:
            return self._analyze_water_failure()
        elif reason == FailureReason.TEMPERATURE_OUT_OF_RANGE:
            return self._analyze_temperature_failure()
        elif reason == FailureReason.CROP_ALL_DEAD:
            return self._analyze_crop_failure()
        elif reason == FailureReason.SANDSTORM_DAMAGE:
            return self._analyze_sandstorm_failure()
        else:
            return self._analyze_unknown_failure()
    
    def _categorize_error(self, errors: List[str]) -> Tuple[List[str], List[str], List[str]]:
        """将错误分类为概念/操作/策略"""
        conceptual = []
        operational = []
        strategic = []
        
        conceptual_keywords = ['原理', '概念', '理解', '应该知道', '基本规律', '科学原理']
        operational_keywords = ['忘记', '未及时', '操作失误', '没有', '忘记开启']
        strategic_keywords = ['策略', '规划', '长期', '储备', '平衡']
        
        for error in errors:
            if any(kw in error for kw in conceptual_keywords):
                conceptual.append(error)
            elif any(kw in error for kw in operational_keywords):
                operational.append(error)
            elif any(kw in error for kw in strategic_keywords):
                strategic.append(error)
            else:
                # 默认归为操作错误
                operational.append(error)
        
        return conceptual, operational, strategic
    
    def _analyze_energy_failure(self) -> FailureAnalysis:
        """分析能量失败"""
        errors = []
        
        # 检查概念错误
        if self.game_state.total_energy_consumption > self.game_state.total_energy_production * 2:
            errors.append("【概念】不理解能量守恒原理，消耗持续大幅超过产能")
        
        # 检查操作错误
        all_lights_on = all(m.light_on for m in self.game_state.greenhouse_modules)
        if all_lights_on and self.game_state.round > 10:
            errors.append("【操作】忘记关灯，夜间也在消耗能量")
        
        # 检查策略错误
        total_battery_cap = sum(b.capacity for b in self.game_state.batteries)
        if total_battery_cap < 300:
            errors.append("【策略】电池储备不足，缺乏应对突发情况的能力")
        
        conceptual, operational, strategic = self._categorize_error(errors)
        
        return FailureAnalysis(
            failure_reason=FailureReason.ENERGY_NEGATIVE,
            error_category=ErrorCategory.OPERATIONAL if operational else ErrorCategory.CONCEPTUAL,
            root_cause="能量入不敷出，系统无法维持基本运转",
            conceptual_errors=conceptual,
            operational_errors=operational,
            strategic_errors=strategic,
            recommendations=[
                "检查太阳能板是否有足够的光照时间",
                "合理安排灯光使用，避免24小时开启",
                "增加电池容量以储备多余能量",
                "优化温控策略，减少不必要的能耗"
            ],
            learning_points=[
                "理解能量守恒：能量不能凭空产生",
                "学习能量转换效率的概念",
                "了解储能系统的重要性"
            ],
            resource_analysis={
                "total_produced": self.game_state.total_energy_production,
                "total_consumed": self.game_state.total_energy_consumption,
                "net_energy": self.game_state.total_energy_production - self.game_state.total_energy_consumption,
                "battery_capacity": sum(b.capacity for b in self.game_state.batteries),
                "final_charge": sum(b.current_charge for b in self.game_state.batteries)
            },
            timeline_events=self._get_key_timeline_events()
        )
    
    def _analyze_water_failure(self) -> FailureAnalysis:
        """分析水循环失败"""
        errors = []
        
        # 概念错误
        all_circulation_off = all(not t.is_circulating for t in self.game_state.water_tanks)
        if all_circulation_off:
            errors.append("【概念】不理解水循环的重要性，关闭了净化系统")
        
        # 操作错误
        tanks_empty = sum(1 for t in self.game_state.water_tanks if t.current_level <= 0)
        if tanks_empty > 0 and self.game_state.round > 5:
            errors.append(f"【操作】有 {tanks_empty} 个水箱空了，未及时补充或检查")
        
        # 策略错误
        total_water = sum(t.capacity for t in self.game_state.water_tanks)
        crop_demand = sum(c.water_consumption for c in self.game_state.crops if c.status != CropStatus.DEAD)
        if total_water < crop_demand * 10:
            errors.append("【策略】水箱容量不足，无法满足作物长期需求")
        
        conceptual, operational, strategic = self._categorize_error(errors)
        
        return FailureAnalysis(
            failure_reason=FailureReason.WATER_CYCLE_BROKEN,
            error_category=ErrorCategory.CONCEPTUAL if conceptual else ErrorCategory.OPERATIONAL,
            root_cause="水循环系统崩溃，作物无法获得必要的水分",
            conceptual_errors=conceptual,
            operational_errors=operational,
            strategic_errors=strategic,
            recommendations=[
                "确保水循环系统始终开启",
                "定期检查水箱水位，及时补充",
                "根据作物数量配置足够的水箱容量",
                "理解水的净化和循环利用原理"
            ],
            learning_points=[
                "了解水在植物生长中的作用",
                "学习水循环和净化系统的工作原理",
                "理解水资源的珍贵性"
            ],
            resource_analysis={
                "total_water_capacity": sum(t.capacity for t in self.game_state.water_tanks),
                "final_water_level": sum(t.current_level for t in self.game_state.water_tanks),
                "circulation_active": any(t.is_circulating for t in self.game_state.water_tanks),
                "crop_water_demand": sum(c.water_consumption for c in self.game_state.crops)
            },
            timeline_events=self._get_key_timeline_events()
        )
    
    def _analyze_temperature_failure(self) -> FailureAnalysis:
        """分析温度失败"""
        errors = []
        
        # 概念错误
        extreme_temps = []
        for m in self.game_state.greenhouse_modules:
            if m.temperature < 5 or m.temperature > 40:
                extreme_temps.append((m.name, m.temperature))
        if extreme_temps:
            errors.append(f"【概念】温度达到极端值（{extreme_temps}），不了解作物的温度耐受范围")
        
        # 操作错误
        no_temp_control = all(abs(m.temperature - m.target_temperature) > 5 for m in self.game_state.greenhouse_modules)
        if no_temp_control:
            errors.append("【操作】未设置合理的目标温度，温控系统未有效工作")
        
        # 策略错误
        if self.game_state.current_sandstorm:
            errors.append("【策略】沙尘暴期间未做好温度防护准备")
        
        conceptual, operational, strategic = self._categorize_error(errors)
        
        return FailureAnalysis(
            failure_reason=FailureReason.TEMPERATURE_OUT_OF_RANGE,
            error_category=ErrorCategory.CONCEPTUAL,
            root_cause="温度超出作物耐受范围，影响作物正常生长",
            conceptual_errors=conceptual,
            operational_errors=operational,
            strategic_errors=strategic,
            recommendations=[
                "了解每种作物的最佳生长温度范围",
                "设置合理的目标温度，让温控系统正常工作",
                "极端天气期间特别注意温度控制",
                "理解温度对酶活性的影响"
            ],
            learning_points=[
                "学习温度对植物光合作用的影响",
                "了解植物的温度适应性",
                "理解温室效应的原理"
            ],
            resource_analysis={
                "module_temperatures": [(m.name, m.temperature, m.target_temperature) 
                                       for m in self.game_state.greenhouse_modules],
                "crop_temp_ranges": [(c.name, c.optimal_temp_min, c.optimal_temp_max) 
                                    for c in self.game_state.crops]
            },
            timeline_events=self._get_key_timeline_events()
        )
    
    def _analyze_crop_failure(self) -> FailureAnalysis:
        """分析作物死亡失败"""
        errors = []
        
        # 分析每株作物的死因
        dead_crops = [c for c in self.game_state.crops if c.status == CropStatus.DEAD]
        
        # 检查水分问题
        low_water_crops = [c for c in dead_crops if c.current_water < 20]
        if low_water_crops:
            errors.append(f"【操作】{len(low_water_crops)} 株作物因缺水死亡")
        
        # 检查温度问题
        temp_issues = 0
        for crop in dead_crops:
            for module in self.game_state.greenhouse_modules:
                if any(c.id == crop.id for c in module.crops):
                    if not (crop.optimal_temp_min <= module.temperature <= crop.optimal_temp_max):
                        temp_issues += 1
                    break
        if temp_issues > 0:
            errors.append(f"【概念】{temp_issues} 株作物因温度不适死亡")
        
        # 策略问题
        if len(self.game_state.crops) < 3:
            errors.append("【策略】种植作物过少，容错率低")
        
        conceptual, operational, strategic = self._categorize_error(errors)
        
        return FailureAnalysis(
            failure_reason=FailureReason.CROP_ALL_DEAD,
            error_category=ErrorCategory.OPERATIONAL if operational else ErrorCategory.CONCEPTUAL,
            root_cause="所有作物死亡，无法完成种植目标",
            conceptual_errors=conceptual,
            operational_errors=operational,
            strategic_errors=strategic,
            recommendations=[
                "确保作物有充足的水分供应",
                "维持适宜的温度环境",
                "保证足够的光照时间",
                "多种植一些作物，提高容错率"
            ],
            learning_points=[
                "了解植物生长的必要条件",
                "学习光合作用的原理",
                "理解生态系统的稳定性"
            ],
            resource_analysis={
                "total_crops": len(self.game_state.crops),
                "dead_crops": len(dead_crops),
                "surviving_crops": len(self.game_state.crops) - len(dead_crops),
                "average_health": sum(c.health for c in self.game_state.crops) / max(1, len(self.game_state.crops))
            },
            timeline_events=self._get_key_timeline_events()
        )
    
    def _analyze_sandstorm_failure(self) -> FailureAnalysis:
        """分析沙尘暴失败"""
        errors = []
        
        if self.game_state.current_sandstorm:
            storm = self.game_state.current_sandstorm
            errors.append(f"【策略】沙尘暴（严重度{storm.severity}）期间防护措施不足")
        
        # 检查是否有备用能量
        total_energy = sum(b.current_charge for b in self.game_state.batteries)
        if total_energy < 100:
            errors.append("【策略】应急能量储备不足")
        
        conceptual, operational, strategic = self._categorize_error(errors)
        
        return FailureAnalysis(
            failure_reason=FailureReason.SANDSTORM_DAMAGE,
            error_category=ErrorCategory.STRATEGIC,
            root_cause="沙尘暴造成严重损害，系统无法恢复",
            conceptual_errors=conceptual,
            operational_errors=operational,
            strategic_errors=strategic,
            recommendations=[
                "建立应急能量储备",
                "沙尘暴期间关闭非必要设备",
                "提前做好防护措施",
                "关注天气预报，提前做好准备"
            ],
            learning_points=[
                "了解火星的环境特点",
                "学习风险管理和应急预案",
                "理解极端环境下的生存策略"
            ],
            resource_analysis={
                "sandstorm_severity": self.game_state.current_sandstorm.severity if self.game_state.current_sandstorm else 0,
                "emergency_energy": sum(b.current_charge for b in self.game_state.batteries),
                "damage_received": sum(100 - c.health for c in self.game_state.crops)
            },
            timeline_events=self._get_key_timeline_events()
        )
    
    def _analyze_unknown_failure(self) -> FailureAnalysis:
        """分析未知失败"""
        return FailureAnalysis(
            failure_reason=self.game_state.failure_reason or FailureReason.CROP_ALL_DEAD,
            error_category=ErrorCategory.UNKNOWN,
            root_cause="游戏失败，具体原因需要进一步分析",
            conceptual_errors=[],
            operational_errors=[],
            strategic_errors=[],
            recommendations=["请联系老师进行详细分析"],
            learning_points=["复盘整个游戏过程，找出问题所在"],
            resource_analysis={},
            timeline_events=self._get_key_timeline_events()
        )
    
    def _get_key_timeline_events(self) -> List[Dict[str, Any]]:
        """获取关键时间线事件"""
        events = []
        
        for round_log in self.engine.round_logs:
            round_num = round_log.get("round", 0)
            actions = round_log.get("actions", [])
            resource_changes = round_log.get("resource_changes", {})
            
            # 只记录有重要事件的回合
            if actions or round_num % 5 == 0:
                events.append({
                    "round": round_num,
                    "actions": actions,
                    "resources": resource_changes
                })
        
        return events


class FailureFeedbackGenerator:
    """失败反馈生成器"""
    
    def generate_student_feedback(self, analysis: FailureAnalysis) -> str:
        """生成给学生的反馈"""
        lines = []
        lines.append("=" * 60)
        lines.append("【游戏失败复盘报告】")
        lines.append("=" * 60)
        lines.append("")
        
        lines.append(f"失败原因: {analysis.failure_reason.value}")
        lines.append(f"根本问题: {analysis.root_cause}")
        lines.append("")
        
        if analysis.conceptual_errors:
            lines.append("【需要加强的概念理解】")
            for i, error in enumerate(analysis.conceptual_errors, 1):
                lines.append(f"  {i}. {error}")
            lines.append("")
        
        if analysis.operational_errors:
            lines.append("【需要改进的操作习惯】")
            for i, error in enumerate(analysis.operational_errors, 1):
                lines.append(f"  {i}. {error}")
            lines.append("")
        
        if analysis.strategic_errors:
            lines.append("【需要优化的策略规划】")
            for i, error in enumerate(analysis.strategic_errors, 1):
                lines.append(f"  {i}. {error}")
            lines.append("")
        
        lines.append("【改进建议】")
        for i, rec in enumerate(analysis.recommendations, 1):
            lines.append(f"  {i}. {rec}")
        lines.append("")
        
        lines.append("【学习要点】")
        for i, point in enumerate(analysis.learning_points, 1):
            lines.append(f"  {i}. {point}")
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_teacher_feedback(self, analysis: FailureAnalysis) -> str:
        """生成给老师的反馈"""
        lines = []
        lines.append("=" * 60)
        lines.append("【教师版 - 失败诊断报告】")
        lines.append("=" * 60)
        lines.append("")
        
        lines.append(f"失败类型: {analysis.failure_reason.value}")
        lines.append(f"错误分类: {analysis.error_category.value}")
        lines.append("")
        
        # 详细的错误统计
        total_errors = len(analysis.conceptual_errors) + len(analysis.operational_errors) + len(analysis.strategic_errors)
        lines.append(f"错误统计:")
        lines.append(f"  - 概念错误: {len(analysis.conceptual_errors)}")
        lines.append(f"  - 操作错误: {len(analysis.operational_errors)}")
        lines.append(f"  - 策略错误: {len(analysis.strategic_errors)}")
        lines.append("")
        
        # 教学建议
        lines.append("【教学干预建议】")
        if analysis.error_category == ErrorCategory.CONCEPTUAL:
            lines.append("  学生可能在基础概念上存在困难，建议:")
            lines.append("  - 复习相关科学原理")
            lines.append("  - 使用更直观的演示")
            lines.append("  - 安排概念讲解小课堂")
        elif analysis.error_category == ErrorCategory.OPERATIONAL:
            lines.append("  学生主要是操作层面的问题，建议:")
            lines.append("  - 提醒学生注意操作细节")
            lines.append("  - 建议制定操作检查表")
            lines.append("  - 加强熟练度训练")
        elif analysis.error_category == ErrorCategory.STRATEGIC:
            lines.append("  学生需要提升策略规划能力，建议:")
            lines.append("  - 引导学生做长远规划")
            lines.append("  - 讲解风险管理的概念")
            lines.append("  - 分析成功案例的策略")
        lines.append("")
        
        # 资源分析
        lines.append("【详细资源分析】")
        for key, value in analysis.resource_analysis.items():
            lines.append(f"  {key}: {value}")
        lines.append("")
        
        # 关键事件时间线
        lines.append("【关键事件时间线】")
        for event in analysis.timeline_events:
            round_num = event.get("round")
            actions = event.get("actions", [])
            if actions:
                lines.append(f"  第{round_num}回合: {'; '.join(actions[:2])}")
        lines.append("")
        
        return "\n".join(lines)
