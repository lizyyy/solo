"""Markdown 引用解析器

支持 Pandoc 风格的引用格式:
- [@key] - 单个引用
- [@key1; @key2] - 多个引用
- [text @key] - 带正文的引用
- [-@key] - 抑制作者名的引用
"""

import re
from typing import List, Optional
from ..models import Citation


class MarkdownParser:
    """Markdown 文件引用解析器"""
    
    CITATION_PATTERN = re.compile(
        r'\[([^\[\]]*?@[a-zA-Z0-9_:.-]+[^\[\]]*?)\]',
        re.MULTILINE
    )
    
    KEY_PATTERN = re.compile(
        r'(?P<prefix>-?)@(?P<key>[a-zA-Z0-9_:.-]+)',
        re.MULTILINE
    )
    
    def parse(self, content: str, filename: str = "<markdown>") -> List[Citation]:
        citations = []
        
        if not content or not content.strip():
            return citations
        
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, start=1):
            matches = self.CITATION_PATTERN.finditer(line)
            for match in matches:
                full_match = match.group(0)
                inner_text = match.group(1)
                
                key_matches = list(self.KEY_PATTERN.finditer(inner_text))
                for key_match in key_matches:
                    key = key_match.group('key').strip()
                    prefix = key_match.group('prefix')
                    
                    raw_text = f"{prefix}@{key}"
                    
                    citation = Citation(
                        key=key,
                        raw_text=raw_text,
                        source_type="markdown",
                        line_number=line_num,
                        context=line.strip()
                    )
                    citations.append(citation)
        
        return citations
    
    def parse_file(self, filepath: str) -> List[Citation]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"Markdown 文件不存在: {filepath}")
        except UnicodeDecodeError:
            raise ValueError(f"无法读取文件编码，请确保是 UTF-8 格式: {filepath}")
        
        return self.parse(content, filepath)
