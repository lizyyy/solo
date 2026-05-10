from datetime import date
import pytest

from volunteer_scheduler.models import (
    PositionRequirement,
    Volunteer,
    Schedule,
    LeaveRequest,
    generate_id,
    CheckInPermission,
    ScheduleStatus,
    LeaveStatus,
    EventType,
)
from volunteer_scheduler.scheduler import (
    VolunteerScheduler,
    SchedulerState,
    ValidationError,
    NotFoundError,
    ConflictError,
    SchedulingError,
)


def create_test_scheduler():
    state = SchedulerState()

    state.positions["p1"] = PositionRequirement(
        position_id="p1",
        name="急救站",
        required_qualifications=["first_aid"],
        required_count=2,
        date=date(2024, 1, 15),
        time_slot="09:00-12:00",
    )

    state.positions["p2"] = PositionRequirement(
        position_id="p2",
        name="安检入口",
        required_qualifications=["security"],
        required_count=1,
        date=date(2024, 1, 15),
        time_slot="09:00-12:00",
    )

    state.volunteers["v1"] = Volunteer(
        volunteer_id="v1",
        name="张三",
        qualifications=["first_aid", "driving"],
        phone="13800138001",
    )

    state.volunteers["v2"] = Volunteer(
        volunteer_id="v2",
        name="李四",
        qualifications=["first_aid"],
        phone="13800138002",
    )

    state.volunteers["v3"] = Volunteer(
        volunteer_id="v3",
        name="王五",
        qualifications=["security"],
        phone="13800138003",
        is_active=True,
    )

    state.volunteers["v4"] = Volunteer(
        volunteer_id="v4",
        name="赵六",
        qualifications=["first_aid"],
        phone="13800138004",
        is_active=False,
    )

    state.schedules["s1"] = Schedule(
        schedule_id="s1",
        position_id="p1",
        volunteer_id="v1",
        date=date(2024, 1, 15),
        time_slot="09:00-12:00",
    )

    state.schedules["s2"] = Schedule(
        schedule_id="s2",
        position_id="p1",
        volunteer_id="v2",
        date=date(2024, 1, 15),
        time_slot="09:00-12:00",
    )

    state.schedules["s3"] = Schedule(
        schedule_id="s3",
        position_id="p2",
        volunteer_id="v3",
        date=date(2024, 1, 15),
        time_slot="09:00-12:00",
    )

    return VolunteerScheduler(state=state)


class TestLeaveRequestValidation:
    def test_missing_volunteer_id_raises_validation_error(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(ValidationError, match="志愿者ID不能为空"):
            scheduler.validate_leave_request(leave)

    def test_missing_schedule_id_raises_validation_error(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(ValidationError, match="排班ID不能为空"):
            scheduler.validate_leave_request(leave)

    def test_missing_reason_raises_validation_error(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="",
        )
        with pytest.raises(ValidationError, match="请假原因不能为空"):
            scheduler.validate_leave_request(leave)

    def test_nonexistent_volunteer_raises_not_found_error(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="invalid_v",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(NotFoundError, match="志愿者不存在"):
            scheduler.validate_leave_request(leave)

    def test_nonexistent_schedule_raises_not_found_error(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="invalid_s",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(NotFoundError, match="排班记录不存在"):
            scheduler.validate_leave_request(leave)

    def test_schedule_not_belonging_to_volunteer_raises_conflict(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s2",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(ConflictError, match="排班记录不属于该志愿者"):
            scheduler.validate_leave_request(leave)

    def test_inactive_schedule_raises_conflict(self):
        scheduler = create_test_scheduler()
        scheduler.state.schedules["s1"].status = ScheduleStatus.REPLACED
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(ConflictError, match="排班记录状态异常"):
            scheduler.validate_leave_request(leave)

    def test_revoked_permission_raises_conflict(self):
        scheduler = create_test_scheduler()
        scheduler.state.schedules["s1"].checkin_permission = CheckInPermission.REVOKED
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        with pytest.raises(ConflictError, match="签到权限已被撤销"):
            scheduler.validate_leave_request(leave)

    def test_valid_leave_request_passes_validation(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        assert scheduler.validate_leave_request(leave) is True


class TestDuplicateLeaveRequestDetection:
    def test_no_duplicate_returns_false(self):
        scheduler = create_test_scheduler()
        assert scheduler.is_duplicate_leave_request("s1") is False

    def test_pending_duplicate_returns_true(self):
        scheduler = create_test_scheduler()
        scheduler.state.leave_requests["l1"] = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
            status=LeaveStatus.PENDING,
        )
        assert scheduler.is_duplicate_leave_request("s1") is True

    def test_approved_duplicate_returns_true(self):
        scheduler = create_test_scheduler()
        scheduler.state.leave_requests["l1"] = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
            status=LeaveStatus.APPROVED,
        )
        assert scheduler.is_duplicate_leave_request("s1") is True

    def test_rejected_not_considered_duplicate(self):
        scheduler = create_test_scheduler()
        scheduler.state.leave_requests["l1"] = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
            status=LeaveStatus.REJECTED,
        )
        assert scheduler.is_duplicate_leave_request("s1") is False


class TestSubstituteFinding:
    def test_finds_qualified_substitute(self):
        scheduler = create_test_scheduler()
        substitutes = scheduler.find_eligible_substitutes(
            "p1", {"v1"}, date(2024, 1, 15), "09:00-12:00"
        )
        assert len(substitutes) == 0

    def test_excludes_original_volunteer(self):
        scheduler = create_test_scheduler()
        substitutes = scheduler.find_eligible_substitutes(
            "p1", {"v1", "v2"}, date(2024, 1, 15), "09:00-12:00"
        )
        assert len(substitutes) == 0

    def test_excludes_inactive_volunteers(self):
        scheduler = create_test_scheduler()
        substitutes = scheduler.find_eligible_substitutes(
            "p1", {"v1", "v2"}, date(2024, 1, 15), "09:00-12:00"
        )
        v4_ids = [v.volunteer_id for v in substitutes]
        assert "v4" not in v4_ids

    def test_does_not_find_mismatched_qualifications(self):
        scheduler = create_test_scheduler()
        substitutes = scheduler.find_eligible_substitutes(
            "p2", {"v3"}, date(2024, 1, 15), "09:00-12:00"
        )
        assert len(substitutes) == 0

    def test_nonexistent_position_raises_error(self):
        scheduler = create_test_scheduler()
        with pytest.raises(NotFoundError, match="岗位不存在"):
            scheduler.find_eligible_substitutes(
                "invalid", {"v1"}, date(2024, 1, 15), "09:00-12:00"
            )


class TestGapDetection:
    def test_no_gap_when_full_staffed(self):
        scheduler = create_test_scheduler()
        gap = scheduler.get_position_gap("p1")
        assert gap.gap_count == 0
        assert gap.severity == "low"

    def test_gap_detected_when_under_staffed(self):
        scheduler = create_test_scheduler()
        scheduler.state.schedules["s2"].checkin_permission = CheckInPermission.REVOKED
        gap = scheduler.get_position_gap("p1")
        assert gap.gap_count == 1
        assert gap.severity == "high"

    def test_gap_counts_only_active_granted_permissions(self):
        scheduler = create_test_scheduler()
        scheduler.state.schedules["s1"].status = ScheduleStatus.REPLACED
        gap = scheduler.get_position_gap("p1")
        assert gap.gap_count == 1

    def test_all_gaps_returns_only_gapped_positions(self):
        scheduler = create_test_scheduler()
        scheduler.state.schedules["s3"].checkin_permission = CheckInPermission.REVOKED
        gaps = scheduler.get_all_gaps()
        assert len(gaps) == 1
        assert gaps[0].position_id == "p2"


class TestLeaveApprovalFlow:
    def test_nonexistent_leave_id_raises_error(self):
        scheduler = create_test_scheduler()
        with pytest.raises(NotFoundError, match="请假记录不存在"):
            scheduler.process_leave_approval("invalid", True)

    def test_duplicate_leave_processing_raises_conflict(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        scheduler.state.leave_requests["l1"] = leave
        scheduler.state.processed_leave_ids.add("l1")
        with pytest.raises(ConflictError, match="重复请求被忽略"):
            scheduler.process_leave_approval("l1", True)

    def test_rejected_leave_does_not_change_schedule(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        scheduler.state.leave_requests["l1"] = leave
        original_permission = scheduler.state.schedules["s1"].checkin_permission

        substitution, gaps = scheduler.process_leave_approval("l1", False)

        assert substitution is None
        assert len(gaps) == 0
        assert scheduler.state.leave_requests["l1"].status == LeaveStatus.REJECTED
        assert scheduler.state.schedules["s1"].checkin_permission == original_permission

    def test_approved_leave_revokes_original_permission(self):
        scheduler = create_test_scheduler()
        scheduler.state.volunteers["v_new"] = Volunteer(
            volunteer_id="v_new",
            name="新替补",
            qualifications=["first_aid"],
        )
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        scheduler.state.leave_requests["l1"] = leave

        substitution, gaps = scheduler.process_leave_approval("l1", True)

        assert scheduler.state.schedules["s1"].checkin_permission == CheckInPermission.REVOKED
        assert scheduler.state.schedules["s1"].status == ScheduleStatus.REPLACED

    def test_approved_leave_finds_substitute_when_available(self):
        scheduler = create_test_scheduler()
        scheduler.state.volunteers["v_backup"] = Volunteer(
            volunteer_id="v_backup",
            name="备用志愿者",
            qualifications=["first_aid"],
        )
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        scheduler.state.leave_requests["l1"] = leave

        substitution, gaps = scheduler.process_leave_approval("l1", True)

        assert substitution is not None
        assert substitution.substitute_volunteer_id == "v_backup"
        assert substitution.original_volunteer_id == "v1"
        assert len(gaps) == 0

    def test_approved_leave_no_substitute_creates_gap(self):
        scheduler = create_test_scheduler()
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        scheduler.state.leave_requests["l1"] = leave

        substitution, gaps = scheduler.process_leave_approval("l1", True)

        assert substitution is None
        assert len(gaps) == 1
        assert gaps[0].position_id == "p1"
        assert gaps[0].gap_count == 1

    def test_event_logs_created_during_approval(self):
        scheduler = create_test_scheduler()
        scheduler.state.volunteers["v_backup"] = Volunteer(
            volunteer_id="v_backup",
            name="备用",
            qualifications=["first_aid"],
        )
        leave = LeaveRequest(
            leave_id="l1",
            volunteer_id="v1",
            schedule_id="s1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
            reason="生病",
        )
        scheduler.state.leave_requests["l1"] = leave
        initial_log_count = len(scheduler.state.event_logs)

        scheduler.process_leave_approval("l1", True)

        final_log_count = len(scheduler.state.event_logs)
        assert final_log_count > initial_log_count

        event_types = [log.event_type for log in scheduler.state.event_logs]
        assert EventType.LEAVE_APPROVED in event_types
        assert EventType.CHECKIN_PERMISSION_UPDATED in event_types
        assert EventType.SUBSTITUTION_FOUND in event_types


class TestCheckInPermissionUpdates:
    def test_update_permission_changes_state(self):
        scheduler = create_test_scheduler()
        old_updated_at = scheduler.state.schedules["s1"].updated_at

        schedule = scheduler.update_checkin_permission(
            "s1", CheckInPermission.REVOKED, "测试撤销"
        )

        assert schedule.checkin_permission == CheckInPermission.REVOKED
        assert schedule.updated_at >= old_updated_at
        assert schedule.notes == "测试撤销"

    def test_update_nonexistent_schedule_raises_error(self):
        scheduler = create_test_scheduler()
        with pytest.raises(NotFoundError, match="排班记录不存在"):
            scheduler.update_checkin_permission("invalid", CheckInPermission.REVOKED)


class TestScheduleExport:
    def test_export_returns_all_schedules(self):
        scheduler = create_test_scheduler()
        exported = scheduler.export_schedule()
        assert len(exported) == 3

    def test_export_filters_by_date(self):
        scheduler = create_test_scheduler()
        exported = scheduler.export_schedule(target_date=date(2024, 1, 15))
        assert len(exported) == 3

        exported_empty = scheduler.export_schedule(target_date=date(2024, 1, 16))
        assert len(exported_empty) == 0

    def test_export_includes_volunteer_and_position_names(self):
        scheduler = create_test_scheduler()
        exported = scheduler.export_schedule()
        first = exported[0]
        assert "volunteer_name" in first
        assert "position_name" in first
        assert first["volunteer_name"] is not None
        assert first["position_name"] is not None


class TestManualCorrection:
    def test_correct_volunteer_info(self):
        scheduler = create_test_scheduler()
        result = scheduler.apply_manual_correction(
            "Volunteer",
            "v1",
            {"name": "张三改", "phone": "13900139001"},
            corrected_by="admin",
        )
        assert result.name == "张三改"
        assert result.phone == "13900139001"

    def test_correct_nonexistent_entity_raises_error(self):
        scheduler = create_test_scheduler()
        with pytest.raises(NotFoundError):
            scheduler.apply_manual_correction(
                "Volunteer", "invalid", {"name": "测试"}
            )

    def test_unsupported_entity_type_raises_error(self):
        scheduler = create_test_scheduler()
        with pytest.raises(ValidationError, match="不支持的实体类型"):
            scheduler.apply_manual_correction(
                "InvalidType", "v1", {"name": "测试"}
            )

    def test_correction_logged_in_event_log(self):
        scheduler = create_test_scheduler()
        initial_count = len(scheduler.state.event_logs)
        scheduler.apply_manual_correction("Volunteer", "v1", {"name": "修改后"})
        event_types = [log.event_type for log in scheduler.state.event_logs]
        assert EventType.MANUAL_CORRECTION in event_types
