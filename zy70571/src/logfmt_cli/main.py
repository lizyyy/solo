import click
import sys
from pathlib import Path

from .parser import LogFileParser
from .reporter import generate_terminal_summary, save_report

@click.group()
def cli():
    pass

@cli.command()
@click.argument("logfile", type=click.Path(exists=True, dir_okay=False))
@click.option("--output-dir", "-o", default="logfmt_output", help="Output directory")
@click.option("--sort-by-time", "-s", is_flag=True, help="Sort by timestamp")
@click.option("--quiet", "-q", is_flag=True, help="Suppress output")
def parse(logfile, output_dir, sort_by_time, quiet):
    try:
        parser = LogFileParser()
        good_lines, bad_lines = parser.parse_file(logfile)
        stats = parser.get_field_stats()
        if not quiet:
            print(generate_terminal_summary(stats))
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        ndjson_path = output_dir / f"{Path(logfile).stem}.ndjson"
        parser.to_ndjson(str(ndjson_path), sort_by_time=sort_by_time)
        if not quiet:
            print(chr(10)+"📄 Structured NDJSON saved to:", ndjson_path)
        report_path = save_report(stats, logfile, output_dir)
        if not quiet:
            print("📊 Report saved to:", report_path)
    except Exception as e:
        print("Error:", str(e), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    cli()
