from datetime import datetime
from typing import List, Dict, Optional, Tuple
import copy
import json

from models import (
    TicketRecord, TicketType, BatchSummary, BatchStatus,
    AuthAlert, AlertLevel, AuditLog, ActionType, SettlementRun
)


class SettlementEngine:
    def __init__(self):
        self.runs: List[SettlementRun] = []
        self.audit_logs: List[AuditLog] = []
        self._current_run: Optional[SettlementRun] = None

    def import_audio_remarks(self, audio_data: List[Dict], operator: str, source_file: str = "audio_remarks.txt") -> SettlementRun:
        run = SettlementRun(
            run_no=len(self.runs) + 1,
            operator=operator,
            source_files=[source_file]
        )
        self._current_run = run

        for item in audio_data:
            ticket = TicketRecord(
                batch_no=item.get("batch_no", ""),
                ticket_no=item.get("ticket_no", ""),
                artist_name=item.get("artist_name", ""),
                amount=float(item.get("amount", 0)),
                audio_remark=item.get("remark", ""),
                source_file=source_file
            )
            ticket.ticket_type = self._infer_ticket_type(ticket)
            run.tickets.append(ticket)

        self._build_batches(run)
        self._generate_alerts(run)

        self._log_action(
            action=ActionType.IMPORT,
            operator=operator,
            reason=f"从 {source_file} 导入音频备注 {len(run.tickets)} 条",
            affected_results=[f"创建批次: {list(run.batches.keys())}"]
        )

        self.runs.append(run)
        return run

    def _infer_ticket_type(self, ticket: TicketRecord) -> TicketType:
        remark = ticket.audio_remark.lower()
        if ticket.amount <= 0 or "赠" in remark or "free" in remark or " complimentary" in remark:
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
            if batch.status == BatchStatus.MIXED:
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
                    assignee="录音师"
                )
                alerts.append(alert)

            tickets_in_batch = [t for t in run.tickets if t.batch_no == batch_no]
            missing_auth = [t for t in tickets_in_batch if not t.auth_period]
            if missing_auth and batch.status != BatchStatus.MIXED:
                alert = AuthAlert(
                    batch_no=batch_no,
                    level=AlertLevel.WARNING,
                    title=f"批次 {batch_no} 缺 {len(missing_auth)} 条授权期限",
                    reason=f"该批次有 {len(missing_auth)} 张票尚未补录授权期限页信息。",
                    missing_materials=["对应艺人的授权期限页扫描件/照片"],
                    next_step="请版权运营小鹿补充授权期限后重跑。",
                    assignee="版权运营小鹿"
                )
                alerts.append(alert)

        run.alerts = alerts

    def update_auth_period(self, run_id: str, ticket_no: str, auth_period: str, operator: str) -> Tuple[Optional[TicketRecord], Optional[AuthAlert]]:
        run = self._find_run(run_id)
        if not run:
            return None, None

        ticket = next((t for t in run.tickets if t.ticket_no == ticket_no), None)
        if not ticket:
            return None, None

        old_auth = ticket.auth_period
        ticket.auth_period = auth_period
        ticket.updated_at = datetime.now()

        self._log_action(
            action=ActionType.AUTH_UPDATE,
            operator=operator,
            target_ticket=ticket.id,
            changes={"auth_period": {"old": old_auth, "new": auth_period}},
            reason=f"补录票号 {ticket_no} 的授权期限: {auth_period}",
            affected_results=[f"所属批次: {ticket.batch_no}"]
        )

        updated_alert = self._refresh_alerts_for_batch(run, ticket.batch_no, operator)
        return ticket, updated_alert

    def _refresh_alerts_for_batch(self, run: SettlementRun, batch_no: str, operator: str) -> Optional[AuthAlert]:
        batch = run.batches.get(batch_no)
        if not batch:
            return None

        tickets_in_batch = [t for t in run.tickets if t.batch_no == batch_no]
        missing_auth = [t for t in tickets_in_batch if not t.auth_period]

        existing_alert = next((a for a in run.alerts if a.batch_no == batch_no and "授权期限" in a.title), None)

        if not missing_auth:
            if existing_alert:
                existing_alert.resolved = True
                existing_alert.resolved_at = datetime.now()
                existing_alert.updated_at = datetime.now()
                existing_alert.title += " - 已补齐"
                self._log_action(
                    action=ActionType.AUTH_UPDATE,
                    operator=operator,
                    target_batch=batch_no,
                    changes={"alert_resolved": True},
                    reason=f"批次 {batch_no} 授权期限已全部补齐",
                    affected_results=["授权提醒已解决"]
                )
            return existing_alert
        else:
            if existing_alert:
                existing_alert.reason = f"该批次仍缺 {len(missing_auth)} 条授权期限，已补 {len(tickets_in_batch) - len(missing_auth)} 条。"
                existing_alert.updated_at = datetime.now()
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

        self._build_batches(run)
        self._generate_alerts(run)

        affected = [f"票号 {ticket_no} 的 {field} 变更"]
        batch = run.batches.get(ticket.batch_no)
        if batch and batch.status == BatchStatus.MIXED:
            affected.append(f"批次 {ticket.batch_no} 状态变为混批，需复核")

        self._log_action(
            action=ActionType.MANUAL_EDIT,
            operator=operator,
            target_ticket=ticket.id,
            changes={field: {"old": old_value, "new": value}},
            reason=reason,
            affected_results=affected
        )

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
        self._log_action(
            action=ActionType.RERUN,
            operator=operator,
            reason=f"基于运行 #{parent_run.run_no} 重跑",
            affected_results=diffs
        )

        self.runs.append(new_run)
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

        old_alerts = {a.batch_no + a.title: a.resolved for a in old.alerts}
        new_alerts = {a.batch_no + a.title: a.resolved for a in new.alerts}
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

        batch.status = BatchStatus.REVIEWED
        batch.needs_review = False
        batch.reviewer = reviewer
        batch.reviewed_at = datetime.now()

        for alert in run.alerts:
            if alert.batch_no == batch_no and alert.level == AlertLevel.BLOCKER:
                alert.resolved = True
                alert.resolved_at = datetime.now()
                alert.updated_at = datetime.now()
                alert.title += " - 已复核"
                alert.next_step = f"录音师已复核：{comment}。请版权运营小鹿补充授权期限。"
                alert.assignee = "版权运营小鹿"

        self._log_action(
            action=ActionType.REVIEW,
            operator=reviewer,
            target_batch=batch_no,
            changes={"status": {"old": BatchStatus.MIXED, "new": BatchStatus.REVIEWED}},
            reason=comment,
            affected_results=[f"批次 {batch_no} 复核完成，解除阻断"]
        )

        return batch

    def get_audit_trail(self, run_id: Optional[str] = None, batch_no: Optional[str] = None) -> List[AuditLog]:
        logs = self.audit_logs
        if run_id:
            run = self._find_run(run_id)
            if run:
                ticket_ids = [t.id for t in run.tickets]
                batch_nos = list(run.batches.keys())
                logs = [l for l in logs if l.target_ticket in ticket_ids or l.target_batch in batch_nos]
        if batch_no:
            logs = [l for l in logs if l.target_batch == batch_no]
        return logs

    def _find_run(self, run_id: str) -> Optional[SettlementRun]:
        return next((r for r in self.runs if r.run_id == run_id), None)

    def get_latest_run(self) -> Optional[SettlementRun]:
        return self.runs[-1] if self.runs else None

    def _log_action(self, **kwargs):
        log = AuditLog(**kwargs)
        self.audit_logs.append(log)
