import uuid
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List, Optional, Tuple
from threading import Thread

from ..models.models import (
    RunRequest, Student, LanguageEnvironment, StatusHistory,
    TimeoutRecord, RequestStatus, ResultSummary
)
from ..schemas.schemas import RunRequestCreate, RunRequestUpdate
from .quota_service import QuotaService
from .code_executor import CodeExecutor, ExecutionResult
from ..core.config import settings


class RequestService:
    @staticmethod
    def generate_request_id() -> str:
        return f"req-{uuid.uuid4().hex[:12]}"

    @staticmethod
    def generate_code_hash(code: str, language_id: int, student_id: int) -> str:
        content = f"{student_id}:{language_id}:{code.strip()}"
        return hashlib.md5(content.encode()).hexdigest()

    @staticmethod
    def find_duplicate_request(db: Session, student_id: int, language_id: int, code_snippet: str) -> Optional[RunRequest]:
        recent_time = datetime.utcnow() - timedelta(minutes=5)
        return db.query(RunRequest).filter(
            RunRequest.student_id == student_id,
            RunRequest.language_id == language_id,
            RunRequest.code_snippet == code_snippet.strip(),
            RunRequest.created_at >= recent_time,
            RunRequest.status.in_([RequestStatus.PENDING, RequestStatus.QUEUED, RequestStatus.RUNNING, RequestStatus.SUCCESS])
        ).order_by(desc(RunRequest.created_at)).first()

    @staticmethod
    def add_status_history(db: Session, request_id: int, from_status: Optional[str], to_status: str, message: Optional[str] = None):
        history = StatusHistory(
            request_id=request_id,
            from_status=from_status,
            to_status=to_status,
            message=message
        )
        db.add(history)
        db.commit()

    @staticmethod
    def create_request(db: Session, request_data: RunRequestCreate) -> Tuple[RunRequest, bool]:
        duplicate = RequestService.find_duplicate_request(
            db, request_data.student_id, request_data.language_id, request_data.code_snippet
        )

        if duplicate:
            RequestService.add_status_history(
                db, duplicate.id, duplicate.status, RequestStatus.MERGED,
                f"合并来自重复提交的请求"
            )
            duplicate.status = RequestStatus.MERGED
            duplicate.merged_from = RequestService.generate_request_id()
            db.commit()
            db.refresh(duplicate)
            return duplicate, True

        can_submit, message = QuotaService.can_submit_request(db, request_data.student_id)
        if not can_submit:
            raise ValueError(message)

        request_id = RequestService.generate_request_id()
        db_request = RunRequest(
            request_id=request_id,
            student_id=request_data.student_id,
            language_id=request_data.language_id,
            code_snippet=request_data.code_snippet.strip(),
            input_data=request_data.input_data,
            priority=request_data.priority,
            status=RequestStatus.PENDING
        )
        db.add(db_request)
        db.commit()
        db.refresh(db_request)

        RequestService.add_status_history(db, db_request.id, None, RequestStatus.PENDING, "请求已创建")

        QuotaService.consume_quota(db, request_data.student_id)

        return db_request, False

    @staticmethod
    def get_request(db: Session, request_id: str) -> Optional[RunRequest]:
        return db.query(RunRequest).filter(RunRequest.request_id == request_id).first()

    @staticmethod
    def list_requests(
        db: Session,
        student_id: Optional[str] = None,
        status: Optional[str] = None,
        language: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[RunRequest], int]:
        query = db.query(RunRequest)

        if student_id:
            query = query.join(Student).filter(Student.student_id == student_id)
        if status:
            query = query.filter(RunRequest.status == status)
        if language:
            query = query.join(LanguageEnvironment).filter(LanguageEnvironment.name == language)

        total = query.count()
        requests = query.order_by(desc(RunRequest.created_at)).offset((page - 1) * page_size).limit(page_size).all()

        return requests, total

    @staticmethod
    def update_request_status(db: Session, request_id: str, update_data: RunRequestUpdate, manual: bool = False) -> Optional[RunRequest]:
        request = RequestService.get_request(db, request_id)
        if not request:
            return None

        old_status = request.status
        if update_data.status:
            request.status = update_data.status

        if update_data.stdout is not None:
            request.stdout = update_data.stdout
        if update_data.stderr is not None:
            request.stderr = update_data.stderr
        if update_data.exit_code is not None:
            request.exit_code = update_data.exit_code
        if update_data.error_message is not None:
            request.error_message = update_data.error_message
        if update_data.execution_time_ms is not None:
            request.execution_time_ms = update_data.execution_time_ms
        if update_data.memory_usage_kb is not None:
            request.memory_usage_kb = update_data.memory_usage_kb

        if request.status in [RequestStatus.RUNNING] and not request.started_at:
            request.started_at = datetime.utcnow()

        if request.status in [RequestStatus.SUCCESS, RequestStatus.FAILED, RequestStatus.TIMEOUT, RequestStatus.CANCELLED]:
            request.completed_at = datetime.utcnow()
            if not request.execution_time_ms and request.started_at:
                request.execution_time_ms = int((request.completed_at - request.started_at).total_seconds() * 1000)

        if manual:
            request.created_by_manual = True

        db.commit()
        db.refresh(request)

        if update_data.status and old_status != update_data.status:
            message = "人工修正状态" if manual else "状态更新"
            RequestService.add_status_history(db, request.id, old_status, update_data.status, message)

        if request.status == RequestStatus.TIMEOUT:
            timeout_record = TimeoutRecord(
                request_id=request.id,
                student_id=request.student_id,
                timeout_after_seconds=settings.MAX_RUNTIME_SECONDS,
                reason="执行超时被强制终止"
            )
            db.add(timeout_record)
            db.commit()

        return request

    @staticmethod
    def cancel_request(db: Session, request_id: str) -> Optional[RunRequest]:
        request = RequestService.get_request(db, request_id)
        if not request or request.status in [RequestStatus.SUCCESS, RequestStatus.FAILED, RequestStatus.TIMEOUT, RequestStatus.CANCELLED, RequestStatus.MERGED]:
            return request

        old_status = request.status
        request.status = RequestStatus.CANCELLED
        request.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(request)

        RequestService.add_status_history(db, request.id, old_status, RequestStatus.CANCELLED, "请求被取消")
        QuotaService.release_quota(db, request.student_id)

        return request

    @staticmethod
    def execute_request(request_id: str):
        from ..database.database import SessionLocal
        import time

        def execute():
            db = SessionLocal()
            try:
                time.sleep(0.3)

                request = db.query(RunRequest).filter(RunRequest.request_id == request_id).first()
                if not request or request.status != RequestStatus.PENDING:
                    return

                request.status = RequestStatus.QUEUED
                history = StatusHistory(
                    request_id=request.id,
                    from_status=RequestStatus.PENDING,
                    to_status=RequestStatus.QUEUED,
                    message="进入执行队列，等待资源分配"
                )
                db.add(history)
                db.commit()

                time.sleep(0.5)

                request.status = RequestStatus.RUNNING
                request.started_at = datetime.utcnow()
                request.container_id = f"proc-{uuid.uuid4().hex[:8]}"
                history = StatusHistory(
                    request_id=request.id,
                    from_status=RequestStatus.QUEUED,
                    to_status=RequestStatus.RUNNING,
                    message=f"执行环境{request.container_id}启动，开始运行代码"
                )
                db.add(history)
                db.commit()

                db.refresh(request)
                language_name = request.language.name if request.language else "python"
                timeout = request.language.timeout_seconds if request.language else settings.MAX_RUNTIME_SECONDS
                
                try:
                    result: ExecutionResult = CodeExecutor.execute_code(
                        code=request.code_snippet,
                        language_name=language_name,
                        timeout_seconds=timeout,
                        input_data=request.input_data
                    )

                    request.completed_at = datetime.utcnow()
                    request.execution_time_ms = result.execution_time_ms
                    request.stdout = result.stdout
                    request.stderr = result.stderr
                    request.exit_code = result.exit_code
                    request.memory_usage_kb = result.memory_usage_kb

                    if result.timed_out:
                        request.status = RequestStatus.TIMEOUT
                        request.error_message = result.error_message or f"执行超过{timeout}秒被强制终止"
                        history = StatusHistory(
                            request_id=request.id,
                            from_status=RequestStatus.RUNNING,
                            to_status=RequestStatus.TIMEOUT,
                            message=f"执行超时，已运行{result.execution_time_ms}ms"
                        )
                        db.add(history)
                        
                        timeout_record = TimeoutRecord(
                            request_id=request.id,
                            student_id=request.student_id,
                            timeout_after_seconds=timeout,
                            reason=result.error_message or "执行超时被强制终止"
                        )
                        db.add(timeout_record)
                    elif result.success:
                        request.status = RequestStatus.SUCCESS
                        request.error_message = None
                        history = StatusHistory(
                            request_id=request.id,
                            from_status=RequestStatus.RUNNING,
                            to_status=RequestStatus.SUCCESS,
                            message=f"执行成功，耗时{result.execution_time_ms}ms"
                        )
                        db.add(history)
                    else:
                        request.status = RequestStatus.FAILED
                        request.error_message = result.error_message or "程序执行出错"
                        history = StatusHistory(
                            request_id=request.id,
                            from_status=RequestStatus.RUNNING,
                            to_status=RequestStatus.FAILED,
                            message=f"执行失败，退出码: {result.exit_code}"
                        )
                        db.add(history)

                except Exception as e:
                    request.completed_at = datetime.utcnow()
                    request.status = RequestStatus.FAILED
                    request.error_message = f"执行异常: {str(e)}"
                    history = StatusHistory(
                        request_id=request.id,
                        from_status=RequestStatus.RUNNING,
                        to_status=RequestStatus.FAILED,
                        message=f"执行异常: {str(e)[:50]}"
                    )
                    db.add(history)

                db.commit()
            finally:
                db.close()

        Thread(target=execute, daemon=True).start()

    @staticmethod
    def get_request_timeline(db: Session, request_id: str) -> List[StatusHistory]:
        request = RequestService.get_request(db, request_id)
        if not request:
            return []
        return request.status_history
