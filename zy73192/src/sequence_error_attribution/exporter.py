import os
import csv
from typing import List
import pandas as pd

from .config import DEFAULT_CONFIG, STABLE_MESSAGES, AttributionConfig
from .models import QuestionRecord, AttributionResult


class ResultExporter:
    """结果导出器，生成CSV明细和交接报告"""

    def __init__(self, config: AttributionConfig = DEFAULT_CONFIG):
        self.config = config
        self.output_columns = config.output_columns

    def export_to_csv(
        self,
        records: List[QuestionRecord],
        output_path: str,
        include_raw_data: bool = True
    ) -> str:
        """
        导出结果到CSV文件
        返回: 输出文件绝对路径
        """
        output_dir = os.path.dirname(os.path.abspath(output_path))
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        output_data = []
        for record in records:
            row_data = record.to_output_dict()

            filtered_row = {}
            for col in self.output_columns:
                if col in row_data:
                    filtered_row[col] = row_data[col]
                else:
                    filtered_row[col] = ""

            if include_raw_data:
                filtered_row["question_content"] = record.question_content
                filtered_row["sequence_type"] = record.sequence_type
                filtered_row["given_terms"] = record.given_terms
                filtered_row["recurrence_formula"] = record.recurrence_formula
                filtered_row["student_answer"] = record.student_answer
                filtered_row["correct_answer"] = record.correct_answer
                filtered_row["error_type"] = record.error_type

            output_data.append(filtered_row)

        df = pd.DataFrame(output_data)

        if include_raw_data:
            final_columns = self.output_columns + [
                "question_content",
                "sequence_type",
                "given_terms",
                "recurrence_formula",
                "student_answer",
                "correct_answer",
                "error_type",
            ]
        else:
            final_columns = self.output_columns

        df = df[final_columns]
        df.to_csv(output_path, index=False, encoding="utf-8-sig", quoting=csv.QUOTE_ALL)

        return os.path.abspath(output_path)

    def export_summary_report(
        self,
        result: AttributionResult,
        output_path: str
    ) -> str:
        """
        导出汇总报告到文本文件
        返回: 输出文件绝对路径
        """
        output_dir = os.path.dirname(os.path.abspath(output_path))
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        report_content = result.generate_summary()

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report_content)

        return os.path.abspath(output_path)

    def export_handover_package(
        self,
        records: List[QuestionRecord],
        output_dir: str,
        base_filename: str = "sequence_error_attribution"
    ) -> AttributionResult:
        """
        导出完整交接包，包含CSV明细和汇总报告
        返回: 归因结果对象
        """
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        csv_path = os.path.join(output_dir, f"{base_filename}_details.csv")
        report_path = os.path.join(output_dir, f"{base_filename}_report.txt")

        abs_csv_path = self.export_to_csv(records, csv_path)

        result = AttributionResult(
            total_records=len(records),
            success_count=sum(1 for r in records if r.processing_status == STABLE_MESSAGES.STATUS_SUCCESS),
            review_count=sum(1 for r in records if r.processing_status == STABLE_MESSAGES.STATUS_NEEDS_REVIEW),
            failed_count=sum(1 for r in records if r.processing_status == STABLE_MESSAGES.STATUS_FAILED),
            jump_count=sum(1 for r in records if r.jump_detected),
            records=records,
            output_file=abs_csv_path,
        )

        abs_report_path = self.export_summary_report(result, report_path)

        return result

    def print_console_summary(self, result: AttributionResult) -> None:
        """在控制台打印汇总信息"""
        print("\n" + "=" * 60)
        print("数列递推错题归因分析 - 处理完成")
        print("=" * 60)
        print(f"  总记录数:    {result.total_records}")
        print(f"  处理完成:    {result.success_count}")
        print(f"  待复核:      {result.review_count}")
        print(f"  处理失败:    {result.failed_count}")
        print(f"  检测到跳变:  {result.jump_count}")
        print()
        print(f"  CSV明细文件: {result.output_file}")
        print(f"  汇总报告:    {result.output_file.replace('_details.csv', '_report.txt')}")
        print()

        if result.review_count > 0:
            print("【重要】以下记录需要数学老师老叶人工复核:")
            for i, rec in enumerate([r for r in result.records if r.needs_review], 1):
                print(f"  {i}. [{rec.source_location}] {rec.question_id}")
                print(f"     原因: {rec.review_reason}")
            print()

        if result.jump_count > 0:
            print("【注意】检测到结果跳变的记录:")
            for i, rec in enumerate([r for r in result.records if r.jump_detected], 1):
                print(f"  {i}. [{rec.source_location}] {rec.question_id}")
                print(f"     原因: {rec.jump_reason}")
            print()

        print("交接说明:")
        print("  1. 打开CSV明细文件查看完整数据")
        print("  2. source_location字段可直接定位原始题目位置（文件名:行号）")
        print("  3. needs_review=TRUE的记录需优先处理")
        print("  4. review_reason字段说明了需要复核的具体原因")
        print("  5. processing_log字段记录了完整处理过程，便于追溯")
        print("=" * 60 + "\n")
