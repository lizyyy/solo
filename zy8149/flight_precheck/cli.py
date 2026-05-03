"""CLI entry point for flight precheck."""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click

from flight_precheck import __version__
from flight_precheck.parsers.csv_parser import WaypointParser, WeatherParser
from flight_precheck.parsers.geojson_parser import GeoJSONParser
from flight_precheck.parsers.yaml_parser import AircraftParser
from flight_precheck.calculators.geometry import calculate_flight_segments
from flight_precheck.calculators.rules import ComplianceCalculator, RiskLevel
from flight_precheck.exporters.csv_exporter import CSVExporter
from flight_precheck.exporters.md_exporter import MarkdownExporter
from flight_precheck.exporters.html_exporter import HTMLMapExporter


SAMPLE_DATA_DIR = Path(__file__).parent / "sample_data"


def get_sample_path(filename: str) -> str:
    """Get path to sample data file."""
    return str(SAMPLE_DATA_DIR / filename)


@click.group()
@click.version_option(version=__version__)
def main():
    """Offline route compliance pre-check CLI for power inspection teams.
    
    This tool checks flight routes for compliance with:
    - No-fly zones and height restrictions
    - Aircraft performance limits
    - Weather conditions
    - Return point availability
    """
    pass


@main.command()
@click.option('--waypoints', '-w', type=click.Path(exists=True),
              help='Path to waypoints CSV file')
@click.option('--zones', '-z', type=click.Path(exists=True),
              help='Path to restricted zones GeoJSON file')
@click.option('--aircraft', '-a', type=click.Path(exists=True),
              help='Path to aircraft capabilities YAML file')
@click.option('--weather', '-wth', type=click.Path(exists=True),
              help='Path to weather CSV file')
@click.option('--output-dir', '-o', type=click.Path(), default='.',
              help='Output directory for reports (default: current directory)')
@click.option('--flight-name', '-n', default='Power Inspection Flight',
              help='Name of the flight for reports')
@click.option('--use-sample', '-s', is_flag=True,
              help='Use built-in sample data for demonstration')
@click.option('--verbose', '-v', is_flag=True,
              help='Show detailed output')
def check(waypoints: Optional[str], zones: Optional[str], 
          aircraft: Optional[str], weather: Optional[str],
          output_dir: str, flight_name: str, use_sample: bool,
          verbose: bool):
    """Run compliance pre-check on a flight route.
    
    Reads waypoints, restricted zones, aircraft capabilities, and weather data,
    then generates compliance reports.
    
    Example:
        flight-precheck check --waypoints wp.csv --zones zones.geojson --aircraft drone.yaml --weather weather.csv
    """
    if use_sample:
        waypoints = get_sample_path("waypoints.csv")
        zones = get_sample_path("restricted_zones.geojson")
        aircraft = get_sample_path("aircraft.yaml")
        weather = get_sample_path("weather.csv")
        
        click.echo(f"Using sample data from: {SAMPLE_DATA_DIR}")
    
    required_files = [waypoints, zones, aircraft, weather]
    if not all(required_files):
        click.echo("Error: All input files are required unless --use-sample is specified", err=True)
        click.echo("Use --help for more information", err=True)
        sys.exit(1)
    
    click.echo(f"📋 Flight Precheck v{__version__}")
    click.echo("=" * 50)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    try:
        if verbose:
            click.echo("Parsing input files...")
        
        wp_parser = WaypointParser()
        waypoints_list = wp_parser.parse(waypoints)
        
        zone_parser = GeoJSONParser()
        restricted_zones = zone_parser.parse(zones)
        
        aircraft_parser = AircraftParser()
        aircraft_caps = aircraft_parser.parse(aircraft)
        
        weather_parser = WeatherParser()
        weather_data = weather_parser.parse(weather)
        
        if verbose:
            click.echo(f"  - Waypoints: {len(waypoints_list)}")
            click.echo(f"  - Restricted zones: {len(restricted_zones)}")
            click.echo(f"  - Aircraft: {aircraft_caps.model}")
            click.echo(f"  - Weather records: {len(weather_data.weather_records)}")
        
        click.echo("Calculating flight segments...")
        segments = calculate_flight_segments(waypoints_list, aircraft_caps.cruise_speed)
        
        total_distance = sum(s.distance_m for s in segments)
        total_time = sum(s.estimated_time_min for s in segments)
        
        if verbose:
            click.echo(f"  - Segments: {len(segments)}")
            click.echo(f"  - Total distance: {total_distance:.0f}m ({total_distance/1000:.2f}km)")
            click.echo(f"  - Estimated time: {total_time:.1f}min")
        
        click.echo("Running compliance checks...")
        calculator = ComplianceCalculator(
            waypoints=waypoints_list,
            restricted_zones=restricted_zones,
            aircraft=aircraft_caps,
            weather=weather_data,
            segments=segments
        )
        
        risk_events = calculator.check_all_compliance()
        
        critical_count = sum(1 for e in risk_events if e.level == RiskLevel.CRITICAL)
        high_count = sum(1 for e in risk_events if e.level == RiskLevel.HIGH)
        medium_count = sum(1 for e in risk_events if e.level == RiskLevel.MEDIUM)
        
        click.echo(f"  - Critical risks: {critical_count}")
        click.echo(f"  - High risks: {high_count}")
        click.echo(f"  - Medium risks: {medium_count}")
        
        if critical_count > 0:
            click.echo("⚠️  CRITICAL risks detected! Flight NOT recommended.")
        elif high_count > 0:
            click.echo("⚠️  HIGH risks detected. Review before proceeding.")
        else:
            click.echo("✅ No critical or high risks detected.")
        
        click.echo("Generating reports...")
        
        csv_path = output_path / "risk_events.csv"
        csv_exporter = CSVExporter()
        csv_exporter.export(risk_events, str(csv_path))
        click.echo(f"  - {csv_path}")
        
        md_path = output_path / "flight_brief.md"
        md_exporter = MarkdownExporter()
        md_exporter.export(
            risk_events=risk_events,
            waypoints=waypoints_list,
            segments=segments,
            aircraft=aircraft_caps,
            output_path=str(md_path),
            flight_name=flight_name
        )
        click.echo(f"  - {md_path}")
        
        html_path = output_path / "map_preview.html"
        html_exporter = HTMLMapExporter()
        html_exporter.export(
            waypoints=waypoints_list,
            segments=segments,
            restricted_zones=restricted_zones,
            risk_events=risk_events,
            output_path=str(html_path),
            flight_name=flight_name
        )
        click.echo(f"  - {html_path}")
        
        click.echo("=" * 50)
        click.echo("✅ Pre-check complete!")
        click.echo(f"   Reports saved to: {output_path.absolute()}")
        click.echo(f"   Open map_preview.html in a browser to view the map.")
        
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option('--output-dir', '-o', type=click.Path(), default='sample_inputs',
              help='Output directory for sample files')
def samples(output_dir: str):
    """Extract sample input files to the current directory.
    
    Copies the built-in sample data files to the specified directory
    so you can examine or modify them.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    sample_files = [
        "waypoints.csv",
        "restricted_zones.geojson",
        "aircraft.yaml",
        "weather.csv"
    ]
    
    click.echo("Extracting sample files...")
    
    for filename in sample_files:
        src = get_sample_path(filename)
        dst = output_path / filename
        
        if Path(src).exists():
            import shutil
            shutil.copy2(src, dst)
            click.echo(f"  - {dst}")
        else:
            click.echo(f"  Warning: {filename} not found in sample data")
    
    click.echo("")
    click.echo("Sample files extracted! Use them like this:")
    click.echo(f"  flight-precheck check -w {output_dir}/waypoints.csv -z {output_dir}/restricted_zones.geojson -a {output_dir}/aircraft.yaml -wth {output_dir}/weather.csv")


if __name__ == "__main__":
    main()
