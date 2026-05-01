"""
合同文本解析模块
"""

import re
from typing import Dict, List, Any


class ContractParser:
    """合同解析器，将文本合同按章节/条款结构化解析"""
    
    SECTION_PATTERNS = [
        r'^第[一二三四五六七八九十百千万零\d]+章[：\s]',
        r'^第[一二三四五六七八九十百千万零\d]+条[：\s]',
        r'^[\d]+[、\.\s]',
        r'^[一二三四五六七八九十]+[、\.\s]',
    ]
    
    CLAUSE_PATTERNS = [
        r'^[\d]+\.[\d]+[、\.\s]',
        r'^[\d]+\.[\d]+\.[\d]+[、\.\s]',
        r'^[（\(][\d]+[）\)]',
        r'^[（\(][一二三四五六七八九十]+[）\)]',
    ]
    
    def __init__(self):
        self.section_regex = [re.compile(pat, re.MULTILINE) for pat in self.SECTION_PATTERNS]
        self.clause_regex = [re.compile(pat, re.MULTILINE) for pat in self.CLAUSE_PATTERNS]
    
    def parse(self, content: str) -> Dict[str, Any]:
        """
        解析合同文本，返回结构化数据
        
        Args:
            content: 合同文本内容
            
        Returns:
            包含章节、条款等结构化信息的字典
        """
        lines = content.split('\n')
        sections = []
        clauses = []
        
        current_section = None
        current_clause = None
        section_content = []
        clause_content = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            is_section = self._is_section_start(line)
            is_clause = self._is_clause_start(line)
            
            if is_section:
                if current_section:
                    current_section['content'] = '\n'.join(section_content).strip()
                    sections.append(current_section)
                
                if current_clause:
                    current_clause['content'] = '\n'.join(clause_content).strip()
                    clauses.append(current_clause)
                    current_clause = None
                    clause_content = []
                
                current_section = {
                    'id': f"section_{len(sections)}",
                    'title': line,
                    'line_number': i + 1,
                    'content': '',
                    'clauses': []
                }
                section_content = [line]
            
            elif is_clause and current_section:
                if current_clause:
                    current_clause['content'] = '\n'.join(clause_content).strip()
                    clauses.append(current_clause)
                    if current_section:
                        current_section['clauses'].append(current_clause['id'])
                
                current_clause = {
                    'id': f"clause_{len(clauses)}",
                    'title': line,
                    'line_number': i + 1,
                    'content': '',
                    'section_id': current_section['id'] if current_section else None
                }
                clause_content = [line]
                section_content.append(line)
            
            else:
                if current_clause:
                    clause_content.append(line)
                if current_section:
                    section_content.append(line)
        
        if current_section:
            current_section['content'] = '\n'.join(section_content).strip()
            sections.append(current_section)
        
        if current_clause:
            current_clause['content'] = '\n'.join(clause_content).strip()
            clauses.append(current_clause)
            if current_section:
                current_section['clauses'].append(current_clause['id'])
        
        return {
            'raw_content': content,
            'sections': sections,
            'clauses': clauses,
            'section_count': len(sections),
            'clause_count': len(clauses)
        }
    
    def _is_section_start(self, line: str) -> bool:
        """判断是否为章节开始"""
        for regex in self.section_regex:
            if regex.match(line):
                return True
        return False
    
    def _is_clause_start(self, line: str) -> bool:
        """判断是否为条款开始"""
        for regex in self.clause_regex:
            if regex.match(line):
                return True
        return False
    
    def find_keywords(self, content: str, keywords: List[str]) -> List[Dict[str, Any]]:
        """
        在内容中查找关键词
        
        Args:
            content: 文本内容
            keywords: 关键词列表
            
        Returns:
            包含关键词位置和上下文的列表
        """
        results = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            for keyword in keywords:
                if keyword.lower() in line.lower():
                    context_start = max(0, i - 2)
                    context_end = min(len(lines), i + 3)
                    context = '\n'.join(lines[context_start:context_end])
                    
                    results.append({
                        'keyword': keyword,
                        'line_number': i + 1,
                        'line_content': line,
                        'context': context
                    })
        
        return results
