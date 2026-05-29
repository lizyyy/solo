"""练琴打卡异常处理CLI - 主入口"""
import os
import sys
import argparse
from datetime import datetime, timedelta
from typing import List, Optional
from collections import defaultdict

from .models import (
    CheckinRecord, Student, MakeupInfo, RecordStatus,
    generate_id, load_json, save_json, ensure_dirs,
    RECORDS_FILE, STUDENTS_FILE, SCHEDULE_FILE, AUDIO_DIR
)
from .audio_checker import AudioChecker
from .makeup_rules import MakeupRuleEngine
from .duplicate_merger import DuplicateMerger
from .comment_tracker import CommentTracker
from .report_exporter import ReportExporter


class CheckinProcessor:
    def __init__(self):
        ensure_dirs()
        self.audio_checker = AudioChecker()
        self.makeup_engine = MakeupRuleEngine()
        self.duplicate_merger = DuplicateMerger()
        self.comment_tracker = CommentTracker()
        self.report_exporter = ReportExporter()

        self._students: List[Student] = []
        self._records: List[CheckinRecord] = []
        self._load_data()

    def _load_data(self):
        students_data = load_json(STUDENTS_FILE, [])
        self._students = [Student.from_dict(s) for s in students_data]

        records_data = load_json(RECORDS_FILE, [])
        self._records = [CheckinRecord.from_dict(r) for r in records_data]

    def _reload(self):
        self._load_data()
        self.makeup_engine._load_schedules()
        self.comment_tracker._load_all()
        self.report_exporter._load_all()

    def _save_records(self):
        data = [r.to_dict() for r in self._records]
        save_json(RECORDS_FILE, data, save_history=True)
        self._reload()

    def process_audio(
        self,
        audio_path: str,
        student_id: str,
        checkin_date: str = None,
        is_makeup: bool = False,
        original_date: str = None,
        makeup_reason: str = None
    ) -> CheckinRecord:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"音频文件不存在: {audio_path}")

        student = self._find_student(student_id)
        if not student:
            raise ValueError(f"学生不存在: {student_id}")

        checkin_date = checkin_date or datetime.now().strftime("%Y-%m-%d")
        checkin_time = datetime.now().strftime("%H:%M:%S")

        audio_result = self.audio_checker.analyze_file(audio_path)

        if not audio_result.audio_info:
            raise ValueError(f"音频校验失败: {audio_result.details}")

        makeup = MakeupInfo(
            is_makeup=is_makeup,
            original_date=original_date,
            reason=makeup_reason,
            submit_date=checkin_date if is_makeup else None,
            approved=None
        )

        record = CheckinRecord(
            record_id=generate_id("r_"),
            student_id=student_id,
            checkin_date=checkin_date,
            checkin_time=checkin_time,
            audio=audio_result.audio_info,
            makeup=makeup,
            status=RecordStatus.PENDING,
            abnormal_types=[],
            abnormal_details=[]
        )

        if not audio_result.is_valid:
            record.abnormal_types.extend(audio_result.abnormal_types)
            record.abnormal_details.extend(audio_result.details)

        record = self.makeup_engine.validate_record(record)

        if record.abnormal_types:
            record.status = RecordStatus.ABNORMAL
        else:
            record.status = RecordStatus.NORMAL

        self._records.append(record)
        self._save_records()

        return record

    def process_batch(
        self,
        audio_files: List[str],
        student_id: str,
        checkin_date: str = None,
        is_makeup: bool = False,
        original_date: str = None,
        makeup_reason: str = None
    ) -> List[CheckinRecord]:
        records = []
        for audio_path in audio_files:
            try:
                record = self.process_audio(
                    audio_path, student_id, checkin_date,
                    is_makeup, original_date, makeup_reason
                )
                records.append(record)
            except Exception as e:
                print(f"处理 {audio_path} 失败: {e}", file=sys.stderr)
        return records

    def merge_duplicates(self, date_filter: str = None) -> dict:
        records_to_process = self._records
        if date_filter:
            records_to_process = [
                r for r in self._records if r.checkin_date == date_filter
            ]

        records, summary = self.duplicate_merger.merge_all(
            records_to_process, auto_confirm=True
        )

        updated_ids = {r.record_id for r in records}
        for i, existing in enumerate(self._records):
            if existing.record_id in updated_ids:
                for updated in records:
                    if updated.record_id == existing.record_id:
                        self._records[i] = updated
                        break

        self._save_records()
        return summary

    def add_comment(
        self,
        record_id: str,
        teacher: str,
        content: str
    ):
        return self.comment_tracker.add_comment(record_id, teacher, content)

    def generate_report(
        self,
        report_date: str = None,
        format: str = "text"
    ) -> str:
        report_date = report_date or datetime.now().strftime("%Y-%m-%d")
        return self.report_exporter.generate_daily_report(report_date, format)

    def generate_student_report(
        self,
        student_id: str,
        start_date: str = None,
        end_date: str = None
    ) -> str:
        return self.report_exporter.export_student_report(
            student_id, start_date, end_date
        )

    def list_records(
        self,
        date_filter: str = None,
        abnormal_only: bool = False,
        student_filter: str = None
    ) -> List[CheckinRecord]:
        records = [
            r for r in self._records
            if r.status != RecordStatus.MERGED
        ]

        if date_filter:
            records = [r for r in records if r.checkin_date == date_filter]
        if student_filter:
            records = [r for r in records if r.student_id == student_filter]
        if abnormal_only:
            records = [r for r in records if r.abnormal_types]

        return sorted(
            records,
            key=lambda x: (x.checkin_date, x.checkin_time)
        )

    def list_students(self) -> List[Student]:
        return sorted(self._students, key=lambda x: x.name)

    def get_record(self, record_id: str) -> Optional[CheckinRecord]:
        for r in self._records:
            if r.record_id == record_id:
                return r
        return None

    def show_pipeline(self, record_id: str) -> str:
        record = self.get_record(record_id)
        if not record:
            return f"记录不存在: {record_id}"

        student = self._find_student(record.student_id)
        lines = []
        lines.append("=" * 70)
        lines.append(f"处理流水线视图 - 记录 {record_id}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("【学生信息】")
        if student:
            lines.append(f"  姓名: {student.name}")
            lines.append(f"  级别: {student.level}")
            lines.append(f"  老师: {student.teacher}")
        lines.append(f"  打卡日期: {record.checkin_date}")
        lines.append(f"  打卡时间: {record.checkin_time}")
        lines.append("")

        lines.append("① 音频校验 → ")
        lines.append(f"   文件: {record.audio.file_name}")
        lines.append(f"   时长: {record.audio.duration_seconds}秒")
        lines.append(f"   音量: {record.audio.avg_volume}dB")
        lines.append(f"   采样率: {record.audio.sample_rate}Hz")
        audio_pass = not any(
            t in record.abnormal_types
            for t in ["blank_audio", "short_audio", "low_quality"]
        )
        lines.append(f"   结果: {'✅ 通过' if audio_pass else '❌ 异常'}")
        if not audio_pass:
            for detail in record.abnormal_details:
                if any(k in detail for k in ["音频", "音量", "时长", "采样率"]):
                    lines.append(f"     - {detail}")
        lines.append("")

        lines.append("② 补录规则 → ")
        if record.makeup.is_makeup:
            lines.append(f"   原日期: {record.makeup.original_date}")
            lines.append(f"   提交日期: {record.makeup.submit_date}")
            lines.append(f"   理由: {record.makeup.reason}")
            makeup_pass = not any(
                t in record.abnormal_types
                for t in ["makeup_overdue", "invalid_reason"]
            )
            lines.append(f"   结果: {'✅ 通过' if makeup_pass else '❌ 异常'}")
            if not makeup_pass:
                for detail in record.abnormal_details:
                    if any(k in detail for k in ["补录", "理由", "超期"]):
                        lines.append(f"     - {detail}")
        else:
            lines.append("   非补录，跳过")
        lines.append("")

        lines.append("③ 重复检测 → ")
        if record.merged_from:
            lines.append(f"   ⚠️  已合并 {len(record.merged_from)} 条重复记录")
            lines.append(f"   合并来源: {', '.join(record.merged_from)}")
        elif record.merged_into:
            lines.append(f"   ⚠️  已被合并至: {record.merged_into}")
        else:
            lines.append("   ✅ 无重复")
        lines.append("")

        lines.append("④ 点评追踪 → ")
        comments = self.comment_tracker.get_comments_for_record(record_id)
        if comments:
            for c in comments:
                lines.append(f"   [{c.comment.created_at}] {c.comment.teacher}:")
                lines.append(f"      {c.comment.content}")
        else:
            lines.append("   ⏳ 待点评")
        lines.append("")

        lines.append("⑤ 报告导出 → ")
        ab_type_names = {
            "blank_audio": "空白音频",
            "short_audio": "时长不足",
            "makeup_overdue": "补录超期",
            "duplicate": "重复上传",
            "invalid_reason": "理由无效",
            "low_quality": "质量过低"
        }
        if record.abnormal_types:
            type_names = [
                ab_type_names.get(t.value, t.value)
                for t in record.abnormal_types
            ]
            lines.append(f"   状态: ⚠️  异常 ({', '.join(type_names)})")
            lines.append(f"   说明: 该记录将在日报中标记为异常，需老师关注")
        else:
            lines.append(f"   状态: ✅ 正常")
            lines.append(f"   说明: 该记录将计入正常统计")
        lines.append("")

        lines.append("=" * 70)
        return "\n".join(lines)

    def _find_student(self, student_id: str) -> Optional[Student]:
        for s in self._students:
            if s.student_id == student_id:
                return s
        return None


def print_menu():
    print("\n" + "=" * 70)
    print("🎹 练琴打卡异常处理系统 CLI")
    print("=" * 70)
    print("\n【主菜单】")
    print("  1. 处理单个音频文件")
    print("  2. 批量处理音频文件")
    print("  3. 合并同日重复记录")
    print("  4. 添加老师点评")
    print("  5. 查看记录列表")
    print("  6. 查看处理流水线")
    print("  7. 生成日报")
    print("  8. 生成学生报告")
    print("  9. 列出学生名单")
    print(" 10. 查看待点评记录")
    print("  0. 退出")
    print("=" * 70)


def interactive_mode():
    processor = CheckinProcessor()

    while True:
        print_menu()
        choice = input("\n请选择操作 [0-10]: ").strip()

        if choice == "1":
            process_single_audio(processor)
        elif choice == "2":
            process_batch_audio(processor)
        elif choice == "3":
            merge_duplicates_interactive(processor)
        elif choice == "4":
            add_comment_interactive(processor)
        elif choice == "5":
            list_records_interactive(processor)
        elif choice == "6":
            show_pipeline_interactive(processor)
        elif choice == "7":
            generate_report_interactive(processor)
        elif choice == "8":
            generate_student_report_interactive(processor)
        elif choice == "9":
            list_students_interactive(processor)
        elif choice == "10":
            list_uncommented_interactive(processor)
        elif choice == "0":
            print("👋 再见！")
            break
        else:
            print("❌ 无效选项，请重试")

        input("\n按 Enter 继续...")


def process_single_audio(processor: CheckinProcessor):
    print("\n【处理单个音频】")
    audio_path = input("音频文件路径: ").strip()
    student_id = input("学生ID: ").strip()
    checkin_date = input("打卡日期 (回车=今天): ").strip() or None
    is_makeup = input("是否补录? (y/N): ").strip().lower() == "y"

    original_date = None
    makeup_reason = None
    if is_makeup:
        original_date = input("原打卡日期 (YYYY-MM-DD): ").strip()
        makeup_reason = input("补录理由: ").strip()

    try:
        record = processor.process_audio(
            audio_path, student_id, checkin_date,
            is_makeup, original_date, makeup_reason
        )
        print(f"\n✅ 处理完成！")
        print(f"记录ID: {record.record_id}")
        print(f"状态: {record.status.value}")
        if record.abnormal_types:
            print(f"⚠️  异常: {len(record.abnormal_types)} 项")
            for detail in record.abnormal_details:
                print(f"   - {detail}")
    except Exception as e:
        print(f"❌ 处理失败: {e}")


def process_batch_audio(processor: CheckinProcessor):
    print("\n【批量处理音频】")
    student_id = input("学生ID: ").strip()
    checkin_date = input("打卡日期 (回车=今天): ").strip() or None
    is_makeup = input("是否补录? (y/N): ").strip().lower() == "y"

    original_date = None
    makeup_reason = None
    if is_makeup:
        original_date = input("原打卡日期 (YYYY-MM-DD): ").strip()
        makeup_reason = input("补录理由: ").strip()

    print("\n输入音频文件路径，每行一个，输入空行结束:")
    audio_files = []
    while True:
        path = input().strip()
        if not path:
            break
        audio_files.append(path)

    if not audio_files:
        print("❌ 未输入音频文件")
        return

    try:
        records = processor.process_batch(
            audio_files, student_id, checkin_date,
            is_makeup, original_date, makeup_reason
        )
        print(f"\n✅ 批量处理完成！成功 {len(records)} 个")
        for record in records:
            status = "⚠️ 异常" if record.abnormal_types else "✅ 正常"
            print(f"  {record.audio.file_name}: {status}")
    except Exception as e:
        print(f"❌ 批量处理失败: {e}")


def merge_duplicates_interactive(processor: CheckinProcessor):
    print("\n【合并重复记录】")
    date_filter = input("指定日期 (回车=全部): ").strip() or None

    summary = processor.merge_duplicates(date_filter)

    print(f"\n合并完成:")
    print(f"  重复组: {summary['total_duplicate_groups']}")
    print(f"  合并记录: {summary['total_merged_records']}")
    print(f"  剩余记录: {summary['remaining_records']}")

    if summary['details']:
        print("\n详细信息:")
        for detail in summary['details']:
            print(f"  {detail}")


def add_comment_interactive(processor: CheckinProcessor):
    print("\n【添加点评】")
    record_id = input("记录ID: ").strip()
    teacher = input("老师姓名: ").strip()
    content = input("点评内容: ").strip()

    try:
        comment = processor.add_comment(record_id, teacher, content)
        print(f"\n✅ 点评添加成功！")
        print(f"点评ID: {comment.comment_id}")
    except Exception as e:
        print(f"❌ 添加失败: {e}")


def list_records_interactive(processor: CheckinProcessor):
    print("\n【记录列表】")
    date_filter = input("日期筛选 (回车=全部): ").strip() or None
    student_filter = input("学生ID筛选 (回车=全部): ").strip() or None
    abnormal_only = input("只看异常? (y/N): ").strip().lower() == "y"

    records = processor.list_records(date_filter, abnormal_only, student_filter)

    if not records:
        print("暂无记录")
        return

    print(f"\n共 {len(records)} 条记录:")
    for i, r in enumerate(records, 1):
        student = processor._find_student(r.student_id)
        name = student.name if student else "未知"
        status = "⚠️ 异常" if r.abnormal_types else "✅ 正常"
        makeup = " [补录]" if r.makeup.is_makeup else ""
        print(
            f"{i:2d}. [{r.record_id[:8]}] {name} - {r.checkin_date} "
            f"{r.checkin_time}: {r.audio.duration_seconds}秒 {status}{makeup}"
        )
        if r.abnormal_details:
            for detail in r.abnormal_details[:2]:
                print(f"     - {detail}")


def show_pipeline_interactive(processor: CheckinProcessor):
    print("\n【处理流水线】")
    record_id = input("记录ID: ").strip()

    result = processor.show_pipeline(record_id)
    print("\n" + result)


def generate_report_interactive(processor: CheckinProcessor):
    print("\n【生成日报】")
    report_date = input("日期 (回车=今天): ").strip() or None
    fmt = input("格式 (text/json/csv, 默认text): ").strip() or "text"

    report = processor.generate_report(report_date, fmt)
    print("\n" + report)


def generate_student_report_interactive(processor: CheckinProcessor):
    print("\n【学生报告】")
    student_id = input("学生ID: ").strip()
    start_date = input("开始日期 (回车=不限): ").strip() or None
    end_date = input("结束日期 (回车=不限): ").strip() or None

    report = processor.generate_student_report(student_id, start_date, end_date)
    print("\n" + report)


def list_students_interactive(processor: CheckinProcessor):
    print("\n【学生名单】")
    students = processor.list_students()

    if not students:
        print("暂无学生")
        return

    print(f"\n共 {len(students)} 名学生:")
    for s in students:
        print(f"  [{s.student_id}] {s.name} - {s.level}级 - {s.teacher}老师")


def list_uncommented_interactive(processor: CheckinProcessor):
    print("\n【待点评记录】")
    date_filter = input("日期筛选 (回车=全部): ").strip() or None
    abnormal_only = input("只看异常? (y/N): ").strip().lower() == "y"

    records = processor.comment_tracker.get_uncommented_records(
        date_filter, abnormal_only
    )

    if not records:
        print("太棒了！所有记录都已点评")
        return

    print(f"\n共 {len(records)} 条待点评:")
    for i, r in enumerate(records, 1):
        student = processor._find_student(r.student_id)
        name = student.name if student else "未知"
        status = "⚠️ 异常" if r.abnormal_types else "✅ 正常"
        print(
            f"{i:2d}. [{r.record_id[:8]}] {name} - "
            f"{r.checkin_date} {r.checkin_time} {status}"
        )


def main():
    parser = argparse.ArgumentParser(
        description="🎹 练琴打卡异常处理系统"
    )

    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="进入交互模式"
    )

    parser.add_argument(
        "--process",
        nargs="+",
        metavar=("AUDIO", "STUDENT"),
        help="处理音频文件: --process <audio_file> <student_id> [options]"
    )

    parser.add_argument(
        "--date",
        help="打卡日期 (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--makeup",
        action="store_true",
        help="标记为补录"
    )

    parser.add_argument(
        "--original-date",
        help="原打卡日期 (补录时使用)"
    )

    parser.add_argument(
        "--reason",
        help="补录理由"
    )

    parser.add_argument(
        "--merge",
        metavar="DATE",
        nargs="?",
        const="all",
        help="合并重复记录，可指定日期"
    )

    parser.add_argument(
        "--report",
        metavar="DATE",
        nargs="?",
        const="today",
        help="生成日报，可指定日期"
    )

    parser.add_argument(
        "--report-format",
        default="text",
        choices=["text", "json", "csv"],
        help="报告格式 (默认: text)"
    )

    parser.add_argument(
        "--student-report",
        metavar="STUDENT_ID",
        help="生成学生报告"
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="列出记录"
    )

    parser.add_argument(
        "--abnormal-only",
        action="store_true",
        help="只显示异常记录"
    )

    parser.add_argument(
        "--pipeline",
        metavar="RECORD_ID",
        help="查看记录处理流水线"
    )

    parser.add_argument(
        "--students",
        action="store_true",
        help="列出学生名单"
    )

    args = parser.parse_args()

    if len(sys.argv) == 1 or args.interactive:
        interactive_mode()
        return

    processor = CheckinProcessor()

    if args.process:
        if len(args.process) < 2:
            print("❌ 请提供音频文件和学生ID")
            sys.exit(1)
        audio_path = args.process[0]
        student_id = args.process[1]

        try:
            record = processor.process_audio(
                audio_path, student_id, args.date,
                args.makeup, args.original_date, args.reason
            )
            print(f"✅ 处理完成！记录ID: {record.record_id}")
            print(f"状态: {record.status.value}")
            if record.abnormal_types:
                print(f"⚠️  异常项:")
                for detail in record.abnormal_details:
                    print(f"   - {detail}")
        except Exception as e:
            print(f"❌ 处理失败: {e}", file=sys.stderr)
            sys.exit(1)

    if args.merge:
        date_filter = None if args.merge == "all" else args.merge
        summary = processor.merge_duplicates(date_filter)
        print(f"✅ 合并完成: 重复组{summary['total_duplicate_groups']}, "
              f"合并{summary['total_merged_records']}条")

    if args.report:
        report_date = None if args.report == "today" else args.report
        report = processor.generate_report(report_date, args.report_format)
        print(report)

    if args.student_report:
        report = processor.generate_student_report(args.student_report)
        print(report)

    if args.list:
        records = processor.list_records(args.date, args.abnormal_only)
        for r in records:
            student = processor._find_student(r.student_id)
            name = student.name if student else "未知"
            status = "异常" if r.abnormal_types else "正常"
            print(f"[{r.record_id[:8]}] {name} - {r.checkin_date} "
                  f"{r.checkin_time}: {status}")

    if args.pipeline:
        result = processor.show_pipeline(args.pipeline)
        print(result)

    if args.students:
        for s in processor.list_students():
            print(f"[{s.student_id}] {s.name} - {s.level}级 - {s.teacher}")


if __name__ == "__main__":
    main()
