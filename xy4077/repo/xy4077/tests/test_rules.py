"""规则引擎测试"""

from datetime import datetime, timedelta

import pytest

from exhibit_inspector.models import (
    ThresholdSettings,
    SensorType,
    SensorRecord,
    PhotoType,
    PhotoRecord,
    RouteBook,
    RouteNode,
    RoutePhase,
)
from exhibit_inspector.rules import RuleEngine
from exhibit_inspector.rules.base import BaseRule, RuleResult


class TestShockDetectorRule:
    """震动检测器规则测试"""
    
    def test_detect_shock_over_threshold(self):
        """测试检测超过阈值的震动"""
        thresholds = ThresholdSettings(shock_threshold_g=2.0)
        engine = RuleEngine(thresholds)
        
        base_time = datetime(2025, 1, 15, 8, 0, 0)
        
        sensor_records = [
            SensorRecord(
                timestamp=base_time + timedelta(minutes=i),
                box_id="BX-001",
                sensor_id="S001",
                sensor_type=SensorType.SHOCK,
                x_accel_g=0.1 if i < 5 else 3.0,
                y_accel_g=0.1 if i < 5 else 2.5,
                z_accel_g=1.0 if i < 5 else 4.0,
                temperature_celsius=20.0,
                humidity_pct=50.0,
            )
            for i in range(10)
        ]
        
        result = engine.analyze(
            shipment_id="SH-TEST-001",
            sensor_records=sensor_records,
        )
        
        shock_issues = [i for i in result.issues if "震动" in i.description or "shock" in i.description.lower()]
        assert len(shock_issues) > 0


class TestTemperatureHumidityRule:
    """温湿度规则测试"""
    
    def test_detect_high_temperature(self):
        """测试检测超高温"""
        thresholds = ThresholdSettings(
            temp_max_celsius=25.0,
            temp_min_celsius=15.0,
        )
        engine = RuleEngine(thresholds)
        
        base_time = datetime(2025, 1, 15, 8, 0, 0)
        
        sensor_records = [
            SensorRecord(
                timestamp=base_time + timedelta(minutes=i),
                box_id="BX-001",
                sensor_id="S001",
                sensor_type=SensorType.TEMPERATURE,
                x_accel_g=0.1,
                y_accel_g=0.1,
                z_accel_g=1.0,
                temperature_celsius=20.0 if i < 5 else 30.0,
                humidity_pct=50.0,
            )
            for i in range(10)
        ]
        
        result = engine.analyze(
            shipment_id="SH-TEST-001",
            sensor_records=sensor_records,
        )
        
        temp_issues = [i for i in result.issues if "温度" in i.description or "temperature" in i.description.lower()]
        assert len(temp_issues) > 0
    
    def test_detect_low_temperature(self):
        """测试检测超低温"""
        thresholds = ThresholdSettings(
            temp_max_celsius=25.0,
            temp_min_celsius=15.0,
        )
        engine = RuleEngine(thresholds)
        
        base_time = datetime(2025, 1, 15, 8, 0, 0)
        
        sensor_records = [
            SensorRecord(
                timestamp=base_time + timedelta(minutes=i),
                box_id="BX-001",
                sensor_id="S001",
                sensor_type=SensorType.TEMPERATURE,
                x_accel_g=0.1,
                y_accel_g=0.1,
                z_accel_g=1.0,
                temperature_celsius=20.0 if i < 5 else 10.0,
                humidity_pct=50.0,
            )
            for i in range(10)
        ]
        
        result = engine.analyze(
            shipment_id="SH-TEST-001",
            sensor_records=sensor_records,
        )
        
        temp_issues = [i for i in result.issues if "温度" in i.description or "temperature" in i.description.lower()]
        assert len(temp_issues) > 0
    
    def test_detect_high_humidity(self):
        """测试检测超高湿度"""
        thresholds = ThresholdSettings(
            humidity_max_pct=70.0,
            humidity_min_pct=40.0,
        )
        engine = RuleEngine(thresholds)
        
        base_time = datetime(2025, 1, 15, 8, 0, 0)
        
        sensor_records = [
            SensorRecord(
                timestamp=base_time + timedelta(minutes=i),
                box_id="BX-001",
                sensor_id="S001",
                sensor_type=SensorType.HUMIDITY,
                x_accel_g=0.1,
                y_accel_g=0.1,
                z_accel_g=1.0,
                temperature_celsius=20.0,
                humidity_pct=50.0 if i < 5 else 80.0,
            )
            for i in range(10)
        ]
        
        result = engine.analyze(
            shipment_id="SH-TEST-001",
            sensor_records=sensor_records,
        )
        
        humid_issues = [i for i in result.issues if "湿度" in i.description or "humidity" in i.description.lower()]
        assert len(humid_issues) > 0


class TestPhotoValidatorRule:
    """照片验证器规则测试"""
    
    def test_detect_missing_photos(self):
        """测试检测缺失照片"""
        thresholds = ThresholdSettings()
        engine = RuleEngine(thresholds)
        
        route_nodes = [
            RouteNode(
                node_id="001",
                phase=RoutePhase.ORIGIN,
                location="北京博物馆",
                scheduled_arrival=datetime(2025, 1, 15, 8, 0, 0),
                scheduled_departure=datetime(2025, 1, 15, 8, 30, 0),
                requires_photos=True,
                requires_unboxing=True,
                requires_signature=True,
            ),
            RouteNode(
                node_id="002",
                phase=RoutePhase.LOADING,
                location="停车场",
                scheduled_arrival=datetime(2025, 1, 15, 8, 30, 0),
                scheduled_departure=datetime(2025, 1, 15, 9, 0, 0),
                requires_photos=True,
                requires_unboxing=False,
                requires_signature=False,
            ),
        ]
        
        route_book = RouteBook(
            shipment_id="SH-TEST-001",
            nodes=route_nodes,
        )
        
        photo_records = [
            PhotoRecord(
                photo_id="P001",
                file_name="IMG_001.jpg",
                timestamp=datetime(2025, 1, 15, 8, 5, 0),
                box_id="BX-001",
                node_id="001",
                photo_type=PhotoType.PACKAGING,
                photographer="张三",
            ),
        ]
        
        result = engine.analyze(
            shipment_id="SH-TEST-001",
            photo_records=photo_records,
            route_book=route_book,
        )
        
        photo_issues = [i for i in result.issues if "照片" in i.description or "photo" in i.description.lower()]
        assert len(photo_issues) > 0


class TestRuleEngine:
    """规则引擎测试"""
    
    def test_empty_input(self):
        """测试空输入"""
        thresholds = ThresholdSettings()
        engine = RuleEngine(thresholds)
        
        result = engine.analyze(shipment_id="SH-TEST-001")
        
        assert result.total_issues == 0
        assert result.issues == []
    
    def test_no_issues_with_normal_data(self):
        """测试正常数据不产生问题"""
        thresholds = ThresholdSettings(
            shock_threshold_g=5.0,
            temp_max_celsius=30.0,
            temp_min_celsius=10.0,
            humidity_max_pct=90.0,
            humidity_min_pct=20.0,
        )
        engine = RuleEngine(thresholds)
        
        base_time = datetime(2025, 1, 15, 8, 0, 0)
        
        sensor_records = [
            SensorRecord(
                timestamp=base_time + timedelta(minutes=i),
                box_id="BX-001",
                sensor_id="S001",
                sensor_type=SensorType.MULTI,
                x_accel_g=0.1,
                y_accel_g=0.1,
                z_accel_g=1.0,
                temperature_celsius=20.0,
                humidity_pct=50.0,
            )
            for i in range(10)
        ]
        
        result = engine.analyze(
            shipment_id="SH-TEST-001",
            sensor_records=sensor_records,
        )
        
        assert result.total_issues == 0
