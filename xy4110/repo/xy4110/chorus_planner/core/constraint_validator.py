"""约束校验引擎"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple, Set, Any
from copy import deepcopy

from ..models.member import Member, VoicePart, MemberStatus
from ..models.seating import Seat, SeatingLayout, SeatingAssignment


class IssueType(Enum):
    """问题类型"""
    VOICE_GAP = "VOICE_GAP"
    VIEW_BLOCK = "VIEW_BLOCK"
    MENTOR_NOT_NEAR = "MENTOR_NOT_NEAR"
    ABSENT_IN_SEAT = "ABSENT_IN_SEAT"
    RESTRICTED_PARTNER = "RESTRICTED_PARTNER"
    PREFERRED_NOT_NEAR = "PREFERRED_NOT_NEAR"
    
    @classmethod
    def display_name(cls, issue_type):
        names = {
            cls.VOICE_GAP: "同声部断层",
            cls.VIEW_BLOCK: "视线遮挡",
            cls.MENTOR_NOT_NEAR: "带教新人未相邻",
            cls.ABSENT_IN_SEAT: "请假成员占位",
            cls.RESTRICTED_PARTNER: "限制搭档相邻",
            cls.PREFERRED_NOT_NEAR: "首选搭档未相邻",
        }
        return names.get(issue_type, issue_type.value)


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"
    
    @classmethod
    def display_name(cls, severity):
        names = {
            cls.CRITICAL: "严重",
            cls.WARNING: "警告",
            cls.INFO: "提示",
        }
        return names.get(severity, severity.value)


@dataclass
class ValidationIssue:
    """单个校验问题"""
    id: str = ""
    issue_type: IssueType = IssueType.VOICE_GAP
    severity: IssueSeverity = IssueSeverity.WARNING
    
    message: str = ""
    details: str = ""
    
    affected_member_ids: List[str] = field(default_factory=list)
    affected_seat_ids: List[str] = field(default_factory=list)
    
    suggestion: str = ""
    
    def to_dict(self):
        return {
            "id": self.id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "affected_member_ids": self.affected_member_ids.copy(),
            "affected_seat_ids": self.affected_seat_ids.copy(),
            "suggestion": self.suggestion,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id", ""),
            issue_type=IssueType(data.get("issue_type", "VOICE_GAP")),
            severity=IssueSeverity(data.get("severity", "WARNING")),
            message=data.get("message", ""),
            details=data.get("details", ""),
            affected_member_ids=data.get("affected_member_ids", []).copy(),
            affected_seat_ids=data.get("affected_seat_ids", []).copy(),
            suggestion=data.get("suggestion", ""),
        )


@dataclass
class ValidationResult:
    """完整校验结果"""
    is_valid: bool = True
    issues: List[ValidationIssue] = field(default_factory=list)
    
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0

    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)
        if issue.severity == IssueSeverity.CRITICAL:
            self.critical_count += 1
            self.is_valid = False
        elif issue.severity == IssueSeverity.WARNING:
            self.warning_count += 1
        elif issue.severity == IssueSeverity.INFO:
            self.info_count += 1

    def get_issues_by_type(self, issue_type: IssueType) -> List[ValidationIssue]:
        return [i for i in self.issues if i.issue_type == issue_type]

    def get_issues_by_severity(self, severity: IssueSeverity) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == severity]

    def to_dict(self):
        return {
            "is_valid": self.is_valid,
            "issues": [i.to_dict() for i in self.issues],
            "critical_count": self.critical_count,
            "warning_count": self.warning_count,
            "info_count": self.info_count,
        }

    @classmethod
    def from_dict(cls, data):
        result = cls(
            is_valid=data.get("is_valid", True),
            critical_count=data.get("critical_count", 0),
            warning_count=data.get("warning_count", 0),
            info_count=data.get("info_count", 0),
        )
        result.issues = [ValidationIssue.from_dict(i) for i in data.get("issues", [])]
        return result


class ConstraintValidator:
    """约束校验引擎"""
    
    def __init__(self):
        self.checks_enabled = {
            IssueType.VOICE_GAP: True,
            IssueType.VIEW_BLOCK: True,
            IssueType.MENTOR_NOT_NEAR: True,
            IssueType.ABSENT_IN_SEAT: True,
            IssueType.RESTRICTED_PARTNER: True,
            IssueType.PREFERRED_NOT_NEAR: False,
        }

    def validate(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        enabled_checks: Optional[Set[IssueType]] = None
    ) -> ValidationResult:
        """执行完整校验"""
        result = ValidationResult()
        
        checks_to_run = enabled_checks or set(
            t for t, enabled in self.checks_enabled.items() if enabled
        )
        
        member_at_seat: Dict[str, Member] = {}
        seat_of_member: Dict[str, Seat] = {}
        
        for seat_id, assignment in layout.assignments.items():
            member_id = assignment.member_id
            seat = layout.seats.get(seat_id)
            member = members.get(member_id)
            if seat and member:
                member_at_seat[seat_id] = member
                seat_of_member[member_id] = seat
        
        if IssueType.VOICE_GAP in checks_to_run:
            self._check_voice_gaps(layout, member_at_seat, result)
        
        if IssueType.VIEW_BLOCK in checks_to_run:
            self._check_view_blocks(layout, member_at_seat, result)
        
        if IssueType.MENTOR_NOT_NEAR in checks_to_run:
            self._check_mentor_adjacency(layout, members, seat_of_member, result)
        
        if IssueType.ABSENT_IN_SEAT in checks_to_run:
            self._check_absent_in_seat(layout, members, member_at_seat, result)
        
        if IssueType.RESTRICTED_PARTNER in checks_to_run:
            self._check_restricted_partners(layout, members, seat_of_member, result)
        
        if IssueType.PREFERRED_NOT_NEAR in checks_to_run:
            self._check_preferred_partners(layout, members, seat_of_member, result)
        
        return result

    def _get_adjacent_seats(
        self,
        layout: SeatingLayout,
        seat: Seat,
        include_diagonal: bool = False
    ) -> List[Seat]:
        """获取相邻座位"""
        adjacent = []
        deltas = [(0, -1), (0, 1)]
        if include_diagonal:
            deltas.extend([(-1, 0), (1, 0), (-1, -1), (-1, 1), (1, -1), (1, 1)])
        
        for d_row, d_col in deltas:
            adj_seat = layout.get_seat_at(seat.row + d_row, seat.col + d_col)
            if adj_seat and adj_seat.is_enabled:
                adjacent.append(adj_seat)
        return adjacent

    def _check_voice_gaps(
        self,
        layout: SeatingLayout,
        member_at_seat: Dict[str, Member],
        result: ValidationResult
    ):
        """检查同声部断层
        
        规则：同一排中，同声部成员应尽量连续排列，不应被其他声部打断
        """
        for row_idx in range(layout.rows):
            row_seats = layout.get_seats_by_row(row_idx)
            if not row_seats:
                continue
            
            voice_sequence: List[Tuple[Seat, Optional[VoicePart]]] = []
            for seat in row_seats:
                member = member_at_seat.get(seat.id)
                if member:
                    voice_sequence.append((seat, member.voice_part))
                else:
                    voice_sequence.append((seat, None))
            
            occupied = [(s, v) for s, v in voice_sequence if v is not None]
            if len(occupied) <= 1:
                continue
            
            voice_groups: List[Tuple[VoicePart, List[Seat]]] = []
            current_voice = None
            current_seats = []
            
            for seat, voice in voice_sequence:
                if voice is None:
                    continue
                if voice != current_voice:
                    if current_voice is not None and current_seats:
                        voice_groups.append((current_voice, current_seats))
                    current_voice = voice
                    current_seats = [seat]
                else:
                    current_seats.append(seat)
            
            if current_voice is not None and current_seats:
                voice_groups.append((current_voice, current_seats))
            
            voice_count: Dict[VoicePart, int] = {}
            for _, v in occupied:
                voice_count[v] = voice_count.get(v, 0) + 1
            
            voices_with_multiple = [v for v, c in voice_count.items() if c >= 2]
            if not voices_with_multiple:
                continue
            
            group_voices = [g[0] for g in voice_groups]
            for voice in voices_with_multiple:
                first_idx = None
                last_idx = None
                for i, g in enumerate(voice_groups):
                    if g[0] == voice:
                        if first_idx is None:
                            first_idx = i
                        last_idx = i
                
                if first_idx is not None and last_idx is not None and first_idx != last_idx:
                    middle_groups = voice_groups[first_idx + 1:last_idx]
                    if middle_groups:
                        all_seats = []
                        for g in voice_groups[first_idx:last_idx + 1]:
                            all_seats.extend(g[1])
                        
                        seat_ids = [s.id for s in all_seats]
                        member_ids = []
                        for seat_id in seat_ids:
                            m = member_at_seat.get(seat_id)
                            if m:
                                member_ids.append(m.id)
                        
                        other_voices = [g[0] for g in middle_groups]
                        other_voice_names = [VoicePart.display_name(v) for v in set(other_voices)]
                        
                        issue = ValidationIssue(
                            id=f"vg_{row_idx}_{voice.value}",
                            issue_type=IssueType.VOICE_GAP,
                            severity=IssueSeverity.WARNING,
                            message=f"第{row_idx + 1}排存在{VoicePart.display_name(voice)}断层",
                            details=f"{VoicePart.display_name(voice)}成员被{', '.join(other_voice_names)}隔开",
                            affected_member_ids=member_ids,
                            affected_seat_ids=seat_ids,
                            suggestion=f"建议将{VoicePart.display_name(voice)}成员调整到连续的位置"
                        )
                        result.add_issue(issue)

    def _check_view_blocks(
        self,
        layout: SeatingLayout,
        member_at_seat: Dict[str, Member],
        result: ValidationResult
    ):
        """检查视线遮挡
        
        规则：前排成员身高 > 后排成员身高 - 5cm 时，会产生视线遮挡
        特别注意：同一列的前后排成员需要检查
        """
        for row_idx in range(1, layout.rows):
            prev_row = row_idx - 1
            for col_idx in range(layout.cols):
                back_seat = layout.get_seat_at(row_idx, col_idx)
                if not back_seat or not back_seat.is_enabled:
                    continue
                
                back_member = member_at_seat.get(back_seat.id)
                if not back_member:
                    continue
                
                front_seat = layout.get_seat_at(prev_row, col_idx)
                if not front_seat or not front_seat.is_enabled:
                    continue
                
                front_member = member_at_seat.get(front_seat.id)
                if not front_member:
                    continue
                
                if front_member.can_see_over(back_member):
                    issue = ValidationIssue(
                        id=f"vb_{back_seat.id}",
                        issue_type=IssueType.VIEW_BLOCK,
                        severity=IssueSeverity.WARNING,
                        message=f"{front_member.name} 遮挡了 {back_member.name} 的视线",
                        details=f"前排{front_member.name}({front_member.height_cm}cm) > 后排{back_member.name}({back_member.height_cm}cm) - 5cm",
                        affected_member_ids=[front_member.id, back_member.id],
                        affected_seat_ids=[front_seat.id, back_seat.id],
                        suggestion=f"建议交换位置或将{back_member.name}调整到更前排或同列更高的位置"
                    )
                    result.add_issue(issue)

    def _check_mentor_adjacency(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        seat_of_member: Dict[str, Seat],
        result: ValidationResult
    ):
        """检查带教新人是否相邻
        
        规则：新人应与其 mentor 或带教老师在左右相邻的位置
        """
        for member_id, member in members.items():
            if not member.is_new():
                continue
            
            if member.status not in [MemberStatus.PRESENT, MemberStatus.UNKNOWN]:
                continue
            
            if member_id not in seat_of_member:
                continue
            
            seat = seat_of_member[member_id]
            adjacent_seats = self._get_adjacent_seats(layout, seat, include_diagonal=False)
            
            has_mentor_nearby = False
            mentor_ids = []
            
            if member.mentor_id:
                mentor_ids.append(member.mentor_id)
            
            for m_id, m in members.items():
                if m.is_mentor() and m.voice_part == member.voice_part:
                    if m_id not in mentor_ids and m_id != member_id:
                        mentor_ids.append(m_id)
            
            for adj_seat in adjacent_seats:
                assignment = layout.get_assignment_by_seat(adj_seat.id)
                if assignment and assignment.member_id in mentor_ids:
                    has_mentor_nearby = True
                    break
            
            if not has_mentor_nearby and mentor_ids:
                nearby_members = []
                for adj_seat in adjacent_seats:
                    assignment = layout.get_assignment_by_seat(adj_seat.id)
                    if assignment:
                        m = members.get(assignment.member_id)
                        if m:
                            nearby_members.append(m.name)
                
                mentor_names = [members.get(mid, members.get(mid, Member(id=mid, name=mid))).name for mid in mentor_ids[:3]]
                
                issue = ValidationIssue(
                    id=f"mn_{member_id}",
                    issue_type=IssueType.MENTOR_NOT_NEAR,
                    severity=IssueSeverity.WARNING,
                    message=f"新人 {member.name} 未与带教老师相邻",
                    details=f"相邻座位是: {', '.join(nearby_members) if nearby_members else '空座位'}，期望的带教老师: {', '.join(mentor_names)}",
                    affected_member_ids=[member_id] + mentor_ids[:1],
                    affected_seat_ids=[seat.id],
                    suggestion=f"建议将{member.name}调整到带教老师旁边"
                )
                result.add_issue(issue)

    def _check_absent_in_seat(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        member_at_seat: Dict[str, Member],
        result: ValidationResult
    ):
        """检查请假/缺席成员是否仍占用座位
        
        规则：状态为 LEAVE(请假) 或 ABSENT(缺席) 的成员不应分配座位
        """
        for seat_id, assignment in layout.assignments.items():
            member_id = assignment.member_id
            member = members.get(member_id)
            seat = layout.seats.get(seat_id)
            
            if not member or not seat:
                continue
            
            if member.status in [MemberStatus.ABSENT, MemberStatus.LEAVE]:
                status_name = MemberStatus.display_name(member.status)
                issue = ValidationIssue(
                    id=f"as_{seat_id}",
                    issue_type=IssueType.ABSENT_IN_SEAT,
                    severity=IssueSeverity.CRITICAL,
                    message=f"{status_name}成员 {member.name} 仍占用座位",
                    details=f"成员状态为{status_name}，但已分配到 {seat.label}",
                    affected_member_ids=[member_id],
                    affected_seat_ids=[seat_id],
                    suggestion=f"建议取消 {member.name} 的座位分配"
                )
                result.add_issue(issue)

    def _check_restricted_partners(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        seat_of_member: Dict[str, Seat],
        result: ValidationResult
    ):
        """检查限制搭档是否相邻
        
        规则：有 restricted_partner_ids 的成员不应与限制对象左右相邻
        """
        for member_id, member in members.items():
            if not member.restricted_partner_ids:
                continue
            
            if member_id not in seat_of_member:
                continue
            
            seat = seat_of_member[member_id]
            adjacent_seats = self._get_adjacent_seats(layout, seat, include_diagonal=False)
            
            for adj_seat in adjacent_seats:
                assignment = layout.get_assignment_by_seat(adj_seat.id)
                if assignment and assignment.member_id in member.restricted_partner_ids:
                    restricted_member = members.get(assignment.member_id)
                    restricted_name = restricted_member.name if restricted_member else assignment.member_id
                    
                    issue = ValidationIssue(
                        id=f"rp_{member_id}_{assignment.member_id}",
                        issue_type=IssueType.RESTRICTED_PARTNER,
                        severity=IssueSeverity.CRITICAL,
                        message=f"{member.name} 与限制对象 {restricted_name} 相邻",
                        details=f"两人被设置为不应相邻，但目前分别在 {seat.label} 和 {adj_seat.label}",
                        affected_member_ids=[member_id, assignment.member_id],
                        affected_seat_ids=[seat.id, adj_seat.id],
                        suggestion=f"建议将 {member.name} 或 {restricted_name} 调整到其他位置"
                    )
                    result.add_issue(issue)

    def _check_preferred_partners(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        seat_of_member: Dict[str, Member],
        result: ValidationResult
    ):
        """检查首选搭档是否相邻（提示级别）
        
        规则：有 preferred_partner_ids 的成员最好能左右相邻
        """
        for member_id, member in members.items():
            if not member.preferred_partner_ids:
                continue
            
            if member_id not in seat_of_member:
                continue
            
            seat = seat_of_member[member_id]
            adjacent_seats = self._get_adjacent_seats(layout, seat, include_diagonal=False)
            
            adjacent_member_ids = set()
            for adj_seat in adjacent_seats:
                assignment = layout.get_assignment_by_seat(adj_seat.id)
                if assignment:
                    adjacent_member_ids.add(assignment.member_id)
            
            missing_preferred = [
                pid for pid in member.preferred_partner_ids 
                if pid not in adjacent_member_ids and pid in seat_of_member
            ]
            
            for pid in missing_preferred:
                preferred_member = members.get(pid)
                if not preferred_member:
                    continue
                preferred_seat = seat_of_member.get(pid)
                if not preferred_seat:
                    continue
                
                issue = ValidationIssue(
                    id=f"pp_{member_id}_{pid}",
                    issue_type=IssueType.PREFERRED_NOT_NEAR,
                    severity=IssueSeverity.INFO,
                    message=f"{member.name} 与首选搭档 {preferred_member.name} 未相邻",
                    details=f"{member.name} 在 {seat.label}，{preferred_member.name} 在 {preferred_seat.label}",
                    affected_member_ids=[member_id, pid],
                    affected_seat_ids=[seat.id, preferred_seat.id],
                    suggestion=f"可考虑将两人调整到相邻位置"
                )
                result.add_issue(issue)
