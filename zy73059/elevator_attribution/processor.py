from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import uuid
import json

from .models import (
    FaultRecord, SensorLog, AuditLog, AttributionChain,
    FilterCriteria, ExportResult,
    FaultStatus, ChangeType, BlockReason
)


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _short_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class AttributionProcessor:
    """
    电梯故障异常归因核心处理器：
    - 采样断档检测（SAMPLE_GAP 拦截）
    - 撤回记录检测（REVOKED_PENDING 拦截）
    - 变动审计（上一班改了什么一眼可见）
    - 归因链路构建（汇总 -> 详情 -> 原始日志 不中断）
    """

    SAMPLE_GAP_THRESHOLD_SEC = 120

    def __init__(self):
        self._records: Dict[str, FaultRecord] = {}

    # ===== 基础 CRUD =====
    def add_record(self, record: FaultRecord) -> None:
        self._records[record.fault_id] = record

    def get_record(self, fault_id: str) -> Optional[FaultRecord]:
        return self._records.get(fault_id)

    def list_all(self) -> List[FaultRecord]:
        return list(self._records.values())

    # ===== 变更审计（交接核心：上一班改了什么）=====
    def _append_audit(
        self,
        record: FaultRecord,
        change_type: ChangeType,
        operator: str,
        before: Optional[Dict[str, Any]],
        after: Optional[Dict[str, Any]],
        change_note: str = ""
    ) -> AuditLog:
        log = AuditLog(
            change_id=_short_id("chg"),
            fault_id=record.fault_id,
            change_type=change_type,
            operator=operator,
            timestamp=_now_iso(),
            before=before,
            after=after,
            change_note=change_note
        )
        record.audit_logs.append(log)
        return log

    def list_changes(self, fault_id: Optional[str] = None,
                     operator: Optional[str] = None,
                     since_ts: Optional[str] = None) -> List[AuditLog]:
        """
        交接时用：列出所有变更。
        可以按故障ID、操作人、时间起过滤。
        """
        changes: List[AuditLog] = []
        for rec in self._records.values():
            if fault_id and rec.fault_id != fault_id:
                continue
            for al in rec.audit_logs:
                if operator and al.operator != operator:
                    continue
                if since_ts and al.timestamp < since_ts:
                    continue
                changes.append(al)
        changes.sort(key=lambda x: x.timestamp, reverse=True)
        return changes

    def format_handover_diff(self, since_ts: str, operator: Optional[str] = None) -> str:
        """
        生成简短交接文字：上一班某人从某时刻起改了什么。
        """
        changes = self.list_changes(operator=operator, since_ts=since_ts)
        if not changes:
            return f"[{since_ts} 起] 无变更记录。"
        lines = [f"交接变更清单（{len(changes)} 条，自 {since_ts}）："]
        for c in changes[:20]:
            lines.append(
                f"  - {c.timestamp} {c.operator} 对 {c.fault_id} 执行【{c.change_type.value}】"
                f"{('：' + c.change_note) if c.change_note else ''}"
            )
        if len(changes) > 20:
            lines.append(f"  ... 另有 {len(changes) - 20} 条略。")
        return "\n".join(lines)

    # ===== 拦截检测：采样断档 =====
    def detect_sample_gap(self, record: FaultRecord) -> Optional[Tuple[BlockReason, str]]:
        """
        检查传感器日志是否存在断档：
        - 按时间排序后，相邻日志间隔超过阈值即视为断档
        - 返回断档区间描述，用于 block_detail
        """
        logs = sorted(
            [s for s in record.sensor_logs if not s.is_revoked],
            key=lambda x: x.ts
        )
        if len(logs) < 2:
            return None

        fmt = "%Y-%m-%d %H:%M:%S"
        gaps = []
        for i in range(1, len(logs)):
            try:
                t_prev = datetime.strptime(logs[i - 1].ts, fmt)
                t_curr = datetime.strptime(logs[i].ts, fmt)
            except ValueError:
                continue
            delta = (t_curr - t_prev).total_seconds()
            if delta > self.SAMPLE_GAP_THRESHOLD_SEC:
                gaps.append(
                    f"{logs[i-1].ts} → {logs[i].ts} 断档 {int(delta)}秒"
                    f"（{logs[i-1].log_id} / {logs[i].log_id}）"
                )

        if gaps:
            detail = (
                f"传感器日志存在 {len(gaps)} 处断档（阈值 {self.SAMPLE_GAP_THRESHOLD_SEC}s）："
                + "；".join(gaps)
                + "。请补充采样后重新归因。"
            )
            return BlockReason.SAMPLE_GAP, detail
        return None

    # ===== 拦截检测：存在待确认撤回 =====
    def detect_pending_revokes(self, record: FaultRecord) -> Optional[Tuple[BlockReason, str]]:
        revoked = [s for s in record.sensor_logs if s.is_revoked]
        if not revoked:
            return None
        unconfirmed = [r for r in revoked if not r.revoke_note.strip()]
        if unconfirmed:
            ids = ", ".join(r.log_id for r in unconfirmed)
            detail = (
                f"存在 {len(unconfirmed)} 条传感器日志已撤回但未填写撤回说明：{ids}。"
                f"请补充撤回原因后再归因。"
            )
            return BlockReason.REVOKED_PENDING, detail
        return None

    # ===== 归因入口：先做拦截，再归因 =====
    def run_attribution(
        self,
        fault_id: str,
        root_cause: str,
        operator: str,
        confidence: float = 0.8,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        核心归因流程。返回 {'blocked': bool, 'status': ..., 'reason': ...}。
        force=True 可跳过拦截（人工强制归因）。
        """
        record = self._records.get(fault_id)
        if not record:
            return {"ok": False, "error": f"fault {fault_id} 不存在"}

        before = record.to_dict(include_chain=False)

        if not force:
            # 采样断档检查
            gap = self.detect_sample_gap(record)
            if gap:
                record.status = FaultStatus.BLOCKED
                record.block_reason = gap[0]
                record.block_detail = gap[1]
                self._append_audit(
                    record, ChangeType.BLOCK, operator,
                    before=before, after=record.to_dict(include_chain=False),
                    change_note=f"拦截原因：{gap[0].value}"
                )
                return {
                    "ok": True,
                    "blocked": True,
                    "fault_id": fault_id,
                    "status": record.status.value,
                    "block_reason": gap[0].value,
                    "block_detail": gap[1],
                }

            # 撤回待确认检查
            rev = self.detect_pending_revokes(record)
            if rev:
                record.status = FaultStatus.BLOCKED
                record.block_reason = rev[0]
                record.block_detail = rev[1]
                self._append_audit(
                    record, ChangeType.BLOCK, operator,
                    before=before, after=record.to_dict(include_chain=False),
                    change_note=f"拦截原因：{rev[0].value}"
                )
                return {
                    "ok": True,
                    "blocked": True,
                    "fault_id": fault_id,
                    "status": record.status.value,
                    "block_reason": rev[0].value,
                    "block_detail": rev[1],
                }

        # 通过拦截 -> 完成归因
        old_status = record.status.value
        record.status = FaultStatus.ATTRIBUTED
        record.root_cause = root_cause
        record.attributor = operator
        record.attributed_at = _now_iso()
        record.attribution_confidence = confidence
        record.block_reason = None
        record.block_detail = ""

        # 先占位，等 audit log 生成后再补 chain（确保 chain 包含本次变动）
        chain_id_placeholder = _short_id("chn")

        audit = self._append_audit(
            record, ChangeType.UPDATE_ATTRIBUTION, operator,
            before=before, after=record.to_dict(include_chain=False),
            change_note=(
                f"归因完成：{root_cause}（置信度 {confidence:.2f}）。"
                f"前状态={old_status}；链路={chain_id_placeholder}"
            )
        )

        # 构建归因链路（汇总 -> 详情 -> 原始日志 -> 变动）——必须包含本次 audit
        change_ids = [a.change_id for a in record.audit_logs[-3:]]
        if audit.change_id not in change_ids:
            change_ids.append(audit.change_id)

        chain = AttributionChain(
            chain_id=chain_id_placeholder,
            fault_id=fault_id,
            summary_id=f"sum_{fault_id}",
            detail_id=f"det_{fault_id}",
            raw_log_ids=[s.log_id for s in record.sensor_logs],
            change_ids=change_ids,
        )
        record.chains.append(chain)

        return {
            "ok": True,
            "blocked": False,
            "fault_id": fault_id,
            "status": record.status.value,
            "root_cause": root_cause,
            "confidence": confidence,
            "chain_id": chain.chain_id,
        }

    # ===== 撤回接口（传感器日志级别）=====
    def revoke_sensor_log(self, fault_id: str, log_id: str,
                          operator: str, revoke_note: str = "") -> Dict[str, Any]:
        record = self._records.get(fault_id)
        if not record:
            return {"ok": False, "error": f"fault {fault_id} 不存在"}

        log = next((s for s in record.sensor_logs if s.log_id == log_id), None)
        if not log:
            return {"ok": False, "error": f"log {log_id} 不存在"}

        before_log = {"is_revoked": log.is_revoked, "revoke_note": log.revoke_note}
        log.is_revoked = True
        if revoke_note:
            log.revoke_note = revoke_note

        self._append_audit(
            record, ChangeType.REVOKE, operator,
            before={"log_id": log_id, **before_log},
            after={"log_id": log_id, "is_revoked": True, "revoke_note": log.revoke_note},
            change_note=f"撤回传感器日志 {log_id}" + (f"：{revoke_note}" if revoke_note else "")
        )

        if record.status == FaultStatus.ATTRIBUTED:
            record.status = FaultStatus.PENDING

        return {"ok": True, "fault_id": fault_id, "log_id": log_id, "is_revoked": True}

    # ===== 归因链路追踪：算法值班人一路追到底 =====
    def trace_chain(self, fault_id: str) -> Dict[str, Any]:
        """
        从汇总一路追到异常记录。
        返回：summary -> detail -> raw_logs -> changes（变动原因不断层）
        """
        record = self._records.get(fault_id)
        if not record:
            return {"ok": False, "error": f"fault {fault_id} 不存在"}

        chains = []
        for ch in record.chains:
            raw_logs = [
                s.to_dict() for s in record.sensor_logs
                if s.log_id in ch.raw_log_ids
            ]
            changes = [
                a.to_dict() for a in record.audit_logs
                if a.change_id in ch.change_ids
            ]
            chains.append({
                "chain_id": ch.chain_id,
                "summary": {
                    "summary_id": ch.summary_id,
                    "fault_id": fault_id,
                    "elevator_id": record.elevator_id,
                    "status": record.status.value,
                    "root_cause": record.root_cause,
                    "confidence": record.attribution_confidence,
                },
                "detail": {
                    "detail_id": ch.detail_id,
                    "fault_code": record.fault_code,
                    "fault_desc": record.fault_desc,
                    "occurred_at": record.occurred_at,
                    "attributor": record.attributor,
                    "attributed_at": record.attributed_at,
                    "block_reason": record.block_reason.value if record.block_reason else None,
                    "block_detail": record.block_detail,
                },
                "raw_logs": raw_logs,
                "changes": changes,
            })

        if record.status == FaultStatus.BLOCKED and not chains:
            chains.append({
                "chain_id": _short_id("tch"),
                "summary": {
                    "fault_id": fault_id,
                    "elevator_id": record.elevator_id,
                    "status": record.status.value,
                    "root_cause": record.root_cause,
                    "confidence": 0.0,
                },
                "detail": {
                    "fault_code": record.fault_code,
                    "fault_desc": record.fault_desc,
                    "occurred_at": record.occurred_at,
                    "block_reason": record.block_reason.value if record.block_reason else None,
                    "block_detail": record.block_detail,
                },
                "raw_logs": [s.to_dict() for s in record.sensor_logs],
                "changes": [a.to_dict() for a in record.audit_logs],
            })

        return {
            "ok": True,
            "fault_id": fault_id,
            "status": record.status.value,
            "chain_count": len(chains),
            "chains": chains,
        }

    # ===== 筛选 & 导出（筛选口径留在接口返回里，和记录不分家）=====
    def apply_filter(self, criteria: FilterCriteria) -> List[FaultRecord]:
        results = []
        for rec in self._records.values():
            if criteria.start_date and rec.occurred_at < criteria.start_date:
                continue
            if criteria.end_date and rec.occurred_at > criteria.end_date:
                continue
            if criteria.elevator_ids and rec.elevator_id not in criteria.elevator_ids:
                continue
            if criteria.status_list and rec.status not in criteria.status_list:
                continue
            if criteria.fault_codes and rec.fault_code not in criteria.fault_codes:
                continue
            if (criteria.min_confidence is not None
                    and rec.attribution_confidence < criteria.min_confidence):
                continue
            results.append(rec)
        return results

    def export_records(self, criteria: FilterCriteria,
                       include_chain: bool = True) -> ExportResult:
        """
        导出：records 里的数字和筛选口径 filter_criteria 同一次返回，
        不会出现"屏幕数字"和"导出文件"分家的问题。
        """
        filtered = self.apply_filter(criteria)
        records = [r.to_dict(include_chain=include_chain) for r in filtered]

        by_status: Dict[str, int] = {}
        by_elevator: Dict[str, int] = {}
        for r in filtered:
            by_status[r.status.value] = by_status.get(r.status.value, 0) + 1
            by_elevator[r.elevator_id] = by_elevator.get(r.elevator_id, 0) + 1

        blocked_detail = [
            {
                "fault_id": r.fault_id,
                "block_reason": r.block_reason.value if r.block_reason else None,
                "block_detail": r.block_detail,
            }
            for r in filtered if r.status == FaultStatus.BLOCKED
        ]

        summary = {
            "by_status": by_status,
            "by_elevator": by_elevator,
            "avg_confidence": (
                round(sum(r.attribution_confidence for r in filtered
                         if r.status == FaultStatus.ATTRIBUTED)
                      / max(1, sum(1 for r in filtered
                                    if r.status == FaultStatus.ATTRIBUTED)), 3)
            ),
            "blocked_count": len(blocked_detail),
            "blocked_detail": blocked_detail,
        }

        return ExportResult(
            export_ts=_now_iso(),
            total_count=len(records),
            filter_criteria=criteria.to_dict(),
            records=records,
            summary_stats=summary,
        )
