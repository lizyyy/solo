let STATE = null;
let CURRENT_EVIDENCE_ID = null;

function flash(msg, isErr) {
  const el = document.getElementById("flash");
  el.textContent = msg;
  el.classList.toggle("err", !!isErr);
  el.classList.add("show");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove("show"), 2400);
}

function statusLabel(s) {
  const map = {
    pending_review: "待复核",
    auto_flagged: "自动标记",
    supplemented: "已补录·待复核",
    confirmed_normal: "复核通过·已归入正常",
    confirmed_anomaly: "复核通过·确认为异常",
  };
  return map[s] || s;
}

function pill(s) {
  return `<span class="status-pill status-${s}">${statusLabel(s)}</span>`;
}

async function fetchJson(url, opts) {
  const r = await fetch(url, { headers: { "Accept": "application/json" }, ...opts });
  if (!r.ok) {
    let msg = "请求失败";
    try { msg = (await r.json()).error || msg; } catch(e) {}
    throw new Error(msg);
  }
  return r.json();
}

async function refresh() {
  STATE = await fetchJson("/api/state");
  renderAll();
}

function renderAll() {
  renderSummary();
  renderAnomalyTable();
  renderCleanedTable();
  renderEvidenceTable();
  renderHistory();
  renderBadges();
  if (CURRENT_EVIDENCE_ID) renderDetail(CURRENT_EVIDENCE_ID);
}

function renderBadges() {
  const ev = STATE.evidence || [];
  document.getElementById("badge-evidence").textContent = "证据 " + ev.length;
  const pending = ev.filter(r => ["pending_review","auto_flagged","supplemented"].includes(r.current_status)).length;
  document.getElementById("badge-pending").textContent = "待复核 " + pending;
  document.getElementById("badge-cleaned").textContent = "正常 " + (STATE.cleaned_rows || []).length;
}

function renderSummary() {
  const s = STATE.summary || {};
  document.getElementById("sum-total").textContent = s.total_raw || 0;
  document.getElementById("sum-cleaned").textContent = s.cleaned_count || 0;
  document.getElementById("sum-anomaly").textContent = s.anomaly_count || 0;
  document.getElementById("sum-dup").textContent = s.duplicate_count || 0;
  const c = STATE.chi_square_result || {};
  document.getElementById("chi-x2").textContent = c.chi_square ?? "—";
  document.getElementById("chi-df").textContent = c.df ?? "—";
  document.getElementById("chi-p").textContent = c.p_value ?? "—";
  document.getElementById("chi-err").textContent = c.error ? "⚠ " + c.error : "";
}

function renderAnomalyTable() {
  const tbody = document.querySelector("#tbl-anomaly tbody");
  const rows = STATE.anomaly_rows || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">当前无异常记录。</td></tr>`;
    return;
  }
  const evByRow = {};
  (STATE.evidence || []).forEach(r => (evByRow[r.original_row] = evByRow[r.original_row] || []).push(r));
  tbody.innerHTML = rows.map(r => {
    const evs = (evByRow[r._original_row] || []).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
    const latest = evs[evs.length-1] || {};
    return `<tr class="row-clickable" data-evid="${latest.evidence_id}" onclick="selectEvidence('${latest.evidence_id}')">
      <td>${r._original_row}</td>
      <td>${r._anomaly || "—"}</td>
      <td>${latest.field_name || r._anomaly_field || "—"}</td>
      <td><code>${latest.original_value ?? ""}</code></td>
      <td><code>${(latest.supplemented_values && latest.field_name) ? (latest.supplemented_values[latest.field_name] ?? "") : (r[latest.field_name] ?? "")}</code></td>
      <td>${pill(latest.current_status || "auto_flagged")}</td>
      <td>${latest.supplemented_by || latest.reviewer || "—"}</td>
      <td class="muted">${latest.next_step || "点击查看详情"}</td>
    </tr>`;
  }).join("");
}

function renderCleanedTable() {
  const head = document.getElementById("tbl-cleaned-head");
  const tbody = document.querySelector("#tbl-cleaned tbody");
  const rows = STATE.cleaned_rows || [];
  if (!rows.length) {
    head.innerHTML = `<th>说明</th>`;
    tbody.innerHTML = `<tr><td class="empty">尚无正常结果。请导入数据或复核通过异常记录。</td></tr>`;
    return;
  }
  const keys = Object.keys(rows[0]);
  head.innerHTML = keys.map(k => `<th>${k}</th>`).join("");
  tbody.innerHTML = rows.map(r => `<tr>${keys.map(k => `<td>${r[k] ?? ""}</td>`).join("")}</tr>`).join("");
}

function renderEvidenceTable() {
  const tbody = document.querySelector("#tbl-evidence tbody");
  const rows = STATE.evidence || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">尚无证据记录。</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `<tr class="row-clickable" data-evid="${r.evidence_id}" onclick="selectEvidence('${r.evidence_id}')">
    <td><strong>${r.evidence_id}</strong></td>
    <td>${r.original_row}</td>
    <td>${r.anomaly_type}</td>
    <td>${r.field_name}</td>
    <td><code>${r.original_value ?? ""}</code></td>
    <td><code>${r.supplemented_values ? JSON.stringify(r.supplemented_values) : (r.corrected_value ?? "—")}</code></td>
    <td>${pill(r.current_status)}</td>
    <td class="muted">${r.review_reason || r.detail || "—"}</td>
  </tr>`).join("");
}

function renderHistory() {
  const log = STATE.workflow_log || [];
  const container = document.getElementById("history-list");
  if (!log.length) {
    container.innerHTML = `<div class="empty">尚无历史记录。</div>`;
    return;
  }
  container.innerHTML = log.slice().reverse().map(l => `<div class="log-line">
    <span class="ts">${l.timestamp.slice(5,19)}</span>
    <span class="step">[${l.step}]</span>
    <span class="act">${l.action}</span>
    ${l.detail ? `<span class="muted">· ${l.detail}</span>` : ""}
  </div>`).join("");
}

async function selectEvidence(evidence_id) {
  CURRENT_EVIDENCE_ID = evidence_id;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector('.tab[data-tab="detail"]').classList.add("active");
  document.querySelectorAll(".tabview").forEach(t => t.classList.remove("active"));
  document.getElementById("tab-detail").classList.add("active");
  await renderDetail(evidence_id);
}

async function renderDetail(evidence_id) {
  const host = document.getElementById("detail-content");
  host.innerHTML = `<div class="empty">加载中…</div>`;
  try {
    const d = await fetchJson(`/api/evidence/${encodeURIComponent(evidence_id)}`);
    const r = d.record;
    const os = d.original_row_snapshot;
    const cr = d.current_row;
    const hist = d.row_history || [];
    const isReviewable = ["pending_review", "auto_flagged", "supplemented"].includes(r.current_status);
    const fields = ["count_a","count_b","denominator"].filter(k => os && k in os && k !== r.field_name);

    host.innerHTML = `
      <div class="detail-block">
        <h3>证据 ${r.evidence_id} · 概览</h3>
        <div class="kv">
          <div class="k">原始行号</div><div class="v"><code>${r.original_row}</code></div>
          <div class="k">异常类型</div><div class="v">${r.anomaly_type}</div>
          <div class="k">问题字段</div><div class="v"><code>${r.field_name}</code></div>
          <div class="k">当前状态</div><div class="v">${pill(r.current_status)}</div>
          <div class="k">时间戳</div><div class="v" class="muted">${r.timestamp}</div>
        </div>
      </div>

      <div class="detail-block">
        <h3>🔴 原始说法（导入快照）</h3>
        <div class="kv">
          ${r.original_statement ? `<div class="k">完整说法</div><div class="v" style="color:#a0410d">${r.original_statement}</div>` : ""}
          <div class="k">问题字段原始值</div><div class="v"><code>${JSON.stringify(r.original_value)}</code></div>
          <div class="k">原始行完整字段</div><div class="v"><code>${JSON.stringify(os)}</code></div>
          <div class="k">自动检测说明</div><div class="v">${r.detail || "—"}</div>
        </div>
      </div>

      ${r.supplemented_values ? `
      <div class="detail-block" style="background:#f6ffed;border-color:#b7eb8f">
        <h3>🟢 改后值（补录）</h3>
        <div class="kv">
          <div class="k">补录字段与值</div><div class="v"><code>${JSON.stringify(r.supplemented_values)}</code></div>
          <div class="k">补录人</div><div class="v">${r.supplemented_by || "—"}</div>
          <div class="k">补录备注</div><div class="v">${r.manual_change || "—"}</div>
        </div>
      </div>` : ""}

      ${r.review_reason ? `
      <div class="detail-block" style="background:${r.current_status==='confirmed_normal'?'#e6ffed':'#fff1f0'};border-color:${r.current_status==='confirmed_normal'?'#b7eb8f':'#ffa39e'}">
        <h3>🔵 复核结果</h3>
        <div class="kv">
          <div class="k">处理原因</div><div class="v">${r.review_reason}</div>
          <div class="k">复核人</div><div class="v">${r.reviewer || "—"}</div>
          <div class="k">修正后进入正常值</div><div class="v"><code>${r.corrected_value ?? "—"}</code></div>
          <div class="k">下一步</div><div class="v">${r.next_step || "—"}</div>
        </div>
      </div>` : ""}

      <div class="detail-block">
        <h3>当前该数据行（与列表/导出同源）</h3>
        <div class="v" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;background:#fff;padding:8px;border-radius:4px;border:1px solid #e8eaf4">
          ${JSON.stringify(cr, null, 2)}
        </div>
      </div>

      <div class="detail-block">
        <h3>本行操作历史</h3>
        ${hist.map(h => `<div class="log-line">
          <span class="ts">${h.timestamp.slice(5,19)}</span>
          <span class="step">[${h.evidence_id}]</span>
          ${pill(h.current_status)}
          <span class="muted">· ${h.detail || h.review_reason || h.manual_change || ""}</span>
        </div>`).join("")}
      </div>

      ${isReviewable ? `
      <div class="supplement-form">
        <h3 style="margin:0 0 8px;font-size:13px;color:#2d3a56">实验助理补录</h3>
        <div class="row">
          ${fields.map(k => `<div><label>${k}</label><input id="sup-${k}" value="${(r.supplemented_values||{})[k] ?? (os[k] ?? '')}" /></div>`).join("")}
          <div><label>${r.field_name}（问题字段）</label><input id="sup-${r.field_name}" value="${(r.supplemented_values||{})[r.field_name] ?? ''}" placeholder="请补录正确值" /></div>
        </div>
        <label>补录人</label>
        <input id="sup-who" value="实验助理小穆" />
        <div class="actions">
          <button onclick="submitSupplement('${r.evidence_id}')">保存补录（不自动归正常）</button>
        </div>
      </div>

      <div class="supplement-form" style="margin-top:10px">
        <h3 style="margin:0 0 8px;font-size:13px;color:#2d3a56">数据复核人确认</h3>
        <label>复核处理原因 / 备注（保留给后续追问）</label>
        <textarea id="rev-note" placeholder="例：对照原始问卷第X页，A组Q3共3人。"></textarea>
        <div class="row">
          <div><label>复核人</label><input id="rev-who" value="数据复核人老K" /></div>
          <div><label>&nbsp;</label>
            <div style="display:flex;gap:8px">
              <button class="success" onclick="submitReview('${r.evidence_id}', true)">✓ 确认正常，移入卡方</button>
              <button class="danger" onclick="submitReview('${r.evidence_id}', false)">✗ 确认异常，排除</button>
            </div>
          </div>
        </div>
      </div>` : `<div class="muted" style="padding:10px">该记录已处理，如需重新处理请先「重置」再走一遍。</div>`}
    `;
  } catch (e) {
    host.innerHTML = `<div class="empty" style="color:#d9534f">加载失败：${e.message}</div>`;
  }
}

async function submitSupplement(evidence_id) {
  const rec = (STATE.evidence || []).find(r => r.evidence_id === evidence_id);
  if (!rec) return;
  const os = (STATE.anomaly_rows || []).find(r => r._original_row === rec.original_row)
         || (STATE.cleaned_rows || []).find(r => r._original_row === rec.original_row) || {};
  const fields = new Set([...Object.keys(os).filter(k => !k.startsWith("_")), rec.field_name]);
  fields.delete("_original_row"); fields.delete("_anomaly"); fields.delete("_anomaly_field");
  fields.delete("_review_status"); fields.delete("_reviewer"); fields.delete("_review_reason");
  fields.delete("_supplemented");
  const new_values = {};
  fields.forEach(k => {
    const el = document.getElementById(`sup-${k}`);
    if (el && el.value !== "") new_values[k] = el.value;
  });
  const supplemented_by = document.getElementById("sup-who").value || "实验助理";
  try {
    STATE = await fetchJson("/api/supplement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_id, new_values, supplemented_by })
    });
    flash("补录成功，已标记为已补录·待复核，**未**自动归入正常结果");
    renderAll();
  } catch (e) {
    flash(e.message, true);
  }
}

async function submitReview(evidence_id, confirmed_normal) {
  const note = document.getElementById("rev-note").value || "";
  const reviewer = document.getElementById("rev-who").value || "数据复核人";
  try {
    STATE = await fetchJson("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_id, confirmed_normal, note, reviewer })
    });
    flash(confirmed_normal ? "复核通过，已移入正常结果并重算卡方" : "复核确认异常，已从正常结果中排除");
    renderAll();
  } catch (e) {
    flash(e.message, true);
  }
}

async function importSample() {
  try {
    STATE = await fetchJson("/api/import/sample", { method: "POST" });
    flash("样例数据已导入");
    renderAll();
  } catch (e) { flash(e.message, true); }
}

async function resetAll() {
  try {
    await fetchJson("/api/reset", { method: "POST" });
    CURRENT_EVIDENCE_ID = null;
    await refresh();
    flash("已重置");
  } catch (e) { flash(e.message, true); }
}

document.getElementById("csv-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const f = document.getElementById("csv-file").files[0];
  if (!f) return flash("请先选择 CSV 文件", true);
  try {
    const r = await fetch("/api/import/csv", { method: "POST", body: fd });
    if (!r.ok) throw new Error(await r.text());
    STATE = await r.json();
    flash("CSV 已导入");
    renderAll();
  } catch (e) { flash(e.message, true); }
});

async function importManualRows() {
  const txt = document.getElementById("manual-rows").value.trim();
  if (!txt) return flash("请先填写 JSON", true);
  let rows; try { rows = JSON.parse(txt); } catch (e) { return flash("JSON 解析失败："+e.message, true); }
  if (!Array.isArray(rows)) return flash("请输入数组", true);
  try {
    STATE = await fetchJson("/api/import/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    flash("手工行已导入");
    renderAll();
  } catch (e) { flash(e.message, true); }
}

async function runSelfCheck() {
  try {
    const d = await fetchJson("/api/selfcheck");
    const tbody = document.querySelector("#tbl-selfcheck tbody");
    tbody.innerHTML = (d.checks || []).map(c => `<tr>
      <td>${c.check}</td>
      <td><span class="status-pill status-${c.status==='PASS'?'confirmed_normal':c.status==='WARN'?'pending_review':'confirmed_anomaly'}">${c.status}</span></td>
      <td>${c.detail}</td>
      <td>${(c.evidence_ids||[]).join(", ") || "—"}</td>
    </tr>`).join("");
    flash("自检完成");
  } catch (e) { flash(e.message, true); }
}

function exportKind(kind) {
  window.open(`/api/export/${encodeURIComponent(kind)}`, "_blank");
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tabview").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

refresh().then(runSelfCheck);
