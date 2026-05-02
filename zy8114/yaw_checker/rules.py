import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
from .calculator import calculate_angular_difference


class IssueType(Enum):
    ANEMOMETER_DRIFT = "anemometer_drift"
    LONG_TERM_YAW_BIAS = "long_term_yaw_bias"
    EXCESSIVE_YAW_ERROR = "excessive_yaw_error"
    MISSING_DATA = "missing_data"
    DATA_GAP = "data_gap"


class IssueSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DetectedIssue:
    turbine_id: str
    issue_type: IssueType
    severity: IssueSeverity
    description: str
    start_time: Optional[pd.Timestamp]
    end_time: Optional[pd.Timestamp]
    affected_samples: int
    metric_value: float
    threshold: float
    recommendation: str


def detect_anemometer_drift(
    timeline_df: pd.DataFrame,
    rules: Dict[str, Any],
    turbine_id: str
) -> List[DetectedIssue]:
    """检测风向仪漂移
    
    检测逻辑:
    1. 分析偏航误差的长期趋势
    2. 如果平均偏航误差持续超过阈值，可能存在风向仪漂移
    3. 考虑风向仪漂移通常表现为系统性偏差
    """
    issues = []
    drift_threshold = rules.get("anemometer_drift_threshold", 5.0)
    min_samples = rules.get("min_data_points_for_analysis", 10)
    
    valid_data = timeline_df[timeline_df["is_valid_for_analysis"]].copy()
    
    if len(valid_data) < min_samples:
        return issues
    
    mean_yaw_error = valid_data["yaw_error_deg"].mean()
    median_yaw_error = valid_data["yaw_error_deg"].median()
    std_yaw_error = valid_data["yaw_error_deg"].std()
    
    abs_mean_error = abs(mean_yaw_error)
    
    if abs_mean_error > drift_threshold:
        drift_direction = "顺时针" if mean_yaw_error > 0 else "逆时针"
        
        if abs_mean_error > drift_threshold * 2:
            severity = IssueSeverity.CRITICAL
        elif abs_mean_error > drift_threshold * 1.5:
            severity = IssueSeverity.HIGH
        else:
            severity = IssueSeverity.MEDIUM
        
        issue = DetectedIssue(
            turbine_id=turbine_id,
            issue_type=IssueType.ANEMOMETER_DRIFT,
            severity=severity,
            description=f"检测到潜在风向仪漂移: 平均偏航误差 {mean_yaw_error:.2f}° ({drift_direction}方向)",
            start_time=valid_data["timestamp"].min(),
            end_time=valid_data["timestamp"].max(),
            affected_samples=len(valid_data),
            metric_value=abs_mean_error,
            threshold=drift_threshold,
            recommendation=f"建议校准风向仪。当前平均偏差 {mean_yaw_error:.2f}°，超过阈值 {drift_threshold}°。中位数偏差 {median_yaw_error:.2f}°，标准差 {std_yaw_error:.2f}°。"
        )
        issues.append(issue)
    
    return issues


def detect_long_term_yaw_bias(
    timeline_df: pd.DataFrame,
    rules: Dict[str, Any],
    turbine_id: str
) -> List[DetectedIssue]:
    """检测长期对风偏差
    
    检测逻辑:
    1. 将数据按时间段（如每24小时）分组
    2. 检查每个时间段内的平均偏航误差
    3. 如果多个连续时间段都存在持续偏差，标记为长期对风偏差
    
    与风向仪漂移的区别:
    - 风向仪漂移通常是系统性的、持续的
    - 长期对风偏差可能是偏航控制系统的问题
    """
    issues = []
    bias_threshold = rules.get("long_term_bias_threshold", 8.0)
    period_hours = rules.get("long_term_bias_period_hours", 24)
    min_samples = rules.get("min_data_points_for_analysis", 10)
    
    valid_data = timeline_df[timeline_df["is_valid_for_analysis"]].copy()
    
    if len(valid_data) < min_samples:
        return issues
    
    valid_data = valid_data.set_index("timestamp")
    
    period_str = f"{period_hours}h"
    grouped = valid_data.resample(period_str).agg({
        "yaw_error_deg": ["mean", "median", "count"],
        "absolute_yaw_error_deg": ["mean", "max"]
    })
    
    grouped.columns = ["yaw_error_mean", "yaw_error_median", "sample_count", 
                       "abs_error_mean", "abs_error_max"]
    grouped = grouped[grouped["sample_count"] >= min_samples // 2]
    
    consecutive_periods = 0
    bias_start_time = None
    total_biased_samples = 0
    
    for timestamp, row in grouped.iterrows():
        abs_mean_error = abs(row["yaw_error_mean"])
        
        if abs_mean_error > bias_threshold:
            if consecutive_periods == 0:
                bias_start_time = timestamp
            consecutive_periods += 1
            total_biased_samples += int(row["sample_count"])
        else:
            if consecutive_periods >= 2:
                bias_direction = "顺时针" if row["yaw_error_mean"] > 0 else "逆时针"
                severity = _determine_bias_severity(consecutive_periods)
                
                issue = DetectedIssue(
                    turbine_id=turbine_id,
                    issue_type=IssueType.LONG_TERM_YAW_BIAS,
                    severity=severity,
                    description=f"检测到长期对风偏差: 连续 {consecutive_periods} 个时间段存在持续偏差",
                    start_time=bias_start_time,
                    end_time=timestamp,
                    affected_samples=total_biased_samples,
                    metric_value=abs_mean_error,
                    threshold=bias_threshold,
                    recommendation=f"建议检查偏航控制系统。连续 {consecutive_periods} 个时间段（每段 {period_hours} 小时）检测到持续对风偏差。近期平均偏差 {row['yaw_error_mean']:.2f}°。"
                )
                issues.append(issue)
            
            consecutive_periods = 0
            bias_start_time = None
            total_biased_samples = 0
    
    if consecutive_periods >= 2:
        last_row = grouped.iloc[-1]
        severity = _determine_bias_severity(consecutive_periods)
        
        issue = DetectedIssue(
            turbine_id=turbine_id,
            issue_type=IssueType.LONG_TERM_YAW_BIAS,
            severity=severity,
            description=f"检测到长期对风偏差: 连续 {consecutive_periods} 个时间段存在持续偏差",
            start_time=bias_start_time,
            end_time=grouped.index[-1],
            affected_samples=total_biased_samples,
            metric_value=abs(last_row["yaw_error_mean"]),
            threshold=bias_threshold,
            recommendation=f"建议检查偏航控制系统。连续 {consecutive_periods} 个时间段（每段 {period_hours} 小时）检测到持续对风偏差。"
        )
        issues.append(issue)
    
    return issues


def _determine_bias_severity(consecutive_periods: int) -> IssueSeverity:
    """根据连续偏差时间段确定严重程度"""
    if consecutive_periods >= 7:
        return IssueSeverity.CRITICAL
    elif consecutive_periods >= 4:
        return IssueSeverity.HIGH
    elif consecutive_periods >= 2:
        return IssueSeverity.MEDIUM
    return IssueSeverity.LOW


def detect_excessive_yaw_error(
    timeline_df: pd.DataFrame,
    rules: Dict[str, Any],
    turbine_id: str
) -> List[DetectedIssue]:
    """检测过度偏航误差
    
    检测逻辑:
    1. 检查单个采样点的偏航误差是否超过阈值
    2. 统计超过阈值的频率
    3. 如果频率过高，标记问题
    """
    issues = []
    yaw_threshold = rules.get("yaw_error_threshold", 15.0)
    min_samples = rules.get("min_data_points_for_analysis", 10)
    
    valid_data = timeline_df[timeline_df["is_valid_for_analysis"]].copy()
    
    if len(valid_data) < min_samples:
        return issues
    
    excessive_errors = valid_data[valid_data["absolute_yaw_error_deg"] > yaw_threshold]
    excessive_count = len(excessive_errors)
    
    if excessive_count == 0:
        return issues
    
    excessive_rate = excessive_count / len(valid_data)
    
    if excessive_rate > 0.20:
        if excessive_rate > 0.50:
            severity = IssueSeverity.CRITICAL
        elif excessive_rate > 0.30:
            severity = IssueSeverity.HIGH
        else:
            severity = IssueSeverity.MEDIUM
        
        max_error = excessive_errors["absolute_yaw_error_deg"].max()
        
        issue = DetectedIssue(
            turbine_id=turbine_id,
            issue_type=IssueType.EXCESSIVE_YAW_ERROR,
            severity=severity,
            description=f"过度偏航误差: {excessive_count} 个采样点（占比 {excessive_rate*100:.1f}%）超过阈值 {yaw_threshold}°",
            start_time=excessive_errors["timestamp"].min(),
            end_time=excessive_errors["timestamp"].max(),
            affected_samples=excessive_count,
            metric_value=excessive_rate,
            threshold=0.20,
            recommendation=f"建议检查偏航控制策略。{excessive_count} 个采样点（{excessive_rate*100:.1f}%）偏航误差超过 {yaw_threshold}°，最大误差 {max_error:.2f}°。"
        )
        issues.append(issue)
    
    return issues


def detect_data_issues(
    timeline_df: pd.DataFrame,
    rules: Dict[str, Any],
    turbine_id: str
) -> List[DetectedIssue]:
    """检测数据质量问题"""
    issues = []
    min_samples = rules.get("min_data_points_for_analysis", 10)
    
    total_samples = len(timeline_df)
    
    if total_samples < min_samples:
        issue = DetectedIssue(
            turbine_id=turbine_id,
            issue_type=IssueType.MISSING_DATA,
            severity=IssueSeverity.HIGH,
            description=f"数据不足: 仅有 {total_samples} 个采样点，低于最低要求 {min_samples} 个",
            start_time=timeline_df["timestamp"].min() if not timeline_df.empty else None,
            end_time=timeline_df["timestamp"].max() if not timeline_df.empty else None,
            affected_samples=total_samples,
            metric_value=total_samples,
            threshold=min_samples,
            recommendation=f"需要更多数据进行可靠分析。当前仅有 {total_samples} 个采样点，建议至少提供 {min_samples} 个有效采样点。"
        )
        issues.append(issue)
    
    missing_count = int(timeline_df["is_missing_sample"].sum())
    if missing_count > 0:
        missing_rate = missing_count / total_samples if total_samples > 0 else 0
        
        if missing_rate > 0.10:
            severity = IssueSeverity.MEDIUM if missing_rate < 0.25 else IssueSeverity.HIGH
            
            issue = DetectedIssue(
                turbine_id=turbine_id,
                issue_type=IssueType.DATA_GAP,
                severity=severity,
                description=f"数据缺口: 检测到 {missing_count} 个数据缺口（占比 {missing_rate*100:.1f}%）",
                start_time=timeline_df["timestamp"].min() if not timeline_df.empty else None,
                end_time=timeline_df["timestamp"].max() if not timeline_df.empty else None,
                affected_samples=missing_count,
                metric_value=missing_rate,
                threshold=0.10,
                recommendation=f"存在 {missing_count} 个数据缺口（{missing_rate*100:.1f}%），可能影响分析结果的连续性。建议检查数据采集系统。"
            )
            issues.append(issue)
    
    return issues


def run_all_checks(
    timeline_df: pd.DataFrame,
    rules: Dict[str, Any],
    turbine_id: str
) -> List[DetectedIssue]:
    """运行所有检测规则"""
    all_issues = []
    
    all_issues.extend(detect_data_issues(timeline_df, rules, turbine_id))
    
    if not timeline_df[timeline_df["is_valid_for_analysis"]].empty:
        all_issues.extend(detect_anemometer_drift(timeline_df, rules, turbine_id))
        all_issues.extend(detect_long_term_yaw_bias(timeline_df, rules, turbine_id))
        all_issues.extend(detect_excessive_yaw_error(timeline_df, rules, turbine_id))
    
    return all_issues


def issues_to_dataframe(issues: List[DetectedIssue]) -> pd.DataFrame:
    """将检测到的问题转换为 DataFrame 以便导出 CSV"""
    if not issues:
        return pd.DataFrame(columns=[
            "turbine_id", "issue_type", "severity", "description",
            "start_time", "end_time", "affected_samples", "metric_value",
            "threshold", "recommendation"
        ])
    
    data = []
    for issue in issues:
        data.append({
            "turbine_id": issue.turbine_id,
            "issue_type": issue.issue_type.value,
            "severity": issue.severity.value,
            "description": issue.description,
            "start_time": issue.start_time.isoformat() if issue.start_time else None,
            "end_time": issue.end_time.isoformat() if issue.end_time else None,
            "affected_samples": issue.affected_samples,
            "metric_value": round(issue.metric_value, 4),
            "threshold": issue.threshold,
            "recommendation": issue.recommendation
        })
    
    return pd.DataFrame(data)