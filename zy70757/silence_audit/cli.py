import click
import sys
import traceback
from pathlib import Path
from datetime import datetime

from .parser import SilenceParser, AlertParser
from .matcher import LabelMatchEngine, SourceTracker
from .risk_assessor import RiskAssessor
from .report_generator import ReportGenerator


class AuditError(Exception):
    pass


class FileParseError(AuditError):
    pass


class NoValidDataError(AuditError):
    pass


def print_banner():
    banner = r"""
  ____  _ _           ___       _ _ _
 / ___|(_) | ___     / _ \ _   _(_) | |_ ___
 \___ \| | |/ _ \   | | | | | | | | | __/ _ \
  ___) | | |  __/   | |_| | |_| | | | ||  __/
 |____/|_|_|\___|    \__\_\\__,_|_|_|\__\___|
              AUDIT TOOL
    """
    click.echo(banner)


def handle_exception(e: Exception, verbose: bool = False):
    click.echo(click.style(f"\nERROR: {str(e)}", fg="red", bold=True))
    if verbose:
        click.echo(click.style("\nStack trace:", fg="yellow"))
        traceback.print_exc()
    sys.exit(1)


@click.group()
@click.version_option(version="0.1.0")
def cli():
    pass


@cli.command()
@click.argument("silence_file", type=click.Path(exists=True, readable=True))
@click.argument("alert_file", type=click.Path(exists=True, readable=True))
@click.option("--output-dir", "-o", default="./audit_output",
              help="Directory for output reports")
@click.option("--prefix", "-p", default="",
              help="Prefix for output filenames")
@click.option("--verbose", "-v", is_flag=True,
              help="Enable verbose output")
def audit(silence_file, alert_file, output_dir, prefix, verbose):
    """
    Audit Prometheus silence rules against alerts.

    SILENCE_FILE: Path to JSON/YAML file containing silences
    ALERT_FILE: Path to JSON/YAML file containing alerts
    """
    print_banner()

    try:
        click.echo(click.style("Starting audit process...", fg="cyan"))
        click.echo(f"  Silence file: {silence_file}")
        click.echo(f"  Alert file: {alert_file}")
        click.echo(f"  Output directory: {output_dir}")
        click.echo("")

        click.echo(click.style("[1/5] Parsing silence file...", fg="blue"))
        try:
            silence_parser = SilenceParser()
            silence_result = silence_parser.parse_file(silence_file)
        except Exception as e:
            raise FileParseError(f"Failed to parse silence file: {str(e)}")

        click.echo(f"  Total silences: {silence_result.total_count}")
        click.echo(f"  Valid: {silence_result.valid_count}")
        click.echo(f"  Invalid: {silence_result.invalid_count}")
        click.echo("")

        if silence_result.valid_count == 0:
            raise NoValidDataError("No valid silences found in the input file")

        click.echo(click.style("[2/5] Parsing alert file...", fg="blue"))
        try:
            alert_parser = AlertParser()
            alert_result = alert_parser.parse_file(alert_file)
        except Exception as e:
            raise FileParseError(f"Failed to parse alert file: {str(e)}")

        click.echo(f"  Total alerts: {alert_result.total_count}")
        click.echo(f"  Valid: {alert_result.valid_count}")
        click.echo(f"  Invalid: {alert_result.invalid_count}")
        click.echo("")

        if alert_result.valid_count == 0:
            click.echo(click.style(
                "Warning: No valid alerts found. Matching results will be empty.",
                fg="yellow"
            ))
            click.echo("")

        click.echo(click.style("[3/5] Matching silences to alerts...", fg="blue"))
        match_engine = LabelMatchEngine()
        match_results = match_engine.match_all(
            silence_result.valid_items,
            alert_result.valid_items
        )

        total_matches = sum(len(r.matched_alerts) for r in match_results)
        click.echo(f"  Total matches found: {total_matches}")
        click.echo("")

        click.echo(click.style("[4/5] Assessing risk levels...", fg="blue"))
        risk_assessor = RiskAssessor()
        risk_assessment = risk_assessor.assess_all(match_results)

        risk_dist = risk_assessment.get("risk_distribution", {})
        click.echo(f"  CRITICAL: {risk_dist.get('CRITICAL', 0)}")
        click.echo(f"  HIGH: {risk_dist.get('HIGH', 0)}")
        click.echo(f"  MEDIUM: {risk_dist.get('MEDIUM', 0)}")
        click.echo(f"  LOW: {risk_dist.get('LOW', 0)}")
        click.echo(f"  INFO: {risk_dist.get('INFO', 0)}")
        click.echo("")

        click.echo(click.style("[5/5] Generating reports...", fg="blue"))
        report_gen = ReportGenerator(output_dir=output_dir)
        outputs = report_gen.generate_all_reports(
            silence_result,
            alert_result,
            match_results,
            risk_assessment,
            prefix=prefix
        )

        click.echo("")
        click.echo(click.style("=" * 60, fg="green"))
        click.echo(click.style("AUDIT COMPLETE", fg="green", bold=True))
        click.echo(click.style("=" * 60, fg="green"))
        click.echo("")

        high_risk_count = risk_assessment.get("high_risk_count", 0)
        if high_risk_count > 0:
            click.echo(click.style(
                f"⚠ WARNING: Found {high_risk_count} high/critical risk silences!",
                fg="yellow", bold=True
            ))
            click.echo("")

        click.echo(click.style("Generated reports:", fg="cyan"))
        for report_type, path in outputs.items():
            click.echo(f"  ✓ {report_type.upper()}: {path}")
        click.echo("")

        if silence_result.invalid_count > 0 or alert_result.invalid_count > 0:
            click.echo(click.style("Note:", fg="yellow"))
            if silence_result.invalid_count > 0:
                click.echo(f"  {silence_result.invalid_count} invalid silence entries were skipped.")
            if alert_result.invalid_count > 0:
                click.echo(f"  {alert_result.invalid_count} invalid alert entries were skipped.")
            click.echo("  See the JSON report for details on invalid items.")
            click.echo("")

    except AuditError as e:
        handle_exception(e, verbose)
    except Exception as e:
        handle_exception(e, verbose)


@cli.command()
@click.argument("silence_file", type=click.Path(exists=True, readable=True))
@click.option("--output-dir", "-o", default="./parse_output",
              help="Directory for output")
@click.option("--verbose", "-v", is_flag=True,
              help="Enable verbose output")
def parse_silences(silence_file, output_dir, verbose):
    """Parse and validate a silence file."""
    try:
        click.echo(click.style(f"Parsing {silence_file}...", fg="blue"))

        parser = SilenceParser()
        result = parser.parse_file(silence_file)

        click.echo(f"Total: {result.total_count}")
        click.echo(f"Valid: {result.valid_count}")
        click.echo(f"Invalid: {result.invalid_count}")

        if result.invalid_count > 0:
            click.echo("")
            click.echo(click.style("Invalid items:", fg="yellow"))
            for invalid in result.invalid_items:
                if hasattr(invalid, "parse_error"):
                    click.echo(f"  Line {invalid.source_line}: {invalid.parse_error}")
                elif isinstance(invalid, dict):
                    click.echo(f"  Line {invalid.get('source_line', '?')}: {invalid.get('parse_error', 'unknown error')}")

    except Exception as e:
        handle_exception(e, verbose)


@cli.command()
@click.argument("alert_file", type=click.Path(exists=True, readable=True))
@click.option("--output-dir", "-o", default="./parse_output",
              help="Directory for output")
@click.option("--verbose", "-v", is_flag=True,
              help="Enable verbose output")
def parse_alerts(alert_file, output_dir, verbose):
    """Parse and validate an alert file."""
    try:
        click.echo(click.style(f"Parsing {alert_file}...", fg="blue"))

        parser = AlertParser()
        result = parser.parse_file(alert_file)

        click.echo(f"Total: {result.total_count}")
        click.echo(f"Valid: {result.valid_count}")
        click.echo(f"Invalid: {result.invalid_count}")

        if result.invalid_count > 0:
            click.echo("")
            click.echo(click.style("Invalid items:", fg="yellow"))
            for invalid in result.invalid_items:
                if hasattr(invalid, "parse_error"):
                    click.echo(f"  Line {invalid.source_line}: {invalid.parse_error}")
                elif isinstance(invalid, dict):
                    click.echo(f"  Line {invalid.get('source_line', '?')}: {invalid.get('parse_error', 'unknown error')}")

    except Exception as e:
        handle_exception(e, verbose)


def main():
    try:
        cli()
    except KeyboardInterrupt:
        click.echo("\n\nAborted by user.")
        sys.exit(1)
    except Exception as e:
        click.echo(f"\nUnexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
