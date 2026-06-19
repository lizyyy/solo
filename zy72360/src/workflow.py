from datetime import datetime
from typing import List, Optional, Dict, Any
from .models import (
    SamplingRecord, TemperatureCalibration, RollPeriodEstimate,
    ConflictEvidence, SafetyReminder, RecordStatus, SensorStatus, ReviewInfo
)
from .conflict_detector import ConflictDetector
from .self_check import SelfChecker
import uuid
import json
import pickle
import os


class QualityWorkflow:
    def __init__(self):
        self.sampling_records: List[SamplingRecord] = []
        self.calibration_records: List[TemperatureCalibration] = []
        self.estimates: List[RollPeriodEstimate] = []
        self.safety_reminders: List[SafetyReminder] = []
        self.conflict_detector = ConflictDetector()
        self.self_checker = SelfChecker()
        self.history_log: List[dict] = []
        self.session_name: str = ""
        self.created_time: datetime = datetime.now()

    def _log_action(self, action: str, record_id: Optional[str], details: dict):
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "record_id": record_id,
            "details": details
        }
        self.history_log.append(log_entry)
        if record_id:
            record = self._get_record(record_id)
            if record:
                record.last_modified_time = datetime.now()

    def _get_record(self, record_id: str) -> Optional[SamplingRecord]:
        return next((r for r in self.sampling_records if r.record_id == record_id), None)

    def _get_calibration(self, calibration_id: str) -> Optional[TemperatureCalibration]:
        return next((c for c in self.calibration_records if c.calibration_id == calibration_id), None)

    def _get_reminder(self, reminder_id: str) -> Optional[SafetyReminder]:
        return next((r for r in self.safety_reminders if r.reminder_id == reminder_id), None)

    def _sync_record_links(self, record: SamplingRecord):
        for conflict in self.conflict_detector.conflicts:
            if conflict.sampling_record_id == record.record_id:
                if conflict.conflict_id not in record.related_conflict_ids:
                    record.related_conflict_ids.append(conflict.conflict_id)
        for cal in self.calibration_records:
            if record.record_id in cal.related_sampling_record_ids:
                if cal.calibration_id not in record.related_calibration_ids:
                    record.related_calibration_ids.append(cal.calibration_id)
        for rem in self.safety_reminders:
            if rem.related_record_id == record.record_id:
                if rem.reminder_id not in record.related_reminder_ids:
                    record.related_reminder_ids.append(rem.reminder_id)

    def _rebuild_all_links(self):
        for record in self.sampling_records:
            record.related_conflict_ids = []
            record.related_calibration_ids = []
            record.related_reminder_ids = []
            record.supplementary_ids = []
            if record.is_supplementary and record.original_record_id:
                orig = self._get_record(record.original_record_id)
                if orig and record.record_id not in orig.supplementary_ids:
                    orig.supplementary_ids.append(record.record_id)
            self._sync_record_links(record)

    def save_session(self, filepath: str, session_name: Optional[str] = None) -> dict:
        self.session_name = session_name or os.path.basename(filepath)
        session_data = {
            "session_name": self.session_name,
            "saved_time": datetime.now().isoformat(),
            "created_time": self.created_time.isoformat(),
            "sampling_records": [r.to_dict() for r in self.sampling_records],
            "calibration_records": [c.to_dict() for c in self.calibration_records],
            "estimates": [
                {
                    "estimate_id": e.estimate_id,
                    "ship_id": e.ship_id,
                    "sampling_records": e.sampling_records,
                    "average_period": e.average_period,
                    "period_variance": e.period_variance,
                    "calculated_time": e.calculated_time.isoformat() if e.calculated_time else None,
                    "calculated_by": e.calculated_by,
                    "status": e.status,
                    "excluded_records": e.excluded_records
                }
                for e in self.estimates
            ],
            "safety_reminders": [
                {
                    "reminder_id": r.reminder_id,
                    "related_record_id": r.related_record_id,
                    "level": r.level,
                    "title": r.title,
                    "content": r.content,
                    "created_time": r.created_time.isoformat(),
                    "reviewed": r.reviewed,
                    "reviewed_by": r.reviewed_by,
                    "reviewed_time": r.reviewed_time.isoformat() if r.reviewed_time else None,
                    "related_conflict_id": r.related_conflict_id,
                    "reminder_type": r.reminder_type,
                    "next_step": r.next_step,
                    "original_value": r.original_value,
                    "current_value": r.current_value
                }
                for r in self.safety_reminders
            ],
            "conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "sampling_record_id": c.sampling_record_id,
                    "calibration_id": c.calibration_id,
                    "conflict_type": c.conflict_type,
                    "description": c.description,
                    "sampling_value": c.sampling_value,
                    "calibration_value": c.calibration_value,
                    "discovered_time": c.discovered_time.isoformat(),
                    "resolved": c.resolved,
                    "resolution": c.resolution,
                    "resolved_by": c.resolved_by,
                    "resolved_time": c.resolved_time.isoformat() if c.resolved_time else None,
                    "original_status": c.original_status,
                    "corrected_status": c.corrected_status,
                    "handler_after_resolve": c.handler_after_resolve,
                    "result_summary": c.result_summary,
                    "reminder_id": c.reminder_id
                }
                for c in self.conflict_detector.conflicts
            ],
            "self_check_results": self.self_checker.get_all_results(),
            "history_log": self.history_log
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        self._log_action("保存会话", None, {"filepath": filepath, "session_name": self.session_name})
        return {"success": True, "filepath": filepath, "saved_time": session_data["saved_time"]}

    def load_session(self, filepath: str) -> dict:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self.sampling_records = []
        for r_data in data["sampling_records"]:
            record = SamplingRecord(
                record_id=r_data["record_id"],
                ship_id=r_data["ship_id"],
                sensor_id=r_data["sensor_id"],
                sampling_interval=r_data["sampling_interval"],
                sampling_start_time=datetime.fromisoformat(r_data["sampling_start_time"]),
                sampling_end_time=datetime.fromisoformat(r_data["sampling_end_time"]),
                roll_periods=r_data["roll_periods"],
                import_time=datetime.fromisoformat(r_data["import_time"]),
                import_user=r_data["import_user"],
                status=RecordStatus(r_data["status"]),
                sensor_status=SensorStatus(r_data.get("sensor_status", "原始编号")),
                previous_sensor_id=r_data.get("previous_sensor_id"),
                is_supplementary=r_data.get("is_supplementary", False),
                original_record_id=r_data.get("original_record_id"),
                remarks=r_data.get("remarks", ""),
                original_sampling_interval=r_data.get("original_sampling_interval"),
                correction_reason=r_data.get("correction_reason", ""),
                next_handler=r_data.get("next_handler", ""),
                version=r_data.get("version", 1),
                supplementary_ids=r_data.get("supplementary_ids", []),
                related_calibration_ids=r_data.get("related_calibration_ids", []),
                related_reminder_ids=r_data.get("related_reminder_ids", []),
                related_conflict_ids=r_data.get("related_conflict_ids", [])
            )
            for ri_data in r_data.get("review_infos", []):
                record.review_infos.append(ReviewInfo(
                    original_value=ri_data["original_value"],
                    corrected_value=ri_data["corrected_value"],
                    field_name=ri_data["field_name"],
                    reason=ri_data["reason"],
                    next_handler=ri_data["next_handler"],
                    handled_by=ri_data["handled_by"],
                    handled_time=datetime.fromisoformat(ri_data["handled_time"]) if ri_data.get("handled_time") else None,
                    result=ri_data.get("result")
                ))
            self.sampling_records.append(record)
        self.calibration_records = []
        for c_data in data["calibration_records"]:
            self.calibration_records.append(TemperatureCalibration(
                calibration_id=c_data["calibration_id"],
                ship_id=c_data["ship_id"],
                sensor_id=c_data["sensor_id"],
                calibration_time=datetime.fromisoformat(c_data["calibration_time"]),
                effective_sampling_interval=c_data["effective_sampling_interval"],
                calibration_temperature=c_data["calibration_temperature"],
                operator=c_data["operator"],
                remarks=c_data.get("remarks", ""),
                related_sampling_record_ids=c_data.get("related_sampling_record_ids", []),
                affected_conflict_ids=c_data.get("affected_conflict_ids", [])
            ))
        self.estimates = []
        for e_data in data.get("estimates", []):
            est = RollPeriodEstimate(
                estimate_id=e_data["estimate_id"],
                ship_id=e_data["ship_id"],
                sampling_records=e_data.get("sampling_records", []),
                average_period=e_data.get("average_period", 0.0),
                period_variance=e_data.get("period_variance", 0.0),
                calculated_by=e_data.get("calculated_by")
            )
            if e_data.get("calculated_time"):
                est.calculated_time = datetime.fromisoformat(e_data["calculated_time"])
            est.status = e_data.get("status", "待计算")
            est.excluded_records = e_data.get("excluded_records", [])
            self.estimates.append(est)
        self.safety_reminders = []
        for r_data in data.get("safety_reminders", []):
            rem = SafetyReminder(
                reminder_id=r_data["reminder_id"],
                related_record_id=r_data["related_record_id"],
                level=r_data["level"],
                title=r_data["title"],
                content=r_data["content"],
                created_time=datetime.fromisoformat(r_data["created_time"])
            )
            rem.reviewed = r_data.get("reviewed", False)
            rem.reviewed_by = r_data.get("reviewed_by")
            if r_data.get("reviewed_time"):
                rem.reviewed_time = datetime.fromisoformat(r_data["reviewed_time"])
            rem.related_conflict_id = r_data.get("related_conflict_id")
            rem.reminder_type = r_data.get("reminder_type", "")
            rem.next_step = r_data.get("next_step", "")
            rem.original_value = r_data.get("original_value")
            rem.current_value = r_data.get("current_value")
            self.safety_reminders.append(rem)
        self.conflict_detector.conflicts = []
        for c_data in data.get("conflicts", []):
            conflict = ConflictEvidence(
                conflict_id=c_data["conflict_id"],
                sampling_record_id=c_data["sampling_record_id"],
                calibration_id=c_data["calibration_id"],
                conflict_type=c_data["conflict_type"],
                description=c_data["description"],
                sampling_value=c_data["sampling_value"],
                calibration_value=c_data["calibration_value"],
                discovered_time=datetime.fromisoformat(c_data["discovered_time"])
            )
            conflict.resolved = c_data.get("resolved", False)
            conflict.resolution = c_data.get("resolution")
            conflict.resolved_by = c_data.get("resolved_by")
            if c_data.get("resolved_time"):
                conflict.resolved_time = datetime.fromisoformat(c_data["resolved_time"])
            conflict.original_status = c_data.get("original_status")
            conflict.corrected_status = c_data.get("corrected_status")
            conflict.handler_after_resolve = c_data.get("handler_after_resolve", "")
            conflict.result_summary = c_data.get("result_summary", "")
            conflict.reminder_id = c_data.get("reminder_id")
            self.conflict_detector.conflicts.append(conflict)
        self.history_log = data.get("history_log", [])
        self.session_name = data.get("session_name", "")
        if data.get("created_time"):
            self.created_time = datetime.fromisoformat(data["created_time"])
        self.self_checker.imported_record_ids = set()
        for r in self.sampling_records:
            self.self_checker.imported_record_ids.add(r.record_id)
        if data.get("self_check_results"):
            for key in self.self_checker.check_results:
                self.self_checker.check_results[key] = data["self_check_results"].get(key, [])
        self._rebuild_all_links()
        self._log_action("恢复会话", None, {"filepath": filepath, "session_name": self.session_name})
        return {"success": True, "filepath": filepath, "records_count": len(self.sampling_records)}

    def step1_import_sampling_record(self, record_data: dict) -> dict:
        record_id = record_data["record_id"]
        is_supplementary = record_data.get("is_supplementary", False)
        original_record_id = record_data.get("original_record_id")

        existing = self._get_record(record_id)
        if existing is not None and not is_supplementary:
            dup_result = {
                "record_id": record_id,
                "check_time": datetime.now().isoformat(),
                "issue": "重复导入",
                "details": f"记录ID [{record_id}] 已存在于系统中，已拦截"
            }
            self.self_checker.check_results["duplicate_import"].append(dup_result)
            self._log_action("拦截重复导入", record_id, {
                "attempted_data": record_data,
                "existing_status": existing.status.value,
                "existing_version": existing.version
            })
            return {
                "step": 1,
                "action": "重复导入已拦截",
                "success": False,
                "record_id": record_id,
                "status": existing.status.value,
                "check_issues": [
                    f"记录ID [{record_id}] 已存在，拒绝重复导入。当前状态：{existing.status.value}，版本：v{existing.version}",
                    dup_result["details"]
                ],
                "conflict_found": False,
                "needs_attention": True,
                "version": existing.version,
                "is_duplicate": True,
                "existing_record_link": record_id,
                "links": {
                    "conflicts": existing.related_conflict_ids,
                    "calibrations": existing.related_calibration_ids,
                    "reminders": existing.related_reminder_ids,
                    "supplementary": existing.supplementary_ids
                }
            }

        original_interval = record_data.get("sampling_interval")
        record = SamplingRecord(
            record_id=record_id,
            ship_id=record_data["ship_id"],
            sensor_id=record_data["sensor_id"],
            sampling_interval=original_interval,
            sampling_start_time=datetime.fromisoformat(record_data["sampling_start_time"]),
            sampling_end_time=datetime.fromisoformat(record_data["sampling_end_time"]),
            roll_periods=record_data["roll_periods"],
            import_time=datetime.now(),
            import_user=record_data.get("import_user", "system"),
            is_supplementary=is_supplementary,
            original_record_id=original_record_id,
            original_sampling_interval=original_interval
        )

        check_issues = self.self_checker.run_all_checks(record)

        conflict = self.conflict_detector.check_sampling_interval_conflict(
            record, self.calibration_records
        )

        self.sampling_records.append(record)
        self._sync_record_links(record)

        est_before = None
        est_after = None
        if is_supplementary and original_record_id:
            orig = self._get_record(original_record_id)
            if orig:
                est_before = self._get_latest_estimate(orig.ship_id)
                if record.record_id not in orig.supplementary_ids:
                    orig.supplementary_ids.append(record.record_id)
                orig.status = RecordStatus.SUPPLEMENTED
                orig.last_modified_time = datetime.now()
                orig.version += 1
                est_after_result = self.calculate_roll_period_estimate(orig.ship_id, "系统-补录自动重算")
                est_after = est_after_result["average_period"]
                if est_before is not None:
                    self.self_checker.check_supplementary_recalc(
                        record, orig, est_before, est_after
                    )
                    self._log_action("补录自动重算", original_record_id, {
                        "supplementary_id": record_id,
                        "estimate_before": est_before,
                        "estimate_after": est_after,
                        "difference": abs(est_after - est_before)
                    })

        self._log_action("导入采样记录", record.record_id, {
            "check_issues": check_issues,
            "has_conflict": conflict is not None,
            "initial_status": record.status.value,
            "is_supplementary": is_supplementary,
            "original_record_id": original_record_id,
            "estimate_before": est_before,
            "estimate_after": est_after
        })

        result = {
            "step": 1,
            "action": "采样记录导入完成",
            "success": True,
            "record_id": record.record_id,
            "status": record.status.value,
            "check_issues": check_issues,
            "conflict_found": conflict is not None,
            "conflict_details": conflict.description if conflict else None,
            "needs_attention": record.status in [RecordStatus.CONFLICT, RecordStatus.PENDING_REVIEW],
            "version": record.version,
            "is_supplementary": is_supplementary,
            "original_record_id": original_record_id,
            "links": {
                "conflicts": record.related_conflict_ids,
                "calibrations": record.related_calibration_ids,
                "reminders": record.related_reminder_ids,
                "supplementary": record.supplementary_ids
            }
        }
        if est_before is not None and est_after is not None:
            result["supplementary_recalc"] = {
                "estimate_before": est_before,
                "estimate_after": est_after,
                "difference": abs(est_after - est_before)
            }
        return result

    def _get_latest_estimate(self, ship_id: str) -> Optional[float]:
        ship_estimates = [e for e in self.estimates if e.ship_id == ship_id]
        if not ship_estimates:
            return None
        latest = max(ship_estimates, key=lambda e: e.calculated_time or datetime.min)
        return latest.average_period

    def step2_import_calibration_and_check(self, calibration_data: dict) -> dict:
        calibration = TemperatureCalibration(
            calibration_id=calibration_data["calibration_id"],
            ship_id=calibration_data["ship_id"],
            sensor_id=calibration_data["sensor_id"],
            calibration_time=datetime.fromisoformat(calibration_data["calibration_time"]),
            effective_sampling_interval=calibration_data["effective_sampling_interval"],
            calibration_temperature=calibration_data["calibration_temperature"],
            operator=calibration_data.get("operator", "system"),
            remarks=calibration_data.get("remarks", "")
        )
        
        self.calibration_records.append(calibration)
        
        conflicts = []
        for record in self.sampling_records:
            if (record.ship_id == calibration.ship_id 
                and record.sensor_id == calibration.sensor_id
                and record.status == RecordStatus.NORMAL):
                conflict = self.conflict_detector.check_sampling_interval_conflict(
                    record, self.calibration_records
                )
                if conflict:
                    conflicts.append({
                        "record_id": record.record_id,
                        "conflict_id": conflict.conflict_id,
                        "description": conflict.description,
                        "sampling_value": conflict.sampling_value,
                        "calibration_value": conflict.calibration_value
                    })
                    if record.record_id not in calibration.related_sampling_record_ids:
                        calibration.related_sampling_record_ids.append(record.record_id)
                    if conflict.conflict_id not in calibration.affected_conflict_ids:
                        calibration.affected_conflict_ids.append(conflict.conflict_id)
                    conflict.original_status = record.status.value
                    record.related_calibration_ids.append(calibration.calibration_id)
                    record.related_conflict_ids.append(conflict.conflict_id)
                    record.last_modified_time = datetime.now()
                    record.version += 1
                    self._log_action("校准触发冲突", record.record_id, {
                        "conflict_id": conflict.conflict_id,
                        "calibration_id": calibration.calibration_id,
                        "old_status": conflict.original_status,
                        "new_status": record.status.value,
                        "sampling_value": conflict.sampling_value,
                        "calibration_value": conflict.calibration_value
                    })
        
        self._log_action("导入温度校准记录", None, {
            "calibration_id": calibration.calibration_id,
            "new_conflicts_count": len(conflicts),
            "affected_records": [c["record_id"] for c in conflicts]
        })
        
        return {
            "step": 2,
            "action": "温度校准记录导入完成",
            "calibration_id": calibration.calibration_id,
            "new_conflicts_found": len(conflicts),
            "conflicts": conflicts,
            "message": f"发现 {len(conflicts)} 条记录与校准数据冲突，请质检员确认",
            "affected_record_ids": [c["record_id"] for c in conflicts]
        }

    def correct_sampling_interval(
        self,
        record_id: str,
        new_interval: float,
        correction_reason: str,
        corrected_by: str,
        next_handler: str = "安全员复核"
    ) -> dict:
        record = self._get_record(record_id)
        if not record:
            return {"success": False, "message": "记录不存在"}
        
        old_interval = record.sampling_interval
        old_status = record.status.value
        
        record.original_sampling_interval = old_interval
        record.sampling_interval = new_interval
        record.correction_reason = correction_reason
        record.next_handler = next_handler
        record.status = RecordStatus.CORRECTED
        record.last_modified_time = datetime.now()
        record.version += 1
        
        review = ReviewInfo(
            original_value=old_interval,
            corrected_value=new_interval,
            field_name="sampling_interval",
            reason=correction_reason,
            next_handler=next_handler,
            handled_by=corrected_by,
            handled_time=datetime.now()
        )
        record.add_review_info(review)
        
        self._log_action("修正采样间隔", record_id, {
            "old_interval": old_interval,
            "new_interval": new_interval,
            "old_status": old_status,
            "new_status": record.status.value,
            "reason": correction_reason,
            "corrected_by": corrected_by,
            "next_handler": next_handler,
            "version": record.version
        })
        
        return {
            "success": True,
            "record_id": record_id,
            "original_value": old_interval,
            "corrected_value": new_interval,
            "reason": correction_reason,
            "corrected_by": corrected_by,
            "next_handler": next_handler,
            "new_status": record.status.value,
            "version": record.version,
            "warning": "记录状态已改为【已修正】，未归入正常结果，需下一步处理"
        }

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: str,
        resolved_by: str,
        handler_after: str = "",
        correct_value: Optional[float] = None
    ) -> dict:
        conflict = next(
            (c for c in self.conflict_detector.conflicts if c.conflict_id == conflict_id),
            None
        )
        
        if not conflict:
            return {"success": False, "message": "冲突记录不存在"}
        
        record = self._get_record(conflict.sampling_record_id)
        old_status = record.status.value if record else None
        
        conflict.original_status = old_status
        
        self.conflict_detector.resolve_conflict(conflict_id, resolution, resolved_by)
        
        review_result = ""
        if record:
            if correct_value is not None:
                old_interval = record.sampling_interval
                record.original_sampling_interval = old_interval
                record.sampling_interval = correct_value
                record.next_handler = handler_after or "安全员归档"
                record.status = RecordStatus.CORRECTED
                review = ReviewInfo(
                    original_value=old_interval,
                    corrected_value=correct_value,
                    field_name="sampling_interval",
                    reason=f"冲突处理：{resolution}",
                    next_handler=record.next_handler,
                    handled_by=resolved_by,
                    handled_time=datetime.now(),
                    result=resolution
                )
                record.add_review_info(review)
                review_result = f"采样间隔已从{old_interval}s修正为{correct_value}s"
            elif "确认" in resolution or "以采样记录为准" in resolution:
                record.status = RecordStatus.CONFIRMED
                record.next_handler = handler_after or "安全员归档"
                review_result = "以采样记录为准，状态确认"
            elif "驳回" in resolution or "以校准数据为准" in resolution:
                record.status = RecordStatus.REJECTED
                record.next_handler = handler_after or "退回数据提供方"
                review_result = "以校准数据为准，记录驳回"
            else:
                record.next_handler = handler_after or "继续跟进"
            record.last_modified_time = datetime.now()
            record.version += 1
            conflict.corrected_status = record.status.value
            conflict.result_summary = review_result
            conflict.handler_after_resolve = record.next_handler
        
        self._log_action("冲突处理", conflict.sampling_record_id, {
            "conflict_id": conflict_id,
            "resolution": resolution,
            "resolved_by": resolved_by,
            "old_status": old_status,
            "new_status": conflict.corrected_status,
            "correct_value": correct_value,
            "handler_after": handler_after,
            "result_summary": review_result
        })
        
        return {
            "success": True,
            "conflict_id": conflict_id,
            "record_id": conflict.sampling_record_id,
            "resolution": resolution,
            "resolved_by": resolved_by,
            "original_status": conflict.original_status,
            "record_new_status": conflict.corrected_status,
            "next_handler": conflict.handler_after_resolve,
            "result_summary": review_result,
            "manual_review_needed": conflict.corrected_status not in [RecordStatus.CONFIRMED.value, RecordStatus.NORMAL.value]
        }

    def step3_update_safety_reminders(self, operator: str) -> dict:
        old_reminders_count = len(self.safety_reminders)
        
        for record in self.sampling_records:
            if record.status == RecordStatus.PENDING_REVIEW:
                existing = any(r.related_record_id == record.record_id for r in self.safety_reminders)
                if not existing:
                    reminder = SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=record.record_id,
                        level="高",
                        title="传感器编号变更待复核",
                        content=f"船舶[{record.ship_id}]传感器编号从[{record.previous_sensor_id}]变为[{record.sensor_id}]，疑似重启，请安全员复核是否正常。当前采样间隔为{record.sampling_interval}s，版本{record.version}。",
                        created_time=datetime.now(),
                        reminder_type="sensor_restart",
                        next_step="联系安全员王五现场确认传感器状态",
                        original_value=record.previous_sensor_id,
                        current_value=record.sensor_id
                    )
                    self.safety_reminders.append(reminder)
                    record.related_reminder_ids.append(reminder.reminder_id)
        
        for conflict in self.conflict_detector.conflicts:
            if not conflict.resolved:
                existing = any(r.related_record_id == conflict.sampling_record_id and r.related_conflict_id == conflict.conflict_id for r in self.safety_reminders)
                if not existing:
                    reminder = SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=conflict.sampling_record_id,
                        level="中",
                        title="采样间隔冲突待确认",
                        content=conflict.description,
                        created_time=datetime.now(),
                        related_conflict_id=conflict.conflict_id,
                        reminder_type="interval_conflict",
                        next_step="联系质检员小白确认采用哪个间隔值",
                        original_value=conflict.sampling_value,
                        current_value=conflict.calibration_value
                    )
                    self.safety_reminders.append(reminder)
                    conflict.reminder_id = reminder.reminder_id
                    record = self._get_record(conflict.sampling_record_id)
                    if record and reminder.reminder_id not in record.related_reminder_ids:
                        record.related_reminder_ids.append(reminder.reminder_id)
        
        for record in self.sampling_records:
            if record.status == RecordStatus.CORRECTED and record.next_handler:
                existing = any(r.related_record_id == record.record_id and r.reminder_type == "corrected" for r in self.safety_reminders)
                if not existing:
                    last_review = record.review_infos[-1] if record.review_infos else None
                    reminder = SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=record.record_id,
                        level="中",
                        title="记录已修正待后续处理",
                        content=f"采样间隔已从{last_review.original_value if last_review else ''}修正为{last_review.corrected_value if last_review else record.sampling_interval}s，原因：{record.correction_reason}，下一步处理：{record.next_handler}",
                        created_time=datetime.now(),
                        reminder_type="corrected",
                        next_step=record.next_handler,
                        original_value=last_review.original_value if last_review else None,
                        current_value=last_review.corrected_value if last_review else record.sampling_interval
                    )
                    self.safety_reminders.append(reminder)
                    record.related_reminder_ids.append(reminder.reminder_id)
        
        new_reminders_count = len(self.safety_reminders) - old_reminders_count
        
        self._log_action("更新安全提醒", None, {
            "operator": operator,
            "new_reminders": new_reminders_count,
            "total_pending": sum(1 for r in self.safety_reminders if not r.reviewed)
        })
        
        return {
            "step": 3,
            "action": "安全提醒更新完成",
            "operator": operator,
            "new_reminders_added": new_reminders_count,
            "total_pending_reminders": sum(1 for r in self.safety_reminders if not r.reviewed),
            "reminders": [
                {
                    "id": r.reminder_id,
                    "level": r.level,
                    "title": r.title,
                    "content": r.content,
                    "related_record": r.related_record_id,
                    "related_conflict": r.related_conflict_id,
                    "reviewed": r.reviewed,
                    "reminder_type": r.reminder_type,
                    "next_step": r.next_step,
                    "original_value": r.original_value,
                    "current_value": r.current_value
                }
                for r in self.safety_reminders
            ]
        }

    def review_safety_reminder(self, reminder_id: str, reviewed_by: str, is_approved: bool, review_note: str = "") -> dict:
        reminder = self._get_reminder(reminder_id)
        
        if not reminder:
            return {"success": False, "message": "提醒不存在"}
        
        reminder.reviewed = True
        reminder.reviewed_by = reviewed_by
        reminder.reviewed_time = datetime.now()
        
        record = self._get_record(reminder.related_record_id)
        old_status = record.status.value if record else None
        
        if record:
            if is_approved:
                if record.status == RecordStatus.PENDING_REVIEW:
                    record.status = RecordStatus.NORMAL
                    record.remarks += f"安全员复核通过：{review_note or '传感器变更已现场确认正常'}；"
                elif record.status == RecordStatus.CORRECTED:
                    record.remarks += f"安全员复核修正结果通过：{review_note}；"
                    record.status = RecordStatus.CONFIRMED
                elif record.status == RecordStatus.CONFLICT:
                    pass
            else:
                record.remarks += f"安全员复核不通过：{review_note}；"
                record.next_handler = "退回数据提供方重新采集"
            
            if reminder.reminder_type == "sensor_restart":
                record.last_modified_time = datetime.now()
                record.version += 1
                review = ReviewInfo(
                    original_value=record.previous_sensor_id,
                    corrected_value=record.sensor_id,
                    field_name="sensor_id",
                    reason="传感器重启后编号变更",
                    next_handler="归档" if is_approved else record.next_handler,
                    handled_by=reviewed_by,
                    handled_time=datetime.now(),
                    result="通过" if is_approved else "不通过"
                )
                record.add_review_info(review)
        
        self._log_action("安全员复核", reminder.related_record_id, {
            "reminder_id": reminder_id,
            "reviewed_by": reviewed_by,
            "is_approved": is_approved,
            "review_note": review_note,
            "old_status": old_status,
            "new_status": record.status.value if record else None,
            "reminder_type": reminder.reminder_type
        })
        
        return {
            "success": True,
            "reminder_id": reminder_id,
            "reviewed_by": reviewed_by,
            "is_approved": is_approved,
            "record_id": reminder.related_record_id,
            "old_status": old_status,
            "record_new_status": record.status.value if record else None,
            "next_action": record.next_handler if record else "",
            "still_pending": record.status.value not in [RecordStatus.NORMAL.value, RecordStatus.CONFIRMED.value] if record else False
        }

    def calculate_roll_period_estimate(self, ship_id: str, calculated_by: str) -> dict:
        all_ship_records = [r for r in self.sampling_records if r.ship_id == ship_id]
        valid_statuses = [RecordStatus.NORMAL, RecordStatus.CONFIRMED, RecordStatus.CORRECTED, RecordStatus.SUPPLEMENTED]
        ship_records = [r for r in all_ship_records if r.status in valid_statuses]
        
        excluded_by_status = [
            {
                "record_id": r.record_id,
                "status": r.status.value,
                "reason": f"状态为{r.status.value}，未纳入计算（需先处理冲突/复核）"
            }
            for r in all_ship_records if r.status not in valid_statuses
        ]

        estimate = RollPeriodEstimate(
            estimate_id=str(uuid.uuid4()),
            ship_id=ship_id,
            sampling_records=[r.record_id for r in ship_records]
        )
        estimate.calculate(ship_records)
        estimate.calculated_by = calculated_by

        for exc in excluded_by_status:
            if not any(e.get("record_id") == exc["record_id"] for e in estimate.excluded_records):
                estimate.excluded_records.append(exc)

        self.estimates.append(estimate)

        for r in ship_records:
            r.last_modified_time = datetime.now()

        self._log_action("计算横摇周期", None, {
            "ship_id": ship_id,
            "records_used": len(ship_records),
            "used_record_ids": [r.record_id for r in ship_records],
            "excluded_records": estimate.excluded_records,
            "average_period": round(estimate.average_period, 4)
        })

        return {
            "estimate_id": estimate.estimate_id,
            "ship_id": ship_id,
            "average_period": round(estimate.average_period, 4),
            "period_variance": round(estimate.period_variance, 6),
            "records_used": len(ship_records),
            "used_record_ids": [r.record_id for r in ship_records],
            "excluded_records": estimate.excluded_records,
            "calculated_time": estimate.calculated_time.isoformat() if estimate.calculated_time else None
        }

    def export_record(self, record_id: str, include_history: bool = True) -> dict:
        record = self._get_record(record_id)
        if not record:
            return {"success": False, "message": "记录不存在"}
        
        export_data = record.to_dict()
        export_id = f"export_{record_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        is_issue, msg = self.self_checker.check_export_consistency(record, export_data, export_id)
        
        related_conflicts = [
            {"conflict_id": c.conflict_id, "calibration_id": c.calibration_id,
             "description": c.description, "resolved": c.resolved,
             "resolution": c.resolution}
            for c in self.conflict_detector.conflicts
            if c.sampling_record_id == record_id
        ]
        
        related_reminders = [
            {"reminder_id": r.reminder_id, "level": r.level, "title": r.title,
             "reviewed": r.reviewed, "next_step": r.next_step}
            for r in self.safety_reminders
            if r.related_record_id == record_id
        ]
        
        related_calibrations = [
            {"calibration_id": c.calibration_id, "effective_sampling_interval": c.effective_sampling_interval,
             "calibration_temperature": c.calibration_temperature}
            for c in self.calibration_records
            if record_id in c.related_sampling_record_ids
        ]
        
        history = self.get_history(record_id) if include_history else []
        supplementaries = [r.to_dict() for r in self.sampling_records if r.original_record_id == record_id]
        
        export_package = {
            "export_id": export_id,
            "export_time": datetime.now().isoformat(),
            "consistency_check": msg,
            "consistent": not is_issue,
            "record_detail": export_data,
            "related_conflicts": related_conflicts,
            "related_calibrations": related_calibrations,
            "related_reminders": related_reminders,
            "supplementary_records": supplementaries,
            "history_log": history
        }
        
        self._log_action("导出记录", record_id, {
            "export_id": export_id,
            "consistent": not is_issue,
            "include_history": include_history
        })
        
        return {"success": True, "data": export_package}

    def get_record_detail(self, record_id: str) -> dict:
        record = self._get_record(record_id)
        if not record:
            return {"success": False, "message": "记录不存在"}
        
        related_conflicts = [
            {
                "conflict_id": c.conflict_id,
                "calibration_id": c.calibration_id,
                "type": c.conflict_type,
                "description": c.description,
                "sampling_value": c.sampling_value,
                "calibration_value": c.calibration_value,
                "resolved": c.resolved,
                "resolution": c.resolution,
                "original_status": c.original_status,
                "corrected_status": c.corrected_status,
                "next_handler": c.handler_after_resolve,
                "result_summary": c.result_summary
            }
            for c in self.conflict_detector.conflicts
            if c.sampling_record_id == record_id
        ]
        
        related_reminders = [
            {
                "reminder_id": r.reminder_id,
                "level": r.level,
                "title": r.title,
                "content": r.content,
                "reviewed": r.reviewed,
                "reviewed_by": r.reviewed_by,
                "type": r.reminder_type,
                "next_step": r.next_step,
                "original_value": r.original_value,
                "current_value": r.current_value
            }
            for r in self.safety_reminders
            if r.related_record_id == record_id
        ]
        
        related_calibrations = [c.to_dict() for c in self.calibration_records if record_id in c.related_sampling_record_ids]
        supplementary_records = [r.to_dict() for r in self.sampling_records if r.original_record_id == record_id]
        original_record = self._get_record(record.original_record_id).to_dict() if record.original_record_id else None

        latest_est = self._get_latest_estimate(record.ship_id)
        supp_recalc_history = []
        for sr in self.self_checker.check_results["supplementary_recalc"]:
            if sr.get("original_id") == record_id:
                supp_recalc_history.append({
                    "supplementary_id": sr["record_id"],
                    "check_time": sr["check_time"],
                    "estimate_before": sr["estimate_before"],
                    "estimate_after": sr["estimate_after"],
                    "difference": sr["difference"],
                    "has_significant_change": sr["has_significant_change"],
                    "details": sr["details"]
                })

        return {
            "success": True,
            "record_id": record_id,
            "summary": {
                "current_status": record.status.value,
                "sensor_status": record.sensor_status.value,
                "version": record.version,
                "is_supplementary": record.is_supplementary,
                "has_conflicts": len(related_conflicts) > 0,
                "pending_reminders": sum(1 for r in related_reminders if not r["reviewed"]),
                "supplementaries_count": len(supplementary_records),
                "supplementary_recalc_count": len(supp_recalc_history),
                "current_roll_period_estimate": latest_est,
                "supplementary_recalc_has_issues": any(s["has_significant_change"] for s in supp_recalc_history)
            },
            "basic_info": {
                "record_id": record.record_id,
                "ship_id": record.ship_id,
                "sensor_id": record.sensor_id,
                "previous_sensor_id": record.previous_sensor_id,
                "sampling_start_time": record.sampling_start_time.isoformat(),
                "sampling_end_time": record.sampling_end_time.isoformat(),
                "import_time": record.import_time.isoformat(),
                "import_user": record.import_user,
                "last_modified_time": record.last_modified_time.isoformat() if record.last_modified_time else None,
                "last_modified_by": record.last_modified_by
            },
            "sampling_values": {
                "declared_interval": record.sampling_interval,
                "original_declared_interval": record.original_sampling_interval,
                "roll_periods": record.roll_periods,
                "remarks": record.remarks
            },
            "review_infos": [
                {
                    "field": ri.field_name,
                    "original_value": ri.original_value,
                    "corrected_value": ri.corrected_value,
                    "reason": ri.reason,
                    "handled_by": ri.handled_by,
                    "handled_time": ri.handled_time.isoformat() if ri.handled_time else None,
                    "next_handler": ri.next_handler,
                    "result": ri.result
                }
                for ri in record.review_infos
            ],
            "status_tracking": {
                "current_status": record.status.value,
                "correction_reason": record.correction_reason,
                "next_handler": record.next_handler,
                "needs_manual_review": record.status in [RecordStatus.CONFLICT, RecordStatus.PENDING_REVIEW, RecordStatus.CORRECTED]
            },
            "related_conflicts": related_conflicts,
            "related_calibrations": related_calibrations,
            "related_reminders": related_reminders,
            "original_record": original_record,
            "supplementary_records": supplementary_records,
            "supplementary_recalc_history": supp_recalc_history,
            "links": {
                "conflict_ids": record.related_conflict_ids,
                "calibration_ids": record.related_calibration_ids,
                "reminder_ids": record.related_reminder_ids,
                "supplementary_ids": record.supplementary_ids,
                "original_record_id": record.original_record_id
            },
            "history": self.get_history(record_id)
        }

    def get_history(self, record_id: Optional[str] = None) -> List[dict]:
        if record_id:
            return [log for log in self.history_log if log.get("record_id") == record_id]
        return self.history_log.copy()

    def get_dashboard(self) -> dict:
        all_record_ids = [r.record_id for r in self.sampling_records]
        pending = sum(1 for r in self.safety_reminders if not r.reviewed)
        pending_by_type = {}
        for r in self.safety_reminders:
            if not r.reviewed:
                t = r.reminder_type or "other"
                pending_by_type[t] = pending_by_type.get(t, 0) + 1
        
        return {
            "overview": {
                "session_name": self.session_name,
                "created_time": self.created_time.isoformat(),
                "total_sampling_records": len(self.sampling_records),
                "total_calibration_records": len(self.calibration_records),
                "total_estimates": len(self.estimates),
                "total_history_entries": len(self.history_log)
            },
            "status_breakdown": {
                "正常": sum(1 for r in self.sampling_records if r.status == RecordStatus.NORMAL),
                "冲突待确认": sum(1 for r in self.sampling_records if r.status == RecordStatus.CONFLICT),
                "待安全员复核": sum(1 for r in self.sampling_records if r.status == RecordStatus.PENDING_REVIEW),
                "已修正": sum(1 for r in self.sampling_records if r.status == RecordStatus.CORRECTED),
                "已补录": sum(1 for r in self.sampling_records if r.status == RecordStatus.SUPPLEMENTED),
                "已确认": sum(1 for r in self.sampling_records if r.status == RecordStatus.CONFIRMED),
                "已驳回": sum(1 for r in self.sampling_records if r.status == RecordStatus.REJECTED)
            },
            "safety_reminders": {
                "total": len(self.safety_reminders),
                "pending": pending,
                "pending_by_type": pending_by_type,
                "reviewed": len(self.safety_reminders) - pending
            },
            "conflicts": {
                "total": len(self.conflict_detector.conflicts),
                "resolved": sum(1 for c in self.conflict_detector.conflicts if c.resolved),
                "unresolved": sum(1 for c in self.conflict_detector.conflicts if not c.resolved)
            },
            "self_check": {
                "summary": self.self_checker.get_check_summary(),
                "detailed_results": self.self_checker.get_all_results()
            },
            "record_list_snippet": [
                {
                    "record_id": r.record_id,
                    "ship_id": r.ship_id,
                    "sensor_id": r.sensor_id,
                    "status": r.status.value,
                    "version": r.version,
                    "pending_reminders": sum(1 for rem in self.safety_reminders if rem.related_record_id == r.record_id and not rem.reviewed),
                    "unresolved_conflicts": sum(1 for c in self.conflict_detector.conflicts if c.sampling_record_id == r.record_id and not c.resolved)
                }
                for r in self.sampling_records
            ]
        }
