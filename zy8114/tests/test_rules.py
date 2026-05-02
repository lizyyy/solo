import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from yaw_checker.rules import (
    IssueType,
    IssueSeverity,
    DetectedIssue,
    detect_anemometer_drift,
    detect_long_term_yaw_bias,
    detect_excessive_yaw_error,
    detect_data_issues,
    run_all_checks,
    issues_to_dataframe
)


class TestIssueType:
    """测试问题类型枚举"""

    def test_issue_type_values(self):
        """测试枚举值"""
        assert IssueType.ANEMOMETER_DRIFT.value == "anemometer_drift"
        assert IssueType.LONG_TERM_YAW_BIAS.value == "long_term_yaw_bias"
        assert IssueType.EXCESSIVE_YAW_ERROR.value == "excessive_yaw_error"
        assert IssueType.MISSING_DATA.value == "missing_data"
        assert IssueType.DATA_GAP.value == "data_gap"


class TestIssueSeverity:
    """测试严重程度枚举"""

    def test_severity_values(self):
        """测试枚举值"""
        assert IssueSeverity.LOW.value == "low"
        assert IssueSeverity.MEDIUM.value == "medium"
        assert IssueSeverity.HIGH.value == "high"
        assert IssueSeverity.CRITICAL.value == "critical"


class TestDetectedIssue:
    """测试问题数据类"""

    def test_create_issue(self):
        """测试创建问题"""
        issue = DetectedIssue(
            turbine_id="WTG01",
            issue_type=IssueType.ANEMOMETER_DRIFT,
            severity=IssueSeverity.HIGH,
            description="测试问题",
            start_time=datetime(2026, 5, 1, 0, 0),
            end_time=datetime(2026, 5, 1, 3, 0),
            affected_samples=20,
            metric_value=7.5,
            threshold=5.0,
            recommendation="建议校准"
        )
        
        assert issue.turbine_id == "WTG01"
        assert issue.issue_type == IssueType.ANEMOMETER_DRIFT
        assert issue.severity == IssueSeverity.HIGH
        assert issue.metric_value == 7.5


class TestDetectAnemometerDrift:
    """测试风向仪漂移检测"""

    def create_timeline_with_bias(self, bias_deg, n_points=30):
        """创建带偏置的时间线数据"""
        base_time = datetime(2026, 5, 1, 0, 0, 0)
        data = []
        
        for i in range(n_points):
            timestamp = base_time + timedelta(minutes=10 * i)
            wind_direction = 270.0 + i
            nacelle_angle = (270.0 + i - bias_deg) % 360
            
            data.append({
                "timestamp": timestamp,
                "wind_direction": wind_direction,
                "nacelle_angle": nacelle_angle,
                "wind_speed": 8.0,
                "active_power": 1500.0,
                "yaw_error_deg": bias_deg,
                "absolute_yaw_error_deg": abs(bias_deg),
                "estimated_power_loss_kw": 0.5,
                "is_valid_for_analysis": True,
                "is_missing_sample": False,
                "nacelle_offset_applied": 0.0
            })
        
        return pd.DataFrame(data)

    def test_no_drift(self):
        """测试无漂移"""
        rules = {"anemometer_drift_threshold": 5.0, "min_data_points_for_analysis": 10}
        timeline = self.create_timeline_with_bias(bias_deg=2.0)
        
        issues = detect_anemometer_drift(timeline, rules, "WTG01")
        
        assert len(issues) == 0

    def test_with_drift(self):
        """测试有漂移"""
        rules = {"anemometer_drift_threshold": 5.0, "min_data_points_for_analysis": 10}
        timeline = self.create_timeline_with_bias(bias_deg=7.0)
        
        issues = detect_anemometer_drift(timeline, rules, "WTG01")
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.ANEMOMETER_DRIFT
        assert issues[0].metric_value >= 5.0

    def test_insufficient_data(self):
        """测试数据不足"""
        rules = {"anemometer_drift_threshold": 5.0, "min_data_points_for_analysis": 10}
        timeline = self.create_timeline_with_bias(bias_deg=7.0, n_points=5)
        
        issues = detect_anemometer_drift(timeline, rules, "WTG01")
        
        assert len(issues) == 0

    def test_severity_levels(self):
        """测试严重程度分级"""
        rules = {"anemometer_drift_threshold": 5.0, "min_data_points_for_analysis": 10}
        
        timeline_medium = self.create_timeline_with_bias(bias_deg=7.0)
        issues_medium = detect_anemometer_drift(timeline_medium, rules, "WTG01")
        assert issues_medium[0].severity == IssueSeverity.MEDIUM
        
        timeline_high = self.create_timeline_with_bias(bias_deg=9.0)
        issues_high = detect_anemometer_drift(timeline_high, rules, "WTG01")
        assert issues_high[0].severity == IssueSeverity.HIGH
        
        timeline_critical = self.create_timeline_with_bias(bias_deg=12.0)
        issues_critical = detect_anemometer_drift(timeline_critical, rules, "WTG01")
        assert issues_critical[0].severity == IssueSeverity.CRITICAL


class TestDetectExcessiveYawError:
    """测试过度偏航误差检测"""

    def create_timeline_with_errors(self, error_rate=0.3, n_points=30):
        """创建带误差的时间线数据"""
        base_time = datetime(2026, 5, 1, 0, 0, 0)
        data = []
        
        for i in range(n_points):
            timestamp = base_time + timedelta(minutes=10 * i)
            
            if i < int(n_points * error_rate):
                yaw_error = 20.0
            else:
                yaw_error = 5.0
            
            data.append({
                "timestamp": timestamp,
                "wind_direction": 270.0,
                "nacelle_angle": 265.0,
                "wind_speed": 8.0,
                "active_power": 1500.0,
                "yaw_error_deg": yaw_error,
                "absolute_yaw_error_deg": abs(yaw_error),
                "estimated_power_loss_kw": 0.5,
                "is_valid_for_analysis": True,
                "is_missing_sample": False,
                "nacelle_offset_applied": 0.0
            })
        
        return pd.DataFrame(data)

    def test_no_excessive_errors(self):
        """测试无过度误差"""
        rules = {"yaw_error_threshold": 15.0, "min_data_points_for_analysis": 10}
        timeline = self.create_timeline_with_errors(error_rate=0.0)
        
        issues = detect_excessive_yaw_error(timeline, rules, "WTG01")
        
        assert len(issues) == 0

    def test_with_excessive_errors(self):
        """测试有过度误差"""
        rules = {"yaw_error_threshold": 15.0, "min_data_points_for_analysis": 10}
        timeline = self.create_timeline_with_errors(error_rate=0.3)
        
        issues = detect_excessive_yaw_error(timeline, rules, "WTG01")
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.EXCESSIVE_YAW_ERROR

    def test_insufficient_data(self):
        """测试数据不足"""
        rules = {"yaw_error_threshold": 15.0, "min_data_points_for_analysis": 10}
        timeline = self.create_timeline_with_errors(error_rate=0.5, n_points=5)
        
        issues = detect_excessive_yaw_error(timeline, rules, "WTG01")
        
        assert len(issues) == 0


class TestDetectDataIssues:
    """测试数据质量问题检测"""

    def test_insufficient_data(self):
        """测试数据不足"""
        rules = {"min_data_points_for_analysis": 10}
        timeline = pd.DataFrame({
            "timestamp": [datetime(2026, 5, 1, 0, 0), datetime(2026, 5, 1, 0, 10)],
            "is_missing_sample": [False, False]
        })
        
        issues = detect_data_issues(timeline, rules, "WTG01")
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.MISSING_DATA

    def test_data_gaps(self):
        """测试数据缺口"""
        rules = {"min_data_points_for_analysis": 10}
        base_time = datetime(2026, 5, 1, 0, 0, 0)
        data = []
        
        for i in range(15):
            timestamp = base_time + timedelta(minutes=10 * i)
            is_missing = i in [2, 5, 8, 11]
            
            data.append({
                "timestamp": timestamp,
                "is_missing_sample": is_missing
            })
        
        timeline = pd.DataFrame(data)
        
        issues = detect_data_issues(timeline, rules, "WTG01")
        
        gap_issues = [i for i in issues if i.issue_type == IssueType.DATA_GAP]
        assert len(gap_issues) == 1


class TestIssuesToDataframe:
    """测试问题转换为 DataFrame"""

    def test_empty_issues(self):
        """测试空问题列表"""
        df = issues_to_dataframe([])
        
        assert len(df) == 0
        assert "turbine_id" in df.columns
        assert "issue_type" in df.columns

    def test_with_issues(self):
        """测试有问题"""
        issues = [
            DetectedIssue(
                turbine_id="WTG01",
                issue_type=IssueType.ANEMOMETER_DRIFT,
                severity=IssueSeverity.HIGH,
                description="测试问题1",
                start_time=datetime(2026, 5, 1, 0, 0),
                end_time=datetime(2026, 5, 1, 3, 0),
                affected_samples=20,
                metric_value=7.5,
                threshold=5.0,
                recommendation="建议校准"
            )
        ]
        
        df = issues_to_dataframe(issues)
        
        assert len(df) == 1
        assert df["turbine_id"].iloc[0] == "WTG01"
        assert df["issue_type"].iloc[0] == "anemometer_drift"
        assert df["severity"].iloc[0] == "high"
