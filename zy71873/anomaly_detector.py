import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

from models import (
    PollutionRecord, RecordStatus, RecordRepository,
    IssueType, PendingQueueItem, AuditLogEntry
)


class AnomalyDetector:
    def __init__(self, repo: RecordRepository):
        self.repo = repo
        self._init_unit_standards()
    
    def _init_unit_standards(self) -> None:
        standards = [
            {
                "pollutant": "COD",
                "standard_unit": "mg/L",
                "allowed_units": ["mg/L", "μg/L", "ppm"],
                "conversion_factors": {"mg/L": 1.0, "μg/L": 0.001, "ppm": 1.0}
            },
            {
                "pollutant": "氨氮",
                "standard_unit": "mg/L",
                "allowed_units": ["mg/L", "μg/L", "ppm", "mg/L-N"],
                "conversion_factors": {"mg/L": 1.0, "μg/L": 0.001, "ppm": 1.0, "mg/L-N": 1.0}
            },
            {
                "pollutant": "总磷",
                "standard_unit": "mg/L",
                "allowed_units": ["mg/L", "μg/L", "ppm", "mg/L-P"],
                "conversion_factors": {"mg/L": 1.0, "μg/L": 0.001, "ppm": 1.0, "mg/L-P": 1.0}
            },
            {
                "pollutant": "pH",
                "standard_unit": "",
                "allowed_units": ["", "pH", "无量纲"],
                "conversion_factors": {"": 1.0, "pH": 1.0, "无量纲": 1.0}
            },
            {
                "pollutant": "溶解氧",
                "standard_unit": "mg/L",
                "allowed_units": ["mg/L", "μg/L", "ppm", "%"],
                "conversion_factors": {"mg/L": 1.0, "μg/L": 0.001, "ppm": 1.0, "%": 0.1}
            }
        ]
        
        for std in standards:
            existing = self.repo.get_unit_standard(std["pollutant"])
            if not existing:
                self.repo.insert_unit_standard(
                    pollutant=std["pollutant"],
                    standard_unit=std["standard_unit"],
                    allowed_units=std["allowed_units"],
                    conversion_factors=std["conversion_factors"]
                )
    
    def _generate_id(self) -> str:
        return str(uuid.uuid4())
    
    def _log_action(self, record_id: str, action: str,
                     old_status: Optional[RecordStatus],
                     new_status: Optional[RecordStatus],
                     changed_by: Optional[str],
                     reason: str,
                     changed_fields: Dict[str, Any] = None) -> None:
        log_entry = AuditLogEntry(
            log_id=self._generate_id(),
            record_id=record_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            change_reason=reason,
            changed_fields=changed_fields or {},
            timestamp=datetime.now()
        )
        self.repo.insert_audit_log(log_entry)
    
    def _add_to_pending(self, record_id: str, issue_type: IssueType,
                        issue_description: str, review_reason: str,
                        metadata: Dict[str, Any] = None) -> PendingQueueItem:
        item = PendingQueueItem(
            queue_id=self._generate_id(),
            record_id=record_id,
            issue_type=issue_type,
            issue_description=issue_description,
            review_reason=review_reason,
            detected_at=datetime.now(),
            is_active=True
        )
        self.repo.insert_pending_item(item)
        
        record = self.repo.get_record(record_id)
        if record and record.status != RecordStatus.PENDING_REVIEW:
            old_status = record.status
            record.status = RecordStatus.PENDING_REVIEW
            record.metadata[f"pending_reason_{issue_type.value}"] = review_reason
            self.repo.update_record(record)
            
            self._log_action(
                record_id=record_id,
                action="mark_pending",
                old_status=old_status,
                new_status=RecordStatus.PENDING_REVIEW,
                changed_by="system",
                reason=f"检测到{issue_type.value}，标记为待复核。{review_reason}",
                changed_fields={
                    "issue_type": issue_type.value,
                    "issue_description": issue_description,
                    "metadata": metadata or {}
                }
            )
        
        return item
    
    def detect_unit_mismatch(self, record_id: str) -> Optional[PendingQueueItem]:
        record = self.repo.get_record(record_id)
        if not record:
            return None
        
        standard = self.repo.get_unit_standard(record.pollutant)
        if not standard:
            return None
        
        record_unit = record.unit.strip()
        
        if record_unit not in standard["allowed_units"]:
            description = (f"污染物[{record.pollutant}]使用了未定义的单位[{record_unit}]，"
                          f"标准单位为[{standard['standard_unit']}]，"
                          f"允许单位为{standard['allowed_units']}")
            
            reason = (f"单位混用风险：该污染物标准单位是{standard['standard_unit']}，"
                     f"但记录使用了{record_unit}。"
                     f"如果不进行单位转换直接参与计算，会导致结果数量级错误。"
                     f"请人工确认是否需要转换，或是否为录入错误。"
                     f"记录详情：位置={record.location}, 时间={record.sample_time}, "
                     f"数值={record.value}{record_unit}")
            
            return self._add_to_pending(
                record_id=record_id,
                issue_type=IssueType.UNIT_MISMATCH,
                issue_description=description,
                review_reason=reason,
                metadata={
                    "record_unit": record_unit,
                    "standard_unit": standard["standard_unit"],
                    "allowed_units": standard["allowed_units"],
                    "value": record.value
                }
            )
        
        same_location_records = self.repo.get_records_by_criteria(
            location=record.location,
            pollutant=record.pollutant
        )
        
        units_used = set()
        for r in same_location_records:
            if r.record_id != record_id:
                units_used.add(r.unit.strip())
        
        if units_used and record_unit not in units_used and len(units_used) >= 1:
            other_units = ", ".join(units_used)
            description = (f"同一监测点[{record.location}]的[{record.pollutant}]出现单位不一致，"
                          f"本记录使用[{record_unit}]，其他记录使用[{other_units}]")
            
            reason = (f"单位混用风险：同一监测点同一污染物出现多种单位。"
                     f"本记录使用{record_unit}，但同位置其他{len(units_used)}条记录使用{other_units}。"
                     f"这可能导致时间序列对比时出现假异常。"
                     f"请确认是否为单位录入错误，或是否需要统一转换。"
                     f"建议统一转换为标准单位{standard['standard_unit']}。")
            
            return self._add_to_pending(
                record_id=record_id,
                issue_type=IssueType.UNIT_MISMATCH,
                issue_description=description,
                review_reason=reason,
                metadata={
                    "record_unit": record_unit,
                    "other_units": list(units_used),
                    "standard_unit": standard["standard_unit"],
                    "same_location_count": len(same_location_records)
                }
            )
        
        return None
    
    def detect_constraint_overridden(self, record_id: str) -> Optional[PendingQueueItem]:
        record = self.repo.get_record(record_id)
        if not record:
            return None
        
        if not record.overridden_constraints:
            return None
        
        audit_log = self.repo.get_audit_log(record_id)
        override_actions = [
            entry for entry in audit_log 
            if "override" in entry.action.lower() or "constraint" in entry.action.lower()
        ]
        
        overridden_keys = list(record.overridden_constraints.keys())
        original_constraints = record.constraints
        
        violations = []
        for key in overridden_keys:
            original_val = original_constraints.get(key, "未设置")
            overridden_val = record.overridden_constraints.get(key)
            
            if original_val != "未设置" and str(original_val) != str(overridden_val):
                violations.append({
                    "constraint_name": key,
                    "original_value": original_val,
                    "overridden_value": overridden_val
                })
        
        if not violations:
            return None
        
        violation_descriptions = "; ".join([
            f"[{v['constraint_name']}] 原值={v['original_value']} → 覆盖值={v['overridden_value']}"
            for v in violations
        ])
        
        description = (f"记录[{record_id}]的约束条件被覆盖。{violation_descriptions}")
        
        who_overrode = "未知"
        when_overrode = "未知"
        why_overrode = "未记录原因"
        
        if override_actions:
            last_override = override_actions[-1]
            who_overrode = last_override.changed_by or "未知"
            when_overrode = last_override.timestamp.isoformat()
            why_overrode = last_override.change_reason or "未记录原因"
        
        reason = (f"约束被覆盖：该记录有{len(violations)}项约束被人工覆盖，"
                 f"这可能影响反推结果的可信度。\n"
                 f"【覆盖详情】\n{violation_descriptions}\n\n"
                 f"【操作痕迹】\n"
                 f"操作人：{who_overrode}\n"
                 f"操作时间：{when_overrode}\n"
                 f"记录原因：{why_overrode}\n\n"
                 f"【复核要点】\n"
                 f"1. 确认每项约束被覆盖的必要性\n"
                 f"2. 检查是否有书面审批记录\n"
                 f"3. 评估覆盖后对反推结果的影响程度\n"
                 f"4. 如无充分理由，应恢复原始约束")
        
        return self._add_to_pending(
            record_id=record_id,
            issue_type=IssueType.CONSTRAINT_OVERRIDDEN,
            issue_description=description,
            review_reason=reason,
            metadata={
                "violations": violations,
                "override_count": len(violations),
                "who_overrode": who_overrode,
                "when_overrode": when_overrode,
                "why_overrode": why_overrode,
                "original_constraints": original_constraints,
                "overridden_constraints": record.overridden_constraints
            }
        )
    
    def detect_result_drift(self, record_id: str, drift_threshold: float = 0.15) -> Optional[PendingQueueItem]:
        record = self.repo.get_record(record_id)
        if not record:
            return None
        
        if not record.model_version:
            return None
        
        similar_records = self.repo.get_records_by_criteria(
            location=record.location,
            pollutant=record.pollutant
        )
        
        same_time_window = []
        for r in similar_records:
            if r.record_id != record_id:
                time_diff = abs((r.sample_time - record.sample_time).total_seconds())
                if time_diff <= 3600:
                    if r.model_version and r.model_version != record.model_version:
                        same_time_window.append(r)
        
        if not same_time_window:
            return None
        
        drifts = []
        for r in same_time_window:
            if r.value > 0:
                drift_pct = abs(record.value - r.value) / r.value
                if drift_pct > drift_threshold:
                    drifts.append({
                        "other_record_id": r.record_id,
                        "other_model_version": r.model_version,
                        "other_value": r.value,
                        "other_unit": r.unit,
                        "other_time": r.sample_time.isoformat(),
                        "drift_percentage": round(drift_pct * 100, 2),
                        "value_diff": round(abs(record.value - r.value), 4)
                    })
        
        if not drifts:
            return None
        
        drift_descriptions = "; ".join([
            f"与记录[{d['other_record_id']}]（模型{d['other_model_version']}）"
            f"偏差{d['drift_percentage']}%，差值{d['value_diff']}{record.unit}"
            for d in drifts
        ])
        
        description = (f"记录[{record_id}]（模型{record.model_version}）与同时段其他模型运行结果偏差过大。"
                      f"{drift_descriptions}")
        
        other_models = set(d["other_model_version"] for d in drifts)
        max_drift = max(d["drift_percentage"] for d in drifts)
        
        reason = (f"结果漂移风险：同一时段同一监测点的同一污染物，"
                 f"使用不同模型反推结果差异超过{drift_threshold*100}%阈值。\n\n"
                 f"【本记录】\n"
                 f"模型版本：{record.model_version}\n"
                 f"反推结果：{record.value}{record.unit}\n"
                 f"采样时间：{record.sample_time}\n\n"
                 f"【差异详情】\n"
                 f"涉及模型版本：{', '.join(other_models)}\n"
                 f"最大偏差：{max_drift}%\n"
                 f"漂移记录数：{len(drifts)}条\n\n"
                 f"【复核要点】\n"
                 f"1. 检查各模型的输入参数是否一致\n"
                 f"2. 确认是否有模型参数更新导致结果变化\n"
                 f"3. 评估哪个模型的结果更可信\n"
                 f"4. 如确认某模型有误，应标记并重新计算")
        
        return self._add_to_pending(
            record_id=record_id,
            issue_type=IssueType.RESULT_DRIFT,
            issue_description=description,
            review_reason=reason,
            metadata={
                "drifts": drifts,
                "drift_count": len(drifts),
                "max_drift_pct": max_drift,
                "threshold_pct": drift_threshold * 100,
                "models_involved": list(other_models),
                "record_model": record.model_version,
                "record_value": record.value
            }
        )
    
    def detect_late_attachment(self, record_id: str) -> Optional[PendingQueueItem]:
        record = self.repo.get_record(record_id)
        if not record:
            return None
        
        source = self.repo.get_data_source(record.source_id)
        if not source or source.source_type.value != "late_attachment":
            return None
        
        original_record_id = record.metadata.get("late_attachment_for")
        if not original_record_id:
            return None
        
        original = self.repo.get_record(original_record_id)
        if not original:
            return None
        
        value_diff = abs(record.value - original.value)
        diff_pct = (value_diff / original.value * 100) if original.value > 0 else 0
        
        description = (f"晚到附件记录[{record_id}]修正了原始记录[{original_record_id}]的数据。"
                      f"原值={original.value}{original.unit}，新值={record.value}{record.unit}，"
                      f"差异={round(value_diff, 4)}{record.unit}（{round(diff_pct, 2)}%）")
        
        attachment_reason = record.metadata.get("attachment_reason", "未说明原因")
        uploaded_by = source.uploaded_by or "未知"
        uploaded_at = source.uploaded_at.isoformat()
        
        reason = (f"晚到附件：该记录是对原始记录的补充修正，"
                 f"晚到数据可能影响已完成的反推结果。\n\n"
                 f"【附件信息】\n"
                 f"上传人：{uploaded_by}\n"
                 f"上传时间：{uploaded_at}\n"
                 f"晚到原因：{attachment_reason}\n\n"
                 f"【数据对比】\n"
                 f"原始记录：{original_record_id}\n"
                 f"原始数值：{original.value}{original.unit}\n"
                 f"修正数值：{record.value}{record.unit}\n"
                 f"差异幅度：{round(diff_pct, 2)}%\n\n"
                 f"【复核要点】\n"
                 f"1. 确认晚到原因是否合理\n"
                 f"2. 评估数据修正是否必要\n"
                 f"3. 检查是否需要重新运行反推模型\n"
                 f"4. 确认原始记录是否应标记为作废")
        
        return self._add_to_pending(
            record_id=record_id,
            issue_type=IssueType.LATE_ATTACHMENT,
            issue_description=description,
            review_reason=reason,
            metadata={
                "original_record_id": original_record_id,
                "original_value": original.value,
                "new_value": record.value,
                "value_diff": value_diff,
                "diff_pct": round(diff_pct, 2),
                "uploaded_by": uploaded_by,
                "uploaded_at": uploaded_at,
                "attachment_reason": attachment_reason
            }
        )
    
    def detect_manual_correction(self, record_id: str) -> Optional[PendingQueueItem]:
        record = self.repo.get_record(record_id)
        if not record:
            return None
        
        if not record.metadata.get("manual_correction"):
            return None
        
        source = self.repo.get_data_source(record.source_id)
        audit_log = self.repo.get_audit_log(record_id)
        
        correction_logs = [
            entry for entry in audit_log
            if entry.action == "manual_correction"
        ]
        
        if not correction_logs:
            return None
        
        last_correction = correction_logs[-1]
        changed_fields = last_correction.changed_fields
        old_values = changed_fields.get("old_values", {})
        new_values = changed_fields.get("new_values", {})
        
        field_changes = "; ".join([
            f"[{field}] {old} → {new}"
            for field, old in old_values.items()
            for f, new in new_values.items()
            if field == f
        ])
        
        description = (f"记录[{record_id}]被人工修正。修正字段：{field_changes}")
        
        corrected_by = record.metadata.get("corrected_by", "未知")
        correction_time = record.metadata.get("correction_time", "未知")
        correction_reason = record.metadata.get("correction_reason", "未说明原因")
        
        reason = (f"人工更正：该记录经过人工修改，修改内容可能影响反推结果的客观性。\n\n"
                 f"【修改信息】\n"
                 f"修改人：{corrected_by}\n"
                 f"修改时间：{correction_time}\n"
                 f"修改原因：{correction_reason}\n\n"
                 f"【修改详情】\n"
                 f"{field_changes}\n\n"
                 f"【复核要点】\n"
                 f"1. 确认修改原因是否充分合理\n"
                 f"2. 检查是否有修改审批记录\n"
                 f"3. 评估修改对反推结果的影响\n"
                 f"4. 确认是否需要重新运行模型")
        
        return self._add_to_pending(
            record_id=record_id,
            issue_type=IssueType.MANUAL_CORRECTION,
            issue_description=description,
            review_reason=reason,
            metadata={
                "corrected_by": corrected_by,
                "correction_time": correction_time,
                "correction_reason": correction_reason,
                "old_values": old_values,
                "new_values": new_values,
                "change_count": len(old_values)
            }
        )
    
    def run_all_checks(self, record_id: str) -> List[PendingQueueItem]:
        issues = []
        
        checkers = [
            self.detect_unit_mismatch,
            self.detect_constraint_overridden,
            self.detect_result_drift,
            self.detect_late_attachment,
            self.detect_manual_correction
        ]
        
        for checker in checkers:
            try:
                issue = checker(record_id)
                if issue:
                    issues.append(issue)
            except Exception as e:
                print(f"检查{checker.__name__}时出错: {e}")
        
        if not issues:
            record = self.repo.get_record(record_id)
            if record and record.status == RecordStatus.DRAFT:
                old_status = record.status
                record.status = RecordStatus.NORMAL
                self.repo.update_record(record)
                
                self._log_action(
                    record_id=record_id,
                    action="auto_approve",
                    old_status=old_status,
                    new_status=RecordStatus.NORMAL,
                    changed_by="system",
                    reason="所有检测通过，无异常，自动标记为正常",
                    changed_fields={"auto_approved": True}
                )
        
        return issues
    
    def check_all_records(self) -> Dict[str, List[PendingQueueItem]]:
        all_records = self.repo.get_records_by_criteria()
        results = {}
        
        for record in all_records:
            if record.status in [RecordStatus.NORMAL, RecordStatus.DRAFT]:
                issues = self.run_all_checks(record.record_id)
                if issues:
                    results[record.record_id] = issues
        
        return results
