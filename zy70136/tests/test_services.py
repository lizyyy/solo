import pytest
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    SignStatus, QualificationStatus, ReceiptStatus,
    RetryType, RetryStatus
)
from app.services import (
    create_sign_application, get_application_by_id, submit_for_qualification,
    upload_qualification, approve_qualification, reject_qualification,
    submit_to_channel, receive_channel_receipt, parse_channel_receipt,
    add_to_retry_queue, get_pending_retries, execute_retry, process_batch_retries,
    generate_audit_report, get_application_history, trace_application_by_request_id,
    check_idempotency, validate_sign_name, can_transition_status, record_operation_log,
    generate_request_id
)
from app.schemas import (
    CreateSignApplicationRequest, UploadQualificationRequest,
    ChannelSubmitRequest, ChannelReceiptRequest
)

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


class TestIdempotencyService:
    def test_generate_request_id(self):
        rid1 = generate_request_id()
        rid2 = generate_request_id()
        assert len(rid1) == 32
        assert rid1 != rid2
    
    def test_validate_sign_name_valid(self):
        valid, msg = validate_sign_name("测试签名")
        assert valid is True
        assert msg == ""
    
    def test_validate_sign_name_empty(self):
        valid, msg = validate_sign_name("")
        assert valid is False
        assert "不能为空" in msg
    
    def test_validate_sign_name_too_long(self):
        valid, msg = validate_sign_name("a" * 50)
        assert valid is False
        assert "不能超过" in msg
    
    def test_validate_sign_name_special_chars(self):
        valid, msg = validate_sign_name("测试!@#签名")
        assert valid is False
        assert "不能包含特殊字符" in msg
    
    def test_can_transition_status_valid(self):
        assert can_transition_status(SignStatus.DRAFT, SignStatus.PENDING_QUALIFICATION) is True
        assert can_transition_status(SignStatus.QUALIFICATION_APPROVED, SignStatus.SUBMITTING_TO_CHANNEL) is True
    
    def test_can_transition_status_invalid(self):
        assert can_transition_status(SignStatus.DRAFT, SignStatus.CHANNEL_SUBMITTED) is False
        assert can_transition_status(SignStatus.CHANNEL_SUBMITTED, SignStatus.DRAFT) is False
    
    def test_check_idempotency_new_request(self, db_session):
        result = check_idempotency(db_session, "test_req_001", "create_application")
        assert result.is_duplicate is False
    
    def test_check_idempotency_duplicate(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            sign_type="NORMAL",
            request_id="test_req_002"
        ))
        
        result = check_idempotency(db_session, "test_req_002", "create_application")
        assert result.is_duplicate is True
        assert result.existing_request_id == "test_req_002"


class TestSignService:
    def test_create_application_success(self, db_session):
        app, msg = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            sign_type="NORMAL",
            request_id="req_create_001"
        ))
        
        assert app is not None
        assert app.merchant_id == "M001"
        assert app.sign_name == "测试签名"
        assert app.status == SignStatus.DRAFT
        assert "创建成功" in msg
    
    def test_create_application_duplicate(self, db_session):
        app1, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            sign_type="NORMAL",
            request_id="req_create_002"
        ))
        
        app2, msg = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            sign_type="NORMAL",
            request_id="req_create_002"
        ))
        
        assert app2 is not None
        assert app2.id == app1.id
        assert "检测到重复请求" in msg
    
    def test_create_application_invalid_name(self, db_session):
        app, msg = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试!@#签名",
            sign_type="NORMAL",
            request_id="req_create_003"
        ))
        
        assert app is None
        assert "不能包含特殊字符" in msg
    
    def test_submit_for_qualification_success(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_submit_001"
        ))
        
        updated_app, msg = submit_for_qualification(db_session, app.id, "req_submit_qual_001")
        
        assert updated_app is not None
        assert updated_app.status == SignStatus.PENDING_QUALIFICATION
        assert "状态更新成功" in msg
    
    def test_submit_for_qualification_duplicate(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_submit_002"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_002")
        
        updated_app, msg = submit_for_qualification(db_session, app.id, "req_submit_qual_002")
        
        assert updated_app is not None
        assert "检测到重复请求" in msg


class TestQualificationService:
    def test_upload_qualification_success(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_qual_001"
        ))
        
        qual, msg = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="abc123def456",
            request_id="req_upload_001"
        ))
        
        assert qual is not None
        assert qual.qualification_type == "营业执照"
        assert qual.status == QualificationStatus.PENDING
        assert "上传成功" in msg
    
    def test_upload_qualification_duplicate_hash(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_qual_002"
        ))
        
        qual1, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="same_hash_123",
            request_id="req_upload_002"
        ))
        
        qual2, msg = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license_v2.pdf",
            file_url="/files/business_license_v2.pdf",
            file_hash="same_hash_123",
            request_id="req_upload_003"
        ))
        
        assert qual2 is not None
        assert qual2.id == qual1.id
        assert "相同文件已存在" in msg
    
    def test_approve_qualification_success(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_qual_003"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_003")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_approve_123",
            request_id="req_upload_004"
        ))
        
        approved_qual, msg = approve_qualification(
            db_session, qual.id, "reviewer_001", "req_approve_001", "资质符合要求"
        )
        
        assert approved_qual is not None
        assert approved_qual.status == QualificationStatus.APPROVED
        assert approved_qual.reviewer_id == "reviewer_001"
        assert "审批通过" in msg
    
    def test_reject_qualification_success(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_qual_004"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_004")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_reject_123",
            request_id="req_upload_005"
        ))
        
        rejected_qual, msg = reject_qualification(
            db_session, qual.id, "reviewer_001", "req_reject_001", "营业执照过期"
        )
        
        assert rejected_qual is not None
        assert rejected_qual.status == QualificationStatus.REJECTED
        assert rejected_qual.review_comment == "营业执照过期"
        assert "已拒绝" in msg
        
        updated_app = get_application_by_id(db_session, app.id)
        assert updated_app.status == SignStatus.QUALIFICATION_REJECTED
    
    def test_reject_qualification_no_comment(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_qual_005"
        ))
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_reject_456",
            request_id="req_upload_006"
        ))
        
        qual, msg = reject_qualification(
            db_session, qual.id, "reviewer_001", "req_reject_002", ""
        )
        
        assert qual is None
        assert "拒绝原因不能为空" in msg


class TestChannelService:
    def test_submit_to_channel_success(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_channel_001"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_005")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_channel_123",
            request_id="req_upload_007"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_002")
        
        updated_app, msg = submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_001"
        ))
        
        assert updated_app is not None
        assert updated_app.status == SignStatus.CHANNEL_SUBMITTED
        assert updated_app.channel_sign_id is not None
        assert "渠道提交成功" in msg
    
    def test_submit_to_channel_no_qualification(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_channel_002"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_006")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_channel_no_qual",
            request_id="req_upload_no_qual"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_no_qual", "先通过再模拟无资质场景")
        
        from app.models import QualificationAttachment, QualificationStatus
        qual_record = db_session.query(QualificationAttachment).filter(
            QualificationAttachment.id == qual.id
        ).first()
        qual_record.status = QualificationStatus.PENDING
        db_session.commit()
        
        updated_app, msg = submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_002"
        ))
        
        assert updated_app is None
        assert "没有已通过的资质" in msg
    
    def test_submit_to_channel_invalid_channel(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_channel_003"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_007")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_channel_456",
            request_id="req_upload_008"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_003")
        
        updated_app, msg = submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="invalid_channel",
            request_id="req_channel_submit_003"
        ))
        
        assert updated_app is None
        assert "不支持的渠道" in msg
    
    def test_receive_and_parse_receipt_approved(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_receipt_001"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_008")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_receipt_123",
            request_id="req_upload_009"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_004")
        
        submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_004"
        ))
        
        receipt, _ = receive_channel_receipt(db_session, ChannelReceiptRequest(
            application_id=app.id,
            channel="alicloud",
            channel_receipt_id="REC_001_APPROVED",
            raw_payload='{"status": "approved", "message": "审核通过", "signId": "SIGN_001"}',
            request_id="req_receive_001"
        ))
        
        parsed_receipt, msg = parse_channel_receipt(db_session, receipt.id)
        
        assert parsed_receipt is not None
        assert parsed_receipt.status == ReceiptStatus.SUCCESS
        assert "回执解析成功" in msg
        
        updated_app = get_application_by_id(db_session, app.id)
        assert updated_app.status == SignStatus.AUDIT_APPROVED
    
    def test_receive_and_parse_receipt_rejected(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_receipt_002"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_009")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_receipt_456",
            request_id="req_upload_010"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_005")
        
        submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_005"
        ))
        
        receipt, _ = receive_channel_receipt(db_session, ChannelReceiptRequest(
            application_id=app.id,
            channel="alicloud",
            channel_receipt_id="REC_002_REJECTED",
            raw_payload='{"status": "rejected", "message": "签名包含敏感词", "signId": "SIGN_002"}',
            request_id="req_receive_002"
        ))
        
        parse_channel_receipt(db_session, receipt.id)
        
        updated_app = get_application_by_id(db_session, app.id)
        assert updated_app.status == SignStatus.AUDIT_REJECTED
    
    def test_parse_receipt_invalid_json(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_receipt_003"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_010")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_receipt_789",
            request_id="req_upload_011"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_006")
        
        submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_006"
        ))
        
        receipt, _ = receive_channel_receipt(db_session, ChannelReceiptRequest(
            application_id=app.id,
            channel="alicloud",
            channel_receipt_id="REC_003_INVALID",
            raw_payload="这不是合法的JSON",
            request_id="req_receive_003"
        ))
        
        parsed_receipt, msg = parse_channel_receipt(db_session, receipt.id)
        
        assert parsed_receipt is not None
        assert parsed_receipt.status == ReceiptStatus.FAILED
        assert "回执解析失败" in msg


class TestRetryService:
    def test_add_to_retry_queue(self, db_session):
        retry, msg = add_to_retry_queue(
            db_session,
            RetryType.RECEIPT_PARSE,
            "1",
            last_error="JSON解析错误"
        )
        
        assert retry is not None
        assert retry.retry_type == RetryType.RECEIPT_PARSE
        assert retry.status == RetryStatus.PENDING
        assert retry.retry_count == 0
        assert "已加入重试队列" in msg
    
    def test_add_duplicate_to_retry_queue(self, db_session):
        add_to_retry_queue(db_session, RetryType.RECEIPT_PARSE, "2", last_error="错误1")
        
        retry2, msg = add_to_retry_queue(db_session, RetryType.RECEIPT_PARSE, "2", last_error="错误2")
        
        assert retry2 is not None
        assert "已在重试队列中" in msg
    
    def test_execute_retry_success(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_retry_001"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_011")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_retry_123",
            request_id="req_upload_012"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_007")
        
        submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_007"
        ))
        
        receipt, _ = receive_channel_receipt(db_session, ChannelReceiptRequest(
            application_id=app.id,
            channel="alicloud",
            channel_receipt_id="REC_RETRY_001",
            raw_payload='{"status": "approved", "message": "审核通过"}',
            request_id="req_receive_004"
        ))
        
        retry, _ = add_to_retry_queue(
            db_session,
            RetryType.RECEIPT_PARSE,
            str(receipt.id),
            last_error="模拟之前解析失败"
        )
        
        from datetime import datetime
        from app.models import RetryQueue
        retry_record = db_session.query(RetryQueue).filter(RetryQueue.id == retry.id).first()
        retry_record.next_retry_at = datetime.utcnow()
        db_session.commit()
        
        pending = get_pending_retries(db_session)
        assert len(pending) > 0
        
        success, msg = execute_retry(db_session, retry.id)
        
        assert success is True
        
        updated_retry = get_pending_retries.__wrapped__(db_session, retry.id) if hasattr(get_pending_retries, '__wrapped__') else None
        refreshed = db_session.query(type(retry)).filter(type(retry).id == retry.id).first()
        assert refreshed.status == RetryStatus.SUCCESS


class TestReportService:
    def test_generate_audit_report_approved(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_report_001"
        ))
        
        submit_for_qualification(db_session, app.id, "req_submit_qual_012")
        
        qual, _ = upload_qualification(db_session, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license.pdf",
            file_url="/files/business_license.pdf",
            file_hash="hash_report_123",
            request_id="req_upload_013"
        ))
        
        approve_qualification(db_session, qual.id, "reviewer_001", "req_approve_008")
        
        submit_to_channel(db_session, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="req_channel_submit_008"
        ))
        
        receipt, _ = receive_channel_receipt(db_session, ChannelReceiptRequest(
            application_id=app.id,
            channel="alicloud",
            channel_receipt_id="REC_REPORT_001",
            raw_payload='{"status": "approved", "message": "审核通过"}',
            request_id="req_receive_005"
        ))
        
        parse_channel_receipt(db_session, receipt.id)
        
        report, msg = generate_audit_report(db_session, app.id)
        
        assert report is not None
        assert report.final_status == SignStatus.AUDIT_APPROVED.value
        assert "报告生成成功" in msg
    
    def test_generate_audit_report_not_terminal(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_report_002"
        ))
        
        report, msg = generate_audit_report(db_session, app.id)
        
        assert report is None
        assert "不是终态" in msg
    
    def test_get_application_history(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_history_001"
        ))
        
        history = get_application_history(db_session, app.id)
        
        assert "application" in history
        assert history["application"]["id"] == app.id
        assert "qualifications" in history
        assert "operation_logs" in history
        assert len(history["operation_logs"]) > 0
    
    def test_trace_application_by_request_id(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="测试签名",
            request_id="req_trace_001"
        ))
        
        trace_result = trace_application_by_request_id(db_session, "req_trace_001")
        
        assert trace_result["found"] is True
        assert trace_result["application_id"] == app.id
        assert "trace_hint" in trace_result


class TestIdempotencyGuarantee:
    def test_duplicate_create_returns_same_id(self, db_session):
        req1 = CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="幂等测试签名",
            request_id="idempotent_req_001"
        )
        
        app1, _ = create_sign_application(db_session, req1)
        
        app2, _ = create_sign_application(db_session, req1)
        
        assert app1.id == app2.id
        assert app1.request_id == app2.request_id
        assert app1.status == app2.status
    
    def test_duplicate_upload_returns_same_qualification(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="幂等测试",
            request_id="idempotent_req_002"
        ))
        
        upload_req = UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="test.pdf",
            file_url="/test.pdf",
            file_hash="idempotent_hash_123",
            request_id="idempotent_upload_001"
        )
        
        qual1, _ = upload_qualification(db_session, upload_req)
        
        qual2, _ = upload_qualification(db_session, upload_req)
        
        assert qual1.id == qual2.id
    
    def test_status_transition_consistency(self, db_session):
        app, _ = create_sign_application(db_session, CreateSignApplicationRequest(
            merchant_id="M001",
            sign_name="状态一致性测试",
            request_id="consistency_req_001"
        ))
        
        assert app.status == SignStatus.DRAFT
        
        submit_for_qualification(db_session, app.id, "consistency_submit_001")
        app_refreshed = get_application_by_id(db_session, app.id)
        assert app_refreshed.status == SignStatus.PENDING_QUALIFICATION
        
        submit_for_qualification(db_session, app.id, "consistency_submit_001")
        app_refreshed2 = get_application_by_id(db_session, app.id)
        assert app_refreshed2.status == SignStatus.PENDING_QUALIFICATION
