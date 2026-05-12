from datetime import datetime, date
from typing import List, Dict, Tuple, Optional

from .models import (
    Student, Insurance, Authorization, Vehicle, Withdrawal,
    CheckReport, CheckResult, StudentStatus
)
from .database import (
    StudentRepo, InsuranceRepo, AuthorizationRepo, 
    VehicleRepo, WithdrawalRepo, CheckReportRepo
)


def _parse_date(d: str) -> Optional[datetime]:
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
        try:
            return datetime.strptime(d, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _today() -> datetime:
    return datetime.combine(date.today(), datetime.min.time())


def _id_card_name_match(student: Student, other_name: str, other_id_card: str) -> Tuple[bool, List[str]]:
    issues = []
    match = True
    if student.name != other_name:
        issues.append(f"姓名不一致: 名单是[{student.name}] vs 其他资料是[{other_name}]")
        match = False
    if student.id_card != other_id_card:
        issues.append(f"身份证不一致: 名单是[{student.id_card}] vs 其他资料是[{other_id_card}]")
        match = False
    return match, issues


def _find_insurance_by_name(student: Student) -> Optional[Insurance]:
    all_ins = InsuranceRepo.get_all()
    for ins in all_ins:
        if ins.student_name == student.name:
            return ins
    return None


def _check_insurance(student: Student, insurance: Optional[Insurance], 
                     insurance_by_name: Optional[Insurance],
                     trip_start: Optional[str]) -> Tuple[List[str], List[str], List[str]]:
    issues = []
    warnings = []
    ok_items = []
    if not insurance and not insurance_by_name:
        issues.append("未找到保险保单")
        return issues, warnings, ok_items
    ins = insurance or insurance_by_name
    if ins.status != 'valid':
        issues.append(f"保险状态异常: {ins.status}")
    name_match, name_issues = _id_card_name_match(student, ins.student_name, ins.student_id_card)
    issues.extend(name_issues)
    if name_match:
        ok_items.append("保险与名单身份信息一致")
    start_dt = _parse_date(ins.start_date)
    end_dt = _parse_date(ins.end_date)
    today = _today()
    if not start_dt or not end_dt:
        issues.append(f"保险日期格式错误: {ins.start_date} ~ {ins.end_date}")
    else:
        if start_dt > today:
            issues.append(f"保险尚未生效: 生效日期{ins.start_date}")
        else:
            ok_items.append(f"保险已生效: {ins.start_date}")
        if end_dt < today:
            issues.append(f"保险已过期: 终止日期{ins.end_date}")
        if trip_start:
            trip_dt = _parse_date(trip_start)
            if trip_dt and end_dt < trip_dt:
                issues.append(f"保险覆盖不到活动结束: 保险截止{ins.end_date} < 活动开始{trip_start}")
    return issues, warnings, ok_items


def _check_authorization(student: Student, auth: Optional[Authorization]) -> Tuple[List[str], List[str], List[str]]:
    issues = []
    warnings = []
    ok_items = []
    if not auth:
        issues.append("未找到家长授权书")
        return issues, warnings, ok_items
    name_match, name_issues = _id_card_name_match(student, auth.student_name, auth.student_id_card)
    issues.extend(name_issues)
    if name_match:
        ok_items.append("授权书与名单身份信息一致")
    if not auth.signature_status:
        issues.append("家长未签字确认")
    else:
        ok_items.append("家长已签字授权")
    if not auth.emergency_contact:
        warnings.append("未填写紧急联系人姓名")
    if not auth.emergency_phone:
        issues.append("未填写紧急联系电话")
    if auth.medical_allergy and auth.medical_allergy not in ['无', '']:
        warnings.append(f"有药物过敏史: {auth.medical_allergy}")
    if auth.special_needs and auth.special_needs not in ['无', '']:
        warnings.append(f"有特殊照顾需求: {auth.special_needs}")
    return issues, warnings, ok_items


def _check_vehicle(student: Student, vehicle: Optional[Vehicle]) -> Tuple[List[str], List[str], List[str]]:
    issues = []
    warnings = []
    ok_items = []
    if not vehicle:
        issues.append("未分配车辆座位")
        return issues, warnings, ok_items
    if len(vehicle.student_ids) > vehicle.capacity:
        issues.append(f"车辆{vehicle.plate_number}超员: {len(vehicle.student_ids)}人 > 容量{vehicle.capacity}人")
    else:
        ok_items.append(f"已分配车辆: {vehicle.plate_number} (司机: {vehicle.driver_name})")
    return issues, warnings, ok_items


def _check_withdrawal(student: Student, withdrawal: Optional[Withdrawal]) -> Tuple[List[str], List[str], List[str], bool]:
    issues = []
    warnings = []
    ok_items = []
    is_withdrawn = False
    if not withdrawal:
        return issues, warnings, ok_items, is_withdrawn
    is_withdrawn = True
    issues.append(f"该学生已退团: {withdrawal.reason} (退团日期: {withdrawal.withdrawal_date}, 操作人: {withdrawal.operator})")
    if not withdrawal.insurance_voided:
        issues.append("退团后保险尚未作废，请及时处理")
    else:
        ok_items.append("退团后保险已作废")
    return issues, warnings, ok_items, is_withdrawn


def check_student(student: Student, trip_start: Optional[str] = None) -> CheckReport:
    check_time = datetime.now().isoformat(timespec='seconds')
    all_issues = []
    all_warnings = []
    all_ok = []
    is_withdrawn = False
    withdrawal = WithdrawalRepo.get_by_student_id(student.id)
    ins = InsuranceRepo.get_by_student_id_card(student.id_card)
    ins_by_name = _find_insurance_by_name(student) if not ins else None
    auth = AuthorizationRepo.get_by_student_id_card(student.id_card)
    vehicle = VehicleRepo.get_by_student(student.id)
    if withdrawal:
        i, w, o, iw = _check_withdrawal(student, withdrawal)
        all_issues.extend(i)
        all_warnings.extend(w)
        all_ok.extend(o)
        is_withdrawn = iw
    if not is_withdrawn:
        i, w, o = _check_insurance(student, ins, ins_by_name, trip_start)
        all_issues.extend(i)
        all_warnings.extend(w)
        all_ok.extend(o)
        i, w, o = _check_authorization(student, auth)
        all_issues.extend(i)
        all_warnings.extend(w)
        all_ok.extend(o)
        i, w, o = _check_vehicle(student, vehicle)
        all_issues.extend(i)
        all_warnings.extend(w)
        all_ok.extend(o)
    if is_withdrawn:
        result = CheckResult.CANNOT_GO
    elif all_issues:
        critical_issues = [x for x in all_issues if '未找到' in x or '未生效' in x or '未签字' in x or '未分配' in x or '不一致' in x]
        if critical_issues:
            result = CheckResult.CANNOT_GO
        else:
            result = CheckResult.NEED_INFO
    else:
        result = CheckResult.CAN_GO
    return CheckReport(
        student_id=student.id,
        student_name=student.name,
        student_id_card=student.id_card,
        result=result,
        issues=all_issues,
        warnings=all_warnings,
        ok_items=all_ok,
        check_time=check_time,
        is_withdrawn=is_withdrawn,
    )


def check_all(trip_start: Optional[str] = None) -> Tuple[str, List[CheckReport]]:
    check_time = datetime.now().isoformat(timespec='seconds')
    students = StudentRepo.get_all()
    reports = []
    for s in students:
        r = check_student(s, trip_start)
        r.check_time = check_time
        CheckReportRepo.save(r)
        reports.append(r)
    return check_time, reports


def get_student_history(student_id: str, limit: int = 10) -> List[CheckReport]:
    from .database import get_conn
    with get_conn() as conn:
        rows = conn.execute('''
            SELECT * FROM check_reports WHERE student_id = ?
            ORDER BY check_time DESC LIMIT ?
        ''', (student_id, limit)).fetchall()
        from .database import _row_to_check_report
        return [_row_to_check_report(r) for r in rows]


def get_summary(check_time: str) -> Dict[str, List[CheckReport]]:
    reports = CheckReportRepo.get_by_check_time(check_time)
    result = {
        'can_go': [],
        'cannot_go': [],
        'need_info': [],
    }
    for r in reports:
        if r.result == CheckResult.CAN_GO:
            result['can_go'].append(r)
        elif r.result == CheckResult.CANNOT_GO:
            result['cannot_go'].append(r)
        else:
            result['need_info'].append(r)
    return result


def check_duplicates() -> List[Dict]:
    return StudentRepo.get_duplicates()


def get_student_full_info(student_id: str) -> Dict:
    student = StudentRepo.get_by_id(student_id)
    if not student:
        return {}
    insurance = InsuranceRepo.get_by_student_id_card(student.id_card)
    authorization = AuthorizationRepo.get_by_student_id_card(student.id_card)
    vehicle = VehicleRepo.get_by_student(student_id)
    withdrawal = WithdrawalRepo.get_by_student_id(student_id)
    latest_report = CheckReportRepo.get_latest(student_id)
    from .database import AuditRepo
    audit_logs = AuditRepo.get_by_entity('student', student_id)
    return {
        'student': student,
        'insurance': insurance,
        'authorization': authorization,
        'vehicle': vehicle,
        'withdrawal': withdrawal,
        'latest_report': latest_report,
        'audit_logs': audit_logs,
    }
