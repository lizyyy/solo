"""测试用例 - 异常检测与回滚模块。"""
import pytest
from datetime import date, datetime, timedelta

from overbooking.anomaly_detector import AnomalyDetector
from overbooking.rollback_manager import RollbackManager
from overbooking.probability_model import ProbabilityModel, NoShowPrediction
from overbooking.models import (
    CabinClass, FlightOrder, NoShowHistory, FlightInfo,
    CompensateRule, OptimizationRequest, OptimizationResult,
    DataIssue
)


class TestAnomalyDetector:
    """异常检测器测试。"""

    def setup_method(self):
        self.detector = AnomalyDetector()

    def test_detect_no_show_misestimation_deviation(self):
        """检测爽约率与历史偏差过大。"""
        from overbooking.models import CabinClass

        prediction = NoShowPrediction()
        prediction.cabin_level[CabinClass.ECONOMY] = 0.45
        prediction.sample_size[CabinClass.ECONOMY] = 100

        histories = [
            NoShowHistory(
                history_id=f"H{i:03d}",
                passenger_name=f"旅客{i}",
                flight_date=date(2026, 1, 1) + timedelta(days=i),
                flight_no="CA1234",
                was_no_show=i < 10
            )
            for i in range(100)
        ]

        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={CabinClass.ECONOMY: 150}
        )

        anomalies = self.detector.detect_no_show_misestimation(
            prediction, histories, flight_info
        )

        assert len(anomalies) >= 2

        deviation_anomalies = [
            a for a in anomalies
            if a.anomaly_type == "no_show_misestimation" and "偏差" in a.description
        ]
        assert len(deviation_anomalies) >= 1

        high_anomalies = [
            a for a in anomalies
            if a.anomaly_type == "no_show_misestimation" and "偏高" in a.description
        ]
        assert len(high_anomalies) >= 1

    def test_detect_no_show_misestimation_low_sample(self):
        """检测样本量不足。"""
        prediction = NoShowPrediction()
        prediction.cabin_level[CabinClass.ECONOMY] = 0.09
        prediction.sample_size[CabinClass.ECONOMY] = 10

        histories = []
        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={CabinClass.ECONOMY: 150}
        )

        anomalies = self.detector.detect_no_show_misestimation(
            prediction, histories, flight_info
        )

        sample_anomalies = [
            a for a in anomalies
            if "样本量不足" in a.description
        ]
        assert len(sample_anomalies) >= 1

    def test_detect_compensation_missing(self):
        """检测补偿规则缺失。"""
        rules = [
            CompensateRule(
                rule_id="R001",
                cabin_class=CabinClass.ECONOMY,
                threshold_hours=24,
                compensation_amount=500
            ),
            CompensateRule(
                rule_id="R002",
                cabin_class=CabinClass.BUSINESS,
                threshold_hours=24,
                compensation_amount=2000
            )
        ]

        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={
                CabinClass.ECONOMY: 150,
                CabinClass.BUSINESS: 20,
                CabinClass.FIRST: 8
            }
        )

        anomalies = self.detector.detect_compensation_missing(
            rules, flight_info, hours_before_flight=10
        )

        missing_anomalies = [
            a for a in anomalies
            if a.anomaly_type == "compensation_missing" and "缺失" in a.description
        ]
        assert len(missing_anomalies) >= 1
        assert "F" in missing_anomalies[0].description or "FIRST" in missing_anomalies[0].description

    def test_detect_compensation_missing_zero_amount(self):
        """检测补偿金额为0。"""
        rules = [
            CompensateRule(
                rule_id="R001",
                cabin_class=CabinClass.ECONOMY,
                threshold_hours=24,
                compensation_amount=0
            )
        ]

        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={CabinClass.ECONOMY: 150}
        )

        anomalies = self.detector.detect_compensation_missing(rules, flight_info)
        zero_anomalies = [
            a for a in anomalies
            if a.anomaly_type == "compensation_missing" and "金额为0" in a.description
        ]
        assert len(zero_anomalies) >= 1

    def test_detect_cabin_boundary_violation(self):
        """检测舱位越界。"""
        result = OptimizationResult(
            result_id="RES001",
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            optimal_overbooking={
                CabinClass.ECONOMY: 40,
                CabinClass.BUSINESS: 5
            },
            expected_no_show_rate={
                CabinClass.ECONOMY: 0.15,
                CabinClass.BUSINESS: 0.08
            },
            expected_revenue=100000,
            expected_compensation_cost=5000,
            expected_net_profit=95000,
            risk_level="high",
            risk_explanation="高风险",
            scenarios=[]
        )

        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={
                CabinClass.ECONOMY: 150,
                CabinClass.BUSINESS: 20
            }
        )

        orders = [
            FlightOrder(
                order_id=f"ORD{i:03d}",
                flight_no="CA1234",
                flight_date=date(2026, 6, 15),
                passenger_name=f"旅客{i}",
                cabin_class=CabinClass.ECONOMY if i < 140 else CabinClass.BUSINESS,
                fare_amount=800 if i < 140 else 2500,
                booking_date=date(2026, 5, 1)
            )
            for i in range(160)
        ]

        anomalies = self.detector.detect_cabin_boundary_violation(
            result, flight_info, orders
        )

        ratio_anomalies = [
            a for a in anomalies
            if "超过上限" in a.description
        ]
        assert len(ratio_anomalies) >= 1

        full_anomalies = [
            a for a in anomalies
            if "已满舱仍建议超售" in a.description
        ]
        assert len(full_anomalies) >= 1

    def test_detect_data_quality_issues(self):
        """检测数据质量问题。"""
        data_issues = [
            DataIssue(
                issue_id="ISS001",
                issue_type="duplicate",
                severity="warning",
                description="发现重复订单",
                affected_records=[{"order_id": "ORD001"}],
                suggested_action="manual_review"
            ),
            DataIssue(
                issue_id="ISS002",
                issue_type="date_format",
                severity="error",
                description="日期格式错误",
                affected_records=[{"order_id": "ORD002"}],
                suggested_action="reject"
            )
        ]

        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={CabinClass.ECONOMY: 150}
        )

        anomalies = self.detector.detect_data_quality_issues(data_issues, flight_info)
        assert len(anomalies) == 2

    def test_summarize_anomalies(self):
        """测试异常汇总。"""
        from overbooking.anomaly_detector import AnomalyRecord

        self.detector.anomalies = [
            AnomalyRecord(
                anomaly_id="A001",
                anomaly_type="no_show_misestimation",
                severity="error",
                category="概率模型",
                description="测试错误",
                human_explanation="测试解释",
                affected_records=[],
                suggested_action="manual_review",
                action_options=["manual_review"],
                detected_at=datetime.now()
            ),
            AnomalyRecord(
                anomaly_id="A002",
                anomaly_type="compensation_missing",
                severity="warning",
                category="补偿规则",
                description="测试警告",
                human_explanation="测试解释",
                affected_records=[],
                suggested_action="request_more_data",
                action_options=["request_more_data"],
                detected_at=datetime.now()
            )
        ]

        summary = self.detector.summarize_anomalies()
        assert summary["total"] == 2
        assert summary["by_severity"]["error"] == 1
        assert summary["by_severity"]["warning"] == 1


class TestRollbackManager:
    """回滚管理器测试。"""

    def setup_method(self, tmp_path):
        self.tmp_path = tmp_path
        self.manager = RollbackManager(storage_path=None)

    def test_save_and_get_optimization(self, tmp_path):
        """测试保存和获取优化记录。"""
        manager = RollbackManager(storage_path=str(tmp_path))

        request = OptimizationRequest(
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15)
        )

        result = OptimizationResult(
            result_id="RES001",
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            optimal_overbooking={CabinClass.ECONOMY: 10},
            expected_no_show_rate={CabinClass.ECONOMY: 0.09},
            expected_revenue=100000,
            expected_compensation_cost=5000,
            expected_net_profit=95000,
            risk_level="low",
            risk_explanation="低风险",
            scenarios=[]
        )

        record = manager.save_optimization(
            request=request,
            result=result,
            created_by="test_user",
            flight_orders_count=100,
            no_show_count=200
        )

        assert record.record_id is not None
        assert record.status == "active"

        retrieved = manager.get_latest_active("CA1234", "2026-06-15")
        assert retrieved is not None
        assert retrieved.record_id == record.record_id

    def test_check_duplicate_request(self):
        """测试重复请求检测。"""
        request = OptimizationRequest(
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15)
        )

        result = OptimizationResult(
            result_id="RES001",
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            optimal_overbooking={},
            expected_no_show_rate={},
            expected_revenue=0,
            expected_compensation_cost=0,
            expected_net_profit=0,
            risk_level="low",
            risk_explanation="",
            scenarios=[]
        )

        self.manager.save_optimization(request, result, flight_orders_count=100, no_show_count=200)

        is_duplicate, existing = self.manager.check_duplicate_request(
            request, 100, 200, tolerance_seconds=3600
        )
        assert is_duplicate is True
        assert existing is not None

        is_duplicate, existing = self.manager.check_duplicate_request(
            request, 101, 200, tolerance_seconds=3600
        )
        assert is_duplicate is False

    def test_rollback(self):
        """测试回滚功能。"""
        request = OptimizationRequest(
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15)
        )

        result = OptimizationResult(
            result_id="RES001",
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            optimal_overbooking={},
            expected_no_show_rate={},
            expected_revenue=0,
            expected_compensation_cost=0,
            expected_net_profit=0,
            risk_level="low",
            risk_explanation="",
            scenarios=[]
        )

        record = self.manager.save_optimization(request, result)

        success = self.manager.rollback(record.record_id, "测试回滚", "test_user")
        assert success is True

        retrieved = self.manager.get_latest_active("CA1234", "2026-06-15")
        assert retrieved is None

        history = self.manager.get_flight_history("CA1234", "2026-06-15", include_rolled_back=True)
        assert len(history) == 1
        assert history[0].status == "rolled_back"

    def test_apply_manual_override(self):
        """测试人工覆盖。"""
        request = OptimizationRequest(
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15)
        )

        result = OptimizationResult(
            result_id="RES001",
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            optimal_overbooking={CabinClass.ECONOMY: 10},
            expected_no_show_rate={CabinClass.ECONOMY: 0.09},
            expected_revenue=100000,
            expected_compensation_cost=5000,
            expected_net_profit=95000,
            risk_level="low",
            risk_explanation="低风险",
            scenarios=[]
        )

        record = self.manager.save_optimization(request, result)

        override = self.manager.apply_manual_override(
            record_id=record.record_id,
            field_name="optimal_overbooking.Y",
            new_value=15,
            reason="旺季需求高",
            applied_by="test_user"
        )

        assert override is not None
        assert override.old_value == 10
        assert override.new_value == 15

        updated_record = self.manager.records[record.record_id]
        assert updated_record.result.optimal_overbooking[CabinClass.ECONOMY] == 15

    def test_get_audit_trail(self):
        """测试审计追踪。"""
        request = OptimizationRequest(
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15)
        )

        result = OptimizationResult(
            result_id="RES001",
            request_id="REQ001",
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            optimal_overbooking={},
            expected_no_show_rate={},
            expected_revenue=0,
            expected_compensation_cost=0,
            expected_net_profit=0,
            risk_level="low",
            risk_explanation="",
            scenarios=[]
        )

        record = self.manager.save_optimization(request, result)

        self.manager.apply_manual_override(
            record.record_id, "risk_level", "medium", "调整风险等级", "test_user"
        )

        audit = self.manager.get_audit_trail(record.record_id)
        assert audit["override_count"] == 1
        assert len(audit["manual_overrides"]) == 1

    def test_get_statistics(self, tmp_path):
        """测试统计信息。"""
        manager = RollbackManager(storage_path=str(tmp_path))

        for i in range(3):
            request = OptimizationRequest(
                request_id=f"REQ{i:03d}",
                flight_no="CA1234",
                flight_date=date(2026, 6, 15)
            )
            result = OptimizationResult(
                result_id=f"RES{i:03d}",
                request_id=f"REQ{i:03d}",
                flight_no="CA1234",
                flight_date=date(2026, 6, 15),
                optimal_overbooking={},
                expected_no_show_rate={},
                expected_revenue=0,
                expected_compensation_cost=0,
                expected_net_profit=0,
                risk_level="low",
                risk_explanation="",
                scenarios=[]
            )
            manager.save_optimization(request, result)

        records = list(manager.records.values())
        manager.rollback(records[0].record_id, "测试", "test")

        stats = manager.get_statistics()
        assert stats["total_records"] == 3
        assert stats["active_records"] == 2
        assert stats["rolled_back_records"] == 1
