from typing import List, Dict, Any, Optional, Callable
import pandas as pd
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import OUTPUT_DIR
from .models import PickingResult, ValidationStatus


class DataExporter:
    def __init__(self):
        self.output_dir = OUTPUT_DIR

    def filter_results(
        self,
        results: List[PickingResult],
        status_filter: Optional[List[ValidationStatus]] = None,
        order_no_filter: Optional[str] = None,
        sku_filter: Optional[str] = None,
        run_id_filter: Optional[str] = None,
        custom_filter: Optional[Callable[[PickingResult], bool]] = None,
    ) -> List[PickingResult]:
        filtered = results

        if status_filter:
            filtered = [r for r in filtered if r.status in status_filter]

        if order_no_filter:
            filtered = [r for r in filtered if order_no_filter.lower() in r.order_no.lower()]

        if sku_filter:
            filtered = [
                r for r in filtered
                if sku_filter.lower() in r.sku_code.lower() or sku_filter.lower() in r.sku_name.lower()
            ]

        if run_id_filter:
            filtered = [r for r in filtered if run_id_filter in r.run_id]

        if custom_filter:
            filtered = [r for r in filtered if custom_filter(r)]

        return filtered

    def to_dataframe(
        self,
        results: List[PickingResult],
        include_issues: bool = True,
        include_validation: bool = True,
    ) -> pd.DataFrame:
        rows = []
        for result in results:
            row = {
                "记录ID": result.record_id,
                "版本": result.version,
                "订单号": result.order_no,
                "商品编码": result.sku_code,
                "商品名称": result.sku_name,
                "拣货数量": result.pick_qty,
                "单位": result.unit,
                "库位": result.pick_location,
                "拣货员": result.picker,
                "拣货时间": result.pick_time.strftime("%Y-%m-%d %H:%M:%S") if result.pick_time else "",
                "运行ID": result.run_id,
                "批次号": result.batch_no,
            }

            if include_validation:
                row["验证状态"] = result.status.value
                row["问题数量"] = len(result.issues)

            if include_issues and result.issues:
                issues_text = "\n".join(
                    [f"- {i.issue_type.value}: {i.description}" for i in result.issues]
                )
                suggestions_text = "\n".join(
                    [f"- {i.suggestion}" for i in result.issues if i.suggestion]
                )
                row["问题详情"] = issues_text
                row["处理建议"] = suggestions_text
                row["验证说明"] = result.validation_notes

                evidence_texts = []
                for i, issue in enumerate(result.issues, 1):
                    if issue.evidence:
                        evidence = "; ".join([f"{k}={v}" for k, v in issue.evidence.items()])
                        evidence_texts.append(f"问题{i}: {evidence}")
                if evidence_texts:
                    row["复核证据"] = "\n".join(evidence_texts)

            rows.append(row)

        return pd.DataFrame(rows)

    def export_to_excel(
        self,
        results: List[PickingResult],
        filename: str,
        include_issues: bool = True,
        include_validation: bool = True,
        sheet_name: str = "拣货结果",
    ) -> str:
        output_path = self.output_dir / filename
        if not output_path.name.endswith((".xlsx", ".xls")):
            output_path = output_path.with_suffix(".xlsx")

        df = self.to_dataframe(results, include_issues, include_validation)

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)

            if include_issues:
                summary_data = self._generate_summary(results)
                summary_df = pd.DataFrame([
                    {"指标": k, "数值": v} for k, v in summary_data.items()
                ])
                summary_df.to_excel(writer, sheet_name="验证汇总", index=False)

        return str(output_path)

    def export_to_csv(
        self,
        results: List[PickingResult],
        filename: str,
        include_issues: bool = True,
        include_validation: bool = True,
        encoding: str = "utf-8-sig",
    ) -> str:
        output_path = self.output_dir / filename
        if not output_path.name.endswith(".csv"):
            output_path = output_path.with_suffix(".csv")

        df = self.to_dataframe(results, include_issues, include_validation)
        df.to_csv(output_path, index=False, encoding=encoding)

        return str(output_path)

    def _generate_summary(self, results: List[PickingResult]) -> Dict[str, Any]:
        total = len(results)
        status_counts = {}
        issue_type_counts = {}

        for r in results:
            status = r.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            for issue in r.issues:
                itype = issue.issue_type.value
                issue_type_counts[itype] = issue_type_counts.get(itype, 0) + 1

        summary = {
            "总记录数": total,
            **status_counts,
        }

        if issue_type_counts:
            summary.update({f"问题-{k}": v for k, v in issue_type_counts.items()})

        return summary

    def get_filter_options(self, results: List[PickingResult]) -> Dict[str, Any]:
        return {
            "statuses": list({r.status.value for r in results}),
            "run_ids": list({r.run_id for r in results}),
            "batch_nos": list({r.batch_no for r in results}),
            "units": list({r.unit for r in results}),
            "pickers": list({r.picker for r in results}),
        }
