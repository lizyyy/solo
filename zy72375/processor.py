import uuid
import json
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from models import (
    SensorRecord,
    PhotoRecord,
    UniformZoneRecord,
    ProcessingStatus,
    ChangeType,
)
from rules import BoundaryRuleEngine
from history import HistoryManager


class UniformZoneProcessor:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.sensor_records: Dict[str, SensorRecord] = {}
        self.photo_records: Dict[str, PhotoRecord] = {}
        self.uniform_zone_records: Dict[str, UniformZoneRecord] = {}
        self.existing_keys: set = set()
        self.rule_engine = BoundaryRuleEngine()
        self.history_manager = HistoryManager(os.path.join(data_dir, "history.json"))
        self._load()

    def _load(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for fname, store in [
            ("sensors.json", self.sensor_records),
            ("photos.json", self.photo_records),
            ("uniform_zones.json", self.uniform_zone_records),
        ]:
            path = os.path.join(self.data_dir, fname)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        if fname == "sensors.json":
                            rec = SensorRecord(
                                sensor_id=item["sensor_id"],
                                original_line_number=item["original_line_number"],
                                raw_data=item.get("raw_data", {}),
                                source_file=item["source_file"],
                                import_batch_id=item["import_batch_id"],
                                temperature_value=item.get("temperature_value"),
                                temperature_unit=item.get("temperature_unit"),
                                uniform_zone_flag=item.get("uniform_zone_flag"),
                                processing_status=ProcessingStatus(item["processing_status"]),
                                manual_edits=item.get("manual_edits", []),
                                created_at=item.get("created_at", datetime.now().isoformat()),
                            )
                            store[rec.get_unique_key()] = rec
                            self.existing_keys.add(rec.get_unique_key())
                        elif fname == "photos.json":
                            rec = PhotoRecord(
                                photo_id=item["photo_id"],
                                scene_description=item["scene_description"],
                                source_file=item["source_file"],
                                upload_time=item["upload_time"],
                                related_sensor_ids=item.get("related_sensor_ids", []),
                                reviewer=item.get("reviewer"),
                                review_notes=item.get("review_notes"),
                                is_late_arrival=item.get("is_late_arrival", False),
                                created_at=item.get("created_at", datetime.now().isoformat()),
                            )
                            store[rec.photo_id] = rec
                        elif fname == "uniform_zones.json":
                            rec = UniformZoneRecord(
                                uniform_zone_id=item["uniform_zone_id"],
                                sensor_id=item["sensor_id"],
                                sensor_record_key=item["sensor_record_key"],
                                original_line_number=item["original_line_number"],
                                source_file=item["source_file"],
                                temperature_value=item.get("temperature_value"),
                                temperature_unit=item.get("temperature_unit"),
                                uniform_zone_flag=item.get("uniform_zone_flag"),
                                processing_status=ProcessingStatus(item["processing_status"]),
                                related_photo_ids=item.get("related_photo_ids", []),
                                review_notes=item.get("review_notes"),
                                manual_annotation=item.get("manual_annotation"),
                                has_mixed_temp_units=item.get("has_mixed_temp_units", False),
                                coach_review_required=item.get("coach_review_required", False),
                                history_ids=item.get("history_ids", []),
                                created_at=item.get("created_at", datetime.now().isoformat()),
                                last_updated_at=item.get("last_updated_at", datetime.now().isoformat()),
                                import_batch_id=item.get("import_batch_id"),
                            )
                            store[rec.uniform_zone_id] = rec
            except FileNotFoundError:
                pass

    def _save(self):
        with open(os.path.join(self.data_dir, "sensors.json"), "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self.sensor_records.values()], f, ensure_ascii=False, indent=2)
        with open(os.path.join(self.data_dir, "photos.json"), "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self.photo_records.values()], f, ensure_ascii=False, indent=2)
        with open(os.path.join(self.data_dir, "uniform_zones.json"), "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self.uniform_zone_records.values()], f, ensure_ascii=False, indent=2)

    def _generate_batch_id(self) -> str:
        return f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def step1_import_sensors(
        self,
        sensor_data_list: List[Dict[str, Any]],
        source_file: str,
        operator: Optional[str] = None,
    ) -> Dict[str, Any]:
        batch_id = self._generate_batch_id()
        imported_count = 0
        duplicate_count = 0
        updated_count = 0
        new_uniform_zone_ids: List[str] = []
        temp_check_records: List[Dict[str, Any]] = []

        for idx, data in enumerate(sensor_data_list, start=1):
            sensor_id = data.get("sensor_id")
            if not sensor_id:
                continue

            raw_data = data.get("raw_data", data)
            temp_value = data.get("temperature_value")
            temp_unit = data.get("temperature_unit")
            uniform_zone_flag = data.get("uniform_zone_flag")

            sensor_rec = SensorRecord(
                sensor_id=sensor_id,
                original_line_number=data.get("original_line_number", idx),
                raw_data=raw_data,
                source_file=source_file,
                import_batch_id=batch_id,
                temperature_value=temp_value,
                temperature_unit=temp_unit,
                uniform_zone_flag=uniform_zone_flag,
                processing_status=ProcessingStatus.IMPORTED,
            )

            key = sensor_rec.get_unique_key()
            command = (
                f"python3 main.py import-sensors --source {source_file} "
                f"--sensor-id {sensor_id} --line {sensor_rec.original_line_number}"
            )

            if key in self.existing_keys:
                duplicate_count += 1
                existing_sensor = self.sensor_records[key]
                existing_uz_id = self._find_uniform_zone_by_key(key)

                if existing_uz_id:
                    uz = self.uniform_zone_records[existing_uz_id]
                    before = uz.to_dict()
                    rule_result = self.rule_engine.execute_rule(
                        "DUPLICATE_001",
                        uz,
                        operator=operator,
                        new_raw_data=raw_data,
                        old_raw_data=existing_sensor.raw_data,
                        new_batch_id=batch_id,
                        manual_edits=existing_sensor.manual_edits,
                    )
                    after = uz.to_dict()

                    if "raw_data_updated" in rule_result["changes_applied"]:
                        updated_count += 1

                    history_entry = self.history_manager.create_entry(
                        uniform_zone_id=existing_uz_id,
                        change_type=ChangeType.MANUAL_EDIT,
                        before_value=before,
                        after_value=after,
                        operator=operator,
                        reason=f"重复导入处理，批次: {batch_id}",
                        evidence_ref=f"source_file={source_file}, line={sensor_rec.original_line_number}",
                        command_used=command,
                    )
                    uz.history_ids.append(history_entry.entry_id)
                    uz.last_updated_at = datetime.now().isoformat()

                existing_sensor.raw_data = raw_data
                existing_sensor.import_batch_id = batch_id
            else:
                imported_count += 1
                self.sensor_records[key] = sensor_rec
                self.existing_keys.add(key)

                uz_id = str(uuid.uuid4())
                uz = UniformZoneRecord(
                    uniform_zone_id=uz_id,
                    sensor_id=sensor_id,
                    sensor_record_key=key,
                    original_line_number=sensor_rec.original_line_number,
                    source_file=source_file,
                    temperature_value=temp_value,
                    temperature_unit=temp_unit,
                    uniform_zone_flag=uniform_zone_flag,
                    processing_status=ProcessingStatus.IMPORTED,
                    import_batch_id=batch_id,
                )
                self.uniform_zone_records[uz_id] = uz
                new_uniform_zone_ids.append(uz_id)

                history_entry = self.history_manager.create_entry(
                    uniform_zone_id=uz_id,
                    change_type=ChangeType.IMPORT,
                    before_value=None,
                    after_value=uz.to_dict(),
                    operator=operator,
                    reason=f"首次导入，批次: {batch_id}",
                    evidence_ref=f"source_file={source_file}, line={sensor_rec.original_line_number}",
                    command_used=command,
                )
                uz.history_ids.append(history_entry.entry_id)

                temp_check_records.append({
                    "sensor_id": sensor_id,
                    "uniform_zone_id": uz_id,
                    "temperature_value": temp_value,
                    "temperature_unit": temp_unit,
                })

        mixed_results = self.rule_engine.check_temperature_mix(temp_check_records)
        for mr in mixed_results:
            uz_id = mr.get("uniform_zone_id")
            if uz_id and uz_id in self.uniform_zone_records:
                uz = self.uniform_zone_records[uz_id]
                before = uz.to_dict()
                issue = mr.get("issue", "")
                if "单位混用" in issue:
                    rule_id = "TEMP_MIX_001"
                    details = f"发现单位混用情况: {mr.get('units_found', [])}。请训练教练复核"
                else:
                    rule_id = "TEMP_MIX_002"
                    details = issue

                rule_result = self.rule_engine.execute_rule(
                    rule_id,
                    uz,
                    operator="系统",
                    mixed_details=details,
                    anomaly_details=details,
                )
                after = uz.to_dict()

                command = (
                    f"python3 main.py check-temperature --uz-id {uz_id}"
                )

                history_entry = self.history_manager.create_entry(
                    uniform_zone_id=uz_id,
                    change_type=ChangeType.MANUAL_EDIT,
                    before_value=before,
                    after_value=after,
                    operator="系统",
                    reason=f"温度单位校验触发规则: {rule_id}",
                    evidence_ref=rule_id,
                    command_used=command,
                )
                uz.history_ids.append(history_entry.entry_id)
                uz.last_updated_at = datetime.now().isoformat()

        self._save()

        result_summary = (
            f"导入完成: 新增{imported_count}条, 重复{duplicate_count}条, 更新{updated_count}条。"
            f"温度单位待复核: {len(mixed_results)}条"
        )
        self.history_manager.add_audit_log(
            command="import-sensors",
            parameters={"source_file": source_file, "batch_id": batch_id},
            result_summary=result_summary,
            operator=operator,
        )

        return {
            "batch_id": batch_id,
            "imported": imported_count,
            "duplicates": duplicate_count,
            "updated": updated_count,
            "mixed_temperature_count": len(mixed_results),
            "mixed_temperature_details": mixed_results,
            "new_uniform_zone_ids": new_uniform_zone_ids,
            "summary": result_summary,
        }

    def _find_uniform_zone_by_key(self, key: str) -> Optional[str]:
        for uz_id, uz in self.uniform_zone_records.items():
            if uz.sensor_record_key == key:
                return uz_id
        return None

    def step2_review_photos(
        self,
        photo_data_list: List[Dict[str, Any]],
        operator: str = "何工",
    ) -> Dict[str, Any]:
        processed_count = 0
        late_arrival_count = 0
        updated_uz_ids: List[str] = []

        for data in photo_data_list:
            photo_id = data.get("photo_id") or str(uuid.uuid4())
            scene_description = data.get("scene_description", "")
            source_file = data.get("source_file", "")
            upload_time = data.get("upload_time", datetime.now().isoformat())
            related_sensor_ids = data.get("related_sensor_ids", [])
            review_notes = data.get("review_notes", "")
            is_late_arrival = data.get("is_late_arrival", False)

            photo_rec = PhotoRecord(
                photo_id=photo_id,
                scene_description=scene_description,
                source_file=source_file,
                upload_time=upload_time,
                related_sensor_ids=related_sensor_ids,
                reviewer=operator,
                review_notes=review_notes,
                is_late_arrival=is_late_arrival,
            )
            self.photo_records[photo_id] = photo_rec

            if is_late_arrival:
                late_arrival_count += 1

            for sensor_id in related_sensor_ids:
                uz_id = self._find_uniform_zone_by_sensor_id(sensor_id)
                if not uz_id:
                    continue

                uz = self.uniform_zone_records[uz_id]
                before = uz.to_dict()

                command = (
                    f"python3 main.py attach-photo --uz-id {uz_id} --photo-id {photo_id}"
                )

                if is_late_arrival:
                    rule_result = self.rule_engine.execute_rule(
                        "LATE_ARRIVAL_001",
                        uz,
                        operator=operator,
                        photo_id=photo_id,
                        photo_notes=f"{scene_description}. {review_notes}".strip(),
                    )
                    change_type = ChangeType.PHOTO_ATTACH
                    reason = f"晚到工况照片关联: {scene_description}"
                else:
                    if photo_id not in uz.related_photo_ids:
                        uz.related_photo_ids.append(photo_id)
                    existing_notes = uz.review_notes or ""
                    uz.review_notes = (
                        existing_notes + f"\n[照片复核][{operator}] {scene_description}: {review_notes}"
                    ).strip()
                    if uz.processing_status == ProcessingStatus.IMPORTED:
                        uz.processing_status = ProcessingStatus.PHOTO_REVIEWED
                    change_type = ChangeType.PHOTO_ATTACH
                    reason = f"工况照片复核: {scene_description}"

                after = uz.to_dict()

                history_entry = self.history_manager.create_entry(
                    uniform_zone_id=uz_id,
                    change_type=change_type,
                    before_value=before,
                    after_value=after,
                    operator=operator,
                    reason=reason,
                    evidence_ref=f"photo_id={photo_id}, source={source_file}",
                    command_used=command,
                )
                uz.history_ids.append(history_entry.entry_id)
                uz.last_updated_at = datetime.now().isoformat()

                if uz_id not in updated_uz_ids:
                    updated_uz_ids.append(uz_id)
                processed_count += 1

        self._save()

        result_summary = (
            f"照片复核完成: 处理{processed_count}条关联, 其中晚到材料{late_arrival_count}条。"
            f"涉及{len(updated_uz_ids)}个均匀区记录"
        )
        self.history_manager.add_audit_log(
            command="review-photos",
            parameters={"operator": operator, "photo_count": len(photo_data_list)},
            result_summary=result_summary,
            operator=operator,
        )

        return {
            "processed": processed_count,
            "late_arrivals": late_arrival_count,
            "updated_uniform_zone_ids": updated_uz_ids,
            "summary": result_summary,
        }

    def _find_uniform_zone_by_sensor_id(self, sensor_id: str) -> Optional[str]:
        for uz_id, uz in self.uniform_zone_records.items():
            if uz.sensor_id == sensor_id:
                return uz_id
        return None

    def step3_update_report(
        self,
        uniform_zone_ids: List[str],
        report_notes: str,
        operator: str = "何工",
    ) -> Dict[str, Any]:
        updated_count = 0
        failed_count = 0
        failed_details: List[Dict[str, Any]] = []

        for uz_id in uniform_zone_ids:
            if uz_id not in self.uniform_zone_records:
                failed_count += 1
                failed_details.append({"uz_id": uz_id, "reason": "记录不存在"})
                continue

            uz = self.uniform_zone_records[uz_id]

            if uz.coach_review_required and uz.processing_status == ProcessingStatus.TEMP_MIXED:
                failed_count += 1
                failed_details.append({
                    "uz_id": uz_id,
                    "reason": "温度单位混用待训练教练复核，不能更新交接报告",
                })
                continue

            before = uz.to_dict()

            existing_notes = uz.review_notes or ""
            uz.review_notes = (
                existing_notes + f"\n[交接报告更新][{operator}] {report_notes}"
            ).strip()
            uz.processing_status = ProcessingStatus.REPORT_UPDATED

            after = uz.to_dict()

            command = (
                f"python3 main.py update-report --uz-id {uz_id} --notes '{report_notes[:50]}...'"
            )

            history_entry = self.history_manager.create_entry(
                uniform_zone_id=uz_id,
                change_type=ChangeType.REPORT_UPDATE,
                before_value=before,
                after_value=after,
                operator=operator,
                reason=f"交接报告更新: {report_notes[:100]}",
                command_used=command,
            )
            uz.history_ids.append(history_entry.entry_id)
            uz.last_updated_at = datetime.now().isoformat()
            updated_count += 1

        self._save()

        result_summary = (
            f"交接报告更新完成: 成功{updated_count}条, 失败{failed_count}条"
        )
        self.history_manager.add_audit_log(
            command="update-report",
            parameters={"uniform_zone_ids": uniform_zone_ids},
            result_summary=result_summary,
            operator=operator,
        )

        return {
            "updated": updated_count,
            "failed": failed_count,
            "failed_details": failed_details,
            "summary": result_summary,
        }

    def coach_review_temperature(
        self,
        uniform_zone_id: str,
        target_unit: str,
        correction_mode: str,
        coach_remark: str,
        operator: str = "训练教练",
    ) -> Dict[str, Any]:
        if uniform_zone_id not in self.uniform_zone_records:
            return {"error": "记录不存在"}

        uz = self.uniform_zone_records[uniform_zone_id]

        if not uz.has_mixed_temp_units and not uz.coach_review_required:
            return {"warning": "该记录不需要温度单位复核"}

        before = uz.to_dict()
        rule_result = self.rule_engine.execute_rule(
            "TEMP_CORR_001",
            uz,
            operator=operator,
            target_unit=target_unit,
            correction_mode=correction_mode,
            coach_remark=coach_remark,
        )
        after = uz.to_dict()

        command = (
            f"python3 main.py coach-review --uz-id {uniform_zone_id} "
            f"--target-unit {target_unit} --correction-mode {correction_mode} "
            f"--remark '{coach_remark}'"
        )

        history_entry = self.history_manager.create_entry(
            uniform_zone_id=uniform_zone_id,
            change_type=ChangeType.COACH_APPROVAL,
            before_value=before,
            after_value=after,
            operator=operator,
            reason=f"温度单位复核完成: {coach_remark}",
            evidence_ref="TEMP_CORR_001",
            command_used=command,
        )
        uz.history_ids.append(history_entry.entry_id)
        uz.last_updated_at = datetime.now().isoformat()

        self._save()

        return {
            "uniform_zone_id": uniform_zone_id,
            "correction": rule_result["changes_applied"],
            "summary": "温度单位复核完成",
        }

    def manual_edit(
        self,
        uniform_zone_id: str,
        field_name: str,
        new_value: Any,
        operator: str,
        reason: str,
    ) -> Dict[str, Any]:
        if uniform_zone_id not in self.uniform_zone_records:
            return {"error": "记录不存在"}

        uz = self.uniform_zone_records[uniform_zone_id]
        before = uz.to_dict()

        if hasattr(uz, field_name):
            old_value = getattr(uz, field_name)
            setattr(uz, field_name, new_value)
        else:
            return {"error": f"字段不存在: {field_name}"}

        after = uz.to_dict()

        command = (
            f"python3 main.py manual-edit --uz-id {uniform_zone_id} "
            f"--field {field_name} --value '{new_value}' --reason '{reason}'"
        )

        history_entry = self.history_manager.create_entry(
            uniform_zone_id=uniform_zone_id,
            change_type=ChangeType.MANUAL_EDIT,
            before_value=before,
            after_value=after,
            operator=operator,
            reason=reason,
            evidence_ref=f"manual_edit: {field_name}: {old_value} -> {new_value}",
            command_used=command,
        )
        uz.history_ids.append(history_entry.entry_id)
        uz.last_updated_at = datetime.now().isoformat()

        self._save()

        return {
            "uniform_zone_id": uniform_zone_id,
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "history_entry_id": history_entry.entry_id,
        }

    def get_combined_result(self, uniform_zone_id: str) -> Dict[str, Any]:
        if uniform_zone_id not in self.uniform_zone_records:
            return {"error": "记录不存在"}

        uz = self.uniform_zone_records[uniform_zone_id]
        sensor = self.sensor_records.get(uz.sensor_record_key)
        photos = [
            self.photo_records[pid].to_dict()
            for pid in uz.related_photo_ids
            if pid in self.photo_records
        ]
        history = self.history_manager.get_uniform_zone_history(uniform_zone_id)
        audit_summary = self.history_manager.generate_audit_summary(uniform_zone_id)
        replay_commands = self.history_manager.generate_replay_commands(uniform_zone_id)
        change_comparisons = [
            self.history_manager.compare_changes(h.entry_id)
            for h in history
        ]

        return {
            "uniform_zone": uz.to_dict(),
            "sensor_evidence": sensor.to_dict() if sensor else None,
            "photo_evidences": photos,
            "history": [h.to_dict() for h in history],
            "change_comparisons": change_comparisons,
            "audit_summary": audit_summary,
            "replay_commands": replay_commands,
        }

    def get_all_combined_results(self) -> List[Dict[str, Any]]:
        return [
            self.get_combined_result(uz_id)
            for uz_id in self.uniform_zone_records.keys()
        ]

    def export_combined_report(self, output_path: str) -> str:
        results = self.get_all_combined_results()
        report = {
            "export_time": datetime.now().isoformat(),
            "total_records": len(results),
            "boundary_rules": self.rule_engine.get_all_rules(),
            "records": results,
            "audit_logs": [l.to_dict() for l in self.history_manager.get_all_audit_logs()],
        }

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return output_path

    def confirm_record(self, uniform_zone_id: str, operator: str) -> Dict[str, Any]:
        if uniform_zone_id not in self.uniform_zone_records:
            return {"error": "记录不存在"}

        uz = self.uniform_zone_records[uniform_zone_id]

        if uz.coach_review_required:
            return {"error": "存在待复核事项，不能确认"}

        before = uz.to_dict()
        uz.processing_status = ProcessingStatus.CONFIRMED
        after = uz.to_dict()

        command = f"python3 main.py confirm --uz-id {uniform_zone_id}"

        history_entry = self.history_manager.create_entry(
            uniform_zone_id=uniform_zone_id,
            change_type=ChangeType.MANUAL_EDIT,
            before_value=before,
            after_value=after,
            operator=operator,
            reason="最终确认",
            command_used=command,
        )
        uz.history_ids.append(history_entry.entry_id)
        uz.last_updated_at = datetime.now().isoformat()

        self._save()

        return {"status": "confirmed", "uniform_zone_id": uniform_zone_id}

    def get_statistics(self) -> Dict[str, Any]:
        status_counts = {}
        for uz in self.uniform_zone_records.values():
            status = uz.processing_status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "total_uniform_zones": len(self.uniform_zone_records),
            "total_sensors": len(self.sensor_records),
            "total_photos": len(self.photo_records),
            "status_distribution": status_counts,
            "pending_coach_review": sum(
                1 for uz in self.uniform_zone_records.values()
                if uz.coach_review_required
            ),
        }
