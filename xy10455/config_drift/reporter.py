from datetime import datetime
from pathlib import Path
from typing import List

from .diff_engine import DiffEngine
from .drift_manager import DriftManager
from .models import (
    ConfigDiff,
    DiffType,
    DriftAllowance,
    PublishRiskReport,
    RiskLevel,
    TenantConfig,
    TenantReport,
)


def generate_tenant_report(
    tenant: TenantConfig,
    diff_engine: DiffEngine,
    drift_manager: DriftManager,
) -> TenantReport:
    diffs = diff_engine.detect_diffs(tenant.config, tenant.source_files)
    allowances = drift_manager.get_tenant_allowances(tenant.tenant_id)

    for allowance in allowances:
        if allowance.check_expired():
            for diff in diffs:
                if diff.key == allowance.key:
                    diff.diff_type = DiffType.EXPIRED_OVERRIDE
                    diff.description = f"过期覆盖: {diff.key} 从 {diff.default_value} 变为 {diff.tenant_value} (原批准已过期)"
                    diff.risk_level = RiskLevel.HIGH

    unresolved = [d for d in diffs if not drift_manager.is_allowed(tenant.tenant_id, d.key)]

    return TenantReport(
        tenant=tenant,
        diffs=diffs,
        allowances=allowances,
        unresolved_diffs=unresolved,
    )


def generate_publish_report(
    tenants: List[TenantConfig],
    diff_engine: DiffEngine,
    drift_manager: DriftManager,
) -> PublishRiskReport:
    tenant_reports = []
    critical_count = 0
    warning_count = 0
    ok_count = 0
    all_critical = []

    for tenant in tenants:
        report = generate_tenant_report(tenant, diff_engine, drift_manager)
        tenant_reports.append(report)

        if report.has_critical_issues:
            critical_count += 1
            for diff in report.unresolved_diffs:
                if diff.risk_level == RiskLevel.HIGH:
                    all_critical.append(f"[{tenant.tenant_id}] {diff.description}")
            for dup in tenant.duplicate_keys:
                all_critical.append(f"[{tenant.tenant_id}] 重复配置: {dup}")
            for err in tenant.parse_errors:
                all_critical.append(f"[{tenant.tenant_id}] 解析错误: {err}")
        elif len(report.unresolved_diffs) > 0:
            warning_count += 1
        else:
            ok_count += 1

    for expired in drift_manager.get_expired_allowances():
        all_critical.append(f"[{expired.tenant_id}] 过期批准: {expired.key} (批准人: {expired.approved_by})")

    return PublishRiskReport(
        generated_at=datetime.now(),
        total_tenants=len(tenants),
        tenants_with_critical_issues=critical_count,
        tenants_with_warnings=warning_count,
        tenants_ok=ok_count,
        tenant_reports=tenant_reports,
        all_critical_issues=all_critical,
    )


def export_html_report(report: PublishRiskReport, output_path: Path):
    html = _build_html_report(report)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def export_json_report(report: PublishRiskReport, output_path: Path):
    data = {
        "generated_at": report.generated_at.isoformat(),
        "summary": {
            "total_tenants": report.total_tenants,
            "tenants_with_critical_issues": report.tenants_with_critical_issues,
            "tenants_with_warnings": report.tenants_with_warnings,
            "tenants_ok": report.tenants_ok,
        },
        "critical_issues": report.all_critical_issues,
        "tenants": [],
    }

    for tr in report.tenant_reports:
        tenant_data = {
            "tenant_id": tr.tenant.tenant_id,
            "tier": tr.tenant.tier,
            "has_errors": tr.tenant.has_errors,
            "duplicate_keys": tr.tenant.duplicate_keys,
            "parse_errors": tr.tenant.parse_errors,
            "unresolved_diffs": [],
            "allowances": [],
        }

        for d in tr.unresolved_diffs:
            tenant_data["unresolved_diffs"].append({
                "key": d.key,
                "diff_type": d.diff_type.value,
                "default_value": str(d.default_value),
                "tenant_value": str(d.tenant_value),
                "description": d.description,
                "risk_level": d.risk_level.value,
                "is_sensitive": d.is_sensitive,
                "source_file": d.source_file,
            })

        for a in tr.allowances:
            tenant_data["allowances"].append({
                "key": a.key,
                "approved_by": a.approved_by,
                "approval_date": a.approval_date.isoformat(),
                "expiry_date": a.expiry_date.isoformat(),
                "reason": a.reason,
                "is_expired": a.is_expired,
            })

        data["tenants"].append(tenant_data)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        import json
        json.dump(data, f, indent=2, ensure_ascii=False)


def _build_html_report(report: PublishRiskReport) -> str:
    critical_html = ""
    for issue in report.all_critical_issues:
        critical_html += f'<li class="critical-item">🔴 {_escape_html(issue)}</li>'

    tenants_html = ""
    for tr in sorted(report.tenant_reports, key=lambda x: (0 if x.has_critical_issues else 1 if len(x.unresolved_diffs) else 2, x.tenant.tenant_id)):
        status_class = "critical" if tr.has_critical_issues else "warning" if tr.unresolved_diffs else "ok"
        status_text = "需要立即处理" if tr.has_critical_issues else "有警告" if tr.unresolved_diffs else "无问题"

        diffs_html = ""
        for d in tr.unresolved_diffs:
            risk_class = "risk-high" if d.risk_level == RiskLevel.HIGH else "risk-medium" if d.risk_level == RiskLevel.MEDIUM else "risk-low"
            icon = "🔴" if d.risk_level == RiskLevel.HIGH else "🟡" if d.risk_level == RiskLevel.MEDIUM else "🟢"
            sensitive_tag = '<span class="tag-sensitive">敏感</span>' if d.is_sensitive else ""
            diffs_html += f"""
                <tr class="{risk_class}">
                    <td>{icon}</td>
                    <td><code>{_escape_html(d.key)}</code> {sensitive_tag}</td>
                    <td>{d.diff_type.value}</td>
                    <td><code>{_escape_html(str(d.default_value))}</code></td>
                    <td><code>{_escape_html(str(d.tenant_value))}</code></td>
                    <td>{_escape_html(d.source_file or '-')}</td>
                </tr>
            """

        allowances_html = ""
        for a in tr.allowances:
            exp_class = "expired" if a.is_expired else "active"
            exp_text = "已过期 ❌" if a.is_expired else "有效"
            allowances_html += f"""
                <tr class="allowance-{exp_class}">
                    <td><code>{_escape_html(a.key)}</code></td>
                    <td>{_escape_html(a.approved_by)}</td>
                    <td>{a.approval_date.strftime('%Y-%m-%d')}</td>
                    <td>{a.expiry_date.strftime('%Y-%m-%d')}</td>
                    <td>{_escape_html(a.reason)}</td>
                    <td>{exp_text}</td>
                </tr>
            """

        errors_html = ""
        if tr.tenant.duplicate_keys or tr.tenant.parse_errors:
            for dup in tr.tenant.duplicate_keys:
                errors_html += f'<li class="error-item">⚠️ 重复键: {_escape_html(dup)}</li>'
            for err in tr.tenant.parse_errors:
                errors_html += f'<li class="error-item">❌ 解析错误: {_escape_html(err)}</li>'
            errors_html = f'<div class="errors-section"><h4>配置错误</h4><ul>{errors_html}</ul></div>'

        tenants_html += f"""
            <div class="tenant-card tenant-{status_class}">
                <div class="tenant-header">
                    <h3>租户: {_escape_html(tr.tenant.tenant_id)} <span class="tier">[{_escape_html(tr.tenant.tier)}]</span></h3>
                    <span class="status-badge status-{status_class}">{status_text}</span>
                </div>
                {errors_html}
                {f'<h4>未解决的配置漂移 ({len(tr.unresolved_diffs)})</h4><table class="diff-table"><thead><tr><th></th><th>配置键</th><th>类型</th><th>默认值</th><th>租户值</th><th>来源文件</th></tr></thead><tbody>{diffs_html}</tbody></table>' if tr.unresolved_diffs else '<p class="no-issues">✓ 配置完全一致</p>'}
                {f'<h4>允许的漂移 ({len(tr.allowances)})</h4><table class="allowance-table"><thead><tr><th>配置键</th><th>批准人</th><th>批准日期</th><th>到期日期</th><th>原因</th><th>状态</th></tr></thead><tbody>{allowances_html}</tbody></table>' if tr.allowances else ''}
            </div>
        """

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多租户配置漂移风险报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #1a202c; border-bottom: 2px solid #4299e1; padding-bottom: 10px; }}
        .summary {{ display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }}
        .summary-card {{ flex: 1; min-width: 120px; background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .summary-card .num {{ font-size: 2em; font-weight: bold; }}
        .summary-card.critical .num {{ color: #e53e3e; }}
        .summary-card.warning .num {{ color: #d69e2e; }}
        .summary-card.ok .num {{ color: #38a169; }}
        .summary-card.total .num {{ color: #4299e1; }}
        .critical-section {{ background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 20px; margin: 20px 0; }}
        .critical-section h2 {{ color: #c53030; margin-top: 0; }}
        .critical-item {{ padding: 8px 0; border-bottom: 1px solid #fed7d7; }}
        .tenant-card {{ background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #cbd5e0; }}
        .tenant-critical {{ border-left-color: #fc8181; }}
        .tenant-warning {{ border-left-color: #f6ad55; }}
        .tenant-ok {{ border-left-color: #68d391; }}
        .tenant-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }}
        .tenant-header h3 {{ margin: 0; color: #2d3748; }}
        .tier {{ color: #718096; font-weight: normal; font-size: 0.8em; }}
        .status-badge {{ padding: 6px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }}
        .status-critical {{ background: #fff5f5; color: #c53030; }}
        .status-warning {{ background: #fffaf0; color: #c05621; }}
        .status-ok {{ background: #f0fff4; color: #276749; }}
        table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #f7fafc; font-weight: 600; color: #4a5568; }}
        tr:hover {{ background: #fafafc; }}
        .risk-high td {{ background: #fff5f5; }}
        .risk-medium td {{ background: #fffaf0; }}
        .risk-low td {{ background: #f7fafc; }}
        .allowance-expired {{ background: #fff5f5; }}
        .allowance-active {{ background: #f7fafc; }}
        code {{ background: #f1f5f8; padding: 2px 6px; border-radius: 4px; font-family: 'SFMono-Regular', monospace; font-size: 0.9em; }}
        .tag-sensitive {{ background: #fed7d7; color: #c53030; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; margin-left: 8px; }}
        .errors-section {{ background: #fffaf0; border: 1px solid #fbd38d; border-radius: 6px; padding: 15px; margin: 15px 0; }}
        .error-item {{ padding: 4px 0; color: #c05621; }}
        .no-issues {{ color: #38a169; font-style: italic; }}
        .footer {{ text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🚨 多租户配置漂移风险报告</h1>
        <p class="footer">生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}</p>

        <div class="summary">
            <div class="summary-card total"><div class="num">{report.total_tenants}</div><div>总租户</div></div>
            <div class="summary-card critical"><div class="num">{report.tenants_with_critical_issues}</div><div>需要立即处理</div></div>
            <div class="summary-card warning"><div class="num">{report.tenants_with_warnings}</div><div>有警告</div></div>
            <div class="summary-card ok"><div class="num">{report.tenants_ok}</div><div>无问题</div></div>
        </div>

        {f'''
        <div class="critical-section">
            <h2>🔥 发布前必须处理的严重问题 ({len(report.all_critical_issues)})</h2>
            <ul>{critical_html}</ul>
        </div>
        ''' if report.all_critical_issues else ''}

        <h2>📋 各租户详细情况</h2>
        {tenants_html}

        <div class="footer">
            <p>此报告由多租户配置漂移检测工具自动生成</p>
            <p>⚠️ 发布前请确保所有红色标记的问题已解决</p>
        </div>
    </div>
</body>
</html>
"""


def _escape_html(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#039;")
    )
