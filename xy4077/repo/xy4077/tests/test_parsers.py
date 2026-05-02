"""CSV解析器测试"""

import tempfile
from pathlib import Path
from datetime import datetime

import pytest

from exhibit_inspector.parsers import (
    parse_sensor_csv,
    parse_route_csv,
    parse_box_csv,
    parse_photo_csv,
    ValidationError,
)


class TestSensorParser:
    """传感器CSV解析器测试"""
    
    def test_parse_valid_sensor_csv(self):
        """测试解析有效的传感器CSV"""
        csv_content = """时间,箱号,传感器ID,X轴(g),Y轴(g),Z轴(g),温度(°C),湿度(%),设备型号
2025-01-15 08:00:00,BX-001,S001,0.1,0.1,1.0,18.5,55.0,SHK-2000
2025-01-15 08:01:00,BX-001,S001,0.12,0.08,1.02,18.6,55.2,SHK-2000
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            result = parse_sensor_csv(temp_path)
            
            assert result.total_rows == 2
            assert result.valid_rows == 2
            assert len(result.data) == 2
            assert result.has_errors is False
            
            record = result.data[0]
            assert record.box_id == "BX-001"
            assert record.sensor_id == "S001"
            assert record.temperature_celsius == 18.5
            assert record.humidity_pct == 55.0
            assert record.x_accel_g == 0.1
            assert record.y_accel_g == 0.1
            assert record.z_accel_g == 1.0
            
        finally:
            Path(temp_path).unlink()
    
    def test_parse_english_headers(self):
        """测试解析英文表头"""
        csv_content = """Time,BoxID,SensorID,X_Accel_G,Y_Accel_G,Z_Accel_G,Temperature_C,Humidity_Pct,DeviceModel
2025-01-15 08:00:00,BX-001,S001,0.1,0.1,1.0,18.5,55.0,SHK-2000
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            result = parse_sensor_csv(temp_path)
            
            assert result.valid_rows == 1
            assert result.data[0].box_id == "BX-001"
            
        finally:
            Path(temp_path).unlink()
    
    def test_parse_missing_columns(self):
        """测试解析缺少必要列的CSV"""
        csv_content = """时间,箱号,温度(°C)
2025-01-15 08:00:00,BX-001,18.5
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            result = parse_sensor_csv(temp_path)
            
            assert result.has_errors is True
            assert len(result.errors) > 0
            
        finally:
            Path(temp_path).unlink()


class TestRouteParser:
    """路书CSV解析器测试"""
    
    def test_parse_valid_route_csv(self):
        """测试解析有效的路书CSV"""
        csv_content = """批次编号,节点编号,阶段,地点,计划到达时间,计划出发时间,需要开箱,需要照片,需要签字
SH-20250115-001,001,始发地,北京博物馆,2025-01-15 08:00:00,2025-01-15 08:30:00,True,True,True
SH-20250115-001,002,装载中,北京博物馆停车场,2025-01-15 08:30:00,2025-01-15 09:00:00,False,True,False
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            result = parse_route_csv(temp_path, "SH-20250115-001")
            
            assert result.valid_rows == 2
            assert len(result.data) == 1
            
            route = result.data[0]
            assert len(route.nodes) == 2
            assert route.nodes[0].node_id == "001"
            assert route.nodes[0].location == "北京博物馆"
            assert route.nodes[0].requires_unboxing is True
            assert route.nodes[0].requires_photos is True
            assert route.nodes[0].requires_signature is True
            
        finally:
            Path(temp_path).unlink()


class TestBoxParser:
    """展箱清单CSV解析器测试"""
    
    def test_parse_valid_box_csv(self):
        """测试解析有效的展箱清单CSV"""
        csv_content = """箱号,展品名称,尺寸(长x宽x高cm),重量(kg),传感器ID,展品等级,备注
BX-001,青铜器·鼎,80x60x50,120.5,S001,一级,易碎文物
BX-002,瓷器·花瓶,40x40x60,15.2,S002,二级,含釉彩
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            result = parse_box_csv(temp_path, "SH-20250115-001")
            
            assert result.valid_rows == 2
            assert len(result.data) == 2
            
            box1 = result.data[0]
            assert box1.box_id == "BX-001"
            assert box1.exhibit_name == "青铜器·鼎"
            assert box1.weight_kg == 120.5
            assert box1.sensor_id == "S001"
            
            box2 = result.data[1]
            assert box2.box_id == "BX-002"
            assert box2.exhibit_name == "瓷器·花瓶"
            
        finally:
            Path(temp_path).unlink()


class TestPhotoParser:
    """照片清单CSV解析器测试"""
    
    def test_parse_valid_photo_csv(self):
        """测试解析有效的照片清单CSV"""
        csv_content = """照片编号,文件名,拍摄时间,箱号,节点编号,照片类型,拍摄人,备注
P001,IMG_20250115_080500.jpg,2025-01-15 08:05:00,BX-001,001,包装检查,张三,始发地包装完整
P002,IMG_20250115_083500.jpg,2025-01-15 08:35:00,BX-001,002,装载照片,李四,正在装车
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            result = parse_photo_csv(temp_path)
            
            assert result.valid_rows == 2
            assert len(result.data) == 2
            
            photo1 = result.data[0]
            assert photo1.photo_id == "P001"
            assert photo1.box_id == "BX-001"
            assert photo1.node_id == "001"
            assert photo1.photographer == "张三"
            
        finally:
            Path(temp_path).unlink()
