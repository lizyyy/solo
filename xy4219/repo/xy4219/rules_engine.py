import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import date


class AnomalyType(Enum):
    SPEND_SURGE = "花费突增"
    CONVERSION_DROP = "转化断崖"
    CROSS_PLATFORM_DIFF = "跨平台差异"
    LOW_ROI = "低ROI"
    HIGH_CPA = "高CPA"


class Severity(Enum):
    CRITICAL = "严重"
    WARNING = "警告"
    INFO = "提示"


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: Severity
    date: Optional[date]
    platform: Optional[str]
    material_id: Optional[str]
    description: str
    current_value: float
    expected_value: float
    deviation_percent: float
    additional_info: Dict = field(default_factory=dict)


class RulesEngine:
    def __init__(self):
        self.config = {
            'spend_surge_threshold': 2.0,
            'conversion_drop_threshold': 0.5,
            'cross_platform_diff_threshold': 0.3,
            'low_roi_threshold': 1.0,
            'high_cpa_threshold': 100.0,
            'lookback_days': 7
        }
    
    def update_config(self, **kwargs):
        self.config.update(kwargs)
    
    def detect_spend_surge(
        self, 
        df: pd.DataFrame, 
        threshold: float = None
    ) -> List[Anomaly]:
        anomalies = []
        if df.empty:
            return anomalies
        
        threshold = threshold or self.config['spend_surge_threshold']
        lookback = self.config['lookback_days']
        
        df_sorted = df.sort_values(['platform', 'material_id', 'date'])
        
        for platform in df_sorted['platform'].unique():
            platform_df = df_sorted[df_sorted['platform'] == platform]
            
            for material_id in platform_df['material_id'].unique():
                material_df = platform_df[platform_df['material_id'] == material_id].copy()
                material_df = material_df.sort_values('date')
                
                if len(material_df) < 2:
                    continue
                
                for i in range(1, len(material_df)):
                    current_date = material_df.iloc[i]['date']
                    current_spend = material_df.iloc[i]['spend']
                    
                    lookback_start = max(0, i - lookback)
                    historical_spend = material_df.iloc[lookback_start:i]['spend'].mean()
                    
                    if historical_spend > 0 and current_spend > 0:
                        ratio = current_spend / historical_spend
                        
                        if ratio >= threshold:
                            deviation = (ratio - 1) * 100
                            
                            severity = Severity.WARNING
                            if ratio >= threshold * 1.5:
                                severity = Severity.CRITICAL
                            
                            anomalies.append(Anomaly(
                                anomaly_type=AnomalyType.SPEND_SURGE,
                                severity=severity,
                                date=current_date,
                                platform=platform,
                                material_id=material_id,
                                description=f"花费突增{deviation:.1f}%",
                                current_value=current_spend,
                                expected_value=historical_spend,
                                deviation_percent=deviation,
                                additional_info={
                                    'historical_days': i - lookback_start,
                                    'ratio': ratio
                                }
                            ))
        
        return anomalies
    
    def detect_conversion_drop(
        self, 
        df: pd.DataFrame, 
        threshold: float = None
    ) -> List[Anomaly]:
        anomalies = []
        if df.empty:
            return anomalies
        
        threshold = threshold or self.config['conversion_drop_threshold']
        lookback = self.config['lookback_days']
        
        df_sorted = df.sort_values(['platform', 'material_id', 'date'])
        
        for platform in df_sorted['platform'].unique():
            platform_df = df_sorted[df_sorted['platform'] == platform]
            
            for material_id in platform_df['material_id'].unique():
                material_df = platform_df[platform_df['material_id'] == material_id].copy()
                material_df = material_df.sort_values('date')
                
                if len(material_df) < 3:
                    continue
                
                for i in range(2, len(material_df)):
                    current_date = material_df.iloc[i]['date']
                    current_conversion = material_df.iloc[i]['conversion']
                    
                    lookback_start = max(0, i - lookback)
                    historical_conversion = material_df.iloc[lookback_start:i]['conversion'].mean()
                    
                    if historical_conversion > 0:
                        drop_ratio = 1 - (current_conversion / historical_conversion)
                        
                        if drop_ratio >= threshold:
                            deviation = drop_ratio * 100
                            
                            severity = Severity.WARNING
                            if drop_ratio >= threshold * 1.5:
                                severity = Severity.CRITICAL
                            
                            anomalies.append(Anomaly(
                                anomaly_type=AnomalyType.CONVERSION_DROP,
                                severity=severity,
                                date=current_date,
                                platform=platform,
                                material_id=material_id,
                                description=f"转化断崖式下降{deviation:.1f}%",
                                current_value=current_conversion,
                                expected_value=historical_conversion,
                                deviation_percent=deviation,
                                additional_info={
                                    'historical_days': i - lookback_start,
                                    'drop_ratio': drop_ratio
                                }
                            ))
        
        return anomalies
    
    def detect_cross_platform_diff(
        self, 
        df: pd.DataFrame, 
        material_df: pd.DataFrame,
        threshold: float = None
    ) -> List[Anomaly]:
        anomalies = []
        if df.empty or material_df.empty:
            return anomalies
        
        threshold = threshold or self.config['cross_platform_diff_threshold']
        
        material_groups = material_df.groupby('material_id')
        
        for material_id, group in material_groups:
            if len(group) < 2:
                continue
            
            platforms = group['platform'].tolist()
            ctr_values = group['avg_ctr'].tolist()
            cpc_values = group['avg_cpc'].tolist()
            roi_values = group['avg_roi'].tolist()
            
            max_ctr = max(ctr_values)
            min_ctr = min(ctr_values)
            ctr_diff = (max_ctr - min_ctr) / (max_ctr + 0.001) if max_ctr > 0 else 0
            
            max_cpc = max(cpc_values)
            min_cpc = min(cpc_values)
            cpc_diff = (max_cpc - min_cpc) / (max_cpc + 0.001) if max_cpc > 0 else 0
            
            max_roi = max(roi_values)
            min_roi = min(roi_values)
            roi_diff = (max_roi - min_roi) / (max_roi + 0.001) if max_roi > 0 else 0
            
            if ctr_diff >= threshold or cpc_diff >= threshold or roi_diff >= threshold:
                best_platform_idx = roi_values.index(max_roi)
                worst_platform_idx = roi_values.index(min_roi)
                
                best_platform = platforms[best_platform_idx]
                worst_platform = platforms[worst_platform_idx]
                
                avg_diff = (ctr_diff + cpc_diff + roi_diff) / 3 * 100
                
                severity = Severity.INFO
                if avg_diff >= threshold * 100 * 1.5:
                    severity = Severity.WARNING
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.CROSS_PLATFORM_DIFF,
                    severity=severity,
                    date=None,
                    platform=f"{best_platform} vs {worst_platform}",
                    material_id=material_id,
                    description=f"同素材跨平台表现差异显著",
                    current_value=avg_diff,
                    expected_value=threshold * 100,
                    deviation_percent=avg_diff - threshold * 100,
                    additional_info={
                        'platforms': platforms,
                        'ctr_values': ctr_values,
                        'cpc_values': cpc_values,
                        'roi_values': roi_values,
                        'best_platform': best_platform,
                        'worst_platform': worst_platform
                    }
                ))
        
        return anomalies
    
    def detect_low_roi(
        self, 
        material_df: pd.DataFrame, 
        threshold: float = None
    ) -> List[Anomaly]:
        anomalies = []
        if material_df.empty:
            return anomalies
        
        threshold = threshold or self.config['low_roi_threshold']
        
        for _, row in material_df.iterrows():
            if row['total_spend'] > 100 and row['avg_roi'] < threshold:
                deviation = (threshold - row['avg_roi']) / threshold * 100
                
                severity = Severity.WARNING
                if row['avg_roi'] < threshold * 0.5:
                    severity = Severity.CRITICAL
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.LOW_ROI,
                    severity=severity,
                    date=None,
                    platform=row['platform'],
                    material_id=row['material_id'],
                    description=f"ROI过低({row['avg_roi']:.2f})",
                    current_value=row['avg_roi'],
                    expected_value=threshold,
                    deviation_percent=deviation,
                    additional_info={
                        'total_spend': row['total_spend'],
                        'total_revenue': row.get('total_revenue', 0)
                    }
                ))
        
        return anomalies
    
    def detect_high_cpa(
        self, 
        material_df: pd.DataFrame, 
        threshold: float = None
    ) -> List[Anomaly]:
        anomalies = []
        if material_df.empty:
            return anomalies
        
        threshold = threshold or self.config['high_cpa_threshold']
        
        for _, row in material_df.iterrows():
            if row['total_conversion'] > 0 and row['avg_cpa'] > threshold:
                deviation = (row['avg_cpa'] - threshold) / threshold * 100
                
                severity = Severity.WARNING
                if row['avg_cpa'] > threshold * 2:
                    severity = Severity.CRITICAL
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.HIGH_CPA,
                    severity=severity,
                    date=None,
                    platform=row['platform'],
                    material_id=row['material_id'],
                    description=f"CPA过高({row['avg_cpa']:.2f}元)",
                    current_value=row['avg_cpa'],
                    expected_value=threshold,
                    deviation_percent=deviation,
                    additional_info={
                        'total_spend': row['total_spend'],
                        'total_conversion': row['total_conversion']
                    }
                ))
        
        return anomalies
    
    def run_all_rules(
        self, 
        df: pd.DataFrame, 
        material_df: pd.DataFrame
    ) -> Dict[AnomalyType, List[Anomaly]]:
        all_anomalies = {
            AnomalyType.SPEND_SURGE: [],
            AnomalyType.CONVERSION_DROP: [],
            AnomalyType.CROSS_PLATFORM_DIFF: [],
            AnomalyType.LOW_ROI: [],
            AnomalyType.HIGH_CPA: []
        }
        
        all_anomalies[AnomalyType.SPEND_SURGE] = self.detect_spend_surge(df)
        all_anomalies[AnomalyType.CONVERSION_DROP] = self.detect_conversion_drop(df)
        all_anomalies[AnomalyType.CROSS_PLATFORM_DIFF] = self.detect_cross_platform_diff(
            df, material_df
        )
        all_anomalies[AnomalyType.LOW_ROI] = self.detect_low_roi(material_df)
        all_anomalies[AnomalyType.HIGH_CPA] = self.detect_high_cpa(material_df)
        
        return all_anomalies
    
    def get_anomaly_summary(
        self, 
        anomalies: Dict[AnomalyType, List[Anomaly]]
    ) -> Dict:
        total_count = 0
        critical_count = 0
        warning_count = 0
        info_count = 0
        
        by_type = {}
        
        for anomaly_type, type_anomalies in anomalies.items():
            count = len(type_anomalies)
            total_count += count
            
            type_critical = sum(1 for a in type_anomalies if a.severity == Severity.CRITICAL)
            type_warning = sum(1 for a in type_anomalies if a.severity == Severity.WARNING)
            type_info = sum(1 for a in type_anomalies if a.severity == Severity.INFO)
            
            critical_count += type_critical
            warning_count += type_warning
            info_count += type_info
            
            by_type[anomaly_type.value] = {
                'count': count,
                'critical': type_critical,
                'warning': type_warning,
                'info': type_info
            }
        
        return {
            'total_count': total_count,
            'critical_count': critical_count,
            'warning_count': warning_count,
            'info_count': info_count,
            'by_type': by_type
        }
    
    def anomalies_to_dataframe(
        self, 
        anomalies: Dict[AnomalyType, List[Anomaly]]
    ) -> pd.DataFrame:
        records = []
        
        for anomaly_type, type_anomalies in anomalies.items():
            for anomaly in type_anomalies:
                records.append({
                    '异常类型': anomaly.anomaly_type.value,
                    '严重程度': anomaly.severity.value,
                    '日期': anomaly.date if anomaly.date else '-',
                    '平台': anomaly.platform if anomaly.platform else '-',
                    '素材ID': anomaly.material_id if anomaly.material_id else '-',
                    '描述': anomaly.description,
                    '当前值': anomaly.current_value,
                    '预期值': anomaly.expected_value,
                    '偏差(%)': round(anomaly.deviation_percent, 2)
                })
        
        return pd.DataFrame(records)
