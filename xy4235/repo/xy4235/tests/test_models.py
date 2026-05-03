"""
数据模型测试
"""
import sys
import os
from datetime import datetime, timedelta

import pytest

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.vital_signs import VitalSigns, VitalSignsRecord
from models.medication import Medication, MedicationRecord, MedicationRoute, MedicationType
from models.risk import Risk, RiskType, RiskStatus, RiskSeverity, RiskSegment
from models.review import Review, ReviewRecord, ReviewAction
from models.case import Case, CaseStatus


class TestVitalSignsRecord:
    """
    生命体征记录测试
    """
    
    def test_create_record(self):
        """
        测试创建生命体征记录
        """
        timestamp = datetime(2024, 1, 15, 9, 0, 0)
        record = VitalSignsRecord(
            timestamp=timestamp,
            temperature=37.8,
            heart_rate=120,
            spo2=98,
            systolic_bp=110,
            diastolic_bp=65,
            respiratory_rate=25
        )
        
        assert record.timestamp == timestamp
        assert record.temperature == 37.8
        assert record.heart_rate == 120
        assert record.spo2 == 98
        assert record.systolic_bp == 110
        assert record.diastolic_bp == 65
        assert record.respiratory_rate == 25
    
    def test_to_dict(self):
        """
        测试转换为字典
        """
        timestamp = datetime(2024, 1, 15, 9, 0, 0)
        record = VitalSignsRecord(
            timestamp=timestamp,
            temperature=37.8,
            heart_rate=120
        )
        
        data = record.to_dict()
        
        assert data['timestamp'] == timestamp.isoformat()
        assert data['temperature'] == 37.8
        assert data['heart_rate'] == 120
        assert data['spo2'] is None
    
    def test_from_dict(self):
        """
        测试从字典创建
        """
        timestamp = datetime(2024, 1, 15, 9, 0, 0)
        data = {
            'timestamp': timestamp.isoformat(),
            'temperature': 37.8,
            'heart_rate': 120,
            'spo2': 98
        }
        
        record = VitalSignsRecord.from_dict(data)
        
        assert record.timestamp == timestamp
        assert record.temperature == 37.8
        assert record.heart_rate == 120
        assert record.spo2 == 98


class TestVitalSigns:
    """
    生命体征数据集测试
    """
    
    def test_create_vital_signs(self):
        """
        测试创建生命体征数据集
        """
        vs = VitalSigns(device_model="TestDevice", firmware_version="1.0")
        
        assert vs.device_model == "TestDevice"
        assert vs.firmware_version == "1.0"
        assert len(vs.records) == 0
    
    def test_add_record(self):
        """
        测试添加记录
        """
        vs = VitalSigns()
        record = VitalSignsRecord(
            timestamp=datetime(2024, 1, 15, 9, 0, 0),
            temperature=37.8
        )
        
        vs.add_record(record)
        
        assert len(vs.records) == 1
        assert vs.records[0].temperature == 37.8
    
    def test_has_data(self):
        """
        测试检查是否有数据
        """
        vs = VitalSigns()
        
        assert not vs.has_data('temperature')
        
        vs.add_record(VitalSignsRecord(
            timestamp=datetime(2024, 1, 15, 9, 0, 0),
            temperature=37.8,
            heart_rate=None
        ))
        
        assert vs.has_data('temperature')
        assert not vs.has_data('heart_rate')
        assert not vs.has_data('spo2')
    
    def test_get_time_range(self):
        """
        测试获取时间范围
        """
        vs = VitalSigns()
        
        start_time = datetime(2024, 1, 15, 9, 0, 0)
        end_time = datetime(2024, 1, 15, 10, 0, 0)
        
        vs.add_record(VitalSignsRecord(timestamp=start_time, temperature=37.8))
        vs.add_record(VitalSignsRecord(timestamp=end_time, temperature=37.0))
        
        tr_start, tr_end = vs.get_time_range()
        
        assert tr_start == start_time
        assert tr_end == end_time
    
    def test_to_dict(self):
        """
        测试转换为字典
        """
        vs = VitalSigns(device_model="TestDevice")
        vs.add_record(VitalSignsRecord(
            timestamp=datetime(2024, 1, 15, 9, 0, 0),
            temperature=37.8
        ))
        
        data = vs.to_dict()
        
        assert data['device_model'] == "TestDevice"
        assert len(data['records']) == 1


class TestMedicationRecord:
    """
    给药记录测试
    """
    
    def test_create_record(self):
        """
        测试创建给药记录
        """
        admin_time = datetime(2024, 1, 15, 9, 0, 0)
        record = MedicationRecord(
            record_id="REC-001",
            medication_name="丙泊酚",
            admin_time=admin_time,
            scheduled_time=admin_time,
            dosage=100.0,
            dosage_unit="mg",
            route=MedicationRoute.IV,
            operator="张医生",
            notes="诱导麻醉"
        )
        
        assert record.medication_name == "丙泊酚"
        assert record.dosage == 100.0
        assert record.route == MedicationRoute.IV


class TestRisk:
    """
    风险测试
    """
    
    def test_create_risk(self):
        """
        测试创建风险
        """
        start_time = datetime(2024, 1, 15, 9, 15, 0)
        end_time = datetime(2024, 1, 15, 9, 30, 0)
        
        risk = Risk(
            risk_type=RiskType.HYPOTHERMIA,
            severity=RiskSeverity.MODERATE,
            start_time=start_time,
            end_time=end_time,
            description="体温下降至36.0°C以下",
            details={'min_temperature': 35.5}
        )
        
        assert risk.risk_type == RiskType.HYPOTHERMIA
        assert risk.severity == RiskSeverity.MODERATE
        assert risk.status == RiskStatus.PENDING
        assert risk.start_time == start_time
        assert risk.end_time == end_time
        assert len(risk.review_history) == 0
    
    def test_add_review(self):
        """
        测试添加复核记录
        """
        risk = Risk(risk_type=RiskType.HYPOTHERMIA, severity=RiskSeverity.MODERATE)
        
        review_time = datetime(2024, 1, 15, 10, 0, 0)
        review = ReviewRecord(
            action=ReviewAction.CONFIRM,
            reviewer="李护士",
            timestamp=review_time,
            notes="确实存在低体温情况"
        )
        
        risk.add_review(review)
        
        assert len(risk.review_history) == 1
        assert risk.review_history[0].action == ReviewAction.CONFIRM


class TestCase:
    """
    病例测试
    """
    
    def test_create_case(self):
        """
        测试创建病例
        """
        case = Case(
            patient_name="小黑",
            species="犬",
            breed="拉布拉多",
            age=3,
            weight=25.5,
            surgery_type="绝育手术"
        )
        
        assert case.patient_name == "小黑"
        assert case.species == "犬"
        assert case.status == CaseStatus.IN_PROGRESS
        assert len(case.risks) == 0
    
    def test_add_vital_signs(self):
        """
        测试添加生命体征
        """
        case = Case()
        vs = VitalSigns()
        vs.add_record(VitalSignsRecord(
            timestamp=datetime(2024, 1, 15, 9, 0, 0),
            temperature=37.8
        ))
        
        case.add_vital_signs(vs)
        
        assert case.vital_signs is not None
        assert len(case.vital_signs.records) == 1
    
    def test_add_risk(self):
        """
        测试添加风险
        """
        case = Case()
        risk = Risk(risk_type=RiskType.HYPOTHERMIA, severity=RiskSeverity.MODERATE)
        
        case.add_risk(risk)
        
        assert len(case.risks) == 1
        assert case.risks[0].risk_type == RiskType.HYPOTHERMIA
    
    def test_get_risk_by_id(self):
        """
        测试按ID获取风险
        """
        case = Case()
        risk = Risk(risk_type=RiskType.HYPOTHERMIA, severity=RiskSeverity.MODERATE)
        risk_id = risk.risk_id
        
        case.add_risk(risk)
        
        found = case.get_risk_by_id(risk_id)
        
        assert found is not None
        assert found.risk_id == risk_id
        
        not_found = case.get_risk_by_id("non_existent")
        assert not_found is None
    
    def test_to_dict(self):
        """
        测试转换为字典
        """
        case = Case(patient_name="小黑", species="犬")
        
        data = case.to_dict()
        
        assert data['patient_name'] == "小黑"
        assert data['species'] == "犬"
        assert 'case_id' in data
        assert 'created_at' in data
