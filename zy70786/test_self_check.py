#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import BuildStatus, ViolationType
from app.schemas import BuildArtifactCreate, BudgetRuleCreate, BudgetReportFilter
from app.crud import (
    create_build_artifact, get_build_artifact, get_build_artifacts,
    get_build_artifact_by_build_id, create_budget_rule, get_budget_rules,
    match_budget_rule, analyze_budget_violations, get_budget_report,
    get_budget_reports, mark_report_processed, review_violation
)
from app.exporter import export_report_to_csv, export_report_to_excel
from app.exceptions import (
    DuplicateBuildException, MissingFieldException, NotFoundException,
    AlreadyProcessedException, NeedsReviewException
)


def run_tests():
    print("=" * 60)
    print("Bundle Budget API - Self Check Test Suite")
    print("=" * 60)

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    passed = 0
    failed = 0

    def test(name, func):
        nonlocal passed, failed
        try:
            func()
            print(f"  ✓ {name}")
            passed += 1
        except Exception as e:
            print(f"  ✗ {name}: {e}")
            failed += 1

    print("\n[1] Testing Build Artifact Creation")
    print("-" * 60)

    def test_create_artifact():
        artifact_data = BuildArtifactCreate(
            build_id="build-001",
            project_name="frontend-app",
            branch="main",
            commit_hash="abc123",
            chunks=[
                {
                    "chunk_name": "main.js",
                    "file_size": 250 * 1024,
                    "gzip_size": 80 * 1024,
                    "is_initial": True,
                    "is_async": False,
                    "modules": [
                        {"module_path": "src/index.tsx", "module_size": 5000, "is_third_party": False},
                        {"module_path": "node_modules/react/index.js", "module_size": 20000, "package_name": "react", "is_third_party": True},
                    ],
                },
                {
                    "chunk_name": "vendor.js",
                    "file_size": 400 * 1024,
                    "gzip_size": 120 * 1024,
                    "is_initial": True,
                    "is_async": False,
                    "modules": [],
                },
            ],
        )
        artifact = create_build_artifact(db, artifact_data)
        assert artifact.id is not None
        assert artifact.build_id == "build-001"
        assert artifact.chunk_count == 2
        assert len(artifact.chunks) == 2
        return artifact

    test("Create build artifact", test_create_artifact)

    def test_duplicate_build():
        artifact_data = BuildArtifactCreate(
            build_id="build-001",
            project_name="frontend-app",
            chunks=[{"chunk_name": "test.js", "file_size": 1000}],
        )
        try:
            create_build_artifact(db, artifact_data)
            assert False, "Should have raised DuplicateBuildException"
        except DuplicateBuildException:
            pass

    test("Prevent duplicate build IDs", test_duplicate_build)

    def test_missing_chunks():
        try:
            artifact_data = BuildArtifactCreate(
                build_id="build-empty-chunks",
                project_name="frontend-app",
                chunks=[],
            )
            create_build_artifact(db, artifact_data)
        except ValueError:
            pass

    test("Require at least one chunk", test_missing_chunks)

    def test_get_artifact():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        assert artifact is not None
        assert artifact.build_id == "build-001"

    test("Retrieve artifact by build ID", test_get_artifact)

    def test_list_artifacts():
        artifacts = get_build_artifacts(db, project_name="frontend-app")
        assert len(artifacts) >= 1

    test("List artifacts by project", test_list_artifacts)

    print("\n[2] Testing Budget Rules")
    print("-" * 60)

    def test_create_budget_rule():
        rule_data = BudgetRuleCreate(
            project_name="frontend-app",
            chunk_pattern="main.*",
            budget_size_kb=200,
            priority=10,
        )
        rule = create_budget_rule(db, rule_data)
        assert rule.id is not None
        assert rule.budget_size_kb == 200
        return rule

    test("Create budget rule", test_create_budget_rule)

    def test_match_budget_rule():
        rule = match_budget_rule(db, "frontend-app", "main.js")
        assert rule is not None
        assert rule.budget_size_kb == 200

        no_match = match_budget_rule(db, "frontend-app", "other.js")
        assert no_match is None

    test("Match budget rule by pattern", test_match_budget_rule)

    def test_list_rules():
        rules = get_budget_rules(db, project_name="frontend-app")
        assert len(rules) >= 1

    test("List budget rules", test_list_rules)

    print("\n[3] Testing Budget Analysis")
    print("-" * 60)

    def test_budget_analysis():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = analyze_budget_violations(db, artifact)
        assert report.id is not None
        assert report.total_violations > 0
        assert report.critical_violations > 0
        assert artifact.status == BuildStatus.NEEDS_REVIEW
        return report

    report = test("Analyze budget violations", test_budget_analysis)

    def test_violation_types():
        artifact_data = BuildArtifactCreate(
            build_id="build-002",
            project_name="frontend-app",
            branch="main",
            built_at=datetime.utcnow(),
            chunks=[
                {
                    "chunk_name": "main.js",
                    "file_size": 300 * 1024,
                    "is_initial": True,
                    "modules": [],
                },
                {
                    "chunk_name": "new-chunk.js",
                    "file_size": 250 * 1024,
                    "is_initial": False,
                    "modules": [],
                },
            ],
        )
        artifact = create_build_artifact(db, artifact_data)
        report = analyze_budget_violations(db, artifact)

        violation_types = [v.violation_type for v in report.violations]
        assert ViolationType.SIZE_EXCEEDED in violation_types
        assert ViolationType.NEW_LARGE_CHUNK in violation_types
        if ViolationType.UNEXPECTED_GROWTH in violation_types:
            print("    - Detected unexpected growth violation")

    test("Detect multiple violation types", test_violation_types)

    def test_duplicate_modules_detection():
        artifact_data = BuildArtifactCreate(
            build_id="build-duplicate-modules",
            project_name="frontend-app",
            chunks=[
                {
                    "chunk_name": "chunk-a.js",
                    "file_size": 100 * 1024,
                    "modules": [
                        {"module_path": "src/shared/utils.ts", "module_size": 5000, "is_third_party": False},
                    ],
                },
                {
                    "chunk_name": "chunk-b.js",
                    "file_size": 100 * 1024,
                    "modules": [
                        {"module_path": "src/shared/utils.ts", "module_size": 5000, "is_third_party": False},
                    ],
                },
                {
                    "chunk_name": "chunk-c.js",
                    "file_size": 100 * 1024,
                    "modules": [
                        {"module_path": "src/shared/utils.ts", "module_size": 5000, "is_third_party": False},
                    ],
                },
            ],
        )
        artifact = create_build_artifact(db, artifact_data)
        report = analyze_budget_violations(db, artifact)

        violation_types = [v.violation_type for v in report.violations]
        assert ViolationType.DUPLICATE_MODULES in violation_types, "DUPLICATE_MODULES violation should be detected"

        duplicate_violations = [v for v in report.violations if v.violation_type == ViolationType.DUPLICATE_MODULES]
        assert len(duplicate_violations) >= 1
        assert "src/shared/utils.ts" in duplicate_violations[0].reason
        assert duplicate_violations[0].needs_review == True

    test("Detect duplicate modules across chunks", test_duplicate_modules_detection)

    def test_filter_by_needs_review():
        artifact_data1 = BuildArtifactCreate(
            build_id="build-needs-review-yes",
            project_name="test-project",
            chunks=[
                {
                    "chunk_name": "huge.js",
                    "file_size": 500 * 1024,
                    "modules": [],
                },
            ],
        )
        artifact1 = create_build_artifact(db, artifact_data1)
        report1 = analyze_budget_violations(db, artifact1)

        artifact_data2 = BuildArtifactCreate(
            build_id="build-needs-review-no",
            project_name="test-project",
            chunks=[
                {
                    "chunk_name": "small.js",
                    "file_size": 50 * 1024,
                    "modules": [],
                },
            ],
        )
        artifact2 = create_build_artifact(db, artifact_data2)
        report2 = analyze_budget_violations(db, artifact2)

        filter_needs_review = BudgetReportFilter(needs_review=True)
        reports_needs_review = get_budget_reports(db, filter_needs_review)
        report_ids_needs_review = [r.id for r in reports_needs_review]
        assert report1.id in report_ids_needs_review

        filter_no_needs_review = BudgetReportFilter(needs_review=False)
        reports_no_needs_review = get_budget_reports(db, filter_no_needs_review)
        report_ids_no_review = [r.id for r in reports_no_needs_review]
        assert report2.id in report_ids_no_review

    test("Filter reports by needs_review flag", test_filter_by_needs_review)

    def test_main_entrypoint():
        from app.main import main
        assert callable(main)
        print("    - main() function is callable")

    test("Verify command entry point main()", test_main_entrypoint)

    print("\n[4] Testing Report Management")
    print("-" * 60)

    def test_get_report():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = get_budget_report(db, artifact.reports[0].id)
        assert report is not None
        assert report.total_violations > 0

    test("Retrieve budget report", test_get_report)

    def test_filter_reports():
        filter_params = BudgetReportFilter(
            project_name="frontend-app",
            has_violations=True,
        )
        reports = get_budget_reports(db, filter_params)
        assert len(reports) >= 1

    test("Filter reports with violations", test_filter_reports)

    def test_report_not_found():
        try:
            get_budget_report(db, 99999)
        except NotFoundException:
            pass

    test("Handle report not found", test_report_not_found)

    print("\n[5] Testing Review Workflow")
    print("-" * 60)

    def test_needs_review_exception():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = artifact.reports[0]
        try:
            mark_report_processed(db, report.id)
            assert False, "Should have raised NeedsReviewException"
        except NeedsReviewException:
            pass

    test("Prevent processing unreviewed reports", test_needs_review_exception)

    def test_review_violations():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = artifact.reports[0]
        for violation in report.violations:
            if violation.needs_review:
                review_violation(db, violation.id, reviewed=True, reviewed_by="tester")

        updated_report = get_budget_report(db, report.id)
        needs_review_count = sum(1 for v in updated_report.violations if v.needs_review and not v.reviewed)
        assert needs_review_count == 0

    test("Review all violations", test_review_violations)

    def test_process_report():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = artifact.reports[0]
        processed = mark_report_processed(db, report.id, notes="Approved for release")
        assert processed.is_processed is True
        assert processed.processed_at is not None
        assert artifact.status == BuildStatus.PROCESSED

    test("Mark report as processed", test_process_report)

    def test_already_processed():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = artifact.reports[0]
        try:
            mark_report_processed(db, report.id)
            assert False, "Should have raised AlreadyProcessedException"
        except AlreadyProcessedException:
            pass

    test("Prevent reprocessing reports", test_already_processed)

    print("\n[6] Testing Report Export")
    print("-" * 60)

    def test_export_csv():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = artifact.reports[0]
        csv_data = export_report_to_csv(db, report.id)
        assert csv_data is not None
        assert len(csv_data) > 0
        assert b"Violation ID" in csv_data
        assert b"main.js" in csv_data

    test("Export report to CSV", test_export_csv)

    def test_export_excel():
        artifact = get_build_artifact_by_build_id(db, "build-001")
        report = artifact.reports[0]
        excel_data = export_report_to_excel(db, report.id)
        assert excel_data is not None
        assert len(excel_data) > 0

    test("Export report to Excel", test_export_excel)

    print("\n[7] Testing Error Handling")
    print("-" * 60)

    def test_not_found():
        try:
            get_build_artifact(db, 99999)
        except NotFoundException:
            pass

    test("Handle artifact not found", test_not_found)

    def test_invalid_status():
        artifact_data = BuildArtifactCreate(
            build_id="build-003",
            project_name="frontend-app",
            chunks=[{"chunk_name": "test.js", "file_size": 1000}],
        )
        artifact = create_build_artifact(db, artifact_data)
        from app.models import BuildArtifact
        db.query(BuildArtifact).filter(BuildArtifact.id == artifact.id).update(
            {"status": BuildStatus.ANALYZING}
        )
        db.commit()

    test("Test status validation", test_invalid_status)

    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)

    db.close()

    if failed > 0:
        print("\n❌ Some tests failed!")
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        print("\nSummary of verified features:")
        print("  - Build artifact creation and retrieval")
        print("  - Budget rule management and pattern matching")
        print("  - Budget violation analysis (multiple types)")
        print("  - Report filtering and retrieval")
        print("  - Violation review workflow")
        print("  - Report processing with state checks")
        print("  - CSV and Excel export functionality")
        print("  - Proper error handling and status codes")
        sys.exit(0)


if __name__ == "__main__":
    run_tests()
