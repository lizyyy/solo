"""数据库测试"""

import tempfile
import os
from datetime import datetime, timedelta

import pytest

from specimen_tracker.models import (
    Patient, Specimen, SpecimenEvent, Anomaly,
    SpecimenStatus, EventType, AnomalyType
)
from specimen_tracker.database import DatabaseManager


@pytest.fixture
def temp_db():
    """创建临时数据库"""
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    
    db = DatabaseManager(path)
    db.initialize_database()
    
    yield db
    
    if os.path.exists(path):
        os.remove(path)


class TestPatientOperations:
    """患者操作测试"""
    
    def test_save_and_get_patient(self, temp_db):
        """测试保存和获取患者"""
        patient = Patient(
            patient_id="P001",
            name="张三",
            age=45,
            gender="男",
            bed_number="12A",
        )
        
        patient_id = temp_db.save_patient(patient)
        
        assert patient_id > 0
        assert patient.id == patient_id
        
        retrieved = temp_db.get_patient_by_id("P001")
        assert retrieved is not None
        assert retrieved.name == "张三"
        assert retrieved.age == 45
    
    def test_update_patient(self, temp_db):
        """测试更新患者"""
        patient = Patient(
            patient_id="P001",
            name="张三",
        )
        temp_db.save_patient(patient)
        
        patient.name = "张三丰"
        patient.age = 50
        temp_db.save_patient(patient)
        
        retrieved = temp_db.get_patient_by_id("P001")
        assert retrieved.name == "张三丰"
        assert retrieved.age == 50


class TestSpecimenOperations:
    """标本操作测试"""
    
    def test_save_and_get_specimen(self, temp_db):
        """测试保存和获取标本"""
        specimen = Specimen(
            specimen_no="BD202605020001",
            patient_id="P001",
            patient_name="张三",
            location="左侧甲状腺",
            status=SpecimenStatus.REGISTERED,
            photo_count=0,
            has_csv=True,
            has_specimen_bag=True,
        )
        
        specimen_id = temp_db.save_specimen(specimen)
        
        assert specimen_id > 0
        assert specimen.id == specimen_id
        
        retrieved = temp_db.get_specimen_by_id(specimen_id)
        assert retrieved is not None
        assert retrieved.specimen_no == "BD202605020001"
        assert retrieved.patient_name == "张三"
        assert retrieved.has_csv == True
    
    def test_get_specimen_by_no(self, temp_db):
        """测试按标本号获取"""
        specimen = Specimen(
            specimen_no="BD001",
            patient_name="张三",
        )
        temp_db.save_specimen(specimen)
        
        retrieved = temp_db.get_specimen_by_no("BD001")
        assert retrieved is not None
        assert retrieved.patient_name == "张三"
    
    def test_get_all_specimens(self, temp_db):
        """测试获取所有标本"""
        for i in range(3):
            specimen = Specimen(
                specimen_no=f"BD{i:03d}",
                patient_name=f"患者{i}",
                status=SpecimenStatus.IN_PROCESS,
            )
            temp_db.save_specimen(specimen)
        
        released_specimen = Specimen(
            specimen_no="BD999",
            patient_name="已出院患者",
            status=SpecimenStatus.RELEASED,
        )
        temp_db.save_specimen(released_specimen)
        
        all_specimens = temp_db.get_all_specimens(include_released=False)
        assert len(all_specimens) == 3
        
        all_including_released = temp_db.get_all_specimens(include_released=True)
        assert len(all_including_released) == 4
    
    def test_get_specimens_by_status(self, temp_db):
        """测试按状态获取标本"""
        specs_by_status = {
            SpecimenStatus.REGISTERED: 2,
            SpecimenStatus.IN_PROCESS: 3,
            SpecimenStatus.REVIEWED: 1,
        }
        
        for status, count in specs_by_status.items():
            for i in range(count):
                specimen = Specimen(
                    specimen_no=f"{status.value}_{i}",
                    patient_name="测试患者",
                    status=status,
                )
                temp_db.save_specimen(specimen)
        
        in_process = temp_db.get_specimens_by_status(SpecimenStatus.IN_PROCESS)
        assert len(in_process) == 3
        
        reviewed = temp_db.get_specimens_by_status(SpecimenStatus.REVIEWED)
        assert len(reviewed) == 1


class TestEventOperations:
    """事件操作测试"""
    
    def test_save_and_get_events(self, temp_db):
        """测试保存和获取事件"""
        specimen = Specimen(
            specimen_no="BD001",
            patient_name="张三",
        )
        temp_db.save_specimen(specimen)
        
        event = SpecimenEvent(
            specimen_id=specimen.id,
            event_type=EventType.PHOTOGRAPH,
            description="拍照完成",
            operator="值班员",
        )
        temp_db.save_event(event)
        
        events = temp_db.get_events_by_specimen(specimen.id)
        assert len(events) == 1
        assert events[0].event_type == EventType.PHOTOGRAPH
        assert events[0].description == "拍照完成"


class TestAnomalyOperations:
    """异常操作测试"""
    
    def test_save_and_get_anomalies(self, temp_db):
        """测试保存和获取异常"""
        specimen = Specimen(
            specimen_no="BD001",
            patient_name="张三",
        )
        temp_db.save_specimen(specimen)
        
        anomaly = Anomaly(
            specimen_id=specimen.id,
            anomaly_type=AnomalyType.MISSING_PHOTO,
            description="标本尚未拍照",
            severity="high",
            is_resolved=False,
        )
        temp_db.save_anomaly(anomaly)
        
        unresolved = temp_db.get_unresolved_anomalies()
        assert len(unresolved) == 1
        assert unresolved[0].anomaly_type == AnomalyType.MISSING_PHOTO
    
    def test_resolved_anomaly_not_in_unresolved(self, temp_db):
        """测试已解决的异常不出现在未解决列表"""
        specimen = Specimen(
            specimen_no="BD001",
            patient_name="张三",
        )
        temp_db.save_specimen(specimen)
        
        anomaly = Anomaly(
            specimen_id=specimen.id,
            anomaly_type=AnomalyType.MISSING_PHOTO,
            description="标本尚未拍照",
            severity="high",
            is_resolved=True,
            resolved_at=datetime.now(),
            resolved_by="值班员",
        )
        temp_db.save_anomaly(anomaly)
        
        unresolved = temp_db.get_unresolved_anomalies()
        assert len(unresolved) == 0
