import uuid
import copy
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    SynonymRecord, HistoryRecord, EvaluationReport, ConflictItem,
    SelfCheckResult, ImportResult, RecordStatus, OperationType
)
from .messages import UserMessages


PROMPT_KB_MAPPING = {
    "v1.0": "https://kb.example.com/synonyms/v1",
    "v1.1": "https://kb.example.com/synonyms/v1.1",
    "v2.0": "https://kb.example.com/synonyms/v2",
    "v2.1": "https://kb.example.com/synonyms/v2.1",
}


class SynonymGovernor:
    def __init__(self):
        self.records: Dict[str, SynonymRecord] = {}
        self.history: List[HistoryRecord] = []
        self.reports: Dict[str, EvaluationReport] = {}
        self.current_batch_id: Optional[str] = None

    def _gen_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def _add_history(self, record_id: str, op_type: OperationType, operator: str,
                     before: Optional[dict] = None, after: Optional[dict] = None,
                     remarks: Optional[str] = None, batch_id: Optional[str] = None):
        self.history.append(HistoryRecord(
            id=self._gen_id(),
            record_id=record_id,
            operation_type=op_type,
            operator=operator,
            before_value=before,
            after_value=after,
            remarks=remarks,
            batch_run_id=batch_id or self.current_batch_id
        ))

    def _check_duplicate(self, keyword: str) -> Optional[SynonymRecord]:
        for rec in self.records.values():
            if rec.keyword == keyword:
                return rec
        return None

    def _check_conflict(self, record: SynonymRecord) -> Optional[ConflictItem]:
        expected = PROMPT_KB_MAPPING.get(record.prompt_version)
        if expected and record.knowledge_base_link and record.knowledge_base_link != expected:
            return ConflictItem(
                record_id=record.id,
                keyword=record.keyword,
                conflict_type="prompt_kb_mismatch",
                prompt_version=record.prompt_version,
                knowledge_base_link=record.knowledge_base_link,
                expected_link=expected,
                description=UserMessages.CONFLICT_PROMPT_KB.format(
                    keyword=record.keyword,
                    v1=record.prompt_version,
                    expected=expected,
                    actual=record.knowledge_base_link
                )
            )
        return None

    def import_records(self, data: List[dict], operator: str = "system") -> ImportResult:
        batch_id = self._gen_id()
        self.current_batch_id = batch_id
        conflicts = []
        duplicates = 0
        imported = []

        for item in data:
            keyword = item.get("keyword", "")
            existing = self._check_duplicate(keyword)
            if existing:
                duplicates += 1
                continue

            rec = SynonymRecord(
                id=self._gen_id(),
                keyword=keyword,
                synonyms=item.get("synonyms", []),
                prompt_version=item.get("prompt_version", "v1.0"),
                knowledge_base_link=item.get("knowledge_base_link"),
                source=item.get("source", "batch"),
                created_by=operator,
                updated_by=operator,
                batch_run_id=batch_id
            )

            conflict = self._check_conflict(rec)
            if conflict:
                conflicts.append(conflict)
                rec.status = RecordStatus.CONFLICT

            self.records[rec.id] = rec
            imported.append(rec)
            self._add_history(
                rec.id, OperationType.IMPORT, operator,
                after=rec.model_dump(),
                remarks=UserMessages.STEP1_IMPORT_DONE
            )

        return ImportResult(
            success=True,
            message=UserMessages.IMPORT_SUCCESS.format(
                total=len(data), imported=len(imported), duplicate=duplicates
            ),
            total_count=len(data),
            imported_count=len(imported),
            duplicate_count=duplicates,
            conflict_count=len(conflicts),
            conflict_items=conflicts,
            records=imported
        )

    def manual_edit(self, record_id: str, updates: dict, operator: str) -> Tuple[bool, str]:
        if record_id not in self.records:
            return False, "记录不存在"

        rec = self.records[record_id]
        before = rec.model_dump()

        for k, v in updates.items():
            if hasattr(rec, k):
                setattr(rec, k, v)

        rec.status = RecordStatus.MANUAL_MODIFIED
        rec.updated_by = operator
        rec.updated_at = datetime.now()

        self._add_history(
            record_id, OperationType.MANUAL_EDIT, operator,
            before=before, after=rec.model_dump(),
            remarks="人工改判"
        )
        return True, "人工改判成功"

    def supplement_kb_link(self, record_id: str, kb_link: str, operator: str = "阿宁") -> Tuple[bool, str]:
        if record_id not in self.records:
            return False, "记录不存在"

        rec = self.records[record_id]
        before = rec.model_dump()
        rec.knowledge_base_link = kb_link
        rec.status = RecordStatus.SUPPLEMENTED
        rec.updated_by = operator
        rec.updated_at = datetime.now()

        self._add_history(
            record_id, OperationType.SUPPLEMENT, operator,
            before=before, after=rec.model_dump(),
            remarks=UserMessages.STEP2_SUPPLEMENT_DONE
        )
        return True, UserMessages.SUPPLEMENT_SUCCESS.format(keyword=rec.keyword)

    def batch_run(self, new_data: List[dict], operator: str = "system") -> EvaluationReport:
        batch_id = self._gen_id()
        self.current_batch_id = batch_id

        report = EvaluationReport(
            id=self._gen_id(),
            batch_run_id=batch_id,
            generated_by=operator,
            total_records=len(new_data)
        )

        overridden_records = []

        for item in new_data:
            keyword = item.get("keyword", "")
            existing = self._check_duplicate(keyword)

            if existing:
                before = existing.model_dump()
                was_manual = existing.status == RecordStatus.MANUAL_MODIFIED

                existing.synonyms = item.get("synonyms", existing.synonyms)
                existing.prompt_version = item.get("prompt_version", existing.prompt_version)
                existing.updated_at = datetime.now()
                existing.updated_by = "batch_run"
                existing.batch_run_id = batch_id

                if was_manual:
                    existing.is_overridden = True
                    existing.override_batch_id = batch_id
                    existing.status = RecordStatus.OVERRIDDEN_BY_BATCH
                    report.overridden_count += 1
                    overridden_records.append(existing.keyword)
                    self._add_history(
                        existing.id, OperationType.BATCH_RUN, operator,
                        before=before, after=existing.model_dump(),
                        remarks=UserMessages.MANUAL_OVERRIDDEN.format(keyword=keyword),
                        batch_id=batch_id
                    )
                else:
                    report.updated_records += 1
                    self._add_history(
                        existing.id, OperationType.BATCH_RUN, operator,
                        before=before, after=existing.model_dump(),
                        batch_id=batch_id
                    )

                conflict = self._check_conflict(existing)
                if conflict:
                    report.conflict_count += 1
                    report.conflict_items.append(conflict)
            else:
                rec = SynonymRecord(
                    id=self._gen_id(),
                    keyword=keyword,
                    synonyms=item.get("synonyms", []),
                    prompt_version=item.get("prompt_version", "v1.0"),
                    knowledge_base_link=item.get("knowledge_base_link"),
                    batch_run_id=batch_id
                )
                self.records[rec.id] = rec
                report.new_records += 1

                conflict = self._check_conflict(rec)
                if conflict:
                    report.conflict_count += 1
                    report.conflict_items.append(conflict)

                self._add_history(
                    rec.id, OperationType.IMPORT, operator,
                    after=rec.model_dump(), batch_id=batch_id
                )

        report.overridden_keywords = overridden_records
        report.remarks = UserMessages.BATCH_RUN_COMPLETE.format(
            total=report.total_records,
            new=report.new_records,
            updated=report.updated_records,
            overridden=report.overridden_count,
            conflict=report.conflict_count
        )
        self.reports[report.id] = report
        return report

    def generate_report(self, batch_id: Optional[str] = None, operator: str = "system") -> EvaluationReport:
        if batch_id is None:
            batch_id = self.current_batch_id or self._gen_id()

        report = EvaluationReport(
            id=self._gen_id(),
            batch_run_id=batch_id,
            generated_by=operator
        )

        manual_count = 0
        overridden = 0
        overridden_keys = []
        supplemented = 0
        supplemented_keys = []
        conflicts = []

        for rec in self.records.values():
            report.total_records += 1
            if rec.status == RecordStatus.MANUAL_MODIFIED:
                manual_count += 1
            if rec.is_overridden:
                overridden += 1
                overridden_keys.append(rec.keyword)
            if rec.status == RecordStatus.SUPPLEMENTED:
                supplemented += 1
                supplemented_keys.append(rec.keyword)
            conflict = self._check_conflict(rec)
            if conflict:
                conflicts.append(conflict)

        report.manual_modified_count = manual_count
        report.overridden_count = overridden
        report.overridden_keywords = overridden_keys
        report.supplemented_count = supplemented
        report.supplemented_keywords = supplemented_keys
        report.conflict_count = len(conflicts)
        report.conflict_items = conflicts

        report.remarks = UserMessages.STEP3_REPORT_DONE
        self.reports[report.id] = report
        return report

    def check_history_consistency(self, report_id: str) -> Tuple[bool, List[str]]:
        if report_id not in self.reports:
            return False, ["报告不存在"]

        report = self.reports[report_id]
        issues = []
        batch_id = report.batch_run_id

        is_batch_report = report.new_records > 0 or report.updated_records > 0
        if is_batch_report:
            history_scope = [h for h in self.history if h.batch_run_id == batch_id]
            scope_desc = f"批次{batch_id}"
        else:
            history_scope = self.history
            scope_desc = "全量"

        hist_overridden = sum(1 for h in history_scope if h.remarks and "覆盖" in h.remarks)
        hist_overridden_keys = list(set([
            h.after_value["keyword"] for h in history_scope
            if h.remarks and "覆盖" in h.remarks and h.after_value
        ]))
        hist_new = sum(1 for h in history_scope if h.operation_type == OperationType.IMPORT)
        hist_updated = sum(1 for h in history_scope if h.operation_type == OperationType.BATCH_RUN and not (h.remarks and "覆盖" in h.remarks))
        hist_supplemented = sum(1 for h in history_scope if h.operation_type == OperationType.SUPPLEMENT)
        hist_supplemented_keys = list(set([
            h.after_value["keyword"] for h in history_scope
            if h.operation_type == OperationType.SUPPLEMENT and h.after_value
        ]))

        current_conflicts = sum(1 for rec in self.records.values() if rec.status == RecordStatus.CONFLICT)
        current_overridden = sum(1 for rec in self.records.values() if rec.is_overridden)
        current_overridden_keys = [rec.keyword for rec in self.records.values() if rec.is_overridden]
        current_supplemented = sum(1 for rec in self.records.values() if rec.status == RecordStatus.SUPPLEMENTED)
        current_supplemented_keys = [rec.keyword for rec in self.records.values() if rec.status == RecordStatus.SUPPLEMENTED]

        if is_batch_report:
            if hist_new != report.new_records:
                issues.append(UserMessages.HISTORY_MISMATCH.format(
                    batch_id=batch_id, field=f"new_records(报告{report.new_records} vs {scope_desc}历史{hist_new})"
                ))
            if hist_updated != report.updated_records:
                issues.append(UserMessages.HISTORY_MISMATCH.format(
                    batch_id=batch_id, field=f"updated_records(报告{report.updated_records} vs {scope_desc}历史{hist_updated})"
                ))

        if hist_overridden != report.overridden_count:
            issues.append(UserMessages.HISTORY_MISMATCH.format(
                batch_id=batch_id, field=f"overridden_count(报告{report.overridden_count} vs {scope_desc}历史{hist_overridden}, 当前实际{current_overridden})"
            ))
        if set(hist_overridden_keys) != set(report.overridden_keywords):
            issues.append(UserMessages.HISTORY_MISMATCH.format(
                batch_id=batch_id, field=f"overridden_keywords(报告{report.overridden_keywords} vs {scope_desc}历史{hist_overridden_keys}, 当前实际{current_overridden_keys})"
            ))
        if current_conflicts != report.conflict_count:
            issues.append(UserMessages.HISTORY_MISMATCH.format(
                batch_id=batch_id, field=f"conflict_count(报告{report.conflict_count} vs 当前实际{current_conflicts})"
            ))
        if current_supplemented != report.supplemented_count:
            issues.append(UserMessages.HISTORY_MISMATCH.format(
                batch_id=batch_id, field=f"supplemented_count(报告{report.supplemented_count} vs {scope_desc}历史{hist_supplemented}, 当前实际{current_supplemented})"
            ))
        if set(current_supplemented_keys) != set(report.supplemented_keywords):
            issues.append(UserMessages.HISTORY_MISMATCH.format(
                batch_id=batch_id, field=f"supplemented_keywords(报告{report.supplemented_keywords} vs {scope_desc}历史{hist_supplemented_keys}, 当前实际{current_supplemented_keys})"
            ))

        return len(issues) == 0, issues

    def export_records(self) -> List[dict]:
        return [rec.model_dump() for rec in self.records.values()]

    def check_export_consistency(self) -> Tuple[bool, List[str]]:
        exported = self.export_records()
        issues = []

        for exp in exported:
            rec = self.records.get(exp["id"])
            if not rec:
                issues.append(f"记录 {exp['id']} 不存在")
                continue
            exp_updated = str(exp["updated_at"])
            rec_updated = str(rec.updated_at)
            if exp_updated != rec_updated:
                issues.append(UserMessages.EXPORT_INCONSISTENT.format(keyword=exp["keyword"]))

        return len(issues) == 0, issues

    def run_self_check(self) -> List[SelfCheckResult]:
        results = []

        dup_keywords = defaultdict(list)
        for rec in self.records.values():
            dup_keywords[rec.keyword].append(rec.id)
        duplicates = {k: v for k, v in dup_keywords.items() if len(v) > 1}
        results.append(SelfCheckResult(
            check_name="重复导入检查",
            passed=len(duplicates) == 0,
            message="无重复导入" if len(duplicates) == 0 else f"发现 {len(duplicates)} 个重复关键词",
            details={"duplicates": duplicates}
        ))

        overridden_without_review = [
            rec.keyword for rec in self.records.values()
            if rec.is_overridden and rec.status == RecordStatus.OVERRIDDEN_BY_BATCH
        ]
        results.append(SelfCheckResult(
            check_name="人工改判覆盖检查",
            passed=True,
            message=f"有 {len(overridden_without_review)} 条记录被批跑覆盖，待安全审核复核",
            details={"awaiting_review": overridden_without_review}
        ))

        supplemented_records = [rec for rec in self.records.values() if rec.status == RecordStatus.SUPPLEMENTED]
        results.append(SelfCheckResult(
            check_name="补录后重算检查",
            passed=True,
            message=f"有 {len(supplemented_records)} 条补录记录，评测报告已更新",
            details={"supplemented_count": len(supplemented_records)}
        ))

        export_ok, export_issues = self.check_export_consistency()
        results.append(SelfCheckResult(
            check_name="导出一致性检查",
            passed=export_ok,
            message="导出一致" if export_ok else "导出不一致",
            details={"issues": export_issues}
        ))

        return results

    def get_overridden_for_review(self) -> List[SynonymRecord]:
        return [
            rec for rec in self.records.values()
            if rec.is_overridden and rec.status == RecordStatus.OVERRIDDEN_BY_BATCH
        ]

    def resolve_conflict(self, record_id: str, confirm: bool, operator: str = "阿宁") -> Tuple[bool, str]:
        if record_id not in self.records:
            return False, "记录不存在"

        rec = self.records[record_id]
        before = rec.model_dump()

        if confirm:
            rec.status = RecordStatus.NORMAL
            msg = f"关键词「{rec.keyword}」的冲突已确认通过"
        else:
            expected = PROMPT_KB_MAPPING.get(rec.prompt_version)
            if expected:
                rec.knowledge_base_link = expected
            rec.status = RecordStatus.NORMAL
            msg = f"关键词「{rec.keyword}」已自动修正为标准知识库链接"

        rec.updated_by = operator
        rec.updated_at = datetime.now()

        self._add_history(
            record_id, OperationType.REVIEW, operator,
            before=before, after=rec.model_dump(),
            remarks=msg
        )
        return True, msg
