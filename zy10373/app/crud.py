import hashlib
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models import ExportRequest, Watermark, AuditLog, IdempotentRequest, ExportStatus
from app.schemas import ExportRequestCreate, WatermarkGenerateRequest, ExpiryPolicy
from app.core.watermark import WatermarkGenerator
from app.core.expiry import ExpiryManager
from app.core.signature import DownloadSignatureGenerator


def _json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


STATUS_TRANSITION_RULES = {
    ExportStatus.PENDING: [ExportStatus.VALIDATING, ExportStatus.REJECTED],
    ExportStatus.VALIDATING: [ExportStatus.APPROVED, ExportStatus.REJECTED, ExportStatus.PENDING],
    ExportStatus.APPROVED: [ExportStatus.GENERATING, ExportStatus.REJECTED],
    ExportStatus.GENERATING: [ExportStatus.READY, ExportStatus.FAILED],
    ExportStatus.READY: [ExportStatus.DOWNLOADED, ExportStatus.EXPIRED],
    ExportStatus.DOWNLOADED: [],
    ExportStatus.EXPIRED: [],
    ExportStatus.REJECTED: [],
    ExportStatus.FAILED: []
}


class CRUDOperations:
    def __init__(self, db: Session):
        self.db = db
        self.expiry_manager = ExpiryManager(db)
        self.watermark_generator = WatermarkGenerator()

    def _calculate_request_hash(self, request_data: Any) -> str:
        data_str = json.dumps(request_data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()

    def check_idempotency(self, idempotency_key: str, request_data: Any) -> Optional[Dict[str, Any]]:
        request_hash = self._calculate_request_hash(request_data)
        existing = self.db.query(IdempotentRequest).filter(
            IdempotentRequest.idempotency_key == idempotency_key
        ).first()
        
        if existing:
            if existing.request_hash == request_hash:
                return existing.response_data
            else:
                raise ValueError("Idempotency key mismatch with different request data")
        return None

    def save_idempotent_response(
        self,
        idempotency_key: str,
        request_data: Any,
        response_data: Dict[str, Any]
    ):
        request_hash = self._calculate_request_hash(request_data)
        serialized_response = json.loads(json.dumps(response_data, default=_json_serializer))
        idempotent_req = IdempotentRequest(
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            response_data=serialized_response
        )
        self.db.add(idempotent_req)
        self.db.commit()

    def create_export_request(self, request: ExportRequestCreate) -> ExportRequest:
        field_scope_dicts = [fs.model_dump() for fs in request.field_scope]
        
        expiry_policy = request.expiry_policy
        expiry_time = self.expiry_manager.calculate_expiry_time(expiry_policy)

        export_request = ExportRequest(
            request_id=request.request_id,
            requester_id=request.requester_id,
            requester_name=request.requester_name,
            data_source=request.data_source,
            field_scope=field_scope_dicts,
            expiry_policy=expiry_policy.model_dump(),
            expiry_time=expiry_time,
            status=ExportStatus.PENDING,
            current_handler=request.requester_id
        )
        
        self.db.add(export_request)
        self.db.commit()
        self.db.refresh(export_request)
        
        self._add_audit_log(
            export_request.id,
            "CREATE",
            None,
            ExportStatus.PENDING,
            request.requester_id,
            request.requester_name,
            "创建导出申请"
        )
        
        return export_request

    def get_export_request(self, request_id: str) -> Optional[ExportRequest]:
        return self.db.query(ExportRequest).filter(
            ExportRequest.request_id == request_id
        ).first()

    def update_status(
        self,
        request_id: str,
        new_status: ExportStatus,
        operator_id: str,
        operator_name: str,
        remark: Optional[str] = None
    ) -> ExportRequest:
        export_request = self.get_export_request(request_id)
        if not export_request:
            raise ValueError(f"Export request {request_id} not found")
        
        old_status = export_request.status
        
        if old_status == new_status:
            return export_request
        
        if old_status not in STATUS_TRANSITION_RULES:
            raise ValueError(f"未知的当前状态: {old_status}")
        
        allowed_transitions = STATUS_TRANSITION_RULES[old_status]
        if new_status not in allowed_transitions:
            raise ValueError(
                f"非法的状态转换: {old_status} -> {new_status}，"
                f"允许的目标状态: {', '.join(allowed_transitions)}"
            )
        
        export_request.status = new_status
        export_request.current_handler = operator_id
        
        if new_status in [ExportStatus.DOWNLOADED, ExportStatus.REJECTED, ExportStatus.EXPIRED]:
            export_request.final_conclusion = remark or f"状态变更为 {new_status}"
        
        self.db.commit()
        self.db.refresh(export_request)
        
        self._add_audit_log(
            export_request.id,
            "STATUS_UPDATE",
            old_status,
            new_status,
            operator_id,
            operator_name,
            remark or f"状态从 {old_status} 变更为 {new_status}"
        )
        
        return export_request

    def generate_watermark(self, request: WatermarkGenerateRequest, operator_id: str) -> Watermark:
        export_request = self.get_export_request(request.request_id)
        if not export_request:
            raise ValueError(f"Export request {request.request_id} not found")
        
        watermark_id = self.watermark_generator.generate_watermark_id()
        
        if request.watermark_type == "text":
            content = self.watermark_generator.generate_text_watermark(
                export_request.requester_id,
                export_request.requester_name,
                request.request_id,
                datetime.now()
            )
        elif request.watermark_type == "qrcode":
            content = self.watermark_generator.generate_qrcode_watermark(
                export_request.requester_id,
                request.request_id,
                f"/api/v1/exports/{request.request_id}/download"
            )
        else:
            content = self.watermark_generator.generate_custom_watermark(
                request.watermark_content,
                export_request.requester_id,
                request.request_id
            )
        
        watermark = Watermark(
            watermark_id=watermark_id,
            export_request_id=export_request.id,
            watermark_type=request.watermark_type,
            content=content,
            generated_by=operator_id
        )
        
        self.db.add(watermark)
        export_request.watermark_id = watermark_id
        export_request.watermark_content = content
        self.db.commit()
        self.db.refresh(watermark)
        
        self._add_audit_log(
            export_request.id,
            "WATERMARK_GENERATE",
            export_request.status,
            export_request.status,
            operator_id,
            operator_id,
            f"生成水印 {watermark_id}"
        )
        
        return watermark

    def generate_download_signature(
        self,
        request_id: str,
        downloader_id: str,
        downloader_name: str
    ) -> Dict[str, Any]:
        export_request = self.get_export_request(request_id)
        if not export_request:
            raise ValueError(f"Export request {request_id} not found")
        
        if export_request.status != ExportStatus.READY:
            raise ValueError(f"Export request {request_id} is not ready for download")
        
        if not export_request.expiry_time:
            raise ValueError(f"Export request {request_id} 未设置过期时间")
        
        if datetime.now() > export_request.expiry_time:
            export_request.status = ExportStatus.EXPIRED
            export_request.final_conclusion = "导出申请已过期"
            self.db.commit()
            self.db.refresh(export_request)
            raise ValueError(f"Export request {request_id} 已过期，无法生成下载签名")
        
        expiry_policy = ExpiryPolicy(**export_request.expiry_policy)
        signature_result = DownloadSignatureGenerator.generate_signature(
            request_id,
            downloader_id,
            downloader_name,
            expiry_policy
        )
        
        export_request.download_signature = signature_result["signature"]
        self.db.commit()
        
        self._add_audit_log(
            export_request.id,
            "SIGNATURE_GENERATE",
            export_request.status,
            export_request.status,
            downloader_id,
            downloader_name,
            "生成下载签名"
        )
        
        return signature_result

    def _add_audit_log(
        self,
        export_request_id: int,
        action: str,
        old_status: Optional[str],
        new_status: Optional[str],
        operator_id: str,
        operator_name: str,
        remark: str
    ):
        audit_log = AuditLog(
            export_request_id=export_request_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            operator_id=operator_id,
            operator_name=operator_name,
            remark=remark
        )
        self.db.add(audit_log)
        self.db.commit()

    def get_audit_logs(self, request_id: str) -> List[AuditLog]:
        export_request = self.get_export_request(request_id)
        if not export_request:
            return []
        return self.db.query(AuditLog).filter(
            AuditLog.export_request_id == export_request.id
        ).order_by(AuditLog.created_at.desc()).all()

    def query_export_history(
        self,
        requester_id: Optional[str] = None,
        status: Optional[ExportStatus] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[List[ExportRequest], int]:
        query = self.db.query(ExportRequest)
        
        if requester_id:
            query = query.filter(ExportRequest.requester_id == requester_id)
        if status:
            query = query.filter(ExportRequest.status == status)
        if start_time:
            query = query.filter(ExportRequest.created_at >= start_time)
        if end_time:
            query = query.filter(ExportRequest.created_at <= end_time)
        
        total = query.count()
        query = query.order_by(ExportRequest.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        return query.all(), total
