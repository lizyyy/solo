"""
状态存储模块
负责存储文件索引、元数据和人工标记状态（可用、需返录、含隐私）
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum


class MaterialStatus(Enum):
    """素材状态枚举"""
    PENDING = "pending"           # 待处理
    AVAILABLE = "available"       # 可用
    NEED_RERECORD = "need_rerecord"  # 需返录
    HAS_PRIVACY = "has_privacy"   # 含隐私


@dataclass
class MaterialState:
    """单个素材的状态"""
    # 基础标识
    file_path: str
    file_name: str
    file_hash: str = ""
    
    # 状态标记
    status: MaterialStatus = MaterialStatus.PENDING
    manual_tags: List[str] = field(default_factory=list)
    manual_notes: str = ""
    
    # 分类标记
    is_environment: bool = False   # 是否环境声
    is_wild_track: bool = False    # 是否补录声
    needs_review: bool = False      # 是否需要复审
    
    # 元数据缓存
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # 时间信息
    created_time: str = field(default_factory=lambda: datetime.now().isoformat())
    modified_time: str = field(default_factory=lambda: datetime.now().isoformat())
    
    # 关联信息
    linked_scene: str = ""
    linked_shot: str = ""
    linked_take: str = ""


@dataclass
class ProjectState:
    """项目级状态"""
    project_name: str = ""
    project_path: str = ""
    
    # 统计信息
    total_materials: int = 0
    available_count: int = 0
    need_rerecord_count: int = 0
    has_privacy_count: int = 0
    pending_count: int = 0
    
    # 环境声统计
    environment_track_count: int = 0
    wild_track_count: int = 0
    
    # 素材索引（按文件哈希）
    materials: Dict[str, MaterialState] = field(default_factory=dict)
    
    # 文件路径到哈希的映射
    path_to_hash: Dict[str, str] = field(default_factory=dict)
    
    # 场记关联
    field_logs: List[Dict[str, Any]] = field(default_factory=list)
    
    # 校验结果缓存
    validation_summary: Dict[str, Any] = field(default_factory=dict)
    
    # 元数据
    created_time: str = field(default_factory=lambda: datetime.now().isoformat())
    modified_time: str = field(default_factory=lambda: datetime.now().isoformat())
    version: str = "1.0.0"


class StateStore:
    """状态存储器"""
    
    # 默认的存储文件名
    DEFAULT_INDEX_FILE = ".field_recording_index.json"
    DEFAULT_STATE_DIR = ".field_recording_state"
    
    def __init__(self, project_path: str = None, storage_path: str = None):
        """
        初始化状态存储器
        
        Args:
            project_path: 项目路径（素材所在目录）
            storage_path: 存储文件路径（可选，默认存在项目目录下）
        """
        self.project_path = project_path
        self.storage_path = storage_path
        
        # 确定存储位置
        if storage_path:
            self.index_file = Path(storage_path)
        elif project_path:
            self.index_file = Path(project_path) / self.DEFAULT_INDEX_FILE
        else:
            # 使用当前目录
            self.index_file = Path.cwd() / self.DEFAULT_INDEX_FILE
        
        # 状态目录（用于存储更多详细数据）
        self.state_dir = self.index_file.parent / self.DEFAULT_STATE_DIR
        
        # 当前状态
        self.state = ProjectState()
        
        # 自动加载现有状态
        if self.index_file.exists():
            self.load()
    
    def load(self) -> bool:
        """
        从文件加载状态
        
        Returns:
            是否加载成功
        """
        try:
            if not self.index_file.exists():
                return False
            
            with open(self.index_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 反序列化
            self._deserialize_project_state(data)
            
            return True
        except Exception as e:
            print(f"加载状态文件时出错: {e}")
            return False
    
    def save(self) -> bool:
        """
        保存状态到文件
        
        Returns:
            是否保存成功
        """
        try:
            # 确保目录存在
            self.index_file.parent.mkdir(parents=True, exist_ok=True)
            
            # 序列化并保存
            data = self._serialize_project_state()
            
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # 更新修改时间
            self.state.modified_time = datetime.now().isoformat()
            
            return True
        except Exception as e:
            print(f"保存状态文件时出错: {e}")
            return False
    
    def _serialize_project_state(self) -> Dict[str, Any]:
        """
        序列化项目状态为字典
        
        Returns:
            序列化后的字典
        """
        # 序列化素材列表
        materials_dict = {}
        for file_hash, material in self.state.materials.items():
            materials_dict[file_hash] = {
                'file_path': material.file_path,
                'file_name': material.file_name,
                'file_hash': material.file_hash,
                'status': material.status.value,
                'manual_tags': material.manual_tags,
                'manual_notes': material.manual_notes,
                'is_environment': material.is_environment,
                'is_wild_track': material.is_wild_track,
                'needs_review': material.needs_review,
                'metadata': material.metadata,
                'created_time': material.created_time,
                'modified_time': material.modified_time,
                'linked_scene': material.linked_scene,
                'linked_shot': material.linked_shot,
                'linked_take': material.linked_take
            }
        
        return {
            'project_name': self.state.project_name,
            'project_path': self.state.project_path,
            'total_materials': self.state.total_materials,
            'available_count': self.state.available_count,
            'need_rerecord_count': self.state.need_rerecord_count,
            'has_privacy_count': self.state.has_privacy_count,
            'pending_count': self.state.pending_count,
            'environment_track_count': self.state.environment_track_count,
            'wild_track_count': self.state.wild_track_count,
            'materials': materials_dict,
            'path_to_hash': self.state.path_to_hash,
            'field_logs': self.state.field_logs,
            'validation_summary': self.state.validation_summary,
            'created_time': self.state.created_time,
            'modified_time': self.state.modified_time,
            'version': self.state.version
        }
    
    def _deserialize_project_state(self, data: Dict[str, Any]):
        """
        从字典反序列化项目状态
        
        Args:
            data: 序列化的数据字典
        """
        self.state.project_name = data.get('project_name', '')
        self.state.project_path = data.get('project_path', '')
        self.state.total_materials = data.get('total_materials', 0)
        self.state.available_count = data.get('available_count', 0)
        self.state.need_rerecord_count = data.get('need_rerecord_count', 0)
        self.state.has_privacy_count = data.get('has_privacy_count', 0)
        self.state.pending_count = data.get('pending_count', 0)
        self.state.environment_track_count = data.get('environment_track_count', 0)
        self.state.wild_track_count = data.get('wild_track_count', 0)
        self.state.path_to_hash = data.get('path_to_hash', {})
        self.state.field_logs = data.get('field_logs', [])
        self.state.validation_summary = data.get('validation_summary', {})
        self.state.created_time = data.get('created_time', datetime.now().isoformat())
        self.state.modified_time = data.get('modified_time', datetime.now().isoformat())
        self.state.version = data.get('version', '1.0.0')
        
        # 反序列化素材
        self.state.materials = {}
        materials_data = data.get('materials', {})
        for file_hash, material_data in materials_data.items():
            material = MaterialState(
                file_path=material_data.get('file_path', ''),
                file_name=material_data.get('file_name', ''),
                file_hash=material_data.get('file_hash', file_hash)
            )
            
            # 状态
            status_str = material_data.get('status', 'pending')
            try:
                material.status = MaterialStatus(status_str)
            except ValueError:
                material.status = MaterialStatus.PENDING
            
            # 其他属性
            material.manual_tags = material_data.get('manual_tags', [])
            material.manual_notes = material_data.get('manual_notes', '')
            material.is_environment = material_data.get('is_environment', False)
            material.is_wild_track = material_data.get('is_wild_track', False)
            material.needs_review = material_data.get('needs_review', False)
            material.metadata = material_data.get('metadata', {})
            material.created_time = material_data.get('created_time', datetime.now().isoformat())
            material.modified_time = material_data.get('modified_time', datetime.now().isoformat())
            material.linked_scene = material_data.get('linked_scene', '')
            material.linked_shot = material_data.get('linked_shot', '')
            material.linked_take = material_data.get('linked_take', '')
            
            self.state.materials[file_hash] = material
    
    def add_material(self, 
                      file_path: str, 
                      file_name: str, 
                      file_hash: str = "",
                      metadata: Dict[str, Any] = None) -> Optional[MaterialState]:
        """
        添加或更新素材
        
        Args:
            file_path: 文件路径
            file_name: 文件名
            file_hash: 文件哈希
            metadata: 元数据
            
        Returns:
            素材状态对象
        """
        # 如果没有提供哈希，使用文件路径作为临时键
        if not file_hash:
            file_hash = file_path
        
        # 检查是否已存在
        if file_hash in self.state.materials:
            # 更新现有素材
            material = self.state.materials[file_hash]
            material.modified_time = datetime.now().isoformat()
            if metadata:
                material.metadata.update(metadata)
        else:
            # 创建新素材
            material = MaterialState(
                file_path=file_path,
                file_name=file_name,
                file_hash=file_hash,
                metadata=metadata or {}
            )
            self.state.materials[file_hash] = material
            self.state.total_materials += 1
        
        # 更新路径到哈希的映射
        self.state.path_to_hash[file_path] = file_hash
        
        # 更新统计
        self._update_statistics()
        
        return material
    
    def get_material(self, file_hash: str = None, file_path: str = None) -> Optional[MaterialState]:
        """
        获取素材状态
        
        Args:
            file_hash: 文件哈希
            file_path: 文件路径（可选，用于通过路径查找）
            
        Returns:
            素材状态对象，未找到返回None
        """
        if file_hash and file_hash in self.state.materials:
            return self.state.materials[file_hash]
        
        if file_path:
            # 通过路径查找
            if file_path in self.state.path_to_hash:
                file_hash = self.state.path_to_hash[file_path]
                return self.state.materials.get(file_hash)
            
            # 尝试模糊匹配
            for material in self.state.materials.values():
                if material.file_path == file_path:
                    return material
        
        return None
    
    def update_material_status(self, 
                                status: MaterialStatus,
                                file_hash: str = None, 
                                file_path: str = None) -> bool:
        """
        更新素材状态
        
        Args:
            status: 新状态
            file_hash: 文件哈希
            file_path: 文件路径
            
        Returns:
            是否更新成功
        """
        material = self.get_material(file_hash=file_hash, file_path=file_path)
        if not material:
            return False
        
        material.status = status
        material.modified_time = datetime.now().isoformat()
        
        self._update_statistics()
        return True
    
    def tag_as_available(self, file_hash: str = None, file_path: str = None) -> bool:
        """标记为可用"""
        return self.update_material_status(MaterialStatus.AVAILABLE, file_hash, file_path)
    
    def tag_as_need_rerecord(self, file_hash: str = None, file_path: str = None) -> bool:
        """标记为需返录"""
        return self.update_material_status(MaterialStatus.NEED_RERECORD, file_hash, file_path)
    
    def tag_as_has_privacy(self, file_hash: str = None, file_path: str = None) -> bool:
        """标记为含隐私"""
        return self.update_material_status(MaterialStatus.HAS_PRIVACY, file_hash, file_path)
    
    def add_manual_tag(self, tag: str, file_hash: str = None, file_path: str = None) -> bool:
        """
        添加人工标签
        
        Args:
            tag: 标签文本
            file_hash: 文件哈希
            file_path: 文件路径
            
        Returns:
            是否添加成功
        """
        material = self.get_material(file_hash=file_hash, file_path=file_path)
        if not material:
            return False
        
        if tag not in material.manual_tags:
            material.manual_tags.append(tag)
            material.modified_time = datetime.now().isoformat()
        
        return True
    
    def set_manual_notes(self, notes: str, file_hash: str = None, file_path: str = None) -> bool:
        """
        设置人工备注
        
        Args:
            notes: 备注文本
            file_hash: 文件哈希
            file_path: 文件路径
            
        Returns:
            是否设置成功
        """
        material = self.get_material(file_hash=file_hash, file_path=file_path)
        if not material:
            return False
        
        material.manual_notes = notes
        material.modified_time = datetime.now().isoformat()
        return True
    
    def mark_as_environment(self, is_environment: bool = True, 
                            file_hash: str = None, file_path: str = None) -> bool:
        """
        标记为环境声
        
        Args:
            is_environment: 是否为环境声
            file_hash: 文件哈希
            file_path: 文件路径
            
        Returns:
            是否设置成功
        """
        material = self.get_material(file_hash=file_hash, file_path=file_path)
        if not material:
            return False
        
        material.is_environment = is_environment
        material.modified_time = datetime.now().isoformat()
        self._update_statistics()
        return True
    
    def mark_as_wild_track(self, is_wild: bool = True,
                           file_hash: str = None, file_path: str = None) -> bool:
        """
        标记为补录声
        
        Args:
            is_wild: 是否为补录声
            file_hash: 文件哈希
            file_path: 文件路径
            
        Returns:
            是否设置成功
        """
        material = self.get_material(file_hash=file_hash, file_path=file_path)
        if not material:
            return False
        
        material.is_wild_track = is_wild
        material.modified_time = datetime.now().isoformat()
        self._update_statistics()
        return True
    
    def get_all_materials(self, status_filter: MaterialStatus = None) -> List[MaterialState]:
        """
        获取所有素材
        
        Args:
            status_filter: 状态过滤（可选）
            
        Returns:
            素材列表
        """
        materials = list(self.state.materials.values())
        
        if status_filter:
            materials = [m for m in materials if m.status == status_filter]
        
        return materials
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            统计信息字典
        """
        self._update_statistics()
        
        return {
            'project_name': self.state.project_name,
            'total_materials': self.state.total_materials,
            'status_breakdown': {
                'available': self.state.available_count,
                'need_rerecord': self.state.need_rerecord_count,
                'has_privacy': self.state.has_privacy_count,
                'pending': self.state.pending_count
            },
            'track_types': {
                'environment': self.state.environment_track_count,
                'wild_track': self.state.wild_track_count
            },
            'validation_summary': self.state.validation_summary
        }
    
    def _update_statistics(self):
        """更新统计信息"""
        materials = list(self.state.materials.values())
        
        self.state.available_count = sum(1 for m in materials if m.status == MaterialStatus.AVAILABLE)
        self.state.need_rerecord_count = sum(1 for m in materials if m.status == MaterialStatus.NEED_RERECORD)
        self.state.has_privacy_count = sum(1 for m in materials if m.status == MaterialStatus.HAS_PRIVACY)
        self.state.pending_count = sum(1 for m in materials if m.status == MaterialStatus.PENDING)
        
        self.state.environment_track_count = sum(1 for m in materials if m.is_environment)
        self.state.wild_track_count = sum(1 for m in materials if m.is_wild_track)


def create_state_store(project_path: str) -> StateStore:
    """
    便捷函数：创建状态存储器
    
    Args:
        project_path: 项目路径
        
    Returns:
        状态存储器实例
    """
    return StateStore(project_path=project_path)
