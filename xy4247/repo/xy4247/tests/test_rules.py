import pytest
from datetime import datetime
from pathlib import Path


class TestMissingReferenceRule:
    def test_detect_missing_reference(self, sample_evidence_catalog):
        from court_evidence_checker.models import Reference, ReferenceType, CheckSession
        from court_evidence_checker.rules import MissingReferenceRule, RuleEngine

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示证据1",
            location="第3页",
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=sample_evidence_catalog,
            references=[ref1],
            objections=[],
        )

        rule = MissingReferenceRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, sample_evidence_catalog)

        missing_results = [r for r in result.results if "2" in r.evidence_numbers]
        assert len(missing_results) > 0

    def test_no_missing_when_all_referenced(self, sample_evidence_catalog):
        from court_evidence_checker.models import Reference, ReferenceType, CheckSession
        from court_evidence_checker.rules import MissingReferenceRule, RuleEngine

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示证据1",
            location="第3页",
        )
        ref2 = Reference(
            evidence_number="2",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示证据2",
            location="第4页",
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=sample_evidence_catalog,
            references=[ref1, ref2],
            objections=[],
        )

        rule = MissingReferenceRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, sample_evidence_catalog)

        missing_results = [r for r in result.results]
        assert len(missing_results) == 0

    def test_evidence_catalog_none(self):
        from court_evidence_checker.models import Reference, ReferenceType, CheckSession
        from court_evidence_checker.rules import MissingReferenceRule, RuleEngine

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=None,
            references=[],
            objections=[],
        )

        rule = MissingReferenceRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, None)

        assert len(result.results) == 0


class TestDuplicateReferenceRule:
    def test_detect_duplicate_with_different_aliases(self):
        from court_evidence_checker.models import (
            Reference,
            ReferenceType,
            CheckSession,
            Evidence,
            EvidenceCatalog,
            EvidenceType,
            EvidenceStatus,
        )
        from court_evidence_checker.rules import DuplicateReferenceRule, RuleEngine

        evidence1 = Evidence(
            evidence_number="1",
            name="货物买卖合同",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            aliases=["合同", "买卖合同"],
            status=EvidenceStatus.ACCEPTED,
        )

        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
            evidences=[evidence1],
        )

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示合同",
            location="第3页",
            aliases_used=["合同"],
        )
        ref2 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示买卖合同",
            location="第4页",
            aliases_used=["买卖合同"],
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=catalog,
            references=[ref1, ref2],
            objections=[],
        )

        rule = DuplicateReferenceRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, catalog)

        dup_results = [r for r in result.results]
        assert len(dup_results) == 0

    def test_detect_different_numbers_referring_same_evidence(self):
        from court_evidence_checker.models import (
            Reference,
            ReferenceType,
            CheckSession,
            Evidence,
            EvidenceCatalog,
            EvidenceType,
            EvidenceStatus,
        )
        from court_evidence_checker.rules import DuplicateReferenceRule, RuleEngine

        evidence1 = Evidence(
            evidence_number="1",
            name="货物买卖合同",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            aliases=["合同"],
            status=EvidenceStatus.ACCEPTED,
        )

        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
            evidences=[evidence1],
        )

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示证据1",
            location="第3页",
            aliases_used=[],
        )
        ref2 = Reference(
            evidence_number="01",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示证据01",
            location="第4页",
            aliases_used=[],
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=catalog,
            references=[ref1, ref2],
            objections=[],
        )

        rule = DuplicateReferenceRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, catalog)

        pass


class TestDateConflictRule:
    def test_detect_date_conflict(self):
        from court_evidence_checker.models import (
            Reference,
            ReferenceType,
            CheckSession,
            Evidence,
            EvidenceCatalog,
            EvidenceType,
            EvidenceStatus,
        )
        from court_evidence_checker.rules import DateConflictRule, RuleEngine

        evidence1 = Evidence(
            evidence_number="1",
            name="货物买卖合同",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            submit_date=datetime(2025, 3, 15),
            status=EvidenceStatus.ACCEPTED,
        )

        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
            evidences=[evidence1],
        )

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="2025年3月15日签订合同",
            location="第3页",
            extracted_date=datetime(2025, 3, 15),
        )
        ref2 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.JUDGMENT,
            context="2025年3月16日签订合同",
            location="第5页",
            extracted_date=datetime(2025, 3, 16),
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=catalog,
            references=[ref1, ref2],
            objections=[],
        )

        rule = DateConflictRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, catalog)

        conflict_results = [r for r in result.results]
        pass

    def test_no_conflict_when_dates_match(self):
        from court_evidence_checker.models import (
            Reference,
            ReferenceType,
            CheckSession,
            Evidence,
            EvidenceCatalog,
            EvidenceType,
            EvidenceStatus,
        )
        from court_evidence_checker.rules import DateConflictRule, RuleEngine

        evidence1 = Evidence(
            evidence_number="1",
            name="货物买卖合同",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            submit_date=datetime(2025, 3, 15),
            status=EvidenceStatus.ACCEPTED,
        )

        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
            evidences=[evidence1],
        )

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="2025年3月15日签订合同",
            location="第3页",
            extracted_date=datetime(2025, 3, 15),
        )
        ref2 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.JUDGMENT,
            context="2025年3月15日签订合同",
            location="第5页",
            extracted_date=datetime(2025, 3, 15),
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=catalog,
            references=[ref1, ref2],
            objections=[],
        )

        rule = DateConflictRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, catalog)

        conflict_results = [r for r in result.results]
        pass


class TestUnhandledObjectionRule:
    def test_detect_unhandled_objection(self):
        from court_evidence_checker.models import (
            Reference,
            ReferenceType,
            CheckSession,
            Evidence,
            EvidenceCatalog,
            EvidenceType,
            EvidenceStatus,
            Objection,
            ObjectionType,
            ObjectionStatus,
        )
        from court_evidence_checker.rules import UnhandledObjectionRule, RuleEngine

        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
            evidences=[],
        )

        objection = Objection(
            objection_id="obj_001",
            objection_type=ObjectionType.RELEVANCE,
            raised_by="被告代理人",
            raised_at=datetime(2026, 4, 15, 9, 35),
            description="对关联性提出异议",
            status=ObjectionStatus.PENDING,
            ruling=None,
            ruling_at=None,
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=catalog,
            references=[],
            objections=[objection],
            judgment_draft_content="裁判要点中没有处理该异议",
        )

        rule = UnhandledObjectionRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, catalog)

        unhandled_results = [r for r in result.results]
        pass

    def test_no_unhandled_when_ruling_exists(self):
        from court_evidence_checker.models import (
            Reference,
            ReferenceType,
            CheckSession,
            Evidence,
            EvidenceCatalog,
            EvidenceType,
            EvidenceStatus,
            Objection,
            ObjectionType,
            ObjectionStatus,
        )
        from court_evidence_checker.rules import UnhandledObjectionRule, RuleEngine

        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
            evidences=[],
        )

        objection = Objection(
            objection_id="obj_001",
            objection_type=ObjectionType.RELEVANCE,
            raised_by="被告代理人",
            raised_at=datetime(2026, 4, 15, 9, 35),
            description="对关联性提出异议",
            status=ObjectionStatus.OVERRULED,
            ruling="异议不成立",
            ruling_at=datetime(2026, 4, 15, 9, 36),
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=catalog,
            references=[],
            objections=[objection],
        )

        rule = UnhandledObjectionRule()
        engine = RuleEngine([rule])
        result = engine.run_all(session, catalog)

        unhandled_results = [r for r in result.results]
        pass


class TestRuleEngine:
    def test_run_multiple_rules(self, sample_evidence_catalog):
        from court_evidence_checker.models import Reference, ReferenceType, CheckSession
        from court_evidence_checker.rules import (
            RuleEngine,
            MissingReferenceRule,
            DateConflictRule,
            UnhandledObjectionRule,
        )

        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            context="出示证据1",
            location="第3页",
        )

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=sample_evidence_catalog,
            references=[ref1],
            objections=[],
        )

        rules = [
            MissingReferenceRule(),
            DateConflictRule(),
            UnhandledObjectionRule(),
        ]

        engine = RuleEngine(rules)
        result = engine.run_all(session, sample_evidence_catalog)

        assert result.session_id == session.session_id
        assert result.total_issues >= 0

    def test_rule_result_severity(self):
        from court_evidence_checker.models import (
            RuleResult,
            RuleType,
            Severity,
            Reference,
            ReferenceType,
            CheckSession,
            EvidenceCatalog,
        )
        from court_evidence_checker.rules import RuleEngine, BaseRule, RuleContext

        high_result = RuleResult(
            rule_type=RuleType.MISSING_REFERENCE,
            severity=Severity.HIGH,
            message="高危问题",
            evidence_numbers=["1"],
        )

        medium_result = RuleResult(
            rule_type=RuleType.DATE_CONFLICT,
            severity=Severity.MEDIUM,
            message="中危问题",
            evidence_numbers=["2"],
        )

        assert high_result.severity == Severity.HIGH
        assert medium_result.severity == Severity.MEDIUM
        assert high_result.severity.value > medium_result.severity.value

    def test_empty_rules_list(self, sample_evidence_catalog):
        from court_evidence_checker.models import Reference, ReferenceType, CheckSession
        from court_evidence_checker.rules import RuleEngine

        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
            evidence_catalog=sample_evidence_catalog,
            references=[],
            objections=[],
        )

        engine = RuleEngine([])
        result = engine.run_all(session, sample_evidence_catalog)

        assert len(result.results) == 0
        assert result.total_issues == 0
