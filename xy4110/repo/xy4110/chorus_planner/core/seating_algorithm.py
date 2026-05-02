"""自动排座算法"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple, Set, Any, TYPE_CHECKING
from copy import deepcopy
import random

from ..models.member import Member, VoicePart, SeniorityLevel, MemberStatus
from ..models.seating import Seat, SeatingLayout, SeatingAssignment
from .constraint_validator import ConstraintValidator, IssueType, IssueSeverity


class VoiceZone(Enum):
    """声部区域（舞台上的典型分布）"""
    SOPRANO = "SOPRANO"
    ALTO = "ALTO"
    TENOR = "TENOR"
    BASS = "BASS"
    MIXED = "MIXED"
    
    @classmethod
    def get_default_voice_order(cls) -> List[VoiceZone]:
        """默认从左到右的声部顺序：女高-女低-男高-男低"""
        return [cls.SOPRANO, cls.ALTO, cls.TENOR, cls.BASS]
    
    @classmethod
    def voice_part_to_zone(cls, voice_part: VoicePart) -> 'VoiceZone':
        """将具体声部分组到大区域"""
        if voice_part in [VoicePart.SOPRANO_1, VoicePart.SOPRANO_2]:
            return cls.SOPRANO
        elif voice_part in [VoicePart.ALTO_1, VoicePart.ALTO_2]:
            return cls.ALTO
        elif voice_part in [VoicePart.TENOR_1, VoicePart.TENOR_2]:
            return cls.TENOR
        elif voice_part in [VoicePart.BASS_1, VoicePart.BASS_2]:
            return cls.BASS
        return cls.MIXED


@dataclass
class AlgorithmConfig:
    """排座算法配置"""
    
    voice_zone_order: List[VoiceZone] = field(default_factory=VoiceZone.get_default_voice_order)
    
    sort_by_height: bool = True
    height_direction: str = "back_taller"
    
    keep_mentor_adjacent: bool = True
    avoid_restricted_partners: bool = True
    
    prioritize_priority_seats: bool = True
    
    keep_locked_assignments: bool = True
    
    max_iterations: int = 100
    random_seed: Optional[int] = None


@dataclass
class AutoSeatResult:
    """自动排座结果"""
    success: bool = False
    message: str = ""
    
    assigned_count: int = 0
    skipped_count: int = 0
    
    validation_issues_count: int = 0
    critical_issues_count: int = 0
    
    details: Dict[str, Any] = field(default_factory=dict)


class SeatingAlgorithm:
    """自动排座算法实现"""
    
    def __init__(self, config: Optional[AlgorithmConfig] = None):
        self.config = config or AlgorithmConfig()
        self.validator = ConstraintValidator()
        if self.config.random_seed is not None:
            random.seed(self.config.random_seed)
    
    def auto_seat(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member]
    ) -> AutoSeatResult:
        """
        执行自动排座
        
        策略：
        1. 预处理：确定可用座位、过滤可排座成员、保留锁定分配
        2. 按声部分组，确定各组在舞台上的区域
        3. 对每个声部区域，按身高排序（后排更高）
        4. 处理带教关系：新人与带教绑定
        5. 验证结果并返回
        """
        result = AutoSeatResult()
        
        locked_assignments: Dict[str, SeatingAssignment] = {}
        if self.config.keep_locked_assignments:
            for seat_id, assignment in layout.assignments.items():
                if assignment.is_locked and assignment.member_id:
                    locked_assignments[seat_id] = assignment
        
        layout.clear_assignments(keep_locked=self.config.keep_locked_assignments)
        
        available_seats = self._get_available_seats(layout, locked_assignments)
        if not available_seats:
            result.message = "没有可用座位"
            return result
        
        seatable_members = self._filter_seatable_members(members, locked_assignments)
        if not seatable_members:
            result.message = "没有需要排座的成员"
            result.success = True
            return result
        
        members_by_zone = self._group_members_by_zone(seatable_members)
        
        zone_seat_map = self._divide_zones(
            available_seats,
            list(members_by_zone.keys()),
            {k: len(v) for k, v in members_by_zone.items()}
        )
        
        assigned_member_ids: Set[str] = set()
        
        for zone in self.config.voice_zone_order:
            if zone not in members_by_zone or zone not in zone_seat_map:
                continue
            
            zone_members = members_by_zone[zone]
            zone_seats = zone_seat_map[zone]
            
            if not zone_members or not zone_seats:
                continue
            
            zone_members_sorted = self._sort_zone_members(zone_members)
            
            assignments = self._assign_zone(
                zone_members_sorted,
                zone_seats,
                layout,
                members,
                assigned_member_ids
            )
            
            for member_id, seat_id in assignments.items():
                try:
                    layout.assign_member(seat_id, member_id, is_locked=False)
                    assigned_member_ids.add(member_id)
                    result.assigned_count += 1
                except Exception:
                    result.skipped_count += 1
        
        for member_id in seatable_members:
            if member_id not in assigned_member_ids:
                result.skipped_count += 1
        
        validation = self.validator.validate(layout, members)
        result.validation_issues_count = len(validation.issues)
        result.critical_issues_count = validation.critical_count
        
        result.success = True
        result.message = f"已为 {result.assigned_count} 位成员分配座位"
        result.details = {
            "locked_kept": len(locked_assignments),
            "total_members": len(seatable_members),
            "total_seats": len(available_seats),
        }
        
        return result
    
    def _get_available_seats(
        self,
        layout: SeatingLayout,
        locked: Dict[str, SeatingAssignment]
    ) -> List[Seat]:
        """获取可用座位（启用且未被锁定）"""
        available = []
        for seat in layout.seats.values():
            if seat.is_enabled and seat.id not in locked:
                available.append(seat)
        
        available.sort(key=lambda s: (s.row, s.col))
        return available
    
    def _filter_seatable_members(
        self,
        members: Dict[str, Member],
        locked: Dict[str, SeatingAssignment]
    ) -> Dict[str, Member]:
        """过滤可排座成员（排除请假/缺席且已锁定的）"""
        locked_member_ids = {a.member_id for a in locked.values() if a.member_id}
        
        seatable = {}
        for member_id, member in members.items():
            if member_id in locked_member_ids:
                continue
            if member.status in [MemberStatus.ABSENT, MemberStatus.LEAVE]:
                continue
            seatable[member_id] = member
        
        return seatable
    
    def _group_members_by_zone(
        self,
        members: Dict[str, Member]
    ) -> Dict[VoiceZone, List[Member]]:
        """按声部分组"""
        groups: Dict[VoiceZone, List[Member]] = {}
        
        for member in members.values():
            zone = VoiceZone.voice_part_to_zone(member.voice_part)
            if zone not in groups:
                groups[zone] = []
            groups[zone].append(member)
        
        return groups
    
    def _divide_zones(
        self,
        available_seats: List[Seat],
        zones: List[VoiceZone],
        member_counts: Dict[VoiceZone, int]
    ) -> Dict[VoiceZone, List[Seat]]:
        """将座位区域按声部划分
        
        策略：从左到右分配给 SOPRANO -> ALTO -> TENOR -> BASS
        每排中，按列号从左到右划分
        """
        zone_seat_map: Dict[VoiceZone, List[Seat]] = {z: [] for z in zones}
        
        seats_by_row: Dict[int, List[Seat]] = {}
        for seat in available_seats:
            if seat.row not in seats_by_row:
                seats_by_row[seat.row] = []
            seats_by_row[seat.row].append(seat)
        
        for row in sorted(seats_by_row.keys()):
            row_seats = seats_by_row[row]
            row_seats.sort(key=lambda s: s.col)
            
            total_members_in_zones = sum(
                member_counts.get(z, 0) for z in self.config.voice_zone_order if z in zones
            )
            
            if total_members_in_zones == 0:
                continue
            
            seat_idx = 0
            total_seats = len(row_seats)
            
            for zone in self.config.voice_zone_order:
                if zone not in zones or member_counts.get(zone, 0) == 0:
                    continue
                
                zone_ratio = member_counts[zone] / total_members_in_zones
                zone_seats_in_row = max(1, round(total_seats * zone_ratio))
                
                if seat_idx >= total_seats:
                    zone_seats_in_row = 0
                elif seat_idx + zone_seats_in_row > total_seats:
                    zone_seats_in_row = total_seats - seat_idx
                
                for i in range(zone_seats_in_row):
                    if seat_idx + i < len(row_seats):
                        zone_seat_map[zone].append(row_seats[seat_idx + i])
                
                seat_idx += zone_seats_in_row
        
        return zone_seat_map
    
    def _sort_zone_members(self, members: List[Member]) -> List[Member]:
        """对区域内成员进行排序
        
        默认策略：
        1. 先按具体声部细分（S1在S2前面，A1在A2前面等）
        2. 再按资深度（带教在前？或者新人需要和带教绑定）
        3. 最后按身高
        """
        voice_order = {
            VoicePart.SOPRANO_1: 1,
            VoicePart.SOPRANO_2: 2,
            VoicePart.ALTO_1: 1,
            VoicePart.ALTO_2: 2,
            VoicePart.TENOR_1: 1,
            VoicePart.TENOR_2: 2,
            VoicePart.BASS_1: 1,
            VoicePart.BASS_2: 2,
            VoicePart.UNASSIGNED: 99,
        }
        
        seniority_order = {
            SeniorityLevel.LEADER: 1,
            SeniorityLevel.SENIOR: 2,
            SeniorityLevel.MID: 3,
            SeniorityLevel.JUNIOR: 4,
            SeniorityLevel.NEW: 5,
        }
        
        def sort_key(m: Member):
            return (
                voice_order.get(m.voice_part, 99),
                seniority_order.get(m.seniority, 99),
                m.height_cm if self.config.height_direction == "back_taller" else -m.height_cm,
            )
        
        members_sorted = sorted(members, key=sort_key)
        
        if self.config.keep_mentor_adjacent:
            members_sorted = self._group_mentor_mentee(members_sorted)
        
        return members_sorted
    
    def _group_mentor_mentee(self, members: List[Member]) -> List[Member]:
        """将带教和新人绑定在一起"""
        member_dict = {m.id: m for m in members}
        result: List[Member] = []
        added: Set[str] = set()
        
        mentor_groups: Dict[str, List[Member]] = {}
        
        for member in members:
            if member.is_new() and member.mentor_id and member.mentor_id in member_dict:
                mentor_id = member.mentor_id
                if mentor_id not in mentor_groups:
                    mentor_groups[mentor_id] = []
                mentor_groups[mentor_id].append(member)
        
        for member in members:
            if member.id in added:
                continue
            
            if member.is_mentor() or member.id in mentor_groups:
                result.append(member)
                added.add(member.id)
                
                mentees = mentor_groups.get(member.id, [])
                for mentee in mentees:
                    if mentee.id not in added:
                        result.append(mentee)
                        added.add(mentee.id)
            else:
                result.append(member)
                added.add(member.id)
        
        return result
    
    def _assign_zone(
        self,
        members: List[Member],
        seats: List[Seat],
        layout: SeatingLayout,
        all_members: Dict[str, Member],
        already_assigned: Set[str]
    ) -> Dict[str, str]:
        """为区域分配座位
        
        策略：
        - 座位按从后往前、从左到右排列
        - 成员按身高从高到低排列，高个子在后
        """
        assignments: Dict[str, str] = {}
        
        seats_sorted = sorted(seats, key=lambda s: (-s.row, s.col))
        
        members_to_assign = [m for m in members if m.id not in already_assigned]
        
        if self.config.sort_by_height:
            if self.config.height_direction == "back_taller":
                members_to_assign = sorted(members_to_assign, key=lambda m: -m.height_cm)
            else:
                members_to_assign = sorted(members_to_assign, key=lambda m: m.height_cm)
        
        for i, member in enumerate(members_to_assign):
            if i < len(seats_sorted):
                assignments[member.id] = seats_sorted[i].id
        
        return assignments
    
    def suggest_swap(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        issues: Optional[List[Any]] = None
    ) -> List[Tuple[str, str, str]]:
        """
        建议交换座位以解决问题
        
        返回：[(问题描述, 座位ID1, 座位ID2), ...]
        """
        suggestions: List[Tuple[str, str, str]] = []
        
        if issues is None:
            validation = self.validator.validate(layout, members)
            issues = validation.issues
        
        for issue in issues:
            if len(issue.affected_seat_ids) >= 2:
                if issue.issue_type == IssueType.VIEW_BLOCK:
                    suggestions.append((
                        issue.suggestion,
                        issue.affected_seat_ids[0],
                        issue.affected_seat_ids[1]
                    ))
                elif issue.issue_type == IssueType.RESTRICTED_PARTNER:
                    suggestions.append((
                        issue.suggestion,
                        issue.affected_seat_ids[0],
                        issue.affected_seat_ids[1]
                    ))
        
        return suggestions
