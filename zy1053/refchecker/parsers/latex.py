"""LaTeX 引用解析器

支持 LaTeX 常用引用命令:
- \cite{key}
- \citet{key}, \citep{key} (natbib)
- \textcite{key}, \parencite{key} (biblatex)
- 带选项: \cite[page]{key}
- 多个key: \cite{key1, key2}
"""

import re
from typing import List, Optional
from ..models import Citation


class LatexParser:
    """LaTeX 文件引用解析器"""
    
    CITE_COMMANDS = [
        'cite', 'citet', 'citep', 'citealt', 'citealp',
        'textcite', 'parencite', 'footcite', 'smartcite',
        'citeyear', 'citeauthor', 'citetitle',
        'citeyearpar', 'citep*', 'citet*',
        'autocite', 'autocite*',
        'Cite', 'Citet', 'Citep', 'Textcite', 'Parencite',
    ]
    
    def _build_pattern(self) -> re.Pattern:
        commands = '|'.join(re.escape(cmd) for cmd in self.CITE_COMMANDS)
        pattern = (
            r'\\'
            r'(?P<command>' + commands + r')'
            r'(?P<optional>\[[^\[\]]*\])?'
            r'\{(?P<keys>[^{}]+)\}'
        )
        return re.compile(pattern, re.MULTILINE)
    
    def __init__(self):
        self._pattern = self._build_pattern()
    
    def parse(self, content: str, filename: str = "<latex>") -> List[Citation]:
        citations = []
        
        if not content or not content.strip():
            return citations
        
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, start=1):
            matches = self._pattern.finditer(line)
            for match in matches:
                command = match.group('command')
                keys_str = match.group('keys')
                full_match = match.group(0)
                
                keys = [k.strip() for k in keys_str.split(',') if k.strip()]
                
                for key in keys:
                    citation = Citation(
                        key=key,
                        raw_text=f"\\{command}{{{key}}}",
                        source_type="latex",
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
            raise FileNotFoundError(f"LaTeX 文件不存在: {filepath}")
        except UnicodeDecodeError:
            try:
                with open(filepath, 'r', encoding='latin-1') as f:
                    content = f.read()
            except Exception:
                raise ValueError(f"无法读取文件编码: {filepath}")
        
        return self.parse(content, filepath)
