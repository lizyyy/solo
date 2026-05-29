import csv
import json
import os
import tempfile
import unittest

from plugin_compat_matrix import (
    ApiCallRef,
    Author,
    AuthorNotifier,
    CompatibilityMatrix,
    CompatibilityReport,
    CompatEntry,
    HostVersion,
    IngestionEngine,
    PluginManifest,
    ReportExporter,
    RiskLevel,
    TestResult,
    TestStatus,
)
from plugin_compat_matrix.ingest import DirtyItem
from plugin_compat_matrix.scanner import ApiScanner, ScanResult

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST_DATA = os.path.join(_HERE, "test_data")
_PLUGINS_DIR = os.path.join(_TEST_DATA, "plugins")
_HOST_DIR = os.path.join(_TEST_DATA, "host")
_AUTHORS_DIR = os.path.join(_TEST_DATA, "authors")
_TESTS_DIR = os.path.join(_TEST_DATA, "tests")

_GOOD_PLUGIN = os.path.join(_PLUGINS_DIR, "good_plugin.json")
_NO_VERSION_PLUGIN = os.path.join(_PLUGINS_DIR, "plugin_no_version.json")
_CRITICAL_PLUGIN = os.path.join(_PLUGINS_DIR, "plugin_critical.json")
_DIRTY_PLUGINS = os.path.join(_PLUGINS_DIR, "dirty_plugins.json")
_HOST_V4 = os.path.join(_HOST_DIR, "host_v4.json")
_AUTHORS = os.path.join(_AUTHORS_DIR, "authors.json")
_TEST_RESULTS = os.path.join(_TESTS_DIR, "test_results.json")
_DIRTY_TESTS = os.path.join(_TESTS_DIR, "dirty_tests.json")


class TestModels(unittest.TestCase):

    def test_api_call_ref_roundtrip(self):
        ref = ApiCallRef(
            api_name="document.export",
            call_site="main.py:42",
            is_alias=True,
            canonical_name="doc.export",
        )
        d = ref.to_dict()
        restored = ApiCallRef.from_dict(d)
        self.assertEqual(restored.api_name, "document.export")
        self.assertEqual(restored.call_site, "main.py:42")
        self.assertTrue(restored.is_alias)
        self.assertEqual(restored.canonical_name, "doc.export")

    def test_plugin_manifest_roundtrip(self):
        calls = [
            ApiCallRef(api_name="a.b", call_site="f.py:1"),
            ApiCallRef(api_name="c.d", call_site="g.py:2"),
        ]
        manifest = PluginManifest(
            plugin_id="my-plugin",
            name="My Plugin",
            author_id="author-1",
            api_calls=calls,
            version="1.0.0",
            min_host_version="3.0.0",
            declared_apis=["a.b", "c.d"],
        )
        d = manifest.to_dict()
        restored = PluginManifest.from_dict(d)
        self.assertEqual(restored.plugin_id, "my-plugin")
        self.assertEqual(restored.name, "My Plugin")
        self.assertEqual(restored.author_id, "author-1")
        self.assertEqual(len(restored.api_calls), 2)
        self.assertEqual(restored.api_calls[0].api_name, "a.b")
        self.assertEqual(restored.version, "1.0.0")
        self.assertEqual(restored.min_host_version, "3.0.0")
        self.assertEqual(restored.declared_apis, ["a.b", "c.d"])

    def test_host_version_roundtrip(self):
        hv = HostVersion(
            version="4.0.0",
            released_apis=["a.b"],
            deprecated_apis=["c.d"],
            removed_apis=["e.f"],
            alias_map={"old.api": "new.api"},
        )
        d = hv.to_dict()
        restored = HostVersion.from_dict(d)
        self.assertEqual(restored.version, "4.0.0")
        self.assertEqual(restored.released_apis, ["a.b"])
        self.assertEqual(restored.deprecated_apis, ["c.d"])
        self.assertEqual(restored.removed_apis, ["e.f"])
        self.assertEqual(restored.alias_map, {"old.api": "new.api"})

    def test_compat_entry_roundtrip(self):
        entry = CompatEntry(
            plugin_id="p1",
            compatible=False,
            risk_level=RiskLevel.high,
            broken_apis=["x.y"],
            alias_apis=["old.z"],
            undeclared_version=True,
            test_coverage=False,
            trace={"score_breakdown": [{"reason": "removed_api:x.y", "points": 40}]},
        )
        d = entry.to_dict()
        restored = CompatEntry.from_dict(d)
        self.assertEqual(restored.plugin_id, "p1")
        self.assertFalse(restored.compatible)
        self.assertEqual(restored.risk_level, RiskLevel.high)
        self.assertEqual(restored.broken_apis, ["x.y"])
        self.assertEqual(restored.alias_apis, ["old.z"])
        self.assertTrue(restored.undeclared_version)
        self.assertFalse(restored.test_coverage)
        self.assertIn("score_breakdown", restored.trace)

    def test_compatibility_report_roundtrip(self):
        entries = [
            CompatEntry(
                plugin_id="p1",
                compatible=True,
                risk_level=RiskLevel.low,
            ),
            CompatEntry(
                plugin_id="p2",
                compatible=False,
                risk_level=RiskLevel.critical,
                broken_apis=["a.b"],
            ),
        ]
        report = CompatibilityReport(
            report_id="rpt-001",
            generated_at="2026-05-30T10:00:00Z",
            host_version="4.0.0",
            entries=entries,
            risk_summary={"critical": 1, "high": 0, "medium": 0, "low": 1},
            calculation_trace={"total_plugins_scanned": 2},
        )
        d = report.to_dict()
        restored = CompatibilityReport.from_dict(d)
        self.assertEqual(restored.report_id, "rpt-001")
        self.assertEqual(restored.host_version, "4.0.0")
        self.assertEqual(len(restored.entries), 2)
        self.assertEqual(restored.entries[0].plugin_id, "p1")
        self.assertEqual(restored.entries[1].risk_level, RiskLevel.critical)
        self.assertEqual(restored.risk_summary["critical"], 1)


class TestIngestion(unittest.TestCase):

    def setUp(self):
        self.engine = IngestionEngine()

    def test_ingest_valid_plugins(self):
        r1 = self.engine.ingest_plugins(_GOOD_PLUGIN)
        self.assertEqual(len(r1.valid_items), 1)
        p = r1.valid_items[0]
        self.assertEqual(p.plugin_id, "pdf-exporter")
        self.assertEqual(p.version, "2.1.0")
        self.assertEqual(len(p.api_calls), 3)
        self.assertTrue(p._source_file)

        r2 = self.engine.ingest_plugins(_NO_VERSION_PLUGIN)
        self.assertEqual(len(r2.valid_items), 1)
        p2 = r2.valid_items[0]
        self.assertEqual(p2.plugin_id, "theme-dark")
        self.assertIsNone(p2.version)
        self.assertTrue(p2._source_file)

        r3 = self.engine.ingest_plugins(_CRITICAL_PLUGIN)
        self.assertEqual(len(r3.valid_items), 1)
        p3 = r3.valid_items[0]
        self.assertEqual(p3.plugin_id, "old-importer")
        self.assertEqual(p3.version, "1.0.0")
        self.assertTrue(p3._source_file)

    def test_ingest_dirty_plugins(self):
        result = self.engine.ingest_plugins(_PLUGINS_DIR)
        dirty = result.dirty_items
        self.assertGreaterEqual(len(dirty), 4)

        all_errors = []
        for di in dirty:
            all_errors.extend(di.errors)

        missing_field_msgs = [
            e for e in all_errors if "missing required field: plugin_id" in e
        ]
        self.assertGreaterEqual(len(missing_field_msgs), 1)

        bad_id_msgs = [e for e in all_errors if "does not match pattern" in e]
        self.assertGreaterEqual(len(bad_id_msgs), 1)

        bad_ver_msgs = [e for e in all_errors if "does not match semver pattern" in e]
        self.assertGreaterEqual(len(bad_ver_msgs), 1)

        dup_msgs = [e for e in all_errors if "duplicate plugin_id" in e]
        self.assertGreaterEqual(len(dup_msgs), 1)

    def test_ingest_host_versions(self):
        result = self.engine.ingest_host_versions(_HOST_V4)
        self.assertEqual(len(result.valid_items), 1)
        hv = result.valid_items[0]
        self.assertEqual(hv.version, "4.0.0")
        self.assertIn("document.export", hv.released_apis)
        self.assertIn("file.import", hv.removed_apis)
        self.assertEqual(hv.alias_map, {"doc.renderLegacy": "document.render"})
        self.assertEqual(len(result.dirty_items), 0)

    def test_ingest_authors(self):
        result = self.engine.ingest_authors(_AUTHORS)
        self.assertEqual(len(result.valid_items), 2)
        ids = {a.author_id for a in result.valid_items}
        self.assertIn("author-alice", ids)
        self.assertIn("author-bob", ids)
        self.assertEqual(len(result.dirty_items), 0)

    def test_ingest_test_results_valid(self):
        result = self.engine.ingest_test_results(_TEST_RESULTS)
        self.assertEqual(len(result.valid_items), 3)
        statuses = {tr.status for tr in result.valid_items}
        self.assertIn(TestStatus.passed, statuses)
        self.assertIn(TestStatus.failed, statuses)
        self.assertIn(TestStatus.missing, statuses)

    def test_ingest_test_results_dirty(self):
        result = self.engine.ingest_test_results(_DIRTY_TESTS)
        self.assertGreaterEqual(len(result.dirty_items), 2)
        all_errors = []
        for di in result.dirty_items:
            all_errors.extend(di.errors)

        unknown_status_msgs = [e for e in all_errors if "unknown test status" in e]
        self.assertGreaterEqual(len(unknown_status_msgs), 1)

        missing_field_msgs = [e for e in all_errors if "missing required field" in e]
        self.assertGreaterEqual(len(missing_field_msgs), 1)

    def test_ingest_stats(self):
        result = self.engine.ingest_plugins(_GOOD_PLUGIN)
        stats = result.stats
        self.assertEqual(stats["total_records"], 1)
        self.assertEqual(stats["valid"], 1)
        self.assertEqual(stats["dirty"], 0)
        self.assertEqual(stats["files_processed"], 1)

        dirty_result = self.engine.ingest_plugins(_PLUGINS_DIR)
        ds = dirty_result.stats
        self.assertEqual(ds["total_records"], ds["valid"] + ds["dirty"])
        self.assertGreaterEqual(ds["files_processed"], 4)


class TestScanner(unittest.TestCase):

    def setUp(self):
        self.engine = IngestionEngine()
        hv_result = self.engine.ingest_host_versions(_HOST_V4)
        self.host = hv_result.valid_items[0]

        gp = self.engine.ingest_plugins(_GOOD_PLUGIN)
        self.pdf_plugin = gp.valid_items[0]

        nv = self.engine.ingest_plugins(_NO_VERSION_PLUGIN)
        self.theme_plugin = nv.valid_items[0]

        cp = self.engine.ingest_plugins(_CRITICAL_PLUGIN)
        self.importer_plugin = cp.valid_items[0]

        dp = self.engine.ingest_plugins(_DIRTY_PLUGINS)
        self.clean_plugin = dp.valid_items[0]

        tr = self.engine.ingest_test_results(_TEST_RESULTS)
        self.test_results = {t.plugin_id: t for t in tr.valid_items}

    def test_scan_alias_detection(self):
        scanner = ApiScanner(self.host)
        result = scanner.scan_plugin(self.pdf_plugin)
        self.assertEqual(result.broken_apis, [])
        self.assertIn("doc.renderLegacy", result.alias_resolved)
        self.assertEqual(result.alias_resolved["doc.renderLegacy"], "document.render")
        self.assertFalse(result.undeclared_version)
        alias_resolutions = result.trace.get("alias_resolutions", [])
        self.assertTrue(
            any(ar["original"] == "doc.renderLegacy" for ar in alias_resolutions)
        )

    def test_scan_undeclared_version(self):
        scanner = ApiScanner(self.host)
        result = scanner.scan_plugin(self.theme_plugin)
        self.assertTrue(result.undeclared_version)
        self.assertIn("ui.settings.get", result.deprecated_apis)
        self.assertEqual(result.broken_apis, [])

    def test_scan_removed_apis_no_alias(self):
        scanner = ApiScanner(self.host)
        result = scanner.scan_plugin(self.importer_plugin)
        self.assertIn("file.import", result.broken_apis)
        self.assertIn("file.parse", result.broken_apis)
        self.assertFalse(result.undeclared_version)

    def test_scan_with_test_coverage(self):
        scanner = ApiScanner(self.host)
        result = scanner.scan_plugin(self.pdf_plugin, self.test_results)
        self.assertEqual(result.untested_apis, [])
        tc = result.trace.get("test_coverage", {})
        self.assertTrue(tc.get("test_result_found"))
        self.assertEqual(tc.get("test_status"), "passed")

    def test_scan_without_test_results(self):
        scanner = ApiScanner(self.host)
        result = scanner.scan_plugin(self.pdf_plugin, test_results=None)
        tc = result.trace.get("test_coverage", {})
        self.assertFalse(tc.get("test_results_provided", True))

    def test_scan_untested_deprecated_api(self):
        scanner = ApiScanner(self.host)
        result = scanner.scan_plugin(self.theme_plugin, self.test_results)
        self.assertIn("ui.settings.get", result.untested_apis)


class TestMatrix(unittest.TestCase):

    def setUp(self):
        self.engine = IngestionEngine()

        gp = self.engine.ingest_plugins(_GOOD_PLUGIN)
        self.pdf_plugin = gp.valid_items[0]

        nv = self.engine.ingest_plugins(_NO_VERSION_PLUGIN)
        self.theme_plugin = nv.valid_items[0]

        cp = self.engine.ingest_plugins(_CRITICAL_PLUGIN)
        self.importer_plugin = cp.valid_items[0]

        dp = self.engine.ingest_plugins(_DIRTY_PLUGINS)
        self.clean_plugin = dp.valid_items[0]

        hv = self.engine.ingest_host_versions(_HOST_V4)
        self.host = hv.valid_items[0]

        tr = self.engine.ingest_test_results(_TEST_RESULTS)
        self.test_results_list = tr.valid_items

        ar = self.engine.ingest_authors(_AUTHORS)
        self.authors = ar.valid_items

    def _compute_full(self):
        matrix = CompatibilityMatrix(
            plugins=[
                self.pdf_plugin,
                self.theme_plugin,
                self.importer_plugin,
                self.clean_plugin,
            ],
            host_version=self.host,
            test_results=self.test_results_list,
            authors=self.authors,
        )
        return matrix.compute()

    def test_compute_full_matrix(self):
        report = self._compute_full()
        entry_map = {e.plugin_id: e for e in report.entries}

        pdf = entry_map["pdf-exporter"]
        self.assertTrue(pdf.compatible)
        self.assertEqual(pdf.risk_level, RiskLevel.low)
        self.assertIn("doc.renderLegacy", pdf.alias_apis)
        self.assertEqual(pdf.broken_apis, [])
        self.assertTrue(pdf.test_coverage)

        theme = entry_map["theme-dark"]
        self.assertFalse(theme.compatible)
        self.assertEqual(theme.risk_level, RiskLevel.high)
        reasons = [
            item["reason"] for item in theme.trace.get("score_breakdown", [])
        ]
        self.assertIn("deprecated_api:ui.settings.get", reasons)
        self.assertTrue(theme.undeclared_version)
        self.assertFalse(theme.test_coverage)

        importer = entry_map["old-importer"]
        self.assertFalse(importer.compatible)
        self.assertEqual(importer.risk_level, RiskLevel.critical)
        self.assertIn("file.import", importer.broken_apis)
        self.assertIn("file.parse", importer.broken_apis)

        clean = entry_map["clean-plugin"]
        self.assertTrue(clean.compatible)
        self.assertEqual(clean.risk_level, RiskLevel.low)

    def test_risk_score_breakdown(self):
        report = self._compute_full()
        theme_entry = None
        for e in report.entries:
            if e.plugin_id == "theme-dark":
                theme_entry = e
                break
        self.assertIsNotNone(theme_entry)

        breakdown = theme_entry.trace.get("score_breakdown", [])
        reasons = [item["reason"] for item in breakdown]
        self.assertIn("deprecated_api:ui.settings.get", reasons)
        self.assertIn("undeclared_version", reasons)
        self.assertIn("no_test_coverage_for_broken_apis", reasons)

        total = 0
        for item in breakdown:
            total += item["points"]
            self.assertEqual(item["running_total"], total)
        self.assertEqual(total, 60)

        tc = theme_entry.trace.get("threshold_check", {})
        self.assertEqual(tc["score"], 60)
        self.assertEqual(tc["level"], "high")

    def test_calculation_trace(self):
        report = self._compute_full()
        ct = report.calculation_trace
        self.assertEqual(ct["total_plugins_scanned"], 4)
        self.assertEqual(ct["plugins_with_undeclared_version"], 1)
        self.assertEqual(ct["plugins_with_alias_apis"], 1)
        self.assertEqual(ct["plugins_without_test_coverage"], 2)
        self.assertIn("scoring_method_version", ct)

    def test_risk_summary(self):
        report = self._compute_full()
        self.assertEqual(report.risk_summary["critical"], 1)
        self.assertEqual(report.risk_summary["high"], 1)
        self.assertEqual(report.risk_summary["medium"], 0)
        self.assertEqual(report.risk_summary["low"], 2)
        total = sum(report.risk_summary.values())
        self.assertEqual(total, len(report.entries))


class TestNotifier(unittest.TestCase):

    def setUp(self):
        self.engine = IngestionEngine()

        gp = self.engine.ingest_plugins(_GOOD_PLUGIN)
        self.pdf_plugin = gp.valid_items[0]

        nv = self.engine.ingest_plugins(_NO_VERSION_PLUGIN)
        self.theme_plugin = nv.valid_items[0]

        cp = self.engine.ingest_plugins(_CRITICAL_PLUGIN)
        self.importer_plugin = cp.valid_items[0]

        dp = self.engine.ingest_plugins(_DIRTY_PLUGINS)
        self.clean_plugin = dp.valid_items[0]

        hv = self.engine.ingest_host_versions(_HOST_V4)
        self.host = hv.valid_items[0]

        tr = self.engine.ingest_test_results(_TEST_RESULTS)
        self.test_results_list = tr.valid_items

        ar = self.engine.ingest_authors(_AUTHORS)
        self.authors = ar.valid_items

        matrix = CompatibilityMatrix(
            plugins=[
                self.pdf_plugin,
                self.theme_plugin,
                self.importer_plugin,
                self.clean_plugin,
            ],
            host_version=self.host,
            test_results=self.test_results_list,
            authors=self.authors,
        )
        self.report = matrix.compute()
        self.notifier = AuthorNotifier()

    def test_generate_notifications(self):
        notifications = self.notifier.generate_notifications(self.report, self.authors)
        bob_notif = None
        alice_notif = None
        for n in notifications:
            if n.author_id == "author-bob":
                bob_notif = n
            if n.author_id == "author-alice":
                alice_notif = n

        self.assertIsNotNone(bob_notif)
        bob_pids = {ap.plugin_id for ap in bob_notif.affected_plugins}
        self.assertIn("theme-dark", bob_pids)
        self.assertIn("old-importer", bob_pids)

        self.assertIsNone(alice_notif)

    def test_notification_id_format(self):
        notifications = self.notifier.generate_notifications(self.report, self.authors)
        for n in notifications:
            expected_id = f"{self.report.report_id}__{n.author_id}"
            self.assertEqual(n.notification_id, expected_id)

    def test_no_notifications_for_low_risk(self):
        matrix = CompatibilityMatrix(
            plugins=[self.clean_plugin],
            host_version=self.host,
            test_results=[],
            authors=self.authors,
        )
        report = matrix.compute()
        notifications = self.notifier.generate_notifications(report, self.authors)
        self.assertEqual(len(notifications), 0)


class TestExporter(unittest.TestCase):

    def setUp(self):
        self.engine = IngestionEngine()

        gp = self.engine.ingest_plugins(_GOOD_PLUGIN)
        self.pdf_plugin = gp.valid_items[0]

        nv = self.engine.ingest_plugins(_NO_VERSION_PLUGIN)
        self.theme_plugin = nv.valid_items[0]

        cp = self.engine.ingest_plugins(_CRITICAL_PLUGIN)
        self.importer_plugin = cp.valid_items[0]

        dp = self.engine.ingest_plugins(_DIRTY_PLUGINS)
        self.clean_plugin = dp.valid_items[0]

        hv = self.engine.ingest_host_versions(_HOST_V4)
        self.host = hv.valid_items[0]

        tr = self.engine.ingest_test_results(_TEST_RESULTS)
        self.test_results_list = tr.valid_items

        ar = self.engine.ingest_authors(_AUTHORS)
        self.authors = ar.valid_items

        matrix = CompatibilityMatrix(
            plugins=[
                self.pdf_plugin,
                self.theme_plugin,
                self.importer_plugin,
                self.clean_plugin,
            ],
            host_version=self.host,
            test_results=self.test_results_list,
            authors=self.authors,
        )
        self.report = matrix.compute()

        self.plugins_source_map = {p.plugin_id: p._source_file for p in [
            self.pdf_plugin, self.theme_plugin,
            self.importer_plugin, self.clean_plugin,
        ]}
        self.test_results_source_map = {t.plugin_id: t._source_file for t in self.test_results_list}

    def test_to_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "report.json")
            exporter = ReportExporter()
            exporter.to_json(self.report, path)
            self.assertTrue(os.path.isfile(path))

            loaded = ReportExporter.load_report(path)
            self.assertEqual(loaded.report_id, self.report.report_id)
            self.assertEqual(loaded.host_version, self.report.host_version)
            self.assertEqual(len(loaded.entries), len(self.report.entries))
            for orig, rest in zip(self.report.entries, loaded.entries):
                self.assertEqual(orig.plugin_id, rest.plugin_id)
                self.assertEqual(orig.risk_level, rest.risk_level)
                self.assertEqual(orig.compatible, rest.compatible)

    def test_to_csv(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "report.csv")
            exporter = ReportExporter()
            exporter.to_csv(self.report, path)
            self.assertTrue(os.path.isfile(path))

            with open(path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            self.assertEqual(len(rows), len(self.report.entries))
            expected_headers = {
                "report_id", "host_version", "plugin_id",
                "compatible", "risk_level", "broken_apis",
                "alias_apis", "undeclared_version", "test_coverage",
            }
            self.assertEqual(set(rows[0].keys()), expected_headers)
            for row in rows:
                self.assertEqual(row["report_id"], self.report.report_id)
                self.assertEqual(row["host_version"], self.report.host_version)

    def test_to_markdown(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "report.md")
            exporter = ReportExporter()
            exporter.to_markdown(self.report, path)
            self.assertTrue(os.path.isfile(path))

            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            self.assertIn("Plugin Compatibility Report", content)
            self.assertIn("Risk Summary", content)
            self.assertIn("Per-Plugin Details", content)
            self.assertIn("Calculation Notes", content)
            self.assertIn(self.report.report_id, content)
            for entry in self.report.entries:
                self.assertIn(entry.plugin_id, content)

    def test_get_source_trace(self):
        exporter = ReportExporter(
            plugins_source_map=self.plugins_source_map,
            test_results_source_map=self.test_results_source_map,
        )
        trace = exporter.get_source_trace(self.report, "pdf-exporter")

        self.assertEqual(trace["report_id"], self.report.report_id)
        self.assertEqual(trace["plugin_id"], "pdf-exporter")
        self.assertIn("source_files", trace)
        self.assertIn("plugin_manifest", trace["source_files"])
        self.assertIn("test_result", trace["source_files"])
        self.assertIn("scan_trace", trace)

        self.assertTrue(trace["source_files"]["plugin_manifest"])
        self.assertTrue(trace["source_files"]["test_result"])

        scan_trace = trace["scan_trace"]
        self.assertIn("api_checks", scan_trace)
        self.assertIn("alias_resolutions", scan_trace)

    def test_get_source_trace_missing_plugin(self):
        exporter = ReportExporter()
        trace = exporter.get_source_trace(self.report, "nonexistent-plugin")
        self.assertIn("error", trace)


class TestEndToEnd(unittest.TestCase):

    def test_full_pipeline(self):
        engine = IngestionEngine()

        gp = engine.ingest_plugins(_GOOD_PLUGIN)
        pdf_plugin = gp.valid_items[0]

        nv = engine.ingest_plugins(_NO_VERSION_PLUGIN)
        theme_plugin = nv.valid_items[0]

        cp = engine.ingest_plugins(_CRITICAL_PLUGIN)
        importer_plugin = cp.valid_items[0]

        dp = engine.ingest_plugins(_DIRTY_PLUGINS)
        clean_plugin = dp.valid_items[0]

        hv = engine.ingest_host_versions(_HOST_V4)
        host = hv.valid_items[0]

        tr = engine.ingest_test_results(_TEST_RESULTS)
        test_results = tr.valid_items

        ar = engine.ingest_authors(_AUTHORS)
        authors = ar.valid_items

        plugins = [pdf_plugin, theme_plugin, importer_plugin, clean_plugin]

        matrix = CompatibilityMatrix(
            plugins=plugins,
            host_version=host,
            test_results=test_results,
            authors=authors,
        )
        report = matrix.compute()

        notifier = AuthorNotifier()
        notifications = notifier.generate_notifications(report, authors)

        plugins_source_map = {p.plugin_id: p._source_file for p in plugins}
        test_results_source_map = {t.plugin_id: t._source_file for t in test_results}

        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = os.path.join(tmpdir, "compat_report.json")
            csv_path = os.path.join(tmpdir, "compat_report.csv")
            md_path = os.path.join(tmpdir, "compat_report.md")

            exporter = ReportExporter(
                plugins_source_map=plugins_source_map,
                test_results_source_map=test_results_source_map,
            )
            exporter.to_json(report, json_path)
            exporter.to_csv(report, csv_path)
            exporter.to_markdown(report, md_path)

            loaded = ReportExporter.load_report(json_path)
            self.assertEqual(loaded.report_id, report.report_id)
            self.assertEqual(len(loaded.entries), len(report.entries))

            trace = exporter.get_source_trace(report, "pdf-exporter")
            self.assertEqual(trace["report_id"], report.report_id)
            self.assertEqual(trace["plugin_id"], "pdf-exporter")
            self.assertIn("source_files", trace)
            self.assertIn("scan_trace", trace)

            self.assertTrue(os.path.isfile(json_path))
            self.assertTrue(os.path.isfile(csv_path))
            self.assertTrue(os.path.isfile(md_path))

        total_in_summary = sum(report.risk_summary.values())
        self.assertEqual(total_in_summary, len(report.entries))

        for n in notifications:
            self.assertTrue(n.notification_id.startswith(report.report_id))

        notif_author_ids = {n.author_id for n in notifications}
        self.assertIn("author-bob", notif_author_ids)
        self.assertNotIn("author-alice", notif_author_ids)

        bob_notif = next(n for n in notifications if n.author_id == "author-bob")
        bob_affected_pids = {ap.plugin_id for ap in bob_notif.affected_plugins}
        self.assertIn("theme-dark", bob_affected_pids)
        self.assertIn("old-importer", bob_affected_pids)


if __name__ == "__main__":
    unittest.main()
