"""
测试数据解析模块
"""

import pytest
import tempfile
import os
import json
import csv
from datetime import datetime, timedelta

from calibrator.parser import SensorParser, TrayParser, WeatherParser, InspectionParser


class TestSensorParser:
    """测试传感器解析器"""
    
    def test_parse_valid_csv(self):
        """测试解析有效的CSV文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['timestamp', 'tray_id', 'light_intensity', 'moisture', 'temperature', 'humidity'])
            writer.writerow(['2026-05-01 08:00:00', 'TRAY-01', 500.0, 65.0, 22.5, 60.0])
            writer.writerow(['2026-05-01 08:30:00', 'TRAY-01', 550.0, 64.5, 23.0, 58.0])
            writer.writerow(['2026-05-01 09:00:00', 'TRAY-02', 600.0, 70.0, 23.5, 55.0])
            temp_path = f.name
        
        try:
            parser = SensorParser()
            df = parser.parse(temp_path)
            
            assert len(df) == 3
            assert len(parser.tray_ids) == 2
            assert 'TRAY-01' in parser.tray_ids
            assert 'TRAY-02' in parser.tray_ids
        finally:
            os.unlink(temp_path)
    
    def test_get_tray_data(self):
        """测试获取指定苗盘的数据"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['timestamp', 'tray_id', 'light_intensity', 'moisture', 'temperature', 'humidity'])
            writer.writerow(['2026-05-01 08:00:00', 'TRAY-01', 500.0, 65.0, 22.5, 60.0])
            writer.writerow(['2026-05-01 08:30:00', 'TRAY-01', 550.0, 64.5, 23.0, 58.0])
            writer.writerow(['2026-05-01 09:00:00', 'TRAY-02', 600.0, 70.0, 23.5, 55.0])
            temp_path = f.name
        
        try:
            parser = SensorParser()
            parser.parse(temp_path)
            
            tray1_data = parser.get_tray_data('TRAY-01')
            assert len(tray1_data) == 2
            
            tray2_data = parser.get_tray_data('TRAY-02')
            assert len(tray2_data) == 1
        finally:
            os.unlink(temp_path)
    
    def test_missing_columns(self):
        """测试缺少必需列的情况"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['timestamp', 'tray_id', 'light_intensity'])
            writer.writerow(['2026-05-01 08:00:00', 'TRAY-01', 500.0])
            temp_path = f.name
        
        try:
            parser = SensorParser()
            with pytest.raises(ValueError, match='缺少必需列'):
                parser.parse(temp_path)
        finally:
            os.unlink(temp_path)
    
    def test_get_summary(self):
        """测试获取摘要信息"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['timestamp', 'tray_id', 'light_intensity', 'moisture', 'temperature', 'humidity'])
            writer.writerow(['2026-05-01 08:00:00', 'TRAY-01', 500.0, 65.0, 22.5, 60.0])
            writer.writerow(['2026-05-01 08:30:00', 'TRAY-01', 550.0, 64.5, 23.0, 58.0])
            writer.writerow(['2026-05-01 09:00:00', 'TRAY-02', 600.0, 70.0, 23.5, 55.0])
            temp_path = f.name
        
        try:
            parser = SensorParser()
            parser.parse(temp_path)
            
            summary = parser.get_summary()
            assert summary['total_records'] == 3
            assert summary['tray_count'] == 2
        finally:
            os.unlink(temp_path)


class TestTrayParser:
    """测试苗盘配置解析器"""
    
    def test_parse_valid_json(self):
        """测试解析有效的JSON配置"""
        tray_data = {
            'trays': [
                {
                    'tray_id': 'TRAY-01',
                    'variety_name': '樱桃番茄',
                    'stage': '幼苗期'
                },
                {
                    'tray_id': 'TRAY-02',
                    'variety_name': '黄瓜',
                    'stage': '成苗期'
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(tray_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = TrayParser()
            data = parser.parse(temp_path)
            
            assert len(data) == 2
            assert parser.get_tray_info('TRAY-01') is not None
            assert parser.get_tray_info('TRAY-02') is not None
        finally:
            os.unlink(temp_path)
    
    def test_parse_simple_array(self):
        """测试解析简单数组格式"""
        tray_data = [
            {
                'tray_id': 'TRAY-01',
                'variety_name': '辣椒',
                'stage': '催芽期'
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(tray_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = TrayParser()
            data = parser.parse(temp_path)
            assert len(data) == 1
        finally:
            os.unlink(temp_path)
    
    def test_missing_required_fields(self):
        """测试缺少必需字段的情况"""
        tray_data = [
            {
                'variety_name': '辣椒',
                'stage': '催芽期'
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(tray_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = TrayParser()
            with pytest.raises(ValueError, match='缺少必需字段'):
                parser.parse(temp_path)
        finally:
            os.unlink(temp_path)
    
    def test_get_variety_requirements(self):
        """测试获取品种需求参数"""
        tray_data = [
            {
                'tray_id': 'TRAY-01',
                'variety_name': '樱桃番茄',
                'stage': '幼苗期'
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(tray_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = TrayParser()
            parser.parse(temp_path)
            
            requirements = parser.get_variety_requirements('TRAY-01')
            assert 'dli_min' in requirements
            assert 'moisture_min' in requirements
            assert 'temp_min' in requirements
        finally:
            os.unlink(temp_path)
    
    def test_get_summary(self):
        """测试获取摘要"""
        tray_data = [
            {
                'tray_id': 'TRAY-01',
                'variety_name': '樱桃番茄',
                'stage': '幼苗期'
            },
            {
                'tray_id': 'TRAY-02',
                'variety_name': '黄瓜',
                'stage': '成苗期'
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(tray_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = TrayParser()
            parser.parse(temp_path)
            
            summary = parser.get_summary()
            assert summary['tray_count'] == 2
            assert '幼苗期' in summary['stage_distribution']
            assert '成苗期' in summary['stage_distribution']
        finally:
            os.unlink(temp_path)


class TestWeatherParser:
    """测试天气预报解析器"""
    
    def test_parse_json_format(self):
        """测试解析JSON格式天气预报"""
        weather_data = {
            'forecast': [
                {
                    'date': '2026-05-01',
                    'temp_avg': 22.5,
                    'humidity_avg': 65,
                    'cloud_cover': 30,
                    'wind_speed': 3.5,
                    'precipitation': 0
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(weather_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = WeatherParser()
            data = parser.parse(temp_path)
            
            assert len(data) == 1
            assert parser.get_forecast_for_date('2026-05-01') is not None
        finally:
            os.unlink(temp_path)
    
    def test_parse_csv_format(self):
        """测试解析CSV格式天气预报"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['date', 'temp_avg', 'humidity_avg', 'cloud_cover', 'wind_speed', 'precipitation'])
            writer.writerow(['2026-05-01', 22.5, 65, 30, 3.5, 0])
            writer.writerow(['2026-05-02', 24.0, 60, 50, 4.0, 20])
            temp_path = f.name
        
        try:
            parser = WeatherParser()
            data = parser.parse(temp_path)
            
            assert len(data) == 2
        finally:
            os.unlink(temp_path)
    
    def test_get_forecast_for_date(self):
        """测试获取指定日期的天气预报"""
        weather_data = [
            {
                'date': '2026-05-01',
                'temp_avg': 22.5
            },
            {
                'date': '2026-05-02',
                'temp_avg': 24.0
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(weather_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = WeatherParser()
            parser.parse(temp_path)
            
            forecast = parser.get_forecast_for_date('2026-05-01')
            assert forecast is not None
            assert forecast['temp_avg'] == 22.5
            
            forecast_none = parser.get_forecast_for_date('2026-12-31')
            assert forecast_none is None
        finally:
            os.unlink(temp_path)
    
    def test_get_summary(self):
        """测试获取天气预报摘要"""
        weather_data = [
            {
                'date': '2026-05-01',
                'temp_avg': 22.5,
                'humidity_avg': 65,
                'solar_irradiance': 400
            },
            {
                'date': '2026-05-02',
                'temp_avg': 24.0,
                'humidity_avg': 60,
                'solar_irradiance': 500
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(weather_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = WeatherParser()
            parser.parse(temp_path)
            
            summary = parser.get_summary()
            assert summary['forecast_days'] == 2
            assert summary['avg_temperature'] == pytest.approx(23.25, 0.1)
        finally:
            os.unlink(temp_path)


class TestInspectionParser:
    """测试人工巡检解析器"""
    
    def test_parse_json_format(self):
        """测试解析JSON格式巡检记录"""
        inspection_data = {
            'inspections': [
                {
                    'timestamp': '2026-05-01 09:00:00',
                    'tray_id': 'TRAY-01',
                    'inspector': '张三',
                    'moisture': '正常',
                    'appearance': '生长正常',
                    'notes': '',
                    'rating': 5
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(inspection_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = InspectionParser()
            data = parser.parse(temp_path)
            
            assert len(data) == 1
        finally:
            os.unlink(temp_path)
    
    def test_get_tray_inspections(self):
        """测试获取指定苗盘的巡检记录"""
        inspection_data = [
            {
                'timestamp': '2026-05-01 09:00:00',
                'tray_id': 'TRAY-01',
                'inspector': '张三',
                'rating': 5
            },
            {
                'timestamp': '2026-05-01 10:00:00',
                'tray_id': 'TRAY-01',
                'inspector': '李四',
                'rating': 4
            },
            {
                'timestamp': '2026-05-01 11:00:00',
                'tray_id': 'TRAY-02',
                'inspector': '王五',
                'rating': 5
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(inspection_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = InspectionParser()
            parser.parse(temp_path)
            
            tray1_inspections = parser.get_tray_inspections('TRAY-01')
            assert len(tray1_inspections) == 2
            
            latest = parser.get_latest_inspection('TRAY-01')
            assert latest is not None
            assert latest['inspector'] == '李四'
        finally:
            os.unlink(temp_path)
    
    def test_has_watering_issue_flag(self):
        """测试检测浇水问题标记"""
        inspection_data = [
            {
                'timestamp': '2026-05-01 09:00:00',
                'tray_id': 'TRAY-01',
                'moisture': '干',
                'notes': '基质干燥'
            },
            {
                'timestamp': '2026-05-01 09:00:00',
                'tray_id': 'TRAY-02',
                'moisture': '正常',
                'notes': ''
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(inspection_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = InspectionParser()
            parser.parse(temp_path)
            
            assert parser.has_watering_issue_flag('TRAY-01') == True
            assert parser.has_watering_issue_flag('TRAY-02') == False
        finally:
            os.unlink(temp_path)
    
    def test_get_summary(self):
        """测试获取巡检摘要"""
        inspection_data = [
            {
                'timestamp': '2026-05-01 09:00:00',
                'tray_id': 'TRAY-01',
                'moisture': '正常',
                'rating': 5
            },
            {
                'timestamp': '2026-05-01 10:00:00',
                'tray_id': 'TRAY-02',
                'moisture': '偏干',
                'rating': 3
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(inspection_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            parser = InspectionParser()
            parser.parse(temp_path)
            
            summary = parser.get_summary()
            assert summary['total_inspections'] == 2
            assert summary['inspected_tray_count'] == 2
        finally:
            os.unlink(temp_path)
