"""
配置管理模块
负责存储、验证和加载项目配置
"""

import json
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path


@dataclass
class Config:
    project_root: Path = field(default_factory=Path)
    
    # 停用词配置
    stopwords: List[str] = field(default_factory=list)
    
    # 脱敏字段配置
    sensitive_fields: List[str] = field(default_factory=list)
    
    # 文本清洗规则
    text_cleaning_rules: Dict[str, Any] = field(default_factory=dict)
    
    # 聚类参数
    clustering_params: Dict[str, Any] = field(default_factory=dict)
    
    # 相似度阈值
    similarity_threshold: float = 0.8
    
    # 输出目录
    output_dir: str = "output"
    
    # 数据目录
    data_dir: str = "data"
    
    # 模型目录
    model_dir: str = "models"
    
    # 字段映射 - 将CSV字段映射到内部字段名
    field_mapping: Dict[str, str] = field(default_factory=dict)
    
    # 渠道列表
    channels: List[str] = field(default_factory=list)
    
    # 产品线列表
    product_lines: List[str] = field(default_factory=list)
    
    # 必填字段
    required_fields: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not self.stopwords:
            self.stopwords = self._get_default_stopwords()
        
        if not self.sensitive_fields:
            self.sensitive_fields = ["手机号", "电话", "邮箱", "订单号", "用户ID", "身份证号"]
        
        if not self.text_cleaning_rules:
            self.text_cleaning_rules = {
                "remove_urls": True,
                "remove_emails": True,
                "remove_phone_numbers": True,
                "remove_special_chars": True,
                "lowercase": True,
                "remove_extra_spaces": True
            }
        
        if not self.clustering_params:
            self.clustering_params = {
                "algorithm": "kmeans",
                "n_clusters": 20,
                "random_state": 42,
                "max_iter": 300
            }
        
        if not self.required_fields:
            self.required_fields = ["工单号", "用户描述", "渠道", "产品线", "时间", "处理人", "处理结论"]

    def _get_default_stopwords(self) -> List[str]:
        return [
            "的", "了", "是", "在", "我", "有", "和", "就",
            "不", "人", "都", "一", "一个", "上", "也", "很",
            "到", "说", "要", "去", "你", "会", "着", "没有",
            "看", "好", "自己", "这", "那", "他", "她", "它",
            "啊", "吧", "呢", "吗", "哦", "嗯", "哈"
        ]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stopwords": self.stopwords,
            "sensitive_fields": self.sensitive_fields,
            "text_cleaning_rules": self.text_cleaning_rules,
            "clustering_params": self.clustering_params,
            "similarity_threshold": self.similarity_threshold,
            "output_dir": self.output_dir,
            "data_dir": self.data_dir,
            "model_dir": self.model_dir,
            "field_mapping": self.field_mapping,
            "channels": self.channels,
            "product_lines": self.product_lines,
            "required_fields": self.required_fields
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any], project_root: Path) -> 'Config':
        return cls(
            project_root=project_root,
            stopwords=data.get("stopwords", []),
            sensitive_fields=data.get("sensitive_fields", []),
            text_cleaning_rules=data.get("text_cleaning_rules", {}),
            clustering_params=data.get("clustering_params", {}),
            similarity_threshold=data.get("similarity_threshold", 0.8),
            output_dir=data.get("output_dir", "output"),
            data_dir=data.get("data_dir", "data"),
            model_dir=data.get("model_dir", "models"),
            field_mapping=data.get("field_mapping", {}),
            channels=data.get("channels", []),
            product_lines=data.get("product_lines", []),
            required_fields=data.get("required_fields", [])
        )

    def get_data_path(self) -> Path:
        return self.project_root / self.data_dir

    def get_output_path(self) -> Path:
        return self.project_root / self.output_dir

    def get_model_path(self) -> Path:
        return self.project_root / self.model_dir

    def get_quarantine_path(self) -> Path:
        return self.get_data_path() / "quarantine.json"

    def get_feedback_path(self) -> Path:
        return self.get_model_path() / "feedback.json"

    def get_clusters_path(self) -> Path:
        return self.get_model_path() / "clusters.json"

    def get_history_path(self) -> Path:
        return self.get_data_path() / "history"


def load_config(project_root: Path) -> Config:
    config_file = project_root / "config.json"
    if not config_file.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_file}")
    
    with open(config_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return Config.from_dict(data, project_root)


def init_config(project_root: Path) -> Config:
    if not project_root.exists():
        project_root.mkdir(parents=True)
    
    config = Config(project_root=project_root)
    
    config_file = project_root / "config.json"
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config.to_dict(), f, ensure_ascii=False, indent=2)
    
    for dir_name in [config.data_dir, config.output_dir, config.model_dir]:
        dir_path = project_root / dir_name
        if not dir_path.exists():
            dir_path.mkdir(parents=True)
    
    history_path = config.get_history_path()
    if not history_path.exists():
        history_path.mkdir(parents=True)
    
    return config


def is_project_initialized(project_root: Path) -> bool:
    config_file = project_root / "config.json"
    return config_file.exists()
