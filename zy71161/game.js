"use strict";

const CONFIG = {
  GRID: 20,
  CELL: 34,
  TURN_LIMIT: 60,
  BAT_MAX: 100,
  LOAD_MAX: 8,
  MOVE_COST: 3,
  SAMPLE_COST: 4,
  TRANSMIT_COST: 2,
  WAIT_COST: 0,
  SUN_GAIN: 4,
  SHADE_DRAIN: 2,
  NIGHT_DRAIN: 5,
  OVERLOAD_PENALTY: 8,
  SAMPLE_VALUE: 15,
  SUN_DEG_PER_TURN: 9,
  COMM_WINDOW_INTERVAL: 8,
  COMM_WINDOW_LEN: 3,
  SAMPLE_RESPAWN: false,
};

const MOUNT_RADIUS = 1.8;
const MOUNT_SHADOW_LEN = 3.2;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayBadge = document.getElementById("overlayBadge");
const overlayText = document.getElementById("overlayText");

const el = (id) => document.getElementById(id);

let state = null;
let replay = null;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function seedWorld() {
  const grid = [];
  for (let y = 0; y < CONFIG.GRID; y++) {
    const row = [];
    for (let x = 0; x < CONFIG.GRID; x++) {
      row.push({
        x, y,
        terrain: "regolith",
        sample: null,
        hasSample: false,
        mountain: 0,
      });
    }
    grid.push(row);
  }

  const craterCount = randInt(3, 5);
  for (let i = 0; i < craterCount; i++) {
    const cx = randInt(2, CONFIG.GRID - 3);
    const cy = randInt(2, CONFIG.GRID - 3);
    const r = randInt(1, 2);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const x = cx + dx, y = cy + dy;
          if (grid[y] && grid[y][x] && grid[y][x].terrain === "regolith") {
            grid[y][x].terrain = "crater";
          }
        }
      }
    }
  }

  const rockCount = randInt(10, 16);
  for (let i = 0; i < rockCount; i++) {
    const x = randInt(1, CONFIG.GRID - 2);
    const y = randInt(1, CONFIG.GRID - 2);
    if (grid[y][x].terrain === "regolith") grid[y][x].terrain = "rock";
  }

  const mountCount = randInt(4, 7);
  const mounts = [];
  let attempts = 0;
  while (mounts.length < mountCount && attempts < 40) {
    attempts++;
    const m = { x: randInt(3, CONFIG.GRID - 4), y: randInt(3, CONFIG.GRID - 4), h: randInt(1, 3) };
    if (grid[m.y][m.x].terrain !== "rock") {
      grid[m.y][m.x].mountain = m.h;
      grid[m.y][m.x].terrain = "mountain";
      mounts.push(m);
    }
  }

  const sampleCount = randInt(8, 12);
  let placed = 0;
  let tries = 0;
  while (placed < sampleCount && tries < 200) {
    tries++;
    const x = randInt(0, CONFIG.GRID - 1);
    const y = randInt(0, CONFIG.GRID - 1);
    const cell = grid[y][x];
    if (cell.terrain === "regolith" || cell.terrain === "crater") {
      if (!cell.hasSample && !cell.mountain) {
        cell.hasSample = true;
        cell.sample = {
          id: "S" + placed,
          type: ["岩芯", "尘埃", "冰样", "金属"][randInt(0, 3)],
          value: CONFIG.SAMPLE_VALUE + randInt(0, 10),
        };
        placed++;
      }
    }
  }

  return { grid, mounts };
}

function initialState() {
  const { grid, mounts } = seedWorld();
  return {
    turn: 0,
    sunAngle: 45,
    battery: CONFIG.BAT_MAX,
    load: 0,
    collected: 0,
    transmitted: 0,
    score: 0,
    rover: { x: 0, y: 0 },
    grid,
    mounts,
    samplesCollected: [],
    commWindows: generateCommWindows(),
    currentComm: null,
    pendingTransmit: [],
    status: "playing",
    failReason: null,
    log: [],
    history: [],
    snapshot: null,
  };
}

function generateCommWindows() {
  const windows = [];
  for (let t = 0; t <= CONFIG.TURN_LIMIT; t += CONFIG.COMM_WINDOW_INTERVAL) {
    if (t === 0) continue;
    windows.push({ start: t, end: t + CONFIG.COMM_WINDOW_LEN - 1, used: false });
  }
  return windows;
}

function resetGame() {
  state = initialState();
  replay = null;
  pushHistory("初始化：月球车在原点着陆，电量满。");
  updateHUD();
  render();
  hideOverlay();
}

function pushHistory(msg, type = "info") {
  state.log.push({ turn: state.turn, msg, type });
  state.history.push(clone({
    turn: state.turn,
    sunAngle: state.sunAngle,
    battery: state.battery,
    load: state.load,
    collected: state.collected,
    transmitted: state.transmitted,
    score: state.score,
    rover: { ...state.rover },
    status: state.status,
    failReason: state.failReason,
    samplesCollected: [...state.samplesCollected],
    pendingTransmit: [...state.pendingTransmit],
  }));
}

function cellIllumination(cell, sunAngle) {
  const lit = isLit(cell, sunAngle);
  const night = sunAngle <= 0 || sunAngle >= 180;
  if (night) return "night";
  if (!lit) return "shade";
  return "sun";
}

function isLit(cell, sunAngle) {
  if (sunAngle <= 0 || sunAngle >= 180) return false;
  const rad = (sunAngle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  for (const m of state.mounts) {
    const vx = cell.x - m.x;
    const vy = cell.y - m.y;
    const along = vx * dx + vy * dy;
    if (along < 0 || along > MOUNT_SHADOW_LEN * m.h) continue;
    const perp = Math.abs(vx * dy - vy * dx);
    if (perp <= MOUNT_RADIUS) return false;
  }
  return true;
}

function canMoveTo(x, y) {
  if (x < 0 || y < 0 || x >= CONFIG.GRID || y >= CONFIG.GRID) return false;
  const cell = state.grid[y][x];
  if (cell.terrain === "rock") return false;
  if (cell.mountain) return false;
  return true;
}

function doTurn(action) {
  if (state.status !== "playing") return;

  let moveDelta = { x: 0, y: 0 };
  if (action.type === "move") {
    const dirs = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const d = dirs[action.dir];
    moveDelta = { x: d[0], y: d[1] };
  }

  state.turn += 1;
  state.sunAngle += CONFIG.SUN_DEG_PER_TURN;
  if (state.sunAngle > 180) state.sunAngle = state.sunAngle - 360;

  let batCost = CONFIG.WAIT_COST;
  let note = "";

  if (action.type === "move") {
    const nx = state.rover.x + moveDelta.x;
    const ny = state.rover.y + moveDelta.y;
    if (canMoveTo(nx, ny)) {
      state.rover.x = nx;
      state.rover.y = ny;
      batCost = CONFIG.MOVE_COST + Math.floor(state.load / 2);
      note = `移动至 (${nx},${ny})，耗电 ${batCost}。`;
    } else {
      note = "前方障碍，原地待命。";
      batCost = 1;
    }
  } else if (action.type === "wait") {
    batCost = CONFIG.WAIT_COST;
    note = "原地等待一回合。";
  } else if (action.type === "sample") {
    const cell = state.grid[state.rover.y][state.rover.x];
    if (cell.hasSample && cell.sample) {
      if (state.load >= CONFIG.LOAD_MAX) {
        batCost = 1;
        note = "载荷已满，无法继续采集！";
      } else {
        batCost = CONFIG.SAMPLE_COST;
        const s = cell.sample;
        cell.hasSample = false;
        cell.sample = null;
        state.load += 1;
        state.collected += 1;
        state.score += Math.floor(s.value * 0.3);
        state.samplesCollected.push({ ...s, turn: state.turn, x: state.rover.x, y: state.rover.y });
        note = `采集 ${s.type} 样本 ${s.id}，+${s.value} 基准分。`;
      }
    } else {
      batCost = 1;
      note = "此处无样本可采集。";
    }
  } else if (action.type === "transmit") {
    const win = currentCommWindow();
    if (win) {
      batCost = CONFIG.TRANSMIT_COST;
      const items = state.samplesCollected.filter((s) => !state.pendingTransmit.includes(s.id));
      if (items.length === 0) {
        note = "没有可回传的样本数据。";
      } else {
        const gain = items.reduce((a, b) => a + b.value, 0);
        state.score += gain;
        state.transmitted += items.length;
        state.load = 0;
        items.forEach((s) => state.pendingTransmit.push(s.id));
        note = `回传 ${items.length} 份样本，得分 +${gain}。载荷已清空。`;
        win.used = true;
      }
    } else {
      batCost = 1;
      note = "非通讯窗口期，无法建立链路。";
    }
  }

  state.battery -= batCost;

  const cell = state.grid[state.rover.y][state.rover.x];
  const illum = cellIllumination(cell, state.sunAngle);
  if (illum === "sun") {
    state.battery += CONFIG.SUN_GAIN;
    note += ` 日光下充电 +${CONFIG.SUN_GAIN}。`;
  } else if (illum === "shade") {
    state.battery -= CONFIG.SHADE_DRAIN;
    note += ` 阴影耗电 -${CONFIG.SHADE_DRAIN}。`;
  } else {
    state.battery -= CONFIG.NIGHT_DRAIN;
    note += ` 月夜耗电 -${CONFIG.NIGHT_DRAIN}。`;
  }

  if (state.load > CONFIG.LOAD_MAX) {
    state.battery -= CONFIG.OVERLOAD_PENALTY;
    note += ` 载荷超载！额外耗电 -${CONFIG.OVERLOAD_PENALTY}。`;
  }

  state.battery = Math.max(0, Math.min(CONFIG.BAT_MAX, state.battery));

  if (note) pushHistory(note, resolveType(note));

  updateCommWindow();

  if (state.battery <= 0) {
    state.status = "failed";
    state.failReason = "电量耗尽，月球车停机。";
    pushHistory(state.failReason, "bad");
  } else if (state.turn >= CONFIG.TURN_LIMIT) {
    state.status = "finished";
    state.failReason = "任务回合已结束。";
    pushHistory(state.failReason, "warn");
  }

  updateHUD();
  render();

  if (state.status !== "playing") {
    finalize();
  }
}

function resolveType(note) {
  if (/采集|回传|充电/.test(note)) return "ok";
  if (/耗电|阴影|月夜|超载|障碍|无法|通讯/.test(note)) return "warn";
  return "info";
}

function currentCommWindow() {
  return state.commWindows.find((w) => state.turn >= w.start && state.turn <= w.end && !w.used);
}

function nextCommWindow() {
  return state.commWindows.find((w) => state.turn < w.start);
}

function updateCommWindow() {
  state.currentComm = currentCommWindow();
}

function updateHUD() {
  el("hudTurn").textContent = state.turn;
  el("hudSun").textContent = state.sunAngle.toFixed(0) + "°";
  el("hudBat").textContent = Math.round(state.battery);
  el("hudLoad").textContent = state.load + "/" + CONFIG.LOAD_MAX;
  el("hudSam").textContent = state.collected;
  el("hudScore").textContent = state.score;

  renderMissionCard();
  renderCommCard();
  renderLog();
  renderSummary();
}

function renderMissionCard() {
  const card = el("missionCard");
  const sampleLeft = countRemainingSamples();
  card.innerHTML = `
    <div class="kv"><span class="k">目标样本</span><span>${sampleLeft} 处待采集</span></div>
    <div class="kv"><span class="k">已采集</span><span>${state.collected}</span></div>
    <div class="kv"><span class="k">已回传</span><span>${state.transmitted}</span></div>
    <div class="kv"><span class="k">回合剩余</span><span>${CONFIG.TURN_LIMIT - state.turn}</span></div>
    <div class="bar"><div style="width:${(state.turn / CONFIG.TURN_LIMIT) * 100}%"></div></div>
  `;
}

function renderCommCard() {
  const card = el("commCard");
  const cur = currentCommWindow();
  const nxt = nextCommWindow();
  let html = "";
  if (cur) {
    html += `<div class="kv"><span class="k">当前窗口</span><span class="ok">开启 至 T${cur.end}</span></div>`;
  } else {
    html += `<div class="kv"><span class="k">当前窗口</span><span class="warn">关闭</span></div>`;
  }
  if (nxt) {
    html += `<div class="kv"><span class="k">下次开启</span><span>T${nxt.start} - T${nxt.end}</span></div>`;
  }
  html += `<div class="kv"><span class="k">已使用</span><span>${state.commWindows.filter(w=>w.used).length}/${state.commWindows.length}</span></div>`;
  card.innerHTML = html;
}

function renderLog() {
  const logEl = el("log");
  logEl.innerHTML = state.log.slice(-40).map((l) => {
    const t = `<span class="turn">T${String(l.turn).padStart(2, "0")}</span>`;
    return `<div class="line ${l.type}">${t} ${l.msg}</div>`;
  }).join("");
  logEl.scrollTop = logEl.scrollHeight;
}

function renderSummary() {
  const card = el("summaryCard");
  if (state.status === "playing") {
    card.innerHTML = `<div>探索进行中…</div>`;
    return;
  }
  const win = state.status === "finished" && state.transmitted >= 5;
  card.innerHTML = `
    <div class="kv"><span class="k">状态</span><span class="${win?'ok':'bad'}">${win?"任务达成":"任务失败"}</span></div>
    <div class="kv"><span class="k">原因</span><span>${state.failReason || "-"}</span></div>
    <div class="kv"><span class="k">最终得分</span><span>${state.score}</span></div>
    <div class="kv"><span class="k">采集/回传</span><span>${state.collected}/${state.transmitted}</span></div>
    <div class="kv"><span class="k">总回合</span><span>${state.turn}</span></div>
    <div style="margin-top:8px;color:#8892a6;font-size:11px">可点击“历史回放”复盘每回合。</div>
  `;
}

function countRemainingSamples() {
  let n = 0;
  for (const row of state.grid) for (const c of row) if (c.hasSample) n++;
  return n;
}

function showOverlay(badge, text) {
  overlayBadge.textContent = badge;
  overlayText.textContent = text;
  overlay.classList.add("show");
}
function hideOverlay() {
  overlay.classList.remove("show");
}

function finalize() {
  const win = state.status === "finished" && state.transmitted >= 5;
  showOverlay(win ? "任务达成" : "任务失败", state.failReason || "回合结束");
}

function togglePause() {
  if (state.status !== "playing") return;
  state.status = "paused";
  showOverlay("暂停", "探索已暂停");
}
function toggleResume() {
  if (state.status !== "paused") return;
  state.status = "playing";
  hideOverlay();
}

function startReplay() {
  if (state.history.length < 2) {
    alert("回放需要至少 2 条历史记录。");
    return;
  }
  replay = {
    index: 0,
    prevStatus: state.status,
  };
  state.status = "replay";
  showOverlay("回放", "T0 / T" + (state.history.length - 1));
  renderReplayFrame(0);
}

function renderReplayFrame(i) {
  if (!replay) return;
  const snap = state.history[i];
  if (!snap) return;
  replay.index = i;
  const saved = state;
  state.replayView = {
    turn: snap.turn,
    sunAngle: snap.sunAngle,
    battery: snap.battery,
    load: snap.load,
    collected: snap.collected,
    transmitted: snap.transmitted,
    score: snap.score,
    rover: { ...snap.rover },
  };
  overlayBadge.textContent = "回放";
  overlayText.textContent = `T${snap.turn} / T${state.history.length - 1}`;
  render();
}

function replayStep(dir) {
  if (!replay) return;
  const next = Math.max(0, Math.min(state.history.length - 1, replay.index + dir));
  renderReplayFrame(next);
}

function exitReplay() {
  if (!replay) return;
  const prev = replay.prevStatus;
  replay = null;
  state.replayView = null;
  state.status = prev;
  if (state.status === "playing") {
    hideOverlay();
  } else if (state.status === "paused") {
    showOverlay("暂停", "探索已暂停");
  } else if (state.status === "failed" || state.status === "finished") {
    finalize();
  }
  render();
}

function exportReport() {
  const data = buildReport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lunar-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const text = buildReportText(data);
  const blob2 = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url2 = URL.createObjectURL(blob2);
  const b = document.createElement("a");
  b.href = url2;
  b.download = `lunar-report-${Date.now()}.txt`;
  b.click();
  URL.revokeObjectURL(url2);
}

function buildReport() {
  return {
    timestamp: new Date().toISOString(),
    final: {
      status: state.status,
      score: state.score,
      collected: state.collected,
      transmitted: state.transmitted,
      turns: state.turn,
      failReason: state.failReason,
    },
    samples: state.samplesCollected,
    history: state.history,
    log: state.log,
  };
}
function buildReportText(d) {
  let s = "===== 月行任务报告 =====\n";
  s += `时间: ${d.timestamp}\n`;
  s += `状态: ${d.final.status}\n`;
  s += `失败原因: ${d.final.failReason || "-"}\n`;
  s += `最终得分: ${d.final.score}\n`;
  s += `采集/回传: ${d.final.collected}/${d.final.transmitted}\n`;
  s += `回合数: ${d.final.turns}\n\n`;
  s += "--- 样本清单 ---\n";
  for (const it of d.samples) {
    s += `T${it.turn} (${it.x},${it.y}) ${it.type} ${it.id} 价值 ${it.value}\n`;
  }
  s += "\n--- 回合摘要 ---\n";
  for (const h of d.history) {
    s += `T${h.turn} 太阳${h.sunAngle.toFixed(0)}° 电量${h.battery.toFixed(0)} 载荷${h.load} 得分${h.score}\n`;
  }
  return s;
}

function render() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const grid = state.grid;
  const cellSize = Math.floor(Math.min(W, H) / CONFIG.GRID);
  const offsetX = Math.floor((W - cellSize * CONFIG.GRID) / 2);
  const offsetY = Math.floor((H - cellSize * CONFIG.GRID) / 2);

  ctx.fillStyle = "#0a0d13";
  ctx.fillRect(0, 0, W, H);

  const sunA = state.replayView ? state.replayView.sunAngle : state.sunAngle;
  const rover = state.replayView ? state.replayView.rover : state.rover;

  for (let y = 0; y < CONFIG.GRID; y++) {
    for (let x = 0; x < CONFIG.GRID; x++) {
      const c = grid[y][x];
      const px = offsetX + x * cellSize;
      const py = offsetY + y * cellSize;
      const illum = cellIllumination(c, sunA);
      let base = "#1a1d25";
      if (illum === "sun") base = "#2a2d36";
      else if (illum === "shade") base = "#11141a";
      else base = "#07090d";
      ctx.fillStyle = base;
      ctx.fillRect(px, py, cellSize, cellSize);

      if (c.terrain === "crater") {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.terrain === "rock") {
        ctx.fillStyle = "#555";
        ctx.fillRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
        ctx.strokeStyle = "#777";
        ctx.strokeRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
      }
      if (c.mountain) {
        ctx.fillStyle = "#6b5a3e";
        ctx.beginPath();
        ctx.moveTo(px + cellSize / 2, py + 4);
        ctx.lineTo(px + cellSize - 4, py + cellSize - 4);
        ctx.lineTo(px + 4, py + cellSize - 4);
        ctx.closePath();
        ctx.fill();
      }
      if (c.hasSample) {
        ctx.fillStyle = "#e85d75";
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.strokeRect(px, py, cellSize, cellSize);
    }
  }

  if (state.currentComm || currentCommWindow()) {
    ctx.fillStyle = "rgba(122,215,240,0.08)";
    ctx.fillRect(offsetX, offsetY, cellSize * CONFIG.GRID, cellSize * CONFIG.GRID);
  }

  const rx = offsetX + rover.x * cellSize + cellSize / 2;
  const ry = offsetY + rover.y * cellSize + cellSize / 2;
  drawRover(rx, ry, cellSize * 0.35);

  drawSunDial(sunA, W - 50, 50);

  if (replay) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(10, H - 60, W - 20, 50);
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(`◀ ◀ 回放 T${replay.index}/${state.history.length - 1} ▶ ▶  (按 ← → 翻帧，ESC 退出)`, 20, H - 30);
  }
}

function drawRover(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#7ad7f0";
  ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4);
  ctx.restore();
}

function drawSunDial(angle, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  const r = 26;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  const rad = (angle * Math.PI) / 180;
  const sx = Math.cos(rad) * r;
  const sy = -Math.sin(rad) * r;
  ctx.fillStyle = angle > 0 && angle < 180 ? "#ffd166" : "#556";
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  ctx.fillStyle = "#8892a6";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(angle.toFixed(0) + "°", 0, r + 14);
  ctx.restore();
}

function handleAction(act) {
  if (state.status === "replay") {
    if (act === "replay") exitReplay();
    return;
  }

  if (act === "restart") { resetGame(); return; }
  if (act === "export") { exportReport(); return; }
  if (act === "replay") { startReplay(); return; }

  if (act === "pause") {
    if (state.status === "playing") togglePause();
    else if (state.status === "paused") toggleResume();
    return;
  }

  if (state.status !== "playing") {
    return;
  }

  if (act === "sample") doTurn({ type: "sample" });
  else if (act === "transmit") doTurn({ type: "transmit" });
  else if (act === "wait") doTurn({ type: "wait" });
  else if (act === "N" || act === "S" || act === "E" || act === "W") doTurn({ type: "move", dir: act });
}

document.querySelectorAll("[data-act]").forEach((btn) => {
  btn.addEventListener("click", () => handleAction(btn.getAttribute("data-act")));
});
document.querySelectorAll("[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => handleAction(btn.getAttribute("data-dir")));
});

document.addEventListener("keydown", (e) => {
  if (state.status === "replay") {
    if (e.key === "ArrowRight") replayStep(1);
    else if (e.key === "ArrowLeft") replayStep(-1);
    else if (e.key === "Escape") exitReplay();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") handleAction("N");
  else if (k === "arrowdown") handleAction("S");
  else if (k === "arrowleft" || k === "a") handleAction("W");
  else if (k === "arrowright" || k === "d") handleAction("E");
  else if (k === " ") { e.preventDefault(); handleAction("wait"); }
  else if (k === "s") handleAction("sample");
  else if (k === "t") handleAction("transmit");
  else if (k === "p") handleAction("pause");
  else if (k === "r") handleAction("restart");
});

resetGame();
