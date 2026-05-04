#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理模块
"""

import os
from pathlib import Path

class Config:
    """配置类"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._initialized = True
        
        # 项目根目录
        self.base_dir = Path(__file__).parent
        
        # 数据目录
        self.data_dir = self.base_dir / "data"
        
        # 数据库文件路径
        self.db_path = self.data_dir / "lab_management.db"
        
        # 导出目录
        self.export_dir = self.data_dir / "exports"
        
        # 危险等级定义
        self.danger_levels = {
            1: {"name": "高危险", "color": "#FF4444", "description": "易燃易爆、剧毒、强腐蚀性，需双人双锁管理"},
            2: {"name": "中危险", "color": "#FF8C00", "description": "氧化剂、还原剂、有毒品，需专柜存放"},
            3: {"name": "低危险", "color": "#FFD700", "description": "普通化学试剂，一般存放"},
            4: {"name": "一般", "color": "#90EE90", "description": "普通教学用品，无特殊要求"}
        }
        
        # 试剂类别定义（用于相容性检查）
        self.reagent_categories = {
            "acid": {"name": "酸类", "incompatible": ["base", "oxidizer", "organic"]},
            "base": {"name": "碱类", "incompatible": ["acid", "oxidizer", "organic"]},
            "oxidizer": {"name": "氧化剂", "incompatible": ["acid", "base", "reducer", "organic"]},
            "reducer": {"name": "还原剂", "incompatible": ["oxidizer", "acid"]},
            "organic": {"name": "有机物", "incompatible": ["acid", "base", "oxidizer"]},
            "metal": {"name": "金属", "incompatible": ["acid", "oxidizer"]},
            "salt": {"name": "盐类", "incompatible": []},
            "indicator": {"name": "指示剂", "incompatible": []},
            "water": {"name": "水溶液", "incompatible": []}
        }
        
        # 单位定义
        self.units = ["克", "千克", "毫升", "升", "瓶", "盒", "个", "滴", "块", "片"]
        
        # 状态定义
        self.booking_status = {
            "pending": {"name": "待审批", "color": "#FFD700"},
            "approved": {"name": "已通过", "color": "#90EE90"},
            "rejected": {"name": "已拒绝", "color": "#FF4444"},
            "collected": {"name": "已领用", "color": "#1E90FF"},
            "returned": {"name": "已归还", "color": "#9370DB"},
            "partial_returned": {"name": "部分归还", "color": "#DDA0DD"}
        }
        
        # 审批状态
        self.approval_status = {
            "pending": "待审批",
            "approved": "已通过",
            "rejected": "已拒绝"
        }
    
    def ensure_directories(self):
        """确保所有必要目录存在"""
        directories = [self.data_dir, self.export_dir]
        for directory in directories:
            if not directory.exists():
                directory.mkdir(parents=True, exist_ok=True)

def get_config():
    """获取配置实例"""
    return Config()
