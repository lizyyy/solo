import tempfile
from pathlib import Path
import pytest

from rain_garden_checker.parsers.csv_parser import CSVParser
from rain_garden_checker.models.data_models import (
    WarningLevel,
    WarningType,
)


class TestCSVParser:
    def setup_method(self):
        self.parser = CSVParser()
        self.temp_dir = tempfile.mkdtemp()
        self.temp_path = Path(self.temp_dir)

    def test_parse_rainfall_valid(self):
        csv_content = """time,intensity
0,0
5,2
10,5
15,12
20,18
"""
        test_file = self.temp_path / "rainfall_test.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        series = self.parser.parse_rainfall_csv(
            test_file,
            name="test_rain",
            return_period=5.0,
        )

        assert series is not None
        assert series.name == "test_rain"
        assert series.return_period == 5.0
        assert len(series.data) == 5
        assert series.total_rainfall > 0
        assert series.peak_intensity == 18

    def test_parse_rainfall_with_missing_values(self):
        csv_content = """time,intensity
0,0
5,
10,5

20,18
"""
        test_file = self.temp_path / "rainfall_missing.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        series = self.parser.parse_rainfall_csv(
            test_file,
            name="test_missing",
            return_period=5.0,
        )

        missing_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.MISSING_DATA
        ]
        assert len(missing_warnings) > 0

    def test_parse_rainfall_with_negative_values(self):
        csv_content = """time,intensity
0,0
5,-5
10,5
"""
        test_file = self.temp_path / "rainfall_neg.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        series = self.parser.parse_rainfall_csv(
            test_file,
            name="test_neg",
            return_period=5.0,
        )

        assert series is None
        outlier_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.OUTLIER
        ]
        assert len(outlier_warnings) > 0

    def test_parse_soil_valid(self):
        csv_content = """soil_type,saturated_hydraulic_conductivity,initial_moisture,saturated_moisture,suction_head
sandy_loam,15,0.2,0.45,10
"""
        test_file = self.temp_path / "soil_test.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        soil = self.parser.parse_soil_test_csv(test_file, test_id="test_soil")

        assert soil is not None
        assert soil.soil_type == "sandy_loam"
        assert soil.saturated_hydraulic_conductivity == 15
        assert soil.initial_moisture == 0.2
        assert soil.saturated_moisture == 0.45

    def test_parse_soil_invalid_moisture(self):
        csv_content = """soil_type,saturated_hydraulic_conductivity,initial_moisture,saturated_moisture
sand,50,0.6,0.45
"""
        test_file = self.temp_path / "soil_invalid.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        soil = self.parser.parse_soil_test_csv(test_file, test_id="invalid_soil")

        assert soil is not None
        unreliable_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.SOIL_PARAMS_UNRELIABLE
        ]
        assert len(unreliable_warnings) > 0

    def test_parse_catchment_valid(self):
        csv_content = """name,area,runoff_coefficient,land_use_type,impervious_ratio
rooftop,500,0.85,building,0.95
lawn,1200,0.3,grass,0.1
"""
        test_file = self.temp_path / "catchment.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        catchments = self.parser.parse_catchment_csv(test_file)

        assert len(catchments) == 2
        assert catchments[0].name == "rooftop"
        assert catchments[0].area == 500
        assert catchments[0].runoff_coefficient == 0.85

    def test_parse_catchment_runoff_conflict(self):
        csv_content = """name,area,runoff_coefficient,impervious_ratio
parking,800,0.3,0.9
"""
        test_file = self.temp_path / "catchment_conflict.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        catchments = self.parser.parse_catchment_csv(test_file)

        assert len(catchments) == 1
        conflict_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.RUNOFF_COEFFICIENT_CONFLICT
        ]
        assert len(conflict_warnings) > 0

    def test_parse_pond_valid(self):
        csv_content = """name,surface_area,depth,underdrain_rate,shape_type
rain_garden_1,100,0.8,30,rectangular
"""
        test_file = self.temp_path / "pond.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        pond = self.parser.parse_pond_csv(test_file)

        assert pond is not None
        assert pond.name == "rain_garden_1"
        assert pond.surface_area == 100
        assert pond.depth == 0.8
        assert pond.storage_volume == 80

    def test_time_step_inconsistency_detection(self):
        csv_content = """time,intensity
0,0
5,2
12,5
15,12
25,18
"""
        test_file = self.temp_path / "rainfall_inconsistent.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        series = self.parser.parse_rainfall_csv(
            test_file,
            name="inconsistent",
            return_period=5.0,
        )

        assert series is not None
        timestep_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.TIMESTEP_INCONSISTENT
        ]
        assert len(timestep_warnings) > 0

    def test_outlier_detection(self):
        csv_content = """time,intensity
0,0
5,2
10,5
15,100
20,8
"""
        test_file = self.temp_path / "rainfall_outlier.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        series = self.parser.parse_rainfall_csv(
            test_file,
            name="outlier_test",
            return_period=5.0,
        )

        outlier_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.OUTLIER
        ]
        assert len(outlier_warnings) > 0

    def test_nonexistent_file(self):
        nonexistent = self.temp_path / "nonexistent.csv"

        series = self.parser.parse_rainfall_csv(
            nonexistent,
            name="nonexistent",
            return_period=5.0,
        )

        assert series is None
        missing_warnings = [
            w for w in self.parser.warnings
            if w.warning_type == WarningType.MISSING_DATA
        ]
        assert len(missing_warnings) > 0

    def test_empty_data(self):
        csv_content = """time,intensity
"""
        test_file = self.temp_path / "empty.csv"
        test_file.write_text(csv_content, encoding="utf-8")

        series = self.parser.parse_rainfall_csv(
            test_file,
            name="empty",
            return_period=5.0,
        )

        assert series is None
