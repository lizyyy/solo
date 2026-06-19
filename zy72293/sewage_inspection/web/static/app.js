let currentProjectId = null;
let currentProjectData = null;
let currentImportType = null;
let chartDataCache = null;
let chartHitTargets = [];
let threeHitTargets = [];

const API = "/api";

function showStatusMsg(msg, isError) {
  var bar = document.getElementById("status-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "status-bar";
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 20px;text-align:center;font-size:15px;transition:opacity 0.5s;";
    document.body.appendChild(bar);
  }
  bar.textContent = msg;
  bar.style.background = isError ? "#e74c3c" : "#27ae60";
  bar.style.color = "#fff";
  bar.style.opacity = "1";
  setTimeout(function() { bar.style.opacity = "0"; }, 3000);
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

async function apiText(path) {
  const res = await fetch(API + path);
  return res.text();
}

function el(id) {
  return document.getElementById(id);
}

async function refreshProjectList() {
  const projects = await api("GET", "/projects");
  const sel = el("project-select");
  sel.innerHTML = '<option value="">— 选择项目 —</option>';
  projects.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.plant_name || "未设厂区"}) — ${p.current_phase_label || p.current_phase}`;
    sel.appendChild(opt);
  });
  if (currentProjectId) sel.value = currentProjectId;
}

function showCreateProject() {
  el("create-panel").classList.remove("hidden");
}

function hideCreateProject() {
  el("create-panel").classList.add("hidden");
}

async function createProject() {
  const name = el("cp-name").value.trim();
  const plant = el("cp-plant").value.trim();
  if (!name) return showStatusMsg("请输入项目名称", true);
  const result = await api("POST", "/projects", { name, plant_name: plant });
  currentProjectId = result.id;
  await refreshProjectList();
  hideCreateProject();
  await loadProject(currentProjectId);
}

async function loadSampleProject() {
  try {
    const result = await api("POST", "/load-sample", {
      name: "污水厂池体检修-样例演示",
      plant_name: "第一污水厂",
      by: "web-新人",
    });
    currentProjectId = result.id || result.project_id;
    await refreshProjectList();
    await loadProject(currentProjectId);
    showStatusMsg("样例项目已加载成功！");
  } catch (e) {
    showStatusMsg("加载样例失败: " + e.message, true);
  }
}

async function loadProject(id) {
  if (!id) {
    el("main-panel").classList.add("hidden");
    return;
  }
  currentProjectId = id;
  currentProjectData = await api("GET", `/projects/${id}`);
  renderProject(currentProjectData);
  el("main-panel").classList.remove("hidden");
}

function renderProject(data) {
  el("project-title").textContent = `${data.name} (${data.plant_name || ""})`;
  const badge = el("phase-badge");
  badge.textContent = data.current_phase_label || data.current_phase;
  badge.setAttribute("data-phase", data.current_phase);

  const steps = ["obstacle_import", "floor_profile_supplement", "occlusion_update"];
  const phaseIdx = steps.indexOf(data.current_phase);
  for (let i = 0; i < 3; i++) {
    const stepEl = el(`step-${i + 1}`);
    stepEl.classList.remove("active", "completed");
    if (i < phaseIdx) stepEl.classList.add("completed");
    else if (i === phaseIdx) stepEl.classList.add("active");
  }

  const s = data.stats;
  el("stats-bar").innerHTML = `
    <div class="stat-item"><div class="stat-value">${s.obstacle_remarks}</div><div class="stat-label">障碍物备注</div></div>
    <div class="stat-item"><div class="stat-value">${s.floor_profiles}</div><div class="stat-label">楼层剖面草图</div></div>
    <div class="stat-item"><div class="stat-value">${s.photo_locations}</div><div class="stat-label">照片点位</div></div>
    <div class="stat-item"><div class="stat-value">${s.coordinate_rows}</div><div class="stat-label">坐标表行</div></div>
    <div class="stat-item"><div class="stat-value ${s.occlusion_points > 0 ? "warning" : "ok"}">${s.occlusion_points}</div><div class="stat-label">遮挡点</div></div>
    <div class="stat-item"><div class="stat-value danger">${s.pending_review || 0}</div><div class="stat-label">待安全员复核</div></div>
    <div class="stat-item"><div class="stat-value ok">${s.resolved || 0}</div><div class="stat-label">已解决</div></div>
    ${(s.escalated || 0) > 0 ? `<div class="stat-item"><div class="stat-value danger">${s.escalated}</div><div class="stat-label">已升级安全员</div></div>` : ""}
  `;

  renderOcclusionList(data);
  renderObstacleList(data);
  renderProfileList(data);
  loadChartData();
}

function renderOcclusionList(data) {
  const container = el("occlusion-list");
  if (!data.occlusion_points || data.occlusion_points.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">当前无遮挡点，数据一致。</p>';
    return;
  }
  container.innerHTML = data.occlusion_points.map((op) => {
    const statusClass = op.status === "pending_review" ? "pending" : op.status === "resolved" ? "resolved" : "escalated";
    const hasChange = op.original_reason && (
      op.original_missing_material !== op.missing_material ||
      op.original_next_action !== op.next_action ||
      op.status !== "pending_review"
    );

    const auditHtml = op.audit_trail && op.audit_trail.length > 0 ? `
      <div class="audit-trail">
        <h5>📋 变更历史（原始说法 → 改后值 · 原因 · 下一步）</h5>
        ${op.audit_trail.map((entry) => `
          <div class="audit-entry">
            <div class="audit-header">
              <span class="audit-action">${_actionLabel(entry.action)}</span>
              <span class="audit-time">${entry.timestamp}</span>
            </div>
            ${entry.from_status || entry.to_status ? `
              <div class="audit-field">状态:
                <span class="from">${entry.from_status || "(新建)"}</span>
                <span class="arrow">→</span>
                <span class="to">${entry.to_status}</span>
              </div>` : ""}
            ${entry.from_missing_material !== entry.to_missing_material ? `
              <div class="audit-field">缺失材料:
                <span class="from">${entry.from_missing_material || "(无)"}</span>
                <span class="arrow">→</span>
                <span class="to">${entry.to_missing_material}</span>
              </div>` : ""}
            ${entry.from_next_action !== entry.to_next_action ? `
              <div class="audit-field">下一步:
                <span class="from">${entry.from_next_action || "(无)"}</span>
                <span class="arrow">→</span>
                <span class="to">${entry.to_next_action}</span>
              </div>` : ""}
            <div class="audit-field">操作人: <strong>${entry.changed_by}</strong> · 原因: ${entry.change_cause}</div>
            ${entry.note ? `<div class="audit-note">💡 ${entry.note}</div>` : ""}
          </div>
        `).join("")}
      </div>
    ` : "";

    return `
      <div class="occlusion-card ${statusClass}">
        <h4 onclick="showOcclusionDetail('${op.id}')" style="cursor:pointer;">
          🔍 照片 ${op.photo_ref} — 点位 (${(op.x ?? 0).toFixed(2)}, ${(op.y ?? 0).toFixed(2)}, ${(op.z ?? 0).toFixed(2)})
        </h4>
        <dl class="occlusion-meta">
          <dt>状态</dt><dd>${op.status_label}</dd>
          <dt>为什么被留下</dt><dd>${op.reason}</dd>
          <dt>还缺什么材料</dt><dd>${op.missing_material}</dd>
          <dt>下一步</dt><dd>${op.next_action_label}</dd>
        </dl>
        ${hasChange ? `
          <div style="margin-top:8px;padding:6px 10px;background:#fffbe6;border-radius:4px;border-left:3px solid #faad14;font-size:12px;color:#ad6800;">
            <strong>原始说法保留：</strong>
            ${op.original_missing_material !== op.missing_material ? `原始缺失：${op.original_missing_material}` : ""}
            ${op.original_next_action && op.original_next_action !== op.next_action ? ` · 原始下一步：${_naLabel(op.original_next_action)}` : ""}
          </div>
        ` : ""}
        <div class="occlusion-actions">
          ${op.status === "pending_review" ? `<button class="escalate" onclick="escalateOcclusion('${op.id}')">升级到安全员</button>` : ""}
          <button onclick="showOcclusionDetail('${op.id}')">查看详情 + 审计轨迹</button>
          ${op.status !== "resolved" ? `<button onclick="showOcclusionDetail('${op.id}')" style="background:#52c41a;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">补录坐标</button>` : ""}
          ${op.obstacle_remark_id ? `<span class="back-link" onclick="goToObstacle('${op.obstacle_remark_id}')">→ 查看关联障碍物备注</span>` : ""}
          ${op.floor_profile_id ? `<span class="back-link" onclick="goToProfile('${op.floor_profile_id}')">→ 查看关联楼层剖面草图</span>` : ""}
        </div>
        ${auditHtml}
      </div>
    `;
  }).join("");
}

function _actionLabel(action) {
  return ({
    created: "首次检测生成",
    resolved_by_coordinate: "坐标表补录后自动解决",
    escalated_to_safety: "升级安全员复核",
    revert_to_pending: "回退待复核",
    review_comment: "人工复核批注",
  })[action] || action;
}

function _naLabel(na) {
  return na === "safety_officer" ? "找安全员复核" : na === "instructor_liang" ? "找培训教官老梁补材料" : na;
}

function renderObstacleList(data) {
  const container = el("obstacle-list");
  if (!data.obstacle_remarks || data.obstacle_remarks.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">暂无障碍物备注。</p>';
    return;
  }
  container.innerHTML = data.obstacle_remarks.map((r) => {
    const sevClass = `severity-${r.severity}`;
    const relatedOcclusions = (data.occlusion_points || [])
      .filter((op) => op.obstacle_remark_id === r.id)
      .length;
    return `
      <div class="obstacle-card" id="obstacle-${r.id}">
        <h4>${r.location} ${relatedOcclusions > 0 ? `<span style="font-size:11px;background:#fff1f0;color:#f5222d;padding:2px 6px;border-radius:8px;">关联 ${relatedOcclusions} 个遮挡点</span>` : ""}</h4>
        <p>${r.description}</p>
        <span class="severity-tag ${sevClass}">${r.severity}</span>
        <p style="font-size:12px;color:#999;margin-top:4px;">照片: ${r.photo_refs.join(", ") || "无"}</p>
        ${r.notes ? `<p style="font-size:12px;color:#666;margin-top:4px;">备注: ${r.notes}</p>` : ""}
        ${relatedOcclusions > 0 ? `<span class="back-link" onclick="switchTab('occlusion')">→ 查看关联遮挡点</span>` : ""}
      </div>
    `;
  }).join("");
}

function renderProfileList(data) {
  const container = el("profile-list");
  if (!data.floor_profiles || data.floor_profiles.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">暂无楼层剖面草图。</p>';
    return;
  }
  container.innerHTML = data.floor_profiles.map((p) => {
    const relatedOcclusions = (data.occlusion_points || [])
      .filter((op) => op.floor_profile_id === p.id)
      .length;
    return `
      <div class="profile-card" id="profile-${p.id}">
        <h4>${p.floor_name} ${relatedOcclusions > 0 ? `<span style="font-size:11px;background:#fff1f0;color:#f5222d;padding:2px 6px;border-radius:8px;">关联 ${relatedOcclusions} 个遮挡点</span>` : ""}</h4>
        <p style="font-size:12px;color:#999;">照片: ${p.photo_refs.join(", ") || "无"}</p>
        ${p.notes ? `<p style="font-size:12px;color:#666;">${p.notes}</p>` : ""}
        ${relatedOcclusions > 0 ? `<span class="back-link" onclick="switchTab('occlusion')">→ 查看关联遮挡点</span>` : ""}
      </div>
    `;
  }).join("");
}

function goToObstacle(remarkId) {
  hideDetailModal();
  switchTab("obstacles");
  setTimeout(() => {
    const card = document.getElementById(`obstacle-${remarkId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.boxShadow = "0 0 0 3px #1890ff";
      setTimeout(() => (card.style.boxShadow = ""), 2000);
    }
  }, 100);
}

function goToProfile(profileId) {
  hideDetailModal();
  switchTab("profiles");
  setTimeout(() => {
    const card = document.getElementById(`profile-${profileId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.boxShadow = "0 0 0 3px #1890ff";
      setTimeout(() => (card.style.boxShadow = ""), 2000);
    }
  }, 100);
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.add("hidden"));
  const tabEl = document.querySelector(`.tab[onclick*="'${tabName}'"]`) || document.querySelector(`.tab[onclick*="${tabName}"]`);
  if (tabEl) tabEl.classList.add("active");
  const content = el(`tab-${tabName}`);
  if (content) content.classList.remove("hidden");
}

function showImportPanel(type) {
  currentImportType = type;
  el("import-title").textContent =
    type === "obstacles" ? "导入障碍物备注" : "补录楼层剖面草图";
  el("import-json").value = "";
  el("import-panel").classList.remove("hidden");
}

function hideImportPanel() {
  el("import-panel").classList.add("hidden");
  currentImportType = null;
}

async function doImport() {
  const raw = el("import-json").value.trim();
  if (!raw) return showStatusMsg("请粘贴JSON数据", true);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return showStatusMsg("JSON解析失败: " + e.message, true);
  }
  if (!Array.isArray(data)) data = [data];

  try {
    let result;
    if (currentImportType === "obstacles") {
      result = await api("POST", `/projects/${currentProjectId}/obstacles`, { obstacles: data });
    } else {
      result = await api("POST", `/projects/${currentProjectId}/floor-profiles`, { profiles: data });
    }
    currentProjectData = result;
    renderProject(result);
    hideImportPanel();
  } catch (e) {
    showStatusMsg("导入失败: " + e.message, true);
  }
}

async function runStep() {
  try {
    const result = await api("POST", `/projects/${currentProjectId}/step`);
    currentProjectData = result;
    renderProject(result);
  } catch (e) {
    showStatusMsg("推进失败: " + e.message, true);
  }
}

async function escalateOcclusion(occlusionId) {
  try {
    const result = await api("POST", `/projects/${currentProjectId}/occlusion/${occlusionId}/escalate`, { target: "safety_officer" });
    currentProjectData = result;
    renderProject(result);
  } catch (e) {
    showStatusMsg("升级失败: " + e.message, true);
  }
}

async function escalateAndShowDetail(occlusionId) {
  try {
    const result = await api("POST", `/projects/${currentProjectId}/occlusion/${occlusionId}/escalate`, { target: "safety_officer" });
    currentProjectData = result;
    renderProject(result);
    showOcclusionDetail(occlusionId);
  } catch (e) {
    showStatusMsg("升级失败: " + e.message, true);
  }
}

async function resolveWithCoords(occlusionId) {
  const pointLabel = document.getElementById(`resolve-point_label-${occlusionId}`).value.trim();
  const x = parseFloat(document.getElementById(`resolve-x-${occlusionId}`).value);
  const y = parseFloat(document.getElementById(`resolve-y-${occlusionId}`).value);
  const z = parseFloat(document.getElementById(`resolve-z-${occlusionId}`).value);
  if (!pointLabel) return showStatusMsg("请输入点位标签", true);
  if (isNaN(x) || isNaN(y) || isNaN(z)) return showStatusMsg("请输入有效的坐标值", true);
  try {
    const result = await api("POST", `/projects/${currentProjectId}/occlusion/${occlusionId}/resolve`, {
      point_label: pointLabel, x, y, z,
    });
    currentProjectData = result;
    renderProject(result);
    showOcclusionDetail(occlusionId);
  } catch (e) {
    showStatusMsg("补录坐标失败: " + e.message, true);
  }
}

async function submitReviewComment(occlusionId) {
  const textarea = document.getElementById(`comment-${occlusionId}`);
  const reviewer = document.getElementById(`reviewer-${occlusionId}`);
  const comment = (textarea?.value || "").trim();
  const who = (reviewer?.value || "safety_officer");
  if (!comment) return showStatusMsg("请填写复核批注内容", true);
  try {
    const result = await api("POST", `/projects/${currentProjectId}/occlusion/${occlusionId}/review-comment`, {
      comment,
      reviewer: who,
    });
    currentProjectData = result;
    renderProject(result);
    showOcclusionDetail(occlusionId);
  } catch (e) {
    showStatusMsg("提交失败: " + e.message, true);
  }
}

async function loadReport() {
  try {
    const text = await apiText(`/projects/${currentProjectId}/report`);
    el("report-content").textContent = text;
  } catch (e) {
    el("report-content").textContent = "生成报告失败: " + e.message;
  }
}

async function loadChartData() {
  try {
    const data = await api("GET", `/projects/${currentProjectId}/chart-data`);
    chartDataCache = data;
    drawChart(data);
    draw3D(data);
  } catch (e) {
    console.error("加载图表数据失败:", e);
  }
}

function drawChart(data) {
  const canvas = el("chart-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  chartHitTargets = [];

  const allPoints = [
    ...data.photo_locations.map((p) => ({ ...p, type: "photo" })),
    ...data.coordinate_rows.map((p) => ({ ...p, type: "coord" })),
  ];

  if (allPoints.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂无数据，请先导入障碍物备注或楼层剖面草图", W / 2, H / 2);
    el("chart-legend").innerHTML = "";
    canvas.onclick = null;
    return;
  }

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs) - 2;
  const maxX = Math.max(...xs) + 2;
  const minY = Math.min(...ys) - 2;
  const maxY = Math.max(...ys) + 2;
  const pad = 60;

  function toScreen(px, py) {
    return [
      pad + ((px - minX) / (maxX - minX)) * (W - 2 * pad),
      H - pad - ((py - minY) / (maxY - minY)) * (H - 2 * pad),
    ];
  }

  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const [sx] = toScreen(minX + (maxX - minX) * i / 10, 0);
    ctx.beginPath();
    ctx.moveTo(sx, pad);
    ctx.lineTo(sx, H - pad);
    ctx.stroke();
  }
  for (let i = 0; i <= 10; i++) {
    const [, sy] = toScreen(0, minY + (maxY - minY) * i / 10);
    ctx.beginPath();
    ctx.moveTo(pad, sy);
    ctx.lineTo(W - pad, sy);
    ctx.stroke();
  }

  data.coordinate_rows.forEach((p) => {
    const [sx, sy] = toScreen(p.x, p.y);
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#52c41a";
    ctx.fill();
    ctx.strokeStyle = "#389e0d";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#389e0d";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.point_label, sx + 10, sy + 4);
  });

  data.photo_locations.forEach((p) => {
    const [sx, sy] = toScreen(p.x, p.y);
    const hasMatch = p.has_coordinate_match;
    const occlusion = data.occlusion_points.find(
      (op) => Math.abs(op.x - p.x) < 0.01 && Math.abs(op.y - p.y) < 0.01 && Math.abs(op.z - p.z) < 0.01
    );

    const radius = hasMatch ? 5 : 8;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = hasMatch ? "#1890ff" : "#f5222d";
    ctx.fill();

    if (!hasMatch) {
      ctx.strokeStyle = "#f5222d";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (occlusion) {
        chartHitTargets.push({
          x: sx, y: sy, r: 16, occlusion, kind: "chart",
        });
      }
    }
  });

  data.occlusion_points.forEach((op) => {
    const [sx, sy] = toScreen(op.x, op.y);
    ctx.fillStyle = "#f5222d";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠", sx, sy - 14);
  });

  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = cx * scaleX;
    const py = cy * scaleY;

    for (const t of chartHitTargets) {
      const dx = px - t.x, dy = py - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) {
        showOcclusionDetail(t.occlusion.id);
        return;
      }
    }
  };

  el("chart-legend").innerHTML = `
    <div class="legend-item"><div class="legend-dot" style="background:#52c41a"></div>坐标表行</div>
    <div class="legend-item"><div class="legend-dot" style="background:#1890ff"></div>照片点位（已匹配）</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f5222d"></div>照片有点位但坐标表缺行（可点击）</div>
    <div class="legend-item" style="color:#f5222d;font-weight:600;">⚠ = 遮挡点（待安全员复核）</div>
  `;
}

function draw3D(data) {
  const canvas = el("three-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  threeHitTargets = [];

  const allPoints = [
    ...data.photo_locations.map((p) => ({ ...p, type: "photo" })),
    ...data.coordinate_rows.map((p) => ({ ...p, type: "coord" })),
  ];

  if (allPoints.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂无数据", W / 2, H / 2);
    canvas.onclick = null;
    return;
  }

  function project3D(x, y, z) {
    const angle = 0.6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    const scale = 15;
    return [
      W / 2 + rx * scale,
      H / 2 - z * scale + ry * scale * 0.3,
    ];
  }

  ctx.strokeStyle = "#d0d0d0";
  ctx.lineWidth = 0.5;
  for (let x = -10; x <= 10; x += 2) {
    const [sx1, sy1] = project3D(x, -10, 0);
    const [sx2, sy2] = project3D(x, 10, 0);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }
  for (let y = -10; y <= 10; y += 2) {
    const [sx1, sy1] = project3D(-10, y, 0);
    const [sx2, sy2] = project3D(10, y, 0);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }

  data.coordinate_rows.forEach((p) => {
    const [sx, sy] = project3D(p.x, p.y, p.z);
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#52c41a";
    ctx.fill();
    ctx.strokeStyle = "#389e0d";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  data.photo_locations.forEach((p) => {
    const [sx, sy] = project3D(p.x, p.y, p.z);
    const hasMatch = p.has_coordinate_match;
    const occlusion = data.occlusion_points.find(
      (op) => Math.abs(op.x - p.x) < 0.01 && Math.abs(op.y - p.y) < 0.01 && Math.abs(op.z - p.z) < 0.01
    );

    const radius = hasMatch ? 4 : 7;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = hasMatch ? "#1890ff" : "#f5222d";
    ctx.fill();
    if (!hasMatch) {
      ctx.strokeStyle = "#ff7875";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy - 20);
      ctx.strokeStyle = "#f5222d";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#f5222d";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", sx, sy - 22);

      if (occlusion) {
        threeHitTargets.push({ x: sx, y: sy, r: 14, occlusion, kind: "3d" });
      }
    }
  });

  data.occlusion_points.forEach((op) => {
    const [sx, sy] = project3D(op.x, op.y, op.z);
    ctx.fillStyle = "#f5222d";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠", sx + 14, sy - 8);
  });

  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = cx * scaleX;
    const py = cy * scaleY;

    for (const t of threeHitTargets) {
      const dx = px - t.x, dy = py - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) {
        showOcclusionDetail(t.occlusion.id);
        return;
      }
    }
  };
}

function showOcclusionDetail(occlusionId) {
  if (!currentProjectData || !currentProjectData.occlusion_points) return;
  const op = currentProjectData.occlusion_points.find((o) => o.id === occlusionId);
  if (!op) return;

  el("detail-title").textContent = `异常点详情 · 照片 ${op.photo_ref}`;

  const statusClass = op.status === "pending_review" ? "pending" : op.status === "resolved" ? "resolved" : "escalated";

  const auditHtml = op.audit_trail && op.audit_trail.length > 0 ? `
    <div class="audit-trail">
      <h5>📋 变更历史</h5>
      ${op.audit_trail.map((entry) => `
        <div class="audit-entry">
          <div class="audit-header">
            <span class="audit-action">${_actionLabel(entry.action)}</span>
            <span class="audit-time">${entry.timestamp}</span>
          </div>
          ${entry.from_status || entry.to_status ? `
            <div class="audit-field">状态:
              <span class="from">${entry.from_status || "(新建)"}</span>
              <span class="arrow">→</span>
              <span class="to">${entry.to_status}</span>
            </div>` : ""}
          ${entry.from_missing_material !== entry.to_missing_material ? `
            <div class="audit-field">缺失材料:
              <span class="from">${entry.from_missing_material || "(无)"}</span>
              <span class="arrow">→</span>
              <span class="to">${entry.to_missing_material}</span>
            </div>` : ""}
          ${entry.from_next_action !== entry.to_next_action ? `
            <div class="audit-field">下一步:
              <span class="from">${entry.from_next_action ? _naLabel(entry.from_next_action) : "(无)"}</span>
              <span class="arrow">→</span>
              <span class="to">${_naLabel(entry.to_next_action)}</span>
            </div>` : ""}
          <div class="audit-field">操作人: <strong>${entry.changed_by}</strong> · 原因: ${entry.change_cause}</div>
          ${entry.note ? `<div class="audit-note">💡 ${entry.note}</div>` : ""}
        </div>
      `).join("")}
    </div>
  ` : "";

  const hasOriginal = op.original_reason && (
    op.original_missing_material !== op.missing_material ||
    op.original_next_action !== op.next_action ||
    op.status !== "pending_review"
  );

  el("detail-body").innerHTML = `
    <div class="detail-block ${statusClass}">
      <h5>照片有点位但坐标表缺一行 — 当前状态：${op.status_label}</h5>
      <div class="detail-row"><div class="label">照片引用</div><div class="value"><strong>${op.photo_ref}</strong> · 点位 (${(op.x ?? 0).toFixed(2)}, ${(op.y ?? 0).toFixed(2)}, ${(op.z ?? 0).toFixed(2)})</div></div>
      <div class="detail-row"><div class="label">为什么被留下</div><div class="value">${op.reason}</div></div>
      <div class="detail-row"><div class="label">还缺什么材料</div><div class="value">${op.missing_material}</div></div>
      <div class="detail-row"><div class="label">下一步</div><div class="value">${op.next_action_label}</div></div>
      ${hasOriginal ? `
        <div class="detail-row original"><div class="label">原始缺失描述</div><div class="value">${op.original_missing_material}</div></div>
        ${op.original_next_action && op.original_next_action !== op.next_action ? `<div class="detail-row original"><div class="label">原始下一步</div><div class="value">${_naLabel(op.original_next_action)}</div></div>` : ""}
      ` : ""}
      ${op.obstacle_remark_summary ? `<div class="detail-row"><div class="label">关联障碍物备注</div><div class="value">${op.obstacle_remark_summary}</div></div>` : ""}
      ${op.floor_profile_summary ? `<div class="detail-row"><div class="label">关联楼层剖面草图</div><div class="value">${op.floor_profile_summary}</div></div>` : ""}
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
      ${op.status === "pending_review" ? `<button class="escalate" style="background:#f5222d;color:white;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;" onclick="escalateAndShowDetail('${op.id}')">升级安全员</button>` : ""}
      ${op.obstacle_remark_id ? `<button style="border:1px solid #1890ff;background:white;color:#1890ff;border-radius:4px;padding:8px 16px;cursor:pointer;" onclick="goToObstacle('${op.obstacle_remark_id}')">→ 回到障碍物备注</button>` : ""}
      ${op.floor_profile_id ? `<button style="border:1px solid #1890ff;background:white;color:#1890ff;border-radius:4px;padding:8px 16px;cursor:pointer;" onclick="goToProfile('${op.floor_profile_id}')">→ 回到楼层剖面草图</button>` : ""}
      <button style="border:1px solid #d9d9d9;background:white;color:#666;border-radius:4px;padding:8px 16px;cursor:pointer;" onclick="switchTab('occlusion');hideDetailModal();">在遮挡点清单中查看</button>
    </div>

    ${auditHtml}

    <div style="margin-top:16px;padding:14px;background:#f6ffed;border:1px solid #b7eb8f;border-radius:6px;">
      <h5 style="margin:0 0 10px 0;color:#389e0d;">📍 补录坐标行</h5>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label style="font-size:13px;">点位标签 <input id="resolve-point_label-${op.id}" type="text" value="P-NEW-XX" style="padding:4px 8px;border:1px solid #d9d9d9;border-radius:4px;width:120px;"></label>
        <label style="font-size:13px;">X <input id="resolve-x-${op.id}" type="number" step="0.01" value="${(op.x ?? 0).toFixed(2)}" style="padding:4px 8px;border:1px solid #d9d9d9;border-radius:4px;width:90px;"></label>
        <label style="font-size:13px;">Y <input id="resolve-y-${op.id}" type="number" step="0.01" value="${(op.y ?? 0).toFixed(2)}" style="padding:4px 8px;border:1px solid #d9d9d9;border-radius:4px;width:90px;"></label>
        <label style="font-size:13px;">Z <input id="resolve-z-${op.id}" type="number" step="0.01" value="${(op.z ?? 0).toFixed(2)}" style="padding:4px 8px;border:1px solid #d9d9d9;border-radius:4px;width:90px;"></label>
        <button onclick="resolveWithCoords('${op.id}')" style="background:#52c41a;color:white;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-weight:bold;">保存并重算</button>
      </div>
    </div>

    <div class="review-form">
      <h5>📝 人工复核批注（留痕：原始说法 + 改后值 + 原因 + 下一步找谁）</h5>
      <label>复核人
        <select id="reviewer-${op.id}" style="padding:4px 8px;border:1px solid #d9d9d9;border-radius:4px;font-size:13px;">
          <option value="safety_officer">安全员</option>
          <option value="instructor_liang">培训教官老梁</option>
        </select>
      </label>
      <label>批注内容
        <textarea id="comment-${op.id}" placeholder="例如：已到现场查看，坐标表缺行确属录入遗漏，立即安排补录。"></textarea>
      </label>
      <button onclick="submitReviewComment('${op.id}')">提交复核批注（写入审计轨迹）</button>
    </div>
  `;

  el("detail-modal").classList.remove("hidden");
}

function hideDetailModal() {
  el("detail-modal").classList.add("hidden");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideImportPanel();
    hideDetailModal();
  }
});

refreshProjectList();
