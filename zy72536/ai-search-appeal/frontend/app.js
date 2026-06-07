const API_BASE = "";
let currentTicketId = null;

document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initTabs();
    initImportForm();
    loadTickets();
    loadVersions();
});

function initNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const view = btn.dataset.view;
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            showView(view);
        });
    });
}

function showView(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");

    if (view === "tickets") loadTickets();
    if (view === "compare") loadVersions();
}

function initTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.getElementById(`tab-${tab}`).classList.add("active");
        });
    });
}

async function apiCall(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            headers: { "Content-Type": "application/json", ...options.headers },
            ...options
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error("API Error:", err);
        alert("请求失败: " + err.message);
        throw err;
    }
}

async function loadTickets() {
    const status = document.getElementById("status-filter").value;
    let url = "/tickets/";
    if (status) url += `?status=${encodeURIComponent(status)}`;

    const tickets = await apiCall(url);
    const tbody = document.getElementById("tickets-body");

    if (tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">暂无工单数据，点击"导入工单"开始</td></tr>`;
        return;
    }

    tbody.innerHTML = tickets.map(t => `
        <tr>
            <td><strong>${escapeHtml(t.ticket_no)}</strong></td>
            <td><span class="ticket-source">${escapeHtml(t.source)}</span></td>
            <td>${t.original_row_no}</td>
            <td>${t.samples.length}</td>
            <td>${statusBadge(t.status)}</td>
            <td>${escapeHtml(t.handler || "-")}</td>
            <td>${formatDate(t.created_at)}</td>
            <td>
                <button class="btn btn-primary" style="padding:4px 10px;font-size:12px;" onclick="viewTicket(${t.id})">查看</button>
            </td>
        </tr>
    `).join("");
}

async function viewTicket(ticketId) {
    currentTicketId = ticketId;
    const ticket = await apiCall(`/tickets/${ticketId}`);

    document.getElementById("detail-title").textContent = `工单详情 - ${ticket.ticket_no}`;
    document.getElementById("desensitization-note").value = ticket.desensitization_note || "";

    document.getElementById("ticket-info").innerHTML = `
        <div class="info-item">
            <span class="info-label">工单编号</span>
            <span class="info-value">${escapeHtml(ticket.ticket_no)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">来源</span>
            <span class="info-value">${escapeHtml(ticket.source)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">原始行号</span>
            <span class="info-value">${ticket.original_row_no}</span>
        </div>
        <div class="info-item">
            <span class="info-label">样本数</span>
            <span class="info-value">${ticket.samples.length}</span>
        </div>
        <div class="info-item">
            <span class="info-label">状态</span>
            <span class="info-value">${statusBadge(ticket.status)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">处理人</span>
            <span class="info-value">${escapeHtml(ticket.handler || "未分配")}</span>
        </div>
        <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value">${formatDate(ticket.created_at)}</span>
        </div>
    `;

    renderSamples(ticket.samples);
    loadSelfCheckResults();
    loadAuditLogs();

    showView("ticket-detail");
}

function renderSamples(samples) {
    const tbody = document.getElementById("samples-body");

    if (samples.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state">暂无样本</td></tr>`;
        return;
    }

    tbody.innerHTML = samples.map(s => `
        <tr style="${s.is_hidden_by_avg ? 'background: #fffaf0;' : ''}">
            <td><strong>${escapeHtml(s.sample_no)}</strong></td>
            <td>${escapeHtml(s.query)}</td>
            <td title="${escapeHtml(s.doc_url)}">${escapeHtml(s.doc_title.substring(0, 30))}${s.doc_title.length > 30 ? '...' : ''}</td>
            <td>${s.original_rank}</td>
            <td><strong>${s.current_rank || '-'}</strong></td>
            <td style="color: ${s.confidence < 0.6 ? '#e53e3e' : '#38a169'}">${(s.confidence * 100).toFixed(1)}%</td>
            <td>${s.is_low_confidence ? '<span class="badge badge-warning">是</span>' : '<span class="badge badge-normal">否</span>'}</td>
            <td>${s.is_hidden_by_avg ? '<span class="badge badge-warning">是 ⚠️</span>' : '<span class="badge badge-normal">否</span>'}</td>
            <td>${sampleStatusBadge(s.status)}</td>
            <td>
                <button class="btn btn-primary" style="padding:4px 10px;font-size:12px;" onclick="editSample(${s.id})">编辑</button>
            </td>
        </tr>
    `).join("");
}

async function loadSelfCheckResults() {
    const results = await apiCall(`/tickets/${currentTicketId}/self-check`);
    const container = document.getElementById("self-check-results");

    if (results.length === 0) {
        container.innerHTML = `<div class="empty-state">暂无自检结果，点击"运行自检"开始</div>`;
        return;
    }

    container.innerHTML = results.map(r => `
        <div class="check-item ${r.passed ? 'passed' : 'failed'}">
            <div class="check-header">
                <span class="check-name">${escapeHtml(r.check_type)}</span>
                <span class="check-status ${r.passed ? 'passed' : 'failed'}">${r.passed ? '✅ 通过' : '❌ 失败'}</span>
            </div>
            <div class="check-details">${formatCheckDetails(r.details)}</div>
        </div>
    `).join("");
}

async function loadAuditLogs() {
    const logs = await apiCall(`/tickets/${currentTicketId}/audit-logs`);
    const tbody = document.getElementById("audit-body");

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">暂无审计记录</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr>
            <td>${formatDate(l.created_at)}</td>
            <td><strong>${escapeHtml(l.action)}</strong></td>
            <td>${escapeHtml(l.operator)}</td>
            <td><code>${escapeHtml(JSON.stringify(l.before_value || {}))}</code></td>
            <td><code>${escapeHtml(JSON.stringify(l.after_value || {}))}</code></td>
            <td>${escapeHtml(l.note || '-')}</td>
        </tr>
    `).join("");
}

async function runSelfCheck() {
    if (!currentTicketId) return;
    await apiCall(`/tickets/${currentTicketId}/self-check`, { method: "POST" });
    loadSelfCheckResults();
    alert("自检完成！");
}

async function recalculate() {
    if (!currentTicketId) return;
    const result = await apiCall(`/tickets/${currentTicketId}/recalculate`, { method: "POST" });
    const ticket = await apiCall(`/tickets/${currentTicketId}`);
    renderSamples(ticket.samples);
    loadAuditLogs();
    alert(`重算完成！重算 ${result.recalculated_count} 条，其中 ${result.hidden_by_avg_count} 条被平均指标盖住`);
}

async function exportTicket() {
    if (!currentTicketId) return;
    window.location.href = API_BASE + `/tickets/${currentTicketId}/export`;
}

async function saveDesensitizationNote() {
    if (!currentTicketId) return;
    const note = document.getElementById("desensitization-note").value;
    await apiCall(`/tickets/${currentTicketId}`, {
        method: "PUT",
        body: JSON.stringify({ desensitization_note: note })
    });
    loadAuditLogs();
    alert("脱敏规则备注已保存！");
}

async function editSample(sampleId) {
    const sample = await apiCall(`/samples/${sampleId}`);
    document.getElementById("edit-sample-id").value = sample.id;
    document.getElementById("edit-expected-rank").value = sample.expected_rank || "";
    document.getElementById("edit-status").value = sample.status;
    document.getElementById("edit-manual-note").value = sample.manual_note || "";
    document.getElementById("edit-is-hidden").checked = sample.is_hidden_by_avg;
    document.getElementById("sample-modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("sample-modal").style.display = "none";
}

async function saveSample() {
    const sampleId = document.getElementById("edit-sample-id").value;
    const data = {
        expected_rank: document.getElementById("edit-expected-rank").value ? parseInt(document.getElementById("edit-expected-rank").value) : null,
        status: document.getElementById("edit-status").value,
        manual_note: document.getElementById("edit-manual-note").value || null,
        is_hidden_by_avg: document.getElementById("edit-is-hidden").checked
    };

    await apiCall(`/samples/${sampleId}`, {
        method: "PUT",
        body: JSON.stringify(data)
    });

    closeModal();
    const ticket = await apiCall(`/tickets/${currentTicketId}`);
    renderSamples(ticket.samples);
    loadAuditLogs();
}

async function loadVersions() {
    const versions = await apiCall("/versions/");
    const v1Select = document.getElementById("version1-select");
    const v2Select = document.getElementById("version2-select");

    const options = versions.map(v => `<option value="${v.id}">${escapeHtml(v.version_name)}</option>`).join("");
    v1Select.innerHTML = options;
    v2Select.innerHTML = options;

    if (versions.length >= 2) {
        v2Select.selectedIndex = 1;
        updateCompare();
    }
}

async function updateCompare() {
    const v1 = document.getElementById("version1-select").value;
    const v2 = document.getElementById("version2-select").value;

    if (!v1 || !v2 || v1 === v2) {
        document.getElementById("compare-body").innerHTML = `<tr><td colspan="9" class="empty-state">请选择两个不同的版本</td></tr>`;
        return;
    }

    const result = await apiCall(`/versions/compare/${v1}/${v2}`);

    document.getElementById("v1-header").textContent = result.version1 + " 排名";
    document.getElementById("v2-header").textContent = result.version2 + " 排名";

    document.getElementById("compare-summary").innerHTML = `
        <div class="summary-item">
            <div class="summary-value">${result.total_count}</div>
            <div class="summary-label">总样本数</div>
        </div>
        <div class="summary-item">
            <div class="summary-value" style="color: #ed8936;">${result.pending_review_count}</div>
            <div class="summary-label">待复核</div>
        </div>
        <div class="summary-item">
            <div class="summary-value" style="color: #4299e1;">${result.from_ticket_count}</div>
            <div class="summary-label">来自线上反馈工单</div>
        </div>
    `;

    const tbody = document.getElementById("compare-body");
    tbody.innerHTML = result.items.map(item => {
        const changeClass = item.rank_change > 0 ? "change-negative" : item.rank_change < 0 ? "change-positive" : "change-zero";
        const changeText = item.rank_change === null ? "-" : (item.rank_change > 0 ? "+" : "") + item.rank_change;

        return `
        <tr style="${item.is_hidden_by_avg ? 'background: #fffaf0;' : ''}">
            <td><strong>${escapeHtml(item.sample_no)}</strong></td>
            <td>${escapeHtml(item.query)}</td>
            <td><span class="ticket-source">${escapeHtml(item.from_source)}</span></td>
            <td>${sampleStatusBadge(item.status)}</td>
            <td>${item.v1_rank || '-'}</td>
            <td>${item.v2_rank || '-'}</td>
            <td class="${changeClass}">${changeText}</td>
            <td>${item.is_low_confidence ? '<span class="badge badge-warning">是</span>' : '<span class="badge badge-normal">否</span>'}</td>
            <td>${item.is_hidden_by_avg ? '<span class="badge badge-warning">是 ⚠️</span>' : '<span class="badge badge-normal">否</span>'}</td>
        </tr>
    `}).join("");
}

function initImportForm() {
    document.getElementById("import-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append("file", document.getElementById("import-file").files[0]);
        formData.append("ticket_no", document.getElementById("import-ticket-no").value);
        formData.append("original_row_start", document.getElementById("import-row-start").value);
        formData.append("operator", document.getElementById("import-operator").value);

        try {
            const response = await fetch(API_BASE + "/tickets/import", {
                method: "POST",
                body: formData
            });
            const result = await response.json();

            const resultDiv = document.getElementById("import-result");
            resultDiv.style.display = "block";
            resultDiv.innerHTML = `
                <h4>✅ 导入成功！</h4>
                <ul>
                    <li>工单编号: ${escapeHtml(result.ticket_no)}</li>
                    <li>导入样本数: ${result.samples_count}</li>
                    ${result.warnings.length > 0 ? `<li>警告: ${result.warnings.join(", ")}</li>` : ''}
                </ul>
                <button class="btn btn-primary" style="margin-top:10px;" onclick="viewTicket(${result.ticket_id})">查看工单</button>
            `;
        } catch (err) {
            alert("导入失败: " + err.message);
        }
    });
}

function statusBadge(status) {
    const map = {
        "待处理": "badge-pending",
        "处理中": "badge-processing",
        "已完成": "badge-completed"
    };
    return `<span class="badge ${map[status] || 'badge-pending'}">${escapeHtml(status)}</span>`;
}

function sampleStatusBadge(status) {
    const map = {
        "待复核": "badge-review",
        "正常": "badge-normal",
        "已确认": "badge-confirmed"
    };
    return `<span class="badge ${map[status] || 'badge-review'}">${escapeHtml(status)}</span>`;
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatCheckDetails(details) {
    if (!details) return "";
    try {
        const entries = Object.entries(details).filter(([k]) => k !== "passed");
        return entries.map(([k, v]) => {
            if (Array.isArray(v) && v.length > 0) {
                return `${k}: ${JSON.stringify(v)}`;
            }
            if (typeof v === "object" && v !== null) {
                return `${k}: ${JSON.stringify(v)}`;
            }
            return `${k}: ${v}`;
        }).join("\n");
    } catch {
        return JSON.stringify(details);
    }
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

window.onclick = (e) => {
    const modal = document.getElementById("sample-modal");
    if (e.target === modal) closeModal();
};
