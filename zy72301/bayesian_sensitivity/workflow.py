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
from .engine import run_sensitivity
from .error_explainer import generate_explanations, refresh_explanations
from .duplicate_detector import detect_duplicate_students
from .models import (
    BoundaryValueNote,
    ErrorExplanation,
    QuestionnaireRawRow,
    ReviewStatus,
    SensitivityResult,
    WorkflowState,
)


class WorkflowSession:
    def __init__(self, session_id: str | None = None):
        self.state = WorkflowState(session_id=session_id or str(uuid.uuid4())[:8])

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

        self.state.results = run_sensitivity(
            self.state.questionnaire_rows, notes
        )

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

        old_display = old_value.value if isinstance(old_value, ReviewStatus) else str(old_value)
        new_display = new_value.value if isinstance(new_value, ReviewStatus) else str(new_value)

        updated = result.model_copy(update={field: new_value})
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
        self.state.results = run_sensitivity(
            self.state.questionnaire_rows, self.state.boundary_notes
        )
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
            dup_tag = " ⚠两版" if r.is_duplicate else ""
            lines.append(
                f"  [{r.result_id}] 学生{r.student_id} 题目{r.question_id}"
                f" → 后验均值{r.posterior_mean:.2f}"
                f" 敏感性{r.sensitivity_range:.2f}"
                f" 状态={r.status.value}{dup_tag}"
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
