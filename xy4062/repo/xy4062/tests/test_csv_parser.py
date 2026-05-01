"""CSV解析器测试"""

import pytest
import tempfile
import csv
from pathlib import Path

from pre_cool_validator.csv_parser import (
    ProductParamsCSVParser,
    VehicleConfigCSVParser,
    LoadingPlanCSVParser,
    CSVParseError,
)


class TestProductParamsCSVParser:
    """货品参数CSV解析器测试"""

    def test_parse_valid_csv(self):
        """测试解析有效的CSV文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                "product_id", "product_name", "specific_heat", "density",
                "default_target_temp", "max_precool_time", "heat_transfer_coeff", "respiration_rate"
            ])
            writer.writerow([
                "APPLE_001", "红富士苹果", "3.65", "500", "0", "120", "12.0", "0.005"
            ])
            writer.writerow([
                "ORANGE_001", "脐橙", "3.75", "550", "5", "90", "10.0", "0.008"
            ])
            temp_path = Path(f.name)

        try:
            products = ProductParamsCSVParser.parse(temp_path)

            assert len(products) == 2
            assert products[0].product_id == "APPLE_001"
            assert products[0].specific_heat == 3.65
            assert products[0].density == 500
            assert products[0].default_target_temp == 0
            assert products[1].product_id == "ORANGE_001"
            assert products[1].respiration_rate == 0.008
        finally:
            temp_path.unlink()

    def test_parse_missing_columns(self):
        """测试缺少必需列"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(["product_id", "product_name"])
            writer.writerow(["APPLE_001", "红富士苹果"])
            temp_path = Path(f.name)

        try:
            with pytest.raises(CSVParseError):
                ProductParamsCSVParser.parse(temp_path)
        finally:
            temp_path.unlink()

    def test_parse_invalid_value(self):
        """测试无效数值"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                "product_id", "product_name", "specific_heat", "density",
                "default_target_temp", "max_precool_time"
            ])
            writer.writerow([
                "APPLE_001", "红富士苹果", "invalid", "500", "0", "120"
            ])
            temp_path = Path(f.name)

        try:
            with pytest.raises(CSVParseError):
                ProductParamsCSVParser.parse(temp_path)
        finally:
            temp_path.unlink()

    def test_export_and_parse(self):
        """测试导出再解析"""
        from pre_cool_validator.models import ProductParams

        original_products = [
            ProductParams(
                product_id="TEST_001",
                product_name="测试产品1",
                specific_heat=3.5,
                density=500,
                default_target_temp=0,
                max_precool_time=120,
            ),
            ProductParams(
                product_id="TEST_002",
                product_name="测试产品2",
                specific_heat=3.8,
                density=600,
                default_target_temp=5,
                max_precool_time=90,
            ),
        ]

        with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as f:
            temp_path = Path(f.name)

        try:
            ProductParamsCSVParser.export(original_products, temp_path)
            parsed_products = ProductParamsCSVParser.parse(temp_path)

            assert len(parsed_products) == 2
            assert parsed_products[0].product_id == original_products[0].product_id
            assert parsed_products[0].specific_heat == original_products[0].specific_heat
        finally:
            temp_path.unlink()


class TestVehicleConfigCSVParser:
    """车辆配置CSV解析器测试"""

    def test_parse_valid_csv(self):
        """测试解析有效的车辆配置CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                "vehicle_id", "vehicle_name", "cargo_volume", "cargo_surface_area",
                "insulation_k", "cooling_capacity", "fan_airflow", "door_area"
            ])
            writer.writerow([
                "REF_001", "4.2米冷藏车", "18.0", "42.0", "0.4", "8.0", "3000.0", "4.0"
            ])
            temp_path = Path(f.name)

        try:
            vehicles = VehicleConfigCSVParser.parse(temp_path)

            assert len(vehicles) == 1
            assert vehicles[0].vehicle_id == "REF_001"
            assert vehicles[0].cooling_capacity == 8.0
            assert vehicles[0].max_door_open_duration == 30
        finally:
            temp_path.unlink()


class TestLoadingPlanCSVParser:
    """装车计划CSV解析器测试"""

    def test_parse_valid_csv(self):
        """测试解析有效的装车计划CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                "plan_id", "plan_name", "vehicle_id", "ambient_temp",
                "total_precool_time", "door_open_duration",
                "batch_id", "product_id", "product_name",
                "volume", "mass", "initial_temp", "target_temp"
            ])
            writer.writerow([
                "PLAN_001", "测试计划", "REF_001", "28.0",
                "90", "15",
                "B001", "APPLE_001", "红富士苹果",
                "2.5", "1250", "15.0", "0.0"
            ])
            writer.writerow([
                "PLAN_001", "测试计划", "REF_001", "28.0",
                "90", "15",
                "B002", "ORANGE_001", "脐橙",
                "2.0", "1100", "12.0", "5.0"
            ])
            temp_path = Path(f.name)

        try:
            plan = LoadingPlanCSVParser.parse(temp_path)

            assert plan.plan_id == "PLAN_001"
            assert plan.plan_name == "测试计划"
            assert plan.vehicle_id == "REF_001"
            assert plan.ambient_temp == 28.0
            assert len(plan.batches) == 2
            assert plan.batches[0].batch_id == "B001"
            assert plan.batches[1].batch_id == "B002"
        finally:
            temp_path.unlink()
