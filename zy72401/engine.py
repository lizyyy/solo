from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import asdict
import copy
import json
import os

from models import (
    TicketRecord, TicketType, BatchSummary, BatchStatus,
    AuthAlert, AlertLevel, AuditLog, ActionType, SettlementRun
)

DEFAULT_STATE_FILE = "settlement_state.json"


class SettlementEngine:
    def __init__(self, state_file: str = DEFAULT_STATE_FILE):
        self.state_file = state_file
        self.runs: List[SettlementRun] = []
        self.audit_logs: List[AuditLog] = []
        self._current_run: Optional[SettlementRun] = None
        self._load()

    def _load(self):
        if not os.path.exists(self.state_file):
            return
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.runs = [self._dict_to_run(r) for r in data.get("runs", [])]
            self.audit_logs = [self._dict_to_log(l) for l in data.get("audit_logs", [])]
            if self.runs:
                self._current_run = self.runs[-1]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    def _save(self):
        data = {
            "runs": [self._run_to_dict(r) for r in self.runs],
            "audit_logs": [self._log_to_dict(l) for l in self.audit_logs]
        }
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _dict_to_ticket(self, d: dict) -> TicketRecord:
        return TicketRecord(
            id=d.get("id", ""),
            batch_no=d.get("batch_no", ""),
            ticket_no=d.get("ticket_no", ""),
            ticket_type=TicketType(d.get("ticket_type", "待确认")),
            artist_name=d.get("artist_name", ""),
            amount=float(d.get("amount", 0)),
            audio_remark=d.get("audio_remark", ""),
            original_remark=d.get("original_remark", ""),
            auth_period=d.get("auth_period"),
            source_file=d.get("source_file", ""),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at")
        )

    def _dict_to_batch(self, d: dict) -> BatchSummary:
        return BatchSummary(
            batch_no=d.get("batch_no", ""),
            total_tickets=d.get("total_tickets", 0),
            free_count=d.get("free_count", 0),
            paid_count=d.get("paid_count", 0),
            unknown_count=d.get("unknown_count", 0),
            total_amount=float(d.get("total_amount", 0)),
            status=BatchStatus(d.get("status", "正常")),
            needs_review=d.get("needs_review", False),
            reviewer=d.get("reviewer"),
            reviewed_at=d.get("reviewed_at")
        )

    def _dict_to_alert(self, d: dict) -> AuthAlert:
        return AuthAlert(
            id=d.get("id", ""),
            batch_no=d.get("batch_no", ""),
            level=AlertLevel(d.get("level", "警告")),
            title=d.get("title", ""),
            reason=d.get("reason", ""),
            missing_materials=d.get("missing_materials", []),
            next_step=d.get("next_step", ""),
            assignee=d.get("assignee", ""),
            resolved=d.get("resolved", False),
            resolved_at=d.get("resolved_at"),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at", ""),
            trigger_ticket_nos=d.get("trigger_ticket_nos", []),
            trigger_remarks=d.get("trigger_remarks", [])
        )

    def _dict_to_run(self, d: dict) -> SettlementRun:
        tickets = [self._dict_to_ticket(t) for t in d.get("tickets", [])]
        batches = {k: self._dict_to_batch(v) for k, v in d.get("batches", {}).items()}
        alerts = [self._dict_to_alert(a) for a in d.get("alerts", [])]
        return SettlementRun(
            run_id=d.get("run_id", ""),
            run_no=d.get("run_no", 1),
            operator=d.get("operator", ""),
            source_files=d.get("source_files", []),
            tickets=tickets,
            batches=batches,
            alerts=alerts,
            is_rerun=d.get("is_rerun", False),
            parent_run_id=d.get("parent_run_id"),
            created_at=d.get("created_at", "")
        )

    def _dict_to_log(self, d: dict) -> AuditLog:
        return AuditLog(
            id=d.get("id", ""),
            action=ActionType(d.get("action", "导入")),
            operator=d.get("operator", ""),
            target_batch=d.get("target_batch"),
            target_ticket=d.get("target_ticket"),
            target_ticket_no=d.get("target_ticket_no"),
            before_text=d.get("before_text", ""),
            after_text=d.get("after_text", ""),
            changes=d.get("changes", {}),
            reason=d.get("reason", ""),
            affected_results=d.get("affected_results", []),
            timestamp=d.get("timestamp", "")
        )

    def _ticket_to_dict(self, t: TicketRecord) -> dict:
        return {
            "id": t.id, "batch_no": t.batch_no, "ticket_no": t.ticket_no,
            "ticket_type": t.ticket_type.value, "artist_name": t.artist_name,
            "amount": t.amount, "audio_remark": t.audio_remark,
            "original_remark": t.original_remark, "auth_period": t.auth_period,
            "source_file": t.source_file, "created_at": t.created_at,
            "updated_at": t.updated_at
        }

    def _batch_to_dict(self, b: BatchSummary) -> dict:
        return {
            "batch_no": b.batch_no, "total_tickets": b.total_tickets,
            "free_count": b.free_count, "paid_count": b.paid_count,
            "unknown_count": b.unknown_count, "total_amount": b.total_amount,
            "status": b.status.value, "needs_review": b.needs_review,
            "reviewer": b.reviewer, "reviewed_at": b.reviewed_at
        }

    def _alert_to_dict(self, a: AuthAlert) -> dict:
        return {
            "id": a.id, "batch_no": a.batch_no, "level": a.level.value,
            "title": a.title, "reason": a.reason,
            "missing_materials": a.missing_materials, "next_step": a.next_step,
            "assignee": a.assignee, "resolved": a.resolved,
            "resolved_at": a.resolved_at, "created_at": a.created_at,
            "updated_at": a.updated_at, "trigger_ticket_nos": a.trigger_ticket_nos,
            "trigger_remarks": a.trigger_remarks
        }

    def _run_to_dict(self, r: SettlementRun) -> dict:
        return {
            "run_id": r.run_id, "run_no": r.run_no, "operator": r.operator,
            "source_files": r.source_files,
            "tickets": [self._ticket_to_dict(t) for t in r.tickets],
            "batches": {k: self._batch_to_dict(v) for k, v in r.batches.items()},
            "alerts": [self._alert_to_dict(a) for a in r.alerts],
            "is_rerun": r.is_rerun, "parent_run_id": r.parent_run_id,
            "created_at": r.created_at
        }

    def _log_to_dict(self, l: AuditLog) -> dict:
        return {
            "id": l.id, "action": l.action.value, "operator": l.operator,
            "target_batch": l.target_batch, "target_ticket": l.target_ticket,
            "target_ticket_no": l.target_ticket_no,
            "before_text": l.before_text, "after_text": l.after_text,
            "changes": l.changes, "reason": l.reason,
            "affected_results": l.affected_results, "timestamp": l.timestamp
        }

    def reset(self):
        self.runs = []
        self.audit_logs = []
        self._current_run = None
        if os.path.exists(self.state_file):
            os.remove(self.state_file)

    def import_audio_remarks(self, audio_data: List[Dict], operator: str, source_file: str = "audio_remarks.txt") -> SettlementRun:
        run = SettlementRun(
            run_no=len(self.runs) + 1,
            operator=operator,
            source_files=[source_file]
        )
        self._current_run = run

        for item in audio_data:
            remark_text = item.get("remark", "")
            ticket = TicketRecord(
                batch_no=item.get("batch_no", ""),
                ticket_no=item.get("ticket_no", ""),
                artist_name=item.get("artist_name", ""),
                amount=float(item.get("amount", 0)),
                audio_remark=remark_text,
                original_remark=remark_text,
                source_file=source_file
            )
            ticket.ticket_type = self._infer_ticket_type(ticket)
            run.tickets.append(ticket)

        self._build_batches(run)
        self._generate_alerts(run)

        ticket_summary_parts = []
        for t in run.tickets:
            ticket_summary_parts.append(
                f"  票号{t.ticket_no} | {t.artist_name} | {t.ticket_type.value} | 金额{t.amount} | 备注: {t.audio_remark}"
            )

        self._log_action(
            action=ActionType.IMPORT,
            operator=operator,
            reason=f"从 {source_file} 导入音频备注 {len(run.tickets)} 条",
            before_text="",
            after_text="\n".join(ticket_summary_parts),
            affected_results=[f"创建批次: {list(run.batches.keys())}"]
        )

        self.runs.append(run)
        self._save()
        return run

    def _infer_ticket_type(self, ticket: TicketRecord) -> TicketType:
        remark = ticket.audio_remark.lower()
        if ticket.amount <= 0 or "赠" in remark or "free" in remark or "complimentary" in remark:
            return TicketType.FREE
        if ticket.amount > 0 and ("售" in remark or "paid" in remark or "sale" in remark):
            return TicketType.PAID
        if ticket.amount > 0:
            return TicketType.PAID
        return TicketType.UNKNOWN

    def _build_batches(self, run: SettlementRun):
        batches: Dict[str, BatchSummary] = {}
        for ticket in run.tickets:
            if ticket.batch_no not in batches:
                batches[ticket.batch_no] = BatchSummary(batch_no=ticket.batch_no)
            batch = batches[ticket.batch_no]
            batch.total_tickets += 1
            batch.total_amount += ticket.amount
            if ticket.ticket_type == TicketType.FREE:
                batch.free_count += 1
            elif ticket.ticket_type == TicketType.PAID:
                batch.paid_count += 1
            else:
                batch.unknown_count += 1

        for batch in batches.values():
            self._classify_batch(batch)

        run.batches = batches

    def _classify_batch(self, batch: BatchSummary):
        has_free = batch.free_count > 0
        has_paid = batch.paid_count > 0
        if has_free and has_paid:
            batch.status = BatchStatus.MIXED
            batch.needs_review = True
        else:
            batch.status = BatchStatus.NORMAL
            batch.needs_review = False

    def _generate_alerts(self, run: SettlementRun):
        alerts: List[AuthAlert] = []
        for batch_no, batch in run.batches.items():
            tickets_in_batch = [t for t in run.tickets if t.batch_no == batch_no]
            if batch.status == BatchStatus.MIXED:
                free_tickets = [t for t in tickets_in_batch if t.ticket_type == TicketType.FREE]
                paid_tickets = [t for t in tickets_in_batch if t.ticket_type == TicketType.PAID]
                alert = AuthAlert(
                    batch_no=batch_no,
                    level=AlertLevel.BLOCKER,
                    title=f"批次 {batch_no} 存在赠票售票混批",
                    reason=f"该批次共 {batch.total_tickets} 张票，其中赠票 {batch.free_count} 张、售票 {batch.paid_count} 张，两类票混在同一批次结算，可能影响餐补计算口径。",
                    missing_materials=[
                        "录音师对该批次票种划分的确认说明",
                        "赠票对应的艺人授权期限页"
                    ],
                    next_step="请先转录音师复核确认票种归属，待确认后再由版权运营小鹿补充授权期限页。",
                    assignee="录音师",
                    trigger_ticket_nos=[t.ticket_no for t in tickets_in_batch],
                    trigger_remarks=[f"{t.ticket_no}: {t.audio_remark}" for t in tickets_in_batch]
                )
                alerts.append(alert)

            missing_auth = [t for t in tickets_in_batch if not t.auth_period]
            if missing_auth and batch.status != BatchStatus.MIXED:
                alert = AuthAlert(
                    batch_no=batch_no,
                    level=AlertLevel.WARNING,
                    title=f"批次 {batch_no} 缺 {len(missing_auth)} 条授权期限",
                    reason=f"该批次有 {len(missing_auth)} 张票尚未补录授权期限页信息。",
                    missing_materials=["对应艺人的授权期限页扫描件/照片"],
                    next_step="请版权运营小鹿补充授权期限后重跑。",
                    assignee="版权运营小鹿",
                    trigger_ticket_nos=[t.ticket_no for t in missing_auth],
                    trigger_remarks=[f"{t.ticket_no}: {t.audio_remark} (授权期限={t.auth_period})" for t in missing_auth]
                )
                alerts.append(alert)

            if missing_auth and batch.status == BatchStatus.MIXED:
                auth_alert = next((a for a in alerts if a.batch_no == batch_no), None)
                if auth_alert:
                    auth_alert.missing_materials.append(f"售票部分的授权期限页（缺 {len(missing_auth)} 条）")
                    for t in missing_auth:
                        auth_alert.trigger_remarks.append(f"{t.ticket_no}: 授权期限未补")

        run.alerts = alerts

    def update_auth_period(self, run_id: str, ticket_no: str, auth_period: str, operator: str) -> Tuple[Optional[TicketRecord], Optional[AuthAlert]]:
        run = self._find_run(run_id)
        if not run:
            return None, None

        ticket = next((t for t in run.tickets if t.ticket_no == ticket_no), None)
        if not ticket:
            return None, None

        old_auth = ticket.auth_period or "(未补)"
        ticket.auth_period = auth_period
        ticket.updated_at = datetime.now().isoformat()

        before = f"票号 {ticket_no}({ticket.artist_name}) 授权期限: {old_auth}"
        after = f"票号 {ticket_no}({ticket.artist_name}) 授权期限: {auth_period}"

        self._log_action(
            action=ActionType.AUTH_UPDATE,
            operator=operator,
            target_ticket=ticket.id,
            target_ticket_no=ticket_no,
            before_text=before,
            after_text=after,
            changes={"auth_period": {"old": old_auth, "new": auth_period}},
            reason=f"补录票号 {ticket_no} 的授权期限: {auth_period}",
            affected_results=[f"所属批次: {ticket.batch_no}", f"原始备注: {ticket.audio_remark}"]
        )

        updated_alert = self._refresh_alerts_for_batch(run, ticket.batch_no, operator)
        self._save()
        return ticket, updated_alert

    def _refresh_alerts_for_batch(self, run: SettlementRun, batch_no: str, operator: str) -> Optional[AuthAlert]:
        batch = run.batches.get(batch_no)
        if not batch:
            return None

        tickets_in_batch = [t for t in run.tickets if t.batch_no == batch_no]
        missing_auth = [t for t in tickets_in_batch if not t.auth_period]
        filled_auth = [t for t in tickets_in_batch if t.auth_period]

        existing_alert = next((a for a in run.alerts if a.batch_no == batch_no and "授权期限" in a.title), None)

        if not missing_auth:
            if existing_alert:
                existing_alert.resolved = True
                existing_alert.resolved_at = datetime.now().isoformat()
                existing_alert.updated_at = datetime.now().isoformat()
                existing_alert.title += " - 已补齐"
                existing_alert.reason += f" [已全部补齐于 {datetime.now().strftime('%Y-%m-%d %H:%M')}]"
                self._log_action(
                    action=ActionType.AUTH_UPDATE,
                    operator=operator,
                    target_batch=batch_no,
                    before_text=f"批次 {batch_no} 缺授权期限",
                    after_text=f"批次 {batch_no} 授权期限已全部补齐",
                    changes={"alert_resolved": True},
                    reason=f"批次 {batch_no} 授权期限已全部补齐",
                    affected_results=["授权提醒已解决"]
                )
            return existing_alert
        else:
            if existing_alert:
                existing_alert.reason = f"该批次仍缺 {len(missing_auth)} 条授权期限，已补 {len(filled_auth)} 条。缺: {', '.join(t.ticket_no for t in missing_auth)}"
                existing_alert.updated_at = datetime.now().isoformat()
                existing_alert.trigger_ticket_nos = [t.ticket_no for t in tickets_in_batch]
                existing_alert.trigger_remarks = [
                    f"{t.ticket_no}: {t.audio_remark} | 授权期限={t.auth_period or '未补'}"
                    for t in tickets_in_batch
                ]
            return existing_alert

    def manual_edit_ticket(self, run_id: str, ticket_no: str, field: str, value: str, operator: str, reason: str) -> Optional[TicketRecord]:
        run = self._find_run(run_id)
        if not run:
            return None

        ticket = next((t for t in run.tickets if t.ticket_no == ticket_no), None)
        if not ticket:
            return None

        old_value = getattr(ticket, field, None)

        if field == "ticket_type":
            value = TicketType(value)
        elif field == "amount":
            value = float(value)

        setattr(ticket, field, value)
        ticket.updated_at = datetime.now().isoformat()

        old_display = str(old_value) if old_value is not None else "(空)"
        new_display = str(value.value) if isinstance(value, TicketType) else str(value)

        before_parts = [f"票号 {ticket_no} | {field} = {old_display}"]
        if field == "audio_remark":
            before_parts.append(f"  改前备注: {old_display}")
        after_parts = [f"票号 {ticket_no} | {field} = {new_display}"]
        if field == "audio_remark":
            after_parts.append(f"  改后备注: {new_display}")

        self._build_batches(run)
        self._generate_alerts(run)

        affected = [f"票号 {ticket_no} 的 {field} 变更: {old_display} → {new_display}"]
        batch = run.batches.get(ticket.batch_no)
        if batch and batch.status == BatchStatus.MIXED:
            affected.append(f"批次 {ticket.batch_no} 状态变为混批，需复核")

        self._log_action(
            action=ActionType.MANUAL_EDIT,
            operator=operator,
            target_ticket=ticket.id,
            target_ticket_no=ticket_no,
            before_text="\n".join(before_parts),
            after_text="\n".join(after_parts),
            changes={field: {"old": old_display, "new": new_display}},
            reason=reason,
            affected_results=affected
        )

        self._save()
        return ticket

    def rerun(self, run_id: str, operator: str) -> Optional[SettlementRun]:
        parent_run = self._find_run(run_id)
        if not parent_run:
            return None

        new_run = SettlementRun(
            run_no=len(self.runs) + 1,
            operator=operator,
            source_files=list(parent_run.source_files),
            is_rerun=True,
            parent_run_id=parent_run.run_id,
            tickets=copy.deepcopy(parent_run.tickets)
        )

        self._current_run = new_run
        self._build_batches(new_run)
        self._generate_alerts(new_run)

        diffs = self._compare_runs(parent_run, new_run)

        parent_batch_summary = []
        for bn, b in parent_run.batches.items():
            parent_batch_summary.append(f"  {bn}: {b.status.value} 金额{b.total_amount}")
        new_batch_summary = []
        for bn, b in new_run.batches.items():
            new_batch_summary.append(f"  {bn}: {b.status.value} 金额{b.total_amount}")

        self._log_action(
            action=ActionType.RERUN,
            operator=operator,
            before_text=f"运行 #{parent_run.run_no} 状态:\n" + "\n".join(parent_batch_summary),
            after_text=f"运行 #{new_run.run_no} 状态:\n" + "\n".join(new_batch_summary),
            reason=f"基于运行 #{parent_run.run_no} 重跑",
            affected_results=diffs
        )

        self.runs.append(new_run)
        self._save()
        return new_run

    def _compare_runs(self, old: SettlementRun, new: SettlementRun) -> List[str]:
        diffs = []
        for batch_no, new_batch in new.batches.items():
            old_batch = old.batches.get(batch_no)
            if not old_batch:
                diffs.append(f"新增批次: {batch_no}")
                continue
            if old_batch.status != new_batch.status:
                diffs.append(f"批次 {batch_no} 状态: {old_batch.status} → {new_batch.status}")
            if old_batch.total_amount != new_batch.total_amount:
                diffs.append(f"批次 {batch_no} 金额: {old_batch.total_amount} → {new_batch.total_amount}")

        old_alerts = {a.batch_no + "|" + a.title: a.resolved for a in old.alerts}
        new_alerts = {a.batch_no + "|" + a.title: a.resolved for a in new.alerts}
        for key, resolved in new_alerts.items():
            if key not in old_alerts:
                diffs.append(f"新增提醒: {key}")
            elif old_alerts[key] != resolved:
                diffs.append(f"提醒状态变更: {key} → {'已解决' if resolved else '未解决'}")

        return diffs if diffs else ["重跑后结果无变化"]

    def review_batch(self, run_id: str, batch_no: str, reviewer: str, comment: str) -> Optional[BatchSummary]:
        run = self._find_run(run_id)
        if not run:
            return None

        batch = run.batches.get(batch_no)
        if not batch:
            return None

        old_status = batch.status
        batch.status = BatchStatus.REVIEWED
        batch.needs_review = False
        batch.reviewer = reviewer
        batch.reviewed_at = datetime.now().isoformat()

        for alert in run.alerts:
            if alert.batch_no == batch_no and alert.level == AlertLevel.BLOCKER:
                alert.resolved = True
                alert.resolved_at = datetime.now().isoformat()
                alert.updated_at = datetime.now().isoformat()
                alert.title += " - 已复核"
                alert.next_step = f"录音师已复核：{comment}。请版权运营小鹿补充授权期限。"
                alert.assignee = "版权运营小鹿"

        tickets_summary = []
        for t in run.tickets:
            if t.batch_no == batch_no:
                tickets_summary.append(f"  {t.ticket_no} | {t.artist_name} | {t.ticket_type.value} | {t.audio_remark}")

        self._log_action(
            action=ActionType.REVIEW,
            operator=reviewer,
            target_batch=batch_no,
            before_text=f"批次 {batch_no} 状态: {old_status.value}\n混批票务明细:\n" + "\n".join(tickets_summary),
            after_text=f"批次 {batch_no} 状态: 已复核\n复核意见: {comment}",
            changes={"status": {"old": old_status.value, "new": "已复核"}},
            reason=comment,
            affected_results=[f"批次 {batch_no} 复核完成，解除阻断"]
        )

        self._save()
        return batch

    def get_audit_trail(self, run_id: Optional[str] = None, batch_no: Optional[str] = None, ticket_no: Optional[str] = None) -> List[AuditLog]:
        logs = list(self.audit_logs)
        if ticket_no:
            logs = [l for l in logs if l.target_ticket_no == ticket_no]
        if batch_no:
            logs = [l for l in logs if l.target_batch == batch_no]
        if run_id:
            run = self._find_run(run_id)
            if run:
                ticket_ids = [t.id for t in run.tickets]
                batch_nos = list(run.batches.keys())
                logs = [l for l in logs if l.target_ticket in ticket_ids or l.target_batch in batch_nos or l.target_ticket_no]
        return logs

    def export_report(self, run_id: Optional[str] = None) -> str:
        run = self._find_run(run_id) if run_id else self.get_latest_run()
        if not run:
            return "尚无数据"

        lines = []
        lines.append("=" * 70)
        lines.append("  音乐节艺人餐补结算 - 完整追踪报告")
        lines.append(f"  运行 #{run.run_no} | 操作人: {run.operator} | 时间: {run.created_at}")
        if run.is_rerun:
            lines.append(f"  (重跑自运行 #{self._find_run(run.parent_run_id).run_no if run.parent_run_id and self._find_run(run.parent_run_id) else '?'})")
        lines.append("=" * 70)

        lines.append("")
        lines.append("【一、批次汇总】")
        for batch_no, batch in run.batches.items():
            status_mark = "🔴" if batch.status == BatchStatus.MIXED else ("🟡" if batch.needs_review else "🟢")
            lines.append(f"  {status_mark} {batch_no}: {batch.status.value} | 赠{batch.free_count}/售{batch.paid_count}/疑{batch.unknown_count} | 金额 {batch.total_amount:.2f}")
            if batch.reviewer:
                lines.append(f"     复核人: {batch.reviewer} | 复核于: {batch.reviewed_at}")
                matching_logs = [l for l in self.audit_logs if l.target_batch == batch_no and l.action == ActionType.REVIEW]
                for log in matching_logs:
                    lines.append(f"     复核意见: {log.reason}")

        lines.append("")
        lines.append("【二、票务明细（含原始备注和授权状态）】")
        for t in run.tickets:
            auth_status = t.auth_period or "⚠ 未补"
            lines.append(f"  {t.ticket_no} | {t.batch_no} | {t.artist_name} | {t.ticket_type.value} | 金额{t.amount:.2f}")
            lines.append(f"    原始备注: {t.original_remark}")
            if t.audio_remark != t.original_remark:
                lines.append(f"    当前备注: {t.audio_remark}")
            lines.append(f"    授权期限: {auth_status}")
            if t.updated_at:
                change_logs = [l for l in self.audit_logs if l.target_ticket_no == t.ticket_no]
                for cl in change_logs:
                    lines.append(f"    变更记录({cl.timestamp}): {cl.before_text} → {cl.after_text} | 原因: {cl.reason}")

        lines.append("")
        lines.append("【三、授权提醒（为什么被留下、缺什么、找谁）】")
        for alert in run.alerts:
            status = "✅ 已解决" if alert.resolved else "⏳ 待处理"
            level_mark = "🛑" if alert.level == AlertLevel.BLOCKER else "⚠️"
            lines.append(f"  {level_mark} {alert.title}  -  {status}")
            lines.append(f"    负责人: {alert.assignee}")
            lines.append(f"    为什么被留下: {alert.reason}")
            lines.append(f"    还缺什么材料: {'; '.join(alert.missing_materials)}")
            lines.append(f"    下一步该找谁: {alert.next_step}")
            if alert.trigger_remarks:
                lines.append(f"    触发此提醒的原始备注:")
                for tr in alert.trigger_remarks:
                    lines.append(f"      - {tr}")

        lines.append("")
        lines.append("【四、审计轨迹（谁改了什么、为什么改、改完影响什么）】")
        for log in self.audit_logs:
            action_map = {
                ActionType.IMPORT: "📥 导入",
                ActionType.MANUAL_EDIT: "✏️ 人工修正",
                ActionType.RERUN: "🔄 重跑",
                ActionType.AUTH_UPDATE: "📄 授权更新",
                ActionType.REVIEW: "✅ 复核"
            }
            action_str = action_map.get(log.action, log.action.value)
            lines.append(f"  {action_str} | {log.operator} | {log.timestamp}")
            lines.append(f"    原因: {log.reason}")
            if log.before_text:
                lines.append(f"    改前: {log.before_text[:200]}")
            if log.after_text:
                lines.append(f"    改后: {log.after_text[:200]}")
            if log.changes:
                for field, change in log.changes.items():
                    if isinstance(change, dict) and "old" in change and "new" in change:
                        lines.append(f"    字段变更: {field} = {change['old']} → {change['new']}")
                    else:
                        lines.append(f"    字段变更: {field} = {change}")
            if log.affected_results:
                lines.append(f"    影响结果: {'; '.join(log.affected_results)}")

        lines.append("")
        lines.append("=" * 70)
        return "\n".join(lines)

    def _find_run(self, run_id: str) -> Optional[SettlementRun]:
        return next((r for r in self.runs if r.run_id == run_id), None)

    def get_latest_run(self) -> Optional[SettlementRun]:
        return self.runs[-1] if self.runs else None

    def _log_action(self, **kwargs):
        log = AuditLog(**kwargs)
        self.audit_logs.append(log)
