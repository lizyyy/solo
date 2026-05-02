import pytest
import tempfile
import csv
import json
from pathlib import Path


def test_warehouse_parser():
    from fumigation_analyzer.parser import WarehouseParser, ValidationError

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("warehouse_id,name,volume_m3,ventilation_rate\n")
        f.write("SILO-A,1号筒仓,1500.0,300.0\n")
        f.write("SILO-B,2号筒仓,1200.0,250.0\n")
        path = f.name

    parser = WarehouseParser(path)
    warehouses = parser.parse()
    assert len(warehouses) == 2
    assert warehouses[0]["warehouse_id"] == "SILO-A"
    assert warehouses[0]["volume_m3"] == 1500.0
    Path(path).unlink()


def test_warehouse_parser_invalid():
    from fumigation_analyzer.parser import WarehouseParser, ValidationError

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("warehouse_id,name\n")
        f.write("SILO-A,1号筒仓\n")
        path = f.name

    parser = WarehouseParser(path)
    with pytest.raises(ValidationError):
        parser.parse()
    Path(path).unlink()


def test_sensor_parser():
    from fumigation_analyzer.parser import SensorParser

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write('{"timestamp": "2025-05-01 08:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 850.0}\n')
        f.write('{"timestamp": "2025-05-01 08:30:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 780.0}\n')
        path = f.name

    parser = SensorParser(path)
    records = parser.parse()
    assert len(records) == 2
    assert records[0]["concentration_ppm"] == 850.0
    Path(path).unlink()


def test_sensor_parser_out_of_order():
    from fumigation_analyzer.parser import SensorParser

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write('{"timestamp": "2025-05-01 09:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 720.0}\n')
        f.write('{"timestamp": "2025-05-01 08:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 850.0}\n')
        path = f.name

    parser = SensorParser(path)
    records = parser.parse()
    assert records[0]["timestamp"] == "2025-05-01 08:00:00"
    assert records[1]["timestamp"] == "2025-05-01 09:00:00"
    Path(path).unlink()


def test_ventilation_parser():
    from fumigation_analyzer.parser import VentilationParser

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("warehouse_id,vent_id,start_time,end_time,flow_rate_m3h\n")
        f.write("SILO-A,VENT-A1,2025-05-01 08:00:00,2025-05-01 12:00:00,150.0\n")
        path = f.name

    parser = VentilationParser(path)
    records = parser.parse()
    assert len(records) == 1
    assert records[0]["flow_rate_m3h"] == 150.0
    Path(path).unlink()


def test_rules_parser():
    from fumigation_analyzer.parser import RulesParser
    import yaml

    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump({
            "rules": [
                {
                    "name": "test_rule",
                    "priority": 10,
                    "condition": "concentration_below",
                    "params": {"threshold_ppm": 100},
                    "action": "safe_to_enter"
                }
            ]
        }, f)
        path = f.name

    parser = RulesParser(path)
    rules = parser.parse()
    assert len(rules["rules"]) == 1
    assert rules["rules"][0]["name"] == "test_rule"
    Path(path).unlink()


def test_decay_model():
    from fumigation_analyzer.model import DecayModel

    warehouses = [{"warehouse_id": "SILO-A", "name": "1号", "volume_m3": 1500.0, "ventilation_rate": 300.0}]
    sensor_data = [
        {"timestamp": "2025-05-01 08:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 850.0},
        {"timestamp": "2025-05-01 09:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 780.0},
    ]

    model = DecayModel(warehouses, sensor_data, timezone="UTC")
    timeline = model.build_timeline()
    assert len(timeline) == 2
    assert timeline[0]["concentration_ppm"] == 850.0


def test_ventilation_model_annotate():
    from fumigation_analyzer.model import DecayModel, VentilationModel

    warehouses = [{"warehouse_id": "SILO-A", "name": "1号", "volume_m3": 1500.0, "ventilation_rate": 300.0}]
    sensor_data = [
        {"timestamp": "2025-05-01 08:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 850.0},
    ]
    vent_records = [
        {"warehouse_id": "SILO-A", "vent_id": "VENT-A1", "start_time": "2025-05-01 07:00:00", "end_time": "2025-05-01 13:00:00", "flow_rate_m3h": 150.0},
    ]

    decay_model = DecayModel(warehouses, sensor_data, timezone="UTC")
    timeline = decay_model.build_timeline()

    vent_model = VentilationModel(vent_records, timezone="UTC")
    vent_model.annotate_timeline(timeline)

    assert timeline[0]["ventilation_active"] is True
    assert timeline[0]["total_vent_flow_m3h"] == 150.0


def test_risk_engine_evaluate():
    from fumigation_analyzer.engine import RiskEngine
    from datetime import datetime
    from zoneinfo import ZoneInfo

    rules = {
        "rules": [
            {
                "name": "danger_critical",
                "priority": 100,
                "risk_level": "critical",
                "condition": "concentration_above",
                "params": {"threshold_ppm": 500},
                "action": "do_not_enter"
            },
            {
                "name": "safe_below_100_vent",
                "priority": 30,
                "risk_level": "safe",
                "condition": "combined",
                "params": {
                    "operator": "and",
                    "conditions": [
                        {"type": "concentration_below", "threshold_ppm": 100},
                        {"type": "ventilation_active"}
                    ]
                },
                "action": "safe_to_enter"
            }
        ]
    }

    timeline = [
        {
            "timestamp": datetime(2025, 5, 1, 10, 0, 0, tzinfo=ZoneInfo("UTC")),
            "warehouse_id": "SILO-A",
            "sensor_id": "S-A-01",
            "event_type": "sensor_reading",
            "concentration_ppm": 850.0,
            "ventilation_active": True,
        },
        {
            "timestamp": datetime(2025, 5, 1, 22, 0, 0, tzinfo=ZoneInfo("UTC")),
            "warehouse_id": "SILO-A",
            "sensor_id": "S-A-01",
            "event_type": "sensor_reading",
            "concentration_ppm": 80.0,
            "ventilation_active": True,
        },
    ]

    engine = RiskEngine(rules, timezone="UTC")
    risk_events = engine.evaluate(timeline)
    assert len(risk_events) == 2


def test_export_csv(tmp_path):
    from fumigation_analyzer.export import CSVExporter
    from datetime import datetime
    from zoneinfo import ZoneInfo

    risk_events = [
        {
            "timestamp": datetime(2025, 5, 1, 10, 0, 0, tzinfo=ZoneInfo("UTC")),
            "warehouse_id": "SILO-A",
            "sensor_id": "S-A-01",
            "concentration_ppm": 850.0,
            "risk_level": "critical",
            "action": "do_not_enter",
            "message": "test",
            "ventilation_active": True,
        }
    ]

    csv_path = tmp_path / "risk_events.csv"
    exporter = CSVExporter(csv_path)
    exporter.export(risk_events)

    content = csv_path.read_text()
    assert "timestamp" in content
    assert "SILO-A" in content


def test_export_html(tmp_path):
    from fumigation_analyzer.export import HTMLExporter
    from datetime import datetime
    from zoneinfo import ZoneInfo

    timeline = [
        {
            "timestamp": datetime(2025, 5, 1, 10, 0, 0, tzinfo=ZoneInfo("UTC")),
            "warehouse_id": "SILO-A",
            "sensor_id": "S-A-01",
            "event_type": "sensor_reading",
            "concentration_ppm": 850.0,
            "ventilation_active": True,
        }
    ]

    html_path = tmp_path / "timeline.html"
    exporter = HTMLExporter(html_path)
    exporter.export(timeline, [], [])

    content = html_path.read_text()
    assert "<html" in content
    assert "筒仓熏蒸" in content
