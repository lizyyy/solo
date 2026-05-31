import os
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pathlib import Path
from sqlalchemy.orm import Session
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from .config import EXPORTS_DIR
from .database import get_db
from .models import (
    AuctionDeposit, ConflictRecord, EvidenceLink, AuditLog,
    RecordStatus
)

console = Console()


class TerminalReporter:
    STATUS_COLORS = {
        "confirmed": "green",
        "suspended": "yellow",
        "conflict": "red",
        "refunded": "blue",
        "pending": "grey50",
    }

    STATUS_LABELS = {
        "confirmed": "✓ 已确认",
        "suspended": "⚠ 挂起",
        "conflict": "✗ 冲突",
        "refunded": "↩ 已退款",
        "pending": "○ 待处理",
    }

    def print_import_summary(self, import_results: List[Dict[str, Any]]):
        console.print(Panel.fit(
            "[bold cyan]二手车拍卖保证金 - 数据导入摘要[/bold cyan]",
            border_style="cyan"
        ))

        table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
        table.add_column("文件名", style="cyan")
        table.add_column("类型", style="yellow")
        table.add_column("状态", justify="center")
        table.add_column("记录数", justify="right")
        table.add_column("信息", style="grey50")

        total_success = 0
        total_failed = 0
        total_skipped = 0
        total_records = 0

        for result in import_results:
            status = result.get("status", "unknown")
            if status == "success":
                status_text = Text("✓ 成功", style="green")
                total_success += 1
            elif status == "skipped":
                status_text = Text("- 跳过", style="yellow")
                total_skipped += 1
            else:
                status_text = Text("✗ 失败", style="red")
                total_failed += 1

            total_records += result.get("count", 0)

            table.add_row(
                result.get("file", ""),
                result.get("file_type", "-"),
                status_text,
                str(result.get("count", 0)),
                result.get("message", "")
            )

        console.print(table)

        summary = Text()
        summary.append(f"总计: {len(import_results)} 个文件, ", style="bold")
        summary.append(f"{total_success} 成功, ", style="green")
        summary.append(f"{total_skipped} 跳过, ", style="yellow")
        summary.append(f"{total_failed} 失败, ", style="red")
        summary.append(f"{total_records} 条记录", style="cyan")
        console.print(summary)
        console.print()

    def print_processing_summary(self, processing_results: List[Dict[str, Any]]):
        console.print(Panel.fit(
            "[bold cyan]二手车拍卖保证金 - 处理结果摘要[/bold cyan]",
            border_style="cyan"
        ))

        if not processing_results:
            console.print("[yellow]没有新处理的记录[/yellow]")
            return

        status_counts = {}
        total_confirmed = 0.0
        total_suspended = 0.0
        total_refunded = 0.0
        total_deposit = 0.0

        for r in processing_results:
            status = r["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
            total_confirmed += r.get("confirmed_amount", 0.0)
            total_suspended += r.get("suspended_amount", 0.0)
            total_refunded += r.get("refund_amount", 0.0)
            if r.get("is_deposit"):
                total_deposit += r["amount"]

        stats_table = Table(show_header=True, header_style="bold magenta", box=box.SIMPLE)
        stats_table.add_column("状态", style="cyan")
        stats_table.add_column("笔数", justify="right")
        stats_table.add_column("金额(元)", justify="right")

        for status, count in sorted(status_counts.items()):
            color = self.STATUS_COLORS.get(status, "white")
            label = self.STATUS_LABELS.get(status, status)

            if status == "confirmed":
                amount = total_confirmed
            elif status == "suspended":
                amount = total_suspended
            elif status == "refunded":
                amount = total_refunded
            else:
                amount = 0.0

            stats_table.add_row(
                Text(label, style=color),
                Text(str(count), style=color),
                Text(f"¥{amount:,.2f}", style=color)
            )

        stats_table.add_row(
            Text("[bold]二手车拍卖保证金合计[/bold]", style="bold cyan"),
            Text(str(len([r for r in processing_results if r.get("is_deposit")])), style="bold cyan"),
            Text(f"[bold]¥{total_deposit:,.2f}[/bold]", style="bold cyan")
        )

        console.print(stats_table)
        console.print()

        detail_table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
        detail_table.add_column("交易号", style="cyan")
        detail_table.add_column("付款人", style="yellow")
        detail_table.add_column("批次", style="blue")
        detail_table.add_column("金额", justify="right")
        detail_table.add_column("状态", justify="center")
        detail_table.add_column("确认金额", justify="right")
        detail_table.add_column("判断原因", style="grey50", max_width=40)

        for r in processing_results:
            status = r["status"]
            color = self.STATUS_COLORS.get(status, "white")
            label = self.STATUS_LABELS.get(status, status)

            detail_table.add_row(
                r["transaction_no"],
                r["payer"],
                r.get("batch") or "-",
                f"¥{r['amount']:,.2f}",
                Text(label, style=color),
                f"¥{r.get('confirmed_amount', 0.0):,.2f}",
                r.get("decision_reason", "")[:80] + "..." if len(r.get("decision_reason", "")) > 80 else r.get("decision_reason", "")
            )

        console.print(detail_table)
        console.print()

    def print_conflicts(self, conflicts: List[Dict[str, Any]]):
        if not conflicts:
            return

        console.print(Panel.fit(
            "[bold red]二手车拍卖保证金 - 需人工处理的冲突[/bold red]",
            border_style="red"
        ))

        for conflict in conflicts:
            conflict_type = conflict.get("conflict_type", "")
            type_labels = {
                "amount_mismatch": "金额不一致",
                "duplicate_batch_claim": "重复批次认领"
            }

            console.print(f"\n[bold red]冲突类型:[/bold red] {type_labels.get(conflict_type, conflict_type)}")
            console.print(f"[bold]交易号:[/bold] {conflict.get('transaction_no', '')}")
            console.print(f"[bold]建议动作:[/bold] {conflict.get('suggested_action', '')}")

            if "side_a" in conflict and "side_b" in conflict:
                side_a = conflict["side_a"]
                side_b = conflict["side_b"]

                table = Table(show_header=True, header_style="bold", box=box.ROUNDED)
                table.add_column("证据来源", style="cyan")
                table.add_column("数值", style="yellow")
                table.add_column("证据说明", style="grey50")

                table.add_row(
                    f"[blue]A: {side_a.get('source', '')}[/blue]",
                    str(side_a.get("value", "")),
                    side_a.get("evidence", "")
                )
                table.add_row(
                    f"[red]B: {side_b.get('source', '')}[/red]",
                    str(side_b.get("value", "")),
                    side_b.get("evidence", "")
                )

                console.print(table)
        console.print()


class FinancialExporter:
    def export_details(self, output_file: str = None) -> Tuple[str, Dict[str, Any]]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if not output_file:
            output_file = EXPORTS_DIR / f"二手车拍卖保证金明细_{timestamp}.xlsx"

        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with get_db() as db:
            deposits = db.query(AuctionDeposit).order_by(AuctionDeposit.payment_time).all()

            if not deposits:
                return "", {"message": "没有数据可导出"}

            details_data = []
            for d in deposits:
                evidence_chain = json.loads(d.evidence_chain) if d.evidence_chain else {}
                source_evidence = json.loads(d.source_evidence) if d.source_evidence else []

                details_data.append({
                    "保证金编号": d.deposit_no,
                    "交易流水号": d.transaction_no,
                    "付款人": d.payer,
                    "批次号": d.related_batch or "",
                    "总金额(元)": d.amount,
                    "币种": d.currency,
                    "付款时间": d.payment_time.strftime("%Y-%m-%d %H:%M:%S") if d.payment_time else "",
                    "确认金额(元)": d.confirmed_amount,
                    "挂起金额(元)": d.suspended_amount,
                    "退款金额(元)": d.refund_amount,
                    "退款时间": d.refund_time.strftime("%Y-%m-%d %H:%M:%S") if d.refund_time else "",
                    "状态": d.status,
                    "是否二手车拍卖保证金": "是" if d.is_deposit else "否",
                    "合同约定金额(元)": d.contract_amount or "",
                    "合同文件": d.contract_file or "",
                    "判断原因": d.decision_reason,
                    "判断时间": d.decision_time.strftime("%Y-%m-%d %H:%M:%S") if d.decision_time else "",
                    "判断人": d.decision_made_by,
                    "原始来源证据": "; ".join(source_evidence),
                    "证据链文件": "; ".join([
                        f"{e.get('source', '')}"
                        for e in evidence_chain.get('refund_requests', [])
                    ] + [
                        f"{e.get('source', '')}"
                        for e in evidence_chain.get('approval_emails', [])
                    ] + [
                        f"{e.get('source', '')}"
                        for e in evidence_chain.get('manual_notes', [])
                    ] + [
                        f"{e.get('source', '')}"
                        for e in evidence_chain.get('attachments', [])
                    ]),
                    "创建时间": d.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "更新时间": d.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                })

            df_details = pd.DataFrame(details_data)

            summary_data = self._generate_summary(deposits)
            df_summary = pd.DataFrame(summary_data)

            conflicts_data = self._generate_conflicts_data(db)
            df_conflicts = pd.DataFrame(conflicts_data) if conflicts_data else pd.DataFrame()

            evidence_data = self._generate_evidence_data(db)
            df_evidence = pd.DataFrame(evidence_data) if evidence_data else pd.DataFrame()

            audit_data = self._generate_audit_data(db)
            df_audit = pd.DataFrame(audit_data) if audit_data else pd.DataFrame()

            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                df_summary.to_excel(writer, sheet_name="汇总表", index=False)
                df_details.to_excel(writer, sheet_name="保证金明细", index=False)

                if not df_conflicts.empty:
                    df_conflicts.to_excel(writer, sheet_name="冲突记录", index=False)

                if not df_evidence.empty:
                    df_evidence.to_excel(writer, sheet_name="证据链", index=False)

                if not df_audit.empty:
                    df_audit.to_excel(writer, sheet_name="审计日志", index=False)

            stats = {
                "total_records": len(deposits),
                "total_confirmed": sum(d.confirmed_amount for d in deposits),
                "total_suspended": sum(d.suspended_amount for d in deposits),
                "total_refunded": sum(d.refund_amount for d in deposits),
                "status_breakdown": self._get_status_breakdown(deposits),
                "export_file": str(output_path)
            }

            return str(output_path), stats

    def _generate_summary(self, deposits: List[AuctionDeposit]) -> List[Dict[str, Any]]:
        status_labels = {
            "confirmed": "已确认",
            "suspended": "挂起待处理",
            "conflict": "有冲突待核实",
            "refunded": "已退款",
            "pending": "待处理"
        }

        summary = []
        summary.append({
            "项目": "二手车拍卖保证金处理汇总",
            "数值": "",
            "说明": f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        })

        batch_totals = {}
        for d in deposits:
            if d.is_deposit and d.related_batch:
                batch = d.related_batch
                if batch not in batch_totals:
                    batch_totals[batch] = {"count": 0, "amount": 0.0, "confirmed": 0.0, "suspended": 0.0}
                batch_totals[batch]["count"] += 1
                batch_totals[batch]["amount"] += d.amount
                batch_totals[batch]["confirmed"] += d.confirmed_amount
                batch_totals[batch]["suspended"] += d.suspended_amount

        for batch, data in sorted(batch_totals.items()):
            summary.append({"项目": "", "数值": "", "说明": ""})
            summary.append({"项目": f"批次: {batch}", "数值": "", "说明": ""})
            summary.append({"项目": "  笔数", "数值": data["count"], "说明": ""})
            summary.append({"项目": "  总金额(元)", "数值": f"{data['amount']:,.2f}", "说明": ""})
            summary.append({"项目": "  已确认金额(元)", "数值": f"{data['confirmed']:,.2f}", "说明": ""})
            summary.append({"项目": "  挂起金额(元)", "数值": f"{data['suspended']:,.2f}", "说明": ""})

        summary.append({"项目": "", "数值": "", "说明": ""})
        summary.append({"项目": "按状态汇总", "数值": "", "说明": ""})

        status_totals = {}
        for d in deposits:
            if d.is_deposit:
                status = d.status
                if status not in status_totals:
                    status_totals[status] = {"count": 0, "amount": 0.0}
                status_totals[status]["count"] += 1
                status_totals[status]["amount"] += d.amount

        for status, data in sorted(status_totals.items()):
            summary.append({
                "项目": f"  {status_labels.get(status, status)}",
                "数值": data["count"],
                "说明": f"{data['amount']:,.2f} 元"
            })

        total_deposit = sum(d.amount for d in deposits if d.is_deposit)
        total_confirmed = sum(d.confirmed_amount for d in deposits)
        total_suspended = sum(d.suspended_amount for d in deposits)
        total_refunded = sum(d.refund_amount for d in deposits)

        summary.append({"项目": "", "数值": "", "说明": ""})
        summary.append({"项目": "[bold]二手车拍卖保证金总计[/bold]", "数值": "", "说明": ""})
        summary.append({"项目": "  总笔数", "数值": sum(1 for d in deposits if d.is_deposit), "说明": ""})
        summary.append({"项目": "  总金额(元)", "数值": f"{total_deposit:,.2f}", "说明": ""})
        summary.append({"项目": "  已确认可入账(元)", "数值": f"{total_confirmed:,.2f}", "说明": ""})
        summary.append({"项目": "  挂起待核实(元)", "数值": f"{total_suspended:,.2f}", "说明": ""})
        summary.append({"项目": "  已退款(元)", "数值": f"{total_refunded:,.2f}", "说明": ""})

        return summary

    def _generate_conflicts_data(self, db: Session) -> List[Dict[str, Any]]:
        conflicts = db.query(ConflictRecord).filter(ConflictRecord.resolved == False).all()
        if not conflicts:
            return []

        data = []
        for c in conflicts:
            deposit = db.query(AuctionDeposit).filter(AuctionDeposit.id == c.deposit_id).first()
            type_labels = {
                "amount_mismatch": "金额不一致",
                "duplicate_batch_claim": "重复批次认领"
            }
            data.append({
                "冲突编号": c.id,
                "交易流水号": deposit.transaction_no if deposit else c.deposit_id,
                "付款人": deposit.payer if deposit else "",
                "冲突类型": type_labels.get(c.conflict_type, c.conflict_type),
                "A方来源": c.side_a_source,
                "A方数值": c.side_a_value,
                "A方证据": c.side_a_evidence,
                "B方来源": c.side_b_source,
                "B方数值": c.side_b_value,
                "B方证据": c.side_b_evidence,
                "建议动作": c.suggested_action,
                "创建时间": c.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        return data

    def _generate_evidence_data(self, db: Session) -> List[Dict[str, Any]]:
        links = db.query(EvidenceLink).order_by(EvidenceLink.deposit_id, EvidenceLink.linked_at).all()
        if not links:
            return []

        data = []
        type_labels = {
            "payment_flow": "收款流水",
            "refund_request": "退款申请",
            "approval_email": "审批邮件",
            "manual_note": "手写备注",
            "attachment_index": "附件索引"
        }

        for link in links:
            deposit = db.query(AuctionDeposit).filter(AuctionDeposit.id == link.deposit_id).first()
            data.append({
                "保证金ID": link.deposit_id,
                "交易流水号": deposit.transaction_no if deposit else "",
                "付款人": deposit.payer if deposit else "",
                "证据类型": type_labels.get(link.evidence_type, link.evidence_type),
                "证据ID": link.evidence_id,
                "证据来源文件": link.evidence_source or "",
                "证据内容": link.evidence_content,
                "关联度": f"{link.relevance_score:.0%}",
                "关联时间": link.linked_at.strftime("%Y-%m-%d %H:%M:%S"),
                "关联人": link.linked_by
            })

        return data

    def _generate_audit_data(self, db: Session) -> List[Dict[str, Any]]:
        logs = db.query(AuditLog).order_by(AuditLog.operation_time.desc()).all()
        if not logs:
            return []

        data = []
        status_labels = {
            "confirmed": "已确认",
            "suspended": "挂起",
            "conflict": "冲突",
            "refunded": "已退款",
            "pending": "待处理",
            "": ""
        }

        for log in logs:
            deposit = db.query(AuctionDeposit).filter(AuctionDeposit.id == log.deposit_id).first()
            data.append({
                "日志ID": log.id,
                "交易流水号": deposit.transaction_no if deposit else log.deposit_id,
                "动作": log.action,
                "原状态": status_labels.get(log.old_status, log.old_status),
                "新状态": status_labels.get(log.new_status, log.new_status),
                "原金额(元)": f"{log.old_amount:,.2f}" if log.old_amount else "",
                "新金额(元)": f"{log.new_amount:,.2f}" if log.new_amount else "",
                "原因": log.reason,
                "操作人": log.operator,
                "操作时间": log.operation_time.strftime("%Y-%m-%d %H:%M:%S"),
                "处理模块": log.source_module
            })

        return data

    def _get_status_breakdown(self, deposits: List[AuctionDeposit]) -> Dict[str, Any]:
        breakdown = {}
        for d in deposits:
            if d.is_deposit:
                status = d.status
                if status not in breakdown:
                    breakdown[status] = {"count": 0, "amount": 0.0}
                breakdown[status]["count"] += 1
                breakdown[status]["amount"] += d.amount
        return breakdown


def print_terminal_summary(import_results, processing_results):
    reporter = TerminalReporter()
    if import_results:
        reporter.print_import_summary(import_results)

    conflicts = []
    for r in processing_results:
        if r.get("conflicts"):
            conflicts.extend(r["conflicts"])

    reporter.print_processing_summary(processing_results)
    reporter.print_conflicts(conflicts)


def export_financial_details(output_file: str = None) -> Tuple[str, Dict[str, Any]]:
    exporter = FinancialExporter()
    return exporter.export_details(output_file)
