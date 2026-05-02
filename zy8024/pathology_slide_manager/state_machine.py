from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict
from models import Slide, BorrowRecord, DepartmentRule, SlideStatus, ValidationResult


class SlideStateMachine:
    VALID_TRANSITIONS = {
        SlideStatus.AVAILABLE: [SlideStatus.BORROWED],
        SlideStatus.BORROWED: [SlideStatus.RETURNED, SlideStatus.OVERDUE, SlideStatus.LOST],
        SlideStatus.OVERDUE: [SlideStatus.RETURNED, SlideStatus.LOST],
        SlideStatus.RETURNED: [SlideStatus.BORROWED],
        SlideStatus.LOST: [],
    }

    def __init__(self, db):
        self.db = db

    def can_transition(self, current_status: SlideStatus, new_status: SlideStatus) -> bool:
        return new_status in self.VALID_TRANSITIONS.get(current_status, [])

    def get_allowed_transitions(self, current_status: SlideStatus) -> List[SlideStatus]:
        return self.VALID_TRANSITIONS.get(current_status, [])

    def validate_borrow(self, slide_id: str, borrower_dept: str) -> ValidationResult:
        result = ValidationResult()
        slide = self.db.get_slide(slide_id)

        if not slide:
            result.add_error("slide", f"切片 '{slide_id}' 不存在")
            return result

        if slide.status not in [SlideStatus.AVAILABLE, SlideStatus.RETURNED]:
            result.add_error("status", f"切片状态为 '{slide.status.value}'，不可借阅")

        active_borrow = self.db.get_active_borrow_by_slide(slide_id)
        if active_borrow:
            result.add_error("active_borrow",
                           f"切片 '{slide_id}' 已有借阅记录 '{active_borrow.record_id}'")

        rule = self.db.get_department_rule(borrower_dept)
        if not rule:
            result.add_warning(f"部门 '{borrower_dept}' 未配置借阅规则")

        return result

    def validate_return(self, record_id: str, return_date: str = None) -> ValidationResult:
        result = ValidationResult()
        records = self.db.get_borrow_records(status=SlideStatus.BORROWED)
        record = None
        for r in records:
            if r.record_id == record_id:
                record = r
                break

        if not record:
            result.add_error("record", f"借阅记录 '{record_id}' 不存在或状态不是已借出")
            return result

        if return_date:
            borrow_dt = datetime.strptime(record.borrow_date, "%Y-%m-%d")
            return_dt = datetime.strptime(return_date, "%Y-%m-%d")
            if return_dt < borrow_dt:
                result.add_error("date",
                               f"归还日期 {return_date} 早于借阅日期 {record.borrow_date}")
            if return_dt > datetime.now():
                result.add_warning(f"归还日期 {return_date} 晚于当前日期")

        return result

    def execute_borrow(self, slide_id: str, borrower_name: str, borrower_dept: str,
                       borrow_date: str = None, expected_return_date: str = None,
                       notes: str = "", record_id: str = None) -> Tuple[bool, str, Optional[BorrowRecord]]:
        if borrow_date is None:
            borrow_date = datetime.now().strftime("%Y-%m-%d")

        validation = self.validate_borrow(slide_id, borrower_dept)
        if not validation.is_valid:
            errors = [str(e) for e in validation.errors]
            return False, "; ".join(errors), None

        if expected_return_date is None:
            rule = self.db.get_department_rule(borrower_dept)
            days = rule.max_borrow_days if rule else 30
            expected_return_date = (datetime.strptime(borrow_date, "%Y-%m-%d") +
                                  timedelta(days=days)).strftime("%Y-%m-%d")

        if record_id is None:
            record_id = f"B{slide_id[2:]}{datetime.now().strftime('%Y%m%d%H%M%S')}"

        record = BorrowRecord(
            record_id=record_id,
            slide_id=slide_id,
            borrower_name=borrower_name,
            borrower_dept=borrower_dept,
            borrow_date=borrow_date,
            expected_return_date=expected_return_date,
            status=SlideStatus.BORROWED,
            notes=notes
        )

        if self.db.insert_borrow_record(record):
            self.db.update_slide_status(slide_id, SlideStatus.BORROWED, notes)
            return True, "借阅成功", record

        return False, "插入借阅记录失败", None

    def execute_return(self, record_id: str, actual_return_date: str = None,
                      actual_return_dept: str = None, confirmed_by: str = None,
                      notes: str = "") -> Tuple[bool, str]:
        if actual_return_date is None:
            actual_return_date = datetime.now().strftime("%Y-%m-%d")

        validation = self.validate_return(record_id, actual_return_date)
        if not validation.is_valid:
            errors = [str(e) for e in validation.errors]
            return False, "; ".join(errors)

        records = self.db.get_borrow_records(status=SlideStatus.BORROWED)
        record = None
        for r in records:
            if r.record_id == record_id:
                record = r
                break

        borrow_dt = datetime.strptime(record.borrow_date, "%Y-%m-%d")
        return_dt = datetime.strptime(actual_return_date, "%Y-%m-%d")
        is_overdue = return_dt > datetime.strptime(record.expected_return_date, "%Y-%m-%d")

        new_status = SlideStatus.RETURNED
        if is_overdue:
            new_status = SlideStatus.OVERDUE

        update_data = {
            'actual_return_date': actual_return_date,
            'actual_return_dept': actual_return_dept or record.borrower_dept,
            'status': new_status,
            'confirmed_by': confirmed_by,
            'confirmed_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if notes:
            update_data['notes'] = notes

        self.db.update_borrow_record(record_id, **update_data)
        self.db.update_slide_status(record.slide_id, SlideStatus.AVAILABLE if not is_overdue else SlideStatus.OVERDUE)

        action = "归还" if not is_overdue else "逾期归还"
        self.db._log_history(record_id, action, actual_return_date,
                           operator=confirmed_by, details=notes)

        msg = action
        if is_overdue:
            overdue_days = (return_dt - datetime.strptime(record.expected_return_date, "%Y-%m-%d")).days
            msg += f" (逾期 {overdue_days} 天)"

        return True, msg

    def batch_return(self, record_ids: List[str], actual_return_date: str = None,
                    confirmed_by: str = None) -> Tuple[int, int, List[str]]:
        success = 0
        failed = 0
        errors = []

        for record_id in record_ids:
            ok, msg = self.execute_return(record_id, actual_return_date, confirmed_by=confirmed_by)
            if ok:
                success += 1
            else:
                failed += 1
                errors.append(f"{record_id}: {msg}")

        return success, failed, errors


class RuleEngine:
    def __init__(self, db):
        self.db = db
        self.state_machine = SlideStateMachine(db)

    def check_borrow_limit(self, borrower_dept: str, borrower_name: str = None) -> Tuple[bool, str]:
        rule = self.db.get_department_rule(borrower_dept)
        if not rule:
            return True, "无限制"

        active_records = self.db.get_borrow_records(status=SlideStatus.BORROWED)
        if borrower_name:
            dept_borrows = [r for r in active_records if r.borrower_name == borrower_name]
        else:
            dept_borrows = [r for r in active_records if r.borrower_dept == borrower_dept]

        if len(dept_borrows) >= rule.max_concurrent_borrows:
            return False, f"部门 '{borrower_dept}' 已有 {len(dept_borrows)} 个借阅，超过了限制 {rule.max_concurrent_borrows}"

        return True, f"当前 {len(dept_borrows)}/{rule.max_concurrent_borrows}"

    def get_expected_return_date(self, borrower_dept: str, borrow_date: str = None) -> str:
        if borrow_date is None:
            borrow_date = datetime.now().strftime("%Y-%m-%d")

        rule = self.db.get_department_rule(borrower_dept)
        days = rule.max_borrow_days if rule else 30

        return (datetime.strptime(borrow_date, "%Y-%m-%d") + timedelta(days=days)).strftime("%Y-%m-%d")

    def check_overdue_slides(self) -> List[Dict]:
        today = datetime.now().strftime("%Y-%m-%d")
        overdue_records = self.db.get_overdue_records()

        results = []
        for record in overdue_records:
            overdue_days = (datetime.now() - datetime.strptime(record.expected_return_date, "%Y-%m-%d")).days
            slide = self.db.get_slide(record.slide_id)
            results.append({
                'record_id': record.record_id,
                'slide_id': record.slide_id,
                'patient_id': slide.patient_id if slide else '',
                'borrower_name': record.borrower_name,
                'borrower_dept': record.borrower_dept,
                'borrow_date': record.borrow_date,
                'expected_return_date': record.expected_return_date,
                'overdue_days': overdue_days,
                'status': record.status.value
            })

        return results

    def update_overdue_status(self) -> int:
        today = datetime.now().strftime("%Y-%m-%d")
        updated = 0

        borrowed_records = self.db.get_borrow_records(status=SlideStatus.BORROWED)
        for record in borrowed_records:
            if record.expected_return_date < today:
                self.db.update_borrow_record(record.record_id, status=SlideStatus.OVERDUE)
                self.db.update_slide_status(record.slide_id, SlideStatus.OVERDUE)
                updated += 1

        return updated
