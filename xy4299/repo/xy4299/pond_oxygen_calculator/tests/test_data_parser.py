import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import tempfile
import os

from ..data_parser import DataParser, DataValidationError


class TestDataParser:
    def setup_method(self):
        self.parser = DataParser()

    def test_generate_sample_data(self):
        df = DataParser.generate_sample_data(pond_count=2, hours=12)

        assert len(df) == 2 * 12
        assert df["pond_id"].nunique() == 2
        assert "timestamp" in df.columns
        assert "temperature" in df.columns
        assert "dissolved_oxygen" in df.columns
        assert "fish_density" in df.columns
        assert "feeding_rate" in df.columns
        assert "weather" in df.columns

    def test_parse_valid_csv(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=5)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            temp_path = f.name

        try:
            parsed_df = self.parser.parse_csv(temp_path)
            assert len(parsed_df) == 5
            assert "pond_id" in parsed_df.columns
        finally:
            os.unlink(temp_path)

    def test_missing_columns(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=5)
        df = df.drop(columns=["temperature"])

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            temp_path = f.name

        try:
            with pytest.raises(DataValidationError) as exc_info:
                self.parser.parse_csv(temp_path)
            assert any("Missing required columns" in err for err in exc_info.value.errors)
        finally:
            os.unlink(temp_path)

    def test_invalid_temperature_range(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=5)
        df.loc[0, "temperature"] = 50

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            temp_path = f.name

        try:
            with pytest.raises(DataValidationError) as exc_info:
                self.parser.parse_csv(temp_path)
            assert any("temperature" in err.lower() for err in exc_info.value.errors)
        finally:
            os.unlink(temp_path)

    def test_invalid_weather_type(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=5)
        df.loc[0, "weather"] = "invalid_type"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            temp_path = f.name

        try:
            with pytest.raises(DataValidationError) as exc_info:
                self.parser.parse_csv(temp_path)
            assert any("weather" in err.lower() for err in exc_info.value.errors)
        finally:
            os.unlink(temp_path)

    def test_interpolation_missing_values(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=10)

        df.loc[2, "dissolved_oxygen"] = None
        df.loc[3, "dissolved_oxygen"] = None
        df.loc[4, "temperature"] = None

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            temp_path = f.name

        try:
            parsed_df = self.parser.parse_csv(temp_path)

            assert not parsed_df["dissolved_oxygen"].isna().any()
            warnings = self.parser.get_warnings()
            assert any("missing values" in w.lower() for w in warnings)
        finally:
            os.unlink(temp_path)

    def test_valid_weather_types(self):
        valid_weather = ["sunny", "cloudy", "rainy", "stormy", "foggy"]

        for weather in valid_weather:
            df = DataParser.generate_sample_data(pond_count=1, hours=3)
            df["weather"] = weather

            with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
                df.to_csv(f.name, index=False)
                temp_path = f.name

            try:
                parsed_df = self.parser.parse_csv(temp_path)
                assert len(parsed_df) == 3
            finally:
                os.unlink(temp_path)

    def test_get_warnings(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=5)
        df["extra_column"] = "test_value"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            temp_path = f.name

        try:
            self.parser.parse_csv(temp_path)
            warnings = self.parser.get_warnings()
            assert any("unexpected columns" in w.lower() for w in warnings)
        finally:
            os.unlink(temp_path)
