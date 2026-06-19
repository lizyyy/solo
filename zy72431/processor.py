import re
import uuid
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from models import (
    TunerMessage, GroupSignup, RehearsalRecord, SongChecklist,
    RecordStatus, DataSource, ProcessingLog
)


class RecordProcessor:
    def __init__(self):
        self.tuner_messages: List[TunerMessage] = []
        self.group_signups: List[GroupSignup] = []
        self.records: List[RehearsalRecord] = []
        self.song_checklists: List[SongChecklist] = []
        self.logs: List[ProcessingLog] = []

    def _log(self, record_id: str, action: str, detail: str, operator: str = "system"):
        log = ProcessingLog(
            id=str(uuid.uuid4()),
            record_id=record_id,
            action=action,
            detail=detail,
            operator=operator
        )
        self.logs.append(log)

    def parse_tuner_message(self, raw_text: str) -> TunerMessage:
        date_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}月\d{1,2}日)', raw_text)
        date = date_match.group(1) if date_match else "未知日期"

        band_match = re.search(r'(乐队|团|组)[:：]\s*(\S+)', raw_text) or re.search(r'(\S+乐队|\S+团)', raw_text)
        band_name = band_match.group(2) if band_match and len(band_match.groups()) > 1 else (band_match.group(1) if band_match else "未知乐队")

        room_match = re.search(r'(房间|室|厅)[:：]\s*(\S+)|(\d+号房)', raw_text)
        room = ""
        if room_match:
            room = room_match.group(2) or room_match.group(3) or ""

        time_match = re.search(r'(\d{1,2}:\d{2})\s*[-~到]\s*(\d{1,2}:\d{2})', raw_text)
        start_time = time_match.group(1) if time_match else ""
        end_time = time_match.group(2) if time_match else ""

        hours = 0.0
        if start_time and end_time:
            try:
                h1, m1 = map(int, start_time.split(':'))
                h2, m2 = map(int, end_time.split(':'))
                hours = round((h2 * 60 + m2 - h1 * 60 - m1) / 60, 1)
            except:
                pass

        tuner_name = ""
        tuner_match = re.search(r'(调音师|录音师)[:：]\s*(\S+)', raw_text)
        if tuner_match:
            tuner_name = tuner_match.group(2)
        else:
            tuner_match2 = re.search(r'(?m)^\s*(\S{2,8})\s*(?:调音师|调音|录音师|录音)\s*$', raw_text)
            if tuner_match2:
                tuner_name = tuner_match2.group(1)

        notes = ""
        leave_keywords = ["请假", "请假了", "没来", "缺席", "取消", "停一次"]
        for kw in leave_keywords:
            if kw in raw_text:
                notes += f"[{kw}]"

        msg = TunerMessage(
            id=str(uuid.uuid4()),
            date=date,
            band_name=band_name,
            room=room,
            start_time=start_time,
            end_time=end_time,
            hours=hours,
            tuner_name=tuner_name,
            notes=notes,
            raw_content=raw_text
        )
        self.tuner_messages.append(msg)
        return msg

    def parse_group_signup(self, raw_text: str) -> GroupSignup:
        date_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}月\d{1,2}日)', raw_text)
        date = date_match.group(1) if date_match else "未知日期"

        band_match = re.search(r'(乐队|团|组)[:：]\s*(\S+)|(\S+乐队|\S+团)', raw_text)
        band_name = band_match.group(2) if band_match and len(band_match.groups()) > 1 else (band_match.group(1) if band_match else "未知乐队")

        lines = raw_text.strip().split('\n')
        lines = [line.strip() for line in lines if line.strip()]

        members = []
        songs = []
        remarks = ""
        in_members = False
        in_songs = False

        for line in lines:
            if re.match(r'^(人员|成员|参与|到场)', line):
                in_members = True
                in_songs = False
                continue
            if re.match(r'^(曲目|歌单|歌曲)', line):
                in_songs = True
                in_members = False
                song_header_match = re.match(r'^(曲目|歌单|歌曲)[:：]\s*(.*)', line)
                if song_header_match and song_header_match.group(2).strip():
                    song_line = song_header_match.group(2).strip()
                    for s in re.split(r'[、,，]', song_line):
                        s = s.strip()
                        if s:
                            songs.append(s)
                continue
            if re.match(r'^(备注|说明|注意)', line):
                in_members = False
                in_songs = False
                remark_match = re.match(r'^(备注|说明|注意)[:：]\s*(.*)', line)
                if remark_match:
                    remarks = remark_match.group(2).strip()
                continue

            if in_members:
                member_match = re.match(r'^(\d+)[.、]\s*(\S+)', line)
                if member_match:
                    members.append(member_match.group(2))
                elif line.strip():
                    members.append(line.strip())
            elif in_songs:
                song_inline = re.findall(r'《([^》]+)》', line)
                if song_inline:
                    songs.extend(song_inline)
                else:
                    for s in re.split(r'[、,，]', line):
                        s = s.strip()
                        if s and not re.match(r'^\d+[.、]', s):
                            songs.append(s)
            else:
                song_inline = re.findall(r'《([^》]+)》', line)
                if song_inline:
                    songs.extend(song_inline)

        if not members:
            member_lines = re.findall(r'(\d+)[.、]\s*(\S+)', raw_text)
            if member_lines:
                members = [m[1] for m in member_lines]

        if not songs:
            song_matches = re.findall(r'《([^》]+)》', raw_text)
            if song_matches:
                songs = song_matches

        if not remarks:
            remark_match = re.search(r'(备注|说明|注意)[:：](.*?)(?:\n|$)', raw_text)
            if remark_match:
                remarks = remark_match.group(2).strip()

        signup = GroupSignup(
            id=str(uuid.uuid4()),
            date=date,
            band_name=band_name,
            members=members,
            song_list=songs,
            remarks=remarks,
            raw_content=raw_text
        )
        self.group_signups.append(signup)
        return signup

    def import_tuner_message(self, raw_text: str, operator: str = "老周") -> RehearsalRecord:
        msg = self.parse_tuner_message(raw_text)
        
        record = RehearsalRecord(
            id=str(uuid.uuid4()),
            date=msg.date,
            band_name=msg.band_name,
            room=msg.room,
            start_time=msg.start_time,
            end_time=msg.end_time,
            hours=msg.hours,
            tuner_name=msg.tuner_name,
            tuner_note=msg.notes,
            source=DataSource.TUNER_MESSAGE,
            is_consumed=True
        )

        is_leave = any(kw in msg.notes for kw in ["请假", "缺席", "取消", "没来"])
        if is_leave:
            record.is_leave = True
            record.is_consumed = True
            record.status = RecordStatus.LEAVE_CONSUMED
            record.needs_review = True
            record.review_note = "请假课时被算进已消耗，请巡演统筹复核"

        self.records.append(record)
        self._log(record.id, "导入调音师留言", f"从调音师留言导入记录，状态: {record.status.value}", operator)
        
        return record

    def supplement_group_signup(self, record_id: str, raw_text: str, operator: str = "老周") -> Optional[RehearsalRecord]:
        record = next((r for r in self.records if r.id == record_id), None)
        if not record:
            return None

        signup = self.parse_group_signup(raw_text)
        
        old_songs = list(record.song_list)
        if signup.song_list:
            record.song_list = signup.song_list
        if signup.members:
            record.members = signup.members
        record.group_remark = signup.remarks
        
        if not record.needs_review:
            if signup.remarks and "旧口径" in signup.remarks:
                record.status = RecordStatus.SUPPLEMENTED
        
        record.updated_at = datetime.now()
        record.run_count += 1
        
        self._update_song_checklist(record, old_songs)
        
        remark_info = ""
        if signup.remarks and "旧口径" in signup.remarks:
            remark_info = "（旧口径）"
        
        self._log(
            record.id,
            "补录排练群接龙",
            f"补录群接龙信息{remark_info}，曲目从{old_songs}更新为{record.song_list}",
            operator
        )
        
        return record

    def _update_song_checklist(self, record: RehearsalRecord, old_songs: List[str]):
        for song in record.song_list:
            existing = next((c for c in self.song_checklists 
                           if c.band_name == record.band_name and c.song_name == song), None)
            if not existing:
                checklist = SongChecklist(
                    id=str(uuid.uuid4()),
                    band_name=record.band_name,
                    song_name=song,
                    planned=True,
                    actually_performed=record.status != RecordStatus.LEAVE_CONSUMED,
                    note="来自排练群接龙",
                    source="group_signup"
                )
                self.song_checklists.append(checklist)
            else:
                existing.source = "group_signup"
                existing.note = "已从群接龙更新"

        for old_song in old_songs:
            if old_song not in record.song_list:
                for c in self.song_checklists:
                    if c.band_name == record.band_name and c.song_name == old_song:
                        c.note = "已从核对表移除，群接龙未包含此曲"

    def manual_correct(self, record_id: str, corrections: Dict, operator: str = "老周") -> Optional[RehearsalRecord]:
        record = next((r for r in self.records if r.id == record_id), None)
        if not record:
            return None

        correction_entry = {
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "changes": corrections
        }
        record.corrections.append(correction_entry)

        if "status" in corrections:
            record.status = RecordStatus(corrections["status"])
        if "is_consumed" in corrections:
            record.is_consumed = corrections["is_consumed"]
        if "needs_review" in corrections:
            record.needs_review = corrections["needs_review"]
        if "review_note" in corrections:
            record.review_note = corrections["review_note"]
        if "song_list" in corrections:
            old_songs = list(record.song_list)
            record.song_list = corrections["song_list"]
            self._update_song_checklist(record, old_songs)
        if "hours" in corrections:
            record.hours = corrections["hours"]
        if "members" in corrections:
            record.members = corrections["members"]
        if "tuner_name" in corrections:
            record.tuner_name = corrections["tuner_name"]

        record.updated_at = datetime.now()

        change_desc_parts = []
        for key, value in corrections.items():
            if key == "tuner_name":
                change_desc_parts.append(f"调音师姓名 → {value}")
            elif key == "hours":
                change_desc_parts.append(f"课时 → {value}小时")
            elif key == "status":
                change_desc_parts.append(f"状态 → {value}")
            elif key == "song_list":
                change_desc_parts.append(f"曲目 → {len(value)}首")
            else:
                change_desc_parts.append(f"{key} → {value}")
        self._log(record.id, "人工修正", "人工修正: " + "; ".join(change_desc_parts), operator)
        
        return record

    def review_record(self, record_id: str, decision: str, reason: str, operator: str = "巡演统筹") -> Optional[RehearsalRecord]:
        record = next((r for r in self.records if r.id == record_id), None)
        if not record:
            return None
        if not record.needs_review:
            return None

        record.review_decision = decision
        record.review_reason = reason
        record.reviewed_by = operator
        record.reviewed_at = datetime.now()
        record.needs_review = False

        if decision == "approve":
            record.status = RecordStatus.REVIEW_APPROVED
            record.is_consumed = True
            log_detail = f"复核通过：确认请假课时计入消耗，理由：{reason}"
        else:
            record.status = RecordStatus.REVIEW_REJECTED
            record.is_consumed = False
            log_detail = f"复核驳回：请假课时不计入消耗，理由：{reason}"

        record.updated_at = datetime.now()

        self._log(record.id, "巡演统筹复核", log_detail, operator)
        
        return record

    def rerun_record(self, record_id: str, operator: str = "老周") -> Optional[RehearsalRecord]:
        record = next((r for r in self.records if r.id == record_id), None)
        if not record:
            return None

        record.run_count += 1
        record.updated_at = datetime.now()

        if record.needs_review:
            self._log(record.id, "重跑", f"第{record.run_count}次重跑，状态仍为待巡演统筹复核", operator)
        else:
            self._log(record.id, "重跑", f"第{record.run_count}次重跑完成", operator)

        return record

    def get_records_summary(self) -> List[Dict]:
        summary = []
        for r in self.records:
            summary.append({
                "id": r.id,
                "date": r.date,
                "band_name": r.band_name,
                "tuner_name": r.tuner_name,
                "hours": r.hours,
                "status": r.status.value,
                "status_text": self._status_text(r.status),
                "needs_review": r.needs_review,
                "is_leave": r.is_leave,
                "is_consumed": r.is_consumed,
                "run_count": r.run_count,
                "song_count": len(r.song_list),
                "correction_count": len(r.corrections),
                "has_corrections": len(r.corrections) > 0
            })
        return summary

    def _status_text(self, status: RecordStatus) -> str:
        mapping = {
            RecordStatus.NORMAL: "正常记录",
            RecordStatus.LEAVE_CONSUMED: "请假被算消耗（待巡演统筹复核）",
            RecordStatus.SUPPLEMENTED: "已补录群接龙",
            RecordStatus.PENDING_REVIEW: "待复核",
            RecordStatus.CORRECTED: "已人工修正",
            RecordStatus.REVIEW_APPROVED: "复核通过（请假计入消耗）",
            RecordStatus.REVIEW_REJECTED: "复核驳回（请假不计消耗）"
        }
        return mapping.get(status, status.value)

    def get_song_checklist(self, band_name: str = None) -> List[Dict]:
        checklists = self.song_checklists
        if band_name:
            checklists = [c for c in checklists if c.band_name == band_name]
        return [
            {
                "band_name": c.band_name,
                "song_name": c.song_name,
                "planned": c.planned,
                "actually_performed": c.actually_performed,
                "note": c.note,
                "source": c.source
            }
            for c in checklists
        ]

    def get_logs(self, record_id: str = None) -> List[Dict]:
        logs = self.logs
        if record_id:
            logs = [l for l in logs if l.record_id == record_id]
        return [
            {
                "timestamp": l.timestamp.isoformat(),
                "action": l.action,
                "detail": l.detail,
                "operator": l.operator,
                "record_id": l.record_id
            }
            for l in logs
        ]

    def get_record_detail(self, record_id: str) -> Optional[Dict]:
        record = next((r for r in self.records if r.id == record_id), None)
        if not record:
            return None
        return {
            "id": record.id,
            "date": record.date,
            "band_name": record.band_name,
            "room": record.room,
            "start_time": record.start_time,
            "end_time": record.end_time,
            "hours": record.hours,
            "tuner_name": record.tuner_name,
            "song_list": record.song_list,
            "members": record.members,
            "status": record.status.value,
            "status_text": self._status_text(record.status),
            "source": record.source.value,
            "is_leave": record.is_leave,
            "is_consumed": record.is_consumed,
            "needs_review": record.needs_review,
            "review_note": record.review_note,
            "review_decision": record.review_decision,
            "review_reason": record.review_reason,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
            "tuner_note": record.tuner_note,
            "group_remark": record.group_remark,
            "corrections": record.corrections,
            "correction_count": len(record.corrections),
            "has_corrections": len(record.corrections) > 0,
            "run_count": record.run_count,
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat()
        }

    def generate_report(self) -> Dict:
        records = self.records
        stats = {
            "total": len(records),
            "normal": 0,
            "leave_consumed": 0,
            "pending_review": 0,
            "supplemented": 0,
            "corrected": 0,
            "review_approved": 0,
            "review_rejected": 0,
            "total_hours": 0.0,
            "consumed_hours": 0.0,
            "pending_hours": 0.0
        }
        for r in records:
            stats["total_hours"] += r.hours
            if r.status == RecordStatus.NORMAL:
                stats["normal"] += 1
            if r.status == RecordStatus.LEAVE_CONSUMED:
                stats["leave_consumed"] += 1
            if r.needs_review:
                stats["pending_review"] += 1
                stats["pending_hours"] += r.hours
            if r.status == RecordStatus.SUPPLEMENTED:
                stats["supplemented"] += 1
            if len(r.corrections) > 0:
                stats["corrected"] += 1
            if r.status == RecordStatus.REVIEW_APPROVED:
                stats["review_approved"] += 1
            if r.status == RecordStatus.REVIEW_REJECTED:
                stats["review_rejected"] += 1
            if r.is_consumed:
                stats["consumed_hours"] += r.hours

        record_list = []
        for r in records:
            record_list.append({
                "date": r.date,
                "band_name": r.band_name,
                "tuner_name": r.tuner_name,
                "hours": r.hours,
                "status": self._status_text(r.status),
                "is_leave": r.is_leave,
                "is_consumed": r.is_consumed,
                "needs_review": r.needs_review,
                "review_note": r.review_note,
                "songs": r.song_list,
                "correction_count": len(r.corrections),
                "has_corrections": len(r.corrections) > 0
            })

        return {
            "generated_at": datetime.now().isoformat(),
            "stats": stats,
            "records": record_list,
            "checklist": self.get_song_checklist()
        }

    def export_report_text(self) -> str:
        report = self.generate_report()
        s = report["stats"]
        lines = []
        lines.append("=" * 60)
        lines.append("  音响租赁调音记录 - 统计报告")
        lines.append("  生成时间: " + report["generated_at"])
        lines.append("=" * 60)
        lines.append("")
        lines.append("【统计概览】")
        lines.append(f"  总记录数: {s['total']}")
        lines.append(f"  总课时: {s['total_hours']} 小时")
        lines.append(f"  已消耗课时: {s['consumed_hours']} 小时")
        lines.append(f"  待复核课时: {s['pending_hours']} 小时")
        lines.append("")
        lines.append("【状态分布】")
        lines.append(f"  正常记录: {s['normal']} 条")
        lines.append(f"  请假被算消耗(待复核): {s['pending_review']} 条 ⚠️")
        lines.append(f"  已补录群接龙: {s['supplemented']} 条")
        lines.append(f"  已人工修正: {s['corrected']} 条")
        lines.append(f"  复核通过(计入消耗): {s['review_approved']} 条")
        lines.append(f"  复核驳回(不计消耗): {s['review_rejected']} 条")
        lines.append("")
        lines.append("【记录明细】")
        lines.append("-" * 60)
        for i, r in enumerate(report["records"], 1):
            flag = " ⚠️待复核" if r["needs_review"] else ""
            corr_tag = " 🔧已人工修正" if r["has_corrections"] else ""
            lines.append(f"{i}. {r['band_name']} - {r['date']}{flag}{corr_tag}")
            lines.append(f"   状态: {r['status']}")
            lines.append(f"   调音师: {r['tuner_name'] or '未记录'}")
            lines.append(f"   课时: {r['hours']}小时 | 请假: {'是' if r['is_leave'] else '否'} | 消耗: {'是' if r['is_consumed'] else '否'}")
            if r["review_note"]:
                lines.append(f"   复核说明: {r['review_note']}")
            if r["songs"]:
                lines.append(f"   曲目: {', '.join(r['songs'][:3])}{'...' if len(r['songs']) > 3 else ''}")
            lines.append("")
        lines.append("=" * 60)
        return "\n".join(lines)
