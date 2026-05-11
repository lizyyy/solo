#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from meeting_room_charge.storage import DataStorage
from meeting_room_charge.core import ChargeEngine
from meeting_room_charge.models import Member, Booking, Checkin, BookingStatus
from datetime import datetime

storage = DataStorage('./test_logic_data')
engine = ChargeEngine(storage)

member = Member(
    member_id="M001",
    name="Test",
    phone="123456789",
    membership_level="Test",
    weekly_free_amount=30.0,
    used_free_amount=0.0,
)
storage.members["M001"] = member

booking = Booking(
    booking_id="B001",
    member_id="M001",
    room_name="Test Room",
    start_time=datetime(2026, 5, 6, 14, 0, 0),
    end_time=datetime(2026, 5, 6, 16, 0, 0),
)

checkin = Checkin(
    checkin_id="C001",
    booking_id="B001",
    member_id="M001",
    checkin_time=datetime(2026, 5, 6, 14, 30, 0),
)

print(f"Before: used_free_amount = {member.used_free_amount}")
print(f"Before: weekly_free_amount = {member.weekly_free_amount}")

status = engine._determine_status(booking, checkin)
print(f"Status: {status}")

amount = engine._calculate_charge(booking, status, checkin)
print(f"Calculated amount: {amount}")

actual = engine._apply_free_amount(booking, amount)
print(f"Actual amount after free: {actual}")
print(f"After: used_free_amount = {member.used_free_amount}")
