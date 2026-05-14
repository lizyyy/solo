async function loadReviewDetail() {
    try {
        const response = await fetch(`/api/reviews/${reviewId}`);
        const review = await response.json();
        
        document.getElementById('review-id').textContent = review.id;
        document.getElementById('old-version').textContent = `v${review.old_spec.version}`;
        document.getElementById('new-version').textContent = `v${review.new_spec.version}`;
        
        const statusBadge = document.getElementById('review-status');
        statusBadge.textContent = review.status;
        statusBadge.className = `status-badge status-${review.status}`;
        
        document.getElementById('report-link').href = `/api/reviews/${reviewId}/report`;
        
        const summaryBox = document.getElementById('summary-box');
        summaryBox.innerHTML = `
            <div class="summary-item">
                <div class="label">总变更数</div>
                <div class="value">${review.summary.total}</div>
            </div>
            <div class="summary-item breaking">
                <div class="label">破坏性变更</div>
                <div class="value">${review.summary.breaking}</div>
            </div>
            <div class="summary-item non-breaking">
                <div class="label">非破坏性变更</div>
                <div class="value">${review.summary.non_breaking}</div>
            </div>
        `;
        
        const changesList = document.getElementById('changes-list');
        changesList.innerHTML = review.changes.map(change => `
            <div class="change-item ${change.is_breaking ? 'breaking' : ''}">
                <div class="change-path">${change.path} ${change.method || ''}</div>
                <div class="change-desc">${change.description}</div>
                <span class="change-severity ${change.severity}">${change.severity.toUpperCase()}</span>
            </div>
        `).join('');
        
        const timelineList = document.getElementById('timeline-list');
        timelineList.innerHTML = review.timeline.map(item => `
            <div class="timeline-item ${item.actor === 'system' ? 'system' : ''}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-event">${item.description}</div>
                    <div class="timeline-time">${item.created_at}</div>
                    ${item.actor !== 'system' ? `<div class="timeline-actor">由 ${item.actor} 操作</div>` : ''}
                </div>
            </div>
        `).join('');
        
        const approvalsList = document.getElementById('approvals-list');
        if (review.approvals.length > 0) {
            approvalsList.innerHTML = review.approvals.map(approval => `
                <div class="change-item">
                    <div class="change-desc">
                        <strong>${approval.approver}</strong> 
                        ${approval.approved ? '✅ 通过' : '❌ 驳回'}
                    </div>
                    <div style="margin-top: 8px; font-size: 13px; color: #666;">
                        ${approval.reason}
                    </div>
                    <div class="timeline-time" style="margin-top: 8px;">${approval.created_at}</div>
                </div>
            `).join('');
        } else {
            approvalsList.innerHTML = '<p style="color: #999;">暂无审批记录</p>';
        }
        
    } catch (error) {
        console.error('加载审查详情失败:', error);
    }
}

async function submitApproval(approved) {
    const approver = document.getElementById('approver-name').value.trim();
    const reason = document.getElementById('approval-reason').value.trim();
    
    if (!approver) {
        alert('请输入审批人姓名');
        return;
    }
    if (!reason) {
        alert('请输入审批理由');
        return;
    }
    
    try {
        const response = await fetch(`/api/reviews/${reviewId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                approved: approved,
                approver: approver,
                reason: reason
            })
        });
        
        const result = await response.json();
        if (response.ok) {
            alert(`审批成功！状态已更新为 ${result.status}`);
            loadReviewDetail();
        } else {
            alert('审批失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('提交审批失败:', error);
        alert('提交审批失败');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadReviewDetail();
});
