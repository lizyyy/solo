from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from src.models.base import (
    RangefinderRecord, ObstacleRemark, ObstacleAnnotation,
    CalculationMeta, ConflictEvidence, NameAliasCandidate,
    OperationLog, AnnotationResult, TrajectoryPoint,
    ConfirmStatus, ConflictType
)
from src.utils.geo import haversine_distance
from config.settings import (
    MODEL_VERSION, MODEL_TRAIN_DATE,
    DISTANCE_THRESHOLD_METERS, OBSTACLE_RADIUS_METERS,
    PARAMS_JUSTIFICATION
)


class AnnotationEngine:
    ALGORITHM_DESC = (
        "1. 使用DBSCAN变体算法对测距仪记录和现场备注进行空间聚类，距离阈值3米；"
        "2. 聚类中心取所有点的加权平均，测距仪记录权重0.6，现场备注权重0.4；"
        "3. 名称取最早导入的测距仪记录名称，如有同物异名待复核；"
        "4. 结论优先级：已确认的备注结论 > 未确认的备注结论 > 测距仪结论；"
        "5. 所有参数变更均记录版本号和取舍理由。"
    )

    def _build_calculation_meta(self) -> CalculationMeta:
        return CalculationMeta(
            model_version=MODEL_VERSION,
            parameter_version=f"{MODEL_VERSION}-{MODEL_TRAIN_DATE}",
            parameters_used={
                "DISTANCE_THRESHOLD_METERS": DISTANCE_THRESHOLD_METERS,
                "OBSTACLE_RADIUS_METERS": OBSTACLE_RADIUS_METERS,
                "rangefinder_weight": 0.6,
                "remark_weight": 0.4
            },
            justification=PARAMS_JUSTIFICATION,
            algorithm_description=self.ALGORITHM_DESC
        )

    def _cluster_objects(
        self,
        records: List[RangefinderRecord],
        remarks: List[ObstacleRemark]
    ) -> List[List[Dict[str, Any]]]:
        all_points = []
        for r in records:
            if not r.is_duplicate:
                all_points.append({
                    "id": r.record_id,
                    "lat": r.latitude,
                    "lon": r.longitude,
                    "name": r.obstacle_name,
                    "type": "record",
                    "obj": r
                })
        for rm in remarks:
            all_points.append({
                "id": rm.remark_id,
                "lat": rm.latitude,
                "lon": rm.longitude,
                "name": rm.obstacle_name,
                "type": "remark",
                "obj": rm
            })

        clusters: List[List[Dict[str, Any]]] = []
        unassigned = list(range(len(all_points)))

        while unassigned:
            current_idx = unassigned.pop(0)
            current = all_points[current_idx]
            cluster = [current]
            to_check = [current_idx]

            while to_check:
                check_idx = to_check.pop()
                check_point = all_points[check_idx]
                i = 0
                while i < len(unassigned):
                    other_idx = unassigned[i]
                    other = all_points[other_idx]
                    dist = haversine_distance(
                        check_point["lat"], check_point["lon"],
                        other["lat"], other["lon"]
                    )
                    if dist <= DISTANCE_THRESHOLD_METERS:
                        cluster.append(other)
                        unassigned.pop(i)
                        to_check.append(other_idx)
                    else:
                        i += 1

            clusters.append(cluster)

        return clusters

    def _resolve_name(
        self,
        cluster: List[Dict[str, Any]],
        alias_candidates: List[NameAliasCandidate],
        conflicts: List[ConflictEvidence]
    ) -> Tuple[str, bool]:
        record_points = [p for p in cluster if p["type"] == "record"]
        if record_points:
            earliest = min(record_points, key=lambda p: p["obj"].import_time)
            canonical_name = earliest["name"]
        else:
            earliest = min(cluster, key=lambda p: p["obj"].submit_time)
            canonical_name = earliest["name"]

        cluster_ids = set(p["id"] for p in cluster)
        cluster_names = set(p["name"] for p in cluster)

        has_alias_issue = False
        if len(cluster_names) > 1:
            related_aliases = [
                ac for ac in alias_candidates
                if ac.primary_record_id in cluster_ids
                and ac.alias_record_id in cluster_ids
            ]
            if not related_aliases:
                has_alias_issue = True
            else:
                has_unresolved = any(
                    ac.confirm_status == ConfirmStatus.PENDING
                    for ac in related_aliases
                )
                if has_unresolved:
                    has_alias_issue = True

        return canonical_name, has_alias_issue

    def _resolve_type(
        self,
        cluster: List[Dict[str, Any]],
        conflicts: List[ConflictEvidence]
    ) -> str:
        remark_points = [p for p in cluster if p["type"] == "remark"]
        if remark_points:
            return remark_points[0]["obj"].obstacle_type

        record_points = [p for p in cluster if p["type"] == "record"]
        if record_points:
            return record_points[0]["obj"].obstacle_type

        return "unknown"

    def _resolve_position(
        self,
        cluster: List[Dict[str, Any]]
    ) -> Tuple[float, float, Optional[float]]:
        total_weight = 0.0
        weighted_lat = 0.0
        weighted_lon = 0.0
        weighted_alt = 0.0
        has_altitude = False

        for p in cluster:
            weight = 0.6 if p["type"] == "record" else 0.4
            total_weight += weight
            weighted_lat += p["lat"] * weight
            weighted_lon += p["lon"] * weight
            if p["obj"].altitude is not None:
                weighted_alt += p["obj"].altitude * weight
                has_altitude = True

        avg_lat = weighted_lat / total_weight
        avg_lon = weighted_lon / total_weight
        avg_alt = weighted_alt / total_weight if has_altitude else None

        return avg_lat, avg_lon, avg_alt

    def _resolve_conclusion(
        self,
        cluster: List[Dict[str, Any]],
        conflicts: List[ConflictEvidence]
    ) -> str:
        remark_points = [p for p in cluster if p["type"] == "remark"]
        record_points = [p for p in cluster if p["type"] == "record"]

        remark_ids = [p["id"] for p in remark_points]
        record_ids = [p["id"] for p in record_points]

        confirmed_remark_conflicts = [
            c for c in conflicts
            if c.conflict_type == ConflictType.CONCLUSION_CONFLICT
            and c.remark_id in remark_ids
            and c.rangefinder_record_id in record_ids
            and c.confirm_status == ConfirmStatus.CONFIRMED
        ]

        if confirmed_remark_conflicts:
            for c in confirmed_remark_conflicts:
                for p in remark_points:
                    if p["id"] == c.remark_id:
                        return p["obj"].conclusion

        pending_conflicts = [
            c for c in conflicts
            if c.conflict_type == ConflictType.CONCLUSION_CONFLICT
            and c.remark_id in remark_ids
            and c.rangefinder_record_id in record_ids
            and c.confirm_status == ConfirmStatus.PENDING
        ]

        if pending_conflicts and remark_points:
            return remark_points[0]["obj"].conclusion

        if remark_points:
            return remark_points[0]["obj"].conclusion

        if record_points:
            return record_points[0]["obj"].raw_conclusion

        return "待确认"

    def _needs_review(
        self,
        cluster: List[Dict[str, Any]],
        conflicts: List[ConflictEvidence],
        alias_candidates: List[NameAliasCandidate]
    ) -> bool:
        cluster_ids = set(p["id"] for p in cluster)

        for c in conflicts:
            if (c.rangefinder_record_id in cluster_ids or
                (c.remark_id and c.remark_id in cluster_ids)):
                if c.confirm_status == ConfirmStatus.PENDING:
                    return True

        for ac in alias_candidates:
            if (ac.primary_record_id in cluster_ids and
                ac.alias_record_id in cluster_ids and
                ac.confirm_status == ConfirmStatus.PENDING):
                return True

        return False

    def calculate_annotations(
        self,
        task_id: str,
        trajectory_points: List[TrajectoryPoint],
        rangefinder_records: List[RangefinderRecord],
        obstacle_remarks: List[ObstacleRemark],
        existing_conflicts: List[ConflictEvidence] = None,
        existing_alias_candidates: List[NameAliasCandidate] = None,
        previous_result: AnnotationResult = None,
        operator: str = None,
        change_reason: str = None
    ) -> Tuple[AnnotationResult, List[OperationLog]]:
        logs: List[OperationLog] = []
        calculation_meta = self._build_calculation_meta()

        conflicts = list(existing_conflicts) if existing_conflicts else []
        alias_candidates = list(existing_alias_candidates) if existing_alias_candidates else []

        clusters = self._cluster_objects(rangefinder_records, obstacle_remarks)

        annotations: List[ObstacleAnnotation] = []
        version = 1
        previous_version_id = None

        if previous_result:
            version = previous_result.version + 1
            previous_version_id = previous_result.result_id
            logs.append(OperationLog(
                operator=operator or "system",
                action="recalculate_triggered",
                detail=f"触发重算，版本v{version}，原因: {change_reason or '补录新数据'}"
            ))

        for cluster in clusters:
            cluster_ids = [p["id"] for p in cluster]

            canonical_name, has_alias_issue = self._resolve_name(
                cluster, alias_candidates, conflicts
            )
            obstacle_type = self._resolve_type(cluster, conflicts)
            lat, lon, alt = self._resolve_position(cluster)
            conclusion = self._resolve_conclusion(cluster, conflicts)
            needs_review = self._needs_review(cluster, conflicts, alias_candidates)

            cluster_aliases = [
                ac for ac in alias_candidates
                if ac.primary_record_id in cluster_ids
                and ac.alias_record_id in cluster_ids
            ]
            cluster_conflicts = [
                c for c in conflicts
                if c.rangefinder_record_id in cluster_ids
                or (c.remark_id and c.remark_id in cluster_ids)
            ]

            source_records = [
                p["id"] for p in cluster if p["type"] == "record"
            ]
            source_remarks = [
                p["id"] for p in cluster if p["type"] == "remark"
            ]

            annotation = ObstacleAnnotation(
                canonical_name=canonical_name,
                obstacle_type=obstacle_type,
                latitude=lat,
                longitude=lon,
                altitude=alt,
                radius=OBSTACLE_RADIUS_METERS,
                source_records=source_records,
                source_remarks=source_remarks,
                final_conclusion=conclusion,
                calculation_meta=calculation_meta,
                has_name_alias_issue=has_alias_issue,
                alias_candidates=cluster_aliases,
                conflicts=cluster_conflicts,
                needs_review=needs_review,
                version=version,
                previous_version=previous_version_id,
                change_reason=change_reason
            )
            annotations.append(annotation)

        result = AnnotationResult(
            task_id=task_id,
            trajectory_points=trajectory_points,
            rangefinder_records=rangefinder_records,
            obstacle_remarks=obstacle_remarks,
            annotations=annotations,
            conflicts=conflicts,
            alias_candidates=alias_candidates,
            calculation_meta=calculation_meta,
            version=version,
            is_latest=True
        )

        if previous_result:
            previous_result.is_latest = False

        logs.append(OperationLog(
            operator=operator or "system",
            action="annotation_calculated",
            detail=f"计算完成，生成{len(annotations)}个障碍物标注，版本v{version}"
        ))

        return result, logs
