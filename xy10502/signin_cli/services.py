import csv
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Callable

from .models import (
    Student,
    Course,
    AttendanceRecord,
    MakeupApplication,
    AuditLog,
    ImportSession,
    AttendanceStatus,
    SourceType,
    MakeupStatus,
    generate_id,
    now_str,
)
from .storage import DataStore


class ValidationEngine:
    def __init__(self, store: DataStore):
        self.store = store

    def check_duplicate_phone(self, phone: str, exclude_id: Optional[str] = None) -> List[Student]:
        students = self.store.get_student_by_phone(phone)
        if exclude_id:
            students = [s for s in students if s.id != exclude_id]
        return students

    def check_duplicate_name_phone(self, name: str, phone: str, exclude_id: Optional[str] = None) -> List[Student]:
        students = self.store.get_students()
        matches = []
        for s in students:
            if exclude_id and s.id == exclude_id:
                continue
            if s.name == name and s.phone == phone:
                matches.append(s)
        return matches

    def is_student_in_list(self, name: Optional[str] = None, phone: Optional[str] = None, student_id: Optional[str] = None) -> Tuple[bool, Optional[Student]]:
        if student_id:
            s = self.store.get_student(student_id)
            return (s is not None, s)
        students = self.store.get_students()
        for s in students:
            name_match = (not name) or s.name == name
            phone_match = (not phone) or s.phone == phone
            if name_match and phone_match:
                return (True, s)
        return (False, None)

    def check_duplicate_attendance(self, course_id: str, student_id: str, source: str, signin_time: Optional[str] = None) -> List[AttendanceRecord]:
        records = self.store.get_attendance_records()
        duplicates = []
        for r in records:
            if r.course_id == course_id and r.student_id == student_id:
                if signin_time and r.signin_time and signin_time[:10] == r.signin_time[:10]:
                    duplicates.append(r)
                elif not signin_time:
                    duplicates.append(r)
        return duplicates

    def validate_makeup_application(self, app: MakeupApplication) -> List[str]:
        errors = []
        if not app.reason or len(app.reason.strip()) < 2:
            errors.append("讲师补录缺少原因或原因过于简短")
        if not app.submitted_by:
            errors.append("补录缺少提交人信息")
        student_exists, _ = self.is_student_in_list(student_id=app.student_id)
        if not student_exists:
            errors.append(f"补录学生不在名单中: {app.student_id}")
        course = self.store.get_course(app.course_id)
        if not course:
            errors.append(f"补录课程不存在: {app.course_id}")
        return errors


class AttendanceService:
    def __init__(self, store: DataStore):
        self.store = store
        self.validator = ValidationEngine(store)

    def parse_student_csv(self, file_path: str) -> List[Tuple[Student, List[str]]]:
        results = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                errors = []
                name = (row.get("姓名") or row.get("name") or "").strip()
                phone = (row.get("手机") or row.get("phone") or row.get("手机号") or "").strip()
                dept = (row.get("部门") or row.get("department") or row.get("dept") or "").strip()
                if not name:
                    errors.append("缺少姓名")
                if not phone:
                    errors.append("缺少手机号")
                if not errors:
                    student = Student(
                        id=generate_id("student", name, phone),
                        name=name,
                        phone=phone,
                        department=dept,
                        created_at=now_str(),
                        updated_at=now_str(),
                    )
                    dup_phones = self.validator.check_duplicate_phone(phone)
                    if dup_phones:
                        errors.append(f"手机号冲突: {phone} 已被 {dup_phones[0].name} 使用")
                    dup_name_phone = self.validator.check_duplicate_name_phone(name, phone)
                    if dup_name_phone:
                        errors.append(f"重复导入: {name} - {phone}")
                results.append((student if not errors else None, errors))
        return results

    def parse_course_csv(self, file_path: str) -> List[Tuple[Course, List[str]]]:
        results = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                errors = []
                name = (row.get("课程名称") or row.get("course_name") or row.get("name") or "").strip()
                instructor = (row.get("讲师") or row.get("instructor") or "").strip()
                start_date = (row.get("开始日期") or row.get("start_date") or "").strip()
                end_date = (row.get("结束日期") or row.get("end_date") or start_date).strip()
                start_time = (row.get("开始时间") or row.get("start_time") or "09:00").strip()
                end_time = (row.get("结束时间") or row.get("end_time") or "17:00").strip()
                hours = float(row.get("总课时") or row.get("total_hours") or 8.0)
                if not name:
                    errors.append("缺少课程名称")
                if not instructor:
                    errors.append("缺少讲师")
                if not start_date:
                    errors.append("缺少开始日期")
                if not errors:
                    course = Course(
                        id=generate_id("course", name, start_date),
                        name=name,
                        instructor=instructor,
                        start_date=start_date,
                        end_date=end_date,
                        start_time=start_time,
                        end_time=end_time,
                        total_hours=hours,
                        created_at=now_str(),
                        updated_at=now_str(),
                    )
                    existing = self.store.get_course_by_name(name)
                    if existing:
                        errors.append(f"课程已存在: {name}")
                results.append((course if not errors else None, errors))
        return results

    def parse_qr_csv(self, file_path: str) -> List[Tuple[AttendanceRecord, List[str]]]:
        results = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                errors = []
                phone = (row.get("手机") or row.get("phone") or row.get("扫码手机号") or "").strip()
                name = (row.get("姓名") or row.get("name") or "").strip()
                course_name = (row.get("课程") or row.get("course") or row.get("课程名称") or "").strip()
                signin_time = (row.get("扫码时间") or row.get("signin_time") or row.get("time") or "").strip()
                if not phone and not name:
                    errors.append("缺少扫码标识（姓名或手机）")
                if not course_name:
                    errors.append("缺少课程信息")
                if not errors:
                    course = self.store.get_course_by_name(course_name)
                    if not course:
                        errors.append(f"课程不存在: {course_name}")
                    exists, student = self.validator.is_student_in_list(name=name, phone=phone)
                    if not exists:
                        errors.append(f"扫码人员不在名单: {name or phone}")
                    else:
                        record = AttendanceRecord(
                            id=generate_id("qr", phone or name, course_name, signin_time),
                            course_id=course.id if course else "",
                            student_id=student.id if student else "",
                            source=SourceType.QR_CODE.value,
                            source_detail=f"扫码签到: {signin_time or '未知时间'}",
                            signin_time=signin_time or None,
                            signout_time=None,
                            status=AttendanceStatus.UNKNOWN.value,
                            is_valid=True,
                            validation_errors=[],
                            created_at=now_str(),
                            updated_at=now_str(),
                        )
                        if course and student:
                            dups = self.validator.check_duplicate_attendance(course.id, student.id, SourceType.QR_CODE.value, signin_time)
                            if dups:
                                errors.append(f"重复扫码: {student.name} 在 {course.name} 已有签到记录")
                results.append((record if not errors else None, errors))
        return results

    def parse_makeup_csv(self, file_path: str) -> List[Tuple[MakeupApplication, List[str]]]:
        results = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                errors = []
                phone = (row.get("手机") or row.get("phone") or "").strip()
                name = (row.get("姓名") or row.get("name") or "").strip()
                course_name = (row.get("课程") or row.get("course") or "").strip()
                reason = (row.get("补录原因") or row.get("reason") or "").strip()
                submitted_by = (row.get("提交人") or row.get("submitted_by") or "讲师").strip()
                submitted_at = (row.get("提交时间") or row.get("submitted_at") or now_str()).strip()
                signin_time = (row.get("签到时间") or row.get("signin_time") or "").strip()
                status_str = (row.get("状态") or row.get("status") or MakeupStatus.PENDING.value).strip()
                if not phone and not name:
                    errors.append("缺少补录人员标识（姓名或手机）")
                if not course_name:
                    errors.append("缺少课程信息")
                if not reason:
                    errors.append("讲师补录缺少原因")
                if not errors:
                    course = self.store.get_course_by_name(course_name)
                    if not course:
                        errors.append(f"课程不存在: {course_name}")
                    exists, student = self.validator.is_student_in_list(name=name, phone=phone)
                    if not exists:
                        errors.append(f"补录人员不在名单: {name or phone}")
                    if not errors:
                        app = MakeupApplication(
                            id=generate_id("makeup", phone or name, course_name),
                            course_id=course.id,
                            student_id=student.id,
                            reason=reason,
                            submitted_by=submitted_by,
                            submitted_at=submitted_at,
                            status=status_str,
                            created_at=now_str(),
                            updated_at=now_str(),
                        )
                        app_errors = self.validator.validate_makeup_application(app)
                        errors.extend(app_errors)
                results.append((app if not errors else None, errors))
        return results

    def import_students(self, file_path: str, operator: str = "system") -> ImportSession:
        session_id = generate_id("import", "students", Path(file_path).name)
        session = ImportSession(
            id=session_id,
            source_type="students",
            file_name=Path(file_path).name,
            timestamp=now_str(),
            status="running",
            message="",
        )
        parsed = self.parse_student_csv(file_path)
        processed = 0
        skipped = 0
        failed = 0
        for student, errors in parsed:
            if errors:
                failed += 1
                continue
            dups = self.validator.check_duplicate_name_phone(student.name, student.phone)
            if dups:
                skipped += 1
                continue
            self.store.add_student(student)
            self.store.add_audit_log(
                action="import",
                entity_type="student",
                entity_id=student.id,
                before=None,
                after=student.to_dict(),
                operator=operator,
                reason="名单导入",
                detail=f"导入学员: {student.name}",
            )
            processed += 1
            session.import_ids.append(student.id)
        session.records_processed = processed
        session.records_skipped = skipped
        session.records_failed = failed
        session.status = "completed"
        session.message = f"成功{processed} 跳过{skipped} 失败{failed}"
        self.store.add_import_session(session)
        return session

    def import_courses(self, file_path: str, operator: str = "system") -> ImportSession:
        session_id = generate_id("import", "courses", Path(file_path).name)
        session = ImportSession(
            id=session_id,
            source_type="courses",
            file_name=Path(file_path).name,
            timestamp=now_str(),
            status="running",
            message="",
        )
        parsed = self.parse_course_csv(file_path)
        processed = 0
        skipped = 0
        failed = 0
        for course, errors in parsed:
            if errors:
                failed += 1
                continue
            existing = self.store.get_course_by_name(course.name)
            if existing:
                skipped += 1
                continue
            self.store.add_course(course)
            self.store.add_audit_log(
                action="import",
                entity_type="course",
                entity_id=course.id,
                before=None,
                after=course.to_dict(),
                operator=operator,
                reason="课程导入",
                detail=f"导入课程: {course.name}",
            )
            processed += 1
            session.import_ids.append(course.id)
        session.records_processed = processed
        session.records_skipped = skipped
        session.records_failed = failed
        session.status = "completed"
        session.message = f"成功{processed} 跳过{skipped} 失败{failed}"
        self.store.add_import_session(session)
        return session

    def import_qr_records(self, file_path: str, operator: str = "system") -> ImportSession:
        session_id = generate_id("import", "qr", Path(file_path).name)
        session = ImportSession(
            id=session_id,
            source_type="qr_code",
            file_name=Path(file_path).name,
            timestamp=now_str(),
            status="running",
            message="",
        )
        parsed = self.parse_qr_csv(file_path)
        processed = 0
        skipped = 0
        failed = 0
        for record, errors in parsed:
            if errors:
                failed += 1
                continue
            dups = self.validator.check_duplicate_attendance(record.course_id, record.student_id, SourceType.QR_CODE.value, record.signin_time)
            if dups:
                skipped += 1
                continue
            self.store.add_attendance(record)
            self.store.add_audit_log(
                action="import",
                entity_type="attendance",
                entity_id=record.id,
                before=None,
                after=record.to_dict(),
                operator=operator,
                reason="二维码导入",
                detail=f"扫码签到: {record.signin_time}",
            )
            processed += 1
            session.import_ids.append(record.id)
        session.records_processed = processed
        session.records_skipped = skipped
        session.records_failed = failed
        session.status = "completed"
        session.message = f"成功{processed} 跳过{skipped} 失败{failed}"
        self.store.add_import_session(session)
        return session

    def import_makeup_applications(self, file_path: str, operator: str = "system") -> ImportSession:
        session_id = generate_id("import", "makeup", Path(file_path).name)
        session = ImportSession(
            id=session_id,
            source_type="makeup",
            file_name=Path(file_path).name,
            timestamp=now_str(),
            status="running",
            message="",
        )
        parsed = self.parse_makeup_csv(file_path)
        processed = 0
        skipped = 0
        failed = 0
        for app, errors in parsed:
            if errors:
                failed += 1
                continue
            existing = [
                m for m in self.store.get_makeup_applications()
                if m.course_id == app.course_id and m.student_id == app.student_id
            ]
            if existing:
                skipped += 1
                continue
            self.store.add_makeup(app)
            self.store.add_audit_log(
                action="import",
                entity_type="makeup",
                entity_id=app.id,
                before=None,
                after=app.to_dict(),
                operator=operator,
                reason="补录导入",
                detail=f"补录申请: {app.reason[:30]}",
            )
            if app.status == MakeupStatus.APPROVED.value:
                self._create_attendance_from_makeup(app, operator)
            processed += 1
            session.import_ids.append(app.id)
        session.records_processed = processed
        session.records_skipped = skipped
        session.records_failed = failed
        session.status = "completed"
        session.message = f"成功{processed} 跳过{skipped} 失败{failed}"
        self.store.add_import_session(session)
        return session

    def _create_attendance_from_makeup(self, app: MakeupApplication, operator: str):
        record = AttendanceRecord(
            id=generate_id("att", "makeup", app.student_id, app.course_id),
            course_id=app.course_id,
            student_id=app.student_id,
            source=SourceType.MAKEUP.value,
            source_detail=f"讲师补录已通过: {app.reason[:30]}",
            signin_time=app.submitted_at,
            status=AttendanceStatus.PRESENT.value,
            is_valid=True,
            makeup_application_id=app.id,
            created_at=now_str(),
            updated_at=now_str(),
        )
        self.store.add_attendance(record)
        self.store.add_audit_log(
            action="approve_makeup",
            entity_type="attendance",
            entity_id=record.id,
            after=record.to_dict(),
            operator=operator,
            reason=f"补录通过: {app.id}",
        )

    def review_makeup(self, makeup_id: str, approved: bool, reviewer: str, comment: str = "") -> bool:
        app = next((m for m in self.store.get_makeup_applications() if m.id == makeup_id), None)
        if not app:
            return False
        before = app.to_dict()
        app.status = MakeupStatus.APPROVED.value if approved else MakeupStatus.REJECTED.value
        app.reviewed_by = reviewer
        app.reviewed_at = now_str()
        app.review_comment = comment
        app.updated_at = now_str()
        self.store.update_makeup(app)
        self.store.add_audit_log(
            action="review",
            entity_type="makeup",
            entity_id=app.id,
            before=before,
            after=app.to_dict(),
            operator=reviewer,
            reason="人工审核",
            detail=f"{'通过' if approved else '驳回'}: {comment[:50]}",
        )
        if approved:
            self._create_attendance_from_makeup(app, reviewer)
        return True

    def evaluate_attendance_status(self, course: Course, record: AttendanceRecord) -> Tuple[str, List[str]]:
        errors = []
        if not record.signin_time:
            return AttendanceStatus.ABSENT.value, ["无签到时间"]
        try:
            course_start = datetime.strptime(f"{course.start_date} {course.start_time}", "%Y-%m-%d %H:%M")
            course_end = datetime.strptime(f"{course.end_date} {course.end_time}", "%Y-%m-%d %H:%M")
            signin = datetime.fromisoformat(record.signin_time)
        except Exception as e:
            return AttendanceStatus.UNKNOWN.value, [f"时间解析错误: {e}"]
        late_threshold = course_start + timedelta(minutes=15)
        early_threshold = course_end - timedelta(minutes=15)
        status = AttendanceStatus.PRESENT.value
        if signin > late_threshold:
            status = AttendanceStatus.LATE.value
            errors.append(f"迟到: 迟到{int((signin - course_start).total_seconds() / 60)}分钟")
        if record.signout_time:
            try:
                signout = datetime.fromisoformat(record.signout_time)
                if signout < early_threshold:
                    if status == AttendanceStatus.LATE.value:
                        status = "late_and_early"
                    else:
                        status = AttendanceStatus.EARLY_LEAVE.value
                    errors.append(f"早退: 早退{int((course_end - signout).total_seconds() / 60)}分钟")
            except Exception:
                pass
        return status, errors

    def run_validation(self, course_id: Optional[str] = None) -> Dict[str, Any]:
        results = {
            "courses_checked": 0,
            "students_checked": 0,
            "records_checked": 0,
            "issues": [],
            "conflicts": [],
        }
        courses = [self.store.get_course(course_id)] if course_id else self.store.get_courses()
        courses = [c for c in courses if c]
        students = self.store.get_students()
        for course in courses:
            results["courses_checked"] += 1
            records = self.store.get_attendance_for_course(course.id)
            for record in records:
                results["records_checked"] += 1
                before = record.to_dict()
                status, errors = self.evaluate_attendance_status(course, record)
                record.status = status
                record.validation_errors = errors
                record.is_valid = len(errors) == 0 or (status != AttendanceStatus.UNKNOWN.value)
                record.updated_at = now_str()
                self.store.update_attendance(record)
                if errors:
                    results["issues"].append({
                        "record_id": record.id,
                        "course": course.name,
                        "student": self.store.get_student(record.student_id).name if self.store.get_student(record.student_id) else "未知",
                        "errors": errors,
                    })
        phone_conflicts = {}
        for s in students:
            results["students_checked"] += 1
            same_phone = self.validator.check_duplicate_phone(s.phone, exclude_id=s.id)
            if same_phone:
                if s.phone not in phone_conflicts:
                    phone_conflicts[s.phone] = [s]
                for other in same_phone:
                    if other not in phone_conflicts[s.phone]:
                        phone_conflicts[s.phone].append(other)
        for phone, students_list in phone_conflicts.items():
            results["conflicts"].append({
                "type": "duplicate_phone",
                "phone": phone,
                "students": [f"{s.name}({s.department})" for s in students_list],
            })
        return results

    def generate_report(self, course_id: Optional[str] = None) -> Dict[str, Any]:
        courses = [self.store.get_course(course_id)] if course_id else self.store.get_courses()
        courses = [c for c in courses if c]
        report = {
            "generated_at": now_str(),
            "summary": {
                "total_courses": len(courses),
                "total_students": len(self.store.get_students()),
                "total_attendance_records": len(self.store.get_attendance_records()),
                "total_makeup_applications": len(self.store.get_makeup_applications()),
            },
            "courses": [],
        }
        for course in courses:
            students = self.store.get_students()
            records = self.store.get_attendance_for_course(course.id)
            makeups = self.store.get_makeup_for_course(course.id)
            status_counts = {}
            student_attendance = {s.id: [] for s in students}
            for r in records:
                status_counts[r.status] = status_counts.get(r.status, 0) + 1
                if r.student_id in student_attendance:
                    student_attendance[r.student_id].append(r)
            present_hours = 0.0
            disputed_hours = 0.0
            disputed_reasons = []
            for s in students:
                s_records = student_attendance.get(s.id, [])
                if not s_records:
                    disputed_hours += course.total_hours
                    disputed_reasons.append({
                        "student": s.name,
                        "reason": "无任何签到/补录记录",
                        "hours": course.total_hours,
                    })
                    continue
                has_valid = False
                for r in s_records:
                    if r.status in [AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value, AttendanceStatus.EARLY_LEAVE.value]:
                        has_valid = True
                        if r.status == AttendanceStatus.PRESENT.value:
                            present_hours += course.total_hours
                        elif r.status == AttendanceStatus.LATE.value:
                            present_hours += course.total_hours * 0.5
                            disputed_reasons.append({
                                "student": s.name,
                                "reason": "迟到 - 按规则扣减课时",
                                "hours": course.total_hours * 0.5,
                            })
                        elif r.status == AttendanceStatus.EARLY_LEAVE.value:
                            present_hours += course.total_hours * 0.5
                            disputed_reasons.append({
                                "student": s.name,
                                "reason": "早退 - 按规则扣减课时",
                                "hours": course.total_hours * 0.5,
                            })
                        break
                if not has_valid:
                    disputed_hours += course.total_hours
                    disputed_reasons.append({
                        "student": s.name,
                        "reason": "签到状态异常",
                        "hours": course.total_hours,
                    })
            makeup_pending = [m for m in makeups if m.status == MakeupStatus.PENDING.value]
            makeup_rejected = [m for m in makeups if m.status == MakeupStatus.REJECTED.value]
            for m in makeup_pending:
                s = self.store.get_student(m.student_id)
                disputed_reasons.append({
                    "student": s.name if s else "未知",
                    "reason": f"补录待审核: {m.reason[:20]}",
                    "hours": course.total_hours,
                })
                disputed_hours += course.total_hours
            for m in makeup_rejected:
                s = self.store.get_student(m.student_id)
                disputed_reasons.append({
                    "student": s.name if s else "未知",
                    "reason": f"补录被驳回: {m.review_comment or m.reason[:20]}",
                    "hours": course.total_hours,
                })
                disputed_hours += course.total_hours
            course_report = {
                "id": course.id,
                "name": course.name,
                "instructor": course.instructor,
                "period": f"{course.start_date} {course.start_time} - {course.end_date} {course.end_time}",
                "is_multi_day": course.is_multi_day,
                "total_hours": course.total_hours,
                "enrolled_students": len(students),
                "attendance_status": status_counts,
                "attendance_records_count": len(records),
                "makeup_applications": {
                    "total": len(makeups),
                    "pending": len(makeup_pending),
                    "approved": len([m for m in makeups if m.status == MakeupStatus.APPROVED.value]),
                    "rejected": len(makeup_rejected),
                },
                "settlement": {
                    "payable_hours": round(present_hours, 2),
                    "disputed_hours": round(disputed_hours, 2),
                    "disputed_reasons": disputed_reasons,
                },
            }
            report["courses"].append(course_report)
        return report


class SampleDataGenerator:
    def __init__(self, store: DataStore):
        self.store = store

    def generate_samples(self, output_dir: str) -> Dict[str, str]:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        students_csv = out / "students.csv"
        courses_csv = out / "courses.csv"
        qr_csv = out / "qr_records.csv"
        makeup_csv = out / "makeup_applications.csv"
        with open(students_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["姓名", "手机", "部门"])
            writer.writeheader()
            writer.writerow({"姓名": "张三", "手机": "13800000001", "部门": "技术部"})
            writer.writerow({"姓名": "李四", "手机": "13800000002", "部门": "市场部"})
            writer.writerow({"姓名": "王五", "手机": "13800000003", "部门": "技术部"})
            writer.writerow({"姓名": "赵六", "手机": "13800000004", "部门": "人事部"})
            writer.writerow({"姓名": "陈七", "手机": "13800000005", "部门": "技术部"})
            writer.writerow({"姓名": "重复手机", "手机": "13800000003", "部门": "财务部"})
        with open(courses_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["课程名称", "讲师", "开始日期", "结束日期", "开始时间", "结束时间", "总课时"])
            writer.writeheader()
            writer.writerow({
                "课程名称": "Python入门培训",
                "讲师": "王老师",
                "开始日期": "2026-05-10",
                "结束日期": "2026-05-10",
                "开始时间": "09:00",
                "结束时间": "17:00",
                "总课时": "8.0",
            })
            writer.writerow({
                "课程名称": "数据分析进阶",
                "讲师": "李老师",
                "开始日期": "2026-05-11",
                "结束日期": "2026-05-12",
                "开始时间": "09:00",
                "结束时间": "17:00",
                "总课时": "16.0",
            })
        with open(qr_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["姓名", "手机", "课程", "扫码时间"])
            writer.writeheader()
            writer.writerow({"姓名": "张三", "手机": "13800000001", "课程": "Python入门培训", "扫码时间": "2026-05-10T08:55:00"})
            writer.writerow({"姓名": "李四", "手机": "13800000002", "课程": "Python入门培训", "扫码时间": "2026-05-10T09:30:00"})
            writer.writerow({"姓名": "名单外人", "手机": "13999999999", "课程": "Python入门培训", "扫码时间": "2026-05-10T09:00:00"})
            writer.writerow({"姓名": "张三", "手机": "13800000001", "课程": "Python入门培训", "扫码时间": "2026-05-10T08:56:00"})
        with open(makeup_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["姓名", "手机", "课程", "补录原因", "提交人", "提交时间", "状态"])
            writer.writeheader()
            writer.writerow({
                "姓名": "王五",
                "手机": "13800000003",
                "课程": "Python入门培训",
                "补录原因": "现场纸质签到，设备故障",
                "提交人": "王老师",
                "提交时间": "2026-05-10T17:30:00",
                "状态": "approved",
            })
            writer.writerow({
                "姓名": "赵六",
                "手机": "13800000004",
                "课程": "Python入门培训",
                "补录原因": "忘记扫码，有签到纸",
                "提交人": "王老师",
                "提交时间": "2026-05-10T18:00:00",
                "状态": "rejected",
            })
            writer.writerow({
                "姓名": "陈七",
                "手机": "13800000005",
                "课程": "Python入门培训",
                "补录原因": "",
                "提交人": "王老师",
                "提交时间": "2026-05-10T19:00:00",
                "状态": "pending",
            })
        return {
            "students": str(students_csv),
            "courses": str(courses_csv),
            "qr": str(qr_csv),
            "makeup": str(makeup_csv),
        }
