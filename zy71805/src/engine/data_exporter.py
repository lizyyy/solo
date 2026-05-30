import pandas as pd
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

from src.config import OUTPUT_DIR, HISTORY_DIR
from src.models.margin_record import MarginRecord
from src.models.audit_history import AuditRecord


class DataExporter:
    def __init__(self, output_dir: Path = OUTPUT_DIR, history_dir: Path = HISTORY_DIR):
        self.output_dir = output_dir
        self.history_dir = history_dir

    def export_margin_records_to_excel(
        self,
        records: List[MarginRecord],
        filename: str = None
    ) -> Path:
        if filename is None:
            filename = f"margin_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        data = [record.to_dict() for record in records]
        for item in data:
            if "source_references" in item:
                item["source_references"] = json.dumps(item["source_references"], ensure_ascii=False)

        df = pd.DataFrame(data)
        output_path = self.output_dir / filename
        df.to_excel(output_path, index=False)

        self._save_to_history(records, "margin_records")

        return output_path

    def export_review_checklist(
        self,
        records: List[MarginRecord],
        filename: str = None
    ) -> Path:
        if filename is None:
            filename = f"review_checklist_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        confirmed = []
        pending = []
        manual = []

        for record in records:
            data = {
                "对手方": record.counterparty,
                "计算日期": record.calculation_date,
                "应缴保证金": record.required_margin,
                "实缴保证金": record.actual_margin,
                "保证金缺口": record.margin_shortfall,
                "保证金超额": record.margin_excess,
                "状态": record.review_status,
                "备注": record.remarks or "",
                "数据来源": ", ".join([ref["source_type_name"] for ref in [r.to_dict() for r in record.source_references]]),
                "人工修改": "是" if record.manual_override else "否",
                "修改原因": record.override_reason or "",
                "下一步跟进": record.next_follow_up or ""
            }

            if record.review_status == "CONFIRMED":
                confirmed.append(data)
            elif record.review_status == "PENDING":
                pending.append(data)
            elif record.review_status == "MANUAL":
                manual.append(data)

        output_path = self.output_dir / filename
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            if confirmed:
                pd.DataFrame(confirmed).to_excel(writer, sheet_name="已确认", index=False)
            if pending:
                pd.DataFrame(pending).to_excel(writer, sheet_name="待补", index=False)
            if manual:
                pd.DataFrame(manual).to_excel(writer, sheet_name="人工修改", index=False)

        return output_path

    def export_audit_history(
        self,
        audit_records: List[AuditRecord],
        filename: str = None
    ) -> Path:
        if filename is None:
            filename = f"audit_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        data = [record.to_dict() for record in audit_records]
        df = pd.DataFrame(data)
        output_path = self.output_dir / filename
        df.to_excel(output_path, index=False)

        return output_path

    def export_to_json(
        self,
        data: Dict[str, Any],
        filename: str
    ) -> Path:
        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return output_path

    def _save_to_history(self, records: List[MarginRecord], record_type: str):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        history_file = self.history_dir / f"{record_type}_{timestamp}.json"

        data = [record.to_dict() for record in records]
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
