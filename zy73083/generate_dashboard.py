"""幕墙节点方案比选 - HTML 看板生成器

基于示例数据和分析逻辑，生成一份可直接在浏览器打开的静态 HTML 看板。
- 节点方案列表、图纸版本、会议纪要来源、计算口径、异常状态、结论
- 点击展开详情：会议纪要片段、补充备注、旧版本截图占位、影响范围
- 重复碰撞点独立隔离区，不混入正常汇总
- 历史变更区：保留旧材料、补录内容、改判前后结论、原因
- 前端一键导出 CSV
"""

import json
import os
from jinja2 import Template

from analysis import (
    get_all_nodes_with_detail,
    get_normal_summary_nodes,
    get_abnormal_nodes,
    get_excluded_collisions,
    get_all_changes_sorted,
    get_export_summary,
    validate_data,
)


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>幕墙节点方案比选 · 看板</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #f5f7fa;
    color: #1f2329;
    line-height: 1.6;
    padding: 24px;
}
.container { max-width: 1200px; margin: 0 auto; }

/* 顶部标题区 */
.header {
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    color: white;
    padding: 32px;
    border-radius: 12px;
    margin-bottom: 24px;
}
.header h1 { font-size: 26px; margin-bottom: 8px; }
.header .subtitle { opacity: 0.9; font-size: 14px; }

/* 统计卡片 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}
.stat-card {
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    border-left: 4px solid #3b82f6;
}
.stat-card.warn { border-left-color: #f59e0b; }
.stat-card.danger { border-left-color: #ef4444; }
.stat-card.success { border-left-color: #10b981; }
.stat-card .label { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
.stat-card .value { font-size: 28px; font-weight: 600; }

/* Tab 切换 */
.tabs {
    display: flex;
    gap: 4px;
    background: white;
    padding: 6px;
    border-radius: 10px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.tab-btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #4b5563;
    font-weight: 500;
    transition: all 0.2s;
}
.tab-btn:hover { background: #f3f4f6; }
.tab-btn.active {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 600;
}
.tab-content { display: none; }
.tab-content.active { display: block; }

/* 节点卡片 */
.node-card {
    background: white;
    border-radius: 10px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    overflow: hidden;
    transition: box-shadow 0.2s;
}
.node-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.node-card.abnormal { border-top: 3px solid #ef4444; }
.node-card.normal { border-top: 3px solid #10b981; }

.node-header {
    padding: 18px 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
.node-header:hover { background: #f9fafb; }
.node-id { font-size: 13px; color: #6b7280; font-family: monospace; }
.node-name { font-size: 16px; font-weight: 600; margin-top: 2px; }
.node-info { display: flex; align-items: center; gap: 24px; flex: 1; }
.node-status { display: flex; flex-direction: column; gap: 6px; }

.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
}
.badge-normal { background: #d1fae5; color: #065f46; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-danger { background: #fee2e2; color: #991b1b; }
.badge-info { background: #dbeafe; color: #1e40af; }
.badge-gray { background: #e5e7eb; color: #374151; }

.node-stats { display: flex; gap: 16px; font-size: 13px; color: #6b7280; }
.node-stats span { display: flex; align-items: center; gap: 4px; }
.expand-icon { font-size: 20px; color: #9ca3af; transition: transform 0.2s; }
.node-card.expanded .expand-icon { transform: rotate(180deg); }

/* 节点详情 */
.node-detail {
    padding: 0 24px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
}
.node-card.expanded .node-detail { max-height: 3000px; }
.detail-section {
    padding: 18px 0;
    border-top: 1px solid #f3f4f6;
}
.detail-section h4 {
    font-size: 14px;
    color: #374151;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.detail-section h4::before {
    content: '';
    width: 3px;
    height: 16px;
    background: #3b82f6;
    border-radius: 2px;
}

.calc-spec {
    background: #f8fafc;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    color: #475569;
    border-left: 3px solid #3b82f6;
}

/* 纪要卡片 */
.minute-card {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
}
.minute-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.minute-meta { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
.minute-content {
    font-size: 13px;
    color: #4b5563;
    white-space: pre-line;
    margin-bottom: 10px;
}
.minute-note {
    background: #fef3c7;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: #92400e;
    margin-bottom: 8px;
}
.minute-source {
    background: #f1f5f9;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: #475569;
    font-family: monospace;
    white-space: pre-line;
}
.minute-screenshot {
    margin-top: 8px;
    padding: 10px;
    background: #f8fafc;
    border: 2px dashed #cbd5e1;
    border-radius: 6px;
    text-align: center;
    font-size: 12px;
    color: #64748b;
}

/* 碰撞点卡片 */
.collision-card {
    border: 1px solid #fecaca;
    background: #fef2f2;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
}
.collision-card.excluded {
    border: 1px dashed #f59e0b;
    background: #fffbeb;
}
.collision-title { font-size: 14px; font-weight: 600; color: #991b1b; margin-bottom: 6px; }
.collision-card.excluded .collision-title { color: #92400e; }
.collision-scope {
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 8px;
}
.collision-tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: #fee2e2;
    color: #991b1b;
}
.collision-tag.excluded-tag {
    background: #fde68a;
    color: #78350f;
}

/* 变更记录卡片 */
.change-card {
    border: 1px solid #e0e7ff;
    background: #eef2ff;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
}
.change-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.change-type { font-size: 13px; font-weight: 600; color: #3730a3; }
.change-time { font-size: 12px; color: #6366f1; }
.change-compare {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
}
.change-before, .change-after {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
}
.change-before { background: #fef2f2; color: #991b1b; text-decoration: line-through; }
.change-after { background: #dcfce7; color: #166534; font-weight: 500; }
.change-arrow { color: #6b7280; font-size: 18px; }
.change-reason {
    background: white;
    padding: 10px;
    border-radius: 6px;
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 8px;
}
.change-materials {
    font-size: 12px;
    color: #6b7280;
    margin-top: 6px;
}
.change-materials strong { color: #374151; }

/* 材料清单 */
.material-list {
    list-style: none;
    font-size: 13px;
    color: #4b5563;
}
.material-list li {
    padding: 6px 0;
    padding-left: 20px;
    position: relative;
}
.material-list li::before {
    content: '📎';
    position: absolute;
    left: 0;
}

/* 隔离区标题 */
.isolation-banner {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 10px;
    margin-bottom: 16px;
}
.isolation-banner h3 { font-size: 16px; margin-bottom: 4px; }
.isolation-banner p { font-size: 13px; opacity: 0.95; }

/* 历史列表 */
.history-item {
    background: white;
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    border-left: 4px solid #8b5cf6;
}
.history-item h4 { font-size: 15px; margin-bottom: 6px; }
.history-item .meta { font-size: 12px; color: #6b7280; margin-bottom: 10px; }

/* 导出按钮 */
.export-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
}
.export-btn {
    padding: 10px 20px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
}
.export-btn:hover { background: #059669; }

/* 空状态 */
.empty-state {
    text-align: center;
    padding: 40px;
    color: #9ca3af;
    font-size: 14px;
}

/* 底部说明 */
.footer-note {
    margin-top: 32px;
    padding: 16px;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 12px;
    color: #64748b;
    text-align: center;
}

/* 响应式 */
@media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .node-header { flex-wrap: wrap; }
    .change-compare { grid-template-columns: 1fr; }
    .change-arrow { transform: rotate(90deg); text-align: center; }
}
</style>
</head>
<body>
<div class="container">

    <!-- 顶部标题 -->
    <div class="header">
        <h1>🏗️ 幕墙节点方案比选 · 看板</h1>
        <div class="subtitle">结构工程师老叶不用再临时解释版本 — 异常一眼看得到、历史都留得住、重复碰撞不混进</div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="label">节点总数</div>
            <div class="value">{{ stats.total }}</div>
        </div>
        <div class="stat-card warn">
            <div class="label">异常节点</div>
            <div class="value">{{ stats.abnormal }}</div>
        </div>
        <div class="stat-card success">
            <div class="label">已确认最新版</div>
            <div class="value">{{ stats.version_confirmed }}</div>
        </div>
        <div class="stat-card danger">
            <div class="label">待复核重复碰撞</div>
            <div class="value">{{ stats.excluded_collisions }}</div>
        </div>
    </div>

    <!-- 导出按钮 -->
    <div class="export-bar">
        <button class="export-btn" onclick="exportCSV()">
            📤 导出当前比选结果 (CSV)
        </button>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('normal')">① 正常汇总看板</button>
        <button class="tab-btn" onclick="switchTab('abnormal')">② 异常标记视图</button>
        <button class="tab-btn" onclick="switchTab('history')">③ 历史追溯视图</button>
    </div>

    <!-- Tab 1: 正常汇总 -->
    <div id="tab-normal" class="tab-content active">
        <div style="margin-bottom:12px; font-size:13px; color:#6b7280;">
            💡 本视图只显示「图纸版本 = 已确认最新版」的记录，看到这张视图就代表是确认过的版本。
        </div>
        {% if normal_nodes %}
            {% for node in normal_nodes %}
                {{ node_card(node) }}
            {% endfor %}
        {% else %}
            <div class="empty-state">暂无已确认最新版的节点</div>
        {% endif %}

        <!-- 重复碰撞点隔离区（始终显示在正常汇总下方） -->
        {% if excluded_collisions %}
        <div style="margin-top: 32px;">
            <div class="isolation-banner">
                <h3>⚠️ 重复碰撞点隔离区（已排除正常汇总）</h3>
                <p>以下碰撞点标记了「排除正常汇总」，绝对不能直接合并进方案比选结论，必须单独复核。</p>
            </div>
            {% for col in excluded_collisions %}
                <div class="collision-card excluded">
                    <div class="collision-title">
                        {{ col.title }}
                        <span class="collision-tag excluded-tag">🔒 已排除正常汇总</span>
                    </div>
                    <div class="collision-scope"><strong>影响范围：</strong>{{ col.impact_scope }}</div>
                    <div style="font-size:12px; color:#6b7280;">
                        关联节点：{{ col.node_id }} — 
                        来源纪要：{{ col.source_minute_id }}
                    </div>
                </div>
            {% endfor %}
        </div>
        {% endif %}
    </div>

    <!-- Tab 2: 异常标记 -->
    <div id="tab-abnormal" class="tab-content">
        <div style="margin-bottom:12px; font-size:13px; color:#6b7280;">
            🚨 所有异常节点汇总在此，点击展开查看会议纪要来源、碰撞点详情、历史变更。
        </div>
        {% if abnormal_nodes %}
            {% for node in abnormal_nodes %}
                {{ node_card(node) }}
            {% endfor %}
        {% else %}
            <div class="empty-state">暂无异常节点 🎉</div>
        {% endif %}
    </div>

    <!-- Tab 3: 历史追溯 -->
    <div id="tab-history" class="tab-content">
        <div style="margin-bottom:12px; font-size:13px; color:#6b7280;">
            📜 所有补录和结论改判记录，旧材料、新备注、改判原因都在这里。
        </div>
        {% if change_records %}
            {% for change in change_records %}
                <div class="history-item">
                    <h4>🔄 {{ change.change_type }} · {{ change.node_id }}</h4>
                    <div class="meta">变更时间：{{ change.change_time }}</div>
                    <div class="change-compare">
                        <div class="change-before">{{ change.conclusion_before }}</div>
                        <div class="change-arrow">→</div>
                        <div class="change-after">{{ change.conclusion_after }}</div>
                    </div>
                    <div class="change-reason"><strong>改判原因：</strong>{{ change.change_reason }}</div>
                    <div class="change-materials">
                        <strong>旧材料摘要：</strong>{{ change.old_material_summary }}
                    </div>
                    <div class="change-materials">
                        <strong>新备注/补录要求：</strong>{{ change.new_note_content }}
                    </div>
                </div>
            {% endfor %}
        {% else %}
            <div class="empty-state">暂无历史变更记录</div>
        {% endif %}
    </div>

    <div class="footer-note">
        幕墙节点方案比选看板 · 静态生成 · 可离线打开 · 支持 CSV 导出 · 运营接手即用
    </div>
</div>

<script>
// Tab 切换
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    event.target.classList.add('active');
}

// 展开/折叠节点卡片
function toggleNode(nodeId) {
    const card = document.getElementById('node-' + nodeId);
    card.classList.toggle('expanded');
}

// 导出 CSV
function exportCSV() {
    const data = {{ export_json | safe }};
    if (!data || data.length === 0) {
        alert('暂无数据可导出');
        return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    data.forEach(row => {
        const values = headers.map(h => {
            let val = row[h];
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\\n'))) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        csvRows.push(values.join(','));
    });
    const csvContent = '\\ufeff' + csvRows.join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '幕墙节点方案比选结果_' + new Date().toISOString().slice(0,10) + '.csv';
    link.click();
}
</script>
</body>
</html>"""


NODE_CARD_TEMPLATE = """
<div id="node-{{ node.id }}" class="node-card {{ 'abnormal' if node.is_abnormal else 'normal' }}">
    <div class="node-header" onclick="toggleNode('{{ node.id }}')">
        <div>
            <div class="node-id">{{ node.id }}</div>
            <div class="node-name">{{ node.name }}</div>
        </div>
        <div class="node-info">
            <div class="node-status">
                <div>
                    <span class="badge {{ 'badge-danger' if '碰撞' in node.current_conclusion or '补录' in node.current_conclusion else 'badge-normal' if '通过' in node.current_conclusion else 'badge-warn' }}">
                        {{ node.current_conclusion }}
                    </span>
                </div>
                <div>
                    <span class="badge {{ 'badge-success' if '已确认' in node.drawing_version_status else 'badge-warn' if '待确认' in node.drawing_version_status else 'badge-danger' }}">
                        📋 {{ node.drawing_version_status }}
                    </span>
                </div>
            </div>
            <div class="node-stats">
                <span>📝 纪要 {{ node.minutes_count }}</span>
                <span>💥 碰撞 {{ node.collision_count }}</span>
                <span>🔄 变更 {{ node.change_count }}</span>
            </div>
        </div>
        <div class="expand-icon">▼</div>
    </div>

    <div class="node-detail">
        <!-- 计算口径 -->
        <div class="detail-section">
            <h4>📐 计算口径</h4>
            <div class="calc-spec">{{ node.calc_spec }}</div>
        </div>

        <!-- 比选材料 -->
        <div class="detail-section">
            <h4>📎 比选材料附件</h4>
            {% if node.material_attachments %}
                <ul class="material-list">
                    {% for mat in node.material_attachments %}
                        <li>{{ mat }}</li>
                    {% endfor %}
                </ul>
            {% else %}
                <div style="font-size:13px; color:#9ca3af;">暂无材料</div>
            {% endif %}
            <div style="margin-top:8px; font-size:12px; color:#6b7280;">
                👤 结构工程师：{{ node.engineer }}
            </div>
        </div>

        <!-- 会议纪要 -->
        {% if node.minutes_list %}
        <div class="detail-section">
            <h4>📝 关联会议纪要（点击异常能回到这里）</h4>
            {% for minute in node.minutes_list %}
                <div class="minute-card">
                    <div class="minute-title">{{ minute.title }}</div>
                    <div class="minute-meta">
                        🕒 {{ minute.meeting_time }}
                        {% if minute.collision_status %}
                            · <span class="badge {{ 'badge-danger' if '碰撞' in minute.collision_status else 'badge-info' }}">
                                {{ minute.collision_status }}
                            </span>
                        {% endif %}
                    </div>
                    <div class="minute-content">{{ minute.content }}</div>

                    {% if minute.supplement_note %}
                    <div class="minute-note">
                        <strong>📌 后续补充备注：</strong>{{ minute.supplement_note }}
                    </div>
                    {% endif %}

                    {% if minute.source_location %}
                    <div class="minute-source">
                        <strong>📍 来源位置：</strong><br>
                        {{ minute.source_location }}
                    </div>
                    {% endif %}

                    {% if minute.old_version_screenshot %}
                    <div class="minute-screenshot">
                        🖼️ 旧版本截图占位：{{ minute.old_version_screenshot }}
                    </div>
                    {% endif %}
                </div>
            {% endfor %}
        </div>
        {% endif %}

        <!-- 碰撞点 -->
        {% if node.collision_list %}
        <div class="detail-section">
            <h4>💥 异常碰撞点</h4>
            {% for col in node.collision_list %}
                <div class="collision-card {{ 'excluded' if col.exclude_from_summary else '' }}">
                    <div class="collision-title">
                        {{ col.title }}
                        {% if col.is_duplicate %}
                            <span class="collision-tag">🔁 重复碰撞</span>
                        {% endif %}
                        {% if col.exclude_from_summary %}
                            <span class="collision-tag excluded-tag">🔒 排除正常汇总</span>
                        {% endif %}
                    </div>
                    <div class="collision-scope"><strong>影响范围：</strong>{{ col.impact_scope }}</div>
                    <div style="font-size:12px; color:#6b7280;">
                        来源纪要：{{ col.source_minute_id }}
                    </div>
                </div>
            {% endfor %}
        </div>
        {% endif %}

        <!-- 历史变更 -->
        {% if node.change_list %}
        <div class="detail-section">
            <h4>🔄 历史变更记录（补录/改判可追溯）</h4>
            {% for change in node.change_list %}
                <div class="change-card">
                    <div class="change-header">
                        <span class="change-type">{{ change.change_type }}</span>
                        <span class="change-time">{{ change.change_time }}</span>
                    </div>
                    <div class="change-compare">
                        <div class="change-before">{{ change.conclusion_before }}</div>
                        <div class="change-arrow">→</div>
                        <div class="change-after">{{ change.conclusion_after }}</div>
                    </div>
                    <div class="change-reason"><strong>改判原因：</strong>{{ change.change_reason }}</div>
                    <div class="change-materials">
                        <strong>旧材料摘要：</strong>{{ change.old_material_summary }}
                    </div>
                    <div class="change-materials">
                        <strong>新备注/补录内容：</strong>{{ change.new_note_content }}
                    </div>
                </div>
            {% endfor %}
        </div>
        {% endif %}

    </div>
</div>
"""


def build_html():
    """构建完整 HTML 内容"""
    all_nodes = get_all_nodes_with_detail()
    normal_nodes = get_normal_summary_nodes()
    abnormal_nodes = get_abnormal_nodes()
    excluded_collisions = get_excluded_collisions()
    change_records = get_all_changes_sorted()
    export_data = get_export_summary()

    stats = {
        "total": len(all_nodes),
        "abnormal": len(abnormal_nodes),
        "version_confirmed": len(normal_nodes),
        "excluded_collisions": len(excluded_collisions),
    }

    node_card_tpl = Template(NODE_CARD_TEMPLATE)

    class Globals:
        pass

    tpl = Template(HTML_TEMPLATE)
    tpl.globals["node_card"] = lambda n: node_card_tpl.render(node=n)

    html = tpl.render(
        stats=stats,
        normal_nodes=normal_nodes,
        abnormal_nodes=abnormal_nodes,
        excluded_collisions=excluded_collisions,
        change_records=change_records,
        export_json=json.dumps(export_data, ensure_ascii=False),
    )

    return html


def main():
    """主函数：校验数据 → 生成 HTML → 保存到 output 目录"""
    errors = validate_data()
    if errors:
        print("⚠️  数据一致性校验发现问题：")
        for e in errors:
            print(f"  - {e}")
    else:
        print("✅ 数据一致性校验通过")

    html = build_html()

    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "dashboard.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"📄 看板已生成：{output_path}")
    print(f"📊 节点总数：{len(get_all_nodes_with_detail())}")
    print(f"   - 异常节点：{len(get_abnormal_nodes())}")
    print(f"   - 已确认最新版：{len(get_normal_summary_nodes())}")
    print(f"   - 待复核重复碰撞：{len(get_excluded_collisions())}")
    print(f"\n🚀 直接在浏览器打开 output/dashboard.html 即可查看")


if __name__ == "__main__":
    main()
