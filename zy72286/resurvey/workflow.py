from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import os

from .models import ResurveyProject, ProcessingStatus
from .processor import DataProcessor, generate_id
from .exporter import DataExporter, UnifiedDataSource
from .self_check import SelfChecker


class ThreeStepWorkflow:
    def __init__(self, project: Optional[ResurveyProject] = None):
        if project is None:
            project = ResurveyProject(project_id=generate_id("PRJ"))
        self.project = project
        self.processor = DataProcessor(project)
        self.exporter = DataExporter(project)
        self.checker = SelfChecker(project)
        self.data_source = UnifiedDataSource(project)
        self.step_history: List[Dict[str, Any]] = []

    def step1_import_obstacle_remarks(
        self,
        file_path: str,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        result = self.processor.import_obstacle_remarks(file_path, operator)

        self.step_history.append({
            "step": 1,
            "name": "导入障碍物备注",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "operator": operator,
            "result": result,
        })

        return {
            "step": 1,
            "name": "导入障碍物备注",
            "completed": True,
            "import_result": result,
            "next_step": "step2_review_floor_sketches",
        }

    def step2_review_floor_sketches(
        self,
        record_id: str,
        sketch_file_path: str,
        building: str,
        floors: int,
        review_note: str,
        reviewer: str = "许工",
    ) -> Dict[str, Any]:
        add_result = self.processor.add_floor_sketch(
            record_id, sketch_file_path, building, floors, reviewer
        )

        if not add_result["success"]:
            return add_result

        sketch_id = add_result["sketch_id"]
        review_result = self.processor.review_floor_sketch(
            sketch_id, review_note, reviewer
        )

        self.step_history.append({
            "step": 2,
            "name": "补看楼层剖面草图",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "reviewer": reviewer,
            "record_id": record_id,
            "sketch_id": sketch_id,
            "result": review_result,
        })

        return {
            "step": 2,
            "name": "补看楼层剖面草图",
            "completed": True,
            "record_id": record_id,
            "sketch_id": sketch_id,
            "review_result": review_result,
            "next_step": "step3_export",
        }

    def step3_export(
        self,
        excel_path: str,
        json_path: Optional[str] = None,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        excel_result = self.exporter.export_to_excel(excel_path)

        json_result = None
        if json_path:
            json_result = self.exporter.export_to_json(json_path)

        consistency_result = self.exporter.verify_consistency()

        self.step_history.append({
            "step": 3,
            "name": "导出截图更新",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "operator": operator,
            "excel_result": excel_result,
            "json_result": json_result,
            "consistency": consistency_result,
        })

        return {
            "step": 3,
            "name": "导出截图更新",
            "completed": True,
            "excel_export": excel_result,
            "json_export": json_result,
            "consistency_check": consistency_result,
            "next_step": "workflow_completed",
        }

    def handle_length_not_recalculated(
        self,
        record_id: str,
        new_points: List[Dict[str, float]],
        remark: str = "",
        operator: str = "许工",
        auto_recalculate: bool = False,
    ) -> Dict[str, Any]:
        supplement_result = self.processor.supplement_route(
            record_id, new_points, remark, operator, auto_recalculate
        )

        if not auto_recalculate and supplement_result.get("needs_recalculation"):
            self.processor.mark_for_customer_review(
                record_id,
                f"补录路线未重算，请客户复核: {supplement_result.get('reason', '')}",
                operator,
            )

        return {
            "action": "handle_length_not_recalculated",
            "record_id": record_id,
            "auto_recalculated": auto_recalculate,
            "needs_customer_review": not auto_recalculate and supplement_result.get("needs_recalculation"),
            "supplement_result": supplement_result,
            "evidence": self.data_source.get_evidence_summary(record_id),
        }

    def recalculate_after_review(
        self,
        record_id: str,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        result = self.processor.recalculate_route_length(record_id, operator)

        record = self.project.get_record(record_id)
        if record and record.obstacle_remark:
            record.obstacle_remark.processing_status = ProcessingStatus.VERIFIED
            record.obstacle_remark.add_manual_change(
                "客户复核完成，已重算并标记为已核实", operator
            )

        return {
            "action": "recalculate_after_review",
            "record_id": record_id,
            "result": result,
            "evidence": self.data_source.get_evidence_summary(record_id),
        }

    def run_full_workflow(
        self,
        import_file: str,
        sketch_info: List[Dict[str, Any]],
        export_excel: str,
        export_json: Optional[str] = None,
        operator: str = "许工",
    ) -> Dict[str, Any]:
        results = {}

        results["step1"] = self.step1_import_obstacle_remarks(import_file, operator)

        for info in sketch_info:
            results.setdefault("step2", []).append(
                self.step2_review_floor_sketches(
                    info["record_id"],
                    info["sketch_file"],
                    info["building"],
                    info["floors"],
                    info["review_note"],
                    operator,
                )
            )

        results["step3"] = self.step3_export(export_excel, export_json, operator)
        results["self_check"] = self.checker.run_all_checks()

        return {
            "workflow_completed": True,
            "project_id": self.project.project_id,
            "total_records": len(self.project.records),
            "steps": results,
        }

    def get_evidence_for_api(self) -> Dict[str, Any]:
        return {
            "project_id": self.project.project_id,
            "project_name": self.project.project_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": self.checker.get_summary(),
            "records": [
                self.data_source.get_evidence_summary(rid)
                for rid in self.project.records.keys()
            ],
            "needing_customer_review": self.checker.get_records_needing_customer_review(),
            "workflow_history": self.step_history,
        }

    def save_project(self, file_path: str) -> None:
        self.processor.save_project(file_path)

    @staticmethod
    def load_project(file_path: str) -> "ThreeStepWorkflow":
        processor = DataProcessor.load_project(file_path)
        workflow = ThreeStepWorkflow(processor.project)
        return workflow
