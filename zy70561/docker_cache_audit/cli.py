import os
import sys
import traceback
import functools
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
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except AuditError as e:
            console.print(f"[bold red]❌ 错误:[/bold red] {e}")
            sys.exit(1)
        except Exception as e:
            console.print(f"[bold red]❌ 发生意外错误:[/bold red] {e}")
            console.print("\n[dim]错误详情已记录，请检查输入数据格式是否正确。")
            console.print("如有疑问，请附上输入文件和以下信息提交反馈:[/dim]")
            console.print(f"\n{traceback.format_exc()}", style="dim")
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
        reporter.print_summary()
    
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
        console.print(f"\n[green]✅ 报告已生成:[/green]")
        for output in outputs:
            console.print(f"  📄 {output}")
    
    if result.parse_errors:
        console.print(f"\n[yellow]⚠️  检测到 {len(result.parse_errors)} 个解析异常，已保留在报告中[/yellow]")


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
    
    console.print(f"\n[green]💡 运行示例:[/green]")
    console.print(f"  docker-cache-audit audit {dir}/Dockerfile.example {dir}/build.log.example")


if __name__ == '__main__':
    main()
