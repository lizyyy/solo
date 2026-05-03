"""测试配置和fixtures。"""

import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

import pytest

from fits_quality_checker.models.models import (
    ObservationConfig,
    FITSMetadata,
    FileType,
    FileStatus,
)


@pytest.fixture
def temp_workspace() -> Path:
    """创建临时工作空间。"""
    temp_dir = tempfile.mkdtemp(prefix="fitsqc_test_")
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def sample_config() -> ObservationConfig:
    """创建示例观测配置。"""
    return ObservationConfig(
        config_name="test_config",
        observer="Test Observer",
        telescope="Test Telescope",
        camera="Test Camera",
        focal_length=2000.0,
        aperture=203.0,
        pixel_size=3.76,
        target_name="M42",
        expected_exposures={"L": 10, "R": 5, "G": 5, "B": 5},
        expected_temperature=-10.0,
        temperature_tolerance=0.5,
        fwhm_threshold=3.0,
        roundness_threshold=0.8,
        noise_threshold=10.0,
    )


@pytest.fixture
def sample_light_metadata() -> FITSMetadata:
    """创建示例光场元数据。"""
    return FITSMetadata(
        file_path="/data/light_0001.fits",
        file_name="light_0001.fits",
        file_type=FileType.LIGHT,
        exposure_time=300.0,
        filter_name="L",
        temperature=-10.0,
        gain=100.0,
        offset=50.0,
        airmass=1.2,
        observation_time=datetime(2024, 5, 3, 2, 30, 0),
        object_name="M42",
        x_pixel_size=3.76,
        y_pixel_size=3.76,
        x_bin=1,
        y_bin=1,
        header={
            "EXPTIME": 300.0,
            "FILTER": "L",
            "TEMP": -10.0,
            "GAIN": 100.0,
            "OFFSET": 50.0,
            "AIRMASS": 1.2,
            "DATE-OBS": "2024-05-03T02:30:00",
            "OBJECT": "M42",
        },
    )


@pytest.fixture
def sample_dark_metadata() -> FITSMetadata:
    """创建示例暗场元数据。"""
    return FITSMetadata(
        file_path="/data/dark_300s_0001.fits",
        file_name="dark_300s_0001.fits",
        file_type=FileType.DARK,
        exposure_time=300.0,
        filter_name="Dark",
        temperature=-10.0,
        gain=100.0,
        offset=50.0,
        observation_time=datetime(2024, 5, 3, 1, 0, 0),
        x_pixel_size=3.76,
        y_pixel_size=3.76,
        x_bin=1,
        y_bin=1,
        header={
            "EXPTIME": 300.0,
            "FILTER": "Dark",
            "TEMP": -10.0,
            "GAIN": 100.0,
            "OFFSET": 50.0,
            "DATE-OBS": "2024-05-03T01:00:00",
        },
    )


@pytest.fixture
def sample_flat_metadata() -> FITSMetadata:
    """创建示例平场元数据。"""
    return FITSMetadata(
        file_path="/data/flat_L_0001.fits",
        file_name="flat_L_0001.fits",
        file_type=FileType.FLAT,
        exposure_time=1.0,
        filter_name="L",
        temperature=20.0,
        gain=100.0,
        offset=50.0,
        observation_time=datetime(2024, 5, 3, 0, 30, 0),
        x_pixel_size=3.76,
        y_pixel_size=3.76,
        x_bin=1,
        y_bin=1,
        header={
            "EXPTIME": 1.0,
            "FILTER": "L",
            "GAIN": 100.0,
            "OFFSET": 50.0,
            "DATE-OBS": "2024-05-03T00:30:00",
        },
    )


@pytest.fixture
def sample_metadata_batch() -> List[FITSMetadata]:
    """创建一批示例元数据。"""
    metadatas: List[FITSMetadata] = []

    for i in range(10):
        metadatas.append(FITSMetadata(
            file_path=f"/data/light_L_{i+1:04d}.fits",
            file_name=f"light_L_{i+1:04d}.fits",
            file_type=FileType.LIGHT,
            exposure_time=300.0,
            filter_name="L",
            temperature=-10.0 + (i - 5) * 0.1,
            gain=100.0,
            offset=50.0,
            airmass=1.0 + i * 0.05,
            observation_time=datetime(2024, 5, 3, 2, 30, 0 + i * 6),
            object_name="M42",
            x_pixel_size=3.76,
            y_pixel_size=3.76,
            x_bin=1,
            y_bin=1,
            header={},
        ))

    for i in range(5):
        metadatas.append(FITSMetadata(
            file_path=f"/data/dark_300s_{i+1:04d}.fits",
            file_name=f"dark_300s_{i+1:04d}.fits",
            file_type=FileType.DARK,
            exposure_time=300.0,
            filter_name="Dark",
            temperature=-10.0,
            gain=100.0,
            offset=50.0,
            observation_time=datetime(2024, 5, 3, 1, 0, 0 + i * 12),
            x_pixel_size=3.76,
            y_pixel_size=3.76,
            x_bin=1,
            y_bin=1,
            header={},
        ))

    for i in range(3):
        metadatas.append(FITSMetadata(
            file_path=f"/data/flat_L_{i+1:04d}.fits",
            file_name=f"flat_L_{i+1:04d}.fits",
            file_type=FileType.FLAT,
            exposure_time=1.0,
            filter_name="L",
            temperature=20.0,
            gain=100.0,
            offset=50.0,
            observation_time=datetime(2024, 5, 3, 0, 30, 0 + i * 10),
            x_pixel_size=3.76,
            y_pixel_size=3.76,
            x_bin=1,
            y_bin=1,
            header={},
        ))

    return metadatas
