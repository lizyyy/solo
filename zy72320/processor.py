import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict
from collections import defaultdict

from models import (
    PredictionRecord, RecordStatus, RecordSource,
    ParameterVersion, HandCalculation, ConflictEvidence, ProcessingLog
)


class RecordProcessor:
    def __init__(self):
        self.records: List[PredictionRecord] = []
        self.parameter_versions: List[ParameterVersion] = []
        self.hand_calculations: List[HandCalculation] = []
        self.conflicts: List[ConflictEvidence] = []
        self.logs: List[ProcessingLog] = []
        self._next_record_id = 1

    def _log_action(self, record_id: int, action: str, operator: str, details: Dict = None):
        log = ProcessingLog(
            log_id=str(uuid.uuid4())[:8],
            record_id=record_id,
            action=action,
            operator=operator,
            details=details or {}
        )
        self.logs.append(log)

    def detect_id_gaps(self) -> List[Tuple[int, int]]:
        if not self.records:
            return []
        
        record_ids = sorted(r.record_id for r in self.records)
        gaps = []
        for i in range(len(record_ids) - 1):
            expected = record_ids[i] + 1
            actual = record_ids[i + 1]
            if actual != expected:
                gaps.append((record_ids[i], actual))
        return gaps

    def mark_gap_records(self, operator: str = "system"):
        gaps = self.detect_id_gaps()
        for gap_start, gap_end in gaps:
            for record in self.records:
                if record.record_id == gap_end:
                    record.status = RecordStatus.GAP_DETECTED
                    record.notes = f"编号断档检测: 前一编号 {gap_start}, 当前编号 {gap_end}"
                    self._log_action(
                        record.record_id,
                        "GAP_DETECTED",
                        operator,
                        {"gap_start": gap_start, "gap_end": gap_end}
                    )

    def import_parameter_sheet(self, records_data: List[Dict], operator: str) -> List[PredictionRecord]:
        imported_records = []
        for data in records_data:
            record = PredictionRecord(
                record_id=self._next_record_id,
                date=data["date"],
                store_id=data["store_id"],
                predicted_foot_traffic=data["predicted_foot_traffic"],
                poisson_lambda=data.get("poisson_lambda", 0.0),
                status=RecordStatus.NORMAL,
                source=RecordSource.IMPORT,
                version=self._get_latest_version()
            )
            self.records.append(record)
            imported_records.append(record)
            self._next_record_id += 1
            self._log_action(
                record.record_id,
                "IMPORT",
                operator,
                {"source": "parameter_sheet"}
            )
        
        self.mark_gap_records(operator)
        return imported_records

    def _get_latest_version(self) -> str:
        if not self.parameter_versions:
            return "v1.0"
        return max(pv.version for pv in self.parameter_versions)

    def add_hand_calculation(self, calc_data: Dict, operator: str) -> HandCalculation:
        calc = HandCalculation(
            calc_id=f"HC-{len(self.hand_calculations) + 1:03d}",
            date=calc_data["date"],
            store_id=calc_data["store_id"],
            manual_value=calc_data["manual_value"],
            formula_used=calc_data["formula_used"],
            created_by=operator
        )
        self.hand_calculations.append(calc)
        return calc

    def check_conflicts(self) -> List[ConflictEvidence]:
        new_conflicts = []
        
        for calc in self.hand_calculations:
            for record in self.records:
                if (record.date == calc.date and 
                    record.store_id == calc.store_id and
                    record.status != RecordStatus.REJECTED):
                    
                    diff = abs(record.predicted_foot_traffic - calc.manual_value)
                    if diff > 0.01:
                        conflict = ConflictEvidence(
                            conflict_id=f"CF-{len(self.conflicts) + 1:03d}",
                            record_id=record.record_id,
                            parameter_value=record.predicted_foot_traffic,
                            hand_calc_value=calc.manual_value,
                            description=f"参数值 {record.predicted_foot_traffic} vs 手算值 {calc.manual_value}, 差异 {diff:.2f}"
                        )
                        self.conflicts.append(conflict)
                        new_conflicts.append(conflict)
                        record.status = RecordStatus.PENDING_REVIEW
        
        return new_conflicts

    def resolve_conflict(self, conflict_id: str, resolution: str, operator: str) -> bool:
        for conflict in self.conflicts:
            if conflict.conflict_id == conflict_id:
                conflict.resolution = resolution
                
                for record in self.records:
                    if record.record_id == conflict.record_id:
                        if resolution == "confirm":
                            record.status = RecordStatus.CONFIRMED
                            record.notes = f"运营规划{operator}确认采用参数值"
                        elif resolution == "reject":
                            record.status = RecordStatus.REJECTED
                            record.notes = f"运营规划{operator}驳回，采用手算反例值"
                        
                        self._log_action(
                            record.record_id,
                            f"RESOLVE_{resolution.upper()}",
                            operator,
                            {"conflict_id": conflict_id}
                        )
                return True
        return False

    def import_old_caliber_record(self, record_data: Dict, operator: str) -> PredictionRecord:
        record = PredictionRecord(
            record_id=self._next_record_id,
            date=record_data["date"],
            store_id=record_data["store_id"],
            predicted_foot_traffic=record_data["predicted_foot_traffic"],
            poisson_lambda=record_data.get("poisson_lambda", 0.0),
            status=RecordStatus.OLD_CALIBER,
            source=RecordSource.HAND_CALCULATION,
            version=record_data.get("version", "v0.9-old"),
            previous_version=record_data.get("previous_version"),
            notes=f"旧口径补录记录，来自手算反例，由{operator}导入"
        )
        self.records.append(record)
        self._next_record_id += 1
        self._log_action(
            record.record_id,
            "OLD_CALIBER_IMPORT",
            operator,
            {"source": "hand_calculation_backfill"}
        )
        return record

    def create_parameter_version(self, lambda_value: float, effective_date: str, 
                                  created_by: str, reason: str) -> ParameterVersion:
        new_version_num = len(self.parameter_versions) + 1
        version = ParameterVersion(
            version=f"v{new_version_num}.0",
            lambda_value=lambda_value,
            effective_date=effective_date,
            created_by=created_by,
            reason=reason
        )
        
        for pv in self.parameter_versions:
            pv.is_active = False
        
        self.parameter_versions.append(version)
        return version

    def get_parameter_version_page(self) -> Dict:
        active_version = None
        for pv in self.parameter_versions:
            if pv.is_active:
                active_version = pv
                break
        
        return {
            "active_version": active_version,
            "history": sorted(self.parameter_versions, key=lambda x: x.created_at, reverse=True),
            "total_versions": len(self.parameter_versions)
        }

    def get_processing_history(self) -> List[Dict]:
        history = []
        for record in sorted(self.records, key=lambda x: x.record_id):
            history.append({
                "record_id": record.record_id,
                "date": record.date,
                "store_id": record.store_id,
                "predicted": record.predicted_foot_traffic,
                "lambda": record.poisson_lambda,
                "status": record.status.value,
                "source": record.source.value,
                "version": record.version,
                "notes": record.notes
            })
        return history

    def simulate_manual_deletion(self, record_id: int, operator: str) -> bool:
        for i, record in enumerate(self.records):
            if record.record_id == record_id:
                del self.records[i]
                self._log_action(
                    record_id,
                    "MANUAL_DELETE",
                    operator,
                    {"note": "人工删除一行记录"}
                )
                return True
        return False
