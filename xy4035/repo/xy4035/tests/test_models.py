import pytest
from datetime import datetime

from strain_calibrator.models import (
    Sensor,
    SensorType,
    Unit,
    CrossSection,
    Material,
    ProjectConfig,
    SensorType,
)


class TestSensor:
    def test_sensor_creation(self):
        sensor = Sensor(
            sensor_id="SG1",
            type=SensorType.STRAIN_GAUGE,
            name="上缘应变片",
            unit=Unit.MICROSTRAIN,
            location_y=0.25,
            temperature_compensation_sensor="T1",
        )
        assert sensor.sensor_id == "SG1"
        assert sensor.type == SensorType.STRAIN_GAUGE
        assert sensor.unit == Unit.MICROSTRAIN
        assert sensor.location_y == 0.25

    def test_sensor_default_values(self):
        sensor = Sensor(
            sensor_id="D1",
            type=SensorType.DISPLACEMENT_METER,
            unit=Unit.MILLIMETER,
        )
        assert sensor.name is None
        assert sensor.location_y is None
        assert sensor.temperature_compensation_sensor is None
        assert sensor.gain == 1.0
        assert sensor.offset == 0.0


class TestCrossSection:
    def test_cross_section_creation(self):
        section = CrossSection(
            width=0.15,
            height=0.3,
            neutral_axis_y=0.15,
        )
        assert section.width == 0.15
        assert section.height == 0.3
        assert section.neutral_axis_y == 0.15

    def test_cross_section_auto_area(self):
        section = CrossSection(
            width=0.15,
            height=0.3,
        )
        assert section.area == 0.15 * 0.3


class TestMaterial:
    def test_material_creation(self):
        material = Material(
            name="Q345钢",
            elastic_modulus=2.06e11,
            poisson_ratio=0.3,
            thermal_expansion_coefficient=1.2e-5,
        )
        assert material.name == "Q345钢"
        assert material.elastic_modulus == 2.06e11

    def test_material_defaults(self):
        material = Material()
        assert material.name == "Steel"
        assert material.elastic_modulus == 2.06e11


class TestProjectConfig:
    def test_project_config_creation(self):
        sensors = [
            Sensor(
                sensor_id="SG1",
                type=SensorType.STRAIN_GAUGE,
                unit=Unit.MICROSTRAIN,
            )
        ]
        section = CrossSection(width=0.15, height=0.3)
        material = Material()

        config = ProjectConfig(
            project_name="测试项目",
            project_id="test_001",
            description="这是一个测试项目",
            sensors=sensors,
            cross_section=section,
            material=material,
            default_sampling_rate=10.0,
        )

        assert config.project_name == "测试项目"
        assert config.project_id == "test_001"
        assert len(config.sensors) == 1
        assert config.default_sampling_rate == 10.0

    def test_project_config_default_thresholds(self):
        config = ProjectConfig(
            project_name="测试项目",
            project_id="test_001",
        )
        assert config.thresholds["max_strain"] == 2000.0
        assert config.thresholds["max_displacement"] == 100.0
