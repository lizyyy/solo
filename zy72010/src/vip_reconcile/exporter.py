import os
import csv
from datetime import datetime
from typing import List, Dict
from collections import defaultdict

from .models import ReconciliationRecord, MatchStatus


class FinanceExporter:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _group_by_status(
        self, records: List[ReconciliationRecord]
    ) -> Dict[MatchStatus, List[ReconciliationRecord]]:
        grouped = defaultdict(list)
        for r in records:
            grouped[r.current_status].append(r)
        return grouped

    def _format_amount(self, amount) -> str:
        if amount is None:
            return "-"
        return f"{amount:.2f}"

    def _format_diff(self, record) -> str:
        diff = record.amount_diff
        if diff is None:
            return "-"
        if diff > 0:
            return f"+{diff:.2f}"
        return f"{diff:.2f}"

    def export_to_finance_excel(
        self, records: List[ReconciliationRecord], filename: str = None
    ) -> str:
        import pandas as pd

        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"机场贵宾券核销对账明细_{timestamp}.xlsx"

        filepath = os.path.join(self.output_dir, filename)
        grouped = self._group_by_status(records)

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            self._write_summary_sheet(writer, records)
            self._write_status_sheet(writer, grouped.get(MatchStatus.CONFIRMED, []), "已确认")
            self._write_status_sheet(writer, grouped.get(MatchStatus.PENDING_MATERIALS, []), "待补材料")
            self._write_status_sheet(writer, grouped.get(MatchStatus.MANUAL_REVIEW, []), "人工改判")
            self._write_status_sheet(writer, grouped.get(MatchStatus.CONFLICT, []), "数据冲突")
            self._write_full_history_sheet(writer, records)

        return filepath

    def _write_summary_sheet(self, writer, records: List[ReconciliationRecord]) -> None:
        import pandas as pd

        grouped = self._group_by_status(records)
        summary_data = []

        total_expected = sum(r.expected_amount for r in records)
        total_actual = sum(r.actual_amount or 0 for r in records if r.current_status == MatchStatus.CONFIRMED)

        for status in [
            MatchStatus.CONFIRMED,
            MatchStatus.PENDING_MATERIALS,
            MatchStatus.MANUAL_REVIEW,
            MatchStatus.CONFLICT,
            MatchStatus.UNMATCHED
        ]:
            count = len(grouped.get(status, []))
            amount = sum(r.expected_amount for r in grouped.get(status, []))
            summary_data.append({
                "状态": status.value,
                "笔数": count,
                "涉及金额(元)": f"{amount:.2f}",
                "占比": f"{count / len(records) * 100:.1f}%" if records else "0%"
            })

        summary_data.append({
            "状态": "合计",
            "笔数": len(records),
            "涉及金额(元)": f"{total_expected:.2f}",
            "占比": "100%"
        })

        df = pd.DataFrame(summary_data)
        df.to_excel(writer, sheet_name="对账汇总", index=False)

        worksheet = writer.sheets["对账汇总"]
        for col in worksheet.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            worksheet.column_dimensions[column].width = max_length + 2

    def _write_status_sheet(
        self, writer, records: List[ReconciliationRecord], sheet_name: str
    ) -> None:
        import pandas as pd

        if not records:
            df = pd.DataFrame(columns=["无记录"])
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            return

        data = []
        for r in records:
            latest_judgment = r.judgment_history[-1] if r.judgment_history else None
            conflict_info = ""
            if r.conflict_details:
                c = r.conflict_details
                conflict_info = (
                    f"收款流水{c['payment_amount']:.2f}元 vs "
                    f"银企回单{c['bank_amount']:.2f}元, "
                    f"差额{c['diff']:.2f}元"
                )

            row = {
                "凭证编号": r.voucher_no,
                "旅客姓名": r.passenger_name,
                "服务日期": r.service_date,
                "航班号": r.flight_no,
                "应收金额(元)": self._format_amount(r.expected_amount),
                "实收金额(元)": self._format_amount(r.actual_amount),
                "差额(元)": self._format_diff(r),
                "当前状态": r.current_status.value,
                "判断理由": latest_judgment.reason if latest_judgment else "",
                "操作人": latest_judgment.operator if latest_judgment else "",
                "判断时间": latest_judgment.timestamp.strftime("%Y-%m-%d %H:%M:%S") if latest_judgment else "",
                "证据来源": ";".join(set(e.source_file for e in r.evidence)),
                "冲突说明": conflict_info,
                "处理建议": "\n".join(r.suggestions),
                "人工备注": "\n".join(r.manual_notes)
            }
            data.append(row)

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name=sheet_name, index=False)

        worksheet = writer.sheets[sheet_name]
        for col in worksheet.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            worksheet.column_dimensions[column].width = min(max_length + 2, 50)

    def _write_full_history_sheet(self, writer, records: List[ReconciliationRecord]) -> None:
        import pandas as pd

        data = []
        for r in records:
            for i, j in enumerate(r.judgment_history):
                data.append({
                    "序号": i + 1,
                    "凭证编号": r.voucher_no,
                    "旅客姓名": r.passenger_name,
                    "变更时间": j.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "变更前状态": j.status_before.value,
                    "变更后状态": j.status_after.value,
                    "变更原因": j.reason,
                    "操作人": j.operator,
                    "关联证据": ";".join(j.evidence_refs),
                    "备注": j.note or ""
                })

        if not data:
            df = pd.DataFrame(columns=["无历史记录"])
        else:
            df = pd.DataFrame(data)

        df.to_excel(writer, sheet_name="判断历史全记录", index=False)

        worksheet = writer.sheets["判断历史全记录"]
        for col in worksheet.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            worksheet.column_dimensions[column].width = min(max_length + 2, 50)

    def export_to_csv(
        self, records: List[ReconciliationRecord], filename: str = None
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"机场贵宾券核销对账明细_{timestamp}.csv"

        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                "凭证编号", "旅客姓名", "服务日期", "航班号",
                "应收金额", "实收金额", "差额", "当前状态",
                "判断理由", "处理建议", "人工备注"
            ])

            for r in records:
                latest_judgment = r.judgment_history[-1] if r.judgment_history else None
                writer.writerow([
                    r.voucher_no,
                    r.passenger_name,
                    r.service_date,
                    r.flight_no,
                    self._format_amount(r.expected_amount),
                    self._format_amount(r.actual_amount),
                    self._format_diff(r),
                    r.current_status.value,
                    latest_judgment.reason if latest_judgment else "",
                    "\n".join(r.suggestions),
                    "\n".join(r.manual_notes)
                ])

        return filepath
