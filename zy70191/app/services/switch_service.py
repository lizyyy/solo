from typing import List, Optional
from datetime import datetime, timedelta
import uuid
from sqlalchemy.orm import Session

from app.models import (
    SwitchRequest, SwitchStatus, Approval, ApprovalStatus,
    DeliveryImpact, ExceptionType
)
from app.schemas import (
    SwitchRequestCreate, SwitchRequestDetail, DeliveryImpactAnalysis,
    SwitchExecutionResult
)
from app.services.supplier_service import SupplierService
from app.services.qualification_service import QualificationService
from app.services.price_service import PriceService
from app.services.exception_service import ExceptionService


class SwitchService:
    def __init__(self, db: Session):
        self.db = db
        self.supplier_service = SupplierService(db)
        self.qualification_service = QualificationService(db)
        self.price_service = PriceService(db)
        self.exception_service = ExceptionService(db)

    def generate_request_no(self) -> str:
        return f"SW-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    def create_switch_request(self, request_data: SwitchRequestCreate) -> SwitchExecutionResult:
        primary_supplier = self.supplier_service.get_supplier(request_data.primary_supplier_id)
        if not primary_supplier:
            return SwitchExecutionResult(
                success=False,
                message="主供应商不存在"
            )

        alternative_supplier = self.supplier_service.get_supplier(request_data.alternative_supplier_id)
        if not alternative_supplier:
            return SwitchExecutionResult(
                success=False,
                message="备选供应商不存在"
            )

        duplicate = self.db.query(SwitchRequest).filter(
            SwitchRequest.primary_supplier_id == request_data.primary_supplier_id,
            SwitchRequest.alternative_supplier_id == request_data.alternative_supplier_id,
            SwitchRequest.product_code == request_data.product_code,
            SwitchRequest.status.in_([SwitchStatus.PENDING, SwitchStatus.APPROVED])
        ).first()

        if duplicate:
            self.exception_service.record_exception(
                exception_type=ExceptionType.DUPLICATE_REQUEST,
                description=f"重复的切换申请检测到：主供应商{primary_supplier.name} -> 备选{alternative_supplier.name}",
                detail=f"已有申请单号: {duplicate.request_no}",
                switch_request_id=duplicate.id
            )
            return SwitchExecutionResult(
                success=False,
                message="存在未完成的重复切换申请",
                details={"existing_request_no": duplicate.request_no}
            )

        switch_request = SwitchRequest(
            request_no=self.generate_request_no(),
            primary_supplier_id=request_data.primary_supplier_id,
            alternative_supplier_id=request_data.alternative_supplier_id,
            product_code=request_data.product_code,
            product_name=request_data.product_name,
            quantity=request_data.quantity,
            reason=request_data.reason,
            requester=request_data.requester,
            requester_department=request_data.requester_department,
            status=SwitchStatus.PENDING
        )
        self.db.add(switch_request)
        self.db.commit()
        self.db.refresh(switch_request)

        return SwitchExecutionResult(
            success=True,
            switch_request_id=switch_request.id,
            message="切换申请创建成功",
            details={"request_no": switch_request.request_no}
        )

    def validate_switch_request(self, switch_request_id: int) -> dict:
        switch_request = self.db.query(SwitchRequest).filter(
            SwitchRequest.id == switch_request_id
        ).first()

        if not switch_request:
            return {"valid": False, "reason": "切换申请不存在"}

        alt_qualification = self.qualification_service.check_qualification(
            switch_request.alternative_supplier_id
        )

        if not alt_qualification.passed:
            self.exception_service.record_exception(
                exception_type=ExceptionType.QUALIFICATION_FAILED,
                description=f"备选供应商资质校验失败: {alt_qualification.message}",
                detail="; ".join(alt_qualification.failed_qualifications),
                switch_request_id=switch_request.id
            )
            return {
                "valid": False,
                "reason": "备选供应商资质校验不通过",
                "details": alt_qualification.failed_qualifications
            }

        price_check = self.price_service.check_price_abnormal(
            switch_request.primary_supplier_id,
            switch_request.alternative_supplier_id,
            switch_request.product_code
        )

        if price_check["is_abnormal"]:
            self.exception_service.record_exception(
                exception_type=ExceptionType.PRICE_ABNORMAL,
                description=f"价格异常检测: {price_check['reason']}",
                detail=str(price_check["details"]),
                switch_request_id=switch_request.id
            )

        return {
            "valid": True,
            "reason": "校验通过",
            "qualification_check": alt_qualification.model_dump(),
            "price_check": price_check
        }

    def get_switch_request(self, request_id: int) -> Optional[SwitchRequest]:
        return self.db.query(SwitchRequest).filter(SwitchRequest.id == request_id).first()

    def get_switch_request_detail(self, request_id: int) -> Optional[SwitchRequestDetail]:
        switch_request = self.get_switch_request(request_id)
        if not switch_request:
            return None

        primary = self.supplier_service.get_supplier(switch_request.primary_supplier_id)
        alternative = self.supplier_service.get_supplier(switch_request.alternative_supplier_id)

        detail = SwitchRequestDetail(
            id=switch_request.id,
            request_no=switch_request.request_no,
            primary_supplier_id=switch_request.primary_supplier_id,
            alternative_supplier_id=switch_request.alternative_supplier_id,
            product_code=switch_request.product_code,
            product_name=switch_request.product_name,
            quantity=switch_request.quantity,
            reason=switch_request.reason,
            status=switch_request.status,
            requester=switch_request.requester,
            requester_department=switch_request.requester_department,
            created_at=switch_request.created_at,
            updated_at=switch_request.updated_at,
            approvals=switch_request.approvals,
            delivery_impacts=switch_request.delivery_impacts,
            exceptions=switch_request.exceptions,
            reports=switch_request.reports,
            primary_supplier=primary,
            alternative_supplier=alternative
        )
        return detail

    def get_all_switch_requests(
        self,
        status: Optional[SwitchStatus] = None,
        limit: int = 100
    ) -> List[SwitchRequest]:
        query = self.db.query(SwitchRequest)
        if status:
            query = query.filter(SwitchRequest.status == status)
        return query.order_by(SwitchRequest.created_at.desc()).limit(limit).all()

    def update_switch_status(self, request_id: int, new_status: SwitchStatus) -> Optional[SwitchRequest]:
        switch_request = self.get_switch_request(request_id)
        if switch_request:
            switch_request.status = new_status
            self.db.commit()
            self.db.refresh(switch_request)
        return switch_request

    def execute_switch(self, request_id: int) -> SwitchExecutionResult:
        switch_request = self.get_switch_request(request_id)
        if not switch_request:
            return SwitchExecutionResult(
                success=False,
                message="切换申请不存在"
            )

        if switch_request.status != SwitchStatus.APPROVED:
            return SwitchExecutionResult(
                success=False,
                message="切换申请尚未获得审批通过，当前状态: " + switch_request.status
            )

        validation = self.validate_switch_request(request_id)
        if not validation["valid"]:
            switch_request.status = SwitchStatus.FAILED
            self.db.commit()
            return SwitchExecutionResult(
                success=False,
                message=validation["reason"],
                details=validation
            )

        switch_request.status = SwitchStatus.EXECUTED
        self.db.commit()
        self.db.refresh(switch_request)

        return SwitchExecutionResult(
            success=True,
            switch_request_id=switch_request.id,
            message="切换执行成功",
            details={
                "request_no": switch_request.request_no,
                "validation": validation
            }
        )
