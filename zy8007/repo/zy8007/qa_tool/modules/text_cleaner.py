"""文本清洗模块"""

import re
import hashlib
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass

from .data_import import QAEntry, ProductParam, CustomerQuestion


@dataclass
class CleanResult:
    """清洗结果"""
    original_count: int
    cleaned_count: int
    removed_empty: int
    removed_duplicates: int
    issues: List[Dict[str, Any]]


class TextCleaner:
    """文本清洗器"""

    def __init__(self):
        self.issues: List[Dict[str, Any]] = []

    def normalize_text(self, text: str) -> str:
        """标准化文本
        
        - 去除首尾空白
        - 统一全角/半角字符
        - 去除多余空白和换行
        - 统一标点符号
        """
        if not text:
            return ""
        
        text = text.strip()
        
        text = self._fullwidth_to_halfwidth(text)
        
        lines = text.split('\n')
        lines = [line.strip() for line in lines]
        lines = [re.sub(r'[ \t]+', ' ', line) for line in lines]
        lines = [line for line in lines if line]
        text = '\n'.join(lines)
        
        text = self._normalize_punctuation(text)
        
        return text.strip()

    def _fullwidth_to_halfwidth(self, text: str) -> str:
        """全角转半角"""
        result = []
        for char in text:
            code = ord(char)
            if code == 0x3000:
                result.append(' ')
            elif 0xFF01 <= code <= 0xFF5E:
                result.append(chr(code - 0xFEE0))
            else:
                result.append(char)
        return ''.join(result)

    def _normalize_punctuation(self, text: str) -> str:
        """标准化标点符号"""
        punctuation_map = {
            '：': ':',
            '；': ';',
            '，': ',',
            '。': '.',
            '！': '!',
            '？': '?',
            '（': '(',
            '）': ')',
            '【': '[',
            '】': ']',
            '「': '"',
            '」': '"',
            '『': "'",
            '』': "'",
            '……': '...',
            '—': '-',
        }
        
        for old, new in punctuation_map.items():
            text = text.replace(old, new)
        
        return text

    def is_empty_answer(self, entry: QAEntry) -> bool:
        """检查是否为空答案"""
        answer = self.normalize_text(entry.answer)
        if not answer:
            return True
        
        empty_patterns = [
            r'^无$',
            r'^暂无$',
            r'^待补充$',
            r'^请咨询$',
            r'^详见.*$',
            r'^参考.*$',
            r'^$',
        ]
        
        for pattern in empty_patterns:
            if re.match(pattern, answer, re.IGNORECASE):
                return True
        
        return False

    def generate_entry_hash(self, entry: QAEntry) -> str:
        """生成Q&A条目的哈希值用于去重
        
        基于标准化后的问题和答案生成
        """
        normalized_question = self.normalize_text(entry.question)
        normalized_answer = self.normalize_text(entry.answer)
        
        content = f"{normalized_question}|{normalized_answer}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def clean_qa_entries(self, entries: List[QAEntry]) -> Tuple[List[QAEntry], CleanResult]:
        """清洗Q&A条目列表
        
        - 去除空答案条目
        - 标准化文本
        - 去重
        """
        self.issues.clear()
        original_count = len(entries)
        removed_empty = 0
        removed_duplicates = 0
        
        seen_hashes = set()
        cleaned_entries: List[QAEntry] = []
        
        for entry in entries:
            normalized_question = self.normalize_text(entry.question)
            normalized_answer = self.normalize_text(entry.answer)
            
            if self.is_empty_answer(entry):
                removed_empty += 1
                self.issues.append({
                    'type': 'empty_answer',
                    'question': entry.question[:100] if entry.question else '',
                    'source': entry.source,
                    'action': 'removed'
                })
                continue
            
            entry_hash = self.generate_entry_hash(entry)
            
            if entry_hash in seen_hashes:
                removed_duplicates += 1
                self.issues.append({
                    'type': 'duplicate',
                    'question': normalized_question[:100],
                    'source': entry.source,
                    'action': 'removed'
                })
                continue
            
            seen_hashes.add(entry_hash)
            
            cleaned_entry = QAEntry(
                question=normalized_question,
                answer=normalized_answer,
                source=entry.source,
                id=entry.id,
                metadata=entry.metadata.copy()
            )
            cleaned_entries.append(cleaned_entry)
        
        result = CleanResult(
            original_count=original_count,
            cleaned_count=len(cleaned_entries),
            removed_empty=removed_empty,
            removed_duplicates=removed_duplicates,
            issues=self.issues.copy()
        )
        
        return cleaned_entries, result

    def normalize_product_params(self, params: List[ProductParam]) -> List[ProductParam]:
        """标准化产品参数"""
        normalized_params = []
        
        for param in params:
            normalized_param = ProductParam(
                product_name=self.normalize_text(param.product_name),
                param_name=self.normalize_text(param.param_name),
                param_value=self.normalize_text(param.param_value),
                version=self.normalize_text(param.version),
                source=param.source,
                metadata=param.metadata.copy()
            )
            normalized_params.append(normalized_param)
        
        return normalized_params

    def normalize_customer_questions(self, questions: List[CustomerQuestion]) -> List[CustomerQuestion]:
        """标准化客户问题"""
        normalized_questions = []
        
        for question in questions:
            normalized_question = CustomerQuestion(
                question=self.normalize_text(question.question),
                context=self.normalize_text(question.context),
                id=question.id
            )
            normalized_questions.append(normalized_question)
        
        return normalized_questions

    def get_issues(self) -> List[Dict[str, Any]]:
        """获取清洗过程中发现的问题"""
        return self.issues.copy()

    def clear_issues(self):
        """清空问题记录"""
        self.issues.clear()
