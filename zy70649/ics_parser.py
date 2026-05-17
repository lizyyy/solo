from typing import List, Tuple
from datetime import datetime, date
from icalendar import Calendar, Event
from pathlib import Path
from models import BookingInterval, SourceLocation, ParseError, BookingStatus, LockReason


class ICSParser:
    def __init__(self):
        pass

    def parse_file(
        self, file_path: str
    ) -> Tuple[List[BookingInterval], List[ParseError]]:
        intervals: List[BookingInterval] = []
        errors: List[ParseError] = []
        path = Path(file_path)

        try:
            with open(path, "rb") as f:
                cal = Calendar.from_ical(f.read())

            for idx, component in enumerate(cal.walk()):
                if component.name == "VEVENT":
                    try:
                        interval = self._parse_event(component, file_path, idx + 1)
                        if interval:
                            intervals.append(interval)
                    except Exception as e:
                        errors.append(
                            ParseError(
                                source=SourceLocation(
                                    file_path=file_path,
                                    line_number=None,
                                    raw_content=str(component.to_ical().decode("utf-8", errors="ignore")),
                                ),
                                error_type="event_parse_error",
                                message=str(e),
                            )
                        )
        except Exception as e:
            errors.append(
                ParseError(
                    source=SourceLocation(file_path=file_path, raw_content=""),
                    error_type="file_parse_error",
                    message=f"ICS文件解析失败: {str(e)}",
                )
            )

        return intervals, errors

    def _parse_event(
        self, event: Event, file_path: str, event_idx: int
    ) -> BookingInterval:
        summary = str(event.get("summary", ""))
        description = str(event.get("description", ""))

        dtstart = event.get("dtstart")
        dtend = event.get("dtend")

        if not dtstart or not dtend:
            raise ValueError("事件缺少开始或结束日期")

        checkin_date = self._extract_date(dtstart.dt)
        checkout_date = self._extract_date(dtend.dt)

        room_id, room_name = self._extract_room_info(summary, description)
        guest_name = self._extract_guest_name(summary, description)
        booking_id = str(event.get("uid", ""))
        status = self._parse_status(str(event.get("status", "")))
        lock_reason = self._detect_lock_reason(summary, description)

        return BookingInterval(
            room_id=room_id,
            room_name=room_name,
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            guest_name=guest_name,
            status=status,
            lock_reason=lock_reason,
            platform="ics",
            booking_id=booking_id,
            source=SourceLocation(
                file_path=file_path,
                line_number=event_idx,
                raw_content=f"{summary} | {description[:100]}",
            ),
        )

    def _extract_date(self, dt) -> date:
        if isinstance(dt, datetime):
            return dt.date()
        return dt

    def _extract_room_info(self, summary: str, description: str) -> Tuple[str, str]:
        room_name = ""

        patterns = [
            r"房间[:：]\s*([^\n|]+)",
            r"房源[:：]\s*([^\n|]+)",
            r"Room[:：]\s*([^\n|]+)",
            r"Listing[:：]\s*([^\n|]+)",
        ]

        import re

        for pattern in patterns:
            match = re.search(pattern, summary + " " + description)
            if match:
                room_name = match.group(1).strip()
                break

        if not room_name:
            parts = summary.split("|")
            if len(parts) > 1:
                room_name = parts[1].strip()

        if not room_name:
            room_name = "unknown_room"

        room_id = room_name
        return room_id, room_name

    def _extract_guest_name(self, summary: str, description: str) -> str:
        import re

        patterns = [
            r"客人[:：]\s*([^\n|]+)",
            r"宾客[:：]\s*([^\n|]+)",
            r"Guest[:：]\s*([^\n|]+)",
            r"姓名[:：]\s*([^\n|]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, summary + " " + description)
            if match:
                return match.group(1).strip()

        parts = summary.split("|")
        if len(parts) > 0:
            candidate = parts[0].strip()
            if candidate and not any(k in candidate for k in ["预订", "Booking", "房间", "房源"]):
                return candidate

        return ""

    def _parse_status(self, status_str: str) -> BookingStatus:
        status_lower = status_str.lower()
        if "confirmed" in status_lower:
            return BookingStatus.CONFIRMED
        if "tentative" in status_lower:
            return BookingStatus.PENDING
        if "cancelled" in status_lower:
            return BookingStatus.CANCELLED
        return BookingStatus.CONFIRMED

    def _detect_lock_reason(self, summary: str, description: str) -> LockReason:
        combined = (summary + " " + description).lower()
        if any(k in combined for k in ["维护", "维修", "保洁", "maintenance", "clean"]):
            return LockReason.MAINTENANCE
        if any(k in combined for k in ["业主", "房主", "自用", "owner"]):
            return LockReason.OWNER_USE
        if any(k in combined for k in ["锁定", "block", "hold"]):
            return LockReason.OTHER
        return LockReason.BOOKING
