#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
状态存储模块 - Storage Module

方案的保存与加载：
- SchemeStorage: 方案存储管理器
"""

import os
import json
import shutil
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict, is_dataclass, field
from pathlib import Path
from datetime import datetime
import uuid

from pvchecker import (
    PVModule,
    RoofZone,
    InverterMPPT,
    StringConfig,
    RiskItem,
    AnalysisResult
)
from pvchecker.solver import ConfigurationSolution, SolutionScore, SolutionType


class StorageError(Exception):
    """存储操作错误"""
    pass


def _custom_json_encoder(obj: Any) -> Any:
    """自定义JSON编码器，处理枚举和数据类"""
    if isinstance(obj, Enum):
        return obj.value
    if is_dataclass(obj) and not isinstance(obj, type):
        return asdict(obj)
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _dict_to_dataclass(data: Dict, dataclass_type: type) -> Any:
    """将字典转换为数据类实例"""
    if not is_dataclass(dataclass_type):
        return data
    
    field_types = {f.name: f.type for f in dataclass_type.__dataclass_fields__.values()}
    
    processed_data = {}
    for key, value in data.items():
        if key in field_types:
            field_type = field_types[key]
            
            if hasattr(field_type, '__args__'):
                origin = getattr(field_type, '__origin__', None)
                if origin is list and hasattr(field_type, '__args__'):
                    item_type = field_type.__args__[0]
                    if is_dataclass(item_type):
                        processed_data[key] = [
                            _dict_to_dataclass(item, item_type) 
                            for item in value
                        ] if value else []
                    continue
            
            if is_dataclass(field_type) and isinstance(value, dict):
                processed_data[key] = _dict_to_dataclass(value, field_type)
                continue
            
            if key == 'solution_type' and isinstance(value, str):
                try:
                    processed_data[key] = SolutionType(value)
                    continue
                except ValueError:
                    pass
            
            processed_data[key] = value
    
    return dataclass_type(**processed_data)


@dataclass
class SavedScheme:
    """保存的方案完整数据"""
    scheme_id: str
    name: str
    created_at: str
    updated_at: str
    description: str = ""
    
    module_params: Optional[Dict] = None
    roof_zones: Optional[List[Dict]] = None
    inverter_params: Optional[Dict] = None
    shading_matrix: Optional[List[List[float]]] = None
    
    solutions: Optional[List[Dict]] = None
    selected_solution_id: Optional[str] = None
    
    risks: Optional[List[Dict]] = None
    
    environment_params: Dict = field(default_factory=lambda: {
        'min_temp': -10.0,
        'max_temp': 60.0,
        'reference_irradiance': 1000.0
    })
    
    metadata: Dict = field(default_factory=dict)


class SchemeStorage:
    """方案存储管理器
    
    负责方案的保存、加载、列表管理。
    
    存储结构：
    saved_schemes/
    ├── index.json              # 方案索引
    └── schemes/
        ├── scheme_001.json
        ├── scheme_002.json
        └── ...
    """
    
    DEFAULT_STORAGE_DIR = Path.home() / ".pvchecker" / "saved_schemes"
    
    def __init__(self, storage_dir: Optional[Union[str, Path]] = None):
        """
        Args:
            storage_dir: 存储目录路径，None表示使用默认路径
        """
        if storage_dir is None:
            self._storage_dir = self.DEFAULT_STORAGE_DIR
        else:
            self._storage_dir = Path(storage_dir)
        
        self._schemes_dir = self._storage_dir / "schemes"
        self._index_path = self._storage_dir / "index.json"
        
        self._ensure_directories()
        self._index: Dict[str, Any] = self._load_index()
    
    def _ensure_directories(self):
        """确保存储目录存在"""
        try:
            self._storage_dir.mkdir(parents=True, exist_ok=True)
            self._schemes_dir.mkdir(parents=True, exist_ok=True)
            
            if not self._index_path.exists():
                default_index = {
                    'version': '1.0',
                    'schemes': [],
                    'last_updated': None
                }
                with open(self._index_path, 'w', encoding='utf-8') as f:
                    json.dump(default_index, f, ensure_ascii=False, indent=2)
                    
        except Exception as e:
            raise StorageError(f"无法创建存储目录: {e}")
    
    def _load_index(self) -> Dict[str, Any]:
        """加载方案索引"""
        if not self._index_path.exists():
            return {
                'version': '1.0',
                'schemes': [],
                'last_updated': None
            }
        
        try:
            with open(self._index_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            backup_path = self._index_path.with_suffix('.json.bak')
            shutil.copy2(self._index_path, backup_path)
            return {
                'version': '1.0',
                'schemes': [],
                'last_updated': None
            }
        except Exception as e:
            raise StorageError(f"加载索引失败: {e}")
    
    def _save_index(self):
        """保存方案索引"""
        try:
            self._index['last_updated'] = datetime.now().isoformat()
            with open(self._index_path, 'w', encoding='utf-8') as f:
                json.dump(self._index, f, ensure_ascii=False, indent=2, default=_custom_json_encoder)
        except Exception as e:
            raise StorageError(f"保存索引失败: {e}")
    
    def _generate_scheme_id(self) -> str:
        """生成唯一的方案ID"""
        return f"scheme_{uuid.uuid4().hex[:8]}"
    
    def save(
        self,
        name: str,
        module: Optional[PVModule] = None,
        roof_zones: Optional[List[RoofZone]] = None,
        inverter: Optional[InverterMPPT] = None,
        shading_matrix: Optional[List[List[float]]] = None,
        solutions: Optional[List[ConfigurationSolution]] = None,
        selected_solution_id: Optional[str] = None,
        risks: Optional[List[RiskItem]] = None,
        environment_params: Optional[Dict] = None,
        description: str = "",
        scheme_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """保存方案
        
        Args:
            name: 方案名称
            module: 组件参数
            roof_zones: 屋面分区列表
            inverter: 逆变器参数
            shading_matrix: 遮挡系数矩阵 (12x24)
            solutions: 方案列表
            selected_solution_id: 选中的方案ID
            risks: 风险列表
            environment_params: 环境参数
            description: 方案描述
            scheme_id: 指定方案ID（用于更新），None表示新建
            metadata: 额外元数据
            
        Returns:
            保存的方案ID
        """
        now = datetime.now().isoformat()
        
        if scheme_id is None:
            scheme_id = self._generate_scheme_id()
            is_new = True
        else:
            is_new = False
        
        saved_scheme = SavedScheme(
            scheme_id=scheme_id,
            name=name,
            created_at=now if is_new else self._get_scheme_created_at(scheme_id),
            updated_at=now,
            description=description,
            module_params=asdict(module) if module else None,
            roof_zones=[asdict(z) for z in roof_zones] if roof_zones else None,
            inverter_params=asdict(inverter) if inverter else None,
            shading_matrix=shading_matrix,
            solutions=[asdict(s) for s in solutions] if solutions else None,
            selected_solution_id=selected_solution_id,
            risks=[asdict(r) for r in risks] if risks else None,
            environment_params=environment_params or {
                'min_temp': -10.0,
                'max_temp': 60.0,
                'reference_irradiance': 1000.0
            },
            metadata=metadata or {}
        )
        
        scheme_path = self._schemes_dir / f"{scheme_id}.json"
        
        try:
            with open(scheme_path, 'w', encoding='utf-8') as f:
                json.dump(
                    asdict(saved_scheme),
                    f,
                    ensure_ascii=False,
                    indent=2,
                    default=_custom_json_encoder
                )
        except Exception as e:
            raise StorageError(f"保存方案失败: {e}")
        
        self._update_index(saved_scheme, is_new)
        
        return scheme_id
    
    def _get_scheme_created_at(self, scheme_id: str) -> str:
        """获取方案创建时间"""
        for s in self._index.get('schemes', []):
            if s.get('scheme_id') == scheme_id:
                return s.get('created_at', datetime.now().isoformat())
        return datetime.now().isoformat()
    
    def _update_index(self, saved_scheme: SavedScheme, is_new: bool):
        """更新方案索引"""
        schemes = self._index.get('schemes', [])
        
        index_entry = {
            'scheme_id': saved_scheme.scheme_id,
            'name': saved_scheme.name,
            'created_at': saved_scheme.created_at,
            'updated_at': saved_scheme.updated_at,
            'description': saved_scheme.description,
            'total_modules': (
                sum(z.get('module_count', 0) for z in saved_scheme.roof_zones)
                if saved_scheme.roof_zones else 0
            ),
            'estimated_power': (
                saved_scheme.module_params.get('p_max', 0) * 
                (sum(z.get('module_count', 0) for z in saved_scheme.roof_zones)
                 if saved_scheme.roof_zones else 0)
            ) if saved_scheme.module_params else 0
        }
        
        if is_new:
            schemes.append(index_entry)
        else:
            for i, s in enumerate(schemes):
                if s.get('scheme_id') == saved_scheme.scheme_id:
                    schemes[i] = index_entry
                    break
        
        self._index['schemes'] = schemes
        self._save_index()
    
    def load(self, scheme_id: str) -> Optional[SavedScheme]:
        """加载指定方案
        
        Args:
            scheme_id: 方案ID
            
        Returns:
            SavedScheme对象，如果不存在则返回None
        """
        scheme_path = self._schemes_dir / f"{scheme_id}.json"
        
        if not scheme_path.exists():
            return None
        
        try:
            with open(scheme_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return _dict_to_dataclass(data, SavedScheme)
            
        except Exception as e:
            raise StorageError(f"加载方案失败: {e}")
    
    def delete(self, scheme_id: str) -> bool:
        """删除指定方案
        
        Args:
            scheme_id: 方案ID
            
        Returns:
            是否成功删除
        """
        scheme_path = self._schemes_dir / f"{scheme_id}.json"
        
        if not scheme_path.exists():
            return False
        
        try:
            scheme_path.unlink()
        except Exception as e:
            raise StorageError(f"删除方案文件失败: {e}")
        
        schemes = self._index.get('schemes', [])
        schemes = [s for s in schemes if s.get('scheme_id') != scheme_id]
        self._index['schemes'] = schemes
        self._save_index()
        
        return True
    
    def list(self, include_details: bool = False) -> List[Dict[str, Any]]:
        """列出所有保存的方案
        
        Args:
            include_details: 是否包含详细信息
            
        Returns:
            方案列表
        """
        schemes = self._index.get('schemes', [])
        
        if not include_details:
            return schemes
        
        result = []
        for entry in schemes:
            scheme_id = entry.get('scheme_id')
            if scheme_id:
                scheme = self.load(scheme_id)
                if scheme:
                    result.append({
                        'index_entry': entry,
                        'full_data': asdict(scheme)
                    })
                else:
                    result.append({'index_entry': entry})
        
        return result
    
    def search(self, keyword: str) -> List[Dict[str, Any]]:
        """按关键词搜索方案
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            匹配的方案列表
        """
        keyword = keyword.lower()
        schemes = self._index.get('schemes', [])
        
        results = []
        for entry in schemes:
            name = entry.get('name', '').lower()
            description = entry.get('description', '').lower()
            
            if keyword in name or keyword in description:
                results.append(entry)
        
        return results
    
    def copy(self, source_scheme_id: str, new_name: str) -> Optional[str]:
        """复制方案
        
        Args:
            source_scheme_id: 源方案ID
            new_name: 新方案名称
            
        Returns:
            新方案ID，如果失败则返回None
        """
        source_scheme = self.load(source_scheme_id)
        
        if source_scheme is None:
            return None
        
        new_scheme_id = self._generate_scheme_id()
        
        return self.save(
            name=new_name,
            module=_dict_to_dataclass(source_scheme.module_params, PVModule) 
                   if source_scheme.module_params else None,
            roof_zones=[_dict_to_dataclass(z, RoofZone) for z in source_scheme.roof_zones]
                       if source_scheme.roof_zones else None,
            inverter=_dict_to_dataclass(source_scheme.inverter_params, InverterMPPT)
                     if source_scheme.inverter_params else None,
            shading_matrix=source_scheme.shading_matrix,
            environment_params=source_scheme.environment_params,
            description=f"{source_scheme.description} (副本)",
            scheme_id=new_scheme_id,
            metadata={
                'copied_from': source_scheme_id,
                'original_name': source_scheme.name
            }
        )
    
    def export_to_file(
        self,
        scheme_id: str,
        output_path: Union[str, Path]
    ) -> bool:
        """导出方案到指定文件
        
        Args:
            scheme_id: 方案ID
            output_path: 输出文件路径
            
        Returns:
            是否成功导出
        """
        scheme = self.load(scheme_id)
        
        if scheme is None:
            return False
        
        output_path = Path(output_path)
        
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(
                    asdict(scheme),
                    f,
                    ensure_ascii=False,
                    indent=2,
                    default=_custom_json_encoder
                )
            
            return True
            
        except Exception as e:
            raise StorageError(f"导出方案失败: {e}")
    
    def import_from_file(
        self,
        input_path: Union[str, Path],
        new_name: Optional[str] = None
    ) -> Optional[str]:
        """从文件导入方案
        
        Args:
            input_path: 输入文件路径
            new_name: 新方案名称（可选）
            
        Returns:
            导入后的方案ID
        """
        input_path = Path(input_path)
        
        if not input_path.exists():
            return None
        
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            scheme = _dict_to_dataclass(data, SavedScheme)
            
            name = new_name if new_name else scheme.name
            
            return self.save(
                name=name,
                module=_dict_to_dataclass(scheme.module_params, PVModule)
                       if scheme.module_params else None,
                roof_zones=[_dict_to_dataclass(z, RoofZone) for z in scheme.roof_zones]
                           if scheme.roof_zones else None,
                inverter=_dict_to_dataclass(scheme.inverter_params, InverterMPPT)
                         if scheme.inverter_params else None,
                shading_matrix=scheme.shading_matrix,
                environment_params=scheme.environment_params,
                description=scheme.description,
                metadata={
                    'imported_from': str(input_path),
                    'imported_at': datetime.now().isoformat()
                }
            )
            
        except Exception as e:
            raise StorageError(f"导入方案失败: {e}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取存储统计信息
        
        Returns:
            包含统计信息的字典
        """
        schemes = self._index.get('schemes', [])
        
        total_modules = 0
        total_power = 0
        
        for entry in schemes:
            total_modules += entry.get('total_modules', 0)
            total_power += entry.get('estimated_power', 0)
        
        return {
            'total_schemes': len(schemes),
            'storage_dir': str(self._storage_dir),
            'total_modules_across_schemes': total_modules,
            'total_estimated_power_w': total_power,
            'last_updated': self._index.get('last_updated'),
            'version': self._index.get('version', '1.0')
        }
    
    @property
    def storage_dir(self) -> Path:
        """获取存储目录"""
        return self._storage_dir


def save_current_analysis(
    name: str,
    module: PVModule,
    roof_zones: List[RoofZone],
    inverter: InverterMPPT,
    shading_matrix: Optional[List[List[float]]],
    solutions: List[ConfigurationSolution],
    risks: List[RiskItem],
    selected_solution_id: Optional[str] = None,
    environment_params: Optional[Dict] = None,
    description: str = "",
    storage_dir: Optional[Union[str, Path]] = None
) -> str:
    """保存当前分析结果的便捷函数
    
    Args:
        name: 方案名称
        module: 组件参数
        roof_zones: 屋面分区
        inverter: 逆变器参数
        shading_matrix: 遮挡系数矩阵
        solutions: 方案列表
        risks: 风险列表
        selected_solution_id: 选中方案ID
        environment_params: 环境参数
        description: 描述
        storage_dir: 存储目录
        
    Returns:
        保存的方案ID
    """
    storage = SchemeStorage(storage_dir)
    return storage.save(
        name=name,
        module=module,
        roof_zones=roof_zones,
        inverter=inverter,
        shading_matrix=shading_matrix,
        solutions=solutions,
        selected_solution_id=selected_solution_id,
        risks=risks,
        environment_params=environment_params,
        description=description
    )
