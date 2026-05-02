import pytest
from datetime import date, datetime
from dataclasses import asdict

from src.models import (
    Patient,
    TrainingRecord,
    PainRecord,
    MovementRecord,
    FollowUpRecord,
    SummaryMetrics,
    RiskAssessment,
    RiskLevel,
)


class TestPatient:
    def test_create_patient(self):
        patient = Patient(
            patient_id="P0001",
            name="测试患者",
            age=65,
            gender="男",
            primary_diagnosis="脑卒中后偏瘫",
        )
        
        assert patient.patient_id == "P0001"
        assert patient.name == "测试患者"
        assert patient.age == 65
        assert patient.gender == "男"
        assert patient.primary_diagnosis == "脑卒中后偏瘫"

    def test_patient_optional_fields(self):
        patient = Patient(
            patient_id="P0002",
            name="测试患者2",
            age=70,
            gender="女",
        )
        
        assert patient.primary_diagnosis is None
        assert patient.treatment_plan is None
        assert patient.admission_date is None
        assert patient.notes is None

    def test_patient_to_dict(self):
        patient = Patient(
            patient_id="P0003",
            name="测试",
            age=60,
            gender="男",
        )
        
        patient_dict = asdict(patient)
        assert "patient_id" in patient_dict
        assert "name" in patient_dict
        assert "age" in patient_dict
        assert "gender" in patient_dict


class TestTrainingRecord:
    def test_create_training_record(self):
        record = TrainingRecord(
            record_id="REC001",
            patient_id="P0001",
            date=date(2024, 1, 1),
            training_program="上肢力量训练",
            is_completed=True,
            completion_percentage=85.0,
            duration_minutes=30,
        )
        
        assert record.patient_id == "P0001"
        assert record.training_program == "上肢力量训练"
        assert record.is_completed is True
        assert record.completion_percentage == 85.0
        assert record.duration_minutes == 30


class TestPainRecord:
    def test_create_pain_record(self):
        record = PainRecord(
            record_id="PAIN001",
            patient_id="P0001",
            date=date(2024, 1, 1),
            pain_location="左膝关节",
            pain_score=5,
            pain_type="酸痛",
        )
        
        assert record.patient_id == "P0001"
        assert record.pain_location == "左膝关节"
        assert record.pain_score == 5
        assert 0 <= record.pain_score <= 10


class TestMovementRecord:
    def test_create_movement_record(self):
        record = MovementRecord(
            record_id="MOVE001",
            patient_id="P0001",
            date=date(2024, 1, 1),
            movement_name="坐位站起",
            completion_score=75.0,
            form_quality=80.0,
            range_of_motion=70.0,
            symmetry_score=78.0,
        )
        
        assert record.movement_name == "坐位站起"
        assert record.completion_score == 75.0
        assert record.form_quality == 80.0


class TestRiskLevel:
    def test_risk_level_values(self):
        assert RiskLevel.LOW.value == "low"
        assert RiskLevel.MEDIUM.value == "medium"
        assert RiskLevel.HIGH.value == "high"
        assert RiskLevel.CRITICAL.value == "critical"

    def test_risk_level_comparison(self):
        assert RiskLevel.LOW < RiskLevel.MEDIUM
        assert RiskLevel.MEDIUM < RiskLevel.HIGH
        assert RiskLevel.HIGH < RiskLevel.CRITICAL


class TestSummaryMetrics:
    def test_create_summary_metrics(self):
        metrics = SummaryMetrics(
            patient_id="P0001",
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 28),
            total_training_days=20,
            completed_training_days=15,
            compliance_rate=0.75,
            average_duration_minutes=25.5,
            average_pain_score=4.5,
            pain_score_change=-0.5,
            average_movement_score=75.0,
            movement_volatility=0.15,
            missed_days_count=5,
            consecutive_missed_days=2,
            training_programs=["上肢训练", "下肢训练"],
        )
        
        assert metrics.compliance_rate == 0.75
        assert metrics.average_pain_score == 4.5
        assert metrics.pain_score_change == -0.5
        assert metrics.missed_days_count == 5


class TestRiskAssessment:
    def test_create_risk_assessment(self):
        assessment = RiskAssessment(
            patient_id="P0001",
            assessment_date=date(2024, 1, 28),
            risk_level=RiskLevel.MEDIUM,
            risk_factors=[
                {"type": "compliance", "details": "依从率偏低", "score": 0.6}
            ],
            compliance_risk=True,
            compliance_risk_details="依从率偏低 (75%)",
            pain_risk=False,
            movement_risk=False,
            missed_days_risk=True,
            missed_days_risk_details="连续缺训2天",
            overall_score=0.45,
            recommendations=["增加随访频率"],
            needs_urgent_follow_up=False,
            follow_up_priority="medium",
        )
        
        assert assessment.risk_level == RiskLevel.MEDIUM
        assert assessment.compliance_risk is True
        assert assessment.pain_risk is False
        assert assessment.overall_score == 0.45
        assert len(assessment.recommendations) == 1
