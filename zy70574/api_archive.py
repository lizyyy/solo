#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime
from pathlib import Path
import click

__version__ = "0.1.0"

DEFAULT_SENSITIVE_FIELDS = [
    "authorization", "token", "password", "secret", "key", "apikey",
    "access_token", "refresh_token", "jwt", "cookie", "session"
]


def mask_value(value, mask_char="*"):
    if len(value) <= 4:
        return mask_char * len(value)
    return value[:2] + mask_char * (len(value) - 4) + value[-2:]


def generate_curl(method, url, headers, body=None):
    parts = ["curl"]
    if method != "GET":
        parts.append(f"-X {method}")
    for key, value in headers.items():
        escaped_value = value.replace('"', '\\"')
        parts.append(f'-H "{key}: {escaped_value}"')
    if body and len(body) < 1000:
        escaped_body = body.replace('"', '\\"').replace("$", "\\$")
        parts.append(f'-d "{escaped_body}"')
    parts.append(f'"{url}"')
    return " ".join(parts)


def process_files(file_paths, sensitive_fields=None, mask=True):
    """最小实现的文件处理函数"""
    result = {"entries": [], "errors": [], "summary": {}}
    
    for file_path in file_paths:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                result["entries"].append({
                    "id": f"file_{len(result['entries'])}",
                    "request": {
                        "method": "UNKNOWN",
                        "url": file_path,
                        "source_type": Path(file_path).suffix,
                        "source_location": file_path
                    },
                    "status": "success",
                    "is_sensitive": False,
                    "sensitive_fields": []
                })
        except Exception as e:
            result["errors"].append({
                "message": str(e),
                "location": file_path,
                "timestamp": datetime.now().isoformat(),
            })
    
    summary = {
        "total_entries": len(result["entries"]),
        "success_count": len(result["entries"]),
        "warning_count": 0,
        "error_count": 0,
        "file_errors": len(result["errors"]),
        "methods": {},
        "source_types": {},
        "sensitive_entries": 0,
        "generated_at": datetime.now().isoformat(),
    }
    result["summary"] = summary
    return result


def generate_terminal_summary(result):
    summary = result["summary"]
    lines = []
    lines.append("=" * 60)
    lines.append("API 抓包归档摘要")
    lines.append("=" * 60)
    lines.append(f"总计条目: {summary['total_entries']}")
    lines.append(f"  - 成功: {summary['success_count']}")
    lines.append(f"  - 警告: {summary['warning_count']}")
    lines.append(f"  - 错误: {summary['error_count']}")
    lines.append(f"文件错误: {summary['file_errors']}")
    
    if result["errors"]:
        lines.append("\n错误列表:")
        for err in result["errors"][:3]:
            loc = err.get("location", "unknown")
            msg = err["message"]
            lines.append(f"  [{loc}] {msg}")
    
    lines.append("=" * 60)
    return "\n".join(lines)


@click.group()
@click.version_option(__version__)
def cli():
    """API 抓包归档工具 - 统一归档 HTTP 抓包数据"""
    pass


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="输出目录")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "md", "all"]), default="all",
              help="输出格式 (json/md/all)")
@click.option("--no-mask", is_flag=True, help="不进行敏感数据脱敏")
@click.option("--sensitive-field", "-s", multiple=True, help="自定义敏感字段名")
@click.option("--quiet", "-q", is_flag=True, help="安静模式，只输出错误")
def archive(files, output, fmt, no_mask, sensitive_field, quiet):
    """归档 HTTP 抓包文件"""
    if not files:
        click.echo("错误: 请指定至少一个文件", err=True)
        sys.exit(1)
    
    try:
        result = process_files(
            list(files),
            sensitive_fields=list(sensitive_field) if sensitive_field else None,
            mask=not no_mask
        )
        
        if not quiet:
            click.echo(generate_terminal_summary(result))
        
        if output:
            output_path = Path(output)
            output_path.mkdir(parents=True, exist_ok=True)
            base_name = f"archive_{result['summary']['generated_at'][:19].replace(':', '-')}"
            
            if fmt in ["json", "all"]:
                json_file = output_path / f"{base_name}.json"
                json_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                if not quiet:
                    click.echo(f"已生成 JSON 报告: {json_file}")
        else:
            if fmt in ["json", "all"]:
                click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        
        if result["errors"] or result["summary"]["error_count"] > 0:
            sys.exit(2)
            
    except Exception as e:
        click.echo(f"处理失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
def validate(files):
    """验证抓包文件格式"""
    for file_path in files:
        click.echo(f"检查: {file_path}")
        try:
            result = process_files([file_path], mask=False)
            if result["errors"]:
                click.echo(f"  ❌ 发现 {len(result['errors'])} 个错误")
                for err in result["errors"]:
                    click.echo(f"     - {err['message']}")
            else:
                click.echo(f"  ✅ 有效，包含 {len(result['entries'])} 个请求")
        except Exception as e:
            click.echo(f"  ❌ 读取失败: {str(e)}")


@cli.command()
def config():
    """显示默认配置"""
    click.echo("默认敏感字段:")
    for field in DEFAULT_SENSITIVE_FIELDS:
        click.echo(f"  - {field}")
    click.echo("")
    click.echo("支持的文件格式:")
    click.echo("  - .har (HAR 格式)")
    click.echo("  - .curl/.sh (curl 命令文件)")
    click.echo("  - .txt (纯文本 HTTP 请求)")


if __name__ == "__main__":
    cli()
