import csv
from datetime import datetime, date
from typing import Dict, List, Tuple, Optional
from .models import (
    DailyRecord, ExperimentGroup, RecordType, RecordStatus,
    AuditFinding, AuditReport
)


class DataLoader:
    def __init__(self, file_path: str, group_config_path: Optional[str] = None):
        self.file_path = file_path
        self.group_config_path = group_config_path
        self.groups: Dict[str, ExperimentGroup] = {}
        self.records: List[DailyRecord] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def load_groups(self) -> Dict[str, ExperimentGroup]:
        if self.group_config_path:
            self._load_groups_from_file()
        return self.groups

    def _load_groups_from_file(self):
        with open(self.group_config_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    group_id = row.get('group_id', '').strip()
                    if not group_id:
                        continue
                    
                    start_date = self._parse_date(row.get('start_date'))
                    end_date = self._parse_date(row.get('end_date'))
                    
                    group = ExperimentGroup(
                        group_id=group_id,
                        group_name=row.get('group_name', group_id),
                        total_seeds=int(row.get('total_seeds', '0')),
                        start_date=start_date,
                        end_date=end_date,
                        metadata={
                            'variety': row.get('variety', ''),
                            'location': row.get('location', ''),
                            'notes': row.get('notes', '')
                        }
                    )
                    self.groups[group_id] = group
                except Exception as e:
                    self.warnings.append(f"读取实验组配置失败: {row} - {str(e)}")

    def load_records(self) -> List[DailyRecord]:
        with open(self.file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            line_num = 1
            
            for row in reader:
                line_num += 1
                record = self._parse_record(row, line_num)
                if record:
                    self.records.append(record)
        
        return self.records

    def _parse_record(self, row: Dict[str, str], line_num: int) -> Optional[DailyRecord]:
        errors = []
        warnings = []
        
        group_id = row.get('group_id', '').strip()
        if not group_id:
            errors.append(f"第{line_num}行: 缺少group_id")
            return self._create_invalid_record(row, line_num, errors)
        
        exp_date = self._parse_date(row.get('experiment_date'))
        if not exp_date:
            errors.append(f"第{line_num}行: 日期格式错误 {row.get('experiment_date')}")
            return self._create_invalid_record(row, line_num, errors, group_id)
        
        try:
            germinated = int(row.get('germinated_count', '0'))
            if germinated < 0:
                errors.append(f"第{line_num}行: 发芽数不能为负数 {germinated}")
        except ValueError:
            germinated = 0
            errors.append(f"第{line_num}行: 发芽数格式错误 {row.get('germinated_count')}")
        
        try:
            total_seeds = int(row.get('total_seeds', '0'))
            if total_seeds < 0:
                errors.append(f"第{line_num}行: 总种子数不能为负数 {total_seeds}")
        except ValueError:
            total_seeds = 0
            errors.append(f"第{line_num}行: 总种子数格式错误 {row.get('total_seeds')}")
        
        if total_seeds > 0 and germinated > total_seeds:
            errors.append(f"第{line_num}行: 发芽数 {germinated} 大于总种子数 {total_seeds}")
        
        record_type = RecordType.DAILY
        if row.get('record_type', '').lower() == 'backfill':
            record_type = RecordType.BACKFILL
            warnings.append(f"第{line_num}行: 这是一条补记记录")
        
        record_date = self._parse_date(row.get('record_date'))
        if record_type == RecordType.BACKFILL and record_date and record_date < exp_date:
            errors.append(f"第{line_num}行: 补记日期 {record_date} 早于实验日期 {exp_date}")
        
        operator = row.get('operator', '').strip()
        notes = row.get('notes', '').strip()
        
        status = RecordStatus.NORMAL
        if errors:
            status = RecordStatus.INVALID
        elif record_type == RecordType.BACKFILL:
            status = RecordStatus.BACKFILLED
        
        return DailyRecord(
            group_id=group_id,
            experiment_date=exp_date,
            germinated_count=germinated,
            total_seeds=total_seeds,
            record_type=record_type,
            record_date=record_date,
            operator=operator,
            notes=notes,
            raw_line=str(row),
            status=status,
            errors=errors,
            warnings=warnings
        )

    def _create_invalid_record(
        self, row: Dict[str, str], line_num: int, errors: List[str],
        group_id: str = ''
    ) -> DailyRecord:
        exp_date = self._parse_date(row.get('experiment_date')) or date.today()
        return DailyRecord(
            group_id=group_id or 'UNKNOWN',
            experiment_date=exp_date,
            germinated_count=0,
            total_seeds=0,
            raw_line=f"第{line_num}行: {str(row)}",
            status=RecordStatus.INVALID,
            errors=errors
        )

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[date]:
        if not date_str or not str(date_str).strip():
            return None
        
        formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%Y.%m.%d',
            '%Y年%m月%d日',
            '%m/%d/%Y',
            '%d-%m-%Y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt).date()
            except ValueError:
                continue
        
        return None


class Validator:
    def __init__(self, records: List[DailyRecord], groups: Dict[str, ExperimentGroup]):
        self.records = records
        self.groups = groups
        self.audit_findings: List[AuditFinding] = []

    def validate_all(self) -> AuditReport:
        self._validate_group_references()
        self._validate_duplicates()
        self._validate_date_sequence()
        self._validate_cumulative_growth()
        self._detect_missing_days()
        self._validate_backfill_records()
        
        return self._generate_audit_report()

    def _validate_group_references(self):
        known_groups = set(self.groups.keys())
        referenced_groups = set(r.group_id for r in self.records if r.group_id)
        
        for group_id in referenced_groups:
            if group_id not in known_groups:
                self.audit_findings.append(AuditFinding(
                    finding_type='unknown_group',
                    group_id=group_id,
                    experiment_date=None,
                    severity='error',
                    message=f'引用了未配置的实验组: {group_id}',
                    details={
                        'referenced_in_records': sum(
                            1 for r in self.records if r.group_id == group_id
                        )
                    }
                ))
        
        for group_id in known_groups:
            if group_id not in referenced_groups:
                self.audit_findings.append(AuditFinding(
                    finding_type='group_without_records',
                    group_id=group_id,
                    experiment_date=None,
                    severity='warning',
                    message=f'实验组 {group_id} 没有任何记录'
                ))

    def _validate_duplicates(self):
        key_map: Dict[Tuple[str, date], List[DailyRecord]] = {}
        
        for record in self.records:
            if record.status == RecordStatus.INVALID:
                continue
            key = (record.group_id, record.experiment_date)
            if key not in key_map:
                key_map[key] = []
            key_map[key].append(record)
        
        for (group_id, exp_date), recs in key_map.items():
            if len(recs) > 1:
                daily_count = sum(1 for r in recs if r.record_type == RecordType.DAILY)
                backfill_count = len(recs) - daily_count
                
                if daily_count > 1:
                    for rec in recs[1:]:
                        rec.status = RecordStatus.DUPLICATE
                    
                    self.audit_findings.append(AuditFinding(
                        finding_type='duplicate_daily',
                        group_id=group_id,
                        experiment_date=exp_date,
                        severity='error',
                        message=f'发现 {daily_count} 条日常记录重复',
                        details={'total_records': len(recs), 'backfill_count': backfill_count}
                    ))
                elif backfill_count > 0:
                    for rec in recs:
                        if rec.record_type == RecordType.BACKFILL:
                            rec.status = RecordStatus.BACKFILLED
                    
                    self.audit_findings.append(AuditFinding(
                        finding_type='has_backfill',
                        group_id=group_id,
                        experiment_date=exp_date,
                        severity='info',
                        message=f'该日期有 {backfill_count} 条补记记录',
                        details={'daily_count': daily_count, 'backfill_count': backfill_count}
                    ))

    def _validate_date_sequence(self):
        for group_id, group in self.groups.items():
            group_records = [
                r for r in self.records 
                if r.group_id == group_id and r.status != RecordStatus.INVALID
            ]
            if not group_records:
                continue
            
            dates = sorted(set(r.experiment_date for r in group_records))
            
            if group.start_date and dates[0] < group.start_date:
                self.audit_findings.append(AuditFinding(
                    finding_type='date_before_start',
                    group_id=group_id,
                    experiment_date=dates[0],
                    severity='warning',
                    message=f'记录日期 {dates[0]} 早于实验开始日期 {group.start_date}'
                ))
            
            if group.end_date and dates[-1] > group.end_date:
                self.audit_findings.append(AuditFinding(
                    finding_type='date_after_end',
                    group_id=group_id,
                    experiment_date=dates[-1],
                    severity='warning',
                    message=f'记录日期 {dates[-1]} 晚于实验结束日期 {group.end_date}'
                ))

    def _validate_cumulative_growth(self):
        for group_id, group in self.groups.items():
            group_records = [
                r for r in self.records 
                if r.group_id == group_id and r.status != RecordStatus.INVALID
            ]
            if not group_records:
                continue
            
            by_date: Dict[date, List[DailyRecord]] = {}
            for r in group_records:
                if r.experiment_date not in by_date:
                    by_date[r.experiment_date] = []
                by_date[r.experiment_date].append(r)
            
            sorted_dates = sorted(by_date.keys())
            prev_total = 0
            
            for exp_date in sorted_dates:
                daily_records = by_date[exp_date]
                daily_total = max(r.germinated_count for r in daily_records)
                
                if daily_total < prev_total:
                    self.audit_findings.append(AuditFinding(
                        finding_type='cumulative_decrease',
                        group_id=group_id,
                        experiment_date=exp_date,
                        severity='error',
                        message=f'累计发芽数下降: 前一日 {prev_total}, 当日 {daily_total}',
                        details={
                            'previous_total': prev_total,
                            'current_total': daily_total,
                            'records_for_day': [
                                {'type': r.record_type.value, 'count': r.germinated_count}
                                for r in daily_records
                            ]
                        }
                    ))
                
                prev_total = daily_total

    def _detect_missing_days(self):
        for group_id, group in self.groups.items():
            group_records = [
                r for r in self.records 
                if r.group_id == group_id and r.status != RecordStatus.INVALID
            ]
            if not group_records:
                continue
            
            recorded_dates = set(r.experiment_date for r in group_records)
            sorted_dates = sorted(recorded_dates)
            
            start_date = group.start_date or sorted_dates[0]
            end_date = group.end_date or sorted_dates[-1]
            
            from datetime import timedelta
            current_date = start_date
            missing_dates = []
            
            while current_date <= end_date:
                if current_date not in recorded_dates:
                    missing_dates.append(current_date)
                current_date += timedelta(days=1)
            
            for miss_date in missing_dates:
                self.audit_findings.append(AuditFinding(
                    finding_type='missing_record',
                    group_id=group_id,
                    experiment_date=miss_date,
                    severity='warning',
                    message=f'缺少 {miss_date} 的记录'
                ))

    def _validate_backfill_records(self):
        backfill_records = [
            r for r in self.records 
            if r.record_type == RecordType.BACKFILL and r.status != RecordStatus.INVALID
        ]
        
        for record in backfill_records:
            if not record.record_date:
                self.audit_findings.append(AuditFinding(
                    finding_type='backfill_no_record_date',
                    group_id=record.group_id,
                    experiment_date=record.experiment_date,
                    severity='warning',
                    message='补记记录缺少record_date'
                ))
            
            if not record.operator:
                self.audit_findings.append(AuditFinding(
                    finding_type='backfill_no_operator',
                    group_id=record.group_id,
                    experiment_date=record.experiment_date,
                    severity='info',
                    message='补记记录缺少操作员信息'
                ))
            
            if not record.notes:
                self.audit_findings.append(AuditFinding(
                    finding_type='backfill_no_notes',
                    group_id=record.group_id,
                    experiment_date=record.experiment_date,
                    severity='info',
                    message='补记记录缺少补记原因说明'
                ))

    def _generate_audit_report(self) -> AuditReport:
        total_records = len(self.records)
        invalid_records = sum(1 for r in self.records if r.status == RecordStatus.INVALID)
        duplicate_records = sum(1 for r in self.records if r.status == RecordStatus.DUPLICATE)
        backfilled_records = sum(1 for r in self.records if r.status == RecordStatus.BACKFILLED)
        valid_records = total_records - invalid_records - duplicate_records
        
        finding_types = {}
        for finding in self.audit_findings:
            ftype = finding.finding_type
            if ftype not in finding_types:
                finding_types[ftype] = 0
            finding_types[ftype] += 1
        
        severity_counts = {
            'error': sum(1 for f in self.audit_findings if f.severity == 'error'),
            'warning': sum(1 for f in self.audit_findings if f.severity == 'warning'),
            'info': sum(1 for f in self.audit_findings if f.severity == 'info'),
        }
        
        missing_records = sum(1 for f in self.audit_findings if f.finding_type == 'missing_record')
        
        return AuditReport(
            findings=self.audit_findings,
            total_records=total_records,
            valid_records=valid_records,
            invalid_records=invalid_records,
            missing_records=missing_records,
            backfilled_records=backfilled_records,
            summary={
                'finding_types': finding_types,
                'severity_counts': severity_counts,
                'has_errors': severity_counts['error'] > 0,
                'has_warnings': severity_counts['warning'] > 0,
                'duplicate_count': duplicate_records,
            }
        )
