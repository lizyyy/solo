import unittest
from datetime import datetime
from models.data_models import (
    TemperaturePoint,
    FiringSegment,
    FiringPlan,
    GlazeBatch,
    WorkPiece,
    RiskType,
    RiskLevel,
    FiringRecord
)
from rules.rate_rule import RateRule
from rules.insulation_rule import InsulationRule
from rules.temperature_diff_rule import TemperatureDiffRule
from rules.batch_match_rule import BatchMatchRule


class TestRateRule(unittest.TestCase):
    
    def setUp(self):
        self.record = FiringRecord(
            record_id="TEST-001",
            name="测试",
            created_at=datetime.now()
        )
        
        segments = [
            FiringSegment(
                segment_id="S1",
                name="升温阶段",
                start_temperature=25,
                end_temperature=500,
                rate=200.0,
                hold_time_minutes=0
            ),
            FiringSegment(
                segment_id="S2",
                name="快速升温",
                start_temperature=500,
                end_temperature=1220,
                rate=210.0,
                hold_time_minutes=0
            )
        ]
        self.record.firing_plan = FiringPlan(
            plan_id="FP-TEST",
            name="测试计划",
            segments=segments
        )
        
        self.record.temperature_data = [
            TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 8, 0, 0),
                temperatures={"上层": 25.0, "中层": 24.0, "下层": 23.0},
                elapsed_minutes=0
            ),
            TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 8, 10, 0),
                temperatures={"上层": 60.0, "中层": 58.0, "下层": 55.0},
                elapsed_minutes=10
            ),
            TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 8, 20, 0),
                temperatures={"上层": 150.0, "中层": 145.0, "下层": 138.0},
                elapsed_minutes=20
            )
        ]
    
    def test_rate_exceeded_detection(self):
        rule = RateRule()
        risks = rule.check(self.record)
        
        self.assertIsNotNone(risks)
        for risk in risks:
            self.assertEqual(risk.risk_type, RiskType.RATE_EXCEEDED)


class TestInsulationRule(unittest.TestCase):
    
    def setUp(self):
        self.record = FiringRecord(
            record_id="TEST-001",
            name="测试",
            created_at=datetime.now()
        )
        
        segments = [
            FiringSegment(
                segment_id="S1",
                name="保温阶段",
                start_temperature=1220,
                end_temperature=1220,
                rate=0,
                hold_time_minutes=30
            )
        ]
        self.record.firing_plan = FiringPlan(
            plan_id="FP-TEST",
            name="测试计划",
            segments=segments
        )
        
        temp_data = []
        for i in range(15):
            temp_data.append(TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 11, i),
                temperatures={"上层": 1220.0, "中层": 1218.0, "下层": 1215.0},
                elapsed_minutes=i
            ))
        self.record.temperature_data = temp_data
    
    def test_insufficient_hold_detection(self):
        rule = InsulationRule()
        risks = rule.check(self.record)
        
        self.assertIsNotNone(risks)
        for risk in risks:
            self.assertEqual(risk.risk_type, RiskType.INSUFFICIENT_HOLD)


class TestTemperatureDiffRule(unittest.TestCase):
    
    def setUp(self):
        self.record = FiringRecord(
            record_id="TEST-001",
            name="测试",
            created_at=datetime.now()
        )
        
        self.record.temperature_data = [
            TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 8, 0, 0),
                temperatures={"上层": 25.0, "中层": 24.0, "下层": 23.0},
                elapsed_minutes=0
            ),
            TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 9, 0, 0),
                temperatures={"上层": 500.0, "中层": 470.0, "下层": 440.0},
                elapsed_minutes=60
            )
        ]
    
    def test_temperature_diff_detection(self):
        rule = TemperatureDiffRule(max_diff_threshold=50.0)
        risks = rule.check(self.record)
        
        self.assertIsNotNone(risks)
        for risk in risks:
            self.assertEqual(risk.risk_type, RiskType.TEMPERATURE_DIFF)


class TestBatchMatchRule(unittest.TestCase):
    
    def setUp(self):
        self.record = FiringRecord(
            record_id="TEST-001",
            name="测试",
            created_at=datetime.now()
        )
        
        self.record.glaze_batches = [
            GlazeBatch(batch_id="GB-001", glaze_name="青瓷釉", status="可用"),
            GlazeBatch(batch_id="GB-002", glaze_name="影青釉", status="可用"),
            GlazeBatch(batch_id="GB-003", glaze_name="均红釉", status="已过期"),
            GlazeBatch(batch_id="GB-004", glaze_name="透明釉", status="已用完")
        ]
        
        self.record.work_pieces = [
            WorkPiece(work_id="W-001", title="花瓶", artist="张三", glaze_batch_id="GB-001"),
            WorkPiece(work_id="W-002", title="茶壶", artist="李四", glaze_batch_id="GB-003"),
            WorkPiece(work_id="W-003", title="杯子", artist="王五", glaze_batch_id="GB-INVALID"),
            WorkPiece(work_id="W-004", title="碟子", artist="赵六", glaze_batch_id="GB-004")
        ]
    
    def test_batch_match_detection(self):
        rule = BatchMatchRule()
        risks = rule.check(self.record)
        
        self.assertIsNotNone(risks)
        
        risk_types = [r.risk_type for r in risks]
        self.assertIn(RiskType.BATCH_MISMATCH, risk_types)
        self.assertIn(RiskType.DUPLICATE_WORK_ID, risk_types)


if __name__ == "__main__":
    unittest.main()
