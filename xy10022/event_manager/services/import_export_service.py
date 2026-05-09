import csv
import json
from typing import List, Dict, Any
from pathlib import Path
from io import StringIO

from ..models import Event, Registration, User
from ..exceptions import ImportExportError, NotFoundError
from ..logger import log_action, log_error
from ..utils import format_datetime

class ImportExportService:
    @staticmethod
    def export_registrations_to_csv(registrations: List[Registration]) -> str:
        output = StringIO()
        fieldnames = [
            'id', 'event_id', 'participant_name', 'participant_email', 
            'participant_phone', 'status', 'notes', 'created_at', 'updated_at'
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for reg in registrations:
            writer.writerow({
                'id': reg.id,
                'event_id': reg.event_id,
                'participant_name': reg.participant_name,
                'participant_email': reg.participant_email or '',
                'participant_phone': reg.participant_phone or '',
                'status': reg.status.value,
                'notes': reg.notes or '',
                'created_at': format_datetime(reg.created_at),
                'updated_at': format_datetime(reg.updated_at)
            })
        
        return output.getvalue()

    @staticmethod
    def export_registrations_to_json(registrations: List[Registration]) -> str:
        data = []
        for reg in registrations:
            data.append({
                'id': reg.id,
                'event_id': reg.event_id,
                'participant_name': reg.participant_name,
                'participant_email': reg.participant_email,
                'participant_phone': reg.participant_phone,
                'status': reg.status.value,
                'notes': reg.notes,
                'extra_data': reg.extra_data,
                'created_at': format_datetime(reg.created_at),
                'updated_at': format_datetime(reg.updated_at)
            })
        return json.dumps(data, ensure_ascii=False, indent=2)

    @staticmethod
    def export_events_to_csv(events: List[Event]) -> str:
        output = StringIO()
        fieldnames = [
            'id', 'title', 'description', 'location', 'start_time', 
            'end_time', 'max_participants', 'status', 'created_by', 'created_at'
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for event in events:
            writer.writerow({
                'id': event.id,
                'title': event.title,
                'description': event.description or '',
                'location': event.location or '',
                'start_time': format_datetime(event.start_time),
                'end_time': format_datetime(event.end_time),
                'max_participants': event.max_participants or '',
                'status': event.status.value,
                'created_by': event.created_by,
                'created_at': format_datetime(event.created_at)
            })
        
        return output.getvalue()

    @staticmethod
    def import_registrations_from_csv(csv_content: str) -> List[Dict]:
        registrations = []
        try:
            reader = csv.DictReader(StringIO(csv_content))
            for row in reader:
                reg = {
                    'participant_name': row.get('participant_name', '').strip(),
                    'participant_email': row.get('participant_email', '').strip() or None,
                    'participant_phone': row.get('participant_phone', '').strip() or None,
                    'notes': row.get('notes', '').strip() or None
                }
                if extra := row.get('extra_data'):
                    try:
                        reg['extra_data'] = json.loads(extra)
                    except:
                        pass
                registrations.append(reg)
        except Exception as e:
            raise ImportExportError(f'CSV解析失败: {e}')
        
        return registrations

    @staticmethod
    def import_registrations_from_json(json_content: str) -> List[Dict]:
        try:
            data = json.loads(json_content)
            if not isinstance(data, list):
                raise ImportExportError('JSON数据必须是数组格式')
            return data
        except json.JSONDecodeError as e:
            raise ImportExportError(f'JSON解析失败: {e}')

    @staticmethod
    def save_to_file(content: str, file_path: str) -> Path:
        path = Path(file_path)
        try:
            path.write_text(content, encoding='utf-8')
            return path
        except Exception as e:
            raise ImportExportError(f'写入文件失败: {e}')

    @staticmethod
    def read_from_file(file_path: str) -> str:
        path = Path(file_path)
        if not path.exists():
            raise ImportExportError(f'文件不存在: {file_path}')
        try:
            return path.read_text(encoding='utf-8')
        except Exception as e:
            raise ImportExportError(f'读取文件失败: {e}')
