from datetime import datetime
from typing import Dict, List, Optional, Tuple
import uuid
import json
import os

from models import (
    Visitor, Meeting, MealVoucher, VerificationRecord, VerificationReport,
    MealVoucherStatus, MeetingStatus, VerificationStatus
)


class MealVoucherService:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.visitors: Dict[str, Visitor] = {}
        self.meetings: Dict[str, Meeting] = {}
        self.vouchers: Dict[str, MealVoucher] = {}
        self.verifications: Dict[str, VerificationRecord] = {}
        self._load_data()

    def _load_data(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for filename in ["visitors.json", "meetings.json", "vouchers.json", "verifications.json"]:
            filepath = os.path.join(self.data_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._restore_data(filename, data)

    def _restore_data(self, filename: str, data: dict):
        if filename == "visitors.json":
            for vid, vdata in data.items():
                vdata['visit_date'] = datetime.fromisoformat(vdata['visit_date'])
                self.visitors[vid] = Visitor(**vdata)
        elif filename == "meetings.json":
            for mid, mdata in data.items():
                mdata['scheduled_time'] = datetime.fromisoformat(mdata['scheduled_time'])
                mdata['end_time'] = datetime.fromisoformat(mdata['end_time'])
                mdata['status'] = MeetingStatus(mdata['status'])
                if mdata.get('cancel_time'):
                    mdata['cancel_time'] = datetime.fromisoformat(mdata['cancel_time'])
                self.meetings[mid] = Meeting(**mdata)
        elif filename == "vouchers.json":
            for code, vdata in data.items():
                vdata['issue_time'] = datetime.fromisoformat(vdata['issue_time'])
                vdata['valid_from'] = datetime.fromisoformat(vdata['valid_from'])
                vdata['valid_to'] = datetime.fromisoformat(vdata['valid_to'])
                vdata['status'] = MealVoucherStatus(vdata['status'])
                if vdata.get('use_time'):
                    vdata['use_time'] = datetime.fromisoformat(vdata['use_time'])
                self.vouchers[code] = MealVoucher(**vdata)
        elif filename == "verifications.json":
            for rid, rdata in data.items():
                rdata['verification_time'] = datetime.fromisoformat(rdata['verification_time'])
                rdata['status'] = VerificationStatus(rdata['status'])
                self.verifications[rid] = VerificationRecord(**rdata)

    def _save_data(self):
        data_mapping = {
            "visitors.json": self.visitors,
            "meetings.json": self.meetings,
            "vouchers.json": self.vouchers,
            "verifications.json": self.verifications
        }
        for filename, data_dict in data_mapping.items():
            filepath = os.path.join(self.data_dir, filename)
            serializable = {}
            for key, obj in data_dict.items():
                obj_dict = obj.__dict__.copy()
                for k, v in obj_dict.items():
                    if isinstance(v, datetime):
                        obj_dict[k] = v.isoformat()
                    elif hasattr(v, 'value'):
                        obj_dict[k] = v.value
                serializable[key] = obj_dict
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(serializable, f, ensure_ascii=False, indent=2)

    def add_visitor(self, name: str, phone: str, company: str, visit_date: datetime) -> Visitor:
        visitor_id = f"V{datetime.now().strftime('%Y%m%d')}{len(self.visitors) + 1:04d}"
        visitor = Visitor(visitor_id=visitor_id, name=name, phone=phone, company=company, visit_date=visit_date)
        self.visitors[visitor_id] = visitor
        self._save_data()
        return visitor

    def add_meeting(self, title: str, host: str, scheduled_time: datetime, end_time: datetime) -> Meeting:
        meeting_id = f"M{datetime.now().strftime('%Y%m%d')}{len(self.meetings) + 1:04d}"
        meeting = Meeting(
            meeting_id=meeting_id, title=title, host=host,
            scheduled_time=scheduled_time, end_time=end_time,
            status=MeetingStatus.SCHEDULED
        )
        self.meetings[meeting_id] = meeting
        self._save_data()
        return meeting

    def cancel_meeting(self, meeting_id: str, cancel_reason: str, auto_cancel_vouchers: bool = True) -> Optional[Meeting]:
        if meeting_id not in self.meetings:
            return None
        meeting = self.meetings[meeting_id]
        meeting.status = MeetingStatus.CANCELLED
        meeting.cancel_reason = cancel_reason
        meeting.cancel_time = datetime.now()
        self._save_data()
        if auto_cancel_vouchers:
            self._cancel_vouchers_for_meeting(meeting_id)
        return meeting

    def _cancel_vouchers_for_meeting(self, meeting_id: str):
        for voucher in self.vouchers.values():
            if voucher.meeting_id == meeting_id and voucher.status == MealVoucherStatus.ISSUED:
                voucher.status = MealVoucherStatus.CANCELLED
        self._save_data()

    def issue_voucher(self, visitor_id: str, meeting_id: str, valid_from: datetime, valid_to: datetime) -> Optional[MealVoucher]:
        if visitor_id not in self.visitors:
            return None
        if meeting_id not in self.meetings:
            return None
        meeting = self.meetings[meeting_id]
        if meeting.status in [MeetingStatus.CANCELLED, MeetingStatus.POSTPONED]:
            return None
        voucher_code = f"VC{datetime.now().strftime('%Y%m%d')}{len(self.vouchers) + 1:06d}"
        voucher = MealVoucher(
            voucher_code=voucher_code, visitor_id=visitor_id, meeting_id=meeting_id,
            issue_time=datetime.now(), valid_from=valid_from, valid_to=valid_to,
            status=MealVoucherStatus.ISSUED
        )
        self.vouchers[voucher_code] = voucher
        self._save_data()
        return voucher

    def use_voucher(self, voucher_code: str, use_location: str) -> Optional[MealVoucher]:
        if voucher_code not in self.vouchers:
            return None
        voucher = self.vouchers[voucher_code]
        if voucher.status != MealVoucherStatus.ISSUED:
            return None
        now = datetime.now()
        if not (voucher.valid_from <= now <= voucher.valid_to):
            return None
        voucher.status = MealVoucherStatus.USED
        voucher.use_time = now
        voucher.use_location = use_location
        self._save_data()
        return voucher

    def verify_voucher(self, voucher_code: str, operator: str) -> Tuple[Optional[VerificationRecord], str]:
        if voucher_code not in self.vouchers:
            return None, "餐券不存在"
        voucher = self.vouchers[voucher_code]
        existing_records = [r for r in self.verifications.values() if r.voucher_code == voucher_code]
        if existing_records:
            latest = existing_records[-1]
            return latest, f"该餐券已检查过（幂等保护），当前状态：{latest.status.value}"
        meeting = self.meetings.get(voucher.meeting_id)
        if not meeting:
            status = VerificationStatus.NO_ACTION
            notes = "关联会议不存在"
        elif meeting.status == MeetingStatus.CANCELLED and voucher.status == MealVoucherStatus.ISSUED:
            status = VerificationStatus.PENDING
            notes = f"会议已取消：{meeting.cancel_reason}"
        elif meeting.status == MeetingStatus.CANCELLED and voucher.status == MealVoucherStatus.USED:
            status = VerificationStatus.CONFLICT
            notes = "冲突：会议已取消但餐券已被使用"
        elif meeting.status in [MeetingStatus.POSTPONED] and voucher.status == MealVoucherStatus.ISSUED:
            status = VerificationStatus.PENDING
            notes = f"会议已延期"
        else:
            status = VerificationStatus.NO_ACTION
            notes = "状态正常，无需核销"
        record_id = str(uuid.uuid4())
        record = VerificationRecord(
            record_id=record_id, voucher_code=voucher_code,
            verification_time=datetime.now(), status=status,
            operator=operator, notes=notes
        )
        self.verifications[record_id] = record
        self._save_data()
        return record, "核销检查完成"

    def check_voucher_status(self, voucher_code: str) -> Optional[dict]:
        if voucher_code not in self.vouchers:
            return None
        voucher = self.vouchers[voucher_code]
        visitor = self.visitors.get(voucher.visitor_id)
        meeting = self.meetings.get(voucher.meeting_id)
        return {
            "voucher": voucher.__dict__,
            "visitor": visitor.__dict__ if visitor else None,
            "meeting": meeting.__dict__ if meeting else None
        }

    def get_verification_history(self, voucher_code: str = None) -> List[VerificationRecord]:
        if voucher_code:
            return [r for r in self.verifications.values() if r.voucher_code == voucher_code]
        return list(self.verifications.values())

    def generate_verification_report(self) -> VerificationReport:
        details = []
        pending_count = 0
        conflict_count = 0
        no_action_count = 0
        to_verified = 0
        for voucher in self.vouchers.values():
            meeting = self.meetings.get(voucher.meeting_id)
            visitor = self.visitors.get(voucher.visitor_id)
            verifications = self.get_verification_history(voucher.voucher_code)
            latest_verification = verifications[-1] if verifications else None
            status_info = "未检查"
            if latest_verification:
                if latest_verification.status == VerificationStatus.PENDING:
                    pending_count += 1
                    to_verified += 1
                    status_info = "待核销"
                elif latest_verification.status == VerificationStatus.CONFLICT:
                    conflict_count += 1
                    to_verified += 1
                    status_info = "冲突"
                elif latest_verification.status == VerificationStatus.NO_ACTION:
                    no_action_count += 1
                    status_info = "无需核销"
                elif latest_verification.status == VerificationStatus.VERIFIED:
                    status_info = "已核销"
            detail = {
                "voucher_code": voucher.voucher_code,
                "visitor_name": visitor.name if visitor else "未知",
                "visitor_company": visitor.company if visitor else "未知",
                "meeting_title": meeting.title if meeting else "未知",
                "meeting_status": meeting.status.value if meeting else "未知",
                "voucher_status": voucher.status.value,
                "verification_status": status_info,
                "notes": latest_verification.notes if latest_verification else "",
                "cancel_reason": meeting.cancel_reason if meeting and meeting.status == MeetingStatus.CANCELLED else ""
            }
            details.append(detail)
        report_id = f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return VerificationReport(
            report_id=report_id,
            generated_at=datetime.now(),
            total_vouchers=len(self.vouchers),
            to_verified=to_verified,
            pending_count=pending_count,
            conflict_count=conflict_count,
            no_action_count=no_action_count,
            details=details
        )
