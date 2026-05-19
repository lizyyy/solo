import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Any, Dict
from dataclasses import is_dataclass, asdict

from .models import (
    CertConfig, CertAnalysisResult, CertNode,
    RiskLevel, CertStatus
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (RiskLevel, CertStatus)):
            return obj.value
        if is_dataclass(obj):
            return asdict(obj)
        return super().default(obj)


class Reporter:
    def __init__(self, config: CertConfig):
        self.config = config
        self.color_map = {
            RiskLevel.CRITICAL: '\033[91m',
            RiskLevel.HIGH: '\033[93m',
            RiskLevel.MEDIUM: '\033[94m',
            RiskLevel.LOW: '\033[92m',
            RiskLevel.INFO: '\033[0m',
        }
        self.reset_color = '\033[0m'

    def print_result(self, result: CertAnalysisResult):
        self._print_header(result.cert_file)
        self._print_summary(result)
        self._print_chain_nodes(result)
        self._print_expiry_issues(result)
        self._print_algorithm_issues(result)
        self._print_chain_issues(result)
        self._print_recommendations(result)

    def _print_header(self, cert_file: str):
        print("\n" + "=" * 80)
        print(f"证书分析报告 - {Path(cert_file).name}")
        print(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)

    def _print_summary(self, result: CertAnalysisResult):
        status_color = self.color_map.get(result.overall_risk, self.reset_color)
        print(f"\n【总体状态】 {status_color}{result.overall_status}{self.reset_color}")
        print(f"【风险等级】 {status_color}{result.overall_risk.value}{self.reset_color}")
        print(f"\n【摘要】")
        print(f"  证书总数: {result.summary['total_certs']}")
        print(f"  根证书: {result.summary['root_ca_count']}")
        print(f"  中间证书: {result.summary['intermediate_ca_count']}")
        print(f"  叶子证书: {result.summary['leaf_cert_count']}")
        print(f"  算法问题: {result.summary['algorithm_issues_count']}")
        print(f"  过期问题: {result.summary['expiry_issues_count']}")
        print(f"  链问题: {result.summary['chain_issues_count']}")

    def _print_chain_nodes(self, result: CertAnalysisResult):
        if not result.chain_nodes:
            return
            
        print(f"\n【证书链节点】")
        for i, node in enumerate(result.chain_nodes, 1):
            node_type = []
            if node.is_root_ca:
                node_type.append("根CA")
            if node.is_intermediate_ca:
                node_type.append("中间CA")
            if node.is_leaf_cert:
                node_type.append("叶子证书")
            if node.is_self_signed:
                node_type.append("自签名")
            
            type_str = ", ".join(node_type) if node_type else "未知类型"
            
            print(f"\n  [{i}] {type_str}")
            print(f"      主题: {node.subject}")
            print(f"      颁发者: {node.issuer}")
            print(f"      序列号: {node.serial_number}")
            print(f"      生效时间: {node.not_before.strftime('%Y-%m-%d')}")
            print(f"      过期时间: {node.not_after.strftime('%Y-%m-%d')}")
            print(f"      剩余天数: {node.days_until_expiry} 天")
            print(f"      签名算法: {node.signature_algorithm}")
            print(f"      公钥算法: {node.public_key_algorithm} {node.public_key_size} bits")
            print(f"      指纹(SHA256): {node.fingerprint}")

    def _print_expiry_issues(self, result: CertAnalysisResult):
        if not result.expiry_issues:
            return
            
        print(f"\n【过期问题】")
        for i, issue in enumerate(result.expiry_issues, 1):
            color = self.color_map.get(issue.risk_level, self.reset_color)
            print(f"\n  {i}. {color}{issue.status.value}{self.reset_color}")
            print(f"      证书: {issue.cert_node.subject}")
            print(f"      剩余天数: {issue.days_remaining} 天")
            print(f"      过期日期: {issue.expiry_date.strftime('%Y-%m-%d')}")
            print(f"      建议: {issue.recommendation}")

    def _print_algorithm_issues(self, result: CertAnalysisResult):
        if not result.algorithm_issues:
            return
            
        print(f"\n【算法问题】")
        for i, issue in enumerate(result.algorithm_issues, 1):
            color = self.color_map.get(issue.risk_level, self.reset_color)
            print(f"\n  {i}. {color}{issue.issue_type}{self.reset_color}")
            print(f"      算法: {issue.algorithm}")
            if issue.key_size:
                print(f"      密钥长度: {issue.key_size} bits")
            print(f"      描述: {issue.description}")
            print(f"      建议: {issue.recommendation}")

    def _print_chain_issues(self, result: CertAnalysisResult):
        if not result.chain_issues:
            return
            
        print(f"\n【证书链问题】")
        for i, issue in enumerate(result.chain_issues, 1):
            color = self.color_map.get(issue.risk_level, self.reset_color)
            print(f"\n  {i}. {color}{issue.issue_type}{self.reset_color}")
            print(f"      描述: {issue.description}")
            if issue.affected_certs:
                print(f"      影响证书: {', '.join(issue.affected_certs)}")
            print(f"      建议: {issue.recommendation}")

    def _print_recommendations(self, result: CertAnalysisResult):
        all_issues = (
            result.expiry_issues +
            result.algorithm_issues +
            result.chain_issues
        )
        
        if not all_issues:
            print(f"\n【修复建议】")
            print("  证书状态健康，无需立即操作。")
            print("  建议定期检查证书过期情况。")
            return
            
        print(f"\n【修复建议汇总】")
        recommendations = set()
        for issue in all_issues:
            recommendations.add(issue.recommendation)
        
        for i, rec in enumerate(sorted(recommendations), 1):
            print(f"  {i}. {rec}")

    def export_report(self, result: CertAnalysisResult, output_dir: str):
        os.makedirs(output_dir, exist_ok=True)
        base_name = Path(result.cert_file).stem
        
        if self.config.output_json:
            json_path = os.path.join(output_dir, f"{base_name}_report.json")
            self._export_json(result, json_path)
            
        if self.config.output_html:
            html_path = os.path.join(output_dir, f"{base_name}_report.html")
            self._export_html_report(result, html_path)

    def export_batch_report(self, results: List[CertAnalysisResult], output_dir: str):
        os.makedirs(output_dir, exist_ok=True)
        
        if self.config.output_json:
            json_path = os.path.join(output_dir, "batch_report.json")
            self._export_batch_json(results, json_path)
            
        if self.config.output_html:
            html_path = os.path.join(output_dir, "batch_report.html")
            self._export_batch_html(results, html_path)

    def _export_json(self, result: CertAnalysisResult, output_path: str):
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)
        print(f"\nJSON报告已导出: {output_path}")

    def _export_batch_json(self, results: List[CertAnalysisResult], output_path: str):
        data = {
            "generated_at": datetime.now(),
            "total_certs": len(results),
            "results": results
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)
        print(f"\n批量JSON报告已导出: {output_path}")

    def export_html_report(self, result: CertAnalysisResult, output_dir: str):
        os.makedirs(output_dir, exist_ok=True)
        base_name = Path(result.cert_file).stem
        html_path = os.path.join(output_dir, f"{base_name}_report.html")
        self._export_html_report(result, html_path)

    def _export_html_report(self, result: CertAnalysisResult, output_path: str):
        html_content = self._generate_html_report(result)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"HTML报告已导出: {output_path}")

    def _generate_html_report(self, result: CertAnalysisResult) -> str:
        risk_colors = {
            RiskLevel.CRITICAL: '#dc3545',
            RiskLevel.HIGH: '#fd7e14',
            RiskLevel.MEDIUM: '#ffc107',
            RiskLevel.LOW: '#20c997',
            RiskLevel.INFO: '#17a2b8',
        }
        
        status_colors = {
            "HEALTHY": "#28a745",
            "AT_RISK": "#dc3545",
            "WARNING": "#ffc107",
            "INVALID": "#6c757d",
        }
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>证书分析报告 - {Path(result.cert_file).name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }}
        .status-badge {{ display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 1.1em; }}
        .card {{ background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .card h2 {{ margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-item {{ text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }}
        .summary-item .value {{ font-size: 2em; font-weight: bold; color: #667eea; }}
        .summary-item .label {{ color: #666; font-size: 0.9em; }}
        .cert-node {{ border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 10px 0; }}
        .cert-node h3 {{ margin: 0 0 10px 0; color: #495057; }}
        .node-props {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em; }}
        .prop-label {{ color: #6c757d; }}
        .issue {{ border-left: 4px solid; padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 0 8px 8px 0; }}
        .issue-critical {{ border-color: #dc3545; }}
        .issue-high {{ border-color: #fd7e14; }}
        .issue-medium {{ border-color: #ffc107; }}
        .issue-info {{ border-color: #17a2b8; }}
        .recommendations {{ background: #e8f4fd; padding: 20px; border-radius: 8px; }}
        .recommendations ol {{ margin: 10px 0 0 20px; }}
        .recommendations li {{ margin: 8px 0; }}
        .timestamp {{ text-align: right; color: #6c757d; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>证书分析报告</h1>
            <p>文件: {Path(result.cert_file).name}</p>
            <div class="status-badge" style="background-color: {status_colors.get(result.overall_status, '#6c757d')};">
                {result.overall_status}
            </div>
            <div style="margin-top: 10px;">
                风险等级: <span style="color: {risk_colors.get(result.overall_risk, '#6c757d')}; font-weight: bold;">{result.overall_risk.value}</span>
            </div>
        </div>

        <div class="card">
            <h2>📊 摘要统计</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">{result.summary['total_certs']}</div>
                    <div class="label">证书总数</div>
                </div>
                <div class="summary-item">
                    <div class="value">{result.summary['root_ca_count']}</div>
                    <div class="label">根证书</div>
                </div>
                <div class="summary-item">
                    <div class="value">{result.summary['intermediate_ca_count']}</div>
                    <div class="label">中间证书</div>
                </div>
                <div class="summary-item">
                    <div class="value">{result.summary['leaf_cert_count']}</div>
                    <div class="label">叶子证书</div>
                </div>
                <div class="summary-item">
                    <div class="value">{result.summary['algorithm_issues_count']}</div>
                    <div class="label">算法问题</div>
                </div>
                <div class="summary-item">
                    <div class="value">{result.summary['expiry_issues_count']}</div>
                    <div class="label">过期问题</div>
                </div>
            </div>
        </div>
"""

        if result.chain_nodes:
            html += """
        <div class="card">
            <h2>🔗 证书链节点</h2>
"""
            for i, node in enumerate(result.chain_nodes, 1):
                node_type = []
                if node.is_root_ca:
                    node_type.append("根CA")
                if node.is_intermediate_ca:
                    node_type.append("中间CA")
                if node.is_leaf_cert:
                    node_type.append("叶子证书")
                if node.is_self_signed:
                    node_type.append("自签名")
                type_str = ", ".join(node_type) if node_type else "未知类型"
                
                html += f"""
            <div class="cert-node">
                <h3>[{i}] {type_str}</h3>
                <div class="node-props">
                    <div><span class="prop-label">主题:</span> {node.subject}</div>
                    <div><span class="prop-label">颁发者:</span> {node.issuer}</div>
                    <div><span class="prop-label">序列号:</span> {node.serial_number}</div>
                    <div><span class="prop-label">生效时间:</span> {node.not_before.strftime('%Y-%m-%d')}</div>
                    <div><span class="prop-label">过期时间:</span> {node.not_after.strftime('%Y-%m-%d')}</div>
                    <div><span class="prop-label">剩余天数:</span> {node.days_until_expiry} 天</div>
                    <div><span class="prop-label">签名算法:</span> {node.signature_algorithm}</div>
                    <div><span class="prop-label">公钥:</span> {node.public_key_algorithm} {node.public_key_size} bits</div>
                </div>
                <div style="margin-top: 10px; font-size: 0.85em; color: #6c757d;">
                    <span class="prop-label">指纹(SHA256):</span> {node.fingerprint}
                </div>
            </div>
"""
            html += "</div>"

        if result.expiry_issues:
            html += """
        <div class="card">
            <h2>⏰ 过期问题</h2>
"""
            for issue in result.expiry_issues:
                risk_class = f"issue-{issue.risk_level.value.lower()}"
                html += f"""
            <div class="issue {risk_class}">
                <strong>{issue.status.value}</strong>
                <p>证书: {issue.cert_node.subject}</p>
                <p>剩余天数: {issue.days_remaining} 天</p>
                <p>过期日期: {issue.expiry_date.strftime('%Y-%m-%d')}</p>
                <p style="margin-top: 10px; color: #28a745;">💡 建议: {issue.recommendation}</p>
            </div>
"""
            html += "</div>"

        if result.algorithm_issues:
            html += """
        <div class="card">
            <h2>🔐 算法问题</h2>
"""
            for issue in result.algorithm_issues:
                risk_class = f"issue-{issue.risk_level.value.lower()}"
                html += f"""
            <div class="issue {risk_class}">
                <strong>{issue.issue_type}</strong>
                <p>算法: {issue.algorithm}</p>
                <p>描述: {issue.description}</p>
                <p style="margin-top: 10px; color: #28a745;">💡 建议: {issue.recommendation}</p>
            </div>
"""
            html += "</div>"

        if result.chain_issues:
            html += """
        <div class="card">
            <h2>⛓️ 证书链问题</h2>
"""
            for issue in result.chain_issues:
                risk_class = f"issue-{issue.risk_level.value.lower()}"
                html += f"""
            <div class="issue {risk_class}">
                <strong>{issue.issue_type}</strong>
                <p>描述: {issue.description}</p>
                <p style="margin-top: 10px; color: #28a745;">💡 建议: {issue.recommendation}</p>
            </div>
"""
            html += "</div>"

        all_issues = result.expiry_issues + result.algorithm_issues + result.chain_issues
        recommendations = set()
        for issue in all_issues:
            recommendations.add(issue.recommendation)

        html += f"""
        <div class="card recommendations">
            <h2>✅ 修复建议汇总</h2>
"""
        if recommendations:
            html += "<ol>"
            for rec in sorted(recommendations):
                html += f"<li>{rec}</li>"
            html += "</ol>"
        else:
            html += "<p>证书状态健康，无需立即操作。建议定期检查证书过期情况。</p>"

        html += f"""
        </div>

        <div class="timestamp">
            报告生成时间: {result.analyzed_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
        </div>
    </div>
</body>
</html>
"""
        return html

    def _export_batch_html(self, results: List[CertAnalysisResult], output_path: str):
        html_content = self._generate_batch_html(results)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"批量HTML报告已导出: {output_path}")

    def _generate_batch_html(self, results: List[CertAnalysisResult]) -> str:
        status_counts = {}
        risk_counts = {}
        for r in results:
            status_counts[r.overall_status] = status_counts.get(r.overall_status, 0) + 1
            risk_counts[r.overall_risk.value] = risk_counts.get(r.overall_risk.value, 0) + 1

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>批量证书分析报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }}
        .card {{ background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .card h2 {{ margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-item {{ text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }}
        .summary-item .value {{ font-size: 2em; font-weight: bold; color: #667eea; }}
        .summary-item .label {{ color: #666; font-size: 0.9em; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }}
        th {{ background: #f8f9fa; font-weight: bold; }}
        .status-healthy {{ color: #28a745; }}
        .status-atrisk {{ color: #dc3545; }}
        .status-warning {{ color: #ffc107; }}
        .status-invalid {{ color: #6c757d; }}
        .timestamp {{ text-align: right; color: #6c757d; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>批量证书分析报告</h1>
            <p>共分析 {len(results)} 个证书</p>
        </div>

        <div class="card">
            <h2>📊 统计摘要</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">{len(results)}</div>
                    <div class="label">证书总数</div>
                </div>
"""
        for status, count in status_counts.items():
            html += f"""
                <div class="summary-item">
                    <div class="value">{count}</div>
                    <div class="label">{status}</div>
                </div>
"""
        html += """
            </div>
        </div>

        <div class="card">
            <h2>📋 证书列表</h2>
            <table>
                <tr>
                    <th>文件</th>
                    <th>状态</th>
                    <th>证书数</th>
                    <th>算法问题</th>
                    <th>过期问题</th>
                    <th>链问题</th>
                </tr>
"""
        for result in results:
            status_class = f"status-{result.overall_status.lower()}"
            html += f"""
                <tr>
                    <td>{Path(result.cert_file).name}</td>
                    <td class="{status_class}">{result.overall_status}</td>
                    <td>{result.chain_length}</td>
                    <td>{result.summary['algorithm_issues_count']}</td>
                    <td>{result.summary['expiry_issues_count']}</td>
                    <td>{result.summary['chain_issues_count']}</td>
                </tr>
"""
        html += f"""
            </table>
        </div>

        <div class="timestamp">
            报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
"""
        return html

    def load_result(self, json_path: str) -> CertAnalysisResult:
        raise NotImplementedError("从JSON加载结果功能暂未实现")

    def print_batch_results(self, results: List[CertAnalysisResult]):
        print("\n" + "=" * 80)
        print(f"批量证书分析报告 - 共 {len(results)} 个证书")
        print("=" * 80)
        
        status_counts = {}
        for r in results:
            status_counts[r.overall_status] = status_counts.get(r.overall_status, 0) + 1
        
        print(f"\n【统计摘要】")
        for status, count in status_counts.items():
            print(f"  {status}: {count}")
        
        print(f"\n【证书列表】")
        for result in results:
            status_color = self.color_map.get(result.overall_risk, self.reset_color)
            print(f"  {Path(result.cert_file).name:40s} {status_color}{result.overall_status}{self.reset_color}")
