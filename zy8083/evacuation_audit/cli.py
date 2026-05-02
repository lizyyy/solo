import click
from pathlib import Path
from .parser import parse_roster, parse_door_events, parse_floor_plan, parse_rules, ParseError
from .models import PathAnalyzer
from .rules import RuleEngine
from .exporters import export_markdown, export_csv, export_html


@click.group()
def cli():
    """Evacuation Drill Audit CLI - For fire safety officers to review building evacuation drills."""
    pass


@cli.command()
@click.option('--roster', '-r', required=True, type=click.Path(exists=True), help='Path to occupant_roster.csv')
@click.option('--events', '-e', required=True, type=click.Path(exists=True), help='Path to door_events.jsonl')
@click.option('--floor-plan', '-f', required=True, type=click.Path(exists=True), help='Path to floor_plan.json')
@click.option('--rules', '-u', required=True, type=click.Path(exists=True), help='Path to drill_rules.yaml')
@click.option('--output-dir', '-o', default='.', help='Output directory for reports')
def run(roster, events, floor_plan, rules, output_dir):
    """Run evacuation drill audit analysis."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        click.echo("Parsing input files...")
        occupants = parse_roster(Path(roster))
        door_events = parse_door_events(Path(events))
        floor_plan_data = parse_floor_plan(Path(floor_plan))
        drill_rules = parse_rules(Path(rules))

        click.echo(f"  - {len(occupants)} occupants loaded")
        click.echo(f"  - {len(door_events)} door events loaded")

        click.echo("Building occupant timelines...")
        analyzer = PathAnalyzer(floor_plan_data)
        analyzer.build_timelines(occupants, door_events)

        click.echo("Running rule checks...")
        rule_engine = RuleEngine(drill_rules, floor_plan_data)
        violations = rule_engine.run_all_checks(analyzer.occupant_timelines, door_events)

        click.echo(f"  - Found {len(violations)} violations")

        drill_start = door_events[0].timestamp if door_events else 0
        drill_end = door_events[-1].timestamp if door_events else 0

        click.echo("Exporting reports...")
        export_markdown(
            output_path / 'evacuation_report.md',
            violations,
            analyzer.occupant_timelines,
            len(occupants),
            drill_start,
            drill_end
        )
        export_csv(output_path / 'violations.csv', violations)
        export_html(
            output_path / 'timeline.html',
            violations,
            analyzer.occupant_timelines,
            len(occupants),
            drill_start,
            drill_end
        )

        click.echo(f"\n✓ Reports exported to {output_path}:")
        click.echo(f"  - evacuation_report.md")
        click.echo(f"  - violations.csv")
        click.echo(f"  - timeline.html")

    except ParseError as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)


if __name__ == '__main__':
    cli()
