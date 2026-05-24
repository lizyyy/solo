from typing import List, Tuple
from .models import Performance, FireworkPoint, FireApproval, TestRecord

MIN_SAFE_DISTANCE = 5.0
REQUIRED_TEST_RECORDS = 1

class ApprovalStatus:
    PENDING = "pending"
    POINTS_SUBMITTED = "points_submitted"
    POINTS_VERIFIED = "points_verified"
    FIRE_APPROVED = "fire_approved"
    TEST_COMPLETED = "test_completed"
    PROPS_CONFIRMED = "props_confirmed"
    FINAL_APPROVED = "final_approved"
    REJECTED = "rejected"

STATUS_TRANSITIONS = {
    ApprovalStatus.PENDING: [ApprovalStatus.POINTS_SUBMITTED, ApprovalStatus.REJECTED],
    ApprovalStatus.POINTS_SUBMITTED: [ApprovalStatus.POINTS_VERIFIED, ApprovalStatus.REJECTED],
    ApprovalStatus.POINTS_VERIFIED: [ApprovalStatus.FIRE_APPROVED, ApprovalStatus.REJECTED],
    ApprovalStatus.FIRE_APPROVED: [ApprovalStatus.TEST_COMPLETED, ApprovalStatus.REJECTED],
    ApprovalStatus.TEST_COMPLETED: [ApprovalStatus.PROPS_CONFIRMED, ApprovalStatus.REJECTED],
    ApprovalStatus.PROPS_CONFIRMED: [ApprovalStatus.FINAL_APPROVED, ApprovalStatus.REJECTED],
    ApprovalStatus.FINAL_APPROVED: [],
    ApprovalStatus.REJECTED: [ApprovalStatus.PENDING]
}

def can_transition(current_status: str, next_status: str) -> bool:
    return next_status in STATUS_TRANSITIONS.get(current_status, [])

def validate_firework_points(points: List[FireworkPoint]) -> Tuple[bool, List[str], List[str]]:
    violations = []
    warnings = []
    
    for point in points:
        if point.distance_to_audience < MIN_SAFE_DISTANCE:
            violations.append(
                f"点位 {point.location_code}: 距离观众区 {point.distance_to_audience}m "
                f"低于安全距离 {MIN_SAFE_DISTANCE}m"
            )
        
        if point.quantity > 50:
            warnings.append(
                f"点位 {point.location_code}: 烟火数量 {point.quantity} 较大，建议增加防护措施"
            )
    
    is_valid = len(violations) == 0
    return is_valid, violations, warnings

def check_fire_approval(approvals: List[FireApproval]) -> Tuple[bool, List[str]]:
    violations = []
    
    fire_dept_approved = any(
        a.department == "消防部门" and a.status == "approved"
        for a in approvals
    )
    
    if not fire_dept_approved:
        violations.append("缺少消防部门审批")
    
    has_certificate = any(
        a.department == "消防部门" and a.certificate_number
        for a in approvals
    )
    
    if not has_certificate and fire_dept_approved:
        violations.append("消防审批缺少证书编号")
    
    return len(violations) == 0, violations

def check_test_records(test_records: List[TestRecord]) -> Tuple[bool, List[str]]:
    violations = []
    
    if len(test_records) < REQUIRED_TEST_RECORDS:
        violations.append(f"试放记录不足: 需要 {REQUIRED_TEST_RECORDS} 条，实际 {len(test_records)} 条")
    
    passed_tests = [t for t in test_records if t.test_result == "passed"]
    if len(passed_tests) < REQUIRED_TEST_RECORDS:
        violations.append("试放记录未通过或缺失")
    
    for test in test_records:
        if not test.video_evidence_url:
            violations.append(f"试放记录 {test.id} 缺少视频证据")
    
    return len(violations) == 0, violations

def check_temporary_performance(performance: Performance) -> Tuple[bool, List[str]]:
    violations = []
    
    if performance.is_temporary:
        if performance.status != ApprovalStatus.FINAL_APPROVED:
            violations.append("临时加场必须完成全部审批流程后方可执行")
    
    return len(violations) == 0, violations

def full_approval_check(
    performance: Performance,
    points: List[FireworkPoint],
    approvals: List[FireApproval],
    test_records: List[TestRecord]
) -> Tuple[bool, List[str], List[str]]:
    all_violations = []
    all_warnings = []
    
    points_valid, points_violations, points_warnings = validate_firework_points(points)
    all_violations.extend(points_violations)
    all_warnings.extend(points_warnings)
    
    fire_valid, fire_violations = check_fire_approval(approvals)
    all_violations.extend(fire_violations)
    
    test_valid, test_violations = check_test_records(test_records)
    all_violations.extend(test_violations)
    
    temp_valid, temp_violations = check_temporary_performance(performance)
    all_violations.extend(temp_violations)
    
    is_approved = len(all_violations) == 0
    return is_approved, all_violations, all_warnings
