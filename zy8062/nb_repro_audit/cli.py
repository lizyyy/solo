"""
CLI Module for nb_repro_audit

Command-line interface for auditing Jupyter notebooks.
"""

import argparse
import sys
import yaml
from pathlib import Path
from typing import Optional, List

from .parser import NotebookParser
from .scanner import DependencyScanner
from .engine import RuleEngine
from .cleaner import NotebookCleaner
from .exporter import ReportExporter


def load_yaml_file(file_path: Path) -> Optional[dict]:
    """Load a YAML file and return its contents as a dict."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"Warning: Could not load {file_path}: {e}")
        return None


def load_env_dependencies(env_file: Optional[Path]) -> List[str]:
    """Load environment dependencies from requirements.txt or similar."""
    if not env_file:
        return []

    dependencies = []

    if env_file.name.endswith('.txt'):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    pkg = line.split('==')[0].split('>=')[0].split('<=')[0].strip()
                    if pkg:
                        dependencies.append(pkg.lower())

    elif env_file.name.endswith('.yaml') or env_file.name.endswith('.yml'):
        data = load_yaml_file(env_file)
        if data:
            if isinstance(data, dict):
                for key in ['dependencies', 'packages', 'requirements']:
                    if key in data:
                        items = data[key]
                        if isinstance(items, list):
                            dependencies.extend([
                                str(item).split('==')[0].split('>=')[0].lower()
                                for item in items
                            ])
                        break

    return dependencies


def audit_command(args):
    """Execute the audit command."""
    notebooks_dir = Path(args.notebooks_dir)
    output_dir = Path(args.output_dir) if args.output_dir else Path('./audit_output')

    if not notebooks_dir.exists():
        print(f"Error: Notebooks directory does not exist: {notebooks_dir}")
        return 1

    datasets_manifest = None
    if args.datasets_manifest:
        datasets_manifest = load_yaml_file(Path(args.datasets_manifest))

    env_dependencies = load_env_dependencies(
        Path(args.env_file) if args.env_file else None
    )

    print(f"Scanning notebooks in: {notebooks_dir}")
    print(f"Output directory: {output_dir}")

    parser = NotebookParser(str(notebooks_dir), datasets_manifest)
    parser.discover_notebooks()

    if not parser.notebooks:
        print("Error: No .ipynb files found in the specified directory")
        return 1

    print(f"Found {len(parser.notebooks)} notebook(s)")

    notebook_analyses = []
    for nb_path in parser.notebooks:
        print(f"  Parsing: {nb_path.name}")
        analysis = parser.parse_notebook(nb_path)
        notebook_analyses.append(analysis)

    scanner = DependencyScanner(
        str(notebooks_dir),
        datasets_manifest,
        env_dependencies
    )

    scan_results = []
    for nb_path in parser.notebooks:
        print(f"  Scanning dependencies: {nb_path.name}")
        scan_result = scanner.scan_notebook(nb_path)
        scan_results.append(scan_result)

    engine = RuleEngine()
    audit_score = engine.apply_rules(notebook_analyses, scan_results)

    print("\n" + "=" * 60)
    print("AUDIT RESULTS")
    print("=" * 60)
    print(f"Total Risk Score: {audit_score.total_score}/{audit_score.max_possible_score}")
    print(f"Risk Rating: {audit_score.risk_rating}")
    print(f"Risk Percentage: {audit_score.risk_percentage:.2f}%")
    print(f"Total Findings: {len(audit_score.risk_findings)}")

    if audit_score.category_scores:
        print("\nScores by Category:")
        for cat, score in sorted(audit_score.category_scores.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {score}")

    print("\nFindings by Severity:")
    for level in ['critical', 'error', 'warning', 'info']:
        count = sum(1 for f in audit_score.risk_findings if f.risk_level.value == level)
        if count > 0:
            print(f"  {level.upper()}: {count}")

    exporter = ReportExporter(output_dir)

    if args.export_reports:
        print(f"\nExporting reports to: {output_dir}")
        export_result = exporter.export_full_report(
            notebook_analyses, scan_results, audit_score, datasets_manifest
        )
        if export_result.report_path:
            print(f"  ✓ Report: {export_result.report_path}")
        if export_result.csv_path:
            print(f"  ✓ CSV: {export_result.csv_path}")
        if export_result.errors:
            for err in export_result.errors:
                print(f"  ✗ Error: {err}")

    if args.clean:
        cleaner = NotebookCleaner()
        cleaned_dir = output_dir / "cleaned_notebooks"
        cleaned_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nCleaning notebooks...")
        cleaned_paths = []
        for nb_path in parser.notebooks:
            result = cleaner.clean_notebook(nb_path, cleaned_dir)
            if result.cleaned_path:
                cleaned_paths.append(result.cleaned_path)
                print(f"  ✓ Cleaned: {result.cleaned_path} ({result.cells_cleaned} cells, {result.output_size_removed} bytes removed)")
            elif result.error:
                print(f"  ✗ Failed: {nb_path.name} - {result.error}")

        if cleaned_paths:
            print(f"\nCleaned notebooks saved to: {cleaned_dir}")

    print("\n" + "=" * 60)

    if audit_score.risk_percentage > 75:
        print("⚠️  WARNING: High risk detected! Review findings before submission.")
        return 1
    elif audit_score.risk_percentage > 50:
        print("⚠️  CAUTION: Medium-high risk. Consider addressing warnings.")
        return 0
    else:
        print("✓ Audit passed. Notebook(s) appear safe for submission.")
        return 0


def clean_command(args):
    """Execute the clean command."""
    notebook_path = Path(args.notebook)
    output_dir = Path(args.output_dir) if args.output_dir else notebook_path.parent

    if not notebook_path.exists():
        print(f"Error: Notebook file does not exist: {notebook_path}")
        return 1

    cleaner = NotebookCleaner(
        large_output_threshold=args.threshold * 1024 if args.threshold else 100 * 1024
    )

    result = cleaner.clean_notebook(notebook_path, output_dir)

    if result.cleaned_path:
        print(f"✓ Cleaned notebook saved: {result.cleaned_path}")
        print(f"  Cells cleaned: {result.cells_cleaned}")
        print(f"  Output removed: {result.output_size_removed} bytes")
        return 0
    else:
        print(f"✗ Failed to clean notebook: {result.error}")
        return 1


def report_command(args):
    """Execute the report command."""
    print("Generating report from existing analysis...")

    output_dir = Path(args.output_dir) if args.output_dir else Path('./audit_output')
    exporter = ReportExporter(output_dir)

    print(f"Reports will be generated in: {output_dir}")
    print("Note: This command requires pre-run analysis data.")
    return 0


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='nb_repro_audit - Jupyter Notebook Reproducibility Audit Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Audit notebooks in current directory
  python -m nb_repro_audit audit --notebooks-dir ./notebooks

  # Audit with datasets manifest and environment file
  python -m nb_repro_audit audit --notebooks-dir ./notebooks \\
                                  --datasets-manifest datasets_manifest.yaml \\
                                  --env-file requirements.txt

  # Audit and clean large outputs
  python -m nb_repro_audit audit --notebooks-dir ./notebooks --clean

  # Clean a single notebook
  python -m nb_repro_audit clean notebook.ipynb --output-dir ./cleaned

  # Clean with custom threshold (in KB)
  python -m nb_repro_audit clean notebook.ipynb --threshold 500
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    audit_parser = subparsers.add_parser('audit', help='Audit notebooks for reproducibility issues')
    audit_parser.add_argument('--notebooks-dir', '-n', required=True, help='Directory containing notebooks')
    audit_parser.add_argument('--datasets-manifest', '-d', help='Path to datasets_manifest.yaml')
    audit_parser.add_argument('--env-file', '-e', help='Path to environment dependencies file (requirements.txt, etc.)')
    audit_parser.add_argument('--output-dir', '-o', help='Output directory for reports (default: ./audit_output)')
    audit_parser.add_argument('--clean', action='store_true', help='Clean large outputs from notebooks')
    audit_parser.add_argument('--export-reports', action='store_true', default=True, help='Export audit reports (default: True)')
    audit_parser.set_defaults(func=audit_command)

    clean_parser = subparsers.add_parser('clean', help='Clean large outputs from a notebook')
    clean_parser.add_argument('notebook', help='Path to the notebook file')
    clean_parser.add_argument('--output-dir', '-o', help='Output directory (default: same as input)')
    clean_parser.add_argument('--threshold', '-t', type=int, help='Output size threshold in KB (default: 100KB)')
    clean_parser.set_defaults(func=clean_command)

    report_parser = subparsers.add_parser('report', help='Generate report from analysis')
    report_parser.add_argument('--output-dir', '-o', help='Output directory (default: ./audit_output)')
    report_parser.set_defaults(func=report_command)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
