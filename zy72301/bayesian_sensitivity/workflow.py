from __future__ import annotations

import json
import uuid
from pathlib import Path

from .audit import (
    record_boundary_review,
    record_error_update,
    record_import,
    record_manual_correction,
    record_rerun,
    format_audit_trail,
)
from .engine import run_sensitivity, merge_sensitivity_into_existing
from .error_explainer import generate_explanations, refresh_explanations
from .duplicate_detector import detect_duplicate_students
from .models import (
    BoundaryValueNote,
    CorrectionRecord,
    ErrorExplanation,
    QuestionnaireRawRow,
    ReviewStatus,
    SensitivityResult,
    WorkflowState,
)


class WorkflowSession:
    def __init__(self, session_id: str | None = None):
        self.state = WorkflowState(session_id=session_id or str(uuid.uuid4())[:8])

    @staticmethod
    def _display_value(value, field: str) -> str:
        if isinstance(value, ReviewStatus):
            return value.value
        return str(value)

    @staticmethod
    def _serialize_value(value, field: str) -> str:
        return WorkflowSession._display_value(value, field)

    def step1_import_questionnaire(
        self,
        rows: list[QuestionnaireRawRow],
        operator: str = "系统",
    ) -> list[SensitivityResult]:
        if self.state.step1_imported:
            raise ValueError("问卷原始行已导入，不能重复导入。如需重跑请使用 rerun()")

        self.state.questionnaire_rows = rows
        self.state.step1_imported = True
        self.state.current_step = 2

        self.state.results = run_sensitivity(rows, self.state.boundary_notes)
        self.state.explanations = generate_explanations(self.state.results)

        result_ids = [r.result_id for r in self.state.results]
        self.state.audit_trail.append(
            record_import(operator, len(rows), result_ids)
        )

        return self.state.results

    def step2_review_boundary(
        self,
        notes: list[BoundaryValueNote],
        operator: str = "教研负责人吴老师",
    ) -> list[SensitivityResult]:
        if not self.state.step1_imported:
            raise ValueError("请先完成步骤1：导入问卷原始行")

        self.state.boundary_notes = notes
        self.state.step2_boundary_reviewed = True

        fresh = run_sensitivity(self.state.questionnaire_rows, notes)
        if self.state.results:
            self.state.results = merge_sensitivity_into_existing(
                fresh, self.state.results
            )
        else:
            self.state.results = fresh

        self.state.explanations = refresh_explanations(
            self.state.results, self.state.explanations
        )

        result_ids = [r.result_id for r in self.state.results]
        self.state.audit_trail.append(
            record_boundary_review(operator, len(notes), result_ids)
        )

        return self.state.results

    def step3_update_error_explanations(
        self,
        operator: str = "系统",
    ) -> list[ErrorExplanation]:
        if not self.state.step2_boundary_reviewed:
            raise ValueError("请先完成步骤2：补看边界值说明")

        self.state.explanations = refresh_explanations(
            self.state.results, self.state.explanations
        )
        self.state.step3_error_updated = True
        self.state.current_step = 3

        result_ids = [r.result_id for r in self.state.results]
        self.state.audit_trail.append(
            record_error_update(
                operator, len(self.state.explanations), result_ids
            )
        )

        return self.state.explanations

    def manual_correct(
        self,
        result_id: str,
        field: str,
        new_value_str: str,
        reason: str,
        operator: str = "教研负责人吴老师",
    ) -> SensitivityResult:
        target_idx = None
        for i, r in enumerate(self.state.results):
            if r.result_id == result_id:
                target_idx = i
                break
        if target_idx is None:
            raise ValueError(f"找不到结果ID={result_id}")

        result = self.state.results[target_idx]

        if not hasattr(result, field):
            raise ValueError(f"结果没有字段{field}")

        old_value = getattr(result, field)

        if isinstance(old_value, bool):
            new_value = new_value_str.lower() in ("true", "1", "yes")
        elif isinstance(old_value, int):
            new_value = int(new_value_str)
        elif isinstance(old_value, float):
            new_value = float(new_value_str)
        elif isinstance(old_value, ReviewStatus):
            new_value = ReviewStatus(new_value_str)
        else:
            new_value = new_value_str

        old_display = self._display_value(old_value, field)
        new_display = self._display_value(new_value, field)

        updated_corrected_fields = dict(result.corrected_fields)
        updated_corrected_fields[field] = self._serialize_value(new_value, field)

        new_history_entry = CorrectionRecord(
            field=field,
            original_value=old_display,
            corrected_value=new_display,
            reason=reason,
            operator=operator,
        )
        updated_history = list(result.corrections_history) + [new_history_entry]

        updated = result.model_copy(update={
            field: new_value,
            "corrected_fields": updated_corrected_fields,
            "corrections_history": updated_history,
        })
        self.state.results[target_idx] = updated

        cascaded = []
        if field in ("posterior_mean", "posterior_std", "sensitivity_range"):
            self.state.explanations = refresh_explanations(
                self.state.results, self.state.explanations
            )
            cascaded = [r.result_id for r in self.state.results if r.result_id != result_id]

        self.state.audit_trail.append(
            record_manual_correction(
                operator, result_id, field,
                old_display, new_display, reason, cascaded,
            )
        )

        return updated

    def rerun(
        self,
        reason: str = "人工修正后重跑",
        operator: str = "教研负责人吴老师",
    ) -> list[SensitivityResult]:
        fresh = run_sensitivity(
            self.state.questionnaire_rows, self.state.boundary_notes
        )
        if self.state.results:
            self.state.results = merge_sensitivity_into_existing(
                fresh, self.state.results
            )
        else:
            self.state.results = fresh

        self.state.explanations = refresh_explanations(
            self.state.results, self.state.explanations
        )

        result_ids = [r.result_id for r in self.state.results]
        self.state.audit_trail.append(
            record_rerun(operator, len(self.state.results), reason, result_ids)
        )

        return self.state.results

    def get_duplicate_summary(self) -> list[dict]:
        return detect_duplicate_students(self.state.questionnaire_rows)

    def get_audit_text(self) -> str:
        return format_audit_trail(self.state.audit_trail)

    def save(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(
            self.state.model_dump_json(indent=2),
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path: str | Path) -> "WorkflowSession":
        p = Path(path)
        data = json.loads(p.read_text(encoding="utf-8"))
        state = WorkflowState.model_validate(data)
        session = cls(session_id=state.session_id)
        session.state = state
        return session

    def summary(self) -> str:
        lines: list[str] = []
        lines.append(f"═══ 贝叶斯先验敏感性试算 · 会话 {self.state.session_id} ═══")
        lines.append("")
        lines.append(f"步骤进度：")
        s1 = "✓" if self.state.step1_imported else "○"
        s2 = "✓" if self.state.step2_boundary_reviewed else "○"
        s3 = "✓" if self.state.step3_error_updated else "○"
        lines.append(f"  {s1} 步骤1：导入问卷原始行（{len(self.state.questionnaire_rows)}条）")
        lines.append(f"  {s2} 步骤2：补看边界值说明（{len(self.state.boundary_notes)}条）")
        lines.append(f"  {s3} 步骤3：更新误差说明（{len(self.state.explanations)}条）")
        lines.append("")

        dup_count = sum(1 for r in self.state.results if r.is_duplicate)
        if dup_count > 0:
            lines.append(f"⚠ 两版答案待复核：{dup_count}条")
            for r in self.state.results:
                if r.is_duplicate:
                    vs = "、".join(f"第{v}版" for v in r.duplicate_versions)
                    lines.append(f"    学生{r.student_id} 题目{r.question_id}（{vs}）")
            lines.append("")

        lines.append("试算结果：")
        for r in self.state.results:
            dup_tag = " ⚠两版待复核" if r.is_duplicate else ""
            corr_tag = " ✔人工复核" if r.corrections_history else ""
            tags = f"{dup_tag}{corr_tag}"
            lines.append(
                f"  [{r.result_id}] 学生{r.student_id} 题目{r.question_id}"
                f" → 后验均值{r.posterior_mean:.2f}"
                f" 敏感性{r.sensitivity_range:.2f}"
                f" 状态={r.status.value}{tags}"
            )
            if r.corrections_history:
                lines.append(f"      修正历史：")
                for c in r.corrections_history:
                    ts = c.corrected_at.strftime("%m-%d %H:%M")
                    lines.append(
                        f"      · [{ts} {c.operator}] {c.field}"
                        f"「{c.original_value}→{c.corrected_value}」"
                        f"（原因：{c.reason}）"
                    )
        lines.append("")

        lines.append("误差说明：")
        for e in self.state.explanations:
            lines.append(f"  [{e.explanation_id}] 学生{e.student_id}")
            lines.append(f"    为什么留下：{e.why_kept}")
            if e.missing_materials:
                lines.append(f"    还缺材料：{'；'.join(e.missing_materials)}")
            lines.append(f"    下一步：{e.next_action.value} — {e.next_action_detail}")
            lines.append("")

        if self.state.audit_trail:
            lines.append("审计记录：")
            lines.append(self.get_audit_text())

        return "\n".join(lines)
