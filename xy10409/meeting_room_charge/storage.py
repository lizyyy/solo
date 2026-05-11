import csv
import os
from datetime import datetime
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


class DataStorage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.ensure_directories()

        self.members: Dict[str, Member] = {}
        self.bookings: Dict[str, Booking] = {}
        self.checkins: Dict[str, Checkin] = {}
        self.charges: Dict[str, Charge] = {}
        self.exceptions: Dict[str, ExceptionRecord] = {}

        self.load_all()

    def ensure_directories(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

        self.files = {
            "members": os.path.join(self.data_dir, "members.csv"),
            "bookings": os.path.join(self.data_dir, "bookings.csv"),
            "checkins": os.path.join(self.data_dir, "checkins.csv"),
            "charges": os.path.join(self.data_dir, "charges.csv"),
            "exceptions": os.path.join(self.data_dir, "exceptions.csv"),
        }

        for f in self.files.values():
            if not os.path.exists(f):
                open(f, "w").close()

    def load_all(self):
        self.load_members()
        self.load_bookings()
        self.load_checkins()
        self.load_charges()
        self.load_exceptions()

    def load_members(self):
        self.members = {}
        filepath = self.files["members"]
        if not os.path.exists(filepath):
            return

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
                self.members[member.member_id] = member

    def load_bookings(self):
        self.bookings = {}
        filepath = self.files["bookings"]
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
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
                    status=BookingStatus[row["status"]],
                )
                self.bookings[booking.booking_id] = booking

    def load_checkins(self):
        self.checkins = {}
        filepath = self.files["checkins"]
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                checkout_time = None
                if row.get("checkout_time"):
                    checkout_time = datetime.fromisoformat(row["checkout_time"])

                checkin = Checkin(
                    checkin_id=row["checkin_id"],
                    booking_id=row.get("booking_id") or None,
                    member_id=row["member_id"],
                    checkin_time=datetime.fromisoformat(row["checkin_time"]),
                    checkout_time=checkout_time,
                    is_processed=row["is_processed"].lower() == "true",
                )
                self.checkins[checkin.checkin_id] = checkin

    def load_charges(self):
        self.charges = {}
        filepath = self.files["charges"]
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                appeal_status = None
                if row.get("appeal_status"):
                    appeal_status = AppealStatus[row["appeal_status"]]

                final_amount = None
                if row.get("final_amount"):
                    final_amount = float(row["final_amount"])

                charge = Charge(
                    charge_id=row["charge_id"],
                    booking_id=row["booking_id"],
                    member_id=row["member_id"],
                    charge_type=BookingStatus[row["charge_type"]],
                    amount=float(row["amount"]),
                    charge_date=datetime.fromisoformat(row["charge_date"]),
                    is_appealed=row["is_appealed"].lower() == "true",
                    appeal_status=appeal_status,
                    appeal_reason=row.get("appeal_reason", ""),
                    final_amount=final_amount,
                )
                self.charges[charge.charge_id] = charge

    def load_exceptions(self):
        self.exceptions = {}
        filepath = self.files["exceptions"]
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                exception = ExceptionRecord(
                    exception_id=row["exception_id"],
                    record_type=row["record_type"],
                    record_id=row["record_id"],
                    reason=row["reason"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                    is_resolved=row["is_resolved"].lower() == "true",
                )
                self.exceptions[exception.exception_id] = exception

    def save_members(self):
        fieldnames = [
            "member_id",
            "name",
            "phone",
            "membership_level",
            "weekly_free_amount",
            "used_free_amount",
        ]
        with open(self.files["members"], "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for member in self.members.values():
                writer.writerow(
                    {
                        "member_id": member.member_id,
                        "name": member.name,
                        "phone": member.phone,
                        "membership_level": member.membership_level,
                        "weekly_free_amount": member.weekly_free_amount,
                        "used_free_amount": member.used_free_amount,
                    }
                )

    def save_bookings(self):
        fieldnames = [
            "booking_id",
            "member_id",
            "room_name",
            "start_time",
            "end_time",
            "cancel_time",
            "status",
        ]
        with open(self.files["bookings"], "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for booking in self.bookings.values():
                writer.writerow(
                    {
                        "booking_id": booking.booking_id,
                        "member_id": booking.member_id,
                        "room_name": booking.room_name,
                        "start_time": booking.start_time.isoformat(),
                        "end_time": booking.end_time.isoformat(),
                        "cancel_time": booking.cancel_time.isoformat()
                        if booking.cancel_time
                        else "",
                        "status": booking.status.name,
                    }
                )

    def save_checkins(self):
        fieldnames = [
            "checkin_id",
            "booking_id",
            "member_id",
            "checkin_time",
            "checkout_time",
            "is_processed",
        ]
        with open(self.files["checkins"], "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for checkin in self.checkins.values():
                writer.writerow(
                    {
                        "checkin_id": checkin.checkin_id,
                        "booking_id": checkin.booking_id or "",
                        "member_id": checkin.member_id,
                        "checkin_time": checkin.checkin_time.isoformat(),
                        "checkout_time": checkin.checkout_time.isoformat()
                        if checkin.checkout_time
                        else "",
                        "is_processed": str(checkin.is_processed).lower(),
                    }
                )

    def save_charges(self):
        fieldnames = [
            "charge_id",
            "booking_id",
            "member_id",
            "charge_type",
            "amount",
            "charge_date",
            "is_appealed",
            "appeal_status",
            "appeal_reason",
            "final_amount",
        ]
        with open(self.files["charges"], "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for charge in self.charges.values():
                writer.writerow(
                    {
                        "charge_id": charge.charge_id,
                        "booking_id": charge.booking_id,
                        "member_id": charge.member_id,
                        "charge_type": charge.charge_type.name,
                        "amount": charge.amount,
                        "charge_date": charge.charge_date.isoformat(),
                        "is_appealed": str(charge.is_appealed).lower(),
                        "appeal_status": charge.appeal_status.name
                        if charge.appeal_status
                        else "",
                        "appeal_reason": charge.appeal_reason,
                        "final_amount": charge.final_amount if charge.final_amount is not None else "",
                    }
                )

    def save_exceptions(self):
        fieldnames = [
            "exception_id",
            "record_type",
            "record_id",
            "reason",
            "created_at",
            "is_resolved",
        ]
        with open(self.files["exceptions"], "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for exception in self.exceptions.values():
                writer.writerow(
                    {
                        "exception_id": exception.exception_id,
                        "record_type": exception.record_type,
                        "record_id": exception.record_id,
                        "reason": exception.reason,
                        "created_at": exception.created_at.isoformat(),
                        "is_resolved": str(exception.is_resolved).lower(),
                    }
                )

    def save_all(self):
        self.save_members()
        self.save_bookings()
        self.save_checkins()
        self.save_charges()
        self.save_exceptions()
