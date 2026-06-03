from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from models import RescueProfile, InspectionPhoto, CADLayer
from boundary_rules import BoundaryRuleEngine, BoundaryCheckResult


class DisplayService:
    """
    展示服务（3D / 图表）
    ======================================
    核心约束: 点击可追溯，不要只剩漂亮画面
    - 每个展示数据点携带 source_refs
    - 3D点 → 追溯到巡检照片编号
    - 图表数据 → 追溯到CAD图层名
    - 异常点高亮显示
    """

    class DisplayMode:
        VIEW_2D = "2d"
        VIEW_3D = "3d"
        CHART = "chart"

    def __init__(self, db: Session):
        self.db = db

    def _add_source_references(self, data_point: Dict, photo: InspectionPhoto) -> Dict:
        """为每个数据点添加溯源引用"""
        cad_layers = self.db.query(CADLayer).filter(
            CADLayer.photo_id == photo.id
        ).all()

        layer_refs = []
        for layer in cad_layers:
            layer_refs.append({
                "cad_layer_id": layer.id,
                "layer_name": layer.layer_name,
                "layer_remark": layer.layer_remark,
                "has_remark": layer.has_remark
            })

        data_point["_source_refs"] = {
            "photo_id": photo.id,
            "photo_number": photo.photo_number,
            "photo_import_batch": photo.import_batch_id,
            "cad_layers": layer_refs,
            "raw_data_available": bool(photo.raw_data),
            "review_link": f"/photos/{photo.photo_number}/review"
        }

        if photo.has_recalculated_length is False:
            data_point["_source_refs"]["length_issue"] = {
                "has_issue": True,
                "message": "补录路线未重新计算长度",
                "recalculate_link": f"/photos/{photo.photo_number}/recalculate"
            }

        return data_point

    def get_3d_view_data(self, profile_id: int) -> Dict:
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        photo = profile.photo

        data_points = self._build_3d_points(profile, photo)

        result = {
            "profile_id": profile.id,
            "mode": self.DisplayMode.VIEW_3D,
            "floor_section": profile.floor_section,
            "status": profile.status,
            "length_mismatch": profile.length_mismatch,
            "needs_review": profile.needs_review,
            "workflow_step": profile.workflow_step,
            "rescue_route": profile.rescue_route,
            "data_points": data_points,
            "evidence_summary": self._build_evidence_summary(photo)
        }

        if profile.length_mismatch or profile.needs_review:
            result["warnings"] = [{
                "type": "length_mismatch" if profile.length_mismatch else "needs_review",
                "message": "存在待复核项，点击数据点可追溯原始记录",
                "action": "请先复核后再用于展示"
            }]

        return result

    def get_chart_view_data(self, profile_id: int) -> Dict:
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        photo = profile.photo

        chart_data = self._build_chart_series(profile, photo)

        result = {
            "profile_id": profile.id,
            "mode": self.DisplayMode.CHART,
            "floor_section": profile.floor_section,
            "status": profile.status,
            "length_mismatch": profile.length_mismatch,
            "needs_review": profile.needs_review,
            "chart_type": "route_length_distribution",
            "series": chart_data,
            "evidence_summary": self._build_evidence_summary(photo)
        }

        if profile.length_mismatch or profile.needs_review:
            result["warnings"] = [{
                "type": "length_mismatch" if profile.length_mismatch else "needs_review",
                "message": "存在待复核项，图表数据仅供参考",
                "action": "点击图例可追溯到CAD图层名和照片编号"
            }]

        return result

    def _build_3d_points(self, profile: RescueProfile, photo: InspectionPhoto) -> List[Dict]:
        points = []

        base_point = {
            "x": photo.location_x or 0,
            "y": photo.location_y or 0,
            "z": photo.location_z or 0,
            "type": "photo_location",
            "label": photo.photo_number,
            "highlight": profile.length_mismatch or profile.needs_review
        }
        base_point = self._add_source_references(base_point, photo)
        points.append(base_point)

        cad_layers = self.db.query(CADLayer).filter(CADLayer.photo_id == photo.id).all()
        for i, layer in enumerate(cad_layers):
            layer_point = {
                "x": (photo.location_x or 0) + i * 0.5,
                "y": photo.location_y or 0,
                "z": (photo.location_z or 0) + (layer.layer_thickness or 0.1) * (i + 1),
                "type": "cad_layer",
                "label": layer.layer_name,
                "layer_material": layer.layer_material,
                "layer_thickness": layer.layer_thickness,
                "has_remark": layer.has_remark,
                "highlight": layer.has_remark
            }
            layer_point = self._add_source_references(layer_point, photo)
            points.append(layer_point)

        return points

    def _build_chart_series(self, profile: RescueProfile, photo: InspectionPhoto) -> List[Dict]:
        series = []

        route_point = {
            "name": "路线长度",
            "type": "bar",
            "data": [{
                "category": profile.floor_section or photo.floor or "未指定",
                "value": photo.route_length or 0,
                "has_recalculated": photo.has_recalculated_length,
                "highlight": not photo.has_recalculated_length
            }],
            "_source_refs": {
                "photo_number": photo.photo_number,
                "trace_link": f"/photos/{photo.photo_number}/route-length"
            }
        }
        series.append(route_point)

        cad_layers = self.db.query(CADLayer).filter(CADLayer.photo_id == photo.id).all()
        if cad_layers:
            thickness_data = []
            for layer in cad_layers:
                thickness_data.append({
                    "category": layer.layer_name,
                    "value": layer.layer_thickness or 0,
                    "material": layer.layer_material,
                    "has_remark": layer.has_remark
                })

            series.append({
                "name": "图层厚度",
                "type": "bar",
                "data": thickness_data,
                "_source_refs": {
                    "photo_number": photo.photo_number,
                    "cad_layer_names": [l.layer_name for l in cad_layers],
                    "trace_link": f"/photos/{photo.photo_number}/cad-layers"
                }
            })

        return series

    def _build_evidence_summary(self, photo: InspectionPhoto) -> Dict:
        cad_layers = self.db.query(CADLayer).filter(CADLayer.photo_id == photo.id).all()

        return {
            "photo_number": photo.photo_number,
            "import_batch": photo.import_batch_id,
            "route_length": photo.route_length,
            "has_recalculated_length": photo.has_recalculated_length,
            "cad_layer_count": len(cad_layers),
            "cad_layers_with_remarks": sum(1 for l in cad_layers if l.has_remark),
            "cad_layer_names": [l.layer_name for l in cad_layers],
            "created_at": photo.created_at,
            "updated_at": photo.updated_at
        }

    def trace_to_source(self, profile_id: int, point_index: int) -> Dict:
        """
        点击3D/图表数据点时，追溯到源数据
        返回巡检照片编号和CAD图层名
        """
        view_data = self.get_3d_view_data(profile_id)

        if point_index >= len(view_data["data_points"]):
            raise ValueError(f"数据点索引 {point_index} 超出范围")

        point = view_data["data_points"][point_index]
        source_refs = point.get("_source_refs", {})

        return {
            "photo_number": source_refs.get("photo_number"),
            "photo_id": source_refs.get("photo_id"),
            "cad_layers": source_refs.get("cad_layers", []),
            "raw_data_available": source_refs.get("raw_data_available"),
            "length_issue": source_refs.get("length_issue"),
            "review_link": source_refs.get("review_link")
        }

    def check_display_allowed(self, profile_id: int, mode: str) -> BoundaryCheckResult:
        """展示前复核检查"""
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        if mode in [self.DisplayMode.VIEW_3D, self.DisplayMode.CHART]:
            return BoundaryRuleEngine.check_export_allowed(
                needs_review=profile.needs_review,
                length_mismatch=profile.length_mismatch
            )

        return BoundaryCheckResult(
            rule_code=None,
            passed=True,
            message="2D视图无需复核",
            decision=None,
            evidence={}
        )
