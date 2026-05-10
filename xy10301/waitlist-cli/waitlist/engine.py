from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from datetime import datetime
import uuid
import json
from .models import Course, Registration, RegistrationStatus, MemberLevel


class PromoteResult:
    def __init__(self):
        self.promoted: List[Registration] = []
        self.notified: List[Registration] = []
        self.duplicates: List[dict] = []
        self.problems: List[dict] = []
        self.notification_queue: List[dict] = []
        self.waitlist_changes: List[dict] = []
        self.batch_id: str = ""


class WaitlistEngine:
    def __init__(self):
        self.courses: Dict[str, Course] = {}
        self.registrations: List[Registration] = []
        self.processed_batches: Dict[str, set] = defaultdict(set)

    def load_courses(self, courses: List[Course]):
        self.courses = {c.id: c for c in courses}

    def load_registrations(self, registrations: List[Registration]):
        self.registrations = registrations

    def get_course_registrations(self, course_id: str) -> List[Registration]:
        return [r for r in self.registrations if r.course_id == course_id]

    def get_confirmed_count(self, course_id: str) -> int:
        regs = self.get_course_registrations(course_id)
        return len([r for r in regs if r.status == RegistrationStatus.CONFIRMED])

    def get_available_slots(self, course_id: str) -> int:
        course = self.courses.get(course_id)
        if not course:
            return 0
        return max(0, course.max_capacity - self.get_confirmed_count(course_id))

    def get_waitlist(self, course_id: str) -> List[Registration]:
        regs = self.get_course_registrations(course_id)
        waitlist = [r for r in regs if r.status in (RegistrationStatus.WAITLIST, RegistrationStatus.NOTIFIED)]
        waitlist.sort(key=lambda r: r.sort_key)
        return waitlist

    def process_withdrawals(self, withdrawal_ids: List[str], batch_id: Optional[str] = None) -> PromoteResult:
        result = PromoteResult()
        batch_id = batch_id or uuid.uuid4().hex[:8]
        result.batch_id = batch_id

        withdrawal_regs = [r for r in self.registrations if r.id in withdrawal_ids]
        for reg in withdrawal_regs:
            if reg.status == RegistrationStatus.CANCELLED:
                result.problems.append({
                    "registration_id": reg.id,
                    "name": reg.name,
                    "course_id": reg.course_id,
                    "reason": "该报名已取消，重复处理"
                })
                continue

            if reg.status not in (RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLIST):
                result.problems.append({
                    "registration_id": reg.id,
                    "name": reg.name,
                    "course_id": reg.course_id,
                    "reason": f"状态不允许取消: {reg.status.value}"
                })
                continue

            reg.status = RegistrationStatus.CANCELLED
            reg.cancelled_at = datetime.now()
            reg.notes = f"批量取消批次: {batch_id}"

        affected_courses = set()
        for reg in withdrawal_regs:
            if reg.status == RegistrationStatus.CANCELLED and not any(
                p["registration_id"] == reg.id for p in result.problems
            ):
                affected_courses.add(reg.course_id)

        for course_id in affected_courses:
            self._promote_waitlist(course_id, batch_id, result)

        self._cleanup_notified_unconfirmed(batch_id, result)
        return result

    def _promote_waitlist(self, course_id: str, batch_id: str, result: PromoteResult):
        course = self.courses.get(course_id)
        if not course:
            result.problems.append({
                "course_id": course_id,
                "reason": "课程不存在"
            })
            return

        available_slots = self.get_available_slots(course_id)
        if available_slots <= 0:
            return

        waitlist = self.get_waitlist(course_id)
        if not waitlist:
            return

        processed_phones: Dict[str, str] = {}
        processed_ids = set()

        for reg in self.registrations:
            if reg.process_batch_id == batch_id:
                processed_ids.add(reg.id)
                if reg.promoted_from:
                    processed_phones[reg.phone] = reg.id

        to_promote: List[Registration] = []
        for reg in waitlist:
            if available_slots <= 0:
                break

            if reg.id in processed_ids:
                continue

            if reg.phone in processed_phones:
                duplicate_reg_id = processed_phones[reg.phone]
                duplicate_reg = next((r for r in self.registrations if r.id == duplicate_reg_id), None)
                result.duplicates.append({
                    "registration_id": reg.id,
                    "name": reg.name,
                    "phone": reg.phone,
                    "course_id": course_id,
                    "duplicate_of": duplicate_reg_id,
                    "duplicate_name": duplicate_reg.name if duplicate_reg else ""
                })
                continue

            if reg.status == RegistrationStatus.NOTIFIED and not reg.is_notified:
                pass

            old_status = reg.status.value
            reg.status = RegistrationStatus.CONFIRMED
            reg.confirmed_at = datetime.now()
            reg.promoted_from = old_status
            reg.process_batch_id = batch_id
            reg.is_notified = True

            to_promote.append(reg)
            processed_phones[reg.phone] = reg.id
            processed_ids.add(reg.id)
            available_slots -= 1

            result.notification_queue.append({
                "registration_id": reg.id,
                "name": reg.name,
                "phone": reg.phone,
                "course_name": course.name,
                "course_date": course.date,
                "course_time": course.time,
                "course_location": course.location,
                "instructor": course.instructor,
                "member_level": reg.member_level.value,
                "notification_type": "候补转正"
            })

            result.waitlist_changes.append({
                "course_id": course_id,
                "course_name": course.name,
                "registration_id": reg.id,
                "name": reg.name,
                "phone": reg.phone,
                "from_status": old_status,
                "to_status": "已确认",
                "member_level": reg.member_level.value,
                "registration_time": reg.registration_time.strftime("%Y-%m-%d %H:%M:%S")
            })

        result.promoted.extend(to_promote)

    def _cleanup_notified_unconfirmed(self, batch_id: str, result: PromoteResult):
        for reg in self.registrations:
            if reg.status == RegistrationStatus.NOTIFIED and reg.is_notified:
                reg.process_batch_id = batch_id

    def export_results(self, result: PromoteResult, output_dir: str) -> Dict[str, str]:
        import os
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        files = {}

        promoted_path = os.path.join(output_dir, f"promoted_{timestamp}_{result.batch_id}.json")
        with open(promoted_path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in result.promoted], f, ensure_ascii=False, indent=2)
        files["promoted"] = promoted_path

        notified_path = os.path.join(output_dir, f"notifications_{timestamp}_{result.batch_id}.json")
        with open(notified_path, "w", encoding="utf-8") as f:
            json.dump(result.notification_queue, f, ensure_ascii=False, indent=2)
        files["notifications"] = notified_path

        duplicates_path = os.path.join(output_dir, f"duplicates_{timestamp}_{result.batch_id}.json")
        with open(duplicates_path, "w", encoding="utf-8") as f:
            json.dump(result.duplicates, f, ensure_ascii=False, indent=2)
        files["duplicates"] = duplicates_path

        problems_path = os.path.join(output_dir, f"problems_{timestamp}_{result.batch_id}.json")
        with open(problems_path, "w", encoding="utf-8") as f:
            json.dump(result.problems, f, ensure_ascii=False, indent=2)
        files["problems"] = problems_path

        changes_path = os.path.join(output_dir, f"waitlist_changes_{timestamp}_{result.batch_id}.json")
        with open(changes_path, "w", encoding="utf-8") as f:
            json.dump(result.waitlist_changes, f, ensure_ascii=False, indent=2)
        files["waitlist_changes"] = changes_path

        return files
