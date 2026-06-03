from datetime import datetime
from typing import List, Dict, Optional
import uuid
from models import (
    ObstacleRecord,
    CleaningPath,
    CleaningPathPoint,
    Coordinate3D,
    RecordStatus,
    HistoryEntry,
)


class View3DUpdater:
    def __init__(self, records: List[ObstacleRecord]):
        self.records = records
        self.history: List[HistoryEntry] = []
        self.view_state: Dict = {
            "version": 1,
            "last_updated": None,
            "layers": [],
            "annotations": [],
        }

    def generate_3d_view(
        self,
        building_id: str,
        origin_point: Dict[str, float],
        actor: str = "system",
    ) -> Dict:
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

        for record in self.records:
            annotation = self._create_annotation(record)
            annotations.append(annotation)

            status_layer = record.status.value
            if status_layer in layers:
                layers[status_layer].append(record.record_id)

        view_layers = []
        for layer_name, record_ids in layers.items():
            if record_ids:
                view_layers.append(
                    {
                        "layer_id": f"layer_{layer_name}",
                        "layer_name": self._get_layer_display_name(layer_name),
                        "visible": layer_name not in ["rejected"],
                        "record_ids": record_ids,
                        "style": self._get_layer_style(layer_name),
                    }
                )

        self.view_state = {
            "version": self.view_state["version"],
            "last_updated": datetime.now().isoformat(),
            "origin_point": origin_point,
            "building_id": building_id,
            "layers": view_layers,
            "annotations": annotations,
        }

        self._add_history(
            action="UPDATE_3D_VIEW",
            actor=actor,
            details={
                "building_id": building_id,
                "version": self.view_state["version"],
                "layers_count": len(view_layers),
                "annotations_count": len(annotations),
                "status_summary": {k: len(v) for k, v in layers.items()},
            },
        )

        return {
            "view_state": self.view_state,
            "history": self.history.copy(),
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
            "caliber_source": record.caliber_source,
            "style": status_style,
            "labels": [],
        }

        if record.status == RecordStatus.DUPLICATE_NAME:
            annotation["labels"].append("重复名称待复核")
            annotation["duplicate_of"] = record.duplicate_of
        elif record.status == RecordStatus.CONFLICT:
            annotation["labels"].append("数据冲突待确认")
            if record.conflict_evidence:
                annotation["conflict_fields"] = record.conflict_evidence.get(
                    "conflicting_fields", []
                )
        elif record.status == RecordStatus.PENDING_REVIEW:
            annotation["labels"].append("培训学员复核中")
        elif record.status == RecordStatus.SUPPLEMENTED:
            annotation["labels"].append("照片补录数据")

        if record.photo_number:
            annotation["photo_number"] = record.photo_number
        if record.origin_id:
            annotation["origin_id"] = record.origin_id
        if record.reviewed_by:
            annotation["reviewed_by"] = record.reviewed_by

        return annotation

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
            "normal": {"color": "#4CAF50", "opacity": 0.8},
            "duplicate_name": {"color": "#FF9800", "opacity": 0.9},
            "conflict": {"color": "#F44336", "opacity": 1.0},
            "pending_review": {"color": "#9C27B0", "opacity": 0.8},
            "supplemented": {"color": "#2196F3", "opacity": 0.8},
            "confirmed": {"color": "#8BC34A", "opacity": 0.8},
            "rejected": {"color": "#9E9E9E", "opacity": 0.4},
        }
        return styles.get(layer_name, {"color": "#9E9E9E", "opacity": 0.6})

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
                point_id=f"point_{idx}_{record.record_id}",
                position=record.position,
                obstacle_id=record.record_id,
                cleaning_action=self._get_cleaning_action(record.obstacle_type),
                sequence=idx + 1,
            )
            points.append(point)

        path = CleaningPath(
            path_id=f"path_{uuid.uuid4().hex[:8]}",
            building_id=building_id,
            path_name=path_name,
            points=points,
            created_at=datetime.now(),
            version=self.view_state["version"],
        )

        self._add_history(
            action="GENERATE_CLEANING_PATH",
            actor=actor,
            details={
                "path_id": path.path_id,
                "path_name": path_name,
                "points_count": len(points),
                "included_records": [r.record_id for r in valid_records],
                "excluded_records": [
                    r.record_id
                    for r in self.records
                    if r.status
                    in [RecordStatus.REJECTED, RecordStatus.CONFLICT, RecordStatus.DUPLICATE_NAME]
                ],
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

    def _add_history(
        self,
        action: str,
        actor: str,
        details: Dict,
        record_id: Optional[str] = None,
    ):
        entry = HistoryEntry(
            entry_id=f"hist_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            action=action,
            actor=actor,
            details=details,
            record_id=record_id,
        )
        self.history.append(entry)
