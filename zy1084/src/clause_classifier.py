#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
条款分类器模块
负责将合同文本按类别（付款、交付、版权、验收、违约、保密、售后等）进行分类
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class Clause:
    """
    条款数据类
    """
    id: str
    content: str
    category: str = "未分类"
    original_lines: List[str] = field(default_factory=list)
    start_line: int = 0
    end_line: int = 0
    metadata: Dict = field(default_factory=dict)


class ClauseClassifier:
    """
    条款分类器
    根据关键词和规则将合同文本划分为不同类别的条款
    """
    
    # 默认分类关键词映射
    DEFAULT_CATEGORY_KEYWORDS = {
        "付款": [
            "付款", "支付", "款项", "金额", "费用", "价格", "报价", "结算",
            "首付", "预付款", "尾款", "付款节点", "付款方式", "付款时间",
            "支付方式", "支付时间", "支付条件", "付款条件", "合同金额",
            "服务费", "报酬", "酬劳", "佣金", "转账", "汇款", "发票"
        ],
        "交付": [
            "交付", "交货", "提交", "上线", "发布", "部署", "验收交付",
            "交付时间", "交付内容", "交付标准", "交付物", "交付成果",
            "交付期限", "交付日期", "交付方式", "交付地点", "交付范围",
            "里程碑", "阶段交付", "迭代", "版本", "交付周期"
        ],
        "版权": [
            "版权", "著作权", "知识产权", "专利", "商标", "域名", "授权",
            "许可", "使用范围", "使用权", "所有权", "归属", "所有",
            "版权所有", "知识产权归属", "授权范围", "许可使用", "转让",
            "保密条款", "商业秘密", "技术秘密"
        ],
        "验收": [
            "验收", "测试", "质检", "质量验收", "验收标准", "验收流程",
            "验收时间", "验收期限", "验收方式", "验收合格", "验收通过",
            "验收不通过", "验收报告", "试运行", "试用期", "测试验收",
            "UAT", "用户验收测试", "功能验收", "性能验收"
        ],
        "违约": [
            "违约", "违约责任", "违约金", "赔偿", "赔偿责任", "损失赔偿",
            "逾期", "逾期责任", "逾期违约金", "迟延", "迟延履行",
            "解除合同", "合同解除", "终止合同", "合同终止", "违约责任",
            "赔偿损失", "损害赔偿", "惩罚性赔偿", "补偿性赔偿"
        ],
        "保密": [
            "保密", "保密条款", "保密义务", "保密责任", "保密期限",
            "保密内容", "保密范围", "保密措施", "泄密", "泄露",
            "商业秘密", "技术秘密", "保密协议", "NDA", "保密信息",
            "不得披露", "不得泄露", "保密期限"
        ],
        "售后": [
            "售后", "售后服务", "维护", "技术支持", "运维", "保修",
            "保修期", "质保期", "质保", "保修服务", "维护服务",
            "技术服务", "支持服务", "升级服务", "更新服务", "培训",
            "售后支持", "维护期限", "响应时间", "SLA", "服务级别"
        ],
        "变更": [
            "变更", "修改", "调整", "变更管理", "变更流程", "变更请求",
            "需求变更", "范围变更", "变更控制", "变更批准", "变更确认",
            "变更影响", "变更费用", "变更时间", "变更范围"
        ],
        "终止": [
            "终止", "解除", "结束", "终止合同", "解除合同", "终止条件",
            "解除条件", "终止日期", "解除日期", "终止流程", "解除流程",
            "提前终止", "自动终止", "终止责任", "终止赔偿"
        ],
        "争议解决": [
            "争议", "纠纷", "解决", "争议解决", "纠纷解决", "仲裁",
            "诉讼", "法院", "管辖", "管辖权", "法律适用", "适用法律",
            "协商", "调解", "和解", "争议处理"
        ]
    }
    
    # 条款标题模式（用于识别新条款的开始）
    CLAUSE_TITLE_PATTERNS = [
        # 中文条款标题模式
        r'^第[一二三四五六七八九十百千零\d]+[章节条款条项目][、\s]',
        r'^[一二三四五六七八九十百千零\d]+[、\.\s]',
        r'^\d+[\.\d]*[\s、]',
        r'^（[一二三四五六七八九十百千零\d]+）',
        r'^\([一二三四五六七八九十百千零\d]+\)',
        # 英文条款标题模式
        r'^Article\s+\d+',
        r'^Section\s+\d+',
        r'^Clause\s+\d+',
        r'^(\d+\.)+\s*[A-Z]',
    ]
    
    def __init__(self, custom_keywords: Optional[Dict[str, List[str]]] = None):
        """
        初始化条款分类器
        
        Args:
            custom_keywords: 自定义分类关键词，将与默认关键词合并
        """
        # 合并默认关键词和自定义关键词
        self.category_keywords = self.DEFAULT_CATEGORY_KEYWORDS.copy()
        if custom_keywords:
            for category, keywords in custom_keywords.items():
                if category in self.category_keywords:
                    self.category_keywords[category].extend(keywords)
                else:
                    self.category_keywords[category] = keywords
        
        # 编译正则表达式
        self._compile_patterns()
    
    def _compile_patterns(self):
        """
        编译正则表达式模式
        """
        # 编译条款标题模式
        self.clause_title_patterns = [
            re.compile(pattern, re.MULTILINE) 
            for pattern in self.CLAUSE_TITLE_PATTERNS
        ]
        
        # 编译分类关键词模式（不区分大小写）
        self.category_patterns = {}
        for category, keywords in self.category_keywords.items():
            # 为每个分类创建一个关键词匹配模式
            escaped_keywords = [re.escape(k) for k in keywords]
            pattern = '|'.join(escaped_keywords)
            self.category_patterns[category] = re.compile(
                pattern, 
                re.IGNORECASE | re.MULTILINE
            )
    
    def _is_clause_title(self, line: str) -> bool:
        """
        检查一行是否是条款标题
        
        Args:
            line: 文本行
            
        Returns:
            是否是条款标题
        """
        stripped_line = line.strip()
        if not stripped_line:
            return False
        
        for pattern in self.clause_title_patterns:
            if pattern.match(stripped_line):
                return True
        
        return False
    
    def _classify_content(self, content: str) -> Tuple[str, Dict[str, float]]:
        """
        根据内容分类
        
        Args:
            content: 条款内容
            
        Returns:
            (分类名称, 各分类匹配分数)
        """
        scores = defaultdict(float)
        
        # 计算每个分类的匹配分数
        for category, pattern in self.category_patterns.items():
            matches = pattern.findall(content)
            scores[category] = len(matches)
        
        # 找到最高分数的分类
        if scores:
            max_score = max(scores.values())
            if max_score > 0:
                # 找出所有最高分的分类
                top_categories = [
                    cat for cat, score in scores.items() 
                    if score == max_score
                ]
                # 如果有多个最高分，优先返回第一个
                return top_categories[0], dict(scores)
        
        return "未分类", dict(scores)
    
    def _merge_related_lines(self, lines: List[str]) -> List[Dict]:
        """
        将相关的行合并为条款块
        处理同一条款被拆成多段的情况
        
        Args:
            lines: 文本行列表
            
        Returns:
            条款块列表，每个块包含内容和行号信息
        """
        blocks = []
        current_block = None
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            
            # 空行作为潜在的分隔符，但不立即分割
            if not stripped:
                if current_block:
                    current_block["content"] += "\n"
                continue
            
            # 检查是否是新条款的开始
            is_new_clause = self._is_clause_title(stripped)
            
            if is_new_clause:
                # 保存当前块（如果有）
                if current_block and current_block["content"].strip():
                    blocks.append(current_block)
                
                # 开始新块
                current_block = {
                    "content": line,
                    "start_line": i,
                    "end_line": i,
                    "lines": [line]
                }
            else:
                # 继续当前块
                if current_block is None:
                    current_block = {
                        "content": line,
                        "start_line": i,
                        "end_line": i,
                        "lines": [line]
                    }
                else:
                    # 检查是否应该合并（非标题行且与前一行相关）
                    # 简单策略：只要不是标题就合并，空行作为分隔
                    current_block["content"] += "\n" + line
                    current_block["end_line"] = i
                    current_block["lines"].append(line)
        
        # 添加最后一个块
        if current_block and current_block["content"].strip():
            blocks.append(current_block)
        
        return blocks
    
    def classify(self, text: str) -> List[Clause]:
        """
        将文本分类为条款列表
        
        Args:
            text: 合同文本
            
        Returns:
            条款列表
        """
        if not text or not text.strip():
            return []
        
        # 按行分割
        lines = text.split('\n')
        
        # 合并相关行为条款块
        blocks = self._merge_related_lines(lines)
        
        # 对每个块进行分类
        clauses = []
        for i, block in enumerate(blocks):
            content = block["content"].strip()
            if not content:
                continue
            
            # 分类
            category, scores = self._classify_content(content)
            
            # 创建条款对象
            clause = Clause(
                id=f"clause_{i+1:03d}",
                content=content,
                category=category,
                original_lines=block["lines"],
                start_line=block["start_line"],
                end_line=block["end_line"],
                metadata={
                    "classification_scores": scores,
                    "raw_content": block["content"]
                }
            )
            
            clauses.append(clause)
        
        return clauses
    
    def group_by_category(self, clauses: List[Clause]) -> Dict[str, List[Clause]]:
        """
        按类别对条款进行分组
        
        Args:
            clauses: 条款列表
            
        Returns:
            按类别分组的条款字典
        """
        grouped = defaultdict(list)
        for clause in clauses:
            grouped[clause.category].append(clause)
        
        # 转换为普通字典并按类别排序
        return dict(sorted(grouped.items(), key=lambda x: x[0]))
    
    def get_categories(self) -> List[str]:
        """
        获取所有支持的分类
        
        Returns:
            分类名称列表
        """
        return list(self.category_keywords.keys())
    
    def add_category_keywords(self, category: str, keywords: List[str]):
        """
        为指定分类添加关键词
        
        Args:
            category: 分类名称
            keywords: 要添加的关键词列表
        """
        if category not in self.category_keywords:
            self.category_keywords[category] = []
        
        self.category_keywords[category].extend(keywords)
        # 重新编译模式
        self._compile_patterns()
