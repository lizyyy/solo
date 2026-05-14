async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>总审查数</h3>
                <div class="number">${stats.total_reviews}</div>
            </div>
            <div class="stat-card blocked">
                <h3>阻塞中</h3>
                <div class="number">${stats.blocked}</div>
            </div>
            <div class="stat-card approved">
                <h3>已通过</h3>
                <div class="number">${stats.approved}</div>
            </div>
            <div class="stat-card rejected">
                <h3>已驳回</h3>
                <div class="number">${stats.rejected}</div>
            </div>
            <div class="stat-card breaking">
                <h3>破坏性变更</h3>
                <div class="number">${stats.breaking_changes}</div>
            </div>
        `;
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

async function loadReviews() {
    try {
        const response = await fetch('/api/reviews');
        const reviews = await response.json();
        
        const tbody = document.getElementById('reviews-body');
        tbody.innerHTML = reviews.map(review => `
            <tr>
                <td>${review.id}</td>
                <td>v${review.old_version} → v${review.new_version}</td>
                <td><span class="status-badge status-${review.status}">${review.status}</span></td>
                <td>${review.changes_count}</td>
                <td>${review.breaking_count}</td>
                <td>${review.created_at}</td>
                <td>
                    <a href="/review/${review.id}" class="btn btn-primary btn-small">查看详情</a>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载审查列表失败:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadReviews();
});
