"""Minimal tests for survey QC."""

import os
import tempfile
from pathlib import Path

from survey_qc.engine import SurveyQCEngine


def test_basic_parsing():
    sample = Path(__file__).parent.parent / "sample_data"
    photos_csv = sample / "photos.csv"
    rules_yaml = sample / "rules.yaml"
    assert photos_csv.exists()
    assert rules_yaml.exists()


def test_engine_initialization():
    sample = Path(__file__).parent.parent / "sample_data"
    engine = SurveyQCEngine(sample)
    assert engine.package_dir == sample


def test_empty_package_handling():
    with tempfile.TemporaryDirectory() as tmpdir:
        engine = SurveyQCEngine(tmpdir)
        engine.load_rules()
        assert engine.rules is not None


def test_cross_midnight_data_exists():
    sample = Path(__file__).parent.parent / "sample_data"
    photos_csv = sample / "photos_midnight.csv"
    exif_jsonl = sample / "exif_midnight.jsonl"
    assert photos_csv.exists()
    assert exif_jsonl.exists()


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
