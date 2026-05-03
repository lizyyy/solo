"""
DLI计算器 - 计算日积累光量（Daily Light Integral）
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


class DLICalculator:
    """
    日积累光量计算器
    
    DLI定义：一天内单位面积上累积的光合有效辐射（PAR）量，
    单位为 mol·m⁻²·d⁻¹ 或 mol·m⁻²·day⁻¹
    """
    
    def __init__(self):
        self.light_data: Optional[pd.DataFrame] = None
    
    def calculate_daily_dli(self, light_intensities: pd.Series, 
                           timestamps: pd.Series) -> Dict[str, float]:
        """
        从时间序列的光照强度数据计算日DLI
        
        Args:
            light_intensities: 光照强度序列（单位：μmol·m⁻²·s⁻¹ 或 lux）
            timestamps: 对应的时间戳序列
            
        Returns:
            包含每日DLI数据的字典，key为日期字符串，value为DLI值
        """
        df = pd.DataFrame({
            'timestamp': pd.to_datetime(timestamps),
            'light_intensity': pd.to_numeric(light_intensities, errors='coerce')
        })
        
        df['date'] = df['timestamp'].dt.date
        df = df.dropna(subset=['light_intensity'])
        
        if len(df) == 0:
            return {}
        
        daily_dli = {}
        
        for date, group in df.groupby('date'):
            group = group.sort_values('timestamp')
            
            dli = self._calculate_dli_from_group(group)
            daily_dli[str(date)] = round(dli, 2)
        
        return daily_dli
    
    def _calculate_dli_from_group(self, group: pd.DataFrame) -> float:
        """
        从一天的数据组计算DLI
        
        使用梯形法则计算积分：
        DLI = Σ [ (PAR_i + PAR_{i+1}) / 2 * Δt ] * 10^-6
        
        其中：
        - PAR_i 是第i个时刻的光合有效辐射
        - Δt 是时间间隔（秒）
        - 10^-6 将μmol转换为mol
        """
        if len(group) < 2:
            if len(group) == 1:
                return float(group['light_intensity'].iloc[0]) * 3600 * 12 * 1e-6
            return 0.0
        
        total = 0.0
        
        for i in range(len(group) - 1):
            t1 = group['timestamp'].iloc[i]
            t2 = group['timestamp'].iloc[i + 1]
            par1 = group['light_intensity'].iloc[i]
            par2 = group['light_intensity'].iloc[i + 1]
            
            delta_seconds = (t2 - t1).total_seconds()
            avg_par = (par1 + par2) / 2
            
            total += avg_par * delta_seconds
        
        dli = total * 1e-6
        
        return dli
    
    def calculate_from_interval(self, light_intensity: float, start_time: datetime, 
                                end_time: datetime) -> float:
        """
        从已知光照强度和时间区间计算DLI增量
        
        Args:
            light_intensity: 光照强度（μmol·m⁻²·s⁻¹）
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            该时间区间的DLI贡献值
        """
        delta_seconds = (end_time - start_time).total_seconds()
        dli = light_intensity * delta_seconds * 1e-6
        return round(dli, 4)
    
    def estimate_supplemental_light_needed(self, current_dli: float, 
                                            target_dli: float,
                                            light_efficiency: float = 2.3,
                                            photoperiod_hours: float = 16) -> Dict:
        """
        估算需要的补光量
        
        Args:
            current_dli: 当前自然光DLI
            target_dli: 目标DLI
            light_efficiency: 补光灯效率（μmol·J⁻¹），LED通常为1.5-3.0
            photoperiod_hours: 补光时长（小时）
            
        Returns:
            包含补光需求信息的字典
        """
        if current_dli >= target_dli:
            return {
                'need_supplement': False,
                'deficit': 0,
                'required_ppfd': 0,
                'estimated_energy': 0,
                'message': '当前光照充足，无需补光'
            }
        
        deficit = target_dli - current_dli
        
        photoperiod_seconds = photoperiod_hours * 3600
        
        required_ppfd = deficit * 1e6 / photoperiod_seconds
        required_ppfd = max(0, required_ppfd)
        
        total_photons = required_ppfd * photoperiod_seconds
        estimated_energy = total_photons / light_efficiency / 1e6
        
        return {
            'need_supplement': True,
            'deficit': round(deficit, 2),
            'required_ppfd': round(required_ppfd, 1),
            'photoperiod_hours': photoperiod_hours,
            'estimated_energy_kwh': round(estimated_energy, 2),
            'message': f'需要补充{round(deficit, 2)} mol/m²/day的光照'
        }
    
    def lux_to_ppfd(self, lux: float, conversion_factor: float = 0.0185) -> float:
        """
        将lux转换为PPFD（光合有效辐射通量密度）
        
        转换因子说明：
        - 太阳光：约0.0185 μmol·s⁻¹·m⁻² 每 lux
        - 白炽灯：约0.019
        - 荧光灯：约0.014
        - LED（白光）：约0.015-0.025
        
        Args:
            lux: 照度值
            conversion_factor: 转换因子
            
        Returns:
            PPFD值（μmol·m⁻²·s⁻¹）
        """
        return lux * conversion_factor
    
    def get_dli_status(self, dli: float, min_threshold: float = 8, 
                        optimal_min: float = 15, optimal_max: float = 25,
                        max_threshold: float = 40) -> Dict:
        """
        判断DLI状态
        
        Args:
            dli: 当前DLI值
            min_threshold: 最低需求阈值
            optimal_min: 最优范围最小值
            optimal_max: 最优范围最大值
            max_threshold: 最高阈值（可能造成光抑制）
            
        Returns:
            包含状态信息的字典
        """
        if dli < min_threshold:
            return {
                'status': '严重不足',
                'level': 'critical',
                'score': 1,
                'recommendation': '立即增加光照，否则会导致徒长或生长停滞'
            }
        elif dli < optimal_min:
            return {
                'status': '偏低',
                'level': 'warning',
                'score': 3,
                'recommendation': '建议适当补光以促进生长'
            }
        elif dli <= optimal_max:
            return {
                'status': '适宜',
                'level': 'normal',
                'score': 5,
                'recommendation': '光照条件良好，维持当前状态'
            }
        elif dli <= max_threshold:
            return {
                'status': '偏高',
                'level': 'warning',
                'score': 4,
                'recommendation': '注意观察是否有光抑制现象，必要时适当遮阴'
            }
        else:
            return {
                'status': '过高',
                'level': 'critical',
                'score': 2,
                'recommendation': '光照过强，建议采取遮阴措施'
            }
    
    def calculate_weekly_stats(self, daily_dli: Dict[str, float]) -> Dict:
        """
        计算周DLI统计
        
        Args:
            daily_dli: 每日DLI字典
            
        Returns:
            包含周统计信息的字典
        """
        if not daily_dli:
            return {}
        
        values = list(daily_dli.values())
        
        return {
            'weekly_total': round(sum(values), 2),
            'weekly_avg': round(sum(values) / len(values), 2),
            'weekly_min': round(min(values), 2),
            'weekly_max': round(max(values), 2),
            'days_below_min': sum(1 for v in values if v < 8),
            'days_in_optimal': sum(1 for v in values if 15 <= v <= 25)
        }
