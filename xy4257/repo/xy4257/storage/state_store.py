import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict, field
from enum import Enum
import pandas as pd


class VerificationStatus(Enum):
    UNVERIFIED = "未核实"
    VERIFIED = "已核实"
    DISMISSED = "已驳回"
    IN_PROGRESS = "核实中"


@dataclass
class VerificationRecord:
    """核实记录"""
    record_id: str  # 违规ID或投诉ID
    record_type: str  # "violation", "complaint", "enforcement"
    status: VerificationStatus
    verified_by: Optional[str] = None
    verified_time: Optional[datetime] = None
    notes: Optional[str] = None
    evidence_links: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AppState:
    """应用状态"""
    session_id: str
    created_at: datetime
    updated_at: datetime
    verification_records: Dict[str, VerificationRecord] = field(default_factory=dict)
    user_notes: Dict[str, str] = field(default_factory=dict)
    filters: Dict[str, Any] = field(default_factory=dict)
    custom_tags: Dict[str, List[str]] = field(default_factory=dict)


class StateStore:
    """
    状态存储类，用于管理应用状态和用户核实记录
    
    功能:
    1. 持久化存储核实状态
    2. 管理用户备注
    3. 保存筛选器配置
    4. 支持导出和导入
    """
    
    def __init__(
        self,
        storage_dir: str = "./data",
        session_id: Optional[str] = None
    ):
        self.storage_dir = storage_dir
        self.session_id = session_id or self._generate_session_id()
        
        # 确保存储目录存在
        os.makedirs(storage_dir, exist_ok=True)
        
        # 初始化状态
        self.state = self._load_or_create_state()
    
    def _generate_session_id(self) -> str:
        """生成会话ID"""
        return f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    def _get_state_file_path(self) -> str:
        """获取状态文件路径"""
        return os.path.join(self.storage_dir, f"{self.session_id}_state.json")
    
    def _load_or_create_state(self) -> AppState:
        """加载或创建状态"""
        state_file = self._get_state_file_path()
        
        if os.path.exists(state_file):
            try:
                return self._load_state_from_file(state_file)
            except:
                pass
        
        # 创建新状态
        now = datetime.now()
        return AppState(
            session_id=self.session_id,
            created_at=now,
            updated_at=now
        )
    
    def _load_state_from_file(self, file_path: str) -> AppState:
        """从文件加载状态"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 转换日期时间
        created_at = datetime.fromisoformat(data['created_at'])
        updated_at = datetime.fromisoformat(data['updated_at'])
        
        # 转换核实记录
        verification_records = {}
        for rid, record_data in data.get('verification_records', {}).items():
            status = VerificationStatus(record_data['status'])
            verified_time = (
                datetime.fromisoformat(record_data['verified_time'])
                if record_data.get('verified_time') else None
            )
            
            verification_records[rid] = VerificationRecord(
                record_id=record_data['record_id'],
                record_type=record_data['record_type'],
                status=status,
                verified_by=record_data.get('verified_by'),
                verified_time=verified_time,
                notes=record_data.get('notes'),
                evidence_links=record_data.get('evidence_links', []),
                metadata=record_data.get('metadata', {})
            )
        
        return AppState(
            session_id=data['session_id'],
            created_at=created_at,
            updated_at=updated_at,
            verification_records=verification_records,
            user_notes=data.get('user_notes', {}),
            filters=data.get('filters', {}),
            custom_tags=data.get('custom_tags', {})
        )
    
    def _save_state(self):
        """保存状态到文件"""
        self.state.updated_at = datetime.now()
        
        # 转换为可序列化格式
        data = {
            'session_id': self.state.session_id,
            'created_at': self.state.created_at.isoformat(),
            'updated_at': self.state.updated_at.isoformat(),
            'verification_records': {},
            'user_notes': self.state.user_notes,
            'filters': self.state.filters,
            'custom_tags': self.state.custom_tags
        }
        
        # 转换核实记录
        for rid, record in self.state.verification_records.items():
            data['verification_records'][rid] = {
                'record_id': record.record_id,
                'record_type': record.record_type,
                'status': record.status.value,
                'verified_by': record.verified_by,
                'verified_time': record.verified_time.isoformat() if record.verified_time else None,
                'notes': record.notes,
                'evidence_links': record.evidence_links,
                'metadata': record.metadata
            }
        
        # 保存文件
        state_file = self._get_state_file_path()
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def set_verification_status(
        self,
        record_id: str,
        record_type: str,
        status: VerificationStatus,
        verified_by: Optional[str] = None,
        notes: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> VerificationRecord:
        """
        设置核实状态
        
        参数:
        - record_id: 记录ID
        - record_type: 记录类型 ("violation", "complaint", "enforcement")
        - status: 核实状态
        - verified_by: 核实人
        - notes: 备注
        - metadata: 附加元数据
        
        返回:
        - 更新后的核实记录
        """
        now = datetime.now()
        
        if record_id in self.state.verification_records:
            record = self.state.verification_records[record_id]
            record.status = status
            record.verified_by = verified_by
            record.verified_time = now
            if notes:
                record.notes = notes
            if metadata:
                record.metadata.update(metadata)
        else:
            record = VerificationRecord(
                record_id=record_id,
                record_type=record_type,
                status=status,
                verified_by=verified_by,
                verified_time=now,
                notes=notes,
                metadata=metadata or {}
            )
            self.state.verification_records[record_id] = record
        
        self._save_state()
        return record
    
    def get_verification_status(self, record_id: str) -> Optional[VerificationRecord]:
        """获取核实状态"""
        return self.state.verification_records.get(record_id)
    
    def get_all_verification_records(self) -> pd.DataFrame:
        """获取所有核实记录为DataFrame"""
        if not self.state.verification_records:
            return pd.DataFrame()
        
        records = []
        for rid, record in self.state.verification_records.items():
            records.append({
                'record_id': record.record_id,
                'record_type': record.record_type,
                'status': record.status.value,
                'verified_by': record.verified_by,
                'verified_time': record.verified_time,
                'notes': record.notes
            })
        
        return pd.DataFrame(records)
    
    def get_verification_stats(self) -> Dict[str, int]:
        """获取核实统计"""
        stats = {
            'total': len(self.state.verification_records),
            'unverified': 0,
            'verified': 0,
            'dismissed': 0,
            'in_progress': 0
        }
        
        for record in self.state.verification_records.values():
            if record.status == VerificationStatus.UNVERIFIED:
                stats['unverified'] += 1
            elif record.status == VerificationStatus.VERIFIED:
                stats['verified'] += 1
            elif record.status == VerificationStatus.DISMISSED:
                stats['dismissed'] += 1
            elif record.status == VerificationStatus.IN_PROGRESS:
                stats['in_progress'] += 1
        
        return stats
    
    def set_user_note(self, key: str, note: str):
        """设置用户备注"""
        self.state.user_notes[key] = note
        self._save_state()
    
    def get_user_note(self, key: str) -> Optional[str]:
        """获取用户备注"""
        return self.state.user_notes.get(key)
    
    def set_filters(self, filters: Dict[str, Any]):
        """保存筛选器配置"""
        self.state.filters = filters.copy()
        self._save_state()
    
    def get_filters(self) -> Dict[str, Any]:
        """获取筛选器配置"""
        return self.state.filters.copy()
    
    def add_tag(self, record_id: str, tag: str):
        """为记录添加标签"""
        if record_id not in self.state.custom_tags:
            self.state.custom_tags[record_id] = []
        
        if tag not in self.state.custom_tags[record_id]:
            self.state.custom_tags[record_id].append(tag)
            self._save_state()
    
    def remove_tag(self, record_id: str, tag: str):
        """移除记录的标签"""
        if record_id in self.state.custom_tags:
            if tag in self.state.custom_tags[record_id]:
                self.state.custom_tags[record_id].remove(tag)
                self._save_state()
    
    def get_tags(self, record_id: str) -> List[str]:
        """获取记录的标签"""
        return self.state.custom_tags.get(record_id, [])
    
    def export_state(self, export_path: str) -> str:
        """
        导出状态到指定路径
        
        返回:
        - 导出文件的完整路径
        """
        # 确保目录存在
        export_dir = os.path.dirname(export_path)
        if export_dir:
            os.makedirs(export_dir, exist_ok=True)
        
        # 复制当前状态文件
        state_file = self._get_state_file_path()
        if os.path.exists(state_file):
            import shutil
            shutil.copy2(state_file, export_path)
            return export_path
        else:
            # 直接保存到目标路径
            self._save_state()
            return state_file
    
    def import_state(self, import_path: str) -> bool:
        """
        从文件导入状态
        
        返回:
        - 是否成功导入
        """
        try:
            self.state = self._load_state_from_file(import_path)
            self.session_id = self.state.session_id
            self._save_state()
            return True
        except Exception as e:
            print(f"导入状态失败: {e}")
            return False
    
    def clear_state(self):
        """清除当前状态"""
        now = datetime.now()
        self.state = AppState(
            session_id=self.session_id,
            created_at=now,
            updated_at=now
        )
        self._save_state()
    
    def merge_with_dataframe(
        self,
        df: pd.DataFrame,
        id_column: str,
        record_type: str
    ) -> pd.DataFrame:
        """
        将核实状态合并到DataFrame中
        
        参数:
        - df: 原始DataFrame
        - id_column: ID列名
        - record_type: 记录类型
        
        返回:
        - 添加了核实状态的DataFrame
        """
        if df.empty or id_column not in df.columns:
            return df
        
        result_df = df.copy()
        
        # 添加核实状态列
        result_df['verification_status'] = VerificationStatus.UNVERIFIED.value
        result_df['verified_by'] = None
        result_df['verified_time'] = None
        result_df['verification_notes'] = None
        
        for idx, row in result_df.iterrows():
            record_id = str(row[id_column])
            if record_id in self.state.verification_records:
                record = self.state.verification_records[record_id]
                result_df.at[idx, 'verification_status'] = record.status.value
                result_df.at[idx, 'verified_by'] = record.verified_by
                result_df.at[idx, 'verified_time'] = record.verified_time
                result_df.at[idx, 'verification_notes'] = record.notes
        
        return result_df
