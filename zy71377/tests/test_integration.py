import os
import json
import tempfile
from datetime import datetime

import pytest

from cloud_bill_analyzer.core.config import Config, load_config
from cloud_bill_analyzer.core.models import CloudProvider, AnomalyType
from cloud_bill_analyzer.parsers import get_parser, AWSParser, AliyunParser, VolcengineParser
from cloud_bill_analyzer.processors import run_full_pipeline
from cloud_bill_analyzer.reporters import export_machine_readable, export_human_report
from cloud_bill_analyzer.utils.security import (
    mask_sensitive_data,
    mask_sensitive_string,
    is_sensitive_field,
    MaskingContext,
)
from cloud_bill_analyzer.utils.currency import convert_currency, normalize_currency_code


TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


class TestConfig:
    def test_default_config(self):
        config = Config()
        assert config.target_currency == "CNY"
        assert config.anomaly_threshold_percent == 20.0
        assert config.enable_display_masking is True

    def test_load_config(self):
        config = load_config()
        assert config is not None

    def test_config_masking_flags(self):
        config = Config()
        assert config.enable_display_masking == True
        assert config.enable_export_masking == True
        assert config.enable_log_masking == True


class TestSecurity:
    def test_is_sensitive_field(self):
        config = Config()
        assert is_sensitive_field("aws_account_id", config) is True
        assert is_sensitive_field("AccountId", config) is True
        assert is_sensitive_field("service", config) is False

    def test_mask_sensitive_string(self):
        config = Config()
        masked = mask_sensitive_string("123456789012", config)
        assert "***" in masked
        assert masked.startswith("1234")
        assert masked.endswith("9012")
        assert len(masked) > 8

    def test_mask_short_string(self):
        config = Config()
        masked = mask_sensitive_string("abc", config)
        assert masked == config.mask_pattern

    def test_mask_sensitive_data_dict(self):
        config = Config()
        data = {
            "aws_account_id": "123456789012",
            "service": "EC2",
            "cost": 100.0,
        }
        masked = mask_sensitive_data(data, config, MaskingContext.EXPORT)
        assert "***" in masked["aws_account_id"]
        assert masked["service"] == "EC2"
        assert masked["cost"] == 100.0

    def test_mask_nested_data(self):
        config = Config()
        data = {
            "user": {
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "sk-abc123def456ghi789",
            },
            "name": "test",
        }
        masked = mask_sensitive_data(data, config, MaskingContext.LOG)
        assert "***" in masked["user"]["access_key"]
        assert "***" in masked["user"]["secret_key"]
        assert masked["name"] == "test"

    def test_mask_disabled(self):
        config = Config()
        config.enable_export_masking = False
        data = {"aws_account_id": "123456789012"}
        masked = mask_sensitive_data(data, config, MaskingContext.EXPORT)
        assert masked["aws_account_id"] == "123456789012"


class TestCurrency:
    def test_normalize_currency_code(self):
        assert normalize_currency_code("USD") == "USD"
        assert normalize_currency_code("rmb") == "CNY"
        assert normalize_currency_code("¥") == "CNY"
        assert normalize_currency_code("$") == "USD"

    def test_convert_currency(self):
        config = Config()
        result, rate = convert_currency(100, "USD", "CNY", config)
        assert result == pytest.approx(725.0)
        assert rate == pytest.approx(7.25)

    def test_convert_same_currency(self):
        config = Config()
        result, rate = convert_currency(100, "CNY", "CNY", config)
        assert result == 100.0
        assert rate == 1.0


class TestParsers:
    def test_aws_parser_detect(self):
        config = Config()
        parser = AWSParser(config)
        aws_file = os.path.join(TEST_DATA_DIR, "aws_bill.csv")
        assert parser.detect(aws_file) is True

    def test_aliyun_parser_detect(self):
        config = Config()
        parser = AliyunParser(config)
        aliyun_file = os.path.join(TEST_DATA_DIR, "aliyun_bill.csv")
        assert parser.detect(aliyun_file) is True

    def test_volcengine_parser_detect(self):
        config = Config()
        parser = VolcengineParser(config)
        volc_file = os.path.join(TEST_DATA_DIR, "volcengine_bill.csv")
        assert parser.detect(volc_file) is True

    def test_get_parser_auto_detect(self):
        config = Config()
        aws_file = os.path.join(TEST_DATA_DIR, "aws_bill.csv")
        parser = get_parser(aws_file, config)
        assert isinstance(parser, AWSParser)

    def test_aws_parse(self):
        config = Config()
        aws_file = os.path.join(TEST_DATA_DIR, "aws_bill.csv")
        parser = AWSParser(config)
        records = parser.parse(aws_file)
        assert len(records) == 12
        assert records[0].provider == CloudProvider.AWS

    def test_aliyun_parse_tags(self):
        config = Config()
        aliyun_file = os.path.join(TEST_DATA_DIR, "aliyun_bill.csv")
        parser = AliyunParser(config)
        records = parser.parse(aliyun_file)
        assert len(records) == 12
        first_row = records[0].raw_data
        tags = parser._extract_tags(first_row)
        assert "project" in tags
        assert "team" in tags
        assert "environment" in tags
        assert tags["project"] == "data-platform"

    def test_volcengine_parse_tags(self):
        config = Config()
        volc_file = os.path.join(TEST_DATA_DIR, "volcengine_bill.csv")
        parser = VolcengineParser(config)
        records = parser.parse(volc_file)
        assert len(records) == 12
        first_row = records[0].raw_data
        tags = parser._extract_tags(first_row)
        assert "project" in tags
        assert "team" in tags
        assert "environment" in tags
        assert tags["environment"] == "production"


class TestFullPipeline:
    def test_full_pipeline(self):
        config = Config()
        config.anomaly_threshold_percent = 20.0

        bill_files = [
            os.path.join(TEST_DATA_DIR, "aws_bill.csv"),
            os.path.join(TEST_DATA_DIR, "aliyun_bill.csv"),
            os.path.join(TEST_DATA_DIR, "volcengine_bill.csv"),
        ]
        budget_file = os.path.join(TEST_DATA_DIR, "budget.csv")

        result = run_full_pipeline(
            bill_files=bill_files,
            config=config,
            provider_hints=[CloudProvider.AWS, CloudProvider.ALIYUN, CloudProvider.VOLCENGINE],
            budget_file=budget_file,
        )

        assert result is not None
        assert len(result.normalized_bills) == 36
        assert len(result.anomalies) > 0
        assert result.total_normalized_cost > 0

        assert len(result.duplicate_ri_credits) == 2

        anomaly_types = {a.anomaly_type for a in result.anomalies}
        assert AnomalyType.DUPLICATE_RI_CREDIT in anomaly_types
        assert AnomalyType.MISSING_TAG in anomaly_types
        assert AnomalyType.BUDGET_EXCEEDED in anomaly_types
        assert AnomalyType.COST_SPIKE in anomaly_types

        assert len(result.budget_comparison) > 0
        for project, data in result.budget_comparison.items():
            assert "budget" in data
            assert "actual" in data
            assert "usage_percent" in data

    def test_machine_readable_export(self):
        config = Config()
        bill_files = [
            os.path.join(TEST_DATA_DIR, "aws_bill.csv"),
        ]
        result = run_full_pipeline(
            bill_files=bill_files,
            config=config,
            provider_hints=[CloudProvider.AWS],
        )

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            output_path = f.name

        try:
            exported = export_machine_readable(result, config, output_path, include_bills=True)
            assert os.path.exists(output_path)
            assert exported is not None

            with open(output_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            assert "schema_version" in data
            assert "anomalies" in data
            assert "normalized_bills" in data
            assert len(data["normalized_bills"]) == 12
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_human_report_export(self):
        config = Config()
        bill_files = [
            os.path.join(TEST_DATA_DIR, "aws_bill.csv"),
        ]
        result = run_full_pipeline(
            bill_files=bill_files,
            config=config,
            provider_hints=[CloudProvider.AWS],
        )

        with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
            output_path = f.name

        try:
            html = export_human_report(result, config, output_path)
            assert os.path.exists(output_path)
            assert html is not None
            assert "多云账单异常检测报告" in html
            assert len(html) > 1000
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)


class TestTagIssues:
    def test_missing_tags_detected(self):
        config = Config()
        config.required_tags = ["project", "team", "environment"]

        bill_files = [
            os.path.join(TEST_DATA_DIR, "aws_bill.csv"),
        ]
        result = run_full_pipeline(
            bill_files=bill_files,
            config=config,
            provider_hints=[CloudProvider.AWS],
        )

        tag_anomalies = [
            a for a in result.anomalies
            if a.anomaly_type in (AnomalyType.MISSING_TAG, AnomalyType.INVALID_TAG)
        ]
        assert len(tag_anomalies) > 0

        missing_project = [a for a in tag_anomalies if "project" in a.message]
        assert len(missing_project) > 0
