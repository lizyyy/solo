import pandas as pd
import json
import csv
from datetime import datetime
from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session
from models import (
    ImportFile, RawRecord, BadRecord,
    Route, RouteStop, RouteSchedule,
    Bus, Driver, GPSRecord, StudentAppeal,
    ImportSourceType, RecordStatus
)

class DataImporter:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def import_schedule_csv(self, file_path: str) -> Dict[str, Any]:
        import_file = ImportFile(
            filename=file_path,
            source_type=ImportSourceType.SCHEDULE_CSV.value,
            status='processing'
        )
        self.db.add(import_file)
        self.db.flush()
        
        valid_count = 0
        invalid_count = 0
        bad_records = []
        raw_records = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for line_num, row in enumerate(reader, start=2):
                    raw_records.append(RawRecord(
                        import_file_id=import_file.id,
                        record_type='schedule',
                        raw_data=json.dumps(row, ensure_ascii=False),
                        line_number=line_num,
                        status='pending'
                    ))
                    
                    is_valid, error, suggestion = self._validate_schedule_row(row, line_num)
                    if not is_valid:
                        invalid_count += 1
                        bad_records.append(BadRecord(
                            import_file_id=import_file.id,
                            record_type='schedule',
                            raw_data=json.dumps(row, ensure_ascii=False),
                            line_number=line_num,
                            failure_reason=error,
                            correction_suggestion=suggestion
                        ))
                        continue
                    
                    try:
                        self._process_schedule_row(row)
                        valid_count += 1
                    except Exception as e:
                        invalid_count += 1
                        bad_records.append(BadRecord(
                            import_file_id=import_file.id,
                            record_type='schedule',
                            raw_data=json.dumps(row, ensure_ascii=False),
                            line_number=line_num,
                            failure_reason=str(e),
                            correction_suggestion="检查数据格式是否正确"
                        ))
            
            self.db.add_all(raw_records)
            self.db.add_all(bad_records)
            
            import_file.total_records = valid_count + invalid_count
            import_file.valid_records = valid_count
            import_file.invalid_records = invalid_count
            import_file.status = 'completed'
            self.db.commit()
            
            return {
                'success': True,
                'import_file_id': import_file.id,
                'total': valid_count + invalid_count,
                'valid': valid_count,
                'invalid': invalid_count,
                'bad_records': bad_records
            }
            
        except Exception as e:
            self.db.rollback()
            import_file.status = 'failed'
            self.db.commit()
            return {
                'success': False,
                'error': str(e)
            }
    
    def _validate_schedule_row(self, row: Dict, line_num: int) -> Tuple[bool, str, str]:
        required_fields = ['route_code', 'route_name', 'stop_name', 'stop_order', 
                          'scheduled_arrival', 'scheduled_departure']
        
        for field in required_fields:
            if field not in row or not str(row[field]).strip():
                return False, f"缺少必填字段: {field}", f"在第{line_num}行添加{field}字段值"
        
        try:
            int(row['stop_order'])
        except ValueError:
            return False, f"stop_order必须是数字: {row['stop_order']}", f"将第{line_num}行的stop_order改为有效整数"
        
        time_fields = ['scheduled_arrival', 'scheduled_departure']
        for field in time_fields:
            if not self._is_valid_time(row[field]):
                return False, f"{field}时间格式无效: {row[field]}", f"将第{line_num}行的{field}改为 HH:MM 格式"
        
        return True, "", ""
    
    def _is_valid_time(self, time_str: str) -> bool:
        try:
            datetime.strptime(time_str.strip(), '%H:%M')
            return True
        except ValueError:
            return False
    
    def _process_schedule_row(self, row: Dict):
        route = self.db.query(Route).filter_by(route_code=row['route_code']).first()
        if not route:
            route = Route(
                route_code=row['route_code'],
                route_name=row['route_name'],
                description=row.get('description', ''),
                direction=row.get('direction', 'morning')
            )
            self.db.add(route)
            self.db.flush()
        
        stop = self.db.query(RouteStop).filter_by(
            route_id=route.id,
            stop_name=row['stop_name']
        ).first()
        
        if not stop:
            stop = RouteStop(
                route_id=route.id,
                stop_name=row['stop_name'],
                stop_order=int(row['stop_order']),
                latitude=float(row['latitude']) if row.get('latitude') else None,
                longitude=float(row['longitude']) if row.get('longitude') else None,
                address=row.get('address', '')
            )
            self.db.add(stop)
            self.db.flush()
        else:
            stop.stop_order = int(row['stop_order'])
        
        existing_schedule = self.db.query(RouteSchedule).filter_by(
            route_id=route.id,
            stop_id=stop.id,
            day_of_week=row.get('day_of_week', 'weekday')
        ).first()
        
        if not existing_schedule:
            schedule = RouteSchedule(
                route_id=route.id,
                stop_id=stop.id,
                scheduled_arrival=row['scheduled_arrival'].strip(),
                scheduled_departure=row['scheduled_departure'].strip(),
                day_of_week=row.get('day_of_week', 'weekday')
            )
            self.db.add(schedule)
    
    def import_gps_json(self, file_path: str) -> Dict[str, Any]:
        import_file = ImportFile(
            filename=file_path,
            source_type=ImportSourceType.GPS_JSON.value,
            status='processing'
        )
        self.db.add(import_file)
        self.db.flush()
        
        valid_count = 0
        invalid_count = 0
        bad_records = []
        raw_records = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            gps_records = data if isinstance(data, list) else data.get('records', [])
            
            for idx, record in enumerate(gps_records):
                line_num = idx + 1
                raw_records.append(RawRecord(
                    import_file_id=import_file.id,
                    record_type='gps',
                    raw_data=json.dumps(record, ensure_ascii=False),
                    line_number=line_num,
                    status='pending'
                ))
                
                is_valid, error, suggestion = self._validate_gps_record(record, line_num)
                if not is_valid:
                    invalid_count += 1
                    bad_records.append(BadRecord(
                        import_file_id=import_file.id,
                        record_type='gps',
                        raw_data=json.dumps(record, ensure_ascii=False),
                        line_number=line_num,
                        failure_reason=error,
                        correction_suggestion=suggestion
                    ))
                    continue
                
                try:
                    self._process_gps_record(record)
                    valid_count += 1
                except Exception as e:
                    invalid_count += 1
                    bad_records.append(BadRecord(
                        import_file_id=import_file.id,
                        record_type='gps',
                        raw_data=json.dumps(record, ensure_ascii=False),
                        line_number=line_num,
                        failure_reason=str(e),
                        correction_suggestion="检查GPS数据格式"
                    ))
            
            self.db.add_all(raw_records)
            self.db.add_all(bad_records)
            
            import_file.total_records = valid_count + invalid_count
            import_file.valid_records = valid_count
            import_file.invalid_records = invalid_count
            import_file.status = 'completed'
            self.db.commit()
            
            return {
                'success': True,
                'import_file_id': import_file.id,
                'total': valid_count + invalid_count,
                'valid': valid_count,
                'invalid': invalid_count,
                'bad_records': bad_records
            }
            
        except Exception as e:
            self.db.rollback()
            import_file.status = 'failed'
            self.db.commit()
            return {
                'success': False,
                'error': str(e)
            }
    
    def _validate_gps_record(self, record: Dict, line_num: int) -> Tuple[bool, str, str]:
        required_fields = ['bus_number', 'timestamp', 'latitude', 'longitude']
        
        for field in required_fields:
            if field not in record or not record[field]:
                return False, f"缺少必填字段: {field}", f"在第{line_num}条记录添加{field}字段"
        
        try:
            float(record['latitude'])
            float(record['longitude'])
        except (ValueError, TypeError):
            return False, "经纬度必须是数字", f"检查第{line_num}条记录的经纬度格式"
        
        try:
            datetime.fromisoformat(record['timestamp'].replace('Z', '+00:00'))
        except ValueError:
            return False, f"时间戳格式无效: {record['timestamp']}", f"第{line_num}条记录使用ISO格式时间戳"
        
        return True, "", ""
    
    def _process_gps_record(self, record: Dict):
        bus = self.db.query(Bus).filter_by(bus_number=record['bus_number']).first()
        if not bus:
            bus = Bus(
                bus_number=record['bus_number'],
                plate_number=record.get('plate_number', ''),
                capacity=int(record.get('capacity', 50))
            )
            self.db.add(bus)
            self.db.flush()
        
        route = None
        if record.get('route_code'):
            route = self.db.query(Route).filter_by(route_code=record['route_code']).first()
        
        timestamp = datetime.fromisoformat(record['timestamp'].replace('Z', '+00:00'))
        
        gps_record = GPSRecord(
            bus_id=bus.id,
            route_id=route.id if route else None,
            timestamp=timestamp,
            latitude=float(record['latitude']),
            longitude=float(record['longitude']),
            speed=float(record['speed']) if record.get('speed') else None,
            heading=float(record['heading']) if record.get('heading') else None,
            ignition_status=record.get('ignition_status')
        )
        self.db.add(gps_record)
    
    def import_appeal_form(self, file_path: str) -> Dict[str, Any]:
        import_file = ImportFile(
            filename=file_path,
            source_type=ImportSourceType.APPEAL_FORM.value,
            status='processing'
        )
        self.db.add(import_file)
        self.db.flush()
        
        valid_count = 0
        invalid_count = 0
        bad_records = []
        raw_records = []
        
        try:
            if file_path.endswith('.json'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                appeals = data if isinstance(data, list) else data.get('appeals', [])
            else:
                df = pd.read_csv(file_path)
                appeals = df.to_dict('records')
            
            for idx, appeal in enumerate(appeals):
                line_num = idx + 1
                raw_records.append(RawRecord(
                    import_file_id=import_file.id,
                    record_type='appeal',
                    raw_data=json.dumps(appeal, ensure_ascii=False),
                    line_number=line_num,
                    status='pending'
                ))
                
                is_valid, error, suggestion = self._validate_appeal(appeal, line_num)
                if not is_valid:
                    invalid_count += 1
                    bad_records.append(BadRecord(
                        import_file_id=import_file.id,
                        record_type='appeal',
                        raw_data=json.dumps(appeal, ensure_ascii=False),
                        line_number=line_num,
                        failure_reason=error,
                        correction_suggestion=suggestion
                    ))
                    continue
                
                try:
                    self._process_appeal(appeal)
                    valid_count += 1
                except Exception as e:
                    invalid_count += 1
                    bad_records.append(BadRecord(
                        import_file_id=import_file.id,
                        record_type='appeal',
                        raw_data=json.dumps(appeal, ensure_ascii=False),
                        line_number=line_num,
                        failure_reason=str(e),
                        correction_suggestion="检查申诉单数据格式"
                    ))
            
            self.db.add_all(raw_records)
            self.db.add_all(bad_records)
            
            import_file.total_records = valid_count + invalid_count
            import_file.valid_records = valid_count
            import_file.invalid_records = invalid_count
            import_file.status = 'completed'
            self.db.commit()
            
            return {
                'success': True,
                'import_file_id': import_file.id,
                'total': valid_count + invalid_count,
                'valid': valid_count,
                'invalid': invalid_count,
                'bad_records': bad_records
            }
            
        except Exception as e:
            self.db.rollback()
            import_file.status = 'failed'
            self.db.commit()
            return {
                'success': False,
                'error': str(e)
            }
    
    def _validate_appeal(self, appeal: Dict, line_num: int) -> Tuple[bool, str, str]:
        required_fields = ['appeal_number', 'student_name', 'incident_date', 'incident_type']
        
        for field in required_fields:
            if field not in appeal or not str(appeal[field]).strip():
                return False, f"缺少必填字段: {field}", f"第{line_num}条申诉缺少{field}字段"
        
        try:
            if isinstance(appeal['incident_date'], str):
                datetime.fromisoformat(appeal['incident_date'])
        except ValueError:
            return False, f"事件日期格式无效: {appeal['incident_date']}", f"第{line_num}条申诉使用YYYY-MM-DD格式日期"
        
        return True, "", ""
    
    def _process_appeal(self, appeal: Dict):
        existing = self.db.query(StudentAppeal).filter_by(appeal_number=appeal['appeal_number']).first()
        if existing:
            return
        
        route = None
        if appeal.get('route_code'):
            route = self.db.query(Route).filter_by(route_code=appeal['route_code']).first()
        
        stop = None
        if route and appeal.get('stop_name'):
            stop = self.db.query(RouteStop).filter_by(
                route_id=route.id,
                stop_name=appeal['stop_name']
            ).first()
        
        bus = None
        if appeal.get('bus_number'):
            bus = self.db.query(Bus).filter_by(bus_number=appeal['bus_number']).first()
        
        incident_date = appeal['incident_date']
        if isinstance(incident_date, str):
            incident_date = datetime.fromisoformat(incident_date)
        
        appeal_record = StudentAppeal(
            appeal_number=appeal['appeal_number'],
            student_name=appeal['student_name'],
            parent_name=appeal.get('parent_name', ''),
            parent_phone=appeal.get('parent_phone', ''),
            route_id=route.id if route else None,
            stop_id=stop.id if stop else None,
            bus_id=bus.id if bus else None,
            incident_date=incident_date,
            incident_type=appeal['incident_type'],
            description=appeal.get('description', ''),
            expected_time=appeal.get('expected_time', ''),
            actual_time=appeal.get('actual_time', ''),
            status='pending'
        )
        self.db.add(appeal_record)
    
    def get_bad_records(self, import_file_id: int = None) -> List[BadRecord]:
        query = self.db.query(BadRecord)
        if import_file_id:
            query = query.filter_by(import_file_id=import_file_id)
        return query.order_by(BadRecord.created_at.desc()).all()
    
    def resolve_bad_record(self, bad_record_id: int, resolved: bool = True):
        record = self.db.query(BadRecord).get(bad_record_id)
        if record:
            record.resolved = resolved
            self.db.commit()
