from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from .models import (
    AuditReport, AuditItem, WithdrawalRecord,
    ExceptionRecord, ExceptionSeverity,
)


class Reporter:
    def __init__(self, report: AuditReport, withdrawals: Optional[list[WithdrawalRecord]] = None):
        self.report = report
        self.withdrawals = withdrawals or []

    def to_markdown(self) -> str:
        r = self.report
        s = r.summary
        lines = [
            f"# 网约车司机提现审核报告",
            f"",
            f"- **审核日期**: {r.audit_date}",
            f"- **报告生成时间**: {r.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"- **报告编号**: {r.report_id}",
            f"",
            f"---",
            f"",
            f"## 💰 金额汇总",
            f"",
            f"| 项目 | 金额(元) |",
            f"|------|----------|",
            f"| 订单总收入 | {s.get('total_income', 0):,.2f} |",
            f"| 奖励总额 | {s.get('total_rewards', 0):,.2f} |",
            f"| 罚款总额 | {s.get('total_fines', 0):,.2f} |",
            f"| 冻结总额 | {s.get('total_frozen', 0):,.2f} |",
            f"| **可提现总额** | **{s.get('total_withdrawable', 0):,.2f}** |",
            f"",
            f"## 🚨 异常统计",
            f"",
            f"| 级别 | 数量 |",
            f"|------|------|",
            f"| 严重(CRITICAL) | {s.get('critical_count', 0)} |",
            f"| 警告(WARNING) | {s.get('warning_count', 0)} |",
            f"| **总计** | **{s.get('total_exceptions', 0)}** |",
            f"",
        ]

        if r.global_exceptions:
            lines.append("## 📌 全局异常")
            lines.append("")
            for exc in r.global_exceptions:
                lines.extend(self._format_exception_md(exc))
                lines.append("")

        lines.append("## 👤 司机审核明细")
        lines.append("")
        for item in r.items:
            lines.extend(self._format_item_md(item))
            lines.append("")

        if self.withdrawals:
            lines.append("## 💳 提现记录")
            lines.append("")
            lines.append("| 提现单号 | 司机ID | 金额 | 状态 | 审核人 | 备注 |")
            lines.append("|----------|--------|------|------|--------|------|")
            for w in self.withdrawals:
                lines.append(
                    f"| {w.withdrawal_id} | {w.driver_id} | ¥{w.amount:,.2f} | {w.status.value} | {w.reviewer or '-'} | {w.review_note or '-'} |"
                )
            lines.append("")

        lines.append("---")
        lines.append(f"*报告由网约车司机提现审核系统自动生成*")

        return "\n".join(lines)

    def _format_item_md(self, item: AuditItem) -> list[str]:
        lines = [
            f"### {item.driver_name} (ID: {item.driver_id})",
            f"",
            f"| 项目 | 金额(元) |",
            f"|------|----------|",
            f"| 订单收入 | ¥{item.total_income:,.2f} |",
            f"| 奖励 | ¥{item.total_rewards:,.2f} |",
            f"| 罚款 | ¥{item.total_fines:,.2f} |",
            f"| 冻结 | ¥{item.total_frozen:,.2f} |",
            f"| **可提现** | **¥{item.withdrawable:,.2f}** |",
            f"",
        ]

        if item.exceptions:
            lines.append(f"**异常记录 ({len(item.exceptions)} 条)**")
            lines.append("")
            for exc in item.exceptions:
                lines.extend(self._format_exception_md(exc))
            lines.append("")

        return lines

    def _format_exception_md(self, exc: ExceptionRecord) -> list[str]:
        icons = {
            ExceptionSeverity.INFO: "ℹ️",
            ExceptionSeverity.WARNING: "⚠️",
            ExceptionSeverity.ERROR: "❌",
            ExceptionSeverity.CRITICAL: "🚨",
        }
        icon = icons.get(exc.severity, "❓")
        fix_tag = ""
        if exc.auto_fixable and not exc.fixed:
            fix_tag = " `[可自动处理]`"
        elif exc.auto_fixable and exc.fixed:
            fix_tag = " `[已自动处理]`"
        elif not exc.auto_fixable:
            fix_tag = " `[需人工确认]`"

        lines = [
            f"{icon} **{exc.title}**{fix_tag}",
            f"   - 类别: {exc.category} | 严重程度: {exc.severity.value}",
            f"   - 详情: {exc.detail}",
            f"   - 建议: {exc.suggestion}",
        ]
        if exc.related_ids:
            lines.append(f"   - 关联ID: {', '.join(exc.related_ids)}")
        return lines

    def to_json(self) -> str:
        data = self._report_to_dict()
        return json.dumps(data, ensure_ascii=False, indent=2, default=self._json_serializer)

    def _report_to_dict(self) -> dict:
        r = self.report
        return {
            "report_id": r.report_id,
            "generated_at": r.generated_at.isoformat(),
            "audit_date": str(r.audit_date),
            "summary": r.summary,
            "global_exceptions": [self._exception_to_dict(e) for e in r.global_exceptions],
            "items": [self._item_to_dict(item) for item in r.items],
            "withdrawals": [self._withdrawal_to_dict(w) for w in self.withdrawals],
        }

    def _item_to_dict(self, item: AuditItem) -> dict:
        return {
            "driver_id": item.driver_id,
            "driver_name": item.driver_name,
            "total_income": item.total_income,
            "total_rewards": item.total_rewards,
            "total_fines": item.total_fines,
            "total_frozen": item.total_frozen,
            "withdrawable": item.withdrawable,
            "exceptions": [self._exception_to_dict(e) for e in item.exceptions],
        }

    def _exception_to_dict(self, exc: ExceptionRecord) -> dict:
        return {
            "exception_id": exc.exception_id,
            "driver_id": exc.driver_id,
            "category": exc.category,
            "severity": exc.severity.value,
            "title": exc.title,
            "detail": exc.detail,
            "suggestion": exc.suggestion,
            "related_ids": exc.related_ids,
            "auto_fixable": exc.auto_fixable,
            "fixed": exc.fixed,
            "fix_action": exc.fix_action,
        }

    def _withdrawal_to_dict(self, w: WithdrawalRecord) -> dict:
        return {
            "withdrawal_id": w.withdrawal_id,
            "driver_id": w.driver_id,
            "amount": w.amount,
            "request_date": str(w.request_date),
            "status": w.status.value,
            "idempotency_key": w.idempotency_key,
            "reviewer": w.reviewer,
            "review_note": w.review_note,
            "approved_at": w.approved_at.isoformat() if w.approved_at else None,
        }

    @staticmethod
    def _json_serializer(obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, ExceptionSeverity):
            return obj.value
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    def save_markdown(self, path: str) -> str:
        content = self.to_markdown()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def save_json(self, path: str) -> str:
        content = self.to_json()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def save_all(self, directory: str) -> tuple[str, str]:
        d = Path(directory)
        d.mkdir(parents=True, exist_ok=True)
        base = f"audit_report_{self.report.audit_date}_{self.report.report_id}"
        md_path = str(d / f"{base}.md")
        json_path = str(d / f"{base}.json")
        self.save_markdown(md_path)
        self.save_json(json_path)
        return md_path, json_path
