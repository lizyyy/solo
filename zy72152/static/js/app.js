let state = { spots: [], approval_records: [], conflicts: [], merge_reports: [], snapshots: [], duplicates: [], overflow: [] };

async function fetchState() {
    const resp = await fetch("/api/state");
    state = await resp.json();
    renderAll();
}

function toast(msg, type = "") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast" + (type ? " " + type : "");
    setTimeout(() => { el.className = "toast hidden"; }, 3000);
}

function showModal(title, bodyHtml, onConfirm) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("modal-overlay").classList.remove("hidden");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const cleanup = () => { document.getElementById("modal-overlay").classList.add("hidden"); confirmBtn.onclick = null; };
    confirmBtn.onclick = () => { if (onConfirm) onConfirm(); cleanup(); };
    cancelBtn.onclick = cleanup;
}

document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
});

document.getElementById("btn-load-sample").addEventListener("click", async () => {
    const resp = await fetch("/api/load-sample", { method: "POST" });
    const data = await resp.json();
    document.getElementById("sample-result").textContent =
        `样例加载完成：${data.spots} 条点位，${data.records} 条审批记录，${data.conflicts} 条冲突`;
    toast("样例数据已加载", "success");
    await fetchState();
});

document.getElementById("form-import-spots").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const resp = await fetch("/api/import/spots", { method: "POST", body: formData });
    const data = await resp.json();
    document.getElementById("import-spots-result").textContent =
        `导入 ${data.added} 条，归并后 ${data.merged_total} 条\n` +
        (data.merge_report || []).map(r => `[${r.动作}] ${r.路口名称}：${r.说明}`).join("\n") +
        (data.duplicates && data.duplicates.length ? "\n重复投诉：" + data.duplicates.map(d => d.说明).join("；") : "");
    toast("点位导入完成", "success");
    await fetchState();
});

document.getElementById("form-import-approval").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const resp = await fetch("/api/import/approval", { method: "POST", body: formData });
    const data = await resp.json();
    document.getElementById("import-approval-result").textContent =
        `导入 ${data.imported} 条审批记录，发现 ${data.conflicts_count} 条冲突`;
    toast("审批台账导入完成", "success");
    await fetchState();
});

document.getElementById("form-photo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const spotId = document.getElementById("photo-spot-id").value;
    if (!spotId) { toast("请选择点位", "error"); return; }
    const formData = new FormData(e.target);
    formData.set("spot_id", spotId);
    const resp = await fetch(`/api/photo/${spotId}`, { method: "POST", body: formData });
    const data = await resp.json();
    document.getElementById("photo-result").textContent = data.status === "ok" ? `照片已上传：${data.filename}` : data.error;
    toast("照片已补充", "success");
    await fetchState();
});

document.getElementById("btn-reset").addEventListener("click", async () => {
    showModal("确认重置", "<p>将清空所有导入的数据，此操作不可撤销。</p>", async () => {
        await fetch("/api/reset", { method: "POST" });
        toast("数据已重置", "success");
        await fetchState();
    });
});

document.getElementById("btn-supplement").addEventListener("click", async () => {
    const spotId = document.getElementById("supplement-spot-id").value;
    const note = document.getElementById("supplement-note").value.trim();
    if (!spotId || !note) { toast("请选择点位并输入备注", "error"); return; }

    const resp = await fetch(`/api/supplement/${spotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
    });
    const data = await resp.json();

    if (data.diff) {
        document.getElementById("diff-report").textContent = data.diff;
        document.getElementById("supplement-result").textContent = "补录完成，差异已生成";
    }
    toast("补录完成", "success");
    document.getElementById("supplement-note").value = "";
    await fetchState();
});

document.getElementById("btn-export-public").addEventListener("click", () => {
    const status = document.getElementById("export-status-filter").value;
    window.location.href = `/api/export/public?status=${status}`;
});

document.getElementById("btn-export-conflicts").addEventListener("click", () => {
    window.location.href = "/api/export/conflicts";
});

document.getElementById("btn-export-diff").addEventListener("click", () => {
    window.location.href = "/api/export/diff";
});

document.getElementById("filter-status").addEventListener("change", renderReviewTable);
document.getElementById("filter-intersection").addEventListener("input", renderReviewTable);

let selectedSpotId = null;

function renderAll() {
    renderReviewTable();
    renderConflicts();
    renderOverflow();
    renderMergeReport();
    renderDuplicates();
    populateSpotSelectors();
}

function populateSpotSelectors() {
    const selects = [document.getElementById("photo-spot-id"), document.getElementById("supplement-spot-id")];
    selects.forEach(sel => {
        const current = sel.value;
        sel.innerHTML = '<option value="">选择点位</option>';
        state.spots.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = `${s.点位名称 || s.路口名称} (${s.id})`;
            sel.appendChild(opt);
        });
        sel.value = current;
    });
}

function renderReviewTable() {
    const statusFilter = document.getElementById("filter-status").value;
    const intersectionFilter = document.getElementById("filter-intersection").value.trim();

    let filtered = state.spots;
    if (statusFilter) filtered = filtered.filter(s => s.审核状态 === statusFilter);
    if (intersectionFilter) filtered = filtered.filter(s => s.路口名称.includes(intersectionFilter));

    const conflictIds = new Set(state.conflicts.map(c => c.点位id));

    const tbody = document.querySelector("#review-table tbody");
    tbody.innerHTML = "";

    filtered.forEach(s => {
        const tr = document.createElement("tr");
        if (s.id === selectedSpotId) tr.classList.add("selected");
        const hasConflict = conflictIds.has(s.id);

        const badgeClass = s.审核状态 === "已通过" ? "badge-approved" :
                          s.审核状态 === "已驳回" ? "badge-rejected" : "badge-pending";

        tr.innerHTML = `
            <td>${s.id}</td>
            <td>${s.点位名称}</td>
            <td>${s.路口名称} ${hasConflict ? '<span class="badge badge-conflict">冲突</span>' : ''}</td>
            <td>${s.小区名称}</td>
            <td>${s.时段}</td>
            <td>${s.容量}</td>
            <td>${s.数据时段}</td>
            <td>${s.来源}</td>
            <td><span class="badge ${badgeClass}">${s.审核状态}</span></td>
            <td>
                <button class="btn sm approve" onclick="reviewAction('${s.id}','approve')">通过</button>
                <button class="btn sm reject" onclick="reviewAction('${s.id}','reject')">驳回</button>
                <button class="btn sm" onclick="showTrace('${s.id}')">来源</button>
            </td>
        `;
        tr.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") return;
            selectedSpotId = s.id;
            showTrace(s.id);
            renderReviewTable();
        });
        tbody.appendChild(tr);
    });
}

async function reviewAction(spotId, action) {
    showModal("审核确认", `<p>确认将此点位标记为「${action === "approve" ? "已通过" : "已驳回"}」？</p>
        <textarea id="review-note-input" rows="2" placeholder="可选：添加审核备注" style="width:100%;margin-top:8px;"></textarea>`,
        async () => {
            const note = document.getElementById("review-note-input").value.trim();
            await fetch(`/api/review/${spotId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, note }),
            });
            toast("审核完成", "success");
            await fetchState();
        });
}

function showTrace(spotId) {
    const spot = state.spots.find(s => s.id === spotId);
    if (!spot) return;

    const el = document.getElementById("trace-detail");
    const conflicts = state.conflicts.filter(c => c.点位id === spotId);
    const snapshots = (state.snapshots || []).filter(s => s.记录id === spotId);

    let html = `<dl>
        <dt>ID</dt><dd>${spot.id}</dd>
        <dt>点位名称</dt><dd>${spot.点位名称}</dd>
        <dt>路口名称</dt><dd>${spot.路口名称}</dd>
        <dt>小区</dt><dd>${spot.小区名称}</dd>
        <dt>时段</dt><dd>${spot.时段}</dd>
        <dt>容量</dt><dd>${spot.容量}</dd>
        <dt>数据时段</dt><dd>${spot.数据时段}</dd>
        <dt>来源</dt><dd>${spot.来源}</dd>
        <dt>来源详情</dt><dd style="white-space:pre-wrap">${spot.来源详情}</dd>
        <dt>备注</dt><dd>${spot.备注 || "无"}</dd>
        <dt>补录备注</dt><dd>${spot.补录备注 || "无"}</dd>
        <dt>照片</dt><dd>${(spot.照片 || []).join("、") || "无"}</dd>
        <dt>审核状态</dt><dd>${spot.审核状态}</dd>
        <dt>来源批次</dt><dd>${spot.来源批次}</dd>
    </dl>`;

    if (conflicts.length) {
        html += `<h4 style="margin-top:12px">⚠️ 关联冲突</h4>`;
        conflicts.forEach(c => {
            html += `<div style="padding:8px;margin:4px 0;background:#fef3c7;border-radius:4px;font-size:13px">
                [${c.类型}] ${c.冲突描述}<br>
                <strong>建议：</strong>${c.建议动作}
            </div>`;
        });
    }

    if (snapshots.length) {
        html += `<h4 style="margin-top:12px">📝 操作记录</h4>`;
        snapshots.forEach(s => {
            html += `<div style="padding:4px 0;font-size:13px;color:#6b7280">${s.时间戳} · ${s.操作}</div>`;
        });
    }

    el.innerHTML = html;
}

function renderConflicts() {
    const el = document.getElementById("conflict-list");
    if (!state.conflicts || state.conflicts.length === 0) {
        el.innerHTML = '<p style="color:#6b7280">暂无冲突，导入审批台账后将自动检测</p>';
        return;
    }

    el.innerHTML = state.conflicts.map(c => {
        const typeIcon = c.类型 === "容量超限" ? "🔴" :
                        c.类型 === "时段冲突" ? "🟠" :
                        c.类型 === "时段差异" ? "🟡" : "🔵";
        return `
        <div class="conflict-card">
            <h4>${typeIcon} ${c.类型}</h4>
            <div class="desc">${c.冲突描述}</div>
            <div class="evidence">
                <div class="evidence-box evidence-a">
                    <div class="label">📊 导入数据方</div>
                    <div>${c.证据A.字段}：${c.证据A.值}</div>
                    <div style="font-size:12px;color:#6b7280">来源：${c.证据A.来源}</div>
                </div>
                <div class="evidence-box evidence-b">
                    <div class="label">📋 审批台账方</div>
                    <div>${c.证据B.字段}：${c.证据B.值}</div>
                    <div style="font-size:12px;color:#6b7280">来源：${c.证据B.来源}</div>
                </div>
            </div>
            <div class="suggestion">💡 建议：${c.建议动作}</div>
            <div style="display:flex;gap:8px;align-items:center">
                <span class="badge ${c.状态 === '已处理' ? 'badge-approved' : 'badge-pending'}">${c.状态}</span>
                ${c.状态 === "待处理" ? `
                    <button class="btn sm" onclick="resolveConflict('${c.id}','resolve')">标记已处理</button>
                    <button class="btn sm" onclick="resolveConflict('${c.id}','ignore')">忽略</button>
                ` : ""}
                ${c.处理备注 ? `<span style="font-size:13px;color:#6b7280">备注：${c.处理备注}</span>` : ""}
            </div>
        </div>`;
    }).join("");
}

async function resolveConflict(conflictId, action) {
    const label = action === "resolve" ? "已处理" : "已忽略";
    showModal("处理冲突", `<p>将此冲突标记为「${label}」</p>
        <textarea id="conflict-note-input" rows="2" placeholder="可选：添加处理备注" style="width:100%;margin-top:8px;"></textarea>`,
        async () => {
            const note = document.getElementById("conflict-note-input").value.trim();
            await fetch(`/api/conflict/${conflictId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, note }),
            });
            toast("冲突已处理", "success");
            await fetchState();
        });
}

function renderOverflow() {
    const el = document.getElementById("overflow-list");
    if (!state.overflow || state.overflow.length === 0) {
        el.innerHTML = '<p style="color:#6b7280">暂无容量异常</p>';
        return;
    }
    el.innerHTML = state.overflow.map(o =>
        `<div class="overflow-item">
            <strong>${o.点位名称}</strong>：${o.问题}<br>
            💡 ${o.建议}
        </div>`
    ).join("");
}

function renderMergeReport() {
    const el = document.getElementById("merge-report");
    if (!state.merge_reports || state.merge_reports.length === 0) {
        el.textContent = "暂无归并报告，请先导入数据";
        return;
    }
    el.textContent = state.merge_reports.map(r => `[${r.动作}] ${r.路口名称}：${r.说明}`).join("\n");
}

function renderDuplicates() {
    const el = document.getElementById("duplicate-report");
    if (!state.duplicates || state.duplicates.length === 0) {
        el.textContent = "暂无重复投诉";
        return;
    }
    el.textContent = state.duplicates.map(d => `[重复] ${d.说明}`).join("\n");
}

fetchState();
