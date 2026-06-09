import json
import os
from typing import List, Any
from dataclasses import asdict
from datetime import datetime
import pandas as pd

from config import Config
from core import (
    StudentAnswer, WeightTable, ErrorLog,
    RevisionHistory, ReviewDetail, BoundaryNote,
    DuplicateDetector, WeightUpdater, BoundaryChecker, asdict_safe
)


class DataStore:
    def __init__(self):
        Config.ensure_data_dir()
        self._answers: List[StudentAnswer] = []
        self._weights: List[WeightTable] = []
        self._error_logs: List[ErrorLog] = []
        self._load_all()

    def _load_json(self, filepath: str, default: Any = None) -> Any:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return default or []
        except json.JSONDecodeError:
            return default or []

    def _save_json(self, filepath: str, data: Any) -> None:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_all(self) -> None:
        answers_data = self._load_json(Config.ANSWERS_FILE)
        self._answers = [StudentAnswer(**d) for d in answers_data]

        weights_data = self._load_json(Config.WEIGHTS_FILE)
        self._weights = [WeightTable(**d) for d in weights_data]

        error_data = self._load_json(Config.ERROR_LOGS_FILE)
        self._error_logs = [ErrorLog(**d) for d in error_data]

    def _save_all(self) -> None:
        self._save_json(
            Config.ANSWERS_FILE,
            [asdict_safe(ans) for ans in self._answers]
        )
        self._save_json(
            Config.WEIGHTS_FILE,
            [asdict_safe(w) for w in self._weights]
        )
        self._save_json(
            Config.ERROR_LOGS_FILE,
            [asdict_safe(e) for e in self._error_logs]
        )

    def import_answers_from_excel(
        self, excel_path: str, batch_id: str
    ) -> List[StudentAnswer]:
        df = pd.read_excel(excel_path)
        new_answers = []
        for _, row in df.iterrows():
            answer = StudentAnswer(
                answer_id=str(row.get("answer_id", "")),
                student_id=str(row.get("student_id", "")),
                student_name=str(row.get("student_name", "")),
                question_id=str(row.get("question_id", "")),
                answer_content=str(row.get("answer_content", "")),
                score=float(row.get("score", 0)),
                submitted_at=str(row.get("submitted_at", "")),
                import_batch=batch_id,
                notes=str(row.get("notes", "")),
            )
            boundary_notes = BoundaryChecker.check_boundaries(answer)
            for bn in boundary_notes:
                answer.add_boundary_note(bn)
            if boundary_notes:
                answer.status = "BOUNDARY_ALERT"
                answer.notes = (
                    f"{answer.notes} 【边界值说明】"
                    + "；".join(bn.description for bn in boundary_notes)
                )
            new_answers.append(answer)
        self._answers.extend(new_answers)
        self._save_all()
        return new_answers

    def import_weights_from_excel(self, excel_path: str) -> List[WeightTable]:
        df = pd.read_excel(excel_path)
        new_weights = []
        for _, row in df.iterrows():
            weight = WeightTable(
                weight_id=str(row.get("weight_id", "")),
                question_id=str(row.get("question_id", "")),
                dimension=str(row.get("dimension", "")),
                weight=float(row.get("weight", 1.0)),
                standard_version=str(row.get("standard_version", "")),
                effective_date=str(row.get("effective_date", "")),
                remarks=str(row.get("remarks", "")),
            )
            new_weights.append(weight)
        self._weights.extend(new_weights)
        self._save_all()
        return new_weights

    def get_all_answers(self) -> List[StudentAnswer]:
        return self._answers

    def get_answer_by_id(self, answer_id: str) -> StudentAnswer:
        return next((a for a in self._answers if a.id == answer_id), None)

    def get_answers_by_student_question(self, student_id: str, question_id: str) -> List[StudentAnswer]:
        return [a for a in self._answers if a.student_id == student_id and a.question_id == question_id]

    def get_all_weights(self) -> List[WeightTable]:
        return self._weights

    def get_all_error_logs(self) -> List[ErrorLog]:
        return self._error_logs

    def get_error_logs_by_answer(self, answer_id: str) -> List[ErrorLog]:
        return [e for e in self._error_logs if e.answer_id == answer_id]

    def add_error_logs(self, error_logs: List[ErrorLog]) -> None:
        self._error_logs.extend(error_logs)
        self._save_all()

    def update_answer(self, answer_id: str, **kwargs) -> bool:
        answer = self.get_answer_by_id(answer_id)
        if answer:
            for key, value in kwargs.items():
                if hasattr(answer, key):
                    setattr(answer, key, value)
            self._save_all()
            return True
        return False

    def manual_correct_answer(
        self,
        answer_id: str,
        operator: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        next_step: str = "",
        next_contact: str = "",
        review_detail_update: dict = None,
    ) -> bool:
        answer = self.get_answer_by_id(answer_id)
        if not answer:
            return False
        revision = RevisionHistory(
            revision_id="",
            field_name=field_name,
            old_value=str(old_value),
            new_value=str(new_value),
            operator=operator,
            reason=reason,
            next_step=next_step,
            next_contact=next_contact,
        )
        answer.add_revision(revision)
        if field_name == "score":
            answer.original_score = answer.original_score
            answer.score = float(new_value)
            answer.adjusted_score = float(new_value)
        elif field_name == "status":
            answer.status = str(new_value)
        elif hasattr(answer, field_name):
            setattr(answer, field_name, new_value)
        answer.status = "MANUAL_CORRECTED"
        current_notes = answer.notes or ""
        answer.notes = (
            f"{current_notes} 【人工修正记录】{operator} "
            f"修改{field_name}：{old_value} → {new_value}，原因：{reason}"
        ).strip()
        if review_detail_update:
            detail = answer.review_detail or {}
            detail.update(review_detail_update)
            answer.review_detail = detail
        self._save_all()
        return True

    def review_duplicate(
        self,
        answer_id: str,
        reviewer: str,
        keep: bool = True,
        reviewed_score: float = None,
        review_opinion: str = "",
        correction_reason: str = "",
        next_step: str = "",
        next_contact: str = "",
        corrected_value: str = "",
    ) -> dict:
        answer = self.get_answer_by_id(answer_id)
        result = {"success": False, "message": ""}
        if not answer:
            result["message"] = "未找到记录"
            return result
        if answer.status != "DUPLICATE_PENDING":
            result["message"] = "当前记录状态不是待复核"
            return result
        old_status = answer.status
        action = "保留" if keep else "标记不保留"
        new_detail = ReviewDetail()
        if answer.review_detail:
            for k, v in answer.review_detail.items():
                if hasattr(new_detail, k):
                    setattr(new_detail, k, v)
        new_detail.corrected_value = corrected_value or (
            f"确认{action}第{answer.version}版，得分{answer.score}"
        )
        new_detail.handling_reason = (
            correction_reason or
            f"业务运营{reviewer}人工复核，判断：{review_opinion or action}"
        )
        new_detail.next_step = next_step or (
            "复核完成，如无异议进入后续归档" if keep
            else "需与学生确认或退回修改"
        )
        new_detail.next_contact = next_contact or reviewer
        new_detail.reviewed_score = reviewed_score or answer.score
        new_detail.review_opinion = review_opinion or f"复核结论：{action}此版"
        detail_old_value = f"原始说法已保留，复核前状态：DUPLICATE_PENDING，{action}标记为REVIEWED，得分{answer.score}"
        detail_new_value = (
            f"复核结论：{action}第{answer.version}版，"
            f"复核得分{new_detail.reviewed_score}，"
            f"复核意见：{new_detail.review_opinion}"
        )
        answer.set_review_detail(new_detail)
        revision = RevisionHistory(
            revision_id="",
            field_name="status/复核结论",
            old_value=detail_old_value,
            new_value=detail_new_value,
            operator=reviewer,
            reason=correction_reason or f"业务运营人工复核",
            next_step=new_detail.next_step,
            next_contact=new_detail.next_contact,
        )
        answer.add_revision(revision)
        if keep:
            answer.status = "REVIEWED"
            score_display = f"，复核得分{new_detail.reviewed_score}"
            answer.notes = (
                f"业务运营{reviewer}复核通过，确认保留此版答案"
                f"{score_display}。{review_opinion}"
            )
        else:
            answer.status = "REVIEWED"
            answer.notes = (
                f"业务运营{reviewer}复核标记：此版作为历史参考不保留。"
                f"{review_opinion}"
            )
        answer.reviewed_by = reviewer
        answer.reviewed_at = datetime.now().isoformat()
        error_log = None
        if reviewed_score is not None and abs(reviewed_score - answer.score) > 0.01:
            old_score = answer.score
            answer.score = reviewed_score
            answer.adjusted_score = reviewed_score
            time_str = datetime.now().strftime('%Y%m%d%H%M%S')[-6:]
            error_log = ErrorLog(
                log_id=time_str,
                answer_id=answer.id,
                error_type="MANUAL_ADJUST",
                description=(
                    f"人工复核调整说明：复核人{reviewer}，"
                    f"原始得分{old_score}，复核调整为{reviewed_score}，"
                    f"调整原因：{correction_reason or review_opinion}"
                ),
                weight_version="MANUAL",
                source="业务运营人工复核",
                original_score=old_score,
                adjusted_score=reviewed_score,
            )
            self._error_logs.append(error_log)
        self._save_all()
        result["success"] = True
        result["message"] = f"复核完成，{answer_id} 已{action}"
        if error_log:
            result["error_log_id"] = error_log.id
        return result

    def rerun_weight_application(
        self, operator: str = "运营规划阿岚", comment: str = ""
    ) -> dict:
        weights = self.get_all_weights()
        answers = self.get_all_answers()
        error_logs = WeightUpdater.apply_old_standard_update(
            answers, weights, rerun=True, operator=operator
        )
        self._error_logs.extend(error_logs)
        answer_ids_updated = set()
        for answer in answers:
            if answer.rerun_count > 0:
                answer.status = "RERUN_DONE"
                answer_ids_updated.add(answer.id)
        self._save_all()
        return {
            "rerun_records": len(answer_ids_updated),
            "new_error_logs": len(error_logs),
            "operator": operator,
            "comment": comment,
            "updated_ids": list(answer_ids_updated),
        }

    def get_duplicates_pending(self) -> List[StudentAnswer]:
        return [a for a in self._answers if a.status == "DUPLICATE_PENDING"]

    def get_old_standard_answers(self) -> List[StudentAnswer]:
        return [a for a in self._answers if a.status == "OLD_STANDARD" or a.status == "RERUN_DONE"]

    def get_boundary_alerts(self) -> List[StudentAnswer]:
        return [a for a in self._answers if a.boundary_notes and len(a.boundary_notes) > 0]

    def clear_all(self) -> None:
        self._answers = []
        self._weights = []
        self._error_logs = []
        self._save_all()

    def export_report(self, output_path: str = None) -> str:
        Config.ensure_data_dir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if output_path is None:
            output_path = os.path.join(
                Config.REPORTS_DIR, f"report_{timestamp}.xlsx")
        dir_path = os.path.dirname(output_path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        answers = self.get_all_answers()
        weights = self.get_all_weights()
        errors = self.get_all_error_logs()
        answers_rows = []
        for a in answers:
            err_logs = self.get_error_logs_by_answer(a.id)
            row = {
                "记录ID": a.id,
                "学生": f"{a.student_name}({a.student_id})",
                "题目": a.question_id,
                "原始得分": a.original_score,
                "当前得分": a.score,
                "调整后得分": a.adjusted_score if a.adjusted_score else "-",
                "提交时间": a.submitted_at,
                "版本": a.version,
                "状态": a.status,
                "状态说明": Config.STATUS_TYPES.get(a.status, a.status),
                "导入批次": a.import_batch,
                "备注": a.notes,
                "复核人": a.reviewed_by or "-",
                "复核时间": a.reviewed_at or "-",
                "重跑次数": a.rerun_count,
                "边界值告警数": len(a.boundary_notes) if a.boundary_notes else 0,
                "修改历史数": len(a.revision_history) if a.revision_history else 0,
                "关联误差记录数": len(err_logs),
            }
            if a.review_detail:
                row["复核详情-原始说法"] = a.review_detail.get("original_claim", "")
                row["复核详情-改后值"] = a.review_detail.get("corrected_value", "")
                row["复核详情-处理原因"] = a.review_detail.get("handling_reason", "")
                row["复核详情-下一步"] = a.review_detail.get("next_step", "")
                row["复核详情-找谁"] = a.review_detail.get("next_contact", "")
            answers_rows.append(row)
        weights_rows = []
        for w in weights:
            weights_rows.append({
                "权重ID": w.id,
                "关联题目": w.question_id,
                "维度": w.dimension,
                "权重系数": w.weight,
                "标准版本": w.standard_version,
                "生效日期": w.effective_date,
                "备注": w.remarks,
                "应用次数": w.applied_count,
                "最近应用": w.last_applied_at or "-",
            })
        errors_rows = []
        for e in errors:
            errors_rows.append({
                "误差ID": e.id,
                "关联答案": e.answer_id,
                "类型": e.error_type,
                "来源": e.source,
                "原始得分": e.original_score,
                "调整后得分": e.adjusted_score,
                "权重系数": e.weight_factor,
                "权重版本": e.weight_version,
                "详细说明": e.description,
                "创建时间": e.created_at,
                "是否已解决": e.resolved,
                "解决人": e.resolved_by or "-",
                "解决备注": e.resolution_notes,
            })
        revisions_rows = []
        for a in answers:
            for rev in (a.revision_history or []):
                revisions_rows.append({
                    "记录ID": a.id,
                    "学生": a.student_name,
                    "修改ID": rev.get("revision_id", ""),
                    "修改字段": rev.get("field_name", ""),
                    "原值": rev.get("old_value", ""),
                    "新值": rev.get("new_value", ""),
                    "操作人": rev.get("operator", ""),
                    "原因": rev.get("reason", ""),
                    "时间": rev.get("operated_at", ""),
                    "下一步": rev.get("next_step", ""),
                    "对接人": rev.get("next_contact", ""),
                })
        summary_rows = [{
            "生成时间": datetime.now().isoformat(),
            "答案总数": len(answers),
            "权重规则": len(weights),
            "误差说明": len(errors),
            "正常记录": len([a for a in answers if a.status == "NORMAL"]),
            "重复待复核": len([a for a in answers if a.status == "DUPLICATE_PENDING"]),
            "边界值告警": len(self.get_boundary_alerts()),
            "旧口径补录": len([a for a in answers if a.status == "OLD_STANDARD"]),
            "已复核": len([a for a in answers if a.status == "REVIEWED"]),
            "人工已修正": len([a for a in answers if a.status == "MANUAL_CORRECTED"]),
            "重跑完成": len([a for a in answers if a.status == "RERUN_DONE"]),
        }]
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            pd.DataFrame(summary_rows).T.to_excel(writer, sheet_name="摘要概览", header=False)
            pd.DataFrame(answers_rows).to_excel(writer, sheet_name="答案明细", index=False)
            pd.DataFrame(weights_rows).to_excel(writer, sheet_name="权重明细", index=False)
            pd.DataFrame(errors_rows).to_excel(writer, sheet_name="误差说明明细", index=False)
            if revisions_rows:
                pd.DataFrame(revisions_rows).to_excel(writer, sheet_name="修改历史明细", index=False)
        return output_path

    def run_full_demo_workflow(self) -> dict:
        return {
            "answers": [asdict_safe(a) for a in self._answers],
            "weights": [asdict_safe(w) for w in self._weights],
            "errors": [asdict_safe(e) for e in self._error_logs],
            "summary": {
                "total_answers": len(self._answers),
                "status_breakdown": self._status_breakdown(),
            },
        }

    def _status_breakdown(self):
        counts = {}
        for a in self._answers:
            counts[a.status] = counts.get(a.status, 0) + 1
        return counts
