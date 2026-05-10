from datetime import date
import pytest

from volunteer_scheduler.models import (
    Volunteer,
    PositionRequirement,
    Schedule,
    LeaveRequest,
    generate_id,
    CheckInPermission,
    ScheduleStatus,
)


class TestVolunteerQualificationMatching:
    def test_volunteer_has_single_qualification(self):
        volunteer = Volunteer(
            volunteer_id="v1",
            name="测试志愿者",
            qualifications=["first_aid", "driving"],
        )
        assert volunteer.has_qualification("first_aid") is True
        assert volunteer.has_qualification("driving") is True
        assert volunteer.has_qualification("security") is False

    def test_volunteer_matches_empty_requirements(self):
        volunteer = Volunteer(
            volunteer_id="v1",
            name="测试志愿者",
            qualifications=["first_aid"],
        )
        assert volunteer.matches_requirements([]) is True

    def test_volunteer_matches_all_requirements(self):
        volunteer = Volunteer(
            volunteer_id="v1",
            name="测试志愿者",
            qualifications=["first_aid", "driving", "english"],
        )
        assert volunteer.matches_requirements(["first_aid", "driving"]) is True

    def test_volunteer_does_not_match_missing_qualification(self):
        volunteer = Volunteer(
            volunteer_id="v1",
            name="测试志愿者",
            qualifications=["first_aid", "driving"],
        )
        assert volunteer.matches_requirements(["first_aid", "security"]) is False

    def test_volunteer_inactive_still_matches_qualification(self):
        volunteer = Volunteer(
            volunteer_id="v1",
            name="测试志愿者",
            qualifications=["first_aid"],
            is_active=False,
        )
        assert volunteer.has_qualification("first_aid") is True


class TestScheduleStates:
    def test_new_schedule_default_states(self):
        schedule = Schedule(
            schedule_id="s1",
            position_id="p1",
            volunteer_id="v1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
        )
        assert schedule.checkin_permission == CheckInPermission.GRANTED
        assert schedule.status == ScheduleStatus.ACTIVE

    def test_schedule_to_dict_conversion(self):
        schedule = Schedule(
            schedule_id="s1",
            position_id="p1",
            volunteer_id="v1",
            date=date(2024, 1, 15),
            time_slot="09:00-12:00",
        )
        data = schedule.to_dict()
        assert data["date"] == "2024-01-15"
        assert data["checkin_permission"] == "granted"
        assert data["status"] == "active"


class TestIdGeneration:
    def test_generate_id_returns_unique_values(self):
        id1 = generate_id()
        id2 = generate_id()
        assert id1 != id2
        assert len(id1) > 0
