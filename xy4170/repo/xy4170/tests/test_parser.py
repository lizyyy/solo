"""测试曲线解析模块"""

import pytest
import csv
import json
from pathlib import Path
from datetime import datetime, timedelta
from tempfile import TemporaryDirectory

from kiln_curve_validator.parser import (
    CSVParser,
    PlanCurveParser,
    ConfigurationLoader,
)
from kiln_curve_validator.models import (
    KilnParameters,
    FiringRecipe,
    FiringType,
    BodyProperties,
    GlazeProperties,
    CurveSegment,
    SegmentType,
    PlannedCurve,
)


class TestCSVParser:
    """测试CSV温度记录解析器"""

    @pytest.fixture
    def sample_csv_file(self):
        """创建临时CSV测试文件"""
        with TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "test_temp.csv"

            start_time = datetime(2026, 5, 2, 9, 0, 0)

            with open(csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["时间", "温度(°C)", "传感器"])

                for i in range(10):
                    time_str = (start_time + timedelta(minutes=i * 5)).strftime("%Y-%m-%d %H:%M:%S")
                    temp = 25.0 + i * 20.0
                    writer.writerow([time_str, f"{temp:.1f}", "0"])

            yield csv_path

    def test_parse_valid_csv(self, sample_csv_file):
        """测试解析有效CSV"""
        parser = CSVParser()
        curve = parser.parse_file(sample_csv_file, kiln_name="测试窑炉")

        assert len(curve.data_points) == 10
        assert curve.kiln_name == "测试窑炉"
        assert curve.get_duration_minutes() == 45.0

    def test_temperature_range(self, sample_csv_file):
        """测试温度范围"""
        parser = CSVParser()
        curve = parser.parse_file(sample_csv_file)

        temps = curve.get_temperatures_array()
        assert min(temps) == 25.0
        assert max(temps) == 205.0

    def test_sampling_interval(self, sample_csv_file):
        """测试采样间隔计算"""
        parser = CSVParser()
        curve = parser.parse_file(sample_csv_file)

        assert curve.sampling_interval == pytest.approx(5.0, rel=1e-3)

    def test_invalid_file(self):
        """测试无效文件"""
        parser = CSVParser()

        with pytest.raises(FileNotFoundError):
            parser.parse_file(Path("nonexistent.csv"))

    def test_detect_delimiter(self):
        """测试分隔符检测"""
        parser = CSVParser()

        comma_lines = ["时间,温度,传感器", "2026-05-02,25.0,0"]
        assert parser._detect_delimiter(comma_lines) == ','

        semicolon_lines = ["时间;温度;传感器", "2026-05-02;25.0;0"]
        assert parser._detect_delimiter(semicolon_lines) == ';'

    def test_time_parsing(self):
        """测试时间解析"""
        parser = CSVParser()

        time1 = parser._parse_time("2026-05-02 09:30:00")
        assert isinstance(time1, datetime)

        time2 = parser._parse_time("09:30:00")
        assert isinstance(time2, datetime)

    def test_valid_temperature(self):
        """测试温度有效性检查"""
        parser = CSVParser()

        assert parser._is_valid_temperature(25.0) is True
        assert parser._is_valid_temperature(1300.0) is True
        assert parser._is_valid_temperature(-100.0) is False
        assert parser._is_valid_temperature(2000.0) is False


class TestPlanCurveParser:
    """测试计划曲线解析器"""

    @pytest.fixture
    def sample_planned_curve_json(self):
        """创建临时计划曲线JSON"""
        with TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "test_plan.json"

            data = {
                "recipe_name": "测试配方",
                "kiln_name": "测试窑炉",
                "preheat_included": True,
                "segments": [
                    {
                        "segment_type": "ramp",
                        "start_temp": 25.0,
                        "end_temp": 200.0,
                        "duration": 70.0,
                    },
                    {
                        "segment_type": "hold",
                        "start_temp": 1240.0,
                        "end_temp": 1240.0,
                        "duration": 30.0,
                    },
                ]
            }

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)

            yield json_path

    def test_parse_json_file(self, sample_planned_curve_json):
        """测试解析JSON文件"""
        parser = PlanCurveParser()
        curve = parser.parse_json_file(sample_planned_curve_json)

        assert curve.recipe_name == "测试配方"
        assert curve.kiln_name == "测试窑炉"
        assert len(curve.segments) == 2
        assert curve.segments[0].segment_type == SegmentType.RAMP
        assert curve.segments[1].segment_type == SegmentType.HOLD

    def test_generate_default_curve(self):
        """测试生成默认曲线"""
        parser = PlanCurveParser()

        kiln = KilnParameters(
            name="测试窑炉",
            max_temperature=1320.0,
            chamber_volume=60.0,
            power_rating=6.0,
            thermal_inertia_factor=2.5,
            max_heating_rate=8.0,
            max_cooling_rate=5.0,
            sensor_accuracy=2.0,
        )

        body = BodyProperties(
            name="测试泥料",
            thickness_range=[0.5, 3.0],
            thermal_conductivity=1.0,
            porosity=0.3,
            recommended_bisque_temp=1000.0,
            critical_cooling_rate=3.0,
        )

        glaze = GlazeProperties(
            name="测试釉料",
            maturing_temp_range=[1220.0, 1260.0],
            hold_time_recommended=30.0,
            expansion_coefficient=5.0,
            is_matte=False,
        )

        recipe = FiringRecipe(
            name="釉烧测试",
            firing_type=FiringType.GLAZE,
            target_temperature=1240.0,
            total_thickness=1.5,
            body=body,
            glaze=glaze,
        )

        curve = parser.generate_default_curve(recipe, kiln)

        assert len(curve.segments) > 0
        assert curve.get_peak_temperature() >= 1240.0

        has_ramp = any(s.segment_type == SegmentType.RAMP for s in curve.segments)
        has_hold = any(s.segment_type == SegmentType.HOLD for s in curve.segments)
        has_cool = any(s.segment_type == SegmentType.COOL for s in curve.segments)

        assert has_ramp is True
        assert has_hold is True


class TestConfigurationLoader:
    """测试配置加载器"""

    @pytest.fixture
    def sample_kiln_json(self):
        """创建临时窑炉配置"""
        with TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "kiln.json"

            data = {
                "name": "测试窑炉",
                "max_temperature": 1320.0,
                "chamber_volume": 60.0,
                "power_rating": 6.0,
                "thermal_inertia_factor": 2.5,
                "max_heating_rate": 8.0,
                "max_cooling_rate": 5.0,
                "sensor_accuracy": 2.0,
                "heating_elements_count": 4
            }

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)

            yield json_path

    @pytest.fixture
    def sample_recipe_json(self):
        """创建临时配方配置"""
        with TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "recipe.json"

            data = {
                "name": "测试配方",
                "firing_type": "glaze",
                "target_temperature": 1240.0,
                "total_thickness": 1.5,
                "max_allowed_heating_rate": 4.0,
                "body": {
                    "name": "测试泥料",
                    "thickness_range": [0.5, 3.0],
                    "thermal_conductivity": 1.0,
                    "porosity": 0.3,
                    "recommended_bisque_temp": 1000.0,
                    "critical_cooling_rate": 3.0
                },
                "glaze": {
                    "name": "测试釉料",
                    "maturing_temp_range": [1220.0, 1260.0],
                    "hold_time_recommended": 30.0,
                    "expansion_coefficient": 5.0,
                    "is_matte": False
                }
            }

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)

            yield json_path

    def test_load_kiln_parameters(self, sample_kiln_json):
        """测试加载窑炉参数"""
        kiln = ConfigurationLoader.load_kiln_parameters(sample_kiln_json)

        assert kiln.name == "测试窑炉"
        assert kiln.max_temperature == 1320.0
        assert kiln.chamber_volume == 60.0
        assert kiln.thermal_inertia_factor == 2.5

    def test_load_recipe(self, sample_recipe_json):
        """测试加载配方"""
        recipe = ConfigurationLoader.load_recipe(sample_recipe_json)

        assert recipe.name == "测试配方"
        assert recipe.firing_type == FiringType.GLAZE
        assert recipe.target_temperature == 1240.0
        assert recipe.total_thickness == 1.5
        assert recipe.body is not None
        assert recipe.glaze is not None

    def test_load_recipe_without_glaze(self):
        """测试加载素烧配方（无釉料）"""
        with TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "bisque_recipe.json"

            data = {
                "name": "素烧配方",
                "firing_type": "bisque",
                "target_temperature": 980.0,
                "total_thickness": 1.2,
                "body": {
                    "name": "测试泥料",
                    "thickness_range": [0.5, 3.0],
                    "thermal_conductivity": 1.0,
                    "porosity": 0.3,
                    "recommended_bisque_temp": 980.0,
                    "critical_cooling_rate": 3.0
                },
                "glaze": None
            }

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)

            recipe = ConfigurationLoader.load_recipe(json_path)

            assert recipe.firing_type == FiringType.BISQUE
            assert recipe.glaze is None
