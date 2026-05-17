#!/usr/bin/env python3
# 生成 Docker 缓存审计工具的所有文件

# 1. parser.py
parser_code = '''import re
from typing import List
from .models import (
    DockerfileInstruction,
    LayerInfo,
    CacheStatus,
    FileChange,
    ChangeType,
    ParseError
)


class DockerfileParser:
    def __init__(self):
        self.errors: List[ParseError] = []
    
    def parse(self, content: str, source_file: str = "") -> List[DockerfileInstruction]:
        instructions = []
        lines = content.splitlines()
        
        DOCKERFILE_INSTRUCTIONS = {
            'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE',
            'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER',
            'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK',
            'SHELL'
        }
        
        accumulated_lines = []
        
        for line_num, line in enumerate(lines, start=1):
            stripped_line = line.strip()
            
            if not stripped_line or stripped_line.startswith('#'):
                continue
            
            accumulated_lines.append(line)
            
            if stripped_line.endswith('\\\\'):
                continue
            
            full_line = ' '.join(l.strip().rstrip('\\\\') for l in accumulated_lines)
            accumulated_lines = []
            
            try:
                parts = full_line.split(None, 1)
                if not parts:
                    continue
                
                instruction = parts[0].upper()
                
                if instruction not in DOCKERFILE_INSTRUCTIONS:
                    self.errors.append(ParseError(
                        line_number=line_num,
                        line_content=line,
                        error_type="unknown_instruction",
                        message=f"未知的 Dockerfile 指令: {instruction}",
                        source_file=source_file
                    ))
                
                arguments = parts[1] if len(parts) > 1 else ""
                
                instructions.append(DockerfileInstruction(
                    line_number=line_num,
                    instruction=instruction,
                    arguments=arguments,
                    raw_content=full_line
                ))
            except Exception as e:
                self.errors.append(ParseError(
                    line_number=line_num,
                    line_content=line,
                    error_type="parse_error",
                    message=f"解析失败: {str(e)}",
                    source_file=source_file
                ))
        
        return instructions


class BuildLogParser:
    def __init__(self):
        self.errors: List[ParseError] = []
    
    def parse(self, content: str, source_file: str = "") -> List[LayerInfo]:
        layers = []
        lines = content.splitlines()
        
        step_pattern = re.compile(r'^Step\\s+(\\d+)/(\\d+)\\s*:\\s*([A-Z]+)\\s*(.*)$', re.IGNORECASE)
        hash_pattern = re.compile(r'^\\s*--->\\s*([a-f0-9]{12})\\s*$')
        cache_pattern = re.compile(r'^\\s*--->\\s*Using\\s+cache\\s*$', re.IGNORECASE)
        
        current_layer = None
        current_layer_lines = []
        
        for line_num, line in enumerate(lines, start=1):
            try:
                current_layer_lines.append(line)
                
                step_match = step_pattern.match(line)
                if step_match:
                    if current_layer is not None:
                        current_layer.raw_log_lines = current_layer_lines[:-1]
                        layers.append(current_layer)
                    
                    layer_index = int(step_match.group(1))
                    instruction = f"{step_match.group(3)} {step_match.group(4)}".strip()
                    
                    current_layer = LayerInfo(
                        index=layer_index,
                        instruction=instruction,
                        cache_status=CacheStatus.UNKNOWN
                    )
                    current_layer_lines = [line]
                    continue
                
                if current_layer is None:
                    continue
                
                if cache_pattern.match(line):
                    current_layer.cache_status = CacheStatus.HIT
                    continue
                
                hash_match = hash_pattern.match(line)
                if hash_match:
                    current_layer.layer_hash = hash_match.group(1)
                    if current_layer.cache_status == CacheStatus.UNKNOWN:
                        current_layer.cache_status = CacheStatus.MISS
                    continue
            
            except Exception as e:
                self.errors.append(ParseError(
                    line_number=line_num,
                    line_content=line,
                    error_type="log_parse_error",
                    message=f"构建日志解析失败: {str(e)}",
                    source_file=source_file
                ))
        
        if current_layer is not None:
            current_layer.raw_log_lines = current_layer_lines
            layers.append(current_layer)
        
        return layers


class FileChangeParser:
    def __init__(self):
        self.errors: List[ParseError] = []
    
    def parse_diff(self, content: str, source_file: str = "") -> List[FileChange]:
        changes = []
        lines = content.splitlines()
        
        simple_pattern = re.compile(r'^([MADR])\\s+(.+)$')
        
        for line_num, line in enumerate(lines, start=1):
            stripped_line = line.strip()
            if not stripped_line:
                continue
            
            try:
                match = simple_pattern.match(stripped_line)
                if match:
                    change_code = match.group(1).upper()
                    filepath = match.group(2)
                    
                    change_type_map = {
                        'A': ChangeType.FILE_ADDED,
                        'M': ChangeType.FILE_MODIFIED,
                        'D': ChangeType.FILE_DELETED,
                        'R': ChangeType.FILE_RENAMED
                    }
                    
                    change_type = change_type_map.get(change_code, ChangeType.UNKNOWN)
                    
                    changes.append(FileChange(
                        filepath=filepath,
                        change_type=change_type
                    ))
                    continue
                
                if stripped_line.startswith('--- a/'):
                    filepath = stripped_line[6:]
                    changes.append(FileChange(
                        filepath=filepath,
                        change_type=ChangeType.FILE_MODIFIED
                    ))
                    continue
            
            except Exception as e:
                self.errors.append(ParseError(
                    line_number=line_num,
                    line_content=line,
                    error_type="diff_parse_error",
                    message=f"变更记录解析失败: {str(e)}",
                    source_file=source_file
                ))
        
        return changes
'''

with open('docker_cache_audit/parser.py', 'w') as f:
    f.write(parser_code)
print("Created parser.py")

# 2. cli.py
cli_code = '''#!/usr/bin/env python3
import os
import json
import click
from datetime import datetime
from .analyzer import CacheAnalyzer
from .reporter import Reporter


@click.group()
def cli():
    """Dockerfile 层缓存审计 CLI 工具"""
    pass


@cli.command()
@click.argument('dockerfile_path', type=click.Path(exists=True))
@click.argument('build_log_path', type=click.Path(exists=True))
@click.option('--file-changes', '-f', type=click.Path(exists=True), help='文件变更记录路径')
@click.option('--output-dir', '-o', default='./audit-reports', help='报告输出目录')
@click.option('--no-markdown', is_flag=True, help='不生成 Markdown 报告')
@click.option('--no-json', is_flag=True, help='不生成 JSON 报告')
def audit(dockerfile_path, build_log_path, file_changes, output_dir, no_markdown, no_json):
    """执行缓存审计分析"""
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        click.echo("🔍 正在分析 Dockerfile 和构建日志...")
        
        analyzer = CacheAnalyzer()
        result = analyzer.analyze(
            dockerfile_path=dockerfile_path,
            build_log_path=build_log_path,
            file_changes_path=file_changes
        )
        
        reporter = Reporter()
        
        click.echo("\\n" + "="*60)
        click.echo("📊 缓存审计摘要")
        click.echo("="*60)
        reporter.print_summary(result)
        
        if not no_json:
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            json_path = os.path.join(output_dir, f"cache-audit-{timestamp}.json")
            reporter.export_json(result, json_path)
            click.echo(f"\\n📄 JSON 报告已保存: {json_path}")
        
        if not no_markdown:
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            md_path = os.path.join(output_dir, f"cache-audit-{timestamp}.md")
            reporter.export_markdown(result, md_path)
            click.echo(f"📝 Markdown 报告已保存: {md_path}")
        
        if result.parse_errors:
            click.echo(f"\\n⚠️  发现 {len(result.parse_errors)} 个解析警告，请查看报告中的详细信息")
    
    except Exception as e:
        click.echo(f"\\n❌ 执行失败: {str(e)}", err=True)
        click.echo("   请检查输入文件格式是否正确", err=True)
        exit(1)


@cli.command()
def examples():
    """生成示例文件用于测试"""
    examples_dir = './examples'
    os.makedirs(examples_dir, exist_ok=True)
    
    dockerfile_content = '''FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python setup.py install
CMD ["python", "app.py"]
'''
    
    build_log_content = '''Step 1/7 : FROM python:3.9-slim
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
'''
    
    file_changes_content = '''M requirements.txt
A setup.py
M src/main.py
'''
    
    with open(os.path.join(examples_dir, 'Dockerfile'), 'w') as f:
        f.write(dockerfile_content)
    
    with open(os.path.join(examples_dir, 'build.log'), 'w') as f:
        f.write(build_log_content)
    
    with open(os.path.join(examples_dir, 'file-changes.txt'), 'w') as f:
        f.write(file_changes_content)
    
    click.echo(f"✅ 示例文件已生成到 {examples_dir}/ 目录")
    click.echo("   测试命令: docker-cache-audit audit examples/Dockerfile examples/build.log")


if __name__ == '__main__':
    cli()
'''

with open('docker_cache_audit/cli.py', 'w') as f:
    f.write(cli_code)
print("Created cli.py")

# 3. reporter.py
reporter_code = '''import json
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from .models import AnalysisResult, CacheStatus


class Reporter:
    def __init__(self):
        self.console = Console()
    
    def print_summary(self, result: AnalysisResult):
        """打印终端摘要"""
        total_layers = len(result.layers)
        hit_rate = result.cache_hit_rate
        
        self.console.print(f"\\n总层数: [bold]{total_layers}[/bold]")
        self.console.print(f"缓存命中: [green]{result.cache_hit_count}[/green] 层")
        self.console.print(f"缓存失效: [red]{result.cache_miss_count}[/red] 层")
        self.console.print(f"缓存命中率: [bold]{hit_rate:.1f}%[/bold]")
        
        table = Table(title="\\n层缓存详情")
        table.add_column("层级", style="cyan", width=6)
        table.add_column("指令", style="magenta", width=30)
        table.add_column("状态", width=10)
        table.add_column("失效原因", style="yellow")
        
        for layer in result.layers:
            status_style = "green" if layer.cache_status == CacheStatus.HIT else "red"
            status_text = "✓ 命中" if layer.cache_status == CacheStatus.HIT else "✗ 失效"
            cause = layer.cause_of_miss if layer.cache_status == CacheStatus.MISS else ""
            
            inst_short = layer.instruction[:27] + "..." if len(layer.instruction) > 30 else layer.instruction
            
            table.add_row(
                str(layer.index),
                inst_short,
                f"[{status_style}]{status_text}[/{status_style}]",
                cause
            )
        
        self.console.print(table)
        
        if result.recommendations:
            self.console.print(Panel("\\n".join(f"💡 {r}" for r in result.recommendations), title="优化建议"))
        
        if result.parse_errors:
            self.console.print(f"\\n⚠️  解析警告: {len(result.parse_errors)} 个")
            for err in result.parse_errors[:3]:
                self.console.print(f"   [{err.source_file}:{err.line_number}] {err.message}")
    
    def export_json(self, result: AnalysisResult, output_path: str):
        """导出 JSON 格式报告"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)
    
    def export_markdown(self, result: AnalysisResult, output_path: str):
        """导出 Markdown 格式报告"""
        hit_rate = result.cache_hit_rate
        
        md_content = f'''# Dockerfile 层缓存审计报告

## 📊 概览统计

| 指标 | 数值 |
|------|------|
| 总层数 | {len(result.layers)} |
| 缓存命中 | {result.cache_hit_count} 层 |
| 缓存失效 | {result.cache_miss_count} 层 |
| 缓存命中率 | {hit_rate:.1f}% |

## 📋 每层缓存详情

| 层级 | Dockerfile行号 | 指令 | 缓存状态 | 失效原因 |
|------|---------------|------|---------|---------|
'''
        
        for layer in result.layers:
            status = "✅ 命中" if layer.cache_status == CacheStatus.HIT else "❌ 失效"
            line_num = layer.dockerfile_line or "-"
            cause = layer.cause_of_miss or "-"
            inst_md = layer.instruction.replace('|', '\\\\|')
            
            md_content += f"| {layer.index} | {line_num} | `{inst_md[:40]}` | {status} | {cause} |\\n"
        
        if result.recommendations:
            md_content += '''
## 💡 优化建议

'''
            for i, rec in enumerate(result.recommendations, 1):
                md_content += f"{i}. {rec}\\n"
        
        if result.parse_errors:
            md_content += f'''
## ⚠️  解析警告 (共 {len(result.parse_errors)} 个)

| 源文件 | 行号 | 错误类型 | 消息 | 原始内容 |
|--------|------|---------|------|---------|
'''
            for err in result.parse_errors:
                content_md = err.line_content.replace('|', '\\\\|')
                md_content += f"| {err.source_file} | {err.line_number} | {err.error_type} | {err.message} | `{content_md[:50]}` |\\n"
        
        md_content += f'''
---
*报告生成时间: {result.metadata.get('timestamp', 'N/A')}*
*分析的 Dockerfile: {result.metadata.get('dockerfile_path', 'N/A')}*
*构建日志: {result.metadata.get('build_log_path', 'N/A')}*
'''
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
'''

with open('docker_cache_audit/reporter.py', 'w') as f:
    f.write(reporter_code)
print("Created reporter.py")

print("\\n✅ All files created successfully!")
