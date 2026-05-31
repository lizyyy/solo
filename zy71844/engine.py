from __future__ import annotations

import copy
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from models import (
    AnomalyType,
    CADChangeAlert,
    CADPoint,
    CheckStatus,
    EquipmentNote,
    RouteCheckResult,
    RouteRun,
    TraceRef,
)


class CampusRouteEngine:
    def __init__(self) -> None:
        self._runs: Dict[str, RouteRun] = {}
        self._runs_by_batch: Dict[str, List[str]] = defaultdict(list)
        self._equipment_notes: Dict[str, EquipmentNote] = {}
        self._cad_points: Dict[str, CADPoint] = {}
        self._cad_point_history: Dict[str, List[CADPoint]] = defaultdict(list)
        self._results: Dict[str, RouteCheckResult] = {}

    def add_equipment_note(self, note: EquipmentNote) -> str:
        self._equipment_notes[note.id] = note
        return note.id

    def add_cad_point(self, point: CADPoint) -> Tuple[str, List[CADChangeAlert]]:
        alerts: List[CADChangeAlert] = []
        existing = self._cad_points.get(point.id)
        if existing:
            old_version = existing.version
            changes = self._diff_cad_point(existing, point)
            if changes:
                self._cad_point_history[point.id].append(copy.deepcopy(existing))
                point.version = old_version + 1
                affected = self._find_affected_result_ids(point.id)
                alert = CADChangeAlert(
                    point_id=point.id,
                    point_label=existing.label,
                    old_version=old_version,
                    new_version=point.version,
                    changes=changes,
                    affected_results=affected,
                )
                alerts.append(alert)
        self._cad_points[point.id] = point
        return point.id, alerts

    def run_route(self, batch_key: str, materials: Dict[str, Any]) -> RouteRun:
        previous_run_ids = self._runs_by_batch.get(batch_key, [])
        run_index = len(previous_run_ids) + 1

        run = RouteRun(
            batch_key=batch_key,
            run_index=run_index,
            material_snapshot=copy.deepcopy(materials),
        )

        results = self._execute_checks(run, materials)
        run.results = results

        for r in results:
            self._results[r.id] = r

        self._runs[run.id] = run
        self._runs_by_batch[batch_key].append(run.id)

        return run

    def get_run(self, run_id: str) -> Optional[RouteRun]:
        return self._runs.get(run_id)

    def get_batch_history(self, batch_key: str) -> List[RouteRun]:
        run_ids = self._runs_by_batch.get(batch_key, [])
        return [self._runs[rid] for rid in run_ids if rid in self._runs]

    def get_result_with_trace(self, result_id: str) -> Optional[Dict[str, Any]]:
        result = self._results.get(result_id)
        if not result:
            return None
        trace_details: List[Dict[str, Any]] = []
        for ref in result.trace_refs:
            detail: Dict[str, Any] = {
                "source_type": ref.source_type,
                "source_id": ref.source_id,
                "detail": ref.detail,
            }
            if ref.source_type == "cad_point":
                pt = self._cad_points.get(ref.source_id)
                if pt:
                    detail["resolved"] = {
                        "label": pt.label,
                        "x": pt.x,
                        "y": pt.y,
                        "z": pt.z,
                        "version": pt.version,
                    }
                    history = self._cad_point_history.get(ref.source_id, [])
                    detail["history_versions"] = len(history) + 1
            elif ref.source_type == "equipment_note":
                note = self._equipment_notes.get(ref.source_id)
                if note:
                    detail["resolved"] = {
                        "equipment_name": note.equipment_name,
                        "model_id": note.model_id,
                        "remark": note.remark,
                    }
            trace_details.append(detail)
        return {
            "result": {
                "id": result.id,
                "run_id": result.run_id,
                "check_item": result.check_item,
                "status": result.status.value,
                "anomaly_type": result.anomaly_type.value if result.anomaly_type else None,
                "description": result.description,
                "created_at": result.created_at,
            },
            "trace_refs": trace_details,
            "run": {
                "batch_key": self._runs[result.run_id].batch_key if result.run_id in self._runs else None,
                "run_index": self._runs[result.run_id].run_index if result.run_id in self._runs else None,
            },
        }

    def _execute_checks(self, run: RouteRun, materials: Dict[str, Any]) -> List[RouteCheckResult]:
        results: List[RouteCheckResult] = []
        results.extend(self._check_model_duplicates(run, materials))
        results.extend(self._check_route_blocked(run, materials))
        results.extend(self._check_axis_flipped(run, materials))
        return results

    def _check_model_duplicates(self, run: RouteRun, materials: Dict[str, Any]) -> List[RouteCheckResult]:
        results: List[RouteCheckResult] = []
        models = materials.get("models", [])
        seen: Dict[str, List[int]] = defaultdict(list)
        for i, m in enumerate(models):
            model_id = m.get("model_id", "")
            seen[model_id].append(i)

        for model_id, indices in seen.items():
            if len(indices) > 1:
                trace_refs: List[TraceRef] = []
                for idx in indices:
                    model = models[idx]
                    cad_point_id = model.get("cad_point_id")
                    note_id = model.get("equipment_note_id")
                    if cad_point_id:
                        trace_refs.append(TraceRef(
                            source_type="cad_point",
                            source_id=cad_point_id,
                            detail=f"model index {idx} placed at CAD point {cad_point_id}",
                        ))
                    if note_id:
                        trace_refs.append(TraceRef(
                            source_type="equipment_note",
                            source_id=note_id,
                            detail=f"model index {idx} linked to equipment note {note_id}",
                        ))
                result = RouteCheckResult(
                    run_id=run.id,
                    check_item=f"model_duplicate:{model_id}",
                    status=CheckStatus.PENDING_CONFIRM,
                    anomaly_type=AnomalyType.MODEL_DUPLICATE,
                    description=f"模型 {model_id} 出现 {len(indices)} 次摆放（索引: {indices}），需确认是否为有意重复",
                    trace_refs=trace_refs,
                )
                results.append(result)
        return results

    def _check_route_blocked(self, run: RouteRun, materials: Dict[str, Any]) -> List[RouteCheckResult]:
        results: List[RouteCheckResult] = []
        route_segments = materials.get("route_segments", [])
        exhibits = materials.get("exhibits", [])

        for seg_idx, seg in enumerate(route_segments):
            seg_start = (seg.get("x1", 0), seg.get("y1", 0))
            seg_end = (seg.get("x2", 0), seg.get("y2", 0))
            for ex_idx, ex in enumerate(exhibits):
                ex_pos = (ex.get("x", 0), ex.get("y", 0))
                radius = ex.get("radius", 1.0)
                if self._point_near_segment(ex_pos, seg_start, seg_end, radius):
                    cad_point_id = ex.get("cad_point_id")
                    note_id = ex.get("equipment_note_id")
                    trace_refs: List[TraceRef] = []
                    if cad_point_id:
                        trace_refs.append(TraceRef(
                            source_type="cad_point",
                            source_id=cad_point_id,
                            detail=f"展品 {ex_idx} 位于 CAD 点位 {cad_point_id}",
                        ))
                    if note_id:
                        trace_refs.append(TraceRef(
                            source_type="equipment_note",
                            source_id=note_id,
                            detail=f"展品 {ex_idx} 关联设备备注 {note_id}",
                        ))
                    result = RouteCheckResult(
                        run_id=run.id,
                        check_item=f"route_blocked:segment_{seg_idx}_exhibit_{ex_idx}",
                        status=CheckStatus.PENDING_CONFIRM,
                        anomaly_type=AnomalyType.ROUTE_BLOCKED,
                        description=f"路线段 {seg_idx} 可能被展品 {ex_idx} 挡住，需确认",
                        trace_refs=trace_refs,
                    )
                    results.append(result)
        return results

    def _check_axis_flipped(self, run: RouteRun, materials: Dict[str, Any]) -> List[RouteCheckResult]:
        results: List[RouteCheckResult] = []
        models = materials.get("models", [])

        for m_idx, m in enumerate(models):
            orientation = m.get("orientation", {})
            if orientation.get("x_flipped") or orientation.get("y_flipped") or orientation.get("z_flipped"):
                cad_point_id = m.get("cad_point_id")
                note_id = m.get("equipment_note_id")
                trace_refs: List[TraceRef] = []
                flipped_axes = [ax for ax in ("x_flipped", "y_flipped", "z_flipped") if orientation.get(ax)]
                if cad_point_id:
                    trace_refs.append(TraceRef(
                        source_type="cad_point",
                        source_id=cad_point_id,
                        detail=f"模型 {m_idx} 坐标轴翻转 {flipped_axes}，关联 CAD 点位 {cad_point_id}",
                    ))
                if note_id:
                    trace_refs.append(TraceRef(
                        source_type="equipment_note",
                        source_id=note_id,
                        detail=f"模型 {m_idx} 坐标轴翻转，关联设备备注 {note_id}",
                    ))
                result = RouteCheckResult(
                    run_id=run.id,
                    check_item=f"axis_flipped:model_{m_idx}",
                    status=CheckStatus.PENDING_CONFIRM,
                    anomaly_type=AnomalyType.AXIS_FLIPPED,
                    description=f"模型 {m_idx} 坐标轴翻转: {flipped_axes}，需确认",
                    trace_refs=trace_refs,
                )
                results.append(result)
        return results

    @staticmethod
    def _point_near_segment(
        point: Tuple[float, float],
        seg_start: Tuple[float, float],
        seg_end: Tuple[float, float],
        threshold: float,
    ) -> bool:
        px, py = point
        x1, y1 = seg_start
        x2, y2 = seg_end
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0:
            return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5 <= threshold
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        dist = ((px - proj_x) ** 2 + (py - proj_y) ** 2) ** 0.5
        return dist <= threshold

    @staticmethod
    def _diff_cad_point(old: CADPoint, new: CADPoint) -> Dict[str, Any]:
        changes: Dict[str, Any] = {}
        if old.x != new.x:
            changes["x"] = {"old": old.x, "new": new.x}
        if old.y != new.y:
            changes["y"] = {"old": old.y, "new": new.y}
        if old.z != new.z:
            changes["z"] = {"old": old.z, "new": new.z}
        if old.label != new.label:
            changes["label"] = {"old": old.label, "new": new.label}
        return changes

    def _find_affected_result_ids(self, cad_point_id: str) -> List[str]:
        affected: List[str] = []
        for rid, result in self._results.items():
            for ref in result.trace_refs:
                if ref.source_type == "cad_point" and ref.source_id == cad_point_id:
                    affected.append(rid)
                    break
        return affected
