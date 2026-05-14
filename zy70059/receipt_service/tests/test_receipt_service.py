import pytest
from datetime import datetime, timedelta
from app.services.receipt_service import ReceiptService
from app.schemas import PermissionRequest, DownloadRequest
from app.models import AuditLog, DownloadLog, ReprintPermission


class TestCreatePermission:
    def test_create_permission_success(self, db_session, test_receipt, test_signature):
        service = ReceiptService(db_session)
        
        request = PermissionRequest(
            customer_id=test_receipt.customer_id,
            receipt_index=test_receipt.receipt_index,
            operator_id="OPER_001",
            operator_name="张三",
            request_reason="对账需要",
            max_download_count=3,
            valid_days=30
        )
        
        permission, result = service.create_permission(request)
        
        assert result.valid is True
        assert permission is not None
        assert permission.customer_id == test_receipt.customer_id
        assert permission.receipt_index == test_receipt.receipt_index
        assert permission.original_transaction_id == test_receipt.original_transaction_id
        assert permission.max_download_count == 3
        assert permission.current_download_count == 0
        
        audit = db_session.query(AuditLog).filter(
            AuditLog.operation_type == "PERMISSION_CREATE"
        ).first()
        assert audit is not None
        assert audit.operation_result == "SUCCESS"
    
    def test_create_permission_no_signature_fails(self, db_session, test_receipt):
        service = ReceiptService(db_session)
        
        request = PermissionRequest(
            customer_id=test_receipt.customer_id,
            receipt_index=test_receipt.receipt_index,
            operator_id="OPER_001",
            operator_name="张三",
            max_download_count=3,
            valid_days=30
        )
        
        permission, result = service.create_permission(request)
        
        assert result.valid is False
        assert permission is None
        assert "缺少签章" in result.errors[0]
    
    def test_create_permission_customer_mismatch(self, db_session, test_receipt, test_signature):
        service = ReceiptService(db_session)
        
        request = PermissionRequest(
            customer_id="WRONG_CUST",
            receipt_index=test_receipt.receipt_index,
            operator_id="OPER_001",
            operator_name="张三",
            max_download_count=3,
            valid_days=30
        )
        
        permission, result = service.create_permission(request)
        
        assert result.valid is False
        assert permission is None
        assert "客户与回单不匹配" in result.errors[0]
    
    def test_create_permission_nonexistent_receipt(self, db_session):
        service = ReceiptService(db_session)
        
        request = PermissionRequest(
            customer_id="CUST001",
            receipt_index="NONEXISTENT",
            operator_id="OPER_001",
            operator_name="张三",
            max_download_count=3,
            valid_days=30
        )
        
        permission, result = service.create_permission(request)
        
        assert result.valid is False
        assert permission is None
        assert "回单不存在" in result.errors[0]
    
    def test_create_permission_pending_signature_fails(self, db_session, test_receipt, test_signature):
        test_signature.verification_status = "PENDING"
        db_session.commit()
        
        service = ReceiptService(db_session)
        
        request = PermissionRequest(
            customer_id=test_receipt.customer_id,
            receipt_index=test_receipt.receipt_index,
            operator_id="OPER_001",
            operator_name="张三",
            max_download_count=3,
            valid_days=30
        )
        
        permission, result = service.create_permission(request)
        
        assert result.valid is False
        assert permission is None
        assert "签章未完成验证" in result.errors[0]
        assert "PENDING" in result.errors[0]
    
    def test_create_permission_audit_log_failure_for_pending_signature(self, db_session, test_receipt, test_signature):
        test_signature.verification_status = "PENDING"
        db_session.commit()
        
        service = ReceiptService(db_session)
        
        request = PermissionRequest(
            customer_id=test_receipt.customer_id,
            receipt_index=test_receipt.receipt_index,
            operator_id="OPER_001",
            operator_name="张三",
            max_download_count=3,
            valid_days=30
        )
        
        permission, result = service.create_permission(request)
        
        audit = db_session.query(AuditLog).filter(
            AuditLog.operation_type == "PERMISSION_CREATE"
        ).first()
        assert audit is not None
        assert audit.operation_result == "FAILED"
        assert "签章校验失败" in audit.operation_details


class TestDownloadReceipt:
    def test_download_success_first_time(self, db_session, test_receipt, test_signature, test_permission):
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index=test_receipt.receipt_index,
            customer_id=test_receipt.customer_id,
            operator_id="OPER_001",
            operator_name="张三",
            client_ip="127.0.0.1"
        )
        
        result = service.download_receipt(request)
        
        assert result.success is True
        assert result.download_seq == 1
        assert result.watermark_info is not None
        
        updated_permission = db_session.query(ReprintPermission).filter(
            ReprintPermission.permission_id == test_permission.permission_id
        ).first()
        assert updated_permission.current_download_count == 1
        
        logs = db_session.query(DownloadLog).filter(
            DownloadLog.permission_id == test_permission.permission_id
        ).all()
        assert len(logs) == 1
        assert logs[0].download_seq == 1
        
        audits = db_session.query(AuditLog).filter(
            AuditLog.operation_type == "RECEIPT_DOWNLOAD"
        ).all()
        assert len(audits) == 1
        assert audits[0].operation_result == "SUCCESS"
    
    def test_download_exceeds_max_count(self, db_session, test_receipt, test_signature, test_permission):
        test_permission.max_download_count = 1
        test_permission.current_download_count = 1
        test_permission.is_active = False
        db_session.commit()
        
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index=test_receipt.receipt_index,
            customer_id=test_receipt.customer_id,
            operator_id="OPER_001",
            operator_name="张三"
        )
        
        result = service.download_receipt(request)
        
        assert result.success is False
        assert "已失效" in result.error_message or "最大下载次数限制" in result.error_message
    
    def test_download_wrong_permission_id(self, db_session, test_receipt):
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id="NONEXISTENT_PERM",
            receipt_index=test_receipt.receipt_index,
            customer_id=test_receipt.customer_id,
            operator_id="OPER_001",
            operator_name="张三"
        )
        
        result = service.download_receipt(request)
        
        assert result.success is False
        assert "权限不存在" in result.error_message
    
    def test_download_wrong_receipt(self, db_session, test_permission):
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index="WRONG_RECEIPT",
            customer_id=test_permission.customer_id,
            operator_id="OPER_001",
            operator_name="张三"
        )
        
        result = service.download_receipt(request)
        
        assert result.success is False
        assert "回单不存在" in result.error_message
    
    def test_download_wrong_customer_fails(self, db_session, test_receipt, test_signature, test_permission):
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index=test_receipt.receipt_index,
            customer_id="CUST999",
            operator_id="OPER_001",
            operator_name="张三"
        )
        
        result = service.download_receipt(request)
        
        assert result.success is False
        assert "请求客户与权限客户不一致" in result.error_message
        assert "CUST999" in result.error_message
    
    def test_download_wrong_customer_audit_log_failure(self, db_session, test_receipt, test_signature, test_permission):
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index=test_receipt.receipt_index,
            customer_id="CUST999",
            operator_id="OPER_001",
            operator_name="张三"
        )
        
        result = service.download_receipt(request)
        
        audit = db_session.query(AuditLog).filter(
            AuditLog.operation_type == "RECEIPT_DOWNLOAD"
        ).first()
        assert audit is not None
        assert audit.operation_result == "FAILED"
        assert "请求客户与权限客户不匹配" in audit.operation_details
    
    def test_download_wrong_customer_no_permission_change(self, db_session, test_receipt, test_signature, test_permission):
        original_count = test_permission.current_download_count
        original_active = test_permission.is_active
        
        service = ReceiptService(db_session)
        
        request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index=test_receipt.receipt_index,
            customer_id="CUST999",
            operator_id="OPER_001",
            operator_name="张三"
        )
        
        service.download_receipt(request)
        
        updated_permission = db_session.query(ReprintPermission).filter(
            ReprintPermission.permission_id == test_permission.permission_id
        ).first()
        assert updated_permission.current_download_count == original_count
        assert updated_permission.is_active == original_active
        
        logs = db_session.query(DownloadLog).filter(
            DownloadLog.permission_id == test_permission.permission_id
        ).all()
        assert len(logs) == 0
    
    def test_download_multiple_downloads(self, db_session, test_receipt, test_signature, test_permission):
        test_permission.max_download_count = 3
        db_session.commit()
        
        service = ReceiptService(db_session)
        
        for i in range(3):
            request = DownloadRequest(
                permission_id=test_permission.permission_id,
                receipt_index=test_receipt.receipt_index,
                customer_id=test_receipt.customer_id,
                operator_id="OPER_001",
                operator_name="张三"
            )
            
            result = service.download_receipt(request)
            assert result.success is True
            assert result.download_seq == i + 1
        
        updated_permission = db_session.query(ReprintPermission).filter(
            ReprintPermission.permission_id == test_permission.permission_id
        ).first()
        assert updated_permission.current_download_count == 3
        assert updated_permission.is_active is False
        
        logs = db_session.query(DownloadLog).filter(
            DownloadLog.permission_id == test_permission.permission_id
        ).order_by(DownloadLog.download_seq).all()
        assert len(logs) == 3
        for i, log in enumerate(logs):
            assert log.download_seq == i + 1
        
        fourth_request = DownloadRequest(
            permission_id=test_permission.permission_id,
            receipt_index=test_receipt.receipt_index,
            customer_id=test_receipt.customer_id,
            operator_id="OPER_001",
            operator_name="张三"
        )
        fourth_result = service.download_receipt(fourth_request)
        assert fourth_result.success is False


class TestWatermarkGeneration:
    def test_watermark_contains_all_info(self, db_session):
        import json
        service = ReceiptService(db_session)
        
        watermark = service._generate_watermark(
            receipt_index="RCPT_001",
            download_seq=2,
            operator_name="张三",
            customer_id="CUST001"
        )
        
        data = json.loads(watermark)
        assert data["receipt_index"] == "RCPT_001"
        assert data["download_seq"] == 2
        assert data["operator_name"] == "张三"
        assert data["customer_id"] == "CUST001"
        assert data["is_copy"] is True
        assert "download_time" in data


class TestConcurrentDownload:
    def test_download_logs_and_count_consistent_after_multiple_downloads(
        self, db_session, test_receipt, test_signature, test_permission
    ):
        test_permission.max_download_count = 5
        db_session.commit()
        
        service = ReceiptService(db_session)
        
        for i in range(3):
            request = DownloadRequest(
                permission_id=test_permission.permission_id,
                receipt_index=test_receipt.receipt_index,
                customer_id=test_receipt.customer_id,
                operator_id="OPER_001",
                operator_name="张三"
            )
            service.download_receipt(request)
        
        permission = db_session.query(ReprintPermission).filter(
            ReprintPermission.permission_id == test_permission.permission_id
        ).first()
        
        logs = db_session.query(DownloadLog).filter(
            DownloadLog.permission_id == test_permission.permission_id
        ).all()
        
        assert permission.current_download_count == 3
        assert len(logs) == 3
        
        from app.services.consistency_validator import ConsistencyValidator
        validation = ConsistencyValidator.validate_download_logs_consistency(permission, logs)
        assert validation.valid is True