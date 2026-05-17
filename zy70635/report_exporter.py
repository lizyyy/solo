from typing import List
from models import PickupReport
from rules_engine import RulesEngine


class ReportExporter:
    def export_text_report(self, reports: List[PickupReport],
                           engine: RulesEngine, filename: str):
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("           托管班接送状态日报\n")
            f.write("=" * 60 + "\n\n")

            if reports:
                report_date = reports[0].report_date
                f.write(f"报告日期: {report_date}\n")
                f.write(f"生成时间: {report_date.strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("-" * 60 + "\n")
            f.write("一、 接送明细\n")
            f.write("-" * 60 + "\n\n")

            for idx, report in enumerate(reports, 1):
                student = engine.students.get(report.student_id)
                person = engine.pickup_persons.get(report.pickup_person_id) if report.pickup_person_id else None

                student_name = student.name if student else f"未知({report.student_id})"
                person_name = person.name if person else f"未知({report.pickup_person_id})"

                f.write(f"{idx}. 学生: {student_name} (ID: {report.student_id})\n")
                f.write(f"   接送人: {person_name}\n")
                f.write(f"   接送时间: {report.pickup_time}\n")

                status = []
                if report.is_authorized:
                    status.append("✅ 授权有效")
                else:
                    status.append("❌ 授权无效")

                if report.is_late:
                    status.append(f"⏰ 迟接 (费用: ¥{report.late_fee:.2f})")

                if report.is_on_leave:
                    status.append("📋 请假中")

                f.write(f"   状态: {' | '.join(status)}\n")

                if report.notes:
                    f.write(f"   备注: {report.notes}\n")

                f.write("\n")

            f.write("-" * 60 + "\n")
            f.write("二、 统计汇总\n")
            f.write("-" * 60 + "\n\n")

            total = len(reports)
            authorized = sum(1 for r in reports if r.is_authorized)
            unauthorized = total - authorized
            late = sum(1 for r in reports if r.is_late)
            on_leave = sum(1 for r in reports if r.is_on_leave)
            total_fee = sum(r.late_fee for r in reports)

            f.write(f"总记录数: {total}\n")
            f.write(f"授权有效: {authorized}\n")
            f.write(f"授权无效: {unauthorized}\n")
            f.write(f"迟接记录: {late}\n")
            f.write(f"请假记录: {on_leave}\n")
            f.write(f"迟接费用总计: ¥{total_fee:.2f}\n\n")

            if unauthorized > 0:
                f.write("-" * 60 + "\n")
                f.write("⚠️  警告: 存在未授权接送记录!\n")
                f.write("-" * 60 + "\n\n")
                for report in reports:
                    if not report.is_authorized:
                        student = engine.students.get(report.student_id)
                        student_name = student.name if student else report.student_id
                        f.write(f"   - {student_name}: {report.notes}\n")
                f.write("\n")

            if late > 0:
                f.write("-" * 60 + "\n")
                f.write("⏰ 迟接明细:\n")
                f.write("-" * 60 + "\n\n")
                for report in reports:
                    if report.is_late:
                        student = engine.students.get(report.student_id)
                        student_name = student.name if student else report.student_id
                        f.write(f"   - {student_name}: 迟接费用 ¥{report.late_fee:.2f}\n")
                f.write("\n")

            f.write("=" * 60 + "\n")
            f.write("报告结束\n")
            f.write("=" * 60 + "\n")
