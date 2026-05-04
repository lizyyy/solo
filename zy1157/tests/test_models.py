"""
Tests for Models
"""

import os
import tempfile
import unittest
from datetime import datetime

from jvm_tune_cli.models.gc_event import GCEvent, GCEventType
from jvm_tune_cli.models.tuning_policy import TuningPolicy, RiskLevel, TuningResult, TuningRecommendation, TuningParameter, RecommendationType


class TestGCEvent(unittest.TestCase):
    
    def test_gc_event_creation(self):
        event = GCEvent(
            timestamp=datetime(2025, 1, 15, 10, 0, 0),
            event_type=GCEventType.YOUNG_GC,
            gc_name="G1 Young GC",
            duration_ms=50.0,
            user_time_ms=200.0,
            sys_time_ms=10.0,
            real_time_ms=50.0,
            heap_before_bytes=1024 * 1024 * 1024,
            heap_after_bytes=512 * 1024 * 1024,
            heap_max_bytes=2048 * 1024 * 1024,
            cause="Allocation Failure"
        )
        
        self.assertEqual(event.event_type, GCEventType.YOUNG_GC)
        self.assertEqual(event.gc_name, "G1 Young GC")
        self.assertEqual(event.duration_ms, 50.0)
        self.assertEqual(event.heap_before_bytes, 1024 * 1024 * 1024)
        self.assertEqual(event.heap_after_bytes, 512 * 1024 * 1024)
        self.assertEqual(event.heap_reclaimed_bytes, 512 * 1024 * 1024)
        self.assertEqual(event.heap_reclaimed_percent, 50.0)
    
    def test_gc_event_properties(self):
        event_full_gc = GCEvent(
            timestamp=datetime(2025, 1, 15, 10, 0, 0),
            event_type=GCEventType.FULL_GC,
            gc_name="Full GC",
            duration_ms=850.0
        )
        
        event_humongous = GCEvent(
            timestamp=datetime(2025, 1, 15, 10, 0, 0),
            event_type=GCEventType.HUMONGOUS_ALLOCATION,
            gc_name="Humongous Allocation",
            duration_ms=5.0
        )
        
        event_promotion_failed = GCEvent(
            timestamp=datetime(2025, 1, 15, 10, 0, 0),
            event_type=GCEventType.PROMOTION_FAILED,
            gc_name="Promotion Failure",
            duration_ms=200.0
        )
        
        self.assertTrue(event_full_gc.is_full_gc)
        self.assertFalse(event_full_gc.is_humongous)
        self.assertFalse(event_full_gc.is_promotion_failed)
        
        self.assertTrue(event_humongous.is_humongous)
        self.assertFalse(event_humongous.is_full_gc)
        
        self.assertTrue(event_promotion_failed.is_promotion_failed)
    
    def test_gc_event_to_dict(self):
        event = GCEvent(
            timestamp=datetime(2025, 1, 15, 10, 0, 0),
            event_type=GCEventType.FULL_GC,
            gc_name="Full GC",
            duration_ms=850.0,
            heap_before_bytes=2000 * 1024 * 1024,
            heap_after_bytes=1000 * 1024 * 1024,
            heap_max_bytes=2048 * 1024 * 1024,
            cause="Metadata GC Threshold"
        )
        
        data = event.to_dict()
        
        self.assertEqual(data["event_type"], "FullGC")
        self.assertEqual(data["gc_name"], "Full GC")
        self.assertEqual(data["duration_ms"], 850.0)
        self.assertEqual(data["cause"], "Metadata GC Threshold")
        self.assertTrue(data["is_full_gc"])
        self.assertEqual(data["heap_reclaimed_percent"], 50.0)
    
    def test_gc_event_type_values(self):
        self.assertEqual(GCEventType.YOUNG_GC.value, "YoungGC")
        self.assertEqual(GCEventType.FULL_GC.value, "FullGC")
        self.assertEqual(GCEventType.MIXED_GC.value, "MixedGC")
        self.assertEqual(GCEventType.HUMONGOUS_ALLOCATION.value, "HumongousAllocation")
        self.assertEqual(GCEventType.PROMOTION_FAILED.value, "PromotionFailed")


class TestTuningPolicy(unittest.TestCase):
    
    def test_tuning_policy_creation(self):
        policy = TuningPolicy(
            name="custom_policy",
            version="1.0",
            risk_thresholds={
                "full_gc_count": {
                    "critical": 10,
                    "high": 5,
                    "medium": 2,
                    "low": 0
                }
            },
            slo_config={
                "max_pause_ms": 200,
                "max_gc_overhead_percent": 10
            },
            policies={
                "containerReserve": {
                    "recommended_reserve_percent": 20
                }
            }
        )
        
        self.assertEqual(policy.name, "custom_policy")
        self.assertEqual(policy.version, "1.0")
        self.assertEqual(policy.risk_thresholds["full_gc_count"]["critical"], 10)
        self.assertEqual(policy.slo_config["max_pause_ms"], 200)
    
    def test_tuning_policy_defaults(self):
        policy = TuningPolicy()
        
        self.assertEqual(policy.name, "default")
        self.assertEqual(policy.version, "1.0")
        self.assertIsNotNone(policy.risk_thresholds)
        self.assertIsNotNone(policy.slo_config)
        self.assertIsNotNone(policy.policies)
        
        self.assertIn("full_gc_count", policy.risk_thresholds)
        self.assertIn("max_pause_ms", policy.slo_config)
        self.assertIn("containerReserve", policy.policies)
    
    def test_risk_level_enum(self):
        self.assertEqual(RiskLevel.CRITICAL.value, "Critical")
        self.assertEqual(RiskLevel.HIGH.value, "High")
        self.assertEqual(RiskLevel.MEDIUM.value, "Medium")
        self.assertEqual(RiskLevel.LOW.value, "Low")
        self.assertEqual(RiskLevel.INFO.value, "Info")
    
    def test_recommendation_type_enum(self):
        self.assertEqual(RecommendationType.HEAP_SIZE.value, "HeapSize")
        self.assertEqual(RecommendationType.PAUSE_TARGET.value, "PauseTarget")
        self.assertEqual(RecommendationType.YOUNG_GEN.value, "YoungGen")
        self.assertEqual(RecommendationType.CONTAINER_RESERVE.value, "ContainerReserve")
    
    def test_tuning_parameter(self):
        param = TuningParameter(
            name="Xmx",
            current_value="4g",
            recommended_value="6g",
            unit="bytes",
            description="Maximum heap size"
        )
        
        self.assertEqual(param.name, "Xmx")
        self.assertEqual(param.current_value, "4g")
        self.assertEqual(param.recommended_value, "6g")
        self.assertTrue(param.needs_change)
        
        param_same = TuningParameter(
            name="Xms",
            current_value="2g",
            recommended_value="2g"
        )
        self.assertFalse(param_same.needs_change)
    
    def test_tuning_policy_get_risk_level(self):
        policy = TuningPolicy()
        
        level1 = policy.get_risk_level("full_gc_count", 15)
        self.assertEqual(level1, RiskLevel.CRITICAL)
        
        level2 = policy.get_risk_level("full_gc_count", 7)
        self.assertEqual(level2, RiskLevel.HIGH)
        
        level3 = policy.get_risk_level("full_gc_count", 0)
        self.assertEqual(level3, RiskLevel.LOW)
    
    def test_tuning_policy_to_dict(self):
        policy = TuningPolicy(
            name="test_policy",
            version="2.0"
        )
        
        data = policy.to_dict()
        
        self.assertEqual(data["name"], "test_policy")
        self.assertEqual(data["version"], "2.0")
        self.assertIn("risk_thresholds", data)
        self.assertIn("slo_config", data)
        self.assertIn("policies", data)


if __name__ == "__main__":
    unittest.main()
