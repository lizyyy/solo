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
    ConflictEvidence,
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
        self._manager_review_conflicts: List[ConflictEvidence] = []
        self._sampling_import_batch_id: Optional[str] = None

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
        src = f"（来源：{warning.source_table}）" if warning.source_table else ""
        batch = f"[批次：{warning.batch_info}]" if warning.batch_info else ""
        reason = f"\n    重复原因：{warning.duplicate_reason}" if warning.duplicate_reason else ""
        
        messages = {
            WarningType.PERCENT_DECIMAL_MIX: (
                f"⚠️  网格[{warning.grid_id}]发现百分数和小数混着出现！{src}{batch}\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.DUPLICATE_IMPORT: (
                f"⚠️  网格[{warning.grid_id}]重复导入！{src}{batch}{reason}\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.DATA_MISMATCH: (
                f"⚠️  网格[{warning.grid_id}]数据与历史记录不一致！{src}\n"
                f"    当前值：{warning.current_value}\n"
                f"    历史值：{warning.expected_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.PARAM_CONFLICT: (
                f"⚠️  网格[{warning.grid_id}]参数冲突！{src}\n"
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
                f"❌ 网格[{warning.grid_id}]计算错误！{src}\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
            WarningType.MISSING_DATA: (
                f"❌ 网格[{warning.grid_id}]数据缺失或格式错误！{src}{batch}\n"
                f"    当前值：{warning.current_value}\n"
                f"    问题：{warning.description}\n"
                f"    建议：{warning.suggestion}"
            ),
        }
        return messages.get(warning.warning_type, f"⚠️  {warning.description}")

    def _format_conflict_for_review(self, c: ConflictEvidence) -> WarningItem:
        decision_text = ""
        if c.analyst_decision:
            decision_text = ("数据分析师" + c.analyst_name + "已" +
                           ("确认(confirm)" if c.analyst_decision == "confirm" else "驳回(reject)") +
                           "，需要负责人最终复核")
        else:
            decision_text = "数据分析师尚未处理"
        
        desc = (f"跨表冲突[{c.field_name}]："
                f"{c.sampling_source}=[{c.sampling_value}] vs "
                f"{c.param_source}=[{c.param_value}]。{c.description}")
        return WarningItem(
            warning_type=WarningType.PARAM_CONFLICT,
            grid_id=c.grid_id,
            field_name=c.field_name,
            current_value=f"{c.sampling_source}:{c.sampling_value} / {c.param_source}:{c.param_value}",
            description=desc,
            suggestion=f"{decision_text}。确认：保留参数表值；驳回：保留抽样值。"
                      f"请活动负责人最终拍板是否同意小祁的处理。",
            need_manager_review=True,
            source_table=f"{c.sampling_source} & {c.param_source}",
            batch_info="",
            duplicate_reason=""
        )

    def step1_import_sampling_list(
        self,
        sampling_records: List[SamplingRecord],
        operator: str = "活动负责人"
    ) -> CheckResult:
        self.sampling_records = [
            SamplingRecord(**{**r.__dict__}) for r in sampling_records
        ]
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        self._add_history(
            "第一步：导入抽样名单",
            operator,
            f"批次[{batch_id}]导入{len(sampling_records)}条抽样记录",
            data_after={"count": len(sampling_records), "batch_id": batch_id}
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
        
        self.validation_engine._new_batch()
        self._sampling_import_batch_id = self.validation_engine.current_batch_id
        
        warnings = self.validation_engine.validate_grid_data(
            temp_grid_data,
            DataSource.SAMPLING_LIST
        )
        
        self.grid_data = temp_grid_data
        self.current_step = WorkflowStep.ANALYST_REVIEW
        
        manager_review_items = [w for w in warnings if w.need_manager_review]
        self._pending_manager_review = manager_review_items
        self._manager_review_conflicts = []
        
        self.validation_engine.record_import(temp_grid_data)
        
        status = CheckStatus.NEED_REVIEW if self._pending_manager_review else CheckStatus.PENDING
        
        return CheckResult(
            status=status,
            warnings=warnings,
            history=self.history_records.copy(),
            message=self._build_step1_message(warnings)
        )

    def _build_step1_message(self, warnings: List[WarningItem]) -> str:
        if not warnings:
            return (f"✅ 抽样名单导入成功，共{len(self.sampling_records)}条记录，未发现异常。\n"
                   f"👉 负责人待复核数：{len(self._pending_manager_review)} 项\n"
                   f"请继续：第二步 数据分析师小祁补看参数调试表")
        
        msg = f"📋 第一步抽样名单导入完成，共{len(self.sampling_records)}条记录。\n"
        msg += f"⚠️  发现{len(warnings)}个问题：\n\n"
        
        for i, warning in enumerate(warnings, 1):
            msg += f"{i}. {self._format_warning(warning)}\n\n"
        
        msg += f"\n🔴 👉 负责人待复核数：{len(self._pending_manager_review)} 项"
        if self._pending_manager_review:
            msg += "，暂不自动判定为正常。"
        
        msg += "\n\n请继续：第二步 数据分析师小祁补看参数调试表"
        return msg

    def step2_analyst_review_params(
        self,
        param_records: List[ParamDebugRecord],
        conflict_callback: Optional[Callable[[List], str]] = None
    ) -> CheckResult:
        if self.current_step != WorkflowStep.ANALYST_REVIEW:
            return CheckResult(
                status=CheckStatus.ABNORMAL,
                message="❌ 流程错误：请先完成第一步抽样名单导入"
            )
        
        self.param_records = [
            ParamDebugRecord(**{**r.__dict__}) for r in param_records
        ]
        self._add_history(
            "第二步：小祁补看参数调试表",
            "小祁",
            f"数据分析师小祁导入{len(param_records)}条参数调试记录，准备与抽样名单比对",
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
                            "第二步：冲突解决-小祁决策",
                            "小祁",
                            f"小祁对网格[{conflict.grid_id}]的{conflict.field_name}冲突"
                            f"做出决策：{decision == 'confirm' and '确认-以参数为准' or '驳回-以抽样为准'}",
                            data_before={
                                f"来自[{conflict.sampling_source}]": conflict.sampling_value,
                                f"来自[{conflict.param_source}]": conflict.param_value
                            },
                            data_after={"decision": decision,
                                        "meaning": ("以参数表为准" if decision == "confirm" else "以抽样为准")}
                        )
            
            pending_conflicts = self.conflict_detector.get_pending_conflicts()
        
        review_conflicts = self.conflict_detector.get_all_manager_review_conflicts()
        self._manager_review_conflicts = review_conflicts
        
        for c in review_conflicts:
            key = f"conflict_{c.grid_id}_{c.field_name}"
            exists = any(
                w.grid_id == c.grid_id and w.field_name == c.field_name
                for w in self._pending_manager_review
            )
            if not exists:
                self._pending_manager_review.append(
                    self._format_conflict_for_review(c)
                )
        
        self.current_step = WorkflowStep.UPDATE_CALCULATION
        
        status = CheckStatus.NEED_REVIEW if self._pending_manager_review else (
            CheckStatus.CONFIRMED if not pending_conflicts else CheckStatus.NEED_REVIEW
        )
        
        return CheckResult(
            status=status,
            conflicts=conflicts,
            history=self.history_records.copy(),
            message=self._build_step2_message(conflicts, pending_conflicts, review_conflicts)
        )

    def _build_step2_message(
        self,
        conflicts: List,
        pending_conflicts: List,
        review_conflicts: List
    ) -> str:
        if not conflicts:
            return (f"✅ 参数调试表审核完成，未发现抽样与参数的跨表冲突。\n"
                   f"👉 负责人待复核数：{len(self._pending_manager_review)} 项\n"
                   f"请继续：第三步 更新计算明细")
        
        msg = f"🔍 第二步小祁补看完成。跨表冲突检测共{len(conflicts)}个冲突点：\n\n"
        
        high_severity = [c for c in conflicts if c.severity == "high"]
        medium_severity = [c for c in conflicts if c.severity == "medium"]
        
        if high_severity:
            msg += f"🔴 高优先级（{len(high_severity)}个）：\n"
            for i, c in enumerate(high_severity, 1):
                decision_tag = ""
                if c.analyst_decision:
                    decision_tag = (f"[小祁已{('确认' if c.analyst_decision == 'confirm' else '驳回')}]")
                msg += (f"  {i}. 网格[{c.grid_id}] {c.field_name} {decision_tag}\n"
                       f"     来自[{c.sampling_source}]：{c.sampling_value}\n"
                       f"     来自[{c.param_source}]：{c.param_value}\n"
                       f"     说明：{c.description}\n\n")
        
        if medium_severity:
            msg += f"🟡 中优先级（{len(medium_severity)}个）：\n"
            for i, c in enumerate(medium_severity, 1):
                decision_tag = ""
                if c.analyst_decision:
                    decision_tag = (f"[小祁已{('确认' if c.analyst_decision == 'confirm' else '驳回')}]")
                msg += (f"  {i}. 网格[{c.grid_id}] {c.field_name} {decision_tag}\n"
                       f"     来自[{c.sampling_source}]：{c.sampling_value}\n"
                       f"     来自[{c.param_source}]：{c.param_value}\n"
                       f"     说明：{c.description}\n\n")
        
        if pending_conflicts:
            msg += (f"⏳ 小祁仍有待处理冲突 {len(pending_conflicts)} 个。\n"
                   f"   👉 请调用 resolve_conflict(grid_id, field_name, 'confirm'/'reject', '小祁')\n"
                   f"   注意：系统不会自动替业务同事拍板。\n\n")
        
        if review_conflicts:
            msg += (f"🔴 👉 负责人待复核数：{len(self._pending_manager_review)} 项\n"
                   f"   其中跨表格式/数值冲突需负责人最终拍板的：{len(review_conflicts)} 项\n"
                   f"   即使小祁已处理，仍留待负责人确认，不自动归为正常。\n\n")
        else:
            msg += f"👉 负责人待复核数：{len(self._pending_manager_review)} 项\n\n"
        
        msg += "请继续：第三步 更新计算明细"
        return msg

    def step3_update_calculation(
        self,
        use_conflict_resolution: bool = True,
        operator: str = "系统"
    ) -> CheckResult:
        if self.current_step != WorkflowStep.UPDATE_CALCULATION:
            return CheckResult(
                status=CheckStatus.ABNORMAL,
                message="❌ 流程错误：请先完成第二步参数调试表审核"
            )
        
        if self.conflict_detector.has_unresolved_conflicts():
            pending = self.conflict_detector.get_pending_conflicts()
            return CheckResult(
                status=CheckStatus.NEED_REVIEW,
                message=("❌ 小祁还有未处理的冲突(" + str(len(pending)) + ")个，"
                        "请先确认或驳回后再更新计算明细")
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
        
        for w in warnings:
            if w.need_manager_review:
                exists = any(
                    pw.grid_id == w.grid_id and pw.field_name == w.field_name
                    for pw in self._pending_manager_review
                )
                if not exists:
                    self._pending_manager_review.append(w)
        
        new_calculations = self._perform_calculation(self.grid_data)
        
        old_count = len(self.calculation_details)
        self.calculation_details = new_calculations
        
        self._add_history(
            "第三步：更新计算明细",
            operator,
            f"根据小祁的冲突决策，重算{len(new_calculations)}条网格边界数据。"
            f"负责人待复核：{len(self._pending_manager_review)} 项。",
            data_before={"count": old_count},
            data_after={"count": len(new_calculations),
                       "pending_review_count": len(self._pending_manager_review)}
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
        sampling_map = {s.grid_id: s for s in self.sampling_records}
        param_map = {}
        for p in self.param_records:
            if p.grid_id not in param_map:
                param_map[p.grid_id] = {}
            param_map[p.grid_id][p.param_name] = p
        
        for data in grid_data:
            if data.numeric_value is None:
                continue
            
            actual_value = data.numeric_value / 100 if data.is_percent else data.numeric_value
            check_pass = 0 <= actual_value <= 1
            
            grid_id = data.grid_id
            original_s = sampling_map.get(grid_id)
            original_p = (param_map.get(grid_id) or {}).get("boundary_threshold")
            original_sampling_value = original_s.boundary_threshold if original_s else ""
            original_param_value = original_p.param_value if original_p else ""
            
            decision_info = self.conflict_detector.get_decision_for_grid(
                grid_id, "boundary_threshold"
            )
            format_conflict = self.conflict_detector.get_decision_for_grid(
                grid_id, "value_format"
            )
            
            conflict_resolved = False
            analyst_decision = ""
            manager_review_needed = False
            remark_parts = []
            
            if decision_info:
                dec, analyst = decision_info
                conflict_resolved = True
                analyst_decision = "confirm:以参数表为准" if dec == "confirm" else "reject:以抽样为准"
                remark_parts.append(
                    f"小祁{analyst}做出决策：{analyst_decision}"
                )
            
            if format_conflict:
                dec, _ = format_conflict
                conflict_resolved = True
                remark_parts.append(
                    f"抽样与参数表存在跨表百分数/小数格式混用，小祁决策："
                    + ("confirm" if dec == "confirm" else "reject")
                )
            
            has_mix_within = any(
                w.grid_id == grid_id and w.warning_type == WarningType.PERCENT_DECIMAL_MIX
                for w in self._pending_manager_review
            )
            has_cross_table_format = any(
                c.grid_id == grid_id and c.field_name == "value_format"
                for c in self._manager_review_conflicts
            )
            has_cross_table_value = any(
                c.grid_id == grid_id and c.field_name == "boundary_threshold"
                for c in self._manager_review_conflicts
            )
            
            if has_mix_within:
                manager_review_needed = True
                remark_parts.append(
                    "【留待负责人复核-1】同表内同一grid同时有百分数和小数格式"
                )
            if has_cross_table_format:
                manager_review_needed = True
                remark_parts.append(
                    "【留待负责人复核-2】跨表格式混用：抽样和参数表一用百分数一用小数"
                )
            if has_cross_table_value:
                manager_review_needed = True
                remark_parts.append(
                    "【留待负责人复核-3】跨表数值冲突：抽样和参数表值不相等"
                )
            
            remark_parts.append(f"采用来源：{data.source.value}")
            remark = "；".join(remark_parts) if remark_parts else ""
            
            calculation = CalculationDetail(
                grid_id=grid_id,
                boundary_value=data.numeric_value,
                is_percent=data.is_percent,
                calculation_result=actual_value,
                check_pass=check_pass,
                calculation_time=datetime.now(),
                source=data.source.value,
                remark=remark,
                original_sampling_value=original_sampling_value,
                original_param_value=original_param_value,
                conflict_resolved=conflict_resolved,
                analyst_decision=analyst_decision,
                manager_review_needed=manager_review_needed
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
        need_review = sum(1 for c in calculations if c.manager_review_needed)
        conflict_marked = sum(1 for c in calculations if c.conflict_resolved)
        
        msg = (f"✅ 第三步计算明细更新完成，共{len(calculations)}条记录。\n"
              f"   ✓ 检查通过：{passed}条\n"
              f"   ✗ 检查未通过：{failed}条\n"
              f"   ⚠️  含冲突处理痕迹：{conflict_marked}条\n"
              f"   🔴 👉 负责人待复核数：{len(self._pending_manager_review)} 项"
              f"（覆盖{need_review}条计算明细）\n\n")
        
        need_review_calcs = [c for c in calculations if c.manager_review_needed]
        if need_review_calcs:
            msg += "📌 以下计算明细留有负责人复核标记（不自动归正常）：\n"
            for i, c in enumerate(need_review_calcs, 1):
                msg += (f"  {i}. 网格[{c.grid_id}] 采用={c.boundary_value}{'%' if c.is_percent else ''} "
                       f"来源={c.source}\n")
                msg += f"     原始抽样值：{c.original_sampling_value}\n"
                msg += f"     原始参数值：{c.original_param_value}\n"
                if c.analyst_decision:
                    msg += f"     小祁决策：{c.analyst_decision}\n"
                msg += f"     为什么留下：{c.remark}\n\n"
        
        if warnings:
            msg += f"⚠️  发现{len(warnings)}个需要注意的问题：\n\n"
            for i, warning in enumerate(warnings, 1):
                msg += f"{i}. {self._format_warning(warning)}\n\n"
        
        return msg

    def supplement_data(
        self,
        supplement_records: List[SamplingRecord],
        operator: str = "活动负责人"
    ) -> CheckResult:
        batch_id = f"batch_supp_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self._add_history(
            "补录数据",
            operator,
            f"批次[{batch_id}]补录{len(supplement_records)}条数据",
            data_after={"count": len(supplement_records), "batch_id": batch_id}
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
        
        conflicts = []
        if self.param_records:
            conflicts = self.conflict_detector.detect_conflicts(
                self.sampling_records,
                self.param_records,
                recheck_resolved=False
            )
            review_conflicts = self.conflict_detector.get_all_manager_review_conflicts()
            for c in review_conflicts:
                key = f"conflict_{c.grid_id}_{c.field_name}"
                exists = any(
                    w.grid_id == c.grid_id and w.field_name == c.field_name
                    for w in self._pending_manager_review
                )
                if not exists:
                    self._pending_manager_review.append(
                        self._format_conflict_for_review(c)
                    )
        
        self.current_step = WorkflowStep.UPDATE_CALCULATION
        
        return CheckResult(
            status=CheckStatus.SUPPLEMENTED,
            conflicts=conflicts,
            history=self.history_records.copy(),
            message=(f"✅ 补录完成：新增{len(new_records)}条，更新{len(updated_records)}条。\n"
                    f"👉 负责人待复核数：{len(self._pending_manager_review)} 项\n"
                    f"请继续：补录后重算（recalculate_after_supplement）")
        )

    def recalculate_after_supplement(self) -> CheckResult:
        self._add_history(
            "补录后重算",
            "系统",
            "补录数据后重新计算所有网格边界数据"
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
                    message=("❌ 补录后发现" + str(len(pending)) + "个新冲突，"
                            "请数据分析师小祁确认或驳回后再重算")
                )
        
        result = self.step3_update_calculation()
        result.status = CheckStatus.RECALCULATED
        result.message = "🔄 " + result.message.replace("✅ 第三步", "补录后重算")
        return result

    def get_pending_manager_review(self) -> List[WarningItem]:
        return self._pending_manager_review

    def clear_manager_review(self, grid_id: str, field_name: str):
        before_count = len(self._pending_manager_review)
        self._pending_manager_review = [
            w for w in self._pending_manager_review
            if not (w.grid_id == grid_id and w.field_name == field_name)
        ]
        removed = before_count - len(self._pending_manager_review)
        
        if removed > 0:
            for i, c in enumerate(self._manager_review_conflicts):
                if c.grid_id == grid_id and c.field_name == field_name:
                    c.need_manager_review = False
            self._add_history(
                "负责人复核完成",
                "活动负责人",
                f"网格[{grid_id}]的{field_name}问题已由活动负责人复核通过，"
                f"从待办中移除（共移除{removed}项）"
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
        original_sampling_grid = []
        for idx, record in enumerate(self.sampling_records):
            numeric, is_percent, _ = self.validation_engine.parse_value(
                record.boundary_threshold
            )
            original_sampling_grid.append(GridBoundaryData(
                grid_id=record.grid_id,
                boundary_value=numeric if numeric is not None else record.boundary_threshold,
                raw_value=record.boundary_threshold,
                is_percent=is_percent,
                numeric_value=numeric,
                source=DataSource.SAMPLING_LIST,
                row_index=idx + 1
            ))
        
        warnings = self.validation_engine.detect_duplicate_import(
            original_sampling_grid,
            DataSource.SAMPLING_LIST,
            current_batch_override=self._sampling_import_batch_id
        )
        
        within_count = sum(1 for w in warnings if w.batch_info and "本次导入" in w.batch_info)
        cross_count = sum(1 for w in warnings if w.batch_info and "历史批次" in w.batch_info)
        
        return SelfCheckResult(
            check_name="重复导入检查（仅检查抽样名单导入阶段）",
            passed=len(warnings) == 0,
            warnings=warnings,
            details=(f"检查第一步抽样名单共{len(self.sampling_records)}条数据，"
                    f"发现{len(warnings)}个重复导入问题"
                    f"（本次导入内重复{within_count}条，跨历史批次重复{cross_count}条）。"
                    f"区分：本次导入内重复/历史批次重复")
        )

    def _check_percent_decimal_mix(self) -> SelfCheckResult:
        warnings = self.validation_engine.detect_percent_decimal_mix(self.grid_data)
        
        cross_format_warnings = []
        for c in self._manager_review_conflicts:
            if c.field_name == "value_format" and c.need_manager_review:
                cross_format_warnings.append(
                    self._format_conflict_for_review(c)
                )
        
        all_warnings = warnings + cross_format_warnings
        
        return SelfCheckResult(
            check_name="百分数小数混合检查（含同表+跨表）",
            passed=len(all_warnings) == 0,
            warnings=all_warnings,
            details=(f"同表混用：{len(warnings)}处，"
                    f"跨表(抽样vs参数)格式混用：{len(cross_format_warnings)}处。"
                    f"全部需活动负责人复核，不自动判定为正常。")
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
                    description="存在补录数据操作但未执行补录后重算",
                    suggestion="请执行recalculate_after_supplement()进行重算",
                    need_manager_review=False,
                    source_table="",
                    batch_info="",
                    duplicate_reason=""
                ))
        
        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=len(warnings) == 0,
            warnings=warnings,
            details=(f"发现{len(supplemented)}次补录操作，"
                    f"其中已完成重算{len(supplemented) - len(warnings)}次")
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
                    description=f"导出数据条数不一致：上次导出{len(self.export_cache)}条，当前{len(self.calculation_details)}条",
                    suggestion="数据已变更，请重新导出",
                    need_manager_review=False,
                    source_table="",
                    batch_info="",
                    duplicate_reason=""
                ))
            else:
                export_map = {c.grid_id: c for c in self.export_cache}
                for current in self.calculation_details:
                    if current.grid_id not in export_map:
                        warnings.append(WarningItem(
                            warning_type=WarningType.EXPORT_MISMATCH,
                            grid_id=current.grid_id,
                            field_name="grid_id",
                            current_value=current.grid_id,
                            expected_value="无",
                            description=f"当前存在但导出时不存在该网格",
                            suggestion="数据已变更，请重新导出",
                            need_manager_review=False
                        ))
                        continue
                    exported = export_map[current.grid_id]
                    if abs(exported.calculation_result - current.calculation_result) > 1e-9:
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
                    if exported.is_percent != current.is_percent:
                        warnings.append(WarningItem(
                            warning_type=WarningType.EXPORT_MISMATCH,
                            grid_id=current.grid_id,
                            field_name="value_format",
                            current_value="百分数" if current.is_percent else "小数",
                            expected_value="百分数" if exported.is_percent else "小数",
                            description=f"导出与当前数值格式不一致",
                            suggestion="数据已变更，请重新导出",
                            need_manager_review=False
                        ))
        
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=len(warnings) == 0,
            warnings=warnings,
            details=(f"检查当前{len(self.calculation_details)}条计算明细"
                    f"与上次导出{len(self.export_cache) if self.export_cache else 0}条是否一致"
                    + ("（未导出跳过）" if not self.export_cache else ""))
        )

    def export_data(self) -> List[CalculationDetail]:
        self.export_cache = self.calculation_details.copy()
        
        self._add_history(
            "导出数据",
            "系统",
            f"导出{len(self.export_cache)}条计算明细，其中待负责人复核"
            f"{sum(1 for c in self.export_cache if c.manager_review_needed)}条",
            data_after={"count": len(self.export_cache),
                       "pending_review": sum(1 for c in self.export_cache if c.manager_review_needed)}
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
        
        progress.append(f"🔴 活动负责人待复核：{len(self._pending_manager_review)} 项")
        
        return "\n".join(progress)
