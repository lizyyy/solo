import os
import re
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class CodeBlock:
    id: str
    language: str
    code: str
    env_vars: List[str]
    file_path: str
    line_number: int

def parse_markdown(content: str, file_path: str = "") -> List[CodeBlock]:
    blocks = []
    pattern = re.compile(
        r'```(\w+)\s+([\w:]+)(?:\s+env:([\w,]+))?\n(.+?)```',
        re.DOTALL
    )
    
    for match in pattern.finditer(content):
        language = match.group(1)
        block_id = match.group(2)
        env_str = match.group(3)
        code = match.group(4).strip()
        
        env_vars = []
        if env_str:
            env_vars = [v.strip() for v in env_str.split(',')]
        
        line_number = content.count('\n', 0, match.start()) + 1
        blocks.append(CodeBlock(
            id=block_id,
            language=language,
            code=code,
            env_vars=env_vars,
            file_path=file_path,
            line_number=line_number
        ))
    
    return blocks

def parse_markdown_files(docs_dir: str) -> List[CodeBlock]:
    all_blocks = []
    
    for root, _, files in os.walk(docs_dir):
        for filename in files:
            if filename.endswith('.md'):
                file_path = os.path.join(root, filename)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                blocks = parse_markdown(content, file_path)
                all_blocks.extend(blocks)
    
    return all_blocks