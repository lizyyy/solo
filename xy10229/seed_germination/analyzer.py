from typing import Dict, Optional
from datetime import datetime
from .models import (
    ExperimentGroup, DailyRecord, AnalysisResult, RecordStatus
)
from .data_loader import DataLoader, Validator
from .statistics import StatisticsCalculator


class Analyzer:
    def __init__(
        self, records_file: str, groups_file: Optional[str] = None
    ):
        self.records_file = records_file
        self.groups_file = groups_file
        self.groups: Dict[str, ExperimentGroup] = {}
        self.configured_groups: Dict[str, ExperimentGroup] = {}
        self.records: list[DailyRecord] = []

    def analyze(self) -> AnalysisResult:
        self._load_data()
        self._auto_discover_groups()
        self._attach_records_to_groups()
        
        validator = Validator(self.records, self.configured_groups)
        audit_report = validator.validate_all()
        
        calculator = StatisticsCalculator(self.groups, self.records)
        statistics = calculator.calculate_all()
        
        return AnalysisResult(
            groups=self.groups,
            statistics=statistics,
            audit_report=audit_report,
            generation_time=datetime.now()
        )

    def _load_data(self):
        loader = DataLoader(self.records_file, self.groups_file)
        
        self.configured_groups = loader.load_groups()
        self.groups = dict(self.configured_groups)
        self.records = loader.load_records()

    def _auto_discover_groups(self):
        referenced_groups = set(r.group_id for r in self.records if r.group_id)
        
        for group_id in referenced_groups:
            if group_id not in self.groups:
                group_records = [
                    r for r in self.records
                    if r.group_id == group_id and r.status != RecordStatus.INVALID
                ]
                
                total_seeds = 0
                if group_records:
                    total_seeds = max((r.total_seeds for r in group_records), default=0)
                
                group = ExperimentGroup(
                    group_id=group_id,
                    group_name=group_id,
                    total_seeds=total_seeds
                )
                self.groups[group_id] = group

    def _attach_records_to_groups(self):
        for record in self.records:
            if record.group_id in self.groups:
                self.groups[record.group_id].records.append(record)
        
        for group_id, group in self.groups.items():
            if group.records:
                valid_dates = [
                    r.experiment_date for r in group.records
                    if r.status != RecordStatus.INVALID
                ]
                if valid_dates:
                    if not group.start_date:
                        group.start_date = min(valid_dates)
                    if not group.end_date:
                        group.end_date = max(valid_dates)
