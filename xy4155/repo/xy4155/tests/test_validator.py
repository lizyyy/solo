import os
import tempfile
import pytest
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock

import pandas as pd

from lens_inspector.validator import (
    DataValidator,
    ValidationError,
    SUPPORTED_IMAGE_FORMATS,
)


class TestDataValidator:
    def test_extract_lens_id_from_filename(self):
        test_cases = [
            ("LENS-001_test.jpg", "001"),
            ("LENS123456_image.png", "123456"),
            ("lens_789012_01.jpg", "789012"),
            ("123456-sample.tiff", "123456"),
            ("ABC12345_test.jpg", "ABC12345"),
        ]

        for filename, expected in test_cases:
            result = DataValidator.extract_lens_id_from_filename(filename)
            assert result == expected, f"Failed for {filename}"

    def test_group_images_by_lens(self):
        from pathlib import Path

        test_files = [
            Path("/test/LENS-001_1.jpg"),
            Path("/test/LENS-001_2.jpg"),
            Path("/test/LENS-002_1.jpg"),
            Path("/test/LENS-002_2.jpg"),
            Path("/test/unknown_image.png"),
        ]

        grouped = DataValidator.group_images_by_lens(test_files)

        assert "001" in grouped
        assert "002" in grouped
        assert len(grouped["001"]) == 2
        assert len(grouped["002"]) == 2

    def test_validate_notes_csv_with_valid_data(self, tmp_path):
        csv_content = """lens_id,body_id,notes,inspector
LENS-001,BODY-A01,测试备注1,张工
LENS-002,BODY-A02,测试备注2,李工
"""

        csv_path = tmp_path / "test_notes.csv"
        csv_path.write_text(csv_content)

        df, errors = DataValidator.validate_notes_csv(str(csv_path))

        assert len(df) == 2
        assert "lens_id" in df.columns
        assert len(errors) == 0

    def test_validate_notes_csv_missing_lens_id(self, tmp_path):
        csv_content = """body_id,notes
BODY-A01,测试备注
"""

        csv_path = tmp_path / "test_notes.csv"
        csv_path.write_text(csv_content)

        with pytest.raises(ValidationError):
            DataValidator.validate_notes_csv(str(csv_path))

    def test_validate_notes_csv_duplicate_lens_id(self, tmp_path):
        csv_content = """lens_id,body_id,notes
LENS-001,BODY-A01,备注1
LENS-001,BODY-A02,备注2
"""

        csv_path = tmp_path / "test_notes.csv"
        csv_path.write_text(csv_content)

        df, errors = DataValidator.validate_notes_csv(str(csv_path))
        assert len(errors) > 0

    def test_parse_lens_notes(self):
        data = {
            "lens_id": ["LENS-001", "LENS-002"],
            "body_id": ["BODY-A01", "BODY-A02"],
            "notes": ["备注1", "备注2"],
            "inspector": ["张工", "李工"],
        }
        df = pd.DataFrame(data)

        notes_dict = DataValidator.parse_lens_notes(df)

        assert "LENS-001" in notes_dict
        assert "LENS-002" in notes_dict
        assert notes_dict["LENS-001"].body_id == "BODY-A01"
        assert notes_dict["LENS-001"].notes == "备注1"
        assert notes_dict["LENS-001"].inspector == "张工"

    def test_parse_lens_notes_with_extra_metadata(self):
        data = {
            "lens_id": ["LENS-001"],
            "body_id": ["BODY-A01"],
            "notes": ["备注"],
            "custom_field": ["custom_value"],
        }
        df = pd.DataFrame(data)

        notes_dict = DataValidator.parse_lens_notes(df)

        assert "custom_field" in notes_dict["LENS-001"].metadata
        assert notes_dict["LENS-001"].metadata["custom_field"] == "custom_value"

    def test_validate_image_directory_not_exists(self):
        with pytest.raises(ValidationError):
            DataValidator.validate_image_directory("/nonexistent/directory")

    def test_validate_image_directory_is_file(self, tmp_path):
        test_file = tmp_path / "not_a_directory.txt"
        test_file.write_text("content")

        with pytest.raises(ValidationError):
            DataValidator.validate_image_directory(str(test_file))

    def test_supported_image_formats(self):
        expected = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}
        assert SUPPORTED_IMAGE_FORMATS == expected
