import pytest
from datetime import date, timedelta

from src.metrics import MetricsCalculator


class TestMetricsCalculator:
    @pytest.fixture
    def calculator(self):
        return MetricsCalculator()

    @pytest.fixture
    def sample_training_records(self):
        start_date = date(2024, 1, 1)
        records = []
        
        for i in range(28):
            current_date = start_date + timedelta(days=i)
            
            if i < 7:
                is_completed = True
            elif i < 14:
                is_completed = i % 2 == 0
            elif i < 21:
                is_completed = False
            else:
                is_completed = True
            
            records.append({
                "patient_id": "P0001",
                "date": str(current_date),
                "training_program": "上肢训练",
                "is_completed": is_completed,
                "completion_percentage": 85 if is_completed else 30,
                "duration_minutes": 30 if is_completed else 10,
            })
        
        return records

    def test_calculate_compliance_rate(self, calculator, sample_training_records):
        period_start = date(2024, 1, 1)
        period_end = date(2024, 1, 7)
        
        compliance_rate, total_days, completed_days = calculator.calculate_compliance_rate(
            sample_training_records,
            period_start,
            period_end,
        )
        
        assert total_days == 7
        assert completed_days == 7
        assert compliance_rate == 1.0

    def test_calculate_compliance_rate_partial(self, calculator, sample_training_records):
        period_start = date(2024, 1, 8)
        period_end = date(2024, 1, 14)
        
        compliance_rate, total_days, completed_days = calculator.calculate_compliance_rate(
            sample_training_records,
            period_start,
            period_end,
        )
        
        assert total_days == 7
        assert completed_days == 4
        assert compliance_rate == 4 / 7

    def test_calculate_average_duration(self, calculator, sample_training_records):
        period_start = date(2024, 1, 1)
        period_end = date(2024, 1, 7)
        
        avg_duration = calculator.calculate_average_duration(
            sample_training_records,
            period_start,
            period_end,
        )
        
        assert avg_duration > 0

    def test_calculate_pain_metrics(self, calculator):
        pain_records = [
            {"patient_id": "P0001", "date": "2024-01-01", "pain_score": 5},
            {"patient_id": "P0001", "date": "2024-01-05", "pain_score": 4},
            {"patient_id": "P0001", "date": "2024-01-10", "pain_score": 3},
            {"patient_id": "P0001", "date": "2024-01-15", "pain_score": 2},
        ]
        
        period_start = date(2024, 1, 1)
        period_end = date(2024, 1, 31)
        
        avg_pain, pain_change = calculator.calculate_pain_metrics(
            pain_records,
            period_start,
            period_end,
        )
        
        assert avg_pain == 3.5
        assert pain_change == -3.0

    def test_calculate_movement_metrics(self, calculator):
        movement_records = [
            {"patient_id": "P0001", "date": "2024-01-01", "completion_score": 70},
            {"patient_id": "P0001", "date": "2024-01-03", "completion_score": 75},
            {"patient_id": "P0001", "date": "2024-01-05", "completion_score": 80},
            {"patient_id": "P0001", "date": "2024-01-07", "completion_score": 78},
        ]
        
        period_start = date(2024, 1, 1)
        period_end = date(2024, 1, 31)
        
        avg_score, volatility = calculator.calculate_movement_metrics(
            movement_records,
            period_start,
            period_end,
        )
        
        assert avg_score > 0
        assert volatility >= 0

    def test_calculate_missed_days(self, calculator, sample_training_records):
        period_start = date(2024, 1, 15)
        period_end = date(2024, 1, 21)
        
        missed_count, consecutive_missed = calculator.calculate_missed_days(
            sample_training_records,
            period_start,
            period_end,
        )
        
        assert missed_count == 7
        assert consecutive_missed == 7

    def test_empty_records(self, calculator):
        period_start = date(2024, 1, 1)
        period_end = date(2024, 1, 31)
        
        compliance_rate, total_days, completed_days = calculator.calculate_compliance_rate(
            [],
            period_start,
            period_end,
        )
        
        assert compliance_rate == 0.0
        assert total_days == 0
        assert completed_days == 0

        avg_pain, pain_change = calculator.calculate_pain_metrics(
            [],
            period_start,
            period_end,
        )
        
        assert avg_pain == 0.0
        assert pain_change == 0.0
