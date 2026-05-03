import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class AdjustmentType(Enum):
    SHIFT_TIME = "调整发车时间"
    INCREASE_SEATS = "增加座位数"
    ADD_TRIP = "增加班次"

@dataclass
class Adjustment:
    adjustment_type: AdjustmentType
    route_name: str
    description: str
    parameters: Dict

@dataclass
class ScenarioResult:
    scenario_name: str
    original_metrics: Dict
    adjusted_metrics: Dict
    improvement_summary: Dict
    affected_records: pd.DataFrame

class ScheduleSimulator:
    def __init__(self, df: pd.DataFrame):
        self.original_df = df.copy()
        self.current_df = df.copy()
    
    def _calculate_scenario_metrics(self, df: pd.DataFrame) -> Dict:
        if df.empty:
            return {
                '准点率': 0,
                '平均延误_分钟': 0,
                '严重延误率': 0,
                '平均座位利用率': 0,
                '超载率': 0,
                '高满载率': 0,
                '总记录数': 0
            }
        
        valid_delays = df[df['最大延误_分钟'].notna()]['最大延误_分钟']
        valid_util = df[df['座位利用率'].notna()]['座位利用率']
        
        return {
            '准点率': df['是否准点'].mean() * 100,
            '平均延误_分钟': valid_delays.mean() if len(valid_delays) > 0 else 0,
            '严重延误率': df['是否严重延误'].mean() * 100,
            '平均座位利用率': valid_util.mean() * 100 if len(valid_util) > 0 else 0,
            '超载率': df['是否超载'].mean() * 100,
            '高满载率': df['是否高满载'].mean() * 100,
            '总记录数': len(df)
        }
    
    def apply_time_shift(self, route_name: str, minutes: int, time_period: str = None) -> pd.DataFrame:
        adjusted_df = self.original_df.copy()
        route_mask = adjusted_df['线路'] == route_name
        
        if time_period:
            route_mask = route_mask & (adjusted_df['时段'] == time_period)
        
        affected = adjusted_df[route_mask].copy()
        
        if minutes < 0:
            adjusted_df.loc[route_mask, '模拟调整说明'] = f'提前发车 {-minutes} 分钟'
            adjusted_df.loc[route_mask, '模拟_最大延误_分钟'] = adjusted_df.loc[route_mask, '最大延误_分钟'].apply(
                lambda x: max(0, x + minutes)
            )
        else:
            adjusted_df.loc[route_mask, '模拟调整说明'] = f'延后发车 {minutes} 分钟'
            adjusted_df.loc[route_mask, '模拟_最大延误_分钟'] = adjusted_df.loc[route_mask, '最大延误_分钟'].apply(
                lambda x: max(0, x - minutes)
            )
        
        adjusted_df.loc[route_mask, '模拟_是否准点'] = adjusted_df.loc[route_mask, '模拟_最大延误_分钟'] <= 3
        adjusted_df.loc[route_mask, '模拟_是否严重延误'] = adjusted_df.loc[route_mask, '模拟_最大延误_分钟'] > 10
        
        for col in ['模拟_最大延误_分钟', '模拟_是否准点', '模拟_是否严重延误']:
            if col not in adjusted_df.columns:
                adjusted_df[col] = adjusted_df[col.replace('模拟_', '')] if col.replace('模拟_', '') in adjusted_df.columns else None
        
        return adjusted_df
    
    def apply_increase_seats(self, route_name: str, additional_seats: int) -> pd.DataFrame:
        adjusted_df = self.original_df.copy()
        route_mask = adjusted_df['线路'] == route_name
        
        adjusted_df.loc[route_mask, '模拟调整说明'] = f'增加座位 {additional_seats} 个'
        adjusted_df.loc[route_mask, '模拟_座位数'] = adjusted_df.loc[route_mask, '座位数'] + additional_seats
        
        adjusted_df.loc[route_mask, '模拟_座位利用率'] = adjusted_df.apply(
            lambda row: row['签到人数'] / row['模拟_座位数'] if route_mask.loc[row.name] and row['模拟_座位数'] > 0 else row.get('座位利用率', None),
            axis=1
        )
        
        adjusted_df.loc[route_mask, '模拟_是否超载'] = adjusted_df.apply(
            lambda row: row['签到人数'] > row['模拟_座位数'] if route_mask.loc[row.name] else row.get('是否超载', False),
            axis=1
        )
        
        adjusted_df.loc[route_mask, '模拟_是否高满载'] = adjusted_df.apply(
            lambda row: row['签到人数'] >= row['模拟_座位数'] * 0.95 if route_mask.loc[row.name] else row.get('是否高满载', False),
            axis=1
        )
        
        for col in ['模拟_座位数', '模拟_座位利用率', '模拟_是否超载', '模拟_是否高满载']:
            base_col = col.replace('模拟_', '')
            if base_col in adjusted_df.columns:
                adjusted_df[col] = adjusted_df[col].fillna(adjusted_df[base_col])
        
        return adjusted_df
    
    def apply_add_trip(self, route_name: str, time_period: str, trips_to_add: int = 1) -> pd.DataFrame:
        adjusted_df = self.original_df.copy()
        
        route_period_mask = (adjusted_df['线路'] == route_name) & (adjusted_df['时段'] == time_period)
        existing_trips = adjusted_df[route_period_mask]
        
        if existing_trips.empty:
            return adjusted_df
        
        new_records = []
        for _, row in existing_trips.iterrows():
            for i in range(trips_to_add):
                new_row = row.copy()
                new_row['模拟_是否新增班次'] = True
                new_row['模拟调整说明'] = f'新增班次 (第{i+1}班)'
                
                new_row['模拟_分流人数'] = int(row['签到人数'] / (trips_to_add + 1))
                new_row['模拟_签到人数'] = new_row['模拟_分流人数']
                new_row['模拟_原签到人数'] = row['签到人数']
                
                new_records.append(new_row)
        
        if new_records:
            new_trips_df = pd.DataFrame(new_records)
            adjusted_df = pd.concat([adjusted_df, new_trips_df], ignore_index=True)
            
            adjusted_df.loc[route_period_mask, '模拟调整说明'] = '原班次（已分流）'
            adjusted_df.loc[route_period_mask, '模拟_签到人数'] = adjusted_df.loc[route_period_mask].apply(
                lambda row: int(row['签到人数'] / (trips_to_add + 1)),
                axis=1
            )
            adjusted_df.loc[route_period_mask, '模拟_原签到人数'] = adjusted_df.loc[route_period_mask]['签到人数']
            
            all_affected_mask = (adjusted_df['线路'] == route_name) & (adjusted_df['时段'] == time_period)
            
            adjusted_df.loc[all_affected_mask, '模拟_座位利用率'] = adjusted_df.apply(
                lambda row: row['模拟_签到人数'] / row['座位数'] if row['座位数'] > 0 else row.get('座位利用率', None),
                axis=1
            )
            
            adjusted_df.loc[all_affected_mask, '模拟_是否超载'] = adjusted_df.apply(
                lambda row: row['模拟_签到人数'] > row['座位数'],
                axis=1
            )
            
            adjusted_df.loc[all_affected_mask, '模拟_是否高满载'] = adjusted_df.apply(
                lambda row: row['模拟_签到人数'] >= row['座位数'] * 0.95,
                axis=1
            )
        
        return adjusted_df
    
    def compare_scenario(
        self, 
        adjustment: Adjustment
    ) -> ScenarioResult:
        route_mask = self.original_df['线路'] == adjustment.route_name
        original_affected = self.original_df[route_mask]
        
        original_metrics = self._calculate_scenario_metrics(original_affected)
        
        if adjustment.adjustment_type == AdjustmentType.SHIFT_TIME:
            minutes = adjustment.parameters.get('minutes', 0)
            time_period = adjustment.parameters.get('time_period')
            adjusted_df = self.apply_time_shift(
                adjustment.route_name, 
                minutes,
                time_period
            )
            
            if time_period:
                affected_mask = (adjusted_df['线路'] == adjustment.route_name) & (adjusted_df['时段'] == time_period)
            else:
                affected_mask = adjusted_df['线路'] == adjustment.route_name
            
            affected = adjusted_df[affected_mask].copy()
            affected['最大延误_分钟'] = affected['模拟_最大延误_分钟']
            affected['是否准点'] = affected['模拟_是否准点']
            affected['是否严重延误'] = affected['模拟_是否严重延误']
            
        elif adjustment.adjustment_type == AdjustmentType.INCREASE_SEATS:
            additional_seats = adjustment.parameters.get('additional_seats', 0)
            adjusted_df = self.apply_increase_seats(
                adjustment.route_name,
                additional_seats
            )
            
            affected_mask = adjusted_df['线路'] == adjustment.route_name
            affected = adjusted_df[affected_mask].copy()
            affected['座位数'] = affected['模拟_座位数']
            affected['座位利用率'] = affected['模拟_座位利用率']
            affected['是否超载'] = affected['模拟_是否超载']
            affected['是否高满载'] = affected['模拟_是否高满载']
            
        elif adjustment.adjustment_type == AdjustmentType.ADD_TRIP:
            time_period = adjustment.parameters.get('time_period', '早高峰')
            trips_to_add = adjustment.parameters.get('trips_to_add', 1)
            adjusted_df = self.apply_add_trip(
                adjustment.route_name,
                time_period,
                trips_to_add
            )
            
            affected_mask = (adjusted_df['线路'] == adjustment.route_name) & (adjusted_df['时段'] == time_period)
            affected = adjusted_df[affected_mask].copy()
            
            for idx, row in affected.iterrows():
                if '模拟_签到人数' in row and pd.notna(row['模拟_签到人数']):
                    affected.at[idx, '签到人数'] = row['模拟_签到人数']
                if '模拟_座位利用率' in row and pd.notna(row['模拟_座位利用率']):
                    affected.at[idx, '座位利用率'] = row['模拟_座位利用率']
                if '模拟_是否超载' in row and pd.notna(row['模拟_是否超载']):
                    affected.at[idx, '是否超载'] = row['模拟_是否超载']
                if '模拟_是否高满载' in row and pd.notna(row['模拟_是否高满载']):
                    affected.at[idx, '是否高满载'] = row['模拟_是否高满载']
        else:
            adjusted_df = self.original_df
            affected = original_affected
        
        adjusted_metrics = self._calculate_scenario_metrics(affected)
        
        improvement = {}
        for key in original_metrics:
            if key in ['准点率']:
                improvement[key] = adjusted_metrics.get(key, 0) - original_metrics.get(key, 0)
            elif key in ['平均延误_分钟', '严重延误率', '超载率', '高满载率']:
                improvement[key] = original_metrics.get(key, 0) - adjusted_metrics.get(key, 0)
            else:
                improvement[key] = adjusted_metrics.get(key, 0) - original_metrics.get(key, 0)
        
        return ScenarioResult(
            scenario_name=adjustment.description,
            original_metrics=original_metrics,
            adjusted_metrics=adjusted_metrics,
            improvement_summary=improvement,
            affected_records=affected
        )
    
    def generate_comparison_report(self, results: List[ScenarioResult]) -> Dict:
        report = {
            '基准场景': self._calculate_scenario_metrics(self.original_df),
            '方案对比': []
        }
        
        for result in results:
            report['方案对比'].append({
                '方案名称': result.scenario_name,
                '调整前指标': result.original_metrics,
                '调整后指标': result.adjusted_metrics,
                '改善情况': {
                    '准点率变化': f"{result.improvement_summary.get('准点率', 0):+.1f}%",
                    '平均延误变化': f"{result.improvement_summary.get('平均延误_分钟', 0):+.1f}分钟",
                    '严重延误率变化': f"{result.improvement_summary.get('严重延误率', 0):+.1f}%",
                    '超载率变化': f"{result.improvement_summary.get('超载率', 0):+.1f}%",
                    '高满载率变化': f"{result.improvement_summary.get('高满载率', 0):+.1f}%"
                }
            })
        
        return report
