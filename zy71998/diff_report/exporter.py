import csv
import json
from typing import List, Optional
from datetime import datetime

from .models import DiffRecord, RecordStatus


class RecordExporter:
    @staticmethod
    def to_csv(records: List[DiffRecord], output_path: str) -> None:
        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "记录ID",
                    "文件路径",
                    "变更类型",
                    "状态",
                    "来源",
                    "变更单号",
                    "操作人",
                    "待处理原因",
                    "备注",
                    "MD5(前)",
                    "MD5(后)",
                    "路径含空格",
                    "文件不匹配",
                    "重复执行",
                    "创建时间",
                    "更新时间",
                ]
            )

            for r in records:
                writer.writerow(
                    [
                        r.record_id,
                        r.file_path,
                        r.diff_type.value,
                        r.status.value,
                        r.source,
                        r.change_order_id,
                        r.operator,
                        r.pending_reason,
                        r.remark,
                        r.md5_before or "",
                        r.md5_after or "",
                        "是" if r.has_path_space else "否",
                        "是" if r.file_mismatch else "否",
                        "是" if r.duplicate_exec else "否",
                        r.create_time,
                        r.update_time,
                    ]
                )

    @staticmethod
    def to_json(records: List[DiffRecord], output_path: str) -> None:
        data = [r.to_dict() for r in records]
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def generate_summary(records: List[DiffRecord]) -> str:
        total = len(records)
        status_count = {}
        type_count = {}

        for r in records:
            status_count[r.status.value] = status_count.get(r.status.value, 0) + 1
            type_count[r.diff_type.value] = type_count.get(r.diff_type.value, 0) + 1

        lines = [
            "=" * 50,
            "差异记录汇总报告",
            "=" * 50,
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"总记录数: {total}",
            "",
            "按状态统计:",
        ]

        for status, count in sorted(status_count.items()):
            lines.append(f"  {status}: {count} ({count/total*100:.1f}%)")

        lines.extend(["", "按变更类型统计:"])
        for dtype, count in sorted(type_count.items()):
            lines.append(f"  {dtype}: {count} ({count/total*100:.1f}%)")

        lines.extend(["", "=" * 50])
        return "\n".join(lines)
