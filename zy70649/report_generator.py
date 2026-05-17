import json
from typing import List
from pathlib import Path
from datetime import date
from models import BookingInterval, Conflict, ParseError
from interval_merger import IntervalMerger


class ReportGenerator:
    def __init__(self):
        self.merger = IntervalMerger()

    def generate_text_report(
        self,
        intervals: List[BookingInterval],
        merged_intervals: List[BookingInterval],
        conflicts: List[Conflict],
        parse_errors: List[ParseError],
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("房态日历连住区间锁房冲突检测报告")
        lines.append("=" * 80)
        lines.append("")

        lines.append("一、解析统计")
        lines.append("-" * 40)
        lines.append(f"  原始预订记录数: {len(intervals)}")
        lines.append(f"  合并后记录数: {len(merged_intervals)}")
        lines.append(f"  合并掉的记录数: {len(intervals) - len(merged_intervals)}")
        lines.append(f"  解析错误数: {len(parse_errors)}")
        lines.append("")

        if parse_errors:
            lines.append("二、解析错误详情")
            lines.append("-" * 40)
            for i, error in enumerate(parse_errors, 1):
                lines.append(f"  {i}. [{error.error_type}] {error.source}")
                lines.append(f"     消息: {error.message}")
                if error.source.raw_content:
                    lines.append(f"     原始内容: {error.source.raw_content[:100]}...")
                lines.append("")

        lines.append("三、冲突检测统计")
        lines.append("-" * 40)
        conflict_types = {}
        for c in conflicts:
            conflict_types[c.conflict_type] = conflict_types.get(c.conflict_type, 0) + 1

        for ctype, count in sorted(conflict_types.items()):
            lines.append(f"  {ctype}: {count} 处")
        lines.append(f"  总计: {len(conflicts)} 处冲突")
        lines.append("")

        if conflicts:
            lines.append("四、冲突详情")
            lines.append("-" * 40)
            for i, conflict in enumerate(conflicts, 1):
                lines.append(f"  {i}. [{conflict.conflict_type}]")
                lines.append(f"     房源: {conflict.room_name}")
                lines.append(f"     日期: {conflict.date.isoformat() if conflict.date else 'N/A'}")
                lines.append(f"     描述: {conflict.description}")
                lines.append("     涉及预订:")
                for interval in conflict.intervals:
                    lines.append(
                        f"       - {interval.date_range_str} | {interval.guest_name or '未填写'} | {interval.platform} | {interval.source}"
                    )
                lines.append("")

        lines.append("五、合并后房态概览")
        lines.append("-" * 40)

        room_groups = self.merger.group_intervals_by_room(merged_intervals)
        for room_id, room_intervals in sorted(room_groups.items()):
            lines.append(f"  房源: {room_intervals[0].room_name}")
            lines.append(f"  预订数: {len(room_intervals)} 个")
            for interval in sorted(room_intervals, key=lambda x: x.checkin_date):
                merged_info = " [已合并]" if interval.is_merged else ""
                lines.append(
                    f"    - {interval.date_range_str} ({interval.nights}晚) | {interval.guest_name or '未填写'} | {interval.lock_reason.value}{merged_info}"
                )
            lines.append("")

        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)

    def generate_json_report(
        self,
        intervals: List[BookingInterval],
        merged_intervals: List[BookingInterval],
        conflicts: List[Conflict],
        parse_errors: List[ParseError],
    ) -> str:
        report = {
            "generated_at": date.today().isoformat(),
            "summary": {
                "total_original": len(intervals),
                "total_merged": len(merged_intervals),
                "total_conflicts": len(conflicts),
                "total_parse_errors": len(parse_errors),
            },
            "conflicts": [c.to_dict() for c in conflicts],
            "parse_errors": [e.to_dict() for e in parse_errors],
            "merged_bookings": [
                {
                    "room_id": i.room_id,
                    "room_name": i.room_name,
                    "checkin": i.checkin_date.isoformat(),
                    "checkout": i.checkout_date.isoformat(),
                    "nights": i.nights,
                    "guest_name": i.guest_name,
                    "status": i.status.value,
                    "lock_reason": i.lock_reason.value,
                    "platform": i.platform,
                    "booking_id": i.booking_id,
                    "is_merged": i.is_merged,
                    "source": str(i.source),
                }
                for i in sorted(merged_intervals, key=lambda x: (x.room_id, x.checkin_date))
            ],
        }
        return json.dumps(report, ensure_ascii=False, indent=2)

    def save_report(
        self, content: str, output_path: str, format_type: str = "text"
    ) -> None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"报告已保存到: {path.absolute()}")

    def generate_room_calendar_view(
        self, merged_intervals: List[BookingInterval]
    ) -> str:
        lines = []
        lines.append("房间日历视图")
        lines.append("=" * 80)

        all_dates = self.merger.get_all_dates(merged_intervals)
        if not all_dates:
            lines.append("无数据")
            return "\n".join(lines)

        start_date = min(all_dates)
        end_date = max(all_dates)

        room_groups = self.merger.group_intervals_by_room(merged_intervals)

        for room_id, room_intervals in sorted(room_groups.items()):
            lines.append(f"\n{room_intervals[0].room_name}:")
            current = start_date
            while current <= end_date:
                has_booking = any(
                    interval.contains_date(current) for interval in room_intervals
                )
                if has_booking:
                    lines.append(f"  {current.isoformat()}: ■ 已预订")
                else:
                    lines.append(f"  {current.isoformat()}: □ 空房")
                current = current.replace(day=current.day + 1)

        return "\n".join(lines)
