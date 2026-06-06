import csv
import json
import os
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from models import (
    TicketExport, AudioFile, RehearsalChange,
    TrackStatus, NextContact, WorkflowState
)


REWORK_KEYWORDS = [
    "返工", "重录", "补录", "重拍", "重制", "修改",
    "重来", "补拍", "后期返工", "重新录制", "重新配音",
    "修正", "调整重录", "瑕疵重录", "噪音重录", "走音重录"
]


def detect_rework_reason(remark: str) -> Tuple[bool, List[str]]:
    found = []
    for keyword in REWORK_KEYWORDS:
        if keyword in remark:
            found.append(keyword)
    return (len(found) > 0, found)


def import_ticket_export(file_path: str) -> List[TicketExport]:
    tickets = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_id = row.get('track_id', row.get('轨道编号', ''))
            track_name = row.get('track_name', row.get('曲目名称', ''))
            planned = float(row.get('planned_hours', row.get('计划工时', 0)))
            actual = float(row.get('actual_hours', row.get('实际工时', 0)))
            remark = row.get('track_remark', row.get('轨道备注', ''))

            has_rework, keywords = detect_rework_reason(remark)

            ticket = TicketExport(
                track_id=track_id,
                track_name=track_name,
                planned_hours=planned,
                actual_hours=actual,
                track_remark=remark,
                has_rework_reason=has_rework,
                rework_keywords=keywords
            )
            tickets.append(ticket)
    return tickets


def import_audio_files(file_path: str) -> List[AudioFile]:
    audio_files = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            audio = AudioFile(
                track_id=row.get('track_id', row.get('轨道编号', '')),
                file_name=row.get('file_name', row.get('文件名', '')),
                audio_remark=row.get('audio_remark', row.get('音频备注', ''))
            )
            audio_files.append(audio)
    return audio_files


class WorkflowEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.tickets: Dict[str, TicketExport] = {}
        self.audio_files: Dict[str, AudioFile] = {}
        self.rehearsal_changes: Dict[str, RehearsalChange] = {}
        self.state = WorkflowState()
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "exports"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "reports"), exist_ok=True)

    def step1_import_tickets(self, ticket_csv: str) -> Tuple[int, int]:
        tickets = import_ticket_export(ticket_csv)
        for t in tickets:
            self.tickets[t.track_id] = t
        self.state.ticket_imported = True
        self.state.step = 2

        rework_count = sum(1 for t in tickets if t.has_rework_reason)
        return len(tickets), rework_count

    def step2_amei_review(self, audio_csv: str, reviewer: str = "阿梅") -> Tuple[int, int]:
        if not self.state.ticket_imported:
            raise RuntimeError("请先完成第一步：导入票务导出表")

        audio_files = import_audio_files(audio_csv)
        updated_count = 0
        for af in audio_files:
            af.reviewed_by_amei = True
            af.review_time = datetime.now()
            self.audio_files[af.track_id] = af

            if af.track_id in self.tickets:
                updated_count += 1
                self._update_rehearsal_from_audio(af)

        self.state.amei_review_done = True
        self.state.step = 3
        return len(audio_files), updated_count

    def _update_rehearsal_from_audio(self, audio: AudioFile):
        ticket = self.tickets.get(audio.track_id)
        if not ticket:
            return

        if ticket.track_id in self.rehearsal_changes:
            change = self.rehearsal_changes[ticket.track_id]
            change.notes = f"音频备注: {audio.audio_remark}\n{change.notes}"
            change.updated_at = datetime.now()
        else:
            change = self._create_rehearsal_change(ticket, audio)
            self.rehearsal_changes[ticket.track_id] = change

    def _create_rehearsal_change(self, ticket: TicketExport, audio: Optional[AudioFile] = None) -> RehearsalChange:
        missing = []
        next_contact = NextContact.COPYRIGHT_OPERATIONS
        kept_why = ""
        change_reason = ticket.track_remark

        if ticket.has_rework_reason:
            status = TrackStatus.PENDING_COPYRIGHT_REVIEW
            kept_why = "轨道备注包含返工原因，需版权运营复核后确认"
            missing.append("版权运营复核意见")
            if not audio or not audio.audio_remark:
                missing.append("音频文件备注")
                next_contact = NextContact.TOUR_COORDINATOR_AMEI
        else:
            status = TrackStatus.NORMAL
            kept_why = "工时尾差在正常范围内，无返工记录"

        if abs(ticket.hour_diff) > 2:
            kept_why = f"工时尾差较大({ticket.hour_diff:+.1f}小时)，需进一步确认"
            if not ticket.has_rework_reason:
                missing.append("工时差异原因说明")

        notes = f"票务备注: {ticket.track_remark}"
        if audio and audio.audio_remark:
            notes += f"\n音频备注: {audio.audio_remark}"

        return RehearsalChange(
            track_id=ticket.track_id,
            track_name=ticket.track_name,
            change_reason=change_reason,
            kept_why=kept_why,
            missing_materials=missing,
            next_contact=next_contact,
            status=status,
            notes=notes
        )

    def step3_update_rehearsal(self) -> Tuple[int, int]:
        if not self.state.amei_review_done:
            raise RuntimeError("请先完成第二步：阿梅补看音频文件备注")

        for track_id, ticket in self.tickets.items():
            if track_id not in self.rehearsal_changes:
                audio = self.audio_files.get(track_id)
                self.rehearsal_changes[track_id] = self._create_rehearsal_change(ticket, audio)

        self.state.rehearsal_updated = True
        self.state.step = 4

        pending_review = sum(
            1 for c in self.rehearsal_changes.values()
            if c.status == TrackStatus.PENDING_COPYRIGHT_REVIEW
        )
        return len(self.rehearsal_changes), pending_review

    def mark_copyright_reviewed(self, track_id: str, approved: bool, reviewer_note: str = ""):
        if track_id not in self.rehearsal_changes:
            raise ValueError(f"未找到轨道 {track_id}")

        change = self.rehearsal_changes[track_id]
        if approved:
            change.status = TrackStatus.APPROVED
        else:
            change.status = TrackStatus.NEEDS_REWORK
        change.notes += f"\n版权运营复核意见: {reviewer_note}"
        change.updated_at = datetime.now()

        all_reviewed = all(
            c.status != TrackStatus.PENDING_COPYRIGHT_REVIEW
            for c in self.rehearsal_changes.values()
        )
        if all_reviewed:
            self.state.copyright_review_done = True

    def get_tracks_with_rework(self) -> List[TicketExport]:
        return [t for t in self.tickets.values() if t.has_rework_reason]

    def get_pending_copyright_review(self) -> List[RehearsalChange]:
        return [
            c for c in self.rehearsal_changes.values()
            if c.status == TrackStatus.PENDING_COPYRIGHT_REVIEW
        ]

    def save_state(self, file_path: str = None):
        if file_path is None:
            file_path = os.path.join(self.data_dir, "workflow_state.json")

        data = {
            "state": {
                "step": self.state.step,
                "ticket_imported": self.state.ticket_imported,
                "amei_review_done": self.state.amei_review_done,
                "rehearsal_updated": self.state.rehearsal_updated,
                "copyright_review_done": self.state.copyright_review_done,
            },
            "tickets": {
                k: {
                    "track_id": v.track_id,
                    "track_name": v.track_name,
                    "planned_hours": v.planned_hours,
                    "actual_hours": v.actual_hours,
                    "track_remark": v.track_remark,
                    "has_rework_reason": v.has_rework_reason,
                    "rework_keywords": v.rework_keywords,
                    "import_time": v.import_time.isoformat(),
                }
                for k, v in self.tickets.items()
            },
            "audio_files": {
                k: {
                    "track_id": v.track_id,
                    "file_name": v.file_name,
                    "audio_remark": v.audio_remark,
                    "reviewed_by_amei": v.reviewed_by_amei,
                    "review_time": v.review_time.isoformat() if v.review_time else None,
                }
                for k, v in self.audio_files.items()
            },
            "rehearsal_changes": {
                k: {
                    "track_id": v.track_id,
                    "track_name": v.track_name,
                    "change_reason": v.change_reason,
                    "kept_why": v.kept_why,
                    "missing_materials": v.missing_materials,
                    "next_contact": v.next_contact,
                    "status": v.status,
                    "created_at": v.created_at.isoformat(),
                    "updated_at": v.updated_at.isoformat(),
                    "notes": v.notes,
                }
                for k, v in self.rehearsal_changes.items()
            }
        }

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_state(self, file_path: str = None):
        if file_path is None:
            file_path = os.path.join(self.data_dir, "workflow_state.json")
        if not os.path.exists(file_path):
            return False

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        s = data["state"]
        self.state = WorkflowState(
            step=s["step"],
            ticket_imported=s["ticket_imported"],
            amei_review_done=s["amei_review_done"],
            rehearsal_updated=s["rehearsal_updated"],
            copyright_review_done=s["copyright_review_done"],
        )

        for k, v in data["tickets"].items():
            self.tickets[k] = TicketExport(
                track_id=v["track_id"],
                track_name=v["track_name"],
                planned_hours=v["planned_hours"],
                actual_hours=v["actual_hours"],
                track_remark=v["track_remark"],
                has_rework_reason=v["has_rework_reason"],
                rework_keywords=v["rework_keywords"],
                import_time=datetime.fromisoformat(v["import_time"]),
            )

        for k, v in data["audio_files"].items():
            self.audio_files[k] = AudioFile(
                track_id=v["track_id"],
                file_name=v["file_name"],
                audio_remark=v["audio_remark"],
                reviewed_by_amei=v["reviewed_by_amei"],
                review_time=datetime.fromisoformat(v["review_time"]) if v["review_time"] else None,
            )

        for k, v in data["rehearsal_changes"].items():
            self.rehearsal_changes[k] = RehearsalChange(
                track_id=v["track_id"],
                track_name=v["track_name"],
                change_reason=v["change_reason"],
                kept_why=v["kept_why"],
                missing_materials=v["missing_materials"],
                next_contact=v["next_contact"],
                status=v["status"],
                created_at=datetime.fromisoformat(v["created_at"]),
                updated_at=datetime.fromisoformat(v["updated_at"]),
                notes=v["notes"],
            )

        return True
