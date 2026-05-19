import csv
import json
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Tuple, List, Dict, Any

from warehouse_nightshift.models import (
    Forklift, ChargingStation, Task, ImportRecord, FailedRecord,
    ImportStatus, OperationLog
)
from warehouse_nightshift.storage import UnitOfWork


class ImportService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _log_operation(self, action: str, entity_type: str, entity_id: str,
                       details: Dict[str, Any], operator: str) -> None:
        log = OperationLog(
            id=self._generate_id(),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            operator=operator
        )
        self.uow.operation_logs.save(log)

    def import_forklifts_from_csv(self, csv_path: Path, operator: str) -> ImportRecord:
        success_count = 0
        failed_count = 0
        failed_records: List[FailedRecord] = []

        import_id = self._generate_id()

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        for row_num, row in enumerate(rows, start=2):
            try:
                if not row.get('id') or not row.get('name'):
                    raise ValueError('缺少必填字段: id 或 name')

                battery_level = int(row.get('battery_level', 0))
                if battery_level < 0 or battery_level > 100:
                    raise ValueError(f'电量必须在 0-100 之间, 当前值: {battery_level}')

                forklift = Forklift(
                    id=row['id'],
                    name=row['name'],
                    battery_level=battery_level,
                    status=row.get('status', 'available'),
                    last_maintenance=date.fromisoformat(row.get('last_maintenance', date.today().isoformat())),
                    current_operator=row.get('current_operator'),
                    current_station=row.get('current_station')
                )

                self.uow.forklifts.save(forklift)
                self._log_operation('create', 'forklift', forklift.id, {'name': forklift.name}, operator)
                success_count += 1

            except Exception as e:
                failed_count += 1
                suggestion = self._get_suggestion('forklift', str(e), row)
                failed_record = FailedRecord(
                    id=self._generate_id(),
                    import_id=import_id,
                    record_type='forklift',
                    original_data=json.dumps(row, ensure_ascii=False),
                    row_number=row_num,
                    error_message=str(e),
                    suggestion=suggestion
                )
                failed_records.append(failed_record)

        for record in failed_records:
            self.uow.failed_records.save(record)

        status = ImportStatus.SUCCESS if failed_count == 0 else \
            ImportStatus.PARTIAL if success_count > 0 else ImportStatus.FAILED

        import_record = ImportRecord(
            id=import_id,
            import_type='forklift',
            file_name=csv_path.name,
            status=status,
            total_records=len(rows),
            success_count=success_count,
            failed_count=failed_count,
            imported_by=operator
        )
        self.uow.import_records.save(import_record)

        return import_record

    def import_charging_stations_from_json(self, json_path: Path, operator: str) -> ImportRecord:
        success_count = 0
        failed_count = 0
        failed_records: List[FailedRecord] = []

        import_id = self._generate_id()

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        stations = data.get('stations', []) if isinstance(data, dict) else data

        for row_num, station_data in enumerate(stations, start=1):
            try:
                if not station_data.get('id') or not station_data.get('name'):
                    raise ValueError('缺少必填字段: id 或 name')

                occupied_since = None
                if station_data.get('occupied_since'):
                    occupied_since = datetime.fromisoformat(station_data['occupied_since'])

                expected_free_time = None
                if station_data.get('expected_free_time'):
                    expected_free_time = datetime.fromisoformat(station_data['expected_free_time'])

                station = ChargingStation(
                    id=station_data['id'],
                    name=station_data['name'],
                    status=station_data.get('status', 'available'),
                    occupied_by=station_data.get('occupied_by'),
                    occupied_since=occupied_since,
                    expected_free_time=expected_free_time
                )

                self.uow.charging_stations.save(station)
                self._log_operation('create', 'charging_station', station.id, {'name': station.name}, operator)
                success_count += 1

            except Exception as e:
                failed_count += 1
                suggestion = self._get_suggestion('charging_station', str(e), station_data)
                failed_record = FailedRecord(
                    id=self._generate_id(),
                    import_id=import_id,
                    record_type='charging_station',
                    original_data=json.dumps(station_data, ensure_ascii=False),
                    row_number=row_num,
                    error_message=str(e),
                    suggestion=suggestion
                )
                failed_records.append(failed_record)

        for record in failed_records:
            self.uow.failed_records.save(record)

        status = ImportStatus.SUCCESS if failed_count == 0 else \
            ImportStatus.PARTIAL if success_count > 0 else ImportStatus.FAILED

        import_record = ImportRecord(
            id=import_id,
            import_type='charging_station',
            file_name=json_path.name,
            status=status,
            total_records=len(stations),
            success_count=success_count,
            failed_count=failed_count,
            imported_by=operator
        )
        self.uow.import_records.save(import_record)

        return import_record

    def import_tasks_from_csv(self, csv_path: Path, operator: str) -> ImportRecord:
        success_count = 0
        failed_count = 0
        failed_records: List[FailedRecord] = []

        import_id = self._generate_id()

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        for row_num, row in enumerate(rows, start=2):
            try:
                if not row.get('id') or not row.get('title'):
                    raise ValueError('缺少必填字段: id 或 title')

                priority = int(row.get('priority', 1))
                if priority < 1 or priority > 5:
                    raise ValueError(f'优先级必须在 1-5 之间, 当前值: {priority}')

                scheduled_date = None
                if row.get('scheduled_date'):
                    scheduled_date = date.fromisoformat(row['scheduled_date'])

                estimated_duration = int(row.get('estimated_duration', 60))

                task = Task(
                    id=row['id'],
                    title=row['title'],
                    description=row.get('description', ''),
                    priority=priority,
                    assigned_forklift=row.get('assigned_forklift'),
                    assigned_operator=row.get('assigned_operator'),
                    scheduled_date=scheduled_date,
                    shift=row.get('shift'),
                    estimated_duration=estimated_duration
                )

                self.uow.tasks.save(task)
                self._log_operation('create', 'task', task.id, {'title': task.title}, operator)
                success_count += 1

            except Exception as e:
                failed_count += 1
                suggestion = self._get_suggestion('task', str(e), row)
                failed_record = FailedRecord(
                    id=self._generate_id(),
                    import_id=import_id,
                    record_type='task',
                    original_data=json.dumps(row, ensure_ascii=False),
                    row_number=row_num,
                    error_message=str(e),
                    suggestion=suggestion
                )
                failed_records.append(failed_record)

        for record in failed_records:
            self.uow.failed_records.save(record)

        status = ImportStatus.SUCCESS if failed_count == 0 else \
            ImportStatus.PARTIAL if success_count > 0 else ImportStatus.FAILED

        import_record = ImportRecord(
            id=import_id,
            import_type='task',
            file_name=csv_path.name,
            status=status,
            total_records=len(rows),
            success_count=success_count,
            failed_count=failed_count,
            imported_by=operator
        )
        self.uow.import_records.save(import_record)

        return import_record

    def _get_suggestion(self, record_type: str, error: str, data: Dict[str, Any]) -> str:
        if '缺少必填字段' in error:
            if 'id' in error:
                return '请为记录添加唯一的 id 字段，格式建议: FL001'
            if 'name' in error:
                return '请添加 name 字段，例如: 1号叉车'
            if 'title' in error:
                return '请添加 title 字段，例如: A区卸货'
        if '电量必须' in error:
            return '请将 battery_level 修改为 0-100 之间的整数'
        if '优先级必须' in error:
            return '请将 priority 修改为 1-5 之间的整数, 5为最高优先级'
        if 'isoformat' in error:
            return '日期格式错误，请使用 YYYY-MM-DD 格式，例如: 2024-01-15'
        return '请检查数据格式是否符合要求'

    def resolve_failed_record(self, record_id: str, operator: str) -> bool:
        record = self.uow.failed_records.get_by_id(record_id)
        if not record:
            return False

        record.resolved = True
        self.uow.failed_records.save(record)
        self._log_operation('resolve', 'failed_record', record_id, {}, operator)
        return True
