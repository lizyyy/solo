"""配置管理模块"""
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Set
from pydantic import BaseModel, Field


class DeviceTimeOffset(BaseModel):
    """设备时间偏移配置，单位为秒（正数表示设备时间比真实时间快）"""
    device_id: str
    offset_seconds: int = Field(default=0, description="时间偏移，正数表示设备时间快")


class EntryRule(BaseModel):
    """入口通行规则"""
    entry_id: str
    entry_name: str
    allowed_ticket_types: List[str] = Field(default_factory=list, description="允许的票种列表")
    is_vip_only: bool = Field(default=False, description="是否仅VIP入口")


class ReconcilerConfig(BaseModel):
    """对账器核心配置"""
    project_name: str = Field(..., description="项目名称")
    event_date: str = Field(..., description="展会日期，格式：YYYY-MM-DD")
    
    # 二次入场配置
    reentry_allowed_ticket_types: List[str] = Field(
        default_factory=list, 
        description="允许二次入场的票种"
    )
    
    # 设备时间偏移
    device_time_offsets: List[DeviceTimeOffset] = Field(
        default_factory=list,
        description="各设备的时间偏移配置"
    )
    
    # 入口规则
    entry_rules: List[EntryRule] = Field(
        default_factory=list,
        description="各入口的通行规则"
    )
    
    # 对账参数
    duplicate_scan_window_seconds: int = Field(
        default=90,
        description="重复扫码的时间窗口（秒）"
    )
    
    # 票种定义
    ticket_types: Dict[str, str] = Field(
        default_factory=dict,
        description="票种ID到名称的映射"
    )

    def get_device_offset(self, device_id: str) -> int:
        """获取指定设备的时间偏移"""
        for offset in self.device_time_offsets:
            if offset.device_id == device_id:
                return offset.offset_seconds
        return 0

    def is_reentry_allowed(self, ticket_type: str) -> bool:
        """检查票种是否允许二次入场"""
        return ticket_type in self.reentry_allowed_ticket_types

    def can_enter_at(self, ticket_type: str, entry_id: str) -> bool:
        """检查票种是否可以在指定入口通行"""
        for rule in self.entry_rules:
            if rule.entry_id == entry_id:
                if rule.is_vip_only:
                    # VIP入口只允许VIP票种
                    return ticket_type in rule.allowed_ticket_types
                # 普通入口检查允许的票种
                if not rule.allowed_ticket_types:
                    return True  # 未配置限制则允许所有
                return ticket_type in rule.allowed_ticket_types
        # 未配置入口规则则允许
        return True

    def get_entry_name(self, entry_id: str) -> str:
        """获取入口名称"""
        for rule in self.entry_rules:
            if rule.entry_id == entry_id:
                return rule.entry_name
        return entry_id

    def get_ticket_type_name(self, ticket_type: str) -> str:
        """获取票种名称"""
        return self.ticket_types.get(ticket_type, ticket_type)


class ConfigManager:
    """配置管理器"""
    
    CONFIG_FILENAME = "reconciler-config.json"
    
    def __init__(self, workspace_dir: Optional[Path] = None):
        """
        初始化配置管理器
        
        Args:
            workspace_dir: 工作目录，如果为None则使用当前目录
        """
        self.workspace_dir = workspace_dir or Path.cwd()
        self.config_path = self.workspace_dir / self.CONFIG_FILENAME
    
    def init_project(
        self,
        project_name: str,
        event_date: str,
        reentry_allowed_types: Optional[List[str]] = None,
    ) -> ReconcilerConfig:
        """
        初始化项目配置
        
        Args:
            project_name: 项目名称
            event_date: 展会日期
            reentry_allowed_types: 允许二次入场的票种
            
        Returns:
            创建的配置对象
        """
        # 创建默认配置
        config = ReconcilerConfig(
            project_name=project_name,
            event_date=event_date,
            reentry_allowed_ticket_types=reentry_allowed_types or [],
        )
        
        # 保存配置
        self.save(config)
        
        # 创建必要的目录结构
        self._ensure_directories()
        
        return config
    
    def _ensure_directories(self):
        """确保必要的目录存在"""
        directories = [
            self.workspace_dir / "data",
            self.workspace_dir / "data" / "rosters",
            self.workspace_dir / "data" / "logs",
            self.workspace_dir / "output",
            self.workspace_dir / "output" / "reports",
            self.workspace_dir / "output" / "ledgers",
            self.workspace_dir / "history",
            self.workspace_dir / "quarantine",
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
    
    def load(self) -> ReconcilerConfig:
        """
        加载配置
        
        Returns:
            配置对象
            
        Raises:
            FileNotFoundError: 如果配置文件不存在
        """
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"配置文件不存在: {self.config_path}，请先运行 init 命令初始化项目"
            )
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return ReconcilerConfig(**data)
    
    def save(self, config: ReconcilerConfig):
        """
        保存配置
        
        Args:
            config: 配置对象
        """
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2, ensure_ascii=False)
    
    def exists(self) -> bool:
        """检查配置文件是否存在"""
        return self.config_path.exists()
    
    def add_entry_rule(self, rule: EntryRule):
        """添加入口规则"""
        config = self.load()
        
        # 检查是否已存在相同的入口规则
        for i, existing in enumerate(config.entry_rules):
            if existing.entry_id == rule.entry_id:
                config.entry_rules[i] = rule
                self.save(config)
                return
        
        config.entry_rules.append(rule)
        self.save(config)
    
    def add_device_offset(self, offset: DeviceTimeOffset):
        """添加设备时间偏移"""
        config = self.load()
        
        # 检查是否已存在相同设备的偏移
        for i, existing in enumerate(config.device_time_offsets):
            if existing.device_id == offset.device_id:
                config.device_time_offsets[i] = offset
                self.save(config)
                return
        
        config.device_time_offsets.append(offset)
        self.save(config)
    
    def add_reentry_allowed_type(self, ticket_type: str):
        """添加允许二次入场的票种"""
        config = self.load()
        
        if ticket_type not in config.reentry_allowed_ticket_types:
            config.reentry_allowed_ticket_types.append(ticket_type)
            self.save(config)
    
    def add_ticket_type(self, type_id: str, type_name: str):
        """添加票种定义"""
        config = self.load()
        config.ticket_types[type_id] = type_name
        self.save(config)
