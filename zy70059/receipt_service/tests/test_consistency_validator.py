import pytest
from datetime import datetime, timedelta
from app.services.consistency_validator import ConsistencyValidator
from app.models import DownloadLog


class TestReceiptSignatureConsistency:
    def test_valid_signature_matches_receipt(self, test_receipt, test_signature):
        result = ConsistencyValidator.validate_receipt_signature_consistency(
            test_receipt, test_signature
        )
        assert result.valid is True
        assert len(result.errors) == 0
    
    def test_signature_missing_returns_error(self, test_receipt):
        result = ConsistencyValidator.validate_receipt_signature_consistency(
            test_receipt, None
        )
        assert result.valid is False
        assert "缺少签章" in result.errors[0]
    
    def test_signature_receipt_index_mismatch(self, test_receipt, test_signature):
        test_signature.receipt_index = "DIFFERENT_INDEX"
        
        result = ConsistencyValidator.validate_receipt_signature_consistency(
            test_receipt, test_signature
        )
        assert result.valid is False
        assert "回单索引不一致" in result.errors[0]
    
    def test_signature_transaction_id_mismatch(self, test_receipt, test_signature):
        test_signature.original_transaction_id = "DIFFERENT_TXN"
        
        result = ConsistencyValidator.validate_receipt_signature_consistency(
            test_receipt, test_signature
        )
        assert result.valid is False
        assert "原交易ID不一致" in result.errors[0]
    
    def test_unverified_signature_returns_warning(self, test_receipt, test_signature):
        test_signature.verification_status = "PENDING"
        
        result = ConsistencyValidator.validate_receipt_signature_consistency(
            test_receipt, test_signature
        )
        assert result.valid is True
        assert len(result.warnings) == 1
        assert "尚未完成验证" in result.warnings[0]


class TestPermissionReceiptConsistency:
    def test_valid_permission_matches_receipt(self, test_permission, test_receipt):
        result = ConsistencyValidator.validate_permission_receipt_consistency(
            test_permission, test_receipt
        )
        assert result.valid is True
    
    def test_permission_receipt_index_mismatch(self, test_permission, test_receipt):
        test_permission.receipt_index = "WRONG_INDEX"
        
        result = ConsistencyValidator.validate_permission_receipt_consistency(
            test_permission, test_receipt
        )
        assert result.valid is False
        assert "回单索引不一致" in result.errors[0]
    
    def test_permission_transaction_id_mismatch(self, test_permission, test_receipt):
        test_permission.original_transaction_id = "WRONG_TXN"
        
        result = ConsistencyValidator.validate_permission_receipt_consistency(
            test_permission, test_receipt
        )
        assert result.valid is False
        assert "原交易ID不一致" in result.errors[0]
    
    def test_permission_customer_id_mismatch(self, test_permission, test_receipt):
        test_permission.customer_id = "WRONG_CUST"
        
        result = ConsistencyValidator.validate_permission_receipt_consistency(
            test_permission, test_receipt
        )
        assert result.valid is False
        assert "客户ID不一致" in result.errors[0]


class TestDownloadCount:
    def test_count_below_max_is_valid(self, test_permission):
        test_permission.max_download_count = 3
        test_permission.current_download_count = 1
        
        result = ConsistencyValidator.validate_download_count(test_permission)
        assert result.valid is True
        assert len(result.warnings) == 1
    
    def test_count_at_max_is_invalid(self, test_permission):
        test_permission.max_download_count = 3
        test_permission.current_download_count = 3
        
        result = ConsistencyValidator.validate_download_count(test_permission)
        assert result.valid is False
        assert "最大下载次数限制" in result.errors[0]
    
    def test_negative_count_is_invalid(self, test_permission):
        test_permission.current_download_count = -1
        
        result = ConsistencyValidator.validate_download_count(test_permission)
        assert result.valid is False
        assert "下载计数异常" in result.errors[0]


class TestDownloadLogsConsistency:
    def test_logs_count_matches_permission(self, test_permission, db_session, test_receipt):
        logs = [
            DownloadLog(
                log_id=f"LOG_{i}",
                receipt_id=test_receipt.id,
                receipt_index=test_receipt.receipt_index,
                permission_id=test_permission.permission_id,
                customer_id=test_permission.customer_id,
                original_transaction_id=test_permission.original_transaction_id,
                operator_id="OPER_001",
                operator_name="张三",
                download_seq=i + 1,
                status="SUCCESS"
            )
            for i in range(2)
        ]
        test_permission.current_download_count = 2
        
        result = ConsistencyValidator.validate_download_logs_consistency(
            test_permission, logs
        )
        assert result.valid is True
    
    def test_logs_count_mismatch(self, test_permission, test_receipt):
        logs = [
            DownloadLog(
                log_id="LOG_1",
                receipt_id=test_receipt.id,
                receipt_index=test_receipt.receipt_index,
                permission_id=test_permission.permission_id,
                customer_id=test_permission.customer_id,
                original_transaction_id=test_permission.original_transaction_id,
                operator_id="OPER_001",
                operator_name="张三",
                download_seq=1,
                status="SUCCESS"
            )
        ]
        test_permission.current_download_count = 3
        
        result = ConsistencyValidator.validate_download_logs_consistency(
            test_permission, logs
        )
        assert result.valid is False
        assert "不一致" in result.errors[0]
    
    def test_duplicate_seq(self, test_permission, test_receipt):
        logs = [
            DownloadLog(
                log_id=f"LOG_{i}",
                receipt_id=test_receipt.id,
                receipt_index=test_receipt.receipt_index,
                permission_id=test_permission.permission_id,
                customer_id=test_permission.customer_id,
                original_transaction_id=test_permission.original_transaction_id,
                operator_id="OPER_001",
                operator_name="张三",
                download_seq=1,
                status="SUCCESS"
            )
            for i in range(2)
        ]
        test_permission.current_download_count = 2
        
        result = ConsistencyValidator.validate_download_logs_consistency(
            test_permission, logs
        )
        assert result.valid is False
        assert "重复的下载序号" in result.errors[0]
    
    def test_non_continuous_seq(self, test_permission, test_receipt):
        logs = [
            DownloadLog(
                log_id="LOG_1",
                receipt_id=test_receipt.id,
                receipt_index=test_receipt.receipt_index,
                permission_id=test_permission.permission_id,
                customer_id=test_permission.customer_id,
                original_transaction_id=test_permission.original_transaction_id,
                operator_id="OPER_001",
                operator_name="张三",
                download_seq=1,
                status="SUCCESS"
            ),
            DownloadLog(
                log_id="LOG_2",
                receipt_id=test_receipt.id,
                receipt_index=test_receipt.receipt_index,
                permission_id=test_permission.permission_id,
                customer_id=test_permission.customer_id,
                original_transaction_id=test_permission.original_transaction_id,
                operator_id="OPER_001",
                operator_name="张三",
                download_seq=3,
                status="SUCCESS"
            ),
        ]
        test_permission.current_download_count = 2
        
        result = ConsistencyValidator.validate_download_logs_consistency(
            test_permission, logs
        )
        assert result.valid is False
        assert "不连续" in result.errors[0]


class TestPermissionValidity:
    def test_active_valid_permission(self, test_permission):
        result = ConsistencyValidator.validate_permission_validity(test_permission)
        assert result.valid is True
    
    def test_inactive_permission(self, test_permission):
        test_permission.is_active = False
        
        result = ConsistencyValidator.validate_permission_validity(test_permission)
        assert result.valid is False
        assert "已失效" in result.errors[0]
    
    def test_not_yet_effective_permission(self, test_permission):
        test_permission.valid_from = datetime.utcnow() + timedelta(days=1)
        
        result = ConsistencyValidator.validate_permission_validity(test_permission)
        assert result.valid is False
        assert "尚未生效" in result.errors[0]
    
    def test_expired_permission(self, test_permission):
        test_permission.valid_until = datetime.utcnow() - timedelta(days=1)
        
        result = ConsistencyValidator.validate_permission_validity(test_permission)
        assert result.valid is False
        assert "已过期" in result.errors[0]
    
    def test_custom_time_validation(self, test_permission):
        past_time = datetime(2020, 1, 1)
        
        result = ConsistencyValidator.validate_permission_validity(
            test_permission, current_time=past_time
        )
        assert result.valid is False
        assert "尚未生效" in result.errors[0]


class TestFullDownloadChain:
    def test_full_chain_valid(self, test_receipt, test_signature, test_permission):
        result = ConsistencyValidator.validate_full_download_chain(
            receipt=test_receipt,
            signature=test_signature,
            permission=test_permission,
            download_logs=[]
        )
        assert result.valid is True
    
    def test_full_chain_with_valid_downloads(self, test_receipt, test_signature, test_permission):
        logs = [
            DownloadLog(
                log_id=f"LOG_{i}",
                receipt_id=test_receipt.id,
                receipt_index=test_receipt.receipt_index,
                permission_id=test_permission.permission_id,
                customer_id=test_permission.customer_id,
                original_transaction_id=test_permission.original_transaction_id,
                operator_id="OPER_001",
                operator_name="张三",
                download_seq=i + 1,
                status="SUCCESS"
            )
            for i in range(1)
        ]
        test_permission.current_download_count = 1
        test_permission.max_download_count = 3
        
        result = ConsistencyValidator.validate_full_download_chain(
            receipt=test_receipt,
            signature=test_signature,
            permission=test_permission,
            download_logs=logs
        )
        assert result.valid is True
    
    def test_full_chain_multiple_errors(self, test_receipt, test_signature, test_permission):
        test_signature.receipt_index = "WRONG"
        test_permission.customer_id = "WRONG_CUST"
        test_permission.current_download_count = 99
        test_permission.max_download_count = 3
        
        result = ConsistencyValidator.validate_full_download_chain(
            receipt=test_receipt,
            signature=test_signature,
            permission=test_permission,
            download_logs=[]
        )
        assert result.valid is False
        assert len(result.errors) >= 3