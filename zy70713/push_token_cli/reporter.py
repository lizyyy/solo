import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from jinja2 import Template

from .rule_engine import AnalysisResult
from .state_machine import FailureReason


class Reporter:
    def __init__(self, result: AnalysisResult):
        self.result = result
        self.generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _get_failure_reason_cn(self, reason: str) -> str:
        reason_map = {
            FailureReason.TOKEN_EXPIRED.value: "Token过期",
            FailureReason.TOKEN_INVALID.value: "Token无效",
            FailureReason.DEVICE_REBOUND.value: "设备换绑",
            FailureReason.USER_UNSUBSCRIBED.value: "用户退订",
            FailureReason.TOKEN_UNBOUND.value: "Token解绑",
            FailureReason.UNKNOWN.value: "未知原因",
        }
        return reason_map.get(reason, reason)

    def _get_state_cn(self, state: str) -> str:
        state_map = {
            "CREATED": "已创建",
            "BOUND": "已绑定",
            "UNBOUND": "已解绑",
            "UNSUBSCRIBED": "已退订",
            "EXPIRED": "已过期",
            "INVALID": "无效",
            "FAILED": "推送失败",
        }
        return state_map.get(state, state)

    def generate_text_report(self, output_path: Optional[str] = None) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("推送 Token 生命周期排查报告")
        lines.append(f"生成时间: {self.generated_at}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【统计概览】")
        lines.append(f"  Token 总数: {self.result.total_tokens}")
        lines.append(f"  已绑定: {self.result.bound_tokens}")
        lines.append(f"  已解绑: {self.result.unbound_tokens}")
        lines.append(f"  已退订: {self.result.unsubscribed_tokens}")
        lines.append(f"  推送失败: {self.result.failed_tokens}")
        lines.append(f"  换绑设备: {self.result.rebound_devices}")
        lines.append("")
        lines.append("【失败原因分类】")
        lines.append(f"  Token 过期: {self.result.token_expired}")
        lines.append(f"  Token 无效: {self.result.token_invalid}")
        lines.append("")

        if self.result.parse_errors:
            lines.append("【解析错误】")
            for err in self.result.parse_errors:
                if err.sheet_name:
                    lines.append(f"  {err.source_file}[{err.sheet_name}] 第{err.row_number}行: {err.error_message}")
                else:
                    lines.append(f"  {err.source_file} 第{err.row_number}行: {err.error_message}")
                if err.raw_content:
                    lines.append(f"    原始内容: {err.raw_content}")
            lines.append("")

        lines.append("【Token 详情】")
        for idx, token in enumerate(self.result.token_details, 1):
            lines.append(f"\n--- Token #{idx}: {token['token'][:20]}... ---")
            lines.append(f"  用户ID: {token['user_id']}")
            lines.append(f"  设备ID: {token['device_id']}")
            lines.append(f"  当前状态: {self._get_state_cn(token['current_state'])}")
            lines.append(f"  创建时间: {token['create_time']}")

            if token['failure_reason']:
                lines.append(f"  失败原因: {self._get_failure_reason_cn(token['failure_reason'])}")

            lines.append(f"  绑定次数: {token['bind_count']} / 解绑次数: {token['unbind_count']}")

            if token['rebound_to']:
                lines.append(f"  已换绑到新Token: {token['rebound_to']}")
            if token['rebound_from']:
                lines.append(f"  接替旧Token: {', '.join(token['rebound_from'])}")

            if token['state_history']:
                lines.append("  状态流转:")
                for event in token['state_history']:
                    details_str = ", ".join([f"{k}={v}" for k, v in event['details'].items() if v])
                    if details_str:
                        lines.append(f"    [{event['time']}] {event['event']} ({details_str}) <{event['source']}>")
                    else:
                        lines.append(f"    [{event['time']}] {event['event']} <{event['source']}>")

            if token['source_traces']:
                lines.append("  数据来源:")
                for trace in token['source_traces']:
                    lines.append(f"    - {trace}")

        lines.append("")
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        content = "\n".join(lines)

        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)

        return content

    def generate_json_report(self, output_path: Optional[str] = None) -> str:
        report_data = {
            "generated_at": self.generated_at,
            "summary": {
                "total_tokens": self.result.total_tokens,
                "bound_tokens": self.result.bound_tokens,
                "unbound_tokens": self.result.unbound_tokens,
                "unsubscribed_tokens": self.result.unsubscribed_tokens,
                "failed_tokens": self.result.failed_tokens,
                "rebound_devices": self.result.rebound_devices,
                "token_expired": self.result.token_expired,
                "token_invalid": self.result.token_invalid,
            },
            "parse_errors": [
                {
                    "source_file": err.source_file,
                    "sheet_name": err.sheet_name,
                    "row_number": err.row_number,
                    "raw_content": err.raw_content,
                    "error_message": err.error_message,
                }
                for err in self.result.parse_errors
            ],
            "token_details": self.result.token_details,
        }

        content = json.dumps(report_data, ensure_ascii=False, indent=2)

        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)

        return content

    def generate_csv_report(self, output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        rows = []
        for token in self.result.token_details:
            rebound_from = ",".join(token['rebound_from'])

            history_descriptions = []
            for event in token['state_history']:
                details_str = ", ".join([f"{k}={v}" for k, v in event['details'].items() if v])
                history_descriptions.append(f"[{event['time']}] {event['event']} ({details_str})")
            state_history_str = " | ".join(history_descriptions)

            source_traces_str = " | ".join(token['source_traces'])

            rows.append({
                "Token": token['token'],
                "用户ID": token['user_id'],
                "设备ID": token['device_id'],
                "当前状态": self._get_state_cn(token['current_state']),
                "失败原因": self._get_failure_reason_cn(token['failure_reason']) if token['failure_reason'] else "",
                "创建时间": token['create_time'],
                "绑定次数": token['bind_count'],
                "解绑次数": token['unbind_count'],
                "失败次数": token['failure_count'],
                "是否退订": "是" if token['is_unsubscribed'] else "否",
                "换绑到新Token": token['rebound_to'],
                "接替旧Token": rebound_from,
                "状态流转": state_history_str,
                "数据来源": source_traces_str,
            })

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else [])
            writer.writeheader()
            writer.writerows(rows)

    def generate_excel_report(self, output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        summary_data = {
            "指标": [
                "Token总数",
                "已绑定",
                "已解绑",
                "已退订",
                "推送失败",
                "换绑设备",
                "Token过期",
                "Token无效",
            ],
            "数值": [
                self.result.total_tokens,
                self.result.bound_tokens,
                self.result.unbound_tokens,
                self.result.unsubscribed_tokens,
                self.result.failed_tokens,
                self.result.rebound_devices,
                self.result.token_expired,
                self.result.token_invalid,
            ],
        }
        df_summary = pd.DataFrame(summary_data)

        token_rows = []
        for token in self.result.token_details:
            rebound_from = ",".join(token['rebound_from'])

            history_descriptions = []
            for event in token['state_history']:
                details_str = ", ".join([f"{k}={v}" for k, v in event['details'].items() if v])
                history_descriptions.append(f"[{event['time']}] {event['event']} ({details_str})")
            state_history_str = " | ".join(history_descriptions)

            source_traces_str = " | ".join(token['source_traces'])

            token_rows.append({
                "Token": token['token'],
                "用户ID": token['user_id'],
                "设备ID": token['device_id'],
                "当前状态": self._get_state_cn(token['current_state']),
                "失败原因": self._get_failure_reason_cn(token['failure_reason']) if token['failure_reason'] else "",
                "创建时间": token['create_time'],
                "绑定次数": token['bind_count'],
                "解绑次数": token['unbind_count'],
                "失败次数": token['failure_count'],
                "是否退订": "是" if token['is_unsubscribed'] else "否",
                "换绑到新Token": token['rebound_to'],
                "接替旧Token": rebound_from,
                "状态流转": state_history_str,
                "数据来源": source_traces_str,
            })
        df_tokens = pd.DataFrame(token_rows)

        error_rows = []
        for err in self.result.parse_errors:
            error_rows.append({
                "文件": err.source_file,
                "工作表": err.sheet_name or "",
                "行号": err.row_number,
                "错误信息": err.error_message,
                "原始内容": err.raw_content,
            })
        df_errors = pd.DataFrame(error_rows)

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df_summary.to_excel(writer, sheet_name='统计概览', index=False)
            df_tokens.to_excel(writer, sheet_name='Token详情', index=False)
            if not df_errors.empty:
                df_errors.to_excel(writer, sheet_name='解析错误', index=False)

    def generate_html_report(self, output_path: str) -> None:
        html_template = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>推送 Token 生命周期排查报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; }
        .generated-at { color: #666; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #444; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
        .stat-card.green { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        .stat-card.red { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
        .stat-card.orange { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .stat-value { font-size: 32px; font-weight: bold; }
        .stat-label { font-size: 14px; opacity: 0.9; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #555; }
        tr:hover { background: #f8f9fa; }
        .error-box { background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 4px; margin-bottom: 10px; }
        .token-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #667eea; }
        .token-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .token-id { font-family: monospace; font-size: 16px; font-weight: bold; }
        .token-state { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .state-BOUND { background: #d4edda; color: #155724; }
        .state-UNBOUND { background: #fff3cd; color: #856404; }
        .state-UNSUBSCRIBED { background: #f8d7da; color: #721c24; }
        .state-FAILED { background: #f8d7da; color: #721c24; }
        .state-CREATED { background: #d1ecf1; color: #0c5460; }
        .token-meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px; }
        .meta-item { font-size: 14px; }
        .meta-label { color: #666; margin-right: 5px; }
        .meta-value { font-weight: 500; }
        .history-item { padding: 8px 12px; background: white; margin-bottom: 5px; border-radius: 4px; font-size: 13px; }
        .history-time { color: #666; font-family: monospace; margin-right: 10px; }
        .history-event { font-weight: 500; margin-right: 10px; }
        .history-source { color: #999; font-size: 12px; }
        .source-list { margin-top: 10px; }
        .source-item { font-size: 12px; color: #666; font-family: monospace; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 5px; }
        .badge-unsubscribed { background: #dc3545; color: white; }
        .badge-rebound { background: #ffc107; color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <h1>推送 Token 生命周期排查报告</h1>
        <div class="generated-at">生成时间: {{ generated_at }}</div>

        <div class="section">
            <h2>统计概览</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">{{ summary.total_tokens }}</div>
                    <div class="stat-label">Token 总数</div>
                </div>
                <div class="stat-card green">
                    <div class="stat-value">{{ summary.bound_tokens }}</div>
                    <div class="stat-label">已绑定</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{{ summary.unbound_tokens }}</div>
                    <div class="stat-label">已解绑</div>
                </div>
                <div class="stat-card red">
                    <div class="stat-value">{{ summary.unsubscribed_tokens }}</div>
                    <div class="stat-label">已退订</div>
                </div>
                <div class="stat-card red">
                    <div class="stat-value">{{ summary.failed_tokens }}</div>
                    <div class="stat-label">推送失败</div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-value">{{ summary.rebound_devices }}</div>
                    <div class="stat-label">换绑设备</div>
                </div>
            </div>
        </div>

        {% if parse_errors %}
        <div class="section">
            <h2>解析错误 ({{ parse_errors|length }})</h2>
            {% for err in parse_errors %}
            <div class="error-box">
                <strong>{{ err.source_file }}{% if err.sheet_name %}[{{ err.sheet_name }}]{% endif %} 第{{ err.row_number }}行</strong>
                <div>{{ err.error_message }}</div>
                {% if err.raw_content %}
                <div style="margin-top: 8px; font-family: monospace; font-size: 12px;">原始内容: {{ err.raw_content }}</div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
        {% endif %}

        <div class="section">
            <h2>Token 详情 ({{ token_details|length }})</h2>
            {% for token in token_details %}
            <div class="token-card">
                <div class="token-header">
                    <span class="token-id">{{ token.token }}</span>
                    <div>
                        <span class="token-state state-{{ token.current_state }}">{{ get_state_cn(token.current_state) }}</span>
                        {% if token.is_unsubscribed %}<span class="badge badge-unsubscribed">已退订</span>{% endif %}
                        {% if token.rebound_to %}<span class="badge badge-rebound">已换绑</span>{% endif %}
                    </div>
                </div>

                {% if token.failure_reason %}
                <div style="margin-bottom: 15px; padding: 10px; background: #fff5f5; border-radius: 4px; color: #c53030;">
                    <strong>失败原因:</strong> {{ get_failure_reason_cn(token.failure_reason) }}
                </div>
                {% endif %}

                <div class="token-meta">
                    <div class="meta-item"><span class="meta-label">用户ID:</span><span class="meta-value">{{ token.user_id or '-' }}</span></div>
                    <div class="meta-item"><span class="meta-label">设备ID:</span><span class="meta-value">{{ token.device_id or '-' }}</span></div>
                    <div class="meta-item"><span class="meta-label">创建时间:</span><span class="meta-value">{{ token.create_time or '-' }}</span></div>
                    <div class="meta-item"><span class="meta-label">绑定次数:</span><span class="meta-value">{{ token.bind_count }}</span></div>
                    <div class="meta-item"><span class="meta-label">解绑次数:</span><span class="meta-value">{{ token.unbind_count }}</span></div>
                    <div class="meta-item"><span class="meta-label">失败次数:</span><span class="meta-value">{{ token.failure_count }}</span></div>
                </div>

                {% if token.rebound_to or token.rebound_from %}
                <div style="margin-bottom: 15px; padding: 10px; background: #fffbeb; border-radius: 4px;">
                    {% if token.rebound_to %}
                    <div><strong>换绑到新Token:</strong> {{ token.rebound_to }}</div>
                    {% endif %}
                    {% if token.rebound_from %}
                    <div><strong>接替旧Token:</strong> {{ token.rebound_from|join(', ') }}</div>
                    {% endif %}
                </div>
                {% endif %}

                {% if token.state_history %}
                <div style="margin-bottom: 10px;"><strong>状态流转:</strong></div>
                {% for event in token.state_history %}
                <div class="history-item">
                    <span class="history-time">{{ event.time or '-' }}</span>
                    <span class="history-event">{{ event.event }}</span>
                    {% for k, v in event.details.items() %}{% if v %}<span>{{ k }}={{ v }}</span>{% endif %}{% endfor %}
                    <span class="history-source">&lt;{{ event.source }}&gt;</span>
                </div>
                {% endfor %}
                {% endif %}

                {% if token.source_traces %}
                <div class="source-list">
                    <strong>数据来源:</strong>
                    {% for trace in token.source_traces %}
                    <div class="source-item">- {{ trace }}</div>
                    {% endfor %}
                </div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
</body>
</html>
        """

        template = Template(html_template)
        content = template.render(
            generated_at=self.generated_at,
            summary={
                "total_tokens": self.result.total_tokens,
                "bound_tokens": self.result.bound_tokens,
                "unbound_tokens": self.result.unbound_tokens,
                "unsubscribed_tokens": self.result.unsubscribed_tokens,
                "failed_tokens": self.result.failed_tokens,
                "rebound_devices": self.result.rebound_devices,
            },
            parse_errors=self.result.parse_errors,
            token_details=self.result.token_details,
            get_state_cn=self._get_state_cn,
            get_failure_reason_cn=self._get_failure_reason_cn,
        )

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
