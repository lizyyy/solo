from datetime import datetime
from typing import List, Optional, Dict
import json
import os

from .models import ModelOutput, ManualJudgment, EvaluationReport
from .reflow_engine import ReflowEngine


class WorkflowStep:
    STEP1_IMPORT = "step1_model_import"
    STEP2_SUPPLEMENT = "step2_manual_supplement"
    STEP3_REPORT = "step3_report_update"


class WorkflowManager:
    def __init__(self, engine: Optional[ReflowEngine] = None, data_dir: str = "./data"):
        self.engine = engine or ReflowEngine()
        self.data_dir = data_dir
        self.workflow_log: List[Dict] = []
        os.makedirs(data_dir, exist_ok=True)

    def step1_import_model_outputs(
        self,
        outputs: List[ModelOutput],
        operator: str,
    ) -> Dict:
        results = []
        for output in outputs:
            result = self.engine.import_model_output(output, operator)
            results.append(result)

        self._log_workflow(
            step=WorkflowStep.STEP1_IMPORT,
            operator=operator,
            details={
                "imported_count": len(outputs),
                "batch_ids": list({o.batch_id for o in outputs}),
                "sample_ids": [o.sample_id for o in outputs],
            },
        )

        return {
            "step": WorkflowStep.STEP1_IMPORT,
            "processed_count": len(results),
            "sample_ids": [r.sample_id for r in results],
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
        }

    def step2_supplement_manual_judgments(
        self,
        judgments: List[ManualJudgment],
        operator: str,
    ) -> Dict:
        results = []
        covered_samples = []
        normal_samples = []

        for judgment in judgments:
            result = self.engine.add_manual_judgment(judgment, operator)
            results.append(result)
            if result.status.value == "covered_pending_review":
                covered_samples.append(result.sample_id)
            else:
                normal_samples.append(result.sample_id)

        self._log_workflow(
            step=WorkflowStep.STEP2_SUPPLEMENT,
            operator=operator,
            details={
                "supplemented_count": len(judgments),
                "normal_samples": normal_samples,
                "covered_pending_review_samples": covered_samples,
                "judgment_ids": [j.judgment_id for j in judgments],
            },
        )

        return {
            "step": WorkflowStep.STEP2_SUPPLEMENT,
            "processed_count": len(results),
            "normal_count": len(normal_samples),
            "covered_pending_review_count": len(covered_samples),
            "covered_samples": covered_samples,
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
        }

    def step3_update_evaluation_report(
        self,
        report_id: str,
        operator: str,
        parent_report_id: Optional[str] = None,
        version: int = 1,
    ) -> Dict:
        report = self.engine.generate_evaluation_report(
            report_id=report_id,
            operator=operator,
            parent_report_id=parent_report_id,
            version=version,
        )

        self._save_report(report)

        self._log_workflow(
            step=WorkflowStep.STEP3_REPORT,
            operator=operator,
            details={
                "report_id": report_id,
                "version": version,
                "total_samples": report.total_samples,
                "parent_report_id": parent_report_id,
            },
        )

        return {
            "step": WorkflowStep.STEP3_REPORT,
            "report_id": report.report_id,
            "version": report.version,
            "total_samples": report.total_samples,
            "label_distribution": report.label_distribution,
            "generated_time": report.generated_time.isoformat(),
            "generated_by": report.generated_by,
        }

    def run_full_workflow(
        self,
        outputs: List[ModelOutput],
        judgments: List[ManualJudgment],
        report_id: str,
        operator: str,
        parent_report_id: Optional[str] = None,
        version: int = 1,
    ) -> Dict:
        step1_result = self.step1_import_model_outputs(outputs, operator)
        step2_result = self.step2_supplement_manual_judgments(judgments, operator)
        step3_result = self.step3_update_evaluation_report(
            report_id, operator, parent_report_id, version
        )

        return {
            "workflow_complete": True,
            "step1": step1_result,
            "step2": step2_result,
            "step3": step3_result,
            "total_samples_in_report": step3_result["total_samples"],
            "covered_pending_samples": step2_result["covered_samples"],
        }

    def _log_workflow(self, step: str, operator: str, details: Dict) -> None:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "step": step,
            "operator": operator,
            "details": details,
        }
        self.workflow_log.append(entry)
        self._save_workflow_log()

    def _save_workflow_log(self) -> None:
        log_path = os.path.join(self.data_dir, "workflow_log.json")
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(self.workflow_log, f, ensure_ascii=False, indent=2)

    def _save_report(self, report: EvaluationReport) -> None:
        report_dir = os.path.join(self.data_dir, "reports")
        os.makedirs(report_dir, exist_ok=True)
        report_path = os.path.join(report_dir, f"{report.report_id}_v{report.version}.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def get_workflow_summary(self) -> Dict:
        steps_summary = {}
        for entry in self.workflow_log:
            step = entry["step"]
            if step not in steps_summary:
                steps_summary[step] = []
            steps_summary[step].append(entry)

        return {
            "total_steps": len(self.workflow_log),
            "steps_summary": {k: len(v) for k, v in steps_summary.items()},
            "full_log": self.workflow_log,
        }
