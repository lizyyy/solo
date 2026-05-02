"""Pytest configuration and minimal tests"""

import os
import tempfile
from pathlib import Path

import pytest

from aqua_guard.data.importer import (
    load_water_quality_csv,
    load_feed_plan_yaml,
    load_weather_forecast_json,
    load_pond_thresholds,
    merge_pond_data,
)
from aqua_guard.sim.engine import simulate_24h
from aqua_guard.report.exporter import export_risk_report, export_adjusted_feed, export_alerts


SAMPLE_DIR = Path(__file__).parent.parent / 'sample_data'


class TestDataImport:
    def test_load_water_quality_csv(self):
        records = load_water_quality_csv(SAMPLE_DIR / 'water_quality.csv')
        assert len(records) > 0
        assert 'pond_id' in records[0]
        assert 'dissolved_oxygen' in records[0]

    def test_load_feed_plan_yaml(self):
        feed_plan = load_feed_plan_yaml(SAMPLE_DIR / 'feed_plan.yaml')
        assert 'Pond_A' in feed_plan or 'default' in feed_plan

    def test_load_weather_forecast_json(self):
        forecast = load_weather_forecast_json(SAMPLE_DIR / 'weather_forecast.json')
        assert 'forecast' in forecast
        assert len(forecast['forecast']) > 0

    def test_load_pond_thresholds(self):
        thresholds = load_pond_thresholds(SAMPLE_DIR / 'pond_thresholds.json')
        assert 'Pond_A' in thresholds
        assert 'do_min' in thresholds['Pond_A']

    def test_merge_pond_data(self):
        water_records = load_water_quality_csv(SAMPLE_DIR / 'water_quality.csv')
        feed_plan = load_feed_plan_yaml(SAMPLE_DIR / 'feed_plan.yaml')
        forecast = load_weather_forecast_json(SAMPLE_DIR / 'weather_forecast.json')
        thresholds = load_pond_thresholds(SAMPLE_DIR / 'pond_thresholds.json')

        merged = merge_pond_data(water_records, feed_plan, forecast, thresholds)
        assert 'ponds' in merged
        assert len(merged['ponds']) > 0


class TestSimulation:
    def test_simulate_24h(self):
        water_records = load_water_quality_csv(SAMPLE_DIR / 'water_quality.csv')
        feed_plan = load_feed_plan_yaml(SAMPLE_DIR / 'feed_plan.yaml')
        forecast = load_weather_forecast_json(SAMPLE_DIR / 'weather_forecast.json')
        thresholds = load_pond_thresholds(SAMPLE_DIR / 'pond_thresholds.json')

        merged = merge_pond_data(water_records, feed_plan, forecast, thresholds)
        sim = simulate_24h(merged)

        assert 'simulation_results' in sim
        assert 'start_time' in sim
        assert 'end_time' in sim

        for pond_id, result in sim['simulation_results'].items():
            assert 'hourly_results' in result
            assert len(result['hourly_results']) == 24


class TestExport:
    def test_export_all_reports(self):
        water_records = load_water_quality_csv(SAMPLE_DIR / 'water_quality.csv')
        feed_plan = load_feed_plan_yaml(SAMPLE_DIR / 'feed_plan.yaml')
        forecast = load_weather_forecast_json(SAMPLE_DIR / 'weather_forecast.json')
        thresholds = load_pond_thresholds(SAMPLE_DIR / 'pond_thresholds.json')

        merged = merge_pond_data(water_records, feed_plan, forecast, thresholds)
        sim = simulate_24h(merged)

        with tempfile.TemporaryDirectory() as tmpdir:
            risk_path = export_risk_report(sim, tmpdir)
            assert risk_path.exists()
            assert risk_path.name == 'risk_report.md'

            feed_path = export_adjusted_feed(sim, tmpdir)
            assert feed_path.exists()
            assert feed_path.name == 'adjusted_feed.csv'

            alerts_path = export_alerts(sim, tmpdir)
            assert alerts_path.exists()
            assert alerts_path.name == 'alerts.json'


class TestEdgeCases:
    def test_missing_sensor_value_handling(self):
        records = load_water_quality_csv(SAMPLE_DIR / 'water_quality.csv')
        for record in records:
            assert record.get('dissolved_oxygen') is None or isinstance(record.get('dissolved_oxygen'), (int, float))

    def test_duplicate_record_handling(self):
        records = load_water_quality_csv(SAMPLE_DIR / 'water_quality.csv')
        seen = set()
        for record in records:
            key = (record['timestamp'].isoformat(), record['pond_id'])
            assert key not in seen
            seen.add(key)
