import os
import json
import uuid
import pickle
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path
from collections import defaultdict

from models import (
    PlayerRecord, DispatchRecord, RecordStatus, Anomaly, AnomalyType,
    ManualCorrection, BatchProcessResult
)


class UndergroundDispatcher:
    def __init__(self, storage_path: str = "./data"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.records_file = self.storage_path / "dispatch_records.pkl"
        self.records: Dict[str, DispatchRecord] = {}
        self.fingerprint_index: Dict[str, List[str]] = defaultdict(list)
        self.input_hash_index: Dict[str, str] = {}
        self._load_records()

    def _load_records(self):
        if self.records_file.exists():
            with open(self.records_file, 'rb') as f:
                data = pickle.load(f)
                self.records = data.get('records', {})
                self.fingerprint_index = data.get('fingerprint_index', defaultdict(list))
                self.input_hash_index = data.get('input_hash_index', {})

    def _save_records(self):
        with open(self.records_file, 'wb') as f:
            pickle.dump({
                'records': self.records,
                'fingerprint_index': self.fingerprint_index,
                'input_hash_index': self.input_hash_index
            }, f)

    def _generate_anomaly_id(self) -> str:
        return f"ANOM_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

    def _generate_correction_id(self) -> str:
        return f"CORR_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

    def _generate_batch_id(self) -> str:
        return f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def _check_duplicate(self, player_record: PlayerRecord) -> Tuple[bool, List[str]]:
        existing_ids = self.fingerprint_index.get(player_record.fingerprint, [])
        return len(existing_ids) > 0, existing_ids

    def _check_late(self, player_record: PlayerRecord, activity_deadline: Optional[datetime] = None) -> bool:
        if activity_deadline and player_record.completion_time > activity_deadline:
            return True
        if player_record.attachment_path:
            if not os.path.exists(player_record.attachment_path):
                return True
            file_mtime = datetime.fromtimestamp(os.path.getmtime(player_record.attachment_path))
            if file_mtime > player_record.completion_time + timedelta(hours=24):
                return True
        return False

    def _check_required_fields(self, player_record: PlayerRecord) -> List[str]:
        missing = []
        required = ['player_id', 'activity_id', 'task_id', 'completion_time', 'reward_amount', 'source']
        for field in required:
            value = getattr(player_record, field, None)
            if value is None or (isinstance(value, str) and not value.strip()):
                missing.append(field)
        return missing

    def process_record(self, player_record: PlayerRecord, activity_deadline: Optional[datetime] = None,
                       operator: str = "system") -> DispatchRecord:
        if player_record.input_hash in self.input_hash_index:
            existing_id = self.input_hash_index[player_record.input_hash]
            return self.records[existing_id]

        is_duplicate, duplicate_ids = self._check_duplicate(player_record)

        if is_duplicate:
            dup_suffix = f"_dup{len(duplicate_ids)}"
            dup_record_id = player_record.record_id + dup_suffix

            if dup_record_id in self.records:
                return self.records[dup_record_id]

            dispatch_record = DispatchRecord(
                record_id=dup_record_id,
                player_record=player_record
            )

            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                anomaly_type=AnomalyType.DUPLICATE_RECORD,
                severity="medium",
                description=f"发现重复记录，指纹与 {len(duplicate_ids)} 条已有记录相同",
                record_id=dup_record_id,
                detected_at=datetime.now(),
                related_record_ids=duplicate_ids
            )
            dispatch_record.add_anomaly(anomaly)
            dispatch_record.transition_status(
                RecordStatus.DUPLICATE,
                operator,
                f"重复记录，与 {duplicate_ids[0]} 等记录冲突",
                {"duplicate_of": duplicate_ids}
            )
            self.fingerprint_index[player_record.fingerprint].append(dup_record_id)
            self.input_hash_index[player_record.input_hash] = dup_record_id
            self.records[dup_record_id] = dispatch_record
            self._save_records()
            return dispatch_record

        if player_record.record_id in self.records:
            return self.records[player_record.record_id]

        dispatch_record = DispatchRecord(
            record_id=player_record.record_id,
            player_record=player_record
        )

        missing_fields = self._check_required_fields(player_record)
        if missing_fields:
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                anomaly_type=AnomalyType.MISSING_REQUIRED_FIELD,
                severity="high",
                description=f"缺少必填字段: {', '.join(missing_fields)}",
                record_id=player_record.record_id,
                detected_at=datetime.now()
            )
            dispatch_record.add_anomaly(anomaly)

        is_late = self._check_late(player_record, activity_deadline)
        if is_late:
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                anomaly_type=AnomalyType.LATE_ARRIVAL,
                severity="low",
                description="记录或附件晚于活动截止时间到达",
                record_id=player_record.record_id,
                detected_at=datetime.now()
            )
            dispatch_record.add_anomaly(anomaly)
            dispatch_record.transition_status(
                RecordStatus.LATE,
                operator,
                "晚到记录，需人工确认是否发奖"
            )
        else:
            dispatch_record.transition_status(
                RecordStatus.NORMAL,
                operator,
                "记录正常，待发奖"
            )
            dispatch_record.transition_status(
                RecordStatus.REWARD_READY,
                operator,
                "自动进入待发奖队列"
            )

        self.fingerprint_index[player_record.fingerprint].append(dispatch_record.record_id)
        self.input_hash_index[player_record.input_hash] = dispatch_record.record_id
        self.records[dispatch_record.record_id] = dispatch_record
        self._save_records()
        return dispatch_record

    def batch_process(self, player_records: List[PlayerRecord],
                      activity_deadline: Optional[datetime] = None,
                      operator: str = "system") -> BatchProcessResult:
        batch_id = self._generate_batch_id()
        start_time = datetime.now()

        new_count = 0
        duplicate_count = 0
        late_count = 0
        anomaly_count = 0

        for pr in player_records:
            already_exists = pr.input_hash in self.input_hash_index

            record = self.process_record(pr, activity_deadline, operator)
            record.batch_id = batch_id
            record.processed_at = datetime.now()

            if already_exists:
                if record.current_status == RecordStatus.DUPLICATE:
                    duplicate_count += 1
                continue

            if record.current_status == RecordStatus.DUPLICATE:
                duplicate_count += 1
            elif record.current_status == RecordStatus.LATE:
                late_count += 1
                new_count += 1
            else:
                new_count += 1

            if record.anomalies:
                anomaly_count += len([a for a in record.anomalies if not a.resolved])

        self._save_records()

        duration = (datetime.now() - start_time).total_seconds()
        return BatchProcessResult(
            batch_id=batch_id,
            total_records=len(player_records),
            new_records=new_count,
            duplicate_records=duplicate_count,
            late_records=late_count,
            anomaly_count=anomaly_count,
            processed_at=datetime.now(),
            duration_seconds=duration
        )

    def apply_manual_correction(self, record_id: str, corrected_fields: Dict[str, Any],
                                operator: str, reason: str) -> DispatchRecord:
        if record_id not in self.records:
            raise ValueError(f"记录 {record_id} 不存在")

        record = self.records[record_id]
        original_values = {}

        for field, new_value in corrected_fields.items():
            if hasattr(record.player_record, field):
                original_values[field] = getattr(record.player_record, field)
                setattr(record.player_record, field, new_value)

        record.player_record.fingerprint = record.player_record._calc_fingerprint()

        correction = ManualCorrection(
            correction_id=self._generate_correction_id(),
            record_id=record_id,
            operator=operator,
            corrected_fields=corrected_fields,
            original_values=original_values,
            reason=reason,
            timestamp=datetime.now()
        )
        record.add_manual_correction(correction)

        anomaly = Anomaly(
            anomaly_id=self._generate_anomaly_id(),
            anomaly_type=AnomalyType.MANUAL_OVERRIDE,
            severity="medium",
            description=f"人工更正字段: {', '.join(corrected_fields.keys())}",
            record_id=record_id,
            detected_at=datetime.now(),
            resolved=True,
            resolved_at=datetime.now(),
            resolution=f"操作人: {operator}, 原因: {reason}"
        )
        record.add_anomaly(anomaly)

        old_status = record.current_status
        record.transition_status(
            RecordStatus.MANUAL_CORRECTED,
            operator,
            f"人工更正: {reason}",
            {"original_values": original_values, "corrected_fields": corrected_fields}
        )
        record.transition_status(
            RecordStatus.REWARD_READY,
            operator,
            "更正完成，重新进入待发奖队列"
        )

        self._save_records()
        return record

    def mark_reward_sent(self, record_id: str, operator: str = "system") -> DispatchRecord:
        if record_id not in self.records:
            raise ValueError(f"记录 {record_id} 不存在")

        record = self.records[record_id]
        record.transition_status(
            RecordStatus.REWARD_SENT,
            operator,
            "奖励已发放"
        )
        self._save_records()
        return record

    def mark_reward_missed(self, record_id: str, reason: str, operator: str) -> DispatchRecord:
        if record_id not in self.records:
            raise ValueError(f"记录 {record_id} 不存在")

        record = self.records[record_id]

        anomaly = Anomaly(
            anomaly_id=self._generate_anomaly_id(),
            anomaly_type=AnomalyType.REWARD_DISCREPANCY,
            severity="high",
            description=f"奖励漏发: {reason}",
            record_id=record_id,
            detected_at=datetime.now()
        )
        record.add_anomaly(anomaly)

        record.transition_status(
            RecordStatus.REWARD_MISSED,
            operator,
            f"标记为漏发: {reason}"
        )
        self._save_records()
        return record

    def get_record(self, record_id: str) -> Optional[DispatchRecord]:
        return self.records.get(record_id)

    def get_records_by_status(self, status: RecordStatus) -> List[DispatchRecord]:
        return [r for r in self.records.values() if r.current_status == status]

    def get_records_by_player(self, player_id: str) -> List[DispatchRecord]:
        return [r for r in self.records.values() if r.player_record.player_id == player_id]

    def get_records_by_activity(self, activity_id: str) -> List[DispatchRecord]:
        return [r for r in self.records.values() if r.player_record.activity_id == activity_id]

    def get_missed_rewards(self) -> List[DispatchRecord]:
        return self.get_records_by_status(RecordStatus.REWARD_MISSED)

    def get_unresolved_anomalies(self) -> List[Anomaly]:
        anomalies = []
        for record in self.records.values():
            for anomaly in record.anomalies:
                if not anomaly.resolved:
                    anomalies.append(anomaly)
        return anomalies

    def resolve_anomaly(self, anomaly_id: str, resolution: str, operator: str) -> bool:
        for record in self.records.values():
            for anomaly in record.anomalies:
                if anomaly.anomaly_id == anomaly_id:
                    anomaly.resolved = True
                    anomaly.resolved_at = datetime.now()
                    anomaly.resolution = f"操作人: {operator}, 处理: {resolution}"
                    self._save_records()
                    return True
        return False

    def get_statistics(self) -> Dict[str, int]:
        stats = defaultdict(int)
        for record in self.records.values():
            stats[record.current_status.value] += 1
        stats['total'] = len(self.records)
        stats['anomalies_total'] = sum(len(r.anomalies) for r in self.records.values())
        stats['anomalies_unresolved'] = len(self.get_unresolved_anomalies())
        return dict(stats)
