import argparse
import json
import os
import sys

from .ingest import IngestionEngine
from .matrix import CompatibilityMatrix
from .notifier import AuthorNotifier
from .exporter import ReportExporter


def _cmd_scan(args: argparse.Namespace) -> None:
    engine = IngestionEngine()

    plugin_result = engine.ingest_plugins(args.plugins_dir)
    host_result = engine.ingest_host_versions(args.host_version_file)
    author_result = engine.ingest_authors(args.authors_dir) if args.authors_dir else engine.ingest_authors("")
    test_result = engine.ingest_test_results(args.tests_dir) if args.tests_dir else engine.ingest_test_results("")

    if not plugin_result.valid_items:
        print("No valid plugins found.", file=sys.stderr)
        sys.exit(1)

    if not host_result.valid_items:
        print("No valid host versions found.", file=sys.stderr)
        sys.exit(1)

    host_version = host_result.valid_items[0]

    dirty_total = (
        len(plugin_result.dirty_items)
        + len(host_result.dirty_items)
        + len(author_result.dirty_items)
        + len(test_result.dirty_items)
    )
    if dirty_total > 0:
        print(f"Warning: {dirty_total} dirty items skipped during ingestion.", file=sys.stderr)

    matrix = CompatibilityMatrix(
        plugins=plugin_result.valid_items,
        host_version=host_version,
        test_results=test_result.valid_items,
        authors=author_result.valid_items,
    )
    report = matrix.compute()

    plugins_source_map = {p.plugin_id: p._source_file for p in plugin_result.valid_items}
    test_results_source_map = {t.plugin_id: t._source_file for t in test_result.valid_items}

    exporter = ReportExporter(
        plugins_source_map=plugins_source_map,
        test_results_source_map=test_results_source_map,
    )

    output_dir = args.output_dir or "."
    os.makedirs(output_dir, exist_ok=True)

    json_path = os.path.join(output_dir, "compat_report.json")
    csv_path = os.path.join(output_dir, "compat_report.csv")
    md_path = os.path.join(output_dir, "compat_report.md")

    exporter.to_json(report, json_path)
    exporter.to_csv(report, csv_path)
    exporter.to_markdown(report, md_path)

    print(f"Report generated: {report.report_id}")
    print(f"  Host version: {report.host_version}")
    print(f"  Plugins scanned: {len(report.entries)}")
    print(f"  Risk summary: {report.risk_summary}")
    print(f"  Output files:")
    print(f"    JSON: {json_path}")
    print(f"    CSV:  {csv_path}")
    print(f"    MD:   {md_path}")


def _cmd_trace(args: argparse.Namespace) -> None:
    report = ReportExporter.load_report(args.report_file)

    engine = IngestionEngine()
    plugins_source_map: dict[str, str] = {}
    test_results_source_map: dict[str, str] = {}

    if args.plugins_dir:
        pr = engine.ingest_plugins(args.plugins_dir)
        plugins_source_map = {p.plugin_id: p._source_file for p in pr.valid_items}
    if args.tests_dir:
        tr = engine.ingest_test_results(args.tests_dir)
        test_results_source_map = {t.plugin_id: t._source_file for t in tr.valid_items}

    exporter = ReportExporter(
        plugins_source_map=plugins_source_map,
        test_results_source_map=test_results_source_map,
    )

    trace = exporter.get_source_trace(report, args.plugin_id)

    if "error" in trace:
        print(trace["error"], file=sys.stderr)
        sys.exit(1)

    print(json.dumps(trace, indent=2, ensure_ascii=False))


def _cmd_notify(args: argparse.Namespace) -> None:
    report = ReportExporter.load_report(args.report_file)

    engine = IngestionEngine()
    author_result = engine.ingest_authors(args.authors_dir)

    notifier = AuthorNotifier()
    notifications = notifier.generate_notifications(report, author_result.valid_items)

    output_dir = args.output_dir or "."
    os.makedirs(output_dir, exist_ok=True)

    notifications_data = [n.to_dict() for n in notifications]
    out_path = os.path.join(output_dir, "notifications.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(notifications_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(notifications)} notifications.")
    for n in notifications:
        print(f"  {n.author_name} ({n.author_email}): {len(n.affected_plugins)} affected plugin(s)")
    print(f"  Output: {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="plugin_compat_matrix",
        description="Plugin Compatibility Matrix - Desktop software release management tool",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Scan plugins for compatibility")
    scan_parser.add_argument("--plugins-dir", required=True, help="Directory containing plugin JSON files")
    scan_parser.add_argument("--host-version-file", required=True, help="Host version JSON file or directory")
    scan_parser.add_argument("--authors-dir", default="", help="Directory containing author JSON files")
    scan_parser.add_argument("--tests-dir", default="", help="Directory containing test result JSON files")
    scan_parser.add_argument("--output-dir", default=".", help="Output directory for reports")

    trace_parser = subparsers.add_parser("trace", help="Trace a plugin's full provenance chain")
    trace_parser.add_argument("--report-file", required=True, help="Path to compatibility report JSON")
    trace_parser.add_argument("--plugin-id", required=True, help="Plugin ID to trace")
    trace_parser.add_argument("--plugins-dir", default="", help="Plugins directory for source file resolution")
    trace_parser.add_argument("--tests-dir", default="", help="Tests directory for source file resolution")

    notify_parser = subparsers.add_parser("notify", help="Generate author notifications from report")
    notify_parser.add_argument("--report-file", required=True, help="Path to compatibility report JSON")
    notify_parser.add_argument("--authors-dir", required=True, help="Directory containing author JSON files")
    notify_parser.add_argument("--output-dir", default=".", help="Output directory for notifications")

    args = parser.parse_args()

    if args.command == "scan":
        _cmd_scan(args)
    elif args.command == "trace":
        _cmd_trace(args)
    elif args.command == "notify":
        _cmd_notify(args)


if __name__ == "__main__":
    main()
