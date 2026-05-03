#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
风险规则引擎模块
负责根据规则评估合同差异的风险等级，并生成建议的追问句
"""

import re
import json
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from .diff_detector import Change, ChangeType


class RiskLevel(Enum):
    """
    风险等级枚举
    """
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


@dataclass
class RiskRule:
    """
    风险规则数据类
    """
    id: str
    name: str
    category: str
    description: str
    
    # 匹配条件
    triggers: List[str] = field(default_factory=list)
    exclude_triggers: List[str] = field(default_factory=list)
    
    # 风险评估
    risk_level: RiskLevel = RiskLevel.MEDIUM
    change_type_mapping: Dict[ChangeType, RiskLevel] = field(default_factory=dict)
    
    # 建议的追问句
    suggested_questions: List[str] = field(default_factory=list)
    
    # 元数据
    examples: List[Dict] = field(default_factory=list)
    notes: str = ""


@dataclass
class RiskAssessment:
    """
    风险评估结果数据类
    """
    change_id: str
    rule_id: str
    rule_name: str
    
    risk_level: RiskLevel
    confidence: float
    
    matched_triggers: List[str]
    evidence: str
    
    suggested_questions: List[str]
    
    metadata: Dict[str, Any] = field(default_factory=dict)


class RiskDictionary:
    """
    风险词典
    存储风险相关的关键词、短语和模式
    """
    
    # 默认风险词典
    DEFAULT_RISK_WORDS = {
        "付款风险": [
            "逾期", "延迟", "拖延", "拒付", "扣除", "减免", "折扣",
            "最长", "最多", "不少于", "不超过", "最多不超过",
            "协商确定", "另行约定", "根据实际情况", "视情况而定"
        ],
        "交付风险": [
            "延期", "推迟", "顺延", "提前", "加速", "压缩",
            "合理时间", "尽快", "及时", "适时", "适当时候",
            "另行通知", "根据甲方要求", "配合甲方进度"
        ],
        "版权风险": [
            "独家", "独占", "排他", "永久", "终身", "无限期",
            "转让", "出售", "处置", "授权第三方", "再许可",
            "甲方所有", "乙方所有", "共同所有", "按份共有"
        ],
        "验收风险": [
            "严格", "苛刻", "全面", "详尽", "细致",
            "甲方满意", "甲方确认", "甲方认可", "甲方验收通过",
            "一次验收不通过", "多次验收", "重新验收", "返工"
        ],
        "违约风险": [
            "违约金", "赔偿金", "罚款", "滞纳金", "罚息",
            "双倍", "三倍", "十倍", "高额", "巨额",
            "全部损失", "直接损失", "间接损失", "可得利益",
            "解除合同", "终止合同", "立即解除", "随时解除"
        ],
        "模糊表述": [
            "等", "等等", "相关", "相应", "适当", "合理",
            "包括但不限于", "视情况而定", "根据实际情况",
            "另行约定", "协商确定", "双方确认", "另行通知",
            "原则上", "一般情况下", "通常", "基本"
        ]
    }
    
    def __init__(self, custom_words: Optional[Dict[str, List[str]]] = None):
        """
        初始化风险词典
        
        Args:
            custom_words: 自定义风险词汇
        """
        self.risk_words = self.DEFAULT_RISK_WORDS.copy()
        
        if custom_words:
            for category, words in custom_words.items():
                if category in self.risk_words:
                    self.risk_words[category].extend(words)
                else:
                    self.risk_words[category] = words
        
        # 编译正则表达式模式
        self._compile_patterns()
    
    def _compile_patterns(self):
        """
        编译正则表达式模式
        """
        self.patterns = {}
        for category, words in self.risk_words.items():
            escaped_words = [re.escape(w) for w in words]
            pattern = '|'.join(escaped_words)
            self.patterns[category] = re.compile(
                pattern, 
                re.IGNORECASE
            )
    
    def find_risk_words(self, text: str) -> Dict[str, List[str]]:
        """
        查找文本中的风险词汇
        
        Args:
            text: 文本内容
            
        Returns:
            按类别分组的风险词汇字典
        """
        results = defaultdict(list)
        
        for category, pattern in self.patterns.items():
            matches = pattern.findall(text)
            if matches:
                results[category] = list(set(matches))
        
        return dict(results)
    
    def has_risk_words(self, text: str, categories: Optional[List[str]] = None) -> bool:
        """
        检查文本是否包含风险词汇
        
        Args:
            text: 文本内容
            categories: 要检查的类别列表，如果为 None 则检查所有类别
            
        Returns:
            是否包含风险词汇
        """
        if categories is None:
            categories = list(self.patterns.keys())
        
        for category in categories:
            if category in self.patterns:
                if self.patterns[category].search(text):
                    return True
        
        return False
    
    def add_risk_words(self, category: str, words: List[str]):
        """
        添加风险词汇
        
        Args:
            category: 类别名称
            words: 要添加的词汇列表
        """
        if category not in self.risk_words:
            self.risk_words[category] = []
        
        self.risk_words[category].extend(words)
        self._compile_patterns()


class RiskEngine:
    """
    风险规则引擎
    根据规则评估合同差异的风险等级
    """
    
    # 默认风险规则
    DEFAULT_RULES = [
        {
            "id": "R001",
            "name": "付款节点变更",
            "category": "付款",
            "description": "检测付款节点、时间、金额的变化",
            "triggers": ["付款", "支付", "款项", "金额", "节点", "时间", "日期"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.MEDIUM,
            "change_type_mapping": {
                ChangeType.WEAKENED: RiskLevel.HIGH,
                ChangeType.DELETED: RiskLevel.HIGH,
                ChangeType.NEW: RiskLevel.MEDIUM
            },
            "suggested_questions": [
                "付款节点变更的原因是什么？",
                "新的付款时间是否会影响我方现金流？",
                "是否有对应的保障措施？"
            ]
        },
        {
            "id": "R002",
            "name": "交付时间变更",
            "category": "交付",
            "description": "检测交付时间、期限的变化",
            "triggers": ["交付", "时间", "日期", "期限", "延期", "提前"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.MEDIUM,
            "change_type_mapping": {
                ChangeType.WEAKENED: RiskLevel.HIGH,
                ChangeType.DELETED: RiskLevel.HIGH
            },
            "suggested_questions": [
                "交付时间变更是否会影响项目进度？",
                "是否有对应的违约金条款？",
                "我方是否能够满足新的交付时间要求？"
            ]
        },
        {
            "id": "R003",
            "name": "版权归属变更",
            "category": "版权",
            "description": "检测版权、知识产权归属的变化",
            "triggers": ["版权", "著作权", "知识产权", "归属", "所有", "转让"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.HIGH,
            "change_type_mapping": {
                ChangeType.WEAKENED: RiskLevel.CRITICAL,
                ChangeType.NEW: RiskLevel.HIGH
            },
            "suggested_questions": [
                "版权归属变更的原因是什么？",
                "是否会影响我方后续使用该作品？",
                "是否有对应的补偿或授权条款？"
            ]
        },
        {
            "id": "R004",
            "name": "验收标准变更",
            "category": "验收",
            "description": "检测验收标准、流程的变化",
            "triggers": ["验收", "标准", "流程", "合格", "通过", "测试"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.MEDIUM,
            "change_type_mapping": {
                ChangeType.WEAKENED: RiskLevel.HIGH,
                ChangeType.NEW: RiskLevel.MEDIUM
            },
            "suggested_questions": [
                "新的验收标准是否更加严格？",
                "我方是否能够达到新的验收标准？",
                "验收不通过的后果是什么？"
            ]
        },
        {
            "id": "R005",
            "name": "违约金变更",
            "category": "违约",
            "description": "检测违约金、赔偿金额的变化",
            "triggers": ["违约金", "赔偿", "罚款", "金额", "比例"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.HIGH,
            "change_type_mapping": {
                ChangeType.WEAKENED: RiskLevel.CRITICAL,
                ChangeType.STRENGTHENED: RiskLevel.LOW
            },
            "suggested_questions": [
                "违约金变更的幅度是多少？",
                "是否合理？是否在行业标准范围内？",
                "我方是否能够承受可能的违约赔偿？"
            ]
        },
        {
            "id": "R006",
            "name": "保密期限变更",
            "category": "保密",
            "description": "检测保密期限、范围的变化",
            "triggers": ["保密", "期限", "范围", "披露", "泄露"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.MEDIUM,
            "change_type_mapping": {
                ChangeType.WEAKENED: RiskLevel.HIGH,
                ChangeType.NEW: RiskLevel.MEDIUM
            },
            "suggested_questions": [
                "保密期限变更是否合理？",
                "保密范围是否扩大或缩小？",
                "是否有对应的保密措施要求？"
            ]
        },
        {
            "id": "R007",
            "name": "模糊表述检测",
            "category": "未分类",
            "description": "检测表述模糊、不明确的条款",
            "triggers": ["等", "等等", "相关", "相应", "适当", "合理", "另行约定", "协商确定"],
            "exclude_triggers": [],
            "risk_level": RiskLevel.MEDIUM,
            "change_type_mapping": {
                ChangeType.UNCLEAR: RiskLevel.HIGH
            },
            "suggested_questions": [
                "此处表述不明确，具体指什么？",
                "是否可以给出更明确的定义或范围？",
                "是否有相关的补充说明或附件？"
            ]
        },
        {
            "id": "R008",
            "name": "条款删除检测",
            "category": "未分类",
            "description": "检测被删除的条款",
            "triggers": [],
            "exclude_triggers": [],
            "risk_level": RiskLevel.MEDIUM,
            "change_type_mapping": {
                ChangeType.DELETED: RiskLevel.HIGH
            },
            "suggested_questions": [
                "该条款为何被删除？",
                "删除该条款是否会影响我方权益？",
                "是否有其他条款替代该条款的功能？"
            ]
        },
        {
            "id": "R009",
            "name": "新增条款检测",
            "category": "未分类",
            "description": "检测新增的条款",
            "triggers": [],
            "exclude_triggers": [],
            "risk_level": RiskLevel.LOW,
            "change_type_mapping": {
                ChangeType.NEW: RiskLevel.MEDIUM
            },
            "suggested_questions": [
                "新增该条款的目的是什么？",
                "该条款是否会对我方产生不利影响？",
                "是否需要进一步协商或修改？"
            ]
        }
    ]
    
    def __init__(
        self, 
        custom_rules: Optional[List[Dict]] = None,
        risk_dictionary: Optional[RiskDictionary] = None
    ):
        """
        初始化风险规则引擎
        
        Args:
            custom_rules: 自定义规则列表
            risk_dictionary: 风险词典
        """
        self.rules = []
        self.risk_dictionary = risk_dictionary or RiskDictionary()
        
        # 加载默认规则
        for rule_data in self.DEFAULT_RULES:
            rule = self._create_rule_from_dict(rule_data)
            self.rules.append(rule)
        
        # 加载自定义规则
        if custom_rules:
            for rule_data in custom_rules:
                rule = self._create_rule_from_dict(rule_data)
                # 检查是否有相同 ID 的规则，有则替换
                existing_index = next(
                    (i for i, r in enumerate(self.rules) if r.id == rule.id),
                    None
                )
                if existing_index is not None:
                    self.rules[existing_index] = rule
                else:
                    self.rules.append(rule)
    
    def _create_rule_from_dict(self, rule_data: Dict) -> RiskRule:
        """
        从字典创建风险规则
        
        Args:
            rule_data: 规则数据字典
            
        Returns:
            RiskRule 对象
        """
        # 处理风险等级
        risk_level = rule_data.get("risk_level", RiskLevel.MEDIUM)
        if isinstance(risk_level, str):
            risk_level = RiskLevel(risk_level)
        
        # 处理变化类型映射
        change_type_mapping = {}
        for change_type_str, level_str in rule_data.get("change_type_mapping", {}).items():
            try:
                change_type = ChangeType(change_type_str)
                if isinstance(level_str, str):
                    level = RiskLevel(level_str)
                else:
                    level = level_str
                change_type_mapping[change_type] = level
            except (ValueError, KeyError):
                continue
        
        return RiskRule(
            id=rule_data["id"],
            name=rule_data["name"],
            category=rule_data["category"],
            description=rule_data["description"],
            triggers=rule_data.get("triggers", []),
            exclude_triggers=rule_data.get("exclude_triggers", []),
            risk_level=risk_level,
            change_type_mapping=change_type_mapping,
            suggested_questions=rule_data.get("suggested_questions", []),
            examples=rule_data.get("examples", []),
            notes=rule_data.get("notes", "")
        )
    
    def _check_triggers(
        self, 
        text: str, 
        triggers: List[str], 
        exclude_triggers: List[str]
    ) -> Tuple[bool, List[str]]:
        """
        检查文本是否匹配触发词
        
        Args:
            text: 文本内容
            triggers: 触发词列表
            exclude_triggers: 排除触发词列表
            
        Returns:
            (是否匹配, 匹配到的触发词列表)
        """
        matched = []
        
        # 如果没有触发词，默认匹配（用于通用规则）
        if not triggers:
            return True, matched
        
        # 检查触发词
        for trigger in triggers:
            if re.search(re.escape(trigger), text, re.IGNORECASE):
                matched.append(trigger)
        
        # 检查排除触发词
        for exclude in exclude_triggers:
            if re.search(re.escape(exclude), text, re.IGNORECASE):
                return False, []
        
        return len(matched) > 0, matched
    
    def _analyze_change_direction(
        self, 
        change: Change
    ) -> Tuple[Optional[ChangeType], float]:
        """
        分析变化的方向（弱化/加重）
        
        Args:
            change: 变化对象
            
        Returns:
            (变化方向, 置信度)
        """
        # 这里使用简单的启发式规则
        # 实际项目中可能需要更复杂的 NLP 分析
        
        # 检查是否有数值变化
        old_text = change.old_content or ""
        new_text = change.new_content or ""
        
        # 提取数字
        old_numbers = set(re.findall(r'\d+\.?\d*', old_text))
        new_numbers = set(re.findall(r'\d+\.?\d*', new_text))
        
        # 如果有数字变化
        if old_numbers != new_numbers:
            # 简单检查：如果新数字变小，可能是弱化（如违约金减少）
            # 这需要根据具体上下文判断，这里只是示例
            try:
                old_nums = [float(n) for n in old_numbers]
                new_nums = [float(n) for n in new_numbers]
                
                if old_nums and new_nums:
                    old_avg = sum(old_nums) / len(old_nums)
                    new_avg = sum(new_nums) / len(new_nums)
                    
                    if new_avg < old_avg:
                        # 数值变小，可能是弱化（如违约金降低）
                        return ChangeType.WEAKENED, 0.6
                    elif new_avg > old_avg:
                        # 数值变大，可能是加重（如违约金提高）
                        return ChangeType.STRENGTHENED, 0.6
            except (ValueError, ZeroDivisionError):
                pass
        
        # 检查是否有模糊表述
        fuzzy_words = ["等", "等等", "相关", "相应", "适当", "合理", "另行约定", "协商确定"]
        new_has_fuzzy = any(w in new_text for w in fuzzy_words)
        old_has_fuzzy = any(w in old_text for w in fuzzy_words)
        
        if new_has_fuzzy and not old_has_fuzzy:
            # 新增模糊表述
            return ChangeType.UNCLEAR, 0.7
        
        return None, 0.0
    
    def assess_change(self, change: Change) -> List[RiskAssessment]:
        """
        评估单个变化的风险
        
        Args:
            change: 变化对象
            
        Returns:
            风险评估结果列表
        """
        assessments = []
        
        # 组合新旧内容用于匹配
        combined_text = f"{change.old_content} {change.new_content}"
        
        # 分析变化方向
        direction, confidence = self._analyze_change_direction(change)
        
        for rule in self.rules:
            # 检查触发词
            matched, matched_triggers = self._check_triggers(
                combined_text,
                rule.triggers,
                rule.exclude_triggers
            )
            
            if not matched:
                continue
            
            # 确定风险等级
            risk_level = rule.risk_level
            
            # 如果有变化类型映射，使用映射的风险等级
            if change.change_type in rule.change_type_mapping:
                risk_level = rule.change_type_mapping[change.change_type]
            
            # 如果分析出了变化方向，也考虑方向
            if direction and direction in rule.change_type_mapping:
                risk_level = rule.change_type_mapping[direction]
            
            # 创建评估结果
            assessment = RiskAssessment(
                change_id=change.id,
                rule_id=rule.id,
                rule_name=rule.name,
                risk_level=risk_level,
                confidence=max(0.5, confidence),
                matched_triggers=matched_triggers,
                evidence=change.evidence_new or change.evidence_old,
                suggested_questions=rule.suggested_questions.copy(),
                metadata={
                    "category": rule.category,
                    "change_type": change.change_type.value,
                    "direction": direction.value if direction else None
                }
            )
            
            assessments.append(assessment)
        
        # 检查风险词典中的风险词汇
        risk_words_found = self.risk_dictionary.find_risk_words(combined_text)
        if risk_words_found:
            # 创建一个通用的风险评估
            all_words = []
            for words in risk_words_found.values():
                all_words.extend(words)
            
            assessment = RiskAssessment(
                change_id=change.id,
                rule_id="RISK_DICT",
                rule_name="风险词汇检测",
                risk_level=RiskLevel.MEDIUM,
                confidence=0.6,
                matched_triggers=all_words,
                evidence=combined_text[:200],
                suggested_questions=[
                    "这些风险词汇是否需要进一步澄清？",
                    "是否存在潜在的风险点？"
                ],
                metadata={
                    "risk_categories": list(risk_words_found.keys()),
                    "risk_words": risk_words_found
                }
            )
            
            assessments.append(assessment)
        
        return assessments
    
    def assess_changes(self, changes: List[Change]) -> Dict[str, List[RiskAssessment]]:
        """
        评估多个变化的风险
        
        Args:
            changes: 变化列表
            
        Returns:
            按变化 ID 分组的风险评估结果
        """
        results = {}
        
        for change in changes:
            assessments = self.assess_change(change)
            if assessments:
                results[change.id] = assessments
        
        return results
    
    def add_rule(self, rule_data: Dict):
        """
        添加自定义规则
        
        Args:
            rule_data: 规则数据字典
        """
        rule = self._create_rule_from_dict(rule_data)
        
        # 检查是否有相同 ID 的规则，有则替换
        existing_index = next(
            (i for i, r in enumerate(self.rules) if r.id == rule.id),
            None
        )
        
        if existing_index is not None:
            self.rules[existing_index] = rule
        else:
            self.rules.append(rule)
    
    def get_rules_by_category(self, category: str) -> List[RiskRule]:
        """
        按类别获取规则
        
        Args:
            category: 类别名称
            
        Returns:
            规则列表
        """
        return [r for r in self.rules if r.category == category]
    
    def load_rules_from_file(self, filepath: str):
        """
        从文件加载规则
        
        Args:
            filepath: 规则文件路径（JSON 格式）
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            rules_data = json.load(f)
        
        # 支持单个规则对象或规则列表
        if isinstance(rules_data, dict):
            rules_data = [rules_data]
        
        for rule_data in rules_data:
            self.add_rule(rule_data)
