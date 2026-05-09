#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta

sys.path.insert(0, '.')

from app.models import (
    VisitorCreate, VisitorUpdate, VisitorStatus,
    PermissionStatus, ParkingStatus, AnomalyType
)
from app.services import (
    VisitorService, PermissionService, ParkingService,
    AnomalyService, SummaryService
)
from app.storage import storage


def create_test_visitor(needs_parking=False, car_plate=None):
    data = VisitorCreate(
        visitor_name="测试访客",
        visitor_phone="13800138000",
        visitor_company="测试公司",
        host_name="张三",
        host_department="技术部",
        scheduled_start_time=datetime.now() + timedelta(hours=1),
        scheduled_end_time=datetime.now() + timedelta(hours=3),
        purpose="技术交流",
        needs_parking=needs_parking,
        car_plate=car_plate,
        access_areas=["A栋1楼", "B栋会议室"]
    )
    return VisitorService.create_visitor(data, actor="admin")


def reset_storage():
    storage.visitors = {}
    storage.permissions = {}
    storage.parkings = {}
    storage.anomalies = {}
    storage.audit_logs = []
    storage._visitor_history = {}
    ParkingService.reset_parking_pool()


def run_test(name, test_func):
    reset_storage()
    try:
        test_func()
        print(f"✓ {name}")
        return True
    except AssertionError as e:
        print(f"✗ {name}: {e}")
        return False
    except Exception as e:
        print(f"✗ {name}: 异常 - {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_create_visitor():
    visitor = create_test_visitor()
    assert visitor.status == VisitorStatus.PENDING
    assert visitor.visitor_name == "测试访客"
    assert visitor.host_name == "张三"
    assert visitor.permission_id is None
    assert visitor.parking_id is None


def test_approve_visitor_issues_permission():
    visitor = create_test_visitor()
    approved = VisitorService.approve_visitor(visitor.id, actor="admin")
    assert approved.status == VisitorStatus.APPROVED
    
    permission = PermissionService.get_permission(visitor.id)
    assert permission is not None
    assert permission.status == PermissionStatus.ISSUED
    assert set(permission.access_areas) == {"A栋1楼", "B栋会议室"}


def test_approve_visitor_with_parking():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    approved = VisitorService.approve_visitor(visitor.id, actor="admin")
    assert approved.status == VisitorStatus.APPROVED
    
    parking = ParkingService.get_parking(visitor.id)
    assert parking is not None
    assert parking.status == ParkingStatus.ASSIGNED
    assert parking.car_plate == "京A12345"
    assert parking.spot_number.startswith("A-")


def test_full_lifecycle_approve_checkin_checkout():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    
    VisitorService.approve_visitor(visitor.id, actor="admin")
    permission = PermissionService.get_permission(visitor.id)
    parking = ParkingService.get_parking(visitor.id)
    assert permission.status == PermissionStatus.ISSUED
    assert parking.status == ParkingStatus.ASSIGNED
    
    checked_in = VisitorService.checkin(visitor.id, actor="门禁系统")
    assert checked_in.status == VisitorStatus.CHECKED_IN
    assert checked_in.actual_checkin_time is not None
    
    checked_out = VisitorService.checkout(visitor.id, actor="门禁系统")
    assert checked_out.status == VisitorStatus.CHECKED_OUT
    assert checked_out.actual_checkout_time is not None
    
    permission = PermissionService.get_permission(visitor.id)
    parking = ParkingService.get_parking(visitor.id)
    assert permission.status == PermissionStatus.REVOKED
    assert parking.status == ParkingStatus.RELEASED


def test_reschedule_changes_time_reissues_permission():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    old_permission = PermissionService.get_permission(visitor.id)
    old_parking = ParkingService.get_parking(visitor.id)
    
    new_start = datetime.now() + timedelta(hours=2)
    new_end = datetime.now() + timedelta(hours=4)
    updated = VisitorService.reschedule_visitor(
        visitor.id,
        VisitorUpdate(
            scheduled_start_time=new_start,
            scheduled_end_time=new_end
        ),
        actor="admin"
    )
    
    assert updated.status == VisitorStatus.RESCHEDULED
    assert updated.scheduled_start_time == new_start
    
    new_permission = PermissionService.get_permission(visitor.id)
    assert new_permission.id != old_permission.id
    assert new_permission.status == PermissionStatus.ISSUED
    assert old_permission.status == PermissionStatus.REVOKED
    
    new_parking = ParkingService.get_parking(visitor.id)
    assert new_parking.id != old_parking.id
    assert new_parking.status == ParkingStatus.ASSIGNED
    assert old_parking.status == ParkingStatus.RELEASED


def test_reschedule_changes_access_areas():
    visitor = create_test_visitor()
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    old_permission = PermissionService.get_permission(visitor.id)
    
    updated = VisitorService.reschedule_visitor(
        visitor.id,
        VisitorUpdate(access_areas=["C栋研发中心", "D栋实验室"]),
        actor="admin"
    )
    
    new_permission = PermissionService.get_permission(visitor.id)
    assert new_permission.id != old_permission.id
    assert set(new_permission.access_areas) == {"C栋研发中心", "D栋实验室"}
    assert old_permission.status == PermissionStatus.REVOKED


def test_reschedule_adds_parking():
    visitor = create_test_visitor(needs_parking=False)
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    assert ParkingService.get_parking(visitor.id) is None
    
    updated = VisitorService.reschedule_visitor(
        visitor.id,
        VisitorUpdate(needs_parking=True, car_plate="京B67890"),
        actor="admin"
    )
    
    parking = ParkingService.get_parking(visitor.id)
    assert parking is not None
    assert parking.status == ParkingStatus.ASSIGNED
    assert parking.car_plate == "京B67890"


def test_reschedule_removes_parking():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    old_parking = ParkingService.get_parking(visitor.id)
    assert old_parking.status == ParkingStatus.ASSIGNED
    
    updated = VisitorService.reschedule_visitor(
        visitor.id,
        VisitorUpdate(needs_parking=False),
        actor="admin"
    )
    
    assert old_parking.status == ParkingStatus.RELEASED


def test_cannot_reschedule_after_checkin():
    visitor = create_test_visitor()
    VisitorService.approve_visitor(visitor.id, actor="admin")
    VisitorService.checkin(visitor.id, actor="门禁系统")
    
    try:
        VisitorService.reschedule_visitor(
            visitor.id,
            VisitorUpdate(scheduled_start_time=datetime.now() + timedelta(hours=5)),
            actor="admin"
        )
        assert False, "应该抛出异常"
    except ValueError as e:
        assert "不支持改约" in str(e)


def test_checkin_requires_approved_status():
    visitor = create_test_visitor()
    
    try:
        VisitorService.checkin(visitor.id, actor="门禁系统")
        assert False, "应该抛出异常"
    except ValueError as e:
        assert "不支持签到" in str(e)
    
    anomalies = AnomalyService.get_anomalies(visitor_id=visitor.id)
    assert any(a.anomaly_type == AnomalyType.INVALID_CHECKIN for a in anomalies)


def test_checkin_requires_issued_permission():
    visitor = create_test_visitor()
    storage.save_visitor(visitor.model_copy(update={"status": VisitorStatus.APPROVED}))
    
    try:
        VisitorService.checkin(visitor.id, actor="门禁系统")
        assert False, "应该抛出异常"
    except ValueError as e:
        assert "门禁权限未下发" in str(e)
    
    anomalies = AnomalyService.get_anomalies(visitor_id=visitor.id)
    assert any(a.anomaly_type == AnomalyType.STATUS_INCONSISTENCY for a in anomalies)


def test_cancel_revokes_permission_and_parking():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    permission = PermissionService.get_permission(visitor.id)
    parking = ParkingService.get_parking(visitor.id)
    
    cancelled = VisitorService.cancel_visitor(visitor.id, actor="admin")
    assert cancelled.status == VisitorStatus.CANCELLED
    
    assert permission.status == PermissionStatus.REVOKED
    assert parking.status == ParkingStatus.RELEASED


def test_cannot_cancel_after_checkin():
    visitor = create_test_visitor()
    VisitorService.approve_visitor(visitor.id, actor="admin")
    VisitorService.checkin(visitor.id, actor="门禁系统")
    
    try:
        VisitorService.cancel_visitor(visitor.id, actor="admin")
        assert False, "应该抛出异常"
    except ValueError as e:
        assert "不支持取消" in str(e)


def test_summary_returns_complete_information():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    summary = SummaryService.get_visitor_summary(visitor.id)
    
    assert "visitor" in summary
    assert "permission" in summary
    assert "parking" in summary
    assert "anomalies" in summary
    assert "history" in summary
    assert "audit_logs" in summary
    assert "consistency_check" in summary
    
    assert summary["permission"]["status"] == PermissionStatus.ISSUED.value
    assert summary["parking"]["status"] == ParkingStatus.ASSIGNED.value


def test_consistency_check_approved_state():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    VisitorService.approve_visitor(visitor.id, actor="admin")
    
    summary = SummaryService.get_visitor_summary(visitor.id)
    cc = summary["consistency_check"]
    
    assert cc["status_matches_permission"]["is_consistent"] == True
    assert cc["status_matches_parking"]["is_consistent"] == True
    assert cc["permission_parking_aligned"] == True


def test_consistency_check_checked_out_state():
    visitor = create_test_visitor(needs_parking=True, car_plate="京A12345")
    VisitorService.approve_visitor(visitor.id, actor="admin")
    VisitorService.checkin(visitor.id, actor="门禁系统")
    VisitorService.checkout(visitor.id, actor="门禁系统")
    
    summary = SummaryService.get_visitor_summary(visitor.id)
    cc = summary["consistency_check"]
    
    assert cc["status_matches_permission"]["is_consistent"] == True
    assert cc["status_matches_parking"]["is_consistent"] == True
    assert cc["permission_parking_aligned"] == True


def test_history_tracks_changes():
    visitor = create_test_visitor()
    history1 = storage.get_visitor_history(visitor.id)
    assert len(history1) == 1
    
    VisitorService.approve_visitor(visitor.id, actor="admin")
    history2 = storage.get_visitor_history(visitor.id)
    assert len(history2) == 2
    assert history2[0].status == VisitorStatus.PENDING
    assert history2[1].status == VisitorStatus.APPROVED
    
    VisitorService.reschedule_visitor(
        visitor.id,
        VisitorUpdate(access_areas=["新区域"]),
        actor="admin"
    )
    history3 = storage.get_visitor_history(visitor.id)
    assert len(history3) == 3
    assert history3[2].status == VisitorStatus.RESCHEDULED


def test_audit_logs_record_all_actions():
    visitor = create_test_visitor()
    VisitorService.approve_visitor(visitor.id, actor="admin")
    VisitorService.checkin(visitor.id, actor="门禁系统")
    VisitorService.checkout(visitor.id, actor="门禁系统")
    
    logs = storage.get_audit_logs_by_visitor(visitor.id)
    actions = [log.action for log in logs]
    
    assert "创建访客单" in actions
    assert "审批通过" in actions
    assert "权限-下发权限" in actions
    assert "签到" in actions
    assert "签退" in actions
    assert "权限-回收权限" in actions


def test_parking_spots_are_not_duplicated():
    v1 = create_test_visitor(needs_parking=True, car_plate="京A1")
    v2 = create_test_visitor(needs_parking=True, car_plate="京A2")
    v3 = create_test_visitor(needs_parking=True, car_plate="京A3")
    
    VisitorService.approve_visitor(v1.id, actor="admin")
    VisitorService.approve_visitor(v2.id, actor="admin")
    VisitorService.approve_visitor(v3.id, actor="admin")
    
    p1 = ParkingService.get_parking(v1.id)
    p2 = ParkingService.get_parking(v2.id)
    p3 = ParkingService.get_parking(v3.id)
    
    spots = {p1.spot_number, p2.spot_number, p3.spot_number}
    assert len(spots) == 3


def test_released_spot_can_be_reassigned():
    v1 = create_test_visitor(needs_parking=True, car_plate="京A1")
    VisitorService.approve_visitor(v1.id, actor="admin")
    
    p1 = ParkingService.get_parking(v1.id)
    spot1 = p1.spot_number
    
    VisitorService.checkin(v1.id, actor="门禁系统")
    VisitorService.checkout(v1.id, actor="门禁系统")
    
    v2 = create_test_visitor(needs_parking=True, car_plate="京A2")
    VisitorService.approve_visitor(v2.id, actor="admin")
    
    p2 = ParkingService.get_parking(v2.id)
    assert p2.spot_number == spot1


if __name__ == "__main__":
    print("=" * 60)
    print("企业门禁访客预约 API - 单元测试")
    print("=" * 60)
    
    tests = [
        ("访客生命周期测试", [
            test_create_visitor,
            test_approve_visitor_issues_permission,
            test_approve_visitor_with_parking,
            test_full_lifecycle_approve_checkin_checkout,
        ]),
        ("改约逻辑测试", [
            test_reschedule_changes_time_reissues_permission,
            test_reschedule_changes_access_areas,
            test_reschedule_adds_parking,
            test_reschedule_removes_parking,
            test_cannot_reschedule_after_checkin,
        ]),
        ("签到核验测试", [
            test_checkin_requires_approved_status,
            test_checkin_requires_issued_permission,
        ]),
        ("取消逻辑测试", [
            test_cancel_revokes_permission_and_parking,
            test_cannot_cancel_after_checkin,
        ]),
        ("汇总和一致性测试", [
            test_summary_returns_complete_information,
            test_consistency_check_approved_state,
            test_consistency_check_checked_out_state,
            test_history_tracks_changes,
        ]),
        ("审计日志测试", [
            test_audit_logs_record_all_actions,
        ]),
        ("车位池测试", [
            test_parking_spots_are_not_duplicated,
            test_released_spot_can_be_reassigned,
        ]),
    ]
    
    all_passed = True
    total = 0
    passed = 0
    
    for group_name, test_funcs in tests:
        print(f"\n【{group_name}】")
        for test_func in test_funcs:
            total += 1
            if run_test(f"  {test_func.__name__}", test_func):
                passed += 1
            else:
                all_passed = False
    
    print("\n" + "=" * 60)
    print(f"测试结果: {passed}/{total} 通过")
    if all_passed:
        print("✓ 所有测试通过!")
    else:
        print("✗ 部分测试失败!")
    print("=" * 60)
    
    sys.exit(0 if all_passed else 1)
