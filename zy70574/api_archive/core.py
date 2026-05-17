#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

DEFAULT_SENSITIVE_FIELDS = [
    "authorization", "token", "password", "secret", "key", "apikey",
    "access_token", "refresh_token", "jwt", "cookie", "session"
]


def mask_value(value: str, mask_char: str = "*") -> str:
    """敏感数据脱敏：保留首尾字符，中间用掩码替换"""
    if not value or len(value) <= 4:
        return mask_char * len(value)
    return value[:2] + mask_char * (len(value) - 4) + value[-2:]


def generate_curl(method: str, url: str, headers: Dict[str, str], body: Optional[str] = None) -> str:
    """生成可复现的curl命令"""
    parts = ["curl"]
    if method.upper() != "GET":
        parts.append(f"-X {method.upper()}")
    for key, value in headers.items():
        escaped_value = value.replace('"', '\\"')
        parts.append(f'-H "{key}: {escaped_value}"')
    if body and len(body) < 1000:
        escaped_body = body.replace('"', '\\"').replace("$", "\\$")
        parts.append(f'-d "{escaped_body}"')
    parts.append(f'"{url}"')
    return " ".join(parts)


class ArchiveEntry:
    """归档条目：包含完整的请求、响应和元数据"""
    def __init__(self, entry_id: str, source_location: str, source_type: str):
        self.id = entry_id
        self.source_location = source_location
        self.source_type = source_type
        self.method = "UNKNOWN"
        self.url = ""
        self.headers = {}
        self.body = None
        self.response = None  # status, headers, body, timing, mime_type
        self.curl_command = ""
        self.is_sensitive = False
        self.sensitive_fields = []
        self.status = "success"  # success / warning / error
        self.error_message = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "request": {
                "method": self.method,
                "url": self.url,
                "headers": self.headers,
                "body": self.body,
                "source_type": self.source_type,
                "source_location": self.source_location,
            },
            "response": self.response,
            "curl_command": self.curl_command,
            "is_sensitive": self.is_sensitive,
            "sensitive_fields": self.sensitive_fields,
            "status": self.status,
            "error_message": self.error_message,
        }


class ArchiveResult:
    """归档结果集合"""
    def __init__(self):
        self.entries: List[ArchiveEntry] = []
        self.errors: List[Dict] = []
        self.summary = {}

    def add_error(self, message: str, location: str, line_no: Optional[int] = None):
        """添加错误记录，保留原始位置"""
        loc = f"{location}:{line_no}" if line_no else location
        self.errors.append({
            "message": message,
            "location": loc,
            "timestamp": datetime.now().isoformat(),
        })

    def add_entry(self, entry: ArchiveEntry):
        self.entries.append(entry)

    def to_dict(self) -> Dict:
        return {
            "entries": [e.to_dict() for e in self.entries],
            "errors": self.errors,
            "summary": self.summary,
        }


class HARReader:
    """HAR文件读取器"""
    @staticmethod
    def read(file_path: str, result: ArchiveResult):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            entries = data.get('log', {}).get('entries', [])
            if not entries:
                result.add_error("HAR文件不包含entries字段或为空", file_path)
                return
            
            for idx, entry in enumerate(entries):
                try:
                    request = entry.get('request', {})
                    response = entry.get('response', {})
                    
                    ae = ArchiveEntry(
                        entry_id=f"har_{idx}",
                        source_location=f"{file_path}:entry[{idx}]",
                        source_type="har"
                    )
                    
                    # 请求信息
                    ae.method = request.get('method', 'UNKNOWN')
                    ae.url = request.get('url', '')
                    ae.headers = {h['name']: h['value'] for h in request.get('headers', [])}
                    ae.body = request.get('postData', {}).get('text') if request.get('postData') else None
                    
                    # 响应信息
                    ae.response = {
                        "status": response.get('status', 0),
                        "headers": {h['name']: h['value'] for h in response.get('headers', [])},
                        "body": response.get('content', {}).get('text'),
                        "mime_type": response.get('content', {}).get('mimeType'),
                        "timing": entry.get('time'),
                    }
                    
                    # 生成curl命令
                    ae.curl_command = generate_curl(ae.method, ae.url, ae.headers, ae.body)
                    
                    result.add_entry(ae)
                    
                except Exception as e:
                    result.add_error(f"解析HAR条目失败: {str(e)}", file_path, idx)
                    
        except json.JSONDecodeError as e:
            result.add_error(f"JSON解析失败: {str(e)}", file_path)
        except Exception as e:
            result.add_error(f"读取HAR文件失败: {str(e)}", file_path)


class CurlReader:
    """curl命令文件读取器"""
    METHOD_PATTERN = re.compile(r'-X\s+(\w+)')
    HEADER_PATTERN = re.compile(r'-H\s+["\']([^:]+):\s*([^"\']+)["\']')
    URL_PATTERN = re.compile(r'(https?://\S+)')
    DATA_PATTERN = re.compile(r'--?d(?:ata)?\s+["\'](.+?)["\'](?:\s|$)')
    
    @staticmethod
    def read(file_path: str, result: ArchiveResult):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            entry_idx = 0
            for line_no, line in enumerate(lines, 1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                if 'curl' in line.lower():
                    ae = ArchiveEntry(
                        entry_id=f"curl_{line_no}",
                        source_location=f"{file_path}:line[{line_no}]",
                        source_type="curl"
                    )
                    
                    # 提取方法
                    method_match = CurlReader.METHOD_PATTERN.search(line)
                    ae.method = method_match.group(1).upper() if method_match else "GET"
                    
                    # 提取URL
                    url_match = CurlReader.URL_PATTERN.search(line)
                    ae.url = url_match.group(1) if url_match else ""
                    
                    # 提取headers
                    for match in CurlReader.HEADER_PATTERN.finditer(line):
                        ae.headers[match.group(1)] = match.group(2)
                    
                    # 提取body
                    data_match = CurlReader.DATA_PATTERN.search(line)
                    ae.body = data_match.group(1) if data_match else None
                    
                    # 生成curl命令
                    ae.curl_command = generate_curl(ae.method, ae.url, ae.headers, ae.body)
                    
                    result.add_entry(ae)
                    entry_idx += 1
                    
        except Exception as e:
            result.add_error(f"读取curl文件失败: {str(e)}", file_path)


class TextHTTPReader:
    """纯文本HTTP请求读取器"""
    REQUEST_LINE_PATTERN = re.compile(r'^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)', re.IGNORECASE)
    HEADER_LINE_PATTERN = re.compile(r'^([A-Za-z0-9-]+):\s*(.+)$')
    
    @staticmethod
    def read(file_path: str, result: ArchiveResult):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            entry_idx = 0
            idx = 0
            while idx < len(lines):
                line = lines[idx].strip()
                start_line = idx + 1
                
                # 查找请求行
                request_match = TextHTTPReader.REQUEST_LINE_PATTERN.match(line)
                if request_match:
                    ae = ArchiveEntry(
                        entry_id=f"txt_{start_line}",
                        source_location=f"{file_path}:line[{start_line}]",
                        source_type="text"
                    )
                    
                    ae.method = request_match.group(1).upper()
                    ae.url = request_match.group(2)
                    idx += 1
                    
                    # 提取headers
                    while idx < len(lines):
                        header_line = lines[idx].strip()
                        if not header_line:
                            idx += 1
                            break
                        
                        header_match = TextHTTPReader.HEADER_LINE_PATTERN.match(header_line)
                        if header_match:
                            ae.headers[header_match.group(1)] = header_match.group(2)
                            idx += 1
                        else:
                            break
                    
                    # 剩余的作为body
                    body_lines = []
                    while idx < len(lines):
                        bline = lines[idx].strip()
                        if TextHTTPReader.REQUEST_LINE_PATTERN.match(bline):
                            break
                        if bline:
                            body_lines.append(bline)
                        idx += 1
                    
                    if body_lines:
                        ae.body = '\n'.join(body_lines)
                    
                    ae.curl_command = generate_curl(ae.method, ae.url, ae.headers, ae.body)
                    result.add_entry(ae)
                    entry_idx += 1
                else:
                    idx += 1
            
            if entry_idx == 0:
                result.add_error("未识别到有效的HTTP请求行", file_path)
                
        except Exception as e:
            result.add_error(f"读取文本HTTP文件失败: {str(e)}", file_path)


def get_reader_for_file(file_path: str):
    """根据文件类型选择读取器"""
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == '.har':
        return HARReader.read
    elif suffix in ['.curl', '.sh'] or 'curl' in path.name.lower():
        return CurlReader.read
    else:
        return TextHTTPReader.read


def mask_sensitive_data(entry: ArchiveEntry, sensitive_fields: List[str]):
    """对单个条目进行敏感数据脱敏：Headers、URL参数、Body，并重新生成curl命令"""
    fields_lower = [f.lower() for f in sensitive_fields]
    sensitive_found = []
    
    # 1. Headers脱敏
    for key, value in list(entry.headers.items()):
        if any(s in key.lower() for s in fields_lower):
            entry.headers[key] = mask_value(value)
            sensitive_found.append(f"header:{key}")
    
    # 2. URL中的敏感参数脱敏
    original_url = entry.url
    for param in ['token', 'access_token', 'key', 'secret', 'password', 'apikey', 'session']:
        pattern = re.compile(rf'({param}=)([^&\s]+)', re.IGNORECASE)
        match = pattern.search(entry.url)
        if match:
            entry.url = pattern.sub(lambda m: m.group(1) + mask_value(m.group(2)), entry.url)
            sensitive_found.append(f"url:{param}")
    
    # 3. Body中的敏感字段脱敏（简单JSON处理）
    if entry.body and isinstance(entry.body, str):
        for field in sensitive_fields:
            # 匹配 "field": "value" 或 'field': 'value' 格式
            pattern = re.compile(rf'([\"\']{field}[\"\']\s*:\s*[\"\'])([^\"\']+)([\"\'])', re.IGNORECASE)
            if pattern.search(entry.body):
                entry.body = pattern.sub(lambda m: m.group(1) + mask_value(m.group(2)) + m.group(3), entry.body)
                sensitive_found.append(f"body:{field}")
    
    # 4. 🔴 关键修复：脱敏后重新生成curl命令（闭环）
    entry.curl_command = generate_curl(entry.method, entry.url, entry.headers, entry.body)
    
    if sensitive_found:
        entry.is_sensitive = True
        entry.sensitive_fields = list(set(sensitive_found))


def process_files(file_paths: List[str], sensitive_fields: Optional[List[str]] = None, mask: bool = True) -> ArchiveResult:
    """核心处理函数：读取多个文件，解析请求，脱敏，生成结果"""
    result = ArchiveResult()
    fields = sensitive_fields if sensitive_fields else DEFAULT_SENSITIVE_FIELDS
    
    for file_path in file_paths:
        reader = get_reader_for_file(file_path)
        reader(file_path, result)
    
    # 脱敏处理
    if mask:
        for entry in result.entries:
            mask_sensitive_data(entry, fields)
    
    # 生成摘要
    total = len(result.entries)
    success = sum(1 for e in result.entries if e.status == 'success')
    warning = sum(1 for e in result.entries if e.status == 'warning')
    error = sum(1 for e in result.entries if e.status == 'error')
    
    methods = {}
    for entry in result.entries:
        methods[entry.method] = methods.get(entry.method, 0) + 1
    
    source_types = {}
    for entry in result.entries:
        source_types[entry.source_type] = source_types.get(entry.source_type, 0) + 1
    
    sensitive_entries = sum(1 for e in result.entries if e.is_sensitive)
    
    result.summary = {
        "total_entries": total,
        "success_count": success,
        "warning_count": warning,
        "error_count": error,
        "file_errors": len(result.errors),
        "methods": methods,
        "source_types": source_types,
        "sensitive_entries": sensitive_entries,
        "generated_at": datetime.now().isoformat(),
    }
    
    return result


class ReportGenerator:
    """报告生成器"""
    def __init__(self, result: ArchiveResult):
        self.result = result
        self.summary = result.summary
    
    def generate_terminal_summary(self) -> str:
        """生成终端摘要输出"""
        lines = []
        lines.append("=" * 60)
        lines.append("API 抓包归档摘要")
        lines.append("=" * 60)
        lines.append(f"总计条目: {self.summary['total_entries']}")
        lines.append(f"  - 成功: {self.summary['success_count']}")
        lines.append(f"  - 警告: {self.summary['warning_count']}")
        lines.append(f"  - 错误: {self.summary['error_count']}")
        lines.append(f"文件错误: {self.summary['file_errors']}")
        
        if self.summary['methods']:
            lines.append("\n请求方法分布:")
            for method, count in sorted(self.summary['methods'].items()):
                lines.append(f"  {method}: {count}")
        
        if self.summary['source_types']:
            lines.append("\n来源类型:")
            for stype, count in sorted(self.summary['source_types'].items()):
                lines.append(f"  {stype}: {count}")
        
        lines.append(f"\n含敏感数据: {self.summary['sensitive_entries']} 条")
        
        if self.result.errors:
            lines.append("\n错误列表:")
            for err in self.result.errors[:5]:
                loc = err.get("location", "unknown")
                msg = err["message"]
                lines.append(f"  [{loc}] {msg}")
            if len(self.result.errors) > 5:
                lines.append(f"  ... 还有 {len(self.result.errors) - 5} 个错误")
        
        lines.append("=" * 60)
        return "\n".join(lines)
    
    def generate_json(self, indent: int = 2) -> str:
        """生成机器可读的JSON结果"""
        return json.dumps(self.result.to_dict(), ensure_ascii=False, indent=indent)
    
    def generate_markdown(self) -> str:
        """生成适合发给同事的Markdown归档报告"""
        lines = []
        lines.append("# API 抓包归档报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.summary['generated_at']}")
        lines.append("")
        
        # 摘要表格
        lines.append("## 📊 摘要概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总计条目 | {self.summary['total_entries']} |")
        lines.append(f"| ✅ 成功 | {self.summary['success_count']} |")
        lines.append(f"| ⚠️  警告 | {self.summary['warning_count']} |")
        lines.append(f"| ❌ 错误 | {self.summary['error_count']} |")
        lines.append(f"| 📁 文件错误 | {self.summary['file_errors']} |")
        lines.append(f"| 🔒 含敏感数据 | {self.summary['sensitive_entries']} |")
        lines.append("")
        
        # 请求方法分布
        if self.summary['methods']:
            lines.append("## 🔗 请求方法分布")
            lines.append("")
            for method, count in sorted(self.summary['methods'].items()):
                lines.append(f"- **{method}**: {count} 个请求")
            lines.append("")
        
        # 来源类型
        if self.summary['source_types']:
            lines.append("## 📂 来源类型")
            lines.append("")
            for stype, count in sorted(self.summary['source_types'].items()):
                lines.append(f"- **{stype}**: {count} 条")
            lines.append("")
        
        # 详细条目
        lines.append("## 📋 归档条目详情")
        lines.append("")
        
        status_icons = {'success': '✅', 'warning': '⚠️', 'error': '❌'}
        for entry in self.result.entries:
            icon = status_icons.get(entry.status, '❓')
            lines.append(f"### {icon} {entry.id}")
            lines.append("")
            lines.append(f"- **来源**: `{entry.source_location}`")
            lines.append(f"- **请求**: {entry.method} `{entry.url}`")
            
            if entry.response and entry.response.get('status'):
                lines.append(f"- **响应状态**: {entry.response['status']}")
            
            if entry.is_sensitive:
                lines.append(f"- **🔒 敏感字段**: {', '.join(entry.sensitive_fields)}")
            
            if entry.error_message:
                lines.append(f"- **❌ 错误**: {entry.error_message}")
            
            # 可复现的curl命令
            if entry.curl_command:
                lines.append("")
                lines.append("**可复现命令:**")
                lines.append("```bash")
                lines.append(entry.curl_command)
                lines.append("```")
            
            lines.append("")
        
        # 文件错误
        if self.result.errors:
            lines.append("## ❌ 文件错误")
            lines.append("")
            for err in self.result.errors:
                loc = err.get("location", "unknown")
                lines.append(f"- **`{loc}`**: {err['message']}")
            lines.append("")
        
        # 附录
        lines.append("## 📝 附录")
        lines.append("")
        lines.append("- 敏感字段掩码规则: 保留首尾2字符，中间用 `*` 替换")
        lines.append("- 条目ID编码规则: `{来源类型}_{序号}`")
        lines.append("- 错误位置格式: `文件路径:line[行号]` 或 `文件路径:entry[HAR索引]`")
        lines.append("")
        
        return "\n".join(lines)
