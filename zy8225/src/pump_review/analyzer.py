"""
分析模块 - 时间线重建、特征标准化、聚类分析和漂移检测
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
import warnings
warnings.filterwarnings('ignore')


class BoundaryType(Enum):
    """边界类型枚举"""
    POST_MAINTENANCE_HIGH_RISK = "检修后仍高风险"
    SENSOR_GAP = "传感器断采"
    CROSS_MIDNIGHT_SHIFT = "跨午夜班次归属"
    SCORE_DRIFT = "分数漂移"
    MODEL_ANOMALY = "模型异常"


@dataclass
class BoundaryCase:
    """边界案例数据类"""
    pump_id: str
    boundary_type: BoundaryType
    timestamp: datetime
    description: str
    severity: str = "medium"
    details: Dict[str, Any] = field(default_factory=dict)
    recommendation: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'pump_id': self.pump_id,
            'boundary_type': self.boundary_type.value,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'description': self.description,
            'severity': self.severity,
            'details': str(self.details),
            'recommendation': self.recommendation
        }


@dataclass
class DriftCase:
    """漂移案例数据类"""
    pump_id: str
    model: str
    drift_start_time: datetime
    drift_end_time: Optional[datetime]
    baseline_score_mean: float
    current_score_mean: float
    score_change_pct: float
    cluster_before: int
    cluster_after: int
    feature_changes: Dict[str, float]
    confidence: float
    is_significant: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'pump_id': self.pump_id,
            'model': self.model,
            'drift_start_time': self.drift_start_time.isoformat(),
            'drift_end_time': self.drift_end_time.isoformat() if self.drift_end_time else None,
            'baseline_score_mean': round(self.baseline_score_mean, 4),
            'current_score_mean': round(self.current_score_mean, 4),
            'score_change_pct': round(self.score_change_pct, 2),
            'cluster_before': self.cluster_before,
            'cluster_after': self.cluster_after,
            'feature_changes': str(self.feature_changes),
            'confidence': round(self.confidence, 2),
            'is_significant': self.is_significant
        }


class TimelineReconstructor:
    """时间线重建器 - 按泵组和班次组织数据"""
    
    SHIFT_CONFIG = {
        'day': {'start_hour': 8, 'end_hour': 20, 'name': '白班'},
        'night': {'start_hour': 20, 'end_hour': 8, 'name': '夜班'}
    }
    
    def __init__(self):
        self.timelines: Dict[str, pd.DataFrame] = {}
        self.shift_assignments: Dict[str, List[Dict]] = {}
    
    def reconstruct_timeline(
        self,
        alarm_scores: pd.DataFrame,
        vibration_features: pd.DataFrame,
        pump_id: str
    ) -> pd.DataFrame:
        """
        为指定泵重建时间线，合并告警分数和振动特征
        """
        pump_alarms = alarm_scores[alarm_scores['pump_id'] == pump_id].copy()
        pump_features = vibration_features[vibration_features['pump_id'] == pump_id].copy()
        
        if pump_alarms.empty:
            return pd.DataFrame()
        
        pump_alarms = pump_alarms.sort_values('timestamp').reset_index(drop=True)
        pump_features = pump_features.sort_values('timestamp').reset_index(drop=True)
        
        if not pump_features.empty:
            merged = pd.merge_asof(
                pump_alarms,
                pump_features,
                on='timestamp',
                by='pump_id',
                direction='nearest',
                tolerance=pd.Timedelta('1H')
            )
        else:
            merged = pump_alarms
        
        merged = self._assign_shifts(merged)
        merged = self._detect_cross_midnight(merged)
        
        self.timelines[pump_id] = merged
        return merged
    
    def _assign_shifts(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        为每条记录分配班次
        """
        if df.empty:
            return df
        
        df = df.copy()
        df['hour'] = df['timestamp'].dt.hour
        df['date'] = df['timestamp'].dt.date
        
        def get_shift(hour: int) -> Tuple[str, str]:
            day_config = self.SHIFT_CONFIG['day']
            night_config = self.SHIFT_CONFIG['night']
            
            if day_config['start_hour'] <= hour < day_config['end_hour']:
                return 'day', day_config['name']
            else:
                return 'night', night_config['name']
        
        shift_info = df['hour'].apply(lambda h: pd.Series(get_shift(h)))
        df['shift_type'] = shift_info[0]
        df['shift_name'] = shift_info[1]
        
        return df
    
    def _detect_cross_midnight(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        检测跨午夜的班次记录
        """
        if df.empty or len(df) < 2:
            df['is_cross_midnight'] = False
            return df
        
        df = df.copy()
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        df['is_cross_midnight'] = False
        df['cross_midnight_group'] = 0
        
        group_counter = 0
        for i in range(1, len(df)):
            prev_hour = df.loc[i-1, 'hour']
            curr_hour = df.loc[i, 'hour']
            
            if prev_hour >= 23 and curr_hour == 0:
                group_counter += 1
                df.loc[i, 'is_cross_midnight'] = True
            
            df.loc[i, 'cross_midnight_group'] = group_counter
        
        return df
    
    def get_shift_summary(self, pump_id: str) -> Dict[str, Any]:
        """
        获取指定泵的班次汇总
        """
        if pump_id not in self.timelines:
            return {}
        
        df = self.timelines[pump_id]
        
        summary = {
            'pump_id': pump_id,
            'total_records': len(df),
            'date_range': {
                'start': df['timestamp'].min().isoformat(),
                'end': df['timestamp'].max().isoformat()
            },
            'shift_distribution': df['shift_name'].value_counts().to_dict(),
            'cross_midnight_count': int(df['is_cross_midnight'].sum()),
            'high_score_count': int(len(df[df['score'] > 0.6])) if 'score' in df.columns else 0
        }
        
        return summary


class FeatureNormalizer:
    """特征标准化器"""
    
    STANDARD_FEATURES = [
        'rms_x', 'rms_y', 'rms_z',
        'peak_x', 'peak_y', 'peak_z',
        'kurtosis_x', 'kurtosis_y', 'kurtosis_z',
        'crest_factor', 'score'
    ]
    
    def __init__(self):
        self.scalers: Dict[str, StandardScaler] = {}
        self.feature_stats: Dict[str, Dict[str, float]] = {}
    
    def normalize_features(
        self,
        df: pd.DataFrame,
        model: str = None,
        fit: bool = True
    ) -> Tuple[pd.DataFrame, List[str]]:
        """
        标准化特征
        
        Args:
            df: 包含特征的数据框
            model: 泵型号，用于分组标准化
            fit: 是否拟合新的scaler，False时使用已有的
        
        Returns:
            (标准化后的数据框, 使用的特征列表)
        """
        if df.empty:
            return df, []
        
        available_features = [f for f in self.STANDARD_FEATURES if f in df.columns]
        
        if not available_features:
            return df, []
        
        df = df.copy()
        scaler_key = model if model else 'global'
        
        if fit:
            scaler = StandardScaler()
            df.loc[:, available_features] = scaler.fit_transform(df[available_features])
            self.scalers[scaler_key] = scaler
            
            stats = {}
            for i, feature in enumerate(available_features):
                stats[feature] = {
                    'mean': float(scaler.mean_[i]),
                    'std': float(np.sqrt(scaler.var_[i])) if scaler.var_ is not None else 1.0
                }
            self.feature_stats[scaler_key] = stats
        else:
            if scaler_key in self.scalers:
                df.loc[:, available_features] = self.scalers[scaler_key].transform(df[available_features])
        
        return df, available_features
    
    def get_feature_stats(self, model: str = None) -> Dict[str, Dict[str, float]]:
        """获取特征统计信息"""
        scaler_key = model if model else 'global'
        return self.feature_stats.get(scaler_key, {})


class LightweightClusterer:
    """轻量级聚类器"""
    
    def __init__(self, n_clusters: int = 3, eps: float = 0.5):
        self.n_clusters = n_clusters
        self.eps = eps
        self.kmeans_models: Dict[str, KMeans] = {}
        self.cluster_centers: Dict[str, np.ndarray] = {}
    
    def cluster_by_model(
        self,
        df: pd.DataFrame,
        features: List[str],
        model: str,
        method: str = 'kmeans'
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        按型号对泵进行聚类
        
        Args:
            df: 包含特征和pump_id的数据框
            features: 用于聚类的特征列表
            model: 泵型号
            method: 聚类方法 ('kmeans' 或 'dbscan')
        
        Returns:
            (添加了cluster标签的数据框, 聚类信息字典)
        """
        if df.empty or not features:
            return df, {}
        
        df = df.copy()
        
        pump_features = df.groupby('pump_id')[features].mean().reset_index()
        
        X = pump_features[features].values
        
        if method == 'kmeans':
            n_clusters = min(self.n_clusters, len(pump_features))
            if n_clusters < 2:
                df['cluster'] = 0
                return df, {'method': 'kmeans', 'n_clusters': 1, 'pumps': len(pump_features)}
            
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            pump_features['cluster'] = kmeans.fit_predict(X)
            
            self.kmeans_models[model] = kmeans
            self.cluster_centers[model] = kmeans.cluster_centers_
            
            cluster_info = {
                'method': 'kmeans',
                'n_clusters': n_clusters,
                'inertia': float(kmeans.inertia_),
                'cluster_sizes': pump_features['cluster'].value_counts().to_dict(),
                'pumps_per_cluster': pump_features.groupby('cluster')['pump_id'].apply(list).to_dict()
            }
        
        else:
            dbscan = DBSCAN(eps=self.eps, min_samples=2)
            pump_features['cluster'] = dbscan.fit_predict(X)
            
            cluster_info = {
                'method': 'dbscan',
                'eps': self.eps,
                'n_clusters': len(set(pump_features['cluster'])) - (1 if -1 in pump_features['cluster'].values else 0),
                'noise_count': int((pump_features['cluster'] == -1).sum()),
                'cluster_sizes': pump_features['cluster'].value_counts().to_dict()
            }
        
        cluster_map = dict(zip(pump_features['pump_id'], pump_features['cluster']))
        df['cluster'] = df['pump_id'].map(cluster_map)
        
        return df, cluster_info
    
    def get_cluster_centers(self, model: str) -> Optional[np.ndarray]:
        """获取指定型号的聚类中心"""
        return self.cluster_centers.get(model)
    
    def detect_cluster_shift(
        self,
        df_before: pd.DataFrame,
        df_after: pd.DataFrame,
        features: List[str],
        pump_id: str,
        model: str
    ) -> Dict[str, Any]:
        """
        检测单个泵的聚类偏移
        
        Args:
            df_before: 漂移前的数据
            df_after: 漂移后的数据
            features: 特征列表
            pump_id: 泵ID
            model: 泵型号
        
        Returns:
            偏移检测结果
        """
        if df_before.empty or df_after.empty:
            return {'has_shift': False}
        
        pump_before = df_before[df_before['pump_id'] == pump_id]
        pump_after = df_after[df_after['pump_id'] == pump_id]
        
        if pump_before.empty or pump_after.empty:
            return {'has_shift': False}
        
        before_mean = pump_before[features].mean().values
        after_mean = pump_after[features].mean().values
        
        feature_changes = {}
        for i, feature in enumerate(features):
            change = after_mean[i] - before_mean[i]
            feature_changes[feature] = float(change)
        
        euclidean_dist = float(np.linalg.norm(after_mean - before_mean))
        cosine_sim = float(
            np.dot(before_mean, after_mean) / 
            (np.linalg.norm(before_mean) * np.linalg.norm(after_mean) + 1e-8)
        )
        
        has_shift = euclidean_dist > 1.0 or cosine_sim < 0.7
        
        return {
            'has_shift': has_shift,
            'euclidean_distance': euclidean_dist,
            'cosine_similarity': cosine_sim,
            'feature_changes': feature_changes,
            'before_cluster': int(pump_before['cluster'].iloc[0]) if 'cluster' in pump_before.columns else -1,
            'after_cluster': int(pump_after['cluster'].iloc[0]) if 'cluster' in pump_after.columns else -1
        }


class DriftDetector:
    """漂移检测器"""
    
    def __init__(
        self,
        score_threshold: float = 0.6,
        drift_window_hours: int = 24,
        baseline_days: int = 7
    ):
        self.score_threshold = score_threshold
        self.drift_window_hours = drift_window_hours
        self.baseline_days = baseline_days
        self.drift_cases: List[DriftCase] = []
        self.boundary_cases: List[BoundaryCase] = []
    
    def detect_score_drift(
        self,
        timeline: pd.DataFrame,
        pump_id: str,
        model: str,
        clusterer: LightweightClusterer = None
    ) -> List[DriftCase]:
        """
        检测分数漂移
        
        Args:
            timeline: 泵的时间线数据
            pump_id: 泵ID
            model: 泵型号
            clusterer: 聚类器实例
        
        Returns:
            漂移案例列表
        """
        if timeline.empty or 'score' not in timeline.columns:
            return []
        
        timeline = timeline.copy()
        timeline = timeline.sort_values('timestamp').reset_index(drop=True)
        
        if len(timeline) < 10:
            return []
        
        baseline_cutoff = timeline['timestamp'].max() - pd.Timedelta(days=self.baseline_days)
        baseline_data = timeline[timeline['timestamp'] <= baseline_cutoff]
        
        if baseline_data.empty:
            baseline_data = timeline.iloc[:len(timeline)//2]
        
        current_data = timeline[timeline['timestamp'] > baseline_cutoff]
        
        if current_data.empty:
            current_data = timeline.iloc[len(timeline)//2:]
        
        baseline_mean = baseline_data['score'].mean()
        current_mean = current_data['score'].mean()
        
        score_change_pct = ((current_mean - baseline_mean) / (baseline_mean + 1e-8)) * 100
        
        high_score_current = current_data[current_data['score'] > self.score_threshold]
        high_score_baseline = baseline_data[baseline_data['score'] > self.score_threshold]
        
        current_high_ratio = len(high_score_current) / len(current_data) if len(current_data) > 0 else 0
        baseline_high_ratio = len(high_score_baseline) / len(baseline_data) if len(baseline_data) > 0 else 0
        
        is_significant = (
            score_change_pct > 50 and
            current_mean > self.score_threshold * 0.8 and
            current_high_ratio > baseline_high_ratio * 1.5
        )
        
        confidence = min(1.0, (
            abs(score_change_pct) / 100 +
            current_high_ratio +
            (1 if 'cluster' in timeline.columns and 
             timeline.iloc[0]['cluster'] != timeline.iloc[-1]['cluster'] else 0)
        ) / 3)
        
        feature_changes = {}
        feature_cols = [c for c in timeline.columns if c in FeatureNormalizer.STANDARD_FEATURES and c != 'score']
        for col in feature_cols:
            if col in baseline_data.columns and col in current_data.columns:
                baseline_val = baseline_data[col].mean()
                current_val = current_data[col].mean()
                if baseline_val > 0:
                    feature_changes[col] = round(((current_val - baseline_val) / baseline_val) * 100, 2)
        
        if is_significant or confidence > 0.6:
            drift_case = DriftCase(
                pump_id=pump_id,
                model=model,
                drift_start_time=current_data['timestamp'].min(),
                drift_end_time=current_data['timestamp'].max(),
                baseline_score_mean=baseline_mean,
                current_score_mean=current_mean,
                score_change_pct=score_change_pct,
                cluster_before=int(timeline.iloc[0]['cluster']) if 'cluster' in timeline.columns else -1,
                cluster_after=int(timeline.iloc[-1]['cluster']) if 'cluster' in timeline.columns else -1,
                feature_changes=feature_changes,
                confidence=confidence,
                is_significant=is_significant
            )
            self.drift_cases.append(drift_case)
        
        return self.drift_cases
    
    def detect_boundary_cases(
        self,
        timeline: pd.DataFrame,
        pump_id: str,
        maintenance_records: List[Dict],
        vibration_features: pd.DataFrame
    ) -> List[BoundaryCase]:
        """
        检测边界案例
        
        检测:
        1. 检修后仍高风险
        2. 传感器断采
        3. 跨午夜班次归属
        """
        self.boundary_cases = []
        
        if timeline.empty:
            return []
        
        pump_maintenance = [m for m in maintenance_records if m['pump_id'] == pump_id]
        self._check_post_maintenance_risk(timeline, pump_id, pump_maintenance)
        
        pump_features = vibration_features[vibration_features['pump_id'] == pump_id]
        self._check_sensor_gaps(pump_features, pump_id)
        
        self._check_cross_midnight_shifts(timeline, pump_id)
        
        return self.boundary_cases
    
    def _check_post_maintenance_risk(
        self,
        timeline: pd.DataFrame,
        pump_id: str,
        maintenance_records: List[Dict]
    ):
        """检查检修后仍高风险的情况"""
        if 'score' not in timeline.columns:
            return
        
        for record in maintenance_records:
            ma_date = record.get('maintenance_date')
            if ma_date is None:
                continue
            
            if isinstance(ma_date, str):
                ma_date = pd.to_datetime(ma_date)
            
            post_ma_window = timeline[
                (timeline['timestamp'] > ma_date) &
                (timeline['timestamp'] <= ma_date + pd.Timedelta(days=7))
            ]
            
            if len(post_ma_window) < 5:
                continue
            
            high_score_count = len(post_ma_window[post_ma_window['score'] > self.score_threshold])
            high_score_ratio = high_score_count / len(post_ma_window)
            
            if high_score_ratio > 0.3:
                boundary_case = BoundaryCase(
                    pump_id=pump_id,
                    boundary_type=BoundaryType.POST_MAINTENANCE_HIGH_RISK,
                    timestamp=ma_date,
                    description=f"检修后7天内高告警分数比例为 {high_score_ratio:.1%}",
                    severity="high" if high_score_ratio > 0.5 else "medium",
                    details={
                        'maintenance_date': ma_date.isoformat(),
                        'maintenance_type': record.get('maintenance_type', '未知'),
                        'high_score_count': high_score_count,
                        'total_records': len(post_ma_window),
                        'avg_score': float(post_ma_window['score'].mean())
                    },
                    recommendation="建议重新评估检修效果，检查是否有未发现的问题"
                )
                self.boundary_cases.append(boundary_case)
    
    def _check_sensor_gaps(
        self,
        vibration_features: pd.DataFrame,
        pump_id: str
    ):
        """检查传感器断采情况"""
        if vibration_features.empty:
            return
        
        df = vibration_features.sort_values('timestamp').reset_index(drop=True)
        
        if len(df) < 2:
            return
        
        df['time_diff'] = df['timestamp'].diff()
        
        gap_threshold = pd.Timedelta(hours=4)
        gaps = df[df['time_diff'] > gap_threshold]
        
        for idx, gap in gaps.iterrows():
            gap_start = df.loc[idx-1, 'timestamp']
            gap_end = gap['timestamp']
            gap_duration = gap['time_diff']
            
            boundary_case = BoundaryCase(
                pump_id=pump_id,
                boundary_type=BoundaryType.SENSOR_GAP,
                timestamp=gap_start,
                description=f"传感器数据断采，断采时长: {gap_duration}",
                severity="medium" if gap_duration > pd.Timedelta(hours=12) else "low",
                details={
                    'gap_start': gap_start.isoformat(),
                    'gap_end': gap_end.isoformat(),
                    'gap_duration_hours': round(gap_duration.total_seconds() / 3600, 2)
                },
                recommendation="检查传感器连接状态和数据采集系统"
            )
            self.boundary_cases.append(boundary_case)
        
        null_cols = []
        feature_cols = ['rms_x', 'rms_y', 'rms_z', 'peak_x', 'peak_y', 'peak_z']
        for col in feature_cols:
            if col in df.columns:
                null_ratio = df[col].isnull().sum() / len(df)
                if null_ratio > 0.2:
                    null_cols.append({'feature': col, 'null_ratio': null_ratio})
        
        for nc in null_cols:
            boundary_case = BoundaryCase(
                pump_id=pump_id,
                boundary_type=BoundaryType.SENSOR_GAP,
                timestamp=df['timestamp'].min(),
                description=f"特征 {nc['feature']} 缺失率过高: {nc['null_ratio']:.1%}",
                severity="medium",
                details=nc,
                recommendation="检查对应传感器通道"
            )
            self.boundary_cases.append(boundary_case)
    
    def _check_cross_midnight_shifts(
        self,
        timeline: pd.DataFrame,
        pump_id: str
    ):
        """检查跨午夜班次归属问题"""
        if 'is_cross_midnight' not in timeline.columns:
            return
        
        cross_midnight_records = timeline[timeline['is_cross_midnight']]
        
        for idx, record in cross_midnight_records.iterrows():
            ts = record['timestamp']
            hour = ts.hour
            
            if hour < 4:
                recommended_shift = '夜班(前一天)'
            else:
                recommended_shift = '白班'
            
            boundary_case = BoundaryCase(
                pump_id=pump_id,
                boundary_type=BoundaryType.CROSS_MIDNIGHT_SHIFT,
                timestamp=ts,
                description=f"跨午夜数据点，当前班次: {record.get('shift_name', '未知')}",
                severity="low",
                details={
                    'timestamp': ts.isoformat(),
                    'hour': hour,
                    'current_shift': record.get('shift_name', '未知'),
                    'recommended_shift': recommended_shift
                },
                recommendation="建议根据业务规则统一跨午夜数据的班次归属"
            )
            self.boundary_cases.append(boundary_case)


class PumpAnalyzer:
    """泵分析主类 - 整合所有分析功能"""
    
    def __init__(
        self,
        parser,
        score_threshold: float = 0.6,
        n_clusters: int = 3
    ):
        self.parser = parser
        self.score_threshold = score_threshold
        
        self.timeline_reconstructor = TimelineReconstructor()
        self.feature_normalizer = FeatureNormalizer()
        self.clusterer = LightweightClusterer(n_clusters=n_clusters)
        self.drift_detector = DriftDetector(score_threshold=score_threshold)
        
        self.analysis_results: Dict[str, Any] = {}
    
    def run_full_analysis(self) -> Dict[str, Any]:
        """
        执行完整分析流程
        
        Returns:
            完整分析结果
        """
        print("开始执行完整分析流程...")
        
        all_pumps = self.parser.pump_ledger['pump_id'].tolist()
        all_models = self.parser.get_all_models()
        
        print(f"共发现 {len(all_pumps)} 台泵，{len(all_models)} 种型号")
        
        print("\n1. 重建各泵时间线...")
        all_timelines = []
        for pump_id in all_pumps:
            timeline = self.timeline_reconstructor.reconstruct_timeline(
                self.parser.alarm_scores,
                self.parser.vibration_features,
                pump_id
            )
            if not timeline.empty:
                all_timelines.append(timeline)
        
        combined_timeline = pd.concat(all_timelines, ignore_index=True) if all_timelines else pd.DataFrame()
        
        print("\n2. 标准化特征...")
        normalized_by_model = {}
        for model in all_models:
            model_pumps = self.parser.get_pumps_by_model(model)
            model_data = combined_timeline[combined_timeline['pump_id'].isin(model_pumps)]
            
            if not model_data.empty:
                normalized, features = self.feature_normalizer.normalize_features(
                    model_data, model=model, fit=True
                )
                normalized_by_model[model] = {'data': normalized, 'features': features}
        
        print("\n3. 按型号聚类分析...")
        cluster_results = {}
        for model in all_models:
            if model in normalized_by_model:
                data = normalized_by_model[model]['data']
                features = normalized_by_model[model]['features']
                
                clustered_data, cluster_info = self.clusterer.cluster_by_model(
                    data, features, model=model, method='kmeans'
                )
                cluster_results[model] = {
                    'data': clustered_data,
                    'info': cluster_info,
                    'features': features
                }
                print(f"  {model}: {cluster_info.get('n_clusters', 0)} 个聚类")
        
        print("\n4. 检测分数漂移...")
        drift_cases = []
        for pump_id in all_pumps:
            pump_info = self.parser.get_pump_info(pump_id)
            if not pump_info:
                continue
            
            model = pump_info.get('model', '')
            
            timeline = self.timeline_reconstructor.timelines.get(pump_id, pd.DataFrame())
            if timeline.empty:
                continue
            
            if model in cluster_results:
                model_data = cluster_results[model]['data']
                pump_cluster_data = model_data[model_data['pump_id'] == pump_id]
                if not pump_cluster_data.empty:
                    timeline = timeline.copy()
                    timeline['cluster'] = pump_cluster_data['cluster'].iloc[0]
            
            cases = self.drift_detector.detect_score_drift(
                timeline, pump_id, model, self.clusterer
            )
            drift_cases.extend(cases)
        
        print(f"  检测到 {len(drift_cases)} 个潜在漂移案例")
        
        print("\n5. 检测边界案例...")
        boundary_cases = []
        for pump_id in all_pumps:
            timeline = self.timeline_reconstructor.timelines.get(pump_id, pd.DataFrame())
            
            cases = self.drift_detector.detect_boundary_cases(
                timeline,
                pump_id,
                self.parser.maintenance_records,
                self.parser.vibration_features
            )
            boundary_cases.extend(cases)
        
        print(f"  检测到 {len(boundary_cases)} 个边界案例")
        
        self.analysis_results = {
            'summary': {
                'total_pumps': len(all_pumps),
                'total_models': len(all_models),
                'analysis_time': datetime.now().isoformat(),
                'drift_cases_count': len(drift_cases),
                'boundary_cases_count': len(boundary_cases)
            },
            'timelines': self.timeline_reconstructor.timelines,
            'normalized_data': normalized_by_model,
            'cluster_results': cluster_results,
            'drift_cases': drift_cases,
            'boundary_cases': boundary_cases,
            'shift_summaries': {
                pid: self.timeline_reconstructor.get_shift_summary(pid)
                for pid in all_pumps
            }
        }
        
        print("\n分析完成!")
        return self.analysis_results
    
    def get_drift_cases_df(self) -> pd.DataFrame:
        """获取漂移案例DataFrame"""
        if not self.analysis_results or 'drift_cases' not in self.analysis_results:
            return pd.DataFrame()
        
        cases = self.analysis_results['drift_cases']
        if not cases:
            return pd.DataFrame()
        
        return pd.DataFrame([case.to_dict() for case in cases])
    
    def get_boundary_cases_df(self) -> pd.DataFrame:
        """获取边界案例DataFrame"""
        if not self.analysis_results or 'boundary_cases' not in self.analysis_results:
            return pd.DataFrame()
        
        cases = self.analysis_results['boundary_cases']
        if not cases:
            return pd.DataFrame()
        
        return pd.DataFrame([case.to_dict() for case in cases])
