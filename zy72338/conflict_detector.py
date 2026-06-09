from typing import List, Dict, Tuple
from models import (
    SamplingRecord,
    ParamDebugRecord,
    ConflictEvidence,
    GridBoundaryData,
    DataSource,
)
from validation_engine import ValidationEngine


class ConflictDetector:
    def __init__(self, validation_engine: ValidationEngine):
        self.validation_engine = validation_engine
        self.conflicts: List[ConflictEvidence] = []
        self.pending_conflicts: List[ConflictEvidence] = []
        self.resolved_conflicts: Dict[str, bool] = {}
        self.conflict_analyst_decisions: Dict[str, Tuple[str, str]] = {}

    def parse_boundary_value(self, raw_value: str) -> Tuple[float, bool]:
        numeric, is_percent, _ = self.validation_engine.parse_value(raw_value)
        if numeric is None or is_percent is None:
            raise ValueError(f"无法解析边界值: {raw_value}")
        return numeric, is_percent

    def detect_conflicts(
        self,
        sampling_records: List[SamplingRecord],
        param_records: List[ParamDebugRecord],
        recheck_resolved: bool = False
    ) -> List[ConflictEvidence]:
        conflicts = []
        self.pending_conflicts = []
        
        param_map: Dict[str, List[ParamDebugRecord]] = {}
        for param in param_records:
            if param.grid_id not in param_map:
                param_map[param.grid_id] = []
            param_map[param.grid_id].append(param)
        
        for sampling in sampling_records:
            if sampling.grid_id not in param_map:
                conflicts.append(ConflictEvidence(
                    grid_id=sampling.grid_id,
                    field_name="missing_param",
                    sampling_value=sampling.boundary_threshold,
                    param_value="无",
                    sampling_source="抽样名单",
                    param_source="参数调试表",
                    description=f"跨表缺失：抽样名单中有网格[{sampling.grid_id}]"
                               f"(值={sampling.boundary_threshold})，"
                               f"但参数调试表中找不到对应记录。请小祁确认是否以抽样为准或补录参数。",
                    severity="medium",
                    need_manager_review=True
                ))
                continue
            
            param_list = param_map[sampling.grid_id]
            
            for param in param_list:
                if param.param_name == "boundary_threshold":
                    try:
                        sample_val, sample_is_percent = self.parse_boundary_value(
                            sampling.boundary_threshold
                        )
                        param_val, param_is_percent = self.parse_boundary_value(
                            param.param_value
                        )
                        
                        sample_numeric = sample_val / 100 if sample_is_percent else sample_val
                        param_numeric = param_val / 100 if param_is_percent else param_val
                        
                        if abs(sample_numeric - param_numeric) > 1e-9:
                            conflicts.append(ConflictEvidence(
                                grid_id=sampling.grid_id,
                                field_name="boundary_threshold",
                                sampling_value=sampling.boundary_threshold,
                                param_value=param.param_value,
                                sampling_source="抽样名单",
                                param_source="参数调试表",
                                description=f"跨表数值冲突：抽样名单[{sampling.boundary_threshold}]"
                                           f"(换算后={sample_numeric:.6f})，"
                                           f"参数调试表[{param.param_value}]"
                                           f"(换算后={param_numeric:.6f})，"
                                           f"差值={abs(sample_numeric - param_numeric):.6f}。"
                                           f"请小祁确认：confirm=以参数表为准，reject=以抽样为准",
                                severity="high",
                                need_manager_review=True
                            ))
                        elif sample_is_percent != param_is_percent:
                            sample_fmt = "百分数" if sample_is_percent else "小数"
                            param_fmt = "百分数" if param_is_percent else "小数"
                            conflicts.append(ConflictEvidence(
                                grid_id=sampling.grid_id,
                                field_name="value_format",
                                sampling_value=sampling.boundary_threshold,
                                param_value=param.param_value,
                                sampling_source="抽样名单",
                                param_source="参数调试表",
                                description=f"跨表格式混用：抽样名单使用{sample_fmt}格式"
                                           f"[{sampling.boundary_threshold}]，"
                                           f"参数调试表使用{param_fmt}格式"
                                           f"[{param.param_value}]。"
                                           f"两者换算后数值相等，但格式不统一。"
                                           f"请小祁确认是否统一格式，再交由活动负责人复核。",
                                severity="high",
                                need_manager_review=True
                            ))
                            
                    except ValueError as e:
                        conflicts.append(ConflictEvidence(
                            grid_id=sampling.grid_id,
                            field_name="boundary_threshold",
                            sampling_value=sampling.boundary_threshold,
                            param_value=param.param_value,
                            sampling_source="抽样名单",
                            param_source="参数调试表",
                            description=f"数值解析失败：{str(e)}",
                            severity="high",
                            need_manager_review=True
                        ))
                
                elif param.param_name == "check_point":
                    if sampling.check_point != param.remark:
                        conflicts.append(ConflictEvidence(
                            grid_id=sampling.grid_id,
                            field_name="check_point",
                            sampling_value=sampling.check_point,
                            param_value=param.remark,
                            sampling_source="抽样名单",
                            param_source="参数调试表",
                            description=f"检查点不一致：抽样名单[{sampling.check_point}]，"
                                       f"参数调试表备注[{param.remark}]",
                            severity="medium",
                            need_manager_review=False
                        ))
        
        for param in param_records:
            found = False
            for sampling in sampling_records:
                if param.grid_id == sampling.grid_id:
                    found = True
                    break
            if not found:
                conflicts.append(ConflictEvidence(
                    grid_id=param.grid_id,
                    field_name="missing_sampling",
                    sampling_value="无",
                    param_value=param.param_value,
                    sampling_source="抽样名单",
                    param_source="参数调试表",
                    description=f"跨表缺失：参数调试表中有网格[{param.grid_id}]"
                               f"(值={param.param_value})，"
                               f"但抽样名单中找不到对应记录。请小祁确认是否补录抽样。",
                    severity="medium",
                    need_manager_review=True
                ))
        
        if not recheck_resolved:
            for c in conflicts:
                key = f"{c.grid_id}_{c.field_name}"
                if key in self.conflict_analyst_decisions:
                    decision, analyst = self.conflict_analyst_decisions[key]
                    c.analyst_decision = decision
                    c.analyst_name = analyst
        
        self.conflicts = conflicts
        if recheck_resolved:
            self.pending_conflicts = [
                c for c in conflicts 
                if c.severity in ["high", "medium"]
            ]
        else:
            self.pending_conflicts = [
                c for c in conflicts 
                if f"{c.grid_id}_{c.field_name}" not in self.resolved_conflicts
                and c.severity in ["high", "medium"]
            ]
        
        return conflicts

    def get_pending_conflicts(self) -> List[ConflictEvidence]:
        return self.pending_conflicts

    def resolve_conflict(
        self,
        grid_id: str,
        field_name: str,
        analyst_decision: str,
        analyst_name: str = "小祁"
    ) -> bool:
        conflict_key = f"{grid_id}_{field_name}"
        
        if analyst_decision == "confirm":
            self.resolved_conflicts[conflict_key] = True
            self.conflict_analyst_decisions[conflict_key] = (analyst_decision, analyst_name)
            self.pending_conflicts = [
                c for c in self.pending_conflicts
                if not (c.grid_id == grid_id and c.field_name == field_name)
            ]
            for c in self.conflicts:
                if c.grid_id == grid_id and c.field_name == field_name:
                    c.analyst_decision = "confirm"
                    c.analyst_name = analyst_name
            return True
        elif analyst_decision == "reject":
            self.resolved_conflicts[conflict_key] = False
            self.conflict_analyst_decisions[conflict_key] = (analyst_decision, analyst_name)
            self.pending_conflicts = [
                c for c in self.pending_conflicts
                if not (c.grid_id == grid_id and c.field_name == field_name)
            ]
            for c in self.conflicts:
                if c.grid_id == grid_id and c.field_name == field_name:
                    c.analyst_decision = "reject"
                    c.analyst_name = analyst_name
            return False
        else:
            raise ValueError("决策类型必须是 'confirm' 或 'reject'")

    def get_conflict_decision(self, grid_id: str, field_name: str) -> bool:
        conflict_key = f"{grid_id}_{field_name}"
        return self.resolved_conflicts.get(conflict_key, None)

    def has_unresolved_conflicts(self) -> bool:
        return len(self.pending_conflicts) > 0

    def get_all_manager_review_conflicts(self) -> List[ConflictEvidence]:
        results = []
        for c in self.conflicts:
            if c.need_manager_review:
                key = f"{c.grid_id}_{c.field_name}"
                if key in self.resolved_conflicts:
                    decision, analyst = self.conflict_analyst_decisions.get(
                        key, (None, "")
                    )
                    c_copy = ConflictEvidence(**{**c.__dict__})
                    c_copy.analyst_decision = decision
                    c_copy.analyst_name = analyst
                    results.append(c_copy)
                else:
                    results.append(c)
        return results

    def convert_to_grid_data(
        self,
        sampling_records: List[SamplingRecord],
        param_records: List[ParamDebugRecord],
        use_conflict_resolution: bool = True
    ) -> List[GridBoundaryData]:
        grid_data_list = []
        
        sampling_map = {s.grid_id: s for s in sampling_records}
        param_map = {}
        for p in param_records:
            if p.grid_id not in param_map:
                param_map[p.grid_id] = {}
            param_map[p.grid_id][p.param_name] = p
        
        for idx, sampling in enumerate(sampling_records):
            raw_value = sampling.boundary_threshold
            numeric, is_percent, _ = self.validation_engine.parse_value(raw_value)
            
            use_param = False
            conflict_key = f"{sampling.grid_id}_boundary_threshold"
            conflict_decision = None
            if use_conflict_resolution and conflict_key in self.resolved_conflicts:
                conflict_decision = self.resolved_conflicts[conflict_key]
                if conflict_decision:
                    if (sampling.grid_id in param_map 
                        and "boundary_threshold" in param_map[sampling.grid_id]):
                        param = param_map[sampling.grid_id]["boundary_threshold"]
                        raw_value = param.param_value
                        numeric, is_percent, _ = self.validation_engine.parse_value(
                            raw_value
                        )
                        use_param = True
            
            grid_data = GridBoundaryData(
                grid_id=sampling.grid_id,
                boundary_value=numeric if numeric is not None else raw_value,
                raw_value=raw_value,
                is_percent=is_percent,
                numeric_value=numeric,
                source=DataSource.PARAM_DEBUG_TABLE if use_param else DataSource.SAMPLING_LIST,
                row_index=idx + 1
            )
            grid_data_list.append(grid_data)
        
        return grid_data_list

    def get_decision_for_grid(self, grid_id: str, field_name: str):
        key = f"{grid_id}_{field_name}"
        return self.conflict_analyst_decisions.get(key, None)
