#!/usr/bin/env python3
"""TinyML Quantization Regression Diagnostic CLI."""
import click
from pathlib import Path
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parser import parse_predictions, parse_labels, parse_thresholds
from alignment import align_data
from metrics import compute_metrics
from reporter import generate_reports


@click.command()
@click.option('--baseline', required=True, type=click.Path(exists=True), help='Float baseline predictions JSONL')
@click.option('--quantized', required=True, type=click.Path(exists=True), help='INT8 quantized predictions JSONL')
@click.option('--labels', required=True, type=click.Path(exists=True), help='Ground truth labels CSV')
@click.option('--thresholds', required=True, type=click.Path(exists=True), help='Quantization thresholds YAML')
@click.option('--output-dir', default='output', type=click.Path(), help='Output directory for reports')
def main(baseline, quantized, labels, thresholds, output_dir):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    click.echo('Parsing inputs...')
    baseline_data = parse_predictions(baseline)
    quantized_data = parse_predictions(quantized)
    labels_data = parse_labels(labels)
    thresholds_data = parse_thresholds(thresholds)

    click.echo('Aligning data...')
    aligned = align_data(baseline_data, quantized_data, labels_data)

    click.echo('Computing metrics...')
    metrics = compute_metrics(aligned, thresholds_data)

    click.echo('Generating reports...')
    generate_reports(metrics, output_path)

    click.echo(f'Reports generated in {output_path}')


if __name__ == '__main__':
    main()