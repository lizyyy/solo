import pytest
import csv
import json
from io import StringIO
from datetime import datetime, timedelta

from event_manager.services.import_export_service import ImportExportService
from event_manager.models import Registration, Event, EventStatus, RegistrationStatus
from event_manager.exceptions import ImportExportError


class TestImportExportService:
    
    def test_export_registrations_to_csv(self, temp_db, test_event, test_user):
        registrations = [
            Registration(
                event_id=test_event.id,
                user_id=test_user.id,
                participant_name='张三',
                participant_email='zhangsan@example.com',
                participant_phone='13800138000',
                status=RegistrationStatus.CONFIRMED,
                notes='备注1'
            ),
            Registration(
                event_id=test_event.id,
                user_id=test_user.id,
                participant_name='李四',
                participant_email='lisi@example.com',
                participant_phone='13900139000',
                status=RegistrationStatus.PENDING,
                notes='备注2'
            )
        ]
        
        content = ImportExportService.export_registrations_to_csv(registrations)
        
        reader = csv.DictReader(StringIO(content))
        rows = list(reader)
        
        assert len(rows) == 2
        assert rows[0]['participant_name'] == '张三'
        assert rows[0]['status'] == 'confirmed'
        assert rows[1]['participant_name'] == '李四'
        assert rows[1]['status'] == 'pending'

    def test_export_registrations_to_json(self, temp_db, test_event, test_user):
        registrations = [
            Registration(
                event_id=test_event.id,
                user_id=test_user.id,
                participant_name='张三',
                participant_email='zhangsan@example.com',
                status=RegistrationStatus.CONFIRMED,
                created_at=datetime(2024, 1, 1, 10, 0, 0)
            )
        ]
        
        content = ImportExportService.export_registrations_to_json(registrations)
        data = json.loads(content)
        
        assert len(data) == 1
        assert data[0]['participant_name'] == '张三'
        assert data[0]['status'] == 'confirmed'

    def test_export_events_to_csv(self, temp_db, test_organizer):
        events = [
            Event(
                title='活动1',
                description='描述1',
                location='地点1',
                start_time=datetime(2024, 1, 15, 10, 0, 0),
                end_time=datetime(2024, 1, 15, 14, 0, 0),
                max_participants=100,
                status=EventStatus.PUBLISHED,
                created_by=test_organizer.id
            ),
            Event(
                title='活动2',
                location='地点2',
                start_time=datetime(2024, 2, 1, 9, 0, 0),
                status=EventStatus.DRAFT,
                created_by=test_organizer.id
            )
        ]
        
        content = ImportExportService.export_events_to_csv(events)
        
        reader = csv.DictReader(StringIO(content))
        rows = list(reader)
        
        assert len(rows) == 2
        assert rows[0]['title'] == '活动1'
        assert rows[0]['status'] == 'published'
        assert rows[1]['title'] == '活动2'
        assert rows[1]['status'] == 'draft'

    def test_import_registrations_from_csv(self):
        csv_content = '''participant_name,participant_email,participant_phone,notes
张三,zhangsan@example.com,13800138000,备注1
李四,lisi@example.com,13900139000,备注2
王五,,13700137000,
'''
        
        registrations = ImportExportService.import_registrations_from_csv(csv_content)
        
        assert len(registrations) == 3
        assert registrations[0]['participant_name'] == '张三'
        assert registrations[0]['participant_email'] == 'zhangsan@example.com'
        assert registrations[0]['notes'] == '备注1'
        assert registrations[2]['participant_email'] is None

    def test_import_registrations_from_json(self):
        json_content = '''
        [
            {"participant_name": "张三", "participant_email": "zhangsan@example.com"},
            {"participant_name": "李四", "participant_phone": "13900139000", "extra_data": {"age": 25}}
        ]
        '''
        
        registrations = ImportExportService.import_registrations_from_json(json_content)
        
        assert len(registrations) == 2
        assert registrations[0]['participant_name'] == '张三'
        assert registrations[1]['participant_phone'] == '13900139000'

    def test_import_invalid_json(self):
        invalid_json = '这不是JSON'
        
        with pytest.raises(ImportExportError):
            ImportExportService.import_registrations_from_json(invalid_json)

    def test_import_json_not_array(self):
        json_content = '{"key": "value"}'
        
        with pytest.raises(ImportExportError):
            ImportExportService.import_registrations_from_json(json_content)

    def test_save_and_read_file(self, tmp_path):
        test_content = '测试内容'
        file_path = str(tmp_path / 'test.txt')
        
        ImportExportService.save_to_file(test_content, file_path)
        
        read_content = ImportExportService.read_from_file(file_path)
        
        assert read_content == test_content

    def test_read_nonexistent_file(self):
        with pytest.raises(ImportExportError):
            ImportExportService.read_from_file('/nonexistent/path/file.txt')
