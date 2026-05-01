#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""配置模块测试"""

import tempfile
from pathlib import Path
from datetime import datetime

import pytest

from web_evidence_organizer.config import (
    CaseConfig,
    EvidenceType,
    TimeTrustLevel,
    RedactionRule,
    TimeSourceRule,
)


class TestCaseConfig:
    """CaseConfig 测试"""

    def test_default_creation(self):
        """测试默认创建"""
        config = CaseConfig(
            case_id="TEST-001",
            case_name="测试案件",
        )

        assert config.case_id == "TEST-001"
        assert config.case_name == "测试案件"
        assert config.timezone == "Asia/Shanghai"
        assert config.max_attachment_size_mb == 100

    def test_evidence_types(self):
        """测试证据类型映射"""
        config = CaseConfig(
            case_id="TEST-001",
            case_name="测试案件",
        )

        assert config.get_extension_type(".html") == EvidenceType.HTML_PAGE
        assert config.get_extension_type("html") == EvidenceType.HTML_PAGE
        assert config.get_extension_type(".har") == EvidenceType.HAR_LOG
        assert config.get_extension_type(".txt") == EvidenceType.CHAT_LOG
        assert config.get_extension_type(".unknown") is None

    def test_redaction_rules(self):
        """测试脱敏规则"""
        config = CaseConfig(
            case_id="TEST-001",
            case_name="测试案件",
        )

        assert len(config.redaction_rules) > 0

        phone_rule = next(
            (r for r in config.redaction_rules if r.name == "手机号"),
            None
        )
        assert phone_rule is not None
        assert phone_rule.replacement == "[PHONE]"

    def test_time_trust_rules(self):
        """测试时间可信度规则"""
        config = CaseConfig(
            case_id="TEST-001",
            case_name="测试案件",
        )

        assert len(config.time_trust_rules) > 0

        har_rule = next(
            (r for r in config.time_trust_rules if r.source == "har_request_time"),
            None
        )
        assert har_rule is not None
        assert har_rule.trust_level == TimeTrustLevel.HIGH

    def test_json_serialization(self):
        """测试JSON序列化"""
        config = CaseConfig(
            case_id="TEST-001",
            case_name="测试案件",
            custom_redaction_keywords=["测试关键词"],
        )

        json_str = config.to_json()
        assert "TEST-001" in json_str
        assert "测试案件" in json_str

        loaded = CaseConfig.from_json(json_str)
        assert loaded.case_id == "TEST-001"
        assert loaded.case_name == "测试案件"

    def test_save_and_load(self):
        """测试保存和加载"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "config.json"

            config = CaseConfig(
                case_id="TEST-001",
                case_name="测试案件",
            )

            config.save(str(config_path))
            assert config_path.exists()

            loaded = CaseConfig.load(str(config_path))
            assert loaded.case_id == "TEST-001"
            assert loaded.case_name == "测试案件"


class TestRedactionRule:
    """RedactionRule 测试"""

    def test_rule_creation(self):
        """测试规则创建"""
        rule = RedactionRule(
            name="测试规则",
            pattern=r"\d+",
            replacement="[NUMBER]",
        )

        assert rule.name == "测试规则"
        assert rule.pattern == r"\d+"
        assert rule.replacement == "[NUMBER]"
        assert rule.enabled is True

    def test_rule_disabled(self):
        """测试禁用规则"""
        rule = RedactionRule(
            name="测试规则",
            pattern=r"\d+",
            enabled=False,
        )

        assert rule.enabled is False


class TestEvidenceType:
    """EvidenceType 测试"""

    def test_all_types(self):
        """测试所有证据类型"""
        assert EvidenceType.HTML_PAGE == "html_page"
        assert EvidenceType.MHTML_ARCHIVE == "mhtml_archive"
        assert EvidenceType.HAR_LOG == "har_log"
        assert EvidenceType.SCREENSHOT == "screenshot"
        assert EvidenceType.PDF_DOCUMENT == "pdf_document"
        assert EvidenceType.CHAT_LOG == "chat_log"
        assert EvidenceType.ATTACHMENT == "attachment"


class TestTimeTrustLevel:
    """TimeTrustLevel 测试"""

    def test_all_levels(self):
        """测试所有可信度级别"""
        assert TimeTrustLevel.HIGH == "high"
        assert TimeTrustLevel.MEDIUM == "medium"
        assert TimeTrustLevel.LOW == "low"
        assert TimeTrustLevel.UNTRUSTED == "untrusted"
