"""规则引擎测试"""

import pytest
from datetime import date, datetime, timedelta
from pathlib import Path
import tempfile

from rescue_car_inspector.rules import (
    RuleEngine,
    CheckResult,
    CheckCategory,
    Severity,
)
from rescue_car_inspector.models import (
    ScanRecord,
    MedicationExpiry,
    MaintenanceBorrow,
    LedgerManager,
)
from rescue_car_inspector.metadata_parser import PhotoMetadata


class TestRuleEngine:
    """规则引擎测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.engine = RuleEngine(near_expiry_days=30)

    def test_seal_continuity_normal(self):
        """测试封签连续性 - 正常情况"""
        records = [
            ScanRecord(
                scan_id="S001",
                rescue_car_id="RC-001",
                seal_number="FQ001",
                scan_time=datetime(2026, 5, 1, 8, 0, 0),
                operator="张护士",
                shift="白班",
            ),
            ScanRecord(
                scan_id="S002",
                rescue_car_id="RC-001",
                seal_number="FQ002",
                scan_time=datetime(2026, 5, 1, 16, 0, 0),
                operator="李护士",
                shift="晚班",
            ),
        ]

        results = self.engine.check_seal_continuity(records)
        assert len(results) == 0

    def test_seal_continuity_gap(self):
        """测试封签连续性 - 断签情况"""
        records = [
            ScanRecord(
                scan_id="S001",
                rescue_car_id="RC-001",
                seal_number="FQ001",
                scan_time=datetime(2026, 5, 1, 8, 0, 0),
                operator="张护士",
                shift="白班",
            ),
            ScanRecord(
                scan_id="S002",
                rescue_car_id="RC-001",
                seal_number="FQ003",
                scan_time=datetime(2026, 5, 1, 16, 0, 0),
                operator="李护士",
                shift="晚班",
            ),
        ]

        results = self.engine.check_seal_continuity(records)
        assert len(results) == 1
        assert results[0].category == CheckCategory.SEAL_CONTINUITY
        assert results[0].severity == Severity.HIGH
        assert "断签" in results[0].description
        assert results[0].details["missing_count"] == 1

    def test_seal_continuity_backward(self):
        """测试封签连续性 - 封签倒退情况"""
        records = [
            ScanRecord(
                scan_id="S001",
                rescue_car_id="RC-001",
                seal_number="FQ005",
                scan_time=datetime(2026, 5, 1, 8, 0, 0),
                operator="张护士",
                shift="白班",
            ),
            ScanRecord(
                scan_id="S002",
                rescue_car_id="RC-001",
                seal_number="FQ003",
                scan_time=datetime(2026, 5, 1, 16, 0, 0),
                operator="李护士",
                shift="晚班",
            ),
        ]

        results = self.engine.check_seal_continuity(records)
        assert len(results) == 1
        assert results[0].severity == Severity.CRITICAL
        assert "倒退" in results[0].description

    def test_medication_expired(self):
        """测试药品效期 - 过期药品"""
        today = date.today()
        expired_date = today - timedelta(days=10)

        medications = [
            MedicationExpiry(
                medication_id="MED001",
                name="盐酸肾上腺素注射液",
                specification="1mg:1ml/支",
                batch_number="20240101",
                expiry_date=expired_date,
                quantity=10,
            )
        ]

        results = self.engine.check_medication_expiry(medications)
        assert len(results) == 1
        assert results[0].category == CheckCategory.MEDICATION_EXPIRY
        assert results[0].severity == Severity.CRITICAL
        assert "已过期" in results[0].description

    def test_medication_near_expiry(self):
        """测试药品效期 - 近效期药品"""
        today = date.today()
        near_expiry_date = today + timedelta(days=15)

        medications = [
            MedicationExpiry(
                medication_id="MED002",
                name="阿托品注射液",
                specification="0.5mg:1ml/支",
                batch_number="20240201",
                expiry_date=near_expiry_date,
                quantity=8,
            )
        ]

        results = self.engine.check_medication_expiry(medications)
        assert len(results) == 1
        assert results[0].severity in (Severity.HIGH, Severity.MEDIUM)
        assert "近效期" in results[0].description

    def test_medication_valid(self):
        """测试药品效期 - 正常有效期药品"""
        today = date.today()
        valid_date = today + timedelta(days=180)

        medications = [
            MedicationExpiry(
                medication_id="MED003",
                name="多巴胺注射液",
                specification="20mg:2ml/支",
                batch_number="20240301",
                expiry_date=valid_date,
                quantity=12,
            )
        ]

        results = self.engine.check_medication_expiry(medications)
        assert len(results) == 0

    def test_device_borrowed(self):
        """测试设备借还冲突 - 借出设备"""
        now = datetime.now()
        borrow_time = now - timedelta(days=2)
        expected_return = now - timedelta(days=1)

        maintenances = [
            MaintenanceBorrow(
                record_id="MB001",
                device_id="DEV-001",
                device_name="除颤仪1号",
                operation_type="借用",
                request_time=borrow_time,
                operator="王医生",
                expected_return_time=expected_return,
                status="active",
            )
        ]

        results = self.engine.check_device_conflict(maintenances)
        assert len(results) == 1
        assert results[0].category == CheckCategory.DEVICE_CONFLICT
        assert "超期" in results[0].description
        assert results[0].severity == Severity.HIGH

    def test_device_borrowed_not_overdue(self):
        """测试设备借还冲突 - 借出但未超期"""
        now = datetime.now()
        borrow_time = now - timedelta(hours=2)
        expected_return = now + timedelta(days=1)

        maintenances = [
            MaintenanceBorrow(
                record_id="MB002",
                device_id="DEV-002",
                device_name="心电图机1号",
                operation_type="借用",
                request_time=borrow_time,
                operator="李医生",
                expected_return_time=expected_return,
                status="active",
            )
        ]

        results = self.engine.check_device_conflict(maintenances)
        assert len(results) == 1
        assert results[0].severity == Severity.MEDIUM
        assert "借出状态" in results[0].description

    def test_device_returned(self):
        """测试设备借还冲突 - 已归还设备"""
        now = datetime.now()
        borrow_time = now - timedelta(days=3)
        expected_return = now - timedelta(days=1)
        actual_return = now - timedelta(days=2)

        maintenances = [
            MaintenanceBorrow(
                record_id="MB003",
                device_id="DEV-003",
                device_name="除颤仪2号",
                operation_type="借用",
                request_time=borrow_time,
                operator="张医生",
                expected_return_time=expected_return,
                actual_return_time=actual_return,
                status="completed",
            )
        ]

        results = self.engine.check_device_conflict(maintenances)
        assert len(results) == 0

    def test_photo_anomaly_future_time(self):
        """测试照片时间异常 - 未来时间"""
        now = datetime.now()
        future_time = now + timedelta(hours=1)

        photos = [
            PhotoMetadata(
                filename="seal_001.jpg",
                file_path="/tmp/seal_001.jpg",
                file_size=1024,
                file_hash="abc123",
                capture_time=future_time,
            )
        ]

        results = self.engine.check_photo_anomaly(photos)
        assert len(results) >= 1
        future_results = [r for r in results if "未来时间" in r.description]
        assert len(future_results) >= 1
        assert future_results[0].severity == Severity.HIGH

    def test_photo_anomaly_duplicate_hash(self):
        """测试照片时间异常 - 相同哈希"""
        now = datetime.now()

        photos = [
            PhotoMetadata(
                filename="seal_001.jpg",
                file_path="/tmp/seal_001.jpg",
                file_size=1024,
                file_hash="duplicate_hash",
                capture_time=now,
            ),
            PhotoMetadata(
                filename="seal_002.jpg",
                file_path="/tmp/seal_002.jpg",
                file_size=1024,
                file_hash="duplicate_hash",
                capture_time=now,
            ),
        ]

        results = self.engine.check_photo_anomaly(photos)
        duplicate_results = [r for r in results if "相同哈希" in r.description]
        assert len(duplicate_results) == 1
        assert duplicate_results[0].severity == Severity.HIGH

    def test_check_all(self):
        """测试完整检查流程"""
        today = date.today()
        now = datetime.now()

        ledger = LedgerManager()

        ledger.scan_records = [
            ScanRecord(
                scan_id="S001",
                rescue_car_id="RC-001",
                seal_number="FQ001",
                scan_time=now - timedelta(hours=8),
                operator="张护士",
            ),
            ScanRecord(
                scan_id="S002",
                rescue_car_id="RC-001",
                seal_number="FQ003",
                scan_time=now,
                operator="李护士",
            ),
        ]

        ledger.medications = [
            MedicationExpiry(
                medication_id="MED001",
                name="过期药品",
                specification="测试",
                batch_number="TEST001",
                expiry_date=today - timedelta(days=5),
            ),
        ]

        ledger.maintenances = [
            MaintenanceBorrow(
                record_id="MB001",
                device_id="DEV-001",
                device_name="除颤仪",
                operation_type="借用",
                request_time=now - timedelta(days=3),
                operator="王医生",
                expected_return_time=now - timedelta(days=1),
                status="active",
            ),
        ]

        photos = [
            PhotoMetadata(
                filename="test.jpg",
                file_path="/tmp/test.jpg",
                file_size=1024,
                file_hash="test123",
                capture_time=now,
            )
        ]

        results = self.engine.check_all(ledger, photos)

        assert "封签连续性检查" in results
        assert "药品效期检查" in results
        assert "设备借还冲突检查" in results
        assert "照片时间异常检查" in results

        assert len(results["封签连续性检查"]) == 1
        assert len(results["药品效期检查"]) == 1
        assert len(results["设备借还冲突检查"]) == 1


class TestCheckResult:
    """检查结果类测试"""

    def test_check_result_to_dict(self):
        """测试转换为字典"""
        result = CheckResult(
            rid="TEST-001",
            category=CheckCategory.SEAL_CONTINUITY,
            severity=Severity.HIGH,
            description="测试问题",
            details={"key": "value"},
            affected_items=["item1", "item2"],
            suggestion="测试建议",
        )

        data = result.to_dict()

        assert data["id"] == "TEST-001"
        assert data["category"] == "封签连续性"
        assert data["severity"] == "high"
        assert data["description"] == "测试问题"
        assert data["details"]["key"] == "value"
        assert data["affected_items"] == ["item1", "item2"]
        assert data["suggestion"] == "测试建议"

    def test_check_result_from_dict(self):
        """测试从字典创建"""
        data = {
            "id": "TEST-002",
            "category": "药品效期",
            "severity": "critical",
            "description": "测试问题2",
            "details": {"test": 123},
            "affected_items": ["med1"],
            "suggestion": "建议2",
            "check_time": datetime.now().isoformat(),
        }

        result = CheckResult.from_dict(data)

        assert result.rid == "TEST-002"
        assert result.category == CheckCategory.MEDICATION_EXPIRY
        assert result.severity == Severity.CRITICAL
        assert result.description == "测试问题2"
        assert result.details["test"] == 123


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
