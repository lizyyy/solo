# Formation QC

Lithium battery formation and grading batch verification CLI tool for engineers.

## Quick Start

```bash
python -m formation_qc demo
```

This generates sample data and runs QC verification.

## Input Files

### channel_readings.csv
| Column | Description |
|--------|-------------|
| channel | Channel number |
| timestamp | Time string (YYYY-MM-DD HH:MM:SS) |
| voltage | Voltage in V |
| current | Current in A |
| temperature | Temperature in °C |
| capacity | Cumulative capacity in Ah |

### recipe.yaml
```yaml
stages:
  - name: formation
    duration_min: 60
  - name: rest
    duration_min: 30
  - name: grading
    duration_min: 90
  - name: final_rest
    duration_min: 30
sampling_interval: 10
temperature_threshold:
  max_rise_per_step: 15.0
  max_rate_C_per_min: 2.0
voltage_threshold:
  min: 2.5
  max: 4.3
```

### tray_map.json
```json
{
  "trays": [
    {
      "tray_id": "A1",
      "cells": [
        {"channel": 1, "position": "A1", "type": "NMC811"}
      ]
    }
  ]
}
```

## Usage

```bash
python -m formation_qc check --csv channel_readings.csv --recipe recipe.yaml --tray-map tray_map.json --output output
```

## Outputs

- `batch_report.md` - Full batch quality report
- `bad_channels.csv` - Channels with issues
- `curves.html` - Interactive voltage/current/temperature/capacity curves

## Detection Rules

| Issue | Detection Logic |
|-------|-----------------|
| Offline | Gap > 3× sampling interval |
| Reverse connection | >30% voltage drops >0.5V |
| Temperature rise | Rise > threshold or rate >2°C/min |
| Missing samples | Gap > 2× expected interval |
| Capacity outlier | IQR or Z-score method |
