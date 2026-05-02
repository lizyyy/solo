"""冲突检测模块"""

import re
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict

from .data_import import QAEntry, ProductParam
from .similarity_search import SimilaritySearch, SimilarMatch, SynonymHandler, KeywordExtractor


@dataclass
class QaConflict:
    """Q&A冲突"""
    conflict_type: str
    question_group: str
    conflicting_entries: List[QAEntry]
    severity: str
    description: str
    suggestions: List[str] = field(default_factory=list)


@dataclass
class ParamConflict:
    """参数冲突"""
    conflict_type: str
    product_name: str
    param_name: str
    conflicting_params: List[ProductParam]
    severity: str
    description: str
    suggestions: List[str] = field(default_factory=list)


@dataclass
class ConflictReport:
    """冲突报告"""
    qa_conflicts: List[QaConflict] = field(default_factory=list)
    param_conflicts: List[ParamConflict] = field(default_factory=list)
    total_qa_conflicts: int = 0
    total_param_conflicts: int = 0
    high_severity_count: int = 0
    medium_severity_count: int = 0
    low_severity_count: int = 0


class ConflictDetector:
    """冲突检测器"""
    
    CONFLICT_SEVERITY_HIGH = 'high'
    CONFLICT_SEVERITY_MEDIUM = 'medium'
    CONFLICT_SEVERITY_LOW = 'low'
    
    NUMERIC_PATTERN = re.compile(r'\d+\.?\d*')
    RANGE_PATTERN = re.compile(r'(\d+\.?\d*)\s*[-~至]\s*(\d+\.?\d*)')
    
    def __init__(
        self,
        similarity_search: SimilaritySearch = None,
        similarity_threshold: float = 0.8
    ):
        self.similarity_search = similarity_search or SimilaritySearch()
        self.similarity_threshold = similarity_threshold
        self.synonym_handler = SynonymHandler()
        self.keyword_extractor = KeywordExtractor(self.synonym_handler)
    
    def detect_qa_conflicts(self, qa_entries: List[QAEntry]) -> List[QaConflict]:
        """检测Q&A冲突
        
        检测相似问题但答案不一致的情况
        """
        conflicts: List[QaConflict] = []
        
        if len(qa_entries) < 2:
            return conflicts
        
        questions = [entry.question for entry in qa_entries]
        
        question_groups = self._group_similar_questions(qa_entries, questions)
        
        for group_key, group_entries in question_groups.items():
            if len(group_entries) < 2:
                continue
            
            conflict = self._analyze_qa_group_conflict(group_key, group_entries)
            if conflict:
                conflicts.append(conflict)
        
        return conflicts
    
    def _group_similar_questions(
        self, 
        qa_entries: List[QAEntry], 
        questions: List[str]
    ) -> Dict[str, List[QAEntry]]:
        """将相似问题分组"""
        groups: Dict[str, List[QAEntry]] = defaultdict(list)
        assigned = set()
        
        for i, entry in enumerate(qa_entries):
            if i in assigned:
                continue
            
            group_key = entry.question
            groups[group_key].append(entry)
            assigned.add(i)
            
            for j, other_entry in enumerate(qa_entries):
                if j <= i or j in assigned:
                    continue
                
                similarity = self._calculate_answer_similarity(
                    entry.question, other_entry.question
                )
                
                if similarity >= self.similarity_threshold:
                    groups[group_key].append(other_entry)
                    assigned.add(j)
        
        return groups
    
    def _calculate_answer_similarity(self, text1: str, text2: str) -> float:
        """计算两个文本的相似度"""
        keywords1 = self.keyword_extractor.extract_keywords(text1)
        keywords2 = self.keyword_extractor.extract_keywords(text2)
        
        if not keywords1 or not keywords2:
            return 0.0
        
        expanded1 = set(self.synonym_handler.expand_keywords(keywords1))
        expanded2 = set(self.synonym_handler.expand_keywords(keywords2))
        
        intersection = len(expanded1 & expanded2)
        union = len(expanded1 | expanded2)
        
        return intersection / union if union > 0 else 0.0
    
    def _analyze_qa_group_conflict(
        self, 
        group_key: str, 
        entries: List[QAEntry]
    ) -> Optional[QaConflict]:
        """分析一组相似Q&A是否存在冲突"""
        if len(entries) < 2:
            return None
        
        answers = [entry.answer for entry in entries]
        
        numeric_conflict = self._check_numeric_conflict(answers)
        boolean_conflict = self._check_boolean_conflict(answers)
        semantic_conflict = self._check_semantic_conflict(answers)
        
        conflict_type = None
        severity = self.CONFLICT_SEVERITY_LOW
        description = ""
        suggestions = []
        
        if numeric_conflict:
            conflict_type = 'numeric_mismatch'
            severity = self.CONFLICT_SEVERITY_HIGH
            description = f"相似问题'{group_key[:50]}...'存在数值冲突: {numeric_conflict}"
            suggestions = ["请核对不同来源的数值，确定正确值", "检查是否为不同版本的参数"]
        
        elif boolean_conflict:
            conflict_type = 'boolean_mismatch'
            severity = self.CONFLICT_SEVERITY_HIGH
            description = f"相似问题'{group_key[:50]}...'存在是/否冲突"
            suggestions = ["请确认功能是否支持", "可能存在版本差异或配置差异"]
        
        elif semantic_conflict:
            conflict_type = 'semantic_mismatch'
            severity = self.CONFLICT_SEVERITY_MEDIUM
            description = f"相似问题'{group_key[:50]}...'存在语义冲突"
            suggestions = ["请检查答案是否描述的是同一问题", "可能需要合并或澄清答案"]
        
        if conflict_type:
            return QaConflict(
                conflict_type=conflict_type,
                question_group=group_key,
                conflicting_entries=entries,
                severity=severity,
                description=description,
                suggestions=suggestions
            )
        
        return None
    
    def _check_numeric_conflict(self, answers: List[str]) -> Optional[str]:
        """检查数值冲突"""
        all_numbers = []
        
        for answer in answers:
            numbers = self._extract_numbers(answer)
            all_numbers.append(numbers)
        
        if len(all_numbers) < 2:
            return None
        
        base_numbers = all_numbers[0]
        conflict_details = []
        
        for i, numbers in enumerate(all_numbers[1:], 1):
            if numbers and base_numbers:
                if not self._numbers_match(base_numbers, numbers):
                    conflict_details.append(
                        f"答案{i+1}: {numbers} vs 基准: {base_numbers}"
                    )
        
        return "; ".join(conflict_details) if conflict_details else None
    
    def _extract_numbers(self, text: str) -> List[float]:
        """从文本中提取数值"""
        numbers = []
        
        for match in self.RANGE_PATTERN.finditer(text):
            numbers.append(float(match.group(1)))
            numbers.append(float(match.group(2)))
        
        for match in self.NUMERIC_PATTERN.finditer(text):
            num = float(match.group())
            if num not in numbers:
                numbers.append(num)
        
        return sorted(numbers)
    
    def _numbers_match(self, nums1: List[float], nums2: List[float]) -> bool:
        """检查两组数值是否匹配（允许一定误差）"""
        if not nums1 or not nums2:
            return True
        
        for num1 in nums1:
            found_match = False
            for num2 in nums2:
                if abs(num1 - num2) < 0.001 or (num1 > 0 and abs(num1 - num2) / num1 < 0.05):
                    found_match = True
                    break
            if not found_match:
                return False
        
        return True
    
    def _check_boolean_conflict(self, answers: List[str]) -> bool:
        """检查是/否冲突"""
        positive_terms = ['是', '支持', '可以', '能够', '有', '存在', '已实现', '支持']
        negative_terms = ['否', '不支持', '不可以', '不能够', '没有', '不存在', '未实现', '暂不']
        
        has_positive = False
        has_negative = False
        
        for answer in answers:
            answer_lower = answer.lower()
            
            for term in positive_terms:
                if term in answer_lower and '不' + term not in answer_lower:
                    has_positive = True
                    break
            
            for term in negative_terms:
                if term in answer_lower:
                    has_negative = True
                    break
            
            for word in ['支持', '可以', '能够']:
                if f'不{word}' in answer_lower:
                    has_negative = True
        
        return has_positive and has_negative
    
    def _check_semantic_conflict(self, answers: List[str]) -> bool:
        """检查语义冲突"""
        if len(answers) < 2:
            return False
        
        base_answer = answers[0]
        
        for answer in answers[1:]:
            similarity = self._calculate_answer_similarity(base_answer, answer)
            
            if similarity < 0.3:
                return True
        
        return False
    
    def detect_param_conflicts(self, params: List[ProductParam]) -> List[ParamConflict]:
        """检测产品参数冲突
        
        检测同一产品同一参数的不同版本值冲突
        """
        conflicts: List[ParamConflict] = []
        
        if not params:
            return conflicts
        
        param_groups = defaultdict(list)
        for param in params:
            key = (param.product_name, param.param_name)
            param_groups[key].append(param)
        
        for (product_name, param_name), group_params in param_groups.items():
            if len(group_params) < 2:
                continue
            
            conflict = self._analyze_param_group_conflict(
                product_name, param_name, group_params
            )
            if conflict:
                conflicts.append(conflict)
        
        return conflicts
    
    def _analyze_param_group_conflict(
        self,
        product_name: str,
        param_name: str,
        params: List[ProductParam]
    ) -> Optional[ParamConflict]:
        """分析一组参数是否存在冲突"""
        if len(params) < 2:
            return None
        
        values = [p.param_value for p in params]
        versions = [p.version for p in params]
        
        unique_values = set(values)
        
        if len(unique_values) == 1:
            return None
        
        has_version_info = any(v for v in versions)
        
        if has_version_info:
            versioned_values = defaultdict(set)
            for param in params:
                if param.version:
                    versioned_values[param.version].add(param.param_value)
            
            all_consistent = True
            for version, vals in versioned_values.items():
                if len(vals) > 1:
                    all_consistent = False
                    break
            
            if all_consistent:
                return ParamConflict(
                    conflict_type='version_difference',
                    product_name=product_name,
                    param_name=param_name,
                    conflicting_params=params,
                    severity=self.CONFLICT_SEVERITY_LOW,
                    description=f"参数'{param_name}'在不同版本中有不同值，但同一版本内一致",
                    suggestions=["这可能是正常的版本差异", "请确认是否需要统一或标注版本"]
                )
        
        numeric_conflict = self._check_numeric_conflict(values)
        
        if numeric_conflict:
            return ParamConflict(
                conflict_type='numeric_mismatch',
                product_name=product_name,
                param_name=param_name,
                conflicting_params=params,
                severity=self.CONFLICT_SEVERITY_HIGH,
                description=f"参数'{param_name}'存在数值冲突: {numeric_conflict}",
                suggestions=["请核对参数值的正确性", "检查是否有版本标注", "确定权威来源"]
            )
        
        return ParamConflict(
            conflict_type='value_mismatch',
            product_name=product_name,
            param_name=param_name,
            conflicting_params=params,
            severity=self.CONFLICT_SEVERITY_MEDIUM,
            description=f"参数'{param_name}'存在值冲突，不同来源有不同描述",
            suggestions=["请确认哪个是正确值", "可能需要合并或澄清描述"]
        )
    
    def generate_conflict_report(
        self,
        qa_entries: List[QAEntry],
        product_params: List[ProductParam]
    ) -> ConflictReport:
        """生成完整的冲突报告"""
        qa_conflicts = self.detect_qa_conflicts(qa_entries)
        param_conflicts = self.detect_param_conflicts(product_params)
        
        high_count = 0
        medium_count = 0
        low_count = 0
        
        for conflict in qa_conflicts + param_conflicts:
            if conflict.severity == self.CONFLICT_SEVERITY_HIGH:
                high_count += 1
            elif conflict.severity == self.CONFLICT_SEVERITY_MEDIUM:
                medium_count += 1
            else:
                low_count += 1
        
        return ConflictReport(
            qa_conflicts=qa_conflicts,
            param_conflicts=param_conflicts,
            total_qa_conflicts=len(qa_conflicts),
            total_param_conflicts=len(param_conflicts),
            high_severity_count=high_count,
            medium_severity_count=medium_count,
            low_severity_count=low_count
        )
    
    def get_conflicts_for_question(
        self,
        question: str,
        qa_entries: List[QAEntry],
        similar_matches: List[SimilarMatch]
    ) -> List[QaConflict]:
        """针对特定问题检测相关冲突"""
        if len(similar_matches) < 2:
            return []
        
        related_entries = [match.matched_qa for match in similar_matches]
        
        conflict = self._analyze_qa_group_conflict(question, related_entries)
        
        return [conflict] if conflict else []
