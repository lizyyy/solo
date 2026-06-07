from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

from models.layer import LayerResult, LayerItem
from models.candidate import CandidateTable
from models.params import ParamsYAML


class VizType(str, Enum):
    CHART_2D = "chart_2d"
    CHART_3D = "chart_3d"
    SCATTER = "scatter"
    HEATMAP = "heatmap"


@dataclass
class VizPoint:
    record_id: str
    x: float
    y: float
    z: Optional[float] = None
    score: float = 0.0
    layer: str = ""
    status: str = ""
    _lineage_ref: Dict[str, Any] = field(default_factory=dict)


class VisualizationLayer:
    def __init__(self):
        self._points: List[VizPoint] = []
        self._viz_type: VizType = VizType.SCATTER
        self._source_layer_result_id: str = ""
        self._source_candidate_table_id: str = ""
        self._source_params_yaml_id: str = ""

    def build_from_layer_result(
        self,
        layer_result: LayerResult,
        candidate_table: CandidateTable,
        viz_type: VizType = VizType.SCATTER,
        x_feature: str = "feature_0",
        y_feature: str = "feature_1",
        z_feature: Optional[str] = None
    ) -> List[VizPoint]:
        self._viz_type = viz_type
        self._source_layer_result_id = layer_result.id
        self._source_candidate_table_id = candidate_table.id
        self._source_params_yaml_id = layer_result.params_yaml_id

        points = []
        for record_id, record in candidate_table.records.items():
            layer_item = layer_result.get_item(record_id)
            if not layer_item:
                continue

            point = VizPoint(
                record_id=record_id,
                x=record.features.get(x_feature, 0.0),
                y=record.features.get(y_feature, 0.0),
                z=record.features.get(z_feature) if z_feature else None,
                score=layer_item.score,
                layer=layer_item.layer_name,
                status=layer_item.status.value,
                _lineage_ref={
                    "candidate_table_id": candidate_table.id,
                    "candidate_record_id": record_id,
                    "layer_result_id": layer_result.id,
                    "layer_item_id": layer_item.id,
                    "params_yaml_id": layer_result.params_yaml_id,
                }
            )
            points.append(point)

        self._points = points
        return points

    def drill_down(self, record_id: str) -> Optional[Dict[str, Any]]:
        for point in self._points:
            if point.record_id == record_id:
                return {
                    "record_id": record_id,
                    "visualization_coords": {
                        "x": point.x,
                        "y": point.y,
                        "z": point.z,
                    },
                    "score": point.score,
                    "status": point.status,
                    "lineage": point._lineage_ref,
                    "navigate_options": [
                        {
                            "target": "candidate_record",
                            "label": "查看召回候选表原始记录",
                            "id": point._lineage_ref["candidate_record_id"],
                            "table_id": point._lineage_ref["candidate_table_id"],
                        },
                        {
                            "target": "params_yaml",
                            "label": "查看对应参数YAML版本",
                            "id": point._lineage_ref["params_yaml_id"],
                        },
                        {
                            "target": "layer_item_history",
                            "label": "查看该分层项的变更历史",
                            "id": point._lineage_ref["layer_item_id"],
                        },
                    ]
                }
        return None

    def get_viz_metadata(self) -> Dict[str, Any]:
        return {
            "viz_type": self._viz_type.value,
            "point_count": len(self._points),
            "source_ids": {
                "layer_result": self._source_layer_result_id,
                "candidate_table": self._source_candidate_table_id,
                "params_yaml": self._source_params_yaml_id,
            },
            "supported_drill_down": True,
        }

    def get_points_for_chart(self) -> Dict[str, Any]:
        return {
            "type": self._viz_type.value,
            "points": [
                {
                    "record_id": p.record_id,
                    "x": p.x,
                    "y": p.y,
                    "z": p.z,
                    "score": p.score,
                    "status": p.status,
                }
                for p in self._points
            ],
            "metadata": self.get_viz_metadata(),
        }
