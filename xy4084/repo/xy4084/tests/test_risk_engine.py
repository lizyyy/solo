import pytest
from datetime import date

from config import RiskThresholds
from src.risk import RiskEngine
from src.models import SummaryMetrics, RiskLevel


class TestRiskEngine:
    @pytest.fixture
    def default_thresholds(self):
        return RiskThresholds()

    @pytest.fixture
    def risk_engine(self, default_thresholds):
        return RiskEngine(thresholds=default_thresholds)

    @pytest.fixture
    def create_metrics(self):
        def _create_metrics(
            patient_id="P0001",
            compliance_rate=0.8,
            average_pain_score=5.0,
            pain_score_change=0.0,
            movement_volatility=0.1,
            missed_days_count=0,
            consecutive_missed_days=0,
        ):
            return SummaryMetrics(
                patient_id=patient_id,
                period_start=date(2024, 1, 1),
                period_end=date(2024, 1, 28),
                total_training_days=20,
                completed_training_days=int(20 * compliance_rate),
                compliance_rate=compliance_rate,
                average_duration_minutes=30.0,
                average_pain_score=average_pain_score,
                pain_score_change=pain_score_change,
                average_movement_score=75.0,
                movement_volatility=movement_volatility,
                missed_days_count=missed_days_count,
                consecutive_missed_days=consecutive_missed_days,
                training_programs=["上肢训练"],
            )
        return _create_metrics

    def test_assess_compliance_risk_low(self, risk_engine, create_metrics):
        metrics = create_metrics(compliance_rate=0.4)
        is_risk, details, score = risk_engine.assess_compliance_risk(metrics)
        
        assert is_risk is True
        assert score == 1.0
        assert "极低" in details

    def test_assess_compliance_risk_warning(self, risk_engine, create_metrics):
        metrics = create_metrics(compliance_rate=0.6)
        is_risk, details, score = risk_engine.assess_compliance_risk(metrics)
        
        assert is_risk is True
        assert score == 0.6
        assert "偏低" in details

    def test_assess_compliance_risk_good(self, risk_engine, create_metrics):
        metrics = create_metrics(compliance_rate=0.85)
        is_risk, details, score = risk_engine.assess_compliance_risk(metrics)
        
        assert is_risk is False
        assert score == 0.0
        assert "良好" in details

    def test_assess_pain_risk_high_level(self, risk_engine, create_metrics):
        metrics = create_metrics(average_pain_score=8.0)
        is_risk, details, score = risk_engine.assess_pain_risk(metrics)
        
        assert is_risk is True
        assert score > 0
        assert "较高" in details

    def test_assess_pain_risk_increase(self, risk_engine, create_metrics):
        metrics = create_metrics(average_pain_score=5.0, pain_score_change=3.0)
        is_risk, details, score = risk_engine.assess_pain_risk(metrics)
        
        assert is_risk is True
        assert score > 0
        assert "上升明显" in details

    def test_assess_pain_risk_improving(self, risk_engine, create_metrics):
        metrics = create_metrics(average_pain_score=4.0, pain_score_change=-2.0)
        is_risk, details, score = risk_engine.assess_pain_risk(metrics)
        
        assert is_risk is False
        assert "缓解" in details

    def test_assess_movement_risk_high_volatility(self, risk_engine, create_metrics):
        metrics = create_metrics(movement_volatility=0.3)
        is_risk, details, score = risk_engine.assess_movement_risk(metrics)
        
        assert is_risk is True
        assert score == 0.7
        assert "较差" in details

    def test_assess_movement_risk_good(self, risk_engine, create_metrics):
        metrics = create_metrics(movement_volatility=0.1)
        is_risk, details, score = risk_engine.assess_movement_risk(metrics)
        
        assert is_risk is False
        assert "良好" in details

    def test_assess_missed_days_critical(self, risk_engine, create_metrics):
        metrics = create_metrics(consecutive_missed_days=5)
        is_risk, details, score = risk_engine.assess_missed_days_risk(metrics)
        
        assert is_risk is True
        assert score == 1.0
        assert "极高" in details

    def test_assess_missed_days_warning(self, risk_engine, create_metrics):
        metrics = create_metrics(consecutive_missed_days=3)
        is_risk, details, score = risk_engine.assess_missed_days_risk(metrics)
        
        assert is_risk is True
        assert score == 0.6
        assert "连续缺训风险" in details

    def test_assess_missed_days_none(self, risk_engine, create_metrics):
        metrics = create_metrics(consecutive_missed_days=0, missed_days_count=0)
        is_risk, details, score = risk_engine.assess_missed_days_risk(metrics)
        
        assert is_risk is False
        assert "无缺训" in details

    def test_calculate_overall_risk_low(self, risk_engine):
        risk_scores = {
            "compliance": 0.0,
            "pain": 0.0,
            "movement": 0.0,
            "missed_days": 0.0,
        }
        
        risk_level, overall_score = risk_engine.calculate_overall_risk(risk_scores)
        
        assert risk_level == RiskLevel.LOW
        assert overall_score == 0.0

    def test_calculate_overall_risk_critical(self, risk_engine):
        risk_scores = {
            "compliance": 1.0,
            "pain": 0.0,
            "movement": 0.0,
            "missed_days": 0.0,
        }
        
        risk_level, overall_score = risk_engine.calculate_overall_risk(risk_scores)
        
        assert risk_level == RiskLevel.CRITICAL

    def test_assess_risk_low_risk_patient(self, risk_engine, create_metrics):
        metrics = create_metrics(
            compliance_rate=0.9,
            average_pain_score=3.0,
            pain_score_change=-1.0,
            movement_volatility=0.1,
            consecutive_missed_days=0,
        )
        
        assessment = risk_engine.assess_risk(metrics)
        
        assert assessment.risk_level == RiskLevel.LOW
        assert assessment.compliance_risk is False
        assert assessment.pain_risk is False
        assert assessment.movement_risk is False
        assert assessment.missed_days_risk is False
        assert assessment.needs_urgent_follow_up is False

    def test_assess_risk_high_risk_patient(self, risk_engine, create_metrics):
        metrics = create_metrics(
            compliance_rate=0.4,
            average_pain_score=8.0,
            pain_score_change=3.0,
            movement_volatility=0.3,
            consecutive_missed_days=5,
        )
        
        assessment = risk_engine.assess_risk(metrics)
        
        assert assessment.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        assert assessment.compliance_risk is True
        assert assessment.pain_risk is True
        assert assessment.movement_risk is True
        assert assessment.missed_days_risk is True
        assert assessment.needs_urgent_follow_up is True
        assert len(assessment.recommendations) > 0

    def test_update_thresholds(self, risk_engine):
        new_thresholds = RiskThresholds(
            compliance_rate_low=0.4,
            compliance_rate_warning=0.6,
            pain_high_level=8,
            pain_increase_threshold=3,
            movement_volatility_threshold=0.3,
            missed_days_warning=3,
            missed_days_critical=6,
        )
        
        risk_engine.update_thresholds(new_thresholds)
        
        assert risk_engine.thresholds.compliance_rate_low == 0.4
        assert risk_engine.thresholds.compliance_rate_warning == 0.6
        assert risk_engine.thresholds.pain_high_level == 8
        assert risk_engine.thresholds.missed_days_critical == 6

    def test_get_risk_level_distribution(self, risk_engine, create_metrics):
        metrics_low = create_metrics(compliance_rate=0.9)
        metrics_medium = create_metrics(compliance_rate=0.6)
        metrics_high = create_metrics(compliance_rate=0.4)
        
        assessment_low = risk_engine.assess_risk(metrics_low)
        assessment_medium = risk_engine.assess_risk(metrics_medium)
        assessment_high = risk_engine.assess_risk(metrics_high)
        
        assessments = {
            "P0001": assessment_low,
            "P0002": assessment_medium,
            "P0003": assessment_high,
        }
        
        distribution = risk_engine.get_risk_level_distribution(assessments)
        
        assert distribution["low"] >= 0
        assert distribution["medium"] >= 0
        assert distribution["high"] >= 0
        assert distribution["critical"] >= 0
