"""测试数据模型"""
import unittest
from datetime import datetime

from freeze_dryer_reviewer.models import (
    BatchData, BatchMetadata, RecipeInfo, PhaseData,
    SensorData, TemperatureData, VacuumData, MoistureData
)


class TestSensorData(unittest.TestCase):
    """测试传感器数据模型"""
    
    def setUp(self):
        self.timestamps = [
            datetime(2024, 1, 15, 8, 0, 0),
            datetime(2024, 1, 15, 8, 15, 0),
            datetime(2024, 1, 15, 8, 30, 0),
        ]
        self.values = [20.0, 15.0, 10.0]
    
    def test_sensor_data_creation(self):
        """测试传感器数据创建"""
        sensor = SensorData(
            sensor_name="test_sensor",
            unit="°C",
            timestamps=self.timestamps,
            values=self.values
        )
        
        self.assertEqual(len(sensor), 3)
        self.assertEqual(sensor.sensor_name, "test_sensor")
        self.assertEqual(sensor.unit, "°C")
    
    def test_sensor_data_get_value_at_time(self):
        """测试获取指定时间点的值"""
        sensor = SensorData(
            sensor_name="test_sensor",
            unit="°C",
            timestamps=self.timestamps,
            values=self.values
        )
        
        target_time = datetime(2024, 1, 15, 8, 7, 30)
        value = sensor.get_value_at_time(target_time)
        
        self.assertAlmostEqual(value, 17.5)
    
    def test_sensor_data_get_stats(self):
        """测试获取统计信息"""
        sensor = SensorData(
            sensor_name="test_sensor",
            unit="°C",
            timestamps=self.timestamps,
            values=self.values
        )
        
        stats = sensor.get_stats()
        
        self.assertEqual(stats["count"], 3)
        self.assertEqual(stats["mean"], 15.0)
        self.assertEqual(stats["min"], 10.0)
        self.assertEqual(stats["max"], 20.0)


class TestTemperatureData(unittest.TestCase):
    """测试温度数据模型"""
    
    def setUp(self):
        self.timestamps = [
            datetime(2024, 1, 15, 8, 0, 0),
            datetime(2024, 1, 15, 8, 15, 0),
            datetime(2024, 1, 15, 8, 30, 0),
            datetime(2024, 1, 15, 8, 45, 0),
        ]
        self.values = [-5.0, -3.0, 2.0, 5.0]
    
    def test_temperature_data_creation(self):
        """测试温度数据创建"""
        temp = TemperatureData(
            sensor_name="shelf_temp",
            timestamps=self.timestamps,
            values=self.values
        )
        
        self.assertEqual(temp.unit, "°C")
    
    def test_has_exceeded(self):
        """测试是否超过阈值"""
        temp = TemperatureData(
            sensor_name="product_temp",
            timestamps=self.timestamps,
            values=self.values
        )
        
        self.assertTrue(temp.has_exceeded(0.0))
        self.assertFalse(temp.has_exceeded(10.0))
    
    def test_get_exceedance_periods(self):
        """测试获取超过阈值的时间段"""
        temp = TemperatureData(
            sensor_name="product_temp",
            timestamps=self.timestamps,
            values=self.values
        )
        
        periods = temp.get_exceedance_periods(0.0)
        
        self.assertEqual(len(periods), 1)
        self.assertGreater(periods[0]["duration_minutes"], 0)


class TestVacuumData(unittest.TestCase):
    """测试真空数据模型"""
    
    def setUp(self):
        self.timestamps = [
            datetime(2024, 1, 15, 8, i, 0) for i in range(20)
        ]
        self.values = [100.0, 110.0, 105.0, 95.0, 100.0] * 4
    
    def test_vacuum_data_creation(self):
        """测试真空数据创建"""
        vac = VacuumData(
            sensor_name="chamber_vacuum",
            timestamps=self.timestamps,
            values=self.values
        )
        
        self.assertEqual(vac.unit, "mTorr")
    
    def test_get_fluctuations(self):
        """测试获取真空波动"""
        vac = VacuumData(
            sensor_name="chamber_vacuum",
            timestamps=self.timestamps,
            values=self.values
        )
        
        fluctuations = vac.get_fluctuations(threshold_mtorr=20.0, window_minutes=5.0)
        
        self.assertIsInstance(fluctuations, list)


class TestBatchData(unittest.TestCase):
    """测试批次数据模型"""
    
    def setUp(self):
        self.metadata = BatchMetadata(
            batch_id="TEST-001",
            product_name="Test Product",
            equipment_id="FD-001"
        )
        
        self.recipe = RecipeInfo(
            product_name="Test Product",
            batch_size_ml=500.0,
            vial_count=100,
            fill_volume_ml=5.0,
            collapse_temp_c=-15.0
        )
    
    def test_batch_data_creation(self):
        """测试批次数据创建"""
        batch = BatchData(
            metadata=self.metadata,
            recipe=self.recipe
        )
        
        self.assertEqual(batch.metadata.batch_id, "TEST-001")
        self.assertEqual(batch.recipe.collapse_temp_c, -15.0)
    
    def test_has_valid_data(self):
        """测试是否有有效数据"""
        batch = BatchData(metadata=self.metadata)
        self.assertFalse(batch.has_valid_data())
        
        temp_data = TemperatureData(
            sensor_name="shelf_temp",
            timestamps=[datetime.now()],
            values=[20.0]
        )
        batch.shelf_temp = temp_data
        self.assertTrue(batch.has_valid_data())


if __name__ == "__main__":
    unittest.main()
