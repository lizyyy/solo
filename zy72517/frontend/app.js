var API_BASE = "/api";

var STATUS_LABELS = {
  pending: "待处理",
  normal: "正常",
  duplicate_user: "同一用户重复反馈",
  needs_review: "待标注负责人复核",
  merged: "已归并",
  excluded: "已排除"
};

var IMPORT_SOURCE_LABELS = {
  initial: "首次导入",
  incremental: "增量导入",
  manual: "人工补录"
};

var state = {
  batches: [],
  currentBatchId: null,
  currentBatch: null,
  records: [],
  selectedRecordIds: [],
  currentRecord: null,
  mergeTargetId: null
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  var hh = String(d.getHours()).padStart(2, "0");
  var mm = String(d.getMinutes()).padStart(2, "0");
  return y + "-" + m + "-" + day + " " + hh + ":" + mm;
}

function showToast(message, type) {
  var toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast " + (type || "success");
  toast.style.display = "block";
  setTimeout(function() {
    toast.style.display = "none";
  }, 3000);
}

function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

async function loadBatches() {
  try {
    var res = await fetch(API_BASE + "/batches");
    state.batches = await res.json();
    renderBatchList();
  } catch (e) { console.error(e); showToast("加载批次列表失败", "error"); }
}

function renderBatchList() {
  var container = document.getElementById("batchList");
  if (state.batches.length === 0) {
    container.innerHTML = "<div style=\"color:#999;padding:20px;text-align:center;\">暂无批次</div>";
    return;
  }
  var html = "";
  state.batches.forEach(function(batch) {
    var active = batch.id === state.currentBatchId ? " active" : "";
    var issueBadge = batch.issueCount > 0 ? "<span class=\"issue-badge\">" + batch.issueCount + "</span>" : "";
    html += "<div class=\"batch-item" + active + "\" onclick=\"selectBatch('" + batch.id + "')\">";
    html += "<div class=\"batch-item-name\">" + batch.name + issueBadge + "</div>";
    html += "<div class=\"batch-item-meta\">" + batch.recordCount + "条 · " + formatDate(batch.createdAt) + "</div>";
    html += "</div>";
  });
  container.innerHTML = html;
}

async function selectBatch(batchId) {
  state.currentBatchId = batchId;
  try {
    var res = await fetch(API_BASE + "/batches/" + batchId);
    var data = await res.json();
    state.currentBatch = data.batch;
    state.records = data.records || [];
    var checkResult = data.checkResult;
    renderBatchList();
    renderBatchDetail(state.currentBatch, state.records, checkResult);
  } catch (e) { console.error(e); showToast("加载失败", "error"); }
}

function renderBatchDetail(batch, records, checkResult) {
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("batchDetail").style.display = "block";
  document.getElementById("batchName").textContent = batch.name;
  document.getElementById("batchFile").textContent = batch.fileName || "-";
  document.getElementById("batchTime").textContent = formatDate(batch.createdAt);
  document.getElementById("batchNotes").value = batch.importNotes || "";
  if (checkResult) { renderCheckResult(checkResult); }
  renderRecordsTable();
}

function renderCheckResult(checkResult) {
  document.getElementById("checkResult").style.display = "block";
  var stats = checkResult.stats || {};
  var sc = stats;
  var ec = checkResult.exportCheck || {};
  var impSrc = stats.importSources || {};
  document.getElementById("statTotal").textContent = stats.total || 0;
  document.getElementById("statNormal").textContent = sc.normal || 0;
  document.getElementById("statDuplicate").textContent = sc.duplicateUser || 0;
  document.getElementById("statMerged").textContent = sc.merged || 0;
  document.getElementById("statExcluded").textContent = sc.excluded || 0;
  document.getElementById("statPending").textContent = sc.pending || 0;
  document.getElementById("statInitial").textContent = impSrc.initial || 0;
  document.getElementById("statIncremental").textContent = impSrc.incremental || 0;
  document.getElementById("exportCheck").textContent = ec.warning || "";
  var issues = checkResult.issues || [];
  var issueHtml = "";
  issues.forEach(function(issue) { issueHtml += "<div class=\"issue " + issue.severity + "\">" + issue.message + "</div>"; });
  document.getElementById("issueList").innerHTML = issueHtml;
}

function renderRecordsTable() {
  var statusFilter = document.getElementById("statusFilter").value;
  var userIdFilter = document.getElementById("userIdFilter").value.toLowerCase();
  var filtered = state.records.filter(function(r) {
    if (statusFilter && r.status !== statusFilter) return false;
    if (userIdFilter && (r.userId || "").toLowerCase().indexOf(userIdFilter) === -1) return false;
    return true;
  });
  document.getElementById("recordCount").textContent = "共 " + filtered.length + " 条";
  var tbody = document.getElementById("recordsTableBody");
  if (filtered.length === 0) { tbody.innerHTML = "<tr><td colspan=\"8\" style=\"text-align:center;color:#999;padding:40px;\">暂无记录</td></tr>"; return; }
  tbody.innerHTML = filtered.map(function(r) {
    var checked = state.selectedRecordIds.indexOf(r.id) >= 0 ? "checked" : "";
    var importSourceLabel = IMPORT_SOURCE_LABELS[r.importSource] || r.importSource || "-";
    var statusLabel = STATUS_LABELS[r.status] || r.status;
    var html = "<tr>";
    html += "<td><input type=\"checkbox\" class=\"record-checkbox\" data-id=\"" + r.id + "\" " + checked + "></td>";
    html += "<td>" + (r.originalLineNumber || "-") + "</td>";
    html += "<td>" + importSourceLabel + "</td>";
    html += "<td>" + (r.userId || "-") + "</td>";
    html += "<td>" + (r.questionText || "-") + "</td>";
    html += "<td><span class=\"status-tag status-" + r.status + "\">" + statusLabel + "</span></td>";
    html += "<td>" + (r.statusUpdatedBy || "-") + "</td>";
    html += "<td><button class=\"btn btn-small btn-secondary\" onclick=\"openRecordDetail(\\\"" + r.id + "\\\")\">详情</button></td>";
    html += "</tr>";
    return html;
  }).join("");
  updateMergeBar();
}

function updateMergeBar() {
  var bar = document.getElementById("mergeBar");
  document.getElementById("selectedCount").textContent = state.selectedRecordIds.length;
  bar.style.display = state.selectedRecordIds.length > 0 ? "block" : "none";
}

function openRecordDetail(recordId) {
  var record = state.records.find(function(r) { return r.id === recordId; });
  if (!record) return;
  state.currentRecord = record;
  var html = "<p><b>用户ID：</b>" + (record.userId || "-") + "</p>";
  html += "<p><b>问题文本：</b>" + (record.questionText || "-") + "</p>";
  html += "<p><b>当前状态：</b>" + (STATUS_LABELS[record.status] || record.status) + "</p>";
  html += "<p><label>修改状态：</label><select id=\"editStatus\">";
  Object.keys(STATUS_LABELS).forEach(function(s) { html += "<option value=\"" + s + "\"" + (record.status === s ? " selected" : "") + ">" + STATUS_LABELS[s] + "</option>"; });
  html += "</select></p>";
  html += "<p><label>操作人：</label><input type=\"text\" id=\"editOperator\" value=\"算法运营-老唐\"></p>";
  html += "<p><label>原因备注：</label><textarea id=\"editReason\"></textarea></p>";
  html += "<button class=\"btn btn-primary\" onclick=\"saveRecordEdit()\">保存修改</button>";
  document.getElementById("recordDetailBody").innerHTML = html;
  openModal("recordDetailModal");
}

async function saveRecordEdit() {
  if (!state.currentRecord) return;
  var newStatus = document.getElementById("editStatus").value;
  var operator = document.getElementById("editOperator").value;
  var reason = document.getElementById("editReason").value;
  try {
    var res = await fetch(API_BASE + "/batches/" + state.currentBatchId + "/records/" + state.currentRecord.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, operator: operator, reason: reason })
    });
    if (res.ok) { showToast("保存成功"); closeModal("recordDetailModal"); await selectBatch(state.currentBatchId); }
    else { showToast("保存失败", "error"); }
  } catch (e) { showToast("保存失败", "error"); }
}

function openRenameModal() {
  document.getElementById("newBatchNameInput").value = state.currentBatch ? state.currentBatch.name : "";
  openModal("renameBatchModal");
}

async function confirmRename() {
  var newName = document.getElementById("newBatchNameInput").value.trim();
  if (!newName) { showToast("请输入批次名称", "error"); return; }
  try {
    var res = await fetch(API_BASE + "/batches/" + state.currentBatchId + "/rename", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    });
    if (res.ok) { showToast("重命名成功"); closeModal("renameBatchModal"); await loadBatches(); await selectBatch(state.currentBatchId); }
    else { var err = await res.json(); showToast(err.error || "重命名失败", "error"); }
  } catch (e) { showToast("重命名失败", "error"); }
}

async function runCheck() {
  try {
    var res = await fetch(API_BASE + "/batches/" + state.currentBatchId + "/check");
    var result = await res.json();
    if (result.valid) { showToast("自检完成"); await selectBatch(state.currentBatchId); }
    else { showToast(result.error || "自检失败", "error"); }
  } catch (e) { showToast("自检失败", "error"); }
}

async function saveNotes() {
  var notes = document.getElementById("batchNotes").value;
  try {
    var res = await fetch(API_BASE + "/batches/" + state.currentBatchId + "/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importNotes: notes })
    });
    if (res.ok) showToast("备注已保存");
    else showToast("保存失败", "error");
  } catch (e) { showToast("保存失败", "error"); }
}

function exportBatch() {
  window.open(API_BASE + "/batches/" + state.currentBatchId + "/export?format=csv", "_blank");
}

async function createBatch() {
  var name = document.getElementById("newBatchName").value.trim();
  var fileInput = document.getElementById("csvFile");
  if (!name) { showToast("请输入批次名称", "error"); return; }
  if (!fileInput.files || !fileInput.files[0]) { showToast("请选择CSV文件", "error"); return; }
  var formData = new FormData();
  formData.append("batchName", name);
  formData.append("operator", "老唐");
  formData.append("file", fileInput.files[0]);
  try {
    var res = await fetch(API_BASE + "/batches", { method: "POST", body: formData });
    var result = await res.json();
    if (res.ok) {
      showToast("导入成功：新增" + (result.incrementalDiff ? result.incrementalDiff.newCount : result.recordCount) + "条，复用" + (result.incrementalDiff ? result.incrementalDiff.reusedCount : 0) + "条");
      closeModal("createBatchModal");
      document.getElementById("newBatchName").value = "";
      fileInput.value = "";
      await loadBatches();
      if (result.batch && result.batch.id) await selectBatch(result.batch.id);
    } else {
      showToast(result.error || "导入失败", "error");
    }
  } catch (e) { showToast("导入失败", "error"); }
}

async function runRecheck() {
  if (!state.currentBatchId) return;
  try {
    var res = await fetch(API_BASE + "/batches/" + state.currentBatchId + "/recheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operator: "老唐" })
    });
    var result = await res.json();
    if (result.success) { showToast(result.message || "重算完成"); await selectBatch(state.currentBatchId); }
    else { showToast(result.error || "重算失败", "error"); }
  } catch (e) { showToast("重算失败", "error"); }
}

function openMergeTargetModal() {
  if (state.selectedRecordIds.length < 2) { showToast("请至少选择2条记录进行归并", "error"); return; }
  var listHtml = "";
  state.selectedRecordIds.forEach(function(id) {
    var record = state.records.find(function(r) { return r.id === id; });
    if (!record) return;
    listHtml += "<div class=\"merge-target-item\" onclick=\"selectMergeTarget('" + id + "')\">";
    listHtml += "<input type=\"radio\" name=\"mergeTarget\" value=\"" + id + "\" id=\"target_" + id + "\">";
    listHtml += "<label for=\"target_" + id + "\">";
    listHtml += "<div><b>行号 " + (record.originalLineNumber || "-") + "</b> · 用户ID: " + (record.userId || "-") + "</div>";
    listHtml += "<div class=\"merge-target-text\">" + (record.questionText || "").substring(0, 100) + "</div>";
    listHtml += "</label>";
    listHtml += "</div>";
  });
  document.getElementById("mergeTargetList").innerHTML = listHtml;
  state.mergeTargetId = null;
  openModal("mergeTargetModal");
}

function selectMergeTarget(id) {
  state.mergeTargetId = id;
  document.querySelectorAll("input[name='mergeTarget']").forEach(function(rb) {
    rb.checked = rb.value === id;
  });
}

async function confirmMerge() {
  if (!state.mergeTargetId) { showToast("请选择主记录", "error"); return; }
  var sourceIds = state.selectedRecordIds.filter(function(id) { return id !== state.mergeTargetId; });
  if (sourceIds.length === 0) { showToast("请选择要归并的记录", "error"); return; }
  try {
    var res = await fetch(API_BASE + "/batches/" + state.currentBatchId + "/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceRecordIds: sourceIds,
        targetRecordId: state.mergeTargetId,
        operator: "老唐"
      })
    });
    var result = await res.json();
    if (result.success) {
      showToast("归并成功");
      closeModal("mergeTargetModal");
      state.selectedRecordIds = [];
      state.mergeTargetId = null;
      document.getElementById("selectAll").checked = false;
      await selectBatch(state.currentBatchId);
    } else {
      showToast(result.error || "归并失败", "error");
    }
  } catch (e) { showToast("归并失败", "error"); }
}

document.addEventListener("DOMContentLoaded", function() {
  loadBatches();
  document.getElementById("createBatchBtn").addEventListener("click", function() { openModal("createBatchModal"); });
  document.getElementById("confirmCreateBatchBtn").addEventListener("click", createBatch);
  document.getElementById("renameBatchBtn").addEventListener("click", openRenameModal);
  document.getElementById("confirmRenameBtn").addEventListener("click", confirmRename);
  document.getElementById("checkBtn").addEventListener("click", runCheck);
  document.getElementById("recheckBtn").addEventListener("click", runRecheck);
  document.getElementById("saveNotesBtn").addEventListener("click", saveNotes);
  document.getElementById("exportBtn").addEventListener("click", exportBatch);
  document.getElementById("mergeBtn").addEventListener("click", openMergeTargetModal);
  document.getElementById("confirmMerge").addEventListener("click", confirmMerge);
  document.getElementById("statusFilter").addEventListener("change", renderRecordsTable);
  document.getElementById("userIdFilter").addEventListener("input", renderRecordsTable);
  document.getElementById("selectAll").addEventListener("change", function(e) {
    var checked = e.target.checked;
    var checkboxes = document.querySelectorAll(".record-checkbox");
    state.selectedRecordIds = [];
    checkboxes.forEach(function(cb) { if (checked) state.selectedRecordIds.push(cb.dataset.id); cb.checked = checked; });
    updateMergeBar();
  });
  document.getElementById("cancelSelectBtn").addEventListener("click", function() {
    state.selectedRecordIds = [];
    document.getElementById("selectAll").checked = false;
    renderRecordsTable();
  });
  document.body.addEventListener("change", function(e) {
    if (e.target.classList.contains("record-checkbox")) {
      var id = e.target.dataset.id;
      if (e.target.checked) { if (state.selectedRecordIds.indexOf(id) < 0) state.selectedRecordIds.push(id); }
      else { state.selectedRecordIds = state.selectedRecordIds.filter(function(x) { return x !== id; }); }
      updateMergeBar();
    }
  });
});
