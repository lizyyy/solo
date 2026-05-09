import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import Counter

from config import config
from logger import get_logger
from data_loader import DataLoader


@dataclass
class AttributionResult:
    category: str
    description: str
    confidence: float
    affected_count: int
    related_indices: List[int]
    contribution: float


class AnomalyAttribution:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader
        self.logger = get_logger()
        self.attributions: List[AttributionResult] = []
    
    def analyze_anomalies(self, df: pd.DataFrame) -> List[AttributionResult]:
        self.logger.log_info("开始异常归因分析")
        
        if '_is_anomaly' not in df.columns:
            self.logger.log_warning("未找到异常标记列，先执行能耗计算流程")
            return []
        
        anomaly_df = df[df['_is_anomaly']].copy()
        
        if len(anomaly_df) == 0:
            self.logger.log_info("未检测到异常样本")
            return []
        
        self.logger.log_info(f"发现 {len(anomaly_df)} 条异常记录，开始归因分析")
        
        high_energy_anomalies = anomaly_df[anomaly_df['_energy_deviation'] > 0]
        low_energy_anomalies = anomaly_df[anomaly_df['_energy_deviation'] < 0]
        
        if len(high_energy_anomalies) > 0:
            self._analyze_high_energy_anomalies(high_energy_anomalies, df)
        
        if len(low_energy_anomalies) > 0:
            self._analyze_low_energy_anomalies(low_energy_anomalies, df)
        
        self._rank_attributions()
        
        return self.attributions
    
    def _analyze_high_energy_anomalies(self, anomaly_df: pd.DataFrame, full_df: pd.DataFrame):
        total_high_anomalies = len(anomaly_df)
        
        leak_factor = self._check_leakage_anomaly(anomaly_df)
        if leak_factor:
            self.attributions.append(leak_factor)
        
        pressure_factor = self._check_pressure_anomaly(anomaly_df)
        if pressure_factor:
            self.attributions.append(pressure_factor)
        
        production_factor = self._check_production_efficiency(anomaly_df, full_df)
        if production_factor:
            self.attributions.append(production_factor)
        
        timing_factor = self._check_timing_pattern(anomaly_df)
        if timing_factor:
            self.attributions.append(timing_factor)
        
        load_factor = self._check_load_factor(anomaly_df, full_df)
        if load_factor:
            self.attributions.append(load_factor)
        
        remaining = self._check_remaining_anomalies(anomaly_df)
        if remaining:
            self.attributions.append(remaining)
    
    def _analyze_low_energy_anomalies(self, anomaly_df: pd.DataFrame, full_df: pd.DataFrame):
        total_low_anomalies = len(anomaly_df)
        
        underload_factor = self._check_underload_anomaly(anomaly_df)
        if underload_factor:
            self.attributions.append(underload_factor)
        
        shutdown_factor = self._check_shutdown_pattern(anomaly_df)
        if shutdown_factor:
            self.attributions.append(shutdown_factor)
    
    def _check_leakage_anomaly(self, anomaly_df: pd.DataFrame) -> Optional[AttributionResult]:
        leak_col = self.loader.mapping.get('leak')
        if not leak_col or leak_col not in anomaly_df.columns:
            return None
        
        leak_threshold = config.leak_threshold
        
        high_leak_mask = anomaly_df[leak_col].notna() & (anomaly_df[leak_col] > leak_threshold)
        high_leak_count = high_leak_mask.sum()
        
        if high_leak_count == 0:
            return None
        
        related_indices = anomaly_df[high_leak_mask]['_original_index'].tolist()
        avg_leak = anomaly_df[high_leak_mask][leak_col].mean()
        
        confidence = min(0.9, 0.5 + (high_leak_count / len(anomaly_df)) * 0.4)
        contribution = (avg_leak / leak_threshold) * 0.3
        
        return AttributionResult(
            category='泄漏',
            description=f"系统泄漏量高于阈值，检测到 {high_leak_count} 条高泄漏记录，平均泄漏 {avg_leak:.4f} {config.default_leak_unit}",
            confidence=confidence,
            affected_count=high_leak_count,
            related_indices=related_indices,
            contribution=min(1.0, contribution)
        )
    
    def _check_pressure_anomaly(self, anomaly_df: pd.DataFrame) -> Optional[AttributionResult]:
        pressure_col = self.loader.mapping.get('pressure')
        if not pressure_col or pressure_col not in anomaly_df.columns:
            return None
        
        min_p, max_p = config.pressure_normal_range
        
        abnormal_pressure_mask = (
            anomaly_df[pressure_col].notna() & 
            ((anomaly_df[pressure_col] < min_p) | (anomaly_df[pressure_col] > max_p))
        )
        abnormal_count = abnormal_pressure_mask.sum()
        
        if abnormal_count == 0:
            return None
        
        related_indices = anomaly_df[abnormal_pressure_mask]['_original_index'].tolist()
        abnormal_pressures = anomaly_df[abnormal_pressure_mask][pressure_col]
        
        low_p_count = (abnormal_pressures < min_p).sum()
        high_p_count = (abnormal_pressures > max_p).sum()
        
        if low_p_count > high_p_count:
            description = f"压力偏低导致空压机频繁加载，检测到 {abnormal_count} 条压力异常记录"
        else:
            description = f"压力偏高导致能耗浪费，检测到 {abnormal_count} 条压力异常记录"
        
        confidence = min(0.85, 0.4 + (abnormal_count / len(anomaly_df)) * 0.4)
        
        return AttributionResult(
            category='压力异常',
            description=description,
            confidence=confidence,
            affected_count=abnormal_count,
            related_indices=related_indices,
            contribution=0.25
        )
    
    def _check_production_efficiency(self, anomaly_df: pd.DataFrame, full_df: pd.DataFrame) -> Optional[AttributionResult]:
        production_col = self.loader.mapping.get('production')
        energy_col = self.loader.mapping.get('energy')
        
        if not production_col or not energy_col:
            return None
        
        valid_full = full_df[full_df[production_col].notna() & full_df[energy_col].notna()]
        valid_anomaly = anomaly_df[anomaly_df[production_col].notna() & anomaly_df[energy_col].notna()]
        
        if len(valid_full) < 10 or len(valid_anomaly) == 0:
            return None
        
        baseline_ratio = valid_full[energy_col].sum() / valid_full[production_col].sum()
        anomaly_ratio = valid_anomaly[energy_col].sum() / valid_anomaly[production_col].sum()
        
        ratio_diff_pct = ((anomaly_ratio - baseline_ratio) / baseline_ratio) * 100
        
        if ratio_diff_pct < 10:
            return None
        
        related_indices = valid_anomaly['_original_index'].tolist()
        
        return AttributionResult(
            category='生产效率下降',
            description=f"单位产量能耗比基准高出 {ratio_diff_pct:.1f}%，异常时段能效明显下降",
            confidence=min(0.8, 0.3 + min(0.5, ratio_diff_pct / 100)),
            affected_count=len(valid_anomaly),
            related_indices=related_indices,
            contribution=min(0.5, ratio_diff_pct / 100)
        )
    
    def _check_timing_pattern(self, anomaly_df: pd.DataFrame) -> Optional[AttributionResult]:
        datetime_col = self.loader.mapping.get('datetime')
        if not datetime_col or datetime_col not in anomaly_df.columns:
            return None
        
        if '_hour' not in anomaly_df.columns:
            return None
        
        hour_counts = Counter(anomaly_df['_hour'].dropna().astype(int))
        
        if not hour_counts:
            return None
        
        peak_hour = hour_counts.most_common(1)[0]
        peak_hour_num, peak_count = peak_hour
        
        if peak_count < max(3, len(anomaly_df) * 0.3):
            return None
        
        if 7 <= peak_hour_num <= 18:
            time_desc = "工作时段"
        elif 22 <= peak_hour_num or peak_hour_num <= 6:
            time_desc = "夜间时段（可能存在空压或泄漏）"
        else:
            time_desc = f"{peak_hour_num}点左右"
        
        related_indices = anomaly_df[anomaly_df['_hour'] == peak_hour_num]['_original_index'].tolist()
        
        return AttributionResult(
            category='时间模式异常',
            description=f"异常集中出现在{time_desc}，{peak_hour_num}:00时段有 {peak_count} 条异常记录",
            confidence=0.6,
            affected_count=peak_count,
            related_indices=related_indices,
            contribution=0.15
        )
    
    def _check_load_factor(self, anomaly_df: pd.DataFrame, full_df: pd.DataFrame) -> Optional[AttributionResult]:
        production_col = self.loader.mapping.get('production')
        if not production_col or production_col not in full_df.columns:
            return None
        
        valid_full = full_df[full_df[production_col].notna() & (full_df[production_col] > 0)]
        valid_anomaly = anomaly_df[anomaly_df[production_col].notna() & (anomaly_df[production_col] > 0)]
        
        if len(valid_full) < 10 or len(valid_anomaly) == 0:
            return None
        
        max_production = valid_full[production_col].max()
        if max_production == 0:
            return None
        
        anomaly_load_ratios = valid_anomaly[production_col] / max_production
        
        low_load_mask = anomaly_load_ratios < 0.3
        low_load_count = low_load_mask.sum()
        
        if low_load_count < max(2, len(valid_anomaly) * 0.2):
            return None
        
        avg_load = anomaly_load_ratios[low_load_mask].mean() * 100
        related_indices = valid_anomaly[low_load_mask]['_original_index'].tolist()
        
        return AttributionResult(
            category='低负载运行',
            description=f"空压机在低负载下运行，平均负载率仅 {avg_load:.1f}%，存在 {low_load_count} 条低效记录",
            confidence=0.65,
            affected_count=low_load_count,
            related_indices=related_indices,
            contribution=0.2
        )
    
    def _check_underload_anomaly(self, anomaly_df: pd.DataFrame) -> Optional[AttributionResult]:
        production_col = self.loader.mapping.get('production')
        energy_col = self.loader.mapping.get('energy')
        
        if not production_col or not energy_col:
            return None
        
        low_production_mask = (
            anomaly_df[production_col].notna() & 
            (anomaly_df[production_col] == 0)
        )
        low_prod_count = low_production_mask.sum()
        
        if low_prod_count == 0:
            return None
        
        related_indices = anomaly_df[low_production_mask]['_original_index'].tolist()
        
        return AttributionResult(
            category='零产量记录',
            description=f"检测到 {low_prod_count} 条零产量但有能耗的记录，可能存在空载运行",
            confidence=0.7,
            affected_count=low_prod_count,
            related_indices=related_indices,
            contribution=0.3
        )
    
    def _check_shutdown_pattern(self, anomaly_df: pd.DataFrame) -> Optional[AttributionResult]:
        energy_col = self.loader.mapping.get('energy')
        if not energy_col or energy_col not in anomaly_df.columns:
            return None
        
        near_zero_mask = (
            anomaly_df[energy_col].notna() & 
            (anomaly_df[energy_col] <= anomaly_df[energy_col].max() * 0.05)
        )
        near_zero_count = near_zero_mask.sum()
        
        if near_zero_count == 0:
            return None
        
        related_indices = anomaly_df[near_zero_mask]['_original_index'].tolist()
        
        return AttributionResult(
            category='停机/待机状态',
            description=f"检测到 {near_zero_count} 条能耗极低的记录，可能为停机或待机状态",
            confidence=0.55,
            affected_count=near_zero_count,
            related_indices=related_indices,
            contribution=0.1
        )
    
    def _check_remaining_anomalies(self, anomaly_df: pd.DataFrame) -> Optional[AttributionResult]:
        attributed_indices = set()
        for attr in self.attributions:
            attributed_indices.update(attr.related_indices)
        
        all_anomaly_indices = set(anomaly_df['_original_index'].tolist())
        remaining_indices = list(all_anomaly_indices - attributed_indices)
        
        if not remaining_indices:
            return None
        
        return AttributionResult(
            category='其他原因',
            description=f"存在 {len(remaining_indices)} 条无法归因的异常记录，建议人工核查",
            confidence=0.3,
            affected_count=len(remaining_indices),
            related_indices=remaining_indices,
            contribution=0.05
        )
    
    def _rank_attributions(self):
        def score(attr: AttributionResult) -> float:
            return attr.confidence * attr.contribution * (1 + attr.affected_count / 100)
        
        self.attributions.sort(key=score, reverse=True)
    
    def get_attribution_summary(self) -> Dict:
        if not self.attributions:
            return {'summary': '未检测到异常', 'details': []}
        
        total_affected = sum(a.affected_count for a in self.attributions)
        
        return {
            'summary': f"检测到 {len(self.attributions)} 类可能原因",
            'primary_cause': self.attributions[0].category if self.attributions else None,
            'total_affected': total_affected,
            'details': [
                {
                    'category': a.category,
                    'description': a.description,
                    'confidence': f"{a.confidence:.0%}",
                    'affected_count': a.affected_count,
                    'contribution': f"{a.contribution:.0%}"
                }
                for a in self.attributions
            ]
        }
