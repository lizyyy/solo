"""YAML 配置文件解析"""

from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .models import (
    CaseDefinition,
    HardwareConfig,
    TransferConfig,
    TransferMethod,
)


class ConfigParser:
    """YAML 配置解析器"""
    
    def parse_file(self, file_path: Path) -> List[CaseDefinition]:
        """从 YAML 文件解析用例列表"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            return []
        
        cases_data = data.get('cases', [])
        global_hardware = self._parse_hardware(data.get('hardware', {}))
        
        cases = []
        for case_data in cases_data:
            case_def = self._parse_case(case_data, global_hardware)
            cases.append(case_def)
        
        return cases
    
    def _parse_case(self, case_data: Dict, default_hardware: HardwareConfig) -> CaseDefinition:
        """解析单个用例"""
        name = case_data.get('name', 'unnamed')
        description = case_data.get('description', '')
        category = case_data.get('category', 'custom')
        tags = case_data.get('tags', [])
        
        hardware = default_hardware
        if 'hardware' in case_data:
            hardware = self._parse_hardware(case_data['hardware'])
        
        config = self._parse_transfer_config(case_data.get('config', {}), hardware)
        
        return CaseDefinition(
            name=name,
            description=description,
            config=config,
            category=category,
            tags=tags
        )
    
    def _parse_hardware(self, hardware_data: Dict) -> HardwareConfig:
        """解析硬件配置"""
        return HardwareConfig(
            disk_bandwidth_mbps=hardware_data.get('disk_bandwidth_mbps', 100.0),
            network_bandwidth_mbps=hardware_data.get('network_bandwidth_mbps', 100.0),
            cpu_cores=hardware_data.get('cpu_cores', 4),
            memory_gb=hardware_data.get('memory_gb', 16),
            page_cache_size_mb=hardware_data.get('page_cache_size_mb', 1024)
        )
    
    def _parse_transfer_config(self, config_data: Dict, hardware: HardwareConfig) -> TransferConfig:
        """解析传输配置"""
        method_str = config_data.get('method', 'read_write').lower()
        if method_str == 'read_write':
            method = TransferMethod.READ_WRITE
        elif method_str == 'mmap_write':
            method = TransferMethod.MMAP_WRITE
        elif method_str == 'sendfile':
            method = TransferMethod.SENDFILE
        else:
            method = TransferMethod.READ_WRITE
        
        return TransferConfig(
            file_size_mb=config_data.get('file_size_mb', 100.0),
            method=method,
            page_cache_hit=config_data.get('page_cache_hit', False),
            use_mmap=config_data.get('use_mmap', False),
            use_sendfile=config_data.get('use_sendfile', False),
            use_dma_sg=config_data.get('use_dma_sg', False),
            use_tls=config_data.get('use_tls', False),
            use_compression=config_data.get('use_compression', False),
            compression_ratio=config_data.get('compression_ratio', 2.0),
            chunk_size_kb=config_data.get('chunk_size_kb', 64),
            hardware=hardware
        )
    
    def generate_template(self, output_path: Path):
        """生成配置文件模板"""
        template = {
            'hardware': {
                'disk_bandwidth_mbps': 100.0,
                'network_bandwidth_mbps': 100.0,
                'cpu_cores': 4,
                'memory_gb': 16,
                'page_cache_size_mb': 1024
            },
            'cases': [
                {
                    'name': 'traditional_read_write',
                    'description': '传统 read + write 方式',
                    'category': 'comparison',
                    'tags': ['traditional', 'baseline'],
                    'config': {
                        'file_size_mb': 100.0,
                        'method': 'read_write',
                        'page_cache_hit': False,
                        'use_mmap': False,
                        'use_sendfile': False,
                        'use_dma_sg': False,
                        'use_tls': False,
                        'use_compression': False,
                        'chunk_size_kb': 64
                    }
                },
                {
                    'name': 'sendfile_zero_copy',
                    'description': 'sendfile 零拷贝方式',
                    'category': 'comparison',
                    'tags': ['optimized', 'zero-copy'],
                    'config': {
                        'file_size_mb': 100.0,
                        'method': 'sendfile',
                        'page_cache_hit': False,
                        'use_mmap': False,
                        'use_sendfile': True,
                        'use_dma_sg': True,
                        'use_tls': False,
                        'use_compression': False,
                        'chunk_size_kb': 64
                    }
                }
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(template, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
