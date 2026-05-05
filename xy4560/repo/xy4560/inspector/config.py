"""配置文件"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import os


@dataclass
class SecurityConfig:
    """安全配置"""
    
    allowed_commands: List[str] = field(default_factory=lambda: [
        "npm",
        "pnpm",
        "yarn",
        "python",
        "python3",
        "curl",
        "wget",
        "echo",
        "ls",
        "cat",
        "node",
    ])
    
    allowed_subcommands: Dict[str, List[str]] = field(default_factory=lambda: {
        "npm": ["install", "run", "test", "start", "build", "check", "lint"],
        "pnpm": ["install", "run", "test", "start", "build", "check", "lint"],
        "yarn": ["install", "run", "test", "start", "build", "check", "lint"],
        "python": ["-m", "-c"],
        "python3": ["-m", "-c"],
        "curl": ["-s", "-S", "-I", "-L", "-o", "-O", "-X", "-H", "-d"],
        "wget": ["-q", "-O", "-P"],
        "node": ["-e"],
    })
    
    blocked_patterns: List[str] = field(default_factory=lambda: [
        "rm -rf",
        "sudo",
        "&& rm",
        "> /dev/",
        "eval(",
        "exec(",
        "bash -c",
        "sh -c",
    ])
    
    max_execution_time: int = 60


@dataclass
class InspectorConfig:
    """巡检器配置"""
    
    project_dir: str = ""
    output_dir: str = ""
    db_path: str = ""
    
    security: SecurityConfig = field(default_factory=SecurityConfig)
    
    check_port_list: List[int] = field(default_factory=lambda: [
        80, 443, 8080, 3000, 3001, 5000, 5173, 4200, 8000, 9000
    ])
    
    expected_files: List[str] = field(default_factory=lambda: [
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "README.md",
    ])
    
    def __post_init__(self):
        if not self.output_dir:
            self.output_dir = os.path.join(self.project_dir, ".inspector") if self.project_dir else ".inspector"
        
        if not self.db_path:
            self.db_path = os.path.join(self.output_dir, "inspector.db")
        
        os.makedirs(self.output_dir, exist_ok=True)
