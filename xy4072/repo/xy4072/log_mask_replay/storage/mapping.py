"""映射存储模块 - 可审计的敏感字段映射存储"""

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64


class MappingSource(str, Enum):
    """映射来源枚举"""
    SCAN = "scan"
    MASK = "mask"
    IMPORT = "import"
    RESTORE = "restore"


@dataclass
class MappingEntry:
    """映射条目 - 记录原始值到假值的映射"""
    field_type: str
    original_value: str
    masked_value: str
    source: MappingSource
    created_at: datetime
    updated_at: datetime
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    is_verified: bool = False
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "field_type": self.field_type,
            "original_value": self.original_value,
            "masked_value": self.masked_value,
            "source": self.source.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "source_file": self.source_file,
            "line_number": self.line_number,
            "is_verified": self.is_verified,
            "notes": self.notes,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MappingEntry":
        """从字典创建映射条目"""
        return cls(
            field_type=data["field_type"],
            original_value=data["original_value"],
            masked_value=data["masked_value"],
            source=MappingSource(data["source"]) if data.get("source") else MappingSource.MASK,
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
            source_file=data.get("source_file"),
            line_number=data.get("line_number"),
            is_verified=data.get("is_verified", False),
            notes=data.get("notes"),
        )


class MappingStore:
    """映射存储类 - 管理敏感字段的映射关系"""
    
    def __init__(self, store_path: Optional[Path] = None, key: Optional[bytes] = None):
        """
        初始化映射存储
        
        Args:
            store_path: 存储文件路径
            key: 加密密钥（可选，如果不提供则不加密）
        """
        self.store_path = store_path
        self._key = key
        self._fernet: Optional[Fernet] = None
        
        # 初始化加密器
        if key:
            self._fernet = Fernet(key)
        
        # 存储结构：{field_type: {original_value: MappingEntry}}
        self._mappings: Dict[str, Dict[str, MappingEntry]] = {}
        
        # 反向索引：{field_type: {masked_value: original_value}}
        self._reverse_mappings: Dict[str, Dict[str, str]] = {}
        
        # 审计日志
        self._audit_log: List[Dict[str, Any]] = []
    
    @staticmethod
    def generate_key() -> bytes:
        """
        生成新的加密密钥
        
        Returns:
            加密密钥
        """
        return Fernet.generate_key()
    
    @staticmethod
    def derive_key_from_password(password: str, salt: Optional[bytes] = None) -> tuple:
        """
        从密码派生密钥
        
        Args:
            password: 密码
            salt: 盐值（可选，如果不提供则生成新的）
            
        Returns:
            (密钥, 盐值)
        """
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))
        return key, salt
    
    def add_mapping(
        self,
        field_type: str,
        original_value: str,
        masked_value: str,
        source: MappingSource = MappingSource.MASK,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
    ) -> MappingEntry:
        """
        添加映射
        
        Args:
            field_type: 字段类型
            original_value: 原始值
            masked_value: 假值
            source: 来源
            source_file: 源文件
            line_number: 行号
            
        Returns:
            创建的映射条目
        """
        # 检查是否已存在
        if field_type in self._mappings and original_value in self._mappings[field_type]:
            existing = self._mappings[field_type][original_value]
            # 更新时间戳
            existing.updated_at = datetime.now()
            self._add_audit_log("update_mapping", {
                "field_type": field_type,
                "original_value": original_value,
                "old_masked_value": existing.masked_value,
                "new_masked_value": masked_value,
            })
            return existing
        
        # 创建新条目
        entry = MappingEntry(
            field_type=field_type,
            original_value=original_value,
            masked_value=masked_value,
            source=source,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            source_file=source_file,
            line_number=line_number,
        )
        
        # 添加到映射
        if field_type not in self._mappings:
            self._mappings[field_type] = {}
            self._reverse_mappings[field_type] = {}
        
        self._mappings[field_type][original_value] = entry
        self._reverse_mappings[field_type][masked_value] = original_value
        
        # 记录审计日志
        self._add_audit_log("add_mapping", {
            "field_type": field_type,
            "original_value": original_value,
            "masked_value": masked_value,
            "source": source.value,
            "source_file": source_file,
        })
        
        return entry
    
    def get_mapping(self, field_type: str, original_value: str) -> Optional[MappingEntry]:
        """
        获取映射
        
        Args:
            field_type: 字段类型
            original_value: 原始值
            
        Returns:
            映射条目，如果不存在则返回 None
        """
        if field_type in self._mappings and original_value in self._mappings[field_type]:
            return self._mappings[field_type][original_value]
        return None
    
    def get_masked_value(self, field_type: str, original_value: str) -> Optional[str]:
        """
        根据原始值获取假值
        
        Args:
            field_type: 字段类型
            original_value: 原始值
            
        Returns:
            假值，如果不存在则返回 None
        """
        entry = self.get_mapping(field_type, original_value)
        return entry.masked_value if entry else None
    
    def get_original_value(self, field_type: str, masked_value: str) -> Optional[str]:
        """
        根据假值获取原始值（需要密钥）
        
        Args:
            field_type: 字段类型
            masked_value: 假值
            
        Returns:
            原始值，如果不存在或没有密钥则返回 None
        """
        if field_type in self._reverse_mappings and masked_value in self._reverse_mappings[field_type]:
            return self._reverse_mappings[field_type][masked_value]
        return None
    
    def get_all_mappings(self) -> Dict[str, Dict[str, MappingEntry]]:
        """
        获取所有映射
        
        Returns:
            所有映射的字典
        """
        return self._mappings.copy()
    
    def get_mappings_by_type(self, field_type: str) -> Dict[str, MappingEntry]:
        """
        获取指定类型的所有映射
        
        Args:
            field_type: 字段类型
            
        Returns:
            该类型的所有映射
        """
        return self._mappings.get(field_type, {}).copy()
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            统计信息字典
        """
        stats = {
            "total_mappings": 0,
            "by_field_type": {},
            "by_source": {},
            "verified_count": 0,
        }
        
        for field_type, mappings in self._mappings.items():
            count = len(mappings)
            stats["total_mappings"] += count
            stats["by_field_type"][field_type] = count
            
            for entry in mappings.values():
                source = entry.source.value
                if source not in stats["by_source"]:
                    stats["by_source"][source] = 0
                stats["by_source"][source] += 1
                
                if entry.is_verified:
                    stats["verified_count"] += 1
        
        return stats
    
    def _add_audit_log(self, action: str, details: Dict[str, Any]) -> None:
        """
        添加审计日志
        
        Args:
            action: 操作类型
            details: 操作详情
        """
        self._audit_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details,
        })
    
    def get_audit_log(self) -> List[Dict[str, Any]]:
        """
        获取审计日志
        
        Returns:
            审计日志列表
        """
        return self._audit_log.copy()
    
    def save(self, path: Optional[Path] = None) -> None:
        """
        保存映射到文件
        
        Args:
            path: 文件路径（可选，如果不提供则使用初始化时的路径）
        """
        save_path = path or self.store_path
        if not save_path:
            raise ValueError("No save path specified")
        
        # 准备数据
        data = {
            "version": "1.0",
            "created_at": datetime.now().isoformat(),
            "mappings": {},
            "audit_log": self._audit_log,
        }
        
        # 转换映射条目
        for field_type, mappings in self._mappings.items():
            data["mappings"][field_type] = {
                original: entry.to_dict()
                for original, entry in mappings.items()
            }
        
        # 序列化为 JSON
        json_data = json.dumps(data, ensure_ascii=False, indent=2)
        
        # 加密（如果有密钥）
        if self._fernet:
            encrypted = self._fernet.encrypt(json_data.encode("utf-8"))
            with open(save_path, "wb") as f:
                f.write(encrypted)
        else:
            with open(save_path, "w", encoding="utf-8") as f:
                f.write(json_data)
        
        self._add_audit_log("save_store", {"path": str(save_path)})
    
    def load(self, path: Optional[Path] = None, key: Optional[bytes] = None) -> None:
        """
        从文件加载映射
        
        Args:
            path: 文件路径（可选，如果不提供则使用初始化时的路径）
            key: 解密密钥（可选）
        """
        load_path = path or self.store_path
        if not load_path:
            raise ValueError("No load path specified")
        
        # 使用提供的密钥或初始化时的密钥
        decrypt_key = key or self._key
        fernet = Fernet(decrypt_key) if decrypt_key else None
        
        # 读取文件
        try:
            # 尝试作为加密文件读取
            with open(load_path, "rb") as f:
                content = f.read()
            
            # 尝试解密
            if fernet:
                try:
                    decrypted = fernet.decrypt(content)
                    json_data = decrypted.decode("utf-8")
                except Exception:
                    # 解密失败，尝试直接解析为 JSON
                    json_data = content.decode("utf-8")
            else:
                json_data = content.decode("utf-8")
        except UnicodeDecodeError:
            # 如果是文本文件
            with open(load_path, "r", encoding="utf-8") as f:
                json_data = f.read()
        
        # 解析 JSON
        data = json.loads(json_data)
        
        # 清空现有映射
        self._mappings.clear()
        self._reverse_mappings.clear()
        
        # 加载映射
        if "mappings" in data:
            for field_type, mappings in data["mappings"].items():
                if field_type not in self._mappings:
                    self._mappings[field_type] = {}
                    self._reverse_mappings[field_type] = {}
                
                for original, entry_data in mappings.items():
                    entry = MappingEntry.from_dict(entry_data)
                    self._mappings[field_type][original] = entry
                    self._reverse_mappings[field_type][entry.masked_value] = original
        
        # 加载审计日志
        if "audit_log" in data:
            self._audit_log = data["audit_log"]
        
        self._add_audit_log("load_store", {"path": str(load_path)})
    
    def clear(self) -> None:
        """清空所有映射"""
        self._mappings.clear()
        self._reverse_mappings.clear()
        self._add_audit_log("clear_store", {})
    
    def merge(self, other: "MappingStore") -> int:
        """
        合并另一个映射存储
        
        Args:
            other: 另一个映射存储
            
        Returns:
            合并的映射数量
        """
        merged_count = 0
        
        for field_type, mappings in other._mappings.items():
            for original, entry in mappings.items():
                # 只添加不存在的映射
                if field_type not in self._mappings or original not in self._mappings[field_type]:
                    self.add_mapping(
                        field_type=field_type,
                        original_value=original,
                        masked_value=entry.masked_value,
                        source=entry.source,
                        source_file=entry.source_file,
                        line_number=entry.line_number,
                    )
                    merged_count += 1
        
        self._add_audit_log("merge_store", {"merged_count": merged_count})
        return merged_count
    
    def export_simple_mappings(self) -> Dict[str, Dict[str, str]]:
        """
        导出简单的映射字典（用于假值生成器）
        
        Returns:
            简单的映射字典 {field_type: {original: masked}}
        """
        result = {}
        for field_type, mappings in self._mappings.items():
            result[field_type] = {
                original: entry.masked_value
                for original, entry in mappings.items()
            }
        return result
