let currentProjectId = null;
let currentProjectData = null;
let currentImportType = null;

const API = "/api";

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
  if (!name) return alert("请输入项目名称");
  const result = await api("POST", "/projects", { name, plant_name: plant });
  currentProjectId = result.id;
  await refreshProjectList();
  hideCreateProject();
  await loadProject(currentProjectId);
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
    <div class="stat-item"><div class="stat-value danger">${s.pending_review}</div><div class="stat-label">待安全员复核</div></div>
    <div class="stat-item"><div class="stat-value ok">${s.resolved}</div><div class="stat-label">已解决</div></div>
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
    return `
      <div class="occlusion-card ${statusClass}">
        <h4>照片 ${op.photo_ref} — 点位 (${op.point_x.toFixed(2)}, ${op.point_y.toFixed(2)}, ${op.point_z.toFixed(2)})</h4>
        <dl class="occlusion-meta">
          <dt>状态</dt><dd>${op.status_label}</dd>
          <dt>为什么被留下</dt><dd>${op.reason}</dd>
          <dt>还缺什么材料</dt><dd>${op.missing_material}</dd>
          <dt>下一步</dt><dd>${op.next_action_label}</dd>
        </dl>
        <div class="occlusion-actions">
          ${op.status === "pending_review" ? `<button class="escalate" onclick="escalateOcclusion('${op.id}')">升级到安全员</button>` : ""}
          ${op.obstacle_remark_id ? `<span class="back-link" onclick="goToObstacle('${op.obstacle_remark_id}')">→ 查看关联障碍物备注</span>` : ""}
          ${op.floor_profile_id ? `<span class="back-link" onclick="goToProfile('${op.floor_profile_id}')">→ 查看关联楼层剖面草图</span>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderObstacleList(data) {
  const container = el("obstacle-list");
  if (!data.obstacle_remarks || data.obstacle_remarks.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">暂无障碍物备注。</p>';
    return;
  }
  container.innerHTML = data.obstacle_remarks.map((r) => {
    const sevClass = `severity-${r.severity}`;
    return `
      <div class="obstacle-card" id="obstacle-${r.id}">
        <h4>${r.location}</h4>
        <p>${r.description}</p>
        <span class="severity-tag ${sevClass}">${r.severity}</span>
        <p style="font-size:12px;color:#999;margin-top:4px;">照片: ${r.photo_refs.join(", ") || "无"}</p>
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
    return `
      <div class="profile-card" id="profile-${p.id}">
        <h4>${p.floor_name}</h4>
        <p style="font-size:12px;color:#999;">照片: ${p.photo_refs.join(", ") || "无"}</p>
        ${p.notes ? `<p style="font-size:12px;color:#666;">${p.notes}</p>` : ""}
      </div>
    `;
  }).join("");
}

function goToObstacle(remarkId) {
  switchTab("obstacles");
  setTimeout(() => {
    const card = document.getElementById(`obstacle-${remarkId}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function goToProfile(profileId) {
  switchTab("profiles");
  setTimeout(() => {
    const card = document.getElementById(`profile-${profileId}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.add("hidden"));
  const tabEl = document.querySelector(`.tab[onclick*="${tabName}"]`);
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
  if (!raw) return alert("请粘贴JSON数据");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return alert("JSON解析失败: " + e.message);
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
    alert("导入失败: " + e.message);
  }
}

async function runStep() {
  try {
    const result = await api("POST", `/projects/${currentProjectId}/step`);
    currentProjectData = result;
    renderProject(result);
  } catch (e) {
    alert("推进失败: " + e.message);
  }
}

async function escalateOcclusion(occlusionId) {
  try {
    const result = await api("POST", `/projects/${currentProjectId}/occlusion/${occlusionId}/escalate`, { target: "safety_officer" });
    currentProjectData = result;
    renderProject(result);
  } catch (e) {
    alert("升级失败: " + e.message);
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
    ctx.beginPath();
    ctx.arc(sx, sy, hasMatch ? 5 : 8, 0, Math.PI * 2);
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
    }
  });

  data.occlusion_points.forEach((op) => {
    const [sx, sy] = toScreen(op.x, op.y);
    ctx.fillStyle = "#f5222d";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠", sx, sy - 14);
  });

  el("chart-legend").innerHTML = `
    <div class="legend-item"><div class="legend-dot" style="background:#52c41a"></div>坐标表行</div>
    <div class="legend-item"><div class="legend-dot" style="background:#1890ff"></div>照片点位（已匹配）</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f5222d"></div>照片有点位但坐标表缺行</div>
    <div class="legend-item" style="color:#f5222d;font-weight:600;">⚠ = 遮挡点（待安全员复核）</div>
  `;
}

function draw3D(data) {
  const canvas = el("three-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const allPoints = [
    ...data.photo_locations.map((p) => ({ ...p, type: "photo" })),
    ...data.coordinate_rows.map((p) => ({ ...p, type: "coord" })),
  ];

  if (allPoints.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂无数据", W / 2, H / 2);
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
    ctx.beginPath();
    ctx.arc(sx, sy, hasMatch ? 4 : 7, 0, Math.PI * 2);
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
    }
  });

  data.occlusion_points.forEach((op) => {
    const [sx, sy] = project3D(op.x, op.y, op.z);
    ctx.fillStyle = "#f5222d";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠", sx + 14, sy - 8);
  });
}

refreshProjectList();
