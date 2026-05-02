"""
报告生成模块
支持HTML、Markdown和JSON格式的报告输出
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

from .rule_engine import RuleResult
from .session_manager import SessionManager


class ValidationResult:
    """完整的验证结果"""
    
    def __init__(self):
        self.session_results: Dict[str, List[RuleResult]] = {}
        self.parse_errors: List[Dict[str, Any]] = []
        self.statistics: Dict[str, Any] = {}
        self.generated_at: datetime = datetime.now()
        
        # 缓存的统计数据
        self._total_rules = 0
        self._passed_rules = 0
        self._failed_rules = 0
        self._failed_rules_count: Dict[str, int] = defaultdict(int)
        self._failed_sessions: List[str] = []
    
    def add_session_results(self, session_id: str, results: List[RuleResult]):
        """添加Session的验证结果"""
        self.session_results[session_id] = results
        
        # 更新统计
        for result in results:
            self._total_rules += 1
            if result.passed:
                self._passed_rules += 1
            else:
                self._failed_rules += 1
                self._failed_rules_count[f"{result.rule_id}: {result.rule_name}"] += 1
                
                if session_id not in self._failed_sessions:
                    self._failed_sessions.append(session_id)
    
    def add_parse_errors(self, errors: List[Dict[str, Any]]):
        """添加解析错误"""
        self.parse_errors.extend(errors)
    
    def set_statistics(self, stats: Dict[str, Any]):
        """设置统计信息"""
        self.statistics = stats
    
    def get_summary(self) -> Dict[str, Any]:
        """获取验证摘要"""
        total_sessions = len(self.session_results)
        passed_sessions = total_sessions - len(self._failed_sessions)
        
        # 计算通过率
        pass_rate = (self._passed_rules / self._total_rules * 100) if self._total_rules > 0 else 0
        session_pass_rate = (passed_sessions / total_sessions * 100) if total_sessions > 0 else 0
        
        # 获取失败规则排行
        failed_rules_ranking = sorted(
            self._failed_rules_count.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            "generated_at": self.generated_at.isoformat(),
            "total_rules": self._total_rules,
            "passed_rules": self._passed_rules,
            "failed_rules": self._failed_rules,
            "pass_rate": round(pass_rate, 2),
            "total_sessions": total_sessions,
            "passed_sessions": passed_sessions,
            "failed_sessions_count": len(self._failed_sessions),
            "session_pass_rate": round(session_pass_rate, 2),
            "parse_errors_count": len(self.parse_errors),
            "failed_rules_ranking": [
                {"rule": rule, "failure_count": count}
                for rule, count in failed_rules_ranking
            ]
        }
    
    def get_failed_sessions_details(self) -> List[Dict[str, Any]]:
        """获取失败Session的详细信息"""
        details = []
        
        for session_id in self._failed_sessions:
            results = self.session_results.get(session_id, [])
            failed_results = [r for r in results if not r.passed]
            
            session_details = {
                "session_id": session_id,
                "failed_rules_count": len(failed_results),
                "failed_rules": []
            }
            
            for result in failed_results:
                rule_detail = {
                    "rule_id": result.rule_id,
                    "rule_name": result.rule_name,
                    "rule_type": result.rule_type.value,
                    "details": result.details,
                    "related_events": result.to_dict().get("related_events", [])
                }
                session_details["failed_rules"].append(rule_detail)
            
            details.append(session_details)
        
        return details
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为完整的字典格式"""
        return {
            "summary": self.get_summary(),
            "statistics": self.statistics,
            "parse_errors": self.parse_errors,
            "failed_sessions_details": self.get_failed_sessions_details(),
            "all_results": {
                session_id: [r.to_dict() for r in results]
                for session_id, results in self.session_results.items()
            }
        }


class Reporter:
    """报告生成器"""
    
    @staticmethod
    def generate_json_report(result: ValidationResult, output_path: str):
        """生成JSON格式报告"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def generate_markdown_report(result: ValidationResult, output_path: str):
        """生成Markdown格式报告"""
        summary = result.get_summary()
        failed_details = result.get_failed_sessions_details()
        
        md_content = [
            "# 埋点日志验证报告",
            "",
            f"**生成时间**: {summary['generated_at']}",
            "",
            "## 一、整体概览",
            "",
            "### 规则验证统计",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总规则数 | {summary['total_rules']} |",
            f"| 通过规则数 | {summary['passed_rules']} |",
            f"| 失败规则数 | {summary['failed_rules']} |",
            f"| **规则通过率** | **{summary['pass_rate']}%** |",
            "",
            "### Session统计",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总Session数 | {summary['total_sessions']} |",
            f"| 通过Session数 | {summary['passed_sessions']} |",
            f"| 失败Session数 | {summary['failed_sessions_count']} |",
            f"| **Session通过率** | **{summary['session_pass_rate']}%** |",
            "",
            f"### 解析错误: {summary['parse_errors_count']} 个",
            "",
        ]
        
        if result.parse_errors:
            md_content.extend([
                "**详细错误:**",
                "",
                "| 行号 | 错误信息 | 原始内容 |",
                "|------|----------|----------|",
            ])
            for error in result.parse_errors[:20]:  # 最多显示20个
                line = error.get('line_number', '-')
                msg = error.get('message', '-')
                raw = error.get('raw_content', '')[:50]  # 截断过长内容
                md_content.append(f"| {line} | {msg} | {raw}... |")
            md_content.append("")
        
        md_content.extend([
            "## 二、失败规则排行",
            "",
        ])
        
        if summary['failed_rules_ranking']:
            md_content.extend([
                "| 排名 | 规则 | 失败次数 |",
                "|------|------|----------|",
            ])
            for idx, rule_info in enumerate(summary['failed_rules_ranking'], 1):
                md_content.append(f"| {idx} | {rule_info['rule']} | {rule_info['failure_count']} |")
        else:
            md_content.append("所有规则均通过验证。")
        
        md_content.append("")
        
        md_content.extend([
            "## 三、问题Session明细",
            "",
        ])
        
        if failed_details:
            for idx, session_detail in enumerate(failed_details, 1):
                md_content.extend([
                    f"### {idx}. Session: `{session_detail['session_id']}`",
                    "",
                    f"**失败规则数**: {session_detail['failed_rules_count']}",
                    "",
                ])
                
                for rule_idx, rule_detail in enumerate(session_detail['failed_rules'], 1):
                    md_content.extend([
                        f"#### {rule_idx}. 规则: {rule_detail['rule_name']} (ID: {rule_detail['rule_id']})",
                        "",
                        f"- **类型**: {rule_detail['rule_type']}",
                        f"- **详情**: {json.dumps(rule_detail['details'], ensure_ascii=False)}",
                        "",
                    ])
                    
                    if rule_detail['related_events']:
                        md_content.append("**相关事件:**")
                        md_content.append("")
                        md_content.append("| 事件 | 页面 | 时间戳 | 行号 |")
                        md_content.append("|------|------|--------|------|")
                        for event in rule_detail['related_events']:
                            md_content.append(
                                f"| {event.get('event', '-')} | "
                                f"{event.get('page', '-')} | "
                                f"{event.get('timestamp', '-')} | "
                                f"{event.get('line_number', '-')} |"
                            )
                        md_content.append("")
                
                md_content.append("---")
                md_content.append("")
        else:
            md_content.append("所有Session均通过验证。")
        
        # 添加统计信息部分
        if result.statistics:
            md_content.extend([
                "## 四、日志统计信息",
                "",
                "| 指标 | 数值 |",
                "|------|------|",
                f"| 总Session数 | {result.statistics.get('session_count', 0)} |",
                f"| 总事件数 | {result.statistics.get('total_events', 0)} |",
                f"| 独立用户数 | {result.statistics.get('user_count', 0)} |",
                f"| 平均每Session事件数 | {result.statistics.get('avg_events_per_session', 0):.2f} |",
                f"| 平均Session时长(秒) | {result.statistics.get('avg_duration_seconds', 0):.2f} |",
                "",
            ])
            
            event_dist = result.statistics.get('event_type_distribution', {})
            if event_dist:
                md_content.append("### 事件类型分布")
                md_content.append("")
                md_content.append("| 事件类型 | 次数 |")
                md_content.append("|----------|------|")
                for event_type, count in sorted(event_dist.items(), key=lambda x: x[1], reverse=True):
                    md_content.append(f"| {event_type} | {count} |")
                md_content.append("")
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_content))
    
    @staticmethod
    def generate_html_report(result: ValidationResult, output_path: str):
        """生成HTML格式报告"""
        summary = result.get_summary()
        failed_details = result.get_failed_sessions_details()
        
        # 基础HTML模板
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>埋点日志验证报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f7fa; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .header .time {{ font-size: 14px; opacity: 0.9; }}
        .content {{ padding: 30px; }}
        .section {{ margin-bottom: 30px; }}
        .section h2 {{ font-size: 20px; color: #2c3e50; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }}
        .card {{ background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; }}
        .card .label {{ font-size: 14px; color: #64748b; margin-bottom: 8px; }}
        .card .value {{ font-size: 32px; font-weight: bold; }}
        .card.passed .value {{ color: #10b981; }}
        .card.failed .value {{ color: #ef4444; }}
        .card.rate .value {{ color: #667eea; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        table th, table td {{ padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        table th {{ background: #f1f5f9; font-weight: 600; color: #475569; }}
        table tr:hover {{ background: #f8fafc; }}
        .session-card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }}
        .session-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }}
        .session-id {{ font-family: monospace; background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-size: 14px; }}
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }}
        .badge.failed {{ background: #fee2e2; color: #dc2626; }}
        .rule-detail {{ background: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin: 10px 0; border-radius: 0 6px 6px 0; }}
        .rule-detail h4 {{ color: #854d0e; margin-bottom: 10px; }}
        .rule-meta {{ font-size: 12px; color: #78716c; margin-bottom: 10px; }}
        .events-table {{ font-size: 13px; }}
        .events-table th, .events-table td {{ padding: 8px 10px; }}
        .error-list {{ background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; }}
        .error-item {{ padding: 8px 0; border-bottom: 1px solid #fecaca; }}
        .error-item:last-child {{ border-bottom: none; }}
        .error-line {{ font-family: monospace; background: #fee2e2; padding: 2px 6px; border-radius: 3px; margin-right: 10px; }}
        .no-data {{ text-align: center; padding: 40px; color: #94a3b8; font-style: italic; }}
        .stats-box {{ background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin-top: 20px; }}
        .stats-box h3 {{ color: #0369a1; margin-bottom: 15px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 埋点日志验证报告</h1>
            <div class="time">生成时间: {summary['generated_at']}</div>
        </div>
        <div class="content">
"""
        
        # 整体概览部分
        html += """
            <div class="section">
                <h2>📈 整体概览</h2>
                <div class="grid">
"""
        
        # 规则统计卡片
        pass_rate_color = "#10b981" if summary['pass_rate'] >= 80 else "#f59e0b" if summary['pass_rate'] >= 60 else "#ef4444"
        session_rate_color = "#10b981" if summary['session_pass_rate'] >= 80 else "#f59e0b" if summary['session_pass_rate'] >= 60 else "#ef4444"
        
        html += f"""
                    <div class="card">
                        <div class="label">总规则数</div>
                        <div class="value">{summary['total_rules']}</div>
                    </div>
                    <div class="card passed">
                        <div class="label">通过规则数</div>
                        <div class="value">{summary['passed_rules']}</div>
                    </div>
                    <div class="card failed">
                        <div class="label">失败规则数</div>
                        <div class="value">{summary['failed_rules']}</div>
                    </div>
                    <div class="card rate">
                        <div class="label">规则通过率</div>
                        <div class="value" style="color: {pass_rate_color}">{summary['pass_rate']}%</div>
                    </div>
"""
        
        html += """
                </div>
                <div class="grid">
"""
        
        html += f"""
                    <div class="card">
                        <div class="label">总Session数</div>
                        <div class="value">{summary['total_sessions']}</div>
                    </div>
                    <div class="card passed">
                        <div class="label">通过Session数</div>
                        <div class="value">{summary['passed_sessions']}</div>
                    </div>
                    <div class="card failed">
                        <div class="label">失败Session数</div>
                        <div class="value">{summary['failed_sessions_count']}</div>
                    </div>
                    <div class="card rate">
                        <div class="label">Session通过率</div>
                        <div class="value" style="color: {session_rate_color}">{summary['session_pass_rate']}%</div>
                    </div>
"""
        
        html += """
                </div>
            </div>
"""
        
        # 解析错误部分
        if result.parse_errors:
            html += f"""
            <div class="section">
                <h2>⚠️ 解析错误 ({summary['parse_errors_count']} 个)</h2>
                <div class="error-list">
"""
            for error in result.parse_errors[:20]:
                line = error.get('line_number', '-')
                msg = error.get('message', '-')
                raw = error.get('raw_content', '')[:100]
                html += f"""
                    <div class="error-item">
                        <span class="error-line">行 {line}</span>
                        <strong>{msg}</strong><br>
                        <small style="color: #78716c;">原始内容: {raw}...</small>
                    </div>
"""
            if len(result.parse_errors) > 20:
                html += f"""
                    <div class="error-item" style="color: #94a3b8; text-align: center;">
                        ... 还有 {len(result.parse_errors) - 20} 个错误，请查看完整JSON报告
                    </div>
"""
            html += """
                </div>
            </div>
"""
        
        # 失败规则排行
        html += """
            <div class="section">
                <h2>🏆 失败规则排行</h2>
"""
        if summary['failed_rules_ranking']:
            html += """
                <table>
                    <thead>
                        <tr>
                            <th>排名</th>
                            <th>规则</th>
                            <th>失败次数</th>
                        </tr>
                    </thead>
                    <tbody>
"""
            for idx, rule_info in enumerate(summary['failed_rules_ranking'], 1):
                html += f"""
                        <tr>
                            <td>{idx}</td>
                            <td>{rule_info['rule']}</td>
                            <td><span class="badge failed">{rule_info['failure_count']}</span></td>
                        </tr>
"""
            html += """
                    </tbody>
                </table>
"""
        else:
            html += '<div class="no-data">🎉 所有规则均通过验证！</div>'
        html += """
            </div>
"""
        
        # 问题Session明细
        html += """
            <div class="section">
                <h2>🔍 问题Session明细</h2>
"""
        if failed_details:
            for idx, session_detail in enumerate(failed_details, 1):
                html += f"""
                <div class="session-card">
                    <div class="session-header">
                        <div>
                            <span class="session-id">{session_detail['session_id']}</span>
                        </div>
                        <div>
                            <span class="badge failed">失败 {session_detail['failed_rules_count']} 条规则</span>
                        </div>
                    </div>
"""
                
                for rule_idx, rule_detail in enumerate(session_detail['failed_rules'], 1):
                    html += f"""
                    <div class="rule-detail">
                        <h4>{rule_idx}. {rule_detail['rule_name']}</h4>
                        <div class="rule-meta">
                            规则ID: {rule_detail['rule_id']} | 类型: {rule_detail['rule_type']}
                        </div>
                        <div>
                            <strong>详情:</strong> {json.dumps(rule_detail['details'], ensure_ascii=False)}
                        </div>
"""
                    
                    if rule_detail['related_events']:
                        html += """
                        <div style="margin-top: 15px;">
                            <strong>相关事件:</strong>
                            <table class="events-table">
                                <thead>
                                    <tr>
                                        <th>事件</th>
                                        <th>页面</th>
                                        <th>时间戳</th>
                                        <th>行号</th>
                                    </tr>
                                </thead>
                                <tbody>
"""
                        for event in rule_detail['related_events']:
                            html += f"""
                                    <tr>
                                        <td>{event.get('event', '-')}</td>
                                        <td>{event.get('page', '-')}</td>
                                        <td>{event.get('timestamp', '-')}</td>
                                        <td>{event.get('line_number', '-')}</td>
                                    </tr>
"""
                        html += """
                                </tbody>
                            </table>
                        </div>
"""
                    
                    html += """
                    </div>
"""
                
                html += """
                </div>
"""
        else:
            html += '<div class="no-data">🎉 所有Session均通过验证！</div>'
        
        html += """
            </div>
"""
        
        # 统计信息
        if result.statistics:
            html += """
            <div class="section">
                <h2>📋 日志统计信息</h2>
                <div class="stats-box">
                    <h3>基本统计</h3>
"""
            html += f"""
                    <table>
                        <thead>
                            <tr>
                                <th>指标</th>
                                <th>数值</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>总Session数</td><td>{result.statistics.get('session_count', 0)}</td></tr>
                            <tr><td>总事件数</td><td>{result.statistics.get('total_events', 0)}</td></tr>
                            <tr><td>独立用户数</td><td>{result.statistics.get('user_count', 0)}</td></tr>
                            <tr><td>平均每Session事件数</td><td>{result.statistics.get('avg_events_per_session', 0):.2f}</td></tr>
                            <tr><td>平均Session时长(秒)</td><td>{result.statistics.get('avg_duration_seconds', 0):.2f}</td></tr>
                        </tbody>
                    </table>
"""
            
            event_dist = result.statistics.get('event_type_distribution', {})
            if event_dist:
                html += """
                    <h3 style="margin-top: 20px;">事件类型分布</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>事件类型</th>
                                <th>次数</th>
                            </tr>
                        </thead>
                        <tbody>
"""
                for event_type, count in sorted(event_dist.items(), key=lambda x: x[1], reverse=True):
                    html += f"""
                            <tr><td>{event_type}</td><td>{count}</td></tr>
"""
                html += """
                        </tbody>
                    </table>
"""
            
            html += """
                </div>
            </div>
"""
        
        html += """
        </div>
    </div>
</body>
</html>
"""
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
