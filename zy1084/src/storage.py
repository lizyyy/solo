#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
存储模块
负责本地持久化存储和历史记录管理
"""

import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path
from enum import Enum

from .diff_detector import Change, ChangeType
from .risk_engine import RiskAssessment, RiskLevel


class StorageFormat(Enum):
    """
    存储格式枚举
    """
    JSON = "json"
    JSONL = "jsonl"


@dataclass
class AnalysisRecord:
    """
    分析记录数据类
    """
    id: str
    project_name: str
    created_at: str
    
    # 版本信息
    versions: List[str] = field(default_factory=list)
    
    # 分析结果摘要
    summary: Dict[str, Any] = field(default_factory=dict)
    
    # 文件路径（相对路径）
    file_paths: Dict[str, str] = field(default_factory=dict)
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典
        """
        return {
            "id": self.id,
            "project_name": self.project_name,
            "created_at": self.created_at,
            "versions": self.versions,
            "summary": self.summary,
            "file_paths": self.file_paths,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AnalysisRecord':
        """
        从字典创建
        """
        return cls(
            id=data["id"],
            project_name=data["project_name"],
            created_at=data["created_at"],
            versions=data.get("versions", []),
            summary=data.get("summary", {}),
            file_paths=data.get("file_paths", {}),
            metadata=data.get("metadata", {})
        )


class LocalStorage:
    """
    本地存储管理器
    负责管理历史记录和分析结果的持久化
    """
    
    # 默认目录结构
    DEFAULT_DIRS = {
        "history": "history",
        "exports": "exports",
        "config": "config",
        "temp": "temp"
    }
    
    def __init__(self, base_dir: Optional[str] = None):
        """
        初始化本地存储
        
        Args:
            base_dir: 基础目录路径，如果为 None 则使用当前目录
        """
        if base_dir is None:
            base_dir = os.getcwd()
        
        self.base_dir = Path(base_dir)
        
        # 初始化目录结构
        self._init_directories()
    
    def _init_directories(self):
        """
        初始化目录结构
        """
        for dir_name in self.DEFAULT_DIRS.values():
            dir_path = self.base_dir / dir_name
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def _generate_id(self) -> str:
        """
        生成唯一 ID
        
        Returns:
            唯一 ID 字符串
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"analysis_{timestamp}"
    
    def _get_history_file(self) -> Path:
        """
        获取历史记录文件路径
        
        Returns:
            历史记录文件路径
        """
        return self.base_dir / self.DEFAULT_DIRS["history"] / "index.json"
    
    def _get_analysis_dir(self, analysis_id: str) -> Path:
        """
        获取分析记录目录
        
        Args:
            analysis_id: 分析记录 ID
            
        Returns:
            分析记录目录路径
        """
        return self.base_dir / self.DEFAULT_DIRS["history"] / analysis_id
    
    def save_analysis(
        self,
        project_name: str,
        versions: List[str],
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]],
        file_paths: Optional[Dict[str, str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AnalysisRecord:
        """
        保存分析结果
        
        Args:
            project_name: 项目名称
            versions: 版本名称列表
            changes: 变化列表
            assessments: 风险评估结果
            file_paths: 原始文件路径
            metadata: 额外元数据
            
        Returns:
            分析记录对象
        """
        # 生成 ID 和时间戳
        analysis_id = self._generate_id()
        created_at = datetime.now().isoformat()
        
        # 创建分析目录
        analysis_dir = self._get_analysis_dir(analysis_id)
        analysis_dir.mkdir(parents=True, exist_ok=True)
        
        # 准备摘要
        summary = self._generate_summary(changes, assessments)
        
        # 保存详细数据
        # 1. 保存变化数据
        changes_data = self._changes_to_dict(changes)
        changes_file = analysis_dir / "changes.json"
        with open(changes_file, 'w', encoding='utf-8') as f:
            json.dump(changes_data, f, ensure_ascii=False, indent=2)
        
        # 2. 保存风险评估数据
        assessments_data = self._assessments_to_dict(assessments)
        assessments_file = analysis_dir / "assessments.json"
        with open(assessments_file, 'w', encoding='utf-8') as f:
            json.dump(assessments_data, f, ensure_ascii=False, indent=2)
        
        # 3. 保存摘要
        summary_file = analysis_dir / "summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        # 创建分析记录
        record = AnalysisRecord(
            id=analysis_id,
            project_name=project_name,
            created_at=created_at,
            versions=versions,
            summary=summary,
            file_paths=file_paths or {},
            metadata=metadata or {}
        )
        
        # 更新历史索引
        self._update_history_index(record)
        
        return record
    
    def _generate_summary(
        self,
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]]
    ) -> Dict[str, Any]:
        """
        生成分析摘要
        
        Args:
            changes: 变化列表
            assessments: 风险评估结果
            
        Returns:
            摘要字典
        """
        # 统计变化类型
        change_type_counts = {}
        category_counts = {}
        
        for change in changes:
            # 变化类型统计
            change_type = change.change_type.value
            if change_type not in change_type_counts:
                change_type_counts[change_type] = 0
            change_type_counts[change_type] += 1
            
            # 类别统计
            category = change.category
            if category not in category_counts:
                category_counts[category] = 0
            category_counts[category] += 1
        
        # 统计风险等级
        risk_level_counts = {
            "严重": 0,
            "高": 0,
            "中": 0,
            "低": 0
        }
        
        for change_id, assessment_list in assessments.items():
            for assessment in assessment_list:
                level = assessment.risk_level.value
                if level in risk_level_counts:
                    risk_level_counts[level] += 1
                else:
                    risk_level_counts[level] = 1
        
        return {
            "total_changes": len(changes),
            "total_assessments": sum(len(a) for a in assessments.values()),
            "change_types": change_type_counts,
            "categories": category_counts,
            "risk_levels": risk_level_counts,
            "generated_at": datetime.now().isoformat()
        }
    
    def _changes_to_dict(self, changes: List[Change]) -> List[Dict[str, Any]]:
        """
        将变化列表转换为字典列表
        
        Args:
            changes: 变化列表
            
        Returns:
            字典列表
        """
        result = []
        for change in changes:
            result.append({
                "id": change.id,
                "change_type": change.change_type.value,
                "category": change.category,
                "old_content": change.old_content,
                "new_content": change.new_content,
                "evidence_old": change.evidence_old,
                "evidence_new": change.evidence_new,
                "old_start_line": change.old_start_line,
                "old_end_line": change.old_end_line,
                "new_start_line": change.new_start_line,
                "new_end_line": change.new_end_line,
                "similarity_score": change.similarity_score,
                "risk_level": change.risk_level,
                "suggested_questions": change.suggested_questions,
                "metadata": change.metadata
            })
        return result
    
    def _assessments_to_dict(
        self, 
        assessments: Dict[str, List[RiskAssessment]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        将风险评估结果转换为字典
        
        Args:
            assessments: 风险评估结果
            
        Returns:
            字典
        """
        result = {}
        for change_id, assessment_list in assessments.items():
            result[change_id] = []
            for assessment in assessment_list:
                result[change_id].append({
                    "change_id": assessment.change_id,
                    "rule_id": assessment.rule_id,
                    "rule_name": assessment.rule_name,
                    "risk_level": assessment.risk_level.value,
                    "confidence": assessment.confidence,
                    "matched_triggers": assessment.matched_triggers,
                    "evidence": assessment.evidence,
                    "suggested_questions": assessment.suggested_questions,
                    "metadata": assessment.metadata
                })
        return result
    
    def _update_history_index(self, record: AnalysisRecord):
        """
        更新历史索引文件
        
        Args:
            record: 分析记录
        """
        history_file = self._get_history_file()
        
        # 读取现有历史
        history = []
        if history_file.exists():
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                history = []
        
        # 添加新记录
        history.append(record.to_dict())
        
        # 按时间排序（最新的在前）
        history.sort(key=lambda x: x["created_at"], reverse=True)
        
        # 保存
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    
    def get_history(self, limit: int = 10) -> List[AnalysisRecord]:
        """
        获取历史记录
        
        Args:
            limit: 返回记录数量限制
            
        Returns:
            分析记录列表
        """
        history_file = self._get_history_file()
        
        if not history_file.exists():
            return []
        
        try:
            with open(history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
        
        # 转换为 AnalysisRecord 对象
        records = []
        for item in history[:limit]:
            try:
                record = AnalysisRecord.from_dict(item)
                records.append(record)
            except KeyError:
                continue
        
        return records
    
    def get_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """
        获取详细分析结果
        
        Args:
            analysis_id: 分析记录 ID
            
        Returns:
            分析结果字典，如果不存在则返回 None
        """
        analysis_dir = self._get_analysis_dir(analysis_id)
        
        if not analysis_dir.exists():
            return None
        
        result = {}
        
        # 读取摘要
        summary_file = analysis_dir / "summary.json"
        if summary_file.exists():
            try:
                with open(summary_file, 'r', encoding='utf-8') as f:
                    result["summary"] = json.load(f)
            except json.JSONDecodeError:
                result["summary"] = {}
        
        # 读取变化数据
        changes_file = analysis_dir / "changes.json"
        if changes_file.exists():
            try:
                with open(changes_file, 'r', encoding='utf-8') as f:
                    result["changes"] = json.load(f)
            except json.JSONDecodeError:
                result["changes"] = []
        
        # 读取风险评估数据
        assessments_file = analysis_dir / "assessments.json"
        if assessments_file.exists():
            try:
                with open(assessments_file, 'r', encoding='utf-8') as f:
                    result["assessments"] = json.load(f)
            except json.JSONDecodeError:
                result["assessments"] = {}
        
        return result if result else None
    
    def delete_analysis(self, analysis_id: str) -> bool:
        """
        删除分析记录
        
        Args:
            analysis_id: 分析记录 ID
            
        Returns:
            是否成功删除
        """
        # 删除目录
        analysis_dir = self._get_analysis_dir(analysis_id)
        if analysis_dir.exists():
            shutil.rmtree(analysis_dir)
        
        # 更新历史索引
        history_file = self._get_history_file()
        if history_file.exists():
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    history = json.load(f)
                
                # 过滤掉要删除的记录
                history = [r for r in history if r["id"] != analysis_id]
                
                with open(history_file, 'w', encoding='utf-8') as f:
                    json.dump(history, f, ensure_ascii=False, indent=2)
            except (json.JSONDecodeError, FileNotFoundError):
                pass
        
        return True
    
    def get_exports_dir(self) -> Path:
        """
        获取导出目录
        
        Returns:
            导出目录路径
        """
        return self.base_dir / self.DEFAULT_DIRS["exports"]
    
    def get_config_dir(self) -> Path:
        """
        获取配置目录
        
        Returns:
            配置目录路径
        """
        return self.base_dir / self.DEFAULT_DIRS["config"]
    
    def save_config(self, name: str, config: Dict[str, Any]):
        """
        保存配置文件
        
        Args:
            name: 配置名称（不含扩展名）
            config: 配置数据
        """
        config_dir = self.get_config_dir()
        config_file = config_dir / f"{name}.json"
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    
    def load_config(self, name: str) -> Optional[Dict[str, Any]]:
        """
        加载配置文件
        
        Args:
            name: 配置名称（不含扩展名）
            
        Returns:
            配置数据，如果不存在则返回 None
        """
        config_dir = self.get_config_dir()
        config_file = config_dir / f"{name}.json"
        
        if not config_file.exists():
            return None
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return None
