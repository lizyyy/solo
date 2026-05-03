import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class ValidationError:
    file_name: str
    row_number: int
    field_name: str
    error_type: str
    message: str


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    row_count: int = 0


class DataParser:
    REQUIRED_BOOKINGS_FIELDS = ['booking_id', 'member_id', 'seat_id', 'date', 'time_slot', 'status', 'deposit_amount', 'is_member']
    REQUIRED_CHECKINS_FIELDS = ['checkin_id', 'booking_id', 'member_id', 'seat_id', 'checkin_time', 'late_minutes']
    REQUIRED_COMPLAINTS_FIELDS = ['complaint_id', 'booking_id', 'member_id', 'seat_id', 'complaint_type', 'complaint_time', 'status']
    REQUIRED_SEATS_FIELDS = ['zones', 'seats']
    
    VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'no-show', 'checked-in']
    VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night']
    VALID_COMPLAINT_TYPES = ['noise', 'refund', 'service', 'other']

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.bookings: List[Dict[str, Any]] = []
        self.checkins: List[Dict[str, Any]] = []
        self.complaints: List[Dict[str, Any]] = []
        self.seats_config: Dict[str, Any] = {}
        self.validation_results: Dict[str, ValidationResult] = {}

    def load_all_data(self) -> Dict[str, ValidationResult]:
        self.load_bookings()
        self.load_checkins()
        self.load_complaints()
        self.load_seats()
        self._cross_validate_references()
        return self.validation_results

    def load_bookings(self) -> ValidationResult:
        file_path = os.path.join(self.data_dir, 'bookings.csv')
        result = ValidationResult()
        errors = []
        warnings = []
        
        if not os.path.exists(file_path):
            errors.append(ValidationError(
                file_name='bookings.csv',
                row_number=0,
                field_name='',
                error_type='file_not_found',
                message='文件不存在'
            ))
            result.is_valid = False
            result.errors = errors
            self.validation_results['bookings'] = result
            return result

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            row_num = 0
            
            for row in reader:
                row_num += 1
                result.row_count += 1
                
                for field in self.REQUIRED_BOOKINGS_FIELDS:
                    if field not in row or not row[field].strip():
                        errors.append(ValidationError(
                            file_name='bookings.csv',
                            row_number=row_num,
                            field_name=field,
                            error_type='missing_field',
                            message=f'缺少必填字段: {field}'
                        ))
                
                if row.get('date'):
                    try:
                        datetime.strptime(row['date'], '%Y-%m-%d')
                    except ValueError:
                        errors.append(ValidationError(
                            file_name='bookings.csv',
                            row_number=row_num,
                            field_name='date',
                            error_type='invalid_date',
                            message=f'日期格式无效: {row["date"]}, 期望格式 YYYY-MM-DD'
                        ))
                
                if row.get('time_slot') and row['time_slot'] not in self.VALID_TIME_SLOTS:
                    warnings.append(ValidationError(
                        file_name='bookings.csv',
                        row_number=row_num,
                        field_name='time_slot',
                        error_type='unknown_value',
                        message=f'未知的时段: {row["time_slot"]}'
                    ))
                
                if row.get('status') and row['status'] not in self.VALID_BOOKING_STATUSES:
                    warnings.append(ValidationError(
                        file_name='bookings.csv',
                        row_number=row_num,
                        field_name='status',
                        error_type='unknown_value',
                        message=f'未知的预约状态: {row["status"]}'
                    ))
                
                if row.get('deposit_amount'):
                    try:
                        float(row['deposit_amount'])
                    except ValueError:
                        errors.append(ValidationError(
                            file_name='bookings.csv',
                            row_number=row_num,
                            field_name='deposit_amount',
                            error_type='invalid_number',
                            message=f'保证金金额无效: {row["deposit_amount"]}'
                        ))
                
                self.bookings.append(self._parse_booking_row(row))

        result.is_valid = len(errors) == 0
        result.errors = errors
        result.warnings = warnings
        self.validation_results['bookings'] = result
        return result

    def load_checkins(self) -> ValidationResult:
        file_path = os.path.join(self.data_dir, 'checkins.csv')
        result = ValidationResult()
        errors = []
        warnings = []
        
        if not os.path.exists(file_path):
            warnings.append(ValidationError(
                file_name='checkins.csv',
                row_number=0,
                field_name='',
                error_type='file_not_found',
                message='文件不存在，将假设所有已签到预约都准时到达'
            ))
            result.is_valid = True
            result.warnings = warnings
            self.validation_results['checkins'] = result
            return result

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            row_num = 0
            
            for row in reader:
                row_num += 1
                result.row_count += 1
                
                for field in self.REQUIRED_CHECKINS_FIELDS:
                    if field not in row or not row[field].strip():
                        errors.append(ValidationError(
                            file_name='checkins.csv',
                            row_number=row_num,
                            field_name=field,
                            error_type='missing_field',
                            message=f'缺少必填字段: {field}'
                        ))
                
                for time_field in ['checkin_time', 'checkout_time']:
                    if row.get(time_field):
                        try:
                            datetime.strptime(row[time_field], '%Y-%m-%d %H:%M:%S')
                        except ValueError:
                            errors.append(ValidationError(
                                file_name='checkins.csv',
                                row_number=row_num,
                                field_name=time_field,
                                error_type='invalid_datetime',
                                message=f'时间格式无效: {row[time_field]}, 期望格式 YYYY-MM-DD HH:MM:SS'
                            ))
                
                if row.get('late_minutes'):
                    try:
                        late = int(row['late_minutes'])
                        if late < 0:
                            warnings.append(ValidationError(
                                file_name='checkins.csv',
                                row_number=row_num,
                                field_name='late_minutes',
                                error_type='negative_value',
                                message=f'迟到分钟数为负数: {row["late_minutes"]}'
                            ))
                    except ValueError:
                        errors.append(ValidationError(
                            file_name='checkins.csv',
                            row_number=row_num,
                            field_name='late_minutes',
                            error_type='invalid_integer',
                            message=f'迟到分钟数格式无效: {row["late_minutes"]}'
                        ))
                
                self.checkins.append(self._parse_checkin_row(row))

        result.is_valid = len(errors) == 0
        result.errors = errors
        result.warnings = warnings
        self.validation_results['checkins'] = result
        return result

    def load_complaints(self) -> ValidationResult:
        file_path = os.path.join(self.data_dir, 'complaints.csv')
        result = ValidationResult()
        errors = []
        warnings = []
        
        if not os.path.exists(file_path):
            warnings.append(ValidationError(
                file_name='complaints.csv',
                row_number=0,
                field_name='',
                error_type='file_not_found',
                message='文件不存在，投诉分析将不可用'
            ))
            result.is_valid = True
            result.warnings = warnings
            self.validation_results['complaints'] = result
            return result

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            row_num = 0
            
            for row in reader:
                row_num += 1
                result.row_count += 1
                
                for field in self.REQUIRED_COMPLAINTS_FIELDS:
                    if field not in row or not row[field].strip():
                        errors.append(ValidationError(
                            file_name='complaints.csv',
                            row_number=row_num,
                            field_name=field,
                            error_type='missing_field',
                            message=f'缺少必填字段: {field}'
                        ))
                
                if row.get('complaint_type') and row['complaint_type'] not in self.VALID_COMPLAINT_TYPES:
                    warnings.append(ValidationError(
                        file_name='complaints.csv',
                        row_number=row_num,
                        field_name='complaint_type',
                        error_type='unknown_value',
                        message=f'未知的投诉类型: {row["complaint_type"]}'
                    ))
                
                if row.get('complaint_time'):
                    try:
                        datetime.strptime(row['complaint_time'], '%Y-%m-%d %H:%M:%S')
                    except ValueError:
                        errors.append(ValidationError(
                            file_name='complaints.csv',
                            row_number=row_num,
                            field_name='complaint_time',
                            error_type='invalid_datetime',
                            message=f'投诉时间格式无效: {row["complaint_time"]}'
                        ))
                
                if row.get('noise_level_estimate'):
                    try:
                        noise = int(row['noise_level_estimate'])
                        if noise < 0 or noise > 120:
                            warnings.append(ValidationError(
                                file_name='complaints.csv',
                                row_number=row_num,
                                field_name='noise_level_estimate',
                                error_type='out_of_range',
                                message=f'噪音值超出合理范围 (0-120): {row["noise_level_estimate"]}'
                            ))
                    except ValueError:
                        errors.append(ValidationError(
                            file_name='complaints.csv',
                            row_number=row_num,
                            field_name='noise_level_estimate',
                            error_type='invalid_integer',
                            message=f'噪音值格式无效: {row["noise_level_estimate"]}'
                        ))
                
                self.complaints.append(self._parse_complaint_row(row))

        result.is_valid = len(errors) == 0
        result.errors = errors
        result.warnings = warnings
        self.validation_results['complaints'] = result
        return result

    def load_seats(self) -> ValidationResult:
        file_path = os.path.join(self.data_dir, 'seats.json')
        result = ValidationResult()
        errors = []
        warnings = []
        
        if not os.path.exists(file_path):
            errors.append(ValidationError(
                file_name='seats.json',
                row_number=0,
                field_name='',
                error_type='file_not_found',
                message='座位配置文件不存在，这是必需文件'
            ))
            result.is_valid = False
            result.errors = errors
            self.validation_results['seats'] = result
            return result

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                result.row_count = 1
                
                for field in self.REQUIRED_SEATS_FIELDS:
                    if field not in data:
                        errors.append(ValidationError(
                            file_name='seats.json',
                            row_number=0,
                            field_name=field,
                            error_type='missing_field',
                            message=f'缺少必填配置字段: {field}'
                        ))
                
                if 'zones' in data:
                    zone_ids = set()
                    for i, zone in enumerate(data['zones']):
                        if 'id' not in zone:
                            errors.append(ValidationError(
                                file_name='seats.json',
                                row_number=0,
                                field_name=f'zones[{i}].id',
                                error_type='missing_field',
                                message=f'区域缺少id字段'
                            ))
                        else:
                            if zone['id'] in zone_ids:
                                warnings.append(ValidationError(
                                    file_name='seats.json',
                                    row_number=0,
                                    field_name=f'zones[{i}].id',
                                    error_type='duplicate',
                                    message=f'重复的区域id: {zone["id"]}'
                                ))
                            zone_ids.add(zone['id'])
                
                if 'seats' in data:
                    seat_ids = set()
                    for i, seat in enumerate(data['seats']):
                        if 'id' not in seat:
                            errors.append(ValidationError(
                                file_name='seats.json',
                                row_number=0,
                                field_name=f'seats[{i}].id',
                                error_type='missing_field',
                                message=f'座位缺少id字段'
                            ))
                        else:
                            if seat['id'] in seat_ids:
                                warnings.append(ValidationError(
                                    file_name='seats.json',
                                    row_number=0,
                                    field_name=f'seats[{i}].id',
                                    error_type='duplicate',
                                    message=f'重复的座位id: {seat["id"]}'
                                ))
                            seat_ids.add(seat['id'])
                        
                        if 'zone' in seat and 'zones' in data:
                            zone_ids = {z['id'] for z in data['zones']}
                            if seat['zone'] not in zone_ids:
                                warnings.append(ValidationError(
                                    file_name='seats.json',
                                    row_number=0,
                                    field_name=f'seats[{i}].zone',
                                    error_type='unknown_zone',
                                    message=f'座位 {seat["id"]} 引用了未知区域: {seat["zone"]}'
                                ))
                
                self.seats_config = data

        except json.JSONDecodeError as e:
            errors.append(ValidationError(
                file_name='seats.json',
                row_number=e.lineno,
                field_name='',
                error_type='invalid_json',
                message=f'JSON格式错误: {e.msg}'
            ))
        except Exception as e:
            errors.append(ValidationError(
                file_name='seats.json',
                row_number=0,
                field_name='',
                error_type='parse_error',
                message=f'解析错误: {str(e)}'
            ))

        result.is_valid = len(errors) == 0
        result.errors = errors
        result.warnings = warnings
        self.validation_results['seats'] = result
        return result

    def _cross_validate_references(self) -> None:
        booking_ids = {b['booking_id'] for b in self.bookings}
        seat_ids = {s['id'] for s in self.seats_config.get('seats', [])}
        
        for checkin in self.checkins:
            if checkin['booking_id'] and checkin['booking_id'] not in booking_ids:
                self.validation_results['checkins'].warnings.append(ValidationError(
                    file_name='checkins.csv',
                    row_number=0,
                    field_name='booking_id',
                    error_type='invalid_reference',
                    message=f'签到记录引用了不存在的预约: {checkin["booking_id"]}'
                ))
        
        for complaint in self.complaints:
            if complaint['booking_id'] and complaint['booking_id'] not in booking_ids:
                self.validation_results['complaints'].warnings.append(ValidationError(
                    file_name='complaints.csv',
                    row_number=0,
                    field_name='booking_id',
                    error_type='invalid_reference',
                    message=f'投诉记录引用了不存在的预约: {complaint["booking_id"]}'
                ))
        
        for booking in self.bookings:
            if booking['seat_id'] and booking['seat_id'] not in seat_ids:
                self.validation_results['bookings'].warnings.append(ValidationError(
                    file_name='bookings.csv',
                    row_number=0,
                    field_name='seat_id',
                    error_type='invalid_reference',
                    message=f'预约引用了不存在的座位: {booking["seat_id"]}'
                ))

    def _parse_booking_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'booking_id': row.get('booking_id', '').strip(),
            'member_id': row.get('member_id', '').strip(),
            'seat_id': row.get('seat_id', '').strip(),
            'date': row.get('date', '').strip(),
            'time_slot': row.get('time_slot', '').strip(),
            'status': row.get('status', '').strip(),
            'deposit_amount': float(row['deposit_amount']) if row.get('deposit_amount') else 0.0,
            'created_at': row.get('created_at', '').strip(),
            'is_member': row.get('is_member', '').lower() == 'true' if row.get('is_member') else False
        }

    def _parse_checkin_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'checkin_id': row.get('checkin_id', '').strip(),
            'booking_id': row.get('booking_id', '').strip(),
            'member_id': row.get('member_id', '').strip(),
            'seat_id': row.get('seat_id', '').strip(),
            'checkin_time': row.get('checkin_time', '').strip(),
            'checkout_time': row.get('checkout_time', '').strip(),
            'late_minutes': int(row['late_minutes']) if row.get('late_minutes') else 0,
            'actual_duration_minutes': int(row['actual_duration_minutes']) if row.get('actual_duration_minutes') else 0
        }

    def _parse_complaint_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'complaint_id': row.get('complaint_id', '').strip(),
            'booking_id': row.get('booking_id', '').strip(),
            'member_id': row.get('member_id', '').strip(),
            'seat_id': row.get('seat_id', '').strip(),
            'complaint_type': row.get('complaint_type', '').strip(),
            'complaint_detail': row.get('complaint_detail', '').strip(),
            'complaint_time': row.get('complaint_time', '').strip(),
            'reported_by_zone': row.get('reported_by_zone', '').strip(),
            'noise_level_estimate': int(row['noise_level_estimate']) if row.get('noise_level_estimate') else 0,
            'status': row.get('status', '').strip(),
            'handling_action': row.get('handling_action', '').strip(),
            'resolution_time': row.get('resolution_time', '').strip()
        }

    def get_all_data(self) -> Dict[str, Any]:
        return {
            'bookings': self.bookings,
            'checkins': self.checkins,
            'complaints': self.complaints,
            'seats_config': self.seats_config,
            'validation_results': {
                name: {
                    'is_valid': r.is_valid,
                    'row_count': r.row_count,
                    'errors': [
                        {
                            'file_name': e.file_name,
                            'row_number': e.row_number,
                            'field_name': e.field_name,
                            'error_type': e.error_type,
                            'message': e.message
                        } for e in r.errors
                    ],
                    'warnings': [
                        {
                            'file_name': w.file_name,
                            'row_number': w.row_number,
                            'field_name': w.field_name,
                            'error_type': w.error_type,
                            'message': w.message
                        } for w in r.warnings
                    ]
                } for name, r in self.validation_results.items()
            }
        }
