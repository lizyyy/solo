import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, date


@dataclass
class DailyMetrics:
    date: date
    platform: str
    spend: float
    impression: int
    click: int
    conversion: int
    ctr: float
    cpc: float
    cpm: float
    cpa: float
    roi: float
    revenue: float


@dataclass
class MaterialMetrics:
    material_id: str
    platform: str
    total_spend: float
    total_impression: int
    total_click: int
    total_conversion: int
    avg_ctr: float
    avg_cpc: float
    avg_cpm: float
    avg_cpa: float
    avg_roi: float
    days_active: int
    fatigue_score: float
    is_fatigued: bool


class MetricsCalculator:
    def __init__(self):
        self.fatigue_threshold = 0.3
        self.fatigue_days = 7
    
    def calculate_basic_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        
        result = df.copy()
        
        result['ctr'] = np.where(
            result['impression'] > 0,
            (result['click'] / result['impression'] * 100).round(4),
            0.0
        )
        
        result['cpc'] = np.where(
            result['click'] > 0,
            (result['spend'] / result['click']).round(4),
            0.0
        )
        
        result['cpm'] = np.where(
            result['impression'] > 0,
            (result['spend'] / result['impression'] * 1000).round(4),
            0.0
        )
        
        result['cpa'] = np.where(
            result['conversion'] > 0,
            (result['spend'] / result['conversion']).round(4),
            0.0
        )
        
        result['roi'] = np.where(
            result['spend'] > 0,
            (result.get('revenue', 0) / result['spend']).round(4),
            0.0
        )
        
        return result
    
    def aggregate_by_date(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame()
        
        agg_dict = {
            'spend': 'sum',
            'impression': 'sum',
            'click': 'sum',
            'conversion': 'sum',
            'revenue': 'sum' if 'revenue' in df.columns else 'count'
        }
        
        if 'revenue' not in df.columns:
            df['revenue'] = 0
        
        daily = df.groupby(['date', 'platform']).agg(agg_dict).reset_index()
        
        daily['ctr'] = np.where(
            daily['impression'] > 0,
            (daily['click'] / daily['impression'] * 100).round(4),
            0.0
        )
        daily['cpc'] = np.where(
            daily['click'] > 0,
            (daily['spend'] / daily['click']).round(4),
            0.0
        )
        daily['cpm'] = np.where(
            daily['impression'] > 0,
            (daily['spend'] / daily['impression'] * 1000).round(4),
            0.0
        )
        daily['cpa'] = np.where(
            daily['conversion'] > 0,
            (daily['spend'] / daily['conversion']).round(4),
            0.0
        )
        daily['roi'] = np.where(
            daily['spend'] > 0,
            (daily['revenue'] / daily['spend']).round(4),
            0.0
        )
        
        return daily
    
    def aggregate_by_material(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame()
        
        agg_dict = {
            'spend': ['sum', 'mean', 'std'],
            'impression': ['sum', 'mean'],
            'click': ['sum', 'mean'],
            'conversion': ['sum', 'mean'],
            'revenue': 'sum' if 'revenue' in df.columns else 'count',
            'date': 'nunique'
        }
        
        if 'revenue' not in df.columns:
            df['revenue'] = 0
        
        material = df.groupby(['material_id', 'platform']).agg(agg_dict).reset_index()
        
        material.columns = ['_'.join(col).strip('_') if col[1] else col[0] 
                           for col in material.columns.values]
        
        material = material.rename(columns={
            'spend_sum': 'total_spend',
            'spend_mean': 'avg_daily_spend',
            'spend_std': 'spend_std',
            'impression_sum': 'total_impression',
            'impression_mean': 'avg_impression',
            'click_sum': 'total_click',
            'click_mean': 'avg_click',
            'conversion_sum': 'total_conversion',
            'conversion_mean': 'avg_conversion',
            'revenue_sum': 'total_revenue',
            'date_nunique': 'days_active'
        })
        
        material['avg_ctr'] = np.where(
            material['total_impression'] > 0,
            (material['total_click'] / material['total_impression'] * 100).round(4),
            0.0
        )
        material['avg_cpc'] = np.where(
            material['total_click'] > 0,
            (material['total_spend'] / material['total_click']).round(4),
            0.0
        )
        material['avg_cpm'] = np.where(
            material['total_impression'] > 0,
            (material['total_spend'] / material['total_impression'] * 1000).round(4),
            0.0
        )
        material['avg_cpa'] = np.where(
            material['total_conversion'] > 0,
            (material['total_spend'] / material['total_conversion']).round(4),
            0.0
        )
        material['avg_roi'] = np.where(
            material['total_spend'] > 0,
            (material['total_revenue'] / material['total_spend']).round(4),
            0.0
        )
        
        return material
    
    def calculate_fatigue(
        self, 
        df: pd.DataFrame, 
        material_df: pd.DataFrame
    ) -> pd.DataFrame:
        if df.empty or material_df.empty:
            return material_df
        
        result = material_df.copy()
        
        df_sorted = df.sort_values(['material_id', 'platform', 'date'])
        
        for idx, row in result.iterrows():
            material_id = row['material_id']
            platform = row['platform']
            
            material_data = df_sorted[
                (df_sorted['material_id'] == material_id) & 
                (df_sorted['platform'] == platform)
            ].copy()
            
            if len(material_data) < 2:
                result.at[idx, 'fatigue_score'] = 0.0
                result.at[idx, 'is_fatigued'] = False
                result.at[idx, 'performance_trend'] = '稳定'
                continue
            
            if 'ctr' not in material_data.columns:
                material_data = self.calculate_basic_metrics(material_data)
            
            recent_days = min(self.fatigue_days, len(material_data))
            recent_data = material_data.tail(recent_days)
            
            ctr_values = recent_data['ctr'].values
            if len(ctr_values) > 1:
                ctr_trend = np.polyfit(range(len(ctr_values)), ctr_values, 1)[0]
                avg_ctr = np.mean(ctr_values)
                ctr_decline = abs(ctr_trend) / (avg_ctr + 0.001)
            else:
                ctr_decline = 0
            
            spend_values = recent_data['spend'].values
            if len(spend_values) > 1:
                spend_trend = np.polyfit(range(len(spend_values)), spend_values, 1)[0]
                avg_spend = np.mean(spend_values)
                spend_increase = spend_trend / (avg_spend + 0.01) if avg_spend > 0 else 0
            else:
                spend_increase = 0
            
            conversion_values = recent_data['conversion'].values
            if len(conversion_values) > 1:
                conversion_trend = np.polyfit(range(len(conversion_values)), conversion_values, 1)[0]
                avg_conversion = np.mean(conversion_values)
                conversion_decline = -conversion_trend / (avg_conversion + 0.1) if avg_conversion > 0 else 0
            else:
                conversion_decline = 0
            
            fatigue_score = (
                ctr_decline * 0.4 +
                max(0, spend_increase) * 0.3 +
                max(0, conversion_decline) * 0.3
            ) * 100
            
            fatigue_score = min(100, max(0, fatigue_score))
            
            result.at[idx, 'fatigue_score'] = round(fatigue_score, 2)
            result.at[idx, 'is_fatigued'] = fatigue_score >= self.fatigue_threshold * 100
            
            if fatigue_score >= self.fatigue_threshold * 100:
                result.at[idx, 'performance_trend'] = '衰退'
            elif fatigue_score >= self.fatigue_threshold * 50:
                result.at[idx, 'performance_trend'] = '下滑'
            else:
                result.at[idx, 'performance_trend'] = '稳定'
        
        return result
    
    def get_overall_summary(self, df: pd.DataFrame) -> Dict:
        if df.empty:
            return {}
        
        df_with_metrics = self.calculate_basic_metrics(df)
        
        total_spend = df_with_metrics['spend'].sum()
        total_impression = df_with_metrics['impression'].sum()
        total_click = df_with_metrics['click'].sum()
        total_conversion = df_with_metrics['conversion'].sum()
        total_revenue = df_with_metrics.get('revenue', 0).sum()
        
        avg_ctr = (total_click / total_impression * 100) if total_impression > 0 else 0
        avg_cpc = (total_spend / total_click) if total_click > 0 else 0
        avg_cpm = (total_spend / total_impression * 1000) if total_impression > 0 else 0
        avg_cpa = (total_spend / total_conversion) if total_conversion > 0 else 0
        avg_roi = (total_revenue / total_spend) if total_spend > 0 else 0
        
        platforms = df_with_metrics['platform'].unique().tolist()
        date_range = (df_with_metrics['date'].min(), df_with_metrics['date'].max())
        materials_count = df_with_metrics['material_id'].nunique()
        
        return {
            'total_spend': round(total_spend, 2),
            'total_impression': int(total_impression),
            'total_click': int(total_click),
            'total_conversion': int(total_conversion),
            'total_revenue': round(total_revenue, 2),
            'avg_ctr': round(avg_ctr, 4),
            'avg_cpc': round(avg_cpc, 4),
            'avg_cpm': round(avg_cpm, 4),
            'avg_cpa': round(avg_cpa, 4),
            'avg_roi': round(avg_roi, 4),
            'platforms': platforms,
            'date_range': date_range,
            'materials_count': materials_count
        }
    
    def get_platform_comparison(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame()
        
        daily = self.aggregate_by_date(df)
        
        platform_agg = daily.groupby('platform').agg({
            'spend': ['sum', 'mean'],
            'impression': ['sum', 'mean'],
            'click': ['sum', 'mean'],
            'conversion': ['sum', 'mean'],
            'revenue': 'sum',
            'ctr': 'mean',
            'cpc': 'mean',
            'cpm': 'mean',
            'cpa': 'mean',
            'roi': 'mean'
        }).reset_index()
        
        platform_agg.columns = ['_'.join(col).strip('_') if col[1] else col[0] 
                                for col in platform_agg.columns.values]
        
        platform_agg = platform_agg.rename(columns={
            'spend_sum': '总花费',
            'spend_mean': '日均花费',
            'impression_sum': '总曝光',
            'impression_mean': '日均曝光',
            'click_sum': '总点击',
            'click_mean': '日均点击',
            'conversion_sum': '总转化',
            'conversion_mean': '日均转化',
            'revenue_sum': '总营收',
            'ctr_mean': '平均CTR',
            'cpc_mean': '平均CPC',
            'cpm_mean': '平均CPM',
            'cpa_mean': '平均CPA',
            'roi_mean': '平均ROI'
        })
        
        return platform_agg
