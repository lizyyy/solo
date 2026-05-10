import time
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    MessageMetadata,
    ReplayRequest,
    ReplayExecution,
    ReplayReport,
    ApprovalStatus,
    ExecutionStatus,
    IdempotencyStatus,
)
from ..exceptions import (
    ApprovalRequiredError,
    RequestAlreadyProcessedError,
    NoMessagesFoundError,
)
from ..utils import (
    generate_request_id,
    generate_execution_id,
    generate_report_id,
    generate_idempotency_key,
)
from .message_locator import MessageLocator
from .idempotency_service import IdempotencyService
from .rate_limiter import RateLimiter


class ReplayService:
    def __init__(
        self,
        db: Optional[Session] = None,
        message_handler: Optional[Callable] = None,
    ):
        self.db = db or SessionLocal()
        self.message_handler = message_handler or self._default_message_handler

    def close(self):
        if self.db:
            self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _default_message_handler(self, message: MessageMetadata) -> Dict[str, Any]:
        return {
            "status": "success",
            "message_id": message.message_id,
            "topic": message.topic,
            "processed_at": datetime.utcnow().isoformat(),
        }

    def create_request(
        self,
        requester: str,
        reason: str,
        scope_type: str,
        scope_value: Dict[str, Any],
        target_environment: str = "prod",
        target_topic: Optional[str] = None,
        rate_limit_per_second: int = 10,
        rate_limit_per_minute: int = 300,
        rate_limit_per_hour: int = 10000,
        topic: Optional[str] = None,
        business_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        with MessageLocator(self.db) as locator:
            messages = locator.locate(scope_type, scope_value, topic, business_type)
            summary = locator.get_message_summary(messages)

        request = ReplayRequest(
            request_id=generate_request_id(),
            requester=requester,
            reason=reason,
            scope_type=scope_type,
            scope_value=scope_value,
            target_topic=target_topic,
            target_environment=target_environment,
            rate_limit_per_second=rate_limit_per_second,
            rate_limit_per_minute=rate_limit_per_minute,
            rate_limit_per_hour=rate_limit_per_hour,
            approval_status=ApprovalStatus.PENDING,
            execution_status=ExecutionStatus.PENDING,
        )
        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)

        return {
            "request_id": request.request_id,
            "requester": request.requester,
            "approval_status": request.approval_status,
            "target_environment": request.target_environment,
            "message_summary": {
                "total_messages": summary["count"],
                "total_amount": summary["total_amount"],
                "total_quantity": summary["total_quantity"],
                "total_quota": summary["total_quota"],
                "business_types": summary["business_types"],
                "topics": summary["topics"],
                "time_range": summary["time_range"],
            },
            "created_at": request.created_at.isoformat(),
        }

    def approve_request(
        self,
        request_id: str,
        approver: str,
        approval_comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        request = (
            self.db.query(ReplayRequest)
            .filter(ReplayRequest.request_id == request_id)
            .first()
        )
        if not request:
            raise ValueError(f"找不到重放请求: {request_id}")

        request.approval_status = ApprovalStatus.APPROVED
        request.approver = approver
        request.approval_comment = approval_comment
        request.approved_at = datetime.utcnow()
        request.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(request)

        return {
            "request_id": request.request_id,
            "approver": approver,
            "approval_status": request.approval_status,
            "approved_at": request.approved_at.isoformat(),
        }

    def reject_request(
        self,
        request_id: str,
        approver: str,
        rejection_reason: str,
    ) -> Dict[str, Any]:
        request = (
            self.db.query(ReplayRequest)
            .filter(ReplayRequest.request_id == request_id)
            .first()
        )
        if not request:
            raise ValueError(f"找不到重放请求: {request_id}")

        request.approval_status = ApprovalStatus.REJECTED
        request.approver = approver
        request.approval_comment = rejection_reason
        request.approved_at = datetime.utcnow()
        request.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(request)

        return {
            "request_id": request.request_id,
            "approver": approver,
            "approval_status": request.approval_status,
            "rejection_reason": rejection_reason,
            "rejected_at": request.approved_at.isoformat(),
        }

    def execute_request(
        self,
        request_id: str,
        executor: str,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        request = (
            self.db.query(ReplayRequest)
            .filter(ReplayRequest.request_id == request_id)
            .first()
        )
        if not request:
            raise ValueError(f"找不到重放请求: {request_id}")

        if request.approval_status != ApprovalStatus.APPROVED:
            raise ApprovalRequiredError(request_id)

        if request.execution_status in [ExecutionStatus.SUCCESS, ExecutionStatus.RUNNING]:
            raise RequestAlreadyProcessedError(request_id)

        with MessageLocator(self.db) as locator:
            messages = locator.locate(request.scope_type, request.scope_value)
            summary = locator.get_message_summary(messages)

        rate_limiter = RateLimiter(
            per_second=request.rate_limit_per_second,
            per_minute=request.rate_limit_per_minute,
            per_hour=request.rate_limit_per_hour,
        )

        request.execution_status = ExecutionStatus.RUNNING
        request.started_at = datetime.utcnow()
        request.updated_at = datetime.utcnow()
        self.db.commit()

        success_count = 0
        failed_count = 0
        skipped_count = 0

        results = []

        for idx, message in enumerate(messages, 1):
            execution = ReplayExecution(
                execution_id=generate_execution_id(),
                request_id=request_id,
                message_id=message.message_id,
                execution_order=idx,
                status=ExecutionStatus.PENDING,
            )
            self.db.add(execution)
            self.db.commit()
            self.db.refresh(execution)

            idempotency_service = IdempotencyService(self.db)
            idempotency_result = idempotency_service.check_or_create(message, request_id)

            if idempotency_result["should_skip"]:
                execution.status = ExecutionStatus.SKIPPED
                execution.error_message = idempotency_result["reason"]
                self.db.commit()

                skipped_count += 1
                results.append(
                    {
                        "message_id": message.message_id,
                        "business_key": message.business_key,
                        "status": "已跳过",
                        "reason": idempotency_result["reason"],
                    }
                )
                continue

            rate_limiter.wait()

            execution.status = ExecutionStatus.RUNNING
            execution.start_time = datetime.utcnow()
            self.db.commit()

            try:
                if dry_run:
                    handler_result = {
                        "status": "success",
                        "dry_run": True,
                        "message": "试运行模式，未实际重放",
                    }
                else:
                    handler_result = self.message_handler(message)

                idempotency_key = idempotency_result["record"].idempotency_key
                idempotency_service.mark_success(idempotency_key, handler_result)

                execution.status = ExecutionStatus.SUCCESS
                execution.end_time = datetime.utcnow()
                execution.duration_ms = int(
                    (execution.end_time - execution.start_time).total_seconds() * 1000
                )
                execution.response_data = handler_result
                self.db.commit()

                success_count += 1
                results.append(
                    {
                        "message_id": message.message_id,
                        "business_key": message.business_key,
                        "status": "执行成功",
                        "amount": message.amount,
                        "quantity": message.quantity,
                        "quota": message.quota,
                        "duration_ms": execution.duration_ms,
                    }
                )

            except Exception as e:
                error_msg = str(e)
                execution.status = ExecutionStatus.FAILED
                execution.end_time = datetime.utcnow()
                execution.duration_ms = int(
                    (execution.end_time - execution.start_time).total_seconds() * 1000
                )
                execution.error_message = error_msg
                self.db.commit()

                if idempotency_result.get("record"):
                    idempotency_service.mark_failed(
                        idempotency_result["record"].idempotency_key, error_msg
                    )

                failed_count += 1
                results.append(
                    {
                        "message_id": message.message_id,
                        "business_key": message.business_key,
                        "status": "执行失败",
                        "error": error_msg,
                        "amount": message.amount,
                        "quantity": message.quantity,
                        "quota": message.quota,
                    }
                )

        request.execution_status = (
            ExecutionStatus.SUCCESS if failed_count == 0 else ExecutionStatus.FAILED
        )
        request.completed_at = datetime.utcnow()
        request.updated_at = datetime.utcnow()
        self.db.commit()

        report = ReplayReport(
            report_id=generate_report_id(),
            request_id=request_id,
            total_messages=len(messages),
            success_count=success_count,
            failed_count=failed_count,
            skipped_count=skipped_count,
            start_time=request.started_at,
            end_time=request.completed_at,
            total_duration_ms=int(
                (request.completed_at - request.started_at).total_seconds() * 1000
            ),
            executor=executor,
            summary=self._generate_summary(results, summary),
            total_amount=summary["total_amount"],
            total_quantity=summary["total_quantity"],
            total_quota=summary["total_quota"],
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)

        return {
            "request_id": request_id,
            "report_id": report.report_id,
            "executor": executor,
            "dry_run": dry_run,
            "summary": {
                "total_messages": report.total_messages,
                "success_count": report.success_count,
                "failed_count": report.failed_count,
                "skipped_count": report.skipped_count,
                "total_duration_ms": report.total_duration_ms,
                "total_amount": report.total_amount,
                "total_quantity": report.total_quantity,
                "total_quota": report.total_quota,
                "success_rate": (
                    100.0
                    * report.success_count
                    / (report.success_count + report.failed_count)
                    if (report.success_count + report.failed_count) > 0
                    else 0.0
                ),
            },
            "execution_results": results,
            "completed_at": request.completed_at.isoformat(),
        }

    def _generate_summary(
        self,
        results: List[Dict[str, Any]],
        message_summary: Dict[str, Any],
    ) -> str:
        parts = []

        success_results = [r for r in results if r["status"] == "执行成功"]
        if success_results:
            success_amount = sum(r.get("amount", 0) or 0 for r in success_results)
            success_qty = sum(r.get("quantity", 0) or 0 for r in success_results)
            success_quota = sum(r.get("quota", 0) or 0 for r in success_results)
            parts.append(
                f"成功处理 {len(success_results)} 条消息，涉及金额 {success_amount:.2f} 元，"
                f"数量 {success_qty}，名额 {success_quota}"
            )

        skipped_results = [r for r in results if r["status"] == "已跳过"]
        if skipped_results:
            parts.append(
                f"跳过 {len(skipped_results)} 条消息，主要原因：幂等性校验"
            )

        failed_results = [r for r in results if r["status"] == "执行失败"]
        if failed_results:
            failed_message_ids = [r["message_id"] for r in failed_results[:5]]
            parts.append(
                f"失败 {len(failed_results)} 条消息，涉及的消息ID示例："
                f"{', '.join(failed_message_ids)}"
            )

        if not parts:
            parts.append("本次重放未处理任何消息")

        return " | ".join(parts)

    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        request = (
            self.db.query(ReplayRequest)
            .filter(ReplayRequest.request_id == request_id)
            .first()
        )
        if not request:
            return None
        return {
            "request_id": request.request_id,
            "requester": request.requester,
            "reason": request.reason,
            "scope_type": request.scope_type,
            "scope_value": request.scope_value,
            "target_environment": request.target_environment,
            "approval_status": request.approval_status,
            "approver": request.approver,
            "approval_comment": request.approval_comment,
            "execution_status": request.execution_status,
            "started_at": request.started_at.isoformat() if request.started_at else None,
            "completed_at": request.completed_at.isoformat() if request.completed_at else None,
            "created_at": request.created_at.isoformat(),
        }

    def get_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        report = (
            self.db.query(ReplayReport)
            .filter(ReplayReport.report_id == report_id)
            .first()
        )
        if not report:
            return None

        executions = (
            self.db.query(ReplayExecution)
            .filter(ReplayExecution.request_id == report.request_id)
            .order_by(ReplayExecution.execution_order)
            .all()
        )

        return {
            "report_id": report.report_id,
            "request_id": report.request_id,
            "summary": {
                "total_messages": report.total_messages,
                "success_count": report.success_count,
                "failed_count": report.failed_count,
                "skipped_count": report.skipped_count,
                "total_amount": report.total_amount,
                "total_quantity": report.total_quantity,
                "total_quota": report.total_quota,
                "total_duration_ms": report.total_duration_ms,
                "executor": report.executor,
                "summary": report.summary,
            },
            "executions": [
                {
                    "execution_id": e.execution_id,
                    "message_id": e.message_id,
                    "status": e.status,
                    "execution_order": e.execution_order,
                    "duration_ms": e.duration_ms,
                    "error_message": e.error_message,
                }
                for e in executions
            ],
            "created_at": report.created_at.isoformat(),
        }
