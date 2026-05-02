import pytest
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import os

from yaw_checker.parsers import (
    parse_turbine_csv,
    parse_scada_10min_csv,
    parse_wind_rules_yaml,
    load_all_data,
    _normalize_angles
)


class TestParseTurbineCsv:
    """测试 turbine.csv 解析"""

    def test_basic_parsing(self, tmp_path):
        """基本解析测试"""
        csv_content = """turbine_id,rated_power,installation_date,nacelle_direction_offset
WTG01,2000,2020-01-15,0.0
WTG02,2500,2021-03-20,2.5"""
        
        csv_file = tmp_path / "turbine.csv"
        csv_file.write_text(csv_content)
        
        df = parse_turbine_csv(csv_file)
        
        assert len(df) == 2
        assert df["turbine_id"].iloc[0] == "WTG01"
        assert df["rated_power"].iloc[0] == 2000.0
        assert df["nacelle_direction_offset"].iloc[1] == 2.5

    def test_missing_nacelle_offset(self, tmp_path):
        """测试缺少 nacelle_direction_offset 列"""
        csv_content = """turbine_id,rated_power
WTG01,2000
WTG02,2500"""
        
        csv_file = tmp_path / "turbine.csv"
        csv_file.write_text(csv_content)
        
        df = parse_turbine_csv(csv_file)
        
        assert "nacelle_direction_offset" in df.columns
        assert df["nacelle_direction_offset"].iloc[0] == 0.0

    def test_missing_required_columns(self, tmp_path):
        """测试缺少必要列"""
        csv_content = """turbine_id
WTG01"""
        
        csv_file = tmp_path / "turbine.csv"
        csv_file.write_text(csv_content)
        
        with pytest.raises(ValueError, match="缺少必要列"):
            parse_turbine_csv(csv_file)


class TestParseScada10minCsv:
    """测试 SCADA 数据解析"""

    def test_basic_parsing(self, tmp_path):
        """基本解析测试"""
        csv_content = """turbine_id,timestamp,wind_direction,nacelle_angle,active_power,wind_speed
WTG01,2026-05-01 00:00:00,275.0,270.0,1250.0,8.5
WTG01,2026-05-01 00:10:00,276.5,271.5,1320.0,8.8"""
        
        csv_file = tmp_path / "scada.csv"
        csv_file.write_text(csv_content)
        
        df = parse_scada_10min_csv(csv_file)
        
        assert len(df) == 2
        assert df["turbine_id"].iloc[0] == "WTG01"
        assert pd.to_datetime("2026-05-01 00:00:00") == df["timestamp"].iloc[0]
        assert df["wind_direction"].iloc[0] == 275.0

    def test_angle_normalization(self, tmp_path):
        """测试角度标准化"""
        csv_content = """turbine_id,timestamp,wind_direction,nacelle_angle,active_power,wind_speed
WTG01,2026-05-01 00:00:00,370.0,-10.0,1250.0,8.5
WTG01,2026-05-01 00:10:00,400.0,720.0,1320.0,8.8"""
        
        csv_file = tmp_path / "scada.csv"
        csv_file.write_text(csv_content)
        
        df = parse_scada_10min_csv(csv_file)
        
        assert df["wind_direction"].iloc[0] == 10.0
        assert df["nacelle_angle"].iloc[0] == 350.0
        assert df["wind_direction"].iloc[1] == 40.0
        assert df["nacelle_angle"].iloc[1] == 0.0

    def test_missing_required_columns(self, tmp_path):
        """测试缺少必要列"""
        csv_content = """turbine_id,timestamp
WTG01,2026-05-01 00:00:00"""
        
        csv_file = tmp_path / "scada.csv"
        csv_file.write_text(csv_content)
        
        with pytest.raises(ValueError, match="缺少必要列"):
            parse_scada_10min_csv(csv_file)

    def test_invalid_numeric_values(self, tmp_path):
        """测试无效数值"""
        csv_content = """turbine_id,timestamp,wind_direction,nacelle_angle,active_power,wind_speed
WTG01,2026-05-01 00:00:00,abc,def,ghi,jkl
WTG01,2026-05-01 00:10:00,275.0,270.0,1250.0,8.5"""
        
        csv_file = tmp_path / "scada.csv"
        csv_file.write_text(csv_content)
        
        df = parse_scada_10min_csv(csv_file)
        
        assert pd.isna(df["wind_direction"].iloc[0])
        assert df["wind_direction"].iloc[1] == 275.0


class TestParseWindRulesYaml:
    """测试规则配置解析"""

    def test_basic_parsing(self, tmp_path):
        """基本解析测试"""
        yaml_content = """yaw_error_threshold: 15.0
power_loss_factor: 0.0015
anemometer_drift_threshold: 5.0
long_term_bias_threshold: 8.0
long_term_bias_period_hours: 24
valid_wind_speed_range: [3.0, 25.0]
min_data_points_for_analysis: 10
yaw_efficiency_target: 0.98"""
        
        yaml_file = tmp_path / "rules.yaml"
        yaml_file.write_text(yaml_content)
        
        rules = parse_wind_rules_yaml(yaml_file)
        
        assert rules["yaw_error_threshold"] == 15.0
        assert rules["power_loss_factor"] == 0.0015
        assert rules["valid_wind_speed_range"] == [3.0, 25.0]

    def test_default_values(self, tmp_path):
        """测试默认值"""
        yaml_content = """yaw_error_threshold: 20.0"""
        
        yaml_file = tmp_path / "rules.yaml"
        yaml_file.write_text(yaml_content)
        
        rules = parse_wind_rules_yaml(yaml_file)
        
        assert rules["yaw_error_threshold"] == 20.0
        assert rules["power_loss_factor"] == 0.0015
        assert rules["anemometer_drift_threshold"] == 5.0

    def test_empty_yaml(self, tmp_path):
        """测试空 YAML"""
        yaml_file = tmp_path / "rules.yaml"
        yaml_file.write_text("")
        
        rules = parse_wind_rules_yaml(yaml_file)
        
        assert rules["yaw_error_threshold"] == 15.0
        assert rules["power_loss_factor"] == 0.0015


class TestNormalizeAngles:
    """测试角度标准化"""

    def test_normalize_within_range(self):
        """测试范围内角度"""
        df = pd.DataFrame({
            "wind_direction": [0.0, 90.0, 180.0, 270.0, 359.0],
            "nacelle_angle": [45.0, 135.0, 225.0, 315.0, 0.0]
        })
        
        result = _normalize_angles(df)
        
        assert result["wind_direction"].tolist() == [0.0, 90.0, 180.0, 270.0, 359.0]
        assert result["nacelle_angle"].tolist() == [45.0, 135.0, 225.0, 315.0, 0.0]

    def test_normalize_above_360(self):
        """测试大于 360 度的角度"""
        df = pd.DataFrame({
            "wind_direction": [370.0, 400.0, 720.0],
            "nacelle_angle": [365.0, 540.0, 719.0]
        })
        
        result = _normalize_angles(df)
        
        assert result["wind_direction"].tolist() == [10.0, 40.0, 0.0]
        assert result["nacelle_angle"].tolist() == [5.0, 180.0, 359.0]

    def test_normalize_negative(self):
        """测试负角度"""
        df = pd.DataFrame({
            "wind_direction": [-10.0, -45.0, -180.0],
            "nacelle_angle": [-5.0, -90.0, -270.0]
        })
        
        result = _normalize_angles(df)
        
        assert result["wind_direction"].tolist() == [350.0, 315.0, 180.0]
        assert result["nacelle_angle"].tolist() == [355.0, 270.0, 90.0]

    def test_normalize_nan(self):
        """测试 NaN 处理"""
        df = pd.DataFrame({
            "wind_direction": [np.nan, 270.0, np.nan],
            "nacelle_angle": [180.0, np.nan, np.nan]
        })
        
        result = _normalize_angles(df)
        
        assert pd.isna(result["wind_direction"].iloc[0])
        assert result["wind_direction"].iloc[1] == 270.0
        assert pd.isna(result["nacelle_angle"].iloc[1])