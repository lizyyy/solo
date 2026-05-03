function applyFilters() {
    if (!AppState.posts || AppState.posts.length === 0) {
        showToast('没有数据可筛选', 'warning');
        return;
    }
    
    const platform = document.getElementById('filterPlatform')?.value || 'all';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';
    const sortBy = document.getElementById('sortBy')?.value || 'exposure_desc';
    
    let filtered = [...AppState.posts];
    
    if (platform !== 'all') {
        filtered = filtered.filter(p => p.platform === platform);
    }
    
    if (startDate) {
        filtered = filtered.filter(p => p.publish_date >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(p => p.publish_date <= endDate);
    }
    
    filtered = sortPosts(filtered, sortBy);
    
    AppState.filteredPosts = filtered;
    
    if (window.calculateFunnelMetrics) {
        calculateFunnelMetrics();
    }
    if (window.renderFunnelChart) {
        renderFunnelChart();
    }
    
    renderPostsTable();
    updateOverviewStats();
    
    showToast(`筛选完成，共 ${filtered.length} 条记录`, 'success');
}

function sortPosts(posts, sortBy) {
    const sorted = [...posts];
    
    switch (sortBy) {
        case 'exposure_desc':
            sorted.sort((a, b) => b.exposure - a.exposure);
            break;
        case 'exposure_asc':
            sorted.sort((a, b) => a.exposure - b.exposure);
            break;
        case 'plays_desc':
            sorted.sort((a, b) => b.plays - a.plays);
            break;
        case 'plays_asc':
            sorted.sort((a, b) => a.plays - b.plays);
            break;
        case 'completion_rate_desc':
            sorted.sort((a, b) => (b.completion_rate || 0) - (a.completion_rate || 0));
            break;
        case 'completion_rate_asc':
            sorted.sort((a, b) => (a.completion_rate || 0) - (b.completion_rate || 0));
            break;
        case 'engagement_rate_desc':
            sorted.sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
            break;
        case 'engagement_rate_asc':
            sorted.sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0));
            break;
        case 'publish_date_desc':
            sorted.sort((a, b) => {
                const dateA = a.publish_date ? new Date(a.publish_date).getTime() : 0;
                const dateB = b.publish_date ? new Date(b.publish_date).getTime() : 0;
                return dateB - dateA;
            });
            break;
        case 'publish_date_asc':
            sorted.sort((a, b) => {
                const dateA = a.publish_date ? new Date(a.publish_date).getTime() : 0;
                const dateB = b.publish_date ? new Date(b.publish_date).getTime() : 0;
                return dateA - dateB;
            });
            break;
        default:
            sorted.sort((a, b) => b.exposure - a.exposure);
    }
    
    return sorted;
}

function renderPostsTable() {
    const tbody = document.getElementById('postsTableBody');
    if (!tbody) return;
    
    const posts = AppState.filteredPosts.length > 0 ? AppState.filteredPosts : AppState.posts;
    
    if (posts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = posts.map(post => {
        const platformClass = getPlatformBadgeClass(post.platform);
        const platformName = getPlatformName(post.platform);
        
        const completionRateClass = getRateClass(post.completion_rate || 0, 'completion_rate');
        const engagementRateClass = getRateClass(post.engagement_rate || 0, 'engagement_rate');
        
        let statusIcon = '';
        if (post.isViral) {
            statusIcon = '<span title="爆款" style="color: #f59e0b;">🔥</span>';
        } else if (post.isFlop) {
            statusIcon = '<span title="扑街" style="color: #ef4444;">📉</span>';
        }
        
        return `
            <tr>
                <td>${post.post_id || '-'}</td>
                <td><span class="platform-badge ${platformClass}">${platformName}</span></td>
                <td title="${post.title || ''}">${(post.title || '').substring(0, 30)}${(post.title || '').length > 30 ? '...' : ''}</td>
                <td>${post.publish_date || '-'} ${post.publish_hour ? post.publish_hour + ':00' : ''}</td>
                <td>${formatNumber(post.exposure || 0)}</td>
                <td>${formatNumber(post.plays || 0)}</td>
                <td><span class="${completionRateClass}">${formatRate(post.completion_rate || 0)}</span></td>
                <td><span class="${engagementRateClass}">${formatRate(post.engagement_rate || 0)}</span></td>
                <td>${formatNumber(post.favorites || 0)}</td>
                <td>${formatNumber(post.conversions || 0)}</td>
                <td>${statusIcon} ${post.status || '-'}</td>
            </tr>
        `;
    }).join('');
}
