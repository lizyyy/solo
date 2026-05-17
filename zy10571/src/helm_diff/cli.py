import click
import sys
import traceback
import logging
from pathlib import Path
from typing import Tuple

from .renderer import HelmRenderer, RenderResult
from .normalizer import ResourceNormalizer
from .differ import HelmDiffer
from .masker import SensitiveDataMasker
from .reporter import ReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def print_error(message: str, show_traceback: bool = False) -> None:
    click.secho(f"ERROR: {message}", fg="red", err=True)
    if show_traceback:
        click.secho("\nStack trace:", fg="yellow", err=True)
        traceback.print_exc()


@click.group()
@click.version_option(version="0.1.0", prog_name="helm-diff")
def cli():
    """Helm Template Diff CLI - Compare Helm chart renders across different values
    
    This tool helps you compare the rendered Kubernetes manifests from a Helm
    chart using different values files, making it easy to spot unintended changes
    before deployment.
    """
    pass


@cli.command()
@click.argument("chart_path", type=click.Path(exists=True, file_okay=True, dir_okay=True))
@click.option("--env", "-e", multiple=True, type=(str, click.Path(exists=True)),
              help="Environment name and values file path (e.g., -e staging values/staging.yaml)")
@click.option("--base-env", "-b", default="base",
              help="Name of the base environment to compare against (default: base)")
@click.option("--output-dir", "-o", default="helm-diff-reports",
              help="Directory for output reports (default: helm-diff-reports)")
@click.option("--mask-sensitive/--no-mask-sensitive", default=True,
              help="Mask sensitive data in reports (default: True)")
@click.option("--save-manifests/--no-save-manifests", default=True,
              help="Save raw rendered manifests (default: True)")
@click.option("--json-report/--no-json-report", default=True,
              help="Generate JSON report (default: True)")
@click.option("--md-report/--no-md-report", default=True,
              help="Generate Markdown report (default: True)")
@click.option("--namespace", "-n", default="default",
              help="Kubernetes namespace for rendering (default: default)")
@click.option("--release-name", "-r", default=None,
              help="Helm release name (default: auto-generated)")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
def compare(
    chart_path: str,
    env: Tuple[Tuple[str, str], ...],
    base_env: str,
    output_dir: str,
    mask_sensitive: bool,
    save_manifests: bool,
    json_report: bool,
    md_report: bool,
    namespace: str,
    release_name: str,
    verbose: bool
):
    """Compare rendered manifests across multiple environments.
    
    CHART_PATH is the path to the Helm chart directory or packaged chart.
    
    Example:
      helm-diff compare ./charts/myapp -e staging values/staging.yaml -e production values/prod.yaml
    """
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        if len(env) < 2:
            raise click.UsageError(
                "At least two environments are required for comparison. "
                "Use -e/--env multiple times to specify environments."
            )

        environments = dict(env)
        
        if base_env not in environments:
            raise click.UsageError(
                f"Base environment '{base_env}' not found in specified environments. "
                f"Available environments: {', '.join(environments.keys())}"
            )

        click.secho("🔍 Rendering Helm templates...", fg="cyan")
        renderer = HelmRenderer()
        render_results = renderer.render_multiple(
            chart_path=chart_path,
            environments=environments,
            release_name=release_name,
            namespace=namespace
        )

        all_success = all(result.success for result in render_results.values())
        if not all_success:
            click.secho("⚠️  Some environments had render errors. Continuing with available data.", fg="yellow")

        click.secho("📋 Normalizing manifests...", fg="cyan")
        normalizer = ResourceNormalizer()
        
        normalized_resources = {}
        for env_name, result in render_results.items():
            normalized = normalizer.normalize_all(result.manifests)
            normalized_resources[env_name] = normalized

        all_masked_items = []
        if mask_sensitive:
            click.secho("🔒 Masking sensitive data...", fg="cyan")
            masker = SensitiveDataMasker()
            for env_name, result in render_results.items():
                masked_manifests, masked_items = masker.mask_all(result.manifests)
                result.manifests = masked_manifests
                all_masked_items.extend(masked_items)

        differ = HelmDiffer()
        reporter = ReportGenerator(output_dir=output_dir)

        other_envs = [name for name in environments.keys() if name != base_env]
        
        for compare_env in other_envs:
            click.secho(f"\n📊 Comparing {base_env} ↔ {compare_env}", fg="blue", bold=True)
            
            env_diff = differ.compare_environments(
                left_result=render_results[base_env],
                right_result=render_results[compare_env],
                left_resources=normalized_resources[base_env],
                right_resources=normalized_resources[compare_env]
            )

            reporter.generate_terminal_summary(env_diff, all_masked_items)

            if json_report:
                json_path = reporter.generate_json_report(env_diff, all_masked_items)
                click.secho(f"📄 JSON report: {json_path}", fg="green")

            if md_report:
                md_path = reporter.generate_markdown_report(env_diff, all_masked_items)
                click.secho(f"📝 Markdown report: {md_path}", fg="green")

        if save_manifests:
            manifest_files = reporter.save_raw_manifests(render_results)
            for env_name, path in manifest_files.items():
                click.secho(f"💾 Manifests ({env_name}): {path}", fg="green")

        click.secho("\n✅ Done!", fg="green", bold=True)
        
        has_changes = any(
            not result.success or 
            sum(1 for rd in differ.compare_environments(
                render_results[base_env],
                render_results[compare_env],
                normalized_resources[base_env],
                normalized_resources[compare_env]
            ).resource_diffs if rd.status != "unchanged") > 0
            for compare_env in other_envs
        )
        
        sys.exit(1 if has_changes else 0)

    except Exception as e:
        print_error(str(e), show_traceback=verbose)
        sys.exit(2)


@cli.command(name="list-resources")
@click.argument("chart_path", type=click.Path(exists=True, file_okay=True, dir_okay=True))
@click.argument("values_file", type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option("--namespace", "-n", default="default", help="Kubernetes namespace")
@click.option("--release-name", "-r", default=None, help="Helm release name")
@click.option("--output", "-o", type=click.Choice(["table", "json", "yaml"]), default="table",
              help="Output format (default: table)")
def list_resources(chart_path: str, values_file: str, namespace: str, release_name: str, output: str):
    """List all resources that would be created by the chart.
    
    Example:
      helm-diff list-resources ./charts/myapp values/staging.yaml
    """
    try:
        renderer = HelmRenderer()
        result = renderer.render(
            chart_path=chart_path,
            values_file=values_file,
            environment="list",
            release_name=release_name,
            namespace=namespace
        )

        if not result.success:
            click.secho("Render errors:", fg="red")
            for err in result.errors:
                click.echo(f"  - {err}")
            sys.exit(1)

        normalizer = ResourceNormalizer()
        normalized = normalizer.normalize_all(result.manifests)

        if output == "table":
            from rich.console import Console
            from rich.table import Table
            
            console = Console()
            table = Table(title="Rendered Resources")
            table.add_column("Kind", style="cyan")
            table.add_column("Namespace", style="magenta")
            table.add_column("Name", style="green")

            for res in sorted(normalized, key=lambda x: (x.kind, x.namespace or "", x.name)):
                table.add_row(res.kind, res.namespace or "-", res.name)
            
            console.print(table)
        
        elif output == "json":
            import json
            resources = [
                {"kind": r.kind, "namespace": r.namespace, "name": r.name}
                for r in normalized
            ]
            click.echo(json.dumps(resources, indent=2))
        
        elif output == "yaml":
            import yaml
            resources = [
                {"kind": r.kind, "namespace": r.namespace, "name": r.name}
                for r in normalized
            ]
            click.echo(yaml.safe_dump(resources, default_flow_style=False))

    except Exception as e:
        print_error(str(e), show_traceback=True)
        sys.exit(2)


@cli.command()
@click.argument("chart_path", type=click.Path(exists=True, file_okay=True, dir_okay=True))
@click.argument("values_file", type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option("--output-file", "-o", default=None, help="Output file path (default: print to stdout)")
@click.option("--namespace", "-n", default="default", help="Kubernetes namespace")
@click.option("--release-name", "-r", default=None, help="Helm release name")
@click.option("--mask-sensitive/--no-mask-sensitive", default=True,
              help="Mask sensitive data (default: True)")
def render(chart_path: str, values_file: str, output_file: str, namespace: str, release_name: str, mask_sensitive: bool):
    """Render Helm templates and output manifests.
    
    Example:
      helm-diff render ./charts/myapp values/staging.yaml -o rendered.yaml
    """
    try:
        renderer = HelmRenderer()
        result = renderer.render(
            chart_path=chart_path,
            values_file=values_file,
            environment="render",
            release_name=release_name,
            namespace=namespace
        )

        if not result.success:
            click.secho("Render errors:", fg="red")
            for err in result.errors:
                click.echo(f"  - {err}")
            sys.exit(1)

        if mask_sensitive:
            masker = SensitiveDataMasker()
            masked_manifests, _ = masker.mask_all(result.manifests)
            result.manifests = masked_manifests

        import yaml
        docs = []
        for manifest in result.manifests:
            docs.append("---")
            docs.append(yaml.safe_dump(manifest, default_flow_style=False))
        
        output = "\n".join(docs)
        
        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(output)
            click.secho(f"✅ Manifests written to: {output_file}", fg="green")
        else:
            click.echo(output)

    except Exception as e:
        print_error(str(e), show_traceback=True)
        sys.exit(2)


def main():
    try:
        cli()
    except KeyboardInterrupt:
        click.secho("\n\n⚠️  Operation cancelled by user.", fg="yellow")
        sys.exit(130)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}", show_traceback=True)
        sys.exit(2)


if __name__ == "__main__":
    main()
