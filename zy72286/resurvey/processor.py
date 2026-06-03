import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd

from .models import (
    ResurveyProject,
    MeasurementRecord,
    ObstacleRemark,
    FloorProfileSketch,
    ProcessingStatus,
)


def generate_id(prefix: str = "REC") -> str:
    return f"{prefix}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(2).hex().upper()}"


class RouteLengthCalculator:
    @staticmethod
    def calculate(points: List[Dict[str, float]]) -> float:
        if len(points) < 2:
            return 0.0
        total = 0.0
        for i in range(1, len(points)):
            p1 = points[i - 1]
            p2 = points[i]
            dx = p2.get("x", 0) - p1.get("x", 0)
            dy = p2.get("y", 0) - p1.get("y", 0)
            total += (dx ** 2 + dy ** 2) ** 0.5
        return round(total, 2)

    @staticmethod
    def check_needs_recalculation(
        record: MeasurementRecord,
        new_points: Optional[List[Dict[str, float]]] = None,
    ) -> Tuple[bool, str]:
        if new_points and new_points != record.route_points:
            return True, "补录了新的路线点，需要重新计算长度"
        if record.is_supplementary and not record.length_recalculated:
            return True, "补录记录但未重算路线长度"
        if record.route_length is None and record.route_points:
            return True, "有路线点但长度为空"
        return False, "无需重算"


class DataProcessor:
    def __init__(self, project: ResurveyProject):
        self.project = project

    def import_obstacle_remarks(
        self,
        file_path: str,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        _, ext = os.path.splitext(file_path)
        if ext == ".xlsx":
            df = pd.read_excel(file_path)
        elif ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

        import_result = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "file": os.path.basename(file_path),
            "total_rows": len(df),
            "imported": 0,
            "duplicates": 0,
            "errors": [],
        }

        existing_keys = set()
        for record in self.project.records.values():
            if record.obstacle_remark:
                key = (
                    record.building_a,
                    record.building_b,
                    record.community_name,
                )
                existing_keys.add(key)

        for idx, row in df.iterrows():
            line_number = idx + 2
            try:
                building_a = str(row.get("楼栋A", "")).strip()
                building_b = str(row.get("楼栋B", "")).strip()
                community = str(row.get("小区名称", "老旧小区")).strip()
                distance = float(row.get("测量间距", 0))
                remark_content = str(row.get("障碍物备注", "")).strip()

                key = (building_a, building_b, community)
                is_duplicate = key in existing_keys

                record_id = generate_id()
                route_points = self._parse_route_points(row.get("路线点", ""))

                obstacle_remark = ObstacleRemark(
                    record_id=record_id,
                    original_line_number=line_number,
                    original_content=remark_content,
                    processing_status=ProcessingStatus.IMPORTED,
                    building_a=building_a,
                    building_b=building_b,
                    measured_distance=distance,
                    is_duplicate=is_duplicate,
                )

                record = MeasurementRecord(
                    record_id=record_id,
                    community_name=community,
                    building_a=building_a,
                    building_b=building_b,
                    measured_distance=distance,
                    route_points=route_points,
                    obstacle_remark=obstacle_remark,
                )

                if route_points:
                    record.route_length = RouteLengthCalculator.calculate(route_points)
                    record.length_recalculated = True

                if is_duplicate:
                    import_result["duplicates"] += 1
                    obstacle_remark.add_manual_change(
                        f"检测到重复记录: {building_a}-{building_b}", operator
                    )
                else:
                    existing_keys.add(key)
                    import_result["imported"] += 1

                self.project.records[record_id] = record

            except Exception as e:
                import_result["errors"].append(
                    f"第{line_number}行导入失败: {str(e)}"
                )

        self.project.import_history.append(import_result)
        return import_result

    def supplement_route(
        self,
        record_id: str,
        new_points: List[Dict[str, float]],
        remark: str = "",
        operator: str = "许工",
        auto_recalculate: bool = False,
    ) -> Dict[str, Any]:
        record = self.project.records.get(record_id)
        if not record:
            return {"success": False, "error": f"记录不存在: {record_id}"}

        old_points = record.route_points.copy()
        old_length = record.route_length

        record.route_points = new_points
        record.is_supplementary = True
        record.length_recalculated = False

        if record.obstacle_remark:
            record.obstacle_remark.add_manual_change(
                f"补录路线点: {len(old_points)} -> {len(new_points)}个点",
                operator,
            )
            if remark:
                record.obstacle_remark.supplement_note = remark
                record.obstacle_remark.add_manual_change(f"补录备注: {remark}", operator)

        needs_recalc, reason = RouteLengthCalculator.check_needs_recalculation(
            record, new_points
        )

        result = {
            "success": True,
            "record_id": record_id,
            "old_point_count": len(old_points),
            "new_point_count": len(new_points),
            "old_length": old_length,
            "needs_recalculation": needs_recalc,
            "reason": reason,
        }

        if auto_recalculate:
            new_length = record.calculate_route_length()
            result["auto_recalculated"] = True
            result["new_length"] = new_length
            if record.obstacle_remark:
                record.obstacle_remark.add_manual_change(
                    f"自动重算路线长度: {old_length} -> {new_length}", operator
                )
                record.obstacle_remark.processing_status = ProcessingStatus.RECALCULATED
                record.obstacle_remark.original_route_length = old_length
                record.obstacle_remark.route_length = new_length
        else:
            record.mark_length_not_recalculated()
            if record.obstacle_remark:
                record.obstacle_remark.add_manual_change(
                    f"标记为待重算: {reason}", operator
                )
                record.obstacle_remark.original_route_length = old_length

        return result

    def recalculate_route_length(
        self,
        record_id: str,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        record = self.project.records.get(record_id)
        if not record:
            return {"success": False, "error": f"记录不存在: {record_id}"}

        old_length = record.route_length
        new_length = record.calculate_route_length()

        if record.obstacle_remark:
            record.obstacle_remark.add_manual_change(
                f"手动重算路线长度: {old_length} -> {new_length}", operator
            )
            record.obstacle_remark.processing_status = ProcessingStatus.RECALCULATED
            record.obstacle_remark.route_length = new_length
            record.obstacle_remark.needs_customer_review = False

        return {
            "success": True,
            "record_id": record_id,
            "old_length": old_length,
            "new_length": new_length,
            "length_changed": old_length != new_length,
        }

    def add_floor_sketch(
        self,
        record_id: str,
        file_path: str,
        building: str,
        floors: int,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        record = self.project.records.get(record_id)
        if not record:
            return {"success": False, "error": f"记录不存在: {record_id}"}

        sketch = FloorProfileSketch(
            sketch_id=generate_id("SKT"),
            record_id=record_id,
            file_path=file_path,
            building=building,
            floors=floors,
        )
        record.floor_sketches.append(sketch)
        record.updated_at = datetime.now()

        return {
            "success": True,
            "sketch_id": sketch.sketch_id,
            "record_id": record_id,
        }

    def review_floor_sketch(
        self,
        sketch_id: str,
        note: str,
        reviewer: str = "许工",
    ) -> Dict[str, Any]:
        for record in self.project.records.values():
            for sketch in record.floor_sketches:
                if sketch.sketch_id == sketch_id:
                    sketch.add_view_note(note, reviewer)
                    record.updated_at = datetime.now()
                    if record.obstacle_remark:
                        record.obstacle_remark.add_manual_change(
                            f"已补看{sketch.building}楼层剖面草图: {note}",
                            reviewer,
                        )
                    return {
                        "success": True,
                        "sketch_id": sketch_id,
                        "note": note,
                        "reviewer": reviewer,
                    }
        return {"success": False, "error": f"草图不存在: {sketch_id}"}

    def mark_for_customer_review(
        self,
        record_id: str,
        reason: str,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        record = self.project.records.get(record_id)
        if not record:
            return {"success": False, "error": f"记录不存在: {record_id}"}

        if record.obstacle_remark:
            record.obstacle_remark.needs_customer_review = True
            record.obstacle_remark.processing_status = ProcessingStatus.NEEDS_REVIEW
            record.obstacle_remark.add_manual_change(
                f"提交客户复核: {reason}", operator
            )

        return {"success": True, "record_id": record_id, "reason": reason}

    def _parse_route_points(self, points_str: str) -> List[Dict[str, float]]:
        if not points_str or not isinstance(points_str, str):
            return []
        try:
            points = json.loads(points_str)
            if isinstance(points, list):
                return [
                    {"x": float(p.get("x", 0)), "y": float(p.get("y", 0))}
                    for p in points
                ]
        except (json.JSONDecodeError, ValueError):
            pass
        return []

    def save_project(self, file_path: str) -> None:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.project.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def load_project(file_path: str) -> "DataProcessor":
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        project = ResurveyProject(**data)
        return DataProcessor(project)
