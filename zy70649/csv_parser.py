import csv
from typing import List, Dict, Optional, Tuple
from datetime import datetime, date
from pathlib import Path
from models import BookingInterval, SourceLocation, ParseError, BookingStatus, LockReason


class PlatformCSVFormat:
    def __init__(
        self,
        name: str,
        room_id_columns: List[str],
        room_name_columns: List[str],
        checkin_columns: List[str],
        checkout_columns: List[str],
        guest_name_columns: List[str],
        status_columns: List[str],
        booking_id_columns: List[str],
        date_formats: List[str],
    ):
        self.name = name
        self.room_id_columns = room_id_columns
        self.room_name_columns = room_name_columns
        self.checkin_columns = checkin_columns
        self.checkout_columns = checkout_columns
        self.guest_name_columns = guest_name_columns
        self.status_columns = status_columns
        self.booking_id_columns = booking_id_columns
        self.date_formats = date_formats

    def match(self, headers: List[str]) -> bool:
        header_set = set(h.lower() for h in headers)
        for col in self.checkin_columns + self.checkout_columns + self.room_name_columns:
            if col.lower() in header_set:
                return True
        return False


BUILTIN_FORMATS = [
    PlatformCSVFormat(
        name="airbnb",
        room_id_columns=["room_id", "listing_id", "房源编号"],
        room_name_columns=["room_name", "listing_name", "房源名称", "房间名称"],
        checkin_columns=["checkin", "check_in", "入住日期", "开始日期"],
        checkout_columns=["checkout", "check_out", "退房日期", "结束日期"],
        guest_name_columns=["guest_name", "客人姓名", "宾客姓名", "姓名"],
        status_columns=["status", "状态", "预订状态"],
        booking_id_columns=["booking_id", "confirmation_code", "确认号", "订单号"],
        date_formats=["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"],
    ),
    PlatformCSVFormat(
        name="tujia",
        room_id_columns=["room_id", "房源编号", "房间号"],
        room_name_columns=["room_name", "房源名称", "房型"],
        checkin_columns=["checkin_date", "入住日期", "开始时间"],
        checkout_columns=["checkout_date", "退房日期", "结束时间"],
        guest_name_columns=["guest_name", "客人", "姓名"],
        status_columns=["status", "订单状态"],
        booking_id_columns=["order_id", "订单编号"],
        date_formats=["%Y-%m-%d", "%Y-%m-%d %H:%M:%S"],
    ),
    PlatformCSVFormat(
        name="meituan",
        room_id_columns=["room_id", "酒店id", "房型id"],
        room_name_columns=["room_name", "房型名称", "酒店名称"],
        checkin_columns=["checkin", "入住日期", "arrival"],
        checkout_columns=["checkout", "离店日期", "departure"],
        guest_name_columns=["guest_name", "客人姓名", "入住人"],
        status_columns=["status", "状态"],
        booking_id_columns=["order_id", "订单id"],
        date_formats=["%Y-%m-%d", "%Y%m%d"],
    ),
]


class CSVParser:
    def __init__(self):
        self.formats = BUILTIN_FORMATS

    def parse_file(
        self, file_path: str
    ) -> Tuple[List[BookingInterval], List[ParseError]]:
        intervals: List[BookingInterval] = []
        errors: List[ParseError] = []
        path = Path(file_path)

        with open(path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        lines = content.splitlines()
        if not lines:
            return intervals, errors

        dialect = self._detect_dialect(lines[0])
        reader = csv.DictReader(lines, dialect=dialect)
        headers = reader.fieldnames or []

        matched_format = self._match_format(headers)

        for line_num, row in enumerate(reader, start=2):
            try:
                interval = self._parse_row(
                    row, headers, matched_format, file_path, line_num
                )
                if interval:
                    intervals.append(interval)
            except Exception as e:
                errors.append(
                    ParseError(
                        source=SourceLocation(
                            file_path=file_path,
                            line_number=line_num,
                            raw_content=lines[line_num - 1] if line_num - 1 < len(lines) else "",
                        ),
                        error_type="parse_error",
                        message=str(e),
                        raw_data=row,
                    )
                )

        return intervals, errors

    def _detect_dialect(self, sample: str) -> csv.Dialect:
        try:
            return csv.Sniffer().sniff(sample)
        except:
            return csv.excel

    def _match_format(self, headers: List[str]) -> Optional[PlatformCSVFormat]:
        for fmt in self.formats:
            if fmt.match(headers):
                return fmt
        return None

    def _parse_row(
        self,
        row: Dict[str, str],
        headers: List[str],
        fmt: Optional[PlatformCSVFormat],
        file_path: str,
        line_num: int,
    ) -> Optional[BookingInterval]:
        lower_headers = {h.lower(): h for h in headers}

        def get_value(possible_names: List[str]) -> str:
            for name in possible_names:
                if name.lower() in lower_headers:
                    value = row.get(lower_headers[name.lower()], "")
                    return (value or "").strip()
            return ""

        room_id = get_value(fmt.room_id_columns if fmt else ["room_id", "房源编号"])
        room_name = get_value(
            fmt.room_name_columns if fmt else ["room_name", "房源名称"]
        )

        if not room_id and not room_name:
            raise ValueError("无法识别房源信息，请检查列名或提供映射")

        checkin_str = get_value(
            fmt.checkin_columns if fmt else ["checkin", "入住日期"]
        )
        checkout_str = get_value(
            fmt.checkout_columns if fmt else ["checkout", "退房日期"]
        )

        if not checkin_str or not checkout_str:
            raise ValueError("缺少入住或退房日期")

        checkin_date = self._parse_date(checkin_str, fmt)
        checkout_date = self._parse_date(checkout_str, fmt)

        if checkin_date >= checkout_date:
            raise ValueError(f"入住日期 {checkin_date} 必须早于退房日期 {checkout_date}")

        guest_name = get_value(
            fmt.guest_name_columns if fmt else ["guest_name", "客人姓名"]
        )
        status_str = get_value(fmt.status_columns if fmt else ["status", "状态"])
        booking_id = get_value(
            fmt.booking_id_columns if fmt else ["booking_id", "订单号"]
        )

        status = self._parse_status(status_str)
        lock_reason = self._detect_lock_reason(guest_name, status_str)

        if not room_id:
            room_id = room_name

        return BookingInterval(
            room_id=room_id,
            room_name=room_name or room_id,
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            guest_name=guest_name,
            status=status,
            lock_reason=lock_reason,
            platform=fmt.name if fmt else "unknown",
            booking_id=booking_id,
            source=SourceLocation(
                file_path=file_path, line_number=line_num, raw_content=str(row)
            ),
        )

    def _parse_date(self, date_str: str, fmt: Optional[PlatformCSVFormat]) -> date:
        date_str = date_str.strip()
        if not date_str:
            raise ValueError("空日期字符串")

        formats = fmt.date_formats if fmt else ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"]

        for date_format in formats:
            try:
                return datetime.strptime(date_str, date_format).date()
            except ValueError:
                continue

        raise ValueError(f"无法解析日期: {date_str}，尝试的格式: {formats}")

    def _parse_status(self, status_str: str) -> BookingStatus:
        status_lower = status_str.lower()
        if any(k in status_lower for k in ["已确认", "confirmed", "accept", "成功"]):
            return BookingStatus.CONFIRMED
        if any(k in status_lower for k in ["待确认", "pending", "等待"]):
            return BookingStatus.PENDING
        if any(k in status_lower for k in ["已取消", "cancelled", "cancel"]):
            return BookingStatus.CANCELLED
        if any(k in status_lower for k in ["已锁定", "blocked", "锁房"]):
            return BookingStatus.BLOCKED
        return BookingStatus.CONFIRMED

    def _detect_lock_reason(self, guest_name: str, status_str: str) -> LockReason:
        if not guest_name or guest_name in ["维护", "维修", "保洁", "保养"]:
            return LockReason.MAINTENANCE
        if guest_name in ["业主", "房主", "自用", "owner"]:
            return LockReason.OWNER_USE
        return LockReason.BOOKING
