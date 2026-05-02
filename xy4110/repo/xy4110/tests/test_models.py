"""测试数据模型"""
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
from chorus_planner.models.version import (
    VersionHistory, VersionSnapshot, RehearsalPlan
)


class TestMember(unittest.TestCase):
    """测试成员模型"""
    
    def test_create_member(self):
        """测试创建成员"""
        m = Member(name="张三", voice_part=VoicePart.SOPRANO_1)
        self.assertEqual(m.name, "张三")
        self.assertEqual(m.voice_part, VoicePart.SOPRANO_1)
        self.assertTrue(m.id)
    
    def test_is_new(self):
        """测试新人判断"""
        m1 = Member(name="新人", seniority=SeniorityLevel.NEW)
        self.assertTrue(m1.is_new())
        
        m2 = Member(name="老人", seniority=SeniorityLevel.SENIOR)
        self.assertFalse(m2.is_new())
    
    def test_is_mentor(self):
        """测试带教判断"""
        m1 = Member(name="声部长", seniority=SeniorityLevel.LEADER)
        self.assertTrue(m1.is_mentor())
        
        m2 = Member(name="资深", seniority=SeniorityLevel.SENIOR)
        self.assertTrue(m2.is_mentor())
        
        m3 = Member(name="新人", seniority=SeniorityLevel.NEW)
        self.assertFalse(m3.is_mentor())
    
    def test_can_see_over(self):
        """测试视线遮挡判断"""
        front = Member(name="前排", height_cm=170)
        back = Member(name="后排", height_cm=175)
        
        self.assertFalse(front.can_see_over(back))
        
        back_tall = Member(name="后排高", height_cm=163)
        self.assertTrue(front.can_see_over(back_tall))
    
    def test_serialization(self):
        """测试序列化和反序列化"""
        m = Member(
            name="张三",
            voice_part=VoicePart.SOPRANO_1,
            height_cm=165,
            seniority=SeniorityLevel.MID,
            status=MemberStatus.PRESENT,
            notes="测试备注"
        )
        
        data = m.to_dict()
        m2 = Member.from_dict(data)
        
        self.assertEqual(m2.name, m.name)
        self.assertEqual(m2.voice_part, m.voice_part)
        self.assertEqual(m2.height_cm, m.height_cm)
        self.assertEqual(m2.notes, m.notes)


class TestVoicePart(unittest.TestCase):
    """测试声部枚举"""
    
    def test_display_name(self):
        """测试显示名称"""
        self.assertEqual(VoicePart.display_name(VoicePart.SOPRANO_1), "女高音1")
        self.assertEqual(VoicePart.display_name(VoicePart.BASS_2), "男低音2")
    
    def test_from_string(self):
        """测试从字符串解析"""
        self.assertEqual(VoicePart.from_string("S1"), VoicePart.SOPRANO_1)
        self.assertEqual(VoicePart.from_string("女高音1"), VoicePart.SOPRANO_1)
        self.assertEqual(VoicePart.from_string("男低2"), VoicePart.BASS_2)


class TestSeatingLayout(unittest.TestCase):
    """测试座位布局"""
    
    def test_create_layout(self):
        """测试创建布局"""
        layout = SeatingLayout(rows=4, cols=10)
        self.assertEqual(layout.rows, 4)
        self.assertEqual(layout.cols, 10)
        self.assertEqual(len(layout.seats), 40)
    
    def test_get_seat_at(self):
        """测试获取指定位置座位"""
        layout = SeatingLayout(rows=3, cols=5)
        seat = layout.get_seat_at(1, 2)
        self.assertIsNotNone(seat)
        self.assertEqual(seat.row, 1)
        self.assertEqual(seat.col, 2)
    
    def test_assign_member(self):
        """测试分配成员到座位"""
        layout = SeatingLayout(rows=2, cols=2)
        seats = list(layout.seats.values())
        
        layout.assign_member(seats[0].id, "member_001")
        
        assignment = layout.get_assignment_by_seat(seats[0].id)
        self.assertIsNotNone(assignment)
        self.assertEqual(assignment.member_id, "member_001")
    
    def test_unassign_seat(self):
        """测试取消座位分配"""
        layout = SeatingLayout(rows=2, cols=2)
        seats = list(layout.seats.values())
        
        layout.assign_member(seats[0].id, "member_001")
        self.assertIsNotNone(layout.get_assignment_by_seat(seats[0].id))
        
        layout.unassign_seat(seats[0].id)
        self.assertIsNone(layout.get_assignment_by_seat(seats[0].id))
    
    def test_locked_assignment(self):
        """测试锁定的分配"""
        layout = SeatingLayout(rows=2, cols=2)
        seats = list(layout.seats.values())
        
        layout.assign_member(seats[0].id, "member_001", is_locked=True)
        
        with self.assertRaises(ValueError):
            layout.unassign_seat(seats[0].id)
    
    def test_clear_assignments(self):
        """测试清空分配"""
        layout = SeatingLayout(rows=2, cols=2)
        seats = list(layout.seats.values())
        
        layout.assign_member(seats[0].id, "member_001", is_locked=True)
        layout.assign_member(seats[1].id, "member_002", is_locked=False)
        
        layout.clear_assignments(keep_locked=True)
        
        self.assertIsNotNone(layout.get_assignment_by_seat(seats[0].id))
        self.assertIsNone(layout.get_assignment_by_seat(seats[1].id))


class TestVersionHistory(unittest.TestCase):
    """测试版本历史"""
    
    def test_create_snapshot(self):
        """测试创建快照"""
        vh = VersionHistory()
        
        data = {"test": "value"}
        snapshot = vh.create_snapshot(data=data, label="测试版本")
        
        self.assertEqual(snapshot.version_number, 1)
        self.assertEqual(snapshot.label, "测试版本")
        self.assertEqual(snapshot.data["test"], "value")
    
    def test_version_numbers(self):
        """测试版本号递增"""
        vh = VersionHistory()
        
        vh.create_snapshot(data={}, label="v1")
        vh.create_snapshot(data={}, label="v2")
        vh.create_snapshot(data={}, label="v3")
        
        self.assertEqual(len(vh.snapshots), 3)
        self.assertEqual(vh.snapshots[0].version_number, 1)
        self.assertEqual(vh.snapshots[2].version_number, 3)
    
    def test_rollback(self):
        """测试回滚"""
        vh = VersionHistory()
        
        s1 = vh.create_snapshot(data={"value": 1}, label="v1")
        s2 = vh.create_snapshot(data={"value": 2}, label="v2")
        s3 = vh.create_snapshot(data={"value": 3}, label="v3")
        
        self.assertEqual(vh.get_current_snapshot().id, s3.id)
        
        vh.rollback_to(s1.id)
        self.assertEqual(vh.get_current_snapshot().id, s1.id)


class TestRehearsalPlan(unittest.TestCase):
    """测试排练计划"""
    
    def test_create_plan(self):
        """测试创建排练计划"""
        plan = RehearsalPlan(name="测试排练计划")
        
        self.assertEqual(plan.name, "测试排练计划")
        self.assertIsNotNone(plan.version_history)
    
    def test_save_and_restore_version(self):
        """测试保存和恢复版本"""
        plan = RehearsalPlan(name="测试计划")
        plan.members = {"m1": {"name": "张三"}}
        
        plan.save_version(label="初始版本")
        
        plan.members = {"m1": {"name": "修改后的张三"}, "m2": {"name": "李四"}}
        
        plan.save_version(label="修改后版本")
        
        snapshots = plan.version_history.snapshots
        self.assertEqual(len(snapshots), 2)
        
        first_snapshot = snapshots[0]
        plan.restore_from_snapshot(first_snapshot.id)
        
        self.assertEqual(len(plan.members), 1)
        self.assertEqual(plan.members["m1"]["name"], "张三")


if __name__ == "__main__":
    unittest.main()
