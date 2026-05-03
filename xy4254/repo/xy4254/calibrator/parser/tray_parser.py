"""
苗盘品种解析器 - 解析苗盘品种JSON配置文件
"""

import json
from typing import Dict, List, Optional


class TrayParser:
    """解析苗盘品种JSON配置"""
    
    REQUIRED_FIELDS = ['tray_id', 'variety_name', 'stage']
    
    def __init__(self):
        self.data: Optional[List[Dict]] = None
        self.tray_map: Dict[str, Dict] = {}
    
    def parse(self, file_path: str) -> List[Dict]:
        """
        解析苗盘品种JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            解析后的苗盘配置列表
            
        Raises:
            ValueError: 如果文件格式不正确
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            if isinstance(raw_data, dict):
                if 'trays' in raw_data:
                    raw_data = raw_data['trays']
                else:
                    raw_data = [raw_data]
            
            self._validate_data(raw_data)
            self.data = raw_data
            self.tray_map = {tray['tray_id']: tray for tray in self.data}
            return self.data
        except json.JSONDecodeError as e:
            raise ValueError(f"苗盘配置文件 {file_path} JSON解析错误: {str(e)}")
        except FileNotFoundError:
            raise ValueError(f"苗盘配置文件 {file_path} 不存在")
        except Exception as e:
            raise ValueError(f"解析苗盘配置文件 {file_path} 失败: {str(e)}")
    
    def _validate_data(self, data: List[Dict]):
        """验证数据格式"""
        for i, tray in enumerate(data):
            missing = set(self.REQUIRED_FIELDS) - set(tray.keys())
            if missing:
                raise ValueError(f"苗盘配置第{i+1}项缺少必需字段: {', '.join(missing)}")
            
            if not isinstance(tray.get('tray_id'), str) or not tray.get('tray_id'):
                raise ValueError(f"苗盘配置第{i+1}项的tray_id无效")
    
    def get_tray_info(self, tray_id: str) -> Optional[Dict]:
        """
        获取指定苗盘的配置信息
        
        Args:
            tray_id: 苗盘ID
            
        Returns:
            苗盘配置信息，不存在则返回None
        """
        return self.tray_map.get(tray_id)
    
    def get_variety_requirements(self, tray_id: str) -> Dict:
        """
        获取品种的生长要求参数
        
        Args:
            tray_id: 苗盘ID
            
        Returns:
            包含DLI需求、湿度范围等参数的字典
        """
        tray_info = self.get_tray_info(tray_id)
        if not tray_info:
            return {}
        
        stage = tray_info.get('stage', '幼苗期')
        stage_requirements = self._get_stage_defaults(stage)
        
        requirements = {
            'dli_min': tray_info.get('dli_min', stage_requirements['dli_min']),
            'dli_optimal': tray_info.get('dli_optimal', stage_requirements['dli_optimal']),
            'dli_max': tray_info.get('dli_max', stage_requirements['dli_max']),
            'moisture_min': tray_info.get('moisture_min', stage_requirements['moisture_min']),
            'moisture_optimal': tray_info.get('moisture_optimal', stage_requirements['moisture_optimal']),
            'moisture_max': tray_info.get('moisture_max', stage_requirements['moisture_max']),
            'temp_min': tray_info.get('temp_min', stage_requirements['temp_min']),
            'temp_optimal': tray_info.get('temp_optimal', stage_requirements['temp_optimal']),
            'temp_max': tray_info.get('temp_max', stage_requirements['temp_max']),
        }
        
        return requirements
    
    def _get_stage_defaults(self, stage: str) -> Dict:
        """获取不同生长阶段的默认参数"""
        defaults = {
            '催芽期': {
                'dli_min': 5,
                'dli_optimal': 10,
                'dli_max': 15,
                'moisture_min': 70,
                'moisture_optimal': 85,
                'moisture_max': 95,
                'temp_min': 18,
                'temp_optimal': 25,
                'temp_max': 30,
            },
            '幼苗期': {
                'dli_min': 8,
                'dli_optimal': 15,
                'dli_max': 25,
                'moisture_min': 55,
                'moisture_optimal': 70,
                'moisture_max': 85,
                'temp_min': 15,
                'temp_optimal': 22,
                'temp_max': 28,
            },
            '成苗期': {
                'dli_min': 12,
                'dli_optimal': 20,
                'dli_max': 35,
                'moisture_min': 45,
                'moisture_optimal': 60,
                'moisture_max': 75,
                'temp_min': 12,
                'temp_optimal': 20,
                'temp_max': 26,
            },
            '炼苗期': {
                'dli_min': 15,
                'dli_optimal': 25,
                'dli_max': 40,
                'moisture_min': 35,
                'moisture_optimal': 50,
                'moisture_max': 65,
                'temp_min': 10,
                'temp_optimal': 18,
                'temp_max': 24,
            }
        }
        
        return defaults.get(stage, defaults['幼苗期'])
    
    def get_summary(self) -> Dict:
        """获取数据摘要"""
        if not self.data:
            return {}
        
        stage_counts = {}
        variety_counts = {}
        for tray in self.data:
            stage = tray.get('stage', '未知')
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            
            variety = tray.get('variety_name', '未知')
            variety_counts[variety] = variety_counts.get(variety, 0) + 1
        
        return {
            'tray_count': len(self.data),
            'tray_ids': list(self.tray_map.keys()),
            'stage_distribution': stage_counts,
            'variety_distribution': variety_counts
        }
