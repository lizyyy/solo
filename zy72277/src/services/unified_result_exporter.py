import csv
import io
import json
from typing import Dict, Any, List
from src.models.base import AnnotationResult, SelfCheckReport
from src.utils.geo import calculate_result_hash


class UnifiedResultExporter:
    def __init__(self):
        pass

    def _normalize_annotation(self, annotation: Any, result: AnnotationResult) -> Dict[str, Any]:
        source_names = []
        for rid in annotation.source_records:
            record = next(
                (r for r in result.rangefinder_records if r.record_id == rid),
                None
            )
            if record:
                source_names.append(f"测距仪:{record.obstacle_name}")
        for rid in annotation.source_remarks:
            remark = next(
                (r for r in result.obstacle_remarks if r.remark_id == rid),
                None
            )
            if remark:
                source_names.append(f"备注:{remark.obstacle_name}")

        return {
            "annotation_id": annotation.annotation_id,
            "canonical_name": annotation.canonical_name,
            "obstacle_type": annotation.obstacle_type,
            "latitude": round(annotation.latitude, 6),
            "longitude": round(annotation.longitude, 6),
            "altitude": round(annotation.altitude, 2) if annotation.altitude else None,
            "radius": annotation.radius,
            "final_conclusion": annotation.final_conclusion,
            "has_name_alias_issue": annotation.has_name_alias_issue,
            "needs_review": annotation.needs_review,
            "version": annotation.version,
            "change_reason": annotation.change_reason,
            "source_names": source_names,
            "alias_candidates": [
                {
                    "primary_name": ac.primary_name,
                    "alias_name": ac.alias_name,
                    "similarity": round(ac.similarity, 2),
                    "distance_meters": round(ac.distance_meters, 2),
                    "confirm_status": ac.confirm_status.value,
                    "reviewed_by": ac.reviewed_by
                }
                for ac in annotation.alias_candidates
            ],
            "conflicts": [
                {
                    "conflict_type": c.conflict_type.value,
                    "rangefinder_value": c.rangefinder_value,
                    "remark_value": c.remark_value,
                    "description": c.description,
                    "confirm_status": c.confirm_status.value,
                    "decided_by": c.decided_by
                }
                for c in annotation.conflicts
            ],
            "calculation_meta": {
                "model_version": annotation.calculation_meta.model_version,
                "parameter_version": annotation.calculation_meta.parameter_version,
                "parameters_used": annotation.calculation_meta.parameters_used,
                "justification": annotation.calculation_meta.justification,
                "algorithm_description": annotation.calculation_meta.algorithm_description
            }
        }

    def _build_core_result(self, result: AnnotationResult) -> Dict[str, Any]:
        data = {
            "task_id": result.task_id,
            "result_id": result.result_id,
            "version": result.version,
            "is_latest": result.is_latest,
            "creation_time": result.creation_time.isoformat(),
            "calculation_meta": {
                "model_version": result.calculation_meta.model_version,
                "parameter_version": result.calculation_meta.parameter_version,
                "calculation_time": result.calculation_meta.calculation_time.isoformat(),
                "parameters_used": result.calculation_meta.parameters_used,
                "justification": result.calculation_meta.justification,
                "algorithm_description": result.calculation_meta.algorithm_description
            },
            "summary": {
                "total_obstacles": len(result.annotations),
                "obstacles_need_review": sum(1 for a in result.annotations if a.needs_review),
                "obstacles_with_alias_issue": sum(1 for a in result.annotations if a.has_name_alias_issue),
                "total_conflicts": len(result.conflicts),
                "pending_conflicts": sum(1 for c in result.conflicts if c.confirm_status == "pending"),
                "total_alias_candidates": len(result.alias_candidates),
                "pending_alias_candidates": sum(1 for ac in result.alias_candidates if ac.confirm_status == "pending")
            },
            "annotations": [
                self._normalize_annotation(a, result)
                for a in result.annotations
            ],
            "conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "conflict_type": c.conflict_type.value,
                    "rangefinder_record_id": c.rangefinder_record_id,
                    "remark_id": c.remark_id,
                    "rangefinder_value": c.rangefinder_value,
                    "remark_value": c.remark_value,
                    "description": c.description,
                    "detected_at": c.detected_at.isoformat(),
                    "confirm_status": c.confirm_status.value,
                    "decided_by": c.decided_by,
                    "decided_at": c.decided_at.isoformat() if c.decided_at else None
                }
                for c in result.conflicts
            ],
            "alias_candidates": [
                {
                    "candidate_id": ac.candidate_id,
                    "primary_name": ac.primary_name,
                    "alias_name": ac.alias_name,
                    "similarity": round(ac.similarity, 2),
                    "distance_meters": round(ac.distance_meters, 2),
                    "primary_record_id": ac.primary_record_id,
                    "alias_record_id": ac.alias_record_id,
                    "confirm_status": ac.confirm_status.value,
                    "reviewed_by": ac.reviewed_by,
                    "reviewed_at": ac.reviewed_at.isoformat() if ac.reviewed_at else None
                }
                for ac in result.alias_candidates
            ],
            "operations_log": [
                {
                    "timestamp": log.timestamp.isoformat(),
                    "operator": log.operator,
                    "action": log.action,
                    "detail": log.detail
                }
                for log in result.operations_log
            ]
        }
        return data

    def get_for_api(self, result: AnnotationResult) -> Dict[str, Any]:
        core = self._build_core_result(result)
        core["data_hash"] = calculate_result_hash(core)
        return core

    def get_for_page(self, result: AnnotationResult) -> Dict[str, Any]:
        core = self._build_core_result(result)
        core["data_hash"] = calculate_result_hash(core)
        return core

    def export_to_csv(self, result: AnnotationResult) -> str:
        core = self._build_core_result(result)
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["农机作业轨迹回看 - 障碍物标注明细"])
        writer.writerow([f"任务ID: {result.task_id}"])
        writer.writerow([f"版本: v{result.version}"])
        writer.writerow([f"模型版本: {result.calculation_meta.model_version}"])
        writer.writerow([f"参数版本: {result.calculation_meta.parameter_version}"])
        writer.writerow([f"数据哈希: {calculate_result_hash(core)[:16]}..."])
        writer.writerow([])

        writer.writerow([
            "标注ID", "规范名称", "类型", "纬度", "经度", "高度", "半径",
            "最终结论", "是否有同物异名", "是否待复核", "版本", "变更原因",
            "来源名称", "参数版本", "模型版本"
        ])

        for a in core["annotations"]:
            writer.writerow([
                a["annotation_id"][:8],
                a["canonical_name"],
                a["obstacle_type"],
                a["latitude"],
                a["longitude"],
                a["altitude"] if a["altitude"] else "",
                a["radius"],
                a["final_conclusion"],
                "是" if a["has_name_alias_issue"] else "否",
                "是" if a["needs_review"] else "否",
                f"v{a['version']}",
                a["change_reason"] if a["change_reason"] else "",
                "; ".join(a["source_names"]),
                a["calculation_meta"]["parameter_version"],
                a["calculation_meta"]["model_version"]
            ])

        writer.writerow([])
        writer.writerow(["同物异名待复核列表"])
        writer.writerow(["候选ID", "主名称", "别名", "相似度", "距离(米)", "状态", "复核人"])
        for ac in core["alias_candidates"]:
            writer.writerow([
                ac["candidate_id"][:8],
                ac["primary_name"],
                ac["alias_name"],
                ac["similarity"],
                ac["distance_meters"],
                ac["confirm_status"],
                ac["reviewed_by"] if ac["reviewed_by"] else ""
            ])

        writer.writerow([])
        writer.writerow(["冲突证据列表"])
        writer.writerow(["冲突ID", "类型", "测距仪值", "备注值", "描述", "状态", "决策人"])
        for c in core["conflicts"]:
            writer.writerow([
                c["conflict_id"][:8],
                c["conflict_type"],
                c["rangefinder_value"],
                c["remark_value"],
                c["description"],
                c["confirm_status"],
                c["decided_by"] if c["decided_by"] else ""
            ])

        writer.writerow([])
        writer.writerow(["参数取舍理由"])
        for param, justification in result.calculation_meta.justification.items():
            writer.writerow([param, justification])

        return output.getvalue()

    def export_to_json(self, result: AnnotationResult) -> str:
        data = self.get_for_api(result)
        return json.dumps(data, ensure_ascii=False, indent=2)

    def get_3d_annotation_view(self, result: AnnotationResult) -> Dict[str, Any]:
        core = self._build_core_result(result)
        view_data = {
            "task_id": result.task_id,
            "version": result.version,
            "data_hash": calculate_result_hash(core),
            "view_type": "3d_annotation",
            "camera_center": self._calculate_camera_center(result),
            "obstacles": [
                {
                    "id": a["annotation_id"],
                    "name": a["canonical_name"],
                    "type": a["obstacle_type"],
                    "position": {
                        "latitude": a["latitude"],
                        "longitude": a["longitude"],
                        "altitude": a["altitude"] if a["altitude"] else 0
                    },
                    "radius": a["radius"],
                    "color": self._get_obstacle_color(a),
                    "has_issue": a["has_name_alias_issue"] or a["needs_review"],
                    "issues": self._get_obstacle_issues(a),
                    "conclusion": a["final_conclusion"],
                    "calculation_meta": a["calculation_meta"],
                    "version": a["version"],
                    "change_reason": a["change_reason"]
                }
                for a in core["annotations"]
            ],
            "trajectory_points": [
                {
                    "latitude": tp.latitude,
                    "longitude": tp.longitude,
                    "altitude": tp.altitude if tp.altitude else 0,
                    "timestamp": tp.timestamp.isoformat()
                }
                for tp in result.trajectory_points
            ]
        }
        return view_data

    def _calculate_camera_center(self, result: AnnotationResult) -> Dict[str, float]:
        if not result.annotations:
            return {"latitude": 0, "longitude": 0, "altitude": 100}

        avg_lat = sum(a.latitude for a in result.annotations) / len(result.annotations)
        avg_lon = sum(a.longitude for a in result.annotations) / len(result.annotations)

        return {
            "latitude": avg_lat,
            "longitude": avg_lon,
            "altitude": 50
        }

    def _get_obstacle_color(self, annotation: Dict[str, Any]) -> str:
        if annotation["needs_review"]:
            return "#FF9800"
        if annotation["has_name_alias_issue"]:
            return "#FFEB3B"
        if annotation["final_conclusion"] == "需要绕行":
            return "#F44336"
        return "#4CAF50"

    def _get_obstacle_issues(self, annotation: Dict[str, Any]) -> List[str]:
        issues = []
        if annotation["has_name_alias_issue"]:
            for ac in annotation["alias_candidates"]:
                issues.append(f"同物异名待确认: {ac['primary_name']} vs {ac['alias_name']}")
        for c in annotation["conflicts"]:
            if c["confirm_status"] == "pending":
                issues.append(f"{c['conflict_type']}: {c['description']}")
        return issues
