import pytest
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

import pandas as pd
import numpy as np

from strain_calibrator.models import (
    ProjectConfig,
    Sensor,
    SensorType,
    Unit,
    CrossSection,
    Material,
)
from strain_calibrator.storage import ProjectStorage


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_sensors():
    return [
        Sensor(
            sensor_id="SG1",
            type=SensorType.STRAIN_GAUGE,
            name="上缘应变片",
            unit=Unit.MICROSTRAIN,
            location_y=0.25,
            temperature_compensation_sensor="T1",
        ),
        Sensor(
            sensor_id="SG2",
            type=SensorType.STRAIN_GAUGE,
            name="下缘应变片",
            unit=Unit.MICROSTRAIN,
            location_y=0.05,
            temperature_compensation_sensor="T1",
        ),
        Sensor(
            sensor_id="T1",
            type=SensorType.TEMPERATURE_SENSOR,
            name="温度传感器",
            unit=Unit.CELSIUS,
        ),
        Sensor(
            sensor_id="D1",
            type=SensorType.DISPLACEMENT_METER,
            name="位移计",
            unit=Unit.MILLIMETER,
        ),
    ]


@pytest.fixture
def sample_config(sample_sensors):
    return ProjectConfig(
        project_name="测试项目",
        project_id="test_001",
        description="pytest测试项目",
        sensors=sample_sensors,
        cross_section=CrossSection(width=0.15, height=0.3),
        material=Material(),
        default_sampling_rate=10.0,
    )


@pytest.fixture
def sample_dataframe():
    n_points = 100
    start_time = datetime(2024, 5, 1, 9, 0, 0)
    times = [start_time + timedelta(seconds=i * 0.1) for i in range(n_points)]

    data = {
        "SG1": np.sin(np.linspace(0, 4 * np.pi, n_points)) * 500 + 10,
        "SG2": -np.sin(np.linspace(0, 4 * np.pi, n_points)) * 300 + 5,
        "T1": np.full(n_points, 22.5),
        "D1": np.linspace(0, 20, n_points),
    }

    df = pd.DataFrame(data, index=times)
    return df


@pytest.fixture
def project_storage(temp_dir):
    return ProjectStorage(temp_dir)
