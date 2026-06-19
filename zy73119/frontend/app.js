// ============================================================
//  旧楼测绘交底清单 - 前端 (Vanilla JS)
// ============================================================
const API = "http://127.0.0.1:8000/api";
const root = document.getElementById("root");

// -------------------- State --------------------
const state = {
  page: "list",
  stats: null,
  items: [],
  selected: null,
  selectedDetail: null,
  detailTab: "basic",
  kw: "",
  anomalyOnly: false,
  filterStatus: "",
  batchRuns: [],
  lastBatch: null,
  loading: true,
};

// -------------------- Helpers --------------------
function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "style") Object.assign(el.style, attrs[k]);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k === "value") el.value = attrs[k];
      else if (k === "checked") el.checked = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
  }
  if (children !== undefined) {
    const list = Array.isArray(children) ? children : [children];
    list.forEach(c => {
      if (c === null || c === undefined) return;
      if (typeof c === "string" || typeof c === "number") {
        el.appendChild(document.createTextNode(String(c)));
      } else if (c instanceof Node) {
        el.appendChild(c);
      }
    });
  }
  return el;
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.className = "toast " + (type || "ok");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function fmtTime(s) {
  return s ? String(s).slice(0, 16).replace("T", " ") : "";
}

async function apiCall(path, opts) {
  opts = opts || {};
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    method: opts.method || "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let err = { detail: res.statusText };
    try { err = await res.json(); } catch (e) {}
    throw new Error(err.detail || "请求失败");
  }
  const ct = res.headers.get("Content-Type") || "";
  if (ct.includes("json")) return res.json();
  return res;
}

function levelBadge(level) {
  if (!level) return h("span", { class: "badge badge-ok" }, "正常");
  const map = { "高": "badge-high", "中": "badge-mid", "低": "badge-low" };
  return h("span", { class: "badge " + (map[level] || "badge-mid") }, "异常·" + level);
}

function statusBadge(status) {
  const map = {
    "待处理": "badge-pending", "待指派": "badge-pending",
    "处理中": "badge-processing",
    "已闭环": "badge-closed", "已完成": "badge-closed",
  };
  return h("span", { class: "badge " + (map[status] || "badge-pending") }, status || "待处理");
}

function formRow(label, inputEl) {
  return h("div", { class: "form-row" }, [h("label", null, label), inputEl]);
}

// -------------------- Modal --------------------
let activeModal = null;
function closeModal() {
  if (activeModal) { activeModal.remove(); activeModal = null; }
}
function openModal(headText, bodyEl, footEls) {
  closeModal();
  const mask = h("div", { class: "modal-mask", onclick: (e) => { if (e.target === mask) closeModal(); } });
  const modal = h("div", { class: "modal", onclick: (e) => e.stopPropagation() }, [
    h("div", { class: "modal-head" }, [
      typeof headText === "string" ? document.createTextNode(headText) : headText,
      h("button", { class: "btn btn-sm", onclick: closeModal }, "×"),
    ]),
    h("div", { class: "modal-body" }, bodyEl),
    h("div", { class: "modal-foot" }, footEls),
  ]);
  mask.appendChild(modal);
  document.body.appendChild(mask);
  activeModal = mask;
  return mask;
}

// -------------------- Header & Nav --------------------
function renderHeader() {
  const s = state.stats;
  const desc = s && s.standard_desc
    ? (s.standard_desc.length > 45 ? s.standard_desc.slice(0, 45) + "…" : s.standard_desc)
    : "";
  return h("header", null, [
    h("div", null, [
      h("h1", null, "旧楼测绘交底清单"),
      h("div", { class: "meta" }, "BIM协调 · 异常追溯 · 材料送审历史 · 坐标偏移处理"),
    ]),
    h("div", { class: "meta", style: { textAlign: "right" } }, [
      h("div", null, "口径版本：" + (s ? s.standard_version : "-")),
      h("div", null, desc),
    ]),
  ]);
}

function renderNav() {
  return h("div", { class: "nav" }, [
    h("button", {
      class: state.page === "list" ? "active" : "",
      onclick: () => { state.page = "list"; state.selected = null; state.selectedDetail = null; render(); },
    }, "📋 交底清单"),
    h("button", {
      class: state.page === "batch" ? "active" : "",
      onclick: () => { state.page = "batch"; state.selected = null; state.selectedDetail = null; loadBatchRuns(); render(); },
    }, "⚙ 一键跑批"),
  ]);
}

function renderStats() {
  const s = state.stats;
  if (!s) return null;
  const cards = [
    ["清单总数", s.total, ""],
    ["异常项", s.anomaly, "warn"],
    ["未闭环异常", s.unresolved_anomalies, "danger"],
    ["坐标超限", s.offsets_exceed, "danger"],
    ["待处理", s.pending, ""],
    ["处理中", s.processing, ""],
    ["已闭环", s.closed, "ok"],
  ];
  return h("div", { class: "stats" },
    cards.map(([label, val, cls]) =>
      h("div", { class: "stat " + cls }, [
        h("div", { class: "label" }, label),
        h("div", { class: "value" }, String(val)),
      ])
    )
  );
}

// -------------------- Data Loading --------------------
async function loadItems() {
  state.loading = true;
  render();
  try {
    const params = new URLSearchParams();
    if (state.kw) params.set("keyword", state.kw);
    if (state.anomalyOnly) params.set("anomaly_only", "true");
    if (state.filterStatus) params.set("status", state.filterStatus);
    state.items = await apiCall("/checklist?" + params.toString());
  } catch (e) { toast(e.message, "err"); }
  state.loading = false;
  render();
}

async function refreshStats() {
  try { state.stats = await apiCall("/stats"); } catch (e) {}
}

async function loadBatchRuns() {
  try { state.batchRuns = await apiCall("/batch-runs"); } catch (e) {}
}

function exportCsv() {
  const bid = state.lastBatch && state.lastBatch.batch ? state.lastBatch.batch.batch_id : "";
  window.open(API + "/export/csv?batch_id=" + encodeURIComponent(bid) + "&operator=" + encodeURIComponent("算法值班人"), "_blank");
  toast("CSV已下载，文件头自带口径版本和跑批说明");
}

async function selectItem(id) {
  try {
    state.selectedDetail = await apiCall("/checklist/" + id);
    state.selected = state.selectedDetail;
    state.detailTab = "basic";
  } catch (e) { toast(e.message, "err"); }
  render();
}

// -------------------- Toolbar & Table --------------------
function renderChecklistToolbar() {
  const kwInput = h("input", { placeholder: "搜索编号/位置/描述", style: { width: "240px" }, value: state.kw });
  kwInput.addEventListener("input", (e) => { state.kw = e.target.value; });

  const sel = h("select", null, [
    h("option", { value: "" }, "全部状态"),
    h("option", { value: "待处理" }, "待处理"),
    h("option", { value: "处理中" }, "处理中"),
    h("option", { value: "已闭环" }, "已闭环"),
  ]);
  sel.value = state.filterStatus;
  sel.addEventListener("change", (e) => { state.filterStatus = e.target.value; });

  const cb = h("input", { type: "checkbox" });
  cb.checked = state.anomalyOnly;
  cb.addEventListener("change", (e) => { state.anomalyOnly = e.target.checked; });

  return h("div", { class: "toolbar" }, [
    kwInput, sel,
    h("label", { style: { display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#4b5563" } }, [cb, "仅看异常"]),
    h("button", { class: "btn", onclick: loadItems }, "查询"),
    h("div", { class: "spacer" }),
    h("button", { class: "btn", onclick: exportCsv }, "导出CSV(带口径)"),
    h("button", { class: "btn btn-success", onclick: () => { state.page = "batch"; state.selected = null; loadBatchRuns(); render(); } }, "一键跑批"),
    h("button", { class: "btn btn-primary", onclick: showCreateModal }, "+ 新增清单项"),
  ]);
}

function renderChecklistTable() {
  const thead = h("thead", null, h("tr", null,
    ["编号", "空间位置", "模型坐标", "异常", "状态", "BIM协调员", "算法值班人", "跑批ID", "更新时间"].map(t => h("th", null, t))
  ));

  let rows;
  if (state.loading) {
    rows = h("tr", null, h("td", { colspan: "9", class: "loading" }, "加载中…"));
  } else if (state.items.length === 0) {
    rows = h("tr", null, h("td", { colspan: "9", class: "empty" }, "暂无数据"));
  } else {
    rows = state.items.map(it => {
      const tr = h("tr", {
        class: it.has_anomaly ? "row-anomaly" : "",
        onclick: () => selectItem(it.id),
      });
      if (state.selected && state.selected.id === it.id) tr.style.background = "#eff6ff";
      tr.appendChild(h("td", { style: { fontWeight: "600", color: "#1f2937" } }, it.item_no));
      tr.appendChild(h("td", null, it.location));
      tr.appendChild(h("td", { style: { fontFamily: "monospace", fontSize: "12px", color: "#4b5563" } }, it.model_ref));
      tr.appendChild(h("td", null, levelBadge(it.has_anomaly ? it.anomaly_level : "")));
      tr.appendChild(h("td", null, statusBadge(it.status)));
      tr.appendChild(h("td", null, it.coordinator));
      tr.appendChild(h("td", null, it.operator));
      tr.appendChild(h("td", { style: { fontSize: "12px", color: "#6b7280" } }, it.batch_id));
      tr.appendChild(h("td", { style: { fontSize: "12px", color: "#6b7280" } }, fmtTime(it.updated_at || it.created_at)));
      return tr;
    });
  }
  return h("table", null, [thead, h("tbody", null, rows)]);
}

// -------------------- Create Modal --------------------
function showCreateModal() {
  const fields = {
    item_no: h("input", null),
    location: h("input", null),
    model_ref: h("input", null),
    description: h("textarea", null),
    coordinator: h("input", { value: "小岑" }),
    operator: h("input", { value: "算法值班人" }),
    status: h("select", null, [h("option", null, "待处理"), h("option", null, "处理中"), h("option", null, "已闭环")]),
  };
  fields.item_no.placeholder = "如 OLD-BLDG-006";
  fields.location.placeholder = "如 1号楼3层西侧走廊";
  fields.model_ref.placeholder = "X:1200.500,Y:850.300,Z:3000.000";

  const body = h("div", null, [
    formRow("编号 *", fields.item_no),
    formRow("空间位置 *", fields.location),
    formRow("模型坐标", fields.model_ref),
    formRow("描述", fields.description),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" } }, [
      formRow("BIM协调员", fields.coordinator),
      formRow("算法值班人", fields.operator),
    ]),
    formRow("状态", fields.status),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const data = {
        item_no: fields.item_no.value.trim(),
        location: fields.location.value.trim(),
        model_ref: fields.model_ref.value,
        description: fields.description.value,
        coordinator: fields.coordinator.value,
        operator: fields.operator.value,
        status: fields.status.value,
      };
      if (!data.item_no || !data.location) { toast("请填写编号和位置", "err"); return; }
      try {
        await apiCall("/checklist", { method: "POST", body: data });
        closeModal();
        toast("创建成功");
        await loadItems();
        await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "创建"),
  ];
  openModal("新增交底清单项", body, foot);
}

// -------------------- Detail Panel: Basic Tab --------------------
function renderBasicInfo() {
  const d = state.selectedDetail;
  if (!d) return null;
  const rows = [
    ["编号", d.item_no],
    ["空间位置", d.location],
    ["模型坐标", d.model_ref],
    ["描述", d.description || "-"],
    ["异常状态", ""],
    ["当前状态", ""],
    ["BIM协调员", d.coordinator],
    ["算法值班人", d.operator],
    ["跑批ID", d.batch_id || "-"],
    ["创建时间", fmtTime(d.created_at)],
    ["更新时间", fmtTime(d.updated_at)],
  ];
  const tbody = rows.map(([k, v]) => {
    if (k === "异常状态") {
      return h("tr", null, [h("td", null, k), h("td", null, levelBadge(d.has_anomaly ? d.anomaly_level : ""))]);
    }
    if (k === "当前状态") {
      return h("tr", null, [h("td", null, k), h("td", null, statusBadge(d.status))]);
    }
    return h("tr", null, [h("td", null, k), h("td", null, v)]);
  });
  return h("div", null, [
    h("table", { class: "info-table" }, [h("tbody", null, tbody)]),
    h("div", { style: { display: "flex", gap: "8px", marginTop: "16px" } }, [
      h("button", { class: "btn", onclick: () => showEditModal() }, "编辑"),
      h("button", { class: "btn btn-danger", onclick: async () => {
        if (!confirm("确认删除这条清单项？")) return;
        try {
          await apiCall("/checklist/" + d.id, { method: "DELETE" });
          state.selected = null; state.selectedDetail = null;
          toast("已删除");
          await loadItems(); await refreshStats();
        } catch (e) { toast(e.message, "err"); }
      }}, "删除"),
    ]),
  ]);
}

function showEditModal() {
  const d = state.selectedDetail;
  if (!d) return;
  const fields = {
    location: h("input", { value: d.location }),
    model_ref: h("input", { value: d.model_ref }),
    description: h("textarea", { value: d.description || "" }),
    coordinator: h("input", { value: d.coordinator }),
    operator: h("input", { value: d.operator }),
    status: h("select", null, [h("option", null, "待处理"), h("option", null, "处理中"), h("option", null, "已闭环")]),
  };
  fields.status.value = d.status;

  const body = h("div", null, [
    h("div", { class: "tip" }, "编号：" + d.item_no + "（不可修改，变更将自动记录历史）"),
    formRow("空间位置", fields.location),
    formRow("模型坐标", fields.model_ref),
    formRow("描述", fields.description),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" } }, [
      formRow("BIM协调员", fields.coordinator),
      formRow("算法值班人", fields.operator),
    ]),
    formRow("状态", fields.status),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const changed = {};
      const keys = { location: fields.location, model_ref: fields.model_ref, description: fields.description, coordinator: fields.coordinator, operator: fields.operator, status: fields.status };
      for (const k in keys) {
        const v = keys[k].value;
        if (String(d[k] || "") !== String(v || "")) changed[k] = v;
      }
      if (Object.keys(changed).length === 0) { toast("无修改", "warn"); return; }
      try {
        await apiCall("/checklist/" + d.id, { method: "PUT", body: changed });
        closeModal();
        toast("已保存，历史已记录");
        state.selectedDetail = await apiCall("/checklist/" + d.id);
        state.selected = state.selectedDetail;
        await loadItems(); await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "保存"),
  ];
  openModal("编辑交底清单项", body, foot);
}

// -------------------- Detail Panel: Anomaly Trace --------------------
function renderAnomalyTrace() {
  const d = state.selectedDetail;
  if (!d) return null;
  const anomalies = d.anomalies || [];

  if (anomalies.length === 0) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } }, [
      h("div", { class: "empty" }, "暂无异常记录"),
      h("button", { class: "btn btn-danger", onclick: () => showAddAnomalyModal() }, "+ 登记异常"),
    ]);
  }

  const container = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
  container.appendChild(h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: "4px" } },
    h("button", { class: "btn btn-danger", onclick: () => showAddAnomalyModal() }, "+ 登记异常")
  ));

  anomalies.forEach(a => {
    const traces = a.traces || [];
    const resolved = !!a.resolved;
    const card = h("div", { class: "card anomaly-card" + (resolved ? " anomaly-closed" : "") });
    card.appendChild(h("div", { class: "card-head" }, [
      h("span", null, [
        h("strong", null, a.title || "异常"),
        document.createTextNode(" · 等级："),
        levelBadge(a.level),
        document.createTextNode(" · "),
        resolved ? h("span", { class: "badge badge-closed" }, "已闭环") : h("span", { class: "badge badge-pending" }, "处理中"),
      ]),
      h("span", { class: "meta" }, fmtTime(a.detected_at)),
    ]));
    card.appendChild(h("div", { class: "card-body" }, [
      h("div", null, [h("strong", null, "异常说明："), document.createTextNode(a.description || "")]),
      h("div", { style: { marginTop: "6px", color: "#6b7280", fontSize: "13px" } }, "位置：" + a.location + (a.source_model ? "　模型来源：" + a.source_model : "")),
    ]));

    if (traces.length > 0) {
      const tl = h("div", { class: "timeline" });
      traces.forEach(t => {
        tl.appendChild(h("div", { class: "timeline-item" }, [
          h("div", { class: "timeline-dot" }),
          h("div", null, [
            h("div", null, [
              h("strong", null, "[" + t.step + "] "),
              h("span", { class: "meta" }, (t.from_node || "-") + " → " + (t.to_node || "-") + " · " + fmtTime(t.created_at)),
            ]),
            h("div", { class: "timeline-body" }, t.reason || ""),
            t.operator ? h("div", { class: "meta", style: { marginTop: "2px" } }, "操作人：" + t.operator) : null,
          ]),
        ]));
      });
      card.appendChild(tl);
    } else {
      card.appendChild(h("div", { class: "card-body", style: { color: "#d97706", borderTop: "1px solid #fde68a" } }, "⚠ 还没有追溯链路，变动原因可能断在中间，请尽快补充追溯步骤"));
    }

    const actions = h("div", { class: "card-body", style: { display: "flex", gap: "8px", borderTop: "1px solid #f3f4f6" } });
    if (!resolved) {
      actions.appendChild(h("button", { class: "btn btn-sm", onclick: () => showAddTraceModal(a.id) }, "+ 补充追溯步骤"));
      actions.appendChild(h("button", { class: "btn btn-sm btn-success", onclick: async () => {
        if (!confirm("确认将此异常标记为已闭环？")) return;
        try {
          await apiCall("/anomalies/" + a.id + "/resolve", { method: "POST", body: { resolved_by: "算法值班人" } });
          toast("已闭环");
          state.selectedDetail = await apiCall("/checklist/" + d.id);
          state.selected = state.selectedDetail;
          await loadItems(); await refreshStats();
        } catch (e) { toast(e.message, "err"); }
      }}, "闭环"));
    }
    card.appendChild(actions);
    container.appendChild(card);
  });

  return container;
}

function showAddAnomalyModal() {
  const d = state.selectedDetail;
  if (!d) return;
  const fields = {
    title: h("input", { value: d.location + " 实测异常" }),
    level: h("select", null, [h("option", null, "高"), h("option", null, "中"), h("option", null, "低")]),
    location: h("input", { value: d.location }),
    source_model: h("input", { value: d.model_ref ? "模型坐标：" + d.model_ref : "" }),
    description: h("textarea", null),
  };
  fields.description.placeholder = "详细描述异常情况、影响范围、检测方法等";

  const body = h("div", null, [
    formRow("异常标题", fields.title),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" } }, [
      formRow("异常等级", fields.level),
      formRow("位置", fields.location),
    ]),
    formRow("模型来源", fields.source_model),
    formRow("详细说明", fields.description),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const data = {
        checklist_item_id: d.id,
        title: fields.title.value,
        level: fields.level.value,
        location: fields.location.value,
        source_model: fields.source_model.value,
        description: fields.description.value,
      };
      if (!data.title) { toast("请填写标题", "err"); return; }
      try {
        await apiCall("/anomalies", { method: "POST", body: data });
        closeModal();
        toast("已登记异常");
        state.selectedDetail = await apiCall("/checklist/" + d.id);
        state.selected = state.selectedDetail;
        await loadItems(); await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "登记"),
  ];
  openModal("登记异常", body, foot);
}

function showAddTraceModal(anomalyId) {
  const d = state.selectedDetail;
  if (!d) return;
  const fields = {
    step: h("input", { value: String(((state.selectedDetail.anomalies || []).find(a => a.id === anomalyId).traces || []).length + 1) }),
    from_node: h("input", { value: "汇总看板" }),
    to_node: h("input", { value: "现场测量" }),
    reason: h("textarea", null),
    operator: h("input", { value: "算法值班人" }),
  };
  fields.reason.placeholder = "变动原因、处理过程、结论…";
  fields.step.type = "number";

  const body = h("div", null, [
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" } }, [
      formRow("步骤", fields.step),
      formRow("操作人", fields.operator),
    ]),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" } }, [
      formRow("起始节点(从哪里)", fields.from_node),
      formRow("目标节点(到哪里)", fields.to_node),
    ]),
    formRow("变动原因 / 处理说明", fields.reason),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const data = {
        step: parseInt(fields.step.value) || 1,
        from_node: fields.from_node.value,
        to_node: fields.to_node.value,
        reason: fields.reason.value,
        operator: fields.operator.value,
      };
      if (!data.reason) { toast("请填写变动原因", "err"); return; }
      try {
        await apiCall("/anomalies/" + anomalyId + "/trace", { method: "POST", body: data });
        closeModal();
        toast("追溯链路已补充");
        state.selectedDetail = await apiCall("/checklist/" + d.id);
        state.selected = state.selectedDetail;
        await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "补充"),
  ];
  openModal("补充追溯步骤", body, foot);
}

// -------------------- Detail Panel: Material History --------------------
function renderMaterialHistory() {
  const d = state.selectedDetail;
  if (!d) return null;
  const materials = d.materials || [];

  // group by material_name -> versions
  const byName = {};
  materials.forEach(m => {
    if (!byName[m.material_name]) byName[m.material_name] = [];
    byName[m.material_name].push(m);
  });
  Object.values(byName).forEach(arr => arr.sort((a, b) => (b.version || 0) - (a.version || 0)));

  const container = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
  container.appendChild(h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: "4px" } },
    h("button", { class: "btn btn-primary", onclick: () => showAddMaterialModal() }, "+ 新增材料送审")
  ));

  if (Object.keys(byName).length === 0) {
    container.appendChild(h("div", { class: "empty" }, "暂无材料送审记录"));
    return container;
  }

  Object.keys(byName).forEach(name => {
    const vers = byName[name];
    const latest = vers[0];
    const card = h("div", { class: "card material-card" });
    card.appendChild(h("div", { class: "card-head" }, [
      h("span", null, [
        h("strong", null, name),
        h("span", { class: "badge badge-ok", style: { marginLeft: "8px" } }, "当前 v" + latest.version),
      ]),
      h("span", { class: "meta" }, "送审人：" + latest.submitted_by),
    ]));
    card.appendChild(h("div", { class: "card-body" }, [
      h("div", null, "规格：" + (latest.specification || "-")),
      h("div", null, "供应商：" + (latest.supplier || "-")),
      latest.remark ? h("div", { style: { marginTop: "6px", background: "#fff7ed", padding: "8px 10px", borderRadius: "4px", borderLeft: "3px solid #f59e0b" } },
        h("strong", null, "备注：" + latest.remark)
      ) : null,
      latest.screenshot_url ? h("div", { class: "meta", style: { marginTop: "4px" } }, "截图：" + latest.screenshot_url) : null,
    ]));

    if (vers.length > 1) {
      const historyBox = h("div", { class: "history-box" });
      historyBox.appendChild(h("div", { style: { fontWeight: "600", marginBottom: "8px" } }, "历史版本（保留所有版本及备注、截图）："));
      vers.slice(1).forEach(v => {
        historyBox.appendChild(h("div", { class: "history-item" }, [
          h("div", null, [
            h("span", { class: "badge badge-mid" }, "v" + v.version + "（旧版）"),
            h("span", { class: "meta" }, " · " + fmtTime(v.created_at) + " · 送审人：" + v.submitted_by),
          ]),
          h("div", { style: { marginTop: "4px", fontSize: "13px", color: "#4b5563" } }, "规格：" + (v.specification || "-") + "　供应商：" + (v.supplier || "-")),
          v.remark ? h("div", { style: { marginTop: "4px", color: "#b45309", fontSize: "13px" } }, "备注：" + v.remark) : null,
          v.screenshot_url ? h("div", { class: "meta", style: { marginTop: "2px" } }, "截图：" + v.screenshot_url) : null,
        ]));
      });
      card.appendChild(historyBox);
    }

    card.appendChild(h("div", { class: "card-body", style: { borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end" } },
      h("button", { class: "btn btn-sm", onclick: () => showUpdateMaterialModal(name) }, "提交新版（保留旧版本历史）")
    ));
    container.appendChild(card);
  });

  return container;
}

function showAddMaterialModal() {
  const d = state.selectedDetail;
  if (!d) return;
  const fields = {
    material_name: h("input", null),
    specification: h("input", null),
    supplier: h("input", null),
    submitted_by: h("input", { value: "算法值班人" }),
    remark: h("textarea", null),
    screenshot_url: h("input", null),
  };
  fields.material_name.placeholder = "如 防水卷材";
  fields.remark.placeholder = "送审备注、补充说明…（会保留在该版本历史中）";

  const body = h("div", null, [
    formRow("材料名称 *", fields.material_name),
    formRow("规格型号", fields.specification),
    formRow("供应商", fields.supplier),
    formRow("送审人", fields.submitted_by),
    formRow("备注（留痕）", fields.remark),
    formRow("截图链接", fields.screenshot_url),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const data = {
        checklist_item_id: d.id,
        material_name: fields.material_name.value.trim(),
        specification: fields.specification.value,
        supplier: fields.supplier.value,
        submitted_by: fields.submitted_by.value,
        remark: fields.remark.value,
        screenshot_url: fields.screenshot_url.value,
      };
      if (!data.material_name) { toast("请填写材料名称", "err"); return; }
      try {
        await apiCall("/materials", { method: "POST", body: data });
        closeModal();
        toast("已提交，自动递增版本号，旧版本已留痕");
        state.selectedDetail = await apiCall("/checklist/" + d.id);
        state.selected = state.selectedDetail;
        await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "提交"),
  ];
  openModal("新增材料送审", body, foot);
}

function showUpdateMaterialModal(name) {
  const d = state.selectedDetail;
  if (!d) return;
  const fields = {
    specification: h("input", null),
    supplier: h("input", null),
    submitted_by: h("input", { value: "算法值班人" }),
    remark: h("textarea", null),
    screenshot_url: h("input", null),
  };
  fields.remark.placeholder = "新版本备注、变更说明…（会保留在该版本历史中）";

  const body = h("div", null, [
    h("div", { class: "tip" }, "材料：" + name + "（将创建新版本，旧版本自动留痕）"),
    formRow("规格型号", fields.specification),
    formRow("供应商", fields.supplier),
    formRow("送审人", fields.submitted_by),
    formRow("新版本备注", fields.remark),
    formRow("截图链接", fields.screenshot_url),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const data = {
        checklist_item_id: d.id,
        material_name: name,
        specification: fields.specification.value,
        supplier: fields.supplier.value,
        submitted_by: fields.submitted_by.value,
        remark: fields.remark.value,
        screenshot_url: fields.screenshot_url.value,
      };
      try {
        await apiCall("/materials", { method: "POST", body: data });
        closeModal();
        toast("新版本已提交，旧版本已留痕");
        state.selectedDetail = await apiCall("/checklist/" + d.id);
        state.selected = state.selectedDetail;
        await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "提交新版本"),
  ];
  openModal("提交材料新版本", body, foot);
}

// -------------------- Detail Panel: Offset View --------------------
function renderOffsetView() {
  const d = state.selectedDetail;
  if (!d) return null;
  const offsets = d.offsets || [];

  const container = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
  container.appendChild(h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: "4px" } },
    h("button", { class: "btn btn-primary", onclick: () => showAddOffsetModal() }, "+ 登记坐标偏移")
  ));

  if (offsets.length === 0) {
    container.appendChild(h("div", { class: "empty" }, "暂无坐标偏移记录"));
    return container;
  }

  offsets.forEach(o => {
    const card = h("div", { class: "card " + (o.exceeds ? "danger-card" : "") });
    card.appendChild(h("div", { class: "card-head" }, [
      h("span", null, [
        h("strong", null, o.measured_point || "测点"),
        o.exceeds ? h("span", { class: "badge badge-high", style: { marginLeft: "8px" } }, "⚠ 超出容差") : h("span", { class: "badge badge-ok", style: { marginLeft: "8px" } }, "容差内"),
      ]),
      h("span", { class: "meta" }, fmtTime(o.created_at)),
    ]));
    card.appendChild(h("div", { class: "card-body" }, [
      h("div", null, [
        "模型坐标：", h("code", null, o.model_coord || "-"),
        "　实测坐标：", h("code", null, o.measured_coord || "-"),
      ]),
      h("div", { style: { marginTop: "6px" } }, [
        "X偏差：" + (o.offset_x || 0) + "mm",
        "　Y偏差：" + (o.offset_y || 0) + "mm",
        "　Z偏差：" + (o.offset_z || 0) + "mm",
        "　欧氏距离：" + (o.distance || 0).toFixed(1) + "mm（容差 50mm）",
      ]),
    ]));
    if (o.exceeds && o.action_item) {
      card.appendChild(h("div", { class: "card-body", style: { background: "#fef2f2", borderTop: "1px solid #fecaca" } }, [
        h("div", { style: { fontWeight: "600", color: "#b91c1c" } }, "📋 可执行动作（已自动生成）："),
        h("div", { style: { marginTop: "6px", whiteSpace: "pre-wrap", color: "#7f1d1d" } }, o.action_item),
      ]));
    }
    container.appendChild(card);
  });

  return container;
}

function showAddOffsetModal() {
  const d = state.selectedDetail;
  if (!d) return;
  const fields = {
    measured_point: h("input", { value: d.location + " 测点" }),
    model_coord: h("input", { value: d.model_ref || "" }),
    measured_coord: h("input", null),
    offset_x: h("input", { value: "0" }),
    offset_y: h("input", { value: "0" }),
    offset_z: h("input", { value: "0" }),
  };
  fields.measured_coord.placeholder = "X:1200.568,Y:850.380,Z:3000.000";
  fields.offset_x.type = fields.offset_y.type = fields.offset_z.type = "number";

  const body = h("div", null, [
    formRow("测点名称", fields.measured_point),
    formRow("模型坐标", fields.model_coord),
    formRow("实测坐标", fields.measured_coord),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" } }, [
      formRow("X偏差(mm)", fields.offset_x),
      formRow("Y偏差(mm)", fields.offset_y),
      formRow("Z偏差(mm)", fields.offset_z),
    ]),
    h("div", { class: "tip" }, "欧氏距离超50mm会自动生成可执行动作，落实到：BIM协调员复核、通知算法值班人、模型更新"),
  ]);
  const foot = [
    h("button", { class: "btn", onclick: closeModal }, "取消"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const data = {
        checklist_item_id: d.id,
        measured_point: fields.measured_point.value,
        model_coord: fields.model_coord.value,
        measured_coord: fields.measured_coord.value,
        offset_x: parseFloat(fields.offset_x.value) || 0,
        offset_y: parseFloat(fields.offset_y.value) || 0,
        offset_z: parseFloat(fields.offset_z.value) || 0,
      };
      try {
        const r = await apiCall("/offsets", { method: "POST", body: data });
        closeModal();
        if (r.exceeds) toast("坐标超出容差！已自动生成可执行动作", "warn");
        else toast("已登记，容差内");
        state.selectedDetail = await apiCall("/checklist/" + d.id);
        state.selected = state.selectedDetail;
        await loadItems(); await refreshStats();
      } catch (e) { toast(e.message, "err"); }
    }}, "登记"),
  ];
  openModal("登记坐标偏移", body, foot);
}

// -------------------- Detail Panel: Change History --------------------
function renderHistoryView() {
  const d = state.selectedDetail;
  if (!d) return null;
  const history = d.change_history || [];

  if (history.length === 0) {
    return h("div", { class: "empty" }, "暂无变更历史");
  }

  const tl = h("div", { class: "timeline" });
  history.forEach(h2 => {
    tl.appendChild(h("div", { class: "timeline-item" }, [
      h("div", { class: "timeline-dot" }),
      h("div", null, [
        h("div", null, [
          h("strong", null, h2.field_name),
          document.createTextNode(" 变更 "),
          h("span", { class: "meta" }, fmtTime(h2.changed_at) + " · 操作人：" + (h2.changed_by || "-")),
        ]),
        h("div", { class: "timeline-body" }, [
          h("span", { style: { color: "#b91c1c" } }, h2.old_value || "(空)"),
          document.createTextNode("  →  "),
          h("span", { style: { color: "#15803d", fontWeight: "600" } }, h2.new_value || "(空)"),
        ]),
      ]),
    ]));
  });
  return tl;
}

// -------------------- Detail Panel (wrapper) --------------------
function renderDetailPanel() {
  const d = state.selectedDetail;
  if (!d) return null;
  const anomalies = d.anomalies || [];
  const unresolved = anomalies.filter(a => !a.resolved).length;
  const materials = d.materials || [];
  const offsets = d.offsets || [];
  const offsetsExceed = offsets.filter(o => o.exceeds).length;

  const tabs = [
    ["basic", "基本信息"],
    ["anomaly", `异常追溯 (${unresolved}/${anomalies.length})`],
    ["material", `材料送审历史 (${materials.length})`],
    ["offset", `坐标偏移${offsetsExceed ? ` (${offsetsExceed}超限)` : ""}`],
    ["history", "变更历史"],
  ];

  const tabsEl = h("div", { class: "detail-tabs" },
    tabs.map(([k, label]) => {
      const b = h("button", {
        class: state.detailTab === k ? "active" : "",
        onclick: () => { state.detailTab = k; render(); },
      }, label);
      return b;
    })
  );

  let body;
  if (state.detailTab === "basic") body = renderBasicInfo();
  else if (state.detailTab === "anomaly") body = renderAnomalyTrace();
  else if (state.detailTab === "material") body = renderMaterialHistory();
  else if (state.detailTab === "offset") body = renderOffsetView();
  else if (state.detailTab === "history") body = renderHistoryView();

  return h("div", { class: "detail-panel" }, [tabsEl, h("div", { class: "detail-body" }, body)]);
}

// -------------------- Batch Run Page --------------------
function renderStandardBox() {
  const s = state.stats;
  const box = h("div", { class: "standard-box", style: { marginTop: "18px" } });
  box.appendChild(h("div", { class: "std-title" }, "当前跑批口径"));
  const line1 = h("div", null, "版本：");
  const strong = document.createElement("strong");
  strong.textContent = s ? s.standard_version : "-";
  line1.appendChild(strong);
  box.appendChild(line1);
  box.appendChild(h("div", null, s ? s.standard_desc : ""));
  return box;
}

async function doBatchRun() {
  if (!confirm("确认执行一键跑批？将扫描所有清单项，标记异常与坐标超限。")) return;
  try {
    const r = await apiCall("/batch-run", { method: "POST", body: { run_by: "算法值班人" } });
    state.lastBatch = r;
    toast("跑批完成！BatchID: " + r.batch.batch_id);
    await refreshStats();
    await loadItems();
    await loadBatchRuns();
    render();
  } catch (e) { toast(e.message, "err"); }
}

function renderBatchView() {
  const s = state.stats;
  const last = state.lastBatch;

  const items = [];
  items.push(h("div", { class: "section-title" }, "一键跑批"));
  items.push(h("div", { class: "tip" }, "月底封账前可直接点击下方按钮执行跑批，系统会自动扫描所有清单项、标记异常、记录坐标超限并生成 BatchID。导出 CSV 会自带口径版本和跑批说明。"));
  items.push(h("div", { style: { display: "flex", gap: "10px", marginTop: "14px", alignItems: "center" } }, [
    h("button", { class: "btn btn-success", style: { padding: "10px 22px", fontSize: "14px" }, onclick: doBatchRun }, "🚀 执行一键跑批"),
    h("span", { class: "meta" }, "执行人：算法值班人　（无需询问材料存放位置）"),
    h("div", { class: "spacer" }),
    h("button", { class: "btn", onclick: exportFromBatch }, "📥 导出当前口径CSV"),
  ]));
  items.push(renderStandardBox());

  if (last) {
    const b = last.batch;
    const br = h("div", { class: "batch-result" }, [
      h("div", { style: { fontSize: "15px", fontWeight: "600", marginBottom: "12px" } }, [
        "本次跑批结果 ",
        h("span", { style: { fontWeight: "400", fontSize: "13px", color: "#6b7280" } }, "· BatchID: " + b.batch_id),
      ]),
      h("div", { class: "batch-info" }, [
        h("div", { class: "stat", style: { border: "none", padding: "0" } }, [h("div", { class: "label" }, "清单项总数"), h("div", { class: "value" }, String(b.total_items))]),
        h("div", { class: "stat warn", style: { border: "none", padding: "0" } }, [h("div", { class: "label" }, "异常项"), h("div", { class: "value" }, String(b.anomaly_count))]),
        h("div", { class: "stat danger", style: { border: "none", padding: "0" } }, [h("div", { class: "label" }, "坐标超限"), h("div", { class: "value" }, String(b.offset_count))]),
        h("div", { class: "stat", style: { border: "none", padding: "0" } }, [h("div", { class: "label" }, "执行时间"), h("div", { class: "value", style: { fontSize: "14px" } }, fmtTime(b.created_at))]),
      ]),
    ]);
    if (last.anomaly_items && last.anomaly_items.length) {
      br.appendChild(h("div", { style: { marginBottom: "10px" } }, [
        h("div", { style: { fontWeight: "600", marginBottom: "6px" } }, "异常项清单："),
        ...last.anomaly_items.map(i => {
          const row = h("div", { style: { padding: "6px 10px", background: "#fef3c740", borderRadius: "4px", marginBottom: "4px", fontSize: "13px", cursor: "pointer" } }, [
            h("strong", null, i.item_no), " · " + i.location + " · ",
            levelBadge(i.anomaly_level),
            h("span", null, " · " + (i.anomaly_note || "")),
            h("span", { class: "meta", style: { marginLeft: "8px" } }, "点击跳转"),
          ]);
          row.onclick = () => { state.page = "list"; selectItem(i.id); };
          return row;
        }),
      ]));
    }
    if (last.offset_items && last.offset_items.length) {
      br.appendChild(h("div", null, [
        h("div", { style: { fontWeight: "600", marginBottom: "6px" } }, "坐标超限项（已自动附带可执行动作）："),
        ...last.offset_items.map(i => {
          const row = h("div", { style: { padding: "6px 10px", background: "#fee2e240", borderRadius: "4px", marginBottom: "4px", fontSize: "13px", cursor: "pointer" } }, [
            h("strong", null, i.item_no), " · " + i.location + " · 坐标已超容差，需BIM协调员处理",
            h("span", { class: "meta", style: { marginLeft: "8px" } }, "点击跳转查看动作"),
          ]);
          row.onclick = () => { state.page = "list"; selectItem(i.id); state.detailTab = "offset"; render(); };
          return row;
        }),
      ]));
    }
    items.push(br);
  }

  items.push(h("div", { class: "section-title", style: { marginTop: "22px" } }, "历史跑批记录"));
  if (state.batchRuns.length === 0) {
    items.push(h("div", { class: "empty", style: { border: "1px solid #e5e7eb", borderRadius: "6px" } }, "暂无记录"));
  } else {
    const thead = h("thead", null, h("tr", null, ["跑批ID", "口径版本", "执行时间", "执行人", "总数", "异常", "坐标超限"].map(t => h("th", null, t))));
    const tbody = h("tbody", null, state.batchRuns.map(r => {
      const tr = h("tr", { style: { cursor: "pointer" }, onclick: async () => {
        // Load this batch detail by fetching a simulated result
        state.lastBatch = {
          batch: r,
          anomaly_items: [],
          offset_items: [],
        };
        toast("已选中跑批 " + r.batch_id);
        render();
      }});
      tr.appendChild(h("td", { style: { fontFamily: "monospace", fontSize: "12px" } }, r.batch_id));
      tr.appendChild(h("td", null, h("span", { class: "badge badge-low" }, r.standard_version)));
      tr.appendChild(h("td", { style: { fontSize: "12px" } }, fmtTime(r.created_at)));
      tr.appendChild(h("td", null, r.run_by));
      tr.appendChild(h("td", null, String(r.total_items)));
      tr.appendChild(h("td", { style: { color: "#d97706", fontWeight: "600" } }, String(r.anomaly_count)));
      tr.appendChild(h("td", { style: { color: "#dc2626", fontWeight: "600" } }, String(r.offset_count)));
      return tr;
    }));
    items.push(h("table", null, [thead, tbody]));
  }

  return h("div", null, items);
}

function exportFromBatch() {
  exportCsv();
}

// -------------------- Main Render --------------------
function render() {
  root.innerHTML = "";
  root.appendChild(renderHeader());
  root.appendChild(renderNav());
  const content = h("div", { class: "content" });
  const statsEl = renderStats();
  if (statsEl) content.appendChild(statsEl);
  if (state.page === "list") {
    content.appendChild(renderChecklistToolbar());
    content.appendChild(renderChecklistTable());
    const dp = renderDetailPanel();
    if (dp) content.appendChild(dp);
  } else if (state.page === "batch") {
    content.appendChild(renderBatchView());
  }
  root.appendChild(content);
}

// -------------------- Init --------------------
(async function init() {
  await Promise.all([refreshStats(), loadItems(), loadBatchRuns()]);
  render();
})();
