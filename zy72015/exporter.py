import os
import csv
from datetime import datetime
from typing import List, Dict, Optional
import pandas as pd

from models import (
    RecordStatus, DataSource, get_records_by_batch, get_batch,
    get_summary, get_discrepancy_list
)
from storage import now_str

EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports")


def _ensure_export_dir():
    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR, exist_ok=True)


def _format_record_for_export(record: Dict, include_history: bool = False) -> Dict:
    row = {
        "记录ID": record["id"],
        "批次号": record["batch_no"],
        "账期": record.get("period", ""),
        "数据来源": DataSource.SOURCE_LABELS.get(record["source"], record["source"]),
        "来源参考": record["source_ref"],
        "充电桩编号": record["pile_no"],
        "交易日期": record["transaction_date"],
        "台账应收(元)": f"{record['expected_amount']:.2f}",
        "银行实收(元)": f"{record['actual_amount']:.2f}" if record["actual_amount"] is not None else "",
        "差异金额(元)": "",
        "状态": RecordStatus.STATUS_LABELS.get(record["status"], record["status"]),
        "原始备注": record["original_remarks"],
        "处理意见": record["processing_notes"],
        "最后处理人": record["operator"],
        "创建时间": record["created_at"],
        "更新时间": record["updated_at"]
    }

    if record["actual_amount"] is not None:
        diff = record["expected_amount"] - record["actual_amount"]
        row["差异金额(元)"] = f"{diff:.2f}"

    if include_history:
        history_text = []
        for i, h in enumerate(record["processing_history"], 1):
            history_text.append(
                f"[{i}] {h['timestamp']} | {h['operator']} | {h['action']} | "
                f"原因：{h['reason']} | 备注：{h.get('notes', '')}"
            )
        row["处理历史"] = "\n".join(history_text)

    return row


def export_discrepancy_list(batch_no: Optional[str] = None, fmt: str = "csv") -> str:
    _ensure_export_dir()
    records = get_discrepancy_list(batch_no)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_suffix = f"_{batch_no}" if batch_no else ""

    if not records:
        filename = f"差异清单_无差异{batch_suffix}_{timestamp}.{fmt}"
        filepath = os.path.join(EXPORT_DIR, filename)
        with open(filepath, "w", encoding="utf-8-sig") as f:
            f.write("新能源充电桩收益归集 - 差异清单\n")
            f.write(f"生成时间：{now_str()}\n")
            f.write("当前无待确认或有差异的记录，所有记录均已处理完毕。\n")
        return filepath

    rows = [_format_record_for_export(r) for r in records]

    if fmt == "xlsx":
        filename = f"差异清单{batch_suffix}_{timestamp}.xlsx"
        filepath = os.path.join(EXPORT_DIR, filename)
        df = pd.DataFrame(rows)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="差异清单", index=False)

            worksheet = writer.sheets["差异清单"]
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if cell.value:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
    else:
        filename = f"差异清单{batch_suffix}_{timestamp}.csv"
        filepath = os.path.join(EXPORT_DIR, filename)

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    return filepath


def export_full_report(batch_no: Optional[str] = None, fmt: str = "csv") -> str:
    _ensure_export_dir()

    if batch_no:
        records = get_records_by_batch(batch_no)
        batch = get_batch(batch_no)
    else:
        from models import get_all_records
        records = get_all_records()
        batch = None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_suffix = f"_{batch_no}" if batch_no else ""
    summary = get_summary(batch_no)

    if fmt == "xlsx":
        filename = f"新能源充电桩收益归集报告{batch_suffix}_{timestamp}.xlsx"
        filepath = os.path.join(EXPORT_DIR, filename)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            summary_data = {
                "项目": [
                    "总记录数",
                    "台账应收总额(元)",
                    "银行实收总额(元)",
                    "已确认归集金额(元)",
                    "已挂起金额(元)",
                    "待确认金额(元)",
                    "待确认记录数",
                    "已确认记录数",
                    "已挂起记录数",
                    "有差异记录数"
                ],
                "数值": [
                    summary["total_count"],
                    f"{summary['total_expected']:.2f}",
                    f"{summary['total_actual']:.2f}",
                    f"{summary['confirmed_amount']:.2f}",
                    f"{summary['suspended_amount']:.2f}",
                    f"{summary['unconfirmed_amount']:.2f}",
                    summary["status_counts"].get(RecordStatus.PENDING, 0),
                    summary["status_counts"].get(RecordStatus.CONFIRMED, 0),
                    summary["status_counts"].get(RecordStatus.SUSPENDED, 0),
                    summary["status_counts"].get(RecordStatus.DISCREPANCY, 0)
                ]
            }
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name="归集汇总", index=False)

            rows = [_format_record_for_export(r, include_history=True) for r in records]
            df_records = pd.DataFrame(rows)
            df_records.to_excel(writer, sheet_name="明细记录", index=False)

            discrepancy_records = [r for r in records if r["status"] in (RecordStatus.DISCREPANCY, RecordStatus.PENDING)]
            if discrepancy_records:
                diff_rows = [_format_record_for_export(r, include_history=True) for r in discrepancy_records]
                df_diff = pd.DataFrame(diff_rows)
                df_diff.to_excel(writer, sheet_name="差异清单", index=False)

            for sheet_name in writer.sheets:
                worksheet = writer.sheets[sheet_name]
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if cell.value:
                                if len(str(cell.value)) > max_length:
                                    max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 60)
                    worksheet.column_dimensions[column_letter].width = adjusted_width

    else:
        filename = f"新能源充电桩收益归集报告{batch_suffix}_{timestamp}.csv"
        filepath = os.path.join(EXPORT_DIR, filename)

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["新能源充电桩收益归集报告"])
            writer.writerow([f"生成时间：{now_str()}"])
            if batch:
                writer.writerow([f"批次号：{batch['batch_no']}", f"账期：{batch['period']}"])
            writer.writerow([])

            writer.writerow(["一、归集汇总"])
            writer.writerow(["项目", "数值"])
            writer.writerow(["总记录数", summary["total_count"]])
            writer.writerow(["台账应收总额(元)", f"{summary['total_expected']:.2f}"])
            writer.writerow(["银行实收总额(元)", f"{summary['total_actual']:.2f}"])
            writer.writerow(["已确认归集金额(元)", f"{summary['confirmed_amount']:.2f}"])
            writer.writerow(["已挂起金额(元)", f"{summary['suspended_amount']:.2f}"])
            writer.writerow(["待确认金额(元)", f"{summary['unconfirmed_amount']:.2f}"])
            writer.writerow(["待确认记录数", summary["status_counts"].get(RecordStatus.PENDING, 0)])
            writer.writerow(["已确认记录数", summary["status_counts"].get(RecordStatus.CONFIRMED, 0)])
            writer.writerow(["已挂起记录数", summary["status_counts"].get(RecordStatus.SUSPENDED, 0)])
            writer.writerow(["有差异记录数", summary["status_counts"].get(RecordStatus.DISCREPANCY, 0)])
            writer.writerow([])

            writer.writerow(["二、明细记录（含处理历史）"])
            if records:
                rows = [_format_record_for_export(r, include_history=True) for r in records]
                dict_writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                dict_writer.writeheader()
                dict_writer.writerows(rows)
            else:
                writer.writerow(["暂无记录"])

    return filepath
