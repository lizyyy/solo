from sqlalchemy.orm import Session
from typing import Optional, List, Tuple, Dict, Any
import uuid
import time
from datetime import datetime
import json

from app.models import HttpLog, CommandLog


class AuditLogService:
    @staticmethod
    def create_http_log(db: Session, method: str, url: str, path: str,
                        query_params: str = None, request_body: str = None,
                        request_headers: str = None, user_id: int = None,
                        client_ip: str = None, user_agent: str = None) -> HttpLog:
        log = HttpLog(
            request_id=str(uuid.uuid4()),
            method=method,
            url=url,
            path=path,
            query_params=query_params,
            request_body=request_body,
            request_headers=request_headers,
            user_id=user_id,
            client_ip=client_ip,
            user_agent=user_agent,
            start_time=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def update_http_log_response(db: Session, log_id: int, status_code: int,
                                 response_body: str = None, response_headers: str = None,
                                 has_error: int = 0, error_message: str = None) -> Optional[HttpLog]:
        log = db.query(HttpLog).filter(HttpLog.id == log_id).first()
        if not log:
            return None

        log.status_code = status_code
        log.response_body = response_body
        log.response_headers = response_headers
        log.end_time = datetime.now()
        if log.start_time:
            duration = (log.end_time - log.start_time).total_seconds() * 1000
            log.duration_ms = int(duration)
        log.has_error = has_error
        log.error_message = error_message

        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def list_http_logs(db: Session, user_id: int = None, method: str = None,
                       path: str = None, has_error: int = None,
                       skip: int = 0, limit: int = 100) -> Tuple[List[HttpLog], int]:
        query = db.query(HttpLog)
        if user_id:
            query = query.filter(HttpLog.user_id == user_id)
        if method:
            query = query.filter(HttpLog.method == method)
        if path:
            query = query.filter(HttpLog.path.contains(path))
        if has_error is not None:
            query = query.filter(HttpLog.has_error == has_error)

        total = query.count()
        logs = query.order_by(HttpLog.created_at.desc()).offset(skip).limit(limit).all()
        return logs, total

    @staticmethod
    def create_command_log(db: Session, command_name: str, command_script: str,
                           arguments: str = None, operator_id: int = None,
                           notes: str = None) -> CommandLog:
        log = CommandLog(
            command_name=command_name,
            command_script=command_script,
            arguments=arguments,
            operator_id=operator_id,
            notes=notes,
            executed_at=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def update_command_log_result(db: Session, log_id: int, exit_code: int,
                                  stdout: str = None, stderr: str = None,
                                  success: int = 1, duration_ms: int = None) -> Optional[CommandLog]:
        log = db.query(CommandLog).filter(CommandLog.id == log_id).first()
        if not log:
            return None

        log.exit_code = exit_code
        log.stdout = stdout
        log.stderr = stderr
        log.success = success
        log.duration_ms = duration_ms

        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def list_command_logs(db: Session, operator_id: int = None, success: int = None,
                          skip: int = 0, limit: int = 100) -> Tuple[List[CommandLog], int]:
        query = db.query(CommandLog)
        if operator_id:
            query = query.filter(CommandLog.operator_id == operator_id)
        if success is not None:
            query = query.filter(CommandLog.success == success)

        total = query.count()
        logs = query.order_by(CommandLog.executed_at.desc()).offset(skip).limit(limit).all()
        return logs, total

    @staticmethod
    def execute_command(db: Session, command_name: str, command_script: str,
                        operator_id: int = None, arguments: dict = None) -> Dict[str, Any]:
        import subprocess

        log = AuditLogService.create_command_log(
            db,
            command_name=command_name,
            command_script=command_script,
            arguments=json.dumps(arguments) if arguments else None,
            operator_id=operator_id
        )

        start_time = time.time()
        try:
            result = subprocess.run(
                command_script,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )
            duration = int((time.time() - start_time) * 1000)

            AuditLogService.update_command_log_result(
                db,
                log_id=log.id,
                exit_code=result.returncode,
                stdout=result.stdout[:5000] if result.stdout else None,
                stderr=result.stderr[:5000] if result.stderr else None,
                success=1 if result.returncode == 0 else 0,
                duration_ms=duration
            )

            return {
                "success": result.returncode == 0,
                "command_log_id": log.id,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "duration_ms": duration
            }
        except subprocess.TimeoutExpired as e:
            duration = int((time.time() - start_time) * 1000)
            AuditLogService.update_command_log_result(
                db,
                log_id=log.id,
                exit_code=-1,
                stdout=e.stdout[:5000] if e.stdout else None,
                stderr="Command timeout after 300 seconds",
                success=0,
                duration_ms=duration
            )
            return {
                "success": False,
                "command_log_id": log.id,
                "error": "Command execution timeout",
                "duration_ms": duration
            }
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            AuditLogService.update_command_log_result(
                db,
                log_id=log.id,
                exit_code=-1,
                stderr=str(e),
                success=0,
                duration_ms=duration
            )
            return {
                "success": False,
                "command_log_id": log.id,
                "error": str(e),
                "duration_ms": duration
            }
