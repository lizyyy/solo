#!/usr/bin/env python3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODULE_DIR = os.path.join(BASE_DIR, 'docker_cache_audit')
os.makedirs(MODULE_DIR, exist_ok=True)

def write_file(filename, content):
    path = os.path.join(MODULE_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {filename}")

# __init__.py
write_file('__init__.py', '__version__ = "0.1.0"\n')

# models.py
models_content = '''from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class CacheStatus(Enum):
    HIT = "hit"
    MISS = "miss"
    PARTIAL = "partial"
    UNKNOWN = "unknown"


class ChangeType(Enum):
    FILE_MODIFIED = "file_modified"
    FILE_ADDED = "file_added"
    FILE_DELETED = "file_deleted"
    ENV_CHANGED = "env_changed"
    COMMAND_CHANGED = "command_changed"
    UNKNOWN = "unknown"


@dataclass
class ParseError:
    line_number: int
    line_content: str
    error_type: str
    message: str
    source_file: str


@dataclass
class DockerfileInstruction:
    line_number: int
    instruction: str
    arguments: str
    raw_content: str
    layer_index: Optional[int] = None


@dataclass
class FileChange:
    filepath: str
    change_type: ChangeType
    size_before: Optional[int] = None
    size_after: Optional[int] = None


@dataclass
class LayerInfo:
    index: int
    digest: str
    instruction: str
    cache_status: CacheStatus
    build_time_ms: int
    size_bytes: int
    file_changes: List[FileChange] = field(default_factory=list)
    cause_of_miss: Optional[str] = None
    dockerfile_line: Optional[int] = None


@dataclass
class AnalysisResult:
    dockerfile_instructions: List[DockerfileInstruction]
    layers: List[LayerInfo]
    parse_errors: List[ParseError]
    total_build_time_ms: int
    cache_hit_count: int
    cache_miss_count: int
    recommendations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
'''
write_file('models.py', models_content)

# parser.py
parser_content = '''import re
import os
from typing import List
from .models import (
    DockerfileInstruction, LayerInfo, CacheStatus, FileChange,
    ChangeType, ParseError
)


class DockerfileParser:
    def __init__(self):
        self.instructions: List[DockerfileInstruction] = []
        self.errors: List[ParseError] = []
        self.valid_instructions = {
            'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE',
            'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER',
            'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK',
            'SHELL'
        }

    def parse(self, content: str, filename: str = "Dockerfile") -> List[DockerfileInstruction]:
        self.instructions = []
        self.errors = []
        lines = content.splitlines()
        line_buffer = []
        start_line = 0

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            if not stripped or stripped.startswith('#'):
                continue

            if line.endswith('\\\\'):
                if not line_buffer:
                    start_line = line_num
                line_buffer.append(line[:-1])
                continue

            if line_buffer:
                line_buffer.append(line)
                full_line = ' '.join(line_buffer)
                line_buffer = []
            else:
                full_line = line
                start_line = line_num

            self._parse_instruction(full_line, start_line, filename)

        return self.instructions

    def _parse_instruction(self, line: str, line_num: int, filename: str):
        parts = line.split(None, 1)
        if not parts:
            return

        instruction = parts[0].upper()
        args = parts[1] if len(parts) > 1 else ''

        if instruction not in self.valid_instructions:
            self.errors.append(ParseError(
                line_number=line_num,
                line_content=line,
                error_type="invalid_instruction",
                message=f"Unknown Dockerfile instruction: {instruction}",
                source_file=filename
            ))

        self.instructions.append(DockerfileInstruction(
            line_number=line_num,
            instruction=instruction,
            arguments=args,
            raw_content=line
        ))


class BuildLogParser:
    def __init__(self):
        self.layers: List[LayerInfo] = []
        self.errors: List[ParseError] = []

    def parse(self, content: str, filename: str = "build.log") -> List[LayerInfo]:
        self.layers = []
        self.errors = []
        lines = content.splitlines()

        for line_num, line in enumerate(lines, 1):
            self._parse_line(line, line_num, filename)

        return self.layers

    def _parse_line(self, line: str, line_num: int, filename: str):
        if 'Step' in line and ':' in line:
            match = re.match(r'^Step\\s+(\\d+)/\\d+\\s+:\\s+(.+)$', line)
            if match:
                step_num = int(match.group(1))
                instruction = match.group(2)
                layer = LayerInfo(
                    index=step_num,
                    digest="",
                    instruction=instruction,
                    cache_status=CacheStatus.UNKNOWN,
                    build_time_ms=0,
                    size_bytes=0
                )
                self.layers.append(layer)
            return

        if 'Using cache' in line:
            if self.layers:
                self.layers[-1].cache_status = CacheStatus.HIT
            return

        if '--->' in line and 'Running in' not in line and 'Using cache' not in line:
            match = re.search(r'--->\\s+([a-f0-9]{12})', line)
            if match and self.layers:
                self.layers[-1].digest = match.group(1)
                if self.layers[-1].cache_status == CacheStatus.UNKNOWN:
                    self.layers[-1].cache_status = CacheStatus.MISS
            return


class FileChangeParser:
    def parse_diff(self, content: str) -> List[FileChange]:
        changes = []
        lines = content.splitlines()
        
        for line in lines:
            if line.startswith('M '):
                changes.append(FileChange(
                    filepath=line[2:].strip(),
                    change_type=ChangeType.FILE_MODIFIED
                ))
            elif line.startswith('A '):
                changes.append(FileChange(
                    filepath=line[2:].strip(),
                    change_type=ChangeType.FILE_ADDED
                ))
            elif line.startswith('D '):
                changes.append(FileChange(
                    filepath=line[2:].strip(),
                    change_type=ChangeType.FILE_DELETED
                ))
        
        return changes
'''
write_file('parser.py', parser_content)

# analyzer.py
analyzer_content = '''import os
from typing import List, Optional
from collections import defaultdict
from .models import (
    DockerfileInstruction, LayerInfo, CacheStatus, FileChange,
    ChangeType, AnalysisResult, ParseError
)
from .parser import DockerfileParser, BuildLogParser, FileChangeParser


class CacheAnalyzer:
    def __init__(self):
        self.dockerfile_parser = DockerfileParser()
        self.log_parser = BuildLogParser()
        self.file_change_parser = FileChangeParser()

    def analyze(
        self,
        dockerfile_path: str,
        build_log_path: str,
        file_changes_path: Optional[str] = None
    ) -> AnalysisResult:
        errors: List[ParseError] = []
        
        dockerfile_content = self._read_file(dockerfile_path, errors, "Dockerfile")
        build_log_content = self._read_file(build_log_path, errors, "build_log")
        
        instructions = self.dockerfile_parser.parse(dockerfile_content, os.path.basename(dockerfile_path))
        errors.extend(self.dockerfile_parser.errors)
        
        layers = self.log_parser.parse(build_log_content, os.path.basename(build_log_path))
        errors.extend(self.log_parser.errors)
        
        file_changes = []
        if file_changes_path and os.path.exists(file_changes_path):
            file_change_content = self._read_file(file_changes_path, errors, "file_changes")
            file_changes = self.file_change_parser.parse_diff(file_change_content)
        
        self._associate_layers_with_instructions(instructions, layers)
        self._analyze_cache_miss_causes(layers, instructions, file_changes)
        
        hit_count = sum(1 for l in layers if l.cache_status == CacheStatus.HIT)
        miss_count = sum(1 for l in layers if l.cache_status == CacheStatus.MISS)
        
        total_time = sum(l.build_time_ms for l in layers)
        
        recommendations = self._generate_recommendations(layers, instructions, file_changes)
        
        return AnalysisResult(
            dockerfile_instructions=instructions,
            layers=layers,
            parse_errors=errors,
            total_build_time_ms=total_time,
            cache_hit_count=hit_count,
            cache_miss_count=miss_count,
            recommendations=recommendations,
            metadata={
                'dockerfile_path': dockerfile_path,
                'build_log_path': build_log_path,
                'file_changes_path': file_changes_path,
                'timestamp': 'latest'
            }
        )

    def _read_file(self, path: str, errors: List[ParseError], file_type: str) -> str:
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception as e:
            errors.append(ParseError(
                line_number=0,
                line_content="",
                error_type="file_read_error",
                message=f"Failed to read {file_type} file: {str(e)}",
                source_file=path
            ))
            return ""

    def _associate_layers_with_instructions(
        self,
        instructions: List[DockerfileInstruction],
        layers: List[LayerInfo]
    ):
        layerable_instructions = [
            i for i in instructions 
            if i.instruction in {'FROM', 'RUN', 'ADD', 'COPY', 'ENV', 'WORKDIR', 'USER', 'ARG'}
        ]
        
        for idx, layer in enumerate(layers):
            if idx < len(layerable_instructions):
                inst = layerable_instructions[idx]
                layer.dockerfile_line = inst.line_number
                inst.layer_index = layer.index

    def _analyze_cache_miss_causes(
        self,
        layers: List[LayerInfo],
        instructions: List[DockerfileInstruction],
        file_changes: List[FileChange]
    ):
        for i, layer in enumerate(layers):
            if layer.cache_status == CacheStatus.MISS:
                if i > 0 and layers[i-1].cache_status == CacheStatus.MISS:
                    layer.cause_of_miss = "上层缓存失效导致连锁反应"
                else:
                    layer.cause_of_miss = self._determine_miss_cause(layer, instructions, file_changes)

    def _determine_miss_cause(
        self,
        layer: LayerInfo,
        instructions: List[DockerfileInstruction],
        file_changes: List[FileChange]
    ) -> str:
        instruction_lower = layer.instruction.lower()
        
        if 'copy' in instruction_lower or 'add' in instruction_lower:
            relevant_changes = [
                fc for fc in file_changes
                if self._file_matches_instruction(fc.filepath, layer.instruction)
            ]
            if relevant_changes:
                change_descs = []
                for fc in relevant_changes[:3]:
                    change_descs.append(f"{fc.change_type.value}: {fc.filepath}")
                if len(relevant_changes) > 3:
                    change_descs.append(f"...以及 {len(relevant_changes) - 3} 个其他文件")
                return "源文件变更: " + "; ".join(change_descs)
            return "COPY/ADD 源文件变更或命令修改"
        
        if 'run' in instruction_lower:
            return "RUN 命令内容变更或依赖环境变化"
        
        if 'env' in instruction_lower:
            return "环境变量值变更"
        
        if 'from' in instruction_lower:
            return "基础镜像更新或标签变更"
        
        return "指令内容变更"

    def _file_matches_instruction(self, filepath: str, instruction: str) -> bool:
        parts = instruction.split()
        for part in parts[1:]:
            if part in filepath or part.replace('.', '') in filepath:
                return True
        return False

    def _generate_recommendations(
        self,
        layers: List[LayerInfo],
        instructions: List[DockerfileInstruction],
        file_changes: List[FileChange]
    ) -> List[str]:
        recommendations = []
        
        miss_layers = [l for l in layers if l.cache_status == CacheStatus.MISS]
        
        if len(miss_layers) > 3:
            first_miss = miss_layers[0]
            recommendations.append(
                f"建议优化: 第 {first_miss.index} 层({first_miss.instruction[:30]}...) 缓存失效导致后续 {len(miss_layers) - 1} 层全部重新构建"
            )
        
        copy_misses = [l for l in miss_layers if 'copy' in l.instruction.lower() or 'add' in l.instruction.lower()]
        if copy_misses:
            recommendations.append(
                "建议优化: COPY/ADD 命令建议将不常变更的文件放在前面复制，利用缓存"
            )
        
        run_misses = [l for l in miss_layers if 'run' in l.instruction.lower()]
        if len(run_misses) > 2:
            recommendations.append(
                "建议优化: 考虑合并相关的 RUN 命令以减少层数，或按变更频率排序 RUN 命令"
            )
        
        if file_changes:
            modified = [fc for fc in file_changes if fc.change_type == ChangeType.FILE_MODIFIED]
            if len(modified) > 5:
                recommendations.append(
                    f"检测到大量文件变更({len(modified)}个文件)，建议使用 .dockerignore 排除不必要文件"
                )
        
        return recommendations
'''
write_file('analyzer.py', analyzer_content)

# reporter.py
reporter_content = '''import os
import json
from datetime import datetime
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.tree import Tree
from jinja2 import Template
from .models import AnalysisResult, CacheStatus, ParseError


class Reporter:
    def __init__(self, result: AnalysisResult):
        self.result = result
        self.console = Console()

    def print_terminal_summary(self):
        self._print_header()
        self._print_overview()
        self._print_layer_table()
        self._print_errors()
        self._print_recommendations()

    def _print_header(self):
        title = Text("🐳 Dockerfile 层缓存审计报告", style="bold blue")
        subtitle = Text(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style="dim")
        self.console.print(Panel.fit("\\n".join([str(title), str(subtitle)]), border_style="blue"))

    def _print_overview(self):
        total = len(self.result.layers)
        hit_rate = (self.result.cache_hit_count / total * 100) if total > 0 else 0
        
        table = Table(title="概览统计", show_header=False, box=None)
        table.add_column("项", style="cyan")
        table.add_column("值", style="bold")
        
        table.add_row("总层数", str(total))
        table.add_row("缓存命中", f"[green]{self.result.cache_hit_count}[/green]")
        table.add_row("缓存失效", f"[red]{self.result.cache_miss_count}[/red]")
        table.add_row("缓存命中率", f"{hit_rate:.1f}%")
        table.add_row("总构建时间", f"{self.result.total_build_time_ms}ms")
        
        self.console.print(table)

    def _print_layer_table(self):
        table = Table(title="层详情", show_lines=True)
        table.add_column("#", style="dim", width=4)
        table.add_column("状态", width=8)
        table.add_column("指令", width=40)
        table.add_column("失效原因", style="yellow")
        
        for layer in self.result.layers:
            status = self._get_status_icon(layer.cache_status)
            instruction = layer.instruction[:37] + "..." if len(layer.instruction) > 40 else layer.instruction
            cause = layer.cause_of_miss or ""
            
            table.add_row(
                str(layer.index),
                status,
                instruction,
                cause
            )
        
        self.console.print(table)

    def _get_status_icon(self, status: CacheStatus) -> str:
        if status == CacheStatus.HIT:
            return "[green]✓ HIT[/green]"
        elif status == CacheStatus.MISS:
            return "[red]✗ MISS[/red]"
        elif status == CacheStatus.PARTIAL:
            return "[yellow]◐ PARTIAL[/yellow]"
        return "[dim]? UNKNOWN[/dim]"

    def _print_errors(self):
        if not self.result.parse_errors:
            return
        
        tree = Tree("⚠️  解析错误/异常样本", style="bold red")
        for error in self.result.parse_errors:
            error_node = tree.add(f"[red]{error.error_type}[/red] - [file://{error.source_file}]{error.source_file}[/]")
            error_node.add(f"行号: {error.line_number}")
            error_node.add(f"内容: {error.line_content[:100] if error.line_content else '(空)'}")
            error_node.add(f"原因: {error.message}")
        
        self.console.print(tree)

    def _print_recommendations(self):
        if not self.result.recommendations:
            return
        
        self.console.print("\\n[bold magenta]💡 优化建议[/bold magenta]")
        for i, rec in enumerate(self.result.recommendations, 1):
            self.console.print(f"  {i}. {rec}")

    def export_json(self, output_path: str) -> str:
        data = {
            'version': '1.0',
            'generated_at': datetime.now().isoformat(),
            'metadata': self.result.metadata,
            'summary': {
                'total_layers': len(self.result.layers),
                'cache_hits': self.result.cache_hit_count,
                'cache_misses': self.result.cache_miss_count,
                'cache_hit_rate': (self.result.cache_hit_count / len(self.result.layers) * 100) if self.result.layers else 0,
                'total_build_time_ms': self.result.total_build_time_ms
            },
            'layers': [
                {
                    'index': l.index,
                    'digest': l.digest,
                    'instruction': l.instruction,
                    'cache_status': l.cache_status.value,
                    'build_time_ms': l.build_time_ms,
                    'size_bytes': l.size_bytes,
                    'cause_of_miss': l.cause_of_miss,
                    'dockerfile_line': l.dockerfile_line,
                    'file_changes': [
                        {'filepath': fc.filepath, 'change_type': fc.change_type.value}
                        for fc in l.file_changes
                    ]
                }
                for l in self.result.layers
            ],
            'parse_errors': [
                {
                    'line_number': e.line_number,
                    'line_content': e.line_content,
                    'error_type': e.error_type,
                    'message': e.message,
                    'source_file': e.source_file
                }
                for e in self.result.parse_errors
            ],
            'recommendations': self.result.recommendations
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return output_path

    def export_markdown(self, output_path: str) -> str:
        template_str = """# Dockerfile 层缓存审计报告

**生成时间**: {{ generated_at }}  
**项目**: {{ metadata.dockerfile_path|default('N/A') }}

## 概览

| 指标 | 数值 |
|------|------|
| 总层数 | {{ total_layers }} |
| 缓存命中 | {{ cache_hits }} |
| 缓存失效 | {{ cache_misses }} |
| 缓存命中率 | {{ "%.1f%%"|format(hit_rate) }} |
| 总构建时间 | {{ total_build_time_ms }}ms |

## 层分析详情

| 层 # | 缓存状态 | 指令 | 失效原因 |
|------|----------|------|----------|
{% for layer in layers %}
| {{ layer.index }} | {{ layer.cache_status|upper }} | `{{ layer.instruction }}` | {{ layer.cause_of_miss|default('-') }} |
{% endfor %}

{% if recommendations %}
## 优化建议

{% for rec in recommendations %}
{{ loop.index }}. {{ rec }}
{% endfor %}
{% endif %}

{% if parse_errors %}
## 异常记录

| 源文件 | 行号 | 错误类型 | 原始内容 | 原因 |
|--------|------|----------|----------|------|
{% for error in parse_errors %}
| `{{ error.source_file }}` | {{ error.line_number }} | {{ error.error_type }} | `{{ error.line_content|truncate(100) }}` | {{ error.message }} |
{% endfor %}
{% endif %}

---
*报告由 docker-cache-audit 工具自动生成*
"""
        
        template = Template(template_str)
        total = len(self.result.layers)
        hit_rate = (self.result.cache_hit_count / total * 100) if total > 0 else 0
        
        content = template.render(
            generated_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            metadata=self.result.metadata,
            total_layers=len(self.result.layers),
            cache_hits=self.result.cache_hit_count,
            cache_misses=self.result.cache_miss_count,
            hit_rate=hit_rate,
            total_build_time_ms=self.result.total_build_time_ms,
            layers=self.result.layers,
            recommendations=self.result.recommendations,
            parse_errors=self.result.parse_errors
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
'''
write_file('reporter.py', reporter_content)

# cli.py
cli_content = '''import os
import sys
import traceback
from typing import Optional
import click
from rich.console import Console
from .analyzer import CacheAnalyzer
from .reporter import Reporter

console = Console()


class AuditError(Exception):
    pass


class FileNotFoundAuditError(AuditError):
    pass


class InvalidInputError(AuditError):
    pass


def handle_errors(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except AuditError as e:
            console.print(f"[bold red]❌ 错误:[/bold red] {e}")
            sys.exit(1)
        except Exception as e:
            console.print(f"[bold red]❌ 发生意外错误:[/bold red] {e}")
            console.print("\\n[dim]错误详情已记录，请检查输入数据格式是否正确。")
            console.print("如有疑问，请附上输入文件和以下信息提交反馈:[/dim]")
            console.print(f"\\n{traceback.format_exc()}", style="dim")
            sys.exit(1)
    return wrapper


def validate_inputs(dockerfile: str, build_log: str, file_changes: Optional[str] = None):
    if not os.path.exists(dockerfile):
        raise FileNotFoundAuditError(f"Dockerfile 不存在: {dockerfile}")
    if not os.path.exists(build_log):
        raise FileNotFoundAuditError(f"构建日志不存在: {build_log}")
    if file_changes and not os.path.exists(file_changes):
        raise FileNotFoundAuditError(f"文件变更记录不存在: {file_changes}")
    
    if os.path.getsize(dockerfile) == 0:
        raise InvalidInputError(f"Dockerfile 是空文件: {dockerfile}")
    if os.path.getsize(build_log) == 0:
        raise InvalidInputError(f"构建日志是空文件: {build_log}")


@click.group()
@click.version_option(version="0.1.0", prog_name="docker-cache-audit")
def main():
    """Dockerfile 层缓存审计 CLI 工具
    
    分析缓存失效原因，生成审计报告，帮助优化镜像构建速度。
    """
    pass


@main.command()
@click.argument('dockerfile', type=click.Path(exists=False))
@click.argument('build_log', type=click.Path(exists=False))
@click.option('--file-changes', '-f', type=click.Path(exists=False), help='文件变更记录文件路径')
@click.option('--output-dir', '-o', type=click.Path(), default='./audit-reports', help='报告输出目录')
@click.option('--json/--no-json', default=True, help='是否输出 JSON 机器可读结果')
@click.option('--markdown/--no-markdown', default=True, help='是否输出 Markdown 报告')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不输出终端摘要')
@handle_errors
def audit(
    dockerfile: str,
    build_log: str,
    file_changes: Optional[str],
    output_dir: str,
    json: bool,
    markdown: bool,
    quiet: bool
):
    """执行 Dockerfile 层缓存审计
    
    DOCKERFILE: Dockerfile 文件路径
    BUILD_LOG: Docker 构建日志文件路径
    """
    validate_inputs(dockerfile, build_log, file_changes)
    
    console.print("[blue]🔍 开始分析 Dockerfile 层缓存...[/blue]")
    
    analyzer = CacheAnalyzer()
    result = analyzer.analyze(dockerfile, build_log, file_changes)
    
    reporter = Reporter(result)
    
    if not quiet:
        reporter.print_terminal_summary()
    
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = result.metadata.get('timestamp', 'latest')
    
    outputs = []
    
    if json:
        json_path = os.path.join(output_dir, f'cache-audit-{timestamp}.json')
        reporter.export_json(json_path)
        outputs.append(f"JSON: {json_path}")
    
    if markdown:
        md_path = os.path.join(output_dir, f'cache-audit-{timestamp}.md')
        reporter.export_markdown(md_path)
        outputs.append(f"Markdown: {md_path}")
    
    if outputs:
        console.print(f"\\n[green]✅ 报告已生成:[/green]")
        for output in outputs:
            console.print(f"  📄 {output}")
    
    if result.parse_errors:
        console.print(f"\\n[yellow]⚠️  检测到 {len(result.parse_errors)} 个解析异常，已保留在报告中[/yellow]")


@main.command()
@click.option('--dir', '-d', type=click.Path(), default='./examples', help='示例文件输出目录')
def examples(dir: str):
    """生成示例输入文件，用于演示工具用法
    """
    os.makedirs(dir, exist_ok=True)
    
    dockerfile_content = """FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python setup.py install
CMD ["python", "app.py"]
"""
    
    build_log_content = """Step 1/7 : FROM python:3.9-slim
 ---> 1234567890ab
Step 2/7 : WORKDIR /app
 ---> Using cache
 ---> 0987654321ba
Step 3/7 : COPY requirements.txt .
 ---> abcdef123456
Step 4/7 : RUN pip install --no-cache-dir -r requirements.txt
 ---> Running in abc123def456
 ---> fedcba654321
Removing intermediate container abc123def456
Step 5/7 : COPY . .
 ---> 112233445566
Step 6/7 : RUN python setup.py install
 ---> Running in 77889900aabb
 ---> ccddeeff1122
Removing intermediate container 77889900aabb
Step 7/7 : CMD ["python", "app.py"]
 ---> Using cache
 ---> 334455667788
Successfully built 334455667788
"""
    
    file_changes_content = """M requirements.txt
A setup.py
M src/main.py
D old_module.py
"""
    
    files = {
        'Dockerfile.example': dockerfile_content,
        'build.log.example': build_log_content,
        'file-changes.diff.example': file_changes_content
    }
    
    for filename, content in files.items():
        path = os.path.join(dir, filename)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        console.print(f"✅ 已创建示例文件: {path}")
    
    console.print(f"\\n[green]💡 运行示例:[/green]")
    console.print(f"  python3 -m docker_cache_audit.cli audit {dir}/Dockerfile.example {dir}/build.log.example")


if __name__ == '__main__':
    main()
'''
write_file('cli.py', cli_content)

# requirements.txt
with open(os.path.join(BASE_DIR, 'requirements.txt'), 'w') as f:
    f.write('click>=8.0.0\n')
    f.write('rich>=12.0.0\n')
    f.write('pyyaml>=6.0\n')
    f.write('jinja2>=3.0.0\n')
print("Created: requirements.txt")

# README.md
readme_content = """# Dockerfile 层缓存审计 CLI

镜像构建越来越慢？大家只知道 cache miss 多，却不知道是哪几层被无效修改打破。这个工具帮你自动排查缓存失效原因，不用再靠手工复制！

## ✨ 功能特性

- **🔍 智能解析**: 自动解析 Dockerfile 和构建日志
- **📍 层归因**: 精确定位哪一层破坏了缓存，原因是什么
- **📁 变更关联**: 关联文件变更与缓存失效的关系
- **💡 优化建议**: 基于分析结果给出具体的缓存优化建议
- **📊 多种输出**: 终端摘要、机器可读 JSON、适合发给同事的 Markdown 报告
- **⚠️ 异常保留**: 坏行或异常样本保留原始位置和原因，不抛原始 traceback

## 🚀 安装依赖

```bash
pip install -r requirements.txt
```

## 📖 快速开始

### 1. 生成示例文件（推荐先试）

```bash
python3 -m docker_cache_audit.cli examples
```

这会在 `./examples` 目录下生成示例输入文件，方便你快速体验。

### 2. 执行审计

```bash
# 基础用法
python3 -m docker_cache_audit.cli audit path/to/Dockerfile path/to/build.log

# 带文件变更记录
python3 -m docker_cache_audit.cli audit Dockerfile build.log --file-changes changes.diff

# 指定输出目录
python3 -m docker_cache_audit.cli audit Dockerfile build.log -o ./my-reports

# 只生成机器可读结果
python3 -m docker_cache_audit.cli audit Dockerfile build.log --no-markdown
```

## 📁 输入目录结构

### 标准输入文件

```
your-project/
├── Dockerfile           # 必需 - 待分析的 Dockerfile
├── build.log            # 必需 - `docker build` 的完整输出日志
└── file-changes.diff    # 可选 - 文件变更记录（git diff 格式）
```

### 文件格式说明

#### Dockerfile
标准 Dockerfile 格式，支持多行指令、注释等。

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

#### 构建日志
`docker build` 命令的完整标准输出，包含 Step 信息和缓存状态。

```
Step 1/5 : FROM python:3.9-slim
 ---> Using cache
 ---> abcdef123456
Step 2/5 : WORKDIR /app
 ---> 123456abcdef
...
```

#### 文件变更记录（可选）
git diff 格式或简单的变更列表。

```
M requirements.txt
A setup.py
D old_file.py
```

## 📄 报告位置

默认输出到 `./audit-reports` 目录，每次运行生成两个文件：

```
audit-reports/
├── cache-audit-latest.json    # 机器可读结果 (API友好)
└── cache-audit-latest.md      # 友好报告，可直接发给同事
```

## 🛠️ 完整命令参考

```bash
# 查看帮助
python3 -m docker_cache_audit.cli --help
python3 -m docker_cache_audit.cli audit --help
```

## ❓ 常见问题

### Q: 遇到坏数据怎么办？
A: 工具不会直接抛出 traceback，而是：
- 在终端友好提示错误
- 将异常样本保留在报告的「异常记录」中
- 包含原始行号和出错内容，方便你定位问题

### Q: 日志不完整可以分析吗？
A: 可以！工具会尽可能解析可用的数据，无法解析的行会作为异常记录下来，不会中断分析流程。

## 📝 项目结构

```
docker_cache_audit/
├── __init__.py          # 版本信息
├── models.py            # 数据模型定义
├── parser.py            # Dockerfile 和构建日志解析器
├── analyzer.py          # 缓存分析核心逻辑
├── reporter.py          # 报告生成器
└── cli.py               # CLI 入口
```
"""
with open(os.path.join(BASE_DIR, 'README.md'), 'w', encoding='utf-8') as f:
    f.write(readme_content)
print("Created: README.md")

print("\n✅ All files created successfully!")
