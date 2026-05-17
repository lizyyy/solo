from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
import uuid
from typing import List, Optional, Tuple
from database import (
    ExceptionRequest, AuditLog, Employee, Destination, PolicyClause,
    ExceptionStatus, ExceptionType, ApprovalAction, ImportValidation
)
from schemas import (
    ExceptionRequestCreate, ApprovalActionRequest, ErrorDetail, ErrorCode,
    ImportRowResult
)


class StateMachine:
    VALID_TRANSITIONS = {
        ExceptionStatus.PENDING_APPROVAL: [
            ExceptionStatus.EXCEPTION_REVIEW,
            ExceptionStatus.APPROVED,
            ExceptionStatus.REJECTED
        ],
        ExceptionStatus.EXCEPTION_REVIEW: [
            ExceptionStatus.APPROVED,
            ExceptionStatus.REJECTED
        ],
        ExceptionStatus.APPROVED: [],
        ExceptionStatus.REJECTED: []
    }

    @classmethod
    def can_transition(cls, from_status: ExceptionStatus, to_status: ExceptionStatus) -> bool:
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])

    @classmethod
    def get_next_status(cls, current_status: ExceptionStatus, action: ApprovalAction) -> Optional[ExceptionStatus]:
        transitions = {
            (ExceptionStatus.PENDING_APPROVAL, ApprovalAction.ESCALATE): ExceptionStatus.EXCEPTION_REVIEW,
            (ExceptionStatus.PENDING_APPROVAL, ApprovalAction.APPROVE): ExceptionStatus.APPROVED,
            (ExceptionStatus.PENDING_APPROVAL, ApprovalAction.REJECT): ExceptionStatus.REJECTED,
            (ExceptionStatus.EXCEPTION_REVIEW, ApprovalAction.APPROVE): ExceptionStatus.APPROVED,
            (ExceptionStatus.EXCEPTION_REVIEW, ApprovalAction.REJECT): ExceptionStatus.REJECTED,
        }
        return transitions.get((current_status, action))


class ExceptionService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _validate_employee_exists(self, employee_id: str) -> Tuple[bool, Optional[ErrorDetail]]:
        employee = self.db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            return False, ErrorDetail(
                code=ErrorCode.EMPLOYEE_NOT_FOUND,
                message=f"员工 {employee_id} 不存在",
                field="employee_id",
                suggestion="请检查员工ID是否正确，或先创建员工信息"
            )
        return True, None

    def _validate_destination_exists(self, destination_id: str) -> Tuple[bool, Optional[ErrorDetail]]:
        if not destination_id:
            return True, None
        destination = self.db.query(Destination).filter(Destination.id == destination_id).first()
        if not destination:
            return False, ErrorDetail(
                code=ErrorCode.DESTINATION_NOT_FOUND,
                message=f"目的地 {destination_id} 不存在",
                field="destination_id",
                suggestion="请从目的地列表中选择有效的目的地"
            )
        return True, None

    def _validate_policy_exists(self, policy_id: Optional[str], policy_type: str) -> Tuple[bool, Optional[ErrorDetail]]:
        if not policy_id:
            return True, None
        policy = self.db.query(PolicyClause).filter(
            and_(PolicyClause.id == policy_id, PolicyClause.is_active == True)
        ).first()
        if not policy:
            return False, ErrorDetail(
                code=ErrorCode.POLICY_NOT_FOUND,
                message=f"{policy_type}政策条款 {policy_id} 不存在或已失效",
                field=f"{policy_type}_policy_clause_id",
                suggestion="请使用有效的政策条款ID"
            )
        return True, None

    def _check_conflict(self, trip_id: str, exception_type: ExceptionType, exclude_request_id: Optional[str] = None) -> Tuple[bool, Optional[ErrorDetail]]:
        query = self.db.query(ExceptionRequest).filter(
            and_(
                ExceptionRequest.trip_id == trip_id,
                ExceptionRequest.status.in_([ExceptionStatus.PENDING_APPROVAL, ExceptionStatus.EXCEPTION_REVIEW])
            )
        )
        if exclude_request_id:
            query = query.filter(ExceptionRequest.id != exclude_request_id)
        
        existing = query.first()
        if existing:
            return True, ErrorDetail(
                code=ErrorCode.CONFLICTING_REQUEST,
                message=f"出差单 {trip_id} 已有进行中的例外申请",
                field="trip_id",
                suggestion=f"请先处理现有申请 (ID: {existing.id})，或等待其完成后再提交"
            )
        return False, None

    def _check_idempotency(self, idempotency_key: str) -> Tuple[bool, Optional[ExceptionRequest], Optional[ErrorDetail]]:
        existing = self.db.query(ExceptionRequest).filter(
            ExceptionRequest.request_idempotency_key == idempotency_key
        ).first()
        if existing:
            return True, existing, ErrorDetail(
                code=ErrorCode.DUPLICATE_REQUEST,
                message="检测到重复提交",
                field="idempotency_key",
                suggestion=f"使用相同幂等键的请求已存在，请求ID: {existing.id}"
            )
        return False, None, None

    def create_exception(self, data: ExceptionRequestCreate) -> Tuple[Optional[ExceptionRequest], List[ErrorDetail]]:
        errors: List[ErrorDetail] = []

        is_idempotent, existing_request, idempotent_error = self._check_idempotency(data.idempotency_key)
        if is_idempotent and existing_request:
            return existing_request, [idempotent_error]

        ok, emp_error = self._validate_employee_exists(data.employee_id)
        if not ok and emp_error:
            errors.append(emp_error)

        ok, dest_error = self._validate_destination_exists(data.destination_id)
        if not ok and dest_error:
            errors.append(dest_error)

        ok, hotel_policy_error = self._validate_policy_exists(data.hotel_policy_clause_id, "酒店")
        if not ok and hotel_policy_error:
            errors.append(hotel_policy_error)

        ok, flight_policy_error = self._validate_policy_exists(data.flight_policy_clause_id, "机票")
        if not ok and flight_policy_error:
            errors.append(flight_policy_error)

        has_conflict, conflict_error = self._check_conflict(data.trip_id, data.exception_type)
        if has_conflict and conflict_error:
            errors.append(conflict_error)

        if errors:
            return None, errors

        employee = self.db.query(Employee).filter(Employee.id == data.employee_id).first()
        
        exception = ExceptionRequest(
            id=self._generate_id(),
            request_idempotency_key=data.idempotency_key,
            trip_id=data.trip_id,
            employee_id=data.employee_id,
            destination_id=data.destination_id,
            exception_type=data.exception_type,
            status=ExceptionStatus.PENDING_APPROVAL,
            hotel_policy_clause_id=data.hotel_policy_clause_id,
            hotel_actual_rate=data.hotel_actual_rate,
            hotel_justification=data.hotel_justification,
            flight_policy_clause_id=data.flight_policy_clause_id,
            flight_actual_discount=data.flight_actual_discount,
            flight_justification=data.flight_justification,
            combined_justification=data.combined_justification,
            current_approver_id=employee.manager_id if employee else None,
            submitted_at=datetime.utcnow()
        )

        self.db.add(exception)
        self.db.flush()

        audit_log = AuditLog(
            id=self._generate_id(),
            request_id=exception.id,
            actor_id=data.employee_id,
            action=ApprovalAction.SUBMIT,
            from_status=None,
            to_status=ExceptionStatus.PENDING_APPROVAL,
            comment="提交例外申请"
        )
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(exception)

        return exception, []

    def process_approval(self, request_id: str, data: ApprovalActionRequest) -> Tuple[Optional[ExceptionRequest], List[ErrorDetail]]:
        errors: List[ErrorDetail] = []

        exception = self.db.query(ExceptionRequest).filter(ExceptionRequest.id == request_id).first()
        if not exception:
            errors.append(ErrorDetail(
                code=ErrorCode.EMPLOYEE_NOT_FOUND,
                message=f"例外申请 {request_id} 不存在",
                suggestion="请检查申请ID是否正确"
            ))
            return None, errors

        ok, actor_error = self._validate_employee_exists(data.actor_id)
        if not ok and actor_error:
            errors.append(actor_error)
            return None, errors

        next_status = StateMachine.get_next_status(exception.status, data.action)
        if not next_status:
            errors.append(ErrorDetail(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=f"当前状态 {exception.status} 不允许执行 {data.action} 操作",
                suggestion=f"允许的状态转换: {StateMachine.VALID_TRANSITIONS.get(exception.status, [])}"
            ))
            return None, errors

        audit_log = AuditLog(
            id=self._generate_id(),
            request_id=exception.id,
            actor_id=data.actor_id,
            action=data.action,
            from_status=exception.status,
            to_status=next_status,
            comment=data.comment,
            ip_address=data.ip_address,
            user_agent=data.user_agent
        )

        from_status = exception.status
        exception.status = next_status

        now = datetime.utcnow()
        if data.action == ApprovalAction.ESCALATE:
            exception.reviewed_at = now
        elif next_status == ExceptionStatus.APPROVED:
            exception.approved_at = now
        elif next_status == ExceptionStatus.REJECTED:
            exception.rejected_at = now

        exception.updated_at = now

        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(exception)

        return exception, []

    def get_exception(self, request_id: str) -> Optional[ExceptionRequest]:
        return self.db.query(ExceptionRequest).filter(ExceptionRequest.id == request_id).first()

    def list_exceptions(self, status: Optional[ExceptionStatus] = None, employee_id: Optional[str] = None,
                        trip_id: Optional[str] = None, page: int = 1, page_size: int = 20) -> Tuple[List[ExceptionRequest], int]:
        query = self.db.query(ExceptionRequest)
        
        if status:
            query = query.filter(ExceptionRequest.status == status)
        if employee_id:
            query = query.filter(ExceptionRequest.employee_id == employee_id)
        if trip_id:
            query = query.filter(ExceptionRequest.trip_id == trip_id)

        total = query.count()
        items = query.order_by(ExceptionRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        
        return items, total

    def get_history(self, request_id: str) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(AuditLog.request_id == request_id).order_by(AuditLog.created_at).all()


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.exception_service = ExceptionService(db)

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def validate_row(self, row_data: dict, row_number: int) -> Tuple[Optional[ExceptionRequestCreate], List[ErrorDetail]]:
        errors: List[ErrorDetail] = []

        required_fields = ['idempotency_key', 'trip_id', 'employee_id', 'exception_type']
        for field in required_fields:
            if not row_data.get(field):
                errors.append(ErrorDetail(
                    code=ErrorCode.MISSING_FIELD,
                    message=f"缺少必填字段: {field}",
                    field=field,
                    suggestion="请补充该字段后重试"
                ))

        if errors:
            return None, errors

        try:
            exception_type = ExceptionType(row_data['exception_type'])
        except ValueError:
            errors.append(ErrorDetail(
                code=ErrorCode.INVALID_FORMAT,
                message=f"例外类型无效: {row_data['exception_type']}",
                field="exception_type",
                suggestion=f"有效值为: {', '.join([e.value for e in ExceptionType])}"
            ))
            return None, errors

        try:
            create_data = ExceptionRequestCreate(
                idempotency_key=row_data['idempotency_key'],
                trip_id=row_data['trip_id'],
                employee_id=row_data['employee_id'],
                destination_id=row_data.get('destination_id'),
                exception_type=exception_type,
                hotel_policy_clause_id=row_data.get('hotel_policy_clause_id'),
                hotel_actual_rate=float(row_data['hotel_actual_rate']) if row_data.get('hotel_actual_rate') else None,
                hotel_justification=row_data.get('hotel_justification'),
                flight_policy_clause_id=row_data.get('flight_policy_clause_id'),
                flight_actual_discount=float(row_data['flight_actual_discount']) if row_data.get('flight_actual_discount') else None,
                flight_justification=row_data.get('flight_justification'),
                combined_justification=row_data.get('combined_justification')
            )
            return create_data, []
        except Exception as e:
            errors.append(ErrorDetail(
                code=ErrorCode.INVALID_FORMAT,
                message=f"数据格式错误: {str(e)}",
                suggestion="请检查所有字段格式是否正确"
            ))
            return None, errors

    def import_batch(self, rows: List[dict]) -> Tuple[str, List[ImportRowResult]]:
        batch_id = self._generate_id()
        results: List[ImportRowResult] = []

        for idx, row_data in enumerate(rows, start=1):
            create_data, validation_errors = self.validate_row(row_data, idx)
            
            if validation_errors:
                first_error = validation_errors[0]
                validation = ImportValidation(
                    id=self._generate_id(),
                    batch_id=batch_id,
                    row_number=idx,
                    is_valid=False,
                    raw_data=str(row_data),
                    error_code=first_error.code,
                    error_message=first_error.message,
                    error_field=first_error.field,
                    suggestion=first_error.suggestion
                )
                self.db.add(validation)
                results.append(ImportRowResult(
                    row_number=idx,
                    is_valid=False,
                    error_code=first_error.code,
                    error_message=first_error.message,
                    error_field=first_error.field,
                    suggestion=first_error.suggestion
                ))
                continue

            exception, business_errors = self.exception_service.create_exception(create_data)
            
            if business_errors and not exception:
                first_error = business_errors[0]
                validation = ImportValidation(
                    id=self._generate_id(),
                    batch_id=batch_id,
                    row_number=idx,
                    is_valid=False,
                    raw_data=str(row_data),
                    error_code=first_error.code,
                    error_message=first_error.message,
                    error_field=first_error.field,
                    suggestion=first_error.suggestion
                )
                self.db.add(validation)
                results.append(ImportRowResult(
                    row_number=idx,
                    is_valid=False,
                    error_code=first_error.code,
                    error_message=first_error.message,
                    error_field=first_error.field,
                    suggestion=first_error.suggestion
                ))
            else:
                validation = ImportValidation(
                    id=self._generate_id(),
                    batch_id=batch_id,
                    row_number=idx,
                    is_valid=True,
                    raw_data=str(row_data)
                )
                self.db.add(validation)
                results.append(ImportRowResult(
                    row_number=idx,
                    is_valid=True,
                    request_id=exception.id if exception else None
                ))

        self.db.commit()
        return batch_id, results