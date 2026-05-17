from pathlib import Path
from jinja2 import Template
from ..core.models import MappingResult, MatchType


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>表头映射报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
        .header h1 { font-size: 28px; margin-bottom: 16px; }
        .header-info { display: flex; gap: 24px; flex-wrap: wrap; }
        .header-info span { opacity: 0.9; }
        
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
        .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 8px; }
        .stat-label { color: #666; font-size: 14px; }
        .stat-matched .stat-value { color: #10b981; }
        .stat-unmatched .stat-value { color: #ef4444; }
        .stat-conflict .stat-value { color: #f59e0b; }
        .stat-total .stat-value { color: #3b82f6; }
        
        .section { background: white; border-radius: 10px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .section h2 { font-size: 20px; margin-bottom: 20px; color: #1f2937; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
        
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 14px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        tr:hover { background: #f9fafb; }
        
        .match-exact { color: #059669; background: #d1fae5; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 500; }
        .match-synonym { color: #0891b2; background: #cffafe; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 500; }
        .match-fuzzy { color: #d97706; background: #fef3c7; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 500; }
        .match-unmatched { color: #dc2626; background: #fee2e2; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 500; }
        
        .confidence-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; width: 120px; display: inline-block; margin-right: 8px; vertical-align: middle; }
        .confidence-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
        .confidence-high { background: #10b981; }
        .confidence-medium { background: #f59e0b; }
        .confidence-low { background: #ef4444; }
        
        .conflict-badge { background: #fef2f2; color: #dc2626; padding: 4px 8px; border-radius: 6px; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
        .warning-icon { font-size: 16px; }
        
        .conclusion { padding: 20px; border-radius: 10px; margin-bottom: 24px; }
        .conclusion-success { background: #d1fae5; color: #065f46; border: 1px solid #34d399; }
        .conclusion-warning { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
        .conclusion-error { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
        
        .bad-row { background: #fef2f2 !important; }
        .sample-data { color: #6b7280; font-size: 13px; font-family: monospace; }
        
        .footer { text-align: center; color: #9ca3af; font-size: 13px; margin-top: 32px; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 表头映射报告</h1>
            <div class="header-info">
                <span>📁 文件: {{ result.file_path }}</span>
                <span>📄 工作表: {{ result.sheet_name }}</span>
                <span>🕐 生成时间: {{ result.generated_at.strftime('%Y-%m-%d %H:%M:%S') }}</span>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card stat-total">
                <div class="stat-value">{{ result.total_columns }}</div>
                <div class="stat-label">总列数</div>
            </div>
            <div class="stat-card stat-matched">
                <div class="stat-value">{{ result.matched_count }}</div>
                <div class="stat-label">已匹配</div>
            </div>
            <div class="stat-card stat-unmatched">
                <div class="stat-value">{{ result.unmatched_count }}</div>
                <div class="stat-label">未匹配</div>
            </div>
            <div class="stat-card stat-conflict">
                <div class="stat-value">{{ result.conflict_count }}</div>
                <div class="stat-label">冲突数</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 表头映射详情</h2>
            <table>
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>原始表头</th>
                        <th>标准字段</th>
                        <th>匹配类型</th>
                        <th>置信度</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    {% for match in result.header_matches %}
                    <tr {% if match.conflict %}class="bad-row"{% endif %}>
                        <td>{{ loop.index }}</td>
                        <td><strong>{{ match.original_header }}</strong></td>
                        <td>{{ match.standard_field or '-' }}</td>
                        <td><span class="match-{{ match.match_type.value }}">{{ match.match_type.value }}</span></td>
                        <td>
                            <div class="confidence-bar">
                                {% set confidence_class = 'high' if match.confidence >= 0.9 else 'medium' if match.confidence >= 0.7 else 'low' %}
                                <div class="confidence-fill confidence-{{ confidence_class }}" style="width: {{ match.confidence * 100 }}%"></div>
                            </div>
                            {{ "%.1f%%"|format(match.confidence * 100) }}
                        </td>
                        <td>
                            {% if match.conflict %}
                            <span class="conflict-badge">
                                <span class="warning-icon">⚠️</span>
                                冲突: {{ match.conflict_with|join(', ') }}
                            </span>
                            {% elif match.match_type.value == 'unmatched' %}
                            <span class="conflict-badge">❌ 无法映射</span>
                            {% endif %}
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        {% if result.bad_rows %}
        <div class="section">
            <h2>⚠️ 异常行检测 ({{ result.bad_rows|length }} 行)</h2>
            <table>
                <thead>
                    <tr>
                        <th>行号</th>
                        <th>原因</th>
                        <th>样本数据</th>
                    </tr>
                </thead>
                <tbody>
                    {% for bad_row in result.bad_rows %}
                    <tr class="bad-row">
                        <td><strong>{{ bad_row.row_index }}</strong></td>
                        <td>{{ bad_row.reason }}</td>
                        <td class="sample-data">
                            {% if bad_row.sample_data %}
                                {% for key, value in bad_row.sample_data.items() %}
                                {{ key }}: {{ value }}
                                {% if not loop.last %} | {% endif %}
                                {% endfor %}
                            {% else %}
                                -
                            {% endif %}
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        {% endif %}
        
        {% if result.unmatched_count == 0 and result.conflict_count == 0 and result.bad_rows|length == 0 %}
        <div class="conclusion conclusion-success">
            <h3>✅ 映射成功！</h3>
            <p>所有表头都已成功匹配，无冲突，无异常行。</p>
        </div>
        {% elif result.conflict_count > 0 %}
        <div class="conclusion conclusion-warning">
            <h3>⚠️ 需要人工确认</h3>
            <p>存在 {{ result.conflict_count }} 处映射冲突，请人工核查并调整。</p>
        </div>
        {% elif result.unmatched_count > 0 %}
        <div class="conclusion conclusion-error">
            <h3>⚠️ 需要处理</h3>
            <p>有 {{ result.unmatched_count }} 列表头无法映射，请添加同义词或手动处理。</p>
        </div>
        {% endif %}
        
        <div class="footer">
            <p>此报告由 电子表头映射CLI 自动生成</p>
        </div>
    </div>
</body>
</html>
"""


class HtmlReport:
    @classmethod
    def generate(cls, result: MappingResult, output_path: str) -> None:
        template = Template(HTML_TEMPLATE)
        html_content = template.render(result=result)
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
