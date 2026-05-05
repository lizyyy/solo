"""
测试数据模型模块
"""

import pytest
import tempfile
import os
import json
from datetime import datetime
from pathlib import Path

from memprofiler.models import (
    LeakSeverity,
    IssueType,
    ObjectInfo,
    ReferenceRelation,
    CycleReference,
    LeakSuspect,
    SnapshotInfo,
    AnalysisResult,
    DatabaseManager,
)


class TestEnums:
    """测试枚举类"""
    
    def test_leak_severity_values(self):
        assert LeakSeverity.CRITICAL.value == "critical"
        assert LeakSeverity.HIGH.value == "high"
        assert LeakSeverity.MEDIUM.value == "medium"
        assert LeakSeverity.LOW.value == "low"
        assert LeakSeverity.INFO.value == "info"
    
    def test_issue_type_values(self):
        assert IssueType.CYCLE_REFERENCE.value == "cycle_reference"
        assert IssueType.DEL_METHOD.value == "del_method"
        assert IssueType.REF_COUNT_LEAK.value == "ref_count_leak"
        assert IssueType.WEAKREF_INVALID.value == "weakref_invalid"
        assert IssueType.CACHE_RESIDUE.value == "cache_residue"
        assert IssueType.LARGE_OBJECT.value == "large_object"
        assert IssueType.UNCOLLECTABLE.value == "uncollectable"


class TestDataclasses:
    """测试数据类"""
    
    def test_object_info_creation(self):
        obj = ObjectInfo(
            obj_id="test_001",
            obj_type="TestClass",
            size=1024,
            ref_count=2,
            address="0x123456",
            module="test_module",
            attributes={"key": "value"}
        )
        
        assert obj.obj_id == "test_001"
        assert obj.obj_type == "TestClass"
        assert obj.size == 1024
        assert obj.ref_count == 2
        assert obj.address == "0x123456"
        assert obj.module == "test_module"
        assert obj.attributes == {"key": "value"}
    
    def test_reference_relation_creation(self):
        ref = ReferenceRelation(
            from_obj_id="obj_001",
            to_obj_id="obj_002",
            ref_type="strong",
            attribute_name="other",
            container_index=0
        )
        
        assert ref.from_obj_id == "obj_001"
        assert ref.to_obj_id == "obj_002"
        assert ref.ref_type == "strong"
        assert ref.attribute_name == "other"
        assert ref.container_index == 0
    
    def test_cycle_reference_creation(self):
        cycle = CycleReference(
            cycle_id="cycle_001",
            objects=["obj_001", "obj_002"],
            size=2048,
            has_del=True,
            is_uncollectable=True,
            evidence="测试循环引用"
        )
        
        assert cycle.cycle_id == "cycle_001"
        assert cycle.objects == ["obj_001", "obj_002"]
        assert cycle.size == 2048
        assert cycle.has_del is True
        assert cycle.is_uncollectable is True
        assert cycle.evidence == "测试循环引用"
    
    def test_leak_suspect_creation(self):
        import uuid
        
        suspect = LeakSuspect(
            suspect_id=str(uuid.uuid4()),
            obj_id="obj_001",
            obj_type="TestClass",
            issue_type=IssueType.CYCLE_REFERENCE,
            severity=LeakSeverity.HIGH,
            size=1024,
            evidence=["检测到循环引用"],
            suggestions=["使用 weakref 打破循环"],
            reference_chain=["obj_001", "obj_002"]
        )
        
        assert suspect.obj_id == "obj_001"
        assert suspect.issue_type == IssueType.CYCLE_REFERENCE
        assert suspect.severity == LeakSeverity.HIGH
        assert len(suspect.evidence) == 1
        assert len(suspect.suggestions) == 1
    
    def test_snapshot_info_creation(self):
        snap = SnapshotInfo(
            snapshot_id="snap_001",
            name="测试快照",
            timestamp=datetime.now(),
            total_objects=1000,
            total_size=1024 * 1024,
            top_types=[{"type": "dict", "count": 100}],
            source_file="/path/to/snapshot.snap"
        )
        
        assert snap.snapshot_id == "snap_001"
        assert snap.name == "测试快照"
        assert snap.total_objects == 1000
        assert snap.total_size == 1048576
        assert len(snap.top_types) == 1
    
    def test_analysis_result_to_dict(self):
        import uuid
        
        result = AnalysisResult(
            analysis_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            status="completed",
            summary={"risk_level": "低"},
            suspects=[],
            cycles=[],
            objects=[],
            references=[],
            snapshots=[],
            error_message=""
        )
        
        result_dict = result.to_dict()
        
        assert "analysis_id" in result_dict
        assert result_dict["status"] == "completed"
        assert result_dict["summary"] == {"risk_level": "低"}


class TestDatabaseManager:
    """测试数据库管理器"""
    
    @pytest.fixture
    def temp_db_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            yield db_path
    
    def test_database_creation(self, temp_db_path):
        db = DatabaseManager(temp_db_path)
        
        assert os.path.exists(temp_db_path)
    
    def test_create_analysis(self, temp_db_path):
        db = DatabaseManager(temp_db_path)
        
        analysis_id = db.create_analysis()
        
        assert analysis_id is not None
        assert len(analysis_id) > 0
        
        analysis = db.get_analysis(analysis_id)
        assert analysis is not None
        assert analysis["status"] == "running"
    
    def test_update_analysis(self, temp_db_path):
        db = DatabaseManager(temp_db_path)
        
        analysis_id = db.create_analysis()
        
        db.update_analysis(
            analysis_id=analysis_id,
            status="completed",
            summary={"risk_level": "高", "total_suspects": 5},
            error_message=""
        )
        
        analysis = db.get_analysis(analysis_id)
        assert analysis["status"] == "completed"
        
        summary = json.loads(analysis["summary"])
        assert summary["risk_level"] == "高"
        assert summary["total_suspects"] == 5
    
    def test_get_latest_analysis(self, temp_db_path):
        db = DatabaseManager(temp_db_path)
        
        analysis1 = db.create_analysis()
        analysis2 = db.create_analysis()
        
        latest = db.get_latest_analysis()
        
        assert latest is not None
        assert latest["id"] == analysis2
    
    def test_get_all_analyses(self, temp_db_path):
        db = DatabaseManager(temp_db_path)
        
        for i in range(3):
            db.create_analysis()
        
        analyses = db.get_all_analyses()
        
        assert len(analyses) == 3
    
    def test_save_and_get_suspects(self, temp_db_path):
        import uuid
        
        db = DatabaseManager(temp_db_path)
        analysis_id = db.create_analysis()
        
        suspect = LeakSuspect(
            suspect_id=str(uuid.uuid4()),
            obj_id="obj_001",
            obj_type="TestClass",
            issue_type=IssueType.CYCLE_REFERENCE,
            severity=LeakSeverity.HIGH,
            size=1024,
            evidence=["测试证据"],
            suggestions=["测试建议"],
            reference_chain=["obj_001", "obj_002"]
        )
        
        db.save_suspect(analysis_id, suspect)
        
        suspects = db.get_suspects(analysis_id)
        
        assert len(suspects) == 1
        assert suspects[0]["obj_id"] == "obj_001"
        assert suspects[0]["severity"] == "high"
    
    def test_save_and_get_cycles(self, temp_db_path):
        import uuid
        
        db = DatabaseManager(temp_db_path)
        analysis_id = db.create_analysis()
        
        cycle = CycleReference(
            cycle_id=str(uuid.uuid4()),
            objects=["obj_001", "obj_002"],
            size=2048,
            has_del=True,
            is_uncollectable=True,
            evidence="测试循环引用"
        )
        
        db.save_cycle(analysis_id, cycle)
        
        cycles = db.get_cycles(analysis_id)
        
        assert len(cycles) == 1
        assert cycles[0]["has_del"] == 1
        assert cycles[0]["is_uncollectable"] == 1
    
    def test_save_object(self, temp_db_path):
        import uuid
        
        db = DatabaseManager(temp_db_path)
        analysis_id = db.create_analysis()
        
        obj = ObjectInfo(
            obj_id="obj_001",
            obj_type="TestClass",
            size=1024,
            ref_count=2,
            address="0x123456",
            module="test_module",
            attributes={"key": "value"}
        )
        
        db.save_object(analysis_id, obj)
