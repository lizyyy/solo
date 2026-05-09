"""一致性分析和容量衰减计算模块。"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from sklearn.linear_model import LinearRegression
from .config import AnalysisConfig
from .logger import AnalysisLogger, ErrorType


@dataclass
class BatteryMetrics:
    """单个电池的性能指标。"""
    battery_id: str
    initial_capacity: float
    max_cycle: int
    capacity_retention_at_target: Dict[int, float]
    capacity_fade_rate: float
    cycle_life_estimate: Optional[int]
    initial_cycle_to_80: Optional[int]


@dataclass
class ConsistencyMetrics:
    """批次一致性指标。"""
    cv_initial_capacity: float
    std_initial_capacity: float
    mean_initial_capacity: float
    cv_fade_rate: float
    std_fade_rate: float
    mean_fade_rate: float
    cv_cv_score: float
    consistency_level: str


@dataclass
class AnalysisResult:
    """完整分析结果。"""
    battery_metrics: Dict[str, BatteryMetrics]
    consistency_metrics: ConsistencyMetrics
    capacity_retention_summary: pd.DataFrame
    batch_summary: Dict[str, Any]


class ConsistencyAnalyzer:
    """一致性分析器。"""
    
    def __init__(self, config: AnalysisConfig, logger: Optional[AnalysisLogger] = None):
        self.config = config
        self.logger = logger or AnalysisLogger(
            log_to_file=config.log_to_file,
            log_file=config.log_file,
            log_level=config.log_level
        )
    
    def analyze(self, df: pd.DataFrame) -> AnalysisResult:
        """
        执行完整的一致性分析。
        """
        if df is None or len(df) == 0:
            self.logger.error("分析", "输入数据为空")
            return AnalysisResult({}, None, pd.DataFrame(), {})
        
        df = df.copy()
        self.logger.info("分析", "开始一致性分析")
        
        battery_metrics = self._calculate_battery_metrics(df)
        
        if not battery_metrics:
            self.logger.error("分析", "没有有效的电池数据可分析")
            return AnalysisResult({}, None, pd.DataFrame(), {})
        
        consistency_metrics = self._calculate_consistency_metrics(battery_metrics)
        
        capacity_retention_df = self._generate_retention_summary(df)
        
        batch_summary = self._generate_batch_summary(df, battery_metrics, consistency_metrics)
        
        self.logger.info(
            "分析",
            f"分析完成: 分析了 {len(battery_metrics)} 个电池, "
            f"一致性水平: {consistency_metrics.consistency_level}"
        )
        
        return AnalysisResult(
            battery_metrics=battery_metrics,
            consistency_metrics=consistency_metrics,
            capacity_retention_summary=capacity_retention_df,
            batch_summary=batch_summary
        )
    
    def _calculate_battery_metrics(self, df: pd.DataFrame) -> Dict[str, BatteryMetrics]:
        """计算每个电池的性能指标。"""
        metrics = {}
        initial_cycle = self.config.initial_cycle
        target_cycles = self.config.target_cycles
        target_retention = self.config.target_capacity_retention
        
        for battery_id, group in df.groupby('battery_id'):
            try:
                group = group.sort_values('cycle').reset_index(drop=True)
                
                if len(group) < 5:
                    self.logger.log_sample_failure(
                        str(battery_id),
                        ErrorType.CALCULATION_ERROR,
                        f"数据点不足: {len(group)} < 5"
                    )
                    continue
                
                initial_capacity = self._get_capacity_at_cycle(group, initial_cycle)
                if initial_capacity is None or initial_capacity <= 0:
                    self.logger.log_sample_failure(
                        str(battery_id),
                        ErrorType.INVALID_CAPACITY,
                        f"无法获取初始容量"
                    )
                    continue
                
                max_cycle = int(group['cycle'].max())
                
                capacity_retention = {}
                for target in target_cycles:
                    cap_at_target = self._get_capacity_at_cycle(group, target)
                    if cap_at_target is not None and initial_capacity > 0:
                        retention = (cap_at_target / initial_capacity) * 100
                        capacity_retention[target] = retention
                    else:
                        capacity_retention[target] = np.nan
                
                fade_rate = self._calculate_fade_rate(group, initial_capacity)
                
                cycle_to_80 = self._estimate_cycle_to_retention(
                    group,
                    initial_capacity,
                    target_retention
                )
                
                cycle_life = self._estimate_cycle_life(
                    group,
                    initial_capacity,
                    target_retention
                )
                
                metrics[str(battery_id)] = BatteryMetrics(
                    battery_id=str(battery_id),
                    initial_capacity=initial_capacity,
                    max_cycle=max_cycle,
                    capacity_retention_at_target=capacity_retention,
                    capacity_fade_rate=fade_rate,
                    cycle_life_estimate=cycle_life,
                    initial_cycle_to_80=cycle_to_80
                )
                
                self.logger.info(
                    "分析",
                    f"电池 {battery_id}: 初始容量={initial_capacity:.1f} mAh, "
                    f"衰减率={fade_rate:.4f}%/循环",
                    {"max_cycle": max_cycle}
                )
            
            except Exception as e:
                self.logger.log_sample_failure(
                    str(battery_id),
                    ErrorType.CALCULATION_ERROR,
                    f"计算指标失败: {str(e)}"
                )
                continue
        
        return metrics
    
    def _get_capacity_at_cycle(self, group: pd.DataFrame, cycle: int) -> Optional[float]:
        """获取指定循环次数的容量值。"""
        if 'cycle' not in group.columns or 'capacity' not in group.columns:
            return None
        
        exact_match = group[group['cycle'] == cycle]
        if len(exact_match) > 0:
            return exact_match['capacity'].iloc[0]
        
        cycle_values = group['cycle'].values
        capacity_values = group['capacity'].values
        
        if len(cycle_values) < 2:
            return None
        
        if cycle < cycle_values.min() or cycle > cycle_values.max():
            return None
        
        try:
            return np.interp(cycle, cycle_values, capacity_values)
        except:
            return None
    
    def _calculate_fade_rate(self, group: pd.DataFrame, initial_capacity: float) -> float:
        """计算容量衰减率（%/循环）。"""
        if len(group) < 10 or initial_capacity <= 0:
            return 0.0
        
        group = group.dropna(subset=['cycle', 'capacity'])
        if len(group) < 5:
            return 0.0
        
        x = group['cycle'].values.reshape(-1, 1)
        y = (group['capacity'].values / initial_capacity) * 100
        
        if len(x) < 5:
            return 0.0
        
        try:
            model = LinearRegression()
            model.fit(x, y)
            slope = model.coef_[0]
            return abs(slope)
        except:
            return 0.0
    
    def _estimate_cycle_to_retention(self, group: pd.DataFrame, 
                                     initial_capacity: float,
                                     target_retention: float) -> Optional[int]:
        """估算达到目标容量保持率的循环次数。"""
        if initial_capacity <= 0:
            return None
        
        target_capacity = initial_capacity * (target_retention / 100)
        
        group = group.sort_values('cycle')
        cycles = group['cycle'].values
        capacities = group['capacity'].values
        
        for i in range(1, len(capacities)):
            if capacities[i] <= target_capacity:
                if capacities[i-1] > target_capacity:
                    ratio = (target_capacity - capacities[i-1]) / (capacities[i] - capacities[i-1])
                    estimated_cycle = cycles[i-1] + ratio * (cycles[i] - cycles[i-1])
                    return int(estimated_cycle)
        
        x = cycles.reshape(-1, 1)
        y = capacities
        
        try:
            model = LinearRegression()
            model.fit(x, y)
            
            if model.coef_[0] >= 0:
                return None
            
            estimated_cycle = (target_capacity - model.intercept_) / model.coef_[0]
            if estimated_cycle > 0:
                return int(estimated_cycle)
        except:
            pass
        
        return None
    
    def _estimate_cycle_life(self, group: pd.DataFrame, 
                       initial_capacity: float,
                       target_retention: float) -> Optional[int]:
        """估算循环寿命（达到目标保持率的循环次数）。"""
        return self._estimate_cycle_to_retention(group, initial_capacity, target_retention)
    
    def _calculate_consistency_metrics(self, 
                                     battery_metrics: Dict[str, BatteryMetrics]
                                    ) -> ConsistencyMetrics:
        """计算批次一致性指标。"""
        initial_capacities = [m.initial_capacity for m in battery_metrics.values()]
        fade_rates = [m.capacity_fade_rate for m in battery_metrics.values()]
        
        mean_initial = np.mean(initial_capacities)
        std_initial = np.std(initial_capacities, ddof=1) if len(initial_capacities) > 1 else 0
        cv_initial = (std_initial / mean_initial * 100) if mean_initial > 0 else 0
        
        mean_fade = np.mean(fade_rates)
        std_fade = np.std(fade_rates, ddof=1) if len(fade_rates) > 1 else 0
        cv_fade = (std_fade / mean_fade * 100) if mean_fade > 0 else 0
        
        cv_score = (cv_initial + cv_fade) / 2
        
        if cv_score < 2:
            level = "优秀"
        elif cv_score < 5:
            level = "良好"
        elif cv_score < 10:
            level = "一般"
        else:
            level = "较差"
        
        return ConsistencyMetrics(
            cv_initial_capacity=cv_initial,
            std_initial_capacity=std_initial,
            mean_initial_capacity=mean_initial,
            cv_fade_rate=cv_fade,
            std_fade_rate=std_fade,
            mean_fade_rate=mean_fade,
            cv_cv_score=cv_score,
            consistency_level=level
        )
    
    def _generate_retention_summary(self, df: pd.DataFrame) -> pd.DataFrame:
        """生成容量保持率汇总表。"""
        if 'battery_id' not in df.columns:
            return pd.DataFrame()
        
        summary_data = []
        
        for battery_id, group in df.groupby('battery_id'):
            group = group.sort_values('cycle')
            
            initial_cycle = self.config.initial_cycle
            initial_cap = self._get_capacity_at_cycle(group, initial_cycle)
            
            if initial_cap is None or initial_cap <= 0:
                continue
            
            row = {'电池编号': str(battery_id)}
            
            for target in sorted(self.config.target_cycles):
                cap = self._get_capacity_at_cycle(group, target)
                if cap is not None:
                    retention = (cap / initial_cap) * 100
                    row[f'{target}次保持率(%)'] = round(retention, 2)
                else:
                    row[f'{target}次保持率(%)'] = np.nan
            
            max_cycle = int(group['cycle'].max())
            final_cap = group['capacity'].iloc[-1]
            final_retention = (final_cap / initial_cap) * 100
            
            row['最大循环次数'] = max_cycle
            row['最终保持率(%)'] = round(final_retention, 2)
            
            summary_data.append(row)
        
        return pd.DataFrame(summary_data)
    
    def _generate_batch_summary(self,
                              df: pd.DataFrame,
                              battery_metrics: Dict[str, BatteryMetrics],
                              consistency_metrics: ConsistencyMetrics
                              ) -> Dict[str, Any]:
        """生成批次汇总。"""
        if 'batch' in df.columns:
            batch_name = df['batch'].iloc[0] if len(df) > 0 else "未知批次"
        else:
            batch_name = "未知批次"
        
        initial_capacities = [m.initial_capacity for m in battery_metrics.values()]
        fade_rates = [m.capacity_fade_rate for m in battery_metrics.values()]
        cycle_lives = [m.cycle_life_estimate for m in battery_metrics.values() if m.cycle_life_estimate is not None]
        
        return {
            "批次名称": batch_name,
            "电池数量": len(battery_metrics),
            "初始容量统计": {
                "均值(mAh)": round(np.mean(initial_capacities), 2) if initial_capacities else 0,
                "标准差(mAh)": round(np.std(initial_capacities, ddof=1), 2) if len(initial_capacities) > 1 else 0,
                "最小值(mAh)": round(np.min(initial_capacities), 2) if initial_capacities else 0,
                "最大值(mAh)": round(np.max(initial_capacities), 2) if initial_capacities else 0,
                "变异系数(%)": round(consistency_metrics.cv_initial_capacity, 2)
            },
            "衰减率统计": {
                "均值(%/循环)": round(np.mean(fade_rates), 4) if fade_rates else 0,
                "标准差(%/循环)": round(np.std(fade_rates, ddof=1), 4) if len(fade_rates) > 1 else 0,
                "变异系数(%)": round(consistency_metrics.cv_fade_rate, 2)
            },
            "循环寿命预估": {
                "均值(次)": round(np.mean(cycle_lives)) if cycle_lives else None,
                "标准差(次)": round(np.std(cycle_lives, ddof=1)) if len(cycle_lives) > 1 else 0,
                "最小值(次)": min(cycle_lives) if cycle_lives else None,
                "最大值(次)": max(cycle_lives) if cycle_lives else None
            } if cycle_lives else {},
            "一致性评估": {
                "综合CV值(%)": round(consistency_metrics.cv_cv_score, 2),
                "一致性等级": consistency_metrics.consistency_level
            }
        }
    
    def get_battery_metrics_df(self, battery_metrics: Dict[str, BatteryMetrics]) -> pd.DataFrame:
        """将电池指标转换为DataFrame。"""
        data = []
        for bid, metrics in battery_metrics.items():
            row = {
                '电池编号': bid,
                '初始容量(mAh)': metrics.initial_capacity,
                '最大循环次数': metrics.max_cycle,
                '衰减率(%/循环)': metrics.capacity_fade_rate,
                '预估循环寿命(次)': metrics.cycle_life_estimate,
                '80%保持率循环(次)': metrics.initial_cycle_to_80,
            }
            
            for cycle, retention in metrics.capacity_retention_at_target.items():
                row[f'{cycle}次保持率(%)'] = retention
            
            data.append(row)
        
        return pd.DataFrame(data)
