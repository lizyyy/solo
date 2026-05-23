import csv
import json
from pathlib import Path
from datetime import datetime
from dataclasses import asdict

from .data_processor import AttendanceDataProcessor


class ReportGenerator:
    def __init__(self, processor: AttendanceDataProcessor, output_dir: str):
        self.processor = processor
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def print_terminal_summary(self):
        stats = self.processor.stats

        print(f"\n📊 数据统计")
        print(f"  课程场次: {stats['total_courses']} 场")
        print(f"  签到机记录: {stats['total_machine_records']} 条")
        print(f"  补签表记录: {stats['total_teacher_records']} 条")
        print(f"  合并后记录: {stats['total_merged_records']} 条")
        print(f"  检测到冲突: {stats['total_conflicts']} 处")

        bad_count = (
            len(self.processor.bad_rows["machine"]) +
            len(self.processor.bad_rows["teacher"]) +
            len(self.processor.bad_rows["courses"])
        )
        if bad_count > 0:
            print(f"  ⚠️  异常数据行: {bad_count} 条 (已保留)")

        print(f"\n👥 学员统计")
        print(f"  总学员数: {stats['total_students']} 人")
        print(f"  符合结业: {stats['eligible_students']} 人")
        print(f"  不符合: {stats['not_eligible_students']} 人")
        if stats['total_students'] > 0:
            rate = stats['eligible_students'] / stats['total_students'] * 100
            print(f"  通过率: {rate:.1f}%")

        if stats['total_conflicts'] > 0:
            print(f"\n⚠️  冲突详情 (前5条):")
            for i, conflict in enumerate(self.processor.conflicts[:5]):
                student = self.processor.students.get(conflict.student_id)
                name = student.student_name if student else "未知"
                print(f"  {i + 1}. {name}({conflict.student_id}) - 场次 {conflict.session_id}")
                print(f"     签到机: {conflict.machine_status} → 补签: {conflict.teacher_status} → 采用: {conflict.final_status}")

        print(f"\n📋 不符合结业学员 (前5条):")
        not_eligible = [s for s in self.processor.students.values() if not s.is_eligible]
        for i, student in enumerate(not_eligible[:5]):
            print(f"  {i + 1}. {student.student_name}({student.student_id}) - "
                  f"出勤率 {student.attendance_rate * 100:.1f}% "
                  f"({student.attended_sessions}/{student.total_sessions})")

    def generate_machine_readable_json(self):
        output_data = {
            "generated_at": datetime.now().isoformat(),
            "statistics": self.processor.stats,
            "courses": {
                course_id: asdict(course)
                for course_id, course in self.processor.courses.items()
            },
            "conflicts": [asdict(c) for c in self.processor.conflicts],
            "students": {
                student_id: asdict(student)
                for student_id, student in self.processor.students.items()
            },
            "bad_rows": self.processor.bad_rows
        }

        filepath = self.output_dir / "attendance_data.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        return filepath

    def generate_merged_records_csv(self):
        filepath = self.output_dir / "merged_attendance.csv"
        fieldnames = [
            "学员编号", "学员姓名", "场次编号", "最终状态",
            "数据来源", "时间戳", "原始行号", "备注"
        ]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for record in self.processor.merged_records:
                writer.writerow({
                    "学员编号": record.student_id,
                    "学员姓名": record.student_name,
                    "场次编号": record.session_id,
                    "最终状态": record.status,
                    "数据来源": record.source,
                    "时间戳": record.timestamp or "",
                    "原始行号": record.original_row,
                    "备注": record.notes
                })

        return filepath

    def generate_conflicts_report_csv(self):
        filepath = self.output_dir / "conflicts_report.csv"
        fieldnames = [
            "学员编号", "学员姓名", "场次编号", "签到机状态",
            "补签状态", "冲突类型", "最终状态",
            "签到机原始行", "补签表原始行"
        ]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for conflict in self.processor.conflicts:
                student = self.processor.students.get(conflict.student_id)
                name = student.student_name if student else ""
                writer.writerow({
                    "学员编号": conflict.student_id,
                    "学员姓名": name,
                    "场次编号": conflict.session_id,
                    "签到机状态": conflict.machine_status,
                    "补签状态": conflict.teacher_status,
                    "冲突类型": conflict.conflict_type,
                    "最终状态": conflict.final_status,
                    "签到机原始行": conflict.original_machine_row,
                    "补签表原始行": conflict.original_teacher_row
                })

        return filepath

    def generate_graduation_report_csv(self):
        filepath = self.output_dir / "graduation_eligibility.csv"
        fieldnames = [
            "学员编号", "学员姓名", "总场次", "出勤场次",
            "缺勤场次", "补签次数", "出勤率", "是否符合结业"
        ]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            sorted_students = sorted(
                self.processor.students.values(),
                key=lambda x: (-x.attendance_rate, x.student_id)
            )

            for student in sorted_students:
                writer.writerow({
                    "学员编号": student.student_id,
                    "学员姓名": student.student_name,
                    "总场次": student.total_sessions,
                    "出勤场次": student.attended_sessions,
                    "缺勤场次": student.absent_sessions,
                    "补签次数": student.make_up_count,
                    "出勤率": f"{student.attendance_rate * 100:.2f}%",
                    "是否符合结业": "是" if student.is_eligible else "否"
                })

        return filepath

    def generate_bad_rows_report_csv(self):
        filepath = self.output_dir / "bad_rows_report.csv"
        fieldnames = [
            "数据来源", "原始行号", "错误信息", "原始数据"
        ]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            source_names = {
                "machine": "签到机数据",
                "teacher": "补签表数据",
                "courses": "课程配置"
            }

            for source, rows in self.processor.bad_rows.items():
                for row in rows:
                    writer.writerow({
                        "数据来源": source_names.get(source, source),
                        "原始行号": row["row_num"],
                        "错误信息": row["error"],
                        "原始数据": json.dumps(row["row_data"], ensure_ascii=False)
                    })

        return filepath

    def generate_detailed_student_csv(self):
        filepath = self.output_dir / "detailed_student_attendance.csv"

        session_ids = sorted(self.processor.courses.keys())
        fieldnames = ["学员编号", "学员姓名"] + session_ids + ["出勤率", "是否符合结业"]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for student in self.processor.students.values():
                row = {
                    "学员编号": student.student_id,
                    "学员姓名": student.student_name,
                    "出勤率": f"{student.attendance_rate * 100:.2f}%",
                    "是否符合结业": "是" if student.is_eligible else "否"
                }

                for session_id in session_ids:
                    detail = student.session_details.get(session_id)
                    if detail:
                        row[session_id] = detail["status"]
                    else:
                        row[session_id] = "缺勤"

                writer.writerow(row)

        return filepath

    def generate_readable_report_md(self):
        filepath = self.output_dir / "README_考勤报告.md"
        stats = self.processor.stats

        content = []
        content.append("# 培训考勤合并报告")
        content.append("")
        content.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        content.append("")
        content.append("## 1. 数据概览")
        content.append("")
        content.append("| 项目 | 数量 |")
        content.append("|------|------|")
        content.append(f"| 课程场次 | {stats['total_courses']} 场 |")
        content.append(f"| 签到机记录 | {stats['total_machine_records']} 条 |")
        content.append(f"| 补签表记录 | {stats['total_teacher_records']} 条 |")
        content.append(f"| 合并后记录 | {stats['total_merged_records']} 条 |")
        content.append(f"| 检测到冲突 | {stats['total_conflicts']} 处 |")
        content.append("")

        bad_count = (
            len(self.processor.bad_rows["machine"]) +
            len(self.processor.bad_rows["teacher"]) +
            len(self.processor.bad_rows["courses"])
        )
        if bad_count > 0:
            content.append(f"> ⚠️  共发现 {bad_count} 条异常数据行，已在 bad_rows_report.csv 中保留原始位置和数据")
            content.append("")

        content.append("## 2. 学员结业资格统计")
        content.append("")
        content.append("| 项目 | 人数 | 占比 |")
        content.append("|------|------|------|")
        content.append(f"| 总学员数 | {stats['total_students']} 人 | 100% |")
        content.append(f"| 符合结业 | {stats['eligible_students']} 人 | "
                       f"{stats['eligible_students'] / stats['total_students'] * 100:.1f}% |")
        content.append(f"| 不符合结业 | {stats['not_eligible_students']} 人 | "
                       f"{stats['not_eligible_students'] / stats['total_students'] * 100:.1f}% |")
        content.append("")

        if stats['total_conflicts'] > 0:
            content.append("## 3. 冲突处理说明")
            content.append("")
            content.append("### 冲突处理规则")
            content.append("- 当签到机数据与老师补签表状态不一致时，**以老师补签为准**")
            content.append("- 所有冲突已在 `conflicts_report.csv` 中记录，包含原始行号便于追溯")
            content.append("")

            content.append("### 冲突列表")
            content.append("")
            content.append("| 序号 | 学员 | 场次 | 签到机 | 补签 | 最终 |")
            content.append("|------|------|------|--------|------|------|")
            for i, conflict in enumerate(self.processor.conflicts, 1):
                student = self.processor.students.get(conflict.student_id)
                name = student.student_name if student else "未知"
                content.append(f"| {i} | {name}({conflict.student_id}) | {conflict.session_id} | "
                               f"{conflict.machine_status} | {conflict.teacher_status} | {conflict.final_status} |")
            content.append("")

        content.append("## 4. 文件说明")
        content.append("")
        content.append("| 文件名 | 说明 |")
        content.append("|--------|------|")
        content.append("| `merged_attendance.csv` | 合并后的完整考勤记录 |")
        content.append("| `conflicts_report.csv` | 冲突记录及处理结果 |")
        content.append("| `graduation_eligibility.csv` | 学员结业资格汇总表 |")
        content.append("| `detailed_student_attendance.csv` | 学员各场次详细考勤 |")
        content.append("| `bad_rows_report.csv` | 异常数据行报告（保留原始位置） |")
        content.append("| `attendance_data.json` | 机器可读的完整数据（可用于程序对接） |")
        content.append("")

        content.append("## 5. 使用说明")
        content.append("")
        content.append("1. **正式确认结业资格请以 graduation_eligibility.csv 为准**")
        content.append("2. 如需核对冲突，请查看 conflicts_report.csv 中的原始行号")
        content.append("3. 异常数据已保留原始位置，建议人工核对后决定是否需要补充")
        content.append("4. JSON 文件可用于程序自动化处理或导入其他系统")
        content.append("")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("\n".join(content))

        return filepath

    def generate_all_reports(self):
        files_generated = []

        files_generated.append(self.generate_machine_readable_json())
        files_generated.append(self.generate_merged_records_csv())
        files_generated.append(self.generate_conflicts_report_csv())
        files_generated.append(self.generate_graduation_report_csv())
        files_generated.append(self.generate_detailed_student_csv())
        files_generated.append(self.generate_bad_rows_report_csv())
        files_generated.append(self.generate_readable_report_md())

        return files_generated
