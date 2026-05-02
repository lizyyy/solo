"""测试核心逻辑（约束校验、排座算法）"""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chorus_planner.models.member import (
    Member, VoicePart, SeniorityLevel, MemberStatus
)
from chorus_planner.models.seating import (
    Seat, SeatingLayout, SeatingAssignment
)
from chorus_planner.core.constraint_validator import (
    ConstraintValidator, ValidationResult, ValidationIssue,
    IssueType, IssueSeverity
)
from chorus_planner.core.seating_algorithm import (
    SeatingAlgorithm, AlgorithmConfig, VoiceZone
)


class TestConstraintValidator(unittest.TestCase):
    """测试约束校验器"""
    
    def setUp(self):
        """设置测试环境"""
        self.validator = ConstraintValidator()
        
        self.members = {}
        
        self.m1 = Member(
            id="m1", name="张明", voice_part=VoicePart.SOPRANO_1,
            height_cm=165, seniority=SeniorityLevel.SENIOR, status=MemberStatus.PRESENT
        )
        self.members["m1"] = self.m1
        
        self.m2 = Member(
            id="m2", name="李华", voice_part=VoicePart.SOPRANO_1,
            height_cm=160, seniority=SeniorityLevel.NEW,
            status=MemberStatus.PRESENT, mentor_id="m1"
        )
        self.members["m2"] = self.m2
        
        self.m3 = Member(
            id="m3", name="王芳", voice_part=VoicePart.SOPRANO_2,
            height_cm=168, seniority=SeniorityLevel.MID, status=MemberStatus.PRESENT
        )
        self.members["m3"] = self.m3
        
        self.m4 = Member(
            id="m4", name="赵亮", voice_part=VoicePart.TENOR_1,
            height_cm=175, seniority=SeniorityLevel.SENIOR, status=MemberStatus.PRESENT
        )
        self.members["m4"] = self.m4
        
        self.m5 = Member(
            id="m5", name="钱伟", voice_part=VoicePart.TENOR_1,
            height_cm=178, seniority=SeniorityLevel.MID, status=MemberStatus.LEAVE
        )
        self.members["m5"] = self.m5
        
        self.m6 = Member(
            id="m6", name="孙强", voice_part=VoicePart.TENOR_1,
            height_cm=170, seniority=SeniorityLevel.MID, status=MemberStatus.PRESENT
        )
        self.members["m6"] = self.m6
        
        self.m7 = Member(
            id="m7", name="周杰", voice_part=VoicePart.BASS_1,
            height_cm=180, seniority=SeniorityLevel.SENIOR, status=MemberStatus.PRESENT
        )
        self.members["m7"] = self.m7
    
    def test_absent_in_seat(self):
        """测试请假成员占位校验"""
        layout = SeatingLayout(rows=2, cols=3)
        
        seats = list(layout.seats.values())
        
        layout.assign_member(seats[0].id, "m1")
        layout.assign_member(seats[1].id, "m5")
        
        result = self.validator.validate(layout, self.members)
        
        absent_issues = result.get_issues_by_type(IssueType.ABSENT_IN_SEAT)
        self.assertEqual(len(absent_issues), 1)
        self.assertEqual(absent_issues[0].severity, IssueSeverity.CRITICAL)
    
    def test_view_block(self):
        """测试视线遮挡校验"""
        layout = SeatingLayout(rows=2, cols=3)
        
        seats = list(layout.seats.values())
        
        seat_0_0 = layout.get_seat_at(0, 0)
        seat_1_0 = layout.get_seat_at(1, 0)
        
        layout.assign_member(seat_0_0.id, "m7")
        layout.assign_member(seat_1_0.id, "m1")
        
        result = self.validator.validate(layout, self.members)
        
        view_issues = result.get_issues_by_type(IssueType.VIEW_BLOCK)
        self.assertEqual(len(view_issues), 1)
        self.assertEqual(view_issues[0].severity, IssueSeverity.WARNING)
    
    def test_mentor_not_near(self):
        """测试带教新人未相邻校验"""
        layout = SeatingLayout(rows=2, cols=4)
        
        seat_0_0 = layout.get_seat_at(0, 0)
        seat_0_3 = layout.get_seat_at(0, 3)
        
        layout.assign_member(seat_0_0.id, "m1")
        layout.assign_member(seat_0_3.id, "m2")
        
        result = self.validator.validate(layout, self.members)
        
        mentor_issues = result.get_issues_by_type(IssueType.MENTOR_NOT_NEAR)
        self.assertEqual(len(mentor_issues), 1)
    
    def test_voice_gap(self):
        """测试同声部断层校验"""
        layout = SeatingLayout(rows=1, cols=5)
        
        for col in range(5):
            seat = layout.get_seat_at(0, col)
            if col == 0:
                layout.assign_member(seat.id, "m1")
            elif col == 1:
                layout.assign_member(seat.id, "m4")
            elif col == 2:
                layout.assign_member(seat.id, "m6")
            elif col == 3:
                layout.assign_member(seat.id, "m2")
            elif col == 4:
                layout.assign_member(seat.id, "m3")
        
        result = self.validator.validate(layout, self.members)
        
        voice_issues = result.get_issues_by_type(IssueType.VOICE_GAP)
        self.assertGreaterEqual(len(voice_issues), 1)
        
        layout2 = SeatingLayout(rows=1, cols=4)
        
        seat_0_0 = layout2.get_seat_at(0, 0)
        seat_0_1 = layout2.get_seat_at(0, 1)
        seat_0_2 = layout2.get_seat_at(0, 2)
        seat_0_3 = layout2.get_seat_at(0, 3)
        
        layout2.assign_member(seat_0_0.id, "m1")
        layout2.assign_member(seat_0_1.id, "m4")
        layout2.assign_member(seat_0_2.id, "m6")
        layout2.assign_member(seat_0_3.id, "m3")
        
        result2 = self.validator.validate(layout2, self.members)
        
        voice_issues2 = result2.get_issues_by_type(IssueType.VOICE_GAP)
        self.assertEqual(len(voice_issues2), 0)
    
    def test_restricted_partners(self):
        """测试限制搭档校验"""
        m1_with_restrict = Member(
            id="r1", name="限制1", voice_part=VoicePart.SOPRANO_1,
            height_cm=165, seniority=SeniorityLevel.MID,
            status=MemberStatus.PRESENT,
            restricted_partner_ids=["r2"]
        )
        
        m2_with_restrict = Member(
            id="r2", name="限制2", voice_part=VoicePart.SOPRANO_2,
            height_cm=165, seniority=SeniorityLevel.MID,
            status=MemberStatus.PRESENT
        )
        
        test_members = {"r1": m1_with_restrict, "r2": m2_with_restrict}
        
        layout = SeatingLayout(rows=1, cols=2)
        
        seat_0_0 = layout.get_seat_at(0, 0)
        seat_0_1 = layout.get_seat_at(0, 1)
        
        layout.assign_member(seat_0_0.id, "r1")
        layout.assign_member(seat_0_1.id, "r2")
        
        result = self.validator.validate(layout, test_members)
        
        restrict_issues = result.get_issues_by_type(IssueType.RESTRICTED_PARTNER)
        self.assertEqual(len(restrict_issues), 1)
        self.assertEqual(restrict_issues[0].severity, IssueSeverity.CRITICAL)
    
    def test_no_issues(self):
        """测试无问题的情况"""
        layout = SeatingLayout(rows=2, cols=2)
        
        seat_0_0 = layout.get_seat_at(0, 0)
        seat_0_1 = layout.get_seat_at(0, 1)
        seat_1_0 = layout.get_seat_at(1, 0)
        seat_1_1 = layout.get_seat_at(1, 1)
        
        layout.assign_member(seat_0_0.id, "m1")
        layout.assign_member(seat_0_1.id, "m2")
        layout.assign_member(seat_1_0.id, "m4")
        layout.assign_member(seat_1_1.id, "m6")
        
        result = self.validator.validate(layout, self.members)
        
        self.assertTrue(result.is_valid)
        
        layout2 = SeatingLayout(rows=1, cols=2)
        layout2.assign_member(layout2.get_seat_at(0, 0).id, "m1")
        layout2.assign_member(layout2.get_seat_at(0, 1).id, "m2")
        
        validator2 = ConstraintValidator()
        validator2.checks_enabled[IssueType.VOICE_GAP] = False
        validator2.checks_enabled[IssueType.MENTOR_NOT_NEAR] = False
        validator2.checks_enabled[IssueType.PREFERRED_NOT_NEAR] = False
        
        result2 = validator2.validate(layout2, self.members)
        
        self.assertTrue(result2.is_valid)


class TestSeatingAlgorithm(unittest.TestCase):
    """测试自动排座算法"""
    
    def setUp(self):
        """设置测试环境"""
        self.algorithm = SeatingAlgorithm(AlgorithmConfig(random_seed=42))
        
        self.members = {}
        
        heights_soprano = [
            Member(id=f"s{i}", name=f"女高{i}", voice_part=VoicePart.SOPRANO_1,
                    height_cm=160 + i * 2, seniority=SeniorityLevel.MID,
                    status=MemberStatus.PRESENT)
            for i in range(5)
        ]
        
        for m in heights_soprano:
            self.members[m.id] = m
        
        m_new = Member(
            id="new1", name="新人", voice_part=VoicePart.SOPRANO_1,
            height_cm=163, seniority=SeniorityLevel.NEW,
            status=MemberStatus.PRESENT, mentor_id="s0"
        )
        self.members["new1"] = m_new
        
        self.members["s0"].mentee_ids = ["new1"]
        self.members["s0"].seniority = SeniorityLevel.SENIOR
        
        self.m_leave = Member(
            id="leave1", name="请假", voice_part=VoicePart.SOPRANO_1,
            height_cm=168, seniority=SeniorityLevel.MID,
            status=MemberStatus.LEAVE
        )
        self.members["leave1"] = self.m_leave
    
    def test_auto_seat_basic(self):
        """测试基本自动排座"""
        layout = SeatingLayout(rows=2, cols=5)
        
        result = self.algorithm.auto_seat(layout, self.members)
        
        self.assertTrue(result.success)
        self.assertEqual(result.assigned_count, 6)
        
        occupied = layout.get_occupied_seats()
        self.assertEqual(len(occupied), 6)
        
        leave_member_seated = False
        for seat, assignment in occupied:
            if assignment.member_id == "leave1":
                leave_member_seated = True
                break
        self.assertFalse(leave_member_seated)
    
    def test_back_taller_strategy(self):
        """测试后排更高策略"""
        config = AlgorithmConfig(
            sort_by_height=True,
            height_direction="back_taller"
        )
        algorithm = SeatingAlgorithm(config)
        
        layout = SeatingLayout(rows=2, cols=5)
        
        algorithm.auto_seat(layout, self.members)
        
        members_at_seat = {}
        for seat_id, assignment in layout.assignments.items():
            if assignment.member_id in self.members:
                members_at_seat[seat_id] = self.members[assignment.member_id]
        
        row_0_heights = []
        row_1_heights = []
        
        for seat in layout.seats.values():
            if seat.id in members_at_seat:
                if seat.row == 0:
                    row_0_heights.append(members_at_seat[seat.id].height_cm)
                elif seat.row == 1:
                    row_1_heights.append(members_at_seat[seat.id].height_cm)
        
        if row_0_heights and row_1_heights:
            avg_row_0 = sum(row_0_heights) / len(row_0_heights)
            avg_row_1 = sum(row_1_heights) / len(row_1_heights)
            
            self.assertGreaterEqual(avg_row_1, avg_row_0)
    
    def test_locked_assignments_kept(self):
        """测试锁定分配被保留"""
        layout = SeatingLayout(rows=2, cols=5)
        
        seats = list(layout.seats.values())
        locked_seat_id = seats[0].id
        layout.assign_member(locked_seat_id, "s0", is_locked=True)
        
        self.algorithm.auto_seat(layout, self.members)
        
        assignment = layout.get_assignment_by_seat(locked_seat_id)
        self.assertIsNotNone(assignment)
        self.assertTrue(assignment.is_locked)
        self.assertEqual(assignment.member_id, "s0")
    
    def test_voice_zones(self):
        """测试声部分区"""
        self.members = {}
        
        voices = [
            ("s", VoicePart.SOPRANO_1),
            ("a", VoicePart.ALTO_1),
            ("t", VoicePart.TENOR_1),
            ("b", VoicePart.BASS_1),
        ]
        
        for prefix, vp in voices:
            for i in range(3):
                m = Member(
                    id=f"{prefix}{i}",
                    name=f"{prefix}{i}",
                    voice_part=vp,
                    height_cm=165,
                    seniority=SeniorityLevel.MID,
                    status=MemberStatus.PRESENT
                )
                self.members[m.id] = m
        
        layout = SeatingLayout(rows=1, cols=12)
        
        algorithm = SeatingAlgorithm(AlgorithmConfig(random_seed=42))
        algorithm.auto_seat(layout, self.members)
        
        zone_heights = {
            "soprano": [],
            "alto": [],
            "tenor": [],
            "bass": [],
        }
        
        for seat_id, assignment in layout.assignments.items():
            if assignment.member_id:
                member = self.members.get(assignment.member_id)
                if member:
                    seat = layout.seats.get(seat_id)
                    if seat:
                        zone = VoiceZone.voice_part_to_zone(member.voice_part)
                        zone_heights[zone.value.lower()].append(seat.col)
        
        if zone_heights["soprano"]:
            avg_s = sum(zone_heights["soprano"]) / len(zone_heights["soprano"])
        else:
            avg_s = -1
            
        if zone_heights["bass"]:
            avg_b = sum(zone_heights["bass"]) / len(zone_heights["bass"])
        else:
            avg_b = 999
        
        self.assertLess(avg_s, avg_b)


if __name__ == "__main__":
    unittest.main()
