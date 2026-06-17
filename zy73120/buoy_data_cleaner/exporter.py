import os
import csv
import shutil
from datetime import datetime
from typing import List, Optional
from .models import BuoyRecord, DuplicateIssue


class Exporter:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir

    def export(
        self,
        output_dir: str,
        status_filter: Optional[List[str]] = None,
        batch_filter: Optional[str] = None,
        operator: str = "system",
    ) -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        pkg_dir = os.path.join(output_dir, f"浮标海况数据导出_{ts}")
        os.makedirs(pkg_dir, exist_ok=True)

        records_path = os.path.join(self.data_dir, "records.csv")
        duplicates_path = os.path.join(self.data_dir, "duplicate_issues.csv")
        audit_path = os.path.join(self.data_dir, "audit_logs.csv")

        with open(records_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            fieldnames = reader.fieldnames or BuoyRecord.fieldnames()

        total = len(rows)
        filtered = []
        for r in rows:
            if status_filter and r.get("status", "") not in status_filter:
                continue
            if batch_filter and r.get("import_batch", "") != batch_filter:
                continue
            filtered.append(r)

        out_records = os.path.join(pkg_dir, "清洗后数据.csv")
        with open(out_records, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in filtered:
                writer.writerow(r)

        if os.path.exists(duplicates_path):
            shutil.copy(duplicates_path, os.path.join(pkg_dir, "采样瓶重复待确认.csv"))
        if os.path.exists(audit_path):
            shutil.copy(audit_path, os.path.join(pkg_dir, "人工确认变更日志.csv"))

        note_lines = [
            "浮标海况数据清洗 —— 导出筛选口径说明",
            "=" * 40,
            f"导出时间: {datetime.now().isoformat(timespec='seconds')}",
            f"操作人: {operator}",
            f"原始记录总数: {total}",
            f"本次导出记录数: {len(filtered)}",
        ]
        if status_filter:
            note_lines.append(f"状态筛选: {', '.join(status_filter)}")
        else:
            note_lines.append("状态筛选: 未限定（全部状态）")
        if batch_filter:
            note_lines.append(f"导入批次筛选: {batch_filter}")
        else:
            note_lines.append("导入批次筛选: 未限定（全部批次）")
        note_lines.append("")
        note_lines.append("说明:")
        note_lines.append("1. 清洗后数据.csv 中的经纬度标准化列(latitude_std/longitude_std)")
        note_lines.append("   与屏幕显示数值一致，均为十进制六小数精度。")
        note_lines.append("2. 采样瓶重复待确认.csv 列出所有重复采样瓶及受影响记录ID，")
        note_lines.append("   未在人工确认前视为正常结果。")
        note_lines.append("3. 人工确认变更日志.csv 记录每次确认前后的状态、人工备注及原因，")
        note_lines.append("   作为审计依据，不依赖人工回忆。")
        note_lines.append("")
        with open(os.path.join(pkg_dir, "导出筛选口径说明.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(note_lines))

        return pkg_dir
