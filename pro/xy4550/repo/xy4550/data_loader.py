"""
数据加载器模块
负责导入 CSV 和 JSON 格式的试验数据
"""
import os
import json
import pandas as pd
from typing import Dict, List, Any, Optional
from config import SAMPLES_DIR, PROCESSED_DIR


class DataLoader:
    """数据加载器"""
    
    def __init__(self):
        self.sample_registry = None
        self.stress_strain_curves = {}
        self.saturation_records = {}
        self.instrument_calibration = None
    
    def load_sample_registry(self, filepath: str = None) -> pd.DataFrame:
        """
        加载试样登记数据
        
        参数:
            filepath: CSV 文件路径，默认使用示例数据
            
        返回:
            pandas DataFrame
        """
        if filepath is None:
            filepath = os.path.join(SAMPLES_DIR, "sample_registry.csv")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"试样登记文件不存在: {filepath}")
        
        df = pd.read_csv(filepath)
        self.sample_registry = df
        return df
    
    def load_stress_strain_curve(self, test_id: str, filepath: str = None) -> Dict[str, Any]:
        """
        加载围压轴压曲线数据
        
        参数:
            test_id: 试验编号
            filepath: CSV 文件路径，默认使用示例数据
            
        返回:
            包含曲线数据的字典
        """
        if filepath is None:
            filepath = os.path.join(SAMPLES_DIR, "stress_strain_curve.csv")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"应力应变曲线文件不存在: {filepath}")
        
        df = pd.read_csv(filepath)
        
        # 筛选特定试验的数据
        test_data = df[df['test_id'] == test_id].copy()
        
        if test_data.empty:
            raise ValueError(f"未找到试验编号 {test_id} 的数据")
        
        # 提取数据列
        strain_data = test_data['strain(%)'].tolist()
        stress_data = test_data['deviator_stress(kPa)'].tolist()
        pore_pressure_data = test_data['pore_pressure(kPa)'].tolist()
        time_data = test_data['time(s)'].tolist()
        confining_pressure = test_data['confining_pressure(kPa)'].iloc[0] if not test_data.empty else 0.0
        
        result = {
            "test_id": test_id,
            "strain_data": strain_data,
            "stress_data": stress_data,
            "pore_pressure_data": pore_pressure_data,
            "time_data": time_data,
            "confining_pressure": float(confining_pressure),
            "data_points": len(strain_data),
            "raw_data": test_data.to_dict('records')
        }
        
        self.stress_strain_curves[test_id] = result
        return result
    
    def load_saturation_record(self, test_id: str, filepath: str = None) -> Dict[str, Any]:
        """
        加载饱和度记录
        
        参数:
            test_id: 试验编号
            filepath: JSON 文件路径，默认使用示例数据
            
        返回:
            包含饱和度记录的字典
        """
        if filepath is None:
            filepath = os.path.join(SAMPLES_DIR, "saturation_record.json")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"饱和度记录文件不存在: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 检查是否匹配试验编号
        if data.get('test_id') != test_id:
            # 尝试查找是否有多个试验的饱和度记录
            # 这里简化处理，直接返回加载的数据
            pass
        
        self.saturation_records[test_id] = data
        return data
    
    def load_instrument_calibration(self, filepath: str = None) -> Dict[str, Any]:
        """
        加载仪器校准表
        
        参数:
            filepath: JSON 文件路径，默认使用示例数据
            
        返回:
            包含仪器校准信息的字典
        """
        if filepath is None:
            filepath = os.path.join(SAMPLES_DIR, "instrument_calibration.json")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"仪器校准文件不存在: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.instrument_calibration = data
        return data
    
    def get_instrument_for_test(self, test_id: str) -> Optional[Dict[str, Any]]:
        """
        获取试验使用的仪器信息
        
        参数:
            test_id: 试验编号
            
        返回:
            仪器信息字典，如果没有找到则返回 None
        """
        if self.instrument_calibration is None:
            return None
        
        mapping = self.instrument_calibration.get('test_instrument_mapping', {})
        instrument_id = mapping.get(test_id)
        
        if not instrument_id:
            return None
        
        instruments = self.instrument_calibration.get('instruments', [])
        for inst in instruments:
            if inst.get('instrument_id') == instrument_id:
                return inst
        
        return None
    
    def load_all_test_data(self, test_id: str) -> Dict[str, Any]:
        """
        加载某个试验的所有相关数据
        
        参数:
            test_id: 试验编号
            
        返回:
            包含所有数据的字典
        """
        result = {
            "test_id": test_id,
            "sample_info": None,
            "stress_strain_curve": None,
            "saturation_record": None,
            "instrument_info": None
        }
        
        # 加载试样信息
        if self.sample_registry is not None:
            sample_data = self.sample_registry[self.sample_registry['test_id'] == test_id]
            if not sample_data.empty:
                result["sample_info"] = sample_data.iloc[0].to_dict()
        
        # 加载应力应变曲线
        try:
            result["stress_strain_curve"] = self.load_stress_strain_curve(test_id)
        except Exception as e:
            result["stress_strain_curve_error"] = str(e)
        
        # 加载饱和度记录
        try:
            result["saturation_record"] = self.load_saturation_record(test_id)
        except Exception as e:
            result["saturation_record_error"] = str(e)
        
        # 加载仪器信息
        result["instrument_info"] = self.get_instrument_for_test(test_id)
        
        return result
    
    def list_available_tests(self) -> List[str]:
        """
        列出所有可用的试验编号
        
        返回:
            试验编号列表
        """
        tests = set()
        
        # 从试样登记中获取
        if self.sample_registry is not None:
            tests.update(self.sample_registry['test_id'].tolist())
        
        # 从已加载的曲线中获取
        tests.update(self.stress_strain_curves.keys())
        
        # 从饱和度记录中获取
        tests.update(self.saturation_records.keys())
        
        return sorted(list(tests))
    
    def save_processed_data(self, test_id: str, data: Dict[str, Any], 
                              filename: str = None) -> str:
        """
        保存处理后的数据
        
        参数:
            test_id: 试验编号
            data: 要保存的数据
            filename: 文件名，默认使用 test_id
            
        返回:
            保存的文件路径
        """
        if not os.path.exists(PROCESSED_DIR):
            os.makedirs(PROCESSED_DIR)
        
        if filename is None:
            filename = f"{test_id}_processed.json"
        
        filepath = os.path.join(PROCESSED_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        
        return filepath
    
    def load_processed_data(self, test_id: str, filename: str = None) -> Optional[Dict[str, Any]]:
        """
        加载已处理的数据
        
        参数:
            test_id: 试验编号
            filename: 文件名，默认使用 test_id
            
        返回:
            已处理的数据字典，如果文件不存在则返回 None
        """
        if filename is None:
            filename = f"{test_id}_processed.json"
        
        filepath = os.path.join(PROCESSED_DIR, filename)
        
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return data
