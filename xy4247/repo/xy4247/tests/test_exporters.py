import pytest
import json
import csv
from datetime import datetime
from pathlib import Path


class TestMarkdownExporter:
    def test_export_markdown_report(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import MarkdownExporter, export_markdown_report

        result1 = RuleResult(
            rule_type=RuleType.MISSING_REFERENCE,
            severity=Severity.HIGH,
            message="证据2未在庭审笔录中被引用",
            evidence_numbers=["2"],
            suggestion="请检查庭审笔录，确认是否遗漏了证据2的引用",
        )

        result2 = RuleResult(
            rule_type=RuleType.DATE_CONFLICT,
            severity=Severity.MEDIUM,
            message="证据1的日期存在矛盾",
            evidence_numbers=["1"],
        )

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=[result1, result2],
        )

        sample_session.check_result = check_result

        md_path = temp_dir / "复核单.md"
        export_markdown_report(sample_session, md_path)

        assert md_path.exists()

        content = md_path.read_text(encoding="utf-8")

        assert "证据校验复核单" in content
        assert "证据2" in content
        assert "高危" in content
        assert "中危" in content

    def test_markdown_exporter_without_check_result(self, temp_dir, sample_session):
        from court_evidence_checker.exporters import export_markdown_report

        sample_session.check_result = None

        md_path = temp_dir / "复核单.md"
        export_markdown_report(sample_session, md_path)

        assert md_path.exists()

        content = md_path.read_text(encoding="utf-8")
        assert "暂无校验结果" in content or "问题列表" in content

    def test_markdown_exporter_statistics(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import export_markdown_report

        results = [
            RuleResult(
                rule_type=RuleType.MISSING_REFERENCE,
                severity=Severity.HIGH,
                message="问题1",
                evidence_numbers=["1"],
            ),
            RuleResult(
                rule_type=RuleType.DATE_CONFLICT,
                severity=Severity.MEDIUM,
                message="问题2",
                evidence_numbers=["2"],
            ),
            RuleResult(
                rule_type=RuleType.UNHANDLED_OBJECTION,
                severity=Severity.LOW,
                message="问题3",
                evidence_numbers=["3"],
            ),
        ]

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=results,
        )

        sample_session.check_result = check_result

        md_path = temp_dir / "复核单.md"
        export_markdown_report(sample_session, md_path)

        content = md_path.read_text(encoding="utf-8")

        assert "3" in content


class TestCSVExporter:
    def test_export_csv_issues(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import CSVExporter, export_csv_issues

        result1 = RuleResult(
            rule_type=RuleType.MISSING_REFERENCE,
            severity=Severity.HIGH,
            message="证据2未被引用",
            evidence_numbers=["2"],
            suggestion="请检查",
        )

        result2 = RuleResult(
            rule_type=RuleType.DATE_CONFLICT,
            severity=Severity.MEDIUM,
            message="日期矛盾",
            evidence_numbers=["1"],
        )

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=[result1, result2],
        )

        sample_session.check_result = check_result

        csv_path = temp_dir / "问题表.csv"
        export_csv_issues(sample_session, csv_path)

        assert csv_path.exists()

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

            assert len(rows) >= 2

            headers = reader.fieldnames
            assert "严重程度" in headers or "severity" in headers or "rule_type" in headers

    def test_csv_exporter_without_check_result(self, temp_dir, sample_session):
        from court_evidence_checker.exporters import export_csv_issues

        sample_session.check_result = None

        csv_path = temp_dir / "问题表.csv"
        export_csv_issues(sample_session, csv_path)

        assert csv_path.exists()

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            assert len(rows) == 0


class TestJSONExporter:
    def test_export_json_audit(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import JSONExporter, export_json_audit

        result1 = RuleResult(
            rule_type=RuleType.MISSING_REFERENCE,
            severity=Severity.HIGH,
            message="证据2未被引用",
            evidence_numbers=["2"],
            suggestion="请检查",
        )

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=[result1],
        )

        sample_session.check_result = check_result

        json_path = temp_dir / "审计包.json"
        export_json_audit(sample_session, json_path)

        assert json_path.exists()

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "session_id" in data
        assert "check_result" in data
        assert "results" in data["check_result"]

        results = data["check_result"]["results"]
        assert len(results) == 1
        assert results[0]["rule_type"] == "missing_reference"

    def test_json_exporter_includes_statistics(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import export_json_audit

        results = [
            RuleResult(
                rule_type=RuleType.MISSING_REFERENCE,
                severity=Severity.HIGH,
                message="问题1",
                evidence_numbers=["1"],
            ),
            RuleResult(
                rule_type=RuleType.DATE_CONFLICT,
                severity=Severity.HIGH,
                message="问题2",
                evidence_numbers=["2"],
            ),
            RuleResult(
                rule_type=RuleType.UNHANDLED_OBJECTION,
                severity=Severity.MEDIUM,
                message="问题3",
                evidence_numbers=["3"],
            ),
        ]

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=results,
        )

        sample_session.check_result = check_result

        json_path = temp_dir / "审计包.json"
        export_json_audit(sample_session, json_path)

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "statistics" in data
        stats = data["statistics"]
        assert "total_issues" in stats


class TestExporterIntegration:
    def test_export_all_formats(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import (
            export_markdown_report,
            export_csv_issues,
            export_json_audit,
        )

        result = RuleResult(
            rule_type=RuleType.MISSING_REFERENCE,
            severity=Severity.HIGH,
            message="测试问题",
            evidence_numbers=["1"],
        )

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=[result],
        )

        sample_session.check_result = check_result

        md_path = temp_dir / "复核单.md"
        csv_path = temp_dir / "问题表.csv"
        json_path = temp_dir / "审计包.json"

        export_markdown_report(sample_session, md_path)
        export_csv_issues(sample_session, csv_path)
        export_json_audit(sample_session, json_path)

        assert md_path.exists()
        assert csv_path.exists()
        assert json_path.exists()

        md_content = md_path.read_text(encoding="utf-8")
        assert "测试问题" in md_content

    def test_exporter_with_evidence_catalog(self, temp_dir, sample_session):
        from court_evidence_checker.models import CheckResult, RuleResult, RuleType, Severity
        from court_evidence_checker.exporters import export_json_audit

        check_result = CheckResult(
            session_id=sample_session.session_id,
            checked_at=datetime.now(),
            results=[],
        )

        sample_session.check_result = check_result

        json_path = temp_dir / "审计包.json"
        export_json_audit(sample_session, json_path)

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "evidence_catalog" in data
        assert "evidences" in data["evidence_catalog"]
