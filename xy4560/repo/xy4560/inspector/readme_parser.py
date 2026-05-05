"""README 解析器 - 提取文档中的命令、端口和预期文件"""

import re
import os
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from markdown_it import MarkdownIt


@dataclass
class ExtractedCommand:
    """从 README 提取的命令"""
    
    command: str
    command_type: str
    section: str = ""
    description: str = ""
    raw_text: str = ""
    line_number: int = 0
    
    def __post_init__(self):
        self.command_type = self._determine_type()
    
    def _determine_type(self) -> str:
        """确定命令类型"""
        cmd_lower = self.command.lower()
        if cmd_lower.startswith("npm "):
            return "npm"
        elif cmd_lower.startswith("pnpm "):
            return "pnpm"
        elif cmd_lower.startswith("yarn "):
            return "yarn"
        elif cmd_lower.startswith("python ") or cmd_lower.startswith("python3 "):
            return "python"
        elif cmd_lower.startswith("curl "):
            return "curl"
        elif cmd_lower.startswith("wget "):
            return "wget"
        elif cmd_lower.startswith("node "):
            return "node"
        return "unknown"


@dataclass
class ExtractedPort:
    """从 README 提取的端口信息"""
    
    port: int
    description: str = ""
    service: str = ""
    raw_text: str = ""


@dataclass
class ExtractedFile:
    """从 README 提取的预期输出文件"""
    
    file_path: str
    description: str = ""
    is_output: bool = False
    is_required: bool = False
    raw_text: str = ""


@dataclass
class ParsedReadme:
    """解析后的 README 数据"""
    
    commands: List[ExtractedCommand] = field(default_factory=list)
    ports: List[ExtractedPort] = field(default_factory=list)
    files: List[ExtractedFile] = field(default_factory=list)
    raw_content: str = ""
    sections: Dict[str, str] = field(default_factory=dict)


class ReadmeParser:
    """README 解析器"""
    
    COMMAND_PATTERNS = [
        re.compile(r"^npm\s+[\w-]+.*$", re.MULTILINE),
        re.compile(r"^pnpm\s+[\w-]+.*$", re.MULTILINE),
        re.compile(r"^yarn\s+[\w-]+.*$", re.MULTILINE),
        re.compile(r"^python3?\s+.*$", re.MULTILINE),
        re.compile(r"^curl\s+.*$", re.MULTILINE),
        re.compile(r"^wget\s+.*$", re.MULTILINE),
        re.compile(r"^node\s+.*$", re.MULTILINE),
    ]
    
    PORT_PATTERN = re.compile(
        r"(?:port|端口|监听|listen|running on|访问|localhost|127\.0\.0\.1)[:\s]+(\d{2,5})",
        re.IGNORECASE
    )
    
    FILE_PATTERN = re.compile(
        r"(?:生成|输出|创建|将生成|output|generate|create|save)(?:到|到|文件|为)?[:\s]+[`\"]?([\w\-_./\\]+\.[\w]+)[`\"]?",
        re.IGNORECASE
    )
    
    def __init__(self, project_dir: str):
        self.project_dir = project_dir
        self.readme_path = self._find_readme()
        self.md = MarkdownIt()
    
    def _find_readme(self) -> Optional[str]:
        """查找 README 文件"""
        readme_names = ["README.md", "readme.md", "README", "readme"]
        for name in readme_names:
            path = os.path.join(self.project_dir, name)
            if os.path.exists(path):
                return path
        return None
    
    def parse(self) -> ParsedReadme:
        """解析 README 文件"""
        if not self.readme_path or not os.path.exists(self.readme_path):
            return ParsedReadme()
        
        with open(self.readme_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        parsed = ParsedReadme(raw_content=content)
        
        parsed.sections = self._extract_sections(content)
        parsed.commands = self._extract_commands(content, parsed.sections)
        parsed.ports = self._extract_ports(content)
        parsed.files = self._extract_files(content)
        
        return parsed
    
    def _extract_sections(self, content: str) -> Dict[str, str]:
        """提取文档章节"""
        sections = {}
        lines = content.split("\n")
        current_section = "root"
        current_content = []
        
        for line in lines:
            if line.startswith("#"):
                if current_content:
                    sections[current_section] = "\n".join(current_content).strip()
                current_section = line.lstrip("#").strip()
                current_content = []
            else:
                current_content.append(line)
        
        if current_content:
            sections[current_section] = "\n".join(current_content).strip()
        
        return sections
    
    def _extract_commands(
        self, content: str, sections: Dict[str, str]
    ) -> List[ExtractedCommand]:
        """提取代码块中的命令"""
        commands = []
        
        code_block_pattern = re.compile(
            r"```(?:\w+)?\n(.*?)```",
            re.DOTALL | re.MULTILINE
        )
        
        for match in code_block_pattern.finditer(content):
            code_content = match.group(1)
            lines = code_content.strip().split("\n")
            
            for line in lines:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("//"):
                    continue
                
                for pattern in self.COMMAND_PATTERNS:
                    if pattern.match(line):
                        section = self._find_section_for_line(
                            content, match.start(), sections
                        )
                        
                        commands.append(ExtractedCommand(
                            command=line,
                            command_type="",
                            section=section,
                            raw_text=line,
                            line_number=self._get_line_number(content, match.start())
                        ))
                        break
        
        return commands
    
    def _extract_ports(self, content: str) -> List[ExtractedPort]:
        """提取端口信息"""
        ports = []
        seen_ports = set()
        
        for match in self.PORT_PATTERN.finditer(content):
            port_num = int(match.group(1))
            if 1 <= port_num <= 65535 and port_num not in seen_ports:
                seen_ports.add(port_num)
                context = self._get_context(content, match.start(), 100)
                
                ports.append(ExtractedPort(
                    port=port_num,
                    description=context,
                    raw_text=match.group(0)
                ))
        
        return ports
    
    def _extract_files(self, content: str) -> List[ExtractedFile]:
        """提取预期输出文件"""
        files = []
        seen_paths = set()
        
        for match in self.FILE_PATTERN.finditer(content):
            file_path = match.group(1)
            if file_path and file_path not in seen_paths:
                seen_paths.add(file_path)
                context = self._get_context(content, match.start(), 80)
                
                is_output = any(kw in context.lower() for kw in ["生成", "输出", "output", "generate", "result"])
                
                files.append(ExtractedFile(
                    file_path=file_path,
                    description=context,
                    is_output=is_output,
                    is_required=True,
                    raw_text=match.group(0)
                ))
        
        return files
    
    def _find_section_for_line(
        self, content: str, pos: int, sections: Dict[str, str]
    ) -> str:
        """找到指定位置所在的章节"""
        before_content = content[:pos]
        last_hash_pos = before_content.rfind("\n#")
        
        if last_hash_pos == -1:
            return "root"
        
        section_line = content[last_hash_pos + 1:].split("\n")[0]
        return section_line.lstrip("#").strip()
    
    def _get_line_number(self, content: str, pos: int) -> int:
        """获取指定位置的行号"""
        return content[:pos].count("\n") + 1
    
    def _get_context(self, content: str, pos: int, context_len: int = 60) -> str:
        """获取指定位置的上下文"""
        start = max(0, pos - context_len)
        end = min(len(content), pos + context_len)
        context = content[start:end]
        
        context = re.sub(r"\s+", " ", context).strip()
        return context
