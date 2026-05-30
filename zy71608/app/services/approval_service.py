from typing import Dict, Any, List, Optional
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models import (
    ReductionApplication,
    ApprovalRecord,
    ApplicationStatus,
    ApprovalAction,
    OperationType,
    AnomalyStatus,
)
from app.services.audit_service import AuditService
from app.services.anomaly_service import AnomalyService
from app.schemas.reduction import AnomalyFlagInfo


class ApprovalService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
        self.anomaly_service = AnomalyService(db)

        self.workflow_steps = [
            {"order": 1, "name": "合同版本校验", "required_status": ApplicationStatus.DRAFT.value},
            {"order": 2, "name": "减免试算", "required_status": ApplicationStatus.PROCESSING.value},
            {"order": 3, "name": "审批状态", "required_status": ApplicationStatus.TRIAL_CALCULATED.value},
            {"order": 4, "name": "异常解释", "required_status": ApplicationStatus.ANOMALY_DETECTED.value},
            {"order": 5, "name": "复核", "required_status": ApplicationStatus.REVIEWING.value},
            {"order": 6, "name": "通过", "required_status": ApplicationStatus.APPROVED.value},
            {"order": 7, "name": "补充协议签署", "required_status": ApplicationStatus.SUPPLEMENTARY_SIGNED.value},
            {"order": 8, "name": "完成", "required_status": ApplicationStatus.COMPLETED.value},
        ]

    def submit_application(self, application_id: int, submitter: str) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status not in [ApplicationStatus.DRAFT.value, ApplicationStatus.REJECTED.value]:
            raise ValueError(f"申请状态为 {application.status}，无法提交")

        application.status = ApplicationStatus.SUBMITTED.value
        application.current_step = "合同版本校验"

        self._create_approval_record(
            application_id=application_id,
            step_order=1,
            step_name="提交申请",
            action=ApprovalAction.SUBMIT.value,
            approver=submitter,
            comments="提交减免申请",
        )

        self.audit_service.log_operation(
            operation_type=OperationType.SUBMIT.value,
            operator=submitter,
            table_name="reduction_applications",
            record_id=application_id,
            new_values={"status": ApplicationStatus.SUBMITTED.value},
            change_reason="提交减免申请",
            application_id=application_id,
        )

        self.db.commit()

        return application

    def process_application(self, application_id: int, processor: str) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status != ApplicationStatus.SUBMITTED.value:
            raise ValueError(f"申请状态为 {application.status}，无法处理")

        application.status = ApplicationStatus.PROCESSING.value
        application.current_step = "减免试算"

        self._create_approval_record(
            application_id=application_id,
            step_order=2,
            step_name="处理",
            action=ApprovalAction.PROCESS.value,
            approver=processor,
            comments="开始处理减免申请",
        )

        self.audit_service.log_operation(
            operation_type=OperationType.UPDATE.value,
            operator=processor,
            table_name="reduction_applications",
            record_id=application_id,
            new_values={"status": ApplicationStatus.PROCESSING.value},
            change_reason="开始处理减免申请",
            application_id=application_id,
        )

        self.db.commit()

        return application

    def start_review(self, application_id: int, reviewer: str) -> ReductionApplication:
        application = self._get_application(application_id)

        valid_statuses = [
            ApplicationStatus.TRIAL_CALCULATED.value,
            ApplicationStatus.ANOMALY_DETECTED.value,
        ]

        if application.status not in valid_statuses:
            raise ValueError(f"申请状态为 {application.status}，无法进入复核")

        open_anomalies = (
            self.db.query(self.anomaly_service.db.query(AnomalyFlagInfo.__class__).filter(
                AnomalyFlagInfo.__class__.application_id == application_id,
                AnomalyFlagInfo.__class__.status == AnomalyStatus.OPEN.value,
            ).exists()).scalar()
        ) if False else False

        anomalies = self.anomaly_service.get_application_anomalies(
            application_id, status=AnomalyStatus.OPEN.value
        )

        if anomalies:
            application.status = ApplicationStatus.ANOMALY_DETECTED.value
            application.current_step = "异常解释"
        else:
            application.status = ApplicationStatus.REVIEWING.value
            application.current_step = "复核"

        self._create_approval_record(
            application_id=application_id,
            step_order=4,
            step_name=application.current_step,
            action=ApprovalAction.REVIEW.value,
            approver=reviewer,
            comments=f"进入{application.current_step}环节",
        )

        self.db.commit()

        return application

    def approve_application(
        self, application_id: int, approver: str, comments: Optional[str] = None
    ) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status == ApplicationStatus.ANOMALY_DETECTED.value:
            open_anomalies = self.anomaly_service.get_application_anomalies(
                application_id, status=AnomalyStatus.OPEN.value
            )
            if open_anomalies:
                raise ValueError(f"存在 {len(open_anomalies)} 个未解决的异常，请先处理")

        if application.status not in [
            ApplicationStatus.REVIEWING.value,
            ApplicationStatus.TRIAL_CALCULATED.value,
            ApplicationStatus.ANOMALY_DETECTED.value,
        ]:
            raise ValueError(f"申请状态为 {application.status}，无法审批通过")

        application.status = ApplicationStatus.APPROVED.value
        application.current_step = "补充协议签署"
        application.approval_comments = comments

        self._create_approval_record(
            application_id=application_id,
            step_order=5,
            step_name="审批通过",
            action=ApprovalAction.APPROVE.value,
            approver=approver,
            comments=comments or "审批通过",
        )

        self.audit_service.log_operation(
            operation_type=OperationType.APPROVE.value,
            operator=approver,
            table_name="reduction_applications",
            record_id=application_id,
            new_values={"status": ApplicationStatus.APPROVED.value},
            change_reason=comments or "审批通过",
            application_id=application_id,
        )

        self.db.commit()

        return application

    def reject_application(
        self, application_id: int, rejector: str, reason: str
    ) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status in [
            ApplicationStatus.COMPLETED.value,
            ApplicationStatus.DRAFT.value,
        ]:
            raise ValueError(f"申请状态为 {application.status}，无法驳回")

        application.status = ApplicationStatus.REJECTED.value
        application.approval_comments = reason

        self._create_approval_record(
            application_id=application_id,
            step_order=0,
            step_name="驳回",
            action=ApprovalAction.REJECT.value,
            approver=rejector,
            comments=reason,
        )

        self.audit_service.log_operation(
            operation_type=OperationType.REJECT.value,
            operator=rejector,
            table_name="reduction_applications",
            record_id=application_id,
            new_values={"status": ApplicationStatus.REJECTED.value},
            change_reason=reason,
            application_id=application_id,
        )

        self.db.commit()

        return application

    def sign_supplementary_agreement(
        self, application_id: int, signer: str, agreement_no: str
    ) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status != ApplicationStatus.APPROVED.value:
            raise ValueError(f"申请状态为 {application.status}，请先完成审批")

        application.status = ApplicationStatus.SUPPLEMENTARY_SIGNED.value
        application.current_step = "完成"

        self._create_approval_record(
            application_id=application_id,
            step_order=6,
            step_name="补充协议签署",
            action=ApprovalAction.SIGN_SUPPLEMENTARY.value,
            approver=signer,
            comments=f"补充协议编号: {agreement_no}",
        )

        self.audit_service.log_operation(
            operation_type=OperationType.UPDATE.value,
            operator=signer,
            table_name="reduction_applications",
            record_id=application_id,
            new_values={"status": ApplicationStatus.SUPPLEMENTARY_SIGNED.value},
            change_reason=f"补充协议已签署: {agreement_no}",
            application_id=application_id,
        )

        self.db.commit()

        return application

    def complete_application(
        self, application_id: int, completer: str
    ) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status != ApplicationStatus.SUPPLEMENTARY_SIGNED.value:
            raise ValueError(f"申请状态为 {application.status}，请先签署补充协议")

        application.status = ApplicationStatus.COMPLETED.value
        application.current_step = "完成"

        self._create_approval_record(
            application_id=application_id,
            step_order=7,
            step_name="完成",
            action=ApprovalAction.COMPLETE.value,
            approver=completer,
            comments="减免审批流程完成",
        )

        self.audit_service.log_operation(
            operation_type=OperationType.UPDATE.value,
            operator=completer,
            table_name="reduction_applications",
            record_id=application_id,
            new_values={"status": ApplicationStatus.COMPLETED.value},
            change_reason="减免审批流程完成",
            application_id=application_id,
        )

        self.db.commit()

        return application

    def revise_application(
        self,
        application_id: int,
        reviser: str,
        update_data: Dict[str, Any],
        reason: str,
    ) -> ReductionApplication:
        application = self._get_application(application_id)

        if application.status == ApplicationStatus.COMPLETED.value:
            raise ValueError("已完成的申请无法修改")

        old_values = {}
        for field, value in update_data.items():
            if hasattr(application, field):
                old_values[field] = getattr(application, field)
                setattr(application, field, value)

        application.manual_override = True
        application.manual_override_reason = reason
        application.manual_override_by = reviser

        if application.status == ApplicationStatus.APPROVED.value:
            application.status = ApplicationStatus.REVIEWING.value
            application.current_step = "复核"

        self._create_approval_record(
            application_id=application_id,
            step_order=3,
            step_name="修改申请",
            action=ApprovalAction.REVISE.value,
            approver=reviser,
            comments=reason,
            is_manual_override=True,
            override_reason=reason,
        )

        self.audit_service.log_manual_override(
            application_id=application_id,
            old_values=old_values,
            new_values=update_data,
            operator=reviser,
            reason=reason,
        )

        self.db.commit()

        return application

    def get_approval_history(self, application_id: int) -> List[Dict[str, Any]]:
        records = (
            self.db.query(ApprovalRecord)
            .filter(ApprovalRecord.application_id == application_id)
            .order_by(ApprovalRecord.step_order, ApprovalRecord.created_at)
            .all()
        )

        history = []
        for record in records:
            history.append({
                "id": record.id,
                "step_order": record.step_order,
                "step_name": record.step_name,
                "action": record.action,
                "approver": record.approver,
                "approval_date": record.approval_date or record.created_at,
                "comments": record.comments,
                "status": record.status,
                "is_manual_override": record.is_manual_override,
                "override_reason": record.override_reason,
            })

        return history

    def get_workflow_status(self, application_id: int) -> Dict[str, Any]:
        application = self._get_application(application_id)

        current_step_index = 0
        for i, step in enumerate(self.workflow_steps):
            if step["name"] == application.current_step:
                current_step_index = i
                break

        steps_status = []
        for i, step in enumerate(self.workflow_steps):
            if i < current_step_index:
                status = "completed"
            elif i == current_step_index:
                status = "current"
            else:
                status = "pending"

            steps_status.append({
                "order": step["order"],
                "name": step["name"],
                "status": status,
                "required_status": step["required_status"],
            })

        anomalies = self.anomaly_service.get_application_anomalies(application_id)
        anomaly_summary = {
            "total": len(anomalies),
            "open": len([a for a in anomalies if a.status == AnomalyStatus.OPEN.value]),
            "resolved": len([a for a in anomalies if a.status == AnomalyStatus.RESOLVED.value]),
            "ignored": len([a for a in anomalies if a.status == AnomalyStatus.IGNORED.value]),
        }

        return {
            "application_id": application_id,
            "application_no": application.application_no,
            "status": application.status,
            "current_step": application.current_step,
            "has_anomaly": application.has_anomaly,
            "manual_override": application.manual_override,
            "steps": steps_status,
            "anomaly_summary": anomaly_summary,
        }

    def _get_application(self, application_id: int) -> ReductionApplication:
        application = (
            self.db.query(ReductionApplication)
            .filter(ReductionApplication.id == application_id)
            .first()
        )
        if not application:
            raise ValueError(f"减免申请 {application_id} 不存在")
        return application

    def _create_approval_record(
        self,
        application_id: int,
        step_order: int,
        step_name: str,
        action: str,
        approver: str,
        comments: Optional[str] = None,
        status: str = "已处理",
        is_manual_override: bool = False,
        override_reason: Optional[str] = None,
    ) -> ApprovalRecord:
        record = ApprovalRecord(
            application_id=application_id,
            step_order=step_order,
            step_name=step_name,
            action=action,
            approver=approver,
            approval_date=date.today(),
            comments=comments,
            status=status,
            is_manual_override=is_manual_override,
            override_reason=override_reason,
            created_by=approver,
            updated_by=approver,
        )
        self.db.add(record)
        self.db.flush()
        return record
