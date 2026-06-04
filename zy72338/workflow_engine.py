from datetime import datetime
from typing import List, Dict, Optional, Callable
from models import (
    SamplingRecord,
    ParamDebugRecord,
    CalculationDetail,
    HistoryRecord,
    CheckResult,
    CheckStatus,
    WarningType,
    WarningItem,
    SelfCheckResult,
    GridBoundaryData,
    DataSource,
)
from validation_engine import ValidationEngine
from conflict_detector import ConflictDetector


class WorkflowStep:
    IMPORT_SAMPLING = "import_sampling"
    ANALYST_REVIEW = "analyst_review"
    UPDATE_CALCULATION = "update_calculation"


class WorkflowEngine:
    def __init__(self):
        self.validation_engine = ValidationEngine()
        self.conflict_detector = ConflictDetector(self.validation_engine)
        
        self.sampling_records: List[SamplingRecord] = []
        self.param_records: List[ParamDebugRecord] = []
        self.grid_data: List[GridBoundaryData] = []
        self.calculation_details: List[CalculationDetail] = []
        self.history_records: List[HistoryRecord] = []
        
        self.current_step: str = WorkflowStep.IMPORT_SAMPLING
        self.completed_steps: List[str] = []
        
        self.export_cache: Optional[List[CalculationDetail]] = None
        self._pending_manager_review: List[WarningItem] = []

    def _add_history(self, operation_type: str, operator: str, detail: str,
                    data_before: Optional[Dict] = None, data_after: Optional[Dict] = None):
        record = HistoryRecord(
            record_id=f"hist_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            operation_type=operation_type,
            operator=operator,
            operation_time=datetime.now(),
            detail=detail,
            data_before=data_before,
            data_after=data_after
        )
        self.history_records.append(record)

    def _format_warning(self, warning: WarningItem) -> str:
        messages = {
            WarningType.PERCENT_DECIMAL_MIX: (
                f"⚠️  网格[{warning.grid_id}]发现百分数和小数混着出现！\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.DUPLICATE_IMPORT: (
                f"⚠️  网格[{warning.grid_id}]重复导入！\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.DATA_MISMATCH: (
                f"⚠️  网格[{warning.grid_id}]数据与历史记录不一致！\n"
                f"    当前值：{warning.current_value}\n"
                f"    历史值：{warning.expected_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.PARAM_CONFLICT: (
                f"⚠️  网格[{warning.grid_id}]参数冲突！\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.EXPORT_MISMATCH: (
                f"⚠️  导出数据不一致！\n"
                f"    网格[{warning.grid_id}]: {warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.CALCULATION_ERROR: (
                f"❌ 网格[{warning.grid_id}]计算错误！\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.MISSING_DATA: (
                f"❌ 网格[{warning.grid_id}]数据缺失或格式错误！\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
        }
        return messages.get(warning.warning_type, f"⚠️  {warning.description}")

    def step1_import_sampling_list(
        self,
        sampling_records: List[SamplingRecord],
        operator: str = "活动负责人"
    ) -> CheckResult:
        self.sampling_records = sampling_records
        self._add_history(
            "导入抽样名单",
            operator,
            f"成功导入{len(sampling_records)}条抽样记录",
            data_after={"count": len(sampling_records)}
        )
        
        temp_grid_data = []
        for idx, record in enumerate(sampling_records):
            numeric, is_percent, _ = self.validation_engine.parse_value(
                record.boundary_threshold
            )
            temp_grid_data.append(GridBoundaryData(
                grid_id=record.grid_id,
                boundary_value=numeric if numeric is not None else record.boundary_threshold,
                raw_value=record.boundary_threshold,
                is_percent=is_percent,
                numeric_value=numeric,
                source=DataSource.SAMPLING_LIST,
                row_index=idx + 1
            ))
        
        warnings = self.validation_engine.validate_grid_data(
            temp_grid_data,
            DataSource.SAMPLING_LIST
        )
        
        self.grid_data = temp_grid_data
        self.current_step = WorkflowStep.ANALYST_REVIEW
        
        manager_review_items = [w for w in warnings if w.need_manager_review]
        self._pending_manager_review.extend(manager_review_items)
        
        self.validation_engine.record_import(temp_grid_data)
        
        status = CheckStatus.NEED_REVIEW if manager_review_items else CheckStatus.PENDING
        
        return CheckResult(
            status=status,
            warnings=warnings,
            history=self.history_records.copy(),
            message=self._build_step1_message(warnings)
        )

    def _build_step1_message(self, warnings: List[WarningItem]) -> str:
        if not warnings:
            return f"✅ 抽样名单导入成功，共{len(self.sampling_records)}条记录，未发现异常。\n请继续：数据分析师小祁补看参数调试表"
        
        msg = f"📋 抽样名单导入完成，共{len(self.sampling_records)}条记录。\n"
        msg += f"⚠️  发现{len(warnings)}个问题：\n\n"
        
        for i, warning in enumerate(warnings, 1):
            msg += f"{i}. {self._format_warning(warning)}\n\n"
        
        if self._pending_manager_review:
            msg += f"\n🔴 其中{len(self._pending_manager_review)}个问题需要活动负责人复核，暂不自动判定为正常。\n"
        
        msg += "\n请继续：数据分析师小祁补看参数调试表"
        return msg

    def step2_analyst_review_params(
        self,
        param_records: List[ParamDebugRecord],
        conflict_callback: Optional[Callable[[List], str]] = None
    ) -> CheckResult:
        if self.current_step != WorkflowStep.ANALYST_REVIEW:
            return CheckResult(
                status=CheckStatus.ABNORMAL,
                message="❌ 流程错误：请先完成抽样名单导入"
            )
        
        self.param_records = param_records
        self._add_history(
            "补看参数调试表",
            "小祁",
            f"数据分析师小祁导入{len(param_records)}条参数调试记录",
            data_after={"count": len(param_records)}
        )
        
        conflicts = self.conflict_detector.detect_conflicts(
            self.sampling_records,
            param_records
        )
        
        pending_conflicts = self.conflict_detector.get_pending_conflicts()
        
        if pending_conflicts:
            if conflict_callback:
                for conflict in pending_conflicts:
                    decision = conflict_callback([conflict])
                    if decision:
                        self.conflict_detector.resolve_conflict(
                            conflict.grid_id,
                            conflict.field_name,
                            decision,
                            "小祁"
                        )
                        self._add_history(
                            "冲突解决",
                            "小祁",
                            f"小祁{decision == 'confirm' and '确认' or '驳回'}了"
                            f"网格[{conflict.grid_id}]的{conflict.field_name}冲突",
                            data_before={
                                "sampling_value": conflict.sampling_value,
                                "param_value": conflict.param_value
                            },
                            data_after={"decision": decision}
                        )
            
            pending_conflicts = self.conflict_detector.get_pending_conflicts()
        
        self.current_step = WorkflowStep.UPDATE_CALCULATION
        
        return CheckResult(
            status=CheckStatus.CONFIRMED if not pending_conflicts else CheckStatus.NEED_REVIEW,
            conflicts=conflicts,
            history=self.history_records.copy(),
            message=self._build_step2_message(conflicts, pending_conflicts)
        )

    def _build_step2_message(
        self,
        conflicts: List,
        pending_conflicts: List
    ) -> str:
        if not conflicts:
            return f"✅ 参数调试表审核完成，未发现冲突。\n请继续：更新计算明细"
        
        msg = f"🔍 参数调试表审核完成，发现{len(conflicts)}个冲突点。\n\n"
        
        high_severity = [c for c in conflicts if c.severity == "high"]
        medium_severity = [c for c in conflicts if c.severity == "medium"]
        low_severity = [c for c in conflicts if c.severity == "low"]
        
        if high_severity:
            msg += f"🔴 高优先级冲突({len(high_severity)}个)：\n"
            for c in high_severity:
                msg += f"  • 网格[{c.grid_id}] - {c.field_name}\n"
                msg += f"    抽样值：{c.sampling_value}\n"
                msg += f"    参数值：{c.param_value}\n"
                msg += f"    说明：{c.description}\n\n"
        
        if medium_severity:
            msg += f"🟡 中优先级冲突({len(medium_severity)}个)：\n"
            for c in medium_severity:
                msg += f"  • 网格[{c.grid_id}] - {c.field_name}\n"
                msg += f"    抽样值：{c.sampling_value}\n"
                msg += f"    参数值：{c.param_value}\n"
                msg += f"    说明：{c.description}\n\n"
        
        if low_severity:
            msg += f"🟢 低优先级提示({len(low_severity)}个)：\n"
            for c in low_severity:
                msg += f"  • 网格[{c.grid_id}] - {c.field_name}\n"
                msg += f"    说明：{c.description}\n\n"
        
        if pending_conflicts:
            msg += f"⏳ 待处理冲突{len(pending_conflicts)}个，请数据分析师小祁选择确认或驳回。\n"
            msg += "  注意：系统不会自动替业务同事拍板。\n\n"
        
        msg += "请继续：更新计算明细"
        return msg

    def step3_update_calculation(
        self,
        use_conflict_resolution: bool = True,
        operator: str = "系统"
    ) -> CheckResult:
        if self.current_step != WorkflowStep.UPDATE_CALCULATION:
            return CheckResult(
                status=CheckStatus.ABNORMAL,
                message="❌ 流程错误：请先完成参数调试表审核"
            )
        
        if self.conflict_detector.has_unresolved_conflicts():
            return CheckResult(
                status=CheckStatus.NEED_REVIEW,
                message="❌ 存在未解决的冲突，请先由数据分析师确认或驳回后再更新计算明细"
            )
        
        self.grid_data = self.conflict_detector.convert_to_grid_data(
            self.sampling_records,
            self.param_records,
            use_conflict_resolution
        )
        
        warnings = self.validation_engine.validate_grid_data(
            self.grid_data,
            DataSource.PARAM_DEBUG_TABLE,
            check_duplicate=False
        )
        
        self._pending_manager_review.extend([
            w for w in warnings if w.need_manager_review
        ])
        
        new_calculations = self._perform_calculation(self.grid_data)
        
        old_calculations = self.calculation_details.copy()
        self.calculation_details = new_calculations
        
        self._add_history(
            "更新计算明细",
            operator,
            f"重新计算{len(new_calculations)}条网格边界数据",
            data_before={"count": len(old_calculations)},
            data_after={"count": len(new_calculations)}
        )
        
        self.completed_steps.append(self.current_step)
        self.current_step = WorkflowStep.IMPORT_SAMPLING
        
        status = CheckStatus.NEED_REVIEW if self._pending_manager_review else CheckStatus.NORMAL
        
        return CheckResult(
            status=status,
            calculation_details=new_calculations,
            warnings=warnings,
            history=self.history_records.copy(),
            message=self._build_step3_message(new_calculations, warnings)
        )

    def _perform_calculation(
        self,
        grid_data: List[GridBoundaryData]
    ) -> List[CalculationDetail]:
        calculations = []
        
        for data in grid_data:
            if data.numeric_value is None:
                continue
            
            actual_value = data.numeric_value / 100 if data.is_percent else data.numeric_value
            check_pass = 0 <= actual_value <= 1
            
            calculation = CalculationDetail(
                grid_id=data.grid_id,
                boundary_value=data.numeric_value,
                is_percent=data.is_percent,
                calculation_result=actual_value,
                check_pass=check_pass,
                calculation_time=datetime.now(),
                source=data.source.value,
                remark=""
            )
            calculations.append(calculation)
        
        return calculations

    def _build_step3_message(
        self,
        calculations: List[CalculationDetail],
        warnings: List[WarningItem]
    ) -> str:
        passed = sum(1 for c in calculations if c.check_pass)
        failed = len(calculations) - passed
        
        msg = f"✅ 计算明细更新完成，共{len(calculations)}条记录。\n"
        msg += f"   ✓ 检查通过：{passed}条\n"
        msg += f"   ✗ 检查未通过：{failed}条\n\n"
        
        if warnings:
            msg += f"⚠️  发现{len(warnings)}个需要注意的问题：\n\n"
            for i, warning in enumerate(warnings, 1):
                msg += f"{i}. {self._format_warning(warning)}\n\n"
        
        if self._pending_manager_review:
            msg += f"\n🔴 其中{len(self._pending_manager_review)}个问题需要活动负责人最终复核。\n"
            msg += "   系统不会自动判定为正常。\n"
        
        return msg

    def supplement_data(
        self,
        supplement_records: List[SamplingRecord],
        operator: str = "活动负责人"
    ) -> CheckResult:
        self._add_history(
            "补录数据",
            operator,
            f"补录{len(supplement_records)}条数据",
            data_after={"count": len(supplement_records)}
        )
        
        existing_ids = {s.grid_id for s in self.sampling_records}
        new_records = [
            s for s in supplement_records 
            if s.grid_id not in existing_ids
        ]
        updated_records = [
            s for s in supplement_records 
            if s.grid_id in existing_ids
        ]
        
        if updated_records:
            for update in updated_records:
                for i, existing in enumerate(self.sampling_records):
                    if existing.grid_id == update.grid_id:
                        self.sampling_records[i] = update
                        break
        
        self.sampling_records.extend(new_records)
        
        if self.param_records:
            conflicts = self.conflict_detector.detect_conflicts(
                self.sampling_records,
                self.param_records,
                recheck_resolved=False
            )
        else:
            conflicts = []
        
        self.current_step = WorkflowStep.UPDATE_CALCULATION
        
        return CheckResult(
            status=CheckStatus.SUPPLEMENTED,
            conflicts=conflicts,
            history=self.history_records.copy(),
            message=f"✅ 补录完成：新增{len(new_records)}条，更新{len(updated_records)}条。\n"
                   f"请继续：更新计算明细以重算数据"
        )

    def recalculate_after_supplement(self) -> CheckResult:
        self._add_history(
            "补录后重算",
            "系统",
            "补录数据后重新计算"
        )
        
        if self.param_records:
            conflicts = self.conflict_detector.detect_conflicts(
                self.sampling_records,
                self.param_records,
                recheck_resolved=False
            )
            
            if self.conflict_detector.has_unresolved_conflicts():
                pending = self.conflict_detector.get_pending_conflicts()
                return CheckResult(
                    status=CheckStatus.NEED_REVIEW,
                    conflicts=conflicts,
                    message=f"❌ 补录后发现{len(pending)}个新冲突需要处理，"
                           f"请数据分析师小祁确认或驳回后再重算"
                )
        
        result = self.step3_update_calculation()
        result.status = CheckStatus.RECALCULATED
        result.message = "🔄 " + result.message.replace("✅ ", "")
        return result

    def get_pending_manager_review(self) -> List[WarningItem]:
        return self._pending_manager_review

    def clear_manager_review(self, grid_id: str, field_name: str):
        self._pending_manager_review = [
            w for w in self._pending_manager_review
            if not (w.grid_id == grid_id and w.field_name == field_name)
        ]
        
        self._add_history(
            "负责人复核完成",
            "活动负责人",
            f"网格[{grid_id}]的{field_name}已由负责人复核通过"
        )

    def get_current_step(self) -> str:
        return self.current_step

    def get_history(self) -> List[HistoryRecord]:
        return self.history_records.copy()

    def get_calculation_details(self) -> List[CalculationDetail]:
        return self.calculation_details.copy()

    def run_self_check(self) -> List[SelfCheckResult]:
        results = []
        
        results.append(self._check_duplicate_import())
        results.append(self._check_percent_decimal_mix())
        results.append(self._check_supplement_recalculate())
        results.append(self._check_export_consistency())
        
        return results

    def _check_duplicate_import(self) -> SelfCheckResult:
        warnings = self.validation_engine.detect_duplicate_import(
            self.grid_data,
            DataSource.SAMPLING_LIST
        )
        
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=len(warnings) == 0,
            warnings=warnings,
            details=f"检查{len(self.grid_data)}条数据，发现{len(warnings)}个重复导入问题"
        )

    def _check_percent_decimal_mix(self) -> SelfCheckResult:
        warnings = self.validation_engine.detect_percent_decimal_mix(self.grid_data)
        
        return SelfCheckResult(
            check_name="百分数小数混合检查",
            passed=len(warnings) == 0,
            warnings=warnings,
            details=f"检查{len(self.grid_data)}条数据，发现{len(warnings)}个格式混合问题。"
                   f"注意：此类问题不自动判定，需活动负责人复核。"
        )

    def _check_supplement_recalculate(self) -> SelfCheckResult:
        warnings = []
        
        supplemented = [
            h for h in self.history_records 
            if h.operation_type == "补录数据"
        ]
        
        if supplemented:
            last_supplement = supplemented[-1]
            recalculations = [
                h for h in self.history_records
                if h.operation_type == "补录后重算"
                and h.operation_time > last_supplement.operation_time
            ]
            
            if not recalculations:
                warnings.append(WarningItem(
                    warning_type=WarningType.CALCULATION_ERROR,
                    grid_id="ALL",
                    field_name="recalculation",
                    current_value="未重算",
                    description="存在补录数据但未执行补录后重算",
                    suggestion="请执行recalculate_after_supplement()进行重算",
                    need_manager_review=False
                ))
        
        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=len(warnings) == 0,
            warnings=warnings,
            details="检查补录数据后是否已重新计算"
        )

    def _check_export_consistency(self) -> SelfCheckResult:
        warnings = []
        
        if self.export_cache and self.calculation_details:
            if len(self.export_cache) != len(self.calculation_details):
                warnings.append(WarningItem(
                    warning_type=WarningType.EXPORT_MISMATCH,
                    grid_id="ALL",
                    field_name="export_count",
                    current_value=str(len(self.calculation_details)),
                    expected_value=str(len(self.export_cache)),
                    description=f"导出数据条数不一致：导出时{len(self.export_cache)}条，当前{len(self.calculation_details)}条",
                    suggestion="数据已变更，请重新导出",
                    need_manager_review=False
                ))
            else:
                for i, (exported, current) in enumerate(zip(self.export_cache, self.calculation_details)):
                    if exported.grid_id != current.grid_id:
                        warnings.append(WarningItem(
                            warning_type=WarningType.EXPORT_MISMATCH,
                            grid_id=current.grid_id,
                            field_name="grid_id",
                            current_value=current.grid_id,
                            expected_value=exported.grid_id,
                            description=f"第{i+1}条数据网格ID不一致",
                            suggestion="数据顺序或内容已变更，请重新导出",
                            need_manager_review=False
                        ))
                    elif abs(exported.calculation_result - current.calculation_result) > 1e-9:
                        warnings.append(WarningItem(
                            warning_type=WarningType.EXPORT_MISMATCH,
                            grid_id=current.grid_id,
                            field_name="calculation_result",
                            current_value=str(current.calculation_result),
                            expected_value=str(exported.calculation_result),
                            description=f"计算结果不一致：导出值{exported.calculation_result}，当前值{current.calculation_result}",
                            suggestion="数据已变更，请重新导出",
                            need_manager_review=False
                        ))
        
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=len(warnings) == 0,
            warnings=warnings,
            details="检查当前数据与上次导出是否一致" if self.export_cache else "未检测到导出历史，跳过检查"
        )

    def export_data(self) -> List[CalculationDetail]:
        self.export_cache = self.calculation_details.copy()
        
        self._add_history(
            "导出数据",
            "系统",
            f"导出{len(self.export_cache)}条计算明细"
        )
        
        return self.export_cache

    def get_workflow_progress(self) -> str:
        steps = [
            (WorkflowStep.IMPORT_SAMPLING, "第一步：抽样名单导入"),
            (WorkflowStep.ANALYST_REVIEW, "第二步：数据分析师小祁补看参数调试表"),
            (WorkflowStep.UPDATE_CALCULATION, "第三步：更新计算明细"),
        ]
        
        progress = []
        for step_id, step_name in steps:
            if step_id in self.completed_steps:
                status = "✅ 已完成"
            elif step_id == self.current_step:
                status = "⏳ 进行中"
            else:
                status = "⏸️ 待开始"
            progress.append(f"{status} {step_name}")
        
        return "\n".join(progress)
