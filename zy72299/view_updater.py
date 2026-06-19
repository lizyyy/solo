from datetime import datetime
from typing import List, Dict, Optional, Tuple
import copy
from models import (
    ObstacleRecord,
    CleaningPath,
    CleaningPathPoint,
    Coordinate3D,
    RecordStatus,
    HistoryEntry,
    deterministic_id,
)


class View3DUpdater:
    def __init__(self, records: List[ObstacleRecord]):
        self.records = records
        self.history: List[HistoryEntry] = []
        self.version: int = 0
        self.view_versions: List[Dict] = []
        self.view_state: Dict = {
            "version": 0,
            "last_updated": None,
            "layers": [],
            "annotations": [],
        }
        self._record_snapshot: Dict[str, ObstacleRecord] = {}

    def _snapshot_records(self) -> Dict[str, Dict]:
        return {
            r.record_id: {
                "record_id": r.record_id,
                "obstacle_name": r.obstacle_name,
                "status": r.status.value,
                "position": {"x": r.position.x, "y": r.position.y, "z": r.position.z},
                "caliber_source": r.caliber_source,
                "photo_number": r.photo_number,
                "origin_id": r.origin_id,
                "duplicate_of": r.duplicate_of,
                "reviewed_by": r.reviewed_by,
                "conflict_evidence": r.conflict_evidence,
            }
            for r in self.records
        }

    def _detect_record_changes(self, old_snap: Dict[str, Dict]) -> Tuple[Dict[str, List[str]], int]:
        current_snap = self._snapshot_records()
        changed: Dict[str, List[str]] = {}
        changes_count = 0

        all_ids = set(list(old_snap.keys()) + list(current_snap.keys()))
        for rid in all_ids:
            old = old_snap.get(rid)
            new = current_snap.get(rid)
            diff_fields: List[str] = []

            if old is None:
                diff_fields.append("ADDED_RECORD")
                changes_count += 1
                changed[rid] = diff_fields
                continue
            if new is None:
                diff_fields.append("REMOVED_RECORD")
                changes_count += 1
                changed[rid] = diff_fields
                continue

            for field in ["obstacle_name", "status", "position", "caliber_source",
                          "photo_number", "origin_id", "duplicate_of", "reviewed_by",
                          "conflict_evidence"]:
                if old.get(field) != new.get(field):
                    diff_fields.append(field)
                    changes_count += 1

            if diff_fields:
                changed[rid] = diff_fields

        return changed, changes_count

    def take_snapshot(self) -> Dict[str, Dict]:
        """公开方法：在修改前拍摄记录快照，保证before/after有真实差异"""
        return {k: copy.deepcopy(v) for k, v in self._snapshot_records().items()}

    def bump_version(
        self,
        trigger_reason: str,
        actor: str = "system",
        external_before_snapshot: Optional[Dict[str, Dict]] = None,
    ) -> int:
        """版本递增。external_before_snapshot: 修改前就拍好的快照（若不传则用当前值）"""
        if external_before_snapshot is not None:
            old_snap = {k: copy.deepcopy(v) for k, v in external_before_snapshot.items()}
        else:
            old_snap = {k: copy.deepcopy(v) for k, v in self._snapshot_records().items()}
        self.version += 1
        changed_records, total_changes = self._detect_record_changes(old_snap)

        version_entry = {
            "version": self.version,
            "bumped_at": datetime.now().isoformat(),
            "trigger_reason": trigger_reason,
            "actor": actor,
            "total_record_changes": total_changes,
            "changed_record_ids": list(changed_records.keys()),
            "changed_fields_by_record": changed_records,
            "records_before": old_snap,
            "records_after": self._snapshot_records(),
        }
        self.view_versions.append(version_entry)

        self._add_history(
            action="BUMP_VIEW_VERSION",
            actor=actor,
            details={
                "new_version": self.version,
                "trigger_reason": trigger_reason,
                "total_changes": total_changes,
                "changed_records": changed_records,
            },
        )
        return self.version

    def generate_3d_view(
        self,
        building_id: str,
        origin_point: Dict[str, float],
        actor: str = "system",
        reason: str = "initial_generation",
    ) -> Dict:
        if self.version == 0:
            self.bump_version(reason, actor)

        annotations = []
        layers = {
            "normal": [],
            "duplicate_name": [],
            "conflict": [],
            "pending_review": [],
            "supplemented": [],
            "confirmed": [],
            "rejected": [],
        }
        annotation_record_map: Dict[str, Dict] = {}

        for record in self.records:
            annotation = self._create_annotation(record)
            annotations.append(annotation)
            annotation_record_map[record.record_id] = annotation

            status_layer = record.status.value
            if status_layer in layers:
                layers[status_layer].append(record.record_id)

        view_layers = []
        for layer_name, record_ids in layers.items():
            view_layers.append(
                {
                    "layer_id": f"layer_{layer_name}",
                    "layer_name": self._get_layer_display_name(layer_name),
                    "visible": layer_name not in ["rejected"],
                    "record_ids": record_ids,
                    "record_count": len(record_ids),
                    "style": self._get_layer_style(layer_name),
                }
            )

        consistency = self._check_view_record_consistency(
            layers, annotation_record_map
        )

        self.view_state = {
            "version": self.version,
            "last_updated": datetime.now().isoformat(),
            "origin_point": origin_point,
            "building_id": building_id,
            "layers": view_layers,
            "annotations": annotations,
            "annotation_count": len(annotations),
            "layer_count": len(view_layers),
            "view_record_consistency": consistency,
            "generated_by": actor,
            "generation_reason": reason,
        }

        self._add_history(
            action="UPDATE_3D_VIEW",
            actor=actor,
            details={
                "building_id": building_id,
                "version": self.version,
                "layers_count": len(view_layers),
                "annotations_count": len(annotations),
                "status_summary": {k: len(v) for k, v in layers.items()},
                "consistency_check": consistency,
                "reason": reason,
            },
        )

        self._record_snapshot = self._snapshot_records()
        return {
            "view_state": self.view_state,
            "view_versions": self.view_versions.copy(),
            "consistency": consistency,
            "history": self.history.copy(),
        }

    def _check_view_record_consistency(
        self,
        layers: Dict[str, List[str]],
        annotation_map: Dict[str, Dict],
    ) -> Dict:
        issues: List[Dict] = []
        layer_record_ids = set()
        for rids in layers.values():
            layer_record_ids.update(rids)

        actual_record_ids = {r.record_id for r in self.records}

        missing_in_layers = actual_record_ids - layer_record_ids
        for rid in missing_in_layers:
            rec = next((r for r in self.records if r.record_id == rid), None)
            issues.append({
                "type": "MISSING_FROM_LAYERS",
                "record_id": rid,
                "detail": f"记录未归入任何图层 status={rec.status.value if rec else 'unknown'}",
            })

        missing_annotations = actual_record_ids - set(annotation_map.keys())
        for rid in missing_annotations:
            issues.append({
                "type": "MISSING_ANNOTATION",
                "record_id": rid,
                "detail": "记录缺少三维标注",
            })

        for record in self.records:
            ann = annotation_map.get(record.record_id)
            if ann:
                if ann["status"] != record.status.value:
                    issues.append({
                        "type": "STATUS_MISMATCH",
                        "record_id": record.record_id,
                        "detail": f"图层标注状态={ann['status']} vs 记录状态={record.status.value}",
                    })
                if abs(ann["position"]["x"] - record.position.x) > 0.001 \
                        or abs(ann["position"]["y"] - record.position.y) > 0.001 \
                        or abs(ann["position"]["z"] - record.position.z) > 0.001:
                    issues.append({
                        "type": "POSITION_MISMATCH",
                        "record_id": record.record_id,
                        "detail": f"标注位置=({ann['position']}) vs 记录位置=({record.position.x},{record.position.y},{record.position.z})",
                    })

        return {
            "checked_at": datetime.now().isoformat(),
            "total_records": len(self.records),
            "total_annotations": len(annotation_map),
            "total_layers_members": len(layer_record_ids),
            "consistent": len(issues) == 0,
            "issue_count": len(issues),
            "issues": issues,
        }

    def _create_annotation(self, record: ObstacleRecord) -> Dict:
        status_style = self._get_status_style(record.status)

        annotation = {
            "annotation_id": f"ann_{record.record_id}",
            "record_id": record.record_id,
            "obstacle_name": record.obstacle_name,
            "obstacle_type": record.obstacle_type.value,
            "position": {
                "x": record.position.x,
                "y": record.position.y,
                "z": record.position.z,
            },
            "status": record.status.value,
            "status_display": self._get_status_display_name(record.status.value),
            "caliber_source": record.caliber_source,
            "caliber_source_display": self._get_source_display_name(record.caliber_source),
            "style": status_style,
            "labels": [],
            "view_version": self.version,
        }

        if record.status == RecordStatus.DUPLICATE_NAME:
            annotation["labels"].append("重复名称待复核")
            annotation["duplicate_of"] = record.duplicate_of
            annotation["review_pending"] = True
            annotation["next_handler"] = "培训学员"
        elif record.status == RecordStatus.CONFLICT:
            annotation["labels"].append("数据冲突待确认")
            annotation["review_pending"] = True
            annotation["next_handler"] = "园区运维小陶"
            if record.conflict_evidence:
                annotation["conflict_fields"] = record.conflict_evidence.get(
                    "conflicting_fields", []
                )
                annotation["conflict_id"] = record.conflict_evidence.get("conflict_id")
        elif record.status == RecordStatus.PENDING_REVIEW:
            annotation["labels"].append("培训学员复核中")
            annotation["review_pending"] = True
            annotation["next_handler"] = "培训学员"
        elif record.status == RecordStatus.SUPPLEMENTED:
            annotation["labels"].append("照片补录数据")
            if record.conflict_evidence and "old_caliber" in record.conflict_evidence:
                annotation["old_caliber_note"] = record.conflict_evidence["old_caliber"]

        if record.photo_number:
            annotation["photo_number"] = record.photo_number
        if record.origin_id:
            annotation["origin_id"] = record.origin_id
        if record.reviewed_by:
            annotation["reviewed_by"] = record.reviewed_by
        if record.reviewed_at:
            annotation["reviewed_at"] = record.reviewed_at.isoformat()
        if record.conflict_evidence:
            annotation["conflict_evidence"] = record.conflict_evidence

        return annotation

    def _get_status_display_name(self, status: str) -> str:
        names = {
            "normal": "正常记录",
            "duplicate_name": "同一障碍物多名称",
            "conflict": "数据冲突待确认",
            "pending_review": "培训学员复核中",
            "supplemented": "照片补录数据",
            "confirmed": "已确认",
            "rejected": "已驳回",
        }
        return names.get(status, status)

    def _get_source_display_name(self, source: str) -> str:
        names = {
            "coordinate_origin_spec": "坐标原点说明",
            "photo_supplement": "巡检照片编号补录",
        }
        return names.get(source, source)

    def _get_layer_display_name(self, layer_name: str) -> str:
        names = {
            "normal": "正常记录",
            "duplicate_name": "重复名称待处理",
            "conflict": "数据冲突待确认",
            "pending_review": "培训学员复核中",
            "supplemented": "照片补录数据",
            "confirmed": "已确认",
            "rejected": "已驳回",
        }
        return names.get(layer_name, layer_name)

    def _get_layer_style(self, layer_name: str) -> Dict:
        styles = {
            "normal": {"color": "#4CAF50", "opacity": 0.8, "border": "solid"},
            "duplicate_name": {"color": "#FF9800", "opacity": 0.9, "border": "dashed"},
            "conflict": {"color": "#F44336", "opacity": 1.0, "border": "double"},
            "pending_review": {"color": "#9C27B0", "opacity": 0.8, "border": "dashed"},
            "supplemented": {"color": "#2196F3", "opacity": 0.8, "border": "solid"},
            "confirmed": {"color": "#8BC34A", "opacity": 0.8, "border": "solid"},
            "rejected": {"color": "#9E9E9E", "opacity": 0.4, "border": "dotted"},
        }
        return styles.get(layer_name, {"color": "#9E9E9E", "opacity": 0.6, "border": "solid"})

    def _get_status_style(self, status: RecordStatus) -> Dict:
        styles = {
            RecordStatus.NORMAL: {
                "color": "#4CAF50",
                "border_style": "solid",
                "icon": "check_circle",
            },
            RecordStatus.DUPLICATE_NAME: {
                "color": "#FF9800",
                "border_style": "dashed",
                "icon": "warning",
            },
            RecordStatus.CONFLICT: {
                "color": "#F44336",
                "border_style": "double",
                "icon": "error",
            },
            RecordStatus.PENDING_REVIEW: {
                "color": "#9C27B0",
                "border_style": "dashed",
                "icon": "schedule",
            },
            RecordStatus.SUPPLEMENTED: {
                "color": "#2196F3",
                "border_style": "solid",
                "icon": "add_photo_alternate",
            },
            RecordStatus.CONFIRMED: {
                "color": "#8BC34A",
                "border_style": "solid",
                "icon": "verified",
            },
            RecordStatus.REJECTED: {
                "color": "#9E9E9E",
                "border_style": "dotted",
                "icon": "block",
            },
        }
        return styles.get(status, {"color": "#9E9E9E", "border_style": "solid", "icon": "help"})

    def generate_cleaning_path(
        self,
        building_id: str,
        path_name: str,
        actor: str = "system",
    ) -> CleaningPath:
        valid_records = [
            r
            for r in self.records
            if r.status
            not in [RecordStatus.REJECTED, RecordStatus.CONFLICT, RecordStatus.DUPLICATE_NAME]
        ]

        valid_records.sort(key=lambda r: (r.position.z, r.position.y, r.position.x))

        points = []
        for idx, record in enumerate(valid_records):
            point = CleaningPathPoint(
                point_id=deterministic_id(
                    "point", building_id, path_name, idx,
                    record.record_id, record.position.x, record.position.y, record.position.z,
                ),
                position=record.position,
                obstacle_id=record.record_id,
                cleaning_action=self._get_cleaning_action(record.obstacle_type),
                sequence=idx + 1,
            )
            points.append(point)

        excluded = [
            r.record_id
            for r in self.records
            if r.status
            in [RecordStatus.REJECTED, RecordStatus.CONFLICT, RecordStatus.DUPLICATE_NAME]
        ]

        path = CleaningPath(
            path_id=deterministic_id("path", building_id, path_name, len(points), self.version),
            building_id=building_id,
            path_name=path_name,
            points=points,
            created_at=datetime.now(),
            version=self.version,
        )

        self._add_history(
            action="GENERATE_CLEANING_PATH",
            actor=actor,
            details={
                "path_id": path.path_id,
                "path_name": path_name,
                "tied_view_version": self.version,
                "points_count": len(points),
                "included_records": [r.record_id for r in valid_records],
                "excluded_records": excluded,
                "excluded_reasons": {
                    r.record_id: f"status={r.status.value}"
                    for r in self.records if r.record_id in excluded
                },
            },
        )

        return path

    def _get_cleaning_action(self, obstacle_type) -> str:
        actions = {
            "window": "玻璃擦拭",
            "ac_unit": "空调外机周边清洁",
            "antenna": "天线基座除尘",
            "pipe": "管道表面清洁",
            "sign": "标识牌擦拭",
            "other": "周边区域清洁",
        }
        return actions.get(obstacle_type.value, "标准清洁")

    def print_view_summary(self):
        print(f"\n  视图版本 v{self.version} 生成时间: {self.view_state.get('last_updated')}")
        print(f"  图层数: {self.view_state.get('layer_count', 0)}   标注数: {self.view_state.get('annotation_count', 0)}")
        cons = self.view_state.get("view_record_consistency", {})
        if cons:
            flag = "✓" if cons.get("consistent") else "✗"
            print(f"  一致性校验: {flag}  问题数: {cons.get('issue_count', 0)}")
            if not cons.get("consistent"):
                for issue in cons.get("issues", []):
                    print(f"    - [{issue['type']}] {issue['record_id']}: {issue['detail']}")
        print(f"  图层明细:")
        for layer in self.view_state.get("layers", []):
            if layer["record_count"] > 0:
                marker = "  " if layer["visible"] else "❌"
                print(f"    {marker} [{layer['style']['color']}] {layer['layer_name']}: {layer['record_count']} 条")

        print(f"\n  标注详情 (按状态分层):")
        by_status: Dict[str, List[Dict]] = {}
        for ann in self.view_state.get("annotations", []):
            s = ann.get("status_display", ann["status"])
            by_status.setdefault(s, []).append(ann)

        for status_name, anns in by_status.items():
            print(f"\n    【{status_name}】共 {len(anns)} 个:")
            for ann in anns:
                extra = []
                if ann.get("photo_number"):
                    extra.append(f"照片={ann['photo_number']}")
                if ann.get("review_pending"):
                    extra.append(f"下一步→{ann.get('next_handler', '未知')}")
                if ann.get("labels"):
                    extra.append("标签: " + ",".join(ann["labels"]))
                extra_str = f"  ({'; '.join(extra)})" if extra else ""
                print(f"      · {ann['obstacle_name']} @ ({ann['position']['x']}, {ann['position']['y']}, {ann['position']['z']}){extra_str}")

        if self.view_versions:
            print(f"\n  版本变更历史:")
            for v in self.view_versions:
                print(f"    v{v['version']} [{v['bumped_at'][:19]}] {v['trigger_reason']} by {v['actor']}")
                if v["changed_record_ids"]:
                    print(f"       变更记录: {', '.join(v['changed_record_ids'])} ({v['total_record_changes']} 处变更)")

    def _add_history(
        self,
        action: str,
        actor: str,
        details: Dict,
        record_id: Optional[str] = None,
    ):
        entry = HistoryEntry(
            entry_id=deterministic_id("hist", "view_updater", action, actor, record_id,
                                       str(sorted(details.items())) if details else "", len(self.history)),
            timestamp=datetime.now(),
            action=action,
            actor=actor,
            details=details,
            record_id=record_id,
        )
        self.history.append(entry)
