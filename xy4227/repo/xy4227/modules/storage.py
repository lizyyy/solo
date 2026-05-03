# 状态存储模块
# 负责 JSON 序列化、版本管理和数据持久化

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, TypeVar, Type, Callable
from dataclasses import asdict, is_dataclass
from enum import Enum

from .models import (
    ProjectState,
    SubtitleEntry,
    Speaker,
    SensitiveWord,
    NoteEntry,
    RiskMarker,
    RiskFragment,
    RedactionDecision,
    RiskLevel,
    RiskType,
    SpeakerPermission,
    ReviewStatus
)


T = TypeVar('T')


class JSONSerializer:
    """JSON 序列化/反序列化器"""
    
    # 枚举类型映射
    ENUM_TYPES: Dict[str, Type[Enum]] = {
        'RiskLevel': RiskLevel,
        'RiskType': RiskType,
        'SpeakerPermission': SpeakerPermission,
        'ReviewStatus': ReviewStatus,
    }
    
    # 数据类类型映射
    DATACLASS_TYPES: Dict[str, Type] = {
        'SubtitleEntry': SubtitleEntry,
        'Speaker': Speaker,
        'SensitiveWord': SensitiveWord,
        'NoteEntry': NoteEntry,
        'RiskMarker': RiskMarker,
        'RiskFragment': RiskFragment,
        'RedactionDecision': RedactionDecision,
        'ProjectState': ProjectState,
    }
    
    @classmethod
    def _default_encoder(cls, obj: Any) -> Any:
        """自定义 JSON 编码器"""
        # 处理枚举
        if isinstance(obj, Enum):
            return {
                '__enum__': obj.__class__.__name__,
                'value': obj.value,
                'name': obj.name
            }
        
        # 处理 datetime
        if isinstance(obj, datetime):
            return {
                '__datetime__': True,
                'iso': obj.isoformat()
            }
        
        # 处理数据类
        if is_dataclass(obj):
            result = asdict(obj)
            result['__dataclass__'] = obj.__class__.__name__
            return result
        
        # 处理 Path
        if isinstance(obj, Path):
            return {
                '__path__': True,
                'path': str(obj)
            }
        
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    @classmethod
    def _object_hook(cls, dct: Dict) -> Any:
        """自定义 JSON 解码器"""
        # 处理枚举
        if '__enum__' in dct:
            enum_name = dct['__enum__']
            enum_type = cls.ENUM_TYPES.get(enum_name)
            if enum_type:
                try:
                    return enum_type[dct['name']]
                except KeyError:
                    try:
                        # 尝试按值查找
                        for item in enum_type:
                            if item.value == dct['value']:
                                return item
                    except:
                        pass
            return dct
        
        # 处理 datetime
        if '__datetime__' in dct:
            try:
                return datetime.fromisoformat(dct['iso'])
            except:
                return dct
        
        # 处理 Path
        if '__path__' in dct:
            return Path(dct['path'])
        
        # 处理数据类
        if '__dataclass__' in dct:
            class_name = dct['__dataclass__']
            data_class = cls.DATACLASS_TYPES.get(class_name)
            
            if data_class:
                # 移除 __dataclass__ 标记
                data = {k: v for k, v in dct.items() if k != '__dataclass__'}
                try:
                    return data_class(**data)
                except TypeError as e:
                    # 忽略不匹配的字段（向后兼容）
                    import inspect
                    sig = inspect.signature(data_class.__init__)
                    valid_params = set(sig.parameters.keys())
                    filtered_data = {k: v for k, v in data.items() if k in valid_params}
                    return data_class(**filtered_data)
        
        return dct
    
    @classmethod
    def dumps(cls, obj: Any, indent: int = 2, ensure_ascii: bool = False) -> str:
        """序列化为 JSON 字符串"""
        return json.dumps(
            obj,
            default=cls._default_encoder,
            indent=indent,
            ensure_ascii=ensure_ascii
        )
    
    @classmethod
    def loads(cls, json_str: str) -> Any:
        """从 JSON 字符串反序列化"""
        return json.loads(
            json_str,
            object_hook=cls._object_hook
        )
    
    @classmethod
    def dump(cls, obj: Any, file_path: str, indent: int = 2, ensure_ascii: bool = False):
        """序列化到文件"""
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(
                obj,
                f,
                default=cls._default_encoder,
                indent=indent,
                ensure_ascii=ensure_ascii
            )
    
    @classmethod
    def load(cls, file_path: str) -> Any:
        """从文件反序列化"""
        path = Path(file_path)
        
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(
                f,
                object_hook=cls._object_hook
            )


class VersionManager:
    """版本管理器"""
    
    def __init__(self, project_dir: str, max_versions: int = 50):
        self.project_dir = Path(project_dir)
        self.max_versions = max_versions
        self.versions_dir = self.project_dir / "versions"
        
        # 确保目录存在
        self.versions_dir.mkdir(parents=True, exist_ok=True)
    
    def create_version(self, state: ProjectState, description: str = "") -> str:
        """
        创建新版本
        
        Args:
            state: 当前项目状态
            description: 版本描述
            
        Returns:
            版本 ID
        """
        timestamp = datetime.now()
        version_id = f"v_{timestamp.strftime('%Y%m%d_%H%M%S_%f')}"
        
        # 构建版本数据
        version_data = {
            'version_id': version_id,
            'created_at': timestamp,
            'description': description,
            'state': state,
            'metadata': {
                'subtitle_count': len(state.subtitles),
                'risk_count': len(state.risk_markers),
                'speaker_count': len(state.speakers),
                'word_count': len(state.sensitive_words),
            }
        }
        
        # 保存版本文件
        version_file = self.versions_dir / f"{version_id}.json"
        JSONSerializer.dump(version_data, str(version_file))
        
        # 更新版本索引
        self._update_version_index(version_id, timestamp, description)
        
        # 清理旧版本
        self._cleanup_old_versions()
        
        return version_id
    
    def get_version(self, version_id: str) -> Optional[Dict]:
        """获取指定版本的数据"""
        version_file = self.versions_dir / f"{version_id}.json"
        
        if not version_file.exists():
            return None
        
        try:
            return JSONSerializer.load(str(version_file))
        except Exception:
            return None
    
    def get_version_list(self) -> List[Dict]:
        """获取所有版本列表"""
        index_file = self.versions_dir / "index.json"
        
        if not index_file.exists():
            return []
        
        try:
            data = JSONSerializer.load(str(index_file))
            return data.get('versions', [])
        except Exception:
            return []
    
    def restore_version(self, version_id: str) -> Optional[ProjectState]:
        """
        恢复到指定版本
        
        Args:
            version_id: 版本 ID
            
        Returns:
            恢复后的项目状态，如果版本不存在则返回 None
        """
        version_data = self.get_version(version_id)
        
        if not version_data:
            return None
        
        return version_data.get('state')
    
    def _update_version_index(self, version_id: str, timestamp: datetime, description: str):
        """更新版本索引"""
        index_file = self.versions_dir / "index.json"
        
        # 读取现有索引
        versions = []
        if index_file.exists():
            try:
                data = JSONSerializer.load(str(index_file))
                versions = data.get('versions', [])
            except Exception:
                versions = []
        
        # 添加新版本
        versions.insert(0, {
            'version_id': version_id,
            'created_at': timestamp,
            'description': description,
        })
        
        # 保存索引
        JSONSerializer.dump({'versions': versions}, str(index_file))
    
    def _cleanup_old_versions(self):
        """清理超过最大数量的旧版本"""
        versions = self.get_version_list()
        
        if len(versions) <= self.max_versions:
            return
        
        # 删除旧版本
        for version in versions[self.max_versions:]:
            version_id = version['version_id']
            version_file = self.versions_dir / f"{version_id}.json"
            if version_file.exists():
                version_file.unlink()
        
        # 更新索引
        index_file = self.versions_dir / "index.json"
        JSONSerializer.dump({'versions': versions[:self.max_versions]}, str(index_file))


class ProjectStorage:
    """项目存储管理器"""
    
    PROJECT_FILE_NAME = "project.json"
    
    def __init__(self, project_path: Optional[str] = None):
        self.project_path: Optional[Path] = None
        self.version_manager: Optional[VersionManager] = None
        
        if project_path:
            self.set_project_path(project_path)
    
    def set_project_path(self, path: str):
        """设置项目路径"""
        self.project_path = Path(path)
        self.version_manager = VersionManager(str(self.project_path))
    
    def create_new_project(self, project_name: str, project_dir: str) -> ProjectState:
        """
        创建新项目
        
        Args:
            project_name: 项目名称
            project_dir: 项目目录路径
            
        Returns:
            初始化的项目状态
        """
        now = datetime.now()
        
        # 初始化项目状态
        state = ProjectState(
            project_name=project_name,
            created_at=now,
            updated_at=now,
            subtitles=[],
            speakers=[],
            sensitive_words=[],
            notes=[],
            risk_markers=[],
            risk_fragments=[],
            redactions=[],
            version_history=[],
            active_version=0
        )
        
        # 设置项目路径
        project_path = Path(project_dir) / project_name
        self.set_project_path(str(project_path))
        
        # 保存初始状态
        self.save_project(state, create_version=True, description="项目创建")
        
        return state
    
    def save_project(self, state: ProjectState, 
                     create_version: bool = True,
                     description: str = "") -> str:
        """
        保存项目
        
        Args:
            state: 项目状态
            create_version: 是否创建版本
            description: 版本描述
            
        Returns:
            新版本 ID（如果创建版本）或空字符串
        """
        if not self.project_path:
            raise ValueError("项目路径未设置")
        
        # 更新时间戳
        state.updated_at = datetime.now()
        
        # 保存主项目文件
        project_file = self.project_path / self.PROJECT_FILE_NAME
        JSONSerializer.dump(state, str(project_file))
        
        # 创建版本
        version_id = ""
        if create_version and self.version_manager:
            if not description:
                description = f"保存于 {state.updated_at.strftime('%Y-%m-%d %H:%M:%S')}"
            version_id = self.version_manager.create_version(state, description)
        
        return version_id
    
    def load_project(self) -> ProjectState:
        """
        加载项目
        
        Returns:
            加载的项目状态
        """
        if not self.project_path:
            raise ValueError("项目路径未设置")
        
        project_file = self.project_path / self.PROJECT_FILE_NAME
        
        if not project_file.exists():
            raise FileNotFoundError(f"项目文件不存在: {project_file}")
        
        return JSONSerializer.load(str(project_file))
    
    def get_versions(self) -> List[Dict]:
        """获取所有版本列表"""
        if not self.version_manager:
            return []
        return self.version_manager.get_version_list()
    
    def restore_version(self, version_id: str) -> Optional[ProjectState]:
        """
        恢复到指定版本
        
        Args:
            version_id: 版本 ID
            
        Returns:
            恢复后的项目状态
        """
        if not self.version_manager:
            return None
        
        state = self.version_manager.restore_version(version_id)
        
        if state:
            # 自动保存恢复后的状态
            self.save_project(state, create_version=True, description=f"恢复到版本 {version_id}")
        
        return state
    
    def is_project_open(self) -> bool:
        """检查是否有项目已打开"""
        return self.project_path is not None
    
    def export_project_archive(self, output_path: str) -> str:
        """
        导出项目归档（整个项目目录打包）
        
        Args:
            output_path: 输出文件路径（不含扩展名）
            
        Returns:
            实际输出文件路径
        """
        if not self.project_path:
            raise ValueError("项目路径未设置")
        
        # 创建 zip 归档
        output_path = Path(output_path)
        output_dir = output_path.parent
        base_name = output_path.stem
        
        # 使用 shutil.make_archive
        archive_path = shutil.make_archive(
            base_name=str(output_dir / base_name),
            format='zip',
            root_dir=str(self.project_path.parent),
            base_dir=self.project_path.name
        )
        
        return archive_path
    
    def import_project_archive(self, archive_path: str, extract_dir: str) -> str:
        """
        导入项目归档
        
        Args:
            archive_path: 归档文件路径
            extract_dir: 解压目录
            
        Returns:
            项目路径
        """
        archive = Path(archive_path)
        extract_path = Path(extract_dir)
        
        # 解压
        shutil.unpack_archive(str(archive), str(extract_path), format='zip')
        
        # 查找解压后的项目目录
        # 通常归档内第一层就是项目目录
        for item in extract_path.iterdir():
            if item.is_dir():
                project_file = item / self.PROJECT_FILE_NAME
                if project_file.exists():
                    self.set_project_path(str(item))
                    return str(item)
        
        raise ValueError("无法在归档中找到有效的项目文件")


class Storage:
    """统一存储入口"""
    
    serializer = JSONSerializer
    project_storage_class = ProjectStorage
    version_manager_class = VersionManager
    
    @classmethod
    def create_project_storage(cls, project_path: Optional[str] = None) -> ProjectStorage:
        """创建项目存储"""
        return cls.project_storage_class(project_path)
    
    @classmethod
    def serialize(cls, obj: Any) -> str:
        """序列化对象"""
        return cls.serializer.dumps(obj)
    
    @classmethod
    def deserialize(cls, json_str: str) -> Any:
        """反序列化对象"""
        return cls.serializer.loads(json_str)
    
    @classmethod
    def to_file(cls, obj: Any, file_path: str):
        """保存到文件"""
        cls.serializer.dump(obj, file_path)
    
    @classmethod
    def from_file(cls, file_path: str) -> Any:
        """从文件加载"""
        return cls.serializer.load(file_path)
