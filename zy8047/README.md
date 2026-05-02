# Survey QC - Drone Aerial Survey Delivery Package Quality Inspection CLI

## Overview

A local CLI tool for validating drone aerial survey delivery packages. It checks photo coverage against flight routes, validates overlap/altitude/GSD metrics, and detects GPS missing or timestamp ordering issues.

## Installation

```bash
pip install -e .
```

## Project Structure

```
survey_qc/
├── __init__.py
├── parser.py      # CSV, YAML, GeoJSON, JSONL parsing
├── rules.py       # Validation rules engine
├── geometry.py    # Spatial calculations, coverage analysis
├── report.py      # CSV and Markdown report generation
├── engine.py      # Main QC orchestration
└── cli.py         # CLI entry point
```

## Usage

### Basic QC Check

```bash
survey-qc ./sample_data --rules ./sample_data/rules.yaml
```

### With Custom Output Directory

```bash
survey-qc ./survey_package --rules ./rules.yaml --output ./qc_reports
```

### Verbose Output

```bash
survey-qc ./sample_data --verbose
```

## Input Files

| File | Required | Description |
|------|----------|-------------|
| `photos.csv` | Yes | Photo list with photo_id, filename, latitude, longitude |
| `flight_lines.geojson` | Yes | Flight route lines with route_id in properties |
| `exif.jsonl` | Yes | Photo EXIF data (JSON Lines format) |
| `rules.yaml` | No | Validation rules (uses defaults if not provided) |

## Output Files

- `summary.md` - Overall quality summary
- `route_issues.csv` - All issues by route
- `{route_id}_issues.csv` - Per-route issue details

## Sample Data

Test data is available in `./sample_data/`:

- `photos.csv` - 12 photos on 2 routes
- `flight_lines.geojson` - 2 survey lines (route_A, route_B)
- `exif.jsonl` - EXIF data for all photos
- `rules.yaml` - Standard validation rules

### Cross-Midnight Sample

- `photos_midnight.csv`, `exif_midnight.jsonl`, `flight_lines_midnight.geojson` - Tests midnight crossing handling

## Validation Rules

| Rule | Default | Description |
|------|---------|-------------|
| `overlap.min_percent` | 60% | Minimum photo overlap |
| `altitude.target_m` | 120m | Target flight altitude |
| `altitude.tolerance_m` | 10m | Altitude tolerance |
| `gsd.min_cm_px` | 2.0 | Minimum GSD (cm/pixel) |
| `gsd.max_cm_px` | 10.0 | Maximum GSD (cm/pixel) |

## Features

- Photo coverage validation against flight routes
- Overlap rate calculation and checking
- Altitude deviation detection
- GSD (Ground Sample Distance) range validation
- GPS missing photo detection
- Timestamp disorder detection
- Cross-midnight flight handling
- Graceful handling of missing EXIF data

## Testing

```bash
pytest tests/ -v
```
