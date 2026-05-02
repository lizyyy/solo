import click
from pathlib import Path

from parsers.manifest import parse_images_manifest
from parsers.labels import parse_labels_jsonl
from parsers.split import parse_split_yaml

from rules.category_mapping import check_category_consistency
from rules.bbox_validation import validate_bounding_boxes
from rules.duplicate_detection import find_duplicate_images
from rules.class_balance import check_class_imbalance

from reports.markdown_report import generate_markdown_report
from reports.csv_report import generate_issues_csv
from reports.html_gallery import generate_html_gallery


@click.command()
@click.option(
    "--manifest",
    "-m",
    required=True,
    help="Path to images_manifest.csv file"
)
@click.option(
    "--labels",
    "-l",
    required=True,
    help="Path to labels.jsonl file"
)
@click.option(
    "--split",
    "-s",
    required=True,
    help="Path to split.yaml file"
)
@click.option(
    "--output",
    "-o",
    default="audit_output",
    help="Output directory for reports"
)
@click.option(
    "--base-path",
    "-b",
    default=".",
    help="Base path for image files in manifest"
)
@click.option(
    "--imbalance-threshold",
    type=float,
    default=10.0,
    help="Threshold for class imbalance ratio"
)
@click.option(
    "--min-samples",
    type=int,
    default=5,
    help="Minimum samples per category threshold"
)
def audit(
    manifest: str,
    labels: str,
    split: str,
    output: str,
    base_path: str,
    imbalance_threshold: float,
    min_samples: int
) -> None:
    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    click.echo("Loading manifest...")
    manifest_data = parse_images_manifest(manifest)
    
    click.echo("Loading labels...")
    labels_data = parse_labels_jsonl(labels)
    
    click.echo("Loading split...")
    split_data = parse_split_yaml(split)
    
    click.echo("Checking category consistency...")
    cat_issues = check_category_consistency(manifest_data, labels_data, split_data)
    
    click.echo("Validating bounding boxes...")
    bbox_issues = validate_bounding_boxes(manifest_data, labels_data)
    
    click.echo("Detecting duplicates...")
    dup_issues = find_duplicate_images(manifest_data, split_data, base_path)
    
    click.echo("Analyzing class balance...")
    balance_issues, balance_stats = check_class_imbalance(
        labels_data,
        split_data,
        imbalance_threshold,
        min_samples
    )
    
    all_issues = cat_issues + bbox_issues + dup_issues + balance_issues
    
    manifest_stats = {
        "total_images": len(manifest_data)
    }
    
    click.echo("Generating markdown report...")
    md_path = output_dir / "dataset_audit.md"
    generate_markdown_report(all_issues, balance_stats, manifest_stats, str(md_path))
    
    click.echo("Generating issues CSV...")
    csv_path = output_dir / "issues.csv"
    generate_issues_csv(all_issues, str(csv_path))
    
    click.echo("Generating HTML gallery...")
    html_path = output_dir / "sample_gallery.html"
    generate_html_gallery(manifest_data, labels_data, all_issues, base_path, str(html_path))
    
    error_count = sum(1 for i in all_issues if i["severity"] == "error")
    warning_count = sum(1 for i in all_issues if i["severity"] == "warning")
    
    click.echo("")
    click.echo(f"Audit complete!")
    click.echo(f"Errors: {error_count}")
    click.echo(f"Warnings: {warning_count}")
    click.echo(f"Reports saved to: {output_dir}")


if __name__ == "__main__":
    audit()