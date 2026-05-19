#!/usr/bin/env python3
import unittest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

from config_drift_audit.models import (
    ConfigItem,
    ExemptionRecord,
    ReviewStatus,
    SourceLocation,
)
from config_drift_audit.parsers import CsvParser
from config_drift_audit.rules import RuleEngine
from config_drift_audit.utils import IdempotencyManager


class TestConfigItem(unittest.TestCase):
    def test_has_drift_true(self):
        item = ConfigItem(
            service_name="test-service",
            config_key="test.key",
            expected_value="A",
            actual_value="B",
        )
        self.assertTrue(item.has_drift())

    def test_has_drift_false(self):
        item = ConfigItem(
            service_name="test-service",
            config_key="test.key",
            expected_value="A",
            actual_value="A",
        )
        self.assertFalse(item.has_drift())

    def test_row_hash_stable(self):
        item1 = ConfigItem(
            service_name="test-service",
            config_key="test.key",
            expected_value="A",
            actual_value="B",
        )
        item2 = ConfigItem(
            service_name="test-service",
            config_key="test.key",
            expected_value="A",
            actual_value="B",
        )
        self.assertEqual(item1.row_hash, item2.row_hash)


class TestExemptionRecord(unittest.TestCase):
    def test_is_expired_with_past_date(self):
        exemption = ExemptionRecord(
            service_name="test-service",
            config_key="test.key",
            reason="test",
            expire_date="2020-01-01",
        )
        self.assertTrue(exemption.is_expired())

    def test_is_expired_with_future_date(self):
        exemption = ExemptionRecord(
            service_name="test-service",
            config_key="test.key",
            reason="test",
            expire_date="2099-12-31",
        )
        self.assertFalse(exemption.is_expired())

    def test_is_expired_with_check_date(self):
        exemption = ExemptionRecord(
            service_name="test-service",
            config_key="test.key",
            reason="test",
            expire_date="2024-06-30",
        )
        check_date = datetime(2024, 7, 1)
        self.assertTrue(exemption.is_expired(check_date))
        check_date = datetime(2024, 6, 1)
        self.assertFalse(exemption.is_expired(check_date))


class TestCsvParser(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_parse_config_items(self):
        csv_content = """service_name,config_key,expected_value,actual_value
order-service,log.level,INFO,DEBUG
order-service,db.timeout,30,30
payment-service,max.retry,3,5
"""
        csv_path = Path(self.test_dir) / "configs.csv"
        csv_path.write_text(csv_content)

        parser = CsvParser()
        result = parser.parse_config_items(str(csv_path))

        self.assertEqual(len(result.items), 3)
        config_keys = {item.config_key for item in result.items}
        self.assertIn("log.level", config_keys)
        self.assertIn("db.timeout", config_keys)
        self.assertIn("max.retry", config_keys)
        self.assertEqual(len(result.source_tracker.bad_rows), 0)

    def test_parse_exemptions(self):
        csv_content = """service_name,config_key,reason,expire_date,reviewer,status
order-service,log.level,test reason,2099-12-31,zhangsan,approved
payment-service,max.retry,another reason,2020-01-01,lisi,pending
"""
        csv_path = Path(self.test_dir) / "exemptions.csv"
        csv_path.write_text(csv_content)

        parser = CsvParser()
        result = parser.parse_exemptions(str(csv_path))

        self.assertEqual(len(result.items), 2)
        reasons = {item.reason for item in result.items}
        self.assertIn("test reason", reasons)
        self.assertIn("another reason", reasons)
        status_values = {item.status for item in result.items}
        self.assertIn(ReviewStatus.APPROVED, status_values)
        self.assertIn(ReviewStatus.PENDING, status_values)

    def test_missing_columns_raises_error(self):
        csv_content = """service_name,wrong_column
order-service,test
"""
        csv_path = Path(self.test_dir) / "bad.csv"
        csv_path.write_text(csv_content)

        parser = CsvParser()
        with self.assertRaises(ValueError):
            parser.parse_config_items(str(csv_path))


class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.configs = [
            ConfigItem("svc1", "key1", "A", "B"),  # 漂移，无豁免
            ConfigItem("svc1", "key2", "X", "Y"),  # 漂移，有有效豁免
            ConfigItem("svc2", "key3", "M", "N"),  # 漂移，豁免过期
            ConfigItem("svc2", "key4", "P", "P"),  # 无漂移
        ]
        self.exemptions = [
            ExemptionRecord("svc1", "key2", "reason1", "2099-12-31", "user1", "approved"),
            ExemptionRecord("svc2", "key3", "reason2", "2020-01-01", "user2", "approved"),
        ]

    def test_process_drift_detection(self):
        from config_drift_audit.parsers.base_parser import ParseResult

        config_result = ParseResult(items=self.configs)
        exemption_result = ParseResult(items=self.exemptions)

        engine = RuleEngine()
        result = engine.process(config_result, exemption_result)
        audit_result = result.audit_result

        self.assertEqual(audit_result.summary.drifted_records, 3)
        self.assertEqual(audit_result.summary.no_exemption, 1)
        self.assertEqual(audit_result.summary.exempted_records, 2)
        self.assertEqual(audit_result.summary.expired_exemptions, 1)

    def test_process_with_check_date(self):
        from config_drift_audit.parsers.base_parser import ParseResult

        config_result = ParseResult(items=self.configs)
        exemption_result = ParseResult(items=self.exemptions)

        check_date = datetime(2019, 1, 1)
        engine = RuleEngine(check_date=check_date)
        result = engine.process(config_result, exemption_result)
        audit_result = result.audit_result

        self.assertEqual(audit_result.summary.expired_exemptions, 0)


class TestIdempotencyManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.manager = IdempotencyManager(cache_dir=self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_deduplicate_config_items(self):
        items = [
            ConfigItem("svc1", "key1", "A", "B"),
            ConfigItem("svc1", "key1", "A", "B"),  # 重复
            ConfigItem("svc2", "key2", "X", "Y"),
        ]
        deduplicated = self.manager.deduplicate_config_items(items)
        self.assertEqual(len(deduplicated), 2)

    def test_deduplicate_exemptions(self):
        exemptions = [
            ExemptionRecord("svc1", "key1", "reason1", "2099-12-31"),
            ExemptionRecord("svc1", "key1", "reason1", "2099-12-31"),  # 重复
            ExemptionRecord("svc2", "key2", "reason2", "2020-01-01"),
        ]
        deduplicated = self.manager.deduplicate_exemptions(exemptions)
        self.assertEqual(len(deduplicated), 2)


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_full_workflow(self):
        configs_csv = Path(self.test_dir) / "configs.csv"
        configs_csv.write_text("""service_name,config_key,expected_value,actual_value
order-service,log.level,INFO,DEBUG
payment-service,max.retry,3,5
user-service,cache.ttl,3600,7200
""")

        exemptions_csv = Path(self.test_dir) / "exemptions.csv"
        exemptions_csv.write_text("""service_name,config_key,reason,expire_date,status
order-service,log.level,debug issue,2020-01-01,approved
payment-service,max.retry,perf test,2099-12-31,pending
""")

        parser = CsvParser()
        configs = parser.parse_config_items(str(configs_csv))
        exemptions = parser.parse_exemptions(str(exemptions_csv))

        engine = RuleEngine()
        result = engine.process(configs, exemptions)
        audit_result = result.audit_result

        self.assertEqual(audit_result.summary.drifted_records, 3)
        self.assertEqual(audit_result.summary.expired_exemptions, 1)
        self.assertEqual(audit_result.summary.pending_review, 1)
        self.assertEqual(audit_result.summary.no_exemption, 1)


if __name__ == "__main__":
    unittest.main()
