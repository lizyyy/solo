import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from seal_borrow_service.models import (
    Base, Seal, BorrowApplication, StatusHistory,
    SealType, SealStatus, ApplicationStatus, FinalResult,
    TimeoutLevel, ReturnVerificationResult, StatusCorrectionType
)
from seal_borrow_service.schemas import (
    BorrowApplicationCreate, BorrowRecordBase, UsageMaterialCreate,
    ReturnRecordBase, ApprovalRequest, ManualCorrectionRequest
)
from seal_borrow_service.services.application_service import ApplicationService
from seal_borrow_service.services.status_service import StatusService
from seal_borrow_service.services.timeout_service import TimeoutService
from seal_borrow_service.services.report_service import ReportService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_seal(db_session):
    seal = Seal(
        seal_code="TEST001",
        seal_name="测试合同章",
        seal_type=SealType.CONTRACT,
        description="用于测试",
        custodian="张三",
        department="行政部",
        status=SealStatus.IN_STORAGE
    )
    db_session.add(seal)
    db_session.commit()
    db_session.refresh(seal)
    return seal


class TestNormalFlow:
    """测试正常业务流程"""

    def test_create_application(self, db_session, sample_seal):
        data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            applicant_department="市场部",
            borrow_reason="外出签订客户合同",
            borrow_location="客户公司",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        
        success, message, app = ApplicationService.create_application(db_session, "李四", data)
        
        assert success is True
        assert "申请已创建" in message
        assert app.status == ApplicationStatus.DRAFT
        assert app.seal_id == sample_seal.id

    def test_full_application_flow(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            applicant_department="市场部",
            borrow_reason="外出签订客户合同",
            borrow_location="客户公司",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        
        success, message, app = ApplicationService.create_application(db_session, "李四", app_data)
        assert success
        
        success, message = ApplicationService.submit_for_approval(db_session, app.id, "李四")
        assert success
        assert "已提交待审批" in message
        
        app = db_session.refresh(app) or db_session.query(BorrowApplication).get(app.id)
        success, message = ApplicationService.approve_application(
            db_session, app.id, "王经理", "同意", True
        )
        assert success
        assert "审批通过" in message
        
        app = db_session.query(BorrowApplication).get(app.id)
        assert app.status == ApplicationStatus.APPROVED

        borrow_data = BorrowRecordBase(
            actual_borrow_date=datetime.now(),
            borrower_signature="李四",
            custodian_signature="张三",
            borrow_remarks="正常借出"
        )
        success, message = ApplicationService.record_borrow(db_session, app.id, borrow_data, "张三")
        assert success
        assert "外借记录已完成" in message
        
        app = db_session.query(BorrowApplication).get(app.id)
        assert app.status == ApplicationStatus.LENDED
        
        seal = db_session.query(Seal).get(sample_seal.id)
        assert seal.status == SealStatus.BORROWED

        material_data = UsageMaterialCreate(
            material_type="合同文件",
            material_name="客户合作协议.pdf",
            file_path="/uploads/contract_001.pdf",
            file_size=102400,
            material_description="签订的客户合同扫描件"
        )
        success, message, material = ApplicationService.upload_usage_material(
            db_session, app.id, material_data, "李四"
        )
        assert success
        assert "已上传" in message
        
        success, message = ApplicationService.verify_material(
            db_session, material.id, "王五", "材料完整", True
        )
        assert success
        assert "核验通过" in message

        return_data = ReturnRecordBase(
            actual_return_date=datetime.now(),
            verification_result=ReturnVerificationResult.VERIFIED,
            verification_details="印章完好，材料齐全",
            verifier="张三",
            returned_by="李四",
            return_remarks="正常归还",
            materials_complete=True,
            seal_intact=True
        )
        success, message = ApplicationService.record_return(db_session, app.id, return_data, "张三")
        assert success
        assert "正常完成" in message
        
        app = db_session.query(BorrowApplication).get(app.id)
        assert app.status == ApplicationStatus.RETURNED
        assert app.final_result == FinalResult.NORMAL_COMPLETION
        
        seal = db_session.query(Seal).get(sample_seal.id)
        assert seal.status == SealStatus.IN_STORAGE


class TestMaterialsIncomplete:
    """测试材料不全的情况"""

    def test_return_without_materials(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="外出签订合同",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        
        success, message, app = ApplicationService.create_application(db_session, "李四", app_data)
        ApplicationService.submit_for_approval(db_session, app.id, "李四")
        app = db_session.query(BorrowApplication).get(app.id)
        ApplicationService.approve_application(db_session, app.id, "王经理", "", True)
        
        app = db_session.query(BorrowApplication).get(app.id)
        borrow_data = BorrowRecordBase(actual_borrow_date=datetime.now())
        ApplicationService.record_borrow(db_session, app.id, borrow_data, "张三")

        app = db_session.query(BorrowApplication).get(app.id)
        return_data = ReturnRecordBase(
            actual_return_date=datetime.now(),
            verification_result=ReturnVerificationResult.VERIFIED,
            verifier="张三",
            materials_complete=False,
            seal_intact=True
        )
        success, message = ApplicationService.record_return(db_session, app.id, return_data, "张三")
        
        app = db_session.query(BorrowApplication).get(app.id)
        assert app.final_result == FinalResult.MATERIALS_INCOMPLETE


class TestTimeoutAndEscalation:
    """测试超时升级机制"""

    def test_timeout_level_calculation(self):
        assert TimeoutService._calculate_timeout_level(20) is None
        assert TimeoutService._calculate_timeout_level(24) == TimeoutLevel.LEVEL1
        assert TimeoutService._calculate_timeout_level(48) == TimeoutLevel.LEVEL2
        assert TimeoutService._calculate_timeout_level(72) == TimeoutLevel.LEVEL3
        assert TimeoutService._calculate_timeout_level(168) == TimeoutLevel.LEVEL4

    def test_timeout_detection(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="外出签订合同",
            planned_borrow_date=datetime.now() - timedelta(days=2),
            planned_return_date=datetime.now() - timedelta(days=1)
        )
        
        success, message, app = ApplicationService.create_application(db_session, "李四", app_data)
        ApplicationService.submit_for_approval(db_session, app.id, "李四")
        app = db_session.query(BorrowApplication).get(app.id)
        ApplicationService.approve_application(db_session, app.id, "王经理", "", True)
        
        app = db_session.query(BorrowApplication).get(app.id)
        borrow_data = BorrowRecordBase(actual_borrow_date=datetime.now() - timedelta(days=2))
        ApplicationService.record_borrow(db_session, app.id, borrow_data, "张三")
        
        result = TimeoutService.check_timeout_applications(db_session)
        
        assert result["success"] is True
        assert result["data"]["escalated_count"] > 0
        
        app = db_session.query(BorrowApplication).get(app.id)
        assert app.status == ApplicationStatus.TIMEOUT
        assert app.current_timeout_level is not None


class TestManualCorrection:
    """测试人工状态修正"""

    def test_manual_correction_records_history(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="测试",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        
        success, message, app = ApplicationService.create_application(db_session, "李四", app_data)
        
        original_status = app.status
        
        success, message = ApplicationService.manual_correct_status(
            db_session, app.id,
            ApplicationStatus.CANCELLED,
            None,
            "管理员",
            "申请人取消申请"
        )
        assert success
        
        histories = StatusService.get_application_history(db_session, app.id)
        assert len(histories) >= 1
        
        manual_history = next(
            (h for h in histories if h.correction_type == StatusCorrectionType.MANUAL_CORRECTION),
            None
        )
        assert manual_history is not None
        assert manual_history.previous_status == original_status
        assert manual_history.new_status == ApplicationStatus.CANCELLED
        assert manual_history.operator == "管理员"

    def test_status_at_time_query(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="测试",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        
        success, message, app = ApplicationService.create_application(db_session, "李四", app_data)
        app_id = app.id
        assert app.status == ApplicationStatus.DRAFT
        
        ApplicationService.submit_for_approval(db_session, app.id, "李四")
        time_after_approval = datetime.now()
        
        status = StatusService.get_status_at_time(db_session, app_id, time_after_approval)
        
        assert status["status"] == ApplicationStatus.PENDING_APPROVAL
        assert status["is_manual_correction"] == False
        assert status["operator"] == "李四"


class TestReportAndReconciliation:
    """测试报告和数据一致性"""

    def test_statistics_summary(self, db_session, sample_seal):
        for i in range(3):
            app_data = BorrowApplicationCreate(
                seal_id=sample_seal.id,
                applicant_id=f"USER{i+1:03d}",
                applicant_name=f"申请人{i+1}",
                borrow_reason=f"测试申请{i+1}",
                planned_borrow_date=datetime.now(),
                planned_return_date=datetime.now() + timedelta(days=1)
            )
            ApplicationService.create_application(db_session, f"申请人{i+1}", app_data)
        
        stats = ReportService.get_statistics_summary(db_session)
        
        assert stats["total_applications"] == 3
        assert stats["pending_approval"] == 0
        assert stats["lended"] == 0

    def test_reconciliation_report(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="测试",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        success, message, app = ApplicationService.create_application(db_session, "李四", app_data)
        
        reconciliation = ReportService.get_reconciliation_report(db_session)
        
        assert reconciliation["is_consistent"] is True
        assert reconciliation["inconsistent_count"] == 0

    def test_usage_ledger(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="测试",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        ApplicationService.create_application(db_session, "李四", app_data)
        
        ledger = ReportService.get_usage_ledger(db_session)
        
        assert len(ledger) == 1
        assert ledger[0]["applicant"] == "李四"


class TestTaskRetry:
    """测试任务失败和重试"""

    def test_task_execution_log(self, db_session, sample_seal):
        app_data = BorrowApplicationCreate(
            seal_id=sample_seal.id,
            applicant_id="USER001",
            applicant_name="李四",
            borrow_reason="测试",
            planned_borrow_date=datetime.now(),
            planned_return_date=datetime.now() + timedelta(days=1)
        )
        ApplicationService.create_application(db_session, "李四", app_data)
        
        result = TimeoutService.check_timeout_applications(db_session)
        
        logs = TimeoutService.get_task_execution_history(db_session, "check_timeout_applications")
        
        assert len(logs) > 0
        assert logs[0].status == "success"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
