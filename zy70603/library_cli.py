#!/usr/bin/env python3
import argparse
import json
import csv
import sys
from datetime import datetime
from typing import Optional
import os

from models import (
    Reader, BookCopy, Reservation, OverdueRecord,
    PickupWindow, ReaderType, CopyStatus, ReservationStatus
)
from reservation_engine import ReservationEngine


class CLIManager:
    def __init__(self, data_dir: str = "./data"):
        self.engine = ReservationEngine()
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(os.path.join(data_dir, "reports"), exist_ok=True)
        os.makedirs(os.path.join(data_dir, "exports"), exist_ok=True)

    def load_data(self, readers_file: str = None, copies_file: str = None,
                  reservations_file: str = None, windows_file: str = None):
        if readers_file and os.path.exists(readers_file):
            self._load_readers(readers_file)
        if copies_file and os.path.exists(copies_file):
            self._load_copies(copies_file)
        if reservations_file and os.path.exists(reservations_file):
            self._load_reservations(reservations_file)
        if windows_file and os.path.exists(windows_file):
            self._load_windows(windows_file)

    def _load_readers(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split(',')
                if len(parts) >= 4:
                    try:
                        reader = Reader(
                            reader_id=parts[0].strip(),
                            name=parts[1].strip(),
                            reader_type=ReaderType(parts[2].strip()),
                            department=parts[3].strip(),
                            overdue_count=int(parts[4]) if len(parts) > 4 else 0
                        )
                        self.engine.add_reader(reader)
                    except (ValueError, KeyError):
                        continue

    def _load_copies(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split(',')
                if len(parts) >= 4:
                    try:
                        copy = BookCopy(
                            copy_id=parts[0].strip(),
                            isbn=parts[1].strip(),
                            title=parts[2].strip(),
                            status=CopyStatus(parts[3].strip()),
                            location=parts[4].strip() if len(parts) > 4 else ""
                        )
                        self.engine.add_copy(copy)
                    except (ValueError, KeyError):
                        continue

    def _load_reservations(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        reader_id = parts[0].strip()
                        copy_id = parts[1].strip()
                        status = ReservationStatus.PENDING
                        created_at = None
                        locked_until = None
                        picked_up_at = None
                        expired_at = None
                        
                        if len(parts) >= 3 and parts[2].strip() and parts[2].strip() in [s.value for s in ReservationStatus]:
                            status = ReservationStatus(parts[2].strip())
                        if len(parts) >= 4 and parts[3].strip():
                            created_at = datetime.fromisoformat(parts[3].strip())
                        if len(parts) >= 5 and parts[4].strip():
                            locked_until = datetime.fromisoformat(parts[4].strip())
                        if len(parts) >= 6 and parts[5].strip():
                            picked_up_at = datetime.fromisoformat(parts[5].strip())
                        if len(parts) >= 7 and parts[6].strip():
                            expired_at = datetime.fromisoformat(parts[6].strip())
                        
                        self.engine.create_reservation(
                            reader_id=reader_id,
                            copy_id=copy_id,
                            status=status,
                            created_at=created_at,
                            locked_until=locked_until,
                            picked_up_at=picked_up_at,
                            expired_at=expired_at
                        )
                    except (ValueError, KeyError) as e:
                        continue

    def list_reservations(self):
        print("\n📋 当前所有预约记录:")
        print("-" * 80)
        for res_id, res in self.engine.reservations.items():
            reader = self.engine.readers.get(res.reader_id)
            copy = self.engine.copies.get(res.copy_id)
            reader_name = reader.name if reader else "未知"
            copy_title = copy.title if copy else "未知"
            status_str = res.status.value
            locked_info = ""
            if res.locked_until:
                if res.is_expired():
                    locked_info = " [已逾期]"
                else:
                    remaining = res.locked_until - datetime.now()
                    hours = int(remaining.total_seconds() / 3600)
                    locked_info = f" [锁定剩余{hours}小时]"
            print(f"  {res_id}: {reader_name}({res.reader_id}) -> "
                  f"{copy_title}({res.copy_id}) [{status_str}]{locked_info}")
        print()

    def _load_windows(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split(',')
                if len(parts) >= 5:
                    try:
                        window = PickupWindow(
                            window_id=parts[0].strip(),
                            start_time=datetime.fromisoformat(parts[1].strip()),
                            end_time=datetime.fromisoformat(parts[2].strip()),
                            location=parts[3].strip(),
                            max_capacity=int(parts[4])
                        )
                        self.engine.add_pickup_window(window)
                    except (ValueError, KeyError):
                        continue

    def print_human_report(self, report):
        print("\n" + "=" * 80)
        print(f"图书馆预约队列流转报告")
        print(f"报告编号: {report.report_id}")
        print(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        print(f"\n📊 预约统计概览")
        print(f"  总预约数:        {report.total_reservations}")
        print(f"  已处理预约数:    {report.processed_reservations}")
        print(f"  已取书数:        {report.picked_up_reservations}")
        print(f"  逾期释放数:      {report.expired_reservations}")
        print(f"  教师优先预约数:  {report.teacher_priority_count}")
        
        if report.released_copies:
            print(f"\n📚 逾期释放的书籍副本 ({len(report.released_copies)} 本):")
            for copy_id in report.released_copies:
                copy = self.engine.copies.get(copy_id)
                if copy:
                    print(f"  - {copy_id}: {copy.title} ({copy.location})")
        
        if report.queue_changes:
            print(f"\n🔄 队列状态变化:")
            for change in report.queue_changes:
                copy = self.engine.copies.get(change['copy_id'])
                title = copy.title if copy else "未知书籍"
                print(f"  - 书籍 {change['copy_id']} ({title}): "
                      f"排队 {change['queue_length']} 人, "
                      f"下一位读者 {change['next_reader']}")
        
        print("\n" + "=" * 80)
        print("✅ 报告生成完毕")
        print("=" * 80 + "\n")

    def save_machine_report(self, report, output_file: str):
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        return output_file

    def save_csv_report(self, report, output_file: str):
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['字段', '值'])
            writer.writerow(['报告编号', report.report_id])
            writer.writerow(['生成时间', report.generated_at.isoformat()])
            writer.writerow(['总预约数', report.total_reservations])
            writer.writerow(['已处理预约数', report.processed_reservations])
            writer.writerow(['已取书数', report.picked_up_reservations])
            writer.writerow(['逾期释放数', report.expired_reservations])
            writer.writerow(['教师优先预约数', report.teacher_priority_count])
            writer.writerow([])
            writer.writerow(['逾期释放书籍'])
            for cid in report.released_copies:
                writer.writerow([cid])
        return output_file

    def validate_and_report(self):
        errors = self.engine.validate_data()
        has_errors = any(v for v in errors.values())
        
        if has_errors:
            print("\n⚠️  数据校验发现以下问题:")
            for category, msgs in errors.items():
                if msgs:
                    print(f"\n  {category.upper()}:")
                    for msg in msgs:
                        print(f"    - {msg}")
            print()
            return False
        return True


def main():
    parser = argparse.ArgumentParser(
        description="图书馆预约队列逾期释放副本流转排查CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
【预约数据完整格式】: reader_id,copy_id,status,created_at,locked_until,picked_up_at,expired_at

示例:
  # 查看所有预约及锁定状态
  python library_cli.py --list
  
  # 模拟预约锁定过期（演示模式，立即将PENDING转已过期LOCKED）
  python library_cli.py --simulate-expired
  
  # 处理逾期释放（逾期释放后副本流转）
  python library_cli.py --process-expired --report --json-out report.json
  
  # 查看逾期释放报告（expired_reservations和released_copies不为空）
  cat report.json | grep -E 'expired_reservations|released_copies'
  
  # 查看指定书籍的预约队列
  python library_cli.py --queue COPY-001
  
  # 演示完整闭环：模拟过期 -> 处理释放 -> 生成报告
  python library_cli.py --simulate-expired --process-expired --report --json-out result.json
        """
    )

    parser.add_argument("--data-dir", default="./data", help="数据目录")
    parser.add_argument("--readers", help="读者数据文件路径")
    parser.add_argument("--copies", help="书籍副本数据文件路径")
    parser.add_argument("--reservations", help="预约数据文件路径")
    parser.add_argument("--windows", help="取书窗口数据文件路径")
    parser.add_argument("--sample", help="使用指定样例数据: normal/boundary/dirty/empty")
    
    parser.add_argument("--list", action="store_true", help="列出所有预约及状态")
    parser.add_argument("--simulate-expired", action="store_true", help="演示模式：模拟预约锁定已过期")
    parser.add_argument("--process-expired", action="store_true", help="处理逾期预约（释放副本流转）")
    parser.add_argument("--lock", nargs=2, metavar=("RES_ID", "WIN_ID"), help="锁定指定预约")
    parser.add_argument("--pickup", metavar="RES_ID", help="取书完成预约")
    
    parser.add_argument("--report", action="store_true", help="生成流转报告")
    parser.add_argument("--queue", metavar="COPY_ID", help="查看指定书籍的预约队列")
    parser.add_argument("--validate", action="store_true", help="数据校验模式")
    
    parser.add_argument("--json-out", help="JSON格式报告输出路径")
    parser.add_argument("--csv-out", help="CSV格式报告输出路径")
    parser.add_argument("--no-human", action="store_true", help="不打印人类可读报告")

    args = parser.parse_args()

    cli = CLIManager(data_dir=args.data_dir)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sample_map = {
        "normal": "samples/normal",
        "boundary": "samples/boundary",
        "dirty": "samples/dirty",
        "empty": "samples/empty",
        "expired": "samples/expired"
    }
    if args.sample and args.sample in sample_map:
        base_path = os.path.join(script_dir, sample_map[args.sample])
    else:
        base_path = os.path.join(script_dir, "samples", "normal")
    
    def resolve_path(path):
        if path is None:
            return None
        if os.path.isabs(path):
            return path
        return os.path.join(script_dir, path)
    
    cli.load_data(
        readers_file=resolve_path(args.readers) if args.readers else os.path.join(base_path, "readers.txt"),
        copies_file=resolve_path(args.copies) if args.copies else os.path.join(base_path, "copies.txt"),
        reservations_file=resolve_path(args.reservations) if args.reservations else os.path.join(base_path, "reservations.txt"),
        windows_file=resolve_path(args.windows) if args.windows else os.path.join(base_path, "windows.txt")
    )

    if args.validate:
        cli.validate_and_report()
        return

    if args.list:
        cli.list_reservations()
        return

    if args.simulate_expired:
        count = cli.engine.simulate_expire_locked(25)
        print(f"\n⏳ 演示模式：模拟 {count} 个预约锁定已过期（锁定时间设为25小时前）")
        cli.list_reservations()

    if args.lock:
        res_id, win_id = args.lock
        success = cli.engine.lock_reservation(res_id, win_id, 24)
        if success:
            print(f"\n✅ 预约 {res_id} 已锁定，取书窗口 {win_id}，锁定24小时")
        else:
            print(f"\n❌ 预约 {res_id} 锁定失败")
        return

    if args.pickup:
        success = cli.engine.pickup_book(args.pickup)
        if success:
            print(f"\n✅ 预约 {args.pickup} 已取书完成")
        else:
            print(f"\n❌ 预约 {args.pickup} 取书失败")
        return

    if args.queue:
        queue = cli.engine.get_copy_queue(args.queue)
        print(f"\n📋 书籍 {args.queue} 的预约队列 ({len(queue)} 人):")
        for idx, res in enumerate(queue, 1):
            reader = cli.engine.readers.get(res.reader_id)
            name = reader.name if reader else "未知"
            rtype = reader.reader_type.value if reader else "unknown"
            print(f"  {idx}. {res.reader_id} - {name} ({rtype}) "
                  f"[创建: {res.created_at.strftime('%m-%d %H:%M')}]")
        print()
        return

    if args.process_expired:
        count, records = cli.engine.process_expired()
        print(f"\n⏰ 处理了 {count} 个逾期预约")
        if records:
            print("  逾期记录:")
            for rec in records:
                print(f"    - {rec.record_id}: 读者 {rec.reader_id}, 书籍 {rec.copy_id}")
        print()

    if args.report or args.json_out or args.csv_out:
        report = cli.engine.generate_flow_report()
        
        if not args.no_human:
            cli.print_human_report(report)
        
        if args.json_out:
            path = cli.save_machine_report(report, args.json_out)
            print(f"💾 JSON报告已保存到: {path}")
        
        if args.csv_out:
            path = cli.save_csv_report(report, args.csv_out)
            print(f"💾 CSV报告已保存到: {path}")

    if len(sys.argv) == 1:
        parser.print_help()


if __name__ == "__main__":
    main()
