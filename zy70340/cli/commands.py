import click
import json
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import Optional, Dict, List

from core.models import (
    Vulnerability, WaiveException, TriageResult, Status, 
    Severity, Exploitability, Ecosystem
)
from core.loader import DataLoader
from core.analyzer import VulnerabilityAnalyzer


@click.group()
@click.option("--data-dir", default="./data", type=click.Path(path_type=Path))
@click.pass_context
def cli(ctx, data_dir):
    """依赖漏洞处置 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    ctx.obj["loader"] = DataLoader(data_dir)


@cli.command("import")
@click.argument("scan-file", type=click.Path(exists=True, path_type=Path))
@click.option("--scan-id", help="扫描任务ID，用于重复导入检测")
@click.pass_context
def import_command(ctx, scan_file, scan_id):
    """导入漏洞扫描结果"""
    loader: DataLoader = ctx.obj["loader"]
    
    with open(scan_file, "r", encoding="utf-8") as f:
        scan_data = json.load(f)
    
    vulnerabilities = loader.load_vulnerabilities()
    import_date = date.today()
    
    existing_scan_ids = set(
        v.scan_id for v in vulnerabilities.values() 
        if v.scan_id
    )
    
    if scan_id and scan_id in existing_scan_ids:
        click.echo(f"扫描ID {scan_id} 已存在，跳过导入")
        return
    
    new_count = 0
    for item in scan_data:
        vuln_id = item.get("id") or item.get("vuln_id")
        if not vuln_id:
            continue
        
        if vuln_id in vulnerabilities:
            continue
        
        ecosystem_str = item.get("ecosystem", "").lower()
        try:
            ecosystem = Ecosystem(ecosystem_str)
        except ValueError:
            click.echo(f"忽略未知生态: {ecosystem_str}")
            continue
        
        severity_str = item.get("severity", "").lower()
        try:
            severity = Severity(severity_str)
        except ValueError:
            severity = Severity.LOW
        
        exploitability_str = item.get("exploitability", "").lower()
        try:
            exploitability = Exploitability(exploitability_str)
        except ValueError:
            exploitability = Exploitability.UNPROVEN
        
        vuln = Vulnerability(
            id=vuln_id,
            cve_id=item.get("cve_id"),
            title=item.get("title", ""),
            description=item.get("description", ""),
            ecosystem=ecosystem,
            package_name=item.get("package_name") or item.get("package", ""),
            severity=severity,
            exploitability=exploitability,
            fixed_version=item.get("fixed_version", ""),
            cwe=item.get("cwe", ""),
            cvss_score=item.get("cvss_score"),
            references=item.get("references", []),
            import_date=import_date,
            scan_id=scan_id
        )
        
        vulnerabilities[vuln.id] = vuln
        new_count += 1
    
    loader.save_vulnerabilities(vulnerabilities)
    click.echo(f"成功导入 {new_count} 个新漏洞")


@cli.command()
@click.argument("vulnerability-id")
@click.argument("service-name")
@click.option("--status", type=click.Choice(
    ["new", "triaged", "waived", "fixed", "false_positive"]
), required=True)
@click.option("--triager", required=True, help="处置人")
@click.option("--notes", default="", help="备注")
@click.option("--fixed-version", help="已修复版本号")
@click.pass_context
def triage(ctx, vulnerability_id, service_name, status, triager, notes, fixed_version):
    """手动分类漏洞"""
    loader: DataLoader = ctx.obj["loader"]
    
    vulnerabilities = loader.load_vulnerabilities()
    if vulnerability_id not in vulnerabilities:
        click.echo(f"漏洞 {vulnerability_id} 不存在")
        return
    
    services = loader.load_services()
    if service_name not in services:
        click.echo(f"服务 {service_name} 不存在")
        return
    
    triage_results = loader.load_triage_results()
    
    tr = TriageResult(
        id=f"tr-{vulnerability_id}-{service_name}",
        vulnerability_id=vulnerability_id,
        service_name=service_name,
        status=Status(status),
        triager=triager,
        triage_date=date.today(),
        notes=notes,
        fixed_version=fixed_version
    )
    
    triage_results[tr.id] = tr
    loader.save_triage_results(triage_results)
    
    click.echo(f"已处置漏洞 {vulnerability_id} 为 {status}")


@cli.command()
@click.argument("vulnerability-id")
@click.argument("service-name")
@click.option("--reason", required=True, help="例外原因")
@click.option("--owner", required=True, help="负责人")
@click.option("--approve-date", default=None, help="批准日期 (YYYY-MM-DD)，默认今天")
@click.option("--expire-days", type=int, default=30, help="例外有效期（天），默认30天")
@click.option("--notes", default="", help="备注")
@click.pass_context
def waive(ctx, vulnerability_id, service_name, reason, owner, approve_date, expire_days, notes):
    """添加漏洞例外"""
    loader: DataLoader = ctx.obj["loader"]
    
    vulnerabilities = loader.load_vulnerabilities()
    if vulnerability_id not in vulnerabilities:
        click.echo(f"漏洞 {vulnerability_id} 不存在")
        return
    
    services = loader.load_services()
    if service_name not in services:
        click.echo(f"服务 {service_name} 不存在")
        return
    
    exceptions = loader.load_exceptions()
    
    approve_dt = datetime.fromisoformat(approve_date).date() if approve_date else date.today()
    expire_dt = approve_dt + timedelta(days=expire_days)
    
    exc = WaiveException(
        id=f"exc-{vulnerability_id}-{service_name}",
        vulnerability_id=vulnerability_id,
        service_name=service_name,
        reason=reason,
        owner=owner,
        approve_date=approve_dt,
        expire_date=expire_dt,
        notes=notes
    )
    
    exceptions[exc.id] = exc
    loader.save_exceptions(exceptions)
    
    click.echo(f"已添加例外，有效期至 {expire_dt}")


@cli.command("fix-mark")
@click.argument("vulnerability-id")
@click.argument("service-name")
@click.option("--fixed-version", required=True, help="已修复的版本号")
@click.option("--triager", required=True, help="修复人")
@click.option("--notes", default="", help="备注")
@click.pass_context
def fix_mark(ctx, vulnerability_id, service_name, fixed_version, triager, notes):
    """标记漏洞为已修复"""
    loader: DataLoader = ctx.obj["loader"]
    
    vulnerabilities = loader.load_vulnerabilities()
    if vulnerability_id not in vulnerabilities:
        click.echo(f"漏洞 {vulnerability_id} 不存在")
        return
    
    services = loader.load_services()
    if service_name not in services:
        click.echo(f"服务 {service_name} 不存在")
        return
    
    triage_results = loader.load_triage_results()
    
    tr = TriageResult(
        id=f"tr-{vulnerability_id}-{service_name}",
        vulnerability_id=vulnerability_id,
        service_name=service_name,
        status=Status.FIXED,
        triager=triager,
        triage_date=date.today(),
        notes=notes,
        fixed_version=fixed_version
    )
    
    triage_results[tr.id] = tr
    loader.save_triage_results(triage_results)
    
    click.echo(f"已标记漏洞 {vulnerability_id} 为已修复 (版本 {fixed_version})")


@cli.command("find")
@click.argument("vulnerability-id")
@click.pass_context
def find_affected_services(ctx, vulnerability_id):
    """查看某个漏洞影响哪些服务"""
    loader: DataLoader = ctx.obj["loader"]
    
    vulnerabilities = loader.load_vulnerabilities()
    if vulnerability_id not in vulnerabilities:
        click.echo(f"漏洞 {vulnerability_id} 不存在")
        return
    
    vuln = vulnerabilities[vulnerability_id]
    services = loader.load_services()
    dependencies = loader.load_dependencies()
    exceptions = loader.load_exceptions()
    triage_results = loader.load_triage_results()
    
    analyzer = VulnerabilityAnalyzer(
        vulnerabilities, services, dependencies, exceptions, triage_results
    )
    
    affected_services = analyzer.find_affected_services(vuln)
    affected_deps = analyzer.find_affected_dependencies(vuln)
    
    click.echo(f"\n漏洞: {vuln.id}")
    click.echo(f"标题: {vuln.title}")
    click.echo(f"包名: {vuln.ecosystem.value}/{vuln.package_name}")
    click.echo(f"严重级别: {vuln.severity.value}")
    click.echo(f"可利用性: {vuln.exploitability.value}")
    click.echo(f"\n影响服务 ({len(affected_services)} 个):")
    
    for service in affected_services:
        status = "待处理"
        tr = analyzer.get_triage_result(vuln.id, service.name)
        exc = analyzer.get_exception(vuln.id, service.name)
        
        if tr and tr.status == Status.FIXED:
            status = "已修复"
        elif exc:
            if analyzer.is_exception_expired(exc):
                status = "例外已过期"
            else:
                status = f"已例外 (到期: {exc.expire_date})"
        elif tr:
            status = f"已处置 ({tr.status.value})"
        
        deps_for_service = [d for d in affected_deps if d.service_name == service.name]
        dep_versions = set(d.version for d in deps_for_service)
        
        click.echo(f"\n  - {service.name}")
        click.echo(f"    负责人: {service.owner} ({service.owner_email})")
        click.echo(f"    服务类型: {'公网暴露' if service.is_exposed else '内部服务'}")
        click.echo(f"    当前状态: {status}")
        click.echo(f"    影响版本: {', '.join(dep_versions)}")


@cli.command()
@click.option("--format", type=click.Choice(["text", "json", "html"]), default="text")
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None)
@click.pass_context
def report(ctx, format, output):
    """生成安全周会报告"""
    loader: DataLoader = ctx.obj["loader"]
    
    vulnerabilities = loader.load_vulnerabilities()
    services = loader.load_services()
    dependencies = loader.load_dependencies()
    exceptions = loader.load_exceptions()
    triage_results = loader.load_triage_results()
    
    analyzer = VulnerabilityAnalyzer(
        vulnerabilities, services, dependencies, exceptions, triage_results
    )
    
    analyses = analyzer.sort_by_priority(analyzer.analyze_all())
    
    new_vulns = [a for a in analyses if a.status == Status.NEW]
    triaged_vulns = [a for a in analyses if a.status == Status.TRIAGED]
    waived_vulns = [a for a in analyses if a.status == Status.WAIVED]
    fixed_vulns = [a for a in analyses if a.status == Status.FIXED]
    fp_vulns = [a for a in analyses if a.status == Status.FALSE_POSITIVE]
    
    critical_new = [v for v in new_vulns if v.vulnerability.severity in [Severity.CRITICAL, Severity.HIGH]]
    
    if format == "text":
        report_text = generate_text_report(
            new_vulns, triaged_vulns, waived_vulns, fixed_vulns, fp_vulns, critical_new
        )
        
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(report_text)
            click.echo(f"报告已保存到 {output}")
        else:
            click.echo(report_text)
    
    elif format == "json":
        report_data = {
            "summary": {
                "total": len(analyses),
                "new": len(new_vulns),
                "triaged": len(triaged_vulns),
                "waived": len(waived_vulns),
                "fixed": len(fixed_vulns),
                "false_positive": len(fp_vulns),
                "critical_high_new": len(critical_new)
            },
            "new": _format_for_json(new_vulns),
            "triaged": _format_for_json(triaged_vulns),
            "waived": _format_for_json(waived_vulns),
            "fixed": _format_for_json(fixed_vulns),
            "false_positive": _format_for_json(fp_vulns)
        }
        
        if output:
            with open(output, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            click.echo(f"报告已保存到 {output}")
        else:
            click.echo(json.dumps(report_data, indent=2, ensure_ascii=False))
    
    elif format == "html":
        report_html = generate_html_report(
            new_vulns, triaged_vulns, waived_vulns, fixed_vulns, fp_vulns, critical_new
        )
        
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(report_html)
            click.echo(f"报告已保存到 {output}")
        else:
            click.echo(report_html)


def generate_text_report(new_vulns, triaged_vulns, waived_vulns, fixed_vulns, fp_vulns, critical_new):
    lines = []
    lines.append("=" * 80)
    lines.append("依赖漏洞处置报告")
    lines.append("=" * 80)
    lines.append(f"\n生成时间: {date.today().isoformat()}")
    lines.append("\n" + "-" * 80)
    lines.append("概览")
    lines.append("-" * 80)
    lines.append(f"  总漏洞数: {len(new_vulns) + len(triaged_vulns) + len(waived_vulns) + len(fixed_vulns) + len(fp_vulns)}")
    lines.append(f"  待处理 (需优先关注): {len(new_vulns)}")
    lines.append(f"    - 高危/严重: {len(critical_new)}")
    lines.append(f"  处置中: {len(triaged_vulns)}")
    lines.append(f"  已例外: {len(waived_vulns)}")
    lines.append(f"  已修复: {len(fixed_vulns)}")
    lines.append(f"  误报/不影响: {len(fp_vulns)}")
    
    if critical_new:
        lines.append("\n" + "=" * 80)
        lines.append("安全风险 - 高危/严重漏洞 (需立即处理)")
        lines.append("=" * 80)
        for a in critical_new:
            lines.extend(_format_vuln_text(a, "security"))
    
    if new_vulns:
        lines.append("\n" + "=" * 80)
        lines.append("工程待办 - 全部待处理漏洞")
        lines.append("=" * 80)
        for a in new_vulns:
            lines.extend(_format_vuln_text(a, "engineering"))
    
    if triaged_vulns:
        lines.append("\n" + "=" * 80)
        lines.append("处置中")
        lines.append("=" * 80)
        for a in triaged_vulns:
            lines.extend(_format_vuln_text(a, "triaged"))
    
    if waived_vulns:
        lines.append("\n" + "=" * 80)
        lines.append("已例外")
        lines.append("=" * 80)
        for a in waived_vulns:
            lines.extend(_format_vuln_text(a, "waived"))
    
    if fixed_vulns:
        lines.append("\n" + "=" * 80)
        lines.append("已修复")
        lines.append("=" * 80)
        for a in fixed_vulns:
            lines.extend(_format_vuln_text(a, "fixed"))
    
    if fp_vulns:
        lines.append("\n" + "=" * 80)
        lines.append("误报/不影响")
        lines.append("=" * 80)
        for a in fp_vulns:
            lines.extend(_format_vuln_text(a, "false_positive"))
    
    return "\n".join(lines)


def _format_vuln_text(analysis, category):
    lines = []
    v = analysis.vulnerability
    lines.append(f"\n漏洞ID: {v.id}")
    if v.cve_id:
        lines.append(f"CVE: {v.cve_id}")
    lines.append(f"标题: {v.title}")
    lines.append(f"组件: {v.ecosystem.value}/{v.package_name}")
    lines.append(f"严重级别: {v.severity.value.upper()}")
    lines.append(f"可利用性: {v.exploitability.value}")
    lines.append(f"修复版本: {v.fixed_version}")
    
    lines.append(f"影响服务 ({len(analysis.affected_services)}):")
    for s in analysis.affected_services:
        exposed = " [公网暴露]" if s.is_exposed else ""
        lines.append(f"  - {s.name}{exposed} (负责人: {s.owner})")
        
        deps = [d for d in analysis.affected_dependencies if d.service_name == s.name]
        if deps:
            versions = set(d.version for d in deps)
            indirect = any(not d.is_direct for d in deps)
            lines.append(f"    当前版本: {', '.join(versions)}")
            if indirect:
                lines.append(f"    类型: 间接依赖")
    
    if analysis.triage_result:
        lines.append(f"处置状态: {analysis.triage_result.status.value}")
        lines.append(f"处置人: {analysis.triage_result.triager}")
        if analysis.triage_result.fixed_version:
            lines.append(f"修复版本: {analysis.triage_result.fixed_version}")
    
    if analysis.exception:
        lines.append(f"例外原因: {analysis.exception.reason}")
        lines.append(f"到期时间: {analysis.exception.expire_date}")
        lines.append(f"批准人: {analysis.exception.owner}")
    
    return lines


def _format_for_json(analyses):
    result = []
    for a in analyses:
        v = a.vulnerability
        item = {
            "id": v.id,
            "cve_id": v.cve_id,
            "title": v.title,
            "ecosystem": v.ecosystem.value,
            "package_name": v.package_name,
            "severity": v.severity.value,
            "exploitability": v.exploitability.value,
            "fixed_version": v.fixed_version,
            "affected_services": [s.name for s in a.affected_services],
            "services_detail": [
                {
                    "name": s.name,
                    "owner": s.owner,
                    "is_exposed": s.is_exposed,
                    "versions": list(set(d.version for d in a.affected_dependencies if d.service_name == s.name))
                }
                for s in a.affected_services
            ]
        }
        
        if a.triage_result:
            item["triage"] = {
                "status": a.triage_result.status.value,
                "triager": a.triage_result.triager,
                "fixed_version": a.triage_result.fixed_version
            }
        
        if a.exception:
            item["exception"] = {
                "reason": a.exception.reason,
                "expire_date": a.exception.expire_date.isoformat(),
                "owner": a.exception.owner
            }
        
        result.append(item)
    
    return result


def generate_html_report(new_vulns, triaged_vulns, waived_vulns, fixed_vulns, fp_vulns, critical_new):
    from jinja2 import Template
    
    template = Template("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>依赖漏洞处置报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { margin-top: 40px; padding: 10px; border-radius: 4px; }
        .security { background: #fff3cd; color: #856404; }
        .engineering { background: #f8d7da; color: #721c24; }
        .triaged { background: #cce5ff; color: #004085; }
        .waived { background: #e2e3e5; color: #383d41; }
        .fixed { background: #d4edda; color: #155724; }
        .false-positive { background: #f8f9fa; color: #6c757d; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .summary-item { text-align: center; padding: 15px; border-radius: 4px; }
        .vuln-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .vuln-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .critical { background: #dc3545; color: white; }
        .high { background: #fd7e14; color: white; }
        .medium { background: #ffc107; color: #333; }
        .low { background: #28a745; color: white; }
        .active { background: #dc3545; color: white; }
        .poc { background: #fd7e14; color: white; }
        .unproven { background: #6c757d; color: white; }
        .service-item { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; }
        .exposed-tag { background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 5px; }
    </style>
</head>
<body>
    <h1>依赖漏洞处置报告</h1>
    <p>生成时间: {{ today }}</p>
    
    <div class="summary">
        <h3>概览</h3>
        <div class="summary-grid">
            <div class="summary-item" style="background: #f8d7da;">
                <div style="font-size: 32px; font-weight: bold;">{{ critical_high_count }}</div>
                <div>高危/严重 (需立即处理)</div>
            </div>
            <div class="summary-item" style="background: #fff3cd;">
                <div style="font-size: 32px; font-weight: bold;">{{ new_count }}</div>
                <div>待处理</div>
            </div>
            <div class="summary-item" style="background: #e2e3e5;">
                <div style="font-size: 32px; font-weight: bold;">{{ total_count }}</div>
                <div>总漏洞数</div>
            </div>
        </div>
        <div style="margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div class="summary-item" style="background: #cce5ff;">
                <div style="font-size: 24px; font-weight: bold;">{{ triaged_count }}</div>
                <div>处置中</div>
            </div>
            <div class="summary-item" style="background: #e2e3e5;">
                <div style="font-size: 24px; font-weight: bold;">{{ waived_count }}</div>
                <div>已例外</div>
            </div>
            <div class="summary-item" style="background: #d4edda;">
                <div style="font-size: 24px; font-weight: bold;">{{ fixed_count }}</div>
                <div>已修复</div>
            </div>
        </div>
    </div>
    
    {% if critical_high %}
    <h2 class="security">安全风险 - 高危/严重漏洞</h2>
    {% for item in critical_high %}
    {{ render_vuln(item) }}
    {% endfor %}
    {% endif %}
    
    {% if new_vulns %}
    <h2 class="engineering">工程待办 - 待处理漏洞</h2>
    {% for item in new_vulns %}
    {{ render_vuln(item) }}
    {% endfor %}
    {% endif %}
    
    {% if triaged_vulns %}
    <h2 class="triaged">处置中</h2>
    {% for item in triaged_vulns %}
    {{ render_vuln(item) }}
    {% endfor %}
    {% endif %}
    
    {% if waived_vulns %}
    <h2 class="waived">已例外</h2>
    {% for item in waived_vulns %}
    {{ render_vuln(item) }}
    {% endfor %}
    {% endif %}
    
    {% if fixed_vulns %}
    <h2 class="fixed">已修复</h2>
    {% for item in fixed_vulns %}
    {{ render_vuln(item) }}
    {% endfor %}
    {% endif %}
    
    {% if fp_vulns %}
    <h2 class="false-positive">误报/不影响</h2>
    {% for item in fp_vulns %}
    {{ render_vuln(item) }}
    {% endfor %}
    {% endif %}
</body>
</html>
""")
    
    from jinja2 import Template
    vuln_template = Template("""
<div class="vuln-card">
    <div class="vuln-header">
        <strong>{{ v.id }}{% if v.cve_id %} ({{ v.cve_id }}){% endif %}</strong>
        <div>
            <span class="badge {{ severity_class }}">{{ v.severity.value.upper() }}</span>
            <span class="badge {{ exploit_class }}">{{ v.exploitability.value }}</span>
        </div>
    </div>
    <div><strong>{{ v.title }}</strong></div>
    <div style="color: #666; font-size: 14px; margin-top: 5px;">
        组件: {{ v.ecosystem.value }}/{{ v.package_name }} | 
        修复版本: {{ v.fixed_version }}
    </div>
    
    {% if item.affected_services %}
    <div style="margin-top: 15px;"><strong>影响服务:</strong></div>
    {% for s in item.affected_services %}
    <div class="service-item">
        <strong>{{ s.name }}</strong>
        {% if s.is_exposed %}<span class="exposed-tag">公网暴露</span>{% endif %}
        <div style="font-size: 13px; color: #666; margin-top: 3px;">
            负责人: {{ s.owner }} ({{ s.owner_email }})
        </div>
        {% set deps = item.affected_dependencies | selectattr('service_name', 'equalto', s.name) | list %}
        {% if deps %}
        <div style="font-size: 13px; margin-top: 3px;">
            版本: {{ deps | map(attribute='version') | unique | join(', ') }}
            {% if deps | selectattr('is_direct', 'equalto', false) | list %}
            | <span style="color: #856404;">间接依赖</span>
            {% endif %}
        </div>
        {% endif %}
    </div>
    {% endfor %}
    {% endif %}
    
    {% if item.triage_result %}
    <div style="margin-top: 10px; padding: 10px; background: #cce5ff; border-radius: 4px;">
        <strong>处置状态:</strong> {{ item.triage_result.status.value }} |
        <strong>处置人:</strong> {{ item.triage_result.triager }}
        {% if item.triage_result.fixed_version %}
        | <strong>修复版本:</strong> {{ item.triage_result.fixed_version }}
        {% endif %}
    </div>
    {% endif %}
    
    {% if item.exception %}
    <div style="margin-top: 10px; padding: 10px; background: #e2e3e5; border-radius: 4px;">
        <strong>例外原因:</strong> {{ item.exception.reason }}<br>
        <strong>到期时间:</strong> {{ item.exception.expire_date }} |
        <strong>批准人:</strong> {{ item.exception.owner }}
    </div>
    {% endif %}
</div>
""")
    
    def render_vuln(item):
        v = item.vulnerability
        severity_classes = {
            Severity.CRITICAL: "critical",
            Severity.HIGH: "high",
            Severity.MEDIUM: "medium",
            Severity.LOW: "low"
        }
        exploit_classes = {
            Exploitability.ACTIVE: "active",
            Exploitability.PROOF_OF_CONCEPT: "poc",
            Exploitability.UNPROVEN: "unproven"
        }
        return vuln_template.render(
            item=item,
            v=v,
            severity_class=severity_classes.get(v.severity, "low"),
            exploit_class=exploit_classes.get(v.exploitability, "unproven")
        )
    
    return template.render(
        today=date.today().isoformat(),
        total_count=len(new_vulns) + len(triaged_vulns) + len(waived_vulns) + len(fixed_vulns) + len(fp_vulns),
        new_count=len(new_vulns),
        triaged_count=len(triaged_vulns),
        waived_count=len(waived_vulns),
        fixed_count=len(fixed_vulns),
        critical_high_count=len(critical_new),
        critical_high=critical_new,
        new_vulns=new_vulns,
        triaged_vulns=triaged_vulns,
        waived_vulns=waived_vulns,
        fixed_vulns=fixed_vulns,
        fp_vulns=fp_vulns,
        render_vuln=render_vuln,
        Severity=Severity,
        Exploitability=Exploitability
    )
