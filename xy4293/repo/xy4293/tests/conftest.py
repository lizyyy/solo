#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
测试配置 - Test Configuration

提供pytest fixtures和共享测试数据。
"""

import pytest
import numpy as np
from pathlib import Path
import tempfile
import json
import csv

from pvchecker import (
    PVModule,
    RoofZone,
    InverterMPPT,
    StringConfig,
    RiskItem,
    AnalysisResult,
)


@pytest.fixture
def test_module() -> PVModule:
    """创建测试用光伏组件参数"""
    return PVModule(
        model="Test-JKM550N",
        p_max=550.0,
        v_mp=48.5,
        i_mp=11.34,
        voc=59.2,
        isc=12.0,
        temp_coeff_voc=-0.32,
        temp_coeff_isc=0.05,
        temp_coeff_pmax=-0.40,
        noct=45.0,
        area=2.58,
        efficiency=0.213,
    )


@pytest.fixture
def test_inverter() -> InverterMPPT:
    """创建测试用逆变器参数"""
    return InverterMPPT(
        inverter_model="Test-SUN-10K",
        mppt_id="mppt_1",
        v_min=200.0,
        v_max=1000.0,
        v_nom=600.0,
        p_max=10000.0,
        i_max=20.0,
        efficiency=0.98,
        v_start=250.0,
    )


@pytest.fixture
def test_roof_zones() -> list:
    """创建测试用屋面分区列表"""
    return [
        RoofZone(
            zone_id="zone_1",
            area=48.0,
            tilt=25.0,
            azimuth=0.0,
            module_count=24,
            shading_profile="standard",
            notes="屋面南坡-无遮挡区域",
        ),
        RoofZone(
            zone_id="zone_2",
            area=36.0,
            tilt=20.0,
            azimuth=-30.0,
            module_count=18,
            shading_profile="light_shading",
            notes="屋面西坡-上午有轻微遮挡",
        ),
    ]


@pytest.fixture
def test_shading_matrix() -> np.ndarray:
    """创建测试用遮挡系数矩阵 (12个月 x 24小时)"""
    matrix = np.ones((12, 24), dtype=float)
    
    for month in range(12):
        for hour in range(24):
            if hour < 6 or hour > 18:
                matrix[month, hour] = 0.0
            elif month in [0, 1, 10, 11]:
                if hour < 8 or hour > 16:
                    matrix[month, hour] = 0.5
            elif month in [5, 6, 7]:
                matrix[month, hour] = 0.95
    
    return matrix


@pytest.fixture
def temp_dir():
    """创建临时目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_roof_zones_csv(temp_dir: Path) -> Path:
    """创建示例屋面分区CSV文件"""
    filepath = temp_dir / "roof_zones.csv"
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['zone_id', 'area', 'tilt', 'azimuth', 'module_count', 'shading_profile', 'notes'])
        writer.writerow(['zone_1', '48.0', '25.0', '0.0', '24', 'standard', 'Test zone 1'])
        writer.writerow(['zone_2', '36.0', '20.0', '-30.0', '18', 'light_shading', 'Test zone 2'])
    return filepath


@pytest.fixture
def sample_module_json(temp_dir: Path) -> Path:
    """创建示例组件参数JSON文件"""
    filepath = temp_dir / "module_params.json"
    data = {
        "model": "Test-Module",
        "p_max": 550.0,
        "v_mp": 48.5,
        "i_mp": 11.34,
        "voc": 59.2,
        "isc": 12.0,
        "temp_coeff_voc": -0.32,
        "temp_coeff_isc": 0.05,
        "temp_coeff_pmax": -0.40,
        "noct": 45.0,
        "area": 2.58,
        "efficiency": 0.213
    }
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return filepath


@pytest.fixture
def sample_inverter_csv(temp_dir: Path) -> Path:
    """创建示例逆变器CSV文件"""
    filepath = temp_dir / "inverter_mppt.csv"
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['inverter_model', 'mppt_id', 'v_min', 'v_max', 'v_nom', 'p_max', 'i_max', 'efficiency', 'v_start'])
        writer.writerow(['Test-Inverter', 'mppt_1', '200.0', '1000.0', '600.0', '10000.0', '20.0', '0.98', '250.0'])
    return filepath


@pytest.fixture
def sample_shading_csv(temp_dir: Path) -> Path:
    """创建示例遮挡系数CSV文件"""
    filepath = temp_dir / "shading_coefficients.csv"
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        
        header = ['month'] + [f'hour_{h}' for h in range(24)]
        writer.writerow(header)
        
        for month in range(1, 13):
            row = [month]
            for hour in range(24):
                if 6 <= hour <= 18:
                    val = 0.9 if month in [6, 7, 8] else 0.8
                else:
                    val = 0.0
                row.append(str(val))
            writer.writerow(row)
    
    return filepath
