"""异常队列生成与一致性校验：给别人看的队列必须和当前页面判断一致"""
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

import pandas as pd

from .models import AttributionRecord, AnomalyLevel, RecordStatus
from .boundary_tracker import BoundaryTracker
from .version_manager import VersionManager
from .spare_marker import SparePartMarker


QUEUE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "queues")
EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "exports")


def _ensure_dirs():
    os.makedirs(QUEUE_DIR, exist_ok=True)
    os.makedirs(EXPORT_DIR, exist_ok=True)


class AnomalyQueue:
    def __init__(self, tracker: Optional[BoundaryTracker] = None,
                 version_mgr: Optional[VersionManager] = None,
                 spare_marker: Optional[SparePartMarker] = None):
        self.tracker = tracker or BoundaryTracker()
        self.version_mgr = version_mgr or VersionManager()
        self.spare_marker = spare_marker or SparePartMarker()
        self._snapshot_signature: Optional[str] = None
        _ensure_dirs()

    def _signature(self, records: List[AttributionRecord]) -> str:
        """生成当前批次记录的判断签名，用于一致性校验"""
        items = []
        for r in sorted(records, key=lambda x: x.record_id):
            items.append(f"{r.record_id}|{r.level.value}|{r.version.status.value}|{r.boundary_detail.reason.value if r.boundary_detail.reason else ''}")
        return hash(";".join(items)).__str__()

    def build_queue(self, records: List[AttributionRecord],
                    include_levels: Optional[List[AnomalyLevel]] = None) -> List[Dict[str, Any]]:
        """构建异常队列，仅含非N且版本为最新/导出的记录"""
        if include_levels is None:
            include_levels = [AnomalyLevel.CRITICAL, AnomalyLevel.WARNING, AnomalyLevel.BOUNDARY]

        queue = []
        sig = self._signature(records)

        for r in records:
            if r.level not in include_levels:
                continue
            binfo = self.tracker.classify_boundary(r)
            spare_export = self.spare_marker.to_export_rows(r.spare_parts)
            versions = self.version_mgr.get_material_versions(r)

            queue.append({
                "record_id": r.record_id,
                "turbine_id": r.measurement.turbine_id,
                "blade_no": f"B{r.measurement.blade_no}",
                "timestamp": r.measurement.timestamp,
                "level": r.level.value,
                "level_rank": include_levels.index(r.level) if r.level in include_levels else 99,
                "root_cause": r.root_cause,
                "conclusion": r.conclusion,
                "status": r.version.status.value,
                "is_boundary": binfo["is_boundary"],
                "stuck_at": binfo["stuck_at"],
                "stuck_detail": binfo["stuck_detail"],
                "verdict_source": r.final_verdict_source,
                "data_source": r.measurement.source,
                "has_handover_only": binfo.get("handover_only", False),
                "spare_parts_count": len(r.spare_parts),
                "spare_replacement_count": sum(1 for s in spare_export if s["is_replacement"]),
                "spare_late_count": sum(1 for s in spare_export if s["is_late"]),
                "spare_parts": spare_export,
                "version_run_id": r.version.run_id,
                "previous_run_id": r.version.previous_run_id or "",
                "appended_note": r.version.appended_note or "",
                "material_versions": versions,
                "evidence_count": len(r.evidence_chain),
                "trace_complete": len(r.evidence_chain) >= 3,
                "_consistency_signature": sig,
                "_snapshot_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })

        queue.sort(key=lambda x: (x["level_rank"], x["timestamp"]))
        self._snapshot_signature = sig
        return queue

    def check_consistency(self, records: List[AttributionRecord],
                          queue_signature: str) -> Tuple[bool, Dict[str, Any]]:
        """校验当前页面判断和已生成队列是否一致，防止两套话"""
        current_sig = self._signature(records)
        consistent = current_sig == queue_signature
        mismatch = []
        if not consistent:
            for r in records:
                mismatch.append({
                    "record_id": r.record_id,
                    "current_level": r.level.value,
                    "current_status": r.version.status.value
                })
        report = {
            "consistent": consistent,
            "queue_signature": queue_signature,
            "current_signature": current_sig,
            "check_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "mismatched_records": mismatch if not consistent else []
        }
        return consistent, report

    def save_queue_csv(self, queue: List[Dict], filename: str) -> str:
        """保存队列CSV，展开备件标记不丢"""
        _ensure_dirs()
        flat_rows = []
        for q in queue:
            base = {k: v for k, v in q.items() if k not in ("spare_parts", "material_versions")}
            if not q["spare_parts"]:
                for col in self.spare_marker.export_columns():
                    base[f"spare_{col}"] = ""
                flat_rows.append(base)
            else:
                for sp in q["spare_parts"]:
                    row = dict(base)
                    for col, val in sp.items():
                        row[f"spare_{col}"] = val
                    flat_rows.append(row)
        path = os.path.join(QUEUE_DIR, filename)
        pd.DataFrame(flat_rows).to_csv(path, index=False, encoding="utf-8-sig")
        return path

    def save_queue_json(self, queue: List[Dict], filename: str) -> str:
        """保存完整结构队列（给别人看的原样）"""
        _ensure_dirs()
        path = os.path.join(QUEUE_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(queue, f, ensure_ascii=False, indent=2, default=str)
        return path

    def export_attribution_xlsx(self, records: List[AttributionRecord], filename: str) -> str:
        """导出归因总表，备件型号替换标记列不丢"""
        _ensure_dirs()
        path = os.path.join(EXPORT_DIR, filename)

        summary_rows = []
        spare_rows = []
        boundary_rows = []
        evidence_rows = []

        for r in records:
            binfo = self.tracker.classify_boundary(r)
            summary_rows.append({
                "记录ID": r.record_id,
                "风机编号": r.measurement.turbine_id,
                "叶片号": f"B{r.measurement.blade_no}",
                "测量时间": r.measurement.timestamp,
                "判定等级": r.level.value,
                "归因": r.root_cause,
                "结论": r.conclusion,
                "结论来源": r.final_verdict_source,
                "数据来源": r.measurement.source,
                "版本状态": r.version.status.value,
                "运行ID": r.version.run_id,
                "上一次运行ID": r.version.previous_run_id or "",
                "后补备注": r.version.appended_note or "",
                "是否边界": "是" if binfo["is_boundary"] else "否",
                "边界卡点": binfo["stuck_at"],
                "卡点说明": binfo["stuck_detail"],
                "证据完整": "是" if len(r.evidence_chain) >= 3 else "否"
            })

            spares = self.spare_marker.to_export_rows(r.spare_parts)
            for s in spares:
                row = {"记录ID": r.record_id, "风机编号": r.measurement.turbine_id}
                row.update({
                    "备件编码": s["part_code"],
                    "备件名称": s["part_name"],
                    "数量": s["quantity"],
                    "需求日期": s["required_date"],
                    "到货日期": s["arrival_date"],
                    "是否替换型号": "是" if s["is_replacement"] else "否",
                    "原型号编码": s["original_code"],
                    "型号替换标记": s["replacement_marker"],
                    "标记说明": s["marker_text"],
                    "标准交期(天)": s["lead_time_days"],
                    "到货延迟(天)": s["arrival_delay_days"],
                    "是否晚于需求": "是" if s["is_late"] else "否"
                })
                spare_rows.append(row)

            if binfo["is_boundary"]:
                boundary_rows.append({
                    "记录ID": r.record_id,
                    "指标": binfo["metric"],
                    "公式": binfo["formula"],
                    "原始值": binfo["raw_value"],
                    "单位": binfo["unit"],
                    "阈值": binfo["threshold"],
                    "容差": binfo["tolerance"],
                    "卡点类型": binfo["stuck_at"],
                    "卡点详细说明": binfo["stuck_detail"]
                })

            for ev in r.evidence_chain:
                evidence_rows.append({
                    "记录ID": r.record_id,
                    "步骤序号": ev.step_order,
                    "步骤名称": ev.step_name,
                    "输入数据": json.dumps(ev.source_data, ensure_ascii=False),
                    "计算公式": ev.calculation,
                    "中间结果": ev.intermediate_result,
                    "步骤时间": ev.timestamp
                })

        with pd.ExcelWriter(path, engine="openpyxl") as writer:
            pd.DataFrame(summary_rows).to_excel(writer, sheet_name="归因总表", index=False)
            pd.DataFrame(spare_rows).to_excel(writer, sheet_name="备件清单(含替换标记)", index=False)
            pd.DataFrame(boundary_rows).to_excel(writer, sheet_name="边界样本卡点明细", index=False)
            pd.DataFrame(evidence_rows).to_excel(writer, sheet_name="证据链明细", index=False)
        return path

    @staticmethod
    def list_queues() -> List[Dict]:
        """列出已生成的异常队列（项目助理小林看哪份）"""
        _ensure_dirs()
        items = []
        for f in sorted(os.listdir(QUEUE_DIR)):
            fp = os.path.join(QUEUE_DIR, f)
            if os.path.isfile(fp):
                items.append({
                    "filename": f,
                    "path": fp,
                    "size_kb": round(os.path.getsize(fp) / 1024, 1),
                    "mtime": datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")
                })
        return items
