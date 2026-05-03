import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import date
from enum import Enum


class AnomalyType(Enum):
    SPEND_SURGE = "花费突增"
    CONVERSION_CLIFF = "转化断崖"
    CROSS_PLATFORM_DIFF = "跨平台表现差异"
    LOW_ROI = "ROI过低"
    HIGH_CPA = "CPA过高"


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    date: Optional[date]
    platform: str
    material_id: Optional[str]
    severity: str
    message: str
    current_value: float
    baseline_value: float
    change_pct: float
    details: Dict = None


class RuleEngine:
    def __init__(self):
        self.spend_surge_threshold = 2.0
        self.conversion_cliff_threshold = 0.5
        self.cross_platform_diff_threshold = 2.0
        self.low_roi_threshold = 1.0
        self.high_cpa_threshold = 50.0
        self.baseline_days = 7

    def detect_all_anomalies(
        self, 
        daily_df: pd.DataFrame, 
        material_df: pd.DataFrame
    ) -> Dict[str, List[Anomaly]]:
        anomalies = {
            'spend_surge': [],
            'conversion_cliff': [],
            'cross_platform_diff': [],
            'low_roi': [],
            'high_cpa': []
        }
        
        if not daily_df.empty:
            anomalies['spend_surge'] = self.detect_spend_surge(daily_df)
            anomalies['conversion_cliff'] = self.detect_conversion_cliff(daily_df)
        
        if not material_df.empty:
            anomalies['cross_platform_diff'] = self.detect_cross_platform_diff(material_df)
            anomalies['low_roi'] = self.detect_low_roi(material_df)
            anomalies['high_cpa'] = self.detect_high_cpa(material_df)
        
        return anomalies

    def detect_spend_surge(self, df: pd.DataFrame) -> List[Anomaly]:
        anomalies = []
        
        if df.empty:
            return anomalies
        
        df_sorted = df.sort_values(['platform', 'date'])
        
        for platform in df_sorted['platform'].unique():
            platform_data = df_sorted[df_sorted['platform'] == platform].copy()
            
            for i in range(1, len(platform_data)):
                current = platform_data.iloc[i]
                previous = platform_data.iloc[i-1]
                
                if previous['spend'] > 0:
                    surge_ratio = current['spend'] / previous['spend']
                    change_pct = (surge_ratio - 1) * 100
                    
                    if surge_ratio >= self.spend_surge_threshold and current['spend'] > previous['spend']:
                        severity = self._get_severity(surge_ratio, self.spend_surge_threshold)
                        anomalies.append(Anomaly(
                            anomaly_type=AnomalyType.SPEND_SURGE,
                            date=current['date'],
                            platform=platform,
                            material_id=None,
                            severity=severity,
                            message=f"{platform} 在 {current['date']} 花费突增",
                            current_value=current['spend'],
                            baseline_value=previous['spend'],
                            change_pct=change_pct,
                            details={
                                'current_spend': current['spend'],
                                'previous_spend': previous['spend'],
                                'surge_ratio': surge_ratio
                            }
                        ))
        
        return anomalies

    def detect_conversion_cliff(self, df: pd.DataFrame) -> List[Anomaly]:
        anomalies = []
        
        if df.empty:
            return anomalies
        
        df_sorted = df.sort_values(['platform', 'date'])
        
        for platform in df_sorted['platform'].unique():
            platform_data = df_sorted[df_sorted['platform'] == platform].copy()
            
            for i in range(1, len(platform_data)):
                current = platform_data.iloc[i]
                previous = platform_data.iloc[i-1]
                
                if previous['conversion'] > 0:
                    cliff_ratio = current['conversion'] / previous['conversion']
                    change_pct = (cliff_ratio - 1) * 100
                    
                    if cliff_ratio <= self.conversion_cliff_threshold and current['conversion'] < previous['conversion']:
                        severity = self._get_severity(1 / cliff_ratio, 1 / self.conversion_cliff_threshold)
                        anomalies.append(Anomaly(
                            anomaly_type=AnomalyType.CONVERSION_CLIFF,
                            date=current['date'],
                            platform=platform,
                            material_id=None,
                            severity=severity,
                            message=f"{platform} 在 {current['date']} 转化断崖",
                            current_value=current['conversion'],
                            baseline_value=previous['conversion'],
                            change_pct=change_pct,
                            details={
                                'current_conversion': current['conversion'],
                                'previous_conversion': previous['conversion'],
                                'cliff_ratio': cliff_ratio
                            }
                        ))
        
        return anomalies

    def detect_cross_platform_diff(self, df: pd.DataFrame) -> List[Anomaly]:
        anomalies = []
        
        if df.empty:
            return anomalies
        
        material_groups = df.groupby('material_id')
        
        for material_id, group in material_groups:
            if len(group) < 2:
                continue
            
            platforms = group['platform'].tolist()
            rois = group['avg_roi'].tolist()
            spends = group['total_spend'].tolist()
            
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    roi_i = rois[i]
                    roi_j = rois[j]
                    
                    if roi_j > 0 and roi_i > 0:
                        diff_ratio = roi_i / roi_j if roi_i > roi_j else roi_j / roi_i
                        
                        if diff_ratio >= self.cross_platform_diff_threshold:
                            worse_platform = platforms[i] if roi_i < roi_j else platforms[j]
                            worse_roi = roi_i if roi_i < roi_j else roi_j
                            better_platform = platforms[j] if roi_i < roi_j else platforms[i]
                            better_roi = roi_j if roi_i < roi_j else roi_i
                            change_pct = (diff_ratio - 1) * 100
                            
                            severity = self._get_severity(diff_ratio, self.cross_platform_diff_threshold)
                            anomalies.append(Anomaly(
                                anomaly_type=AnomalyType.CROSS_PLATFORM_DIFF,
                                date=None,
                                platform=worse_platform,
                                material_id=material_id,
                                severity=severity,
                                message=f"素材 {material_id} 在 {worse_platform} 与 {better_platform} 表现差异大",
                                current_value=worse_roi,
                                baseline_value=better_roi,
                                change_pct=change_pct,
                                details={
                                    'material_id': material_id,
                                    'worse_platform': worse_platform,
                                    'better_platform': better_platform,
                                    'worse_roi': worse_roi,
                                    'better_roi': better_roi,
                                    'diff_ratio': diff_ratio
                                }
                            ))
        
        return anomalies

    def detect_low_roi(self, df: pd.DataFrame) -> List[Anomaly]:
        anomalies = []
        
        if df.empty:
            return anomalies
        
        low_roi_materials = df[df['avg_roi'] < self.low_roi_threshold]
        
        for _, row in low_roi_materials.iterrows():
            if row['total_spend'] > 0:
                change_pct = (row['avg_roi'] - self.low_roi_threshold) / self.low_roi_threshold * 100
                severity = '高' if row['avg_roi'] < 0.3 else '中' if row['avg_roi'] < 0.6 else '低'
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.LOW_ROI,
                    date=None,
                    platform=row['platform'],
                    material_id=row['material_id'],
                    severity=severity,
                    message=f"素材 {row['material_id']} 在 {row['platform']} ROI过低",
                    current_value=row['avg_roi'],
                    baseline_value=self.low_roi_threshold,
                    change_pct=change_pct,
                    details={
                        'material_id': row['material_id'],
                        'platform': row['platform'],
                        'total_spend': row['total_spend'],
                        'avg_roi': row['avg_roi']
                    }
                ))
        
        return anomalies

    def detect_high_cpa(self, df: pd.DataFrame) -> List[Anomaly]:
        anomalies = []
        
        if df.empty:
            return anomalies
        
        high_cpa_materials = df[
            (df['avg_cpa'] > self.high_cpa_threshold) & 
            (df['total_conversion'] > 0)
        ]
        
        for _, row in high_cpa_materials.iterrows():
            change_pct = (row['avg_cpa'] - self.high_cpa_threshold) / self.high_cpa_threshold * 100
            severity = self._get_severity(row['avg_cpa'] / self.high_cpa_threshold, 1.0)
            
            anomalies.append(Anomaly(
                anomaly_type=AnomalyType.HIGH_CPA,
                date=None,
                platform=row['platform'],
                material_id=row['material_id'],
                severity=severity,
                message=f"素材 {row['material_id']} 在 {row['platform']} CPA过高",
                current_value=row['avg_cpa'],
                baseline_value=self.high_cpa_threshold,
                change_pct=change_pct,
                details={
                    'material_id': row['material_id'],
                    'platform': row['platform'],
                    'total_spend': row['total_spend'],
                    'total_conversion': row['total_conversion'],
                    'avg_cpa': row['avg_cpa']
                }
            ))
        
        return anomalies

    def _get_severity(self, ratio: float, threshold: float) -> str:
        if ratio >= threshold * 3:
            return '高'
        elif ratio >= threshold * 2:
            return '中'
        else:
            return '低'

    def anomalies_to_dataframe(self, anomalies: Dict[str, List[Anomaly]]) -> pd.DataFrame:
        records = []
        
        for anomaly_type, anomaly_list in anomalies.items():
            for anomaly in anomaly_list:
                records.append({
                    '异常类型': anomaly.anomaly_type.value,
                    '日期': anomaly.date if anomaly.date else 'N/A',
                    '平台': anomaly.platform,
                    '素材ID': anomaly.material_id if anomaly.material_id else 'N/A',
                    '严重程度': anomaly.severity,
                    '当前值': round(anomaly.current_value, 2),
                    '基准值': round(anomaly.baseline_value, 2),
                    '变化率(%)': round(anomaly.change_pct, 2),
                    '描述': anomaly.message
                })
        
        if records:
            return pd.DataFrame(records)
        return pd.DataFrame(columns=[
            '异常类型', '日期', '平台', '素材ID', '严重程度',
            '当前值', '基准值', '变化率(%)', '描述'
        ])
