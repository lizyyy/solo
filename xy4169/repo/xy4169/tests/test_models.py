"""数据模型测试"""

from datetime import datetime
from specimen_tracker.models import (
    Patient, Specimen, SpecimenEvent, Anomaly,
    SpecimenStatus, EventType, AnomalyType
)


class TestPatient:
    """患者模型测试"""
    
    def test_patient_creation(self):
        """测试创建患者"""
        patient = Patient(
            patient_id="P001",
            name="张三",
            age=45,
            gender="男",
            bed_number="12A",
            admission_number="ZY20260001",
        )
        
        assert patient.patient_id == "P001"
        assert patient.name == "张三"
        assert patient.age == 45
        assert patient.gender == "男"
        assert patient.id is None
    
    def test_patient_defaults(self):
        """测试患者默认值"""
        patient = Patient()
        
        assert patient.patient_id == ""
        assert patient.name == ""
        assert patient.age == 0
        assert patient.gender == ""


class TestSpecimen:
    """标本模型测试"""
    
    def test_specimen_creation(self):
        """测试创建标本"""
        specimen = Specimen(
            specimen_no="BD202605020001",
            patient_id="P001",
            patient_name="张三",
            location="左侧甲状腺",
            specimen_type="冰冻切片",
            operation_room="手术室1",
            surgeon="张医师",
            urgent_level="急诊",
        )
        
        assert specimen.specimen_no == "BD202605020001"
        assert specimen.patient_name == "张三"
        assert specimen.status == SpecimenStatus.REGISTERED
        assert specimen.photo_count == 0
        assert specimen.has_csv == False
        assert specimen.has_specimen_bag == False
    
    def test_specimen_status_enum(self):
        """测试状态枚举"""
        assert SpecimenStatus.REGISTERED.value == "已登记"
        assert SpecimenStatus.IN_PROCESS.value == "处理中"
        assert SpecimenStatus.RELEASED.value == "已放行"
        assert SpecimenStatus.DELAYED.value == "已延迟"


class TestSpecimenEvent:
    """标本事件测试"""
    
    def test_event_creation(self):
        """测试创建事件"""
        event = SpecimenEvent(
            specimen_id=1,
            event_type=EventType.REGISTER,
            description="标本登记",
            operator="值班员",
        )
        
        assert event.event_type == EventType.REGISTER
        assert event.description == "标本登记"
        assert event.operator == "值班员"
    
    def test_event_type_enum(self):
        """测试事件类型枚举"""
        assert EventType.REGISTER.value == "登记"
        assert EventType.PHOTOGRAPH.value == "拍照"
        assert EventType.REVIEW.value == "复核"
        assert EventType.RELEASE.value == "放行"
        assert EventType.DELAY.value == "延迟"


class TestAnomaly:
    """异常记录测试"""
    
    def test_anomaly_creation(self):
        """测试创建异常"""
        anomaly = Anomaly(
            specimen_id=1,
            anomaly_type=AnomalyType.MISSING_PHOTO,
            description="标本尚未拍照",
            severity="high",
        )
        
        assert anomaly.anomaly_type == AnomalyType.MISSING_PHOTO
        assert anomaly.severity == "high"
        assert anomaly.is_resolved == False
    
    def test_anomaly_type_enum(self):
        """测试异常类型枚举"""
        assert AnomalyType.MISSING_PHOTO.value == "缺照片"
        assert AnomalyType.TIMEOUT.value == "超时未回报"
        assert AnomalyType.MULTI_PART_CONFUSION.value == "多部位混淆"
        assert AnomalyType.MISSING_REVIEW.value == "漏复核签名"
