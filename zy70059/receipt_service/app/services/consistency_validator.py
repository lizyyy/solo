from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Receipt, SignatureRecord, ReprintPermission, DownloadLog
from app.schemas import ValidationResult, SignatureValidationResult


class ConsistencyValidator:
    @staticmethod
    def validate_receipt_signature_consistency(
        receipt: Receipt,
        signature: Optional[SignatureRecord]
    ) -> ValidationResult:
        result = ValidationResult(valid=True, errors=[], warnings=[])
        
        if not signature:
            result.valid = False
            result.errors.append("回单缺少签章记录")
            return result
        
        if signature.receipt_index != receipt.receipt_index:
            result.valid = False
            result.errors.append(
                f"签章记录的回单索引不一致: 回单={receipt.receipt_index}, 签章={signature.receipt_index}"
            )
        
        if signature.original_transaction_id != receipt.original_transaction_id:
            result.valid = False
            result.errors.append(
                f"签章记录的原交易ID不一致: 回单={receipt.original_transaction_id}, 签章={signature.original_transaction_id}"
            )
        
        if signature.verification_status != "VERIFIED":
            result.warnings.append("签章尚未完成验证流程")
        
        return result
    
    @staticmethod
    def validate_permission_receipt_consistency(
        permission: ReprintPermission,
        receipt: Receipt
    ) -> ValidationResult:
        result = ValidationResult(valid=True, errors=[], warnings=[])
        
        if permission.receipt_index != receipt.receipt_index:
            result.valid = False
            result.errors.append(
                f"权限的回单索引不一致: 回单={receipt.receipt_index}, 权限={permission.receipt_index}"
            )
        
        if permission.original_transaction_id != receipt.original_transaction_id:
            result.valid = False
            result.errors.append(
                f"权限的原交易ID不一致: 回单={receipt.original_transaction_id}, 权限={permission.original_transaction_id}"
            )
        
        if permission.customer_id != receipt.customer_id:
            result.valid = False
            result.errors.append(
                f"权限的客户ID不一致: 回单={receipt.customer_id}, 权限={permission.customer_id}"
            )
        
        return result
    
    @staticmethod
    def validate_download_count(
        permission: ReprintPermission
    ) -> ValidationResult:
        result = ValidationResult(valid=True, errors=[], warnings=[])
        
        if permission.current_download_count >= permission.max_download_count:
            result.valid = False
            result.errors.append(
                f"已达到最大下载次数限制: 当前={permission.current_download_count}, 最大={permission.max_download_count}"
            )
        
        if permission.current_download_count < 0:
            result.valid = False
            result.errors.append(
                f"下载计数异常: 当前={permission.current_download_count} < 0"
            )
        
        if permission.current_download_count > 0:
            result.warnings.append(f"该权限已下载过 {permission.current_download_count} 次")
        
        return result
    
    @staticmethod
    def validate_download_logs_consistency(
        permission: ReprintPermission,
        download_logs: List[DownloadLog]
    ) -> ValidationResult:
        result = ValidationResult(valid=True, errors=[], warnings=[])
        
        if len(download_logs) != permission.current_download_count:
            result.valid = False
            result.errors.append(
                f"下载日志数量与计数不一致: 日志={len(download_logs)}, 计数={permission.current_download_count}"
            )
        
        seqs = [log.download_seq for log in download_logs]
        if len(seqs) != len(set(seqs)):
            result.valid = False
            result.errors.append("存在重复的下载序号")
        
        if seqs and max(seqs) != len(seqs):
            result.valid = False
            result.errors.append(f"下载序号不连续: 最大序号={max(seqs)}, 实际数量={len(seqs)}")
        
        for log in download_logs:
            if log.permission_id != permission.permission_id:
                result.valid = False
                result.errors.append(
                    f"下载日志权限ID不一致: 日志={log.permission_id}, 权限={permission.permission_id}"
                )
            if log.original_transaction_id != permission.original_transaction_id:
                result.valid = False
                result.errors.append(
                    f"下载日志原交易ID不一致: 日志={log.original_transaction_id}, 权限={permission.original_transaction_id}"
                )
        
        return result
    
    @staticmethod
    def validate_permission_validity(
        permission: ReprintPermission,
        current_time: Optional[datetime] = None
    ) -> ValidationResult:
        result = ValidationResult(valid=True, errors=[], warnings=[])
        now = current_time or datetime.utcnow()
        
        if not permission.is_active:
            result.valid = False
            result.errors.append("补打权限已失效")
        
        if now < permission.valid_from:
            result.valid = False
            result.errors.append(f"补打权限尚未生效: 生效时间={permission.valid_from}")
        
        if now > permission.valid_until:
            result.valid = False
            result.errors.append(f"补打权限已过期: 失效时间={permission.valid_until}")
        
        return result
    
    @staticmethod
    def validate_full_download_chain(
        receipt: Receipt,
        signature: Optional[SignatureRecord],
        permission: ReprintPermission,
        download_logs: List[DownloadLog]
    ) -> ValidationResult:
        result = ValidationResult(valid=True, errors=[], warnings=[])
        
        sig_check = ConsistencyValidator.validate_receipt_signature_consistency(receipt, signature)
        if not sig_check.valid:
            result.errors.extend(sig_check.errors)
        result.warnings.extend(sig_check.warnings)
        
        perm_check = ConsistencyValidator.validate_permission_receipt_consistency(permission, receipt)
        if not perm_check.valid:
            result.errors.extend(perm_check.errors)
        result.warnings.extend(perm_check.warnings)
        
        count_check = ConsistencyValidator.validate_download_count(permission)
        if not count_check.valid:
            result.errors.extend(count_check.errors)
        result.warnings.extend(count_check.warnings)
        
        log_check = ConsistencyValidator.validate_download_logs_consistency(permission, download_logs)
        if not log_check.valid:
            result.errors.extend(log_check.errors)
        result.warnings.extend(log_check.warnings)
        
        validity_check = ConsistencyValidator.validate_permission_validity(permission)
        if not validity_check.valid:
            result.errors.extend(validity_check.errors)
        
        result.valid = len(result.errors) == 0
        return result