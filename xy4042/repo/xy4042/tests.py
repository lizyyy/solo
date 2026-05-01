#!/usr/bin/env python3
"""
测试模块 - 用于验证核心功能
"""

import sys
from pathlib import Path
import tempfile
import shutil
import hashlib

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from config.settings import Settings, set_settings
from models.database import init_db
from core.patient_repository import PatientRepository
from core.order_repository import OrderRepository
from core.measurement_repository import MeasurementRepository
from core.attachment_repository import AttachmentRepository
from core.fitting_repository import FittingRecordRepository
from core.rework_repository import ReworkRecordRepository
from core.audit_repository import AuditLogRepository
from core.workflow.state_machine import StateMachine
from core.workflow.business_rules import BusinessRules
from core.workflow.order_validator import OrderValidator
from core.attachment.archiver import AttachmentArchiver
from core.attachment.hasher import compute_sha256
from models.patient import Patient
from models.order import Order
from models.measurement import Measurement
from models.fitting_record import FittingRecord
from models.rework_record import ReworkRecord


class TestRunner:
    def __init__(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix="orthotics_test_"))
        self.passed = 0
        self.failed = 0
        
        settings = Settings(
            base_dir=self.temp_dir,
            data_dir=self.temp_dir / "data",
            db_path=self.temp_dir / "data" / "orthotics.db",
            attachments_dir=self.temp_dir / "data" / "attachments",
            temp_dir=self.temp_dir / "data" / "temp"
        )
        set_settings(settings)
        
        init_db()
    
    def cleanup(self):
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
    
    def run_test(self, name: str, test_func):
        print(f"测试: {name} ... ", end="")
        try:
            test_func()
            self.passed += 1
            print("✓ 通过")
        except Exception as e:
            self.failed += 1
            print(f"✗ 失败: {e}")
    
    def test_patient_crud(self):
        repo = PatientRepository()
        
        patient = Patient(name="测试患者", phone="13800138000")
        saved = repo.create(patient)
        
        assert saved.id is not None
        assert saved.name == "测试患者"
        
        retrieved = repo.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.phone == "13800138000"
        
        saved.name = "更新后姓名"
        repo.update(saved)
        
        retrieved = repo.get_by_id(saved.id)
        assert retrieved.name == "更新后姓名"
        
        repo.delete(saved.id)
        retrieved = repo.get_by_id(saved.id)
        assert retrieved is None
    
    def test_order_crud(self):
        patient_repo = PatientRepository()
        order_repo = OrderRepository()
        
        patient = Patient(name="订单测试患者")
        patient = patient_repo.create(patient)
        
        order = Order(
            patient_id=patient.id,
            order_number="TEST20260501001",
            body_part="小腿假肢",
            side="左侧",
            status="待取模"
        )
        saved = order_repo.create(order)
        
        assert saved.id is not None
        assert saved.order_number == "TEST20260501001"
        
        retrieved = order_repo.get_by_order_number("TEST20260501001")
        assert retrieved is not None
        assert retrieved.body_part == "小腿假肢"
    
    def test_measurement_crud(self):
        patient_repo = PatientRepository()
        order_repo = OrderRepository()
        measurement_repo = MeasurementRepository()
        
        patient = Patient(name="尺寸测试患者")
        patient = patient_repo.create(patient)
        
        order = Order(
            patient_id=patient.id,
            order_number="MEAS20260501",
            body_part="大腿假肢",
            side="右侧"
        )
        order = order_repo.create(order)
        
        measurement = Measurement(order_id=order.id, version=1)
        measurement.set_dimensions_dict({
            "残肢长度": "35cm",
            "残肢围度": "50cm"
        })
        saved = measurement_repo.create(measurement)
        
        assert saved.id is not None
        
        retrieved = measurement_repo.get_latest(order.id)
        assert retrieved is not None
        
        dims = retrieved.get_dimensions_dict()
        assert dims["残肢长度"] == "35cm"
        assert dims["残肢围度"] == "50cm"
    
    def test_state_machine(self):
        sm = StateMachine()
        
        assert sm.can_transition("待取模", "待设计")
        assert not sm.can_transition("待取模", "制作中")
        assert not sm.can_transition("待取模", "待取模")
        
        transitions = sm.get_available_transitions("待设计")
        assert "待取模" in transitions
        assert "制作中" in transitions
        
        order = Order(status="待取模")
        result = sm.validate_transition(order, "待设计", {"has_measurements": True})
        assert result.success
        
        result = sm.validate_transition(order, "待设计", {"has_measurements": False})
        assert not result.success
        assert "尺寸版本" in result.errors[0]
    
    def test_business_rules(self):
        order = Order(status="待设计")
        
        result = BusinessRules.check_measurements_for_design(order, [])
        assert not result.passed
        
        m = Measurement()
        result = BusinessRules.check_measurements_for_design(order, [m])
        assert result.passed
    
    def test_order_validator(self):
        validator = OrderValidator()
        
        errors = validator.validate_phone("13800138000")
        assert len(errors) == 0
        
        errors = validator.validate_phone("12345")
        assert len(errors) == 1
        
        errors = validator.validate_side("左侧")
        assert len(errors) == 0
        
        errors = validator.validate_side("无效侧")
        assert len(errors) == 1
    
    def test_sha256_hasher(self):
        test_file = self.temp_dir / "test_hash.txt"
        test_file.write_text("测试内容")
        
        hash1 = compute_sha256(test_file)
        
        hash2 = compute_sha256(test_file)
        
        assert hash1 == hash2
        
        test_file.write_text("不同的内容")
        hash3 = compute_sha256(test_file)
        
        assert hash1 != hash3
    
    def test_fitting_and_rework(self):
        patient_repo = PatientRepository()
        order_repo = OrderRepository()
        fitting_repo = FittingRecordRepository()
        rework_repo = ReworkRecordRepository()
        
        patient = Patient(name="试穿测试患者")
        patient = patient_repo.create(patient)
        
        order = Order(
            patient_id=patient.id,
            order_number="FIT20260501",
            body_part="小腿矫形器",
            side="左侧"
        )
        order = order_repo.create(order)
        
        fitting = FittingRecord(
            order_id=order.id,
            feedback="测试反馈",
            adjustments="测试调整"
        )
        fitting = fitting_repo.create(fitting)
        
        assert fitting.id is not None
        
        rework = ReworkRecord(
            order_id=order.id,
            fitting_record_id=fitting.id,
            rework_reason="尺寸不合适"
        )
        rework = rework_repo.create(rework)
        
        assert rework.id is not None
        assert rework.fitting_record_id == fitting.id
    
    def test_audit_log(self):
        patient_repo = PatientRepository()
        order_repo = OrderRepository()
        audit_repo = AuditLogRepository()
        
        patient = Patient(name="审计测试患者")
        patient = patient_repo.create(patient)
        
        order = Order(
            patient_id=patient.id,
            order_number="AUD20260501",
            body_part="足部矫形器",
            side="右侧"
        )
        order = order_repo.create(order)
        
        audit_repo.log(
            action="测试操作",
            details="这是一个测试日志",
            order_id=order.id,
            old_value="旧值",
            new_value="新值"
        )
        
        logs = audit_repo.get_by_order(order.id)
        assert len(logs) == 1
        assert logs[0].action == "测试操作"
        assert logs[0].old_value == "旧值"
        assert logs[0].new_value == "新值"
    
    def test_status_transition_rules(self):
        sm = StateMachine()
        
        result = sm.validate_transition(
            Order(status="待设计"),
            "制作中",
            {"has_images": True}
        )
        assert result.success
        
        result = sm.validate_transition(
            Order(status="待设计"),
            "制作中",
            {"has_images": False, "has_scans": False}
        )
        assert not result.success
        
        result = sm.validate_transition(
            Order(status="待试穿"),
            "需返修",
            {"has_fitting_record": True}
        )
        assert result.success
        
        result = sm.validate_transition(
            Order(status="待试穿"),
            "需返修",
            {"has_fitting_record": False}
        )
        assert not result.success
    
    def run_all(self):
        print("=" * 50)
        print("开始运行测试...")
        print("=" * 50)
        
        self.run_test("患者CRUD操作", self.test_patient_crud)
        self.run_test("订单CRUD操作", self.test_order_crud)
        self.run_test("尺寸记录CRUD", self.test_measurement_crud)
        self.run_test("状态机基本功能", self.test_state_machine)
        self.run_test("业务规则验证", self.test_business_rules)
        self.run_test("订单字段验证", self.test_order_validator)
        self.run_test("SHA256哈希计算", self.test_sha256_hasher)
        self.run_test("试穿和返修记录", self.test_fitting_and_rework)
        self.run_test("审计日志功能", self.test_audit_log)
        self.run_test("状态转换规则", self.test_status_transition_rules)
        
        print()
        print("=" * 50)
        print(f"测试完成: 通过 {self.passed}, 失败 {self.failed}")
        print("=" * 50)
        
        self.cleanup()
        
        return self.failed == 0


if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)
