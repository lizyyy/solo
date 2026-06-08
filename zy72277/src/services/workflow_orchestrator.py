from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from src.models.base import (
    TrajectoryPoint, AnnotationResult, SelfCheckReport,
    OperationLog, ConfirmStatus, ConflictEvidence
)
from src.services.rangefinder_importer import RangefinderImporter
from src.services.remark_manager import RemarkManager
from src.services.alias_detector import AliasDetector
from src.services.annotation_engine import AnnotationEngine
from src.services.self_checker import SelfChecker
from src.services.unified_result_exporter import UnifiedResultExporter


class WorkflowStep(str):
    STEP_1_IMPORT = "step1_import_rangefinder"
    STEP_2_REMARK = "step2_supplement_remarks"
    STEP_3_VIEW_UPDATE = "step3_3d_view_update"


class WorkflowOrchestrator:
    def __init__(self):
        self.rangefinder_importer = RangefinderImporter()
        self.remark_manager = RemarkManager()
        self.alias_detector = AliasDetector()
        self.annotation_engine = AnnotationEngine()
        self.self_checker = SelfChecker(self.annotation_engine)
        self.exporter = UnifiedResultExporter()

        self.current_step = None
        self.task_id = None
        self.trajectory_points: List[TrajectoryPoint] = []
        self.result_history: List[AnnotationResult] = []
        self.pending_decisions: List[Dict[str, Any]] = []

    def start_task(self, task_id: str, trajectory_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        self.task_id = task_id
        self.trajectory_points = [
            TrajectoryPoint(**tp) for tp in trajectory_data
        ]
        self.current_step = None
        self.result_history = []
        self.pending_decisions = []

        return {
            "task_id": task_id,
            "status": "initialized",
            "next_step": WorkflowStep.STEP_1_IMPORT,
            "trajectory_points_count": len(self.trajectory_points)
        }

    def step_1_import_rangefinder(
        self,
        raw_records: List[Dict[str, Any]],
        source_batch: str,
        imported_by: str
    ) -> Dict[str, Any]:
        records, logs, warnings = self.rangefinder_importer.import_records(
            raw_records, source_batch, imported_by
        )

        result, calc_logs = self.annotation_engine.calculate_annotations(
            task_id=self.task_id,
            trajectory_points=self.trajectory_points,
            rangefinder_records=records,
            obstacle_remarks=[],
            operator=imported_by,
            change_reason="首次导入测距仪记录"
        )

        all_logs = logs + calc_logs
        result.operations_log = all_logs
        self.result_history.append(result)
        self.current_step = WorkflowStep.STEP_1_IMPORT

        self_check = self.self_checker.run_all_checks(result)

        pending_aliases, alias_logs = self.alias_detector.detect_aliases(
            records, [], previous_candidates=self.result_history[-1].alias_candidates if self.result_history else None
        )
        result.alias_candidates = pending_aliases
        result.operations_log.extend(alias_logs)

        self._collect_pending_decisions(result)

        view_3d = self.exporter.get_3d_annotation_view(result)

        return {
            "step": WorkflowStep.STEP_1_IMPORT,
            "completed": True,
            "result_summary": self._build_summary(result),
            "self_check": self_check.model_dump(),
            "pending_decisions": self.pending_decisions,
            "warnings": warnings,
            "view_3d": view_3d,
            "next_step": WorkflowStep.STEP_2_REMARK,
            "prompt_for_instructor": (
                f"培训教官{imported_by}您好，已完成测距仪记录导入。"
                f"生成{len(result.annotations)}个障碍物标注，"
                f"其中{len(self.pending_decisions)}项需要人工确认。"
                f"请检查是否有障碍物备注需要补录。"
            )
        }

    def step_2_supplement_remarks(
        self,
        remark_data_list: List[Dict[str, Any]],
        submitted_by: str
    ) -> Dict[str, Any]:
        if not self.result_history:
            return {"error": "请先完成第一步：导入测距仪记录"}

        previous_result = self.result_history[-1]
        all_logs = list(previous_result.operations_log)
        all_conflicts = list(previous_result.conflicts)
        all_remarks = list(previous_result.obstacle_remarks)

        for remark_data in remark_data_list:
            remark = self.remark_manager.add_remark(remark_data, submitted_by)
            all_remarks.append(remark)

            conflicts, conflict_logs = self.remark_manager.detect_conflicts(
                remark, previous_result.rangefinder_records
            )
            all_conflicts.extend(conflicts)
            all_logs.extend(conflict_logs)

        alias_candidates, alias_logs = self.alias_detector.detect_aliases(
            previous_result.rangefinder_records, all_remarks,
            previous_candidates=previous_result.alias_candidates
        )
        all_logs.extend(alias_logs)

        new_result, calc_logs = self.annotation_engine.calculate_annotations(
            task_id=self.task_id,
            trajectory_points=self.trajectory_points,
            rangefinder_records=previous_result.rangefinder_records,
            obstacle_remarks=all_remarks,
            existing_conflicts=all_conflicts,
            existing_alias_candidates=alias_candidates,
            previous_result=previous_result,
            operator=submitted_by,
            change_reason="补录障碍物备注"
        )

        all_logs.extend(calc_logs)
        new_result.operations_log = all_logs
        self.result_history.append(new_result)
        self.current_step = WorkflowStep.STEP_2_REMARK

        self_check = self.self_checker.run_all_checks(new_result)
        self._collect_pending_decisions(new_result)

        view_3d_before = self.exporter.get_3d_annotation_view(previous_result)
        view_3d_after = self.exporter.get_3d_annotation_view(new_result)
        view_changes = self._compare_views(view_3d_before, view_3d_after)

        return {
            "step": WorkflowStep.STEP_2_REMARK,
            "completed": True,
            "result_summary": self._build_summary(new_result),
            "self_check": self_check.model_dump(),
            "pending_decisions": self.pending_decisions,
            "view_changes": view_changes,
            "view_3d": view_3d_after,
            "previous_view_3d": view_3d_before,
            "next_step": WorkflowStep.STEP_3_VIEW_UPDATE,
            "prompt_for_instructor": (
                f"培训教官{submitted_by}您好，已补录{len(remark_data_list)}条障碍物备注。"
                f"检测到{len(all_conflicts)}处冲突，{len(alias_candidates)}个同物异名候选。"
                f"三维标注视图已更新，请检查标注变化是否正确。"
                f"请优先处理冲突决策：先列出冲突证据，再确认或驳回。"
            ),
            "rework_available": self._build_rework_scenario(previous_result, new_result)
        }

    def decide_conflict(
        self,
        conflict_id: str,
        operator: str,
        confirm: bool
    ) -> Dict[str, Any]:
        if not self.result_history:
            return {"error": "请先导入数据"}

        current_result = self.result_history[-1]
        conflicts, logs = self.remark_manager.decide_conflict(
            conflict_id, current_result.conflicts, operator, confirm
        )
        current_result.conflicts = conflicts
        current_result.operations_log.extend(logs)

        new_result, calc_logs = self.annotation_engine.calculate_annotations(
            task_id=self.task_id,
            trajectory_points=self.trajectory_points,
            rangefinder_records=current_result.rangefinder_records,
            obstacle_remarks=current_result.obstacle_remarks,
            existing_conflicts=current_result.conflicts,
            existing_alias_candidates=current_result.alias_candidates,
            previous_result=current_result,
            operator=operator,
            change_reason=f"{'确认' if confirm else '驳回'}冲突{conflict_id[:8]}"
        )

        new_result.operations_log.extend(calc_logs)
        self.result_history.append(new_result)

        self._collect_pending_decisions(new_result)
        self_check = self.self_checker.run_all_checks(new_result)
        view_3d = self.exporter.get_3d_annotation_view(new_result)

        return {
            "action": "decide_conflict",
            "completed": True,
            "result_summary": self._build_summary(new_result),
            "self_check": self_check.model_dump(),
            "pending_decisions": self.pending_decisions,
            "view_3d": view_3d,
            "prompt_for_instructor": (
                f"已记录您的决策：{'确认' if confirm else '驳回'}冲突{conflict_id[:8]}。"
                f"三维标注已更新，版本v{new_result.version}。"
                f"还有{len(self.pending_decisions)}项待处理。"
            )
        }

    def review_alias(
        self,
        candidate_id: str,
        reviewer: str,
        is_same_object: bool
    ) -> Dict[str, Any]:
        if not self.result_history:
            return {"error": "请先导入数据"}

        current_result = self.result_history[-1]
        candidates, logs = self.alias_detector.review_alias(
            candidate_id, current_result.alias_candidates, reviewer, is_same_object
        )
        current_result.alias_candidates = candidates
        current_result.operations_log.extend(logs)

        new_result, calc_logs = self.annotation_engine.calculate_annotations(
            task_id=self.task_id,
            trajectory_points=self.trajectory_points,
            rangefinder_records=current_result.rangefinder_records,
            obstacle_remarks=current_result.obstacle_remarks,
            existing_conflicts=current_result.conflicts,
            existing_alias_candidates=current_result.alias_candidates,
            previous_result=current_result,
            operator=reviewer,
            change_reason=f"学员复核同物异名: {'确认' if is_same_object else '驳回'}{candidate_id[:8]}"
        )

        new_result.operations_log.extend(calc_logs)
        self.result_history.append(new_result)

        self._collect_pending_decisions(new_result)
        self_check = self.self_checker.run_all_checks(new_result)
        view_3d = self.exporter.get_3d_annotation_view(new_result)

        return {
            "action": "review_alias",
            "completed": True,
            "result_summary": self._build_summary(new_result),
            "self_check": self_check.model_dump(),
            "pending_decisions": self.pending_decisions,
            "view_3d": view_3d,
            "prompt_for_instructor": (
                f"学员{reviewer}已完成同物异名复核："
                f"{'确认是同物异名' if is_same_object else '判定为不同物体'}。"
                f"三维标注已更新，版本v{new_result.version}。"
                f"还有{len(self.pending_decisions)}项待处理。"
            )
        }

    def step_3_view_update(self, operator: str) -> Dict[str, Any]:
        if not self.result_history:
            return {"error": "请先完成前两步"}

        current_result = self.result_history[-1]
        self.current_step = WorkflowStep.STEP_3_VIEW_UPDATE

        self_check = self.self_checker.run_all_checks(current_result)
        view_3d = self.exporter.get_3d_annotation_view(current_result)
        api_data = self.exporter.get_for_api(current_result)
        page_data = self.exporter.get_for_page(current_result)
        csv_data = self.exporter.export_to_csv(current_result)

        log = OperationLog(
            operator=operator,
            action="step_3_completed",
            detail=f"三步流程完成，最终版本v{current_result.version}，自检{'通过' if self_check.overall_passed else '未通过'}"
        )
        current_result.operations_log.append(log)

        return {
            "step": WorkflowStep.STEP_3_VIEW_UPDATE,
            "completed": True,
            "workflow_completed": True,
            "result_summary": self._build_summary(current_result),
            "self_check": self_check.model_dump(),
            "pending_decisions": self.pending_decisions,
            "view_3d": view_3d,
            "api_data": api_data,
            "page_data": page_data,
            "csv_export": csv_data,
            "data_consistency_verified": (
                api_data["data_hash"] == page_data["data_hash"]
            ),
            "version_history": self._build_version_history(),
            "prompt_for_instructor": (
                f"培训教官{operator}您好，三步流程已全部完成。"
                f"最终版本v{current_result.version}，"
                f"包含{len(current_result.annotations)}个障碍物标注。"
                f"数据一致性校验{'通过' if api_data['data_hash'] == page_data['data_hash'] else '未通过'}，"
                f"自检{'通过' if self_check.overall_passed else '发现问题'}。"
                f"页面、接口、导出使用同一份数据，哈希值：{api_data['data_hash'][:16]}..."
            )
        }

    def _collect_pending_decisions(self, result: AnnotationResult) -> None:
        self.pending_decisions = []

        for conflict in result.conflicts:
            if conflict.confirm_status == ConfirmStatus.PENDING:
                self.pending_decisions.append({
                    "type": "conflict",
                    "id": conflict.conflict_id,
                    "conflict_type": conflict.conflict_type.value,
                    "description": conflict.description,
                    "rangefinder_value": conflict.rangefinder_value,
                    "remark_value": conflict.remark_value,
                    "action_required": "请培训教官确认或驳回此冲突",
                    "decision_guide": "不要自动拍板，先列出冲突证据，让老梁选"
                })

        for alias in result.alias_candidates:
            if alias.confirm_status == ConfirmStatus.PENDING:
                self.pending_decisions.append({
                    "type": "alias_review",
                    "id": alias.candidate_id,
                    "primary_name": alias.primary_name,
                    "alias_name": alias.alias_name,
                    "similarity": alias.similarity,
                    "distance_meters": alias.distance_meters,
                    "action_required": "请培训学员复核是否为同物异名",
                    "decision_guide": "别急着归正常，留给培训学员复核"
                })

    def _build_summary(self, result: AnnotationResult) -> Dict[str, Any]:
        return {
            "version": f"v{result.version}",
            "result_id": result.result_id,
            "total_obstacles": len(result.annotations),
            "total_rangefinder_records": len(result.rangefinder_records),
            "duplicate_records": sum(1 for r in result.rangefinder_records if r.is_duplicate),
            "total_remarks": len(result.obstacle_remarks),
            "obstacles_need_review": sum(1 for a in result.annotations if a.needs_review),
            "obstacles_with_alias_issue": sum(1 for a in result.annotations if a.has_name_alias_issue),
            "total_conflicts": len(result.conflicts),
            "pending_conflicts": sum(1 for c in result.conflicts if c.confirm_status == ConfirmStatus.PENDING),
            "pending_alias_reviews": sum(1 for ac in result.alias_candidates if ac.confirm_status == ConfirmStatus.PENDING),
            "calculation_meta": result.calculation_meta.model_dump()
        }

    def _compare_views(
        self,
        view_before: Dict[str, Any],
        view_after: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        changes = []

        before_map = {o["id"]: o for o in view_before["obstacles"]}
        after_map = {o["id"]: o for o in view_after["obstacles"]}

        for oid, after_obj in after_map.items():
            if oid not in before_map:
                changes.append({
                    "type": "new_obstacle",
                    "obstacle_name": after_obj["name"],
                    "description": f"新增障碍物{after_obj['name']}",
                    "reason": "补录备注后发现新障碍物"
                })
            else:
                before_obj = before_map[oid]
                if before_obj["conclusion"] != after_obj["conclusion"]:
                    changes.append({
                        "type": "conclusion_changed",
                        "obstacle_name": after_obj["name"],
                        "before": before_obj["conclusion"],
                        "after": after_obj["conclusion"],
                        "description": f"{after_obj['name']}的结论变化",
                        "reason": "补录备注后结论更新，测距仪结论与现场备注不一致，以已确认的备注为准"
                    })
                if before_obj["color"] != after_obj["color"]:
                    changes.append({
                        "type": "status_changed",
                        "obstacle_name": after_obj["name"],
                        "before": before_obj["color"],
                        "after": after_obj["color"],
                        "description": f"{after_obj['name']}的状态颜色变化",
                        "reason": "状态变更导致显示颜色更新"
                    })

        return changes

    def _build_rework_scenario(
        self,
        old_result: AnnotationResult,
        new_result: AnnotationResult
    ) -> Dict[str, Any]:
        rework_example = None

        for old_ann in old_result.annotations:
            for new_ann in new_result.annotations:
                if old_ann.canonical_name == new_ann.canonical_name:
                    if old_ann.final_conclusion != new_ann.final_conclusion:
                        related_conflicts = [
                            c for c in new_result.conflicts
                            if c.rangefinder_record_id in new_ann.source_records
                            or (c.remark_id and c.remark_id in new_ann.source_remarks)
                        ]

                        rework_example = {
                            "obstacle_name": old_ann.canonical_name,
                            "old_conclusion": old_ann.final_conclusion,
                            "new_conclusion": new_ann.final_conclusion,
                            "old_version": f"v{old_result.version}",
                            "new_version": f"v{new_result.version}",
                            "why_view_changed": (
                                f"测距仪最初给出结论「{old_ann.final_conclusion}」，"
                                f"后来群里补录障碍物备注，现场说法是「{new_ann.final_conclusion}」。"
                                f"培训教官老梁回看时发现冲突，"
                                f"系统检测到{len(related_conflicts)}处矛盾证据："
                                + "；".join([c.description for c in related_conflicts])
                                + "。三维标注视图因此更新，原因是补录了现场备注，"
                                "结论优先级调整为：已确认的备注结论 > 测距仪结论。"
                            ),
                            "related_conflicts": [c.model_dump() for c in related_conflicts],
                            "calculation_parameters": new_ann.calculation_meta.model_dump()
                        }
                        break
            if rework_example:
                break

        return {
            "rework_available": rework_example is not None,
            "example": rework_example,
            "instruction": (
                "这是一个返工场景：测距仪先给出旧结论，后来障碍物备注补到现场说法，"
                "培训教官老梁能看到三维标注视图为什么变了。"
                "系统保留了完整的版本历史和变更原因。"
            )
        }

    def _build_version_history(self) -> List[Dict[str, Any]]:
        history = []
        for i, result in enumerate(self.result_history):
            history.append({
                "version": f"v{result.version}",
                "result_id": result.result_id,
                "creation_time": result.creation_time.isoformat(),
                "obstacle_count": len(result.annotations),
                "change_reason": result.annotations[0].change_reason if result.annotations else None,
                "is_latest": result.is_latest
            })
        return history

    def get_export_data(self, result_id: str = None) -> Dict[str, Any]:
        if result_id:
            result = next(
                (r for r in self.result_history if r.result_id == result_id),
                None
            )
        else:
            result = self.result_history[-1] if self.result_history else None

        if not result:
            return {"error": "未找到对应结果"}

        return {
            "csv": self.exporter.export_to_csv(result),
            "json": self.exporter.export_to_json(result),
            "api": self.exporter.get_for_api(result),
            "page": self.exporter.get_for_page(result),
            "view_3d": self.exporter.get_3d_annotation_view(result)
        }
