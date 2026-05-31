import json
import os
from typing import List

from .models import LedgerRecord, RecordStatus, DuplicateAction
from .audit import AuditLog


class Exporter:
    def __init__(self, output_dir: str, audit_log: AuditLog):
        self.output_dir = output_dir
        self.audit_log = audit_log
        os.makedirs(output_dir, exist_ok=True)

    def terminal_summary(self, records: List[LedgerRecord]) -> str:
        confirmed = [r for r in records if r.status == RecordStatus.CONFIRMED]
        pending = [r for r in records if r.status == RecordStatus.PENDING_MATERIAL]
        overrides = [r for r in records if r.status == RecordStatus.MANUAL_OVERRIDE]
        conflicts = [r for r in records if r.status == RecordStatus.CONFLICT]

        lines = []
        lines.append("=" * 60)
        lines.append("  航运运费套保台账 — 导入摘要")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"  总记录数:       {len(records)}")
        lines.append(f"  已确认:         {len(confirmed)}")
        lines.append(f"  待补材料:       {len(pending)}")
        lines.append(f"  人工改判:       {len(overrides)}")
        lines.append(f"  冲突待定:       {len(conflicts)}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("  已确认记录:")
        for r in confirmed:
            src = r.source.file_name if r.source else "?"
            row_str = f"第{r.source.row_number}行" if r.source and r.source.row_number else "?"
            lines.append(f"    [{r.record_id}] {r.trade_date} {r.route} "
                         f"{r.hedge_type} {r.direction} "
                         f"{r.notional_amount}{r.currency} ← {src} {row_str}")
        lines.append("")
        lines.append("  待补材料记录:")
        for r in pending:
            src = r.source.file_name if r.source else "?"
            missing = self._missing_fields(r)
            lines.append(f"    [{r.record_id}] {r.trade_date or '日期缺失'} {r.route or '航线缺失'} "
                         f"缺少: {', '.join(missing)} ← {src}")
        lines.append("")
        if overrides:
            lines.append("  人工改判记录:")
            for r in overrides:
                src = r.source.file_name if r.source else "?"
                lines.append(f"    [{r.record_id}] {r.trade_date} {r.route} "
                             f"原状态→人工改判 ← {src}")
            lines.append("")
        if conflicts:
            lines.append("  冲突待定记录:")
            for r in conflicts:
                src = r.source.file_name if r.source else "?"
                lines.append(f"    [{r.record_id}] {r.trade_date} {r.route} "
                             f"重复冲突 ← {src}")
            lines.append("")
        lines.append("=" * 60)

        total_amount = sum(r.notional_amount or 0 for r in confirmed)
        lines.append(f"  已确认金额合计: {total_amount:,.2f} (仅已确认)")
        lines.append("=" * 60)

        text = "\n".join(lines)
        return text

    @staticmethod
    def _missing_fields(r: LedgerRecord) -> List[str]:
        missing = []
        if not r.trade_date:
            missing.append("交易日期")
        if not r.route:
            missing.append("航线")
        if r.notional_amount is None:
            missing.append("名义金额")
        if not r.hedge_type:
            missing.append("套保类型")
        if not r.direction:
            missing.append("方向")
        if not r.operator:
            missing.append("经办人")
        return missing

    def export_finance_detail(self, records: List[LedgerRecord],
                              filename: str = "finance_detail.json") -> str:
        confirmed = [r for r in records if r.status == RecordStatus.CONFIRMED]
        pending = [r for r in records if r.status == RecordStatus.PENDING_MATERIAL]
        overrides = [r for r in records if r.status == RecordStatus.MANUAL_OVERRIDE]
        conflicts = [r for r in records if r.status == RecordStatus.CONFLICT]

        total_confirmed = sum(r.notional_amount or 0 for r in confirmed)
        total_pending = sum(r.notional_amount or 0 for r in pending)
        total_overrides = sum(r.notional_amount or 0 for r in overrides)

        report = {
            "report_title": "航运运费套保台账 — 财务明细",
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "summary": {
                "total_records": len(records),
                "confirmed_count": len(confirmed),
                "pending_count": len(pending),
                "override_count": len(overrides),
                "conflict_count": len(conflicts),
                "total_confirmed_amount": total_confirmed,
                "total_pending_amount": total_pending,
                "total_override_amount": total_overrides,
            },
            "confirmed": [r.to_dict() for r in confirmed],
            "pending_material": [r.to_dict() for r in pending],
            "manual_override": [r.to_dict() for r in overrides],
            "conflict": [r.to_dict() for r in conflicts],
        }

        audit_entries = self.audit_log.read_all()
        report["audit_log"] = audit_entries

        path = os.path.join(self.output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return path

    def export_csv_sections(self, records: List[LedgerRecord],
                            prefix: str = "finance") -> List[str]:
        import csv as csv_mod

        sections = {
            "confirmed": [r for r in records if r.status == RecordStatus.CONFIRMED],
            "pending_material": [r for r in records if r.status == RecordStatus.PENDING_MATERIAL],
            "manual_override": [r for r in records if r.status == RecordStatus.MANUAL_OVERRIDE],
            "conflict": [r for r in records if r.status == RecordStatus.CONFLICT],
        }

        fieldnames = ["record_id", "trade_date", "route", "hedge_type", "direction",
                      "notional_amount", "currency", "counterparty", "operator",
                      "operator_raw", "contract_period", "settlement_date",
                      "status", "duplicate_action", "remark", "caliber",
                      "source_file", "source_row", "audit_summary"]

        paths = []
        for section_name, recs in sections.items():
            fname = f"{prefix}_{section_name}.csv"
            path = os.path.join(self.output_dir, fname)
            with open(path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv_mod.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in recs:
                    audit_summary = "; ".join(
                        f"{e.action if hasattr(e, 'action') else e.get('action', '')}:{e.detail if hasattr(e, 'detail') else e.get('detail', '')}"
                        for e in r.audit_trail
                    )
                    row = {
                        "record_id": r.record_id,
                        "trade_date": r.trade_date.isoformat() if r.trade_date else "",
                        "route": r.route,
                        "hedge_type": r.hedge_type,
                        "direction": r.direction,
                        "notional_amount": r.notional_amount if r.notional_amount is not None else "",
                        "currency": r.currency,
                        "counterparty": r.counterparty,
                        "operator": r.operator,
                        "operator_raw": r.operator_raw,
                        "contract_period": r.contract_period,
                        "settlement_date": r.settlement_date.isoformat() if r.settlement_date else "",
                        "status": r.status.value,
                        "duplicate_action": r.duplicate_action.value if r.duplicate_action else "",
                        "remark": r.remark,
                        "caliber": r.caliber,
                        "source_file": r.source.file_name if r.source else "",
                        "source_row": r.source.row_number if r.source else "",
                        "audit_summary": audit_summary,
                    }
                    writer.writerow(row)
            paths.append(path)

        return paths
