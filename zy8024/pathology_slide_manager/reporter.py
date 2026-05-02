import csv
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from models import Slide, BorrowRecord, SlideStatus


class ReportGenerator:
    def __init__(self, db):
        self.db = db

    def generate_handover_markdown(self, records: List[BorrowRecord] = None,
                                  title: str = "切片交接报告",
                                  output_path: str = None) -> str:
        if records is None:
            records = self.db.get_borrow_records(status=SlideStatus.RETURNED)

        today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        md_lines = [
            f"# {title}",
            "",
            f"**生成时间**: {today}",
            "",
            f"**报告类型**: 切片交接清单",
            "",
            "---",
            "",
            "## 基本统计",
            "",
        ]

        stats = self._calculate_stats(records)
        md_lines.extend([
            f"- 总交接记录: {stats['total']} 条",
            f"- 按时归还: {stats['on_time']} 条",
            f"- 逾期归还: {stats['overdue']} 条",
            f"- 涉及切片数: {stats['unique_slides']} 个",
            "",
            "---",
            "",
            "## 交接明细",
            "",
            "| 序号 | 记录ID | 切片ID | 患者ID | 借阅人 | 借阅部门 | 借阅日期 | 应还日期 | 实还日期 | 状态 | 备注 |",
            "|------|--------|--------|--------|--------|----------|----------|----------|--------|------|------|"
        ])

        for idx, record in enumerate(records, 1):
            slide = self.db.get_slide(record.slide_id)
            patient_id = slide.patient_id if slide else "未知"
            status_icon = "✅" if record.status == SlideStatus.RETURNED else "⚠️"
            overdue = self._check_overdue(record)
            status_text = f"{status_icon} {record.status.value}"
            if overdue:
                days = (datetime.strptime(record.actual_return_date, "%Y-%m-%d") -
                       datetime.strptime(record.expected_return_date, "%Y-%m-%d")).days
                status_text += f" (逾期{days}天)"

            md_lines.append(
                f"| {idx} | {record.record_id} | {record.slide_id} | {patient_id} | "
                f"{record.borrower_name} | {record.borrower_dept} | {record.borrow_date} | "
                f"{record.expected_return_date} | {record.actual_return_date or '-'} | "
                f"{status_text} | {record.notes or '-'} |"
            )

        md_lines.extend(["", "---", "", "## 逾期切片清单", ""])

        overdue_records = [r for r in records if self._check_overdue(r)]
        if overdue_records:
            md_lines.append("| 切片ID | 患者ID | 借阅人 | 借阅部门 | 借阅日期 | 应还日期 | 逾期天数 |")
            md_lines.append("|--------|--------|--------|----------|----------|----------|----------|")
            for record in overdue_records:
                slide = self.db.get_slide(record.slide_id)
                days = (datetime.strptime(record.actual_return_date, "%Y-%m-%d") -
                       datetime.strptime(record.expected_return_date, "%Y-%m-%d")).days
                md_lines.append(
                    f"| {record.slide_id} | {slide.patient_id if slide else '未知'} | "
                    f"{record.borrower_name} | {record.borrower_dept} | "
                    f"{record.borrow_date} | {record.expected_return_date} | {days}天 |"
                )
        else:
            md_lines.append("*暂无逾期记录*")

        md_lines.extend(["", "---", "", f"**报告生成时间**: {today}"])

        content = "\n".join(md_lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

        return content

    def generate_handover_csv(self, records: List[BorrowRecord] = None,
                            output_path: str = None) -> str:
        if records is None:
            records = self.db.get_borrow_records(status=SlideStatus.RETURNED)

        headers = ['序号', '记录ID', '切片ID', '患者ID', '借阅人', '借阅部门',
                   '借阅日期', '应还日期', '实还日期', '状态', '逾期天数', '备注']

        rows = []
        for idx, record in enumerate(records, 1):
            slide = self.db.get_slide(record.slide_id)
            patient_id = slide.patient_id if slide else "未知"
            overdue_days = 0
            if self._check_overdue(record) and record.actual_return_date:
                days = (datetime.strptime(record.actual_return_date, "%Y-%m-%d") -
                       datetime.strptime(record.expected_return_date, "%Y-%m-%d")).days
                overdue_days = days

            rows.append([
                idx, record.record_id, record.slide_id, patient_id,
                record.borrower_name, record.borrower_dept,
                record.borrow_date, record.expected_return_date,
                record.actual_return_date or '', record.status.value,
                overdue_days, record.notes or ''
            ])

        content = self._to_csv_string(headers, rows)

        if output_path:
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                f.write(content)

        return content

    def generate_overdue_report_markdown(self, output_path: str = None) -> str:
        overdue_records = self.db.get_overdue_records()

        today = datetime.now().strftime("%Y-%m-%d")
        md_lines = [
            "# 切片逾期报告",
            "",
            f"**生成时间**: {today}",
            "",
            f"**逾期记录数**: {len(overdue_records)} 条",
            "",
            "---",
            "",
            "## 逾期明细",
            ""
        ]

        if overdue_records:
            md_lines.extend([
                "| 切片ID | 患者ID | 借阅人 | 部门 | 借阅日期 | 应还日期 | 逾期天数 |",
                "|--------|--------|--------|------|----------|----------|----------|"
            ])

            for record in overdue_records:
                slide = self.db.get_slide(record.slide_id)
                overdue_days = (datetime.now() - datetime.strptime(
                    record.expected_return_date, "%Y-%m-%d")).days
                md_lines.append(
                    f"| {record.slide_id} | {slide.patient_id if slide else '未知'} | "
                    f"{record.borrower_name} | {record.borrower_dept} | "
                    f"{record.borrow_date} | {record.expected_return_date} | {overdue_days}天 |"
                )
        else:
            md_lines.append("*暂无逾期记录*")

        content = "\n".join(md_lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

        return content

    def generate_inventory_report_markdown(self, output_path: str = None) -> str:
        slides = self.db.get_all_slides()
        stats = self.db.get_statistics()

        today = datetime.now().strftime("%Y-%m-%d")
        md_lines = [
            "# 切片库存报告",
            "",
            f"**生成时间**: {today}",
            "",
            "---",
            "",
            "## 库存统计",
            "",
            f"- 切片总数: {stats['total_slides']}",
            f"- 在库: {stats['available']}",
            f"- 已借出: {stats['borrowed']}",
            f"- 逾期: {stats['overdue']}",
            "",
            "---",
            "",
            "## 库存明细",
            ""
        ]

        if slides:
            md_lines.extend([
                "| 切片ID | 患者ID | 类型 | 科室 | 存放位置 | 状态 | 备注 |",
                "|--------|--------|------|------|----------|------|------|"
            ])

            for slide in slides:
                status_icon = {"在库": "📦", "已借出": "📤", "已归还": "✅",
                              "逾期": "⚠️", "丢失": "❌"}.get(slide.status.value, "")
                md_lines.append(
                    f"| {slide.slide_id} | {slide.patient_id} | {slide.specimen_type} | "
                    f"{slide.department} | {slide.storage_location} | "
                    f"{status_icon} {slide.status.value} | {slide.notes or '-'} |"
                )
        else:
            md_lines.append("*暂无切片数据*")

        content = "\n".join(md_lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

        return content

    def generate_borrow_history_markdown(self, slide_id: str = None,
                                        output_path: str = None) -> str:
        if slide_id:
            records = self.db.get_borrow_records(slide_id=slide_id)
            slide = self.db.get_slide(slide_id)
            title = f"切片 {slide_id} 借阅历史"
            subtitle = f"患者ID: {slide.patient_id if slide else '未知'}" if slide else ""
        else:
            records = self.db.get_borrow_records()
            title = "全部借阅记录"
            subtitle = ""

        today = datetime.now().strftime("%Y-%m-%d")
        md_lines = [
            f"# {title}",
            "",
            f"**生成时间**: {today}",
            f"**总记录数**: {len(records)}",
        ]

        if subtitle:
            md_lines.append(f"**{subtitle}**")

        md_lines.extend(["", "---", ""])

        if records:
            md_lines.extend([
                "| 记录ID | 借阅人 | 部门 | 借阅日期 | 应还日期 | 实还日期 | 状态 | 确认人 |",
                "|--------|--------|------|----------|----------|----------|------|--------|"
            ])

            for record in records:
                md_lines.append(
                    f"| {record.record_id} | {record.borrower_name} | {record.borrower_dept} | "
                    f"{record.borrow_date} | {record.expected_return_date} | "
                    f"{record.actual_return_date or '-'} | {record.status.value} | "
                    f"{record.confirmed_by or '-'} |"
                )
        else:
            md_lines.append("*暂无借阅记录*")

        content = "\n".join(md_lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

        return content

    def _calculate_stats(self, records: List[BorrowRecord]) -> Dict:
        stats = {
            'total': len(records),
            'on_time': 0,
            'overdue': 0,
            'unique_slides': len(set(r.slide_id for r in records))
        }

        for record in records:
            if record.actual_return_date:
                if record.actual_return_date <= record.expected_return_date:
                    stats['on_time'] += 1
                else:
                    stats['overdue'] += 1

        return stats

    def _check_overdue(self, record: BorrowRecord) -> bool:
        if not record.actual_return_date:
            return False
        return record.actual_return_date > record.expected_return_date

    def _to_csv_string(self, headers: List[str], rows: List[List]) -> str:
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        return output.getvalue()
