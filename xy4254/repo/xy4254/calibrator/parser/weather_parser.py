"""
天气预报解析器 - 解析天气预报数据文件
"""

import json
import csv
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class WeatherParser:
    """解析天气预报数据"""
    
    def __init__(self):
        self.data: Optional[List[Dict]] = None
        self.forecast_dates: List[str] = []
    
    def parse(self, file_path: str) -> List[Dict]:
        """
        解析天气预报文件（支持JSON或CSV格式）
        
        Args:
            file_path: 天气预报文件路径
            
        Returns:
            解析后的预报数据列表
            
        Raises:
            ValueError: 如果文件格式不正确
        """
        if file_path.endswith('.json'):
            return self._parse_json(file_path)
        elif file_path.endswith('.csv'):
            return self._parse_csv(file_path)
        else:
            raise ValueError(f"不支持的天气预报文件格式: {file_path}")
    
    def _parse_json(self, file_path: str) -> List[Dict]:
        """解析JSON格式的天气预报"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            if isinstance(raw_data, dict):
                if 'forecast' in raw_data:
                    raw_data = raw_data['forecast']
                else:
                    raw_data = [raw_data]
            
            self._validate_and_normalize(raw_data)
            self.data = raw_data
            self.forecast_dates = sorted(set(item['date'] for item in self.data))
            return self.data
        except json.JSONDecodeError as e:
            raise ValueError(f"天气预报JSON解析错误: {str(e)}")
    
    def _parse_csv(self, file_path: str) -> List[Dict]:
        """解析CSV格式的天气预报"""
        try:
            raw_data = []
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    raw_data.append(dict(row))
            
            self._validate_and_normalize(raw_data)
            self.data = raw_data
            self.forecast_dates = sorted(set(item['date'] for item in self.data))
            return self.data
        except Exception as e:
            raise ValueError(f"天气预报CSV解析错误: {str(e)}")
    
    def _validate_and_normalize(self, data: List[Dict]):
        """验证并规范化数据"""
        for i, item in enumerate(data):
            if 'date' not in item:
                raise ValueError(f"天气预报第{i+1}项缺少date字段")
            
            try:
                date_obj = datetime.strptime(str(item['date']), '%Y-%m-%d')
                item['date'] = date_obj.strftime('%Y-%m-%d')
            except ValueError:
                raise ValueError(f"天气预报第{i+1}项的date格式不正确，应为YYYY-MM-DD")
            
            item['cloud_cover'] = float(item.get('cloud_cover', 50))
            item['precipitation'] = float(item.get('precipitation', 0))
            item['wind_speed'] = float(item.get('wind_speed', 5))
            item['temp_avg'] = float(item.get('temp_avg', item.get('temperature', 20)))
            item['humidity_avg'] = float(item.get('humidity_avg', item.get('humidity', 60)))
            item['solar_irradiance'] = float(item.get('solar_irradiance', item.get('irradiance', 0)))
            
            if item['solar_irradiance'] == 0:
                cloud_factor = 1 - (item['cloud_cover'] / 100 * 0.7)
                item['solar_irradiance'] = 500 * cloud_factor
    
    def get_forecast_for_date(self, date_str: str) -> Optional[Dict]:
        """
        获取指定日期的天气预报
        
        Args:
            date_str: 日期字符串，格式YYYY-MM-DD
            
        Returns:
            该日期的预报数据，不存在则返回None
        """
        if not self.data:
            return None
        
        for item in self.data:
            if item['date'] == date_str:
                return item.copy()
        return None
    
    def get_next_three_days(self, reference_date: str = None) -> List[Dict]:
        """
        获取未来三天的天气预报
        
        Args:
            reference_date: 参考日期，默认为今天
            
        Returns:
            未来三天的预报数据列表
        """
        if not self.data:
            return []
        
        if reference_date is None:
            reference_date = datetime.now().strftime('%Y-%m-%d')
        
        try:
            ref_date = datetime.strptime(reference_date, '%Y-%m-%d')
        except ValueError:
            return []
        
        result = []
        for i in range(1, 4):
            target_date = ref_date + timedelta(days=i)
            forecast = self.get_forecast_for_date(target_date.strftime('%Y-%m-%d'))
            if forecast:
                result.append(forecast)
        
        return result
    
    def estimate_potential_evapotranspiration(self, date_str: str) -> Optional[float]:
        """
        估算潜在蒸散量（简化的Penman-Monteith公式）
        
        Args:
            date_str: 日期字符串
            
        Returns:
            蒸散量估计值（mm/天），无数据则返回None
        """
        forecast = self.get_forecast_for_date(date_str)
        if not forecast:
            return None
        
        temp = forecast['temp_avg']
        humidity = forecast['humidity_avg']
        wind = forecast['wind_speed']
        irradiance = forecast['solar_irradiance']
        
        delta = 4098 * (0.6108 * (17.27 * temp / (temp + 237.3))) / (temp + 237.3) ** 2
        gamma = 0.0665
        
        es = 0.6108 * (17.27 * temp / (temp + 237.3))
        ea = es * (humidity / 100)
        vpd = es - ea
        
        rn = irradiance * 0.75 * 0.0864
        g = 0
        
        et0 = (0.408 * delta * (rn - g) + gamma * 900 / (temp + 273) * wind * vpd) / (delta + gamma * (1 + 0.34 * wind))
        
        return max(0, et0)
    
    def get_summary(self) -> Dict:
        """获取数据摘要"""
        if not self.data:
            return {}
        
        temp_avg = sum(item['temp_avg'] for item in self.data) / len(self.data)
        humidity_avg = sum(item['humidity_avg'] for item in self.data) / len(self.data)
        irradiance_avg = sum(item['solar_irradiance'] for item in self.data) / len(self.data)
        
        return {
            'forecast_days': len(self.data),
            'dates': self.forecast_dates,
            'avg_temperature': round(temp_avg, 1),
            'avg_humidity': round(humidity_avg, 1),
            'avg_irradiance': round(irradiance_avg, 1)
        }
