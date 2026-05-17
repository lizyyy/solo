import click
import uuid
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from .__init__ import __version__
from .types import EvolutionReport, SchemaSnapshot, CompatibilityResult
from .schema_reader import get_schema_snapshot, validate_parquet_file, get_parquet_files
from .comparator import compare_schemas
from .reporter import generate_console_summary, generate_machine_readable, generate_markdown_report


@click.group()
@click.version_option(__version__)
def cli():
    pass


@cli.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.option('--reference', '-r', type=click.Path(exists=True), help='Reference parquet file/dir to compare against')
@click.option('--output-dir', '-o', type=click.Path(), default='./parquet-evolve-output', help='Output directory for reports')
@click.option('--strict/--no-strict', default=False, help='Strict mode: removed fields are considered incompatible')
@click.option('--validate-data/--no-validate', default=True, help='Validate actual data rows for decoding errors')
@click.option('--sample-size', '-s', type=int, default=1000, help='Max bad rows to capture')
@click.option('--run-id', type=str, help='Custom run ID (defaults to UUID)')
def check(
    input_path: str,
    reference: Optional[str],
    output_dir: str,
    strict: bool,
    validate_data: bool,
    sample_size: int,
    run_id: Optional[str],
):
    """Check Parquet schema evolution compatibility between datasets"""
    
    run_id = run_id or str(uuid.uuid4())[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    output_base = Path(output_dir) / f"run_{run_id}_{timestamp}"
    output_base.mkdir(parents=True, exist_ok=True)
    
    target_files = get_parquet_files(input_path)
    if not target_files:
        click.echo(f"❌ No Parquet files found at: {input_path}", err=True)
        sys.exit(1)
    
    click.echo(f"🔍 Found {len(target_files)} Parquet file(s)")
    
    reference_snapshot: Optional[SchemaSnapshot] = None
    if reference:
        ref_files = get_parquet_files(reference)
        if not ref_files:
            click.echo(f"❌ No Parquet files found at reference path: {reference}", err=True)
            sys.exit(1)
        reference_snapshot = get_schema_snapshot(ref_files[0])
        click.echo(f"📏 Reference: {ref_files[0]} ({len(reference_snapshot.fields)} fields)")
    elif len(target_files) >= 2:
        reference_snapshot = get_schema_snapshot(target_files[0])
        click.echo(f"📏 Using first file as reference: {target_files[0]}")
        target_files = target_files[1:]
    else:
        reference_snapshot = get_schema_snapshot(target_files[0])
        click.echo(f"📊 Single file analysis mode")
        target_files = []
    
    target_snapshots: List[SchemaSnapshot] = []
    all_bad_rows = []
    
    for file in target_files:
        try:
            snap = get_schema_snapshot(file)
            target_snapshots.append(snap)
            
            if validate_data:
                bad_rows = validate_parquet_file(file, sample_size)
                all_bad_rows.extend(bad_rows)
                if bad_rows:
                    click.echo(f"⚠️ Found {len(bad_rows)} issues in: {Path(file).name}")
        except Exception as e:
            click.echo(f"❌ Failed to process {file}: {str(e)}", err=True)
    
    from .types import CompatibilityLevel
    
    compat_result: CompatibilityResult
    if target_snapshots:
        if reference_snapshot:
            result = compare_schemas(reference_snapshot, target_snapshots[0], strict)
            for snap in target_snapshots[1:]:
                r = compare_schemas(reference_snapshot, snap, strict)
                result.changes.extend(r.changes)
                result.summary["total_changes"] += r.summary["total_changes"]
                for k, v in r.summary["changes_by_type"].items():
                    result.summary["changes_by_type"][k] = result.summary["changes_by_type"].get(k, 0) + v
                for k, v in r.summary["changes_by_impact"].items():
                    result.summary["changes_by_impact"][k] = result.summary["changes_by_impact"].get(k, 0) + v
                if r.overall_level == CompatibilityLevel.INCOMPATIBLE:
                    result.overall_level = CompatibilityLevel.INCOMPATIBLE
            compat_result = result
        else:
            compat_result = compare_schemas(target_snapshots[0], target_snapshots[0], strict)
    else:
        compat_result = compare_schemas(reference_snapshot, reference_snapshot, strict) if reference_snapshot else compare_schemas(target_snapshots[0], target_snapshots[0], strict)
    
    compat_result.bad_rows = all_bad_rows
    
    json_path = str(output_base / "results.json")
    md_path = str(output_base / "report.md")
    bad_rows_path = str(output_base / "bad_rows.csv")
    
    report = EvolutionReport(
        run_id=run_id,
        run_time=datetime.now().isoformat(),
        input_files=target_files,
        reference_schema=reference_snapshot,
        target_schemas=target_snapshots,
        compatibility=compat_result,
        output_paths={
            "machine_readable_json": json_path,
            "markdown_report": md_path,
            "bad_rows_csv": bad_rows_path,
        }
    )
    
    generate_machine_readable(report, json_path)
    generate_markdown_report(report, md_path)
    
    if all_bad_rows:
        import csv
        with open(bad_rows_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["row_index", "file_path", "column_name", "reason"])
            for br in all_bad_rows:
                writer.writerow([br.row_index, br.file_path, br.column_name or "", br.reason])
    
    generate_console_summary(report)
    
    click.echo(f"\n📦 Full output at: {output_base}")
    click.echo(f"   - JSON results: {json_path}")
    click.echo(f"   - Markdown report: {md_path}")
    if all_bad_rows:
        click.echo(f"   - Bad rows CSV: {bad_rows_path}")
    
    if compat_result.overall_level not in ["fully_compatible", "backward_compatible"]:
        sys.exit(2)


@cli.command("inspect")
@click.argument('file_path', type=click.Path(exists=True))
def inspect_schema(file_path: str):
    """Inspect Parquet file schema"""
    snap = get_schema_snapshot(file_path)
    
    click.echo(f"📄 File: {file_path}")
    click.echo(f"📊 Rows: {snap.row_count}")
    click.echo(f"📋 Fields ({len(snap.fields)}):")
    click.echo("")
    
    for f in snap.fields:
        nullable = "nullable" if f["nullable"] else "not null"
        click.echo(f"  - {f['name']}: {f['type']} [{nullable}]")


if __name__ == "__main__":
    cli()


def main():
    cli()
