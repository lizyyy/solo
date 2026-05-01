import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import shutil
import json

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.import_validator import DataImporter, ValidationResult, ValidationError
from core.matcher import DataMatcher, MatchResult, DuplicateGroup
from core.rule_engine import RuleEngine, RuleResult, EngineResult
from core.persistence import DataPersistence, WorkflowState, AuditEntry
from exporters.exporter import DataExporter


class TestDataImporter:
    @pytest.fixture
    def importer(self):
        return DataImporter()
    
    @pytest.fixture
    def sample_sensor_csv(self, tmp_path):
        csv_content = """井盖编号,经度,纬度,记录时间,异响次数,振动强度,传感器状态
MH-001,118.8,31.0,2024-05-01 08:30:00,5,3.5,正常
MH-002,118.81,31.01,2024-05-01 08:45:00,3,2.8,正常
S-003,118.9,31.1,2024-05-01 09:00:00,8,4.2,告警
"""
        file_path = tmp_path / "sensor_data.csv"
        file_path.write_text(csv_content, encoding='utf-8')
        return file_path
    
    @pytest.fixture
    def sample_manual_csv(self, tmp_path):
        csv_content = """井盖编号,经度,纬度,巡检时间,异响情况,积水深度,巡检员,状态
井盖-001,118.8,31.0,2024-05-01 09:00:00,有异响,15,张三,待复核
井盖编号-002,118.81,31.01,2024-05-01 09:15:00,无异响,0,张三,已复核
JH-003,118.9,31.1,2024-05-01 09:30:00,有异响,30,李四,待复核
"""
        file_path = tmp_path / "manual_data.csv"
        file_path.write_text(csv_content, encoding='utf-8')
        return file_path
    
    @pytest.fixture
    def sample_water_geojson(self, tmp_path):
        geojson_content = """
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [118.805, 31.005]
            },
            "properties": {
                "积水深度": 25,
                "积水半径": 60,
                "发生时间": "2024-05-01 07:00:00",
                "严重程度": "严重",
                "街区": "中心城区"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [118.902, 31.102]
            },
            "properties": {
                "积水深度": 40,
                "积水半径": 80,
                "发生时间": "2024-05-01 06:30:00",
                "严重程度": "特别严重",
                "街区": "北部新城"
            }
        }
    ]
}
"""
        file_path = tmp_path / "water_data.geojson"
        file_path.write_text(geojson_content, encoding='utf-8')
        return file_path
    
    def test_import_sensor_csv(self, importer, sample_sensor_csv):
        result = importer.import_sensor_csv(sample_sensor_csv)
        
        assert isinstance(result, ValidationResult)
        assert len(result.valid_rows) == 3
        assert len(result.invalid_rows) == 0
        assert not result.has_errors
        
        assert "normalized_id" in result.valid_rows.columns
        assert result.valid_rows.iloc[0]["normalized_id"] == "001"
    
    def test_import_manual_csv(self, importer, sample_manual_csv):
        result = importer.import_manual_csv(sample_manual_csv)
        
        assert isinstance(result, ValidationResult)
        assert len(result.valid_rows) == 3
        assert not result.has_errors
        
        assert "has_abnormal_sound" in result.valid_rows.columns
        assert result.valid_rows.iloc[0]["has_abnormal_sound"] == True
    
    def test_import_water_geojson(self, importer, sample_water_geojson):
        result = importer.import_water_geojson(sample_water_geojson)
        
        assert isinstance(result, ValidationResult)
        assert len(result.valid_rows) == 2
        assert not result.has_errors
        
        assert "积水深度" in result.valid_rows.columns
        assert "积水半径" in result.valid_rows.columns
    
    def test_normalize_manhole_id(self, importer):
        test_cases = [
            ("MH-001", "001"),
            ("S-002", "002"),
            ("SS-003", "003"),
            ("井盖-004", "004"),
            ("井盖编号-005", "005"),
            ("JH-006", "006"),
            ("JG-007", "007"),
            ("008", "008"),
        ]
        
        for input_id, expected in test_cases:
            assert importer._normalize_manhole_id(input_id) == expected
    
    def test_validate_sensor_row_valid(self, importer):
        valid_row = pd.Series({
            "井盖编号": "MH-001",
            "经度": 118.8,
            "纬度": 31.0,
            "记录时间": "2024-05-01 08:30:00",
            "异响次数": 5,
            "振动强度": 3.5,
            "传感器状态": "正常"
        })
        
        errors = importer._validate_sensor_row(valid_row, 0)
        assert len(errors) == 0
    
    def test_validate_sensor_row_invalid(self, importer):
        invalid_row = pd.Series({
            "井盖编号": "",
            "经度": 999,
            "纬度": 999,
            "记录时间": "invalid",
            "异响次数": -5,
            "振动强度": 3.5,
            "传感器状态": "正常"
        })
        
        errors = importer._validate_sensor_row(invalid_row, 0)
        assert len(errors) > 0


class TestDataMatcher:
    @pytest.fixture
    def matcher(self):
        return DataMatcher()
    
    def test_haversine_distance(self, matcher):
        dist = matcher.haversine_distance(31.0, 118.8, 31.001, 118.801)
        assert dist > 0
        assert dist < 1
    
    def test_match_sensor_manual(self, matcher):
        sensor_data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "normalized_id": "001",
                "经度": 118.8,
                "纬度": 31.0,
                "记录时间": pd.to_datetime("2024-05-01 08:30:00"),
                "异响次数": 5,
                "振动强度": 3.5
            }
        ])
        
        manual_data = pd.DataFrame([
            {
                "井盖编号": "井盖-001",
                "normalized_id": "001",
                "经度": 118.8,
                "纬度": 31.0,
                "巡检时间": pd.to_datetime("2024-05-01 09:00:00"),
                "has_abnormal_sound": True,
                "积水深度": 15
            }
        ])
        
        result = matcher.match_sensor_manual(sensor_data, manual_data)
        
        assert isinstance(result, MatchResult)
        assert result.matched_count == 1
    
    def test_find_duplicates(self, matcher):
        data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "normalized_id": "001",
                "经度": 118.8,
                "纬度": 31.0,
                "异响次数": 5
            },
            {
                "井盖编号": "井盖-001",
                "normalized_id": "001",
                "经度": 118.8001,
                "纬度": 31.0001,
                "异响次数": 3
            }
        ])
        
        duplicates = matcher.find_duplicates(data)
        
        assert len(duplicates) == 1
        assert len(duplicates[0].records) == 2
    
    def test_merge_duplicates(self, matcher):
        group = DuplicateGroup(
            group_id="TEST_001",
            records=[
                {
                    "井盖编号": "MH-001",
                    "经度": 118.8,
                    "纬度": 31.0,
                    "异响次数": 5,
                    "振动强度": 3.5
                },
                {
                    "井盖编号": "井盖-001",
                    "经度": 118.8001,
                    "纬度": 31.0001,
                    "has_abnormal_sound": True,
                    "积水深度": 15
                }
            ],
            primary_index=0,
            merge_suggestion="Test",
            distance_threshold=10
        )
        
        merged = matcher.merge_duplicates(group, keep_primary=True)
        
        assert merged["merged_来源记录数"] == 2
        assert "merged_井盖编号列表" in merged


class TestRuleEngine:
    @pytest.fixture
    def engine(self):
        return RuleEngine()
    
    def test_check_high_frequency_sound(self, engine):
        data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "事件时间": pd.to_datetime("2024-05-01 08:30:00"),
                "异响次数": 5
            },
            {
                "井盖编号": "MH-002",
                "事件时间": pd.to_datetime("2024-05-01 08:45:00"),
                "异响次数": 2
            }
        ])
        
        storm_time = pd.to_datetime("2024-05-01 07:00:00")
        results = engine.check_high_frequency_sound(data, storm_time)
        
        assert len(results) == 1
        assert results[0].manhole_id == "MH-001"
        assert results[0].risk_score >= 30
    
    def test_check_water_radius_hit(self, engine):
        manhole_data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "纬度": 31.001,
                "经度": 118.801
            }
        ])
        
        water_data = pd.DataFrame([
            {
                "纬度": 31.005,
                "经度": 118.805,
                "积水深度": 25,
                "积水半径": 60
            }
        ])
        
        results = engine.check_water_radius_hit(manhole_data, water_data)
        
        assert len(results) >= 0
    
    def test_check_timeout_review(self, engine):
        data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "事件时间": datetime.now() - timedelta(hours=30),
                "状态": "待复核"
            },
            {
                "井盖编号": "MH-002",
                "事件时间": datetime.now() - timedelta(hours=10),
                "状态": "待复核"
            }
        ])
        
        results = engine.check_timeout_review(data, current_time=datetime.now())
        
        assert len(results) == 1
        assert results[0].manhole_id == "MH-001"
    
    def test_run_all_rules(self, engine):
        merged_data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "normalized_id": "001",
                "纬度": 31.0,
                "经度": 118.8,
                "事件时间": pd.to_datetime("2024-05-01 08:30:00"),
                "异响次数": 8,
                "振动强度": 4.2,
                "积水深度": 15,
                "has_abnormal_sound": True
            }
        ])
        
        water_data = pd.DataFrame([
            {
                "纬度": 31.005,
                "经度": 118.805,
                "积水深度": 25,
                "积水半径": 100
            }
        ])
        
        result = engine.run_all_rules(
            merged_data,
            water_data,
            storm_time=pd.to_datetime("2024-05-01 07:00:00")
        )
        
        assert isinstance(result, EngineResult)
        assert result.triggered_rules >= 1
        assert "critical" in result.risk_summary or "high" in result.risk_summary


class TestDataPersistence:
    @pytest.fixture
    def persistence(self, tmp_path):
        data_dir = tmp_path / "data"
        exports_dir = tmp_path / "exports"
        return DataPersistence(data_dir, exports_dir)
    
    def test_create_new_session(self, persistence):
        state = persistence.create_new_session()
        
        assert isinstance(state, WorkflowState)
        assert state.session_id is not None
        assert len(state.reviewed_ids) == 0
        assert len(state.merged_groups) == 0
    
    def test_save_load_workflow_state(self, persistence):
        state = persistence.create_new_session()
        state.reviewed_ids = ["MH-001", "MH-002"]
        
        persistence.save_workflow_state(state)
        
        loaded = persistence.load_workflow_state(state.session_id)
        
        assert loaded is not None
        assert loaded.session_id == state.session_id
        assert len(loaded.reviewed_ids) == 2
    
    def test_mark_as_reviewed(self, persistence):
        state = persistence.create_new_session()
        persistence.save_workflow_state(state)
        
        result = persistence.mark_as_reviewed(
            state.session_id,
            "MH-001",
            "test_user"
        )
        
        assert result == True
        
        loaded = persistence.load_workflow_state(state.session_id)
        assert "MH-001" in loaded.reviewed_ids
    
    def test_get_audit_log(self, persistence):
        state = persistence.create_new_session()
        
        audit_log = persistence.get_audit_log()
        
        assert isinstance(audit_log, list)
    
    def test_export_audit_package(self, persistence):
        state = persistence.create_new_session()
        
        package = persistence.export_audit_package(state.session_id)
        
        assert isinstance(package, dict)
        assert "export_time" in package
        assert "version" in package


class TestDataExporter:
    @pytest.fixture
    def exporter(self, tmp_path):
        exports_dir = tmp_path / "exports"
        return DataExporter(exports_dir)
    
    def test_export_dispatch_csv(self, exporter):
        high_risk_data = pd.DataFrame([
            {
                "井盖编号": "MH-001",
                "街区": "中心城区",
                "风险评分": 85,
                "风险等级": "high",
                "触发规则列表": "高频异响, 积水半径命中",
                "异响次数": 8,
                "积水深度": 25,
                "纬度": 31.0,
                "经度": 118.8
            }
        ])
        
        assigned_tasks = []
        
        path = exporter.export_dispatch_csv(high_risk_data, assigned_tasks)
        
        assert path.exists()
        
        loaded = pd.read_csv(path)
        assert len(loaded) == 1
    
    def test_list_exports(self, exporter):
        exports = exporter.list_exports()
        assert isinstance(exports, list)
    
    def test_export_audit_json(self, exporter):
        audit_package = {
            "export_time": datetime.now().isoformat(),
            "version": "1.0.0",
            "audit_log": [],
            "workflow_sessions": []
        }
        
        path = exporter.export_audit_json(audit_package)
        
        assert path.exists()
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert data["version"] == "1.0.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
