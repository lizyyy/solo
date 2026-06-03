from typing import List, Tuple
from src.models.base import (
    AnnotationResult, SelfCheckReport, SelfCheckItem,
    RangefinderRecord, ObstacleAnnotation, ConfirmStatus
)
from src.utils.geo import calculate_result_hash, haversine_distance
from src.services.annotation_engine import AnnotationEngine


class SelfChecker:
    def __init__(self, annotation_engine: AnnotationEngine):
        self.annotation_engine = annotation_engine

    def run_all_checks(self, result: AnnotationResult) -> SelfCheckReport:
        checks: List[SelfCheckItem] = []

        checks.append(self._check_duplicate_imports(result.rangefinder_records))
        checks.append(self._check_duplicate_names(result))
        checks.append(self._check_recalculate_consistency(result))
        checks.append(self._check_export_consistency(result))

        overall_passed = all(c.passed for c in checks)
        result_dict = result.model_dump()
        result_hash = calculate_result_hash(result_dict)

        return SelfCheckReport(
            overall_passed=overall_passed,
            checks=checks,
            result_hash=result_hash
        )

    def _check_duplicate_imports(
        self,
        records: List[RangefinderRecord]
    ) -> SelfCheckItem:
        duplicate_count = sum(1 for r in records if r.is_duplicate)
        hash_groups = {}

        for r in records:
            if r.import_hash not in hash_groups:
                hash_groups[r.import_hash] = []
            hash_groups[r.import_hash].append(r.record_id)

        duplicates_with_same_hash = [
            f"哈希{h[:8]}: {len(ids)}条记录 - {', '.join(i[:8] for i in ids)}"
            for h, ids in hash_groups.items()
            if len(ids) > 1
        ]

        if duplicate_count == 0 and not duplicates_with_same_hash:
            return SelfCheckItem(
                check_name="重复导入检测",
                passed=True,
                message=f"共{len(records)}条测距仪记录，无重复导入",
                severity="info"
            )
        else:
            return SelfCheckItem(
                check_name="重复导入检测",
                passed=False,
                message=f"检测到{duplicate_count}条重复记录，涉及{len(duplicates_with_same_hash)}组相同内容",
                details=duplicates_with_same_hash,
                severity="warning"
            )

    def _check_duplicate_names(self, result: AnnotationResult) -> SelfCheckItem:
        annotations = result.annotations
        pending_alias = [
            a for a in result.alias_candidates
            if a.confirm_status == ConfirmStatus.PENDING
        ]
        annotations_with_alias_issue = [
            a for a in annotations if a.has_name_alias_issue
        ]

        if not pending_alias and not annotations_with_alias_issue:
            return SelfCheckItem(
                check_name="同物异名检测",
                passed=True,
                message=f"共{len(annotations)}个障碍物，无未复核的同物异名",
                severity="info"
            )
        else:
            details = []
            for ac in pending_alias:
                details.append(
                    f"待复核:「{ac.primary_name}」与「{ac.alias_name}」"
                    f"相似度{ac.similarity:.2f}，距离{ac.distance_meters:.2f}米"
                )
            for ann in annotations_with_alias_issue:
                all_names = set()
                for rid in ann.source_records:
                    record = next(
                        (r for r in result.rangefinder_records if r.record_id == rid),
                        None
                    )
                    if record:
                        all_names.add(record.obstacle_name)
                for rid in ann.source_remarks:
                    remark = next(
                        (r for r in result.obstacle_remarks if r.remark_id == rid),
                        None
                    )
                    if remark:
                        all_names.add(remark.obstacle_name)
                details.append(
                    f"障碍物{ann.canonical_name}有{len(all_names)}个名称: {', '.join(all_names)}"
                )

            return SelfCheckItem(
                check_name="同物异名检测",
                passed=False,
                message=f"检测到{len(pending_alias)}个同物异名待复核，"
                        f"{len(annotations_with_alias_issue)}个标注有名称问题",
                details=details,
                severity="warning"
            )

    def _check_recalculate_consistency(self, result: AnnotationResult) -> SelfCheckItem:
        try:
            recalculated, _ = self.annotation_engine.calculate_annotations(
                task_id=result.task_id,
                trajectory_points=result.trajectory_points,
                rangefinder_records=result.rangefinder_records,
                obstacle_remarks=result.obstacle_remarks,
                existing_conflicts=result.conflicts,
                existing_alias_candidates=result.alias_candidates,
                operator="system_check"
            )

            inconsistencies = []

            if len(recalculated.annotations) != len(result.annotations):
                inconsistencies.append(
                    f"标注数量不一致: 原{len(result.annotations)}个，重算{len(recalculated.annotations)}个"
                )

            name_map_original = {a.annotation_id: a.canonical_name for a in result.annotations}
            name_map_recalc = {a.annotation_id: a.canonical_name for a in recalculated.annotations}

            for aid, orig_name in name_map_original.items():
                if aid in name_map_recalc and name_map_recalc[aid] != orig_name:
                    inconsistencies.append(
                        f"标注{aid[:8]}名称变化: {orig_name} -> {name_map_recalc[aid]}"
                    )

            for a1 in result.annotations:
                for a2 in recalculated.annotations:
                    if a1.canonical_name == a2.canonical_name:
                        dist = haversine_distance(
                            a1.latitude, a1.longitude,
                            a2.latitude, a2.longitude
                        )
                        if dist > 0.1:
                            inconsistencies.append(
                                f"标注{a1.canonical_name}位置偏差{dist:.2f}米"
                            )

            if not inconsistencies:
                return SelfCheckItem(
                    check_name="补录重算一致性",
                    passed=True,
                    message="重算结果与原结果完全一致，重算逻辑稳定",
                    severity="info"
                )
            else:
                return SelfCheckItem(
                    check_name="补录重算一致性",
                    passed=False,
                    message=f"重算检测到{len(inconsistencies)}处不一致",
                    details=inconsistencies,
                    severity="error"
                )

        except Exception as e:
            return SelfCheckItem(
                check_name="补录重算一致性",
                passed=False,
                message=f"重算执行失败: {str(e)}",
                severity="error"
            )

    def _check_export_consistency(self, result: AnnotationResult) -> SelfCheckItem:
        export_dict = self._prepare_export_data(result)
        page_dict = self._prepare_page_data(result)
        api_dict = self._prepare_api_data(result)

        export_hash = calculate_result_hash(export_dict)
        page_hash = calculate_result_hash(page_dict)
        api_hash = calculate_result_hash(api_dict)

        inconsistencies = []

        if export_hash != page_hash:
            inconsistencies.append("导出数据与页面展示数据不一致")
        if export_hash != api_hash:
            inconsistencies.append("导出数据与接口返回数据不一致")
        if page_hash != api_hash:
            inconsistencies.append("页面展示数据与接口返回数据不一致")

        annotation_names_export = sorted(
            a["canonical_name"] for a in export_dict["annotations"]
        )
        annotation_names_page = sorted(
            a["canonical_name"] for a in page_dict["annotations"]
        )
        annotation_names_api = sorted(
            a["canonical_name"] for a in api_dict["annotations"]
        )

        if annotation_names_export != annotation_names_page:
            inconsistencies.append(
                f"导出与页面的障碍物列表不一致: "
                f"导出{annotation_names_export} vs 页面{annotation_names_page}"
            )
        if annotation_names_export != annotation_names_api:
            inconsistencies.append(
                f"导出与接口的障碍物列表不一致: "
                f"导出{annotation_names_export} vs 接口{annotation_names_api}"
            )

        for ann in result.annotations:
            if ann.has_name_alias_issue:
                export_has_issue = any(
                    a.get("has_name_alias_issue")
                    for a in export_dict["annotations"]
                    if a["annotation_id"] == ann.annotation_id
                )
                page_has_issue = any(
                    a.get("has_name_alias_issue")
                    for a in page_dict["annotations"]
                    if a["annotation_id"] == ann.annotation_id
                )
                api_has_issue = any(
                    a.get("has_name_alias_issue")
                    for a in api_dict["annotations"]
                    if a["annotation_id"] == ann.annotation_id
                )
                if not (export_has_issue and page_has_issue and api_has_issue):
                    inconsistencies.append(
                        f"同物异名标记不一致: {ann.canonical_name} "
                        f"(导出={export_has_issue}, 页面={page_has_issue}, 接口={api_has_issue})"
                    )

        if not inconsistencies:
            return SelfCheckItem(
                check_name="导出/页面/接口一致性",
                passed=True,
                message="导出明细、页面展示、接口返回使用同一份数据，一致性校验通过",
                details=[f"数据哈希: {export_hash[:16]}..."],
                severity="info"
            )
        else:
            return SelfCheckItem(
                check_name="导出/页面/接口一致性",
                passed=False,
                message=f"检测到{len(inconsistencies)}处数据不一致",
                details=inconsistencies,
                severity="error"
            )

    def _prepare_export_data(self, result: AnnotationResult) -> dict:
        return {
            "task_id": result.task_id,
            "version": result.version,
            "calculation_meta": result.calculation_meta.model_dump(),
            "annotations": [
                {
                    "annotation_id": a.annotation_id,
                    "canonical_name": a.canonical_name,
                    "obstacle_type": a.obstacle_type,
                    "latitude": a.latitude,
                    "longitude": a.longitude,
                    "altitude": a.altitude,
                    "radius": a.radius,
                    "final_conclusion": a.final_conclusion,
                    "has_name_alias_issue": a.has_name_alias_issue,
                    "needs_review": a.needs_review,
                    "alias_candidates": [ac.model_dump() for ac in a.alias_candidates],
                    "conflicts": [c.model_dump() for c in a.conflicts],
                    "calculation_meta": a.calculation_meta.model_dump()
                }
                for a in result.annotations
            ],
            "conflicts": [c.model_dump() for c in result.conflicts],
            "alias_candidates": [ac.model_dump() for ac in result.alias_candidates]
        }

    def _prepare_page_data(self, result: AnnotationResult) -> dict:
        return self._prepare_export_data(result)

    def _prepare_api_data(self, result: AnnotationResult) -> dict:
        return self._prepare_export_data(result)
