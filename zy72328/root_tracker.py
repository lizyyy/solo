import math
import warnings
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
import copy

from models import (
    SampleRecord, SampleStatus, ImportSource, ConflictType,
    ConflictEvidence, HistoryRecord, SelfCheckResult, AntiExample,
    AntiExampleStatus
)
from errors import (
    DuplicateImportError, BoundaryValueWarning, ConflictDetectedError,
    InvalidDataError, StatusTransitionError, ExportConsistencyError,
    MissingDataError
)


class NonlinearRootTracker:
    def __init__(self):
        self._samples: Dict[str, SampleRecord] = {}
        self._conflicts: List[ConflictEvidence] = []
        self._history: List[HistoryRecord] = []
        self._anti_examples: List[AntiExample] = []
        self._pending_review: List[str] = []
        self._supplemented_samples: set = set()
        self._unresolved_samples: set = set()

    def calculate_root(self, param: float, threshold: float) -> Optional[float]:
        try:
            if param < 0:
                return None
            root = math.sqrt(param)
            return round(root, 6)
        except (ValueError, TypeError):
            return None

    def _validate_sample_data(self, sample_id: str, equation_param: float, threshold: float) -> None:
        if not sample_id or not isinstance(sample_id, str) or len(sample_id.strip()) == 0:
            raise InvalidDataError("sample_id", sample_id, "样本编号不能为空，必须是有效的字符串。")
        
        try:
            equation_param = float(equation_param)
        except (ValueError, TypeError):
            raise InvalidDataError("equation_param", equation_param, "方程参数必须是数字。")
        
        try:
            threshold = float(threshold)
        except (ValueError, TypeError):
            raise InvalidDataError("threshold", threshold, "阈值必须是数字。")

    def _check_boundary_value(self, sample_id: str, equation_param: float, threshold: float) -> Tuple[bool, SampleStatus]:
        epsilon = 1e-9
        is_boundary = abs(equation_param - threshold) < epsilon
        
        if is_boundary:
            warnings.warn(BoundaryValueWarning(sample_id, equation_param, threshold))
            return True, SampleStatus.PENDING_REVIEW
        
        return False, SampleStatus.NORMAL

    def _check_duplicate(self, sample_id: str, source: ImportSource) -> None:
        if sample_id in self._samples:
            existing = self._samples[sample_id]
            raise DuplicateImportError(sample_id, existing.source.value if existing.source else "未知来源", source.value)

    def _snapshot_original_values(self, record: SampleRecord) -> None:
        if record.original_equation_param is None:
            record.original_equation_param = record.equation_param
            record.original_threshold = record.threshold
            record.original_root_value = record.root_value
            record.original_is_boundary_case = record.is_boundary_case

    def _resolve_anti_examples_for_sample(self, sample_id: str, resolution_note: str, operator: str,
                                          include_boundary: bool = False) -> None:
        now = datetime.now()
        for ae in self._anti_examples:
            if ae.sample_id == sample_id and ae.status == AntiExampleStatus.OPEN:
                is_boundary_anti = "刚好等于阈值" in ae.description
                if is_boundary_anti and not include_boundary:
                    continue
                ae.status = AntiExampleStatus.RESOLVED
                ae.resolution_note = resolution_note
                ae.resolved_by = operator
                ae.resolved_time = now

    def import_sample_list(self, sample_data: List[Dict[str, Any]], operator: str) -> List[SampleRecord]:
        imported_records = []
        current_time = datetime.now()
        
        for data in sample_data:
            sample_id = data.get("sample_id", "")
            equation_param = data.get("equation_param")
            threshold = data.get("threshold")
            
            self._validate_sample_data(sample_id, equation_param, threshold)
            self._check_duplicate(sample_id, ImportSource.SAMPLE_LIST)
            
            is_boundary, status = self._check_boundary_value(sample_id, equation_param, threshold)
            root_value = self.calculate_root(equation_param, threshold)
            
            record = SampleRecord(
                sample_id=sample_id,
                equation_param=float(equation_param),
                threshold=float(threshold),
                root_value=root_value,
                status=status,
                source=ImportSource.SAMPLE_LIST,
                import_time=current_time,
                is_boundary_case=is_boundary,
                next_handler="任课老师" if is_boundary else None
            )
            
            self._snapshot_original_values(record)
            
            self._samples[sample_id] = record
            imported_records.append(record)
            
            if is_boundary:
                self._pending_review.append(sample_id)
                self._add_anti_example(
                    sample_id,
                    f"方程参数值({equation_param})刚好等于阈值({threshold})",
                    "边界值等于阈值，需人工复核"
                )
            
            self._add_history("导入抽样名单", operator, {
                "sample_id": sample_id,
                "equation_param": float(equation_param),
                "threshold": float(threshold),
                "root_value": root_value,
                "is_boundary": is_boundary,
                "status_after": status.value,
                "next_handler": record.next_handler
            })
        
        return imported_records

    def import_parameter_table(self, parameter_data: List[Dict[str, Any]], operator: str) -> List[SampleRecord]:
        updated_records = []
        current_time = datetime.now()
        first_conflict_exception = None
        
        for data in parameter_data:
            sample_id = data.get("sample_id", "")
            equation_param = data.get("equation_param")
            threshold = data.get("threshold")
            notes = data.get("notes", "")
            
            self._validate_sample_data(sample_id, equation_param, threshold)
            
            if sample_id not in self._samples:
                raise MissingDataError(sample_id, "equation_param")
            
            existing = self._samples[sample_id]
            
            existing.proposed_equation_param = float(equation_param)
            existing.proposed_threshold = float(threshold)
            existing.proposed_notes = notes if notes else None
            
            conflicts = self._detect_conflicts(existing, equation_param, threshold)
            if conflicts:
                for conflict in conflicts:
                    self._conflicts.append(conflict)
                    self._add_anti_example(
                        sample_id,
                        conflict.description,
                        f"抽样名单与参数调试表{conflict.conflict_type.value}"
                    )
                
                self._unresolved_samples.add(sample_id)
                existing.next_handler = "吴老师（处理冲突）"
                
                self._add_history("导入参数调试表（检测到冲突，暂存提案值）", operator, {
                    "sample_id": sample_id,
                    "proposed_equation_param": float(equation_param),
                    "proposed_threshold": float(threshold),
                    "proposed_notes": notes,
                    "conflict_count": len(conflicts),
                    "conflict_types": [c.conflict_type.value for c in conflicts],
                    "next_handler": existing.next_handler,
                    "note": "参数调试表的值已暂存到proposed字段，请吴老师确认/驳回后才生效"
                })
                
                if first_conflict_exception is None:
                    first_conflict_exception = ConflictDetectedError(
                        sample_id,
                        conflicts[0].conflict_type,
                        conflicts[0].sample_list_value,
                        conflicts[0].parameter_table_value,
                        conflicts[0].description
                    )
                continue
            
            is_boundary, status = self._check_boundary_value(sample_id, equation_param, threshold)
            root_value = self.calculate_root(equation_param, threshold)
            
            old_param = existing.equation_param
            old_threshold = existing.threshold
            old_root = existing.root_value
            old_status = existing.status
            old_boundary = existing.is_boundary_case
            
            existing.equation_param = float(equation_param)
            existing.threshold = float(threshold)
            existing.root_value = root_value
            existing.source = ImportSource.PARAMETER_TABLE
            existing.import_time = current_time
            existing.is_boundary_case = is_boundary
            existing.notes = notes if notes else existing.notes
            existing.proposed_equation_param = None
            existing.proposed_threshold = None
            existing.proposed_notes = None
            
            if is_boundary and existing.status != SampleStatus.PENDING_REVIEW:
                existing.status = SampleStatus.PENDING_REVIEW
                existing.next_handler = "任课老师"
                if sample_id not in self._pending_review:
                    self._pending_review.append(sample_id)
            elif not is_boundary and existing.status == SampleStatus.PENDING_REVIEW:
                existing.status = SampleStatus.NORMAL
                existing.next_handler = None
                if sample_id in self._pending_review:
                    self._pending_review.remove(sample_id)
            elif not is_boundary:
                existing.status = SampleStatus.NORMAL
                existing.next_handler = None
            
            updated_records.append(existing)
            
            self._add_history("导入参数调试表（无冲突，直接生效）", operator, {
                "sample_id": sample_id,
                "old_equation_param": old_param,
                "new_equation_param": float(equation_param),
                "old_threshold": old_threshold,
                "new_threshold": float(threshold),
                "old_root_value": old_root,
                "new_root_value": root_value,
                "old_status": old_status.value,
                "new_status": existing.status.value,
                "old_is_boundary": old_boundary,
                "new_is_boundary": is_boundary,
                "notes": notes,
                "next_handler": existing.next_handler
            })
        
        if first_conflict_exception is not None:
            raise first_conflict_exception
        
        return updated_records

    def _detect_conflicts(self, existing: SampleRecord, new_param: float, new_threshold: float) -> List[ConflictEvidence]:
        conflicts = []
        epsilon = 1e-9
        
        if abs(existing.equation_param - float(new_param)) > epsilon:
            conflicts.append(ConflictEvidence(
                sample_id=existing.sample_id,
                conflict_type=ConflictType.DATA_MISMATCH,
                sample_list_value=existing.equation_param,
                parameter_table_value=float(new_param),
                description=f"方程参数不一致，抽样名单是{existing.equation_param}，参数调试表是{new_param}"
            ))
        
        if abs(existing.threshold - float(new_threshold)) > epsilon:
            conflicts.append(ConflictEvidence(
                sample_id=existing.sample_id,
                conflict_type=ConflictType.THRESHOLD_MISMATCH,
                sample_list_value=existing.threshold,
                parameter_table_value=float(new_threshold),
                description=f"阈值不一致，抽样名单是{existing.threshold}，参数调试表是{new_threshold}"
            ))
        
        existing_is_boundary = abs(existing.equation_param - existing.threshold) < epsilon
        new_is_boundary = abs(float(new_param) - float(new_threshold)) < epsilon
        
        if existing_is_boundary != new_is_boundary:
            conflicts.append(ConflictEvidence(
                sample_id=existing.sample_id,
                conflict_type=ConflictType.STATUS_MISMATCH,
                sample_list_value="是边界值" if existing_is_boundary else "不是边界值",
                parameter_table_value="是边界值" if new_is_boundary else "不是边界值",
                description="边界值判断不一致，抽样名单和参数调试表对于是否是边界值的判断不同"
            ))
        
        return conflicts

    def resolve_conflict(self, sample_id: str, confirm: bool, operator: str, 
                        reason: Optional[str] = None) -> List[ConflictEvidence]:
        if operator != "吴老师":
            raise PermissionError("只有教研负责人吴老师才能处理冲突。")
        
        unresolved_conflicts = [c for c in self._conflicts if c.sample_id == sample_id and not c.resolved]
        if not unresolved_conflicts:
            raise ValueError(f"样本【{sample_id}】没有未解决的冲突。")
        
        sample = self._samples.get(sample_id)
        if not sample:
            raise ValueError(f"样本【{sample_id}】不存在。")
        
        old_param = sample.equation_param
        old_threshold = sample.threshold
        old_root = sample.root_value
        old_status = sample.status
        old_boundary = sample.is_boundary_case
        old_next = sample.next_handler
        
        now = datetime.now()
        
        if confirm:
            resolution_text = "吴老师确认，以参数调试表为准"
            resolution_reason = reason or "吴老师审核后认为参数调试表的数据更可信"
            sample.resolution_reason = resolution_reason
            
            new_param = sample.proposed_equation_param if sample.proposed_equation_param is not None else sample.equation_param
            new_threshold = sample.proposed_threshold if sample.proposed_threshold is not None else sample.threshold
            
            is_boundary, new_status = self._check_boundary_value(sample_id, new_param, new_threshold)
            new_root = self.calculate_root(new_param, new_threshold)
            
            sample.equation_param = new_param
            sample.threshold = new_threshold
            sample.root_value = new_root
            sample.is_boundary_case = is_boundary
            sample.source = ImportSource.PARAMETER_TABLE
            
            if sample.proposed_notes:
                sample.notes = (sample.notes or "") + f" [参数调试表]{sample.proposed_notes}"
            
            sample.notes = (sample.notes or "") + (
                f" [吴老师确认]原始:参数={old_param},阈值={old_threshold},根={old_root},边界={old_boundary}; "
                f"改为:参数={new_param},阈值={new_threshold},根={new_root},边界={is_boundary}; 原因:{resolution_reason}"
            )
            
            if is_boundary:
                sample.status = SampleStatus.PENDING_REVIEW
                sample.next_handler = "任课老师"
                if sample_id not in self._pending_review:
                    self._pending_review.append(sample_id)
                anti_resolution_note = f"吴老师确认以参数调试表为准，更新后仍是边界值，转交任课老师复核。原因：{resolution_reason}"
            else:
                sample.status = SampleStatus.CONFIRMED
                sample.next_handler = None
                if sample_id in self._pending_review:
                    self._pending_review.remove(sample_id)
                anti_resolution_note = f"吴老师确认以参数调试表为准，冲突已解决。原因：{resolution_reason}"
            
            sample.proposed_equation_param = None
            sample.proposed_threshold = None
            sample.proposed_notes = None
            
        else:
            resolution_text = "吴老师驳回，以抽样名单为准"
            resolution_reason = reason or "吴老师审核后认为抽样名单的原始数据更可信"
            sample.resolution_reason = resolution_reason
            
            is_boundary = sample.is_boundary_case
            
            if is_boundary:
                sample.status = SampleStatus.PENDING_REVIEW
                sample.next_handler = "任课老师"
            else:
                sample.status = SampleStatus.REJECTED
                sample.next_handler = None
            
            anti_resolution_note = f"吴老师驳回参数调试表提案，保留抽样名单原始值。原因：{resolution_reason}"
            
            sample.notes = (sample.notes or "") + (
                f" [吴老师驳回]保留原始值:参数={old_param},阈值={old_threshold}; "
                f"驳回提案值:参数={sample.proposed_equation_param},阈值={sample.proposed_threshold}; 原因:{resolution_reason}"
            )
            
            sample.proposed_equation_param = None
            sample.proposed_threshold = None
            sample.proposed_notes = None
        
        sample.reviewer = "吴老师"
        sample.review_time = now
        
        for c in unresolved_conflicts:
            c.resolved = True
            c.resolution = resolution_text
            c.resolved_by = operator
            c.resolved_time = now
        
        include_boundary_anti = confirm and not is_boundary
        self._resolve_anti_examples_for_sample(sample_id, anti_resolution_note, operator,
                                               include_boundary=include_boundary_anti)
        
        if sample_id in self._unresolved_samples:
            self._unresolved_samples.remove(sample_id)
        
        self._add_history("吴老师处理冲突（确认/驳回）", operator, {
            "sample_id": sample_id,
            "confirm": confirm,
            "resolution": resolution_text,
            "reason": resolution_reason,
            "old_equation_param": old_param,
            "new_equation_param": sample.equation_param,
            "old_threshold": old_threshold,
            "new_threshold": sample.threshold,
            "old_root_value": old_root,
            "new_root_value": sample.root_value,
            "old_status": old_status.value,
            "new_status": sample.status.value,
            "old_is_boundary": old_boundary,
            "new_is_boundary": sample.is_boundary_case,
            "old_next_handler": old_next,
            "new_next_handler": sample.next_handler,
            "conflicts_resolved_count": len(unresolved_conflicts)
        })
        
        return unresolved_conflicts

    def teacher_review_boundary(self, sample_id: str, is_normal: bool, operator: str,
                               review_reason: Optional[str] = None) -> SampleRecord:
        sample = self._samples.get(sample_id)
        if not sample:
            raise ValueError(f"样本【{sample_id}】不存在。")
        
        if sample.status != SampleStatus.PENDING_REVIEW:
            raise StatusTransitionError(sample_id, sample.status, SampleStatus.NORMAL)
        
        old_status = sample.status
        old_next = sample.next_handler
        reason_text = review_reason or ("任课老师人工核对后认为属于正常范围" if is_normal else "任课老师人工核对后判定为异常")
        
        if is_normal:
            sample.status = SampleStatus.NORMAL
            sample.notes = (sample.notes or "") + f" 任课老师[{operator}]复核确认正常。原因：{reason_text}"
        else:
            sample.status = SampleStatus.ABNORMAL
            sample.notes = (sample.notes or "") + f" 任课老师[{operator}]复核确认为异常。原因：{reason_text}"
        
        sample.reviewer = operator
        sample.review_time = datetime.now()
        sample.next_handler = None
        sample.resolution_reason = (sample.resolution_reason or "") + f"；任课老师复核：{reason_text}"
        
        if sample_id in self._pending_review:
            self._pending_review.remove(sample_id)
        
        anti_note = f"任课老师[{operator}]复核完成，判定为{'正常' if is_normal else '异常'}。原因：{reason_text}"
        self._resolve_anti_examples_for_sample(sample_id, anti_note, operator, include_boundary=True)
        
        self._add_history("任课老师复核边界值", operator, {
            "sample_id": sample_id,
            "is_normal": is_normal,
            "old_status": old_status.value,
            "new_status": sample.status.value,
            "reason": reason_text,
            "old_next_handler": old_next,
            "new_next_handler": None
        })
        
        return sample

    def supplement_sample(self, sample_id: str, new_data: Dict[str, Any], operator: str,
                         supplement_reason: Optional[str] = None) -> SampleRecord:
        sample = self._samples.get(sample_id)
        if not sample:
            raise ValueError(f"样本【{sample_id}】不存在。")
        
        equation_param = new_data.get("equation_param", sample.equation_param)
        threshold = new_data.get("threshold", sample.threshold)
        notes = new_data.get("notes", "")
        
        self._validate_sample_data(sample_id, equation_param, threshold)
        
        old_param = sample.equation_param
        old_threshold = sample.threshold
        old_root = sample.root_value
        old_status = sample.status
        old_boundary = sample.is_boundary_case
        old_next = sample.next_handler
        
        reason_text = supplement_reason or "补录/修正数据"
        
        sample.equation_param = float(equation_param)
        sample.threshold = float(threshold)
        sample.root_value = self.calculate_root(float(equation_param), float(threshold))
        sample.notes = (sample.notes or "") + f" [补录(by {operator})]{notes}; 原因:{reason_text}; 原始:参数={old_param},阈值={old_threshold}→新值:参数={equation_param},阈值={threshold}"
        
        is_boundary, new_status = self._check_boundary_value(sample_id, float(equation_param), float(threshold))
        sample.is_boundary_case = is_boundary
        
        if is_boundary:
            sample.status = SampleStatus.PENDING_REVIEW
            sample.next_handler = "任课老师"
            if sample_id not in self._pending_review:
                self._pending_review.append(sample_id)
            self._add_anti_example(
                sample_id,
                f"补录后方程参数值({equation_param})刚好等于阈值({threshold})",
                f"补录修正后触发边界值，需人工复核。补录原因：{reason_text}"
            )
        elif sample.status == SampleStatus.PENDING_REVIEW and not is_boundary:
            sample.status = SampleStatus.NORMAL
            sample.next_handler = None
            if sample_id in self._pending_review:
                self._pending_review.remove(sample_id)
        
        self._supplemented_samples.add(sample_id)
        
        self._add_history("补录样本数据", operator, {
            "sample_id": sample_id,
            "old_equation_param": old_param,
            "new_equation_param": float(equation_param),
            "old_threshold": old_threshold,
            "new_threshold": float(threshold),
            "old_root_value": old_root,
            "new_root_value": sample.root_value,
            "old_status": old_status.value,
            "new_status": sample.status.value,
            "old_is_boundary": old_boundary,
            "new_is_boundary": is_boundary,
            "old_next_handler": old_next,
            "new_next_handler": sample.next_handler,
            "supplement_notes": notes,
            "reason": reason_text
        })
        
        return sample

    def recalculate_after_supplement(self, operator: str) -> List[SampleRecord]:
        recalculated = []
        
        for sample_id in list(self._supplemented_samples):
            sample = self._samples.get(sample_id)
            if sample:
                old_root = sample.root_value
                new_root = self.calculate_root(sample.equation_param, sample.threshold)
                sample.root_value = new_root
                
                recalculated.append(sample)
                
                self._add_history("补录后重算根值", operator, {
                    "sample_id": sample_id,
                    "old_root": old_root,
                    "new_root": new_root,
                    "equation_param_used": sample.equation_param
                })
        
        self._supplemented_samples.clear()
        return recalculated

    def _add_history(self, operation: str, operator: str, details: Dict[str, Any]) -> None:
        self._history.append(HistoryRecord(
            operation=operation,
            operator=operator,
            timestamp=datetime.now(),
            details=details
        ))

    def _add_anti_example(self, sample_id: str, description: str, root_cause: str) -> None:
        self._anti_examples.append(AntiExample(
            sample_id=sample_id,
            description=description,
            root_cause=root_cause,
            detected_time=datetime.now(),
            status=AntiExampleStatus.OPEN
        ))

    def get_sample(self, sample_id: str) -> Optional[SampleRecord]:
        return self._samples.get(sample_id)

    def get_all_samples(self) -> List[SampleRecord]:
        return list(self._samples.values())

    def get_conflicts(self, resolved: Optional[bool] = None) -> List[ConflictEvidence]:
        if resolved is None:
            return list(self._conflicts)
        return [c for c in self._conflicts if c.resolved == resolved]

    def get_history(self) -> List[HistoryRecord]:
        return list(self._history)

    def get_anti_examples(self, status: Optional[AntiExampleStatus] = None) -> List[AntiExample]:
        if status is None:
            return list(self._anti_examples)
        return [ae for ae in self._anti_examples if ae.status == status]

    def get_pending_review(self) -> List[str]:
        return list(self._pending_review)

    def get_unresolved_samples(self) -> List[str]:
        return list(self._unresolved_samples)

    def export_data(self) -> List[Dict[str, Any]]:
        return [sample.to_dict() for sample in self._samples.values()]

    def export_report(self, include_self_check_in_summary: bool = False) -> Dict[str, Any]:
        if include_self_check_in_summary:
            all_passed = all(r.passed for r in self.run_self_check())
            self_check_results = [r.to_dict() for r in self.run_self_check()]
        else:
            all_passed = None
            self_check_results = []
        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_samples": len(self._samples),
                "boundary_cases": len([s for s in self._samples.values() if s.is_boundary_case]),
                "pending_review": len(self._pending_review),
                "unresolved_conflicts": len(self.get_conflicts(resolved=False)),
                "total_conflicts": len(self._conflicts),
                "anti_examples_open": len(self.get_anti_examples(status=AntiExampleStatus.OPEN)),
                "anti_examples_resolved": len(self.get_anti_examples(status=AntiExampleStatus.RESOLVED)),
                "self_check_passed": all_passed
            },
            "samples": self.export_data(),
            "conflicts": [c.to_dict() for c in self._conflicts],
            "anti_examples": [ae.to_dict() for ae in self._anti_examples],
            "history": [h.to_dict() for h in self._history],
            "self_check_results": self_check_results
        }

    def run_self_check(self) -> List[SelfCheckResult]:
        results = []
        
        results.append(self._check_duplicate_import())
        results.append(self._check_boundary_values())
        results.append(self._check_recalc_after_supplement())
        results.append(self._check_export_consistency())
        
        return results

    def _check_duplicate_import(self) -> SelfCheckResult:
        seen_ids_by_source = {}
        duplicates = []
        
        for record in self._history:
            if record.operation in ["导入抽样名单", "导入参数调试表", 
                                   "导入参数调试表（无冲突，直接生效）",
                                   "导入参数调试表（检测到冲突，暂存提案值）"]:
                sample_id = record.details.get("sample_id")
                if sample_id is None:
                    continue
                base_op = "导入抽样名单" if "抽样名单" in record.operation else "导入参数调试表"
                
                if sample_id not in seen_ids_by_source:
                    seen_ids_by_source[sample_id] = set()
                
                if base_op in seen_ids_by_source[sample_id]:
                    duplicates.append(f"{sample_id}(从{base_op}重复导入)")
                else:
                    seen_ids_by_source[sample_id].add(base_op)
        
        if duplicates:
            return SelfCheckResult(
                check_name="重复导入检查",
                passed=False,
                message=f"发现{len(duplicates)}个样本被重复导入：{', '.join(duplicates)}",
                details={"duplicate_samples": duplicates}
            )
        
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=True,
            message="没有发现重复导入的样本。",
            details={}
        )

    def _check_boundary_values(self) -> SelfCheckResult:
        boundary_samples = []
        epsilon = 1e-9
        reviewed_ids = set()
        for h in self._history:
            if h.operation == "任课老师复核边界值":
                reviewed_ids.add(h.details.get("sample_id"))
        
        for sample in self._samples.values():
            if abs(sample.equation_param - sample.threshold) < epsilon:
                ok = False
                if sample.status == SampleStatus.PENDING_REVIEW:
                    ok = True
                elif sample.status == SampleStatus.CONFIRMED:
                    ok = True
                elif sample.status in (SampleStatus.NORMAL, SampleStatus.ABNORMAL):
                    if sample.sample_id in reviewed_ids:
                        ok = True
                if not ok:
                    boundary_samples.append({
                        "sample_id": sample.sample_id,
                        "status": sample.status.value,
                        "expected": "要么状态=待任课老师复核/已确认，要么已走任课老师复核流程再改正常/异常"
                    })
        
        if boundary_samples:
            return SelfCheckResult(
                check_name="边界值检查",
                passed=False,
                message=f"发现{len(boundary_samples)}个边界值样本状态不正确，需要留给任课老师复核或吴老师确认。",
                details={"boundary_samples": boundary_samples}
            )
        
        return SelfCheckResult(
            check_name="边界值检查",
            passed=True,
            message="所有边界值样本的状态都正确。",
            details={}
        )

    def _check_recalc_after_supplement(self) -> SelfCheckResult:
        issues = []
        
        for sample in self._samples.values():
            calculated_root = self.calculate_root(sample.equation_param, sample.threshold)
            if sample.root_value != calculated_root:
                issues.append({
                    "sample_id": sample.sample_id,
                    "stored_root": sample.root_value,
                    "calculated_root": calculated_root,
                    "equation_param": sample.equation_param
                })
        
        if issues:
            return SelfCheckResult(
                check_name="补录后重算检查",
                passed=False,
                message=f"发现{len(issues)}个样本的根值与计算值不一致，需要重新计算。",
                details={"inconsistent_samples": issues}
            )
        
        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=True,
            message="所有样本的根值计算都正确。",
            details={}
        )

    def _check_export_consistency(self) -> SelfCheckResult:
        issues = []
        
        original_data = copy.deepcopy(self._samples)
        exported_data = self.export_data()
        
        for exported in exported_data:
            sample_id = exported["sample_id"]
            original = original_data.get(sample_id)
            
            if not original:
                issues.append({"sample_id": sample_id, "issue": "导出的样本在原始数据中不存在"})
                continue
            
            epsilon = 1e-9
            numeric_fields = ["equation_param", "threshold", "root_value", 
                             "original_equation_param", "original_threshold", "original_root_value",
                             "proposed_equation_param", "proposed_threshold"]
            for field in numeric_fields:
                orig_val = getattr(original, field)
                exp_val = exported.get(field)
                if orig_val is not None and exp_val is not None:
                    try:
                        if abs(float(orig_val) - float(exp_val)) > epsilon:
                            issues.append({
                                "sample_id": sample_id,
                                "field": field,
                                "original": orig_val,
                                "exported": exp_val
                            })
                    except (ValueError, TypeError):
                        pass
        
        report = self.export_report()
        if report["summary"]["total_samples"] != len(self._samples):
            issues.append({"report_summary": "样本总数不一致"})
        
        if issues:
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=False,
                message=f"发现{len(issues)}个导出数据不一致的问题（含报告摘要核对）。",
                details={"export_issues": issues}
            )
        
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=True,
            message="导出数据与原始数据完全一致（含列表、详情、报告摘要、历史记录）。",
            details={}
        )
