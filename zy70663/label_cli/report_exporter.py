import pandas as pd
from datetime import datetime
from typing import List, Dict
import os
from .data_reader import LabelRecord
from .duplicate_detector import Conflict


class ReportExporter:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def export_mapping_report(self, records: List[LabelRecord], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"label_mapping_{timestamp}.csv"

        filepath = os.path.join(self.output_dir, filename)

        data = []
        for record in records:
            data.append({
                "old_label": record.old_label,
                "sku": record.sku,
                "location": record.location,
                "batch": record.batch,
                "new_label": record.new_label,
                "print_status": record.print_status,
                "is_valid": record.is_valid,
                "errors": "; ".join(record.error_messages)
            })

        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')

        return filepath

    def export_print_list(self, records: List[LabelRecord], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"print_list_{timestamp}.csv"

        filepath = os.path.join(self.output_dir, filename)

        pending_records = [r for r in records if r.is_valid and r.print_status != "printed"]

        data = []
        for idx, record in enumerate(pending_records, 1):
            data.append({
                "print_order": idx,
                "new_label": record.new_label,
                "sku": record.sku,
                "location": record.location,
                "batch": record.batch,
                "old_label": record.old_label
            })

        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')

        return filepath

    def export_conflict_report(self, conflicts: List[Conflict], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"conflict_report_{timestamp}.csv"

        filepath = os.path.join(self.output_dir, filename)

        data = []
        for conflict in conflicts:
            data.append({
                "conflict_type": conflict.conflict_type,
                "old_label": conflict.old_label,
                "conflicting_with": conflict.conflicting_with,
                "message": conflict.message
            })

        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')

        return filepath

    def export_human_readable_report(self, records: List[LabelRecord], 
                                      conflicts: List[Conflict],
                                      filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"summary_report_{timestamp}.txt"

        filepath = os.path.join(self.output_dir, filename)

        total_records = len(records)
        valid_records = sum(1 for r in records if r.is_valid)
        invalid_records = total_records - valid_records
        printed_records = sum(1 for r in records if r.print_status == "printed")
        pending_records = sum(1 for r in records if r.print_status == "pending")
        failed_records = sum(1 for r in records if r.print_status == "failed")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("       标签重打旧新映射排查报告\n")
            f.write("=" * 60 + "\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("【统计概览】\n")
            f.write(f"  总记录数: {total_records}\n")
            f.write(f"  有效记录: {valid_records}\n")
            f.write(f"  无效记录: {invalid_records}\n")
            f.write(f"  已打印: {printed_records}\n")
            f.write(f"  待打印: {pending_records}\n")
            f.write(f"  打印失败: {failed_records}\n\n")

            if conflicts:
                f.write("【冲突详情】\n")
                for idx, conflict in enumerate(conflicts, 1):
                    f.write(f"  {idx}. {conflict.message}\n")
                f.write("\n")

            f.write("【映射详情】\n")
            for record in records:
                status_mark = "✓" if record.is_valid else "✗"
                f.write(f"  {status_mark} {record.old_label} -> {record.new_label}\n")
                if record.error_messages:
                    for err in record.error_messages:
                        f.write(f"      ! {err}\n")

            f.write("\n" + "=" * 60 + "\n")

        return filepath

    def export_all(self, records: List[LabelRecord], conflicts: List[Conflict]) -> Dict[str, str]:
        return {
            "mapping_report": self.export_mapping_report(records),
            "print_list": self.export_print_list(records),
            "conflict_report": self.export_conflict_report(conflicts),
            "summary_report": self.export_human_readable_report(records, conflicts)
        }
