import json
import os
from datetime import date
from typing import Dict, Any, List

from .models import (
    ValidationResult, Applicant, Issue, RiskLevel, IssueType,
    MaterialFile
)
from .utils import format_date


RISK_COLORS = {
    RiskLevel.CRITICAL: '#dc2626',
    RiskLevel.HIGH: '#ea580c',
    RiskLevel.MEDIUM: '#ca8a04',
    RiskLevel.LOW: '#2563eb',
    RiskLevel.OK: '#16a34a',
}

RISK_LABELS = {
    RiskLevel.CRITICAL: '严重',
    RiskLevel.HIGH: '高',
    RiskLevel.MEDIUM: '中',
    RiskLevel.LOW: '低',
    RiskLevel.OK: '正常',
}

DOC_TYPE_NAMES = {
    'passport': '护照扫描件',
    'photo': '证件照',
    'employment_cert': '在职证明',
    'bank_statement': '银行流水',
    'flight_itinerary': '机票行程单',
    'hotel_booking': '酒店预订单',
    'insurance': '保险单',
    'itinerary': '行程表',
}

ISSUE_TYPE_NAMES = {
    IssueType.MISSING_DOCUMENT: '缺少材料',
    IssueType.INVALID_FILENAME: '文件名不规范',
    IssueType.PASSPORT_EXPIRED: '护照已过期',
    IssueType.PASSPORT_EXPIRY_INSUFFICIENT: '护照有效期不足',
    IssueType.PHOTO_SPEC_ISSUE: '照片规格问题',
    IssueType.INSURANCE_COVERAGE_GAP: '保险覆盖有空隙',
    IssueType.INSURANCE_EXPIRES_EARLY: '保险结束过早',
    IssueType.HOTEL_DAYS_MISMATCH: '酒店天数不匹配',
    IssueType.EMPLOYMENT_CERT_DATE_ISSUE: '在职证明日期问题',
    IssueType.ITINERARY_CONFLICT: '行程日期冲突',
    IssueType.DATE_FORMAT_ERROR: '日期格式错误',
    IssueType.APPLICANT_NOT_FOUND: '申请人不存在',
    IssueType.MATERIAL_DIR_EMPTY: '材料目录为空',
    IssueType.RULES_MISSING_FIELD: '规则文件缺字段',
    IssueType.UNKNOWN_DOCUMENT: '未知文件类型',
}


def issue_to_dict(issue: Issue) -> Dict[str, Any]:
    return {
        'issue_type': issue.issue_type.value,
        'issue_type_name': ISSUE_TYPE_NAMES.get(issue.issue_type, issue.issue_type.value),
        'severity': issue.severity.value,
        'severity_name': RISK_LABELS.get(issue.severity, issue.severity.value),
        'severity_color': RISK_COLORS.get(issue.severity, '#666'),
        'message': issue.message,
        'evidence': issue.evidence,
        'document_type': issue.document_type,
        'document_type_name': DOC_TYPE_NAMES.get(issue.document_type, issue.document_type) if issue.document_type else None,
        'file_path': issue.file_path,
    }


def applicant_to_dict(applicant: Applicant) -> Dict[str, Any]:
    return {
        'applicant_id': applicant.applicant_id,
        'name': applicant.name,
        'passport_number': applicant.passport_number,
        'passport_expiry_date': format_date(applicant.passport_expiry_date) if applicant.passport_expiry_date else None,
        'birth_date': format_date(applicant.birth_date) if applicant.birth_date else None,
        'nationality': applicant.nationality,
        'email': applicant.email,
        'phone': applicant.phone,
        'risk_level': applicant.risk_level.value,
        'risk_level_name': RISK_LABELS.get(applicant.risk_level, applicant.risk_level.value),
        'risk_color': RISK_COLORS.get(applicant.risk_level, '#666'),
        'issues_count': len(applicant.issues),
        'issues': [issue_to_dict(i) for i in applicant.issues],
        'missing_docs': applicant.missing_docs,
        'missing_docs_names': [DOC_TYPE_NAMES.get(d, d) for d in applicant.missing_docs],
        'materials': [{
            'original_path': m.original_path,
            'filename': m.filename,
            'extension': m.extension,
            'file_size': m.file_size,
            'document_type': m.document_type,
            'document_type_name': DOC_TYPE_NAMES.get(m.document_type, m.document_type) if m.document_type else None,
            'normalized_filename': m.normalized_filename,
        } for m in applicant.materials],
    }


def result_to_dict(result: ValidationResult, today: date) -> Dict[str, Any]:
    return {
        'generated_at': format_date(today),
        'total_applicants': len(result.applicants),
        'total_issues': result.total_issues,
        'has_critical_issues': result.has_critical_issues,
        'summary': {
            'by_risk': {
                'critical': sum(1 for a in result.applicants if a.risk_level == RiskLevel.CRITICAL),
                'high': sum(1 for a in result.applicants if a.risk_level == RiskLevel.HIGH),
                'medium': sum(1 for a in result.applicants if a.risk_level == RiskLevel.MEDIUM),
                'low': sum(1 for a in result.applicants if a.risk_level == RiskLevel.LOW),
                'ok': sum(1 for a in result.applicants if a.risk_level == RiskLevel.OK),
            },
        },
        'global_issues': [issue_to_dict(i) for i in result.global_issues],
        'unmatched_materials': [{
            'original_path': m.original_path,
            'filename': m.filename,
            'extension': m.extension,
            'file_size': m.file_size,
        } for m in result.unmatched_materials],
        'applicants': [applicant_to_dict(a) for a in result.applicants],
        'rules': {
            'passport_min_validity_months': result.rules.passport_min_validity_months,
            'employment_cert_max_age_days': result.rules.employment_cert_max_age_days,
            'insurance_buffer_days': result.rules.insurance_buffer_days,
            'required_documents': result.rules.required_documents,
            'required_documents_names': [DOC_TYPE_NAMES.get(d, d) for d in result.rules.required_documents],
            'photo_requirements': result.rules.photo_requirements,
        },
    }


def generate_json_report(result: ValidationResult, output_path: str, today: date) -> None:
    data = result_to_dict(result, today)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_markdown_report(result: ValidationResult, output_path: str, today: date) -> None:
    data = result_to_dict(result, today)
    
    lines = [
        f"# 签证材料核对报告",
        f"",
        f"**生成日期**: {data['generated_at']}",
        f"",
        f"## 概览",
        f"",
        f"- **申请人数**: {data['total_applicants']}",
        f"- **问题总数**: {data['total_issues']}",
        f"- **是否有严重问题**: {'是 ⚠️' if data['has_critical_issues'] else '否 ✅'}",
        f"",
        f"### 风险分布",
        f"",
        f"| 风险等级 | 人数 |",
        f"|----------|------|",
    ]
    
    risk_order = ['critical', 'high', 'medium', 'low', 'ok']
    for risk in risk_order:
        count = data['summary']['by_risk'].get(risk, 0)
        risk_name = {
            'critical': '严重 🔴',
            'high': '高 🟠',
            'medium': '中 🟡',
            'low': '低 🔵',
            'ok': '正常 🟢',
        }.get(risk, risk)
        lines.append(f"| {risk_name} | {count} |")
    
    lines.append("")
    
    if data['global_issues']:
        lines.append("## 全局问题")
        lines.append("")
        for issue in data['global_issues']:
            severity_icon = {
                'critical': '🔴',
                'high': '🟠',
                'medium': '🟡',
                'low': '🔵',
            }.get(issue['severity'], '⚪')
            lines.append(f"### {severity_icon} [{issue['severity_name']}] {issue['issue_type_name']}")
            lines.append("")
            lines.append(f"{issue['message']}")
            lines.append("")
            if issue['evidence']:
                lines.append(f"**证据**: {issue['evidence']}")
                lines.append("")
    
    if data['unmatched_materials']:
        lines.append("## 无法匹配的文件")
        lines.append("")
        lines.append("| 文件名 | 类型 | 大小(字节) |")
        lines.append("|--------|------|------------|")
        for m in data['unmatched_materials']:
            lines.append(f"| {m['filename']} | {m['extension']} | {m['file_size']} |")
        lines.append("")
    
    lines.append("## 申请人详情")
    lines.append("")
    
    for applicant in data['applicants']:
        risk_icon = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🔵',
            'ok': '🟢',
        }.get(applicant['risk_level'], '⚪')
        
        lines.append(f"---")
        lines.append("")
        lines.append(f"### {risk_icon} {applicant['name']} ({applicant['applicant_id']})")
        lines.append("")
        lines.append(f"- **风险等级**: {applicant['risk_level_name']}")
        lines.append(f"- **护照号**: {applicant['passport_number']}")
        lines.append(f"- **护照有效期**: {applicant['passport_expiry_date']}")
        lines.append(f"- **问题数量**: {applicant['issues_count']}")
        lines.append("")
        
        if applicant['missing_docs']:
            lines.append(f"#### ❌ 缺少的材料")
            lines.append("")
            for doc in applicant['missing_docs_names']:
                lines.append(f"- {doc}")
            lines.append("")
        
        if applicant['issues']:
            lines.append(f"#### ⚠️ 问题列表")
            lines.append("")
            for issue in applicant['issues']:
                severity_icon = {
                    'critical': '🔴',
                    'high': '🟠',
                    'medium': '🟡',
                    'low': '🔵',
                }.get(issue['severity'], '⚪')
                lines.append(f"**{severity_icon} {issue['severity_name']} - {issue['issue_type_name']}**")
                lines.append("")
                lines.append(f"> {issue['message']}")
                lines.append("")
                if issue['evidence']:
                    lines.append(f"> 证据: {issue['evidence']}")
                    lines.append("")
                if issue['file_path']:
                    lines.append(f"> 文件: {issue['file_path']}")
                    lines.append("")
        
        if applicant['materials']:
            lines.append(f"#### 📄 已提供的材料")
            lines.append("")
            lines.append("| 材料类型 | 文件名 | 规范化名称 |")
            lines.append("|----------|--------|------------|")
            for m in applicant['materials']:
                doc_type = m.get('document_type_name') or m.get('document_type') or '未知'
                normalized = m.get('normalized_filename') or '-'
                lines.append(f"| {doc_type} | {m['filename']} | {normalized} |")
            lines.append("")
    
    content = "\n".join(lines)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)


def generate_html_report(result: ValidationResult, output_path: str, today: date) -> None:
    data = result_to_dict(result, today)
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>签证材料核对报告 - {data['generated_at']}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background: #f3f4f6;
        }}
        .container {{ background: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        h1 {{ color: #111827; font-size: 1.8em; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }}
        h2 {{ color: #374151; font-size: 1.4em; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }}
        h3 {{ color: #4b5563; font-size: 1.2em; margin: 20px 0 10px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-card {{ background: #f9fafb; border-radius: 8px; padding: 15px; text-align: center; }}
        .summary-card .value {{ font-size: 2em; font-weight: bold; }}
        .summary-card .label {{ font-size: 0.9em; color: #6b7280; }}
        .risk-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }}
        .risk-critical {{ background: #fef2f2; color: #dc2626; }}
        .risk-high {{ background: #fff7ed; color: #ea580c; }}
        .risk-medium {{ background: #fefce8; color: #ca8a04; }}
        .risk-low {{ background: #eff6ff; color: #2563eb; }}
        .risk-ok {{ background: #f0fdf4; color: #16a34a; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }}
        th {{ background: #f9fafb; font-weight: 600; }}
        tr:hover {{ background: #f9fafb; }}
        .issue-card {{ margin: 15px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #e5e7eb; }}
        .issue-critical {{ border-left-color: #dc2626; background: #fef2f2; }}
        .issue-high {{ border-left-color: #ea580c; background: #fff7ed; }}
        .issue-medium {{ border-left-color: #ca8a04; background: #fefce8; }}
        .issue-low {{ border-left-color: #2563eb; background: #eff6ff; }}
        .issue-title {{ font-weight: 600; margin-bottom: 8px; }}
        .issue-evidence {{ font-size: 0.9em; color: #6b7280; font-style: italic; }}
        .applicant-section {{ margin: 30px 0; padding: 20px; background: #fafafa; border-radius: 8px; }}
        .applicant-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }}
        .applicant-name {{ font-size: 1.3em; font-weight: 600; }}
        .divider {{ height: 1px; background: #e5e7eb; margin: 20px 0; }}
        .meta-info {{ color: #6b7280; font-size: 0.9em; margin-bottom: 20px; }}
        .file-list {{ font-family: monospace; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 签证材料核对报告</h1>
        <div class="meta-info">生成日期: {data['generated_at']}</div>
        
        <h2>📊 概览</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <div class="value">{data['total_applicants']}</div>
                <div class="label">申请人数</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: {'#dc2626' if data['has_critical_issues'] else '#16a34a'}">{data['total_issues']}</div>
                <div class="label">问题总数</div>
            </div>
            <div class="summary-card">
                <div class="value">{'⚠️' if data['has_critical_issues'] else '✅'}</div>
                <div class="label">{'有严重问题' if data['has_critical_issues'] else '无严重问题'}</div>
            </div>
        </div>
        
        <h3>风险分布</h3>
        <table>
            <tr><th>风险等级</th><th>人数</th></tr>
"""
    
    risk_order = [('critical', '严重 🔴', 'risk-critical'), ('high', '高 🟠', 'risk-high'), ('medium', '中 🟡', 'risk-medium'), ('low', '低 🔵', 'risk-low'), ('ok', '正常 🟢', 'risk-ok')]
    for risk, name, css_class in risk_order:
        count = data['summary']['by_risk'].get(risk, 0)
        html += f"            <tr><td><span class=\"risk-badge {css_class}\">{name}</span></td><td>{count}</td></tr>\n"
    
    html += "        </table>\n"
    
    if data['global_issues']:
        html += """
        <h2>⚠️ 全局问题</h2>
"""
        for issue in data['global_issues']:
            css_class = f"issue-{issue['severity']}"
            html += f"""
        <div class="issue-card {css_class}">
            <div class="issue-title">
                <span class="risk-badge risk-{issue['severity']}">{issue['severity_name']}</span>
                {issue['issue_type_name']}
            </div>
            <div>{issue['message']}</div>
"""
            if issue['evidence']:
                html += f"            <div class=\"issue-evidence\">证据: {issue['evidence']}</div>\n"
            html += "        </div>\n"
    
    if data['unmatched_materials']:
        html += """
        <h2>❓ 无法匹配的文件</h2>
        <table>
            <tr><th>文件名</th><th>类型</th><th>大小(字节)</th></tr>
"""
        for m in data['unmatched_materials']:
            html += f"            <tr><td class=\"file-list\">{m['filename']}</td><td>{m['extension']}</td><td>{m['file_size']}</td></tr>\n"
        html += "        </table>\n"
    
    html += """
        <h2>👥 申请人详情</h2>
"""
    
    for applicant in data['applicants']:
        css_class = f"risk-{applicant['risk_level']}"
        risk_icon = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🔵',
            'ok': '🟢',
        }.get(applicant['risk_level'], '⚪')
        
        html += f"""
        <div class="applicant-section">
            <div class="applicant-header">
                <div class="applicant-name">{risk_icon} {applicant['name']} <span style="color: #6b7280; font-size: 0.8em;">({applicant['applicant_id']})</span></div>
                <span class="risk-badge {css_class}">{applicant['risk_level_name']}</span>
            </div>
            <table>
                <tr><th>护照号</th><td>{applicant['passport_number']}</td></tr>
                <tr><th>护照有效期</th><td>{applicant['passport_expiry_date']}</td></tr>
                <tr><th>问题数量</th><td>{applicant['issues_count']}</td></tr>
            </table>
"""
        
        if applicant['missing_docs']:
            html += f"""
            <h3>❌ 缺少的材料</h3>
            <ul style="margin-left: 20px;">
"""
            for doc in applicant['missing_docs_names']:
                html += f"                <li>{doc}</li>\n"
            html += "            </ul>\n"
        
        if applicant['issues']:
            html += "            <h3>⚠️ 问题列表</h3>\n"
            for issue in applicant['issues']:
                css_class = f"issue-{issue['severity']}"
                html += f"""
            <div class="issue-card {css_class}">
                <div class="issue-title">
                    <span class="risk-badge risk-{issue['severity']}">{issue['severity_name']}</span>
                    {issue['issue_type_name']}
                </div>
                <div>{issue['message']}</div>
"""
                if issue['evidence']:
                    html += f"                <div class=\"issue-evidence\">证据: {issue['evidence']}</div>\n"
                if issue['file_path']:
                    html += f"                <div class=\"issue-evidence\">文件: {issue['file_path']}</div>\n"
                html += "            </div>\n"
        
        if applicant['materials']:
            html += """
            <h3>📄 已提供的材料</h3>
            <table>
                <tr><th>材料类型</th><th>文件名</th><th>规范化名称</th></tr>
"""
            for m in applicant['materials']:
                doc_type = m.get('document_type_name') or m.get('document_type') or '未知'
                normalized = m.get('normalized_filename') or '-'
                html += f"                <tr><td>{doc_type}</td><td class=\"file-list\">{m['filename']}</td><td class=\"file-list\">{normalized}</td></tr>\n"
            html += "            </table>\n"
        
        html += "        </div>\n"
    
    html += """
    </div>
</body>
</html>
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)


def generate_report(result: ValidationResult, output_dir: str, formats: List[str], today: date) -> Dict[str, str]:
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    generated = {}
    base_name = f"report_{today.strftime('%Y%m%d')}"
    
    if 'json' in formats:
        path = os.path.join(output_dir, f"{base_name}.json")
        generate_json_report(result, path, today)
        generated['json'] = path
    
    if 'md' in formats or 'markdown' in formats:
        path = os.path.join(output_dir, f"{base_name}.md")
        generate_markdown_report(result, path, today)
        generated['markdown'] = path
    
    if 'html' in formats:
        path = os.path.join(output_dir, f"{base_name}.html")
        generate_html_report(result, path, today)
        generated['html'] = path
    
    return generated
