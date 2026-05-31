import os
import pytest
from models import Database
from schedule_service import ScheduleService, ScheduleError


@pytest.fixture
def db():
    test_db = "test_flight_schedule.db"
    if os.path.exists(test_db):
        os.remove(test_db)
    db = Database(test_db)
    yield db
    if os.path.exists(test_db):
        os.remove(test_db)


@pytest.fixture
def service(db):
    return ScheduleService(db)


class TestScheduleService:
    def test_create_new_schedule(self, service):
        data = {
            'batch_id': 'TEST001',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>包含返航点信息</kml>',
            'weather_snapshot': 'weather_20240501.png'
        }
        
        schedule, is_new = service.process_schedule(data, '操作员A')
        
        assert is_new is True
        assert schedule.batch_id == 'TEST001'
        assert schedule.return_point == '返航点_A'
        assert schedule.return_point_source == '航线KML'

    def test_idempotent_update_same_batch(self, service):
        data = {
            'batch_id': 'TEST002',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>包含返航点信息</kml>',
            'weather_snapshot': 'weather_20240501.png'
        }
        
        schedule1, is_new1 = service.process_schedule(data, '操作员A')
        assert is_new1 is True
        
        data['pilot'] = '李四'
        schedule2, is_new2 = service.process_schedule(data, '操作员B')
        
        assert is_new2 is False
        assert schedule2.id == schedule1.id
        assert schedule2.pilot == '李四'

    def test_kml_change_tracking(self, service):
        data = {
            'batch_id': 'TEST003',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>包含返航点信息</kml>',
            'weather_snapshot': 'weather_20240501.png'
        }
        
        service.process_schedule(data, '操作员A')
        
        data['kml_file'] = '<kml>修改后的航线 返航点</kml>'
        data['kml_change_reason'] = '避开新增高压线'
        service.process_schedule(data, '操作员B')
        
        history = service.db.get_kml_history_by_batch('TEST003')
        assert len(history) == 1
        assert history[0].modified_by == '操作员B'
        assert history[0].change_reason == '避开新增高压线'

    def test_weather_snapshot_history(self, service):
        data = {
            'batch_id': 'TEST004',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>包含返航点信息</kml>',
            'weather_snapshot': 'weather_v1.png'
        }
        
        service.process_schedule(data, '操作员A')
        
        data['weather_snapshot'] = 'weather_v2.png'
        service.process_schedule(data, '操作员B')
        
        history = service.db.get_weather_history_by_batch('TEST004')
        assert len(history) == 2
        assert history[0].operation_type == '更新'
        assert history[1].operation_type == '创建'

    def test_missing_return_point_from_kml(self, service):
        data = {
            'batch_id': 'TEST005',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>只有航线坐标没有返航标记</kml>',
            'weather_snapshot': 'weather.png'
        }
        
        with pytest.raises(ScheduleError) as excinfo:
            service.process_schedule(data, '操作员A')
        
        assert '返航点找不到了' in str(excinfo.value)
        assert '外场队长' in str(excinfo.value)
        
        issues = service.db.get_return_point_issues_by_batch('TEST005')
        assert len(issues) == 1
        assert issues[0].assignee == '外场队长'

    def test_return_point_from_battery(self, service):
        data = {
            'batch_id': 'TEST006',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>普通航线</kml>',
            'weather_snapshot': 'weather.png'
        }
        battery_record = 'battery_data_with_RTP_coordinates'
        
        schedule, is_new = service.process_schedule(data, '操作员A', battery_record)
        
        assert schedule.return_point == '返航点_B'
        assert schedule.return_point_source == '电池记录'

    def test_friendly_error_short_pilot_name(self, service):
        data = {
            'batch_id': 'TEST007',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>返航点</kml>',
            'weather_snapshot': 'weather.png'
        }
        
        with pytest.raises(ScheduleError) as excinfo:
            service.process_schedule(data, '操作员A')
        
        error_msg = str(excinfo.value)
        assert '飞行员' in error_msg
        assert '名字' in error_msg
        assert '写全了' in error_msg

    def test_get_kml_modifiers(self, service):
        data = {
            'batch_id': 'TEST008',
            'flight_date': '2024-05-01',
            'area': '大兴安岭A区',
            'pilot': '张三',
            'drone_id': 'DJI-001',
            'kml_file': '<kml>返航点 v1</kml>',
            'weather_snapshot': 'weather.png'
        }
        
        service.process_schedule(data, '操作员A')
        
        data['kml_file'] = '<kml>返航点 v2</kml>'
        data['kml_change_reason'] = '调整航线'
        service.process_schedule(data, '操作员B')
        
        result = service.get_kml_modifiers('TEST008')
        assert 'TEST008' in result
        assert '操作员B' in result
        assert '调整航线' in result

    def test_get_schedule_details_not_found(self, service):
        with pytest.raises(ScheduleError) as excinfo:
            service.get_schedule_details('NOTEXIST')
        
        assert '找不到' in str(excinfo.value)
        assert '批次编号' in str(excinfo.value)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
