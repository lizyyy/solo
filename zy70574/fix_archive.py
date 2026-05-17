#!/usr/bin/env python3
import sys

# 读取现有文件
with open("api_archive.py", "r", encoding="utf-8") as f:
    content = f.read()

# 如果文件只有58行，追加剩余内容
if len(content.split("\n")) < 100:
    additional_code = '''

def read_har_file(file_path, result):
    with open(file_path, "r", encoding="utf-8") as f:
        har_data = json.load(f)
    
    har_entries = har_data.get("log", {}).get("entries", [])
    
    for idx, har_entry in enumerate(har_entries):
        try:
            request_data = har_entry.get("request", {})
            headers = {h["name"]: h["value"] for h in request_data.get("headers", [])}
            
            request = {
                "method": request_data.get("method", "UNKNOWN"),
                "url": request_data.get("url", ""),
                "headers": headers,
                "body": request_data.get("postData", {}).get("text"),
                "source_type": "har",
                "source_location": f"{file_path}:entry {idx}",
            }
            
            response_data = har_entry.get("response", {})
            resp_headers = {h["name"]: h["value"] for h in response_data.get("headers", [])}
            
            response = {
                "status": response_data.get("status", 0),
                "headers": resp_headers,
                "body": response_data.get("content", {}).get("text"),
                "mimeType": response_data.get("content", {}).get("mimeType"),
                "timing": har_entry.get("time"),
            }
            
            entry = {
                "id": f"har_{idx}",
                "request": request,
                "response": response,
                "curl_command": generate_curl(request["method"], request["url"], headers, request["body"]),
                "is_sensitive": False,
                "sensitive_fields": [],
                "status": "success",
            }
            result["entries"].append(entry)
            
        except Exception as e:
            result["errors"].append({
                "message": f"解析HAR条目失败: {str(e)}",
                "location": f"{file_path}:entry {idx}",
                "timestamp": datetime.now().isoformat(),
            })


def process_curl_line(curl_cmd, line_num, file_path, result):
    curl_cmd = curl_cmd.strip()
    if not curl_cmd.lower().startswith("curl"):
        return
    
    method = "GET"
    url = ""
    headers = {}
    
    import shlex
    try:
        parts = shlex.split(curl_cmd)
        for i, part in enumerate(parts):
            if part.startswith("http"):
                url = part
                break
    except:
        pass
    
    request = {
        "method": method.upper(),
        "url": url,
        "headers": headers,
        "body": None,
        "source_type": "curl",
        "source_location": f"{file_path}:line {line_num}",
    }
    
    entry = {
        "id": f"curl_{line_num}",
        "request": request,
        "response": None,
        "curl_command": curl_cmd,
        "is_sensitive": False,
        "sensitive_fields": [],
        "status": "success",
    }
    result["entries"].append(entry)


def read_text_file(file_path, result):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    lines = content.split("\\n")
    method_pattern = re.compile(r"^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\\s+(\\S+)", re.IGNORECASE)
    
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        match = method_pattern.match(line.strip())
        
        if match:
            method = match.group(1).upper()
            url = match.group(2)
            headers = {}
            
            start_line = idx + 1
            idx += 1
            while idx < len(lines) and ":" in lines[idx]:
                header_line = lines[idx].strip()
                if ":" in header_line:
                    key, value = header_line.split(":", 1)
                    headers[key.strip()] = value.strip()
                idx += 1
            
            request = {
                "method": method,
                "url": url,
                "headers": headers,
                "body": None,
                "source_type": "text",
                "source_location": f"{file_path}:line {start_line}",
            }
            
            entry = {
                "id": f"text_{start_line}",
                "request": request,
                "response": None,
                "curl_command": generate_curl(method, url, headers),
                "is_sensitive": False,
                "sensitive_fields": [],
                "status": "success",
            }
            result["entries"].append(entry)
        else:
            idx += 1


def get_reader(file_path):
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == ".har":
        return read_har_file
    elif "curl" in path.name.lower() or suffix in [".curl", ".sh"]:
        return read_curl_file
    else:
        return read_text_file


def mask_sensitive_data(result, custom_fields=None):
    sensitive_fields = [f.lower() for f in (custom_fields or DEFAULT_SENSITIVE_FIELDS)]
    
    for entry in result["entries"]:
        sensitive_found = []
        request = entry["request"]
        
        for key in list(request["headers"].keys()):
            if any(s in key.lower() for s in sensitive_fields):
                request["headers"][key] = mask_value(request["headers"][key])
                sensitive_found.append(f"header:{key}")
        
        if sensitive_found:
            entry["is_sensitive"] = True
            entry["sensitive_fields"] = list(set(sensitive_found))


def process_files(file_paths, sensitive_fields=None, mask=True):
    result = {"entries": [], "errors": [], "summary": {}}
    
    for file_path in file_paths:
        try:
            reader = get_reader(file_path)
            reader(file_path, result)
        except Exception as e:
            result["errors"].append({
                "message": str(e),
                "location": file_path,
                "timestamp": datetime.now().isoformat(),
            })
    
    if mask:
        mask_sensitive_data(result, sensitive_fields)
    
    generate_summary(result)
    
    return result


def generate_summary(result):
    total = len(result["entries"])
    success = len([e for e in result["entries"] if e.get("status") == "success"])
    warning = len([e for e in result["entries"] if e.get("status") == "warning"])
    error = len([e for e in result["entries"] if e.get("status") == "error"])
    
    methods = {}
    for entry in result["entries"]:
        method = entry.get("request", {}).get("method", "UNKNOWN")
        methods[method] = methods.get(method, 0) + 1
    
    source_types = {}
    for entry in result["entries"]:
        st = entry.get("request", {}).get("source_type", "unknown")
        source_types[st] = source_types.get(st, 0) + 1
    
    has_sensitive = len([e for e in result["entries"] if e.get("is_sensitive")])
    
    summary = {
        "total_entries": total,
        "success_count": success,
        "warning_count": warning,
        "error_count": error,
        "file_errors": len(result["errors"]),
        "methods": methods,
        "source_types": source_types,
        "sensitive_entries": has_sensitive,
        "generated_at": datetime.now().isoformat(),
    }
    result["summary"] = summary
    return summary


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
    
    if summary["methods"]:
        lines.append("\\n请求方法分布:")
        for method, count in summary["methods"].items():
            lines.append(f"  {method}: {count}")
    
    if summary["source_types"]:
        lines.append("\\n来源类型:")
        for stype, count in summary["source_types"].items():
            lines.append(f"  {stype}: {count}")
    
    lines.append(f"\\n含敏感数据: {summary['sensitive_entries']} 条")
    
    if result["errors"]:
        lines.append("\\n错误列表:")
        for err in result["errors"][:5]:
            loc = err.get("location", "unknown")
            msg = err["message"]
            lines.append(f"  [{loc}] {msg}")
        if len(result["errors"]) > 5:
            lines.append(f"  ... 还有 {len(result['errors']) - 5} 个错误")
    
    lines.append("=" * 60)
    
    return "\\n".join(lines)


def generate_markdown(result):
    summary = result["summary"]
    
    lines = []
    lines.append("# API 抓包归档报告")
    lines.append("")
    lines.append(f"生成时间: {summary['generated_at']}")
    lines.append("")
    
    lines.append("## 摘要")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总计条目 | {summary['total_entries']} |")
    lines.append(f"| 成功 | {summary['success_count']} |")
    lines.append(f"| 警告 | {summary['warning_count']} |")
    lines.append(f"| 错误 | {summary['error_count']} |")
    lines.append(f"| 文件错误 | {summary['file_errors']} |")
    lines.append(f"| 含敏感数据 | {summary['sensitive_entries']} |")
    lines.append("")
    
    if summary["methods"]:
        lines.append("## 请求方法分布")
        lines.append("")
        for method, count in summary["methods"].items():
            lines.append(f"- **{method}**: {count}")
        lines.append("")
    
    lines.append("## 归档条目")
    lines.append("")
    
    for entry in result["entries"]:
        status_icon = {"success": "\\u2705", "warning": "\\u26a0\\ufe0f", "error": "\\u274c"}.get(entry.get("status", "success"), "\\u2753")
        lines.append(f"### {status_icon} {entry['id']}")
        lines.append("")
        lines.append(f"- **来源**: {entry['request']['source_location']}")
        lines.append(f"- **请求**: {entry['request']['method']} `{entry['request']['url']}`")
        
        if entry.get("response") and entry["response"].get("status"):
            lines.append(f"- **响应状态**: {entry['response']['status']}")
        
        if entry.get("is_sensitive"):
            lines.append(f"- **敏感字段**: {', '.join(entry['sensitive_fields'])}")
        
        if entry.get("error_message"):
            lines.append(f"- **错误**: {entry['error_message']}")
        
        lines.append("")
    
    if result["errors"]:
        lines.append("## 文件错误")
        lines.append("")
        for err in result["errors"]:
            lines.append(f"- **{err.get('location', 'unknown')}**: {err['message']}")
        lines.append("")
    
    return "\\n".join(lines)


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
            
            if fmt in ["md", "all"]:
                md_file = output_path / f"{base_name}.md"
                md_file.write_text(generate_markdown(result), encoding="utf-8")
                if not quiet:
                    click.echo(f"已生成 Markdown 报告: {md_file}")
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
                click.echo(f"  \\u274c 发现 {len(result['errors'])} 个错误")
                for err in result["errors"]:
                    click.echo(f"     - {err['message']}")
            else:
                click.echo(f"  \\u2705 有效，包含 {len(result['entries'])} 个请求")
        except Exception as e:
            click.echo(f"  \\u274c 读取失败: {str(e)}")


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
'''
    with open("api_archive.py", "a", encoding="utf-8") as f:
        f.write(additional_code)
    
    print("成功追加代码")
else:
    print("文件已经完整")