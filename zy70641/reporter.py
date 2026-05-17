import csv
import os
from datetime import datetime
from typing import Optional
from models import ReconciliationResult, MatchStatus, DiscrepancyReason
from config import AppConfig


class ReportGenerator:
    def __init__(self, config: AppConfig):
        self.config = config

    def _ensure_output_dir(self):
        os.makedirs(self.config.report.output_dir, exist_ok=True)

    def _get_filename_prefix(self) -> str:
        return f"reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def generate_csv(self, result: ReconciliationResult, filename: Optional[str] = None) -> str:
        self._ensure_output_dir()
        if not filename:
            filename = f"{self._get_filename_prefix()}.csv"
        filepath = os.path.join(self.config.report.output_dir, filename)

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["=== 对账汇总 ==="])
            writer.writerow(["收银机流水总数", result.summary.total_cash_register])
            writer.writerow(["支付平台流水总数", result.summary.total_payment_gateway])
            writer.writerow(["匹配成功", result.summary.matched_count])
            writer.writerow(["未匹配", result.summary.unmatched_count])
            writer.writerow(["重复流水", result.summary.duplicate_count])
            writer.writerow(["坏行数", result.summary.bad_row_count])
            writer.writerow(["处理时间(秒)", f"{result.summary.processing_time:.2f}"])
            writer.writerow([])

            writer.writerow(["=== 差异原因统计 ==="])
            for reason, count in result.summary.discrepancy_breakdown.items():
                writer.writerow([reason.value, count])
            writer.writerow([])

            writer.writerow(["=== 对账详情 ==="])
            headers = [
                "状态", "差异原因", "匹配置信度",
                "收银机-交易号", "收银机-门店", "收银机-金额", "收银机-时间", "收银机-类型",
                "收银机-文件", "收银机-行号",
                "支付平台-交易号", "支付平台-门店", "支付平台-金额", "支付平台-时间", "支付平台-类型",
                "支付平台-文件", "支付平台-行号",
                "备注"
            ]
            writer.writerow(headers)

            for match in result.matches:
                cash = match.cash_register_tx
                payment = match.payment_gateway_tx

                row = [
                    match.status.value,
                    match.discrepancy_reason.value if match.discrepancy_reason else "",
                    f"{match.match_confidence:.2f}" if match.match_confidence else "",
                ]

                if cash:
                    row.extend([
                        cash.transaction_id,
                        cash.store_id,
                        f"{cash.amount:.2f}",
                        cash.transaction_time.strftime("%Y-%m-%d %H:%M:%S"),
                        cash.transaction_type.value,
                        os.path.basename(cash.source.file_path),
                        cash.source.line_number
                    ])
                else:
                    row.extend(["", "", "", "", "", "", ""])

                if payment:
                    row.extend([
                        payment.transaction_id,
                        payment.store_id,
                        f"{payment.amount:.2f}",
                        payment.transaction_time.strftime("%Y-%m-%d %H:%M:%S"),
                        payment.transaction_type.value,
                        os.path.basename(payment.source.file_path),
                        payment.source.line_number
                    ])
                else:
                    row.extend(["", "", "", "", "", "", ""])

                row.append(match.notes or "")
                writer.writerow(row)

            if self.config.report.include_bad_rows and result.bad_rows:
                writer.writerow([])
                writer.writerow(["=== 坏行记录 ==="])
                writer.writerow(["文件", "行号", "原始内容"])
                for bad_row in result.bad_rows:
                    writer.writerow([
                        os.path.basename(bad_row.file_path),
                        bad_row.line_number,
                        bad_row.raw_content
                    ])

        return filepath

    def generate_markdown(self, result: ReconciliationResult, filename: Optional[str] = None) -> str:
        self._ensure_output_dir()
        if not filename:
            filename = f"{self._get_filename_prefix()}.md"
        filepath = os.path.join(self.config.report.output_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("# 收银支付对账报告\n\n")
            f.write(f"生成时间：{result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("## 对账汇总\n\n")
            f.write("| 指标 | 数值 |\n")
            f.write("|------|------|\n")
            f.write(f"| 收银机流水总数 | {result.summary.total_cash_register} |\n")
            f.write(f"| 支付平台流水总数 | {result.summary.total_payment_gateway} |\n")
            f.write(f"| 匹配成功 | {result.summary.matched_count} |\n")
            f.write(f"| 未匹配 | {result.summary.unmatched_count} |\n")
            f.write(f"| 重复流水 | {result.summary.duplicate_count} |\n")
            f.write(f"| 坏行数 | {result.summary.bad_row_count} |\n")
            f.write(f"| 处理时间 | {result.summary.processing_time:.2f} 秒 |\n\n")

            f.write("## 差异原因统计\n\n")
            f.write("| 差异原因 | 数量 |\n")
            f.write("|----------|------|\n")
            for reason, count in sorted(result.summary.discrepancy_breakdown.items(), key=lambda x: -x[1]):
                f.write(f"| {reason.value} | {count} |\n")
            f.write("\n")

            matched = [m for m in result.matches if m.status == MatchStatus.MATCHED]
            unmatched = [m for m in result.matches if m.status == MatchStatus.UNMATCHED]
            duplicates = [m for m in result.matches if m.status == MatchStatus.DUPLICATE]

            f.write("## 未匹配详情\n\n")
            if unmatched:
                f.write("| 类型 | 交易号 | 门店 | 金额 | 时间 | 文件 | 行号 | 差异原因 |\n")
                f.write("|------|--------|------|------|------|------|------|----------|\n")
                for m in unmatched:
                    tx = m.cash_register_tx or m.payment_gateway_tx
                    source = "收银机" if m.cash_register_tx else "支付平台"
                    if tx:
                        f.write((
                            f"| {source} | {tx.transaction_id} | {tx.store_id} | "
                            f"{tx.amount:.2f} | {tx.transaction_time.strftime('%Y-%m-%d %H:%M:%S')} | "
                            f"{os.path.basename(tx.source.file_path)} | {tx.source.line_number} | "
                            f"{m.discrepancy_reason.value if m.discrepancy_reason else ''} |\n"
                        ))
            else:
                f.write("无未匹配记录\n")
            f.write("\n")

            f.write("## 重复流水详情\n\n")
            if duplicates:
                f.write("| 来源 | 交易号 | 门店 | 金额 | 时间 | 文件 | 行号 |\n")
                f.write("|------|--------|------|------|------|------|------|\n")
                for m in duplicates:
                    tx = m.cash_register_tx or m.payment_gateway_tx
                    source = "收银机" if m.cash_register_tx else "支付平台"
                    if tx:
                        f.write((
                            f"| {source} | {tx.transaction_id} | {tx.store_id} | "
                            f"{tx.amount:.2f} | {tx.transaction_time.strftime('%Y-%m-%d %H:%M:%S')} | "
                            f"{os.path.basename(tx.source.file_path)} | {tx.source.line_number} |\n"
                        ))
            else:
                f.write("无重复流水记录\n")
            f.write("\n")

            if self.config.report.include_bad_rows and result.bad_rows:
                f.write("## 坏行记录\n\n")
                f.write("| 文件 | 行号 | 原始内容 |\n")
                f.write("|------|------|----------|\n")
                for bad_row in result.bad_rows:
                    content = bad_row.raw_content.replace("|", "\\|")[:100]
                    f.write(f"| {os.path.basename(bad_row.file_path)} | {bad_row.line_number} | {content} |\n")
                f.write("\n")

        return filepath

    def generate(self, result: ReconciliationResult) -> dict:
        outputs = {}
        if self.config.report.generate_csv:
            outputs["csv"] = self.generate_csv(result)
        if self.config.report.generate_markdown:
            outputs["markdown"] = self.generate_markdown(result)
        return outputs
