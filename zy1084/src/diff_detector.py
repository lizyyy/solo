#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
差异检测器模块
负责检测不同版本合同之间的差异，包括新增、删除、修改、弱化、加重等变化类型
"""

import re
import difflib
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

try:
    from fuzzywuzzy import fuzz
    HAS_FUZZYWUZZY = True
except ImportError:
    HAS_FUZZYWUZZY = False

try:
    from diff_match_patch import diff_match_patch
    HAS_DIFF_MATCH_PATCH = True
except ImportError:
    HAS_DIFF_MATCH_PATCH = False


class ChangeType(Enum):
    """
    变化类型枚举
    """
    NEW = "新增"           # 新增的条款或内容
    DELETED = "删除"       # 删除的条款或内容
    MODIFIED = "修改"      # 修改的条款或内容
    WEAKENED = "弱化"      # 对我方不利的修改（如减少付款、降低违约金）
    STRENGTHENED = "加重"  # 对我方有利的修改（如增加付款、提高违约金）
    UNCLEAR = "表述模糊"   # 表述不清晰，可能存在歧义


@dataclass
class Change:
    """
    变化数据类
    """
    id: str
    change_type: ChangeType
    category: str = "未分类"
    
    # 变化内容
    old_content: str = ""
    new_content: str = ""
    
    # 证据片段（用于报告）
    evidence_old: str = ""
    evidence_new: str = ""
    
    # 位置信息
    old_start_line: int = 0
    old_end_line: int = 0
    new_start_line: int = 0
    new_end_line: int = 0
    
    # 分析信息
    similarity_score: float = 0.0
    risk_level: str = "低"
    suggested_questions: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class DiffDetector:
    """
    差异检测器
    用于检测不同版本合同之间的差异
    """
    
    # 相似度阈值
    SIMILARITY_THRESHOLD_HIGH = 0.85
    SIMILARITY_THRESHOLD_MEDIUM = 0.6
    SIMILARITY_THRESHOLD_LOW = 0.4
    
    def __init__(self):
        """
        初始化差异检测器
        """
        self._setup_diff_tools()
    
    def _setup_diff_tools(self):
        """
        设置差异比较工具
        """
        if HAS_DIFF_MATCH_PATCH:
            self.dmp = diff_match_patch()
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """
        计算两个文本的相似度
        
        Args:
            text1: 第一个文本
            text2: 第二个文本
            
        Returns:
            相似度分数（0-1）
        """
        if not text1 or not text2:
            return 0.0
        
        # 预处理文本
        text1_clean = self._normalize_text(text1)
        text2_clean = self._normalize_text(text2)
        
        if not text1_clean or not text2_clean:
            return 0.0
        
        # 使用 fuzzywuzzy 进行相似度计算（如果可用）
        if HAS_FUZZYWUZZY:
            # 使用多种相似度算法的平均值
            ratio = fuzz.ratio(text1_clean, text2_clean) / 100.0
            partial_ratio = fuzz.partial_ratio(text1_clean, text2_clean) / 100.0
            token_sort_ratio = fuzz.token_sort_ratio(text1_clean, text2_clean) / 100.0
            return (ratio + partial_ratio + token_sort_ratio) / 3.0
        
        # 回退到简单的 difflib 相似度
        matcher = difflib.SequenceMatcher(None, text1_clean, text2_clean)
        return matcher.ratio()
    
    def _normalize_text(self, text: str) -> str:
        """
        标准化文本（去除多余空格、换行等）
        
        Args:
            text: 原始文本
            
        Returns:
            标准化后的文本
        """
        if not text:
            return ""
        
        # 替换多个空白字符为单个空格
        text = re.sub(r'\s+', ' ', text)
        # 去除首尾空白
        text = text.strip()
        # 转换为小写（不区分大小写）
        text = text.lower()
        
        return text
    
    def _extract_key_phrases(self, text: str) -> List[str]:
        """
        提取文本中的关键短语
        
        Args:
            text: 文本内容
            
        Returns:
            关键短语列表
        """
        if not text:
            return []
        
        # 简单的关键词提取策略：
        # 1. 提取中文词（假设每个中文词由2-4个汉字组成）
        # 2. 提取数字和金额相关的短语
        # 3. 提取法律/合同相关的术语
        
        phrases = []
        
        # 提取金额相关的短语
        amount_pattern = r'[\d，,]+[元万]|人民币[\d，,]+[元万]?|金额[：:]\s*[\d，,]+'
        amounts = re.findall(amount_pattern, text)
        phrases.extend(amounts)
        
        # 提取时间相关的短语
        time_pattern = r'\d+[天月日年周]|[\d一二三四五六七八九十]+[天月日年周]'
        times = re.findall(time_pattern, text)
        phrases.extend(times)
        
        # 提取百分比
        percent_pattern = r'\d+%|\d+百分之[一二三四五六七八九十百千]+'
        percents = re.findall(percent_pattern, text)
        phrases.extend(percents)
        
        return list(set(phrases))
    
    def _find_matching_clauses(
        self, 
        old_clauses: List[Any], 
        new_clauses: List[Any]
    ) -> Tuple[List[Tuple[Any, Any, float]], List[Any], List[Any]]:
        """
        查找匹配的条款
        
        Args:
            old_clauses: 旧版本条款列表
            new_clauses: 新版本条款列表
            
        Returns:
            (匹配的条款对, 旧版本中未匹配的条款, 新版本中未匹配的条款)
        """
        matched_pairs = []
        unmatched_old = list(old_clauses)
        unmatched_new = list(new_clauses)
        
        # 首先尝试按类别匹配
        old_by_category = defaultdict(list)
        new_by_category = defaultdict(list)
        
        for clause in old_clauses:
            old_by_category[clause.category].append(clause)
        
        for clause in new_clauses:
            new_by_category[clause.category].append(clause)
        
        # 对每个类别进行匹配
        for category in set(old_by_category.keys()) | set(new_by_category.keys()):
            old_cat_clauses = old_by_category.get(category, [])
            new_cat_clauses = new_by_category.get(category, [])
            
            # 计算相似度矩阵
            similarity_matrix = {}
            for old_clause in old_cat_clauses:
                for new_clause in new_cat_clauses:
                    similarity = self._calculate_similarity(
                        old_clause.content, 
                        new_clause.content
                    )
                    similarity_matrix[(old_clause.id, new_clause.id)] = similarity
            
            # 使用贪心算法进行匹配
            # 按相似度从高到低排序
            sorted_pairs = sorted(
                similarity_matrix.items(),
                key=lambda x: x[1],
                reverse=True
            )
            
            matched_old_ids = set()
            matched_new_ids = set()
            
            for (old_id, new_id), similarity in sorted_pairs:
                if old_id in matched_old_ids or new_id in matched_new_ids:
                    continue
                
                if similarity >= self.SIMILARITY_THRESHOLD_MEDIUM:
                    # 找到匹配的条款
                    old_clause = next(c for c in old_cat_clauses if c.id == old_id)
                    new_clause = next(c for c in new_cat_clauses if c.id == new_id)
                    
                    matched_pairs.append((old_clause, new_clause, similarity))
                    matched_old_ids.add(old_id)
                    matched_new_ids.add(new_id)
            
            # 移除已匹配的条款
            unmatched_old = [
                c for c in unmatched_old 
                if c.id not in matched_old_ids
            ]
            unmatched_new = [
                c for c in unmatched_new 
                if c.id not in matched_new_ids
            ]
        
        return matched_pairs, unmatched_old, unmatched_new
    
    def _analyze_change_type(
        self, 
        old_clause: Any, 
        new_clause: Any, 
        similarity: float
    ) -> Tuple[ChangeType, Dict[str, Any]]:
        """
        分析变化类型
        
        Args:
            old_clause: 旧条款
            new_clause: 新条款
            similarity: 相似度分数
            
        Returns:
            (变化类型, 元数据)
        """
        metadata = {
            "similarity": similarity,
            "old_length": len(old_clause.content),
            "new_length": len(new_clause.content)
        }
        
        # 如果相似度很高，检查是否有重要的数值变化
        if similarity >= self.SIMILARITY_THRESHOLD_HIGH:
            # 提取关键短语并比较
            old_phrases = self._extract_key_phrases(old_clause.content)
            new_phrases = self._extract_key_phrases(new_clause.content)
            
            # 检查是否有数值变化
            old_numbers = set(re.findall(r'\d+', old_clause.content))
            new_numbers = set(re.findall(r'\d+', new_clause.content))
            
            if old_numbers != new_numbers:
                # 有数值变化，需要进一步分析
                metadata["number_changes"] = {
                    "old": list(old_numbers - new_numbers),
                    "new": list(new_numbers - old_numbers)
                }
                
                # 这里可以根据上下文判断是弱化还是加重
                # 暂时标记为修改，后续风险引擎会进一步分析
                return ChangeType.MODIFIED, metadata
        
        # 中等相似度，标记为修改
        if similarity >= self.SIMILARITY_THRESHOLD_MEDIUM:
            return ChangeType.MODIFIED, metadata
        
        # 低相似度，可能是完全不同的条款
        # 需要进一步判断是删除后新增还是完全替换
        return ChangeType.MODIFIED, metadata
    
    def _create_diff_evidence(
        self, 
        old_content: str, 
        new_content: str
    ) -> Tuple[str, str]:
        """
        创建差异证据片段
        
        Args:
            old_content: 旧内容
            new_content: 新内容
            
        Returns:
            (旧证据片段, 新证据片段)
        """
        # 提取关键差异部分
        # 使用 difflib 找到差异位置
        old_lines = old_content.split('\n')
        new_lines = new_content.split('\n')
        
        differ = difflib.Differ()
        diff = list(differ.compare(old_lines, new_lines))
        
        # 收集有差异的行
        old_diff_lines = []
        new_diff_lines = []
        
        for line in diff:
            if line.startswith('- '):
                old_diff_lines.append(line[2:])
            elif line.startswith('+ '):
                new_diff_lines.append(line[2:])
        
        # 如果没有找到行级差异，尝试字符级差异
        if not old_diff_lines and not new_diff_lines:
            # 使用 difflib 进行字符级比较
            s = difflib.SequenceMatcher(None, old_content, new_content)
            
            for tag, i1, i2, j1, j2 in s.get_opcodes():
                if tag == 'delete':
                    old_diff_lines.append(old_content[i1:i2])
                elif tag == 'insert':
                    new_diff_lines.append(new_content[j1:j2])
                elif tag == 'replace':
                    old_diff_lines.append(old_content[i1:i2])
                    new_diff_lines.append(new_content[j1:j2])
        
        # 限制证据长度
        evidence_old = '\n'.join(old_diff_lines[:3]) if old_diff_lines else old_content[:200]
        evidence_new = '\n'.join(new_diff_lines[:3]) if new_diff_lines else new_content[:200]
        
        return evidence_old, evidence_new
    
    def detect_changes(
        self, 
        old_clauses: List[Any], 
        new_clauses: List[Any]
    ) -> List[Change]:
        """
        检测两个版本之间的差异
        
        Args:
            old_clauses: 旧版本条款列表
            new_clauses: 新版本条款列表
            
        Returns:
            变化列表
        """
        changes = []
        
        # 查找匹配的条款
        matched_pairs, unmatched_old, unmatched_new = self._find_matching_clauses(
            old_clauses, 
            new_clauses
        )
        
        # 处理匹配的条款对
        for i, (old_clause, new_clause, similarity) in enumerate(matched_pairs):
            # 分析变化类型
            change_type, metadata = self._analyze_change_type(
                old_clause, 
                new_clause, 
                similarity
            )
            
            # 创建差异证据
            evidence_old, evidence_new = self._create_diff_evidence(
                old_clause.content, 
                new_clause.content
            )
            
            # 创建变化对象
            change = Change(
                id=f"change_{i+1:03d}",
                change_type=change_type,
                category=old_clause.category,
                old_content=old_clause.content,
                new_content=new_clause.content,
                evidence_old=evidence_old,
                evidence_new=evidence_new,
                old_start_line=old_clause.start_line,
                old_end_line=old_clause.end_line,
                new_start_line=new_clause.start_line,
                new_end_line=new_clause.end_line,
                similarity_score=similarity,
                metadata={
                    **metadata,
                    "old_clause_id": old_clause.id,
                    "new_clause_id": new_clause.id
                }
            )
            
            changes.append(change)
        
        # 处理旧版本中未匹配的条款（可能是删除的）
        for i, clause in enumerate(unmatched_old):
            change = Change(
                id=f"change_deleted_{i+1:03d}",
                change_type=ChangeType.DELETED,
                category=clause.category,
                old_content=clause.content,
                new_content="",
                evidence_old=clause.content[:200],
                evidence_new="",
                old_start_line=clause.start_line,
                old_end_line=clause.end_line,
                new_start_line=0,
                new_end_line=0,
                similarity_score=0.0,
                metadata={
                    "old_clause_id": clause.id,
                    "status": "deleted"
                }
            )
            changes.append(change)
        
        # 处理新版本中未匹配的条款（可能是新增的）
        for i, clause in enumerate(unmatched_new):
            change = Change(
                id=f"change_new_{i+1:03d}",
                change_type=ChangeType.NEW,
                category=clause.category,
                old_content="",
                new_content=clause.content,
                evidence_old="",
                evidence_new=clause.content[:200],
                old_start_line=0,
                old_end_line=0,
                new_start_line=clause.start_line,
                new_end_line=clause.end_line,
                similarity_score=0.0,
                metadata={
                    "new_clause_id": clause.id,
                    "status": "new"
                }
            )
            changes.append(change)
        
        return changes
    
    def detect_changes_multiple_versions(
        self, 
        versions: Dict[str, List[Any]]
    ) -> Dict[str, List[Change]]:
        """
        检测多个版本之间的差异
        
        Args:
            versions: 版本字典，格式为 {版本名: 条款列表}
            
        Returns:
            各版本之间的差异字典，格式为 {版本对比: 变化列表}
        """
        results = {}
        
        # 按版本顺序比较
        version_names = sorted(versions.keys())
        
        for i in range(len(version_names) - 1):
            old_version = version_names[i]
            new_version = version_names[i + 1]
            
            changes = self.detect_changes(
                versions[old_version],
                versions[new_version]
            )
            
            results[f"{old_version} → {new_version}"] = changes
        
        return results
