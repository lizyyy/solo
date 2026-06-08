const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const api = (url, opts = {}) => fetch(url, { headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

let ENUMS = {};
let LAST_BATCH_ID = null;

const statusClass = s => `status-pill status-${s}`;
const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

function materialTypeCN(t) {
  return (ENUMS.material_types && ENUMS.material_types[t]) || t;
}
function statusCN(s) {
  return (ENUMS.statuses && ENUMS.statuses[s]) || s;
}

function toast(el, msg, ok = true) {
  if (!el) return;
  el.textContent = msg;
  el.className = "result-box" + (ok ? "" : " empty");
  if (!ok) el.style.display = "none";
}

async function loadEnums() {
  ENUMS = await api("/api/enums");
  const sel = $("#filter-status");
  Object.entries(ENUMS.statuses || {}).forEach(([k, v]) => {
    const o = document.createElement("option");
    o.value = k; o.textContent = `${v} (${k})`;
    sel.appendChild(o);
  });
}

async function loadDashboard() {
  const d = await api("/api/dashboard");
  $("#dash-total").textContent = `记录总数: ${d.total_records}`;
  $("#dash-vac").textContent = `疫苗缺失: ${d.vaccine_missing}`;
}

async function loadBatches() {
  const list = await api("/api/batches");
  LAST_BATCH_ID = list[0]?.id || null;
  ["#filter-batch", "#export-batch"].forEach(sel => {
    const el = $(sel);
    const current = el.value;
    el.innerHTML = '<option value="">全部</option>';
    list.forEach(b => {
      const o = document.createElement("option");
      o.value = b.id;
      o.textContent = `${b.batch_no} · ${b.operator || ""} ${b.remark ? "· " + b.remark : ""}`;
      el.appendChild(o);
    });
    if (current) el.value = current;
  });

  const tb = $("#batch-table tbody");
  tb.innerHTML = "";
  list.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.id}</td>
      <td>${safe(b.batch_no)}</td>
      <td>${safe(b.operator)}</td>
      <td>${safe(b.remark || "")}</td>
      <td>${safe(b.created_at)}</td>
      <td>
        <button class="btn btn-primary" data-rerun="${b.id}">🔁 重跑</button>
      </td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll("[data-rerun]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("确认重跑该批次？会版本+1，保留历史备注/快照关联。")) return;
      const res = await api(`/api/batches/${btn.dataset.rerun}/rerun`, { method: "POST", body: "{}" });
      toast($("#import-result"), "✅ 重跑完成\n" + JSON.stringify(res, null, 2));
      refreshAll();
    };
  });
}

function renderRecords(list, container) {
  if (!list.length) {
    container.innerHTML = '<div style="color:#a0aec0;padding:16px;">暂无记录</div>';
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="record-card" data-id="${r.id}">
      <div class="title">
        <h4>🐾 ${safe(r.cat_name)}${r.is_vaccine_missing ? '<span class="vac-badge">疫苗缺失</span>' : ""}</h4>
        <span class="${statusClass(r.status)}">${safe(statusCN(r.status))}</span>
      </div>
      <div class="meta">
        ${r.foster_no ? "寄养编号 " + safe(r.foster_no) + " · " : ""}
        版本 v${r.version} · 批次 ${safe(r.batch_no || "-")}
      </div>
      <div class="issue">${safe(r.litter_box_issue)}</div>
      ${r.screenshot_note ? `<div class="mtrace" style="background:#eef2ff;color:#434190;">📷 截图说明：${safe(r.screenshot_note)}</div>` : ""}
      ${r.material_trace ? `<div class="mtrace">🔗 材料追溯：${safe(r.material_trace)}</div>` : ""}
    </div>
  `).join("");
  container.querySelectorAll(".record-card").forEach(c => {
    c.onclick = () => openDetail(+c.dataset.id);
  });
}

async function loadRecords() {
  const status = $("#filter-status").value || undefined;
  const batch_id = $("#filter-batch").value || undefined;
  const vacOnly = false;
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (batch_id) params.set("batch_id", batch_id);
  if (vacOnly) params.set("vaccine_missing_only", "1");
  const list = await api("/api/records" + (params.toString() ? "?" + params : ""));
  renderRecords(list, $("#records"));

  const vacList = await api("/api/records?vaccine_missing_only=1" + (batch_id ? "&batch_id=" + batch_id : ""));
  const vacOn = $("#vac-toggle").checked;
  renderRecords(vacOn ? vacList : [], $("#vaccine-records"));
}

async function openDetail(recordId) {
  const r = await api(`/api/records/${recordId}`);
  if (!r || r.error) { alert("记录不存在"); return; }
  $("#modal-title").innerHTML = `详情：${safe(r.cat_name)} · v${r.version}`;

  const materialsHTML = (r.materials || []).map(m => `
    <div class="material-item">
      <strong>${safe(materialTypeCN(m.material_type))}</strong> ·
      <code>${safe(m.source_name || "-")}</code>
      ${m.affects_conclusion ? ' · <span style="color:#c53030;">⚡ 影响结论</span>' : ""}
      <div style="color:#718096;font-size:12px;margin-top:4px;">${safe(m.created_at)}</div>
    </div>`).join("") || '<div style="color:#a0aec0;">无</div>';

  const notesHTML = (r.notes || []).map(n => `
    <div class="note-item">
      <strong>👤 ${safe(n.author)}</strong>${n.protected ? ' · <span style="color:#38a169;">🔒 已保护(不被覆盖)</span>' : ""}
      <div style="margin-top:4px;">${safe(n.content)}</div>
      <div style="color:#718096;font-size:12px;">${safe(n.created_at)}</div>
    </div>`).join("") || '<div style="color:#a0aec0;">无</div>';

  const snapHTML = (r.snapshots || []).map(s => `
    <div class="snapshot-item ${s.record_version === r.version ? "current" : ""}">
      <div>
        <span class="${statusClass(s.status)}">${safe(statusCN(s.status))}</span>
        ${s.record_version === r.version ? ' · <strong style="color:#434190;">当前版本</strong>' : ` · 历史 v${s.record_version}`}
        <span style="color:#718096;font-size:12px;margin-left:8px;">${safe(s.created_at)}</span>
      </div>
      <div style="margin-top:6px;"><strong>📷 截图说明：</strong>${safe(s.screenshot_note)}</div>
      <div style="margin-top:4px;color:#718096;font-size:12px;">
        关联材料ID: ${safe(s.affected_material_ids || "[]")} ·
        关联备注ID: ${safe(s.linked_note_ids || "[]")}
      </div>
    </div>`).join("") || '<div style="color:#a0aec0;">无</div>';

  const statusOptions = Object.entries(ENUMS.statuses || {}).map(([k, v]) =>
    `<option value="${k}" ${k === r.status ? "selected" : ""}>${v}</option>`
  ).join("");

  $("#modal-body").innerHTML = `
    <div class="kv">
      <div>猫名</div><div>${safe(r.cat_name)} (规范化: ${safe(r.cat_name_normalized)})</div>
      <div>寄养编号</div><div>${safe(r.foster_no || "-")}</div>
      <div>疫苗日期</div><div>${r.is_vaccine_missing ? '<span style="color:#c53030;font-weight:600;">缺失⚠️</span>' : safe(r.vaccine_date)}</div>
      <div>异常描述</div><div>${safe(r.litter_box_issue)}</div>
      <div>当前状态</div><div><span class="${statusClass(r.status)}">${safe(statusCN(r.status))}</span></div>
      <div>当前版本</div><div>v${r.version}</div>
      <div>当前截图说明</div><div style="background:#eef2ff;padding:6px 10px;border-radius:6px;">${safe(r.screenshot_note || "-")}</div>
      <div>材料追溯</div><div style="font-size:12px;color:#4a5568;">${safe(r.material_trace || "-")}</div>
    </div>

    <div class="detail-block"><h5>⚡ 状态变更</h5>
      <div class="actions-row">
        <select id="new-status">${statusOptions}</select>
        <input id="status-operator" placeholder="操作人" value="项目经理"/>
        <button class="btn btn-primary" id="btn-save-status">保存状态</button>
      </div>
    </div>

    <div class="detail-block"><h5>📝 添加人工备注（自动保护，重跑不覆盖）</h5>
      <div class="actions-row">
        <input id="note-author" placeholder="备注人" value="项目经理" style="flex:0 0 140px;"/>
        <input id="note-content" placeholder="备注内容..." style="flex:1;"/>
        <button class="btn btn-primary" id="btn-add-note">添加</button>
      </div>
    </div>

    <div class="detail-block"><h5>🧾 材料明细${r.materials?.length ? ` (共${r.materials.length}份)` : ""}</h5>${materialsHTML}</div>
    <div class="detail-block"><h5>💬 人工备注${r.notes?.length ? ` (共${r.notes.length}条)` : ""}</h5>${notesHTML}</div>
    <div class="detail-block"><h5>📸 状态快照（关联不断线）${r.snapshots?.length ? ` (共${r.snapshots.length}条)` : ""}</h5>${snapHTML}</div>
  `;

  $("#modal").classList.remove("hidden");

  $("#btn-save-status").onclick = async () => {
    const ns = $("#new-status").value;
    const op = $("#status-operator").value || "项目经理";
    const res = await api(`/api/records/${recordId}/status`, {
      method: "PUT", body: JSON.stringify({ status: ns, operator: op })
    });
    toast($("#import-result"), "✅ 状态已更新: " + JSON.stringify(res));
    openDetail(recordId); refreshAll();
  };
  $("#btn-add-note").onclick = async () => {
    const content = $("#note-content").value.trim();
    if (!content) return;
    const author = $("#note-author").value || "项目经理";
    const res = await api(`/api/records/${recordId}/notes`, {
      method: "POST", body: JSON.stringify({ content, author })
    });
    $("#note-content").value = "";
    toast($("#import-result"), "✅ 备注已添加: " + JSON.stringify(res));
    openDetail(recordId); refreshAll();
  };
}

async function doImport() {
  const raw = $("#import-json").value.trim();
  if (!raw) { alert("请先粘贴材料 JSON"); return; }
  let items;
  try { items = JSON.parse(raw); }
  catch (e) { alert("JSON 格式错误: " + e.message); return; }
  if (!Array.isArray(items)) { alert("items 必须是数组"); return; }
  const operator = $("#import-operator").value || "系统";
  const remark = $("#import-remark").value || "";
  const res = await api("/api/import", {
    method: "POST",
    body: JSON.stringify({ items, operator, remark, rerun: false })
  });
  toast($("#import-result"), "✅ 导入完成\n" + JSON.stringify(res, null, 2));
  refreshAll();
}

async function doRerunLast() {
  if (!LAST_BATCH_ID) { alert("暂无批次可重跑"); return; }
  if (!confirm(`确认重跑最后一个批次 (#${LAST_BATCH_ID})？`)) return;
  const res = await api(`/api/batches/${LAST_BATCH_ID}/rerun`, { method: "POST", body: "{}" });
  toast($("#import-result"), "✅ 重跑完成\n" + JSON.stringify(res, null, 2));
  refreshAll();
}

async function doExport() {
  const bid = $("#export-batch").value;
  const url = "/api/export" + (bid ? "?batch_id=" + bid : "");
  const data = await api(url);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `猫砂盆异常复核导出-${Date.now()}.json`;
  a.click();
  toast($("#import-result"), `✅ 已导出 ${data.length} 条记录（与接口一致）`);
}

async function doExportCSV() {
  const bid = $("#export-batch").value;
  const url = "/api/export" + (bid ? "?batch_id=" + bid : "");
  const data = await api(url);
  if (!data.length) return;
  const headers = ["batch_no","cat_name","foster_no","litter_box_issue","vaccine_date","is_vaccine_missing","status","status_cn","screenshot_note","record_version","affected_material_ids","linked_note_ids","created_at"];
  const escape = v => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(",")].concat(
    data.map(r => headers.map(h => escape(r[h])).join(","))
  ).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `猫砂盆异常复核导出-${Date.now()}.csv`;
  a.click();
}

async function doSeed() {
  if (!confirm("装载演示数据（包含1条正常、1份旧版登记表、名称不一致材料、口头备注、1条疫苗缺失）？\n已存在的同名记录会自动去重，不会翻倍。")) return;
  const res = await api("/api/seed", { method: "POST", body: "{}" });
  toast($("#import-result"), "🧪 演示数据装载完成\n" + JSON.stringify(res, null, 2));
  refreshAll();
}

function refreshAll() {
  return Promise.all([loadDashboard(), loadBatches(), loadRecords()]);
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#modal-close").onclick = () => $("#modal").classList.add("hidden");
  $("#modal").onclick = e => { if (e.target.id === "modal") $("#modal").classList.add("hidden"); };
  $("#btn-import").onclick = doImport;
  $("#btn-rerun-last").onclick = doRerunLast;
  $("#btn-refresh").onclick = loadRecords;
  $("#filter-status").onchange = loadRecords;
  $("#filter-batch").onchange = loadRecords;
  $("#vac-toggle").onchange = loadRecords;
  $("#btn-export").onclick = doExport;
  $("#btn-export-csv").onclick = doExportCSV;
  $("#btn-seed").onclick = doSeed;

  await loadEnums();
  await refreshAll();
});
