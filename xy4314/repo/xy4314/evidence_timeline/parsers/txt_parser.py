"""TXT解析器 - 用于解析庭审笔录草稿"""
import re
from typing import Any, Dict, List
from datetime import datetime
from .base_parser import BaseParser


class TXTParser(BaseParser):
    """TXT文件解析器"""
    
    def __init__(self):
        self.supported_extensions = ['.txt']
        self.evidence_pattern = re.compile(r'[Ee][0-9]+')
        self.date_pattern = re.compile(r'\d{4}[-/]\d{2}[-/]\d{2}')
    
    def supports_file(self, file_path: str) -> bool:
        """检查是否支持该文件类型"""
        return any(file_path.lower().endswith(ext) for ext in self.supported_extensions)
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """
        解析庭审笔录草稿TXT文件
        
        解析逻辑：
        1. 提取所有内容
        2. 识别证据引用（E001, e002等）
        3. 识别时间戳
        4. 按段落或语义分割内容
        """
        results = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        paragraphs = self._split_paragraphs(content)
        
        for i, para in enumerate(paragraphs):
            if not para.strip():
                continue
            
            evidence_refs = self.evidence_pattern.findall(para)
            dates = self.date_pattern.findall(para)
            
            timestamp = None
            if dates:
                try:
                    timestamp = self._parse_timestamp(dates[0])
                except Exception:
                    pass
            
            results.append({
                'id': f'transcript_{i}',
                'type': 'transcript',
                'content': para.strip(),
                'timestamp': timestamp,
                'metadata': {
                    'evidence_refs': evidence_refs,
                    'dates': dates,
                    'paragraph_index': i
                }
            })
        
        return results
    
    def _split_paragraphs(self, content: str) -> List[str]:
        """
        将文本按段落分割
        
        Args:
            content: 原始文本内容
            
        Returns:
            段落列表
        """
        paragraphs = re.split(r'\n\s*\n', content)
        return [p for p in paragraphs if p.strip()]
