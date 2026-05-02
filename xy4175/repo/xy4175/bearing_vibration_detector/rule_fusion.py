"""
规则融合模块
- 结合AI模型输出和专家规则
- 给出风险等级和解释
- 支持基于历史复核数据的动态调整
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

import numpy as np
import pandas as pd

from .model_inference import TripAnomalyResult, FrameAnomalyResult, AnomalyType


class RiskLevel(Enum):
    """风险等级"""
    GREEN = "绿色 - 正常"
    YELLOW = "黄色 - 关注"
    ORANGE = "橙色 - 警告"
    RED = "红色 - 紧急"


@dataclass
class RiskEvidence:
    """风险证据"""
    evidence_type: str
    description: str
    severity: float
    supporting_data: Dict = field(default_factory=dict)


@dataclass
class FrameRiskResult:
    """单帧风险结果"""
    frame_idx: int
    start_time: float
    end_time: float
    
    risk_level: RiskLevel = RiskLevel.GREEN
    risk_score: float = 0.0
    
    evidence: List[RiskEvidence] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class TripRiskResult:
    """单趟风险结果"""
    trip_id: str
    analysis_time: str
    
    overall_risk: RiskLevel = RiskLevel.GREEN
    overall_score: float = 0.0
    
    frame_results: List[FrameRiskResult] = field(default_factory=list)
    
    primary_concern: str = ""
    evidence_summary: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    confidence: float = 0.0
    review_status: str = "待复核"


class RuleFusion:
    """规则融合器"""
    
    RISK_THRESHOLDS = {
        "red": 0.85,
        "orange": 0.65,
        "yellow": 0.40,
        "green": 0.0
    }
    
    ANOMALY_TYPE_WEIGHTS = {
        AnomalyType.SPALLING: 0.8,
        AnomalyType.SENSOR_LOOSE: 0.7,
        AnomalyType.IMPULSIVE: 0.9,
        AnomalyType.VIBRATION_HIGH: 0.6,
        AnomalyType.UNCERTAIN: 0.4,
        AnomalyType.NORMAL: 0.0
    }
    
    EXPERT_RULES = {
        "high_kurtosis": {
            "condition": lambda x: x.get("time_kurtosis", 3.0) > 10.0,
            "severity": 0.8,
            "description": "峭度值过高，可能存在冲击性故障"
        },
        "high_crest": {
            "condition": lambda x: x.get("time_crest_factor", 1.0) > 6.0,
            "severity": 0.7,
            "description": "峰值因子过高，可能存在局部缺陷"
        },
        "harmonic_pattern": {
            "condition": lambda x: (
                x.get("freq_harmonic_ratio_1x", 0.0) + 
                x.get("freq_harmonic_ratio_2x", 0.0) + 
                x.get("freq_harmonic_ratio_3x", 0.0)
            ) > 0.5,
            "severity": 0.6,
            "description": "存在明显的谐波成分，可能是传感器松动或对中不良"
        },
        "high_frequency_energy": {
            "condition": lambda x: x.get("freq_band_energy_high", 0.0) > 0.4,
            "severity": 0.5,
            "description": "高频能量占比较高，可能存在早期轴承损伤"
        },
        "rms_increase": {
            "condition": lambda x: x.get("rms_increase_ratio", 1.0) > 1.5,
            "severity": 0.6,
            "description": "RMS值较基线显著升高"
        }
    }
    
    def __init__(self,
                 historical_data: Optional[pd.DataFrame] = None,
                 custom_rules: Optional[Dict] = None):
        """
        初始化规则融合器
        
        参数:
            historical_data: 历史复核数据
            custom_rules: 自定义专家规则
        """
        self.historical_data = historical_data
        self.custom_rules = custom_rules or {}
        
        self._baseline_stats = {}
        self._rule_weights = self._initialize_rule_weights()
        
        if historical_data is not None:
            self._learn_from_history(historical_data)
    
    def _initialize_rule_weights(self) -> Dict[str, float]:
        """
        初始化规则权重
        """
        weights = {
            "model_score": 0.4,
            "expert_rules": 0.35,
            "historical_correlation": 0.15,
            "anomaly_type": 0.10
        }
        return weights
    
    def _learn_from_history(self, historical_data: pd.DataFrame):
        """
        从历史数据学习
        """
        if "risk_level" in historical_data.columns:
            level_counts = historical_data["risk_level"].value_counts()
            total = len(historical_data)
            
            for level, count in level_counts.items():
                self._baseline_stats[f"historical_{level}_ratio"] = count / total
        
        feature_cols = [col for col in historical_data.columns 
                       if col.startswith("time_") or col.startswith("freq_")]
        
        if feature_cols and "risk_score" in historical_data.columns:
            try:
                from scipy.stats import pearsonr
                
                for col in feature_cols:
                    valid_data = historical_data[[col, "risk_score"]].dropna()
                    if len(valid_data) > 10:
                        corr, _ = pearsonr(valid_data[col], valid_data["risk_score"])
                        self._baseline_stats[f"corr_{col}"] = corr
            except:
                pass
    
    def fuse(self,
             anomaly_result: TripAnomalyResult,
             features_df: Optional[pd.DataFrame] = None,
             validation_warnings: Optional[List[str]] = None) -> TripRiskResult:
        """
        融合AI模型输出和专家规则，给出最终风险评估
        
        参数:
            anomaly_result: AI模型异常检测结果
            features_df: 特征 DataFrame
            validation_warnings: 数据校验警告
            
        返回:
            TripRiskResult 风险评估结果
        """
        frame_results = []
        
        for frame_anomaly in anomaly_result.frame_results:
            frame_risk = self._fuse_frame(frame_anomaly, features_df)
            frame_results.append(frame_risk)
        
        overall_risk, overall_score = self._calculate_overall_risk(frame_results)
        
        primary_concern = self._identify_primary_concern(frame_results, anomaly_result)
        
        evidence_summary = self._compile_evidence_summary(frame_results, anomaly_result)
        
        recommendations = self._generate_recommendations(
            overall_risk, primary_concern, frame_results, validation_warnings
        )
        
        confidence = self._calculate_confidence(
            frame_results, anomaly_result, validation_warnings
        )
        
        return TripRiskResult(
            trip_id=anomaly_result.trip_id,
            analysis_time=datetime.now().isoformat(),
            overall_risk=overall_risk,
            overall_score=overall_score,
            frame_results=frame_results,
            primary_concern=primary_concern,
            evidence_summary=evidence_summary,
            recommendations=recommendations,
            confidence=confidence,
            review_status="待复核"
        )
    
    def _fuse_frame(self,
                    frame_anomaly: FrameAnomalyResult,
                    features_df: Optional[pd.DataFrame]) -> FrameRiskResult:
        """
        融合单帧的模型输出和规则
        """
        frame_features = {}
        if features_df is not None:
            matching = features_df[features_df["frame_idx"] == frame_anomaly.frame_idx]
            if len(matching) > 0:
                frame_features = matching.iloc[0].to_dict()
        
        model_score = frame_anomaly.anomaly_score
        
        rule_score, rule_evidence = self._apply_expert_rules(frame_features)
        
        anomaly_type_score = self.ANOMALY_TYPE_WEIGHTS.get(
            frame_anomaly.anomaly_type, 0.0
        )
        
        historical_score = self._calculate_historical_score(frame_features)
        
        final_score = (
            self._rule_weights["model_score"] * model_score +
            self._rule_weights["expert_rules"] * rule_score +
            self._rule_weights["historical_correlation"] * historical_score +
            self._rule_weights["anomaly_type"] * anomaly_type_score
        )
        
        final_score = max(0.0, min(1.0, final_score))
        
        risk_level = self._score_to_risk_level(final_score)
        
        evidence = []
        
        if model_score > 0.5:
            evidence.append(RiskEvidence(
                evidence_type="AI模型检测",
                description=f"AI模型检测到异常信号，分数: {model_score:.2f}",
                severity=model_score * 0.8
            ))
        
        evidence.extend(rule_evidence)
        
        if frame_anomaly.anomaly_type != AnomalyType.NORMAL:
            type_desc = self._get_anomaly_type_description(frame_anomaly.anomaly_type)
            evidence.append(RiskEvidence(
                evidence_type="异常类型",
                description=type_desc,
                severity=anomaly_type_score
            ))
        
        recommendations = self._generate_frame_recommendations(
            risk_level, frame_anomaly, frame_features
        )
        
        return FrameRiskResult(
            frame_idx=frame_anomaly.frame_idx,
            start_time=frame_anomaly.start_time,
            end_time=frame_anomaly.end_time,
            risk_level=risk_level,
            risk_score=final_score,
            evidence=evidence,
            recommendations=recommendations
        )
    
    def _apply_expert_rules(self, features: Dict) -> Tuple[float, List[RiskEvidence]]:
        """
        应用专家规则
        """
        total_score = 0.0
        evidence_list = []
        
        all_rules = {**self.EXPERT_RULES, **self.custom_rules}
        
        for rule_name, rule in all_rules.items():
            try:
                if rule["condition"](features):
                    severity = rule["severity"]
                    total_score = max(total_score, severity)
                    
                    evidence_list.append(RiskEvidence(
                        evidence_type=f"专家规则: {rule_name}",
                        description=rule["description"],
                        severity=severity
                    ))
            except Exception as e:
                pass
        
        return total_score, evidence_list
    
    def _calculate_historical_score(self, features: Dict) -> float:
        """
        计算基于历史相关性的分数
        """
        if not self._baseline_stats:
            return 0.0
        
        max_corr_score = 0.0
        
        for key, corr in self._baseline_stats.items():
            if key.startswith("corr_"):
                feature_name = key.replace("corr_", "")
                
                if feature_name in features:
                    value = features[feature_name]
                    
                    if not pd.isna(value) and abs(corr) > 0.3:
                        if corr > 0:
                            score = min(1.0, value / 10.0) * corr
                        else:
                            score = min(1.0, (10.0 - value) / 10.0) * abs(corr)
                        
                        max_corr_score = max(max_corr_score, abs(score))
        
        return max_corr_score
    
    def _score_to_risk_level(self, score: float) -> RiskLevel:
        """
        将分数转换为风险等级
        """
        if score >= self.RISK_THRESHOLDS["red"]:
            return RiskLevel.RED
        elif score >= self.RISK_THRESHOLDS["orange"]:
            return RiskLevel.ORANGE
        elif score >= self.RISK_THRESHOLDS["yellow"]:
            return RiskLevel.YELLOW
        else:
            return RiskLevel.GREEN
    
    def _get_anomaly_type_description(self, anomaly_type: AnomalyType) -> str:
        """
        获取异常类型描述
        """
        descriptions = {
            AnomalyType.SPALLING: "检测到轻微剥落特征（周期性冲击信号）",
            AnomalyType.SENSOR_LOOSE: "检测到传感器松动特征（强谐波成分）",
            AnomalyType.IMPULSIVE: "检测到冲击性故障特征（高峭度）",
            AnomalyType.VIBRATION_HIGH: "整体振动水平偏高",
            AnomalyType.UNCERTAIN: "存在不确定的异常模式",
            AnomalyType.NORMAL: "无明显异常"
        }
        return descriptions.get(anomaly_type, "未知异常类型")
    
    def _generate_frame_recommendations(self,
                                         risk_level: RiskLevel,
                                         frame_anomaly: FrameAnomalyResult,
                                         features: Dict) -> List[str]:
        """
        生成单帧建议
        """
        recommendations = []
        
        if risk_level == RiskLevel.RED:
            recommendations.append("建议立即关注此时间段的振动数据")
            recommendations.append("建议检查历史数据中是否有类似模式")
        
        elif risk_level == RiskLevel.ORANGE:
            recommendations.append("建议重点关注此时间段")
            recommendations.append("建议在下一次检修时仔细检查")
        
        elif risk_level == RiskLevel.YELLOW:
            recommendations.append("建议记录此异常，持续观察")
        
        if frame_anomaly.anomaly_type == AnomalyType.SENSOR_LOOSE:
            recommendations.append("建议检查传感器安装是否牢固")
        
        if frame_anomaly.anomaly_type == AnomalyType.SPALLING:
            recommendations.append("建议检查轴承滚道表面是否有剥落")
        
        return recommendations
    
    def _calculate_overall_risk(self,
                                 frame_results: List[FrameRiskResult]) -> Tuple[RiskLevel, float]:
        """
        计算整体风险等级
        """
        if not frame_results:
            return RiskLevel.GREEN, 0.0
        
        scores = [fr.risk_score for fr in frame_results]
        
        max_score = max(scores)
        mean_score = np.mean(scores)
        high_risk_ratio = sum(1 for fr in frame_results 
                              if fr.risk_level in [RiskLevel.RED, RiskLevel.ORANGE]) / len(frame_results)
        
        overall_score = (
            0.5 * max_score +
            0.3 * mean_score +
            0.2 * high_risk_ratio
        )
        
        overall_score = max(0.0, min(1.0, overall_score))
        
        risk_count = {}
        for fr in frame_results:
            level = fr.risk_level
            risk_count[level] = risk_count.get(level, 0) + 1
        
        if RiskLevel.RED in risk_count:
            overall_level = RiskLevel.RED
        elif RiskLevel.ORANGE in risk_count and risk_count.get(RiskLevel.ORANGE, 0) >= 2:
            overall_level = RiskLevel.ORANGE
        elif RiskLevel.ORANGE in risk_count or RiskLevel.YELLOW in risk_count:
            if max_score >= self.RISK_THRESHOLDS["orange"]:
                overall_level = RiskLevel.ORANGE
            elif max_score >= self.RISK_THRESHOLDS["yellow"]:
                overall_level = RiskLevel.YELLOW
            else:
                overall_level = RiskLevel.GREEN
        else:
            overall_level = RiskLevel.GREEN
        
        return overall_level, overall_score
    
    def _identify_primary_concern(self,
                                   frame_results: List[FrameRiskResult],
                                   anomaly_result: TripAnomalyResult) -> str:
        """
        识别主要问题
        """
        type_counts = {}
        
        for fr in anomaly_result.frame_results:
            if fr.anomaly_type != AnomalyType.NORMAL:
                t = fr.anomaly_type
                type_counts[t] = type_counts.get(t, 0) + 1
        
        if not type_counts:
            return "无明显异常"
        
        primary_type = max(type_counts.items(), key=lambda x: x[1])[0]
        
        high_risk_frames = [fr for fr in frame_results 
                           if fr.risk_level in [RiskLevel.RED, RiskLevel.ORANGE]]
        
        if high_risk_frames:
            time_ranges = []
            for fr in high_risk_frames[:3]:
                time_ranges.append(f"{fr.start_time:.1f}s-{fr.end_time:.1f}s")
            time_desc = ", ".join(time_ranges)
            return f"主要问题: {self._get_anomaly_type_description(primary_type)}，发生在时间段: {time_desc}"
        
        return f"检测到潜在问题: {self._get_anomaly_type_description(primary_type)}"
    
    def _compile_evidence_summary(self,
                                   frame_results: List[FrameRiskResult],
                                   anomaly_result: TripAnomalyResult) -> List[str]:
        """
        编译证据摘要
        """
        summary = []
        
        if anomaly_result.has_anomaly:
            summary.append(f"检测到 {len(anomaly_result.anomaly_frames)} 个异常帧")
        
        high_risk_count = sum(1 for fr in frame_results 
                             if fr.risk_level == RiskLevel.RED)
        med_risk_count = sum(1 for fr in frame_results 
                            if fr.risk_level == RiskLevel.ORANGE)
        low_risk_count = sum(1 for fr in frame_results 
                           if fr.risk_level == RiskLevel.YELLOW)
        
        if high_risk_count > 0:
            summary.append(f"存在 {high_risk_count} 个高风险帧")
        if med_risk_count > 0:
            summary.append(f"存在 {med_risk_count} 个中风险帧")
        if low_risk_count > 0:
            summary.append(f"存在 {low_risk_count} 个低风险帧")
        
        type_counts = {}
        for fr in anomaly_result.frame_results:
            if fr.anomaly_type != AnomalyType.NORMAL:
                t = fr.anomaly_type.value
                type_counts[t] = type_counts.get(t, 0) + 1
        
        if type_counts:
            type_desc = ", ".join([f"{k}: {v}帧" for k, v in type_counts.items()])
            summary.append(f"异常类型分布: {type_desc}")
        
        return summary
    
    def _generate_recommendations(self,
                                   overall_risk: RiskLevel,
                                   primary_concern: str,
                                   frame_results: List[FrameRiskResult],
                                   validation_warnings: Optional[List[str]]) -> List[str]:
        """
        生成整体建议
        """
        recommendations = []
        
        if validation_warnings:
            recommendations.append("数据质量警告:")
            for warning in validation_warnings[:3]:
                recommendations.append(f"  - {warning}")
            recommendations.append("")
        
        if overall_risk == RiskLevel.RED:
            recommendations.append("【紧急】建议立即采取以下行动:")
            recommendations.append("  1. 立即复核高风险时间段的原始振动数据")
            recommendations.append("  2. 检查历史记录中是否有类似故障模式")
            recommendations.append("  3. 建议安排重点检修")
            recommendations.append("  4. 导出详细报告供技术人员分析")
        
        elif overall_risk == RiskLevel.ORANGE:
            recommendations.append("【警告】建议采取以下行动:")
            recommendations.append("  1. 复核标记为异常的时间段")
            recommendations.append("  2. 建议在下次检修时重点检查相关轴承")
            recommendations.append("  3. 持续监测后续运行数据")
        
        elif overall_risk == RiskLevel.YELLOW:
            recommendations.append("【关注】建议:")
            recommendations.append("  1. 记录当前检测结果")
            recommendations.append("  2. 持续观察后续运行数据")
            recommendations.append("  3. 如发现异常趋势升级，及时处理")
        
        else:
            recommendations.append("【正常】当前数据未检测到明显异常")
            recommendations.append("  - 建议保持常规监测频率")
        
        high_risk_frames = [fr for fr in frame_results 
                           if fr.risk_level in [RiskLevel.RED, RiskLevel.ORANGE]]
        
        if high_risk_frames:
            recommendations.append("")
            recommendations.append("重点关注时间段:")
            for fr in high_risk_frames[:5]:
                recommendations.append(f"  - 帧 {fr.frame_idx}: {fr.start_time:.1f}s - {fr.end_time:.1f}s (风险: {fr.risk_level.value})")
        
        return recommendations
    
    def _calculate_confidence(self,
                               frame_results: List[FrameRiskResult],
                               anomaly_result: TripAnomalyResult,
                               validation_warnings: Optional[List[str]]) -> float:
        """
        计算评估置信度
        """
        base_confidence = anomaly_result.confidence
        
        penalty = 0.0
        if validation_warnings:
            penalty = 0.1 * min(3, len(validation_warnings))
        
        risk_count = {}
        for fr in frame_results:
            level = fr.risk_level
            risk_count[level] = risk_count.get(level, 0) + 1
        
        consistency_bonus = 0.0
        if len(risk_count) == 1:
            consistency_bonus = 0.1
        
        confidence = base_confidence - penalty + consistency_bonus
        
        return max(0.0, min(1.0, confidence))
    
    def get_risk_summary(self, risk_result: TripRiskResult) -> Dict:
        """
        获取风险摘要
        """
        risk_level_counts = {}
        for fr in risk_result.frame_results:
            level = fr.risk_level.value
            risk_level_counts[level] = risk_level_counts.get(level, 0) + 1
        
        return {
            "trip_id": risk_result.trip_id,
            "analysis_time": risk_result.analysis_time,
            "overall_risk": risk_result.overall_risk.value,
            "overall_score": risk_result.overall_score,
            "primary_concern": risk_result.primary_concern,
            "confidence": risk_result.confidence,
            "review_status": risk_result.review_status,
            "risk_distribution": risk_level_counts,
            "evidence_count": len(risk_result.evidence_summary),
            "recommendation_count": len(risk_result.recommendations)
        }
