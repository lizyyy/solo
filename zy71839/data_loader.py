import json
import csv
import os
import hashlib
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from pathlib import Path

from models import (
    BattleRecord, BattleAction, Position, Unit, SettlementData,
    RecordSource, ConfirmationStatus, AnomalyMark, AnomalyType
)


class DataLoader:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.duplicate_hash_index: Dict[str, List[str]] = {}
        self.correction_index: Dict[str, str] = {}
        self.loaded_records: List[BattleRecord] = []
        self.loaded_units: Dict[str, Unit] = {}
        self.loaded_settlements: List[SettlementData] = []

    def load_all(self) -> Tuple[List[BattleRecord], Dict[str, Unit], List[SettlementData]]:
        self._load_unit_tables()
        self._load_battle_records()
        self._load_settlement_data()
        self._process_late_attachments()
        self._detect_duplicates()
        self._apply_manual_corrections()
        return self.loaded_records, self.loaded_units, self.loaded_settlements

    def _load_unit_tables(self):
        unit_files = list(self.data_dir.glob("**/units*.csv")) + list(self.data_dir.glob("**/units*.json"))
        for file_path in unit_files:
            self._load_unit_file(file_path)

    def _load_unit_file(self, file_path: Path):
        source_file = str(file_path.absolute())
        if file_path.suffix == '.csv':
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for line_num, row in enumerate(reader, start=2):
                    unit = Unit(
                        unit_id=row['unit_id'],
                        name=row['name'],
                        faction=row['faction'],
                        unit_type=row['unit_type'],
                        hp=int(row['hp']),
                        attack=int(row['attack']),
                        defense=int(row['defense']),
                        move_range=int(row['move_range']),
                        source_file=source_file,
                        line_number=line_num
                    )
                    self.loaded_units[unit.unit_id] = unit
        elif file_path.suffix == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for line_num, unit_data in enumerate(data, start=1):
                    unit = Unit(
                        unit_id=unit_data['unit_id'],
                        name=unit_data['name'],
                        faction=unit_data['faction'],
                        unit_type=unit_data['unit_type'],
                        hp=int(unit_data['hp']),
                        attack=int(unit_data['attack']),
                        defense=int(unit_data['defense']),
                        move_range=int(unit_data['move_range']),
                        source_file=source_file,
                        line_number=line_num
                    )
                    self.loaded_units[unit.unit_id] = unit

    def _load_battle_records(self):
        record_files = list(self.data_dir.glob("**/battle_records*.json")) + \
                       list(self.data_dir.glob("**/battle_log*.json")) + \
                       list(self.data_dir.glob("**/round_*.json"))

        for file_path in record_files:
            source = self._detect_source_type(file_path)
            self._load_record_file(file_path, source)

    def _detect_source_type(self, file_path: Path) -> RecordSource:
        name = file_path.name.lower()
        if 'late' in name or 'attachment' in name:
            return RecordSource.LATE_ATTACHMENT
        if 'correction' in name or 'manual' in name:
            return RecordSource.MANUAL_CORRECTION
        if 'duplicate' in name:
            return RecordSource.DUPLICATE
        return RecordSource.NORMAL

    def _load_record_file(self, file_path: Path, source: RecordSource):
        source_file = str(file_path.absolute())
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for line_num, record_data in enumerate(data, start=1):
                record = self._parse_battle_record(record_data, source, source_file, line_num)
                self.loaded_records.append(record)

                content_hash = self._calculate_content_hash(record_data)
                if content_hash not in self.duplicate_hash_index:
                    self.duplicate_hash_index[content_hash] = []
                self.duplicate_hash_index[content_hash].append(record.record_id)

                if source == RecordSource.MANUAL_CORRECTION:
                    original_id = record_data.get('corrected_record_id')
                    if original_id:
                        self.correction_index[original_id] = record.record_id
                        record.parent_correction_id = original_id

    def _parse_battle_record(self, data: Dict, source: RecordSource,
                             source_file: str, line_num: int) -> BattleRecord:
        actions = []
        for action_data in data.get('actions', []):
            action = BattleAction(
                action_id=action_data['action_id'],
                turn=int(action_data['turn']),
                unit_id=action_data['unit_id'],
                action_type=action_data['action_type'],
                start_pos=Position(
                    x=int(action_data['start_pos']['x']),
                    y=int(action_data['start_pos']['y']),
                    zone=action_data['start_pos'].get('zone', '')
                ),
                end_pos=Position(
                    x=int(action_data['end_pos']['x']),
                    y=int(action_data['end_pos']['y']),
                    zone=action_data['end_pos'].get('zone', '')
                ),
                timestamp=datetime.fromisoformat(action_data['timestamp']),
                target_unit_id=action_data.get('target_unit_id'),
                damage_dealt=action_data.get('damage_dealt'),
                result=action_data.get('result')
            )
            actions.append(action)

        return BattleRecord(
            record_id=data['record_id'],
            source=source,
            battle_id=data['battle_id'],
            round_number=int(data['round_number']),
            actions=actions,
            raw_content=json.dumps(data, ensure_ascii=False),
            source_file=source_file,
            line_number=line_num
        )

    def _load_settlement_data(self):
        settlement_files = list(self.data_dir.glob("**/settlement*.json")) + \
                           list(self.data_dir.glob("**/result*.json"))
        for file_path in settlement_files:
            self._load_settlement_file(file_path)

    def _load_settlement_file(self, file_path: Path):
        source_file = str(file_path.absolute())
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for line_num, s_data in enumerate(data, start=1):
                settlement = SettlementData(
                    settlement_id=s_data['settlement_id'],
                    battle_id=s_data['battle_id'],
                    round_number=int(s_data['round_number']),
                    surviving_units=s_data.get('surviving_units', {}),
                    casualties=s_data.get('casualties', {}),
                    resource_changes=s_data.get('resource_changes', {}),
                    source_file=source_file,
                    line_number=line_num
                )
                self.loaded_settlements.append(settlement)

    def _process_late_attachments(self):
        for record in self.loaded_records:
            if record.source == RecordSource.LATE_ATTACHMENT:
                record.anomalies.append(AnomalyMark(
                    anomaly_type=AnomalyType.SUSPECTED_DUPLICATE,
                    description=f"晚到附件记录，来源: {os.path.basename(record.source_file)}",
                    confidence=0.5,
                    review_reason="该记录为晚到附件，需确认是否与已有记录重复或冲突",
                    evidence_refs=[f"file://{record.source_file}#L{record.line_number}"]
                ))
                record.confirmation_status = ConfirmationStatus.PENDING

    def _detect_duplicates(self):
        for content_hash, record_ids in self.duplicate_hash_index.items():
            if len(record_ids) > 1:
                primary_id = record_ids[0]
                for dup_id in record_ids[1:]:
                    dup_record = self._find_record_by_id(dup_id)
                    if dup_record:
                        dup_record.duplicate_of = primary_id
                        dup_record.source = RecordSource.DUPLICATE
                        dup_record.anomalies.append(AnomalyMark(
                            anomaly_type=AnomalyType.SUSPECTED_DUPLICATE,
                            description=f"检测为重复记录，主记录ID: {primary_id}",
                            confidence=0.95,
                            review_reason=f"记录内容哈希与 {primary_id} 完全一致",
                            evidence_refs=[f"hash:{content_hash}"]
                        ))
                        dup_record.confirmation_status = ConfirmationStatus.PENDING

    def _apply_manual_corrections(self):
        for original_id, correction_id in self.correction_index.items():
            original_record = self._find_record_by_id(original_id)
            correction_record = self._find_record_by_id(correction_id)
            if original_record and correction_record:
                original_record.confirmation_status = ConfirmationStatus.REJECTED
                original_record.anomalies.append(AnomalyMark(
                    anomaly_type=AnomalyType.SUSPECTED_DUPLICATE,
                    description=f"已被人工更正记录 {correction_id} 替代",
                    confidence=1.0,
                    review_reason="存在人工更正版本，此记录标记为废弃",
                    evidence_refs=[f"correction:{correction_id}"]
                ))

    def _find_record_by_id(self, record_id: str) -> Optional[BattleRecord]:
        for record in self.loaded_records:
            if record.record_id == record_id:
                return record
        return None

    @staticmethod
    def _calculate_content_hash(data: Dict) -> str:
        canonical = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(canonical.encode('utf-8')).hexdigest()
