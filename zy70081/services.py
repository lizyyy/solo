from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
import json
from sqlalchemy.orm import Session
from models import (
    Department, Employee, Loan, OffsetVoucher, ApprovalHistory,
    OverdueReminder, ExceptionRecord, PendingTask,
    LoanStatus, OffsetStatus, SessionLocal
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PettyCashService:
    @staticmethod
    def log_exception(
        db: Session,
        source_type: str,
        error_code: str,
        error_message: str,
        source_id: Optional[int] = None,
        data_snapshot: Optional[Dict[str, Any]] = None
    ) -> ExceptionRecord:
        exc = ExceptionRecord(
            source_type=source_type,
            source_id=source_id,
            error_code=error_code,
            error_message=error_message,
            data_snapshot=json.dumps(data_snapshot, ensure_ascii=False, default=str) if data_snapshot else None
        )
        db.add(exc)
        db.commit()
        db.refresh(exc)
        return exc

    @staticmethod
    def create_pending_task(
        db: Session,
        task_type: str,
        description: str,
        related_id: Optional[int] = None,
        priority: str = "normal",
        assigned_to: Optional[str] = None
    ) -> PendingTask:
        task = PendingTask(
            task_type=task_type,
            related_id=related_id,
            description=description,
            priority=priority,
            assigned_to=assigned_to
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def create_department(
        db: Session,
        name: str,
        initial_balance: float = 0.0
    ) -> Dict[str, Any]:
        try:
            if initial_balance < 0:
                raise ValueError("部门初始余额不能为负数")
            
            existing = db.query(Department).filter(Department.name == name).first()
            if existing:
                raise ValueError(f"部门名称 '{name}' 已存在")
            
            dept = Department(
                name=name,
                initial_balance=initial_balance,
                current_balance=initial_balance
            )
            db.add(dept)
            db.commit()
            db.refresh(dept)
            return {
                "success": True,
                "data": {
                    "id": dept.id,
                    "name": dept.name,
                    "current_balance": dept.current_balance,
                    "available_balance": dept.available_balance()
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "department_create", "CREATE_FAILED", str(e),
                data_snapshot={"name": name, "initial_balance": initial_balance}
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def create_employee(
        db: Session,
        name: str,
        employee_no: str,
        department_id: int
    ) -> Dict[str, Any]:
        try:
            dept = db.query(Department).filter(Department.id == department_id).first()
            if not dept:
                raise ValueError(f"部门ID {department_id} 不存在")
            
            existing = db.query(Employee).filter(Employee.employee_no == employee_no).first()
            if existing:
                raise ValueError(f"工号 '{employee_no}' 已存在")
            
            emp = Employee(
                name=name,
                employee_no=employee_no,
                department_id=department_id
            )
            db.add(emp)
            db.commit()
            db.refresh(emp)
            return {
                "success": True,
                "data": {
                    "id": emp.id,
                    "name": emp.name,
                    "employee_no": emp.employee_no,
                    "department_name": dept.name
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "employee_create", "CREATE_FAILED", str(e),
                data_snapshot={"name": name, "employee_no": employee_no, "department_id": department_id}
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def generate_loan_no(db: Session) -> str:
        today = date.today().strftime("%Y%m%d")
        count = db.query(Loan).filter(Loan.loan_no.like(f"LK{today}%")).count()
        return f"LK{today}{count + 1:04d}"

    @staticmethod
    def create_loan(
        db: Session,
        employee_id: int,
        amount: float,
        purpose: str,
        expected_return_date: date
    ) -> Dict[str, Any]:
        try:
            if amount <= 0:
                raise ValueError("借款金额必须大于0")
            
            today = date.today()
            if expected_return_date <= today:
                raise ValueError("预计归还日期必须晚于今天")
            
            if not purpose or not purpose.strip():
                raise ValueError("借款用途不能为空")
            
            emp = db.query(Employee).filter(Employee.id == employee_id).first()
            if not emp:
                raise ValueError(f"员工ID {employee_id} 不存在")
            
            if not emp.is_active:
                raise ValueError(f"员工 {emp.name} 已离职，无法借款")
            
            dept = db.query(Department).filter(Department.id == emp.department_id).first()
            if not dept:
                raise ValueError("员工所属部门不存在")
            
            loan_no = PettyCashService.generate_loan_no(db)
            
            loan = Loan(
                loan_no=loan_no,
                employee_id=employee_id,
                department_id=dept.id,
                amount=amount,
                purpose=purpose.strip(),
                expected_return_date=expected_return_date,
                status=LoanStatus.DRAFT.value,
                remaining_amount=amount
            )
            db.add(loan)
            db.commit()
            db.refresh(loan)
            
            PettyCashService.create_pending_task(
                db, "loan_approval", f"借款单 {loan_no} 待审批",
                related_id=loan.id, priority="high"
            )
            
            return {
                "success": True,
                "data": {
                    "loan_no": loan.loan_no,
                    "id": loan.id,
                    "employee_name": emp.name,
                    "department_name": dept.name,
                    "amount": loan.amount,
                    "expected_return_date": loan.expected_return_date.isoformat(),
                    "status": loan.status
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "loan_create", "CREATE_FAILED", str(e),
                data_snapshot={"employee_id": employee_id, "amount": amount, "purpose": purpose}
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def approve_loan(
        db: Session,
        loan_id: int,
        approver_name: str,
        approve: bool,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            loan = db.query(Loan).filter(Loan.id == loan_id).first()
            if not loan:
                raise ValueError(f"借款单ID {loan_id} 不存在")
            
            if loan.status not in [LoanStatus.DRAFT.value, LoanStatus.PENDING_APPROVAL.value]:
                raise ValueError(f"当前借款单状态为 '{loan.status}'，无法审批")
            
            emp = db.query(Employee).filter(Employee.id == loan.employee_id).first()
            dept = db.query(Department).filter(Department.id == loan.department_id).first()
            
            if approve:
                available = dept.available_balance()
                if loan.amount > available:
                    raise ValueError(
                        f"部门可用余额不足。当前可用: {available}, 借款金额: {loan.amount}"
                    )
                
                dept.frozen_amount += loan.amount
                loan.status = LoanStatus.APPROVED.value
                
                PettyCashService.create_pending_task(
                    db, "loan_followup", f"借款单 {loan.loan_no} 已放款，请跟进归还",
                    related_id=loan.id, priority="normal"
                )
            else:
                loan.status = LoanStatus.REJECTED.value
            
            approval = ApprovalHistory(
                loan_id=loan.id,
                approver_name=approver_name,
                action="approve" if approve else "reject",
                comment=comment
            )
            db.add(approval)
            
            db.commit()
            db.refresh(loan)
            
            return {
                "success": True,
                "data": {
                    "loan_no": loan.loan_no,
                    "status": loan.status,
                    "department_available_balance": dept.available_balance(),
                    "department_frozen_amount": dept.frozen_amount,
                    "approval_id": approval.id
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "loan_approval", "APPROVAL_FAILED", str(e),
                source_id=loan_id,
                data_snapshot={"approver_name": approver_name, "approve": approve}
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def generate_voucher_no(db: Session) -> str:
        today = date.today().strftime("%Y%m%d")
        count = db.query(OffsetVoucher).filter(OffsetVoucher.voucher_no.like(f"CZ{today}%")).count()
        return f"CZ{today}{count + 1:04d}"

    @staticmethod
    def create_offset(
        db: Session,
        loan_id: int,
        offset_amount: float,
        expense_amount: float,
        cash_return_amount: float,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            loan = db.query(Loan).filter(Loan.id == loan_id).first()
            if not loan:
                raise ValueError(f"借款单ID {loan_id} 不存在")
            
            if loan.status not in [
                LoanStatus.APPROVED.value,
                LoanStatus.PARTIAL_SETTLED.value,
                LoanStatus.OVERDUE.value
            ]:
                raise ValueError(f"借款单状态 '{loan.status}' 不允许冲账")
            
            if offset_amount <= 0:
                raise ValueError("冲账金额必须大于0")
            
            remaining = loan.remaining_amount
            if offset_amount > remaining:
                raise ValueError(f"冲账金额 {offset_amount} 大于剩余借款 {remaining}")
            
            if expense_amount + cash_return_amount != offset_amount:
                raise ValueError(
                    f"费用报销金额 + 现金归还金额 ({expense_amount + cash_return_amount}) 必须等于冲账金额 ({offset_amount})"
                )
            
            if expense_amount < 0 or cash_return_amount < 0:
                raise ValueError("金额不能为负数")
            
            emp = db.query(Employee).filter(Employee.id == loan.employee_id).first()
            dept = db.query(Department).filter(Department.id == loan.department_id).first()
            
            voucher_no = PettyCashService.generate_voucher_no(db)
            
            offset = OffsetVoucher(
                voucher_no=voucher_no,
                loan_id=loan.id,
                employee_id=emp.id,
                department_id=dept.id,
                offset_amount=offset_amount,
                expense_amount=expense_amount,
                cash_return_amount=cash_return_amount,
                description=description,
                status=OffsetStatus.DRAFT.value
            )
            db.add(offset)
            db.commit()
            db.refresh(offset)
            
            PettyCashService.create_pending_task(
                db, "offset_approval", f"冲账凭证 {voucher_no} 待审批",
                related_id=offset.id, priority="high"
            )
            
            return {
                "success": True,
                "data": {
                    "voucher_no": offset.voucher_no,
                    "id": offset.id,
                    "loan_no": loan.loan_no,
                    "employee_name": emp.name,
                    "offset_amount": offset_amount,
                    "expense_amount": expense_amount,
                    "cash_return_amount": cash_return_amount,
                    "status": offset.status
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "offset_create", "CREATE_FAILED", str(e),
                source_id=loan_id,
                data_snapshot={
                    "loan_id": loan_id, "offset_amount": offset_amount,
                    "expense_amount": expense_amount, "cash_return_amount": cash_return_amount
                }
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def approve_offset(
        db: Session,
        offset_id: int,
        approver_name: str,
        approve: bool,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            offset = db.query(OffsetVoucher).filter(OffsetVoucher.id == offset_id).first()
            if not offset:
                raise ValueError(f"冲账凭证ID {offset_id} 不存在")
            
            if offset.status not in [OffsetStatus.DRAFT.value, OffsetStatus.PENDING_APPROVAL.value]:
                raise ValueError(f"当前凭证状态 '{offset.status}'，无法审批")
            
            loan = db.query(Loan).filter(Loan.id == offset.loan_id).first()
            dept = db.query(Department).filter(Department.id == offset.department_id).first()
            
            if approve:
                if dept.frozen_amount < offset.offset_amount:
                    raise ValueError(
                        f"部门冻结金额异常。冻结金额: {dept.frozen_amount}, 冲账金额: {offset.offset_amount}"
                    )
                
                dept.frozen_amount -= offset.offset_amount
                dept.current_balance -= offset.expense_amount
                
                loan.actual_settled_amount += offset.offset_amount
                loan.remaining_amount -= offset.offset_amount
                
                if loan.remaining_amount <= 0:
                    loan.status = LoanStatus.FULL_SETTLED.value
                    
                    pending_loan_tasks = db.query(PendingTask).filter(
                        PendingTask.related_id == loan.id,
                        PendingTask.is_completed == False
                    ).all()
                    for t in pending_loan_tasks:
                        t.is_completed = True
                        t.completed_at = datetime.utcnow()
                else:
                    loan.status = LoanStatus.PARTIAL_SETTLED.value
                
                offset.status = OffsetStatus.APPROVED.value
            else:
                offset.status = OffsetStatus.REJECTED.value
            
            approval = ApprovalHistory(
                offset_id=offset.id,
                approver_name=approver_name,
                action="approve" if approve else "reject",
                comment=comment
            )
            db.add(approval)
            
            db.commit()
            db.refresh(offset)
            db.refresh(loan)
            db.refresh(dept)
            
            return {
                "success": True,
                "data": {
                    "voucher_no": offset.voucher_no,
                    "status": offset.status,
                    "loan_status": loan.status,
                    "loan_remaining_amount": loan.remaining_amount,
                    "department_current_balance": dept.current_balance,
                    "department_frozen_amount": dept.frozen_amount,
                    "department_available_balance": dept.available_balance()
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "offset_approval", "APPROVAL_FAILED", str(e),
                source_id=offset_id,
                data_snapshot={"approver_name": approver_name, "approve": approve}
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def check_overdue(db: Session) -> Dict[str, Any]:
        try:
            today = date.today()
            overdue_loans = db.query(Loan).filter(
                Loan.expected_return_date < today,
                Loan.status.in_([
                    LoanStatus.APPROVED.value,
                    LoanStatus.PARTIAL_SETTLED.value
                ])
            ).all()
            
            processed_count = 0
            for loan in overdue_loans:
                if loan.status != LoanStatus.OVERDUE.value:
                    loan.status = LoanStatus.OVERDUE.value
                    processed_count += 1
                
                existing_reminder = db.query(OverdueReminder).filter(
                    OverdueReminder.loan_id == loan.id,
                    OverdueReminder.reminder_date == today
                ).first()
                
                if not existing_reminder:
                    emp = db.query(Employee).filter(Employee.id == loan.employee_id).first()
                    overdue_days = (today - loan.expected_return_date).days
                    reminder = OverdueReminder(
                        loan_id=loan.id,
                        reminder_date=today,
                        reminder_content=(
                            f"员工 {emp.name} 的借款单 {loan.loan_no} 已逾期 {overdue_days} 天。"
                            f"借款金额: {loan.amount}, 剩余金额: {loan.remaining_amount}, "
                            f"原应归还日期: {loan.expected_return_date}"
                        )
                    )
                    db.add(reminder)
                    
                    PettyCashService.create_pending_task(
                        db, "overdue_followup",
                        f"逾期跟进: {emp.name} 的借款 {loan.loan_no} 已逾期 {overdue_days} 天",
                        related_id=loan.id, priority="high"
                    )
                
                processed_count += 1
            
            db.commit()
            
            return {
                "success": True,
                "data": {
                    "overdue_loan_count": len(overdue_loans),
                    "processed_count": processed_count,
                    "as_of_date": today.isoformat()
                }
            }
        except Exception as e:
            db.rollback()
            PettyCashService.log_exception(
                db, "overdue_check", "CHECK_FAILED", str(e)
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_department_report(db: Session, department_id: Optional[int] = None) -> Dict[str, Any]:
        try:
            query = db.query(Department)
            if department_id:
                query = query.filter(Department.id == department_id)
            
            departments = query.all()
            result = []
            
            for dept in departments:
                loans = db.query(Loan).filter(Loan.department_id == dept.id).all()
                offsets = db.query(OffsetVoucher).filter(
                    OffsetVoucher.department_id == dept.id,
                    OffsetVoucher.status == OffsetStatus.APPROVED.value
                ).all()
                
                loan_stats = {
                    "total_loans": len(loans),
                    "approved_loans": sum(1 for l in loans if l.status in [
                        LoanStatus.APPROVED.value,
                        LoanStatus.PARTIAL_SETTLED.value,
                        LoanStatus.FULL_SETTLED.value,
                        LoanStatus.OVERDUE.value
                    ]),
                    "pending_approval_loans": sum(1 for l in loans if l.status in [
                        LoanStatus.DRAFT.value, LoanStatus.PENDING_APPROVAL.value
                    ]),
                    "overdue_loans": sum(1 for l in loans if l.status == LoanStatus.OVERDUE.value),
                    "full_settled_loans": sum(1 for l in loans if l.status == LoanStatus.FULL_SETTLED.value),
                    "total_borrowed": sum(l.amount for l in loans if l.status != LoanStatus.REJECTED.value),
                    "total_settled": sum(l.actual_settled_amount for l in loans),
                    "total_remaining": sum(l.remaining_amount for l in loans if l.status not in [
                        LoanStatus.REJECTED.value, LoanStatus.FULL_SETTLED.value
                    ]),
                }
                
                offset_stats = {
                    "total_offsets": len(offsets),
                    "total_offset_amount": sum(o.offset_amount for o in offsets),
                    "total_expense": sum(o.expense_amount for o in offsets),
                    "total_cash_return": sum(o.cash_return_amount for o in offsets),
                }
                
                result.append({
                    "department_id": dept.id,
                    "department_name": dept.name,
                    "initial_balance": dept.initial_balance,
                    "current_balance": dept.current_balance,
                    "frozen_amount": dept.frozen_amount,
                    "available_balance": dept.available_balance(),
                    "loan_stats": loan_stats,
                    "offset_stats": offset_stats
                })
            
            return {
                "success": True,
                "data": result,
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            PettyCashService.log_exception(
                db, "report_generate", "GENERATE_FAILED", str(e)
            )
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_loan_details(db: Session, loan_id: int) -> Dict[str, Any]:
        try:
            loan = db.query(Loan).filter(Loan.id == loan_id).first()
            if not loan:
                raise ValueError(f"借款单ID {loan_id} 不存在")
            
            emp = db.query(Employee).filter(Employee.id == loan.employee_id).first()
            dept = db.query(Department).filter(Department.id == loan.department_id).first()
            offsets = db.query(OffsetVoucher).filter(OffsetVoucher.loan_id == loan.id).all()
            approvals = db.query(ApprovalHistory).filter(ApprovalHistory.loan_id == loan.id).all()
            reminders = db.query(OverdueReminder).filter(OverdueReminder.loan_id == loan.id).all()
            
            return {
                "success": True,
                "data": {
                    "loan_no": loan.loan_no,
                    "employee_name": emp.name,
                    "employee_no": emp.employee_no,
                    "department_name": dept.name,
                    "amount": loan.amount,
                    "purpose": loan.purpose,
                    "expected_return_date": loan.expected_return_date.isoformat(),
                    "status": loan.status,
                    "actual_settled_amount": loan.actual_settled_amount,
                    "remaining_amount": loan.remaining_amount,
                    "created_at": loan.created_at.isoformat(),
                    "offsets": [
                        {
                            "voucher_no": o.voucher_no,
                            "offset_amount": o.offset_amount,
                            "expense_amount": o.expense_amount,
                            "cash_return_amount": o.cash_return_amount,
                            "status": o.status,
                            "created_at": o.created_at.isoformat()
                        } for o in offsets
                    ],
                    "approval_history": [
                        {
                            "approver": a.approver_name,
                            "action": a.action,
                            "comment": a.comment,
                            "time": a.created_at.isoformat()
                        } for a in approvals
                    ],
                    "overdue_reminders": [
                        {
                            "date": r.reminder_date.isoformat(),
                            "content": r.reminder_content,
                            "is_read": r.is_read
                        } for r in reminders
                    ]
                }
            }
        except Exception as e:
            PettyCashService.log_exception(
                db, "loan_query", "QUERY_FAILED", str(e), source_id=loan_id
            )
            return {"success": False, "error": str(e)}
