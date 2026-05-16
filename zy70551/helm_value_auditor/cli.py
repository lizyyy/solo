import click
import os
import yaml
from .auditor import HelmValuesAuditor


@click.group()
def main():
    pass

@main.command()
@click.argument("values_files", nargs=-1, type=click.Path(exists=True))
@click.option("--json", "output_json", type=click.Path(), help="Output JSON report to file")
@click.option("--html", "output_html", type=click.Path(), help="Output HTML report to file")
def audit(values_files, output_json, output_html):
    if not values_files:
        click.echo("Error: Please provide at least one values file")
        return
    auditor = HelmValuesAuditor()
    auditor.load_values_files(values_files)
    click.echo(auditor.generate_terminal_summary())
    if output_json:
        with open(output_json, "w") as f:
            f.write(auditor.generate_json_report())
        click.echo("JSON report written to " + output_json)
    if output_html:
        with open(output_html, "w") as f:
            f.write(auditor.generate_html_report())
        click.echo("HTML report written to " + output_html)

def flatten_dict(d, parent_key=""):
    items = {}
    for k, v in d.items():
        new_key = parent_key + "." + k if parent_key else k
        if isinstance(v, dict):
            items.update(flatten_dict(v, new_key))
        else:
            items[new_key] = v
    return items

@main.command()
@click.argument("file1", type=click.Path(exists=True))
@click.argument("file2", type=click.Path(exists=True))
def diff(file1, file2):
    with open(file1) as f:
        data1 = yaml.safe_load(f) or {}
    with open(file2) as f:
        data2 = yaml.safe_load(f) or {}
    flat1 = flatten_dict(data1)
    flat2 = flatten_dict(data2)
    all_keys = set(flat1.keys()) | set(flat2.keys())
    click.echo("=" * 80)
    click.echo("VALUES FILE DIFFERENCE")
    click.echo("=" * 80)
    for key in sorted(all_keys):
        if key not in flat1:
            click.echo("  + " + key + ": " + str(flat2[key]) + " (only in " + file2 + ")")
        elif key not in flat2:
            click.echo("  - " + key + ": " + str(flat1[key]) + " (only in " + file1 + ")")
        elif flat1[key] != flat2[key]:
            click.echo("  M " + key + ": " + str(flat1[key]) + " -> " + str(flat2[key]))
    click.echo("=" * 80)

if __name__ == "__main__":
    main()
