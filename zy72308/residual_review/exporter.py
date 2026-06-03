"""统一结果导出：明细、页面展示、接口返回使用同一份数据"""

import json
import csv
from pathlib import Path
from typing import Dict, Any, List

from .models import ImportRecord, RowStatus
from .storage import StorageManager


class UnifiedExporter:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def _get_unified_data(self, record: ImportRecord) -> Dict[str, Any]:
        sorted_rows = sorted(record.rows, key=lambda r: r.original_line_no)

        row_details = []
        for row in sorted_rows:
            row_details.append(
                {
                    "原始行号": row.original_line_no,
                    "当前行号": row.current_line_no,
                    "X值": row.x_value,
                    "Y值": row.y_value,
                    "预测值": round(row.predicted, 4) if row.predicted else None,
                    "残差": round(row.residual, 4) if row.residual else None,
                    "状态": row.status.value,
                    "删除时间": row.deleted_at.isoformat() if row.deleted_at else None,
                    "补录时间": row.supplemented_at.isoformat() if row.supplemented_at else None,
                    "备注": row.notes,
                }
            )

        gap_rows = [r for r in sorted_rows if r.status == RowStatus.GAP]
        normal_rows = [r for r in sorted_rows if r.status in [RowStatus.NORMAL, RowStatus.SUPPLEMENTED]]

        return {
            "导入ID": record.import_id,
            "导入时间": record.import_time.isoformat(),
            "源文件": record.source_file,
            "文件哈希": record.file_hash,
            "状态": record.status.value,
            "参数版本": record.params_version,
            "总行数": record.total_rows,
            "有效行数": len(normal_rows),
            "断档行数": len(gap_rows),
            "回归参数": record.regression_params,
            "行明细": row_details,
            "断档摘要": [
                {
                    "原始行号": r.original_line_no,
                    "状态": r.status.value,
                    "备注": r.notes,
                }
                for r in gap_rows
            ],
            "批注记录": record.annotations,
        }

    def export_for_api(self, import_id: str) -> Dict[str, Any]:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")
        return self._get_unified_data(record)

    def export_for_display(self, import_id: str) -> Dict[str, Any]:
        return self.export_for_api(import_id)

    def export_to_csv(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_明细.csv")

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(data["行明细"][0].keys()))
            writer.writeheader()
            writer.writerows(data["行明细"])

        return output_path

    def export_to_json(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_复盘记录.json")

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return output_path

    def export_summary_report(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_复盘摘要.txt")

        lines = []
        lines.append("=" * 60)
        lines.append("线性回归残差复盘报告")
        lines.append("=" * 60)
        lines.append(f"导入ID: {data['导入ID']}")
        lines.append(f"导入时间: {data['导入时间']}")
        lines.append(f"源文件: {data['源文件']}")
        lines.append(f"状态: {data['状态']}")
        lines.append(f"参数版本: v{data['参数版本']}")
        lines.append("-" * 60)
        lines.append(f"总行数: {data['总行数']}")
        lines.append(f"有效行数: {data['有效行数']}")
        lines.append(f"断档行数: {data['断档行数']}")
        lines.append("-" * 60)

        if data["回归参数"]:
            lines.append("回归参数:")
            lines.append(f"  斜率 (slope): {data['回归参数']['slope']:.6f}")
            lines.append(f"  截距 (intercept): {data['回归参数']['intercept']:.6f}")
            lines.append(f"  R²: {data['回归参数']['r_squared']:.6f}")
            lines.append("-" * 60)

        if data["断档摘要"]:
            lines.append("断档记录（待教研组复核）:")
            for gap in data["断档摘要"]:
                lines.append(f"  [原始行号{gap['原始行号']}] {gap['状态']} - {gap['备注']}")
            lines.append("-" * 60)

        if data["批注记录"]:
            lines.append("批注记录:")
            for ann in data["批注记录"]:
                lines.append(
                    f"  [行{ann['original_line_no']}] {ann['author']}: {ann['annotation']}"
                )
            lines.append("-" * 60)

        lines.append("行明细:")
        lines.append(
            f"{'原始行号':<8} {'当前行号':<8} {'X值':<10} {'Y值':<10} {'残差':<12} {'状态':<12} {'备注'}"
        )
        for row in data["行明细"]:
            curr = str(row["当前行号"]) if row["当前行号"] else "-"
            residual = f"{row['残差']:.4f}" if row["残差"] else "-"
            lines.append(
                f"{row['原始行号']:<8} {curr:<8} {row['X值']:<10.2f} {row['Y值']:<10.2f} {residual:<12} {row['状态']:<12} {row['备注']}"
            )

        lines.append("=" * 60)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return output_path

    def export_all(self, import_id: str) -> Dict[str, str]:
        return {
            "json": self.export_to_json(import_id),
            "csv": self.export_to_csv(import_id),
            "report": self.export_summary_report(import_id),
        }
