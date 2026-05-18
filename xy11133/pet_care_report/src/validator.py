from typing import List, Dict, Any
from datetime import datetime
from .parser import PetCareRecord


class ValidationError:
    def __init__(self, error_type: str, message: str, record_id: str = '', cage_number: str = '', severity: str = 'warning'):
        self.error_type = error_type
        self.message = message
        self.record_id = record_id
        self.cage_number = cage_number
        self.severity = severity
        self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            'error_type': self.error_type,
            'message': self.message,
            'record_id': self.record_id,
            'cage_number': self.cage_number,
            'severity': self.severity,
            'timestamp': self.timestamp
        }


class ReportValidator:
    def __init__(self):
        self.max_pets_per_cage = 2

    def validate(self, records: List[PetCareRecord]) -> Dict[str, Any]:
        all_errors = []
        normal_records = []
        abnormal_records = []

        cage_records = self._group_by_cage(records)

        for record in records:
            record_errors = []

            record_errors.extend(self._check_multiple_pets_per_cage(record, cage_records))
            record_errors.extend(self._check_photo_timestamps(record))
            record_errors.extend(self._check_required_fields(record))
            record_errors.extend(self._check_date_format(record))

            if record_errors:
                abnormal_records.append(record)
                all_errors.extend(record_errors)
            else:
                normal_records.append(record)

        return {
            'normal_records': normal_records,
            'abnormal_records': abnormal_records,
            'errors': all_errors,
            'summary': self._generate_summary(normal_records, abnormal_records, all_errors)
        }

    def _group_by_cage(self, records: List[PetCareRecord]) -> Dict[str, List[PetCareRecord]]:
        cage_map = {}
        for record in records:
            if record.cage_number:
                if record.cage_number not in cage_map:
                    cage_map[record.cage_number] = []
                cage_map[record.cage_number].append(record)
        return cage_map

    def _check_multiple_pets_per_cage(self, record: PetCareRecord, cage_records: Dict[str, List[PetCareRecord]]) -> List[ValidationError]:
        errors = []
        if not record.cage_number:
            return errors

        pets_in_cage = set()
        for r in cage_records.get(record.cage_number, []):
            pets_in_cage.update(r.pet_names)
        
        pets_sorted = sorted(pets_in_cage)

        if len(pets_in_cage) > self.max_pets_per_cage:
            errors.append(ValidationError(
                error_type='多宠同笼异常',
                message=f"笼子 {record.cage_number} 中有 {len(pets_in_cage)} 只宠物: {', '.join(pets_sorted)}，超过最大限制 {self.max_pets_per_cage} 只",
                record_id=record.record_id,
                cage_number=record.cage_number,
                severity='error'
            ))
        elif len(pets_in_cage) > 1:
            errors.append(ValidationError(
                error_type='多宠同笼提醒',
                message=f"笼子 {record.cage_number} 中有 {len(pets_in_cage)} 只宠物合笼: {', '.join(pets_sorted)}",
                record_id=record.record_id,
                cage_number=record.cage_number,
                severity='info'
            ))

        return errors

    def _check_photo_timestamps(self, record: PetCareRecord) -> List[ValidationError]:
        errors = []
        if not record.photos:
            return errors

        missing_timestamp_count = 0
        for photo in record.photos:
            if not photo.get('timestamp'):
                missing_timestamp_count += 1

        if missing_timestamp_count > 0:
            errors.append(ValidationError(
                error_type='照片缺时间戳',
                message=f"记录 {record.record_id} 中有 {missing_timestamp_count} 张照片缺少时间戳信息",
                record_id=record.record_id,
                cage_number=record.cage_number,
                severity='warning'
            ))

        return errors

    def _check_required_fields(self, record: PetCareRecord) -> List[ValidationError]:
        errors = []
        required_fields = [
            ('record_id', '记录ID'),
            ('date', '日期'),
            ('cage_number', '笼号'),
        ]

        for field, display_name in required_fields:
            value = getattr(record, field, '')
            if not value:
                errors.append(ValidationError(
                    error_type='必填字段缺失',
                    message=f"记录缺少必填字段: {display_name}",
                    record_id=record.record_id,
                    cage_number=record.cage_number,
                    severity='error'
                ))

        if not record.pet_names:
            errors.append(ValidationError(
                error_type='宠物信息缺失',
                message=f"记录中没有宠物名称",
                record_id=record.record_id,
                cage_number=record.cage_number,
                severity='warning'
            ))

        return errors

    def _check_date_format(self, record: PetCareRecord) -> List[ValidationError]:
        errors = []
        if not record.date:
            return errors

        date_formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']
        valid = False
        for fmt in date_formats:
            try:
                datetime.strptime(record.date, fmt)
                valid = True
                break
            except ValueError:
                continue

        if not valid:
            errors.append(ValidationError(
                error_type='日期格式错误',
                message=f"日期格式不正确: {record.date}，请使用 YYYY-MM-DD 格式",
                record_id=record.record_id,
                cage_number=record.cage_number,
                severity='warning'
            ))

        return errors

    def _generate_summary(self, normal_records: List[PetCareRecord], 
                          abnormal_records: List[PetCareRecord], 
                          errors: List[ValidationError]) -> Dict[str, Any]:
        error_types = {}
        for error in errors:
            if error.error_type not in error_types:
                error_types[error.error_type] = 0
            error_types[error.error_type] += 1

        return {
            'total_records': len(normal_records) + len(abnormal_records),
            'normal_count': len(normal_records),
            'abnormal_count': len(abnormal_records),
            'total_errors': len(errors),
            'error_types': error_types,
            'severity_count': {
                'error': sum(1 for e in errors if e.severity == 'error'),
                'warning': sum(1 for e in errors if e.severity == 'warning'),
                'info': sum(1 for e in errors if e.severity == 'info')
            }
        }
