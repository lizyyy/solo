"""
Hydraulic Balance Calculator for District Heating Systems
============================================================

A CLI tool for heating maintenance teams to recalculate hydraulic balance
of building heat exchange stations before cold waves.

Features:
- Reads building topology (CSV)
- Reads flow/temperature data (JSONL)
- Reads valve settings (YAML)
- Reads weather load curve
- Calculates supply/return temperature difference
- Estimates branch resistance
- Calculates heat deficit
- Provides valve adjustment recommendations
- Handles sensor data gaps and valve out-of-bound anomalies

Usage:
    heat-balance --help
    heat-balance run --topology data/topology.csv --sensor data/sensor.jsonl \
        --valve data/valves.yaml --weather data/weather.csv --output reports/
"""

__version__ = "0.1.0"
