const API_BASE = 'http://localhost:5001/api';
let trendChart = null;

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadStats();
    loadBlacklist();
    loadTrends();
    
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchSlug();
        }
    });
});

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId + '-tab').classList.add('active');
        });
    });
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const data = await response.json();
        
        document.getElementById('total-slugs').textContent = data.total_slugs;
        document.getElementById('banned-slugs').textContent = data.banned_slugs;
        document.getElementById('normal-slugs').textContent = data.normal_slugs;
        document.getElementById('blacklist-count').textContent = data.blacklist_rules;
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

async function searchSlug() {
    const query = document.getElementById('search-input').value.trim();
    const resultsDiv = document.getElementById('search-results');
    
    if (!query) {
        resultsDiv.innerHTML = '<div class="empty-state">请输入搜索关键词</div>';
        return;
    }
    
    resultsDiv.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading"></div></div>';
    
    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results.length === 0) {
            resultsDiv.innerHTML = `
                <div class="empty-state">
                    <div>🔍</div>
                    <p>未找到匹配的短链接</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="results-header">
                <div class="results-count">找到 <strong>${data.count}</strong> 条结果</div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Slug</th>
                            <th>目标域名</th>
                            <th>负责人</th>
                            <th>创建时间</th>
                            <th>状态</th>
                            <th>风险原因</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.results.forEach(item => {
            const statusClass = item.status === 'banned' ? 'banned' : 'normal';
            const statusText = item.status === 'banned' ? '已封禁' : '正常';
            const riskTag = item.is_risky ? '<span class="risk-tag">⚠️ 高风险</span>' : '';
            
            html += `
                <tr>
                    <td><strong>${item.slug}</strong>${riskTag}</td>
                    <td>${item.target_domain}</td>
                    <td>${item.owner || '-'}</td>
                    <td>${item.created_at || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td style="color: #e74c3c; font-size: 12px;">${item.risk_reason || '-'}</td>
                    <td>
                        <div class="action-buttons">
            `;
            
            if (item.status === 'banned') {
                html += `<button class="btn btn-small btn-success" onclick="unbanSlug('${item.slug}')">解封</button>`;
            } else {
                html += `<button class="btn btn-small btn-danger" onclick="banSlug('${item.slug}')">封禁</button>`;
            }
            
            html += `
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        resultsDiv.innerHTML = html;
    } catch (error) {
        resultsDiv.innerHTML = '<div class="empty-state">搜索失败，请检查服务是否正常运行</div>';
        console.error('搜索失败:', error);
    }
}

async function banSlug(slug) {
    if (!confirm(`确定要封禁短链 "${slug}" 吗？`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug, reason: '手动封禁' })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('封禁成功！');
            searchSlug();
            loadStats();
        } else {
            alert('封禁失败: ' + data.reason);
        }
    } catch (error) {
        alert('封禁失败，请重试');
        console.error('封禁失败:', error);
    }
}

async function unbanSlug(slug) {
    if (!confirm(`确定要解封短链 "${slug}" 吗？`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/unban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('解封成功！');
            searchSlug();
            loadStats();
        } else {
            alert('解封失败: ' + data.reason);
        }
    } catch (error) {
        alert('解封失败，请重试');
        console.error('解封失败:', error);
    }
}

function fillTestData() {
    const testData = `new-phish,https://malicious-site.com/fake-login,测试用户1
safe-link,https://legitimate-shop.com/safe,测试用户2
another-risk,https://scam-site.com/free-money,测试用户3
normal-link,https://real-news.com/article,测试用户4`;
    document.getElementById('batch-input').value = testData;
}

async function batchImport() {
    const input = document.getElementById('batch-input').value.trim();
    const resultsDiv = document.getElementById('import-results');
    
    if (!input) {
        resultsDiv.className = 'import-results error';
        resultsDiv.innerHTML = '<h4>❌ 请输入要导入的数据</h4>';
        return;
    }
    
    const lines = input.split('\n').filter(line => line.trim());
    const slugs = [];
    
    for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            slugs.push({
                slug: parts[0],
                target_url: parts[1],
                owner: parts[2] || '未知'
            });
        }
    }
    
    if (slugs.length === 0) {
        resultsDiv.className = 'import-results error';
        resultsDiv.innerHTML = '<h4>❌ 没有有效的数据可导入</h4>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/batch-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slugs: slugs })
        });
        
        const data = await response.json();
        
        let html = '';
        if (data.risky_found > 0) {
            html = `<h4>⚠️ 检测完成！发现 ${data.risky_found} 个风险短链，已自动封禁</h4>`;
        } else {
            html = `<h4>✅ 导入完成！${data.success}/${data.total} 条成功，未发现风险</h4>`;
        }
        
        html += '<ul>';
        data.results.forEach(result => {
            if (result.success) {
                const status = result.is_risky ? 
                    `<span style="color: #e74c3c;">🔴 风险 - ${result.risk_reason} - 已封禁</span>` : 
                    `<span style="color: #27ae60;">🟢 正常</span>`;
                html += `<li><strong>${result.slug}</strong>: ${status}</li>`;
            } else {
                html += `<li><strong>${result.slug}</strong>: ❌ 失败 - ${result.reason}</li>`;
            }
        });
        html += '</ul>';
        
        resultsDiv.className = 'import-results success';
        resultsDiv.innerHTML = html;
        
        loadStats();
    } catch (error) {
        resultsDiv.className = 'import-results error';
        resultsDiv.innerHTML = '<h4>❌ 导入失败，请检查服务是否正常运行</h4>';
        console.error('批量导入失败:', error);
    }
}

async function loadTrends() {
    const days = document.getElementById('trend-days').value;
    
    try {
        const response = await fetch(`${API_BASE}/click-trends?days=${days}`);
        const data = await response.json();
        
        const ctx = document.getElementById('trend-chart').getContext('2d');
        
        if (trendChart) {
            trendChart.destroy();
        }
        
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.trends.map(t => t.date),
                datasets: [{
                    label: '点击量',
                    data: data.trends.map(t => t.clicks),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        
        const sourceDiv = document.getElementById('source-breakdown');
        let sourceHtml = '';
        
        const sourceNames = {
            'direct': '直接访问',
            'google': 'Google搜索',
            'facebook': 'Facebook',
            'twitter': 'Twitter',
            'email': '邮件',
            'unknown': '未知来源'
        };
        
        Object.entries(data.sources).forEach(([source, count]) => {
            const name = sourceNames[source] || source;
            sourceHtml += `
                <div class="source-item">
                    <div class="source-name">${name}</div>
                    <div class="source-count">${count}</div>
                </div>
            `;
        });
        
        sourceDiv.innerHTML = sourceHtml;
    } catch (error) {
        console.error('加载趋势数据失败:', error);
    }
}

function exportData() {
    const days = document.getElementById('trend-days').value;
    window.open(`${API_BASE}/export?days=${days}`, '_blank');
}

async function loadBlacklist() {
    try {
        const response = await fetch(`${API_BASE}/blacklist`);
        const data = await response.json();
        
        const rulesDiv = document.getElementById('blacklist-rules');
        let html = '';
        
        data.rules.forEach(rule => {
            html += `
                <div class="blacklist-item">
                    <div class="domain">🚫 ${rule.domain}</div>
                    <div class="rule">规则类型: ${rule.rule}</div>
                    <span class="reason">失败原因: ${rule.reason}</span>
                    <div style="margin-top: 8px; font-size: 11px; color: #999;">
                        添加时间: ${rule.added_at} | 添加者: ${rule.added_by}
                    </div>
                </div>
            `;
        });
        
        if (data.rules.length === 0) {
            html = '<div class="empty-state">暂无黑名单规则</div>';
        }
        
        rulesDiv.innerHTML = html;
    } catch (error) {
        console.error('加载黑名单失败:', error);
    }
}
