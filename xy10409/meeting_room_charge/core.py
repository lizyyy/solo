import csv
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .models import (
    AppealStatus,
    Booking,
    BookingStatus,
    Charge,
    Checkin,
    ExceptionRecord,
    Member,
)
from .storage import DataStorage


class ChargeConfig:
    NO_SHOW_RATE = 50.0
    LATE_RATE = 30.0
    OVERTIME_RATE_PER_HOUR = 40.0
    LATE_THRESHOLD_MINUTES = 15
    EARLY_CANCEL_HOURS = 24


class ChargeEngine:
    def __init__(self, storage: DataStorage):
        self.storage = storage
        self.config = ChargeConfig()

    def generate_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def import_members(self, filepath: str) -> int:
        count = 0
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                member = Member(
                    member_id=row["member_id"],
                    name=row["name"],
                    phone=row["phone"],
                    membership_level=row["membership_level"],
                    weekly_free_amount=float(row.get("weekly_free_amount", 0)),
                    used_free_amount=float(row.get("used_free_amount", 0)),
                )
                self.storage.members[member.member_id] = member
                count += 1
        self.storage.save_members()
        return count

    def import_bookings(self, filepath: str) -> int:
        count = 0
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("booking_id") in self.storage.bookings:
                    continue

                cancel_time = None
                if row.get("cancel_time"):
                    cancel_time = datetime.fromisoformat(row["cancel_time"])

                booking = Booking(
                    booking_id=row["booking_id"],
                    member_id=row["member_id"],
                    room_name=row["room_name"],
                    start_time=datetime.fromisoformat(row["start_time"]),
                    end_time=datetime.fromisoformat(row["end_time"]),
                    cancel_time=cancel_time,
                    status=BookingStatus.PENDING,
                )

                self._validate_booking(booking)
                self.storage.bookings[booking.booking_id] = booking
                count += 1

        self.storage.save_bookings()
        self.storage.save_exceptions()
        return count

    def _validate_booking(self, booking: Booking):
        if booking.cancel_time and booking.cancel_time > booking.start_time:
            exception = ExceptionRecord(
                exception_id=self.generate_id(),
                record_type="booking",
                record_id=booking.booking_id,
                reason=f"取消时间({booking.cancel_time})晚于开始时间({booking.start_time})",
                created_at=datetime.now(),
            )
            self.storage.exceptions[exception.exception_id] = exception

    def import_checkins(self, filepath: str) -> int:
        count = 0
        imported_dates: Dict[str, set] = {}

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("checkin_id") in self.storage.checkins:
                    continue

                checkin_time = datetime.fromisoformat(row["checkin_time"])

                member_id = row["member_id"]
                checkin_date = checkin_time.date().isoformat()

                if member_id not in imported_dates:
                    imported_dates[member_id] = set()

                if checkin_date in imported_dates[member_id]:
                    continue

                checkout_time = None
                if row.get("checkout_time"):
                    checkout_time = datetime.fromisoformat(row["checkout_time"])

                checkin = Checkin(
                    checkin_id=row["checkin_id"],
                    booking_id=row.get("booking_id") or None,
                    member_id=member_id,
                    checkin_time=checkin_time,
                    checkout_time=checkout_time,
                    is_processed=False,
                )

                self._validate_checkin(checkin)
                self.storage.checkins[checkin.checkin_id] = checkin
                imported_dates[member_id].add(checkin_date)
                count += 1

        self.storage.save_checkins()
        self.storage.save_exceptions()
        return count

    def _validate_checkin(self, checkin: Checkin) -> bool:
        if not checkin.booking_id:
            exception = ExceptionRecord(
                exception_id=self.generate_id(),
                record_type="checkin",
                record_id=checkin.checkin_id,
                reason=f"签到记录({checkin.checkin_id})预约编号缺失",
                created_at=datetime.now(),
            )
            self.storage.exceptions[exception.exception_id] = exception
            checkin.is_processed = True
            return False

        booking = self.storage.bookings.get(checkin.booking_id)
        if not booking:
            checkin.is_processed = True
            return False

        if checkin.checkin_time.date() != booking.start_time.date():
            exception = ExceptionRecord(
                exception_id=self.generate_id(),
                record_type="checkin",
                record_id=checkin.checkin_id,
                reason=f"签到时间({checkin.checkin_time})跨天，预约开始时间({booking.start_time})",
                created_at=datetime.now(),
            )
            self.storage.exceptions[exception.exception_id] = exception
            checkin.is_processed = True
            return False

        return True

    def process_charges(self):
        for checkin in self.storage.checkins.values():
            if checkin.is_processed or not checkin.booking_id:
                continue

            booking = self.storage.bookings.get(checkin.booking_id)
            if not booking:
                continue

            status = self._determine_status(booking, checkin)
            booking.status = status

            if status in [BookingStatus.NO_SHOW, BookingStatus.LATE, BookingStatus.OVERTIME]:
                self._create_charge(booking, status, checkin)

            checkin.is_processed = True

        for booking in self.storage.bookings.values():
            if booking.status != BookingStatus.PENDING:
                continue

            if booking.cancel_time:
                hours_before_start = (booking.start_time - booking.cancel_time).total_seconds() / 3600
                if hours_before_start >= self.config.EARLY_CANCEL_HOURS:
                    booking.status = BookingStatus.EARLY_CANCEL
                elif hours_before_start > 0:
                    booking.status = BookingStatus.NO_SHOW
                    self._create_charge(booking, BookingStatus.NO_SHOW, None)
            else:
                if datetime.now() > booking.end_time:
                    booking.status = BookingStatus.NO_SHOW
                    self._create_charge(booking, BookingStatus.NO_SHOW, None)

        self.storage.save_all()

    def _determine_status(self, booking: Booking, checkin: Checkin) -> BookingStatus:
        if booking.cancel_time:
            hours_before_start = (booking.start_time - booking.cancel_time).total_seconds() / 3600
            if hours_before_start >= self.config.EARLY_CANCEL_HOURS:
                return BookingStatus.EARLY_CANCEL

        late_minutes = (checkin.checkin_time - booking.start_time).total_seconds() / 60

        if late_minutes > self.config.LATE_THRESHOLD_MINUTES:
            status = BookingStatus.LATE
        else:
            status = BookingStatus.NORMAL

        if checkin.checkout_time and checkin.checkout_time > booking.end_time:
            return BookingStatus.OVERTIME

        return status

    def _create_charge(self, booking: Booking, status: BookingStatus, checkin: Optional[Checkin]):
        if any(
            c.booking_id == booking.booking_id
            and not c.is_appealed
            for c in self.storage.charges.values()
        ):
            return

        amount = self._calculate_charge(booking, status, checkin)
        actual_amount = self._apply_free_amount(booking, amount)

        charge = Charge(
            charge_id=self.generate_id(),
            booking_id=booking.booking_id,
            member_id=booking.member_id,
            charge_type=status,
            amount=amount,
            charge_date=datetime.now(),
            final_amount=actual_amount,
        )
        self.storage.charges[charge.charge_id] = charge

    def _calculate_charge(self, booking: Booking, status: BookingStatus, checkin: Optional[Checkin]) -> float:
        if status == BookingStatus.NO_SHOW:
            return self.config.NO_SHOW_RATE
        elif status == BookingStatus.LATE:
            return self.config.LATE_RATE
        elif status == BookingStatus.OVERTIME and checkin and checkin.checkout_time:
            overtime_hours = (checkin.checkout_time - booking.end_time).total_seconds() / 3600
            overtime_hours = max(overtime_hours, 0)
            return overtime_hours * self.config.OVERTIME_RATE_PER_HOUR
        return 0.0

    def _apply_free_amount(self, booking: Booking, amount: float) -> float:
        member = self.storage.members.get(booking.member_id)
        if not member or amount <= 0:
            return amount

        remaining_free = max(member.weekly_free_amount - member.used_free_amount, 0)
        if remaining_free > 0:
            used_amount = min(remaining_free, amount)
            member.used_free_amount += used_amount
            return max(amount - remaining_free, 0)

        return amount

    def get_member_bill(self, member_id: str) -> List[Charge]:
        return [
            charge
            for charge in self.storage.charges.values()
            if charge.member_id == member_id
        ]

    def register_appeal(self, charge_id: str, reason: str) -> Optional[Charge]:
        charge = self.storage.charges.get(charge_id)
        if not charge:
            return None

        charge.is_appealed = True
        charge.appeal_status = AppealStatus.PENDING
        charge.appeal_reason = reason
        self.storage.save_charges()
        return charge

    def process_appeal(self, charge_id: str, approved: bool) -> Optional[Charge]:
        charge = self.storage.charges.get(charge_id)
        if not charge:
            return None

        if approved:
            charge.appeal_status = AppealStatus.APPROVED
            charge.final_amount = 0.0
        else:
            charge.appeal_status = AppealStatus.REJECTED

        self.storage.save_charges()
        return charge

    def recalculate_charges(self):
        for charge in self.storage.charges.values():
            if charge.is_appealed and charge.appeal_status == AppealStatus.APPROVED:
                continue

            booking = self.storage.bookings.get(charge.booking_id)
            if not booking:
                continue

            checkin = None
            for c in self.storage.checkins.values():
                if c.booking_id == booking.booking_id:
                    checkin = c
                    break

            new_amount = self._calculate_charge(booking, charge.charge_type, checkin)
            new_final = self._apply_free_amount(booking, new_amount)

            charge.amount = new_amount
            charge.final_amount = new_final

        self.storage.save_all()

    def get_weekly_report(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        report = []
        for charge in self.storage.charges.values():
            if start_date <= charge.charge_date <= end_date:
                member = self.storage.members.get(charge.member_id)
                booking = self.storage.bookings.get(charge.booking_id)

                report.append(
                    {
                        "charge_id": charge.charge_id,
                        "member_id": charge.member_id,
                        "member_name": member.name if member else "Unknown",
                        "member_phone": member.phone if member else "Unknown",
                        "room_name": booking.room_name if booking else "Unknown",
                        "charge_type": charge.charge_type.value,
                        "original_amount": charge.amount,
                        "final_amount": charge.final_amount,
                        "charge_date": charge.charge_date.isoformat(),
                        "is_appealed": charge.is_appealed,
                        "appeal_status": charge.appeal_status.value if charge.appeal_status else "",
                    }
                )
        return sorted(report, key=lambda x: x["charge_date"])

    def export_weekly_report(self, filepath: str, start_date: datetime, end_date: datetime):
        report = self.get_weekly_report(start_date, end_date)
        if not report:
            return 0

        fieldnames = [
            "charge_id",
            "member_id",
            "member_name",
            "member_phone",
            "room_name",
            "charge_type",
            "original_amount",
            "final_amount",
            "charge_date",
            "is_appealed",
            "appeal_status",
        ]

        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in report:
                writer.writerow(row)

        return len(report)

    def get_pending_exceptions(self) -> List[ExceptionRecord]:
        return [e for e in self.storage.exceptions.values() if not e.is_resolved]

    def resolve_exception(self, exception_id: str) -> Optional[ExceptionRecord]:
        exception = self.storage.exceptions.get(exception_id)
        if not exception:
            return None
        exception.is_resolved = True
        self.storage.save_exceptions()
        return exception
