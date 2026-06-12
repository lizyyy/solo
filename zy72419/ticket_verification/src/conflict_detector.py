from typing import List, Dict, Tuple
from difflib import SequenceMatcher

from .models import (
    TicketRecord, AudioRemark, Conflict, ConflictType,
    TicketStatus, LeaveStatus,
    normalize_status, are_statuses_equivalent,
    TICKET_STATUS_TO_AUDIO, AUDIO_STATUS_TO_TICKET
)


class ConflictDetector:
    def __init__(self, similarity_threshold: float = 0.6):
        self.similarity_threshold = similarity_threshold

    def detect_all_conflicts(
        self,
        tickets: List[TicketRecord],
        audio_remarks: List[AudioRemark]
    ) -> List[Conflict]:
        all_conflicts: List[Conflict] = []
        remarks_by_ticket = self._group_remarks_by_ticket(audio_remarks)

        for ticket in tickets:
            ticket_conflicts = self.detect_ticket_conflicts(ticket, remarks_by_ticket)
            ticket.conflicts = ticket_conflicts

            if ticket_conflicts:
                has_real_conflict = any(
                    c.conflict_type != ConflictType.LEAVE_COUNTED or c.resolved
                    for c in ticket_conflicts
                )
                leave_only = all(
                    c.conflict_type == ConflictType.LEAVE_COUNTED for c in ticket_conflicts
                )
                if leave_only:
                    ticket.verification_status = TicketStatus.NEED_REVIEW
                else:
                    ticket.verification_status = TicketStatus.CONFLICT
            else:
                if ticket.verification_status == TicketStatus.PENDING:
                    ticket.verification_status = TicketStatus.CONFIRMED

        return all_conflicts

    def _group_remarks_by_ticket(self, remarks: List[AudioRemark]) -> Dict[str, List[AudioRemark]]:
        result: Dict[str, List[AudioRemark]] = {}
        for remark in remarks:
            if remark.ticket_id:
                if remark.ticket_id not in result:
                    result[remark.ticket_id] = []
                result[remark.ticket_id].append(remark)
        return result

    def detect_ticket_conflicts(
        self,
        ticket: TicketRecord,
        remarks_by_ticket: Dict[str, List[AudioRemark]]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        if ticket.leave_status == LeaveStatus.LEAVE and ticket.is_consumed:
            conflicts.append(self._create_leave_counted_conflict(ticket))

        remarks = remarks_by_ticket.get(ticket.ticket_id, [])
        if not remarks:
            return conflicts

        for remark in remarks:
            conflicts.extend(self._compare_ticket_with_remark(ticket, remark))

        return conflicts

    def _compare_ticket_with_remark(
        self,
        ticket: TicketRecord,
        remark: AudioRemark
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        if remark.parsed_repertoire and ticket.repertoire:
            sim = self._similarity(ticket.repertoire, remark.parsed_repertoire)
            if sim < self.similarity_threshold:
                conflicts.append(self._create_repertoire_conflict(ticket, remark))

        if remark.parsed_status and ticket.status:
            if not are_statuses_equivalent(ticket.status, remark.parsed_status):
                ticket_norm = normalize_status(ticket.status)
                audio_norm = normalize_status(remark.parsed_status)
                if ticket_norm != audio_norm:
                    conflicts.append(self._create_status_conflict(ticket, remark))

        if remark.parsed_date and ticket.performance_date:
            norm_ticket_date = self._normalize_date(ticket.performance_date)
            norm_audio_date = self._normalize_date(remark.parsed_date)
            if norm_ticket_date and norm_audio_date and norm_ticket_date != norm_audio_date:
                conflicts.append(self._create_date_conflict(ticket, remark))

        if remark.parsed_is_leave and ticket.leave_status != LeaveStatus.LEAVE:
            conflicts.append(self._create_leave_conflict(ticket, remark))

        return conflicts

    def _similarity(self, a: str, b: str) -> float:
        return SequenceMatcher(None, a, b).ratio()

    def _normalize_date(self, date_str: str) -> str:
        import re
        date_str = date_str.strip()
        patterns = [
            r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})',
            r'(\d{1,2})[-/月](\d{1,2})',
        ]
        for pattern in patterns:
            match = re.search(pattern, date_str)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    return f"{groups[0]}-{groups[1].zfill(2)}-{groups[2].zfill(2)}"
                elif len(groups) == 2:
                    return f"{groups[0].zfill(2)}-{groups[1].zfill(2)}"
        return date_str

    def _create_repertoire_conflict(self, ticket: TicketRecord, remark: AudioRemark) -> Conflict:
        return Conflict(
            conflict_type=ConflictType.REPERTOIRE_MISMATCH,
            ticket_id=ticket.ticket_id,
            field_name="曲目",
            ticket_value=ticket.repertoire,
            audio_value=remark.parsed_repertoire,
            description=f"票号{ticket.ticket_id}曲目不一致",
            evidence={
                "ticket_source": "票务导出表",
                "ticket_value": ticket.repertoire,
                "audio_file": remark.audio_file,
                "audio_raw_remark": remark.raw_remark,
                "audio_parsed_value": remark.parsed_repertoire,
                "similarity": self._similarity(ticket.repertoire, remark.parsed_repertoire or "")
            }
        )

    def _create_status_conflict(self, ticket: TicketRecord, remark: AudioRemark) -> Conflict:
        ticket_norm = normalize_status(ticket.status)
        audio_norm = normalize_status(remark.parsed_status) if remark.parsed_status else ""
        return Conflict(
            conflict_type=ConflictType.STATUS_MISMATCH,
            ticket_id=ticket.ticket_id,
            field_name="状态",
            ticket_value=ticket.status,
            audio_value=remark.parsed_status,
            description=f"票号{ticket.ticket_id}状态不一致（映射后: {ticket_norm} vs {audio_norm}）",
            evidence={
                "ticket_source": "票务导出表",
                "ticket_raw_status": ticket.status,
                "ticket_normalized_status": ticket_norm,
                "audio_file": remark.audio_file,
                "audio_raw_remark": remark.raw_remark,
                "audio_parsed_status": remark.parsed_status,
                "audio_normalized_status": audio_norm,
                "status_mapping": TICKET_STATUS_TO_AUDIO
            }
        )

    def _create_date_conflict(self, ticket: TicketRecord, remark: AudioRemark) -> Conflict:
        return Conflict(
            conflict_type=ConflictType.DATE_MISMATCH,
            ticket_id=ticket.ticket_id,
            field_name="演出日期",
            ticket_value=ticket.performance_date,
            audio_value=remark.parsed_date,
            description=f"票号{ticket.ticket_id}演出日期不一致",
            evidence={
                "ticket_source": "票务导出表",
                "ticket_value": ticket.performance_date,
                "audio_file": remark.audio_file,
                "audio_raw_remark": remark.raw_remark,
                "audio_parsed_value": remark.parsed_date
            }
        )

    def _create_leave_counted_conflict(self, ticket: TicketRecord) -> Conflict:
        return Conflict(
            conflict_type=ConflictType.LEAVE_COUNTED,
            ticket_id=ticket.ticket_id,
            field_name="请假状态",
            ticket_value="请假但已标记为消耗",
            audio_value=None,
            description=f"票号{ticket.ticket_id}请假课时被算进已消耗，需巡演统筹复核",
            evidence={
                "ticket_source": "票务导出表",
                "leave_status": ticket.leave_status.value,
                "is_consumed": ticket.is_consumed,
                "student_name": ticket.student_name,
                "repertoire": ticket.repertoire,
                "performance_date": ticket.performance_date
            }
        )

    def _create_leave_conflict(self, ticket: TicketRecord, remark: AudioRemark) -> Conflict:
        return Conflict(
            conflict_type=ConflictType.LEAVE_COUNTED,
            ticket_id=ticket.ticket_id,
            field_name="请假状态",
            ticket_value=ticket.leave_status.value,
            audio_value="请假",
            description=f"票号{ticket.ticket_id}音频备注显示请假但票务表未标记",
            evidence={
                "ticket_source": "票务导出表",
                "ticket_leave_status": ticket.leave_status.value,
                "audio_file": remark.audio_file,
                "audio_raw_remark": remark.raw_remark,
                "audio_parsed_is_leave": remark.parsed_is_leave
            }
        )

    def resolve_conflict(
        self,
        conflict: Conflict,
        resolution: str,
        operator: str,
        use_audio_value: bool = False
    ) -> Conflict:
        conflict.resolved = True
        conflict.resolution = resolution
        conflict.resolved_by = operator
        from datetime import datetime
        conflict.resolved_time = datetime.now()
        return conflict
