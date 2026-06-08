"""统一结果导出：明细、页面展示、接口返回同一份数据 - 包含变更历史、参数历史、复核信息"""

import json
import csv
from pathlib import Path
from typing import Dict, Any, List

from .models import ImportRecord, RowStatus
from .importer import SUPPORTED_VALID_STATUS
from .storage import StorageManager


class UnifiedExporter:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def _get_unified_data(self, record: ImportRecord) -> Dict[str, Any]:
        sorted_rows = sorted(record.rows, key=lambda r: r.original_line_no)

        row_details = []
        for row in sorted_rows:
            is_valid = row.status in SUPPORTED_VALID_STATUS
            row_details.append(
                {
                    "原始行号": row.original_line_no,
                    "当前行号": row.current_line_no,
                    "原始X值": row.original_x_value,
                    "原始Y值": row.original_y_value,
                    "当前X值": row.x_value,
                    "当前Y值": row.y_value,
                    "预测值": round(row.predicted, 6) if row.predicted is not None else None,
                    "残差": round(row.residual, 6) if row.residual is not None else None,
                    "状态": row.status.value,
                    "状态说明": self._status_description(row.status.value),
                    "是否参与计算": "是" if is_valid else "否",
                    "删除时间": row.deleted_at.isoformat() if row.deleted_at else None,
                    "补录时间": row.supplemented_at.isoformat() if row.supplemented_at else None,
                    "复核时间": row.reviewed_at.isoformat() if row.reviewed_at else None,
                    "复核人": row.reviewed_by,
                    "复核意见": row.review_comment,
                    "下一步处理人": row.next_owner,
                    "来源字段X": row.source_field_x,
                    "来源字段Y": row.source_field_y,
                    "来源文件": row.source_file_ref,
                    "备注": row.notes,
                }
            )

        gap_rows = [r for r in sorted_rows if r.status not in SUPPORTED_VALID_STATUS]
        normal_rows = [r for r in sorted_rows if r.status in SUPPORTED_VALID_STATUS]
        pending_rows = [r for r in sorted_rows if r.status.value == "pending_review"]
        reviewed_rows = [r for r in sorted_rows if r.status.value == "reviewed"]

        summary = {
            "导入ID": record.import_id,
            "导入时间": record.import_time.isoformat(),
            "源文件": record.source_file,
            "文件哈希": record.file_hash,
            "源格式": record.source_format,
            "字段映射": record.field_mapping,
            "状态": record.status.value,
            "数据负责人": record.data_owner,
            "参数版本": record.params_version,
            "总行数": record.total_rows,
            "有效行数": len(normal_rows),
            "断档行数": len(gap_rows),
            "待复核行数": len(pending_rows),
            "已复核行数": len(reviewed_rows),
            "回归参数": record.regression_params,
            "参数历史快照": record.regression_params_history,
            "变更历史": [c.to_dict() for c in record.change_log],
            "行明细": row_details,
            "待处理摘要": {
                "gap": [
                    {
                        "原始行号": r.original_line_no,
                        "状态": r.status.value,
                        "原始值": [r.original_x_value, r.original_y_value],
                        "当前值": [r.x_value, r.y_value],
                        "下一步处理人": r.next_owner,
                        "备注": r.notes,
                    }
                    for r in gap_rows
                ],
                "pending_review": [
                    {
                        "原始行号": r.original_line_no,
                        "状态": r.status.value,
                        "原始值": [r.original_x_value, r.original_y_value],
                        "当前值": [r.x_value, r.y_value],
                        "下一步处理人": r.next_owner,
                        "备注": r.notes,
                    }
                    for r in pending_rows
                ],
            },
            "批注记录": record.annotations,
            "数据一致性校验": {
                "总行数校验": "通过" if record.total_rows == len(row_details) else f"异常:{record.total_rows}!={len(row_details)}",
                "参数版本对齐": f"v{record.params_version}",
                "有效行参与残差覆盖": "通过" if all(
                    (r.status not in SUPPORTED_VALID_STATUS) or (r.predicted is not None)
                    for r in sorted_rows
                ) else "异常:有效行存在空残差",
            },
        }
        return summary

    def _status_description(self, status: str) -> str:
        mapping = {
            "normal": "正常导入",
            "deleted": "已删除",
            "gap": "编号断档-待教研组复核",
            "supplemented": "已补录（已通过复核）",
            "pending_review": "已补录/修正-待复核",
            "reviewed": "复核通过",
            "modified": "已修正（已复核）",
        }
        return mapping.get(status, status)

    def export_for_api(self, import_id: str) -> Dict[str, Any]:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")
        return self._get_unified_data(record)

    def export_for_display(self, import_id: str) -> Dict[str, Any]:
        return self.export_for_api(import_id)

    def export_list_row_details(self, import_id: str) -> List[Dict[str, Any]]:
        return self.export_for_api(import_id)

    def export_to_csv(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_明细.csv")

        if not data["行明细"]:
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                f.write("")
            return output_path

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(data["行明细"][0].keys()))
            writer.writeheader()
            writer.writerows(data["行明细"])

        return output_path

    def export_to_json(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_复盘记录.json")
        else:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return str(output_path)

    def export_change_log_csv(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_变更历史.csv")

        if not data["变更历史"]:
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                f.write("")
            return output_path

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(data["变更历史"][0].keys()))
            writer.writeheader()
            writer.writerows(data["变更历史"])

        return output_path

    def export_summary_report(self, import_id: str, output_path: str = None) -> str:
        data = self.export_for_api(import_id)

        if not output_path:
            output_path = str(self.storage.exports_dir / f"{import_id}_复盘摘要.txt")

        lines: list[str] = []
        lines.append("=" * 72)
        lines.append("线性回归残差复盘报告")
        lines.append("=" * 72)
        lines.append(f"导入ID: {data['导入ID']}")
        lines.append(f"导入时间: {data['导入时间']}")
        lines.append(f"源文件: {data['源文件']} (格式: {data['源格式']})")
        lines.append(f"字段映射: {data['字段映射']}")
        lines.append(f"记录状态: {data['状态']}")
        lines.append(f"数据负责人: {data['数据负责人'] or '-'}")
        lines.append(f"参数版本: v{data['参数版本']}")
        lines.append("-" * 72)
        lines.append(
            f"总数: {data['总行数']} | 有效: {data['有效行数']} | "
            f"断档: {data['断档行数']} | 待复核: {data['待复核行数']} | 已复核: {data['已复核行数']}"
        )
        lines.append("-" * 72)

        if data["回归参数"]:
            lines.append("当前回归参数:")
            for k, v in data["回归参数"].items():
                lines.append(f"  {k}: {v}")
            lines.append("-" * 72)

        if data["参数历史快照"]:
            lines.append("参数历史快照 (共{}个版本):".format(len(data["参数历史快照"])))
            for snap in data["参数历史快照"]:
                lines.append(
                    f"  v{snap['params_version']} @ {snap['snapshot_time']} | trigger={snap['trigger']}"
                )
                for pk, pv in snap["params"].items():
                    lines.append(f"    {pk}: {pv}")
            lines.append("-" * 72)

        if data["待处理摘要"]["gap"]:
            lines.append("断档记录 (待教研组复核):")
            for g in data["待处理摘要"]["gap"]:
                lines.append(
                f"  [行{g['原始行号']}] 状态={g['状态']} 原值={g['原始值']} 下一步→{g['下一步处理人']}"
            )
            lines.append("-" * 72)

        if data["待处理摘要"]["pending_review"]:
            lines.append("待复核补录/修正记录:")
            for g in data["待处理摘要"]["pending_review"]:
                lines.append(
                    f"  [行{g['原始行号']}] 状态={g['状态']} 原值={g['原始值']} 当前值={g['当前值']} → 下一步→{g['下一步处理人']}"
                )
            lines.append("-" * 72)

        if data["批注记录"]:
            lines.append("批注记录:")
            for ann in data["批注记录"]:
                lines.append(
                    f"  [{ann['author']} @ 行{ann['original_line_no']} - {ann['annotation']} ({ann['timestamp']})"
                )
            lines.append("-" * 72)

        if data["变更历史"]:
            lines.append("变更历史 (共{}条):".format(len(data["变更历史"])))
            for ch in data["变更历史"]:
                who = ch["author"]
                when = ch["timestamp"]
                ct = ch["change_type"]
                line = ch["original_line_no"]
                reason = ch["reason"]
                next_act = ch["next_action"]
                lines.append(f"  [{when}] {ct} @ 行{line} | 操作人:{who}")
                if ch["original_value_x"] is not None:
                    lines.append(
                        f"    原值({ch['original_value_x']},{ch['original_value_y']}"
                    )
                if ch["new_value_x"] is not None:
                    lines.append(
                        f"    → 新值({ch['new_value_x']},{ch['new_value_y']})"
                    )
                if ch["original_status"] or ch["new_status"]:
                    lines.append(
                    f"    状态: {ch['original_status']} → {ch['new_status']}"
                )
                lines.append(f"    原因: {reason}")
                if next_act:
                    lines.append(f"    下一步: {next_act}")
            lines.append("-" * 72)

        lines.append("一致性校验:")
        for k, v in data["数据一致性校验"].items():
            lines.append(f"  {k}: {v}")
        lines.append("-" * 72)

        lines.append("行明细:")
        header = (
            f"{'原始行号':<8} {'当前行号':<8} {'原始X':<10} {'原始Y':<10} "
            f"{'当前X':<10} {'当前Y':<10} {'残差':<12} {'状态':<14} {'下一步':<10}"
        )
        lines.append(header)
        for row in data["行明细"]:
            curr = str(row["当前行号"]) if row["当前行号"] else "-"
            residual = f"{row['残差']:.4f}" if row["残差"] is not None else "-"
            lines.append(
                f"{row['原始行号']:<8} {curr:<8} "
                f"{row['原始X值'] if row['原始X值'] is not None else '-':<10.2f}"
                + f"{row['原始Y值'] if row['原始Y值'] is not None else '-':<10.2f} "
                f"{row['当前X值']:<10.2f} {row['当前Y值']:<10.2f} {residual:<12} "
                f"{row['状态']:<14} {row['下一步处理人']:<10}"
            )
        lines.append("=" * 72)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return str(output_path)

    def export_all(self, import_id: str) -> Dict[str, str]:
        return {
            "json_full": self.export_to_json(import_id),
            "csv_details": self.export_to_csv(import_id),
            "csv_changelog": self.export_change_log_csv(import_id),
            "report": self.export_summary_report(import_id),
        }
