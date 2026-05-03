from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pytest
import yaml

from kiln_analyzer.models import PhaseType
from kiln_analyzer.parsers.csv_parser import ThermocoupleCSVParser
from kiln_analyzer.parsers.yaml_parser import TargetCurveYAMLParser
from kiln_analyzer.parsers.json_parser import KilnLoadJSONParser, DefectJSONParser


class TestThermocoupleCSVParser:
    def test_parse_valid_csv(self):
        with TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_data.csv"
            csv_content = """timestamp,elapsed_seconds,TC1,TC2,TC3
2026-05-03 08:00:00,0,25.0,25.0,25.0
2026-05-03 08:05:00,300,125.0,120.0,115.0
2026-05-03 08:10:00,600,228.0,220.0,210.0
"""
            csv_path.write_text(csv_content)

            parser = ThermocoupleCSVParser()
            data = parser.parse(csv_path)

            assert len(data) == 3
            assert data[0].elapsed_seconds == 0.0
            assert data[0].temperatures["TC1"] == 25.0
            assert data[1].temperatures["TC2"] == 120.0

    def test_validate_valid_data(self):
        parser = ThermocoupleCSVParser()

        from kiln_analyzer.models import ThermocoupleData
        valid_data = [
            ThermocoupleData(
                timestamp=datetime.now(),
                temperatures={"TC1": 25.0},
                elapsed_seconds=0.0,
            )
        ]

        assert parser.validate(valid_data) is True

    def test_validate_invalid_data(self):
        parser = ThermocoupleCSVParser()

        assert parser.validate([]) is False
        assert parser.validate("not a list") is False


class TestTargetCurveYAMLParser:
    def test_parse_valid_yaml(self):
        with TemporaryDirectory() as temp_dir:
            yaml_path = Path(temp_dir) / "test_curve.yaml"
            yaml_content = """
name: "测试曲线"
description: "测试用烧成曲线"
phases:
  - name: "低温升温"
    type: "heating"
    start_temp: 25
    end_temp: 600
    duration: "30m"
    rate: 19.2

  - name: "高温保温"
    type: "holding"
    start_temp: 1240
    end_temp: 1240
    duration: "1h"

  - name: "冷却阶段"
    type: "cooling"
    start_temp: 1240
    end_temp: 850
    duration: "2h"
"""
            yaml_path.write_text(yaml_content)

            parser = TargetCurveYAMLParser()
            curve = parser.parse(yaml_path)

            assert curve.name == "测试曲线"
            assert len(curve.phases) == 3
            assert curve.phases[0].phase_type == PhaseType.HEATING
            assert curve.phases[1].phase_type == PhaseType.HOLDING
            assert curve.phases[2].phase_type == PhaseType.COOLING

    def test_duration_parsing(self):
        parser = TargetCurveYAMLParser()

        assert parser._parse_duration_string("30m") == 1800.0
        assert parser._parse_duration_string("1h") == 3600.0
        assert parser._parse_duration_string("1.5h") == 5400.0
        assert parser._parse_duration_string("3600") == 3600.0

    def test_phase_type_parsing(self):
        parser = TargetCurveYAMLParser()

        assert parser._parse_phase_type("heating") == PhaseType.HEATING
        assert parser._parse_phase_type("升温") == PhaseType.HEATING
        assert parser._parse_phase_type("holding") == PhaseType.HOLDING
        assert parser._parse_phase_type("保温") == PhaseType.HOLDING
        assert parser._parse_phase_type("cooling") == PhaseType.COOLING
        assert parser._parse_phase_type("冷却") == PhaseType.COOLING


class TestKilnLoadJSONParser:
    def test_parse_valid_json(self):
        with TemporaryDirectory() as temp_dir:
            json_path = Path(temp_dir) / "test_load.json"
            json_content = """
{
  "batch_id": "TEST_001",
  "load_date": "2026-05-03T08:00:00",
  "kiln_model": "TEST-1200",
  "total_pieces": 10,
  "layers": [
    {
      "layer_name": "top",
      "position": "top",
      "load_type": "茶碗",
      "piece_count": 5
    },
    {
      "layer_name": "bottom",
      "position": "bottom",
      "load_type": "雕塑",
      "piece_count": 5
    }
  ]
}
"""
            json_path.write_text(json_content)

            parser = KilnLoadJSONParser()
            load = parser.parse(json_path)

            assert load.batch_id == "TEST_001"
            assert load.kiln_model == "TEST-1200"
            assert len(load.layers) == 2
            assert load.total_pieces == 10


class TestDefectJSONParser:
    def test_parse_valid_json(self):
        with TemporaryDirectory() as temp_dir:
            json_path = Path(temp_dir) / "test_defects.json"
            json_content = """
[
  {
    "batch_id": "TEST_001",
    "piece_id": "P001",
    "layer_name": "top",
    "defect_type": "釉裂",
    "severity": "轻微",
    "suspect_phase": "cooling"
  }
]
"""
            json_path.write_text(json_content)

            parser = DefectJSONParser()
            defects = parser.parse(json_path)

            assert len(defects) == 1
            assert defects[0].batch_id == "TEST_001"
            assert defects[0].defect_type == "釉裂"

    def test_parse_empty_file(self):
        with TemporaryDirectory() as temp_dir:
            json_path = Path(temp_dir) / "empty.json"
            json_path.write_text("[]")

            parser = DefectJSONParser()
            defects = parser.parse(json_path)

            assert len(defects) == 0
