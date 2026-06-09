"""边界样本追踪：一条边界样本能追到最终说法，不依赖班组交接凑结论"""
from datetime import datetime
from typing import List, Dict, Optional, Any

from .models import AttributionRecord, EvidenceItem, AnomalyLevel, BoundaryReason


class VerdictStatus:
    PENDING = "待人工确认"
    CONFIRMED_WARNING = "人工确认-预警"
    CONFIRMED_CRITICAL = "人工确认-严重"
    CONFIRMED_NORMAL = "人工确认-正常"
    ESCALATED = "上报专家"


class BoundaryTracker:
    def __init__(self):
        self._verdicts: Dict[str, Dict] = {}

    def is_boundary(self, record: AttributionRecord) -> bool:
        return record.level == AnomalyLevel.BOUNDARY or record.boundary_detail.is_boundary

    def classify_boundary(self, record: AttributionRecord) -> Dict[str, Any]:
        """说明一条边界样本卡在公式、单位还是阈值"""
        bd = record.boundary_detail
        result = {
            "record_id": record.record_id,
            "is_boundary": self.is_boundary(record),
            "stuck_at": "",
            "stuck_detail": "",
            "metric": bd.metric,
            "formula": bd.formula,
            "raw_value": bd.raw_value,
            "threshold": bd.threshold_value,
            "tolerance": bd.tolerance,
            "unit": bd.unit,
            "handover_only": False,
        }
        if not result["is_boundary"]:
            return result

        reason = bd.reason
        if reason == BoundaryReason.FORMULA:
            result["stuck_at"] = "公式"
            result["stuck_detail"] = f"公式判定逻辑边界: {bd.formula}"
        elif reason == BoundaryReason.UNIT:
            result["stuck_at"] = "单位"
            result["stuck_detail"] = bd.description
        elif reason == BoundaryReason.THRESHOLD:
            result["stuck_at"] = "阈值"
            result["stuck_detail"] = (f"数值{bd.raw_value}{bd.unit}卡在阈值{bd.threshold_value}±{bd.tolerance}容差带内, "
                                       f"超出自动判定范围")
        else:
            result["stuck_at"] = "未知"
            result["stuck_detail"] = "边界原因未明确"

        if record.handover_notes and not record.evidence_chain:
            result["handover_only"] = True

        return result

    def build_evidence_trace(self, record: AttributionRecord) -> Dict[str, Any]:
        """构建从原始记录→判定步骤→最终说法的完整证据链，不靠班组交接凑结论"""
        trace = {
            "record_id": record.record_id,
            "turbine": record.measurement.turbine_id,
            "blade": f"B{record.measurement.blade_no}",
            "timestamp": record.measurement.timestamp,
            "data_sources": [],
            "calculation_steps": [],
            "intermediate_results": [],
            "final_verdict": {
                "level": record.level.value,
                "root_cause": record.root_cause,
                "conclusion": record.conclusion,
                "source": record.final_verdict_source,
                "needs_manual": record.level == AnomalyLevel.BOUNDARY
            },
            "handover_notes_presence": bool(record.handover_notes),
            "trace_complete": False
        }

        src = record.measurement.source
        trace["data_sources"].append(f"原始测量数据(来源:{src})")
        if record.handover_notes:
            trace["data_sources"].append("班组交接备注(仅作参考,不作唯一依据)")

        for ev in record.evidence_chain:
            trace["calculation_steps"].append({
                "order": ev.step_order,
                "name": ev.step_name,
                "formula": ev.calculation,
                "inputs": ev.source_data
            })
            trace["intermediate_results"].append({
                "step": ev.step_name,
                "result": ev.intermediate_result,
                "time": ev.timestamp
            })

        has_real_evidence = len(record.evidence_chain) >= 3
        trace["trace_complete"] = has_real_evidence

        if record.level == AnomalyLevel.BOUNDARY:
            verdict = self._verdicts.get(record.record_id)
            if verdict:
                trace["final_verdict"].update({
                    "manual_status": verdict.get("status"),
                    "manual_operator": verdict.get("operator"),
                    "manual_time": verdict.get("time"),
                    "manual_reason": verdict.get("reason"),
                    "source": verdict.get("status", record.final_verdict_source)
                })
                trace["final_verdict"]["needs_manual"] = False
            else:
                trace["final_verdict"]["manual_status"] = VerdictStatus.PENDING

        return trace

    def submit_verdict(self, record_id: str, status: str, operator: str,
                       reason: str, overwrite_handovers: bool = True) -> Dict:
        """提交边界样本人工结论，覆盖班组交接的单一结论来源"""
        verdict = {
            "record_id": record_id,
            "status": status,
            "operator": operator,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "reason": reason,
            "overwrite_handovers": overwrite_handovers
        }
        self._verdicts[record_id] = verdict
        return verdict

    def pending_list(self, records: List[AttributionRecord]) -> List[Dict]:
        """列出所有待处理边界样本及其卡点说明"""
        pending = []
        for r in records:
            if self.is_boundary(r) and r.record_id not in self._verdicts:
                info = self.classify_boundary(r)
                pending.append({
                    "record_id": r.record_id,
                    "turbine": r.measurement.turbine_id,
                    "blade": f"B{r.measurement.blade_no}",
                    "stuck_at": info["stuck_at"],
                    "stuck_detail": info["stuck_detail"],
                    "final_verdict_source": r.final_verdict_source
                })
        return pending
