#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Set


@dataclass
class BookingRecord:
    booking_id: str
    room_name: str
    start_time: datetime
    end_time: datetime
    booker: str
    status: str
    has_equipment: bool = False
    cancel_type: str = ""
    source_file: str = ""
    source_line: int = 0

    def is_cross_day(self) -> bool:
        return self.start_time.date() != self.end_time.date()

    def is_manual_cancel(self) -> bool:
        return self.cancel_type == "人工取消"

    def has_equipment_occupied(self) -> bool:
        return self.has_equipment


@dataclass
class CompensationResult:
    booking_id: str
    room_name: str
    booker: str
    compensation_type: str
    compensation_amount: float
    cross_day: bool
    equipment_occupied: bool
    manual_cancel: bool
    source_file: str
    source_line: int
    processed_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def get_sort_key(self) -> tuple:
        return (self.room_name, self.booking_id, self.compensation_type)


class MeetingRoomCompensationCLI:
    def __init__(self, input_dir: str, output_file: str, append: bool = False):
        self.input_dir = Path(input_dir)
        self.output_file = Path(output_file)
        self.append = append
        self.processed_bookings: Set[str] = set()
        self.results: List[CompensationResult] = []
        
    def load_processed_history(self) -> None:
        if self.output_file.exists() and self.append:
            with open(self.output_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.processed_bookings.add(row['booking_id'])
    
    def parse_datetime(self, dt_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间格式: {dt_str}")

    def read_booking_file(self, file_path: Path) -> List[BookingRecord]:
        records = []
        filename = file_path.name
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    record = BookingRecord(
                        booking_id=row.get('预约编号', row.get('booking_id', '')).strip(),
                        room_name=row.get('会议室名称', row.get('room_name', '')).strip(),
                        start_time=self.parse_datetime(row.get('开始时间', row.get('start_time', ''))),
                        end_time=self.parse_datetime(row.get('结束时间', row.get('end_time', ''))),
                        booker=row.get('预约人', row.get('booker', '')).strip(),
                        status=row.get('状态', row.get('status', '')).strip(),
                        has_equipment=row.get('设备占用', row.get('has_equipment', '')).lower() in ['是', 'true', '1', 'yes'],
                        cancel_type=row.get('取消类型', row.get('cancel_type', '')).strip(),
                        source_file=filename,
                        source_line=line_num
                    )
                    records.append(record)
                except Exception as e:
                    print(f"警告: 文件 {filename} 第 {line_num} 行解析失败: {e}", file=sys.stderr)
        
        return records

    def calculate_compensation(self, record: BookingRecord) -> Optional[CompensationResult]:
        if record.booking_id in self.processed_bookings:
            return None

        compensation_types = []
        total_amount = 0.0

        if record.is_cross_day():
            compensation_types.append("跨天预约补偿")
            total_amount += 100.0
        
        if record.has_equipment_occupied():
            compensation_types.append("设备占用补偿")
            total_amount += 50.0
        
        if record.is_manual_cancel():
            compensation_types.append("人工取消补偿")
            total_amount += 30.0

        if not compensation_types:
            return None

        result = CompensationResult(
            booking_id=record.booking_id,
            room_name=record.room_name,
            booker=record.booker,
            compensation_type=" + ".join(compensation_types),
            compensation_amount=total_amount,
            cross_day=record.is_cross_day(),
            equipment_occupied=record.has_equipment_occupied(),
            manual_cancel=record.is_manual_cancel(),
            source_file=record.source_file,
            source_line=record.source_line
        )
        
        return result

    def process_files(self) -> None:
        csv_files = list(self.input_dir.glob("*.csv"))
        if not csv_files:
            print(f"警告: 在 {self.input_dir} 中未找到CSV文件", file=sys.stderr)
            return

        all_records = []
        for csv_file in csv_files:
            records = self.read_booking_file(csv_file)
            all_records.extend(records)
            print(f"已读取 {csv_file.name}: {len(records)} 条记录")

        for record in all_records:
            result = self.calculate_compensation(record)
            if result:
                self.results.append(result)

        self.results.sort(key=lambda r: r.get_sort_key())

    def write_results(self) -> None:
        fieldnames = [
            'booking_id', 'room_name', 'booker', 'compensation_type',
            'compensation_amount', 'cross_day', 'equipment_occupied',
            'manual_cancel', 'source_file', 'source_line', 'processed_at'
        ]

        mode = 'a' if self.append and self.output_file.exists() else 'w'
        
        with open(self.output_file, mode, encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if mode == 'w' or not self.output_file.exists():
                writer.writeheader()
            
            for result in self.results:
                writer.writerow(asdict(result))

        print(f"\n核算完成!")
        print(f"- 处理记录数: {len(self.results)}")
        print(f"- 输出文件: {self.output_file.resolve()}")

    def generate_summary(self) -> Dict:
        summary = {
            "total_compensations": len(self.results),
            "total_amount": sum(r.compensation_amount for r in self.results),
            "by_room": {},
            "by_type": {},
            "cross_day_count": sum(1 for r in self.results if r.cross_day),
            "equipment_count": sum(1 for r in self.results if r.equipment_occupied),
            "manual_cancel_count": sum(1 for r in self.results if r.manual_cancel),
        }

        for result in self.results:
            summary["by_room"][result.room_name] = summary["by_room"].get(result.room_name, 0) + 1
            for t in result.compensation_type.split(" + "):
                summary["by_type"][t] = summary["by_type"].get(t, 0) + 1

        return summary

    def print_summary(self) -> None:
        summary = self.generate_summary()
        print("\n" + "="*50)
        print("会议室预约表释放补偿核算报告")
        print("="*50)
        print(f"总补偿订单数: {summary['total_compensations']}")
        print(f"总补偿金额: ¥{summary['total_amount']:.2f}")
        print(f"- 跨天预约补偿: {summary['cross_day_count']} 笔")
        print(f"- 设备占用补偿: {summary['equipment_count']} 笔")
        print(f"- 人工取消补偿: {summary['manual_cancel_count']} 笔")
        print("\n按会议室统计:")
        for room, count in sorted(summary['by_room'].items()):
            print(f"  {room}: {count} 笔")
        print("\n按补偿类型统计:")
        for ctype, count in sorted(summary['by_type'].items()):
            print(f"  {ctype}: {count} 笔")
        print("="*50 + "\n")

    def run(self) -> int:
        try:
            self.load_processed_history()
            self.process_files()
            self.write_results()
            self.print_summary()
            return 0
        except Exception as e:
            print(f"错误: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            return 1


def main():
    parser = argparse.ArgumentParser(
        description="会议室预约表释放补偿核算 CLI - 稳定核算应补偿订单",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
补偿规则:
- 跨天预约: ¥100
- 设备占用: ¥50
- 人工取消: ¥30

输出字段说明:
- booking_id: 预约编号
- room_name: 会议室名称  
- booker: 预约人
- compensation_type: 补偿类型
- compensation_amount: 补偿金额
- cross_day: 是否跨天预约
- equipment_occupied: 是否设备占用
- manual_cancel: 是否人工取消
- source_file: 原始文件名
- source_line: 原始文件行号
- processed_at: 处理时间
        """
    )
    parser.add_argument(
        '-i', '--input-dir',
        required=True,
        help='输入目录，包含预约表CSV文件'
    )
    parser.add_argument(
        '-o', '--output-file',
        required=True,
        help='输出结果CSV文件路径'
    )
    parser.add_argument(
        '-a', '--append',
        action='store_true',
        help='追加模式（跳过已处理的预约编号）'
    )
    parser.add_argument(
        '--summary-only',
        action='store_true',
        help='仅显示已存在结果的摘要'
    )

    args = parser.parse_args()

    if args.summary_only:
        if not Path(args.output_file).exists():
            print(f"错误: 输出文件不存在: {args.output_file}", file=sys.stderr)
            return 1
        cli = MeetingRoomCompensationCLI(args.input_dir, args.output_file, args.append)
        cli.load_processed_history()
        print(f"已处理历史记录数: {len(cli.processed_bookings)}")
        return 0

    cli = MeetingRoomCompensationCLI(args.input_dir, args.output_file, args.append)
    return cli.run()


if __name__ == "__main__":
    sys.exit(main())
