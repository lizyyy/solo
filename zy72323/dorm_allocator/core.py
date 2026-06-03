import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from .models import (
    RecordStatus,
    ReviewRole,
    FormulaSource,
    Annotation,
    AllocationRecord,
    RunLog,
    ClassroomDemoResult,
)


class DormAllocator:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.records: Dict[str, AllocationRecord] = {}
        self.run_logs: Dict[str, RunLog] = {}
        self._load_data()

    def _load_data(self):
        records_file = self.data_dir / "records.json"
        logs_file = self.data_dir / "run_logs.json"

        if records_file.exists():
            with open(records_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for record_data in data:
                    record = AllocationRecord(**record_data)
                    self.records[record.id] = record

        if logs_file.exists():
            with open(logs_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for log_data in data:
                    log = RunLog(**log_data)
                    self.run_logs[log.run_id] = log

    def _save_data(self):
        records_file = self.data_dir / "records.json"
        logs_file = self.data_dir / "run_logs.json"

        with open(records_file, "w", encoding="utf-8") as f:
            json.dump([r.model_dump() for r in self.records.values()], f, default=str, indent=2, ensure_ascii=False)

        with open(logs_file, "w", encoding="utf-8") as f:
            json.dump([l.model_dump() for l in self.run_logs.values()], f, default=str, indent=2, ensure_ascii=False)

    def _generate_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def import_from_screenshot_data(
        self,
        screenshot_data: List[Dict[str, Any]],
        operator: str,
        operator_role: ReviewRole,
        is_old_formula: bool = True,
    ) -> str:
        run_id = self._generate_id()
        run_log = RunLog(
            run_id=run_id,
            run_type="import_screenshot",
            operator=operator,
            operator_role=operator_role,
            notes="从旧公式截图导入数据" if is_old_formula else "从修正后公式导入数据",
        )

        issues_found = []

        for item in screenshot_data:
            record_id = self._generate_id()
            numerator = float(item.get("numerator", 0))
            denominator = float(item.get("denominator", 0))

            is_zero_issue = denominator == 0
            if is_zero_issue:
                result = None
                result_display = item.get("result_display", "")
                issues_found.append(f"记录 {item.get('student_name', '未知')}: 分母为0，显示值为'{result_display}'")
            else:
                result = numerator / denominator
                result_display = f"{result:.2f}"

            record = AllocationRecord(
                id=record_id,
                student_id=item.get("student_id", ""),
                student_name=item.get("student_name", ""),
                dorm_preference=item.get("dorm_preference", ""),
                assigned_dorm=item.get("assigned_dorm", ""),
                numerator=numerator,
                denominator=denominator,
                result=result,
                result_display=result_display,
                formula_source=FormulaSource.OLD_SCREENSHOT if is_old_formula else FormulaSource.CORRECTED,
                run_id=run_id,
                is_denominator_zero_issue=is_zero_issue,
                status=RecordStatus.PENDING_REVIEW if is_zero_issue else RecordStatus.REVIEWING,
            )

            self.records[record_id] = record

        run_log.finished_at = datetime.now()
        run_log.record_count = len(screenshot_data)
        run_log.issues_found = issues_found
        self.run_logs[run_id] = run_log
        self._save_data()

        return run_id

    def add_annotation(
        self,
        record_id: str,
        content: str,
        author_name: str,
        author_role: ReviewRole,
    ) -> Optional[str]:
        if record_id not in self.records:
            return None

        annotation_id = self._generate_id()
        annotation = Annotation(
            id=annotation_id,
            author_role=author_role,
            author_name=author_name,
            content=content,
        )

        self.records[record_id].annotations.append(annotation)
        self.records[record_id].updated_at = datetime.now()
        self._save_data()

        return annotation_id

    def approve_annotation(
        self,
        record_id: str,
        annotation_id: str,
        approved_by: str,
    ) -> bool:
        if record_id not in self.records:
            return False

        record = self.records[record_id]
        for ann in record.annotations:
            if ann.id == annotation_id:
                ann.is_approved = True
                ann.approved_by = approved_by
                ann.approved_at = datetime.now()
                record.updated_at = datetime.now()
                self._save_data()
                return True
        return False

    def review_record(
        self,
        record_id: str,
        reviewer_name: str,
        reviewer_role: ReviewRole,
        review_note: str,
        new_status: Optional[RecordStatus] = None,
    ) -> bool:
        if record_id not in self.records:
            return False

        record = self.records[record_id]
        record.reviewed_by = reviewer_name
        record.review_note = review_note
        record.updated_at = datetime.now()

        if new_status:
            record.status = new_status

        self._save_data()
        return True

    def correct_denominator(
        self,
        record_id: str,
        new_denominator: float,
        corrected_by: str,
        correction_note: str,
    ) -> Optional[float]:
        if record_id not in self.records:
            return None

        record = self.records[record_id]
        record.denominator = new_denominator
        record.is_denominator_zero_issue = (new_denominator == 0)

        if new_denominator != 0:
            record.result = record.numerator / new_denominator
            record.result_display = f"{record.result:.2f}"
        else:
            record.result = None
            record.result_display = ""

        record.status = RecordStatus.CORRECTED
        record.formula_source = FormulaSource.CORRECTED
        record.updated_at = datetime.now()

        self.add_annotation(
            record_id=record_id,
            content=f"分母修正: {new_denominator}。备注: {correction_note}",
            author_name=corrected_by,
            author_role=ReviewRole.DATA_CHECKER,
        )

        self._save_data()
        return record.result

    def rerun_with_annotations(
        self,
        previous_run_id: str,
        operator: str,
        operator_role: ReviewRole,
    ) -> str:
        new_run_id = self._generate_id()

        prev_records = [r for r in self.records.values() if r.run_id == previous_run_id]

        run_log = RunLog(
            run_id=new_run_id,
            run_type="rerun_with_annotations",
            is_correction_run=True,
            previous_run_id=previous_run_id,
            operator=operator,
            operator_role=operator_role,
            notes="基于批注重新运行",
        )

        for prev_record in prev_records:
            new_record = AllocationRecord(
                id=self._generate_id(),
                student_id=prev_record.student_id,
                student_name=prev_record.student_name,
                dorm_preference=prev_record.dorm_preference,
                assigned_dorm=prev_record.assigned_dorm,
                numerator=prev_record.numerator,
                denominator=prev_record.denominator,
                result=prev_record.result,
                result_display=prev_record.result_display,
                status=prev_record.status,
                formula_source=prev_record.formula_source,
                annotations=prev_record.annotations.copy(),
                run_id=new_run_id,
                is_denominator_zero_issue=prev_record.is_denominator_zero_issue,
            )
            self.records[new_record.id] = new_record

        run_log.finished_at = datetime.now()
        run_log.record_count = len(prev_records)
        self.run_logs[new_run_id] = run_log
        self._save_data()

        return new_run_id

    def get_classroom_demo_results(
        self,
        run_id: Optional[str] = None,
    ) -> List[ClassroomDemoResult]:
        if run_id:
            records = [r for r in self.records.values() if r.run_id == run_id]
        else:
            records = list(self.records.values())

        results = []
        for record in records:
            results.append(self._generate_demo_result(record))
        return results

    def _generate_demo_result(self, record: AllocationRecord) -> ClassroomDemoResult:
        formula = "分配得分 = 匹配度 / 优先级权重"
        calculation = f"{record.numerator} / {record.denominator}"

        if record.is_denominator_zero_issue:
            status_explanation = "分母为0，存在数据问题"
            why_kept = "保留原始截图数据，等待数据复核人确认分母真实值，不自动归正常"
            missing_materials = ["分母的真实来源数据", "数据复核人的确认签字"]
            next_action = "联系数据复核人核实分母数据"
            next_contact = "数据复核人"
        elif record.status == RecordStatus.PENDING_REVIEW:
            status_explanation = "待复核"
            why_kept = "数据已导入但尚未经过教研流程确认"
            missing_materials = ["老师批注", "教研负责人审核记录"]
            next_action = "请老师补充批注，然后送教研负责人审核"
            next_contact = "授课老师 → 教研负责人吴老师"
        elif record.status == RecordStatus.REVIEWING:
            status_explanation = "教研负责人审核中"
            why_kept = "吴老师正在回看批注，确认计算逻辑是否符合教研要求"
            missing_materials = ["教研负责人的最终审批意见"]
            next_action = "等待吴老师完成审核"
            next_contact = "教研负责人吴老师"
        elif record.status == RecordStatus.CORRECTED:
            status_explanation = "已修正并复核"
            why_kept = "数据问题已修正，批注完整，可作为课堂演示案例"
            missing_materials = []
            next_action = "无需进一步动作，可直接用于课堂演示"
            next_contact = "无需联系"
        else:
            status_explanation = "已验证"
            why_kept = "完整通过教研流程审核"
            missing_materials = []
            next_action = "正常使用"
            next_contact = "无需联系"

        annotations_summary = [
            f"[{ann.author_name}] {ann.content}"
            for ann in record.annotations
        ]

        return ClassroomDemoResult(
            record_id=record.id,
            student_name=record.student_name,
            assigned_dorm=record.assigned_dorm,
            formula_used=formula,
            calculation=calculation,
            result_value=record.result,
            result_display=record.result_display,
            status=record.status.value,
            status_explanation=status_explanation,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_action=next_action,
            next_contact=next_contact,
            annotations_summary=annotations_summary,
        )

    def generate_review_report(self, run_id: str) -> Dict[str, Any]:
        records = [r for r in self.records.values() if r.run_id == run_id]
        run_log = self.run_logs.get(run_id)

        issues = [r for r in records if r.is_denominator_zero_issue]
        annotated = [r for r in records if len(r.annotations) > 0]

        report = {
            "run_id": run_id,
            "run_log": run_log.model_dump() if run_log else None,
            "total_records": len(records),
            "denominator_zero_issues": len(issues),
            "records_with_annotations": len(annotated),
            "status_summary": {
                status.value: len([r for r in records if r.status == status])
                for status in RecordStatus
            },
            "issue_records": [r.model_dump() for r in issues],
            "classroom_demo": [r.model_dump() for r in self.get_classroom_demo_results(run_id)],
        }
        return report

    def get_run_log(self, run_id: str) -> Optional[RunLog]:
        return self.run_logs.get(run_id)

    def get_record(self, record_id: str) -> Optional[AllocationRecord]:
        return self.records.get(record_id)

    def list_run_ids(self) -> List[str]:
        return list(self.run_logs.keys())
