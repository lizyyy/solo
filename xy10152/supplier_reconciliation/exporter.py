import json
from datetime import datetime, date
from pathlib import Path
from typing import Dict, Any, List, Optional
from .models import ReconciliationRun, ReconciliationStatus


class ReportExporter:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _format_amount(self, amount: float) -> str:
        return f"{amount:,.2f}"
    
    def _format_date(self, d: Optional[date]) -> str:
        if d is None:
            return ""
        return d.isoformat()
    
    def _serialize_for_json(self, obj: Any) -> Any:
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, dict):
            return {str(k): self._serialize_for_json(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._serialize_for_json(item) for item in obj]
        if hasattr(obj, "value"):
            return obj.value
        return obj
    
    def export_json(self, run: ReconciliationRun, filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"reconciliation_{run.run_id}.json"
        
        filepath = self.output_dir / filename
        
        output = {
            "run_id": run.run_id,
            "run_date": run.run_date.isoformat(),
            "period": run.period,
            "summary": self._serialize_for_json(run.summary),
            "documents": [
                {
                    "doc_type": d.doc_type.value,
                    "doc_number": d.doc_number,
                    "supplier_id": d.supplier_id,
                    "supplier_name": d.supplier_name,
                    "amount": d.amount,
                    "doc_date": self._format_date(d.doc_date),
                    "due_date": self._format_date(d.due_date),
                    "description": d.description,
                    "reference": d.reference,
                    "is_valid": d.is_valid,
                    "validation_errors": d.validation_errors,
                    "metadata": d.metadata,
                }
                for d in run.documents
            ],
            "results": [
                {
                    "doc_number": r.document.doc_number,
                    "supplier_id": r.document.supplier_id,
                    "supplier_name": r.document.supplier_name,
                    "doc_type": r.document.doc_type.value,
                    "doc_amount": r.document.amount,
                    "matched_amount": r.matched_amount,
                    "remaining_amount": r.remaining_amount,
                    "status": r.status.value,
                    "period": r.period,
                    "aging_days": r.aging_days,
                    "matched_documents": r.matched_documents,
                    "discrepancies": r.document.metadata.get("discrepancies", []),
                }
                for r in run.results
            ],
            "errors": run.errors,
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def export_csv(self, run: ReconciliationRun, filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"reconciliation_{run.run_id}.csv"
        
        filepath = self.output_dir / filename
        
        headers = [
            "凭证类型", "凭证号", "供应商ID", "供应商名称", "凭证金额",
            "已匹配金额", "剩余金额", "状态", "账期", "账龄天数",
            "匹配凭证", "差异原因"
        ]
        
        status_map = {
            ReconciliationStatus.MATCHED: "已匹配",
            ReconciliationStatus.PARTIAL: "部分匹配",
            ReconciliationStatus.UNMATCHED: "未匹配",
            ReconciliationStatus.DUPLICATE: "重复凭证",
            ReconciliationStatus.INVALID: "无效数据",
        }
        
        type_map = {
            "invoice": "发票",
            "grn": "收货单",
            "payment": "付款",
        }
        
        import csv
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for r in run.results:
                doc = r.document
                writer.writerow([
                    type_map.get(doc.doc_type.value, doc.doc_type.value),
                    doc.doc_number,
                    doc.supplier_id,
                    doc.supplier_name,
                    self._format_amount(doc.amount),
                    self._format_amount(r.matched_amount),
                    self._format_amount(r.remaining_amount),
                    status_map.get(r.status, r.status.value),
                    r.period,
                    r.aging_days,
                    "; ".join(r.matched_documents),
                    "; ".join(doc.metadata.get("discrepancies", [])),
                ])
        
        return str(filepath)
    
    def export_summary(self, run: ReconciliationRun, filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"summary_{run.run_id}.txt"
        
        filepath = self.output_dir / filename
        
        status_map = {
            "matched": "已匹配",
            "partial": "部分匹配",
            "unmatched": "未匹配",
            "duplicate": "重复凭证",
            "invalid": "无效数据",
        }
        
        type_map = {
            "invoice": "发票",
            "grn": "收货单",
            "payment": "付款",
        }
        
        summary = run.summary
        
        lines = [
            "=" * 60,
            f"供应商账期对账报告",
            "=" * 60,
            f"运行ID: {run.run_id}",
            f"运行时间: {run.run_date.strftime('%Y-%m-%d %H:%M:%S')}",
            f"对账期间: {run.period}",
            "",
            "-" * 60,
            "总体统计",
            "-" * 60,
            f"总凭证数: {summary.get('total_documents', 0)}",
            f"有效凭证: {summary.get('valid_documents', 0)}",
            f"无效凭证: {summary.get('invalid_documents', 0)}",
            f"总金额: {self._format_amount(summary.get('total_amount', 0.0))}",
            f"已匹配金额: {self._format_amount(summary.get('matched_amount', 0.0))}",
            f"匹配率: {summary.get('match_rate', 0.0) * 100:.2f}%",
            "",
            "-" * 60,
            "按凭证类型统计",
            "-" * 60,
        ]
        
        by_type = summary.get("by_type", {})
        for doc_type, data in by_type.items():
            lines.append(f"  {type_map.get(doc_type, doc_type)}: {data['count']} 笔, 金额 {self._format_amount(data['amount'])}")
        
        lines.extend([
            "",
            "-" * 60,
            "按状态统计",
            "-" * 60,
        ])
        
        by_status = summary.get("by_status", {})
        for status, data in by_status.items():
            lines.append(f"  {status_map.get(status, status)}: {data['count']} 笔, 金额 {self._format_amount(data['amount'])}")
        
        lines.extend([
            "",
            "-" * 60,
            "按供应商统计",
            "-" * 60,
        ])
        
        by_supplier = summary.get("by_supplier", {})
        for supplier_id, data in by_supplier.items():
            match_rate = data["matched"] / data["amount"] if data["amount"] > 0 else 0
            lines.append(
                f"  {supplier_id}: {data['count']} 笔, "
                f"金额 {self._format_amount(data['amount'])}, "
                f"已匹配 {self._format_amount(data['matched'])}, "
                f"匹配率 {match_rate * 100:.2f}%"
            )
        
        if run.errors:
            lines.extend([
                "",
                "-" * 60,
                "错误信息",
                "-" * 60,
            ])
            for error in run.errors:
                lines.append(f"  - {error}")
        
        lines.extend(["", "=" * 60])
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return str(filepath)
    
    def export_all(self, run: ReconciliationRun) -> Dict[str, str]:
        return {
            "json": self.export_json(run),
            "csv": self.export_csv(run),
            "summary": self.export_summary(run),
        }
