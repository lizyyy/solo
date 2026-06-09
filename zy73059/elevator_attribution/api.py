from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from .models import FilterCriteria, FaultStatus, ChangeType, BlockReason
from .processor import AttributionProcessor


class AttributionAPI:
    """
    对外接口封装层（对接前端 / 导出工具 / 值班脚本）。

    所有查询类接口的返回中都会把本次使用的 filter_criteria 带回，
    确保"屏幕上看到的数字"和"导出文件里的数字"口径一致，不会分家。
    """

    def __init__(self, processor: AttributionProcessor):
        self.proc = processor

    # ---------- 统计汇总（屏幕首页）----------
    def summary(self, criteria: Optional[FilterCriteria] = None) -> Dict[str, Any]:
        if criteria is None:
            criteria = FilterCriteria()
        export = self.proc.export_records(criteria, include_chain=False)
        return {
            "ok": True,
            "filter_criteria": export.filter_criteria,
            "total_count": export.total_count,
            "summary_stats": export.summary_stats,
            "records": [
                {k: r[k] for k in ("fault_id", "elevator_id", "occurred_at",
                                   "fault_code", "status", "root_cause",
                                   "attribution_confidence", "block_reason",
                                   "audit_count", "sensor_log_count")}
                for r in export.records
            ],
        }

    # ---------- 列表 + 筛选（和 summary 共用一套 criteria）----------
    def list_faults(self, criteria: Optional[FilterCriteria] = None,
                    page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        if criteria is None:
            criteria = FilterCriteria()
        export = self.proc.export_records(criteria, include_chain=False)
        total = len(export.records)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "ok": True,
            "filter_criteria": export.filter_criteria,
            "pagination": {
                "page": page, "page_size": page_size,
                "total": total, "total_pages": (total + page_size - 1) // page_size,
            },
            "records": export.records[start:end],
            "summary_stats": export.summary_stats,
        }

    # ---------- 详情 + 链路追踪（从汇总一路追到异常）----------
    def fault_detail(self, fault_id: str) -> Dict[str, Any]:
        record = self.proc.get_record(fault_id)
        if not record:
            return {"ok": False, "error": f"fault {fault_id} 不存在"}
        trace = self.proc.trace_chain(fault_id)
        return {
            "ok": True,
            "fault": record.to_dict(include_chain=False),
            "trace": trace,
        }

    # ---------- 导出（和 list_faults / summary 口径完全一致）----------
    def export(self, criteria: Optional[FilterCriteria] = None,
               format: str = "json") -> Dict[str, Any]:
        """
        format: json | csv_headers
        返回中必含 filter_criteria，确保导出数字和屏幕数字同源。
        """
        if criteria is None:
            criteria = FilterCriteria()
        export = self.proc.export_records(criteria, include_chain=True)
        payload = export.to_dict()

        if format == "csv_headers":
            payload["csv_headers"] = [
                "fault_id", "elevator_id", "occurred_at", "fault_code",
                "fault_desc", "status", "root_cause", "attributor",
                "attributed_at", "block_reason", "attribution_confidence",
                "audit_count", "sensor_log_count",
            ]
        payload["format"] = format
        payload["note"] = (
            "本导出文件附带本次使用的 filter_criteria。"
            "若与同期屏幕数字不一致，请先核对 filter_criteria 字段，再联系算法值班人。"
        )
        return payload

    # ---------- 交接：上一班改了什么 ----------
    def handover_report(self, since_ts: str,
                        operator: Optional[str] = None) -> Dict[str, Any]:
        text = self.proc.format_handover_diff(since_ts, operator)
        changes = self.proc.list_changes(operator=operator, since_ts=since_ts)
        return {
            "ok": True,
            "since": since_ts,
            "operator": operator,
            "change_count": len(changes),
            "changes": [c.to_dict() for c in changes],
            "handover_text": text,
        }

    # ---------- 操作：归因 / 撤回日志 / 强制归因 ----------
    def do_attribution(self, fault_id: str, root_cause: str,
                       operator: str, confidence: float = 0.8,
                       force: bool = False) -> Dict[str, Any]:
        return self.proc.run_attribution(
            fault_id=fault_id, root_cause=root_cause,
            operator=operator, confidence=confidence, force=force,
        )

    def do_revoke_log(self, fault_id: str, log_id: str,
                      operator: str, revoke_note: str = "") -> Dict[str, Any]:
        return self.proc.revoke_sensor_log(
            fault_id=fault_id, log_id=log_id,
            operator=operator, revoke_note=revoke_note,
        )

    # ---------- 坏材料排查路径 ----------
    def bad_material_triage(self, fault_id: Optional[str] = None) -> Dict[str, Any]:
        """
        坏材料来了先看这里：
          1) 已拦截(BLOCKED)列表 —— 先看 block_reason + block_detail
          2) 传感器撤回记录 —— 再看 revoked logs 及说明
          3) 置信度低(<0.6) 的已归因 —— 最后复核
        """
        criteria = FilterCriteria()
        export = self.proc.export_records(criteria, include_chain=True)

        blocked = [r for r in export.records if r["status"] == FaultStatus.BLOCKED.value]
        low_conf = [
            r for r in export.records
            if r["status"] == FaultStatus.ATTRIBUTED.value
            and r["attribution_confidence"] < 0.6
        ]
        with_revoked = []
        for r in export.records:
            rv = [s for s in r.get("sensor_logs", []) if s["is_revoked"]]
            if rv:
                with_revoked.append({
                    "fault_id": r["fault_id"],
                    "elevator_id": r["elevator_id"],
                    "status": r["status"],
                    "revoked_logs": rv,
                })

        return {
            "ok": True,
            "steps": [
                "Step 1: 看 BLOCKED 列表 —— 先处理被拦住的（采样断档 / 撤回未填说明）",
                "Step 2: 看 REVOKED 日志 —— 核对撤回说明是否充分，是否影响归因",
                "Step 3: 看低置信度（<0.6）—— 最后复核算法判断",
            ],
            "blocked": [
                {
                    "fault_id": b["fault_id"],
                    "elevator_id": b["elevator_id"],
                    "block_reason": b["block_reason"],
                    "block_detail": b["block_detail"],
                    "detail_link": f"api.fault_detail('{b['fault_id']}')",
                }
                for b in blocked
            ],
            "with_revoked": with_revoked,
            "low_confidence": [
                {
                    "fault_id": l["fault_id"],
                    "elevator_id": l["elevator_id"],
                    "confidence": l["attribution_confidence"],
                    "root_cause": l["root_cause"],
                    "detail_link": f"api.fault_detail('{l['fault_id']}')",
                }
                for l in low_conf
            ],
        }
