import math
import warnings
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
import copy

from models import (
    SampleRecord, SampleStatus, ImportSource, ConflictType,
    ConflictEvidence, HistoryRecord, SelfCheckResult, AntiExample
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
                is_boundary_case=is_boundary
            )
            
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
                "equation_param": equation_param,
                "threshold": threshold,
                "is_boundary": is_boundary
            })
        
        return imported_records

    def import_parameter_table(self, parameter_data: List[Dict[str, Any]], operator: str) -> List[SampleRecord]:
        updated_records = []
        current_time = datetime.now()
        
        for data in parameter_data:
            sample_id = data.get("sample_id", "")
            equation_param = data.get("equation_param")
            threshold = data.get("threshold")
            notes = data.get("notes", "")
            
            self._validate_sample_data(sample_id, equation_param, threshold)
            
            if sample_id not in self._samples:
                raise MissingDataError(sample_id, "equation_param")
            
            existing = self._samples[sample_id]
            
            conflicts = self._detect_conflicts(existing, equation_param, threshold)
            if conflicts:
                for conflict in conflicts:
                    self._conflicts.append(conflict)
                    self._add_anti_example(
                        sample_id,
                        conflict.description,
                        f"抽样名单与参数调试表{conflict.conflict_type.value}"
                    )
                raise ConflictDetectedError(
                    sample_id,
                    conflicts[0].conflict_type,
                    conflicts[0].sample_list_value,
                    conflicts[0].parameter_table_value,
                    conflicts[0].description
                )
            
            is_boundary, status = self._check_boundary_value(sample_id, equation_param, threshold)
            root_value = self.calculate_root(equation_param, threshold)
            
            existing.equation_param = float(equation_param)
            existing.threshold = float(threshold)
            existing.root_value = root_value
            existing.source = ImportSource.PARAMETER_TABLE
            existing.import_time = current_time
            existing.is_boundary_case = is_boundary
            existing.notes = notes
            
            if is_boundary and existing.status != SampleStatus.PENDING_REVIEW:
                existing.status = SampleStatus.PENDING_REVIEW
                self._pending_review.append(sample_id)
            elif not is_boundary and existing.status == SampleStatus.PENDING_REVIEW:
                pass
            
            updated_records.append(existing)
            
            self._add_history("导入参数调试表", operator, {
                "sample_id": sample_id,
                "equation_param": equation_param,
                "threshold": threshold,
                "notes": notes
            })
        
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

    def resolve_conflict(self, sample_id: str, confirm: bool, operator: str) -> ConflictEvidence:
        if operator != "吴老师":
            raise PermissionError("只有教研负责人吴老师才能处理冲突。")
        
        conflict = None
        for c in self._conflicts:
            if c.sample_id == sample_id and not c.resolved:
                conflict = c
                break
        
        if not conflict:
            raise ValueError(f"样本【{sample_id}】没有未解决的冲突。")
        
        sample = self._samples.get(sample_id)
        if not sample:
            raise ValueError(f"样本【{sample_id}】不存在。")
        
        if confirm:
            conflict.resolved = True
            conflict.resolution = "吴老师确认，以参数调试表为准"
            sample.status = SampleStatus.CONFIRMED
            sample.reviewer = "吴老师"
            sample.review_time = datetime.now()
            
            epsilon = 1e-9
            if abs(sample.equation_param - sample.threshold) < epsilon:
                if sample_id in self._pending_review:
                    self._pending_review.remove(sample_id)
        else:
            conflict.resolved = True
            conflict.resolution = "吴老师驳回，以抽样名单为准"
            sample.status = SampleStatus.REJECTED
            sample.reviewer = "吴老师"
            sample.review_time = datetime.now()
        
        self._add_history("处理冲突", operator, {
            "sample_id": sample_id,
            "confirm": confirm,
            "resolution": conflict.resolution
        })
        
        return conflict

    def teacher_review_boundary(self, sample_id: str, is_normal: bool, operator: str) -> SampleRecord:
        sample = self._samples.get(sample_id)
        if not sample:
            raise ValueError(f"样本【{sample_id}】不存在。")
        
        if sample.status != SampleStatus.PENDING_REVIEW:
            raise StatusTransitionError(sample_id, sample.status, SampleStatus.NORMAL)
        
        if is_normal:
            sample.status = SampleStatus.NORMAL
            sample.notes = (sample.notes or "") + f" 任课老师[{operator}]复核确认正常。"
        else:
            sample.status = SampleStatus.ABNORMAL
            sample.notes = (sample.notes or "") + f" 任课老师[{operator}]复核确认为异常。"
        
        sample.reviewer = operator
        sample.review_time = datetime.now()
        
        if sample_id in self._pending_review:
            self._pending_review.remove(sample_id)
        
        self._add_history("任课老师复核边界值", operator, {
            "sample_id": sample_id,
            "is_normal": is_normal
        })
        
        return sample

    def supplement_sample(self, sample_id: str, new_data: Dict[str, Any], operator: str) -> SampleRecord:
        sample = self._samples.get(sample_id)
        if not sample:
            raise ValueError(f"样本【{sample_id}】不存在。")
        
        equation_param = new_data.get("equation_param", sample.equation_param)
        threshold = new_data.get("threshold", sample.threshold)
        notes = new_data.get("notes", "")
        
        self._validate_sample_data(sample_id, equation_param, threshold)
        
        sample.equation_param = float(equation_param)
        sample.threshold = float(threshold)
        sample.root_value = self.calculate_root(float(equation_param), float(threshold))
        sample.notes = (sample.notes or "") + f" [补录]{notes}"
        
        is_boundary, new_status = self._check_boundary_value(sample_id, float(equation_param), float(threshold))
        sample.is_boundary_case = is_boundary
        
        if is_boundary:
            sample.status = SampleStatus.PENDING_REVIEW
            if sample_id not in self._pending_review:
                self._pending_review.append(sample_id)
        
        self._supplemented_samples.add(sample_id)
        
        self._add_history("补录样本数据", operator, {
            "sample_id": sample_id,
            "new_equation_param": equation_param,
            "new_threshold": threshold,
            "notes": notes
        })
        
        return sample

    def recalculate_after_supplement(self, operator: str) -> List[SampleRecord]:
        recalculated = []
        
        for sample_id in self._supplemented_samples:
            sample = self._samples.get(sample_id)
            if sample:
                old_root = sample.root_value
                new_root = self.calculate_root(sample.equation_param, sample.threshold)
                sample.root_value = new_root
                
                recalculated.append(sample)
                
                self._add_history("补录后重算", operator, {
                    "sample_id": sample_id,
                    "old_root": old_root,
                    "new_root": new_root
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
            detected_time=datetime.now()
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

    def get_anti_examples(self) -> List[AntiExample]:
        return list(self._anti_examples)

    def get_pending_review(self) -> List[str]:
        return list(self._pending_review)

    def export_data(self) -> List[Dict[str, Any]]:
        return [sample.to_dict() for sample in self._samples.values()]

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
            if record.operation in ["导入抽样名单", "导入参数调试表"]:
                sample_id = record.details.get("sample_id")
                source = record.operation
                
                if sample_id not in seen_ids_by_source:
                    seen_ids_by_source[sample_id] = set()
                
                if source in seen_ids_by_source[sample_id]:
                    duplicates.append(f"{sample_id}(从{source}重复导入)")
                else:
                    seen_ids_by_source[sample_id].add(source)
        
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
        
        for sample in self._samples.values():
            if abs(sample.equation_param - sample.threshold) < epsilon:
                if sample.status != SampleStatus.PENDING_REVIEW and sample.status != SampleStatus.CONFIRMED:
                    boundary_samples.append({
                        "sample_id": sample.sample_id,
                        "status": sample.status.value,
                        "expected": "待任课老师复核 或 吴老师确认"
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
                    "calculated_root": calculated_root
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
            if abs(original.equation_param - float(exported["equation_param"])) > epsilon:
                issues.append({
                    "sample_id": sample_id,
                    "field": "equation_param",
                    "original": original.equation_param,
                    "exported": exported["equation_param"]
                })
            
            if abs(original.threshold - float(exported["threshold"])) > epsilon:
                issues.append({
                    "sample_id": sample_id,
                    "field": "threshold",
                    "original": original.threshold,
                    "exported": exported["threshold"]
                })
            
            if original.root_value is not None and exported["root_value"] is not None:
                if abs(original.root_value - float(exported["root_value"])) > epsilon:
                    issues.append({
                        "sample_id": sample_id,
                        "field": "root_value",
                        "original": original.root_value,
                        "exported": exported["root_value"]
                    })
        
        if issues:
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=False,
                message=f"发现{len(issues)}个导出数据不一致的问题。",
                details={"export_issues": issues}
            )
        
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=True,
            message="导出数据与原始数据完全一致。",
            details={}
        )
