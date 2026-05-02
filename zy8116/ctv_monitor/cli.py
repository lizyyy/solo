"""CLI entry point for Clinical Trial Visit Window Monitor."""

import logging
from datetime import date
from pathlib import Path
from typing import Optional

import click

from .core import DateParser, DeviationType
from .engine import VisitWindowEngine
from .loader import DataLoader
from .output import OutputGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option()
def main():
    """Clinical Trial Visit Window Deviation Checker.
    
    Monitor visit window compliance in clinical trials.
    """
    pass


@main.command()
@click.option(
    "--data-dir", "-d",
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    default=".",
    help="Directory containing input data files (subjects.csv, visits.csv, etc.)",
)
@click.option(
    "--output-dir", "-o",
    type=click.Path(file_okay=False, dir_okay=True),
    default="./output",
    help="Directory to write output files",
)
@click.option(
    "--reference-date", "-r",
    type=str,
    default=None,
    help="Reference date for missed visit detection (format: YYYY-MM-DD). Default: today.",
)
@click.option(
    "--timezone", "-t",
    type=str,
    default="UTC",
    help="Default timezone for date parsing. Default: UTC",
)
@click.option(
    "--no-by-site",
    is_flag=True,
    help="Don't generate per-site deviation CSVs",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="Enable verbose logging",
)
def run(
    data_dir: str,
    output_dir: str,
    reference_date: Optional[str],
    timezone: str,
    no_by_site: bool,
    verbose: bool,
):
    """Run full analysis and generate all outputs.
    
    This command:
    1. Loads subjects.csv, visits.csv, protocol_windows.yaml, amendments.json
    2. Calculates visit windows based on protocol version and enrollment date
    3. Detects deviations (missed visits, early/late visits, duplicates, amendment crossings)
    4. Generates deviations.csv, report.md, and timeline.html for each subject
    """
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    data_path = Path(data_dir)
    output_path = Path(output_dir)
    
    logger.info(f"Loading data from: {data_path}")
    logger.info(f"Output directory: {output_path}")
    
    ref_date: Optional[date] = None
    if reference_date:
        try:
            ref_date = DateParser.parse_date(reference_date, timezone)
            logger.info(f"Using reference date: {ref_date.isoformat()}")
        except ValueError as e:
            logger.error(f"Invalid reference date: {e}")
            raise click.Abort()
    
    try:
        loader = DataLoader(data_path, default_timezone=timezone)
        data = loader.load_all()
    except Exception as e:
        logger.error(f"Failed to load data: {e}")
        raise click.Abort()
    
    logger.info(f"Loaded {len(data['subjects'])} subjects")
    logger.info(f"Loaded {len(data['visits'])} visits")
    logger.info(f"Loaded {len(data['protocol_windows'])} protocol version(s)")
    logger.info(f"Loaded {len(data['amendments'])} amendment(s)")
    
    engine = VisitWindowEngine(
        subjects=data["subjects"],
        visits=data["visits"],
        protocol_windows=data["protocol_windows"],
        amendments=data["amendments"],
    )
    
    logger.info("Running deviation analysis...")
    deviations = engine.run_analysis(reference_date=ref_date)
    
    logger.info(f"Detected {len(deviations)} total deviation(s)")
    
    by_type = engine.get_deviations_by_type()
    for dtype, devs in by_type.items():
        if devs:
            logger.info(f"  - {dtype.value}: {len(devs)}")
    
    output_gen = OutputGenerator(engine, output_path)
    
    logger.info("Generating output files...")
    outputs = output_gen.generate_all_outputs(
        reference_date=ref_date,
        by_site=not no_by_site,
    )
    
    logger.info(f"Generated deviations CSV: {outputs['deviations_csv'][0]}")
    if len(outputs["deviations_csv"]) > 1:
        for p in outputs["deviations_csv"][1:]:
            logger.info(f"Generated site-specific CSV: {p}")
    
    logger.info(f"Generated report: {outputs['report_md']}")
    logger.info(f"Generated {len(outputs['timelines'])} timeline HTML(s)")
    
    high_count = len([d for d in deviations if d.severity == "high"])
    if high_count > 0:
        logger.warning(f"Found {high_count} HIGH severity deviation(s) - review recommended")
    
    logger.info("Analysis complete!")


@main.command()
@click.option(
    "--data-dir", "-d",
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    default=".",
    help="Directory containing input data files",
)
@click.option(
    "--timezone", "-t",
    type=str,
    default="UTC",
    help="Default timezone",
)
def validate(data_dir: str, timezone: str):
    """Validate input data files without running full analysis.
    
    Checks that all required files exist and can be parsed correctly.
    """
    data_path = Path(data_dir)
    
    logger.info(f"Validating data in: {data_path}")
    
    required_files = ["subjects.csv", "visits.csv", "protocol_windows.yaml"]
    optional_files = ["amendments.json"]
    
    all_ok = True
    for f in required_files:
        file_path = data_path / f
        if not file_path.exists():
            logger.error(f"Required file missing: {file_path}")
            all_ok = False
        else:
            logger.info(f"✓ Found: {f}")
    
    for f in optional_files:
        file_path = data_path / f
        if file_path.exists():
            logger.info(f"✓ Found (optional): {f}")
        else:
            logger.info(f"  Not found (optional): {f}")
    
    if not all_ok:
        logger.error("Validation failed - missing required files")
        raise click.Abort()
    
    try:
        loader = DataLoader(data_path, default_timezone=timezone)
        data = loader.load_all()
        
        logger.info(f"✓ Successfully loaded {len(data['subjects'])} subjects")
        logger.info(f"✓ Successfully loaded {len(data['visits'])} visits")
        logger.info(f"✓ Successfully loaded {len(data['protocol_windows'])} protocol version(s)")
        logger.info(f"✓ Successfully loaded {len(data['amendments'])} amendment(s)")
        
        sites = {s.site_id for s in data["subjects"]}
        logger.info(f"  Sites detected: {', '.join(sorted(sites))}")
        
        visit_names = {v.visit_name for v in data["visits"]}
        logger.info(f"  Visit types: {', '.join(sorted(visit_names))}")
        
    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise click.Abort()
    
    logger.info("Validation passed!")


@main.command()
@click.option(
    "--output-dir", "-o",
    type=click.Path(file_okay=False, dir_okay=True),
    default="./sample_data",
    help="Directory to create sample data files",
)
def samples(output_dir: str):
    """Create sample data files for testing.
    
    Generates subjects.csv, visits.csv, protocol_windows.yaml, and amendments.json
    with realistic example data including various deviation scenarios.
    """
    from datetime import date, timedelta
    import csv
    import json
    import yaml
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    today = date.today()
    enroll_base = today - timedelta(days=100)
    
    subjects = [
        {
            "subject_id": "S001",
            "site_id": "Site-A",
            "enrollment_date": enroll_base.isoformat(),
            "enrollment_timezone": "America/New_York",
            "protocol_version": "1.0",
        },
        {
            "subject_id": "S002",
            "site_id": "Site-A",
            "enrollment_date": (enroll_base + timedelta(days=5)).isoformat(),
            "enrollment_timezone": "America/New_York",
            "protocol_version": "1.0",
        },
        {
            "subject_id": "S003",
            "site_id": "Site-B",
            "enrollment_date": (enroll_base + timedelta(days=10)).isoformat(),
            "enrollment_timezone": "Europe/London",
            "protocol_version": "2.0",
        },
        {
            "subject_id": "S004",
            "site_id": "Site-B",
            "enrollment_date": (enroll_base + timedelta(days=15)).isoformat(),
            "enrollment_timezone": "Asia/Tokyo",
            "protocol_version": "2.0",
        },
    ]
    
    subjects_file = output_path / "subjects.csv"
    with open(subjects_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=subjects[0].keys())
        writer.writeheader()
        writer.writerows(subjects)
    
    visits = [
        {
            "subject_id": "S001",
            "visit_name": "Screening",
            "visit_date": enroll_base.isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S001",
            "visit_name": "Day 1",
            "visit_date": enroll_base.isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S001",
            "visit_name": "Day 7",
            "visit_date": (enroll_base + timedelta(days=5)).isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S001",
            "visit_name": "Day 14",
            "visit_date": (enroll_base + timedelta(days=20)).isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S002",
            "visit_name": "Screening",
            "visit_date": (enroll_base + timedelta(days=5)).isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S002",
            "visit_name": "Day 1",
            "visit_date": (enroll_base + timedelta(days=5)).isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S002",
            "visit_name": "Day 7",
            "visit_date": (enroll_base + timedelta(days=12)).isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S002",
            "visit_name": "Day 7",
            "visit_date": (enroll_base + timedelta(days=12)).isoformat(),
            "visit_timezone": "America/New_York",
            "is_missed": "false",
        },
        {
            "subject_id": "S003",
            "visit_name": "Screening",
            "visit_date": (enroll_base + timedelta(days=10)).isoformat(),
            "visit_timezone": "Europe/London",
            "is_missed": "false",
        },
        {
            "subject_id": "S003",
            "visit_name": "Day 1",
            "visit_date": (enroll_base + timedelta(days=10)).isoformat(),
            "visit_timezone": "Europe/London",
            "is_missed": "false",
        },
        {
            "subject_id": "S003",
            "visit_name": "Day 7",
            "visit_date": (enroll_base + timedelta(days=17)).isoformat(),
            "visit_timezone": "Europe/London",
            "is_missed": "false",
        },
        {
            "subject_id": "S004",
            "visit_name": "Screening",
            "visit_date": (enroll_base + timedelta(days=15)).isoformat(),
            "visit_timezone": "Asia/Tokyo",
            "is_missed": "false",
        },
        {
            "subject_id": "S004",
            "visit_name": "Day 1",
            "visit_date": (enroll_base + timedelta(days=15)).isoformat(),
            "visit_timezone": "Asia/Tokyo",
            "is_missed": "true",
        },
    ]
    
    visits_file = output_path / "visits.csv"
    with open(visits_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=visits[0].keys())
        writer.writeheader()
        writer.writerows(visits)
    
    protocol_windows = {
        "versions": [
            {
                "version": "1.0",
                "windows": [
                    {
                        "visit_name": "Screening",
                        "target_days": 0,
                        "window_early_days": 7,
                        "window_late_days": 0,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 1",
                        "target_days": 0,
                        "window_early_days": 0,
                        "window_late_days": 0,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 7",
                        "target_days": 7,
                        "window_early_days": 1,
                        "window_late_days": 1,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 14",
                        "target_days": 14,
                        "window_early_days": 2,
                        "window_late_days": 2,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 28",
                        "target_days": 28,
                        "window_early_days": 3,
                        "window_late_days": 3,
                        "is_mandatory": True,
                    },
                ],
            },
            {
                "version": "2.0",
                "windows": [
                    {
                        "visit_name": "Screening",
                        "target_days": 0,
                        "window_early_days": 14,
                        "window_late_days": 0,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 1",
                        "target_days": 0,
                        "window_early_days": 0,
                        "window_late_days": 0,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 7",
                        "target_days": 7,
                        "window_early_days": 2,
                        "window_late_days": 2,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 14",
                        "target_days": 14,
                        "window_early_days": 3,
                        "window_late_days": 3,
                        "is_mandatory": True,
                    },
                    {
                        "visit_name": "Day 28",
                        "target_days": 28,
                        "window_early_days": 4,
                        "window_late_days": 4,
                        "is_mandatory": True,
                    },
                ],
            },
        ],
    }
    
    protocol_file = output_path / "protocol_windows.yaml"
    with open(protocol_file, "w", encoding="utf-8") as f:
        yaml.dump(protocol_windows, f, default_flow_style=False, sort_keys=False)
    
    amendments = {
        "amendments": [
            {
                "amendment_id": "AM-001",
                "protocol_version": "2.0",
                "effective_date": (enroll_base + timedelta(days=8)).isoformat(),
                "effective_timezone": "UTC",
                "description": "Extended visit windows for all visits",
                "visit_changes": [
                    {"visit_name": "Day 7", "change": "window extended from ±1 to ±2 days"},
                    {"visit_name": "Day 14", "change": "window extended from ±2 to ±3 days"},
                ],
            },
        ],
    }
    
    amendments_file = output_path / "amendments.json"
    with open(amendments_file, "w", encoding="utf-8") as f:
        json.dump(amendments, f, indent=2)
    
    logger.info(f"Sample data created in: {output_path}")
    logger.info(f"  - {subjects_file.name} ({len(subjects)} subjects)")
    logger.info(f"  - {visits_file.name} ({len(visits)} visits)")
    logger.info(f"  - {protocol_file.name} (2 protocol versions)")
    logger.info(f"  - {amendments_file.name} (1 amendment)")
    logger.info("")
    logger.info("Sample scenarios included:")
    logger.info("  - S001: Early Day 7, Late Day 14")
    logger.info("  - S002: Duplicate Day 7 visits")
    logger.info("  - S003: Uses protocol v2.0")
    logger.info("  - S004: Missed Day 1 (explicitly marked)")


if __name__ == "__main__":
    main()
