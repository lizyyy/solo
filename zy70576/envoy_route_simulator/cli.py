#!/usr/bin/env python3
import yaml
import json
import re
import os
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from jinja2 import Template
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

@dataclass
class RouteMatch:
    prefix: Optional[str] = None
    path: Optional[str] = None
    regex: Optional[str] = None
    headers: List[Dict] = field(default_factory=list)

@dataclass
class Route:
    name: str
    match: RouteMatch
    cluster: str
    priority: int = 0

@dataclass
class VirtualHost:
    name: str
    domains: List[str]
    routes: List[Route]

@dataclass
class EnvoyConfig:
    virtual_hosts: List[VirtualHost]
    clusters: List[str]

@dataclass
class RequestSample:
    line_num: int
    path: str
    headers: Dict[str, str]
    method: str = "GET"
    is_valid: bool = True
    error: str = ""

@dataclass
class MatchResult:
    request: RequestSample
    matched: bool
    cluster: str = ""
    route_name: str = ""
    match_reason: List[str] = field(default_factory=list)
    vhost_name: str = ""

def parse_envoy_config(config_path: str) -> Tuple[Optional[EnvoyConfig], List[str]]:
    errors = []
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            raw = json.load(f) if config_path.endswith(".json") else yaml.safe_load(f)
    except Exception as e:
        errors.append(f"配置读取失败: {str(e)}")
        return None, errors
    clusters = []
    try:
        if "static_resources" in raw:
            clist = raw["static_resources"].get("clusters", [])
            clusters = [c.get("name") for c in clist if c.get("name")]
    except Exception as e:
        errors.append(f"提取clusters失败: {str(e)}")
    vhosts = []
    try:
        listeners = raw.get("static_resources", {}).get("listeners", [])
        for listener in listeners:
            for fc in listener.get("filter_chains", []):
                for f in fc.get("filters", []):
                    if "http_connection_manager" in f.get("name", ""):
                        cfg = f.get("typed_config", {})
                        rcfg = cfg.get("route_config")
                        if rcfg:
                            for idx, vh in enumerate(rcfg.get("virtual_hosts", [])):
                                routes = []
                                for ridx, r in enumerate(vh.get("routes", [])):
                                    m = r.get("match", {})
                                    rm = RouteMatch(
                                        prefix=m.get("prefix"),
                                        path=m.get("path"),
                                        regex=m.get("regex"),
                                        headers=m.get("headers", [])
                                    )
                                    routes.append(Route(
                                        name=r.get("name", f"route_{ridx}"),
                                        match=rm,
                                        cluster=r.get("route", {}).get("cluster", ""),
                                        priority=ridx
                                    ))
                                vhosts.append(VirtualHost(
                                    name=vh.get("name", f"vhost_{idx}"),
                                    domains=vh.get("domains", ["*"]),
                                    routes=routes
                                ))
    except Exception as e:
        errors.append(f"解析路由失败: {str(e)}")
    return EnvoyConfig(virtual_hosts=vhosts, clusters=clusters), errors

def load_requests(file_path: str) -> List[RequestSample]:
    samples = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    data = json.loads(line)
                    samples.append(RequestSample(
                        line_num=line_num,
                        path=data.get("path", "/"),
                        headers=data.get("headers", {}),
                        method=data.get("method", "GET")
                    ))
                except json.JSONDecodeError as e:
                    samples.append(RequestSample(
                        line_num=line_num,
                        path="",
                        headers={},
                        is_valid=False,
                        error=f"JSON解析错误: {str(e)}"
                    ))
    except FileNotFoundError:
        console.print(f"[red]错误: 请求文件不存在 {file_path}[/red]")
        sys.exit(1)
    return samples

def match_vhost_domain(request_host: str, vhost_domains: List[str]) -> Tuple[bool, str]:
    request_host = (request_host or "").lower().strip()
    if not request_host:
        request_host = "*"
    
    request_host = request_host.split(":")[0]
    
    for domain in vhost_domains:
        domain = domain.lower().strip()
        
        if domain == "*":
            return True, "domain匹配: * (通配符)"
        
        if domain == request_host:
            return True, f"domain精确匹配: {domain}"
        
        if domain.startswith("*") and domain.endswith(request_host[-(len(domain)-1):] if len(domain) > 1 else ""):
            suffix = domain[1:]
            if request_host.endswith(suffix):
                return True, f"domain后缀匹配: {domain}"
        
        if domain.endswith("*") and request_host.startswith(domain[:-1]):
            prefix = domain[:-1]
            if request_host.startswith(prefix):
                return True, f"domain前缀匹配: {domain}"
    
    return False, ""

def match_header(header_rule: Dict, headers: Dict[str, str]) -> bool:
    name = header_rule.get("name", "").lower()
    actual_value = headers.get(name, "") or headers.get(name.title(), "") or ""
    if "exact_match" in header_rule:
        return actual_value == header_rule["exact_match"]
    if "regex_match" in header_rule:
        try:
            return bool(re.match(header_rule["regex_match"], actual_value))
        except:
            return False
    if "prefix_match" in header_rule:
        return actual_value.startswith(header_rule["prefix_match"])
    if "present_match" in header_rule:
        return name in [k.lower() for k in headers.keys()]
    return True

def match_path(route_match: RouteMatch, path: str) -> Tuple[bool, str]:
    if route_match.prefix is not None:
        if path.startswith(route_match.prefix):
            return True, f"前缀匹配: {route_match.prefix}"
    if route_match.path is not None:
        if path == route_match.path:
            return True, f"精确匹配: {route_match.path}"
    if route_match.regex is not None:
        try:
            if re.match(route_match.regex, path):
                return True, f"正则匹配: {route_match.regex}"
        except:
            pass
    return False, ""

def match_request(request: RequestSample, config: EnvoyConfig) -> MatchResult:
    result = MatchResult(request=request, matched=False)
    if not request.is_valid:
        return result
    
    request_host = request.headers.get("host") or request.headers.get("Host") or ""
    
    for vhost in config.virtual_hosts:
        vhost_ok, vhost_reason = match_vhost_domain(request_host, vhost.domains)
        if not vhost_ok:
            continue
            
        for route in vhost.routes:
            reasons = [vhost_reason]
            path_ok, path_reason = match_path(route.match, request.path)
            if path_ok:
                reasons.append(path_reason)
            else:
                continue
            all_headers_ok = True
            for hdr_rule in route.match.headers:
                if not match_header(hdr_rule, request.headers):
                    all_headers_ok = False
                    break
                reasons.append(f"Header匹配: {hdr_rule.get('name')}")
            if all_headers_ok:
                result.matched = True
                result.cluster = route.cluster
                result.route_name = route.name
                result.vhost_name = vhost.name
                result.match_reason = reasons
                return result
    return result

def generate_report(results: List[MatchResult], config: EnvoyConfig, output_dir: str):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(output_dir, exist_ok=True)
    matched_count = sum(1 for r in results if r.matched)
    unmatched_count = sum(1 for r in results if not r.matched and r.request.is_valid)
    invalid_count = sum(1 for r in results if not r.request.is_valid)
    summary = {
        "total": len(results), "matched": matched_count,
        "unmatched": unmatched_count, "invalid": invalid_count,
        "timestamp": timestamp, "clusters": config.clusters, "results": []
    }
    for r in results:
        summary["results"].append({
            "line_num": r.request.line_num, "path": r.request.path,
            "matched": r.matched, "cluster": r.cluster,
            "route_name": r.route_name, "vhost": r.vhost_name,
            "reason": r.match_reason,
            "error": r.request.error if not r.request.is_valid else ""
        })
    json_path = os.path.join(output_dir, f"report_{timestamp}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    html_template = """<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Envoy路由模拟报告</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px}
.summary{display:flex;gap:20px;margin-bottom:30px}
.card{padding:20px;border-radius:8px;min-width:120px;text-align:center}
.matched{background:#d4edda;color:#155724}
.unmatched{background:#f8d7da;color:#721c24}
.invalid{background:#fff3cd;color:#856404}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}
th{background:#f8f9fa}
tr:hover{background:#f5f5f5}
.badge{padding:4px 8px;border-radius:4px;font-size:12px}
.badge-success{background:#d4edda;color:#155724}
.badge-danger{background:#f8d7da;color:#721c24}
.badge-warning{background:#fff3cd;color:#856404}
</style>
</head>
<body>
<h1>Envoy路由模拟报告</h1>
<p>生成时间: {{timestamp}}</p>
<div class="summary">
<div class="card">总请求数<br><strong>{{summary.total}}</strong></div>
<div class="card matched">匹配成功<br><strong>{{summary.matched}}</strong></div>
<div class="card unmatched">未匹配<br><strong>{{summary.unmatched}}</strong></div>
<div class="card invalid">无效样本<br><strong>{{summary.invalid}}</strong></div>
</div>
<h2>匹配结果详情</h2>
<table>
<thead>
<tr>
<th>行号</th><th>路径</th><th>状态</th><th>Cluster</th><th>路由名称</th><th>匹配原因</th>
</tr>
</thead>
<tbody>
{% for r in summary.results %}
<tr>
<td>{{r.line_num}}</td>
<td>{{r.path}}</td>
<td>
{% if r.matched %}<span class="badge badge-success">匹配</span>
{% elif r.error %}<span class="badge badge-warning">无效</span>
{% else %}<span class="badge badge-danger">未匹配</span>{% endif %}
</td>
<td>{{r.cluster or "-"}}</td>
<td>{{r.route_name or "-"}}</td>
<td>{% if r.reason %}{{ r.reason|join(", ") }}{% elif r.error %}{{r.error}}{% else %}-{% endif %}</td>
</tr>
{% endfor %}
</tbody>
</table>
</body>
</html>
    """
    html_path = os.path.join(output_dir, f"report_{timestamp}.html")
    template = Template(html_template)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(template.render(timestamp=summary["timestamp"], summary=summary))
    return json_path, html_path

def print_console_summary(results: List[MatchResult]):
    matched_count = sum(1 for r in results if r.matched)
    unmatched_count = sum(1 for r in results if not r.matched and r.request.is_valid)
    invalid_count = sum(1 for r in results if not r.request.is_valid)
    console.print(Panel.fit(
        f"总计: {len(results)} | [green]匹配: {matched_count}[/green] | "
        f"[red]未匹配: {unmatched_count}[/red] | [yellow]无效: {invalid_count}[/yellow]",
        title="匹配摘要"
    ))
    table = Table(title="匹配详情")
    table.add_column("行号", style="cyan")
    table.add_column("路径")
    table.add_column("状态")
    table.add_column("Cluster")
    table.add_column("路由")
    for r in results[:20]:
        if r.matched:
            status = "[green]✓[/green]"
        elif not r.request.is_valid:
            status = "[yellow]⚠[/yellow]"
        else:
            status = "[red]✗[/red]"
        table.add_row(str(r.request.line_num), r.request.path[:50], status, r.cluster or "-", r.route_name or "-")
    if len(results) > 20:
        console.print(f"... 还有 {len(results) - 20} 条记录，请查看完整报告")
    console.print(table)

def main():
    parser = argparse.ArgumentParser(description="Envoy路由模拟工具")
    parser.add_argument("-c", "--config", required=True, help="Envoy配置文件路径(YAML/JSON)")
    parser.add_argument("-r", "--requests", required=True, help="请求样本文件(JSONL格式)")
    parser.add_argument("-o", "--output", default="./reports", help="报告输出目录")
    args = parser.parse_args()
    console.print("[bold blue]开始Envoy路由模拟[/bold blue]")
    config, config_errors = parse_envoy_config(args.config)
    if config_errors:
        for e in config_errors:
            console.print(f"[yellow]警告: {e}[/yellow]")
    if not config:
        console.print("[red]配置解析失败[/red]")
        sys.exit(1)
    console.print(f"解析到 {len(config.virtual_hosts)} 个虚拟主机, {len(config.clusters)} 个cluster")
    requests = load_requests(args.requests)
    console.print(f"加载了 {len(requests)} 个请求样本")
    results = [match_request(req, config) for req in requests]
    print_console_summary(results)
    json_path, html_path = generate_report(results, config, args.output)
    console.print(f"\n[green]报告已生成:[/green]")
    console.print(f"  JSON: {json_path}")
    console.print(f"  HTML: {html_path}")

if __name__ == "__main__":
    main()
