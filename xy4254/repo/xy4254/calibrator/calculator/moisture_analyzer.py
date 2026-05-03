"""
水分分析器 - 分析基质水分状态和变化趋势
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


class MoistureAnalyzer:
    """
    基质水分分析器
    
    分析水分传感器数据，评估水分状态、变化趋势和风险
    """
    
    def __init__(self):
        self.default_field_capacity = 70.0
        self.default_wilting_point = 20.0
    
    def analyze_moisture_timeseries(self, moisture_data: pd.Series,
                                     timestamps: pd.Series,
                                     field_capacity: float = None,
                                     wilting_point: float = None) -> Dict:
        """
        分析水分时间序列数据
        
        Args:
            moisture_data: 水分含量序列（体积含水量 %）
            timestamps: 对应的时间戳序列
            field_capacity: 田间持水量，默认70%
            wilting_point: 萎蔫点，默认20%
            
        Returns:
            包含分析结果的字典
        """
        fc = field_capacity or self.default_field_capacity
        wp = wilting_point or self.default_wilting_point
        
        df = pd.DataFrame({
            'timestamp': pd.to_datetime(timestamps),
            'moisture': pd.to_numeric(moisture_data, errors='coerce')
        })
        
        df = df.dropna(subset=['moisture'])
        
        if len(df) == 0:
            return {}
        
        df = df.sort_values('timestamp')
        
        stats = self._calculate_basic_stats(df['moisture'])
        
        trend = self._calculate_trend(df)
        
        risk = self._assess_water_risk(df, fc, wp)
        
        daily_stats = self._calculate_daily_stats(df)
        
        irrigation_events = self._detect_irrigation_events(df)
        
        return {
            'basic_stats': stats,
            'trend': trend,
            'risk': risk,
            'daily_stats': daily_stats,
            'irrigation_events': irrigation_events,
            'field_capacity': fc,
            'wilting_point': wp
        }
    
    def _calculate_basic_stats(self, moisture: pd.Series) -> Dict:
        """计算基本统计量"""
        return {
            'mean': round(float(moisture.mean()), 1),
            'median': round(float(moisture.median()), 1),
            'std': round(float(moisture.std()), 1),
            'min': round(float(moisture.min()), 1),
            'max': round(float(moisture.max()), 1),
            'range': round(float(moisture.max() - moisture.min()), 1),
            'count': len(moisture)
        }
    
    def _calculate_trend(self, df: pd.DataFrame) -> Dict:
        """计算水分变化趋势"""
        if len(df) < 2:
            return {
                'direction': 'stable',
                'description': '数据不足，无法判断趋势',
                'slope': 0,
                'hourly_change': 0
            }
        
        x = (df['timestamp'] - df['timestamp'].min()).dt.total_seconds() / 3600
        y = df['moisture']
        
        slope, intercept = np.polyfit(x, y, 1)
        
        hours_span = x.max() - x.min()
        total_change = slope * hours_span
        
        if slope < -0.1:
            direction = 'decreasing_fast'
            description = '快速下降'
        elif slope < -0.02:
            direction = 'decreasing'
            description = '缓慢下降'
        elif slope > 0.1:
            direction = 'increasing_fast'
            description = '快速上升'
        elif slope > 0.02:
            direction = 'increasing'
            description = '缓慢上升'
        else:
            direction = 'stable'
            description = '基本稳定'
        
        return {
            'direction': direction,
            'description': description,
            'slope_per_hour': round(slope, 4),
            'total_change': round(total_change, 1),
            'hours_span': round(hours_span, 1)
        }
    
    def _assess_water_risk(self, df: pd.DataFrame, fc: float, wp: float) -> Dict:
        """评估水分风险"""
        moisture = df['moisture']
        
        optimal_low = fc - (fc - wp) * 0.3
        optimal_high = fc
        
        below_wp = (moisture <= wp).sum()
        below_optimal = (moisture < optimal_low).sum()
        in_optimal = ((moisture >= optimal_low) & (moisture <= optimal_high)).sum()
        above_optimal = (moisture > optimal_high).sum()
        above_fc = (moisture > fc).sum()
        
        total = len(moisture)
        
        current_moisture = moisture.iloc[-1]
        
        if current_moisture <= wp:
            current_risk = 'critical'
            current_status = '严重干旱'
        elif current_moisture < optimal_low:
            current_risk = 'high'
            current_status = '偏干'
        elif current_moisture <= optimal_high:
            current_risk = 'normal'
            current_status = '适宜'
        elif current_moisture <= fc + 5:
            current_risk = 'medium'
            current_status = '偏湿'
        else:
            current_risk = 'high'
            current_status = '过湿'
        
        risk_score = 0
        
        if below_wp > 0:
            risk_score += 10
        if below_optimal / total > 0.3:
            risk_score += 5
        if above_fc / total > 0.2:
            risk_score += 5
        
        if risk_score >= 10:
            overall_risk = 'high'
        elif risk_score >= 5:
            overall_risk = 'medium'
        else:
            overall_risk = 'low'
        
        return {
            'current_risk': current_risk,
            'current_status': current_status,
            'current_moisture': round(current_moisture, 1),
            'overall_risk': overall_risk,
            'risk_score': risk_score,
            'distribution': {
                'below_wilting_point': int(below_wp),
                'below_optimal': int(below_optimal),
                'in_optimal': int(in_optimal),
                'above_optimal': int(above_optimal),
                'above_field_capacity': int(above_fc),
                'total': int(total)
            }
        }
    
    def _calculate_daily_stats(self, df: pd.DataFrame) -> List[Dict]:
        """计算每日统计"""
        df['date'] = df['timestamp'].dt.date
        
        daily = []
        for date, group in df.groupby('date'):
            group = group.sort_values('timestamp')
            daily.append({
                'date': str(date),
                'morning_moisture': round(float(group.iloc[0]['moisture']), 1),
                'evening_moisture': round(float(group.iloc[-1]['moisture']), 1),
                'daily_change': round(float(group.iloc[-1]['moisture'] - group.iloc[0]['moisture']), 1),
                'avg_moisture': round(float(group['moisture'].mean()), 1),
                'min_moisture': round(float(group['moisture'].min()), 1),
                'max_moisture': round(float(group['moisture'].max()), 1)
            })
        
        return daily
    
    def _detect_irrigation_events(self, df: pd.DataFrame, 
                                    threshold_increase: float = 5.0) -> List[Dict]:
        """
        检测灌溉事件
        
        通过检测水分的快速上升来判断可能的灌溉事件
        
        Args:
            df: 包含timestamp和moisture的DataFrame
            threshold_increase: 水分上升阈值（%），超过此值认为是灌溉
            
        Returns:
            灌溉事件列表
        """
        events = []
        
        if len(df) < 2:
            return events
        
        df = df.sort_values('timestamp')
        
        for i in range(1, len(df)):
            prev_moisture = df['moisture'].iloc[i - 1]
            curr_moisture = df['moisture'].iloc[i]
            time_diff = (df['timestamp'].iloc[i] - df['timestamp'].iloc[i - 1]).total_seconds()
            
            moisture_increase = curr_moisture - prev_moisture
            
            if moisture_increase >= threshold_increase:
                events.append({
                    'timestamp': df['timestamp'].iloc[i].isoformat(),
                    'increase_amount': round(moisture_increase, 1),
                    'from_moisture': round(prev_moisture, 1),
                    'to_moisture': round(curr_moisture, 1),
                    'time_since_prev_seconds': time_diff
                })
        
        return events
    
    def estimate_next_irrigation_time(self, current_moisture: float,
                                        depletion_rate: float,
                                        field_capacity: float = None,
                                        wilting_point: float = None,
                                        safety_margin: float = 10.0) -> Dict:
        """
        估算下次需要灌溉的时间
        
        Args:
            current_moisture: 当前水分含量（%）
            depletion_rate: 水分消耗速率（%/小时）
            field_capacity: 田间持水量
            wilting_point: 萎蔫点
            safety_margin: 安全边际（%），在达到萎蔫点前提前灌溉
            
        Returns:
            包含灌溉时间估算的字典
        """
        fc = field_capacity or self.default_field_capacity
        wp = wilting_point or self.default_wilting_point
        
        target_threshold = wp + safety_margin
        
        if current_moisture <= target_threshold:
            return {
                'need_irrigation_now': True,
                'hours_until_irrigation': 0,
                'current_status': '需要立即灌溉',
                'target_threshold': round(target_threshold, 1)
            }
        
        moisture_to_deplete = current_moisture - target_threshold
        
        if depletion_rate <= 0:
            return {
                'need_irrigation_now': False,
                'hours_until_irrigation': 999,
                'current_status': '水分稳定，无需灌溉',
                'target_threshold': round(target_threshold, 1)
            }
        
        hours_needed = moisture_to_deplete / depletion_rate
        
        if hours_needed < 6:
            urgency = '紧急'
        elif hours_needed < 24:
            urgency = '今日'
        elif hours_needed < 48:
            urgency = '明日'
        else:
            urgency = '正常'
        
        return {
            'need_irrigation_now': hours_needed < 6,
            'hours_until_irrigation': round(hours_needed, 1),
            'days_until_irrigation': round(hours_needed / 24, 1),
            'urgency': urgency,
            'current_moisture': round(current_moisture, 1),
            'target_threshold': round(target_threshold, 1),
            'depletion_rate': round(depletion_rate, 3)
        }
    
    def get_moisture_substrate_info(self, substrate_type: str = '通用育苗基质') -> Dict:
        """
        获取不同基质类型的水分特性参数
        
        Args:
            substrate_type: 基质类型
            
        Returns:
            包含基质水分特性的字典
        """
        substrates = {
            '通用育苗基质': {
                'field_capacity': 70,
                'wilting_point': 20,
                'optimal_min': 50,
                'optimal_max': 70,
                'bulk_density': 0.45,
                'description': '通用泥炭-珍珠岩混合基质'
            },
            '穴盘专用基质': {
                'field_capacity': 65,
                'wilting_point': 18,
                'optimal_min': 45,
                'optimal_max': 65,
                'bulk_density': 0.40,
                'description': '精细化穴盘育苗基质'
            },
            '多肉专用基质': {
                'field_capacity': 45,
                'wilting_point': 10,
                'optimal_min': 20,
                'optimal_max': 35,
                'bulk_density': 0.55,
                'description': '高透气性多肉基质'
            },
            '蔬菜育苗基质': {
                'field_capacity': 75,
                'wilting_point': 22,
                'optimal_min': 55,
                'optimal_max': 75,
                'bulk_density': 0.42,
                'description': '高保水性蔬菜育苗基质'
            }
        }
        
        return substrates.get(substrate_type, substrates['通用育苗基质'])
