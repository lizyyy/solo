import unittest
from datetime import datetime
from models.data_models import (
    TemperaturePoint,
    FiringSegment,
    FiringPlan,
    GlazeBatch,
    WorkPiece,
    Observation,
    Risk,
    RiskLevel,
    RiskType,
    ReviewStatus,
    TimelineEvent,
    FiringRecord
)


class TestDataModels(unittest.TestCase):
    
    def test_temperature_point_creation(self):
        tp = TemperaturePoint(
            timestamp=datetime(2024, 1, 15, 8, 0, 0),
            temperatures={"上层": 25.0, "中层": 24.5, "下层": 24.8},
            elapsed_minutes=0
        )
        self.assertEqual(tp.timestamp, datetime(2024, 1, 15, 8, 0, 0))
        self.assertEqual(tp.temperatures["上层"], 25.0)
        self.assertEqual(tp.elapsed_minutes, 0)
    
    def test_firing_segment_creation(self):
        segment = FiringSegment(
            segment_id="S1",
            name="预热阶段",
            start_temperature=25,
            end_temperature=300,
            rate=150.0,
            hold_time_minutes=0,
            description="缓慢升温以排除坯体中的水分"
        )
        self.assertEqual(segment.segment_id, "S1")
        self.assertEqual(segment.rate, 150.0)
        self.assertEqual(segment.hold_time_minutes, 0)
    
    def test_firing_plan_creation(self):
        segments = [
            FiringSegment(
                segment_id="S1",
                name="预热阶段",
                start_temperature=25,
                end_temperature=300,
                rate=150.0,
                hold_time_minutes=0
            ),
            FiringSegment(
                segment_id="S2",
                name="保温阶段",
                start_temperature=1220,
                end_temperature=1220,
                rate=0,
                hold_time_minutes=30
            )
        ]
        plan = FiringPlan(
            plan_id="FP-2024-001",
            name="测试烧成计划",
            segments=segments,
            created_at=datetime(2024, 1, 10, 8, 0, 0)
        )
        self.assertEqual(plan.plan_id, "FP-2024-001")
        self.assertEqual(len(plan.segments), 2)
    
    def test_glaze_batch_status_handling(self):
        batch = GlazeBatch(
            batch_id="GB-2024-001",
            glaze_name="青瓷釉",
            status="可用"
        )
        self.assertEqual(batch.status, "可用")
        self.assertTrue(batch.is_available())
        
        expired_batch = GlazeBatch(
            batch_id="GB-2024-002",
            glaze_name="均红釉",
            status="已过期"
        )
        self.assertFalse(expired_batch.is_available())
    
    def test_risk_enum_values(self):
        self.assertEqual(RiskLevel.LOW.value, "低")
        self.assertEqual(RiskLevel.MEDIUM.value, "中")
        self.assertEqual(RiskLevel.HIGH.value, "高")
        self.assertEqual(RiskLevel.CRITICAL.value, "严重")
        
        self.assertEqual(RiskType.RATE_EXCEEDED.value, "升温速率超限")
        self.assertEqual(RiskType.INSUFFICIENT_HOLD.value, "保温时间不足")
        self.assertEqual(RiskType.TEMPERATURE_DIFF.value, "层间温差过大")
        self.assertEqual(RiskType.BATCH_MISMATCH.value, "釉料批次不匹配")
        
        self.assertEqual(ReviewStatus.PENDING.value, "待复核")
        self.assertEqual(ReviewStatus.CONFIRMED.value, "已确认")
        self.assertEqual(ReviewStatus.IGNORED.value, "已忽略")
        self.assertEqual(ReviewStatus.RESOLVED.value, "已解决")
    
    def test_risk_creation(self):
        risk = Risk(
            risk_id="R-001",
            risk_type=RiskType.RATE_EXCEEDED,
            level=RiskLevel.HIGH,
            description="升温速率超过计划限值",
            timestamp=datetime(2024, 1, 15, 9, 30, 0),
            details={"actual_rate": 250.0, "planned_rate": 200.0, "exceeded_by": 50.0}
        )
        self.assertEqual(risk.risk_type, RiskType.RATE_EXCEEDED)
        self.assertEqual(risk.level, RiskLevel.HIGH)
        self.assertEqual(risk.review_status, ReviewStatus.PENDING)
        self.assertEqual(risk.details["actual_rate"], 250.0)
    
    def test_risk_review(self):
        risk = Risk(
            risk_id="R-001",
            risk_type=RiskType.RATE_EXCEEDED,
            level=RiskLevel.HIGH,
            description="测试风险",
            timestamp=datetime(2024, 1, 15, 9, 30, 0)
        )
        
        risk.review(ReviewStatus.CONFIRMED, "确认存在问题")
        self.assertEqual(risk.review_status, ReviewStatus.CONFIRMED)
        self.assertEqual(risk.review_notes, "确认存在问题")
        self.assertIsNotNone(risk.reviewed_at)
    
    def test_timeline_event_creation(self):
        event = TimelineEvent(
            event_id="E-001",
            event_type="phase_start",
            timestamp=datetime(2024, 1, 15, 8, 0, 0),
            title="预热阶段开始",
            description="进入预热阶段，目标温度300℃",
            details={"phase": "preheat", "target_temp": 300}
        )
        self.assertEqual(event.event_type, "phase_start")
        self.assertEqual(event.title, "预热阶段开始")
    
    def test_firing_record_creation(self):
        record = FiringRecord(
            record_id="FR-2024-001",
            name="2024年第一窑",
            created_at=datetime(2024, 1, 15, 8, 0, 0)
        )
        self.assertEqual(record.record_id, "FR-2024-001")
        self.assertEqual(len(record.temperature_data), 0)
        self.assertIsNone(record.firing_plan)
        self.assertEqual(len(record.glaze_batches), 0)
        self.assertEqual(len(record.work_pieces), 0)
        self.assertEqual(len(record.observations), 0)
        self.assertEqual(len(record.risks), 0)
        self.assertEqual(len(record.timeline), 0)


if __name__ == "__main__":
    unittest.main()
