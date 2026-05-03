"""
Report generators for Passkey/FIDO2 compatibility checker
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from .models import (
    CompatibilityReport,
    Issue,
    IssueSeverity,
    IssueCategory,
    COSE_ALGORITHMS,
)


class ReportGenerator:
    """Generate various output reports"""
    
    SEVERITY_COLORS = {
        IssueSeverity.CRITICAL: '#dc2626',
        IssueSeverity.HIGH: '#ea580c',
        IssueSeverity.MEDIUM: '#ca8a04',
        IssueSeverity.LOW: '#2563eb',
        IssueSeverity.INFO: '#6b7280',
    }
    
    CATEGORY_ICONS = {
        IssueCategory.RP_ID: '🏷️',
        IssueCategory.RESIDENT_KEY: '🔑',
        IssueCategory.UV_UP: '👤',
        IssueCategory.ALGORITHM: '🔐',
        IssueCategory.COUNTER: '🔢',
        IssueCategory.SYNC_RISK: '🔄',
        IssueCategory.UNKNOWN_ALGORITHM: '❓',
    }
    
    def __init__(self, report: CompatibilityReport):
        self.report = report
    
    def generate_issues_csv(self, output_path: str):
        """Generate issues CSV file"""
        fieldnames = [
            'issue_id',
            'category',
            'severity',
            'title',
            'description',
            'affected_credential_ids',
            'affected_user_ids',
            'affected_devices',
            'additional_info',
            'timestamp',
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for issue in self.report.issues:
                row = {
                    'issue_id': issue.issue_id,
                    'category': issue.category.value,
                    'severity': issue.severity.value,
                    'title': issue.title,
                    'description': issue.description,
                    'affected_credential_ids': ';'.join(issue.affected_credential_ids),
                    'affected_user_ids': ';'.join(issue.affected_user_ids),
                    'affected_devices': ';'.join(issue.affected_devices),
                    'additional_info': json.dumps(issue.additional_info, default=str),
                    'timestamp': issue.timestamp.isoformat() if issue.timestamp else '',
                }
                writer.writerow(row)
    
    def generate_compat_report_md(self, output_path: str):
        """Generate markdown compatibility report"""
        lines = []
        
        lines.append('# Passkey/FIDO2 Compatibility Report')
        lines.append('')
        lines.append(f'**Generated at:** {self.report.generated_at.strftime("%Y-%m-%d %H:%M:%S UTC") if self.report.generated_at else "N/A"}')
        lines.append('')
        
        lines.append('## Executive Summary')
        lines.append('')
        lines.append(f'- **Total Users Analyzed:** {self.report.total_users}')
        lines.append(f'- **Total Credentials:** {self.report.total_credentials}')
        lines.append(f'- **Total Log Entries:** {self.report.total_log_entries}')
        lines.append(f'- **Total Issues Found:** {len(self.report.issues)}')
        lines.append('')
        
        lines.append('### Issue Severity Distribution')
        lines.append('')
        severity_dist = self.report.summary.get('severity_distribution', {})
        for severity in ['critical', 'high', 'medium', 'low', 'info']:
            count = severity_dist.get(severity, 0)
            lines.append(f'- **{severity.upper()}**: {count} issue(s)')
        lines.append('')
        
        lines.append('### Algorithm Usage')
        lines.append('')
        lines.append('| Algorithm ID | Algorithm Name | Usage Count |')
        lines.append('|--------------|----------------|-------------|')
        for alg_id, count in sorted(self.report.algorithm_usage.items()):
            alg_name = COSE_ALGORITHMS.get(alg_id, f'Unknown ({alg_id})')
            lines.append(f'| {alg_id} | {alg_name} | {count} |')
        lines.append('')
        
        lines.append('### Browser Compatibility')
        lines.append('')
        for browser, info in self.report.browser_compatibility.items():
            lines.append(f'#### {browser}')
            lines.append('')
            lines.append(f'- **Usage Count:** {info.get("usage_count", 0)}')
            lines.append(f'- **Unique Credentials:** {info.get("unique_credentials", 0)}')
            lines.append(f'- **FIDO2 Supported:** {self._format_bool(info.get("supported"))}')
            lines.append(f'- **Resident Key Supported:** {self._format_bool(info.get("resident_key_supported"))}')
            lines.append(f'- **User Verification Supported:** {self._format_bool(info.get("uv_supported"))}')
            lines.append('')
        
        lines.append('## Issues Detail')
        lines.append('')
        
        if not self.report.issues:
            lines.append('No issues found. All checks passed!')
        else:
            sorted_issues = sorted(
                self.report.issues,
                key=lambda x: [
                    IssueSeverity.CRITICAL,
                    IssueSeverity.HIGH,
                    IssueSeverity.MEDIUM,
                    IssueSeverity.LOW,
                    IssueSeverity.INFO,
                ].index(x.severity)
            )
            
            for issue in sorted_issues:
                icon = self.CATEGORY_ICONS.get(issue.category, '⚠️')
                lines.append(f'### {icon} {issue.issue_id} - {issue.title}')
                lines.append('')
                lines.append(f'**Severity:** {issue.severity.value.upper()}')
                lines.append(f'**Category:** {issue.category.value}')
                lines.append('')
                lines.append(f'**Description:**')
                lines.append('')
                lines.append(f'> {issue.description}')
                lines.append('')
                
                if issue.affected_credential_ids:
                    lines.append(f'**Affected Credentials ({len(issue.affected_credential_ids)}):**')
                    lines.append('')
                    for cred_id in issue.affected_credential_ids[:5]:
                        lines.append(f'- `{cred_id}`')
                    if len(issue.affected_credential_ids) > 5:
                        lines.append(f'- ... and {len(issue.affected_credential_ids) - 5} more')
                    lines.append('')
                
                if issue.affected_user_ids:
                    lines.append(f'**Affected Users ({len(issue.affected_user_ids)}):**')
                    lines.append('')
                    for user_id in issue.affected_user_ids[:5]:
                        lines.append(f'- `{user_id}`')
                    if len(issue.affected_user_ids) > 5:
                        lines.append(f'- ... and {len(issue.affected_user_ids) - 5} more')
                    lines.append('')
                
                if issue.additional_info:
                    lines.append('**Additional Information:**')
                    lines.append('')
                    lines.append('```json')
                    lines.append(json.dumps(issue.additional_info, indent=2, default=str))
                    lines.append('```')
                    lines.append('')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    
    def generate_diff_html(self, output_path: str):
        """Generate interactive HTML diff report"""
        html_content = self._build_html_report()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def _build_html_report(self) -> str:
        """Build the HTML report content"""
        issues_json = json.dumps([
            {
                'issue_id': issue.issue_id,
                'category': issue.category.value,
                'severity': issue.severity.value,
                'title': issue.title,
                'description': issue.description,
                'affected_credential_ids': issue.affected_credential_ids,
                'affected_user_ids': issue.affected_user_ids,
                'affected_devices': issue.affected_devices,
                'additional_info': issue.additional_info,
                'timestamp': issue.timestamp.isoformat() if issue.timestamp else None,
            }
            for issue in self.report.issues
        ], default=str)
        
        summary_json = json.dumps({
            'total_users': self.report.total_users,
            'total_credentials': self.report.total_credentials,
            'total_log_entries': self.report.total_log_entries,
            'total_issues': len(self.report.issues),
            'severity_distribution': self.report.summary.get('severity_distribution', {}),
            'category_distribution': self.report.summary.get('category_distribution', {}),
            'algorithm_usage': self.report.algorithm_usage,
            'browser_compatibility': self.report.browser_compatibility,
            'generated_at': self.report.generated_at.isoformat() if self.report.generated_at else None,
        }, default=str)
        
        return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Passkey/FIDO2 Compatibility Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }}
        
        header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 1rem;
            margin-bottom: 2rem;
        }}
        
        header h1 {{
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }}
        
        header .subtitle {{
            opacity: 0.9;
            font-size: 1rem;
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }}
        
        .summary-card {{
            background: white;
            padding: 1.5rem;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }}
        
        .summary-card .value {{
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
        }}
        
        .summary-card .label {{
            color: #64748b;
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }}
        
        .severity-badge {{
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }}
        
        .severity-critical {{ background: #fee2e2; color: #991b1b; }}
        .severity-high {{ background: #ffedd5; color: #9a3412; }}
        .severity-medium {{ background: #fef9c3; color: #854d0e; }}
        .severity-low {{ background: #dbeafe; color: #1e40af; }}
        .severity-info {{ background: #f1f5f9; color: #475569; }}
        
        .filters {{
            background: white;
            padding: 1rem;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 1.5rem;
        }}
        
        .filters label {{
            margin-right: 1rem;
            font-weight: 500;
        }}
        
        .filters select {{
            padding: 0.5rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.375rem;
            font-size: 0.9rem;
        }}
        
        .issues-list {{
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }}
        
        .issue-card {{
            background: white;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        
        .issue-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }}
        
        .issue-header {{
            padding: 1rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
            border-bottom: 1px solid #f1f5f9;
        }}
        
        .issue-icon {{
            font-size: 1.5rem;
        }}
        
        .issue-title {{
            flex: 1;
            font-weight: 600;
        }}
        
        .issue-id {{
            font-family: monospace;
            color: #64748b;
            font-size: 0.9rem;
        }}
        
        .issue-body {{
            display: none;
            padding: 1.5rem;
            background: #f8fafc;
        }}
        
        .issue-body.expanded {{
            display: block;
        }}
        
        .issue-description {{
            margin-bottom: 1rem;
            padding: 1rem;
            background: white;
            border-radius: 0.5rem;
            border-left: 4px solid #667eea;
        }}
        
        .issue-meta {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }}
        
        .meta-item {{
            background: white;
            padding: 1rem;
            border-radius: 0.5rem;
        }}
        
        .meta-item h4 {{
            font-size: 0.875rem;
            color: #64748b;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        
        .meta-item ul {{
            list-style: none;
            font-family: monospace;
            font-size: 0.875rem;
        }}
        
        .meta-item li {{
            padding: 0.25rem 0;
            color: #475569;
        }}
        
        .additional-info {{
            background: #1e293b;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: monospace;
            font-size: 0.875rem;
            overflow-x: auto;
            white-space: pre-wrap;
        }}
        
        .tabs {{
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 2px solid #e2e8f0;
        }}
        
        .tab {{
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            font-weight: 500;
            color: #64748b;
            transition: all 0.2s;
        }}
        
        .tab:hover {{
            color: #667eea;
        }}
        
        .tab.active {{
            color: #667eea;
            border-bottom-color: #667eea;
        }}
        
        .tab-content {{
            display: none;
        }}
        
        .tab-content.active {{
            display: block;
        }}
        
        .chart-container {{
            background: white;
            padding: 1.5rem;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 1.5rem;
        }}
        
        .chart-container h3 {{
            margin-bottom: 1rem;
            color: #475569;
        }}
        
        .bar-chart {{
            display: flex;
            gap: 0.5rem;
            align-items: flex-end;
            height: 200px;
            padding: 1rem 0;
        }}
        
        .bar {{
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
        }}
        
        .bar-fill {{
            width: 100%;
            border-radius: 0.25rem 0.25rem 0 0;
            transition: background 0.2s;
        }}
        
        .bar-label {{
            font-size: 0.75rem;
            color: #64748b;
            text-align: center;
        }}
        
        .bar-value {{
            font-size: 0.875rem;
            font-weight: 600;
            color: #475569;
        }}
        
        .no-issues {{
            text-align: center;
            padding: 4rem 2rem;
            background: white;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        
        .no-issues .icon {{
            font-size: 4rem;
            margin-bottom: 1rem;
        }}
        
        .no-issues h2 {{
            color: #059669;
            margin-bottom: 0.5rem;
        }}
        
        .no-issues p {{
            color: #64748b;
        }}
        
        @media (max-width: 768px) {{
            .container {{
                padding: 1rem;
            }}
            
            .summary-grid {{
                grid-template-columns: repeat(2, 1fr);
            }}
            
            .issue-meta {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔐 Passkey/FIDO2 Compatibility Report</h1>
            <div class="subtitle">Generated at <span id="generated-at"></span></div>
        </header>
        
        <div class="tabs">
            <div class="tab active" data-tab="overview">Overview</div>
            <div class="tab" data-tab="issues">Issues</div>
            <div class="tab" data-tab="algorithms">Algorithms</div>
            <div class="tab" data-tab="browsers">Browsers</div>
        </div>
        
        <div id="overview" class="tab-content active">
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="value" id="stat-users">0</div>
                    <div class="label">Users</div>
                </div>
                <div class="summary-card">
                    <div class="value" id="stat-credentials">0</div>
                    <div class="label">Credentials</div>
                </div>
                <div class="summary-card">
                    <div class="value" id="stat-logs">0</div>
                    <div class="label">Log Entries</div>
                </div>
                <div class="summary-card">
                    <div class="value" id="stat-issues">0</div>
                    <div class="label">Issues</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3>Issue Severity Distribution</h3>
                <div class="bar-chart" id="severity-chart"></div>
            </div>
            
            <div class="chart-container">
                <h3>Issue Category Distribution</h3>
                <div class="bar-chart" id="category-chart"></div>
            </div>
        </div>
        
        <div id="issues" class="tab-content">
            <div class="filters">
                <label>Filter by Severity:</label>
                <select id="severity-filter">
                    <option value="all">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                </select>
            </div>
            
            <div class="issues-list" id="issues-list"></div>
        </div>
        
        <div id="algorithms" class="tab-content">
            <div class="chart-container">
                <h3>Algorithm Usage</h3>
                <div class="bar-chart" id="algorithm-chart"></div>
            </div>
        </div>
        
        <div id="browsers" class="tab-content">
            <div id="browser-list"></div>
        </div>
    </div>
    
    <script>
        const reportData = {summary_json};
        const issuesData = {issues_json};
        
        const categoryIcons = {{
            'rp_id': '🏷️',
            'resident_key': '🔑',
            'uv_up': '👤',
            'algorithm': '🔐',
            'counter': '🔢',
            'sync_risk': '🔄',
            'unknown_algorithm': '❓'
        }};
        
        const severityColors = {{
            'critical': '#dc2626',
            'high': '#ea580c',
            'medium': '#ca8a04',
            'low': '#2563eb',
            'info': '#6b7280'
        }};
        
        const algorithmNames = {{
            '-7': 'ES256',
            '-8': 'EdDSA',
            '-35': 'ES384',
            '-36': 'ES512',
            '-37': 'PS256',
            '-38': 'PS384',
            '-39': 'PS512',
            '-257': 'RS256',
            '-258': 'RS384',
            '-259': 'RS512',
            '-65535': 'RS1'
        }};
        
        document.addEventListener('DOMContentLoaded', function() {{
            initOverview();
            initIssues();
            initAlgorithms();
            initBrowsers();
            initTabs();
        }});
        
        function initOverview() {{
            document.getElementById('generated-at').textContent = new Date(reportData.generated_at).toLocaleString();
            document.getElementById('stat-users').textContent = reportData.total_users;
            document.getElementById('stat-credentials').textContent = reportData.total_credentials;
            document.getElementById('stat-logs').textContent = reportData.total_log_entries;
            document.getElementById('stat-issues').textContent = reportData.total_issues;
            
            renderBarChart(
                'severity-chart',
                reportData.severity_distribution,
                ['critical', 'high', 'medium', 'low', 'info'],
                severityColors
            );
            
            renderBarChart(
                'category-chart',
                reportData.category_distribution,
                Object.keys(reportData.category_distribution),
                {{}}
            );
        }}
        
        function renderBarChart(containerId, data, order, colors) {{
            const container = document.getElementById(containerId);
            const maxValue = Math.max(...Object.values(data), 1);
            
            container.innerHTML = '';
            
            order.forEach(key => {{
                const value = data[key] || 0;
                const percentage = (value / maxValue) * 100;
                const color = colors[key] || '#667eea';
                
                const bar = document.createElement('div');
                bar.className = 'bar';
                bar.innerHTML = `
                    <span class="bar-value">${{value}}</span>
                    <div class="bar-fill" style="height: ${{percentage}}%; background: ${{color}};"></div>
                    <span class="bar-label">${{key}}</span>
                `;
                container.appendChild(bar);
            }});
        }}
        
        function initIssues() {{
            const filter = document.getElementById('severity-filter');
            const list = document.getElementById('issues-list');
            
            function renderIssues(severity = 'all') {{
                const filtered = severity === 'all' 
                    ? issuesData 
                    : issuesData.filter(i => i.severity === severity);
                
                if (filtered.length === 0) {{
                    list.innerHTML = `
                        <div class="no-issues">
                            <div class="icon">✅</div>
                            <h2>No Issues Found</h2>
                            <p>All compatibility checks passed for this filter.</p>
                        </div>
                    `;
                    return;
                }}
                
                const severityOrder = {{ critical: 0, high: 1, medium: 2, low: 3, info: 4 }};
                filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
                
                list.innerHTML = filtered.map(issue => `
                    <div class="issue-card" data-severity="${{issue.severity}}">
                        <div class="issue-header" onclick="toggleIssue(this)">
                            <span class="issue-icon">${{categoryIcons[issue.category] || '⚠️'}}</span>
                            <div class="issue-title">${{issue.title}}</div>
                            <span class="severity-badge severity-${{issue.severity}}">${{issue.severity}}</span>
                            <span class="issue-id">${{issue.issue_id}}</span>
                        </div>
                        <div class="issue-body">
                            <div class="issue-description">${{issue.description}}</div>
                            <div class="issue-meta">
                                ${{issue.affected_credential_ids.length > 0 ? `
                                    <div class="meta-item">
                                        <h4>Affected Credentials (${{issue.affected_credential_ids.length}})</h4>
                                        <ul>
                                            ${{issue.affected_credential_ids.slice(0, 10).map(id => `<li>• ${{id}}</li>`).join('')}}
                                            ${{issue.affected_credential_ids.length > 10 ? `<li>... and ${{issue.affected_credential_ids.length - 10}} more</li>` : ''}}
                                        </ul>
                                    </div>
                                ` : ''}}
                                ${{issue.affected_user_ids.length > 0 ? `
                                    <div class="meta-item">
                                        <h4>Affected Users (${{issue.affected_user_ids.length}})</h4>
                                        <ul>
                                            ${{issue.affected_user_ids.slice(0, 10).map(id => `<li>• ${{id}}</li>`).join('')}}
                                            ${{issue.affected_user_ids.length > 10 ? `<li>... and ${{issue.affected_user_ids.length - 10}} more</li>` : ''}}
                                        </ul>
                                    </div>
                                ` : ''}}
                                ${{issue.affected_devices.length > 0 ? `
                                    <div class="meta-item">
                                        <h4>Affected Devices (${{issue.affected_devices.length}})</h4>
                                        <ul>
                                            ${{issue.affected_devices.slice(0, 10).map(id => `<li>• ${{id}}</li>`).join('')}}
                                            ${{issue.affected_devices.length > 10 ? `<li>... and ${{issue.affected_devices.length - 10}} more</li>` : ''}}
                                        </ul>
                                    </div>
                                ` : ''}}
                            </div>
                            ${{Object.keys(issue.additional_info).length > 0 ? `
                                <h4 style="margin-bottom: 0.5rem; color: #64748b;">Additional Info</h4>
                                <pre class="additional-info">${{JSON.stringify(issue.additional_info, null, 2)}}</pre>
                            ` : ''}}
                        </div>
                    </div>
                `).join('');
            }}
            
            renderIssues();
            
            filter.addEventListener('change', () => renderIssues(filter.value));
        }}
        
        function toggleIssue(header) {{
            const body = header.nextElementSibling;
            body.classList.toggle('expanded');
        }}
        
        function initAlgorithms() {{
            const algorithms = reportData.algorithm_usage;
            const container = document.getElementById('algorithm-chart');
            
            if (Object.keys(algorithms).length === 0) {{
                container.innerHTML = '<p>No algorithm data available.</p>';
                return;
            }}
            
            const maxValue = Math.max(...Object.values(algorithms), 1);
            const sortedAlgIds = Object.keys(algorithms).sort((a, b) => algorithms[b] - algorithms[a]);
            
            container.innerHTML = '';
            
            sortedAlgIds.forEach(algId => {{
                const value = algorithms[algId];
                const percentage = (value / maxValue) * 100;
                const algName = algorithmNames[algId] || `Unknown (${{algId}})`;
                
                const bar = document.createElement('div');
                bar.className = 'bar';
                bar.innerHTML = `
                    <span class="bar-value">${{value}}</span>
                    <div class="bar-fill" style="height: ${{percentage}}%; background: #667eea;"></div>
                    <span class="bar-label">${{algName}}</span>
                `;
                container.appendChild(bar);
            }});
        }}
        
        function initBrowsers() {{
            const browsers = reportData.browser_compatibility;
            const container = document.getElementById('browser-list');
            
            if (Object.keys(browsers).length === 0) {{
                container.innerHTML = '<div class="no-issues"><p>No browser data available.</p></div>';
                return;
            }}
            
            container.innerHTML = Object.entries(browsers).map(([browser, info]) => `
                <div class="chart-container">
                    <h3>${{browser || 'Unknown'}}</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div class="meta-item">
                            <h4>Usage Count</h4>
                            <p style="font-size: 1.5rem; font-weight: bold; color: #667eea;">${{info.usage_count}}</p>
                        </div>
                        <div class="meta-item">
                            <h4>Unique Credentials</h4>
                            <p style="font-size: 1.5rem; font-weight: bold; color: #667eea;">${{info.unique_credentials}}</p>
                        </div>
                        <div class="meta-item">
                            <h4>FIDO2 Supported</h4>
                            <p style="font-size: 1.5rem; font-weight: bold; color: ${{info.supported ? '#059669' : info.supported === false ? '#dc2626' : '#64748b'}};">
                                ${{info.supported === null ? 'N/A' : (info.supported ? '✓ Yes' : '✗ No')}}
                            </p>
                        </div>
                        <div class="meta-item">
                            <h4>Resident Key</h4>
                            <p style="font-size: 1.5rem; font-weight: bold; color: ${{info.resident_key_supported ? '#059669' : info.resident_key_supported === false ? '#dc2626' : '#64748b'}};">
                                ${{info.resident_key_supported === null ? 'N/A' : (info.resident_key_supported ? '✓ Yes' : '✗ No')}}
                            </p>
                        </div>
                        <div class="meta-item">
                            <h4>User Verification</h4>
                            <p style="font-size: 1.5rem; font-weight: bold; color: ${{info.uv_supported ? '#059669' : info.uv_supported === false ? '#dc2626' : '#64748b'}};">
                                ${{info.uv_supported === null ? 'N/A' : (info.uv_supported ? '✓ Yes' : '✗ No')}}
                            </p>
                        </div>
                    </div>
                </div>
            `).join('');
        }}
        
        function initTabs() {{
            const tabs = document.querySelectorAll('.tab');
            const contents = document.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {{
                tab.addEventListener('click', () => {{
                    const targetId = tab.dataset.tab;
                    
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    contents.forEach(c => c.classList.remove('active'));
                    document.getElementById(targetId).classList.add('active');
                }});
            }});
        }}
    </script>
</body>
</html>'''
    
    def _format_bool(self, value: Any) -> str:
        """Format a boolean value for display"""
        if value is None:
            return 'N/A'
        return '✓ Yes' if value else '✗ No'
