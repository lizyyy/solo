import uuid
import csv
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

from models import (
    PollutionRecord, RecordStatus, DataSource, DataSourceType,
    RecordRepository, AuditLogEntry, IssueType, PendingQueueItem,
    DuplicateGroup
)


class DataIngestionService:
    def __init__(self, repo: RecordRepository):
        self.repo = repo
    
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
    
    def _create_data_source(self, source_type: DataSourceType,
                            filename: Optional[str] = None,
                            uploaded_by: Optional[str] = None,
                            metadata: Dict[str, Any] = None) -> str:
        source = DataSource(
            source_id=self._generate_id(),
            source_type=source_type,
            filename=filename,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.now(),
            metadata=metadata or {}
        )
        self.repo.insert_data_source(source)
        return source.source_id
    
    def ingest_from_dict(self, data: Dict[str, Any],
                          source_type: DataSourceType = DataSourceType.AUTOMATIC,
                          uploaded_by: Optional[str] = None,
                          filename: Optional[str] = None,
                          source_metadata: Dict[str, Any] = None) -> str:
        source_id = self._create_data_source(
            source_type=source_type,
            filename=filename,
            uploaded_by=uploaded_by,
            metadata=source_metadata
        )
        
        record = PollutionRecord(
            record_id=self._generate_id(),
            source_id=source_id,
            sample_time=datetime.fromisoformat(data["sample_time"]) if isinstance(data["sample_time"], str) else data["sample_time"],
            location=data["location"],
            pollutant=data["pollutant"],
            value=float(data["value"]),
            unit=data["unit"],
            status=RecordStatus.DRAFT,
            model_version=data.get("model_version"),
            constraints=data.get("constraints", {}),
            overridden_constraints=data.get("overridden_constraints", {}),
            current_owner=uploaded_by,
            metadata=data.get("metadata", {})
        )
        
        self.repo.insert_record(record)
        
        self._log_action(
            record_id=record.record_id,
            action="create",
            old_status=None,
            new_status=RecordStatus.DRAFT,
            changed_by=uploaded_by,
            reason=f"数据导入，来源: {source_type.value}",
            changed_fields={"source": source_type.value, "filename": filename}
        )
        
        return record.record_id
    
    def ingest_from_csv(self, csv_path: str,
                         source_type: DataSourceType = DataSourceType.MANUAL_UPLOAD,
                         uploaded_by: Optional[str] = None,
                         source_metadata: Dict[str, Any] = None) -> List[str]:
        record_ids = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    record_id = self.ingest_from_dict(
                        data=row,
                        source_type=source_type,
                        uploaded_by=uploaded_by,
                        filename=csv_path,
                        source_metadata=source_metadata
                    )
                    record_ids.append(record_id)
                except Exception as e:
                    print(f"跳过无效行 {row}: {e}")
        
        return record_ids
    
    def ingest_from_json(self, json_path: str,
                          source_type: DataSourceType = DataSourceType.MANUAL_UPLOAD,
                          uploaded_by: Optional[str] = None,
                          source_metadata: Dict[str, Any] = None) -> List[str]:
        with open(json_path, "r", encoding="utf-8") as f:
            data_list = json.load(f)
        
        if not isinstance(data_list, list):
            data_list = [data_list]
        
        record_ids = []
        for data in data_list:
            try:
                record_id = self.ingest_from_dict(
                    data=data,
                    source_type=source_type,
                    uploaded_by=uploaded_by,
                    filename=json_path,
                    source_metadata=source_metadata
                )
                record_ids.append(record_id)
            except Exception as e:
                print(f"跳过无效数据 {data}: {e}")
        
        return record_ids
    
    def ingest_late_attachment(self, original_record_id: str,
                                attachment_data: Dict[str, Any],
                                uploaded_by: str,
                                filename: Optional[str] = None,
                                reason: str = "") -> str:
        original = self.repo.get_record(original_record_id)
        if not original:
            raise ValueError(f"原始记录不存在: {original_record_id}")
        
        source_metadata = {
            "original_record_id": original_record_id,
            "attachment_reason": reason,
            "original_sample_time": original.sample_time.isoformat()
        }
        
        new_record_data = {
            "sample_time": attachment_data.get("sample_time", original.sample_time.isoformat()),
            "location": attachment_data.get("location", original.location),
            "pollutant": attachment_data.get("pollutant", original.pollutant),
            "value": float(attachment_data.get("value", original.value)),
            "unit": attachment_data.get("unit", original.unit),
            "model_version": attachment_data.get("model_version", original.model_version),
            "constraints": attachment_data.get("constraints", original.constraints),
            "overridden_constraints": attachment_data.get("overridden_constraints", original.overridden_constraints),
            "metadata": {
                **attachment_data.get("metadata", {}),
                "late_attachment_for": original_record_id,
                "attachment_reason": reason
            }
        }
        
        new_record_id = self.ingest_from_dict(
            data=new_record_data,
            source_type=DataSourceType.LATE_ATTACHMENT,
            uploaded_by=uploaded_by,
            filename=filename,
            source_metadata=source_metadata
        )
        
        self._log_action(
            record_id=original_record_id,
            action="late_attachment",
            old_status=original.status,
            new_status=original.status,
            changed_by=uploaded_by,
            reason=f"收到晚到附件，关联新记录: {new_record_id}。原因: {reason}",
            changed_fields={"attached_record_id": new_record_id}
        )
        
        return new_record_id
    
    def apply_manual_correction(self, record_id: str,
                                 corrections: Dict[str, Any],
                                 corrected_by: str,
                                 reason: str) -> None:
        original = self.repo.get_record(record_id)
        if not original:
            raise ValueError(f"记录不存在: {record_id}")
        
        old_values = {}
        new_values = {}
        
        for field, new_value in corrections.items():
            if hasattr(original, field):
                old_value = getattr(original, field)
                if old_value != new_value:
                    old_values[field] = old_value
                    new_values[field] = new_value
                    setattr(original, field, new_value)
        
        if not old_values:
            return
        
        source_id = self._create_data_source(
            source_type=DataSourceType.MANUAL_CORRECTION,
            uploaded_by=corrected_by,
            metadata={
                "original_record_id": record_id,
                "correction_reason": reason,
                "old_values": old_values
            }
        )
        
        old_status = original.status
        original.status = RecordStatus.DRAFT
        original.source_id = source_id
        original.metadata = {
            **original.metadata,
            "manual_correction": True,
            "corrected_by": corrected_by,
            "correction_reason": reason,
            "correction_time": datetime.now().isoformat()
        }
        
        self.repo.update_record(original)
        
        self._log_action(
            record_id=record_id,
            action="manual_correction",
            old_status=old_status,
            new_status=RecordStatus.DRAFT,
            changed_by=corrected_by,
            reason=f"人工更正: {reason}",
            changed_fields={"old_values": old_values, "new_values": new_values}
        )
    
    def find_duplicates(self, location: Optional[str] = None,
                         pollutant: Optional[str] = None,
                         time_window_minutes: int = 30) -> List[DuplicateGroup]:
        records = self.repo.get_records_by_criteria(
            location=location,
            pollutant=pollutant
        )
        
        groups: Dict[str, List[PollutionRecord]] = {}
        
        for record in records:
            key = f"{record.location}|{record.pollutant}"
            if key not in groups:
                groups[key] = []
            groups[key].append(record)
        
        duplicate_groups = []
        
        for key, group_records in groups.items():
            group_records.sort(key=lambda r: r.sample_time)
            
            i = 0
            while i < len(group_records):
                window_end = group_records[i].sample_time + timedelta(minutes=time_window_minutes)
                window_records = [group_records[i]]
                
                j = i + 1
                while j < len(group_records) and group_records[j].sample_time <= window_end:
                    if abs(group_records[j].value - group_records[i].value) < 0.001:
                        window_records.append(group_records[j])
                    j += 1
                
                if len(window_records) >= 2:
                    primary = window_records[0]
                    duplicates = [r.record_id for r in window_records[1:]]
                    
                    group = DuplicateGroup(
                        group_id=self._generate_id(),
                        primary_record_id=primary.record_id,
                        duplicate_record_ids=duplicates,
                        detected_at=datetime.now(),
                        merged=False
                    )
                    self.repo.insert_duplicate_group(group)
                    duplicate_groups.append(group)
                    
                    for dup_id in duplicates:
                        dup_record = self.repo.get_record(dup_id)
                        if dup_record:
                            pending_item = PendingQueueItem(
                                queue_id=self._generate_id(),
                                record_id=dup_id,
                                issue_type=IssueType.DUPLICATE,
                                issue_description=f"检测到重复记录，主记录ID: {primary.record_id}",
                                review_reason=f"在{time_window_minutes}分钟窗口内发现相同位置、相同污染物、相近数值的重复记录。"
                                             f"主记录时间: {primary.sample_time}, 数值: {primary.value}{primary.unit}",
                                detected_at=datetime.now(),
                                is_active=True
                            )
                            self.repo.insert_pending_item(pending_item)
                            
                            old_status = dup_record.status
                            dup_record.status = RecordStatus.PENDING_REVIEW
                            dup_record.metadata["duplicate_of"] = primary.record_id
                            self.repo.update_record(dup_record)
                            
                            self._log_action(
                                record_id=dup_id,
                                action="duplicate_detected",
                                old_status=old_status,
                                new_status=RecordStatus.PENDING_REVIEW,
                                changed_by="system",
                                reason=f"检测为重复记录，主记录: {primary.record_id}",
                                changed_fields={"primary_record_id": primary.record_id}
                            )
                
                i = j
        
        return duplicate_groups
    
    def get_record_full_info(self, record_id: str) -> Dict[str, Any]:
        record = self.repo.get_record(record_id)
        if not record:
            return {}
        
        source = self.repo.get_data_source(record.source_id)
        audit_log = self.repo.get_audit_log(record_id)
        pending_items = self.repo.get_pending_items_for_record(record_id, active_only=False)
        
        return {
            "record": asdict(record),
            "source": asdict(source) if source else None,
            "audit_log": [asdict(entry) for entry in audit_log],
            "pending_items": [asdict(item) for item in pending_items]
        }
