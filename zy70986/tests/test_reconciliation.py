import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date
import pytest

from package.importer import DataImporter
from package.reconciler import Reconciler
from package.exporter import ReportExporter
from package.models import DisposalType, DifferenceType, PackageStatus
from package.sample_data import SAMPLE_PACKAGES_CSV, SAMPLE_SMS_JSON, SAMPLE_RULES_JSON


class TestDataImporter:
    def test_import_packages(self):
        packages, errors = DataImporter.import_packages_csv(SAMPLE_PACKAGES_CSV)
        assert len(errors) == 0
        assert len(packages) == 5
        pkg = packages[0]
        assert pkg.package_id == "PKG001"
        assert pkg.pickup_code == "1-2-333"
        assert pkg.recipient_name == "张*"
        assert pkg.recipient_phone == "138****8001"

    def test_import_sms(self):
        sms, errors = DataImporter.import_sms_json(SAMPLE_SMS_JSON)
        assert len(errors) == 0
        assert len(sms) == 10
        assert sms[0].sms_type.value == "arrival"

    def test_import_rules(self):
        rules, errors = DataImporter.import_rules_json(SAMPLE_RULES_JSON)
        assert len(errors) == 0
        assert len(rules) == 2
        assert rules[0].overdue_days == 7


class TestReconciler:
    def setup_method(self):
        self.packages, _ = DataImporter.import_packages_csv(SAMPLE_PACKAGES_CSV)
        self.sms, _ = DataImporter.import_sms_json(SAMPLE_SMS_JSON)
        self.rules, _ = DataImporter.import_rules_json(SAMPLE_RULES_JSON)
        self.reconciler = Reconciler(default_overdue_days=7)

    def test_reconcile_detects_overdue(self):
        disposals = self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        pkg003 = next(d for d in disposals if d.package_id == "PKG003")
        assert DifferenceType.OVERDUE_PICKUP in pkg003.difference_types
        assert pkg003.disposal_type == DisposalType.RETURN

        pkg005 = next(d for d in disposals if d.package_id == "PKG005")
        assert DifferenceType.OVERDUE_PICKUP in pkg005.difference_types
        assert pkg005.disposal_type == DisposalType.RETURN

    def test_reconcile_detects_duplicate_reminders(self):
        disposals = self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        pkg004 = next(d for d in disposals if d.package_id == "PKG004")
        assert DifferenceType.DUPLICATE_REMINDER in pkg004.difference_types
        assert pkg004.disposal_type == DisposalType.SUPPLEMENT

    def test_reconcile_normal_package(self):
        disposals = self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        pkg002 = next(d for d in disposals if d.package_id == "PKG002")
        assert pkg002.disposal_type == DisposalType.RELEASE

    def test_review_disposal(self):
        self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        modified = self.reconciler.review_disposal(
            "PKG004", DisposalType.RELEASE, "已电话联系，用户将取件", "张站长"
        )
        assert modified.disposal_type == DisposalType.RELEASE
        assert modified.reviewed_by == "张站长"
        assert modified.status.value == "reviewed"

    def test_recalculate_preserves_reviewed(self):
        self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        self.reconciler.review_disposal(
            "PKG004", DisposalType.RELEASE, "测试备注", "测试员"
        )
        updated = self.reconciler.recalculate(self.packages, self.sms, self.rules)
        pkg004 = next(d for d in updated if d.package_id == "PKG004")
        assert pkg004.status.value == "reviewed"
        assert pkg004.disposal_type == DisposalType.RELEASE

    def test_explain_disposal(self):
        self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        explanation = self.reconciler.explain_disposal("PKG001")
        assert explanation["package_id"] == "PKG001"
        assert "disposal_type" in explanation
        assert "reasons" in explanation

    def test_audit_logs(self):
        self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )
        self.reconciler.review_disposal("PKG004", DisposalType.RELEASE, "测试", "测试员")
        logs = self.reconciler.get_audit_logs("PKG004")
        assert len(logs) >= 2
        actions = [log.action for log in logs]
        assert "auto_reconcile" in actions
        assert "manual_review" in actions


class TestReportExporter:
    def setup_method(self):
        self.packages, _ = DataImporter.import_packages_csv(SAMPLE_PACKAGES_CSV)
        self.sms, _ = DataImporter.import_sms_json(SAMPLE_SMS_JSON)
        self.rules, _ = DataImporter.import_rules_json(SAMPLE_RULES_JSON)
        self.reconciler = Reconciler()
        self.disposals = self.reconciler.reconcile(
            self.packages, self.sms, self.rules, reference_date=date(2026, 5, 27)
        )

    def test_build_summary(self):
        summary = ReportExporter.build_summary(self.packages, self.disposals)
        assert summary.total_packages == 5
        assert summary.overdue_count >= 2
        assert summary.returned_count >= 2

    def test_export_csv(self):
        csv_content = ReportExporter.export_details_csv(self.packages, self.disposals)
        assert "包裹ID" in csv_content
        assert "PKG001" in csv_content
        assert "1-2-333" in csv_content

    def test_export_excel(self):
        summary = ReportExporter.build_summary(self.packages, self.disposals)
        excel_bytes = ReportExporter.export_excel(
            self.packages, self.disposals, summary, self.reconciler.audit_logs
        )
        assert len(excel_bytes) > 0

    def test_evidence_report(self):
        pkg = next(p for p in self.packages if p.package_id == "PKG001")
        disposal = next(d for d in self.disposals if d.package_id == "PKG001")
        logs = self.reconciler.get_audit_logs("PKG001")
        report = ReportExporter.export_evidence_report("PKG001", pkg, disposal, logs)
        assert report["package_id"] == "PKG001"
        assert "pickup_code" in report
        assert "evidence_chain" in report


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
