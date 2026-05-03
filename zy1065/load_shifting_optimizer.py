from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import copy

from pricing_config import PricingConfig, TimeSlot
from task_manager import FlexibleTask, TaskManager


@dataclass
class OptimizationResult:
    """优化结果数据类"""
    task_id: str
    task_name: str
    
    # 原始安排
    original_start_hour: Optional[int]
    original_cost: float
    original_slot_name: Optional[str]
    
    # 优化后的安排
    optimized_start_hour: int
    optimized_cost: float
    optimized_slot_name: Optional[str]
    
    # 节省
    savings: float
    savings_percentage: float
    
    # 约束检查
    is_within_window: bool
    delay_hours: float
    is_delay_acceptable: bool
    
    # 详细信息
    available_hours: List[int] = field(default_factory=list)
    hourly_prices: Dict[int, float] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'task_id': self.task_id,
            'task_name': self.task_name,
            'original_start_hour': self.original_start_hour,
            'original_cost': round(self.original_cost, 2),
            'original_slot_name': self.original_slot_name,
            'optimized_start_hour': self.optimized_start_hour,
            'optimized_cost': round(self.optimized_cost, 2),
            'optimized_slot_name': self.optimized_slot_name,
            'savings': round(self.savings, 2),
            'savings_percentage': round(self.savings_percentage, 1),
            'is_within_window': self.is_within_window,
            'delay_hours': round(self.delay_hours, 1),
            'is_delay_acceptable': self.is_delay_acceptable,
            'available_hours_count': len(self.available_hours)
        }


@dataclass
class OptimizationSummary:
    """优化汇总结果"""
    total_tasks: int
    optimized_tasks: int
    total_original_cost: float
    total_optimized_cost: float
    total_savings: float
    total_savings_percentage: float
    
    # 按时段统计
    tasks_by_slot: Dict[str, int] = field(default_factory=dict)
    savings_by_slot: Dict[str, float] = field(default_factory=dict)
    
    # 问题任务
    tasks_with_issues: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'total_tasks': self.total_tasks,
            'optimized_tasks': self.optimized_tasks,
            'total_original_cost': round(self.total_original_cost, 2),
            'total_optimized_cost': round(self.total_optimized_cost, 2),
            'total_savings': round(self.total_savings, 2),
            'total_savings_percentage': round(self.total_savings_percentage, 1),
            'tasks_by_slot': self.tasks_by_slot,
            'savings_by_slot': {k: round(v, 2) for k, v in self.savings_by_slot.items()},
            'tasks_with_issues_count': len(self.tasks_with_issues)
        }


class LoadShiftingOptimizer:
    """
    错峰优化算法模块
    
    核心功能：
    1. 根据电价配置找到最便宜的时段
    2. 考虑任务的时间窗口约束
    3. 计算原始成本和优化后的成本
    4. 检查约束是否满足
    """
    
    def __init__(self, pricing_config: PricingConfig = None):
        self.pricing_config = pricing_config or PricingConfig()
        self._hourly_prices: Dict[int, float] = {}
        self._update_hourly_prices()
    
    def set_pricing_config(self, pricing_config: PricingConfig):
        """设置电价配置"""
        self.pricing_config = pricing_config
        self._update_hourly_prices()
    
    def _update_hourly_prices(self):
        """更新每小时的电价映射"""
        self._hourly_prices = {}
        for hour in range(24):
            price, _ = self.pricing_config.get_price_for_hour(hour)
            self._hourly_prices[hour] = price or 0.0
    
    def get_hourly_price(self, hour: int) -> float:
        """获取指定小时的电价"""
        return self._hourly_prices.get(hour, 0.0)
    
    def get_slot_for_hour(self, hour: int) -> Optional[str]:
        """获取指定小时所属的时段名称"""
        _, slot_name = self.pricing_config.get_price_for_hour(hour)
        return slot_name
    
    def calculate_task_cost(self, task: FlexibleTask, start_hour: int) -> Tuple[float, List[int]]:
        """
        计算任务在指定开始时间的成本
        
        Args:
            task: 任务对象
            start_hour: 开始小时
            
        Returns:
            (总成本, 涉及的小时列表)
        """
        involved_hours = []
        total_cost = 0.0
        
        # 计算每小时的用电量（平均分配）
        hourly_energy = task.energy_kwh / max(task.duration_hours, 1)
        
        for i in range(int(task.duration_hours)):
            hour = (start_hour + i) % 24
            involved_hours.append(hour)
            price = self.get_hourly_price(hour)
            total_cost += hourly_energy * price
        
        return total_cost, involved_hours
    
    def find_cheapest_hour(self, available_hours: List[int], 
                           duration_hours: float = 1.0) -> Tuple[int, float, List[int]]:
        """
        在可用小时中找到最便宜的开始时间
        
        Args:
            available_hours: 可用小时列表
            duration_hours: 任务持续时间
            
        Returns:
            (最优开始小时, 最低成本, 涉及的小时列表)
        """
        if not available_hours:
            return 0, 0.0, []
        
        min_cost = float('inf')
        best_start_hour = available_hours[0]
        best_involved_hours = []
        
        for start_hour in available_hours:
            # 检查从 start_hour 开始的连续 duration_hours 是否都在可用小时中
            can_fit = True
            check_hours = []
            for i in range(int(duration_hours)):
                hour = (start_hour + i) % 24
                check_hours.append(hour)
                if hour not in available_hours:
                    can_fit = False
                    break
            
            if not can_fit:
                continue
            
            # 计算成本
            cost, involved_hours = self._calculate_range_cost(start_hour, duration_hours)
            
            if cost < min_cost:
                min_cost = cost
                best_start_hour = start_hour
                best_involved_hours = involved_hours
        
        return best_start_hour, min_cost, best_involved_hours
    
    def _calculate_range_cost(self, start_hour: int, duration_hours: float) -> Tuple[float, List[int]]:
        """计算连续时段的成本"""
        involved_hours = []
        total_cost = 0.0
        
        for i in range(int(duration_hours)):
            hour = (start_hour + i) % 24
            involved_hours.append(hour)
            total_cost += self.get_hourly_price(hour)
        
        # 按比例计算（假设用电量均匀分布）
        cost_per_hour = total_cost / max(duration_hours, 1)
        
        return total_cost, involved_hours
    
    def calculate_delay(self, original_hour: Optional[int], 
                        optimized_hour: int) -> float:
        """
        计算延迟时间（考虑跨天情况）
        
        Args:
            original_hour: 原始小时（可以是None，表示无偏好）
            optimized_hour: 优化后的小时
            
        Returns:
            延迟小时数（总是非负）
        """
        if original_hour is None:
            return 0.0
        
        # 计算最小的时间差（考虑顺时针和逆时针）
        diff_clockwise = (optimized_hour - original_hour) % 24
        diff_counter = (original_hour - optimized_hour) % 24
        
        return min(diff_clockwise, diff_counter)
    
    def optimize_task(self, task: FlexibleTask) -> OptimizationResult:
        """
        优化单个任务的安排
        
        Args:
            task: 任务对象
            
        Returns:
            优化结果
        """
        # 获取可用小时
        available_hours = task.get_available_hours()
        
        # 如果没有可用小时，使用默认
        if not available_hours:
            available_hours = list(range(24))
        
        # 确定原始开始时间
        original_start_hour = task.preferred_start_hour
        
        # 如果没有偏好时间，选择第一个可用小时作为"原始"时间
        if original_start_hour is None:
            if available_hours:
                original_start_hour = available_hours[0]
            else:
                original_start_hour = 0
        
        # 计算原始成本
        original_cost, _ = self.calculate_task_cost(task, original_start_hour)
        original_slot_name = self.get_slot_for_hour(original_start_hour)
        
        # 找到最优开始时间
        optimized_start_hour, optimized_cost, _ = self.find_cheapest_hour(
            available_hours, task.duration_hours
        )
        optimized_slot_name = self.get_slot_for_hour(optimized_start_hour)
        
        # 计算节省
        savings = original_cost - optimized_cost
        savings_percentage = (savings / original_cost * 100) if original_cost > 0 else 0.0
        
        # 检查约束
        delay_hours = self.calculate_delay(original_start_hour, optimized_start_hour)
        is_within_window = optimized_start_hour in available_hours
        is_delay_acceptable = delay_hours <= task.max_delay_hours
        
        # 构建每小时电价信息
        hourly_prices = {h: self.get_hourly_price(h) for h in available_hours}
        
        return OptimizationResult(
            task_id=task.id,
            task_name=task.name,
            original_start_hour=original_start_hour,
            original_cost=original_cost,
            original_slot_name=original_slot_name,
            optimized_start_hour=optimized_start_hour,
            optimized_cost=optimized_cost,
            optimized_slot_name=optimized_slot_name,
            savings=savings,
            savings_percentage=savings_percentage,
            is_within_window=is_within_window,
            delay_hours=delay_hours,
            is_delay_acceptable=is_delay_acceptable,
            available_hours=available_hours,
            hourly_prices=hourly_prices
        )
    
    def optimize_all_tasks(self, task_manager: TaskManager,
                           update_tasks: bool = True) -> Tuple[List[OptimizationResult], OptimizationSummary]:
        """
        优化所有启用的任务
        
        Args:
            task_manager: 任务管理器
            update_tasks: 是否更新任务对象中的优化结果
            
        Returns:
            (优化结果列表, 汇总结果)
        """
        enabled_tasks = task_manager.get_enabled_tasks()
        
        if not enabled_tasks:
            return [], self._create_empty_summary()
        
        results = []
        total_original_cost = 0.0
        total_optimized_cost = 0.0
        
        tasks_by_slot: Dict[str, int] = {}
        savings_by_slot: Dict[str, float] = {}
        tasks_with_issues = []
        
        for task in enabled_tasks:
            result = self.optimize_task(task)
            results.append(result)
            
            # 累加成本
            total_original_cost += result.original_cost
            total_optimized_cost += result.optimized_cost
            
            # 按时段统计
            slot_name = result.optimized_slot_name or '未分类'
            tasks_by_slot[slot_name] = tasks_by_slot.get(slot_name, 0) + 1
            savings_by_slot[slot_name] = savings_by_slot.get(slot_name, 0) + result.savings
            
            # 检查问题
            if not result.is_within_window or not result.is_delay_acceptable:
                tasks_with_issues.append({
                    'task_id': result.task_id,
                    'task_name': result.task_name,
                    'issue': '超出时间窗口' if not result.is_within_window else '延迟时间过长',
                    'delay_hours': result.delay_hours,
                    'max_allowed': task.max_delay_hours
                })
            
            # 更新任务对象
            if update_tasks:
                task.optimized_start_hour = result.optimized_start_hour
                task.optimized_cost = result.optimized_cost
                task.original_cost = result.original_cost
                task.savings = result.savings
        
        # 计算汇总
        total_savings = total_original_cost - total_optimized_cost
        total_savings_percentage = (total_savings / total_original_cost * 100) if total_original_cost > 0 else 0.0
        
        summary = OptimizationSummary(
            total_tasks=len(enabled_tasks),
            optimized_tasks=len(results),
            total_original_cost=total_original_cost,
            total_optimized_cost=total_optimized_cost,
            total_savings=total_savings,
            total_savings_percentage=total_savings_percentage,
            tasks_by_slot=tasks_by_slot,
            savings_by_slot=savings_by_slot,
            tasks_with_issues=tasks_with_issues
        )
        
        return results, summary
    
    def _create_empty_summary(self) -> OptimizationSummary:
        """创建空的汇总结果"""
        return OptimizationSummary(
            total_tasks=0,
            optimized_tasks=0,
            total_original_cost=0.0,
            total_optimized_cost=0.0,
            total_savings=0.0,
            total_savings_percentage=0.0
        )
    
    def generate_recommendation(self, result: OptimizationResult) -> str:
        """
        为单个优化结果生成推荐文字
        
        Args:
            result: 优化结果
            
        Returns:
            推荐文字
        """
        lines = []
        
        # 基本信息
        lines.append(f"**任务: {result.task_name}**")
        
        # 原始安排
        if result.original_start_hour is not None:
            original_time = f"{result.original_start_hour}:00"
            lines.append(f"- 原始安排: {original_time} ({result.original_slot_name or '未分类'}时段)")
            lines.append(f"- 原始成本: ¥{result.original_cost:.2f}")
        
        # 优化安排
        optimized_time = f"{result.optimized_start_hour}:00"
        lines.append(f"- 推荐安排: {optimized_time} ({result.optimized_slot_name or '未分类'}时段)")
        lines.append(f"- 优化成本: ¥{result.optimized_cost:.2f}")
        
        # 节省
        if result.savings > 0:
            lines.append(f"- ✅ 预计节省: ¥{result.savings:.2f} ({result.savings_percentage:.1f}%)")
        elif result.savings < 0:
            lines.append(f"- ⚠️ 成本增加: ¥{-result.savings:.2f}")
        else:
            lines.append(f"- 成本不变")
        
        # 约束检查
        if not result.is_delay_acceptable:
            lines.append(
                f"- ⚠️ 警告: 延迟时间({result.delay_hours:.1f}小时) "
                f"超过最大允许延迟"
            )
        
        return "\n".join(lines)
    
    def get_price_comparison_chart_data(self) -> Dict:
        """
        获取电价对比图表数据
        
        Returns:
            包含小时、电价、时段信息的字典
        """
        hours = list(range(24))
        prices = [self.get_hourly_price(h) for h in hours]
        slots = [self.get_slot_for_hour(h) or '未分类' for h in hours]
        
        # 按时段分组
        slot_groups = {}
        for h, p, s in zip(hours, prices, slots):
            if s not in slot_groups:
                slot_groups[s] = {'hours': [], 'prices': []}
            slot_groups[s]['hours'].append(h)
            slot_groups[s]['prices'].append(p)
        
        return {
            'hours': hours,
            'prices': prices,
            'slots': slots,
            'slot_groups': slot_groups
        }
