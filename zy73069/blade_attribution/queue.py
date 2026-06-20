"""异常队列生成与一致性校验：给别人看的队列必须和工具重新复核的判断一致。

判定签名使用 SHA256，只覆盖稳定的"异常判断"字段(等级/归因/结论/边界卡点/备件替换延迟)，
显式排除时间戳、运行ID、版本状态、临时对象顺序等会随重启/重跑变化的因素，
因此 `check --queue-file` 不会因为重新启动进程、时间戳或顺序而变成另一套结论。"""
import os
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

import pandas as pd

from .models import AttributionRecord, AnomalyLevel
from .boundary_tracker import BoundaryTracker
from .version_manager import VersionManager
from .spare_marker import SparePartMarker


QUEUE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "queues")
EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "exports")


def _ensure_dirs():
    os.makedirs(QUEUE_DIR, exist_ok=True)
    os.makedirs(EXPORT_DIR, exist_ok=True)


def _stable_hash(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AnomalyQueue:
    def __init__(self, tracker: Optional[BoundaryTracker] = None,
                 version_mgr: Optional[VersionManager] = None,
                 spare_marker: Optional[SparePartMarker] = None):
        self.tracker = tracker or BoundaryTracker()
        self.version_mgr = version_mgr or VersionManager()
        self.spare_marker = spare_marker or SparePartMarker()
        _ensure_dirs()

    def _record_judgment(self, record: AttributionRecord) -> Dict[str, Any]:
        """提取单条记录的稳定"异常判断"字段(只含判定依据，排除运行元数据)"""
        binfo = self.tracker.classify_boundary(record)
        spares = self.spare_marker.to_export_rows(record.spare_parts)
        spare_sig = sorted(
            [(s["part_code"], s["is_replacement"], s["original_code"],
              s["is_late"], s["arrival_delay_days"], s["lead_time_days"]) for s in spares],
            key=lambda x: x[0]
        )
        return {
            "record_id": record.record_id,
            "level": record.level.value,
            "root_cause": record.root_cause,
            "conclusion": record.conclusion,
            "is_boundary": binfo["is_boundary"],
            "stuck_at": binfo["stuck_at"],
            "stuck_detail": binfo["stuck_detail"],
            "verdict_source": record.final_verdict_source,
            "spare_signature": spare_sig,
        }

    def judgment_signature(self, records: List[AttributionRecord]) -> str:
        """整批异常判断的稳定签名：按 record_id 排序后 SHA256。
        同一样例材料+同一阈值配置 → 同一签名，跨进程/重启/顺序不变。"""
        items = [self._record_judgment(r) for r in sorted(records, key=lambda x: x.record_id)]
        payload = json.dumps(items, sort_keys=True, ensure_ascii=False)
        return _stable_hash(payload)

    def per_record_judgment_hashes(self, records: List[AttributionRecord]) -> Dict[str, str]:
        """每条记录的判定签名，用于精细化定位差异"""
        out: Dict[str, str] = {}
        for r in sorted(records, key=lambda x: x.record_id):
            j = self._record_judgment(r)
            out[r.record_id] = _stable_hash(json.dumps(j, sort_keys=True, ensure_ascii=False))
        return out

    def build_queue(self, records: List[AttributionRecord],
                    include_levels: Optional[List[AnomalyLevel]] = None
                    ) -> Tuple[List[Dict[str, Any]], str]:
        """构建异常队列(仅含非正常记录)，返回 (队列列表, 整批判定签名)"""
        if include_levels is None:
            include_levels = [AnomalyLevel.CRITICAL, AnomalyLevel.WARNING, AnomalyLevel.BOUNDARY]

        sig = self.judgment_signature(records)
        per_record = self.per_record_judgment_hashes(records)
        queue: List[Dict[str, Any]] = []

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
                "_judgment_hash": per_record.get(r.record_id, ""),
            })

        queue.sort(key=lambda x: (x["level_rank"], x["timestamp"]))
        return queue, sig

    def check_consistency(self, records: List[AttributionRecord],
                          stored_signature: str,
                          stored_hashes: Optional[Dict[str, str]] = None
                          ) -> Tuple[bool, Dict[str, Any]]:
        """用当前重新复核的判断比对队列里存的判断，防止两套话。
        比对只看异常判断签名，不看版本状态/时间戳，因此重启后依然稳定。"""
        current_sig = self.judgment_signature(records)
        current_hashes = self.per_record_judgment_hashes(records)
        sig_ok = (current_sig == stored_signature)
        hash_ok = True
        mismatched: List[Dict[str, Any]] = []

        if stored_hashes:
            for rid, h in current_hashes.items():
                if stored_hashes.get(rid) != h:
                    hash_ok = False
                    mismatched.append({
                        "record_id": rid,
                        "detail": f"队列签名={str(stored_hashes.get(rid, '(缺失)'))[:12]}.. 当前签名={h[:12]}.."
                    })
            for rid in stored_hashes:
                if rid not in current_hashes:
                    hash_ok = False
                    mismatched.append({"record_id": rid, "detail": "队列里有但当前复核未生成"})
        else:
            if not sig_ok:
                for r in sorted(records, key=lambda x: x.record_id):
                    mismatched.append({
                        "record_id": r.record_id,
                        "detail": f"当前等级={r.level.value} 结论={r.conclusion}"
                    })

        consistent = sig_ok and hash_ok
        report = {
            "consistent": consistent,
            "queue_signature": stored_signature,
            "current_signature": current_sig,
            "signature_match": sig_ok,
            "per_record_match": hash_ok,
            "check_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "mismatched_records": mismatched,
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

    def save_queue_json(self, queue: List[Dict], signature: str,
                        filename: str, record_count: int) -> str:
        """保存完整结构队列(信封式)，带稳定判定签名，给别人看也便于程序复核"""
        _ensure_dirs()
        path = os.path.join(QUEUE_DIR, filename)
        envelope = {
            "_judgment_signature": signature,
            "_signature_algorithm": "sha256",
            "_signature_scope": "异常判断字段(等级/归因/结论/边界卡点/备件替换延迟),排除时间戳/运行ID/版本状态",
            "_generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "_record_count": record_count,
            "records": queue,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(envelope, f, ensure_ascii=False, indent=2, default=str)
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
    def load_queue_envelope(path: str) -> Tuple[Optional[str], List[Dict], Dict[str, str], bool]:
        """读取已导出队列JSON，返回 (整批签名, 记录列表, 单条签名map, 是否新格式)。
        旧格式(不稳定hash)返回 is_new_format=False，提示需要重新生成。"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "records" in data:
            stored_sig = data.get("_judgment_signature", "")
            records = data.get("records", [])
            stored_hashes = {r.get("record_id"): r.get("_judgment_hash", "") for r in records}
            return stored_sig, records, stored_hashes, True
        if isinstance(data, list):
            old_sig = data[0].get("_consistency_signature", "") if data else ""
            return old_sig, data, {}, False
        return "", [], {}, False

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
