import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict
from ..models import VerificationResult, ParsedData, BadRecord
from ..utils import BadRecordReporter, SourceTracker


class TextReportGenerator:
    @staticmethod
    def generate_summary(summary: dict) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("  器材借还复核汇总报告")
        lines.append(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"总借用单数: {summary['total_orders']}")
        lines.append(f"已完成复核: {summary['complete_orders']}")
        lines.append(f"待处理: {summary['pending_orders']}")
        lines.append(f"有问题订单: {summary['orders_with_issues']}")
        lines.append(f"数据错误记录: {summary['bad_records_count']}")
        lines.append("")
        lines.append(f"押金总额: ¥{summary['total_deposit']:.2f}")
        lines.append(f"扣款总额: ¥{summary['total_deductions']:.2f}")
        lines.append(f"应退押金: ¥{summary['total_refund']:.2f}")
        lines.append("")
        return "\n".join(lines)

    @staticmethod
    def generate_detail_result(result: VerificationResult) -> str:
        lines = []
        lines.append("-" * 50)
        lines.append(f"借用单ID: {result.order_id}")
        lines.append(f"借用人: {result.borrower_name}")
        lines.append(f"器材: {result.equipment_name}")
        lines.append(f"状态: {'已完成' if result.is_complete else '待处理'}")
        lines.append("")

        if result.equipment_discrepancies:
            lines.append("  器材问题:")
            for issue in result.equipment_discrepancies:
                lines.append(f"    - {issue}")
        else:
            lines.append("  器材状态: 正常")

        if result.accessory_discrepancies:
            lines.append("")
            lines.append("  配件差异:")
            for disc in result.accessory_discrepancies:
                status = "缺少" if disc.difference < 0 else "多余"
                lines.append(
                    f"    - {disc.accessory_name}({disc.accessory_id}): "
                    f"应有{disc.expected_quantity}, "
                    f"实有{disc.returned_quantity}, "
                    f"{status}{abs(disc.difference)}件 "
                    f"(损失¥{disc.total_loss:.2f})"
                )

        if result.overdue_record:
            lines.append("")
            lines.append("  逾期记录:")
            lines.append(
                f"    - 应归还: {result.overdue_record.expected_return_date}, "
                f"实归还: {result.overdue_record.actual_return_date}, "
                f"逾期{result.overdue_record.overdue_days}天, "
                f"逾期费¥{result.overdue_record.overdue_fee:.2f}"
            )

        if result.approved_deductions:
            lines.append("")
            lines.append("  已批准扣款:")
            for ded in result.approved_deductions:
                lines.append(
                    f"    - {ded.deduction_type}: ¥{ded.amount:.2f} ({ded.reason})"
                )

        if result.pending_deductions:
            lines.append("")
            lines.append("  待审批扣款:")
            for ded in result.pending_deductions:
                lines.append(
                    f"    - {ded.deduction_type}: ¥{ded.amount:.2f} ({ded.reason})"
                )

        lines.append("")
        lines.append(f"  押金: ¥{result.total_deposit:.2f}")
        lines.append(f"  扣款合计: ¥{result.total_deductions:.2f}")
        lines.append(f"  应退押金: ¥{result.refund_amount:.2f}")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def generate_full_report(
        results: List[VerificationResult],
        summary: dict,
        bad_records: List[BadRecord],
    ) -> str:
        content = TextReportGenerator.generate_summary(summary)

        content += "\n" + "=" * 60 + "\n"
        content += "  详细复核结果\n"
        content += "=" * 60 + "\n\n"

        for result in sorted(results, key=lambda x: x.order_id):
            content += TextReportGenerator.generate_detail_result(result)

        if bad_records:
            content += "\n" + "=" * 60 + "\n"
            content += "  数据错误记录\n"
            content += "=" * 60 + "\n"
            content += BadRecordReporter.format_bad_records(bad_records)

        return content


class CSVReportGenerator:
    @staticmethod
    def generate_summary_csv(summary: dict, output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["指标", "数值"])
            writer.writerow(["总借用单数", summary["total_orders"]])
            writer.writerow(["已完成复核", summary["complete_orders"]])
            writer.writerow(["待处理", summary["pending_orders"]])
            writer.writerow(["有问题订单", summary["orders_with_issues"]])
            writer.writerow(["数据错误记录", summary["bad_records_count"]])
            writer.writerow(["押金总额", f"{summary['total_deposit']:.2f}"])
            writer.writerow(["扣款总额", f"{summary['total_deductions']:.2f}"])
            writer.writerow(["应退押金", f"{summary['total_refund']:.2f}"])

    @staticmethod
    def generate_results_csv(results: List[VerificationResult], output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "借用单ID",
                "借用人",
                "器材",
                "状态",
                "器材问题",
                "配件差异数量",
                "是否逾期",
                "逾期天数",
                "已批准扣款金额",
                "待审批扣款数量",
                "押金",
                "扣款合计",
                "应退押金",
            ])

            for result in sorted(results, key=lambda x: x.order_id):
                equipment_issues = "; ".join(result.equipment_discrepancies) if result.equipment_discrepancies else ""
                accessory_diff_count = len(result.accessory_discrepancies)
                is_overdue = "是" if result.overdue_record else "否"
                overdue_days = result.overdue_record.overdue_days if result.overdue_record else 0
                approved_amount = sum(d.amount for d in result.approved_deductions)
                pending_count = len(result.pending_deductions)
                status = "已完成" if result.is_complete else "待处理"

                writer.writerow([
                    result.order_id,
                    result.borrower_name,
                    result.equipment_name,
                    status,
                    equipment_issues,
                    accessory_diff_count,
                    is_overdue,
                    overdue_days,
                    f"{approved_amount:.2f}",
                    pending_count,
                    f"{result.total_deposit:.2f}",
                    f"{result.total_deductions:.2f}",
                    f"{result.refund_amount:.2f}",
                ])

    @staticmethod
    def generate_bad_records_csv(bad_records: List[BadRecord], output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["文件路径", "行号", "记录类型", "错误信息"])
            for record in sorted(bad_records, key=lambda x: (x.source.file_path, x.source.row_number)):
                writer.writerow([
                    record.source.file_path,
                    record.source.row_number,
                    record.record_type,
                    record.error_message,
                ])


class ReportGenerator:
    def __init__(self, results: List[VerificationResult], summary: dict, parsed_data: ParsedData):
        self.results = results
        self.summary = summary
        self.parsed_data = parsed_data

    def generate_text_report(self, output_path: str) -> None:
        content = TextReportGenerator.generate_full_report(
            self.results,
            self.summary,
            self.parsed_data.bad_records,
        )
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    def generate_csv_reports(self, output_dir: str) -> None:
        dir_path = Path(output_dir)
        dir_path.mkdir(parents=True, exist_ok=True)

        CSVReportGenerator.generate_summary_csv(
            self.summary,
            str(dir_path / "summary.csv"),
        )
        CSVReportGenerator.generate_results_csv(
            self.results,
            str(dir_path / "verification_results.csv"),
        )
        CSVReportGenerator.generate_bad_records_csv(
            self.parsed_data.bad_records,
            str(dir_path / "bad_records.csv"),
        )

    def generate_all_reports(self, output_dir: str) -> None:
        dir_path = Path(output_dir)
        dir_path.mkdir(parents=True, exist_ok=True)

        self.generate_text_report(str(dir_path / "full_report.txt"))
        self.generate_csv_reports(output_dir)
