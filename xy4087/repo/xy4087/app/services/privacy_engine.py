import pandas as pd
import numpy as np
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from app.config import settings


@dataclass
class AggregationResult:
    """聚合结果数据类"""
    group: Dict[str, Any]
    aggregations: Dict[str, Any]
    suppressed: bool = False
    noise_scale: Optional[float] = None
    true_value: Optional[Any] = None


class PrivacyEngine:
    """差分隐私引擎"""
    
    def __init__(self):
        self.default_epsilon = settings.DEFAULT_EPSILON
        self.suppression_threshold = settings.SUPPRESSION_THRESHOLD
    
    def laplace_mechanism(self, 
                          true_value: float, 
                          sensitivity: float, 
                          epsilon: float,
                          delta: float = None) -> Tuple[float, float]:
        """
        拉普拉斯机制 - 向真实值添加拉普拉斯噪声
        
        Args:
            true_value: 真实值
            sensitivity: 敏感度
            epsilon: 隐私预算
            delta: delta值（用于近似差分隐私，这里拉普拉斯是纯DP）
            
        Returns:
            (加噪后的值, 噪声尺度)
        """
        if epsilon <= 0:
            raise ValueError("Epsilon must be positive")
        
        # 拉普拉斯分布的尺度参数 = 敏感度 / epsilon
        scale = sensitivity / epsilon
        
        # 生成拉普拉斯噪声
        # 使用 numpy 的 laplace 函数，loc=0, scale=scale
        noise = np.random.laplace(loc=0.0, scale=scale)
        
        # 添加噪声
        noisy_value = true_value + noise
        
        return noisy_value, scale
    
    def count_sensitivity(self) -> float:
        """计数查询的敏感度 - 添加或删除一个记录最多改变计数1"""
        return 1.0
    
    def sum_sensitivity(self, lower_bound: float, upper_bound: float) -> float:
        """
        求和查询的敏感度 - 添加或删除一个记录最多改变求和的范围
        
        Args:
            lower_bound: 数值的下界
            upper_bound: 数值的上界
            
        Returns:
            敏感度
        """
        return max(abs(upper_bound), abs(lower_bound))
    
    def average_sensitivity(self, lower_bound: float, upper_bound: float, min_count: int = 1) -> float:
        """
        平均值查询的敏感度
        
        平均值 = 求和 / 计数
        敏感度计算较复杂，通常使用两种方法：
        1. 分别计算求和和计数，然后计算 noisy_sum / noisy_count
        2. 使用平滑敏感度
        
        这里我们使用方法1，返回求和的敏感度供调用者参考
        """
        return self.sum_sensitivity(lower_bound, upper_bound)
    
    def suppress_if_needed(self, 
                           count: int, 
                           threshold: int = None) -> bool:
        """
        检查是否需要抑制低样本量分组
        
        Args:
            count: 分组计数
            threshold: 抑制阈值
            
        Returns:
            是否需要抑制
        """
        if threshold is None:
            threshold = self.suppression_threshold
        
        return count < threshold
    
    def _compute_aggregation(self, 
                             group_df: pd.DataFrame, 
                             agg_type: str, 
                             metric: str = None,
                             epsilon: float = None,
                             bounds: Dict[str, float] = None) -> Dict[str, Any]:
        """
        计算单个聚合
        
        Args:
            group_df: 分组数据框
            agg_type: 聚合类型: 'count', 'sum', 'avg', 'min', 'max'
            metric: 指标字段名（对于count可以为None）
            epsilon: 隐私预算
            bounds: 数值边界 {'lower': float, 'upper': float}
            
        Returns:
            聚合结果字典
        """
        result = {}
        true_value = None
        sensitivity = None
        noisy_value = None
        noise_scale = None
        
        count = len(group_df)
        result['count'] = count
        
        if agg_type == 'count':
            # 计数聚合
            true_value = count
            sensitivity = self.count_sensitivity()
            
            if epsilon:
                noisy_value, noise_scale = self.laplace_mechanism(
                    true_value=true_value,
                    sensitivity=sensitivity,
                    epsilon=epsilon
                )
                # 确保计数不为负
                noisy_value = max(0, noisy_value)
                result['value'] = round(noisy_value)
                result['true_value'] = true_value
                result['noise_scale'] = noise_scale
            else:
                result['value'] = true_value
                result['true_value'] = true_value
        
        elif agg_type == 'sum':
            # 求和聚合
            if metric is None:
                raise ValueError("Sum aggregation requires a metric field")
            
            # 转换为数值
            numeric_series = pd.to_numeric(group_df[metric], errors='coerce').dropna()
            true_value = float(numeric_series.sum())
            
            # 计算敏感度
            if bounds and 'lower' in bounds and 'upper' in bounds:
                sensitivity = self.sum_sensitivity(bounds['lower'], bounds['upper'])
            else:
                # 启发式：使用数据的范围
                if len(numeric_series) > 0:
                    data_min = float(numeric_series.min())
                    data_max = float(numeric_series.max())
                    sensitivity = self.sum_sensitivity(data_min, data_max)
                else:
                    sensitivity = 1.0  # 默认敏感度
            
            if epsilon:
                noisy_value, noise_scale = self.laplace_mechanism(
                    true_value=true_value,
                    sensitivity=sensitivity,
                    epsilon=epsilon
                )
                result['value'] = noisy_value
                result['true_value'] = true_value
                result['noise_scale'] = noise_scale
                result['sensitivity'] = sensitivity
            else:
                result['value'] = true_value
                result['true_value'] = true_value
        
        elif agg_type == 'avg':
            # 平均值聚合
            if metric is None:
                raise ValueError("Average aggregation requires a metric field")
            
            # 转换为数值
            numeric_series = pd.to_numeric(group_df[metric], errors='coerce').dropna()
            true_count = len(numeric_series)
            true_sum = float(numeric_series.sum())
            true_value = true_sum / true_count if true_count > 0 else 0.0
            
            if epsilon and true_count > 0:
                # 方法：分别计算噪声求和和噪声计数，然后求比值
                # 分配epsilon：一半给求和，一半给计数
                epsilon_sum = epsilon * 0.7
                epsilon_count = epsilon * 0.3
                
                # 计算敏感度
                if bounds and 'lower' in bounds and 'upper' in bounds:
                    sensitivity_sum = self.sum_sensitivity(bounds['lower'], bounds['upper'])
                else:
                    if len(numeric_series) > 0:
                        data_min = float(numeric_series.min())
                        data_max = float(numeric_series.max())
                        sensitivity_sum = self.sum_sensitivity(data_min, data_max)
                    else:
                        sensitivity_sum = 1.0
                
                # 添加噪声
                noisy_sum, scale_sum = self.laplace_mechanism(true_sum, sensitivity_sum, epsilon_sum)
                noisy_count, scale_count = self.laplace_mechanism(true_count, self.count_sensitivity(), epsilon_count)
                
                # 确保计数至少为1
                noisy_count = max(1, noisy_count)
                noisy_value = noisy_sum / noisy_count
                
                result['value'] = noisy_value
                result['true_value'] = true_value
                result['noise_scale_sum'] = scale_sum
                result['noise_scale_count'] = scale_count
                result['noisy_sum'] = noisy_sum
                result['noisy_count'] = noisy_count
            else:
                result['value'] = true_value
                result['true_value'] = true_value
        
        else:
            raise ValueError(f"Unsupported aggregation type: {agg_type}")
        
        return result
    
    def execute_query(self,
                      df: pd.DataFrame,
                      group_by: List[str],
                      aggregations: List[Dict[str, Any]],
                      epsilon: float,
                      suppression_threshold: int = None,
                      filters: Dict[str, Any] = None) -> List[AggregationResult]:
        """
        执行差分隐私查询
        
        Args:
            df: 数据框
            group_by: 分组字段列表
            aggregations: 聚合操作列表，每个操作包含:
                - type: 'count', 'sum', 'avg'
                - metric: 指标字段名（对于count可选）
                - name: 结果名称（可选）
            epsilon: 本次查询的隐私预算
            suppression_threshold: 样本抑制阈值
            filters: 筛选条件
            
        Returns:
            聚合结果列表
        """
        # 应用筛选条件
        if filters:
            df = self._apply_filters(df, filters)
        
        # 如果没有分组字段，创建一个虚拟分组
        if not group_by:
            df['_dummy_group'] = 1
            group_by = ['_dummy_group']
        
        # 检查分组字段是否存在
        missing_cols = set(group_by) - set(df.columns)
        if missing_cols:
            raise ValueError(f"Group by columns not found: {', '.join(missing_cols)}")
        
        # 计算总epsilon分配
        # 简单策略：平均分配给每个聚合
        num_aggs = len(aggregations)
        epsilon_per_agg = epsilon / num_aggs if num_agg > 0 else epsilon
        
        # 获取所有分组
        results = []
        suppressed_count = 0
        
        # 按分组字段分组
        grouped = df.groupby(group_by, dropna=False)
        
        for group_key, group_df in grouped:
            # 构造分组字典
            if len(group_by) == 1:
                group_dict = {group_by[0]: self._serialize_value(group_key)}
            else:
                group_dict = {
                    col: self._serialize_value(key)
                    for col, key in zip(group_by, group_key)
                }
            
            # 移除以_开头的内部字段
            group_dict = {k: v for k, v in group_dict.items() if not k.startswith('_')}
            
            # 检查分组大小
            group_count = len(group_df)
            need_suppression = self.suppress_if_needed(group_count, suppression_threshold)
            
            agg_results = {}
            noise_scales = []
            
            if need_suppression:
                # 抑制该分组
                suppressed_count += 1
                for agg in aggregations:
                    agg_name = agg.get('name', f"{agg['type']}_{agg.get('metric', 'count')}")
                    agg_results[agg_name] = None
            else:
                # 执行每个聚合
                for agg in aggregations:
                    agg_type = agg['type']
                    metric = agg.get('metric')
                    agg_name = agg.get('name', f"{agg_type}_{metric or 'count'}")
                    bounds = agg.get('bounds')
                    
                    try:
                        agg_result = self._compute_aggregation(
                            group_df=group_df,
                            agg_type=agg_type,
                            metric=metric,
                            epsilon=epsilon_per_agg,
                            bounds=bounds
                        )
                        
                        agg_results[agg_name] = agg_result['value']
                        if 'noise_scale' in agg_result:
                            noise_scales.append(agg_result['noise_scale'])
                        
                    except Exception as e:
                        agg_results[agg_name] = None
                        print(f"Error in aggregation {agg_name}: {e}")
            
            # 计算平均噪声尺度（用于报告）
            avg_noise_scale = np.mean(noise_scales) if noise_scales else None
            
            # 创建结果对象
            result = AggregationResult(
                group=group_dict,
                aggregations=agg_results,
                suppressed=need_suppression,
                noise_scale=avg_noise_scale
            )
            results.append(result)
        
        return results
    
    def _apply_filters(self, df: pd.DataFrame, filters: Dict[str, Any]) -> pd.DataFrame:
        """
        应用筛选条件
        
        支持的筛选操作：
        - eq: 等于
        - ne: 不等于
        - gt: 大于
        - gte: 大于等于
        - lt: 小于
        - lte: 小于等于
        - in: 在列表中
        - not_in: 不在列表中
        - contains: 包含字符串
        """
        mask = pd.Series([True] * len(df), index=df.index)
        
        for field, conditions in filters.items():
            if field not in df.columns:
                continue
            
            if isinstance(conditions, dict):
                # 多条件
                for op, value in conditions.items():
                    if op == 'eq':
                        mask = mask & (df[field] == value)
                    elif op == 'ne':
                        mask = mask & (df[field] != value)
                    elif op == 'gt':
                        mask = mask & (df[field] > value)
                    elif op == 'gte':
                        mask = mask & (df[field] >= value)
                    elif op == 'lt':
                        mask = mask & (df[field] < value)
                    elif op == 'lte':
                        mask = mask & (df[field] <= value)
                    elif op == 'in':
                        mask = mask & df[field].isin(value)
                    elif op == 'not_in':
                        mask = mask & ~df[field].isin(value)
                    elif op == 'contains':
                        mask = mask & df[field].astype(str).str.contains(str(value), na=False)
            else:
                # 简单等于
                mask = mask & (df[field] == conditions)
        
        return df[mask]
    
    def _serialize_value(self, value: Any) -> Any:
        """序列化值为JSON兼容格式"""
        if isinstance(value, (np.integer, np.int64, np.int32)):
            return int(value)
        elif isinstance(value, (np.floating, np.float64, np.float32)):
            return float(value)
        elif isinstance(value, np.ndarray):
            return value.tolist()
        elif pd.isna(value):
            return None
        return value
    
    def estimate_privacy_cost(self,
                               num_aggregations: int,
                               epsilon_per_agg: float = None,
                               total_epsilon: float = None) -> float:
        """
        估算查询的隐私成本
        
        简单组合定理：多个查询的总epsilon是各查询epsilon之和
        
        Args:
            num_aggregations: 聚合操作数量
            epsilon_per_agg: 每个聚合的epsilon
            total_epsilon: 总epsilon（如果提供，直接返回）
            
        Returns:
            总隐私成本
        """
        if total_epsilon is not None:
            return total_epsilon
        
        if epsilon_per_agg is None:
            epsilon_per_agg = 0.1
        
        return num_aggregations * epsilon_per_agg


privacy_engine = PrivacyEngine()
