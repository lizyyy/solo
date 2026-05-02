"""
模型推理模块
- 轻量级异常检测
- 基于统计和机器学习的方法
- 支持增量学习和历史数据对比
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import warnings

import numpy as np
import pandas as pd


class AnomalyType(Enum):
    """异常类型枚举"""
    NORMAL = "正常"
    SPALLING = "轻微剥落"
    SENSOR_LOOSE = "传感器松动"
    IMPULSIVE = "冲击性故障"
    VIBRATION_HIGH = "整体振动偏高"
    UNCERTAIN = "不确定"


@dataclass
class FrameAnomalyResult:
    """单帧异常检测结果"""
    frame_idx: int
    start_time: float
    end_time: float
    
    anomaly_score: float = 0.0
    anomaly_probability: float = 0.0
    is_anomaly: bool = False
    
    anomaly_type: AnomalyType = AnomalyType.NORMAL
    contributing_features: Dict[str, float] = field(default_factory=dict)
    
    model_scores: Dict[str, float] = field(default_factory=dict)


@dataclass
class TripAnomalyResult:
    """单趟异常检测结果"""
    trip_id: str
    
    frame_results: List[FrameAnomalyResult] = field(default_factory=list)
    global_score: float = 0.0
    
    has_anomaly: bool = False
    primary_anomaly_type: AnomalyType = AnomalyType.NORMAL
    
    anomaly_frames: List[int] = field(default_factory=list)
    suspicious_frames: List[int] = field(default_factory=list)
    
    confidence: float = 0.0


class AnomalyDetector:
    """轻量级异常检测器"""
    
    MODEL_CONFIGS = {
        "isolation_forest": {
            "n_estimators": 100,
            "contamination": 0.05,
            "max_samples": "auto"
        },
        "elliptic_envelope": {
            "contamination": 0.05,
            "support_fraction": 0.9
        },
        "lof": {
            "n_neighbors": 20,
            "contamination": 0.05
        }
    }
    
    FEATURE_WEIGHTS = {
        "kurtosis": 2.0,
        "crest_factor": 1.5,
        "impulse_factor": 1.5,
        "margin_factor": 1.2,
        "rms": 1.0,
        "peak": 1.0,
        "harmonic_ratio_1x": 1.8,
        "harmonic_ratio_2x": 1.5,
        "harmonic_ratio_3x": 1.2,
        "band_energy_high": 1.3
    }
    
    def __init__(self,
                 baseline_data: Optional[pd.DataFrame] = None,
                 use_ensemble: bool = True,
                 anomaly_threshold: float = 0.7):
        """
        初始化异常检测器
        
        参数:
            baseline_data: 基线数据（用于建立正常模型）
            use_ensemble: 是否使用集成方法
            anomaly_threshold: 异常阈值 (0-1)
        """
        self.baseline_data = baseline_data
        self.use_ensemble = use_ensemble
        self.anomaly_threshold = anomaly_threshold
        
        self.models: Dict[str, Any] = {}
        self.feature_scaler: Optional[Any] = None
        self.baseline_stats: Dict[str, Dict] = {}
        
        if baseline_data is not None:
            self._fit_baseline(baseline_data)
    
    def _fit_baseline(self, baseline_data: pd.DataFrame):
        """
        使用基线数据建立正常模型
        """
        feature_cols = [col for col in baseline_data.columns 
                       if col.startswith("time_") or col.startswith("freq_")]
        
        if not feature_cols:
            warnings.warn("基线数据中未找到特征列，将使用默认统计值")
            return
        
        for col in feature_cols:
            values = baseline_data[col].dropna()
            if len(values) > 0:
                self.baseline_stats[col] = {
                    "mean": float(values.mean()),
                    "std": float(values.std()),
                    "median": float(values.median()),
                    "p95": float(values.quantile(0.95)),
                    "p99": float(values.quantile(0.99))
                }
        
        try:
            from sklearn.preprocessing import StandardScaler
            
            X = baseline_data[feature_cols].fillna(0).values
            
            self.feature_scaler = StandardScaler()
            X_scaled = self.feature_scaler.fit_transform(X)
            
            if self.use_ensemble:
                from sklearn.ensemble import IsolationForest
                from sklearn.covariance import EllipticEnvelope
                from sklearn.neighbors import LocalOutlierFactor
                
                self.models["isolation_forest"] = IsolationForest(
                    **self.MODEL_CONFIGS["isolation_forest"],
                    random_state=42
                )
                self.models["isolation_forest"].fit(X_scaled)
                
                try:
                    self.models["elliptic_envelope"] = EllipticEnvelope(
                        **self.MODEL_CONFIGS["elliptic_envelope"],
                        random_state=42
                    )
                    self.models["elliptic_envelope"].fit(X_scaled)
                except Exception as e:
                    warnings.warn(f"EllipticEnvelope 拟合失败: {e}")
                
                self.models["lof"] = LocalOutlierFactor(
                    **self.MODEL_CONFIGS["lof"],
                    novelty=True
                )
                self.models["lof"].fit(X_scaled)
                
        except ImportError:
            warnings.warn("scikit-learn 未安装，将仅使用统计方法")
    
    def detect(self,
               features_df: pd.DataFrame,
               global_features: Optional[Dict] = None) -> TripAnomalyResult:
        """
        检测异常
        
        参数:
            features_df: 帧特征 DataFrame
            global_features: 全局特征字典
            
        返回:
            TripAnomalyResult 检测结果
        """
        if features_df is None or len(features_df) == 0:
            return TripAnomalyResult(trip_id="unknown")
        
        frame_results = []
        anomaly_frames = []
        suspicious_frames = []
        
        for idx, row in features_df.iterrows():
            frame_result = self._detect_frame(row, features_df)
            frame_results.append(frame_result)
            
            if frame_result.is_anomaly:
                anomaly_frames.append(frame_result.frame_idx)
            elif frame_result.anomaly_score > self.anomaly_threshold * 0.5:
                suspicious_frames.append(frame_result.frame_idx)
        
        global_score = self._calculate_global_score(frame_results, global_features)
        
        has_anomaly = len(anomaly_frames) > 0
        
        primary_anomaly_type = self._determine_primary_anomaly(frame_results)
        
        confidence = self._calculate_confidence(frame_results)
        
        return TripAnomalyResult(
            trip_id=features_df.get("trip_id", "unknown") if hasattr(features_df, 'get') else "unknown",
            frame_results=frame_results,
            global_score=global_score,
            has_anomaly=has_anomaly,
            primary_anomaly_type=primary_anomaly_type,
            anomaly_frames=anomaly_frames,
            suspicious_frames=suspicious_frames,
            confidence=confidence
        )
    
    def _detect_frame(self,
                      frame_row: pd.Series,
                      all_frames: pd.DataFrame) -> FrameAnomalyResult:
        """
        检测单帧异常
        """
        frame_idx = int(frame_row.get("frame_idx", 0))
        start_time = float(frame_row.get("start_time", 0.0))
        end_time = float(frame_row.get("end_time", 0.0))
        
        scores = {}
        
        stat_score = self._calculate_statistical_score(frame_row, all_frames)
        scores["statistical"] = stat_score
        
        model_score = self._calculate_model_score(frame_row)
        scores["model"] = model_score
        
        rule_score = self._calculate_rule_score(frame_row)
        scores["rule"] = rule_score
        
        if self.use_ensemble and self.models:
            weights = {"statistical": 0.3, "model": 0.4, "rule": 0.3}
        else:
            weights = {"statistical": 0.4, "model": 0.2, "rule": 0.4}
        
        final_score = sum(
            scores.get(method, 0.0) * weights.get(method, 0.25)
            for method in ["statistical", "model", "rule"]
        )
        
        final_score = max(0.0, min(1.0, final_score))
        
        is_anomaly = final_score >= self.anomaly_threshold
        
        anomaly_type = self._classify_anomaly_type(frame_row, final_score)
        
        contributing_features = self._identify_contributing_features(frame_row, all_frames)
        
        return FrameAnomalyResult(
            frame_idx=frame_idx,
            start_time=start_time,
            end_time=end_time,
            anomaly_score=final_score,
            anomaly_probability=final_score,
            is_anomaly=is_anomaly,
            anomaly_type=anomaly_type,
            contributing_features=contributing_features,
            model_scores=scores
        )
    
    def _calculate_statistical_score(self,
                                      frame_row: pd.Series,
                                      all_frames: pd.DataFrame) -> float:
        """
        计算统计异常分数
        """
        feature_cols = [col for col in frame_row.index 
                       if col.startswith("time_") or col.startswith("freq_")]
        
        if not feature_cols:
            return 0.0
        
        z_scores = []
        
        for col in feature_cols:
            value = frame_row[col]
            
            if pd.isna(value):
                continue
            
            baseline = self.baseline_stats.get(col, {})
            
            if baseline:
                mean_val = baseline.get("mean", 0)
                std_val = baseline.get("std", 1)
            else:
                all_values = all_frames[col].dropna()
                if len(all_values) > 1:
                    mean_val = all_values.mean()
                    std_val = all_values.std()
                else:
                    mean_val = 0
                    std_val = 1
            
            if std_val > 0:
                z_score = abs(value - mean_val) / std_val
            else:
                z_score = 0.0
            
            feature_name = col.replace("time_", "").replace("freq_", "")
            weight = self.FEATURE_WEIGHTS.get(feature_name, 1.0)
            z_scores.append(z_score * weight)
        
        if not z_scores:
            return 0.0
        
        avg_z = np.mean(z_scores)
        max_z = np.max(z_scores)
        
        combined_score = 0.6 * max_z + 0.4 * avg_z
        
        normalized_score = 1.0 - np.exp(-combined_score / 3.0)
        
        return normalized_score
    
    def _calculate_model_score(self, frame_row: pd.Series) -> float:
        """
        计算模型异常分数
        """
        if not self.models or self.feature_scaler is None:
            return 0.0
        
        feature_cols = [col for col in frame_row.index 
                       if col.startswith("time_") or col.startswith("freq_")]
        
        if not feature_cols:
            return 0.0
        
        X = frame_row[feature_cols].fillna(0).values.reshape(1, -1)
        
        try:
            X_scaled = self.feature_scaler.transform(X)
            
            scores = []
            
            if "isolation_forest" in self.models:
                if_pred = self.models["isolation_forest"].decision_function(X_scaled)[0]
                if_score = 1.0 - (if_pred + 0.5)
                scores.append(if_score)
            
            if "elliptic_envelope" in self.models:
                try:
                    ee_pred = self.models["elliptic_envelope"].decision_function(X_scaled)[0]
                    ee_score = 1.0 - 1.0 / (1.0 + np.exp(-ee_pred / 10.0))
                    scores.append(ee_score)
                except:
                    pass
            
            if "lof" in self.models:
                try:
                    lof_pred = self.models["lof"].decision_function(X_scaled)[0]
                    lof_score = 1.0 - (lof_pred + 1.5)
                    scores.append(max(0.0, lof_score))
                except:
                    pass
            
            if scores:
                return float(np.mean(scores))
            
        except Exception as e:
            warnings.warn(f"模型预测失败: {e}")
        
        return 0.0
    
    def _calculate_rule_score(self, frame_row: pd.Series) -> float:
        """
        计算基于规则的异常分数
        """
        score = 0.0
        
        kurtosis = frame_row.get("time_kurtosis", 3.0)
        if kurtosis > 10.0:
            score += 0.3 * min(1.0, (kurtosis - 10.0) / 20.0)
        elif kurtosis > 6.0:
            score += 0.15 * min(1.0, (kurtosis - 6.0) / 10.0)
        
        crest = frame_row.get("time_crest_factor", 1.0)
        if crest > 6.0:
            score += 0.25 * min(1.0, (crest - 6.0) / 10.0)
        elif crest > 4.0:
            score += 0.1 * min(1.0, (crest - 4.0) / 5.0)
        
        harmonic_1x = frame_row.get("freq_harmonic_ratio_1x", 0.0)
        harmonic_2x = frame_row.get("freq_harmonic_ratio_2x", 0.0)
        harmonic_3x = frame_row.get("freq_harmonic_ratio_3x", 0.0)
        
        total_harmonic = harmonic_1x + harmonic_2x + harmonic_3x
        if total_harmonic > 0.5:
            score += 0.3 * min(1.0, (total_harmonic - 0.5) / 0.5)
        
        rms = frame_row.get("time_rms", 0.0)
        if rms > 0:
            pass
        
        band_high = frame_row.get("freq_band_energy_high", 0.0)
        if band_high > 0.3:
            score += 0.15 * min(1.0, (band_high - 0.3) / 0.4)
        
        return min(1.0, score)
    
    def _classify_anomaly_type(self,
                                frame_row: pd.Series,
                                score: float) -> AnomalyType:
        """
        分类异常类型
        """
        if score < 0.3:
            return AnomalyType.NORMAL
        
        kurtosis = frame_row.get("time_kurtosis", 3.0)
        crest = frame_row.get("time_crest_factor", 1.0)
        impulse = frame_row.get("time_impulse_factor", 1.0)
        
        harmonic_1x = frame_row.get("freq_harmonic_ratio_1x", 0.0)
        harmonic_2x = frame_row.get("freq_harmonic_ratio_2x", 0.0)
        harmonic_3x = frame_row.get("freq_harmonic_ratio_3x", 0.0)
        
        total_harmonic = harmonic_1x + harmonic_2x + harmonic_3x
        
        if total_harmonic > 0.5 and crest < 5.0:
            return AnomalyType.SENSOR_LOOSE
        
        if kurtosis > 8.0 or crest > 5.0:
            if kurtosis > 15.0:
                return AnomalyType.IMPULSIVE
            else:
                return AnomalyType.SPALLING
        
        rms = frame_row.get("time_rms", 0.0)
        peak = frame_row.get("time_peak", 0.0)
        
        if score > 0.7:
            return AnomalyType.VIBRATION_HIGH
        
        return AnomalyType.UNCERTAIN
    
    def _identify_contributing_features(self,
                                         frame_row: pd.Series,
                                         all_frames: pd.DataFrame) -> Dict[str, float]:
        """
        识别导致异常的关键特征
        """
        contributing = {}
        
        feature_cols = [col for col in frame_row.index 
                       if col.startswith("time_") or col.startswith("freq_")]
        
        for col in feature_cols:
            value = frame_row[col]
            if pd.isna(value):
                continue
            
            all_values = all_frames[col].dropna()
            if len(all_values) < 2:
                continue
            
            mean_val = all_values.mean()
            std_val = all_values.std()
            
            if std_val > 0:
                z_score = abs(value - mean_val) / std_val
                if z_score > 2.0:
                    contributing[col] = float(z_score)
        
        return dict(sorted(contributing.items(), key=lambda x: x[1], reverse=True)[:5])
    
    def _calculate_global_score(self,
                                 frame_results: List[FrameAnomalyResult],
                                 global_features: Optional[Dict]) -> float:
        """
        计算全局异常分数
        """
        if not frame_results:
            return 0.0
        
        frame_scores = [fr.anomaly_score for fr in frame_results]
        
        max_score = max(frame_scores) if frame_scores else 0.0
        mean_score = np.mean(frame_scores) if frame_scores else 0.0
        std_score = np.std(frame_scores) if frame_scores else 0.0
        
        anomaly_count = sum(1 for fr in frame_results if fr.is_anomaly)
        anomaly_ratio = anomaly_count / len(frame_results) if frame_results else 0.0
        
        global_score = (
            0.4 * max_score +
            0.3 * mean_score +
            0.2 * anomaly_ratio +
            0.1 * min(1.0, std_score * 2.0)
        )
        
        if global_features:
            kurtosis_spike = global_features.get("kurtosis_spike_score", 0.0)
            if kurtosis_spike > 3.0:
                global_score += 0.1 * min(1.0, (kurtosis_spike - 3.0) / 5.0)
            
            rms_variability = global_features.get("rms_variability", 0.0)
            if rms_variability > 0.5:
                global_score += 0.05
        
        return min(1.0, global_score)
    
    def _determine_primary_anomaly(self,
                                    frame_results: List[FrameAnomalyResult]) -> AnomalyType:
        """
        确定主要异常类型
        """
        type_counts = {}
        
        for fr in frame_results:
            if fr.anomaly_type != AnomalyType.NORMAL:
                type_counts[fr.anomaly_type] = type_counts.get(fr.anomaly_type, 0) + 1
        
        if not type_counts:
            return AnomalyType.NORMAL
        
        return max(type_counts.items(), key=lambda x: x[1])[0]
    
    def _calculate_confidence(self, frame_results: List[FrameAnomalyResult]) -> float:
        """
        计算检测置信度
        """
        if not frame_results:
            return 0.5
        
        anomaly_frames = [fr for fr in frame_results if fr.is_anomaly]
        
        if not anomaly_frames:
            normal_scores = [fr.anomaly_score for fr in frame_results]
            return 0.7 if max(normal_scores) < 0.3 else 0.5
        
        avg_probability = np.mean([fr.anomaly_probability for fr in anomaly_frames])
        
        method_agreement = []
        for fr in anomaly_frames:
            scores = list(fr.model_scores.values())
            if len(scores) >= 2:
                agreement = 1.0 - np.std(scores)
                method_agreement.append(agreement)
        
        agreement_score = np.mean(method_agreement) if method_agreement else 0.5
        
        anomaly_ratio = len(anomaly_frames) / len(frame_results)
        consistency_score = 1.0 - abs(anomaly_ratio - 0.5)
        
        confidence = (
            0.5 * avg_probability +
            0.3 * agreement_score +
            0.2 * consistency_score
        )
        
        return min(1.0, max(0.0, confidence))
    
    def update_baseline(self, new_data: pd.DataFrame):
        """
        更新基线数据（增量学习）
        """
        if self.baseline_data is None:
            self.baseline_data = new_data
        else:
            self.baseline_data = pd.concat([self.baseline_data, new_data], ignore_index=True)
        
        self._fit_baseline(self.baseline_data)
    
    def get_anomaly_summary(self, result: TripAnomalyResult) -> Dict:
        """
        获取异常摘要
        """
        summary = {
            "trip_id": result.trip_id,
            "has_anomaly": result.has_anomaly,
            "global_score": result.global_score,
            "primary_anomaly_type": result.primary_anomaly_type.value,
            "confidence": result.confidence,
            "anomaly_frame_count": len(result.anomaly_frames),
            "suspicious_frame_count": len(result.suspicious_frames),
            "total_frames": len(result.frame_results)
        }
        
        if result.frame_results:
            type_distribution = {}
            for fr in result.frame_results:
                t = fr.anomaly_type.value
                type_distribution[t] = type_distribution.get(t, 0) + 1
            summary["type_distribution"] = type_distribution
        
        return summary
